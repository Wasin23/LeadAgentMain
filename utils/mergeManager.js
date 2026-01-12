import axios from 'axios';
import AWSManager from './awsManager.js';

class MergeManager {
  constructor() {
    this.apiKey = process.env.MERGE_API_KEY;
    this.baseURL = 'https://api.merge.dev';
    this.awsManager = new AWSManager();
    
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
      const response = await this.client.post('/api/integrations/create-link-token', {
        end_user_origin_id: userId,
        end_user_email_address: endUserEmail,
        end_user_organization_name: 'Meridian User',
        categories: ['crm'],
        link_expiry_mins: 30
      });

      console.log('✅ [MERGE] Created link token for user:', userId);
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
      const user = await this.awsManager.getUserById(userId);
      
      if (!user.crmConnected || !user.crmAccountToken) {
        return { success: false, error: 'No CRM connected' };
      }

      // Create contact in CRM using Merge API
      const contactResponse = await this.client.post('/api/crm/v1/contacts', {
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
          }] : [],
          account: {
            name: leadData.companyName
          }
        }
      }, {
        headers: {
          'X-Account-Token': user.crmAccountToken
        }
      });

      const contact = contactResponse.data;

      // Add research notes
      if (leadData.researchSummary) {
        await this.client.post('/api/crm/v1/notes', {
          model: {
            content: `Research Summary:\n\n${leadData.researchSummary}`,
            contact: contact.id
          }
        }, {
          headers: {
            'X-Account-Token': user.crmAccountToken
          }
        });
      }

      console.log(`✅ [MERGE] Synced lead ${leadData.email} to ${user.crmIntegration}`);
      
      return { 
        success: true, 
        crmContactId: contact.id,
        crmIntegration: user.crmIntegration
      };
    } catch (error) {
      console.error('❌ [MERGE] Error syncing lead to CRM:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
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
        autoSync: user.crmAutoSync !== false // default true
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
        crmAutoSync: false
      });

      console.log('✅ [MERGE] Disconnected CRM for user:', userId);
      return { success: true };
    } catch (error) {
      console.error('❌ [MERGE] Error disconnecting CRM:', error);
      throw error;
    }
  }
}

export default MergeManager;
