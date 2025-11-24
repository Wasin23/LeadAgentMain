import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/jwt.js';
import { getTrialCreditStatus } from '../middleware/apiCostTracker.js';
import AWSManager from '../utils/awsManager.js';
import { broadcastActivity } from './monitoring.js';
import { 
  sendPaymentFailedEmail, 
  sendPaymentSuccessEmail, 
  sendAccountSuspendedEmail,
  sendAccountReactivatedEmail 
} from '../utils/billingEmails.js';

// Activity logging helper - creates single critical issue for billing failures
async function logBillingActivity(userId, action, details, status = 'success') {
  try {
    const awsManager = new AWSManager();
    const timestamp = new Date().toISOString();
    
    // Console log only
    console.log(`💰 [BILLING LOG] ${timestamp} - User: ${userId} - Action: ${action} - Status: ${status}`);
    console.log(`   Details:`, details);
    
    // Only create critical issue for failures (shows in notifications AND activity feed)
    if (status === 'failed' || status === 'error') {
      try {
        const issueResult = await awsManager.addIssue(
          userId,
          'billing',
          `💳 Payment ${action} Failed`,
          details.error || details.message || 'Unknown error',
          {
            severity: 'critical',
            amount: details.amount,
            currency: details.currency || 'USD',
            timestamp
          }
        );
        console.log('✅ [BILLING LOG] Critical issue created:', issueResult);
        
        // Broadcast the billing failure to SSE clients immediately
        broadcastActivity({
          type: 'error',
          category: 'issue',
          severity: 'critical',
          title: `💳 Payment ${action} Failed`,
          message: details.error || details.message || 'Unknown error',
          timestamp,
          metadata: {
            amount: details.amount,
            currency: details.currency || 'USD'
          }
        });
        console.log('📡 [BILLING LOG] Broadcasted billing failure to SSE clients');
      } catch (issueError) {
        console.error('❌ [BILLING LOG] Failed to create issue:', issueError.message);
        console.error('   Stack:', issueError.stack);
      }
    }
  } catch (error) {
    console.error('❌ [BILLING LOG] Error logging activity:', error);
  }
}

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const awsManager = new AWSManager();

// Get trial credit status
router.get('/trial-credits', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('🔵 [BILLING] Getting trial credits for user:', userId);
    const creditStatus = await getTrialCreditStatus(userId);
    console.log('🔵 [BILLING] Trial credit status:', creditStatus);
    
    res.json({
      success: true,
      credits: creditStatus
    });
  } catch (error) {
    console.error('❌ [BILLING] Error getting trial credits:', error);
    res.status(500).json({ error: 'Failed to get trial credit status' });
  }
});

// Add payment method and unlock unlimited API usage
router.post('/add-payment-method', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }
    
    // Get user
    const user = await awsManager.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let customerId = user.stripeCustomerId;
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId,
          username: user.username
        }
      });
      customerId = customer.id;
      
      await awsManager.updateUser(userId, {
        stripeCustomerId: customerId
      });
    }
    
    // Attach payment method to customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      console.log('✅ [BILLING] Payment method attached successfully');
    } catch (attachError) {
      // If already attached to a different customer, detach and reattach
      if (attachError.message?.includes('already been attached')) {
        console.log('⚠️ [BILLING] Payment method already attached to another customer, detaching...');
        try {
          // Detach from old customer
          await stripe.paymentMethods.detach(paymentMethodId);
          console.log('✅ [BILLING] Payment method detached from old customer');
          
          // Attach to current customer
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId
          });
          console.log('✅ [BILLING] Payment method attached to current customer');
        } catch (detachError) {
          console.error('❌ [BILLING] Error during detach/reattach:', detachError.message);
          throw detachError;
        }
      } else if (attachError.code !== 'resource_missing') {
        throw attachError;
      }
    }
    
    // Verify payment method is attached to this customer before setting as default
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== customerId) {
      throw new Error('Payment method is not attached to this customer');
    }
    
    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
    console.log('✅ [BILLING] Payment method set as default');
    
    // Update user to indicate payment method added (unlocks unlimited API usage)
    console.log('🔵 [BILLING] Updating user with paymentMethodAdded=true...');
    const updateResult = await awsManager.updateUser(userId, {
      paymentMethodAdded: true,
      stripeCustomerId: customerId
    });
    console.log('✅ [BILLING] User update result:', updateResult);
    console.log(`✅ [BILLING] Payment method added for user ${userId} - Trial restrictions removed`);
    
    res.json({
      success: true,
      message: 'Payment method added successfully. You now have unlimited API usage!',
      customerId: customerId
    });
  } catch (error) {
    console.error('❌ [BILLING] Error adding payment method:', error);
    res.status(500).json({ 
      error: 'Failed to add payment method',
      message: error.message 
    });
  }
});

