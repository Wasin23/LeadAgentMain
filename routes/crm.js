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
    
    console.log('[CRM] Link token response:', linkToken);
    console.log('[CRM] Sending to frontend:', linkToken.link_token);
    
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
    const { publicToken } = req.body;
    
    if (!publicToken) {
      return res.status(400).json({ error: 'Public token required' });
    }
    
    const tokenResponse = await mergeManager.exchangeToken(publicToken);
    
    // Get integration name from Merge response (e.g. "HubSpot", "Salesforce")
    const integrationName = tokenResponse.integration?.name || tokenResponse.integration?.slug || 'crm';
    console.log('✅ [CRM] Integration name from Merge:', integrationName);
    
    await mergeManager.saveCRMConnection(userId, tokenResponse.account_token, integrationName);
    
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

// Connect CRM via direct API (ActiveCampaign, etc.)
router.post('/connect-direct', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { integrationName, apiUrl, apiKey } = req.body;
    
    if (!integrationName || !apiUrl || !apiKey) {
      return res.status(400).json({ error: 'Integration name, API URL, and API key are required' });
    }

    // Test the connection first
    if (integrationName.toLowerCase() === 'activecampaign') {
      try {
        const axios = (await import('axios')).default;
        const testResponse = await axios.get(`${apiUrl}/api/3/users/me`, {
          headers: { 'Api-Token': apiKey }
        });
        console.log('✅ [CRM] ActiveCampaign connection test successful:', testResponse.data?.user?.email);
      } catch (testError) {
        console.error('❌ [CRM] ActiveCampaign connection test failed:', testError.response?.data || testError.message);
        return res.status(400).json({ 
          error: 'Invalid API credentials. Please check your API URL and key.',
          details: testError.response?.data?.message || testError.message
        });
      }
    }

    await mergeManager.saveDirectCRMConnection(userId, integrationName, apiUrl, apiKey);
    
    res.json({
      success: true,
      integration: integrationName
    });
  } catch (error) {
    console.error('❌ [CRM] Error connecting direct CRM:', error);
    res.status(500).json({ error: 'Failed to connect CRM' });
  }
});

export default router;
