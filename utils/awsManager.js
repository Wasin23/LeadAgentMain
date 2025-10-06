import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

class AWSManager {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    // Configure DynamoDB
    const ddbClient = new DynamoDBClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });
    
    this.dynamodb = DynamoDBDocumentClient.from(ddbClient);
    
    // Configure SES
    this.ses = new SESClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });
    
    // Table names
    this.tables = {
      userSettings: process.env.AWS_DYNAMODB_USER_SETTINGS_TABLE || 'examark-user-settings',
      agentSettings: process.env.AWS_DYNAMODB_AGENT_SETTINGS_TABLE || 'examark-agent-settings',
      leadData: process.env.AWS_DYNAMODB_LEAD_DATA_TABLE || 'examark-lead-data',
      emailTracking: process.env.AWS_DYNAMODB_EMAIL_TRACKING_TABLE || 'examark-email-tracking',
      agentState: process.env.AWS_DYNAMODB_AGENT_STATE_TABLE || 'examark-agent-state'
    };
    
    console.log('🔧 [AWS] AWSManager initialized with region:', this.region);
    console.log('🔧 [AWS] Tables configured:', this.tables);
  }

  // =====================
  // USER SETTINGS METHODS
  // =====================
  
  async getUserSettings(userId) {
    try {
      console.log('⚙️ [AWS] Getting user settings for userId:', userId);
      
      const command = new GetCommand({
        TableName: this.tables.userSettings,
        Key: { userId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('❌ [AWS] No user settings found for userId:', userId);
        return null;
      }
      
      console.log('✅ [AWS] User settings retrieved successfully');
      return result.Item;
    } catch (error) {
      console.error('❌ [AWS] Error getting user settings:', error);
      throw error;
    }
  }
  
  async saveUserSettings(userId, settings) {
    try {
      console.log('💾 [AWS] Saving user settings for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.userSettings,
        Item: {
          userId,
          ...settings,
          updatedAt: new Date().toISOString(),
          version: settings.version || '1.0'
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] User settings saved successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error saving user settings:', error);
      throw error;
    }
  }

  // =======================
  // AGENT SETTINGS METHODS
  // =======================
  
  async getLeadAgentSettings(userId) {
    try {
      console.log('⚙️ [AWS] Getting lead agent settings for userId:', userId);
      
      const command = new GetCommand({
        TableName: this.tables.agentSettings,
        Key: { 
          userId,
          settingsType: 'lead-agent' 
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('❌ [AWS] No lead agent settings found for userId:', userId);
        return null;
      }
      
      console.log('✅ [AWS] Lead agent settings retrieved successfully');
      return result.Item.settings;
    } catch (error) {
      console.error('❌ [AWS] Error getting lead agent settings:', error);
      throw error;
    }
  }
  
  async saveLeadAgentSettings(userId, settings) {
    try {
      console.log('💾 [AWS] Saving lead agent settings for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.agentSettings,
        Item: {
          userId,
          settingsType: 'lead-agent',
          settings: {
            ...settings,
            updatedAt: new Date().toISOString(),
            version: settings.version || '2.0'
          }
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Lead agent settings saved successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error saving lead agent settings:', error);
      throw error;
    }
  }

  // ==================
  // LEAD DATA METHODS
  // ==================
  
  async saveLeadData(userId, leadData) {
    try {
      console.log('💾 [AWS] Saving lead data for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.leadData,
        Item: {
          userId,
          leadId: leadData.id || `lead_${Date.now()}`,
          ...leadData,
          createdAt: new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Lead data saved successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error saving lead data:', error);
      throw error;
    }
  }
  
  async getLeadHistory(userId, limit = 50) {
    try {
      console.log('📊 [AWS] Getting lead history for userId:', userId);
      
      const command = new QueryCommand({
        TableName: this.tables.leadData,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });
      
      const result = await this.dynamodb.send(command);
      
      console.log(`✅ [AWS] Retrieved ${result.Items?.length || 0} lead records`);
      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error getting lead history:', error);
      throw error;
    }
  }

  // ======================
  // EMAIL TRACKING METHODS
  // ======================
  
  async trackEmailSent(userId, emailData) {
    try {
      console.log('📧 [AWS] Tracking email sent for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.emailTracking,
        Item: {
          userId,
          emailId: emailData.emailId || `email_${Date.now()}`,
          ...emailData,
          status: 'sent',
          sentAt: new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Email tracking saved successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error tracking email:', error);
      throw error;
    }
  }
  
  async updateEmailStatus(userId, emailId, status, metadata = {}) {
    try {
      console.log('📧 [AWS] Updating email status for emailId:', emailId, 'status:', status);
      
      const command = new UpdateCommand({
        TableName: this.tables.emailTracking,
        Key: { userId, emailId },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #metadata = :metadata',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
          '#metadata': 'metadata'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString(),
          ':metadata': metadata
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Email status updated successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error updating email status:', error);
      throw error;
    }
  }

  // ====================
  // AGENT STATE METHODS
  // ====================
  
  async saveAgentState(userId, agentId, state) {
    try {
      console.log('🤖 [AWS] Saving agent state for userId:', userId, 'agentId:', agentId);
      
      const command = new PutCommand({
        TableName: this.tables.agentState,
        Item: {
          userId,
          agentId,
          ...state,
          updatedAt: new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Agent state saved successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error saving agent state:', error);
      throw error;
    }
  }
  
  async getAgentState(userId, agentId) {
    try {
      console.log('🤖 [AWS] Getting agent state for userId:', userId, 'agentId:', agentId);
      
      const command = new GetCommand({
        TableName: this.tables.agentState,
        Key: { userId, agentId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('❌ [AWS] No agent state found');
        return null;
      }
      
      console.log('✅ [AWS] Agent state retrieved successfully');
      return result.Item;
    } catch (error) {
      console.error('❌ [AWS] Error getting agent state:', error);
      throw error;
    }
  }

  // =================
  // EMAIL SES METHODS
  // =================
  
  async sendEmail({ to, from, subject, htmlBody, textBody }) {
    try {
      console.log('📧 [AWS SES] Sending email to:', to);
      
      const command = new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
              Charset: 'UTF-8'
            }
          }
        }
      });
      
      const result = await this.ses.send(command);
      
      console.log('✅ [AWS SES] Email sent successfully. MessageId:', result.MessageId);
      return {
        success: true,
        messageId: result.MessageId
      };
    } catch (error) {
      console.error('❌ [AWS SES] Error sending email:', error);
      throw error;
    }
  }

  // =================
  // UTILITY METHODS
  // =================
  
  async healthCheck() {
    try {
      console.log('🏥 [AWS] Running health check...');
      
      // Test DynamoDB connection
      const testCommand = new QueryCommand({
        TableName: this.tables.userSettings,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': 'health-check-test'
        },
        Limit: 1
      });
      
      await this.dynamodb.send(testCommand);
      
      console.log('✅ [AWS] Health check passed');
      return {
        status: 'healthy',
        region: this.region,
        tables: this.tables,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [AWS] Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default AWSManager;