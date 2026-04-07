import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

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
    if (!user?.stripeCustomerId || !userSettings?.defaultPaymentMethodId) {
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
        payment_method: userSettings.defaultPaymentMethodId,
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
    if (!user?.stripeCustomerId || !userSettings?.defaultPaymentMethodId) {
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
        payment_method: userSettings.defaultPaymentMethodId,
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

export default router;