// Get payment status
router.get('/payment-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSettings = await awsManager.getUserSettings(userId);
    
    // Calculate next payment due date (1st of next month at 2am)
    const now = new Date();
    const nextPaymentDue = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0);
    
    res.json({
      status: userSettings?.paymentStatus || 'active',
      gracePeriodEnd: userSettings?.gracePeriodEnd,
      lastChargeDate: userSettings?.lastChargeDate,
      lastFailedCharge: userSettings?.lastFailedCharge,
      nextPaymentDue: nextPaymentDue.toISOString()
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
    console.log('🔵 [BILLING] Fetching payment methods for user:', userId);
    
    // Get or create Stripe customer
    const userSettings = await awsManager.getUserSettings(userId);
    console.log('🔵 [BILLING] User settings:', userSettings);
    
    let customerId = userSettings?.stripeCustomerId;
    console.log('🔵 [BILLING] Existing customer ID:', customerId);
    
    if (!customerId) {
      console.log('🔵 [BILLING] Creating new Stripe customer...');
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: { userId }
      });
      customerId = customer.id;
      console.log('✅ [BILLING] Created Stripe customer:', customerId);
      
      // Save to AWS
      await awsManager.saveUserSettings(userId, {
        ...userSettings,
        stripeCustomerId: customerId
      });
      console.log('✅ [BILLING] Saved customer ID to user settings');
    }
    
    // Get payment methods
    console.log('🔵 [BILLING] Fetching payment methods from Stripe...');
    let paymentMethods;
    try {
      paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
    } catch (stripeError) {
      // If customer doesn't exist (switched from test to live mode), create new one
      if (stripeError.code === 'resource_missing') {
        console.log('⚠️ [BILLING] Customer not found in Stripe, creating new one...');
        const newCustomer = await stripe.customers.create({
          metadata: { userId }
        });
        customerId = newCustomer.id;
        console.log('✅ [BILLING] Created new Stripe customer:', customerId);
        
        // Update user settings with new customer ID
        await awsManager.saveUserSettings(userId, {
          ...userSettings,
          stripeCustomerId: customerId,
          defaultPaymentMethodId: null // Clear old payment method ID
        });
        console.log('✅ [BILLING] Updated user settings with new customer ID');
        
        // Try again with new customer
        paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card'
        });
      } else {
        throw stripeError;
      }
    }
    console.log('✅ [BILLING] Found', paymentMethods.data.length, 'payment methods');
    
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
    console.error('❌ [BILLING] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch payment methods',
      message: error.message 
    });
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
        
        // Log successful reactivation
        await logBillingActivity(userId, 'Account Reactivation', {
          amount: userSettings.lastFailedCharge.amount,
          paymentMethodId,
          retriedCharge: true
        }, 'success');
        
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

// Extracted billing logic for direct calls (from admin or cron)
export async function scanUsersAndCharge() {
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
        
          // Log payment to history
          await awsManager.logPayment(userId, {
            amount: totalCost,
            status: 'success',
            currency: 'USD',
            stripePaymentIntentId: paymentIntent.id,
            billingPeriod: startOfMonth.toISOString(),
            description: `Monthly API usage - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
          });
        
          // Send success email
          if (user.email) {
            await sendPaymentSuccessEmail(userId, user.email, totalCost);
          }
          
          // Log successful billing
          await logBillingActivity(userId, 'Monthly Charge', {
            amount: totalCost,
            currency: 'USD',
            paymentIntentId: paymentIntent.id,
            billingPeriod: startOfMonth.toISOString()
          }, 'success');
          
          console.log(`✅ [BILLING] Charged ${userId}: $${totalCost.toFixed(2)}`);
          results.successful++;      } catch (chargeError) {
        console.error(`❌ [BILLING] Charge failed for ${userId}:`, chargeError.message);
        
        // Log failed payment to history
        await awsManager.logPayment(userId, {
          amount: totalCost,
          status: 'failed',
          currency: 'USD',
          stripePaymentIntentId: null,
          billingPeriod: startOfMonth.toISOString(),
          description: `Monthly API usage - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          errorMessage: chargeError.message
        });
        
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
        
        // Log failed billing and create alert
        await logBillingActivity(userId, 'Monthly Charge', {
          amount: totalCost,
          currency: 'USD',
          error: chargeError.message,
          gracePeriodEnd: gracePeriodEnd.toISOString()
        }, 'failed');
        
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
  return results;
}

// Monthly billing - charge all users for API usage
router.post('/charge-monthly', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to trigger monthly billing
    // TODO: Add admin check or use cron job authentication
    
    const results = await scanUsersAndCharge();
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error in monthly billing:', error);
    res.status(500).json({ error: error.message || 'Failed to process monthly billing' });
  }
});

// Get payment history for user
router.get('/payment-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;
    
    const history = await awsManager.getPaymentHistory(userId, limit);
    
    res.json({
      success: true,
      payments: history
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error getting payment history:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// Get payment statistics
router.get('/payment-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = await awsManager.getPaymentStats(userId);
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ [BILLING] Error getting payment stats:', error);
    res.status(500).json({ error: 'Failed to get payment stats' });
  }
});

export default router;
