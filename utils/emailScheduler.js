/**
 * EMAIL SCHEDULER
 * 
 * Processes scheduled emails from the queue and sends them at specified times.
 * Checks queue every 5 minutes for emails ready to send.
 * 
 * IMPLEMENTATION STATUS: ACTIVE
 * 
 * Usage in app.js:
 *   import { startEmailScheduler } from './utils/emailScheduler.js';
 *   startEmailScheduler();
 */

import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';

class EmailScheduler {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
    this.awsManager = new AWSManager();
    this.awsEmailQueue = new AWSEmailQueue();
    
    // Check every 5 minutes
    this.CHECK_INTERVAL_MS = 5 * 60 * 1000;
  }
  
  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('⚠️ [EMAIL SCHEDULER] Already running');
      return;
    }
    
    console.log('📅 [EMAIL SCHEDULER] Starting email scheduler (checks every 5 minutes)');
    this.isRunning = true;
    
    // Check immediately on start
    this.checkAndSend();
    
    // Then check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkAndSend();
    }, this.CHECK_INTERVAL_MS);
  }
  
  // Stop the scheduler
  stop() {
    console.log('🛑 [EMAIL SCHEDULER] Stopping email scheduler');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  // Check for emails ready to send
  async checkAndSend() {
    try {
      console.log('📅 [EMAIL SCHEDULER] Checking for scheduled emails...');
      
      // Get all scheduled emails that are ready to send
      const scheduledEmails = await this.getScheduledEmailsReadyToSend();
      
      if (!scheduledEmails || scheduledEmails.length === 0) {
        console.log('📊 [EMAIL SCHEDULER] No emails ready to send');
        return;
      }
      
      console.log(`📊 [EMAIL SCHEDULER] Found ${scheduledEmails.length} email(s) ready to send`);
      
      for (const email of scheduledEmails) {
        await this.sendScheduledEmail(email);
      }
      
      console.log('✅ [EMAIL SCHEDULER] Check complete');
    } catch (error) {
      console.error('❌ [EMAIL SCHEDULER] Error during check:', error);
    }
  }
  
  // Get all scheduled emails that are ready to send
  async getScheduledEmailsReadyToSend() {
    try {
      const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
      const now = new Date().toISOString();
      
      // Scan for QUEUED emails with scheduledAt in the past/present
      // Use the GSI to make scanning more efficient
      const response = await this.awsEmailQueue.dynamodb.send(new ScanCommand({
        TableName: this.awsEmailQueue.tableName,
        IndexName: this.awsEmailQueue.gsiName,
        FilterExpression: 'contains(GSIPK, :queued) AND attribute_exists(scheduledAt) AND scheduledAt <= :now',
        ExpressionAttributeValues: {
          ':queued': '#QUEUED',
          ':now': now
        },
        // Limit to prevent too many results
        Limit: 100
      }));
      
      return response.Items || [];
    } catch (error) {
      console.error('[EMAIL SCHEDULER] Error fetching scheduled emails:', error);
      return [];
    }
  }
  
  // Send a scheduled email — direct in-process send (no HTTP self-call needed)
  async sendScheduledEmail(email) {
    const { id: emailId, userId, agentId, scheduledAt } = email;
    try {
      console.log(`📧 [EMAIL SCHEDULER] Processing email ${emailId} (scheduled for ${scheduledAt})`);

      const approvedEmail = await this.awsEmailQueue.approveEmail(userId, agentId, emailId);

      const emailData      = approvedEmail.emailData || {};
      const finalRecipient = emailData.finalRecipient || approvedEmail.finalRecipient || approvedEmail.to;
      const finalSubject   = emailData.finalSubject   || approvedEmail.finalSubject   || approvedEmail.subject;
      const finalBody      = emailData.finalBody      || approvedEmail.finalBody      || approvedEmail.body;

      if (!finalRecipient || !finalSubject || !finalBody) {
        console.warn(`[EMAIL SCHEDULER] ⚠️ Email ${emailId} missing required fields, skipping`);
        return;
      }

      const personInfo = approvedEmail.leadDetails?.personInfo || null;

      // Fetch CC / BCC / senderName from agent settings
      let ccEmails   = approvedEmail.cc   || approvedEmail.emailData?.cc   || null;
      let bccEmails  = approvedEmail.bcc  || approvedEmail.emailData?.bcc  || null;
      let senderName = null;
      try {
        const agentSettings = await this.awsManager.getLeadAgentSettings(userId, agentId);
        if (agentSettings) {
          if (!ccEmails  && agentSettings.emailBuilder?.ccEmails)  ccEmails  = agentSettings.emailBuilder.ccEmails;
          if (!bccEmails && agentSettings.emailBuilder?.bccEmails) bccEmails = agentSettings.emailBuilder.bccEmails;
          senderName = agentSettings.companyName || agentSettings.emailBuilder?.companyName || null;
        }
      } catch { /* non-fatal */ }

      const replyOptions = approvedEmail.replyOptions || null;

      const sendResult = await leadEmail(
        finalRecipient, finalSubject, finalBody,
        personInfo, userId, agentId,
        ccEmails, bccEmails, senderName, replyOptions
      );

      if (sendResult.success) {
        await this.awsEmailQueue.markEmailAsSent(userId, agentId, emailId, {
          id:         sendResult.result?.id,
          message:    sendResult.result?.message,
          trackingId: sendResult.result?.trackingId,
          fromAccount: sendResult.result?.fromAccount || sendResult.result?.sentFrom || null,
          method:     sendResult.method || 'scheduled',
          messageId:  sendResult.result?.messageId || null,
          threadId:   sendResult.result?.threadId  || null,
        });
        console.log(`✅ [EMAIL SCHEDULER] Sent ${emailId} → ${finalRecipient}`);
      } else {
        console.error(`❌ [EMAIL SCHEDULER] Send failed for ${emailId}:`, sendResult.error);
      }

    } catch (error) {
      console.error(`❌ [EMAIL SCHEDULER] Error sending email ${emailId}:`, error.message);
    }
  }
  
  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL_MS / 1000 / 60 + ' minutes'
    };
  }
}

// Singleton instance
let instance = null;

export function getEmailScheduler() {
  if (!instance) {
    instance = new EmailScheduler();
  }
  return instance;
}

export function startEmailScheduler() {
  const scheduler = getEmailScheduler();
  scheduler.start();
}

export function stopEmailScheduler() {
  const scheduler = getEmailScheduler();
  scheduler.stop();
}

export default EmailScheduler;
