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
      users: process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users',
      userSettings: process.env.AWS_DYNAMODB_USER_SETTINGS_TABLE || 'meridian-user-settings',
      agentSettings: process.env.AWS_DYNAMODB_AGENT_SETTINGS_TABLE || 'meridian-agent-settings',
      leadData: process.env.AWS_DYNAMODB_LEAD_DATA_TABLE || 'meridian-lead-data',
      emailTracking: process.env.AWS_DYNAMODB_EMAIL_TRACKING_TABLE || 'meridian-email-tracking',
      agentState: process.env.AWS_DYNAMODB_AGENT_STATE_TABLE || 'meridian-agent-state',
      contactedLeads: process.env.AWS_DYNAMODB_CONTACTED_LEADS_TABLE || 'meridian-contacted-leads',
      cycleLogs: process.env.AWS_DYNAMODB_CYCLE_LOGS_TABLE || 'meridian-cycle-logs',
      apiUsage: process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage'
    };
    
    // API Cost rates (estimated)
    this.apiCosts = {
      apollo: 0.01, // $0.01 per credit
      openai: 0.002 / 1000, // $0.002 per 1K tokens for GPT-3.5
      mailgun: 0.0008, // $0.0008 per email
      zerobounce: 0.005 // $0.005 per validation
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

  // ==================
  // USER MANAGEMENT METHODS
  // ==================
  
  async getUserById(userId) {
    try {
      console.log('👤 [AWS] Getting user by ID:', userId);
      
      const command = new GetCommand({
        TableName: this.tables.users,
        Key: { userId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('❌ [AWS] No user found with ID:', userId);
        return null;
      }
      
      console.log('✅ [AWS] User retrieved successfully');
      return result.Item;
    } catch (error) {
      console.error('❌ [AWS] Error getting user by ID:', error);
      throw error;
    }
  }
  
  async getUserByUsername(username) {
    try {
      console.log('👤 [AWS] Getting user by username:', username);
      
      const command = new ScanCommand({
        TableName: this.tables.users,
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': username
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        console.log('❌ [AWS] No user found with username:', username);
        return null;
      }
      
      console.log('✅ [AWS] User retrieved by username successfully');
      return result.Items[0];
    } catch (error) {
      console.error('❌ [AWS] Error getting user by username:', error);
      throw error;
    }
  }
  
  async getUserByEmail(email) {
    try {
      console.log('👤 [AWS] Getting user by email:', email);
      
      // Make email search case-insensitive by searching both formats
      const command = new ScanCommand({
        TableName: this.tables.users,
        FilterExpression: 'email = :email OR email = :emailUpper OR email = :emailLower',
        ExpressionAttributeValues: {
          ':email': email,
          ':emailUpper': email.toUpperCase(),
          ':emailLower': email.toLowerCase()
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        console.log('❌ [AWS] No user found with email:', email);
        return null;
      }
      
      console.log('✅ [AWS] User retrieved by email successfully');
      return result.Items[0];
    } catch (error) {
      console.error('❌ [AWS] Error getting user by email:', error);
      throw error;
    }
  }
  
  async getAllUsers() {
    try {
      console.log('📋 [AWS] Getting all users from database');
      const params = {
        TableName: this.tables.users
      };
      
      const result = await this.dynamodb.send(new ScanCommand(params));
      console.log(`✅ [AWS] Retrieved ${result.Items ? result.Items.length : 0} users`);
      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error getting all users:', error);
      throw error;
    }
  }
  
  async createUser(userData) {
    try {
      console.log('👤 [AWS] Creating new user:', userData.username);
      
      const command = new PutCommand({
        TableName: this.tables.users,
        Item: {
          userId: userData.userId,
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          createdAt: new Date().toISOString(),
          lastLogin: null,
          lastPasswordReset: null,
          activeAgents: [], // Initialize empty agents array
          ...userData
        },
        ConditionExpression: 'attribute_not_exists(userId)' // Prevent overwrites
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] User created successfully');
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User already exists');
      }
      console.error('❌ [AWS] Error creating user:', error);
      throw error;
    }
  }
  
  async updateUser(userId, updates) {
    try {
      console.log('👤 [AWS] Updating user:', userId, 'with updates:', updates);
      
      // Build update expression and attribute values
      const updateExpressions = [];
      const expressionAttributeValues = {};
      const expressionAttributeNames = {};
      
      // Always update the updatedAt field
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      
      // Add the provided updates
      Object.entries(updates).forEach(([key, value], index) => {
        const valueKey = `:val${index}`;
        const nameKey = `#${key}`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeValues[valueKey] = value;
        expressionAttributeNames[nameKey] = key;
      });
      
      const params = {
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
      };
      
      console.log('🔄 [AWS] Update params:', JSON.stringify(params, null, 2));
      
      const result = await this.dynamodb.send(new UpdateCommand(params));
      console.log('✅ [AWS] Update result:', result.Attributes);
      
      return result.Attributes;
    } catch (error) {
      console.error('❌ [AWS] Error updating user:', error);
      throw error;
    }
  }
  
  async addAgentToUser(userId, agentData) {
    try {
      console.log('🤖 [AWS] Adding agent to user:', userId, agentData.agentId);
      
      const command = new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: 'SET activeAgents = list_append(if_not_exists(activeAgents, :empty_list), :new_agent), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':new_agent': [agentData],
          ':empty_list': [],
          ':updatedAt': new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Agent added to user successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error adding agent to user:', error);
      throw error;
    }
  }
  
  async getUserByResetToken(resetToken) {
    try {
      console.log('👤 [AWS] Getting user by reset token:', resetToken);
      
      const command = new ScanCommand({
        TableName: this.tables.users,
        FilterExpression: 'resetToken = :resetToken',
        ExpressionAttributeValues: {
          ':resetToken': resetToken
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        console.log('❌ [AWS] No user found with reset token');
        return null;
      }
      
      console.log('✅ [AWS] User retrieved by reset token successfully');
      return result.Items[0];
    } catch (error) {
      console.error('❌ [AWS] Error getting user by reset token:', error);
      throw error;
    }
  }
  
  async removeAgentFromUser(userId, agentId) {
    try {
      console.log('🤖 [AWS] Removing agent from user:', userId, agentId);
      
      // First get the user to find the agent index
      const user = await this.getUserById(userId);
      if (!user || !user.activeAgents) {
        throw new Error('User not found or has no agents');
      }
      
      const agentIndex = user.activeAgents.findIndex(agent => agent.agentId === agentId);
      if (agentIndex === -1) {
        throw new Error('Agent not found in user\'s active agents');
      }
      
      const command = new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: `REMOVE activeAgents[${agentIndex}] SET updatedAt = :updatedAt`,
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Agent removed from user successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error removing agent from user:', error);
      throw error;
    }
  }
  
  // =======================
  // AGENT MANAGEMENT METHODS  
  // =======================
  
  generateAgentId() {
    // Generate 6-digit agent ID (100000-999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  async createDefaultAgent(userId, agentName = 'Lead Agent') {
    try {
      console.log('🤖 [AWS] Creating default agent for user:', userId);
      
      const agentId = this.generateAgentId();
      
      // Ensure unique agent ID by checking existing agents
      const user = await this.getUserById(userId);
      if (user && user.activeAgents) {
        const existingIds = user.activeAgents.map(agent => agent.agentId);
        let attempts = 0;
        let newAgentId = agentId;
        
        while (existingIds.includes(newAgentId) && attempts < 10) {
          newAgentId = this.generateAgentId();
          attempts++;
        }
        
        if (attempts >= 10) {
          throw new Error('Failed to generate unique agent ID after 10 attempts');
        }
      }
      
      const agentData = {
        agentId: agentId,
        name: agentName,
        type: 'reasoning-lead-agent',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastRun: null,
        settings: {
          enabled: true,
          intervalMinutes: 30,
          maxLeadsPerCycle: 5
        }
      };
      
      await this.addAgentToUser(userId, agentData);
      
      console.log(`✅ [AWS] Default agent created: ${agentId} for user ${userId}`);
      return agentData;
      
    } catch (error) {
      console.error('❌ [AWS] Error creating default agent:', error);
      throw error;
    }
  }
  
  async createAgent(userId, agentName, agentType = 'reasoning-lead-agent') {
    try {
      console.log('🤖 [AWS] Creating new agent for user:', userId);
      
      const agentId = this.generateAgentId();
      
      // Ensure unique agent ID
      const user = await this.getUserById(userId);
      if (user && user.activeAgents) {
        const existingIds = user.activeAgents.map(agent => agent.agentId);
        let attempts = 0;
        let newAgentId = agentId;
        
        while (existingIds.includes(newAgentId) && attempts < 10) {
          newAgentId = this.generateAgentId();
          attempts++;
        }
        
        if (attempts >= 10) {
          throw new Error('Failed to generate unique agent ID after 10 attempts');
        }
      }
      
      const agentData = {
        agentId: agentId,
        name: agentName,
        type: agentType,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastRun: null,
        settings: {
          enabled: true,
          intervalMinutes: 30,
          maxLeadsPerCycle: 5
        }
      };
      
      await this.addAgentToUser(userId, agentData);
      
      console.log(`✅ [AWS] Agent created: ${agentId} (${agentName}) for user ${userId}`);
      return agentData;
      
    } catch (error) {
      console.error('❌ [AWS] Error creating agent:', error);
      throw error;
    }
  }
  
  async getUserAgents(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user || !user.activeAgents) {
        return [];
      }
      return user.activeAgents;
    } catch (error) {
      console.error('❌ [AWS] Error getting user agents:', error);
      throw error;
    }
  }
  
  async updateAgentStatus(userId, agentId, status) {
    try {
      console.log('🤖 [AWS] Updating agent status:', userId, agentId, status);
      
      const user = await this.getUserById(userId);
      if (!user || !user.activeAgents) {
        throw new Error('User not found or has no agents');
      }
      
      const agentIndex = user.activeAgents.findIndex(agent => agent.agentId === agentId);
      if (agentIndex === -1) {
        throw new Error('Agent not found');
      }
      
      // Update the agent status
      user.activeAgents[agentIndex].status = status;
      user.activeAgents[agentIndex].updatedAt = new Date().toISOString();
      
      // Save back to AWS
      await this.updateUser(userId, {
        activeAgents: user.activeAgents
      });
      
      console.log('✅ [AWS] Agent status updated successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error updating agent status:', error);
      throw error;
    }
  }

  // =======================
  // AGENT SETTINGS METHODS
  // =======================
  
  async getLeadAgentSettings(userId, agentId = 'lead-agent') {
    try {
      console.log('⚙️ [AWS] Getting lead agent settings for userId:', userId, 'agentId:', agentId);
      
      // Ensure agentId is string for consistency with save
      const agentIdToUse = String(agentId);
      
      const command = new GetCommand({
        TableName: this.tables.agentSettings,
        Key: { 
          userId,
          agentId: agentIdToUse
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        // Only log when no settings found (reduced verbosity)
        console.log('❌ [AWS] No lead agent settings found for userId:', userId, 'agentId:', agentId);
        return null;
      }
      
      console.log('✅ [AWS] Lead agent settings retrieved successfully');
      return result.Item.settings;
    } catch (error) {
      console.error('❌ [AWS] Error getting lead agent settings:', error);
      throw error;
    }
  }
  
  async saveLeadAgentSettings(userId, agentId, settings) {
    try {
      console.log('💾 [AWS] Saving lead agent settings for userId:', userId, 'agentId:', agentId);
      
      // Ensure agentId is included in the settings and convert to string for consistency
      const agentIdToUse = String(agentId || settings.agentId || 'lead-agent');
      
      const command = new PutCommand({
        TableName: this.tables.agentSettings,
        Item: {
          userId,
          agentId: agentIdToUse,
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
  
  async deleteAgentSettings(userId, agentId) {
    try {
      console.log('🗑️ [AWS] Deleting agent settings for userId:', userId, 'agentId:', agentId);
      
      const command = new DeleteCommand({
        TableName: this.tables.agentSettings,
        Key: { 
          userId,
          agentId: String(agentId)
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Agent settings deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error deleting agent settings:', error);
      throw error;
    }
  }

  // Aliases for simpler method names
  async getAgentSettings(userId, agentId) {
    return this.getLeadAgentSettings(userId, agentId);
  }

  async saveAgentSettings(settings) {
    return this.saveLeadAgentSettings(settings.userId, settings.agentId, settings);
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

  // ====================
  // CYCLE LOGS METHODS
  // ====================
  
  async saveCycleLog(userId, agentId, cycleData) {
    try {
      const timestamp = cycleData.timestamp || new Date().toISOString();
      const cycleId = `${timestamp}#cycle${cycleData.cycleNumber}`;
      
      console.log('📊 [AWS] Saving cycle log for userId:', userId, 'agentId:', agentId, 'cycle:', cycleData.cycleNumber);
      
      const command = new PutCommand({
        TableName: this.tables.cycleLogs,
        Item: {
          userId,
          cycleId, // Sort key: timestamp#cycleNumber for time-series queries
          agentId,
          cycleNumber: cycleData.cycleNumber,
          completedAt: timestamp,
          leadsProcessed: cycleData.leadsProcessed || 0,
          emailsSent: cycleData.emailsSent || 0,
          stepsExecuted: cycleData.stepsExecuted || 0,
          success: cycleData.success !== false,
          ...cycleData
        }
      });
      
      await this.dynamodb.send(command);
      console.log('✅ [AWS] Cycle log saved successfully');
      return true;
    } catch (error) {
      console.error('❌ [AWS] Error saving cycle log:', error);
      throw error;
    }
  }
  
  async getCycleLogs(userId, agentId = null, limit = 100) {
    try {
      console.log('📊 [AWS] Getting cycle logs for userId:', userId, agentId ? `agentId: ${agentId}` : '(all agents)');
      
      const params = {
        TableName: this.tables.cycleLogs,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Sort descending (newest first)
        Limit: limit
      };
      
      // Filter by agent if specified
      if (agentId) {
        params.FilterExpression = 'agentId = :agentId';
        params.ExpressionAttributeValues[':agentId'] = agentId;
      }
      
      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);
      
      console.log(`✅ [AWS] Retrieved ${result.Items?.length || 0} cycle logs`);
      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error getting cycle logs:', error);
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

  // ===================================
  // CONTACTED LEADS DEDUPLICATION METHODS
  // ===================================

  /**
   * Add a contacted lead to the deduplication database
   * @param {string} userId - User ID who contacted the lead
   * @param {object} leadInfo - Lead information
   * @param {string} leadInfo.name - Lead's full name
   * @param {string} leadInfo.email - Lead's email address
   * @param {string} leadInfo.company - Lead's company name
   * @param {string} leadInfo.title - Lead's job title (optional)
   */
  async addContactedLead(userId, leadInfo) {
    try {
      console.log('📝 [AWS] Adding contacted lead:', leadInfo.name, 'at', leadInfo.company);

      // Create a unique contact ID combining name and company (to match deduplication logic)
      const contactId = `${leadInfo.name.toLowerCase().replace(/\s+/g, '_')}_${leadInfo.company.toLowerCase().replace(/\s+/g, '_')}`;
      
      const contactData = {
        contactKey: contactId, // Use contactKey as the primary key
        userId: userId,
        name: leadInfo.name,
        email: leadInfo.email.toLowerCase(),
        company: leadInfo.company,
        title: leadInfo.title || 'Unknown',
        contactedAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // Expire after 1 year
      };

      const command = new PutCommand({
        TableName: this.tables.contactedLeads,
        Item: contactData,
        ConditionExpression: 'attribute_not_exists(contactKey)' // Prevent overwriting existing contacts
      });

      await this.dynamodb.send(command);
      
      console.log('✅ [AWS] Successfully added contacted lead:', contactId);
      return { success: true, contactId };

    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log('⚠️ [AWS] Lead already exists in contacted database:', leadInfo.email);
        return { success: false, reason: 'already_contacted', contactId: null };
      }
      
      console.error('❌ [AWS] Failed to add contacted lead:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a contacted lead from the deduplication database
   * @param {string} userId - User ID who contacted the lead
   * @param {string} contactId - Contact ID to remove
   */
  async removeContactedLead(userId, contactId) {
    try {
      console.log('🗑️ [AWS] Removing contacted lead:', contactId);

      const command = new DeleteCommand({
        TableName: this.tables.contactedLeads,
        Key: {
          contactKey: contactId  // Use contactKey as the primary key (single key, not composite)
        }
      });

      await this.dynamodb.send(command);
      
      console.log('✅ [AWS] Successfully removed contacted lead:', contactId);
      return { success: true };

    } catch (error) {
      console.error('❌ [AWS] Failed to remove contacted lead:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if leads have already been contacted
   * @param {string} userId - User ID to check contacts for
   * @param {array} leads - Array of lead objects to check
   * @returns {object} - Object with newLeads and duplicateLeads arrays
   */
  async checkForDuplicateContacts(userId, leads) {
    try {
      console.log('🔍 [AWS] Checking', leads.length, 'leads for duplicates...');

      const newLeads = [];
      const duplicateLeads = [];

      // Check each lead individually
      for (const lead of leads) {
        // Apollo returns organization.name, normalize to company field
        const companyName = lead.company || lead.organization?.name;
        
        if (!lead.name || !companyName) {
          console.log('⚠️ [AWS] Skipping lead with missing data:', lead.name || 'MISSING', '| Company:', companyName || 'MISSING');
          continue;
        }

        // Use name + company as unique identifier (not email since Apollo doesn't provide emails)
        const contactId = `${lead.name.toLowerCase().replace(/\s+/g, '_')}_${companyName.toLowerCase().replace(/\s+/g, '_')}`;
        
        const command = new GetCommand({
          TableName: this.tables.contactedLeads,
          Key: { 
            contactKey: contactId  // Use contactKey as the primary key
          }
        });

        try {
          const result = await this.dynamodb.send(command);
          
          if (result.Item) {
            console.log('🔄 [AWS] Duplicate found:', lead.name, 'at', companyName, '(contacted:', result.Item.contactedAt, ')');
            duplicateLeads.push({
              ...lead,
              contactedAt: result.Item.contactedAt,
              reason: 'previously_contacted'
            });
          } else {
            console.log('✅ [AWS] New lead:', lead.name, 'at', companyName);
            newLeads.push(lead);
          }
        } catch (getError) {
          console.error('❌ [AWS] Error checking lead:', contactId, getError.message);
          // If there's an error checking, assume it's a new lead to be safe
          newLeads.push(lead);
        }
      }

      console.log(`📊 [AWS] Deduplication results: ${newLeads.length} new leads, ${duplicateLeads.length} duplicates filtered out`);
      
      return {
        success: true,
        newLeads,
        duplicateLeads,
        summary: {
          totalChecked: leads.length,
          newCount: newLeads.length,
          duplicateCount: duplicateLeads.length
        }
      };

    } catch (error) {
      console.error('❌ [AWS] Failed to check for duplicate contacts:', error);
      return {
        success: false,
        error: error.message,
        newLeads: leads, // Return all leads as "new" if check fails
        duplicateLeads: []
      };
    }
  }

  /**
   * Get contacted leads history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of records to return (optional)
   */
  async getContactedLeadsHistory(userId, limit = 100) {
    try {
      console.log('📊 [AWS] Getting contacted leads history for user:', userId);

      const command = new QueryCommand({
        TableName: this.tables.contactedLeads,
        IndexName: 'UserIdIndex', // Assumes GSI on userId
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });

      const result = await this.dynamodb.send(command);
      
      console.log('✅ [AWS] Retrieved', result.Items?.length || 0, 'contacted leads');
      return {
        success: true,
        contacts: result.Items || [],
        count: result.Items?.length || 0
      };

    } catch (error) {
      console.error('❌ [AWS] Failed to get contacted leads history:', error);
      return {
        success: false,
        error: error.message,
        contacts: []
      };
    }
  }

  /**
   * Clear all contacted leads for a specific user (for testing purposes)
   * @param {string} userId - User ID whose contacts to clear
   */
  async clearContactedLeads(userId) {
    try {
      console.log('🗑️ [AWS] Clearing all contacted leads for user:', userId);

      // First, get all contacts for this user
      const getCommand = new ScanCommand({
        TableName: this.tables.contactedLeads,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });

      const result = await this.dynamodb.send(getCommand);
      const contacts = result.Items || [];

      if (contacts.length === 0) {
        console.log('✅ [AWS] No contacts found to clear for user:', userId);
        return {
          success: true,
          deletedCount: 0,
          message: 'No contacts found to clear'
        };
      }

      // Delete each contact individually
      let deletedCount = 0;
      const deletePromises = contacts.map(async (contact) => {
        try {
          const deleteCommand = new DeleteCommand({
            TableName: this.tables.contactedLeads,
            Key: {
              contactKey: contact.contactKey  // Use contactKey as the primary key
            }
          });

          await this.dynamodb.send(deleteCommand);
          deletedCount++;
          console.log(`🗑️ [AWS] Deleted contact: ${contact.name} (${contact.email}) at ${contact.company}`);
        } catch (deleteError) {
          console.error('❌ [AWS] Failed to delete contact:', contact.contactId, deleteError.message);
        }
      });

      await Promise.all(deletePromises);

      console.log(`✅ [AWS] Successfully cleared ${deletedCount} contacted leads for user: ${userId}`);
      return {
        success: true,
        deletedCount: deletedCount,
        totalFound: contacts.length,
        message: `Cleared ${deletedCount} out of ${contacts.length} contacts`
      };

    } catch (error) {
      console.error('❌ [AWS] Failed to clear contacted leads:', error);
      return {
        success: false,
        error: error.message,
        deletedCount: 0
      };
    }
  }

  // =====================
  // API USAGE TRACKING METHODS
  // =====================

  /**
   * Log API usage (Apollo, OpenAI, Mailgun, etc.)
   */
  async logApiUsage({ userId, agentId, service, operation, usage, cost = null, metadata = {} }) {
    try {
      const timestamp = new Date().toISOString();
      
      // Calculate cost if not provided
      if (cost === null && this.apiCosts[service]) {
        cost = usage * this.apiCosts[service];
      }
      
      const command = new PutCommand({
        TableName: this.tables.apiUsage,
        Item: {
          userId,
          timestamp,
          agentId,
          service, // 'apollo', 'openai', 'mailgun', 'zerobounce'
          operation, // e.g., 'search', 'completion', 'send_email', 'email_validation'
          usage, // credits/tokens/emails used
          cost: cost || 0, // Cost in dollars
          metadata, // Additional data (model name, search query, etc.)
          createdAt: timestamp
        }
      });

      await this.dynamodb.send(command);
      console.log(`📊 [AWS] Logged ${service} usage: ${usage} (${operation}) - $${(cost || 0).toFixed(4)}`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Failed to log API usage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get API usage stats for a specific agent
   */
  async getAgentApiUsage(agentId, startDate = null, endDate = null) {
    try {
      const params = {
        TableName: this.tables.apiUsage,
        IndexName: 'agentId-timestamp-index',
        KeyConditionExpression: 'agentId = :agentId',
        ExpressionAttributeValues: {
          ':agentId': agentId
        }
      };

      // Add date range if provided
      if (startDate && endDate) {
        params.KeyConditionExpression += ' AND #ts BETWEEN :start AND :end';
        params.ExpressionAttributeNames = { '#ts': 'timestamp' };
        params.ExpressionAttributeValues[':start'] = startDate;
        params.ExpressionAttributeValues[':end'] = endDate;
      }

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      // Aggregate by service
      const stats = {
        apollo: { usage: 0, calls: 0, cost: 0 },
        openai: { usage: 0, calls: 0, cost: 0 },
        mailgun: { usage: 0, calls: 0, cost: 0 },
        zerobounce: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        if (stats[item.service]) {
          stats[item.service].usage += item.usage || 0;
          stats[item.service].calls += 1;
          stats[item.service].cost += item.cost || 0;
        }
      });

      return { success: true, stats, total: result.Items.length };
    } catch (error) {
      console.error('❌ [AWS] Failed to get agent API usage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get total API usage across all agents for a user
   */
  async getUserApiUsage(userId, startDate = null, endDate = null) {
    try {
      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      };

      // Add date range if provided
      if (startDate && endDate) {
        params.KeyConditionExpression += ' AND #ts BETWEEN :start AND :end';
        params.ExpressionAttributeNames = { '#ts': 'timestamp' };
        params.ExpressionAttributeValues[':start'] = startDate;
        params.ExpressionAttributeValues[':end'] = endDate;
      }

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      // Aggregate by service
      const stats = {
        apollo: { usage: 0, calls: 0, cost: 0 },
        openai: { usage: 0, calls: 0, cost: 0 },
        mailgun: { usage: 0, calls: 0, cost: 0 },
        zerobounce: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        if (stats[item.service]) {
          stats[item.service].usage += item.usage || 0;
          stats[item.service].calls += 1;
          stats[item.service].cost += item.cost || 0;
        }
      });

      return { success: true, stats, total: result.Items.length };
    } catch (error) {
      console.error('❌ [AWS] Failed to get user API usage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get API usage over time for graphing (last 7 days by default)
   */
  async getApiUsageTimeSeries(userId, days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId AND #ts >= :start',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':start': startDate.toISOString()
        }
      };

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      // Group by day and service
      const timeSeriesData = {};
      
      result.Items.forEach(item => {
        const date = item.timestamp.split('T')[0]; // Get YYYY-MM-DD
        
        if (!timeSeriesData[date]) {
          timeSeriesData[date] = {
            date,
            apollo: { usage: 0, cost: 0 },
            openai: { usage: 0, cost: 0 },
            mailgun: { usage: 0, cost: 0 },
            zerobounce: { usage: 0, cost: 0 },
            total: { usage: 0, cost: 0 }
          };
        }

        if (timeSeriesData[date][item.service]) {
          timeSeriesData[date][item.service].usage += item.usage || 0;
          timeSeriesData[date][item.service].cost += item.cost || 0;
          timeSeriesData[date].total.usage += item.usage || 0;
          timeSeriesData[date].total.cost += item.cost || 0;
        }
      });

      // Convert to array and sort by date
      const series = Object.values(timeSeriesData).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      return { success: true, series, days };
    } catch (error) {
      console.error('❌ [AWS] Failed to get API usage time series:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has exceeded API rate limits
   */
  async checkApiRateLimit(userId, service, requestedUsage = 1) {
    try {
      // Get user's configured rate limits
      const userSettings = await this.getUserSettings(userId);
      const rateLimits = userSettings?.apiRateLimits?.[service];

      if (!rateLimits) {
        // No limits configured, allow request
        return { 
          allowed: true, 
          reason: 'No rate limits configured',
          remaining: null 
        };
      }

      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Query usage for different time periods
      const [hourlyUsage, dailyUsage, monthlyUsage] = await Promise.all([
        rateLimits.hourly ? this.getApiUsageForPeriod(userId, service, hourStart) : { usage: 0 },
        rateLimits.daily ? this.getApiUsageForPeriod(userId, service, dayStart) : { usage: 0 },
        rateLimits.monthly ? this.getApiUsageForPeriod(userId, service, monthStart) : { usage: 0 }
      ]);

      // Check each limit
      if (rateLimits.hourly && hourlyUsage.usage + requestedUsage > rateLimits.hourly) {
        return {
          allowed: false,
          reason: 'hourly',
          limit: rateLimits.hourly,
          current: hourlyUsage.usage,
          resetTime: new Date(hourStart.getTime() + 3600000) // +1 hour
        };
      }

      if (rateLimits.daily && dailyUsage.usage + requestedUsage > rateLimits.daily) {
        return {
          allowed: false,
          reason: 'daily',
          limit: rateLimits.daily,
          current: dailyUsage.usage,
          resetTime: new Date(dayStart.getTime() + 86400000) // +1 day
        };
      }

      if (rateLimits.monthly && monthlyUsage.usage + requestedUsage > rateLimits.monthly) {
        return {
          allowed: false,
          reason: 'monthly',
          limit: rateLimits.monthly,
          current: monthlyUsage.usage,
          resetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1) // Next month
        };
      }

      return {
        allowed: true,
        remaining: {
          hourly: rateLimits.hourly ? rateLimits.hourly - hourlyUsage.usage : null,
          daily: rateLimits.daily ? rateLimits.daily - dailyUsage.usage : null,
          monthly: rateLimits.monthly ? rateLimits.monthly - monthlyUsage.usage : null
        }
      };
    } catch (error) {
      console.error('❌ [AWS] Error checking rate limit:', error);
      // On error, allow the request (fail open)
      return { allowed: true, reason: 'Error checking limits', error: error.message };
    }
  }

  /**
   * Get API usage for a specific time period
   */
  async getApiUsageForPeriod(userId, service, startDate) {
    try {
      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId AND #ts >= :start',
        FilterExpression: 'service = :service',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':start': startDate.toISOString(),
          ':service': service
        }
      };

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      const totalUsage = result.Items.reduce((sum, item) => sum + (item.usage || 0), 0);

      return { usage: totalUsage, calls: result.Items.length };
    } catch (error) {
      console.error('❌ [AWS] Error getting usage for period:', error);
      return { usage: 0, calls: 0 };
    }
  }
}

export default AWSManager;