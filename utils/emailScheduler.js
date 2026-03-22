/**
 * EMAIL SCHEDULER
 * 
 * Processes scheduled emails from the queue and sends them at specified times.
 * Checks queue every minute for emails ready to send.
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
import { sendSystemEmail } from '../tools/emailMailgun.js';
import { sendSMS } from './smsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

class EmailScheduler {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
    this.processingEmails = new Set();
    this.awsManager = new AWSManager();
    this.awsEmailQueue = new AWSEmailQueue();
    
    // Check every minute so scheduled sends are not delayed.
    this.CHECK_INTERVAL_MS = 60 * 1000;
  }
  
  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('⚠️ [EMAIL SCHEDULER] Already running');
      return;
    }
    
    console.log('📅 [EMAIL SCHEDULER] Starting email scheduler (checks every minute)');
    this.isRunning = true;
    
    // Check immediately on start
    this.checkAndSend();
    
    // Then check every minute
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
    const now = new Date().toISOString();
    console.log(`📅 [EMAIL SCHEDULER] checkAndSend() tick — now=${now}`);
    try {
      const scheduledEmails = await this.getScheduledEmailsReadyToSend();
      
      if (!scheduledEmails || scheduledEmails.length === 0) {
        console.log('📊 [EMAIL SCHEDULER] No emails ready to send');
        return;
      }
      
      console.log(`📊 [EMAIL SCHEDULER] Found ${scheduledEmails.length} email(s) ready to send:`);
      for (const e of scheduledEmails) {
        console.log(`   → id=${e.id} scheduledAt=${e.scheduledAt} to=${e.to || e.emailData?.finalRecipient} status-in-SK=${e.SK?.split('#')[0]}`);
      }

      for (const email of scheduledEmails) {
        await this.sendScheduledEmail(email);
      }
      
      console.log('✅ [EMAIL SCHEDULER] Check complete');
    } catch (error) {
      console.error('❌ [EMAIL SCHEDULER] Error during check:', error);
    }
  }

  async getQueuedEmailsForUser(userId) {
    const items = [];
    let lastEvaluatedKey = null;

    do {
      const response = await this.awsEmailQueue.dynamodb.send(new QueryCommand({
        TableName: this.awsEmailQueue.tableName,
        IndexName: this.awsEmailQueue.gsiName,
        KeyConditionExpression: 'GSIPK = :gsipk',
        ExpressionAttributeValues: {
          ':gsipk': `${userId}#QUEUED`
        },
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: true,
      }));

      items.push(...(response.Items || []));
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }
  
  // Get all scheduled emails that are ready to send
  async getScheduledEmailsReadyToSend() {
    try {
      const now = new Date().toISOString();
      const users = await this.awsManager.getAllUsers();
      const scheduledEmails = [];

      for (const user of users) {
        const userId = user.userId || user.id;
        if (!userId) continue;

        const queuedEmails = await this.getQueuedEmailsForUser(userId);
        const dueEmails = queuedEmails.filter(email =>
          email.scheduledAt &&
          email.scheduledAt <= now &&
          email.status === 'QUEUED'
        );

        if (dueEmails.length > 0) {
          console.log(`📊 [EMAIL SCHEDULER] userId=${userId} has ${dueEmails.length} due scheduled email(s)`);
          scheduledEmails.push(...dueEmails);
        }
      }

      scheduledEmails.sort((left, right) => {
        return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
      });

      console.log(`📊 [EMAIL SCHEDULER] Query found ${scheduledEmails.length} item(s) with scheduledAt <= ${now}`);
      return scheduledEmails;
    } catch (error) {
      console.error('[EMAIL SCHEDULER] Error fetching scheduled emails:', error);
      return [];
    }
  }
  
  // Send a scheduled email — direct in-process send (no HTTP self-call needed)
  async sendScheduledEmail(email) {
    const { id: emailId, userId, agentId, scheduledAt } = email;
    if (this.processingEmails.has(emailId)) {
      console.log(`⚠️ [EMAIL SCHEDULER] Skipping duplicate in-flight send for ${emailId}`);
      return;
    }

    this.processingEmails.add(emailId);
    console.log(`📧 [EMAIL SCHEDULER] sendScheduledEmail start — id=${emailId} userId=${userId} agentId=${agentId} scheduledAt=${scheduledAt}`);
    try {
      const approvedEmail = await this.awsEmailQueue.approveEmail(userId, agentId, emailId);
      console.log(`📧 [EMAIL SCHEDULER] approveEmail OK — keys=${Object.keys(approvedEmail).join(',')}`);

      const emailData      = approvedEmail.emailData || {};
      const finalRecipient = emailData.finalRecipient || approvedEmail.finalRecipient || approvedEmail.to;
      const finalSubject   = emailData.finalSubject   || approvedEmail.finalSubject   || approvedEmail.subject;
      const finalBody      = emailData.finalBody      || approvedEmail.finalBody      || approvedEmail.body;

      console.log(`📧 [EMAIL SCHEDULER] fields — to=${finalRecipient} hasSubject=${!!finalSubject} hasBody=${!!finalBody}`);

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

      console.log(`📧 [EMAIL SCHEDULER] Calling leadEmail() for ${emailId}...`);
      const sendResult = await leadEmail(
        finalRecipient, finalSubject, finalBody,
        personInfo, userId, agentId,
        ccEmails, bccEmails, senderName, replyOptions
      );

      console.log(`📧 [EMAIL SCHEDULER] leadEmail result — success=${sendResult.success} method=${sendResult.method} error=${sendResult.error || 'none'}`);

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

        // Fire notification (non-fatal)
        try {
          const agentSettings = await this.awsManager.getLeadAgentSettings(userId, agentId).catch(() => null);
          const agentName = agentSettings?.name || agentId;
          const userSettings = await this.awsManager.getUserSettings(userId).catch(() => null);
          const toEmail = userSettings?.email;
          const notifPrefs = userSettings?.preferences?.notifPrefs || {};

          // In-app notification
          await this.awsManager.addIssue(
            userId, 'scheduled_send',
            `📅 ${agentName}: 1 email sent (scheduled)`,
            `Agent "${agentName}" sent a manually-scheduled email to ${finalRecipient}.`,
            { severity: 'low', agentId, agentName, emailCount: 1 }
          );

          // Email notification (unless explicitly disabled)
          if (notifPrefs.emailNotifications !== false && toEmail) {
            await sendSystemEmail(
              toEmail,
              `📅 ${agentName}: scheduled email sent`,
              `<p>Your agent <strong>${agentName}</strong> just sent a scheduled email to <strong>${finalRecipient}</strong>.</p><p>Subject: ${finalSubject}</p>`
            );
          }

          // SMS notification (opt-in: only fires when phone + smsEnabled set)
          if (notifPrefs.smsEnabled && notifPrefs.phone) {
            const appUrl = process.env.FRONTEND_URL || 'https://app.meridianai.co';
            await sendSMS(
              notifPrefs.phone,
              `Meridian: "${agentName}" sent a scheduled email to ${finalRecipient}. ${appUrl}/email-queue`
            );
          }
        } catch (notifErr) {
          console.warn(`[EMAIL SCHEDULER] ⚠️ Notification failed (non-fatal):`, notifErr.message);
        }
      } else {
        console.error(`❌ [EMAIL SCHEDULER] Send failed for ${emailId}:`, sendResult.error);
      }

    } catch (error) {
      console.error(`❌ [EMAIL SCHEDULER] Error sending email ${emailId}:`, error.message);
      console.error(`❌ [EMAIL SCHEDULER] Stack:`, error.stack);
    } finally {
      this.processingEmails.delete(emailId);
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
