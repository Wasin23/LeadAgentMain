import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();

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
      return res.status(400).json({
        success: false,
        error: 'Plan type is required'
      });
    }
    
    const result = await awsManager.updateUserPlan(userId, planType);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[PLANS] Error upgrading plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Purchase additional credits
router.post('/purchase-credits', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { creditAmount } = req.body;
    
    if (!creditAmount || creditAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid credit amount is required'
      });
    }
    
    const result = await awsManager.purchaseCredits(userId, creditAmount);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[CREDITS] Error purchasing credits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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