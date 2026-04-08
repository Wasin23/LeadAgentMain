import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { sendPlanUpgradedEmail, sendPlanCancelledEmail, sendPlanChangedEmail } from '../utils/billingEmails.js';

const router = express.Router();
const awsManager = new AWSManager();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Prices in cents; must match the frontend pricingTiers
const PLAN_PRICES_CENTS = {
  basic:        10000,   // $100
  starter:      50000,   // $500
  professional: 100000,  // $1,000
  enterprise:   250000,  // $2,500
};

// Get user's current plan and credit status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const status = await awsManager.getUserPlanStatus(userId);
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('[PLANS] Error getting plan status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available plans
router.get('/available', async (req, res) => {
  try {
    const plans = awsManager.getAvailablePlans();
    
    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('[PLANS] Error getting available plans:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update user's plan
router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planType } = req.body;

    if (!planType) {
      return res.status(400).json({ success: false, error: 'Plan type is required' });
    }

    const planPriceCents = PLAN_PRICES_CENTS[planType];
    if (!planPriceCents) {
      return res.status(400).json({ success: false, error: `Invalid plan type: ${planType}` });
    }

    // Require a saved payment method
    const [user, userSettings] = await Promise.all([
      awsManager.getUserById(userId),
      awsManager.getUserSettings(userId),
    ]);

    let paymentMethodId = userSettings?.defaultPaymentMethodId;

    // Fall back to Stripe if defaultPaymentMethodId not saved locally
    if (!paymentMethodId && user?.stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        paymentMethodId = customer?.invoice_settings?.default_payment_method || null;
        // If still nothing, grab the first attached card
        if (!paymentMethodId) {
          const pms = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card', limit: 1 });
          paymentMethodId = pms.data[0]?.id || null;
        }
        // Persist it so future checks are instant
        if (paymentMethodId) {
          await awsManager.saveUserSettings(userId, { ...userSettings, defaultPaymentMethodId: paymentMethodId });
        }
      } catch (e) {
        console.error('[PLANS] Stripe customer lookup failed:', e.message);
      }
    }

    if (!user?.stripeCustomerId || !paymentMethodId) {
      return res.status(402).json({
        success: false,
        error: 'No payment method on file. Please add a payment method in Settings before upgrading.',
      });
    }

    // Charge via Stripe before touching the DB
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: planPriceCents,
        currency: 'usd',
        customer: user.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Meridian ${planType} plan`,
        metadata: { userId, planType },
      });
    } catch (stripeErr) {
      console.error('[PLANS] Stripe charge failed:', stripeErr.message);
      const msg = stripeErr.code === 'authentication_required'
        ? 'Your card requires additional authentication. Please update your payment method in Settings.'
        : stripeErr.message || 'Payment failed';
      return res.status(402).json({ success: false, error: msg });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        success: false,
        error: `Payment not completed (status: ${paymentIntent.status})`,
      });
    }

    const result = await awsManager.updateUserPlan(userId, planType);

    // Send upgrade confirmation email (non-blocking)
    try {
      const fromPlanName = awsManager.getPlanConfig(user.plan || 'free-trial').name;
      const toPlanName = awsManager.getPlanConfig(planType).name;
      sendPlanUpgradedEmail(userId, user.email, fromPlanName, toPlanName, planPriceCents / 100).catch(() => {});
    } catch {}

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[PLANS] Error upgrading plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Purchase additional credits
router.post('/purchase-credits', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { creditAmount } = req.body;

    if (!creditAmount || creditAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid credit amount is required' });
    }

    // Require a saved payment method
    const [user, userSettings] = await Promise.all([
      awsManager.getUserById(userId),
      awsManager.getUserSettings(userId),
    ]);

    let paymentMethodId = userSettings?.defaultPaymentMethodId;

    // Fall back to Stripe if defaultPaymentMethodId not saved locally
    if (!paymentMethodId && user?.stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        paymentMethodId = customer?.invoice_settings?.default_payment_method || null;
        if (!paymentMethodId) {
          const pms = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card', limit: 1 });
          paymentMethodId = pms.data[0]?.id || null;
        }
        if (paymentMethodId) {
          await awsManager.saveUserSettings(userId, { ...userSettings, defaultPaymentMethodId: paymentMethodId });
        }
      } catch (e) {
        console.error('[CREDITS] Stripe customer lookup failed:', e.message);
      }
    }

    if (!user?.stripeCustomerId || !paymentMethodId) {
      return res.status(402).json({
        success: false,
        error: 'No payment method on file. Please add a payment method in Settings before purchasing credits.',
      });
    }

    // $0.05 per credit = 5 cents per credit
    const amountCents = Math.round(creditAmount * 5);

    // Charge via Stripe before touching the DB
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: user.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Meridian ${creditAmount} credit top-up`,
        metadata: { userId, creditAmount: String(creditAmount) },
      });
    } catch (stripeErr) {
      console.error('[CREDITS] Stripe charge failed:', stripeErr.message);
      const msg = stripeErr.code === 'authentication_required'
        ? 'Your card requires additional authentication. Please update your payment method in Settings.'
        : stripeErr.message || 'Payment failed';
      return res.status(402).json({ success: false, error: msg });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        success: false,
        error: `Payment not completed (status: ${paymentIntent.status})`,
      });
    }

    const result = await awsManager.purchaseCredits(userId, creditAmount);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[CREDITS] Error purchasing credits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get credit purchase history
