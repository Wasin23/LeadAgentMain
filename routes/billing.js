import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get payment methods for user
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get or create Stripe customer
    const { awsManager } = await import('../utils/awsManager.js');
    const userSettings = await awsManager.getUserSettings(userId);
    
    let customerId = userSettings?.stripeCustomerId;
    
    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: { userId }
      });
      customerId = customer.id;
      
      // Save to AWS
      await awsManager.saveUserSettings(userId, {
        ...userSettings,
        stripeCustomerId: customerId
      });
    }
    
    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    
    res.json({
      success: true,
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        isDefault: pm.id === userSettings?.defaultPaymentMethodId
      }))
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Create setup intent for adding card
router.post('/setup-intent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get or create Stripe customer
    const { awsManager } = await import('../utils/awsManager.js');
    const userSettings = await awsManager.getUserSettings(userId);
    
    let customerId = userSettings?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId }
      });
      customerId = customer.id;
      
      await awsManager.saveUserSettings(userId, {
        ...userSettings,
        stripeCustomerId: customerId
      });
    }
    
    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card']
    });
    
    res.json({
      success: true,
      clientSecret: setupIntent.client_secret
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error creating setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

// Set default payment method
router.post('/set-default-payment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { paymentMethodId } = req.body;
    
    const { awsManager } = await import('../utils/awsManager.js');
    const userSettings = await awsManager.getUserSettings(userId);
    
    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      defaultPaymentMethodId: paymentMethodId
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ [BILLING] Error setting default payment:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

// Remove payment method
router.delete('/payment-methods/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await stripe.paymentMethods.detach(id);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ [BILLING] Error removing payment method:', error);
    res.status(500).json({ error: 'Failed to remove payment method' });
  }
});

// Charge for token usage
router.post('/charge-tokens', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, description } = req.body; // amount in cents
    
    const { awsManager } = await import('../utils/awsManager.js');
    const userSettings = await awsManager.getUserSettings(userId);
    
    if (!userSettings?.defaultPaymentMethodId) {
      return res.status(400).json({ error: 'No payment method on file' });
    }
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: userSettings.stripeCustomerId,
      payment_method: userSettings.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      description: description || 'API token usage',
      metadata: { userId }
    });
    
    res.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount
      }
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error charging tokens:', error);
    res.status(500).json({ error: error.message || 'Failed to charge payment method' });
  }
});

export default router;
