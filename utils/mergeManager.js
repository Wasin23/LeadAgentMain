import axios from 'axios';
import AWSManager from './awsManager.js';

class MergeManager {
  constructor() {
    this.apiKey = process.env.MERGE_API_KEY;
    this.baseURL = 'https://api.merge.dev';
    this.awsManager = new AWSManager();
    
    // Log initialization status
    console.log('🔧 [MERGE] MergeManager initialized');
    console.log('🔧 [MERGE] API Key configured:', this.apiKey ? `***${this.apiKey.slice(-4)}` : 'NOT SET');
    
    // Create axios instance with auth
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create a Link Token for user to connect their CRM
   */
  async createLinkToken(userId, endUserEmail) {
    try {
      console.log('[MERGE] Creating link token with params:', { userId, endUserEmail });
      
      const response = await this.client.post('/api/integrations/create-link-token', {
        end_user_origin_id: userId,
        end_user_email_address: endUserEmail,
        end_user_organization_name: 'Meridian User',
        categories: ['crm'],
        link_expiry_mins: 30,
        // Only show CRMs that fully support contact creation via Merge
        // Exclude ActiveCampaign as it doesn't support write operations
        integration: 'hubspot,salesforce,pipedrive,zoho-crm,copper,close'
      });

      console.log('✅ [MERGE] Full response:', JSON.stringify(response.data, null, 2));
      console.log('✅ [MERGE] Link token:', response.data.link_token);
      return response.data;
    } catch (error) {
      console.error('❌ [MERGE] Error creating link token:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Exchange public token for account token after user connects CRM
   */
  async exchangeToken(publicToken) {
    try {
      const response = await this.client.get(`/api/integrations/account-token/${publicToken}`);

      console.log('✅ [MERGE] Exchanged token successfully');
      console.log('✅ [MERGE] Full exchange response:', JSON.stringify(response.data, null, 2));
      
      // Response includes: account_token, integration (object with name, slug, etc)
      return response.data;
    } catch (error) {
      console.error('❌ [MERGE] Error exchanging token:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Save CRM connection to user's settings
   */
  async saveCRMConnection(userId, accountToken, integrationName) {
    try {
      const user = await this.awsManager.getUserById(userId);
      
      await this.awsManager.updateUser(userId, {
        crmConnected: true,
        crmAccountToken: accountToken,
        crmIntegration: integrationName, // salesforce, hubspot, etc
        crmConnectedAt: new Date().toISOString(),
        crmAutoSync: true // default to auto-sync on
      });

      console.log(`✅ [MERGE] Saved ${integrationName} connection for user:`, userId);
      return { success: true };
    } catch (error) {
      console.error('❌ [MERGE] Error saving CRM connection:', error);
      throw error;
    }
  }

  /**
   * Sync a lead to user's connected CRM
   */
  async syncLeadToCRM(userId, leadData) {
    try {
      console.log('🔄 [MERGE] syncLeadToCRM called for user:', userId);
      console.log('🔄 [MERGE] Lead data:', JSON.stringify(leadData, null, 2));
      
      const user = await this.awsManager.getUserById(userId);
      
      console.log('🔍 [MERGE] User CRM settings:', {
        crmConnected: user?.crmConnected,
        crmAccountToken: user?.crmAccountToken ? '***exists***' : null,
        crmIntegration: user?.crmIntegration,
        crmAutoSync: user?.crmAutoSync
      });
      
      if (!user?.crmConnected || !user?.crmAccountToken) {
        console.log('⚠️ [MERGE] No CRM connected or missing account token');
        return { success: false, error: 'No CRM connected' };
      }

      console.log(`📤 [MERGE] Creating contact in ${user.crmIntegration}...`);

      // Create contact in CRM using Merge API
      // Note: account field requires a valid Merge UUID, not a name object
      // We'll create the contact without account association for now
      const contactPayload = {
        model: {
          first_name: leadData.firstName,
          last_name: leadData.lastName,
          email_addresses: leadData.email ? [{
            email_address: leadData.email,
            email_address_type: 'WORK'
          }] : [],
          phone_numbers: leadData.phone ? [{
            phone_number: leadData.phone,
            phone_number_type: 'WORK'
          }] : []
        }
      };
      
      console.log('📤 [MERGE] Sending contact payload:', JSON.stringify(contactPayload, null, 2));
      console.log('📤 [MERGE] Using account token:', user.crmAccountToken ? `***${user.crmAccountToken.slice(-8)}` : 'MISSING');
      
      const contactResponse = await this.client.post('/api/crm/v1/contacts', contactPayload, {
        headers: {
          'X-Account-Token': user.crmAccountToken
        }
      });

      console.log('✅ [MERGE] Contact creation response:', JSON.stringify(contactResponse.data, null, 2));
      const contact = contactResponse.data;

      // Add research notes (include company name since we don't associate with an account)
      const notesContent = leadData.companyName 
        ? `Company: ${leadData.companyName}\n\nResearch Summary:\n\n${leadData.researchSummary || 'No research summary available.'}`
        : (leadData.researchSummary || 'No research summary available.');
      
      console.log('📝 [MERGE] Adding notes to contact...');
      await this.client.post('/api/crm/v1/notes', {
        model: {
          content: notesContent,
          contact: contact.id
        }
      }, {
        headers: {
          'X-Account-Token': user.crmAccountToken
        }
      });
      console.log('✅ [MERGE] Notes added');

      console.log(`✅ [MERGE] Synced lead ${leadData.email} to ${user.crmIntegration}`);
      
      return { 
        success: true, 
        crmContactId: contact.id,
        crmIntegration: user.crmIntegration
      };
    } catch (error) {
      const errorData = error.response?.data;
      const errorDetail = errorData?.errors?.[0];
      
      // Check for unsupported operation error
      if (errorDetail?.problem_type === 'UNSUPPORTED_OPERATION') {
        console.warn(`⚠️ [MERGE] CRM does not support contact creation via Merge API`);
        return { 
          success: false, 
          error: 'CRM does not support contact creation',
          unsupported: true
        };
      }
      
      console.error('❌ [MERGE] Error syncing lead to CRM:', errorData || error.message);
      return { 
        success: false, 
        error: errorData?.message || error.message 
      };
    }
  }

  /**
   * Get CRM connection status for user
   */
  async getCRMStatus(userId) {
    try {
      const user = await this.awsManager.getUserById(userId);
      
      return {
        connected: user.crmConnected || false,
        integration: user.crmIntegration || null,
        connectedAt: user.crmConnectedAt || null,
        autoSync: user.crmAutoSync !== false, // default true
        crmType: user.crmType || 'merge' // 'merge' or 'direct'
      };
    } catch (error) {
      console.error('❌ [MERGE] Error getting CRM status:', error);
      return { connected: false };
    }
  }

  /**
   * Disconnect CRM
   */
  async disconnectCRM(userId) {
    try {
      await this.awsManager.updateUser(userId, {
        crmConnected: false,
        crmAccountToken: null,
        crmIntegration: null,
        crmConnectedAt: null,
        crmAutoSync: false,
        crmApiKey: null,
        crmApiUrl: null,
        crmType: null // 'merge' or 'direct'
      });

      console.log('✅ [MERGE] Disconnected CRM for user:', userId);
      return { success: true };
    } catch (error) {
      console.error('❌ [MERGE] Error disconnecting CRM:', error);
      throw error;
    }
  }

  /**
   * Save direct API CRM connection (ActiveCampaign, etc.)
   */
  async saveDirectCRMConnection(userId, integrationName, apiUrl, apiKey) {
    try {
      await this.awsManager.updateUser(userId, {
        crmConnected: true,
        crmIntegration: integrationName,
        crmConnectedAt: new Date().toISOString(),
        crmAutoSync: true,
        crmType: 'direct',
        crmApiUrl: apiUrl,
        crmApiKey: apiKey,
        crmAccountToken: null // Not using Merge
      });

      console.log(`✅ [CRM] Saved direct ${integrationName} connection for user:`, userId);
      return { success: true };
    } catch (error) {
      console.error('❌ [CRM] Error saving direct CRM connection:', error);
      throw error;
    }
  }

  /**
   * Sync lead to ActiveCampaign via direct API
   */
  async syncLeadToActiveCampaign(apiUrl, apiKey, leadData) {
    try {
      console.log('🔄 [ACTIVECAMPAIGN] Syncing lead:', leadData.email);
      
      // ActiveCampaign API endpoint
      const endpoint = `${apiUrl}/api/3/contacts`;
      
      const contactPayload = {
        contact: {
          email: leadData.email,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          phone: leadData.phone || ''
        }
      };

      const response = await axios.post(endpoint, contactPayload, {
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ [ACTIVECAMPAIGN] Contact created:', response.data?.contact?.id);

      // Add note with research summary if available
      if (leadData.researchSummary && response.data?.contact?.id) {
        const noteEndpoint = `${apiUrl}/api/3/notes`;
        const noteContent = leadData.companyName 
          ? `Company: ${leadData.companyName}\n\nResearch Summary:\n\n${leadData.researchSummary}`
          : leadData.researchSummary;

        await axios.post(noteEndpoint, {
          note: {
            note: noteContent,
            relid: response.data.contact.id,
            reltype: 'Subscriber'
          }
        }, {
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ [ACTIVECAMPAIGN] Note added');
      }

      return {
        success: true,
        crmContactId: response.data?.contact?.id,
        crmIntegration: 'ActiveCampaign'
      };
    } catch (error) {
      console.error('❌ [ACTIVECAMPAIGN] Error syncing lead:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Sync lead to CRM - handles both Merge and direct API
   */
  async syncLeadToCRMUnified(userId, leadData) {
    try {
      const user = await this.awsManager.getUserById(userId);
      
      if (!user?.crmConnected) {
        return { success: false, error: 'No CRM connected' };
      }

      // Check if using direct API or Merge
      if (user.crmType === 'direct') {
        // Direct API integration
        const integration = user.crmIntegration?.toLowerCase();
        
        if (integration === 'activecampaign') {
          return await this.syncLeadToActiveCampaign(
            user.crmApiUrl,
            user.crmApiKey,
            leadData
          );
        }
        
        // Add more direct integrations here as needed
        return { success: false, error: `Direct sync not implemented for ${user.crmIntegration}` };
      }
      
      // Default: use Merge API
      return await this.syncLeadToCRM(userId, leadData);
    } catch (error) {
      console.error('❌ [CRM] Error in unified sync:', error);
      return { success: false, error: error.message };
    }
  }
}

export default MergeManager;