router.get('/purchase-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // For now, just return the last purchase from user object
    // In production, you'd want a separate purchase history table
    const user = await awsManager.getUserById(userId);
    const lastPurchase = user?.lastCreditPurchase;
    
    res.json({
      success: true,
      purchases: lastPurchase ? [lastPurchase] : []
    });
  } catch (error) {
    console.error('[PLANS] Error getting purchase history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PLAN_ORDER = ['free-trial', 'basic', 'starter', 'professional', 'enterprise'];

// Cancel plan — reverts to free-trial, keeps existing credits
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await awsManager.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const currentPlan = user.plan || 'free-trial';
    if (currentPlan === 'free-trial') {
      return res.status(400).json({ success: false, error: 'You are already on the free trial.' });
    }

    const freePlanConfig = awsManager.getPlanConfig('free-trial');
    await awsManager.updateUser(userId, {
      plan: 'free-trial',
      maxAgents: freePlanConfig.maxAgents,
      maxConcurrency: freePlanConfig.maxConcurrency,
      maxCredits: freePlanConfig.maxCredits,
      planUpdatedAt: new Date().toISOString(),
    });

    const fromPlanName = awsManager.getPlanConfig(currentPlan).name;
    sendPlanCancelledEmail(userId, user.email, fromPlanName).catch(() => {});

    console.log(`📋 [PLANS] User ${userId} cancelled plan (was ${currentPlan})`);
    res.json({ success: true, message: 'Plan cancelled. You are now on the Free Trial.' });
  } catch (error) {
    console.error('[PLANS] Error cancelling plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Downgrade plan — moves to a lower paid tier, no charge, keeps existing credits
router.post('/downgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planType } = req.body;

    if (!planType) return res.status(400).json({ success: false, error: 'planType is required' });

    const user = await awsManager.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const currentPlan = user.plan || 'free-trial';
    const currentIdx = PLAN_ORDER.indexOf(currentPlan);
    const newIdx = PLAN_ORDER.indexOf(planType);

    if (newIdx === -1) return res.status(400).json({ success: false, error: `Invalid plan: ${planType}` });
    if (newIdx === 0) return res.status(400).json({ success: false, error: 'Use the cancel endpoint to revert to Free Trial.' });
    if (newIdx >= currentIdx) return res.status(400).json({ success: false, error: 'Use the upgrade endpoint to move to a higher plan.' });

    const newPlanConfig = awsManager.getPlanConfig(planType);
    await awsManager.updateUser(userId, {
      plan: planType,
      maxAgents: newPlanConfig.maxAgents,
      maxConcurrency: newPlanConfig.maxConcurrency,
      maxCredits: newPlanConfig.maxCredits,
      planUpdatedAt: new Date().toISOString(),
    });

    const fromPlanName = awsManager.getPlanConfig(currentPlan).name;
    sendPlanChangedEmail(userId, user.email, fromPlanName, newPlanConfig.name).catch(() => {});

    console.log(`📋 [PLANS] User ${userId} downgraded from ${currentPlan} to ${planType}`);
    res.json({ success: true, message: `Downgraded to ${newPlanConfig.name}.`, plan: newPlanConfig });
  } catch (error) {
    console.error('[PLANS] Error downgrading plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;