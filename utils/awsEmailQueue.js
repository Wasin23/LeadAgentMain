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
    
    console.log(`📧 [AWS EMAIL QUEUE] Initialized with table: ${this.tableName}`);
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
        
        // Lead information (normalize leadInfo -> lead for backward compatibility)
        lead: emailData.lead || emailData.leadInfo || {},
        
        // Timestamps
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
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': 'QUEUED#'
        }
      }));

      return response.Items || [];
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting queued emails:', error);
      throw error;
    }
  }

  /**
   * Get all sent emails for a specific agent
   */
  async getSentEmails(userId, agentId) {
    try {
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': this._getPK(userId, agentId),
          ':status': 'SENT#'
        }
      }));

      return response.Items || [];
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
  }

  /**
   * Get ALL sent emails across ALL agents for a user (using GSI)
   */
  async getAllSentEmailsForUser(userId) {
    try {
      const response = await this.dynamodb.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gsiName,
        KeyConditionExpression: 'GSIPK = :gsipk',
        ExpressionAttributeValues: {
          ':gsipk': this._getGSIPK(userId, 'SENT')
        }
      }));

      return response.Items || [];
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error getting all sent emails for user:', error);
      throw error;
    }
  }

  /**
   * Get ALL replied emails across ALL agents for a user (using GSI)
   */
  async getAllRepliedEmailsForUser(userId) {
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
      mailgunMessage: mailgunData.message
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
      const emails = await this.getSentEmails(userId, agentId);
      
      if (emails.length === 0) {
        return { clearedCount: 0 };
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
      return { clearedCount: emails.length };
    } catch (error) {
      console.error('[AWS EMAIL QUEUE] Error clearing sent emails:', error);
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
