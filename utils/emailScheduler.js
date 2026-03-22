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
import { getScheduledEmailJobs } from './scheduledEmailJobs.js';
import { leadEmail } from '../tools/leadEmail.js';
import { sendSystemEmail } from '../tools/emailMailgun.js';
import { sendSMS } from './smsManager.js';

function buildScheduledSendEmailHTML({ agentName, recipient, subject, scheduledAt, appUrl }) {
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
  const recipientName = recipient.name || '';
  const recipientCompany = recipient.company || '';
  const recipientEmail = recipient.to || '';
  const whenSent = scheduledDate.toLocaleString();

  const recipientSection = `
  <tr><td style="padding:0 40px 28px;">
    <p style="margin:0 0 10px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Recipient</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:10px;border-collapse:collapse;overflow:hidden;">
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #27272a;">
          <span style="color:#e4e4e7;font-size:13px;font-weight:500;">${recipientName}</span>
          ${recipientCompany ? `<span style="color:#71717a;font-size:12px;"> &middot; ${recipientCompany}</span>` : ''}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #27272a;text-align:right;">
          <span style="color:#71717a;font-size:12px;">${recipientEmail}</span>
        </td>
      </tr>
    </table>
  </td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">

  <tr><td style="background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);height:3px;font-size:0;">&nbsp;</td></tr>

  <tr><td style="padding:32px 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><table cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center;vertical-align:middle;line-height:36px;">
          <span style="color:#fff;font-weight:800;font-size:18px;">M</span>
        </td>
        <td style="padding-left:10px;vertical-align:middle;">
          <span style="color:#71717a;font-size:13px;font-weight:600;letter-spacing:0.06em;">MERIDIAN</span>
        </td>
      </tr></table></td>
      <td align="right">
        <span style="background:#16a34a22;color:#4ade80;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid #4ade8044;">&#x2713; SCHEDULED SENT</span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:0 40px 24px;">
    <h1 style="margin:0 0 8px;font-size:30px;font-weight:700;color:#fafafa;line-height:1.2;">&#x1F4C5; 1 email sent</h1>
    <p style="margin:0;color:#71717a;font-size:15px;">Your agent <strong style="color:#a1a1aa;">${agentName}</strong> sent a scheduled email.</p>
  </td></tr>

  <tr><td style="padding:0 40px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:12px;border-collapse:collapse;overflow:hidden;">
      <tr>
        <td width="50%" style="padding:20px;border-right:1px solid #27272a;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:#6366f1;">${whenSent}</div>
          <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">Scheduled Time</div>
        </td>
        <td width="50%" style="padding:20px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:#4ade80;">${subject}</div>
          <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">Subject</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${recipientSection}

  <tr><td style="padding:4px 40px 32px;">
    <a href="${appUrl}/email-queue" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;">View Email Queue &rarr;</a>
  </td></tr>

  <tr><td style="padding:20px 40px;border-top:1px solid #27272a;">
    <p style="margin:0;color:#52525b;font-size:12px;line-height:1.7;">
      You received this because email batch notifications are enabled on your account.
      <a href="${appUrl}/notifications" style="color:#6366f1;text-decoration:none;">Manage preferences</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

class EmailScheduler {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
    this.processingEmails = new Set();
    this.awsManager = new AWSManager();
    this.awsEmailQueue = new AWSEmailQueue();
    this.scheduledEmailJobs = getScheduledEmailJobs();
    
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
        console.log(`   → id=${e.emailId || e.id} scheduledAt=${e.scheduledAt} userId=${e.userId} agentId=${e.agentId}`);
      }

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
      const now = new Date().toISOString();
      const scheduledEmails = await this.scheduledEmailJobs.getDueScheduledEmails(now);

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
    const emailId = email.emailId || email.id;
    const { userId, agentId, scheduledAt } = email;
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
          const agentName = agentSettings?.name || approvedEmail.agentName || 'Agent';
          const userSettings = await this.awsManager.getUserSettings(userId).catch(() => null);
          const user = await this.awsManager.getUserById(userId).catch(() => null);
          const toEmail = user?.email || userSettings?.email || null;
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
            const appUrl = process.env.FRONTEND_URL || 'https://app.meridianai.co';
            const html = buildScheduledSendEmailHTML({
              agentName,
              recipient: {
                name: approvedEmail.leadDetails?.personInfo?.fullName || approvedEmail.leadData?.name || '',
                company: approvedEmail.leadDetails?.companyName || approvedEmail.leadData?.company || '',
                to: finalRecipient,
              },
              subject: finalSubject,
              scheduledAt,
              appUrl,
            });
            await sendSystemEmail(
              toEmail,
              `📅 ${agentName}: scheduled email sent`,
              html
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
      if (error.message?.includes('not found in QUEUED status')) {
        try {
          await this.scheduledEmailJobs.deleteScheduledEmail(userId, agentId, emailId);
          console.warn(`⚠️ [EMAIL SCHEDULER] Removed stale scheduled job for ${emailId}`);
        } catch (cleanupError) {
          console.error(`❌ [EMAIL SCHEDULER] Failed to clean stale scheduled job for ${emailId}:`, cleanupError.message);
        }
      }
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
