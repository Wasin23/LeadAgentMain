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
    
    // Get ALL API usage summaries to calculate outstanding (unpaid) amounts
    const apiUsageSummaryCommand = new ScanCommand({
      TableName: awsManager.tables.apiUsageSummary
    });
    const { Items: apiUsageSummary } = await awsManager.dynamodb.send(apiUsageSummaryCommand);
    
    console.log(`💳 [ADMIN] Found ${payments?.length || 0} payment records`);
    if (payments && payments.length > 0) {
      console.log(`💳 [ADMIN] Sample payment:`, JSON.stringify(payments[0], null, 2));
    }
    
    console.log(`💰 [ADMIN] Found ${apiUsageSummary?.length || 0} API usage summary records (all months)`);
    if (apiUsageSummary && apiUsageSummary.length > 0) {
      console.log(`💰 [ADMIN] Sample summary:`, JSON.stringify(apiUsageSummary[0], null, 2));
    }
    
    // Debug: Show summary by userId (sum ALL months for outstanding)
    const summaryByUser = {};
    apiUsageSummary?.forEach(summary => {
      if (!summaryByUser[summary.userId]) {
        summaryByUser[summary.userId] = { totalCost: 0, totalCalls: 0 };
      }
      
      // Sum costs from all services (nested structure)
      ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
        if (summary[service]) {
          summaryByUser[summary.userId].totalCost += summary[service].cost || 0;
          summaryByUser[summary.userId].totalCalls += summary[service].calls || 0;
        }
      });
    });
    
    console.log(`👥 [ADMIN] Found ${users?.length || 0} users`);
    users?.slice(0, 5).forEach(user => {
      const usage = summaryByUser[user.userId];
      const userSettings = settings?.find(s => s.userId === user.userId);
      console.log(`   User: ${user.email} → userId: ${user.userId} → Outstanding: $${usage?.totalCost.toFixed(2) || '0.00'} (${usage?.totalCalls || 0} calls)`);
      console.log(`      Payment Method Fields:`, {
        defaultPaymentMethodId: userSettings?.defaultPaymentMethodId,
        stripePaymentMethodId: userSettings?.stripePaymentMethodId || user.stripePaymentMethodId,
        stripeCustomerId: user.stripeCustomerId,
        paymentStatus: userSettings?.paymentStatus,
        paymentMethodAdded: userSettings?.paymentMethodAdded || user.paymentMethodAdded
      });
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
      
      // Build monthly payment breakdown
      const monthlyBreakdown = {};
      userPayments
        .filter(p => p.status === 'success' && p.billingPeriod)
        .forEach(payment => {
          const date = new Date(payment.billingPeriod);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          
          if (!monthlyBreakdown[monthKey]) {
            monthlyBreakdown[monthKey] = {
              month: monthLabel,
              amount: 0,
              date: payment.timestamp
            };
          }
          monthlyBreakdown[monthKey].amount += payment.amount;
        });
      
      // Convert to array and sort by month (newest first)
      const paymentBreakdown = Object.keys(monthlyBreakdown)
        .sort((a, b) => b.localeCompare(a))
        .map(key => monthlyBreakdown[key]);
      
      // Calculate outstanding amount from UNPAID months only
      const userSummaries = apiUsageSummary?.filter(s => s.userId === user.userId) || [];
      
      // Get list of paid months from successful payments
      const paidMonths = new Set(
        userPayments
          .filter(p => p.status === 'success' && p.billingPeriod)
          .map(p => {
            // Extract YYYY-MM from billingPeriod (ISO date string)
            const date = new Date(p.billingPeriod);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          })
      );
      
      let outstandingAmount = 0;
      let apiCallsThisMonth = 0;
      
      // Sum ONLY unpaid months
      userSummaries.forEach(summary => {
        // Skip this month if it's already been paid
        if (paidMonths.has(summary.monthKey)) {
          return;
        }
        
        ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
          if (summary[service]) {
            outstandingAmount += summary[service].cost || 0;
            apiCallsThisMonth += summary[service].calls || 0;
          }
        });
      });
      
      // Check multiple fields for payment method (Stripe can store it in different places)
      const hasPaymentMethod = !!(
        userSettings?.defaultPaymentMethodId || 
        userSettings?.stripePaymentMethodId ||
        user.stripePaymentMethodId ||
        userSettings?.paymentMethodAdded ||
        user.paymentMethodAdded ||
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
        apiCallsThisMonth: apiCallsThisMonth,
        paymentCount: userPayments.length,
        paymentBreakdown: paymentBreakdown
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
