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
  
  // Send a scheduled email
  async sendScheduledEmail(email) {
    try {
      const { id: emailId, userId, agentId, scheduledAt } = email;
      
      console.log(`📧 [EMAIL SCHEDULER] Processing email ${emailId} (scheduled for ${scheduledAt})`);
      
      // Use the email queue API endpoint to approve/send the email
      const axios = (await import('axios')).default;
      const apiUrl = process.env.API_URL || 'http://localhost:3030';
      
      // Get user's JWT token (this is server-side, so we need to handle auth differently)
      // For now, we'll directly call the approve endpoint
      const response = await axios.post(
        `${apiUrl}/api/email-queue/${emailId}/approve`,
        { agentId, isScheduled: true },
        {
          headers: {
            'Content-Type': 'application/json',
            // Server-side auth bypass for scheduled sends
            'X-Scheduled-Send': 'true',
            'X-User-Id': userId
          },
          params: { agentId }
        }
      ).catch(err => {
        // If API call fails, try direct send
        return this.sendEmailDirect(email);
      });
      
      if (response && response.data) {
        console.log(`✅ [EMAIL SCHEDULER] Email ${emailId} sent successfully`);
        
        // Log notification
        await this.awsManager.addIssue(
          userId,
          'info',
          'Scheduled Email Sent',
          `Scheduled email to ${email.to || email.emailData?.finalRecipient} was sent successfully.`,
          {
            emailId,
            agentId,
            to: email.to || email.emailData?.finalRecipient,
            subject: email.subject || email.emailData?.finalSubject,
            scheduledTime: scheduledAt,
            sentTime: new Date().toISOString()
          }
        );
      }
      
    } catch (error) {
      console.error(`❌ [EMAIL SCHEDULER] Error sending email ${email.id}:`, error);
      
      // Log error notification
      try {
        await this.awsManager.addIssue(
          email.userId,
          'error',
          'Scheduled Email Failed',
          `Failed to send scheduled email: ${error.message}`,
          {
            emailId: email.id,
            agentId: email.agentId,
            to: email.to || email.emailData?.finalRecipient,
            subject: email.subject || email.emailData?.finalSubject,
            scheduledTime: email.scheduledAt,
            error: error.message
          }
        );
      } catch (issueError) {
        console.error('[EMAIL SCHEDULER] Failed to log issue:', issueError);
      }
    }
  }
  
  // Direct send method (fallback if API unavailable)
  async sendEmailDirect(email) {
    try {
      const { EmailQueue } = await import('../lib/emailQueue.js');
      const emailQueue = new EmailQueue(email.userId, email.agentId);
      
      // Approve and send the email
      await this.awsEmailQueue.approveEmail(email.userId, email.agentId, email.id);
      const result = await emailQueue.sendEmail(email.id);
      
      return { data: result };
    } catch (error) {
      console.error('[EMAIL SCHEDULER] Direct send failed:', error);
      throw error;
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
