import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import MergeManager from '../utils/mergeManager.js';

const router = express.Router();
const mergeManager = new MergeManager();

// Get CRM connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const status = await mergeManager.getCRMStatus(userId);
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('❌ [CRM] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get CRM status' });
  }
});

// Create link token to connect CRM
router.post('/link-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    
    const linkToken = await mergeManager.createLinkToken(userId, userEmail);
    
    res.json({
      success: true,
      linkToken: linkToken.link_token
    });
  } catch (error) {
    console.error('❌ [CRM] Error creating link token:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token after user connects CRM
router.post('/exchange-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { publicToken, integrationName } = req.body;
    
    if (!publicToken) {
      return res.status(400).json({ error: 'Public token required' });
    }
    
    const accountToken = await mergeManager.exchangeToken(publicToken);
    await mergeManager.saveCRMConnection(userId, accountToken.account_token, integrationName);
    
    res.json({
      success: true,
      integration: integrationName
    });
  } catch (error) {
    console.error('❌ [CRM] Error exchanging token:', error);
    res.status(500).json({ error: 'Failed to connect CRM' });
  }
});

// Sync a lead to CRM
router.post('/sync-lead', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { leadData } = req.body;
    
    if (!leadData) {
      return res.status(400).json({ error: 'Lead data required' });
    }
    
    const result = await mergeManager.syncLeadToCRM(userId, leadData);
    
    res.json(result);
  } catch (error) {
    console.error('❌ [CRM] Error syncing lead:', error);
    res.status(500).json({ error: 'Failed to sync lead' });
  }
});

// Disconnect CRM
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await mergeManager.disconnectCRM(userId);
    
    res.json({
      success: true,
      message: 'CRM disconnected successfully'
    });
  } catch (error) {
    console.error('❌ [CRM] Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect CRM' });
  }
});

// Toggle auto-sync
router.post('/toggle-auto-sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { autoSync } = req.body;
    
    await mergeManager.awsManager.updateUser(userId, {
      crmAutoSync: autoSync
    });
    
    res.json({
      success: true,
      autoSync
    });
  } catch (error) {
    console.error('❌ [CRM] Error toggling auto-sync:', error);
    res.status(500).json({ error: 'Failed to update auto-sync' });
  }
});

export default router;
