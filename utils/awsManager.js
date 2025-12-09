import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand, SendRawEmailCommand, VerifyDomainIdentityCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';
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
      emailTracking: process.env.AWS_DYNAMODB_EMAIL_TRACKING_TABLE || 'meridian-email-tracking-v2',
      agentState: process.env.AWS_DYNAMODB_AGENT_STATE_TABLE || 'meridian-agent-state',
      contactedLeads: process.env.AWS_DYNAMODB_CONTACTED_LEADS_TABLE || 'meridian-contacted-leads',
      cycleLogs: process.env.AWS_DYNAMODB_CYCLE_LOGS_TABLE || 'meridian-cycle-logs',
      apiUsage: process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage',
      apiUsageSummary: process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary',
      issuesAlerts: process.env.AWS_DYNAMODB_ISSUES_ALERTS_TABLE || 'meridian-issues-alerts',
      unsubscribes: process.env.AWS_DYNAMODB_UNSUBSCRIBES_TABLE || 'meridian-unsubscribes',
      searchHistory: process.env.AWS_DYNAMODB_SEARCH_HISTORY_TABLE || 'meridian-search-history',
      paymentHistory: process.env.AWS_DYNAMODB_PAYMENT_HISTORY_TABLE || 'meridian-payment-history'
    };
    
    // API Cost rates (estimated)
    this.apiCosts = {
      apollo: 0.026, // $0.026 per credit ($65 for 2500 credits)
      openai: 0.0034 / 1000, // $0.0034 per 1K tokens for GPT-3.5 (1.7x)
      mailgun: 0.00136, // $0.00136 per email (1.7x)
      zerobounce: 0.0085, // $0.0085 per validation (1.7x)
      serper: 0.001 // $0.001 per search query ($50 for 50k credits)
    };
    
    // Removed initialization logs to reduce console noise
    // console.log('🔧 [AWS] AWSManager initialized with region:', this.region);
    // console.log('🔧 [AWS] Tables configured:', this.tables);
  }

  // =====================
  // USER SETTINGS METHODS
  // =====================
  
  async getUserSettings(userId) {
    try {
      // Reduced verbosity - only log errors
      
      const command = new GetCommand({
        TableName: this.tables.userSettings,
        Key: { userId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('❌ [AWS] No user settings found for userId:', userId);
        return null;
      }
      
      // Settings retrieved successfully (log removed for cleaner output)
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
      // Reduced verbosity - only log errors
      
      const command = new GetCommand({
        TableName: this.tables.users,
        Key: { userId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('❌ [AWS] No user found with ID:', userId);
        return null;
      }
      
      // User retrieved successfully (log removed for cleaner output)
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

  async getAllUsersWithGmail() {
    try {
      console.log('📋 [AWS] Getting all users with Gmail configured');
      
      // Scan user settings table for users with Gmail auth
      const params = {
        TableName: this.tables.userSettings,
        FilterExpression: 'attribute_exists(gmailAuth.refreshToken)'
      };
      
      const result = await this.dynamodb.send(new ScanCommand(params));
      const users = result.Items || [];
      
      console.log(`✅ [AWS] Found ${users.length} user(s) with Gmail configured`);
      return users;
    } catch (error) {
      console.error('❌ [AWS] Error getting users with Gmail:', error);
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
      // Reduced verbosity - only log errors
      
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
      
      // Settings retrieved successfully (log removed for cleaner output)
      return result.Item.settings;
    } catch (error) {
      console.error('❌ [AWS] Error getting lead agent settings:', error);
      throw error;
    }
  }
  
  async saveLeadAgentSettings(userId, agentId, settings) {
    try {
      console.log('💾 [AWS] Saving lead agent settings for userId:', userId, 'agentId:', agentId);
      console.log('💾 [AWS] EmailBuilder being saved:', JSON.stringify(settings.emailBuilder, null, 2));
      
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

  async getAllAgentStates(userId) {
    try {
      console.log('🤖 [AWS] Getting all agent states for userId:', userId);
      
      // Use Scan with filter instead of Query since table structure may not support querying by userId alone
      const result = await this.dynamodb.send(new ScanCommand({
        TableName: this.tables.agentState,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }));
      
      console.log(`✅ [AWS] Retrieved ${result.Items?.length || 0} agent states`);
      return { success: true, states: result.Items || [] };
    } catch (error) {
      console.error('❌ [AWS] Error getting all agent states:', error);
      return { success: false, error: error.message, states: [] };
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
  
  async sendEmail({ to, from, subject, htmlBody, textBody, userId = null }) {
    try {
      console.log('📧 [AWS SES] Sending email to:', to);
      
      // If userId provided, try to fetch their custom domain settings
      let fromAddress = from;
      if (userId) {
        try {
          const userSettings = await this.getUserSettings(userId);
          if (userSettings?.emailSettings?.customDomain && 
              userSettings?.emailSettings?.domainVerified && 
              userSettings?.emailSettings?.fromEmail) {
            // Use custom domain if verified
            fromAddress = userSettings.emailSettings.fromEmail;
            console.log(`📧 [AWS SES] Using custom domain email: ${fromAddress}`);
          }
        } catch (err) {
          console.log('⚠️ [AWS SES] Could not fetch custom domain, using default:', err.message);
        }
      }
      
      const command = new SendEmailCommand({
        Source: fromAddress,
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

  // Verify domain with AWS SES
  async verifyDomainWithSES(domain) {
    try {
      console.log(`🔐 [AWS SES] Verifying domain: ${domain}`);
      
      const command = new VerifyDomainIdentityCommand({
        Domain: domain
      });
      
      const result = await this.ses.send(command);
      
      console.log('✅ [AWS SES] Domain verification initiated. Verification token:', result.VerificationToken);
      
      return {
        success: true,
        verificationToken: result.VerificationToken,
        instructions: {
          recordType: 'TXT',
          recordName: `_amazonses.${domain}`,
          recordValue: result.VerificationToken,
          message: 'Add this TXT record to your DNS to complete verification'
        }
      };
    } catch (error) {
      console.error('❌ [AWS SES] Error verifying domain:', error);
      throw error;
    }
  }

  // Check domain verification status
  async checkDomainVerificationStatus(domain) {
    try {
      console.log(`🔍 [AWS SES] Checking verification status for: ${domain}`);
      
      const command = new GetIdentityVerificationAttributesCommand({
        Identities: [domain]
      });
      
      const result = await this.ses.send(command);
      const attributes = result.VerificationAttributes[domain];
      
      if (!attributes) {
        return {
          verified: false,
          status: 'NotStarted',
          message: 'Domain verification has not been initiated'
        };
      }
      
      return {
        verified: attributes.VerificationStatus === 'Success',
        status: attributes.VerificationStatus,
        verificationToken: attributes.VerificationToken,
        message: attributes.VerificationStatus === 'Success' 
          ? 'Domain is verified and ready to send emails'
          : attributes.VerificationStatus === 'Pending'
          ? 'Verification pending - check your DNS records'
          : 'Verification failed - please check your DNS records'
      };
    } catch (error) {
      console.error('❌ [AWS SES] Error checking domain status:', error);
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

      // Create a unique contact ID combining userId, name and company (user-specific deduplication)
      const contactId = `${userId}_${leadInfo.name.toLowerCase().replace(/\s+/g, '_')}_${leadInfo.company.toLowerCase().replace(/\s+/g, '_')}`;
      
      const contactData = {
        contactKey: contactId, // Use contactKey as the primary key (includes userId)
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
   * Check if leads have already been contacted OR unsubscribed
   * @param {string} userId - User ID to check contacts for
   * @param {array} leads - Array of lead objects to check
   * @returns {object} - Object with newLeads, duplicateLeads, and unsubscribedLeads arrays
   */
  async checkForDuplicateContacts(userId, leads) {
    try {
      console.log('🔍 [AWS] Checking', leads.length, 'leads for duplicates and unsubscribes...');

      const newLeads = [];
      const duplicateLeads = [];
      const unsubscribedLeads = [];

      // Check each lead individually
      for (const lead of leads) {
        // Apollo returns organization.name, normalize to company field
        const companyName = lead.company || lead.organization?.name;
        const leadEmail = lead.email || lead.email_address;
        
        if (!lead.name || !companyName) {
          console.log('⚠️ [AWS] Skipping lead with missing data:', lead.name || 'MISSING', '| Company:', companyName || 'MISSING');
          continue;
        }

        // STEP 1: Check if email is unsubscribed (blocks across ALL agents for this user)
        if (leadEmail) {
          const unsubCheckCommand = new GetCommand({
            TableName: this.tables.unsubscribes,
            Key: {
              email: leadEmail.toLowerCase()
            }
          });

          try {
            const unsubResult = await this.dynamodb.send(unsubCheckCommand);
            if (unsubResult.Item && unsubResult.Item.userId === userId) {
              console.log('🚫 [UNSUBSCRIBED]:', lead.name, '(', leadEmail, ') - BLOCKED');
              unsubscribedLeads.push({
                ...lead,
                unsubscribedAt: unsubResult.Item.timestamp,
                reason: 'unsubscribed'
              });
              continue; // Skip to next lead
            }
          } catch (unsubError) {
            console.error('❌ [AWS] Error checking unsubscribe:', leadEmail, unsubError.message);
            // Continue to duplicate check if unsubscribe check fails
          }
        }

        // STEP 2: Check if already contacted (user-level, not agent-specific)
        // Use userId + name + company as unique identifier (ALL agents for this user share this list)
        const contactId = `${userId}_${lead.name.toLowerCase().replace(/\s+/g, '_')}_${companyName.toLowerCase().replace(/\s+/g, '_')}`;
        
        const command = new GetCommand({
          TableName: this.tables.contactedLeads,
          Key: { 
            contactKey: contactId  // Use contactKey as the primary key (includes userId)
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

      console.log(`📊 [AWS] Deduplication results: ${newLeads.length} new leads, ${duplicateLeads.length} duplicates, ${unsubscribedLeads.length} unsubscribed`);
      
      return {
        success: true,
        newLeads,
        duplicateLeads,
        unsubscribedLeads,
        summary: {
          totalChecked: leads.length,
          newCount: newLeads.length,
          duplicateCount: duplicateLeads.length,
          unsubscribedCount: unsubscribedLeads.length
        }
      };

    } catch (error) {
      console.error('❌ [AWS] Failed to check for duplicate contacts:', error);
      return {
        success: false,
        error: error.message,
        newLeads: leads, // Return all leads as "new" if check fails
        duplicateLeads: [],
        unsubscribedLeads: []
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
      
      // Filter out undefined values from metadata to avoid DynamoDB errors
      const cleanMetadata = Object.fromEntries(
        Object.entries(metadata).filter(([_, value]) => value !== undefined)
      );
      
      const item = {
        userId,
        timestamp,
        agentId,
        service, // 'apollo', 'openai', 'mailgun', 'zerobounce'
        operation, // e.g., 'search', 'completion', 'send_email', 'email_validation'
        usage, // credits/tokens/emails used
        cost: cost || 0, // Cost in dollars
        metadata: cleanMetadata, // Additional data (model name, search query, etc.) - cleaned of undefined
        createdAt: timestamp
      };
      
      console.log(`🔍 [AWS DEBUG] Writing to table: ${this.tables.apiUsage}, userId: ${userId}, service: ${service}, cost: ${cost}`);
      
      const command = new PutCommand({
        TableName: this.tables.apiUsage,
        Item: item
      });

      const writeResult = await this.dynamodb.send(command);
      console.log(`📊 [AWS] Logged ${service} usage: ${usage} (${operation}) - $${(cost || 0).toFixed(4)}`);
      console.log(`✅ [AWS] DynamoDB write confirmed:`, JSON.stringify(writeResult.$metadata));
      
      // Update summary table asynchronously (don't wait)
      this.updateApiUsageSummary(userId, service, usage, cost || 0).catch(err => {
        console.error('⚠️  [AWS] Failed to update summary:', err.message);
      });
      
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Failed to log API usage:', error);
      console.error('❌ [AWS] Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }
  }

  /**
   * Update API usage summary table (aggregated totals per user)
   */
  async updateApiUsageSummary(userId, service, usage, cost) {
    try {
      // Get current month in YYYY-MM format
      const month = new Date().toISOString().slice(0, 7);
      
      // First, try to get existing record
      const getCommand = new GetCommand({
        TableName: this.tables.apiUsageSummary,
        Key: { userId, month }
      });
      
      const existing = await this.dynamodb.send(getCommand);
      
      // Build the service stats
      const serviceStats = existing.Item?.[service] || { usage: 0, calls: 0, cost: 0 };
      serviceStats.usage += usage;
      serviceStats.calls += 1;
      serviceStats.cost += cost;
      
      // Update with new values
      const putCommand = new PutCommand({
        TableName: this.tables.apiUsageSummary,
        Item: {
          ...existing.Item,
          userId,
          month,
          [service]: serviceStats,
          updatedAt: new Date().toISOString()
        }
      });

      await this.dynamodb.send(putCommand);
      console.log(`✅ [SUMMARY] Updated ${service} totals for user ${userId} (${month})`);
    } catch (error) {
      console.error(`❌ [SUMMARY] Failed to update summary:`, error.message);
      throw error;
    }
  }

  /**
   * Get API usage from summary table (fast, no aggregation needed)
   */
  async getUserApiUsageSummary(userId) {
    try {
      // Query all months for this user and aggregate
      const command = new QueryCommand({
        TableName: this.tables.apiUsageSummary,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });

      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        // No summary yet, return empty stats
        return {
          success: true,
          stats: {
            apollo: { usage: 0, calls: 0, cost: 0 },
            openai: { usage: 0, calls: 0, cost: 0 },
            mailgun: { usage: 0, calls: 0, cost: 0 },
            zerobounce: { usage: 0, calls: 0, cost: 0 },
            serper: { usage: 0, calls: 0, cost: 0 }
          }
        };
      }

      // Aggregate across all months
      const stats = {
        apollo: { usage: 0, calls: 0, cost: 0 },
        openai: { usage: 0, calls: 0, cost: 0 },
        mailgun: { usage: 0, calls: 0, cost: 0 },
        zerobounce: { usage: 0, calls: 0, cost: 0 },
        serper: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        ['apollo', 'openai', 'mailgun', 'zerobounce', 'serper'].forEach(service => {
          if (item[service]) {
            stats[service].usage += item[service].usage || 0;
            stats[service].calls += item[service].calls || 0;
            stats[service].cost += item[service].cost || 0;
          }
        });
      });

      return { success: true, stats };
    } catch (error) {
      console.error('❌ [SUMMARY] Failed to get user summary:', error.message);
      return {
        success: false,
        error: error.message,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get API usage stats for a specific agent (with retry logic for throttling)
   */
  async getAgentApiUsage(agentId, startDate = null, endDate = null, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      // Use Query with GSI for fast lookups by agentId
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
        zerobounce: { usage: 0, calls: 0, cost: 0 },
        serper: { usage: 0, calls: 0, cost: 0 }
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
      // Check if it's a throttling error
      if (error.name === 'ProvisionedThroughputExceededException' && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`⚠️ [AWS] Throttled on getAgentApiUsage, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAgentApiUsage(agentId, startDate, endDate, retryCount + 1);
      }
      
      // Log error but don't crash - return empty stats
      console.error('❌ [AWS] Failed to get agent API usage:', error.message);
      return { 
        success: false, 
        error: error.message,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get total API usage across all agents for a user (with retry logic for throttling)
   */
  async getUserApiUsage(userId, startDate = null, endDate = null, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ConsistentRead: true // Force strongly consistent reads to see latest data immediately
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
        zerobounce: { usage: 0, calls: 0, cost: 0 },
        serper: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        if (stats[item.service]) {
          // Handle usage which can be a number or object (e.g., { tokens: 123 } or { credits: 5 })
          let usageValue = 0;
          if (typeof item.usage === 'object' && item.usage !== null) {
            // Extract the numeric value from the object (tokens, credits, searches, etc.)
            usageValue = Object.values(item.usage)[0] || 0;
          } else {
            usageValue = item.usage || 0;
          }
          
          stats[item.service].usage += usageValue;
          stats[item.service].calls += 1;
          stats[item.service].cost += item.cost || 0;
        }
      });

      return { success: true, stats, total: result.Items.length };
    } catch (error) {
      // Check if it's a throttling error
      if (error.name === 'ProvisionedThroughputExceededException' && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`⚠️ [AWS] Throttled on getUserApiUsage, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getUserApiUsage(userId, startDate, endDate, retryCount + 1);
      }
      
      // Log error but don't crash - return empty stats
      console.error('❌ [AWS] Failed to get user API usage:', error.message);
      return { 
        success: false, 
        error: error.message,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get API usage over time for graphing (last 7 days by default)
   */
  async getApiUsageTimeSeries(userId, days = 7, interval = 'day') {
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

      // Group by interval and service
      const timeSeriesData = {};
      
      result.Items.forEach(item => {
        const timestamp = new Date(item.timestamp);
        let key;
        let displayDate;
        
        // Generate key based on interval
        switch(interval) {
          case 'minute':
            // Round to nearest minute
            timestamp.setSeconds(0, 0);
            key = timestamp.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
            const mins = timestamp.getMinutes();
            const hourMin = timestamp.getHours();
            const ampmMin = hourMin >= 12 ? 'PM' : 'AM';
            const hour12Min = hourMin % 12 || 12;
            displayDate = `${hour12Min}:${mins.toString().padStart(2, '0')} ${ampmMin}`;
            break;
          case 'hour':
            // Round to nearest hour
            timestamp.setMinutes(0, 0, 0);
            key = timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
            const hr = timestamp.getHours();
            const ampm = hr >= 12 ? 'PM' : 'AM';
            const hour12 = hr % 12 || 12;
            displayDate = `${hour12} ${ampm}`;
            break;
          case 'month':
            // Group by month
            key = timestamp.toISOString().slice(0, 7); // YYYY-MM
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${months[timestamp.getMonth()]} ${timestamp.getFullYear()}`;
            break;
          case 'day':
          default:
            // Group by day
            key = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
            const monthsDay = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${monthsDay[timestamp.getMonth()]} ${timestamp.getDate()}`;
            break;
        }
        
        if (!timeSeriesData[key]) {
          timeSeriesData[key] = {
            date: displayDate,
            sortKey: key,
            // Flattened structure for API calls chart
            apolloCalls: 0,
            openaiCalls: 0,
            mailgunCalls: 0,
            zerbounceCalls: 0,
            serperCalls: 0,
            totalCalls: 0,
            // Nested structure for cost chart (you liked this format)
            apollo: { cost: 0 },
            openai: { cost: 0 },
            mailgun: { cost: 0 },
            zerobounce: { cost: 0 },
            serper: { cost: 0 },
            total: { cost: 0 }
          };
        }

        // Map service names to property names
        const serviceMap = {
          'apollo': 'apollo',
          'openai': 'openai',
          'mailgun': 'mailgun',
          'zerobounce': 'zerobounce',
          'serper': 'serper'
        };

        const serviceName = serviceMap[item.service];
        if (serviceName) {
          // Update flat calls properties - count each log entry as 1 API call
          timeSeriesData[key][`${serviceName}Calls`] += 1;
          timeSeriesData[key].totalCalls += 1;
          
          // Update nested cost objects
          if (timeSeriesData[key][item.service]) {
            timeSeriesData[key][item.service].cost += item.cost || 0;
            timeSeriesData[key].total.cost += item.cost || 0;
          }
        }
      });

      // Fill in missing time periods with zeros
      const now = new Date();
      const startTime = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      const filledData = {};
      
      // Generate all time periods in range
      let currentTime = new Date(startTime);
      while (currentTime <= now) {
        let key;
        let displayDate;
        
        switch(interval) {
          case 'minute':
            currentTime.setSeconds(0, 0);
            key = currentTime.toISOString().slice(0, 16);
            const mins = currentTime.getMinutes();
            const hourMin = currentTime.getHours();
            const ampmMin = hourMin >= 12 ? 'PM' : 'AM';
            const hour12Min = hourMin % 12 || 12;
            displayDate = `${hour12Min}:${mins.toString().padStart(2, '0')} ${ampmMin}`;
            currentTime.setMinutes(currentTime.getMinutes() + 1);
            break;
          case 'hour':
            currentTime.setMinutes(0, 0, 0);
            key = currentTime.toISOString().slice(0, 13);
            const hr = currentTime.getHours();
            const ampm = hr >= 12 ? 'PM' : 'AM';
            const hour12 = hr % 12 || 12;
            displayDate = `${hour12} ${ampm}`;
            currentTime.setHours(currentTime.getHours() + 1);
            break;
          case 'month':
            key = currentTime.toISOString().slice(0, 7);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${months[currentTime.getMonth()]} ${currentTime.getFullYear()}`;
            currentTime.setMonth(currentTime.getMonth() + 1);
            break;
          case 'day':
          default:
            key = currentTime.toISOString().split('T')[0];
            const monthsDay = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${monthsDay[currentTime.getMonth()]} ${currentTime.getDate()}`;
            currentTime.setDate(currentTime.getDate() + 1);
            break;
        }
        
        // Use existing data or create empty entry
        filledData[key] = timeSeriesData[key] || {
          date: displayDate,
          sortKey: key,
          apolloCalls: 0,
          openaiCalls: 0,
          mailgunCalls: 0,
          zerbounceCalls: 0,
          serperCalls: 0,
          totalCalls: 0,
          apollo: { cost: 0 },
          openai: { cost: 0 },
          mailgun: { cost: 0 },
          zerobounce: { cost: 0 },
          serper: { cost: 0 },
          total: { cost: 0 }
        };
      }

      // Convert to array and sort by sortKey (chronological order)
      const series = Object.values(filledData).sort((a, b) => 
        a.sortKey.localeCompare(b.sortKey)
      );

      return { success: true, series, days, interval };
    } catch (error) {
      console.error('❌ [AWS] Failed to get API usage time series:', error);
      
      // Check if it's a throughput exceeded error
      if (error.name === 'ProvisionedThroughputExceededException' || 
          error.__type?.includes('ProvisionedThroughputExceededException')) {
        console.log('⚠️  [AWS] Throughput exceeded - returning empty data set (this is cached to prevent further queries)');
        // Return empty data instead of error - this will be cached
        return { 
          success: true, 
          series: [], 
          days, 
          interval,
          throttled: true,
          message: 'API usage data temporarily unavailable due to high load. Data will refresh in a few minutes.'
        };
      }
      
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

  // =====================
  // Issues & Alerts Methods
  // =====================

  /**
   * Add an issue or alert
   * @param {string} userId - User ID
   * @param {string} type - Type: 'error', 'warning', 'info'
   * @param {string} title - Issue title
   * @param {string} message - Issue message
   * @param {object} metadata - Additional metadata
   */
  async addIssue(userId, type, title, message, metadata = {}) {
    try {
      const timestamp = new Date().toISOString();
      const issueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract severity from metadata if provided, default to 'medium'
      const { severity = 'medium', ...otherMetadata } = metadata;
      
      const issue = {
        PK: `USER#${userId}`,
        SK: `ISSUE#${timestamp}#${issueId}`,
        issueId,
        userId,
        type, // billing, agent, email, system
        severity, // critical, high, medium, low (top-level for easy filtering)
        title,
        message,
        metadata: otherMetadata, // Store remaining metadata
        timestamp,
        read: false,
        createdAt: timestamp
      };

      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.issuesAlerts,
        Item: issue
      }));

      console.log(`✅ [AWS] Added ${type} issue (${severity}): ${title}`);

      // Clean up old issues if over 100
      await this.cleanupOldIssues(userId);

      return { success: true, issueId };
    } catch (error) {
      console.error('❌ [AWS] Error adding issue:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all issues/alerts for a user
   */
  async getIssues(userId, limit = 100) {
    try {
      const command = new QueryCommand({
        TableName: this.tables.issuesAlerts,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'ISSUE#'
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });

      const result = await this.dynamodb.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error getting issues:', error);
      return [];
    }
  }

  /**
   * Mark issue as read
   */
  async markIssueAsRead(userId, issueId) {
    try {
      // Find the issue first to get the full SK
      const issues = await this.getIssues(userId);
      const issue = issues.find(i => i.issueId === issueId);
      
      if (!issue) {
        throw new Error('Issue not found');
      }

      await this.dynamodb.send(new UpdateCommand({
        TableName: this.tables.issuesAlerts,
        Key: {
          PK: issue.PK,
          SK: issue.SK
        },
        UpdateExpression: 'SET #read = :read',
        ExpressionAttributeNames: {
          '#read': 'read'
        },
        ExpressionAttributeValues: {
          ':read': true
        }
      }));

      console.log(`✅ [AWS] Marked issue as read: ${issueId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Error marking issue as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all issues for a user
   */
  async clearAllIssues(userId) {
    try {
      // Get all issues for this user
      const issues = await this.getIssues(userId, 500); // Get more items for deletion
      
      if (issues.length === 0) {
        console.log(`✅ [AWS] No issues to clear for user ${userId}`);
        return { success: true, deleted: 0 };
      }

      // Delete all issues in batches
      const batchSize = 25; // DynamoDB batch write limit
      let deletedCount = 0;

      for (let i = 0; i < issues.length; i += batchSize) {
        const batch = issues.slice(i, i + batchSize);
        const deleteRequests = batch.map(issue => ({
          DeleteRequest: {
            Key: {
              PK: issue.PK,
              SK: issue.SK
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tables.issuesAlerts]: deleteRequests
          }
        }));

        deletedCount += deleteRequests.length;
      }

      console.log(`✅ [AWS] Cleared ${deletedCount} issues for user ${userId}`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('❌ [AWS] Error clearing all issues:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all cycle logs for a user
   */
  async clearAllCycleLogs(userId) {
    try {
      // Get all cycle logs for this user
      const cycleLogs = await this.getCycleLogs(userId, null, 500); // Get more items for deletion
      
      if (cycleLogs.length === 0) {
        console.log(`✅ [AWS] No cycle logs to clear for user ${userId}`);
        return { success: true, deleted: 0 };
      }

      // Delete all cycle logs in batches
      const batchSize = 25; // DynamoDB batch write limit
      let deletedCount = 0;

      for (let i = 0; i < cycleLogs.length; i += batchSize) {
        const batch = cycleLogs.slice(i, i + batchSize);
        const deleteRequests = batch.map(cycle => ({
          DeleteRequest: {
            Key: {
              userId: cycle.userId,
              cycleId: cycle.cycleId // Use cycleId as the sort key, not timestamp
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tables.cycleLogs]: deleteRequests
          }
        }));

        deletedCount += deleteRequests.length;
      }

      console.log(`✅ [AWS] Cleared ${deletedCount} cycle logs for user ${userId}`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('❌ [AWS] Error clearing all cycle logs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete old issues if count exceeds 100
   */
  async cleanupOldIssues(userId) {
    try {
      const issues = await this.getIssues(userId, 150); // Get more than limit to check

      if (issues.length > 100) {
        // Delete oldest issues (they're sorted newest first)
        const toDelete = issues.slice(100);
        
        for (const issue of toDelete) {
          await this.dynamodb.send(new DeleteCommand({
            TableName: this.tables.issuesAlerts,
            Key: {
              PK: issue.PK,
              SK: issue.SK
            }
          }));
        }

        console.log(`🗑️ [AWS] Cleaned up ${toDelete.length} old issues`);
      }
    } catch (error) {
      console.error('❌ [AWS] Error cleaning up old issues:', error);
    }
  }

  /**
   * Delete a specific issue
   */
  async deleteIssue(userId, issueId) {
    try {
      const issues = await this.getIssues(userId);
      const issue = issues.find(i => i.issueId === issueId);
      
      if (!issue) {
        throw new Error('Issue not found');
      }

      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tables.issuesAlerts,
        Key: {
          PK: issue.PK,
          SK: issue.SK
        }
      }));

      console.log(`✅ [AWS] Deleted issue: ${issueId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Error deleting issue:', error);
      return { success: false, error: error.message };
    }
  }

  // ======================
  // PAYMENT HISTORY METHODS
  // ======================

  /**
   * Log a payment transaction
   */
  async logPayment(userId, paymentData) {
    try {
      const timestamp = new Date().toISOString();
      const paymentId = `PAYMENT#${timestamp}#${Math.random().toString(36).substr(2, 9)}`;

      const command = new PutCommand({
        TableName: this.tables.paymentHistory,
        Item: {
          userId,
          paymentId,
          timestamp,
          amount: paymentData.amount,
          status: paymentData.status, // 'success', 'failed', 'refunded'
          currency: paymentData.currency || 'USD',
          stripePaymentIntentId: paymentData.stripePaymentIntentId,
          billingPeriod: paymentData.billingPeriod,
          description: paymentData.description || `Monthly billing for ${paymentData.billingPeriod}`,
          errorMessage: paymentData.errorMessage || null,
          metadata: paymentData.metadata || {}
        }
      });

      await this.dynamodb.send(command);
      console.log(`💳 [AWS] Logged payment: ${paymentData.status} - $${paymentData.amount}`);
      return { success: true, paymentId };
    } catch (error) {
      console.error('❌ [AWS] Error logging payment:', error);
      throw error;
    }
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId, limit = 20) {
    try {
      const command = new QueryCommand({
        TableName: this.tables.paymentHistory,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });

      const result = await this.dynamodb.send(command);
      console.log(`✅ [AWS] Retrieved ${result.Items?.length || 0} payment records`);
      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error getting payment history:', error);
      return [];
    }
  }

  /**
   * Get payment statistics for a user
   */
  async getPaymentStats(userId) {
    try {
      const payments = await this.getPaymentHistory(userId, 100);
      
      const stats = {
        totalPaid: 0,
        totalFailed: 0,
        successCount: 0,
        failedCount: 0,
        lastSuccessfulPayment: null,
        lastFailedPayment: null
      };

      // Track unique billing periods to avoid counting duplicates
      const successfulPeriods = new Set();
      const failedPeriods = new Map(); // Map to store amount per period

      payments.forEach(payment => {
        if (payment.status === 'success') {
          // Only count each successful billing period once
          if (!successfulPeriods.has(payment.billingPeriod)) {
            stats.totalPaid += payment.amount;
            stats.successCount++;
            successfulPeriods.add(payment.billingPeriod);
          }
          if (!stats.lastSuccessfulPayment || payment.timestamp > stats.lastSuccessfulPayment.timestamp) {
            stats.lastSuccessfulPayment = payment;
          }
        } else if (payment.status === 'failed') {
          // Only count each failed billing period once (use the first/latest attempt amount)
          if (!failedPeriods.has(payment.billingPeriod)) {
            failedPeriods.set(payment.billingPeriod, payment.amount);
            stats.failedCount++;
          }
          if (!stats.lastFailedPayment || payment.timestamp > stats.lastFailedPayment.timestamp) {
            stats.lastFailedPayment = payment;
          }
        }
      });

      // Sum up unique failed amounts
      stats.totalFailed = Array.from(failedPeriods.values()).reduce((sum, amount) => sum + amount, 0);

      // Calculate next billing date (first of next month)
      const now = new Date();
      const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      stats.nextBillingDate = nextBillingDate.toISOString();

      console.log(`✅ [AWS] Payment stats: ${stats.successCount} successful, ${stats.failedCount} failed (unique periods)`);
      return stats;
    } catch (error) {
      console.error('❌ [AWS] Error getting payment stats:', error);
      return null;
    }
  }

  // ======================
  // UNSUBSCRIBE MANAGEMENT
  // ======================

  /**
   * Add email to unsubscribe list
   */
  async addUnsubscribe(email, reason = 'User request', metadata = {}) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const timestamp = new Date().toISOString();
      
      const item = {
        PK: `UNSUBSCRIBE#${normalizedEmail}`,
        SK: timestamp,
        email: normalizedEmail,
        reason,
        unsubscribedAt: timestamp,
        metadata: metadata || {},
        type: 'unsubscribe'
      };

      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.unsubscribes,
        Item: item
      }));

      console.log(`🚫 [AWS] Email unsubscribed: ${normalizedEmail}`);
      return { success: true, email: normalizedEmail };
    } catch (error) {
      console.error('❌ [AWS] Error adding unsubscribe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if email is unsubscribed
   */
  async isUnsubscribed(email) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.unsubscribes,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `UNSUBSCRIBE#${normalizedEmail}`
        },
        Limit: 1
      }));

      return result.Items && result.Items.length > 0;
    } catch (error) {
      console.error('❌ [AWS] Error checking unsubscribe status:', error);
      return false; // Default to not unsubscribed on error
    }
  }

  /**
   * Get all unsubscribed emails for a user's campaigns
   */
  async getUnsubscribes(limit = 100) {
    try {
      const result = await this.dynamodb.send(new ScanCommand({
        TableName: this.tables.unsubscribes,
        Limit: limit
      }));

      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error fetching unsubscribes:', error);
      return [];
    }
  }

  /**
   * Remove email from unsubscribe list (re-subscribe)
   */
  async removeUnsubscribe(email) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Find the item first
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.unsubscribes,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `UNSUBSCRIBE#${normalizedEmail}`
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return { success: false, error: 'Email not in unsubscribe list' };
      }

      // Delete all entries for this email
      for (const item of result.Items) {
        await this.dynamodb.send(new DeleteCommand({
          TableName: this.tables.unsubscribes,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      console.log(`✅ [AWS] Email re-subscribed: ${normalizedEmail}`);
      return { success: true, email: normalizedEmail };
    } catch (error) {
      console.error('❌ [AWS] Error removing unsubscribe:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SEARCH HISTORY TRACKING ====================
  
  async recordSearchHistory(userId, agentId, industry, position, leadsFound) {
    try {
      const timestamp = Date.now();
      const searchKey = `${industry.toLowerCase()}#${position.toLowerCase()}`;
      
      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.searchHistory,
        Item: {
          PK: `USER#${userId}#AGENT#${agentId}`,
          SK: `SEARCH#${timestamp}`,
          searchKey: searchKey,
          industry: industry.toLowerCase(),
          position: position,
          leadsFound: leadsFound,
          timestamp: timestamp,
          searchDate: new Date(timestamp).toISOString(),
          TTL: Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60) // 90 day TTL
        }
      }));
      
      console.log(`📝 [SEARCH HISTORY] Recorded: ${industry} + ${position} (${leadsFound} leads)`);
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Error recording search history:', error);
      return { success: false, error: error.message };
    }
  }

  async checkSearchHistory(userId, agentId, industry, position, daysBack = 30) {
    try {
      const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
      const searchKey = `${industry.toLowerCase()}#${position.toLowerCase()}`;
      
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.searchHistory,
        KeyConditionExpression: 'PK = :pk AND SK >= :cutoff',
        FilterExpression: 'searchKey = :searchKey',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#AGENT#${agentId}`,
          ':cutoff': `SEARCH#${cutoffTime}`,
          ':searchKey': searchKey
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1
      }));

      if (result.Items && result.Items.length > 0) {
        const lastSearch = result.Items[0];
        const daysAgo = Math.floor((Date.now() - lastSearch.timestamp) / (24 * 60 * 60 * 1000));
        console.log(`⚠️ [DUPLICATE] Already searched ${industry} + ${position} ${daysAgo} days ago (${lastSearch.leadsFound} leads)`);
        return {
          isDuplicate: true,
          lastSearched: lastSearch.timestamp,
          daysAgo: daysAgo,
          leadsFound: lastSearch.leadsFound
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('❌ [AWS] Error checking search history:', error);
      return { isDuplicate: false }; // Don't block searches on error
    }
  }

  async getSearchHistory(userId, agentId, limit = 50) {
    try {
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.searchHistory,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#AGENT#${agentId}`
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      }));

      return {
        success: true,
        searches: result.Items || []
      };
    } catch (error) {
      console.error('❌ [AWS] Error getting search history:', error);
      return { success: false, error: error.message, searches: [] };
    }
  }

  async deleteSearchHistory(userId, agentId) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      
      // Query all search history entries
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.searchHistory,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        console.log(`📝 [AWS] No search history found for agent ${agentId}`);
        return { success: true, deletedCount: 0 };
      }

      // Delete all entries
      for (const item of result.Items) {
        await this.dynamodb.send(new DeleteCommand({
          TableName: this.tables.searchHistory,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      console.log(`✅ [AWS] Deleted ${result.Items.length} search history entries for agent ${agentId}`);
      return { success: true, deletedCount: result.Items.length };
    } catch (error) {
      console.error('❌ [AWS] Error deleting search history:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteAgentState(userId, agentId) {
    try {
      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tables.agentState,
        Key: {
          userId: userId,
          agentId: agentId
        }
      }));

      console.log(`✅ [AWS] Deleted agent state for ${agentId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Error deleting agent state:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteCycleLogs(userId, agentId) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      
      // Query all cycle logs
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.cycleLogs,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        console.log(`📝 [AWS] No cycle logs found for agent ${agentId}`);
        return { success: true, deletedCount: 0 };
      }

      // Delete all entries
      for (const item of result.Items) {
        await this.dynamodb.send(new DeleteCommand({
          TableName: this.tables.cycleLogs,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      console.log(`✅ [AWS] Deleted ${result.Items.length} cycle logs for agent ${agentId}`);
      return { success: true, deletedCount: result.Items.length };
    } catch (error) {
      console.error('❌ [AWS] Error deleting cycle logs:', error);
      return { success: false, error: error.message };
    }
  }

  // =======================
  // EMAIL TRACKING METHODS
  // =======================
  
  async logEmailTracking(userId, agentId, trackingId, eventData) {
    try {
      const timestamp = new Date().toISOString();
      const eventId = `${trackingId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`📝 [EMAIL-TRACKING] Logging event:`, {
        eventType: eventData.eventType,
        userId,
        agentId,
        trackingId,
        recipientEmail: eventData.recipientEmail,
        timestamp
      });
      
      const command = new PutCommand({
        TableName: this.tables.emailTracking,
        Item: {
          PK: `USER#${userId}#AGENT#${agentId}`,  // Efficient querying by user/agent
          SK: `EVENT#${timestamp}#${eventId}`,     // Chronological ordering
          userId,
          agentId,
          trackingId,
          eventId,
          timestamp,
          ...eventData
        }
      });
      
      await this.dynamodb.send(command);
      console.log(`✅ [EMAIL-TRACKING] Event logged successfully: ${eventData.eventType}`, { eventId });
      return { success: true, eventId };
    } catch (error) {
      console.error('❌ [EMAIL-TRACKING] Error logging email tracking:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getEmailTrackingByTracking(trackingId) {
    try {
      // Use GSI for efficient querying by trackingId
      const command = new QueryCommand({
        TableName: this.tables.emailTracking,
        IndexName: 'TrackingIdIndex',
        KeyConditionExpression: 'trackingId = :trackingId',
        ExpressionAttributeValues: {
          ':trackingId': trackingId
        }
      });
      
      const result = await this.dynamodb.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('❌ [AWS] Error getting email tracking:', error);
      return [];
    }
  }
  
  async getEmailTrackingByUser(userId, agentId = null, limit = 1000) {
    try {
      console.log(`🔍 [EMAIL-TRACKING] Retrieving events for userId: ${userId}`, { agentId, limit });
      
      if (!agentId) {
        console.log(`⚠️ [EMAIL-TRACKING] agentId required for efficient query, falling back to scan`);
        return [];
      }
      
      const pk = `USER#${userId}#AGENT#${agentId}`;
      let allEvents = [];
      let lastEvaluatedKey = null;
      let pageCount = 0;
      
      // Use Query instead of Scan - much more efficient!
      do {
        pageCount++;
        const commandParams = {
          TableName: this.tables.emailTracking,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': pk
          },
          Limit: limit
        };
        
        if (lastEvaluatedKey) {
          commandParams.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const command = new QueryCommand(commandParams);
        const result = await this.dynamodb.send(command);
        const events = result.Items || [];
        allEvents = allEvents.concat(events);
        lastEvaluatedKey = result.LastEvaluatedKey;
        
        console.log(`🔍 [EMAIL-TRACKING] Page ${pageCount}: Retrieved ${events.length} events, total so far: ${allEvents.length}, hasMore: ${!!lastEvaluatedKey}`);
        
        if (allEvents.length >= limit) {
          allEvents = allEvents.slice(0, limit);
          break;
        }
      } while (lastEvaluatedKey);
      
      console.log(`✅ [EMAIL-TRACKING] Retrieved ${allEvents.length} total events in ${pageCount} page(s)`);
      
      if (allEvents.length > 0) {
        console.log(`🔍 [EMAIL-TRACKING] Event types found:`, [...new Set(allEvents.map(e => e.eventType))].join(', '));
      }
      
      return allEvents;
    } catch (error) {
      console.error('❌ [EMAIL-TRACKING] Error getting user email tracking:', error);
      return [];
    }
  }

  async deleteEmailTrackingEvent(event) {
    try {
      console.log(`🗑️ [EMAIL-TRACKING] Attempting to delete event:`, {
        userId: event.userId,
        agentId: event.agentId,
        trackingId: event.trackingId,
        eventId: event.eventId,
        timestamp: event.timestamp
      });
      
      // V2 table uses compound key: PK (USER#...#AGENT#...) + SK (EVENT#timestamp#eventId)
      const pk = `USER#${event.userId}#AGENT#${event.agentId}`;
      const sk = `EVENT#${event.timestamp}#${event.eventId}`;
      
      const deleteCommand = new DeleteCommand({
        TableName: this.tables.emailTracking,
        Key: { 
          PK: pk,
          SK: sk
        }
      });
      
      await this.dynamodb.send(deleteCommand);
      console.log(`✅ [EMAIL-TRACKING] Successfully deleted event with PK: ${pk}, SK: ${sk}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [EMAIL-TRACKING] Error deleting tracking event:', error);
      throw error;
    }
  }

  // ====================
  // TABLE CREATION
  // ====================
  
  async createSearchHistoryTable() {
    try {
      console.log('🔧 [AWS] Creating search history table...');
      
      const command = new CreateTableCommand({
        TableName: this.tables.searchHistory,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },  // Partition key: USER#{userId}#AGENT#{agentId}
          { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key: SEARCH#{timestamp}
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
        Tags: [
          { Key: 'Project', Value: 'Meridian' },
          { Key: 'Purpose', Value: 'SearchHistory' }
        ]
      });
      
      const ddbClient = new DynamoDBClient({
        region: this.region,
        credentials: fromNodeProviderChain()
      });
      
      await ddbClient.send(command);
      
      console.log('✅ [AWS] Search history table created successfully');
      return { success: true, tableName: this.tables.searchHistory };
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log('ℹ️ [AWS] Search history table already exists');
        return { success: true, tableName: this.tables.searchHistory, alreadyExists: true };
      }
      console.error('❌ [AWS] Error creating search history table:', error);
      return { success: false, error: error.message };
    }
  }

  // Set AI control state for a specific conversation
  async setConversationAIControl(userId, agentId, conversationId, enabled) {
    try {
      const command = new PutCommand({
        TableName: this.tables.agentState,
        Item: {
          userId,
          agentId: `AI_CONTROL#${conversationId}`,
          aiEnabled: enabled,
          conversationId,
          timestamp: new Date().toISOString()
        }
      });

      await this.dynamodb.send(command);
      console.log(`✅ [AWS] AI control set for conversation ${conversationId}: ${enabled ? 'ENABLED' : 'PAUSED'}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [AWS] Error setting AI control:', error);
      throw error;
    }
  }

  // Get AI control state for a specific conversation
  async getConversationAIControl(userId, agentId, conversationId) {
    try {
      const command = new GetCommand({
        TableName: this.tables.agentState,
        Key: {
          userId,
          agentId: `AI_CONTROL#${conversationId}`
        }
      });

      const result = await this.dynamodb.send(command);
      if (result.Item) {
        return result.Item.aiEnabled !== false; // Default to enabled if not found
      }
      return true; // Default to enabled
    } catch (error) {
      // Silently default to enabled - schema mismatch is expected until feature is properly implemented
      return true;
    }
  }
}

export default AWSManager;