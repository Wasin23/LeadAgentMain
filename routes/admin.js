import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import { checkGracePeriods } from '../utils/gracePeriodChecker.js';
import { scanUsersAndCharge } from './billing.js';

const router = express.Router();

// Manual trigger for monthly billing (admin only)
router.post('/trigger-billing', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // In production, add admin check here
    console.log('🔧 [ADMIN] Manual billing trigger by:', userId);
    
    // Call billing function directly
    const result = await scanUsersAndCharge();
    
    res.json({
      success: true,
      message: 'Billing job triggered',
      result
    });
  } catch (error) {
    console.error('❌ [ADMIN] Billing trigger failed:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to trigger billing'
    });
  }
});

// Manual trigger for grace period check (admin only)
router.post('/trigger-grace-check', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    console.log('🔧 [ADMIN] Manual grace check trigger by:', userId);
    
    await checkGracePeriods();
    
    res.json({
      success: true,
      message: 'Grace period check completed'
    });
  } catch (error) {
    console.error('❌ [ADMIN] Grace check failed:', error);
    res.status(500).json({ error: error.message || 'Failed to check grace periods' });
  }
});

// Get all users payment status (admin only)
router.get('/payment-overview', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    console.log('🔧 [ADMIN] Payment overview requested by:', userId);
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const scanCommand = new ScanCommand({
      TableName: awsManager.tables.userSettings,
      ProjectionExpression: 'userId, email, paymentStatus, gracePeriodEnd, lastChargeDate, lastFailedCharge'
    });
    
    const { Items: users } = await awsManager.dynamodb.send(scanCommand);
    
    const summary = {
      total: users?.length || 0,
      active: users?.filter(u => u.paymentStatus === 'active').length || 0,
      payment_failed: users?.filter(u => u.paymentStatus === 'payment_failed').length || 0,
      suspended: users?.filter(u => u.paymentStatus === 'suspended').length || 0,
      users: users?.map(u => ({
        userId: u.userId,
        email: u.email,
        status: u.paymentStatus || 'unknown',
        gracePeriodEnd: u.gracePeriodEnd,
        lastCharge: u.lastChargeDate,
        failedAmount: u.lastFailedCharge?.amount
      }))
    };
    
    res.json(summary);
  } catch (error) {
    console.error('❌ [ADMIN] Payment overview failed:', error);
    res.status(500).json({ error: error.message || 'Failed to get payment overview' });
  }
});

export default router;
