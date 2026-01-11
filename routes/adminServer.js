import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { scanUsersAndCharge } from './billing.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

const router = express.Router();
const awsManager = new AWSManager();

// Admin password authentication
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (password === process.env.ADMIN_PASSWORD) {
      // Generate a simple admin session token (just use a static value for simplicity)
      const adminToken = Buffer.from(`admin:${Date.now()}`).toString('base64');
      
      res.json({
        success: true,
        token: adminToken,
        message: 'Admin authenticated'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }
  } catch (error) {
    console.error('❌ [ADMIN] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Simple admin auth check - verify admin token
function isAdmin(req, res, next) {
  const adminToken = req.headers['x-admin-token'];
  
  if (!adminToken) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  // Simple validation - check if token starts with "admin:"
  try {
    const decoded = Buffer.from(adminToken, 'base64').toString();
    if (decoded.startsWith('admin:')) {
      next();
    } else {
      res.status(401).json({ error: 'Invalid admin token' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Invalid admin token' });
  }
}

// Admin dashboard - get all billing data
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    console.log('📊 [ADMIN] Dashboard request from admin');
    
    // Get all users
    const usersCommand = new ScanCommand({
      TableName: awsManager.tables.users
    });
    const { Items: users } = await awsManager.dynamodb.send(usersCommand);
    
    // Get all user settings for payment info
    const settingsCommand = new ScanCommand({
      TableName: awsManager.tables.userSettings
    });
    const { Items: settings } = await awsManager.dynamodb.send(settingsCommand);
    
    // Get all payment history
    const paymentsCommand = new ScanCommand({
      TableName: awsManager.tables.paymentHistory
    });
    const { Items: payments } = await awsManager.dynamodb.send(paymentsCommand);
    
    // Get API usage for current month to calculate outstanding amounts
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const apiUsageCommand = new ScanCommand({
      TableName: awsManager.tables.apiUsage,
      FilterExpression: '#timestamp >= :startDate',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':startDate': startOfMonth.toISOString()
      }
    });
    const { Items: apiUsage } = await awsManager.dynamodb.send(apiUsageCommand);
    
    console.log(`💳 [ADMIN] Found ${payments?.length || 0} payment records`);
    if (payments && payments.length > 0) {
      console.log(`💳 [ADMIN] Sample payment:`, JSON.stringify(payments[0], null, 2));
    }
    
    console.log(`💰 [ADMIN] Found ${apiUsage?.length || 0} API usage records this month`);
    
    console.log(`👥 [ADMIN] Found ${users?.length || 0} users`);
    users?.slice(0, 5).forEach(user => {
      console.log(`   User: ${user.email} → userId: ${user.userId}`);
    });
    
    // Calculate totals
    const totalBilling = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    
    // Group payments by month
    const monthlyBilling = {};
    payments?.forEach(payment => {
      const date = new Date(payment.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyBilling[monthKey]) {
        monthlyBilling[monthKey] = {
          month: monthKey,
          total: 0,
          count: 0,
          successful: 0,
          failed: 0
        };
      }
      
      monthlyBilling[monthKey].total += payment.amount || 0;
      monthlyBilling[monthKey].count += 1;
      
      if (payment.status === 'success') {
        monthlyBilling[monthKey].successful += 1;
      } else if (payment.status === 'failed') {
        monthlyBilling[monthKey].failed += 1;
      }
    });
    
    // Convert to array and sort by month (newest first)
    const monthlyReports = Object.values(monthlyBilling).sort((a, b) => b.month.localeCompare(a.month));
    
    // Combine user data with settings
    const activeAccounts = users?.map(user => {
      const userSettings = settings?.find(s => s.userId === user.userId);
      const userPayments = payments?.filter(p => p.userId === user.userId) || [];
      const totalSpent = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      // Calculate outstanding amount from current month's API usage
      const userApiUsage = apiUsage?.filter(u => u.userId === user.userId) || [];
      const outstandingAmount = userApiUsage.reduce((sum, u) => sum + (u.cost || 0), 0);
      
      // Check multiple fields for payment method (Stripe can store it in different places)
      const hasPaymentMethod = !!(
        userSettings?.defaultPaymentMethodId || 
        userSettings?.stripePaymentMethodId ||
        user.stripePaymentMethodId ||
        (user.stripeCustomerId && userSettings?.paymentStatus === 'active')
      );
      
      return {
        userId: user.userId,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        stripeCustomerId: user.stripeCustomerId,
        paymentStatus: userSettings?.paymentStatus || 'unknown',
        hasPaymentMethod: hasPaymentMethod,
        lastChargeDate: userSettings?.lastChargeDate,
        lastChargeAmount: userSettings?.lastChargeAmount,
        gracePeriodEnd: userSettings?.gracePeriodEnd,
        totalSpent: totalSpent,
        outstandingAmount: outstandingAmount,
        apiCallsThisMonth: userApiUsage.length,
        paymentCount: userPayments.length
      };
    }).filter(u => u.email) || []; // Filter out any invalid entries
    
    // Payment status summary
    const statusSummary = {
      active: activeAccounts.filter(u => u.paymentStatus === 'active').length,
      payment_failed: activeAccounts.filter(u => u.paymentStatus === 'payment_failed').length,
      suspended: activeAccounts.filter(u => u.paymentStatus === 'suspended').length,
      no_payment: activeAccounts.filter(u => !u.hasPaymentMethod).length
    };
    
    res.json({
      success: true,
      summary: {
        totalBilling: totalBilling.toFixed(2),
        totalPayments: payments?.length || 0,
        totalUsers: users?.length || 0,
        activeAccounts: activeAccounts.length,
        statusSummary
      },
      monthlyReports,
      accounts: activeAccounts.sort((a, b) => b.totalSpent - a.totalSpent) // Sort by spend
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Dashboard error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load admin dashboard',
      message: error.message 
    });
  }
});

// Trigger monthly billing manually
router.post('/trigger-billing', isAdmin, async (req, res) => {
  try {
    console.log('💰 [ADMIN] Manual billing trigger by:', req.user.userId);
    
    const results = await scanUsersAndCharge();
    
    res.json({
      success: true,
      message: 'Monthly billing completed',
      results
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Billing trigger failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to trigger billing',
      message: error.message 
    });
  }
});

// Get detailed user billing info
router.get('/user/:userId/billing', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await awsManager.getUserById(userId);
    const userSettings = await awsManager.getUserSettings(userId);
    const paymentHistory = await awsManager.getPaymentHistory(userId, 100);
    const paymentStats = await awsManager.getPaymentStats(userId);
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        username: user.username,
        stripeCustomerId: user.stripeCustomerId
      },
      settings: {
        paymentStatus: userSettings?.paymentStatus,
        hasPaymentMethod: !!userSettings?.defaultPaymentMethodId,
        lastChargeDate: userSettings?.lastChargeDate,
        lastChargeAmount: userSettings?.lastChargeAmount,
        gracePeriodEnd: userSettings?.gracePeriodEnd,
        lastFailedCharge: userSettings?.lastFailedCharge
      },
      paymentHistory,
      stats: paymentStats
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] User billing error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get user billing info',
      message: error.message 
    });
  }
});

export default router;
