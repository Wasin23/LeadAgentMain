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
    
    const result = await mergeManager.syncLeadToCRMUnified(userId, leadData);
    
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

// Connect CRM via direct API (all CRMs)
router.post('/connect-direct', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { integrationName, apiUrl, apiKey } = req.body;
    
    if (!integrationName || !apiKey) {
      return res.status(400).json({ error: 'Integration name and API key are required' });
    }

    const axios = (await import('axios')).default;
    const integration = integrationName.toLowerCase();

    // Test connection based on CRM type
    try {
      switch (integration) {
        case 'activecampaign':
          if (!apiUrl) return res.status(400).json({ error: 'API URL is required for ActiveCampaign' });
          await axios.get(`${apiUrl}/api/3/users/me`, { headers: { 'Api-Token': apiKey } });
          break;
          
        case 'hubspot':
          await axios.get('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
          
        case 'pipedrive':
          await axios.get(`https://api.pipedrive.com/v1/users/me?api_token=${apiKey}`);
          break;
          
        case 'close':
          await axios.get('https://api.close.com/api/v1/me/', {
            auth: { username: apiKey, password: '' }
          });
          break;
          
        case 'copper':
          if (!apiUrl) return res.status(400).json({ error: 'User email is required for Copper' });
          await axios.get('https://api.copper.com/developer_api/v1/account', {
            headers: { 
              'X-PW-AccessToken': apiKey,
              'X-PW-Application': 'developer_api',
              'X-PW-UserEmail': apiUrl,
              'Content-Type': 'application/json'
            }
          });
          break;
          
        case 'zoho':
          if (!apiUrl) return res.status(400).json({ error: 'Data center URL is required for Zoho' });
          await axios.get(`${apiUrl}/crm/v2/users?type=CurrentUser`, {
            headers: { 'Authorization': `Zoho-oauthtoken ${apiKey}` }
          });
          break;
          
        case 'salesforce':
          if (!apiUrl) return res.status(400).json({ error: 'Instance URL is required for Salesforce' });
          await axios.get(`${apiUrl}/services/data/v57.0/sobjects`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
          
        case 'affinity':
          await axios.get('https://api.affinity.co/whoami', {
            headers: { 'Authorization': `Basic ${Buffer.from(':' + apiKey).toString('base64')}` }
          });
          break;
          
        case 'capsule':
          await axios.get('https://api.capsulecrm.com/api/v2/users/current', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
          
        case 'insightly':
          await axios.get('https://api.insightly.com/v3.1/Users/Me', {
            headers: { 'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}` }
          });
          break;
          
        case 'keap':
          await axios.get('https://api.infusionsoft.com/crm/rest/v1/account/profile', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
          
        case 'nutshell':
          if (!apiUrl) return res.status(400).json({ error: 'User email is required for Nutshell' });
          await axios.post('https://app.nutshell.com/api/v1/json', {
            method: 'getUser',
            params: {},
            id: 'test'
          }, {
            auth: { username: apiUrl, password: apiKey }
          });
          break;
          
        case 'salesflare':
          await axios.get('https://api.salesflare.com/me', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
          
        case 'zendesksell':
          await axios.get('https://api.getbase.com/v2/users/self', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
          
        default:
          // For other CRMs, just save without testing (we'll add tests as needed)
          console.log(`⚠️ [CRM] No connection test implemented for ${integrationName}, saving anyway`);
      }
      
      console.log(`✅ [CRM] ${integrationName} connection test successful`);
    } catch (testError) {
      console.error(`❌ [CRM] ${integrationName} connection test failed:`, testError.response?.data || testError.message);
      return res.status(400).json({ 
        error: 'Invalid API credentials. Please check your credentials and try again.',
        details: testError.response?.data?.message || testError.message
      });
    }

    await mergeManager.saveDirectCRMConnection(userId, integrationName, apiUrl || '', apiKey);
    
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
