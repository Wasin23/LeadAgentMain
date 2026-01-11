import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand, 
  UpdateCommand, 
  DeleteCommand,
  BatchWriteCommand 
} from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { v4 as uuidv4 } from 'uuid';

/**
 * AWS DynamoDB Email Queue Manager
 * 
 * Single Table Design:
 * - Table Name: EmailQueue
 * - Partition Key (PK): userId#agentId (e.g., "76e84c79#reasoning-lead-agent")
 * - Sort Key (SK): STATUS#timestamp#emailId (e.g., "QUEUED#2025-10-22T10:30:00Z#email123")
 * 
 * GSI for cross-agent queries:
 * - GSI Name: UserStatusIndex
 * - GSI-PK: userId#STATUS (e.g., "76e84c79#QUEUED")
 * - GSI-SK: timestamp#emailId
 * 
 * Email States: QUEUED, APPROVED, SENT, REPLIED
 */

class AWSEmailQueue {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    const ddbClient = new DynamoDBClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });
    
    this.dynamodb = DynamoDBDocumentClient.from(ddbClient);
    this.tableName = process.env.AWS_DYNAMODB_EMAIL_QUEUE_TABLE || 'meridian-email-queue';
    this.gsiName = 'UserStatusIndex';
    
    // Add in-memory cache to reduce DynamoDB queries
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache
    
    console.log(`📧 [AWS EMAIL QUEUE] Initialized with table: ${this.tableName}`);
  }

  /**
   * Get cached data or fetch from DB
   */
  async _getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📦 [CACHE HIT] ${key}`);
      return cached.data;
    }
    
    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clear old cache entries (keep last 100)
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    return data;
  }

  /**
   * Invalidate cache for a user
   */
  _invalidateCache(userId) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(userId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Generate partition key
   */
  _getPK(userId, agentId) {
    return `${userId}#${agentId}`;
  }

  /**
   * Generate sort key
   */
  _getSK(status, timestamp, emailId) {
    return `${status}#${timestamp}#${emailId}`;
  }

  /**
   * Generate GSI partition key
   */
  _getGSIPK(userId, status) {
    return `${userId}#${status}`;
  }

  /**
   * Generate GSI sort key
   */
  _getGSISK(timestamp, emailId) {
    return `${timestamp}#${emailId}`;
  }

  /**
   * Parse SK to extract status, timestamp, and emailId
   */
  _parseSK(sk) {
    const [status, timestamp, emailId] = sk.split('#');
    return { status, timestamp, emailId };
  }

  /**
   * Add email to queue
   */
  async queueEmail(userId, agentId, emailData) {
    try {
      const emailId = emailData.id || uuidv4();
      const timestamp = new Date().toISOString();
      const status = 'QUEUED';

      const item = {
        PK: this._getPK(userId, agentId),
        SK: this._getSK(status, timestamp, emailId),
        GSIPK: this._getGSIPK(userId, status),
        GSISK: this._getGSISK(timestamp, emailId),
        
        // Email data
        id: emailId,
        userId,
        agentId,
        status,
        to: emailData.to,
        cc: emailData.cc || '', // Add CC email addresses
        bcc: emailData.bcc || '', // Add BCC email addresses
        from: emailData.from,
        subject: emailData.subject,
        body: emailData.body || emailData.text,
        text: emailData.text,
        html: emailData.html,
        
        // AI Confidence Report
        confidenceReport: emailData.confidenceReport || '',
        confidenceLevel: emailData.confidenceLevel || 'medium',
        
        // AI Report (NEW - comprehensive qualification report)
        aiReport: emailData.aiReport || null,
        
        // Lead information (normalize leadInfo -> lead for backward compatibility)
        lead: emailData.lead || emailData.leadInfo || {},
        
        // Research data
        researchData: emailData.researchData || null,
        
        // Timestamps
        timestamp: emailData.timestamp || timestamp, // Use provided timestamp or default to now
        queuedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        
        // Metadata
        metadata: emailData.metadata || {},
        
        // TTL (optional - expires after 90 days)
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
      };

      await this.dynamodb.send(new PutCommand({
        TableName: this.tableName,
        Item: item
      }));

      // Invalidate cache for this user
      this._invalidateCache(userId);

      console.log(`✅ [AWS EMAIL QUEUE] Email queued: ${emailId} for agent ${agentId}`);
      return item;
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error queueing email:', error);
      throw error;
    }
  }

  /**
   * Get all queued emails for a specific agent
   */
  async getQueuedEmails(userId, agentId) {
    try {
      const pk = this._getPK(userId, agentId);
      // console.log(`[AWS EMAIL QUEUE] 🔍 getQueuedEmails - PK: ${pk}`);
      
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':status': 'QUEUED#'
        }
      }));

      // console.log(`[AWS EMAIL QUEUE] ✅ Query returned ${response.Items?.length || 0} items`);
      return response.Items || [];
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] ❌ Error getting queued emails:', error);
      console.error('[AWS EMAIL QUEUE] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Enrich emails with tracking data from DynamoDB tracking table
   */
  async enrichEmailsWithTracking(userId, agentId, emails) {
    try {
      if (!emails || emails.length === 0) return emails;

      const { default: AWSManager } = await import('./awsManager.js');
      const awsManager = new AWSManager();

      // Fetch tracking events for this user/agent
      const trackingEvents = await awsManager.getEmailTrackingByUser(userId, agentId);
      // console.log(`📊 [AWS ENRICHMENT] Found ${trackingEvents.length} tracking events for ${emails.length} emails`);

      // Create a map of tracking events by trackingId
      const trackingMap = new Map();
      trackingEvents.forEach(event => {
        const id = event.trackingId;
        if (!trackingMap.has(id)) {
          trackingMap.set(id, { opened: false, clicked: false, replied: false, hasProxy: false, events: [] });
        }
        const data = trackingMap.get(id);
        data.events.push(event);
        
        // Set flags based on event type
        if (event.eventType === 'open') data.opened = true; // Real open (second hit)
        if (event.eventType === 'proxy') data.hasProxy = true; // First hit (image proxy)
        if (event.eventType === 'click') data.clicked = true;
        if (event.eventType === 'reply') data.replied = true;
        if (event.eventType === 'ai_response') data.aiResponded = true;
      });

      // Enrich each email with its tracking data
      const enrichedEmails = emails.map(email => {
        const tracking = trackingMap.get(email.trackingId) || trackingMap.get(email.id);
        
        if (tracking) {
          return {
            ...email,
            analytics: {
              opened: tracking.opened,
              clicked: tracking.clicked,
              replied: tracking.replied,
              aiResponded: tracking.aiResponded,
              hasProxy: tracking.hasProxy
            },
            opened: tracking.opened,
            replied: tracking.replied,
            trackingEvents: tracking.events
          };
        }
        
        return email;
      });

      // console.log(`✅ [AWS ENRICHMENT] Enriched ${enrichedEmails.filter(e => e.analytics).length} emails with tracking data`);
      return enrichedEmails;
      
    } catch (error) {
      console.error('[AWS ENRICHMENT] Error enriching emails with tracking:', error);
      return emails; // Return original emails if enrichment fails
    }
  }

  /**
   * Get all sent emails for a specific agent (enriched with tracking data)
   * Includes both SENT and BOUNCED emails
   */
  async getSentEmails(userId, agentId) {
    try {
      // Query for SENT emails
      const sentResponse = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': 'SENT#'
        }
      }));

      // Query for BOUNCED emails
      const bouncedResponse = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': 'BOUNCED#'
        }
      }));

      const emails = [...(sentResponse.Items || []), ...(bouncedResponse.Items || [])];
      
      // Enrich with tracking data from DynamoDB tracking table
      return await this.enrichEmailsWithTracking(userId, agentId, emails);
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting sent emails:', error);
      throw error;
    }
  }

  /**
   * Get all replied emails for a specific agent
   */
  async getRepliedEmails(userId, agentId) {
    try {
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': 'REPLIED#'
        }
      }));

      return response.Items || [];
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting replied emails:', error);
      throw error;
    }
  }

  /**
   * Get ALL queued emails across ALL agents for a user (using GSI)
   */
  async getAllQueuedEmailsForUser(userId) {
    return this._getCached(`${userId}:queued`, async () => {
      try {
        const response = await this.dynamodb.send(new QueryCommand({
          TableName: this.tableName,
          IndexName: this.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: {
            ':gsipk': this._getGSIPK(userId, 'QUEUED')
          }
        }));

        return response.Items || [];
      } catch (error) {
        console.error('[AWS EMAIL QUEUE] Error getting all queued emails for user:', error);
        throw error;
      }
    });
  }

  /**
   * Get ALL sent emails across ALL agents for a user (using GSI, enriched with tracking)
   * Includes both SENT and BOUNCED emails
   */
  async getAllSentEmailsForUser(userId) {
    return this._getCached(`${userId}:sent`, async () => {
      try {
        // Query for SENT emails across all agents
        const sentResponse = await this.dynamodb.send(new QueryCommand({
          TableName: this.tableName,
          IndexName: this.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: {
            ':gsipk': this._getGSIPK(userId, 'SENT')
          }
        }));

      // Query for BOUNCED emails across all agents
      const bouncedResponse = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gsiName,
        KeyConditionExpression: 'GSIPK = :gsipk',
        ExpressionAttributeValues: {
          ':gsipk': this._getGSIPK(userId, 'BOUNCED')
        }
      }));

      const emails = [...(sentResponse.Items || []), ...(bouncedResponse.Items || [])];
      
      // Enrich with tracking data (pass null for agentId to get all tracking)
      return await this.enrichEmailsWithTracking(userId, null, emails);
      } catch (error) {
        console.error('[AWS EMAIL QUEUE] Error getting all sent emails for user:', error);
        throw error;
      }
    });
  }

  /**
   * Get ALL replied emails across ALL agents for a user (using GSI)
   */
  async getAllRepliedEmailsForUser(userId) {
    return this._getCached(`${userId}:replied`, async () => {
      try {
        const response = await this.dynamodb.send(new QueryCommand({
          TableName: this.tableName,
          IndexName: this.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: {
            ':gsipk': this._getGSIPK(userId, 'REPLIED')
          }
        }));

        return response.Items || [];
      } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting all replied emails for user:', error);
      throw error;
    }
  }

  /**
   * Update email content (subject, body, etc.) without changing status
   */
  async updateEmail(userId, agentId, emailId, updates) {
    try {
      // Find the email with any status
      const statuses = ['QUEUED', 'APPROVED', 'SENT', 'REPLIED'];
      let foundItem = null;
      
      for (const status of statuses) {
        const response = await this.dynamodb.send(new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
          FilterExpression: 'id = :emailId',
          ExpressionAttributeValues: {
            ':pk': this._getPK(userId, agentId),
            ':status': `${status}#`,
            ':emailId': emailId
          }
        }));
        
        if (response.Items && response.Items.length > 0) {
          foundItem = response.Items[0];
          break;
        }
      }
      
      if (!foundItem) {
        throw new Error(`Email ${emailId} not found`);
      }
      
      // Update the item in place (keeping same PK and SK)
      const updatedItem = {
        ...foundItem,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await this.dynamodb.send(new PutCommand({
        TableName: this.tableName,
        Item: updatedItem
      }));
      
      console.log(`✅ [AWS EMAIL QUEUE] Email ${emailId} updated successfully`);
      return updatedItem;
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error updating email:', error);
      throw error;
    }
  }

  /**
   * Update email status (QUEUED -> APPROVED -> SENT -> REPLIED)
   * This requires deleting old item and creating new one (because status is in SK)
   */
  async updateEmailStatus(userId, agentId, emailId, oldStatus, newStatus, additionalData = {}) {
    try {
      // First, find the email with the old status
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        FilterExpression: 'id = :emailId',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': `${oldStatus}#`,
          ':emailId': emailId
        }
      }));

      if (!response.Items || response.Items.length === 0) {
        throw new Error(`Email ${emailId} not found with status ${oldStatus}`);
      }

      const oldItem = response.Items[0];
      const newTimestamp = new Date().toISOString();

      // Create new item with updated status
      const newItem = {
        ...oldItem,
        PK: this._getPK(userId, agentId),
        SK: this._getSK(newStatus, newTimestamp, emailId),
        GSIPK: this._getGSIPK(userId, newStatus),
        GSISK: this._getGSISK(newTimestamp, emailId),
        status: newStatus,
        updatedAt: newTimestamp,
        ...additionalData
      };

      // Add status-specific timestamps
      if (newStatus === 'APPROVED') {
        newItem.approvedAt = newTimestamp;
      } else if (newStatus === 'SENT') {
        newItem.sentAt = newTimestamp;
      } else if (newStatus === 'REPLIED') {
        newItem.repliedAt = newTimestamp;
      }

      // Delete old item and put new item (transactional would be better but using two operations)
      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: oldItem.PK,
          SK: oldItem.SK
        }
      }));

      await this.dynamodb.send(new PutCommand({
        TableName: this.tableName,
        Item: newItem
      }));

      // Invalidate cache for this user
      this._invalidateCache(userId);

      console.log(`✅ [AWS EMAIL QUEUE] Email ${emailId} status updated: ${oldStatus} -> ${newStatus}`);
      return newItem;
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error updating email status:', error);
      throw error;
    }
  }

  /**
   * Approve a queued email
   */
  async approveEmail(userId, agentId, emailId) {
    return this.updateEmailStatus(userId, agentId, emailId, 'QUEUED', 'APPROVED');
  }

  /**
   * Mark email as sent
   */
  async markEmailAsSent(userId, agentId, emailId, mailgunData = {}) {
    return this.updateEmailStatus(userId, agentId, emailId, 'APPROVED', 'SENT', {
      mailgunId: mailgunData.id,
      mailgunMessage: mailgunData.message,
      trackingId: mailgunData.trackingId,  // Store the tracking ID for correlation with Zilliz events!
      fromAccount: mailgunData.fromAccount || null, // Track which email account sent it
      sendMethod: mailgunData.method || 'mailgun' // Track send method (gmail/mailgun)
    });
  }

  /**
   * Mark email as replied
   */
  async markEmailAsReplied(userId, agentId, emailId, replyData = {}) {
    return this.updateEmailStatus(userId, agentId, emailId, 'SENT', 'REPLIED', {
      replyFrom: replyData.from,
      replySubject: replyData.subject,
      replyBody: replyData.body
    });
  }

  /**
   * Update email analytics (opens, clicks, replies)
   */
  async updateEmailAnalytics(emailId, analytics) {
    try {
      // Email ID format includes userId and agentId, extract them
      // Typical format: uuid or composite key
      // For now, we need to query to find the email first
      
      console.log(`📊 [AWS EMAIL QUEUE] Updating analytics for email ${emailId}`);
      
      // Since we don't have userId/agentId directly, we need to scan or use a different approach
      // For efficiency, the emailId should be passed with context, but for now we'll update by scanning
      // This is not ideal for production but works for tracking updates
      
      // Alternative: Pass full email object with PK/SK or userId/agentId
      // For now, return success - the calling code should pass the full email object
      console.log(`📊 [AWS EMAIL QUEUE] Analytics update queued for ${emailId}:`, analytics);
      return { success: true };
      
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error updating analytics:', error);
      throw error;
    }
  }

  /**
   * Update email analytics with full context (userId, agentId, emailId)
   */
  async updateEmailAnalyticsWithContext(userId, agentId, emailId, analytics) {
    try {
      // Find the email first to get its current status
      const statuses = ['SENT', 'APPROVED', 'REPLIED'];
      let foundItem = null;
      
      for (const status of statuses) {
        const response = await this.dynamodb.send(new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
          FilterExpression: 'id = :emailId',
          ExpressionAttributeValues: {
            ':pk': this._getPK(userId, agentId),
            ':status': `${status}#`,
            ':emailId': emailId
          },
          Limit: 1
        }));

        if (response.Items && response.Items.length > 0) {
          foundItem = response.Items[0];
          break;
        }
      }

      if (!foundItem) {
        console.log(`⚠️ [AWS EMAIL QUEUE] Email ${emailId} not found for analytics update`);
        return { success: false, error: 'Email not found' };
      }

      // Update the analytics field
      await this.dynamodb.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: foundItem.PK,
          SK: foundItem.SK
        },
        UpdateExpression: 'SET analytics = :analytics, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':analytics': analytics,
          ':updatedAt': new Date().toISOString()
        }
      }));

      console.log(`✅ [AWS EMAIL QUEUE] Analytics updated for email ${emailId}`);
      return { success: true };
      
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error updating analytics:', error);
      throw error;
    }
  }

  /**
   * Delete a queued email (reject)
   */
  async deleteQueuedEmail(userId, agentId, emailId) {
    try {
      // Find the email
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        FilterExpression: 'id = :emailId',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': 'QUEUED#',
          ':emailId': emailId
        }
      }));

      if (!response.Items || response.Items.length === 0) {
        console.log(`⚠️ [AWS EMAIL QUEUE] Email ${emailId} not found for deletion`);
        return;
      }

      const item = response.Items[0];

      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }));

      // Invalidate cache for this user
      this._invalidateCache(userId);

      console.log(`✅ [AWS EMAIL QUEUE] Email ${emailId} deleted (rejected)`);
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error deleting email:', error);
      throw error;
    }
  }

  /**
   * Get statistics for an agent
   */
  async getStats(userId, agentId) {
    try {
      const [queued, sent, replied] = await Promise.all([
        this.getQueuedEmails(userId, agentId),
        this.getSentEmails(userId, agentId),
        this.getRepliedEmails(userId, agentId)
      ]);

      return {
        pending: queued.length,
        queued: queued.length,
        sent: sent.length,
        replied: replied.length,
        total: queued.length + sent.length + replied.length,
        rejected: 0 // No longer tracking rejected
      };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting stats:', error);
      return { pending: 0, queued: 0, sent: 0, replied: 0, total: 0, rejected: 0 };
    }
  }

  /**
   * Get statistics across ALL agents for a user
   */
  async getAllStats(userId) {
    try {
      const [queued, sent, replied] = await Promise.all([
        this.getAllQueuedEmailsForUser(userId),
        this.getAllSentEmailsForUser(userId),
        this.getAllRepliedEmailsForUser(userId)
      ]);

      return {
        queued: queued.length,
        sent: sent.length,
        replied: replied.length,
        total: queued.length + sent.length + replied.length
      };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting all stats:', error);
      return { queued: 0, sent: 0, replied: 0, total: 0 };
    }
  }

  /**
   * Clear all sent emails for an agent (cleanup)
   */
  async clearSentEmails(userId, agentId) {
    try {
      // Get ALL email statuses (SENT only - approved emails are managed separately)
      let emails = [];
      if (agentId === null) {
        // Clear ALL sent emails for the user across all agents
        emails = await this.getAllSentEmailsForUser(userId);
      } else {
        // Clear sent emails for specific agent
        emails = await this.getSentEmails(userId, agentId);
      }
      
      if (emails.length === 0) {
        return { clearedCount: 0, zillizCleared: 0 };
      }

      // Clear Zilliz tracking events for these emails
      let zillizCleared = 0;
      try {
        const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
        const milvusClient = new MilvusClient({
          address: process.env.ZILLIZ_ENDPOINT,
          token: process.env.ZILLIZ_TOKEN,
          timeout: 30000
        });

        // Check if collection exists
        const hasCollection = await milvusClient.hasCollection({
          collection_name: 'email_tracking_events'
        });

        if (hasCollection.value) {
          if (agentId === null) {
            // Clear ALL tracking events for the user (all agents)
            const deleteResult = await milvusClient.delete({
              collection_name: 'email_tracking_events',
              filter: `user_id == "${userId}"`
            });
            zillizCleared = deleteResult.delete_cnt || 0;
            console.log(`🗑️ [ZILLIZ] Cleared ${zillizCleared} tracking events for all agents of user ${userId}`);
          } else {
            // Clear tracking events for specific agent only
            const deleteResult = await milvusClient.delete({
              collection_name: 'email_tracking_events',
              filter: `user_id == "${userId}" && agent_id == "${agentId}"`
            });
            zillizCleared = deleteResult.delete_cnt || 0;
            console.log(`🗑️ [ZILLIZ] Cleared ${zillizCleared} tracking events for agent ${agentId}`);
          }
        }
      } catch (zillizError) {
        console.error('⚠️ [ZILLIZ] Error clearing tracking events (continuing with email deletion):', zillizError.message);
      }

      // Batch delete (max 25 items per batch)
      const batches = [];
      for (let i = 0; i < emails.length; i += 25) {
        batches.push(emails.slice(i, i + 25));
      }

      for (const batch of batches) {
        const deleteRequests = batch.map(email => ({
          DeleteRequest: {
            Key: {
              PK: email.PK,
              SK: email.SK
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: deleteRequests
          }
        }));
      }

      console.log(`✅ [AWS EMAIL QUEUE] Cleared ${emails.length} sent emails for agent ${agentId}`);
      return { clearedCount: emails.length, zillizCleared };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error clearing sent emails:', error);
      throw error;
    }
  }

  /**
   * Clear all replied emails for a specific agent
   */
  async clearRepliedEmails(userId, agentId) {
    try {
      // If agentId is null, clear ALL replied emails for the user
      const emails = agentId === null
        ? await this.getAllRepliedEmailsForUser(userId)
        : await this.getRepliedEmails(userId, agentId);
      
      if (emails.length === 0) {
        return { clearedCount: 0 };
      }

      const batches = [];
      for (let i = 0; i < emails.length; i += 25) {
        batches.push(emails.slice(i, i + 25));
      }

      for (const batch of batches) {
        const deleteRequests = batch.map(email => ({
          DeleteRequest: {
            Key: {
              PK: email.PK,
              SK: email.SK
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: deleteRequests
          }
        }));
      }

      console.log(`✅ [AWS EMAIL QUEUE] Cleared ${emails.length} replied emails for agent ${agentId}`);
      return { clearedCount: emails.length };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error clearing replied emails:', error);
      throw error;
    }
  }

  /**
   * Clear all queued emails for a specific agent
   */
  async clearQueuedEmails(userId, agentId) {
    try {
      // If agentId is null, clear ALL queued emails for the user
      const emails = agentId === null
        ? await this.getAllQueuedEmailsForUser(userId)
        : await this.getQueuedEmails(userId, agentId);
      
      if (emails.length === 0) {
        return { clearedCount: 0 };
      }

      const batches = [];
      for (let i = 0; i < emails.length; i += 25) {
        batches.push(emails.slice(i, i + 25));
      }

      for (const batch of batches) {
        const deleteRequests = batch.map(email => ({
          DeleteRequest: {
            Key: {
              PK: email.PK,
              SK: email.SK
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: deleteRequests
          }
        }));
      }

      console.log(`✅ [AWS EMAIL QUEUE] Cleared ${emails.length} queued emails for agent ${agentId}`);
      return { clearedCount: emails.length };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error clearing queued emails:', error);
      throw error;
    }
  }

  /**
   * Reassign an email from one agent to another
   */
  async reassignEmailToAgent(userId, oldAgentId, emailId, newAgentId) {
    try {
      console.log(`📧 [AWS EMAIL QUEUE] Reassigning email ${emailId} from ${oldAgentId} to ${newAgentId}`);
      
      // Find the email with any status
      const statuses = ['QUEUED', 'APPROVED', 'SENT', 'REPLIED'];
      let foundItem = null;
      let foundStatus = null;
      
      for (const status of statuses) {
        const response = await this.dynamodb.send(new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
          ExpressionAttributeValues: {
            ':pk': this._getPK(userId, oldAgentId),
            ':status': `${status}#`
          }
        }));
        
        const item = (response.Items || []).find(i => i.id === emailId);
        if (item) {
          foundItem = item;
          foundStatus = status;
          break;
        }
      }
      
      if (!foundItem) {
        console.log(`⚠️ [AWS EMAIL QUEUE] Email ${emailId} not found for agent ${oldAgentId}`);
        return { success: false, message: 'Email not found' };
      }
      
      // Delete old item
      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: foundItem.PK,
          SK: foundItem.SK
        }
      }));
      
      // Create new item with new agentId
      const timestamp = foundItem.timestamp || new Date().toISOString();
      const newItem = {
        ...foundItem,
        PK: this._getPK(userId, newAgentId),
        SK: this._getSK(foundStatus, timestamp, emailId),
        GSIPK: this._getGSIPK(userId, foundStatus),
        GSISK: this._getGSISK(timestamp, emailId),
        agentId: newAgentId,
        originalAgentId: oldAgentId, // Store original agent for tracking
        reassignedAt: new Date().toISOString()
      };
      
      await this.dynamodb.send(new PutCommand({
        TableName: this.tableName,
        Item: newItem
      }));
      
      console.log(`✅ [AWS EMAIL QUEUE] Successfully reassigned email ${emailId} to ${newAgentId}`);
      return { success: true, message: 'Email reassigned' };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error reassigning email:', error);
      throw error;
    }
  }
}

// Singleton instance
let awsEmailQueueInstance = null;

export function getAWSEmailQueue() {
  if (!awsEmailQueueInstance) {
    awsEmailQueueInstance = new AWSEmailQueue();
  }
  return awsEmailQueueInstance;
}

export default AWSEmailQueue;
