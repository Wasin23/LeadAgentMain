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

        case 'dynamics365':
          if (!apiUrl) return res.status(400).json({ error: 'Organization URL is required for Dynamics 365' });
          await axios.get(`${apiUrl}/api/data/v9.2/WhoAmI`, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
          });
          break;

        case 'pipeliner':
          if (!apiUrl) return res.status(400).json({ error: 'Space ID is required for Pipeliner' });
          {
            const [pUser, pPass] = apiKey.split(':');
            await axios.get(
              `https://eu-central.api.pipelinersales.com/api/v100/rest/spaces/${apiUrl}/Contacts?limit=1`,
              { auth: { username: pUser || apiUrl, password: pPass || apiKey } }
            );
          }
          break;

        case 'sugarcrm':
          if (!apiUrl) return res.status(400).json({ error: 'Instance URL is required for SugarCRM' });
          await axios.get(`${apiUrl}/rest/v11_1/ping`, {
            headers: { 'OAuth-Token': apiKey }
          });
          break;

        case 'teamleader':
          await axios.get('https://api.focus.teamleader.eu/users.me', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;

        case 'teamwork':
          if (!apiUrl) return res.status(400).json({ error: 'Site URL is required for Teamwork CRM' });
          await axios.get(`${apiUrl.replace(/\/$/, '')}/account.json`, {
            headers: { 'Authorization': `Basic ${Buffer.from(apiKey + ':x').toString('base64')}` }
          });
          break;

        case 'vtiger':
          if (!apiUrl) return res.status(400).json({ error: 'Instance URL is required for Vtiger' });
          {
            const [vUser, vKey] = apiKey.split(':');
            const chalRes = await axios.get(`${apiUrl}/webservice.php`, { params: { operation: 'getchallenge', username: vUser } });
            const token = chalRes.data?.result?.token;
            const { createHash } = await import('crypto');
            const md5h = createHash('md5').update(token + vKey).digest('hex');
            await axios.post(`${apiUrl}/webservice.php`, new URLSearchParams({ operation: 'login', username: vUser, accessKey: md5h }));
          }
          break;

        case 'accelo':
          if (!apiUrl) return res.status(400).json({ error: 'Deployment URL is required for Accelo' });
          {
            const [aId, aSecret] = apiKey.split(':');
            await axios.post(`${apiUrl.replace(/\/$/, '')}/oauth2/v0/token`,
              new URLSearchParams({ grant_type: 'client_credentials', client_id: aId, client_secret: aSecret, scope: 'read(all)' }),
              { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
          }
          break;

        default:
          // For other CRMs, just save without testing (we'll add tests as needed)
          console.log(`[WARN] No connection test implemented for ${integrationName}, saving anyway`);
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

// Import leads from connected CRM
router.get('/import-leads', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    console.log(`[CRM] import-leads requested for user ${userId}, limit=${limit}`);
    const result = await mergeManager.readLeadsFromCRM(userId, limit);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to import leads' });
    }

    console.log(`[CRM] Imported ${result.contacts.length} contacts`);
    res.json({ success: true, contacts: result.contacts, total: result.contacts.length });
  } catch (error) {
    console.error('❌ [CRM] Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads from CRM' });
  }
});

// ─── SAVED CRM CONTACTS (Meridian DB) ───────────────────────────────────────

// List saved contacts
router.get('/saved-contacts', authenticateToken, async (req, res) => {
  try {
    const contacts = await mergeManager.awsManager.getCRMContacts(req.user.userId);
    res.json({ success: true, contacts });
  } catch (error) {
    console.error('❌ [CRM] get saved-contacts:', error);
    res.status(500).json({ error: 'Failed to fetch saved contacts' });
  }
});

// Batch-save contacts
router.post('/saved-contacts/batch', authenticateToken, async (req, res) => {
  try {
    const { contacts = [] } = req.body;
    await mergeManager.awsManager.saveCRMContacts(req.user.userId, contacts);
    res.json({ success: true, saved: contacts.length });
  } catch (error) {
    console.error('❌ [CRM] batch save contacts:', error);
    res.status(500).json({ error: 'Failed to save contacts' });
  }
});

// Update one contact's status
router.patch('/saved-contacts/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await mergeManager.awsManager.updateCRMContactStatus(req.user.userId, req.params.id, status);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CRM] update contact status:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Clear all saved contacts
router.delete('/saved-contacts', authenticateToken, async (req, res) => {
  try {
    await mergeManager.awsManager.clearCRMContacts(req.user.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CRM] clear saved contacts:', error);
    res.status(500).json({ error: 'Failed to clear contacts' });
  }
});

// ─── AUDITOR STATE ───────────────────────────────────────────────────────────

router.get('/auditor-state', authenticateToken, async (req, res) => {
  try {
    const state = await mergeManager.awsManager.getAuditorState(req.user.userId);
    res.json({ success: true, state });
  } catch (error) {
    console.error('❌ [CRM] get auditor state:', error);
    res.status(500).json({ error: 'Failed to get auditor state' });
  }
});

router.post('/auditor-state', authenticateToken, async (req, res) => {
  try {
    await mergeManager.awsManager.saveAuditorState(req.user.userId, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CRM] save auditor state:', error);
    res.status(500).json({ error: 'Failed to save auditor state' });
  }
});

router.delete('/auditor-state', authenticateToken, async (req, res) => {
  try {
    await mergeManager.awsManager.clearAuditorState(req.user.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CRM] clear auditor state:', error);
    res.status(500).json({ error: 'Failed to clear auditor state' });
  }
});

export default router;
