import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { 
  sendPaymentFailedEmail, 
  sendPaymentSuccessEmail, 
  sendAccountSuspendedEmail,
  sendAccountReactivatedEmail 
} from '../utils/billingEmails.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const awsManager = new AWSManager();

// Get payment status
router.get('/payment-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSettings = await awsManager.getUserSettings(userId);
    
    res.json({
      status: userSettings?.paymentStatus || 'active',
      gracePeriodEnd: userSettings?.gracePeriodEnd,
      lastChargeDate: userSettings?.lastChargeDate,
      lastFailedCharge: userSettings?.lastFailedCharge
    });
  } catch (error) {
    console.error('❌ [BILLING] Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Get payment methods for user
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get or create Stripe customer
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
    
    const userSettings = await awsManager.getUserSettings(userId);
    
    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      defaultPaymentMethodId: paymentMethodId
    });
    
    // If payment previously failed, retry charge
    if (userSettings?.paymentStatus === 'payment_failed' && userSettings?.lastFailedCharge) {
      try {
        console.log('💳 [BILLING] Retrying failed charge after card update...');
        
        const amountInCents = Math.round(userSettings.lastFailedCharge.amount * 100);
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          customer: userSettings.stripeCustomerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: 'Retry failed payment',
          metadata: { 
            userId,
            retryAttempt: 'true'
          }
        });
        
        // Success - reactivate account
        await awsManager.saveUserSettings(userId, {
          ...userSettings,
          defaultPaymentMethodId: paymentMethodId,
          paymentStatus: 'active',
          lastChargeDate: new Date().toISOString(),
          lastChargeAmount: userSettings.lastFailedCharge.amount,
          gracePeriodEnd: null,
          lastFailedCharge: null
        });
        
        // Send reactivation email
        if (userSettings.email) {
          await sendAccountReactivatedEmail(userId, userSettings.email);
        }
        
        console.log('✅ [BILLING] Charge retry successful, account reactivated');
        
        return res.json({ 
          success: true,
          accountReactivated: true,
          message: 'Payment method updated and account reactivated'
        });
        
      } catch (retryError) {
        console.error('❌ [BILLING] Charge retry failed:', retryError.message);
        // Card updated but charge still failed - don't block the response
      }
    }
    
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

// Monthly billing - charge all users for API usage
router.post('/charge-monthly', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to trigger monthly billing
    // TODO: Add admin check or use cron job authentication
    
    console.log('💰 [BILLING] Starting monthly billing cycle...');
    
    // Get all users with Stripe customers
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const scanCommand = new ScanCommand({
      TableName: awsManager.tables.userSettings,
      FilterExpression: 'attribute_exists(stripeCustomerId)'
    });
    
    const { Items: users } = await awsManager.dynamodb.send(scanCommand);
    console.log(`📊 [BILLING] Found ${users?.length || 0} users with payment methods`);
    
    const results = {
      total: users?.length || 0,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (const user of users || []) {
      try {
        const userId = user.userId;
        
        // Skip if already charged this month
        const lastChargeDate = user.lastChargeDate;
        if (lastChargeDate) {
          const lastCharge = new Date(lastChargeDate);
          const now = new Date();
          if (lastCharge.getMonth() === now.getMonth() && lastCharge.getFullYear() === now.getFullYear()) {
            console.log(`⏭️ [BILLING] Skipping ${userId} - already charged this month`);
            continue;
          }
        }
        
        // Get usage from api-usage table for this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
        const usageQuery = new QueryCommand({
          TableName: awsManager.tables.apiUsage,
          KeyConditionExpression: 'userId = :userId AND #timestamp >= :startDate',
          ExpressionAttributeNames: {
            '#timestamp': 'timestamp'
          },
          ExpressionAttributeValues: {
            ':userId': userId,
            ':startDate': startOfMonth.toISOString()
          }
        });
        
        const { Items: usageRecords } = await awsManager.dynamodb.send(usageQuery);
        
        // Calculate total cost
        let totalCost = 0;
        for (const record of usageRecords || []) {
          totalCost += record.cost || 0;
        }
        
        // Convert to cents and round
        const amountInCents = Math.round(totalCost * 100);
        
        console.log(`💵 [BILLING] User ${userId}: $${totalCost.toFixed(2)} (${amountInCents} cents)`);
        
        // Skip if no charges
        if (amountInCents === 0) {
          console.log(`⏭️ [BILLING] Skipping ${userId} - no usage this month`);
          continue;
        }
        
        // Charge the card
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            customer: user.stripeCustomerId,
            payment_method: user.defaultPaymentMethodId,
            off_session: true,
            confirm: true,
            description: `Monthly API usage - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            metadata: { 
              userId,
              billingPeriod: `${startOfMonth.toISOString()}`,
              recordCount: usageRecords?.length || 0
            }
          });
          
          // Update user settings with success
          await awsManager.saveUserSettings(userId, {
            ...user,
            paymentStatus: 'active',
            lastChargeDate: new Date().toISOString(),
            lastChargeAmount: totalCost,
            gracePeriodEnd: null
          });
          
          // Send success email
          if (user.email) {
            await sendPaymentSuccessEmail(userId, user.email, totalCost);
          }
          
          console.log(`✅ [BILLING] Charged ${userId}: $${totalCost.toFixed(2)}`);
          results.successful++;
          
        } catch (chargeError) {
          console.error(`❌ [BILLING] Charge failed for ${userId}:`, chargeError.message);
          
          // Set grace period (7 days)
          const gracePeriodEnd = new Date();
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
          
          // Update user settings with failure
          await awsManager.saveUserSettings(userId, {
            ...user,
            paymentStatus: 'payment_failed',
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            lastFailedCharge: {
              date: new Date().toISOString(),
              amount: totalCost,
              error: chargeError.message
            }
          });
          
          // Send failed payment email
          if (user.email) {
            await sendPaymentFailedEmail(userId, user.email, totalCost, chargeError.message);
          }
          
          results.failed++;
          results.errors.push({
            userId,
            amount: totalCost,
            error: chargeError.message
          });
        }
        
      } catch (userError) {
        console.error(`❌ [BILLING] Error processing user:`, userError);
        results.errors.push({
          userId: user.userId,
          error: userError.message
        });
      }
    }
    
    console.log('✅ [BILLING] Monthly billing complete:', results);
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error in monthly billing:', error);
    res.status(500).json({ error: error.message || 'Failed to process monthly billing' });
  }
});

export default router;
