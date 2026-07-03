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
import { buildComplianceFooter } from '../routes/unsubscribe.js';

function buildScheduledSendEmailHTML({ agentName, recipient, subject, scheduledAt, appUrl }) {
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
  const recipientName = recipient.name || '';
  const recipientCompany = recipient.company || '';
  const recipientEmail = recipient.to || '';
  const whenSent = scheduledDate.toLocaleString();

  const recipientSection = `
  <tr><td style="padding:0 40px 28px;">
    <p style="margin:0 0 10px;color:#9e8252;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Recipient</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,26,24,0.12);border-radius:8px;border-collapse:collapse;overflow:hidden;">
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(26,26,24,0.08);">
          <span style="color:#1a1a18;font-size:13px;font-weight:500;">${recipientName}</span>
          ${recipientCompany ? `<span style="color:#9e8252;font-size:12px;"> &middot; ${recipientCompany}</span>` : ''}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(26,26,24,0.08);text-align:right;">
          <span style="color:#6b6455;font-size:12px;">${recipientEmail}</span>
        </td>
      </tr>
    </table>
  </td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede8de;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#f4efe6;border-radius:12px;overflow:hidden;border:1px solid rgba(26,26,24,0.12);">

  <tr><td style="background:#1a3d28;height:3px;font-size:0;">&nbsp;</td></tr>

  <tr><td style="padding:32px 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><table cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <img src="${appUrl}/MeridianM.png" width="30" height="30" alt="M" style="display:block;" />
        </td>
        <td style="padding-left:10px;vertical-align:middle;">
          <span style="color:#6b6455;font-size:13px;font-weight:600;letter-spacing:0.08em;">MERIDIAN</span>
        </td>
      </tr></table></td>
      <td align="right">
        <span style="background:rgba(158,130,82,0.12);color:#9e8252;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid rgba(158,130,82,0.3);">&#x2713; SCHEDULED SENT</span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:0 40px 24px;">
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;color:#1a1a18;line-height:1.2;font-family:Georgia,serif;">1 email sent</h1>
    <p style="margin:0;color:#6b6455;font-size:14px;">Your agent <strong style="color:#1a1a18;">${agentName}</strong> sent a scheduled email.</p>
  </td></tr>

  <tr><td style="padding:0 40px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,26,24,0.12);border-radius:8px;border-collapse:collapse;overflow:hidden;">
      <tr>
        <td width="50%" style="padding:20px;border-right:1px solid rgba(26,26,24,0.12);text-align:center;background:#ede8de;">
          <div style="font-size:15px;font-weight:600;color:#1a3d28;">${whenSent}</div>
          <div style="color:#9e8252;font-size:10px;margin-top:4px;text-transform:uppercase;letter-spacing:0.08em;">Scheduled Time</div>
        </td>
        <td width="50%" style="padding:20px;text-align:center;background:#ede8de;">
          <div style="font-size:15px;font-weight:600;color:#1a1a18;">${subject}</div>
          <div style="color:#9e8252;font-size:10px;margin-top:4px;text-transform:uppercase;letter-spacing:0.08em;">Subject</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${recipientSection}

  <tr><td style="padding:4px 40px 32px;">
    <a href="${appUrl}/email-queue" style="display:inline-block;background:#1a3d28;color:#f4efe6;text-decoration:none;font-size:13px;font-weight:500;padding:11px 24px;border-radius:4px;letter-spacing:0.04em;">View Email Queue &rarr;</a>
  </td></tr>

  <tr><td style="padding:20px 40px;border-top:1px solid rgba(26,26,24,0.1);">
    <p style="margin:0;color:#9e8252;font-size:12px;line-height:1.7;">
      You received this because email batch notifications are enabled on your account.
      <a href="${appUrl}/notifications" style="color:#1a3d28;text-decoration:none;">Manage preferences</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

function buildBatchScheduledHTML({ agentName, sentResults, appUrl }) {
  const count = sentResults.length;
  const rows = sentResults.slice(0, 5).map(r => {
    const name = r.approvedEmail?.leadDetails?.personInfo?.fullName || r.approvedEmail?.leadData?.name || '';
    const company = r.approvedEmail?.leadDetails?.companyName || r.approvedEmail?.leadData?.company || '';
    return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(26,26,24,0.08);">
        <span style="color:#1a1a18;font-size:13px;font-weight:500;">${name}</span>
        ${company ? `<span style="color:#9e8252;font-size:12px;"> &middot; ${company}</span>` : ''}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(26,26,24,0.08);text-align:right;">
        <span style="color:#6b6455;font-size:12px;">${r.to}</span>
      </td>
    </tr>`;
  }).join('');
  const overflow = sentResults.length > 5
    ? `<tr><td colspan="2" style="padding:10px 16px;color:#9e8252;font-size:12px;text-align:center;">+ ${sentResults.length - 5} more</td></tr>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#ede8de;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#f4efe6;border-radius:12px;overflow:hidden;border:1px solid rgba(26,26,24,0.12);">
  <tr><td style="background:#1a3d28;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="color:#6b6455;font-size:13px;font-weight:600;letter-spacing:0.08em;">MERIDIAN</span></td>
      <td align="right"><span style="background:rgba(158,130,82,0.12);color:#9e8252;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid rgba(158,130,82,0.3);">&#x2713; SCHEDULED SENT</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 40px 24px;">
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;color:#1a1a18;font-family:Georgia,serif;">${count} emails sent</h1>
    <p style="margin:0;color:#6b6455;font-size:14px;">Your agent <strong style="color:#1a1a18;">${agentName}</strong> sent ${count} scheduled emails.</p>
  </td></tr>
  <tr><td style="padding:0 40px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,26,24,0.12);border-radius:8px;border-collapse:collapse;overflow:hidden;">
      ${rows}${overflow}
    </table>
  </td></tr>
  <tr><td style="padding:4px 40px 32px;">
    <a href="${appUrl}/email-queue" style="display:inline-block;background:#1a3d28;color:#f4efe6;text-decoration:none;font-size:13px;font-weight:500;padding:11px 24px;border-radius:4px;letter-spacing:0.04em;">View Email Queue &rarr;</a>
  </td></tr>
</table></td></tr></table></body></html>`;
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

      // Group by userId+agentId so we can batch notifications
      const sentByAgent = {}; // key: `${userId}#${agentId}`

      for (const email of scheduledEmails) {
        const result = await this.sendScheduledEmail(email);
        if (result?.success) {
          const key = `${email.userId}#${email.agentId}`;
          if (!sentByAgent[key]) sentByAgent[key] = { userId: email.userId, agentId: email.agentId, emails: [] };
          sentByAgent[key].emails.push(result);
        }
        // Stagger DynamoDB writes to avoid ProvisionedThroughputExceededException when many
        // emails fire at the same scheduled time (e.g. 9 emails all due at 5:15 PM)
        await new Promise(r => setTimeout(r, 350));
      }

      // Send one batched notification per agent
      for (const { userId, agentId, emails } of Object.values(sentByAgent)) {
        try {
          await this.notifyBatchScheduled(userId, agentId, emails);
        } catch (err) {
          console.warn(`[EMAIL SCHEDULER] ⚠️ Batch notification failed for agent ${agentId}:`, err.message);
        }
      }

      // 15s after every batch: silently reconcile counters + purge orphaned scheduled jobs
      // for every user who had emails in this tick. Non-blocking — never throws.
      const affectedUserIds = [...new Set(scheduledEmails.map(e => e.userId).filter(Boolean))];
      if (affectedUserIds.length > 0) {
        setTimeout(async () => {
          for (const userId of affectedUserIds) {
            try {
              await this.awsEmailQueue.reconcileCounters(userId);
              // Belt-and-suspenders: delete scheduled jobs for every email we just processed
              for (const email of scheduledEmails) {
                if (email.userId === userId) {
                  await this.scheduledEmailJobs.deleteScheduledEmail(userId, email.agentId, email.emailId || email.id).catch(() => {});
                }
              }
              console.log(`🔄 [EMAIL SCHEDULER] Post-send reconcile done for ${userId}`);
            } catch (err) {
              console.warn(`[EMAIL SCHEDULER] ⚠️ Post-send reconcile failed for ${userId}:`, err.message);
            }
          }
        }, 15_000);
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

      // Final unsubscribe gate: the recipient may have unsubscribed after this send
      // was scheduled. Pull it out of the send flow instead of emailing them.
      const recipientUnsubscribed = await this.awsManager.isUnsubscribed(finalRecipient).catch(() => false);
      if (recipientUnsubscribed) {
        console.log(`🚫 [EMAIL SCHEDULER] Skipping ${emailId} — ${finalRecipient} has unsubscribed`);
        await this.awsEmailQueue.updateEmailStatus(userId, agentId, emailId, 'QUEUED', 'QUEUED', {
          scheduledAt: null,
          unsubscribed: true,
        }).catch(() => {});
        return;
      }

      const personInfo = approvedEmail.leadDetails?.personInfo || null;

      // Fetch CC / BCC / senderName / companyBranding from agent settings
      let ccEmails   = approvedEmail.cc   || approvedEmail.emailData?.cc   || null;
      let bccEmails  = approvedEmail.bcc  || approvedEmail.emailData?.bcc  || null;
      let senderName = null;
      let companyBranding = null;
      try {
        const agentSettings = await this.awsManager.getLeadAgentSettings(userId, agentId);
        if (agentSettings) {
          if (!ccEmails  && agentSettings.emailBuilder?.ccEmails)  ccEmails  = agentSettings.emailBuilder.ccEmails;
          if (!bccEmails && agentSettings.emailBuilder?.bccEmails) bccEmails = agentSettings.emailBuilder.bccEmails;
          senderName = agentSettings.companyName || agentSettings.emailBuilder?.companyName || null;
          companyBranding = agentSettings.companyBranding || null;
        }
      } catch { /* non-fatal */ }

      const replyOptions = approvedEmail.replyOptions || null;

      // Append legal compliance footer (company branding + unsubscribe link) — built fresh
      // at actual send time, never baked into the editable draft.
      const finalBodyWithFooter = finalBody + buildComplianceFooter({
        recipientEmail: finalRecipient,
        userId,
        companyBranding,
      }).replace('<!--MERIDIAN_FOOTER-->', '');

      console.log(`📧 [EMAIL SCHEDULER] Calling leadEmail() for ${emailId}...`);
      const sendResult = await leadEmail(
        finalRecipient, finalSubject, finalBodyWithFooter,
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
        return {
          success: true,
          emailId,
          to: finalRecipient,
          subject: finalSubject,
          scheduledAt,
          approvedEmail,
        };
      } else {
        console.error(`❌ [EMAIL SCHEDULER] Send failed for ${emailId}:`, sendResult.error);
        return { success: false };
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
    return { success: false };
  }

  // Send one batched notification for all scheduled emails that fired in this tick for a single agent
  async notifyBatchScheduled(userId, agentId, sentResults) {
    const count = sentResults.length;
    const agentSettings = await this.awsManager.getLeadAgentSettings(userId, agentId).catch(() => null);
    const agentName = agentSettings?.name || 'Agent';
    const userSettings = await this.awsManager.getUserSettings(userId).catch(() => null);
    const user = await this.awsManager.getUserById(userId).catch(() => null);
    const toEmail = user?.email || userSettings?.email || null;
    const notifPrefs = userSettings?.preferences?.notifPrefs || {};
    const appUrl = process.env.FRONTEND_URL || 'https://www.meridianprospects.com';

    // In-app notification (one entry)
    await this.awsManager.addIssue(
      userId, 'scheduled_send',
      `\u{1F4C5} ${agentName}: ${count} scheduled email${count !== 1 ? 's' : ''} sent`,
      `Agent \u201C${agentName}\u201D sent ${count} scheduled email${count !== 1 ? 's' : ''}.`,
      { severity: 'low', agentId, agentName, emailCount: count }
    );

    // SSE broadcast
    try {
      const { broadcastNotification } = await import('../routes/monitoring.js');
      broadcastNotification(userId, {
        title:   `\u{1F4C5} ${agentName}: ${count} scheduled email${count !== 1 ? 's' : ''} sent`,
        message: `${count} scheduled email${count !== 1 ? 's' : ''} delivered`,
        agentName, agentId,
      });
    } catch { /* non-fatal */ }

    // Email notification (one email, lists all recipients)
    if (notifPrefs.emailNotifications !== false && toEmail) {
      // Use first email's scheduledAt for the timestamp; list all recipients
      const first = sentResults[0];
      const html = count === 1
        ? buildScheduledSendEmailHTML({
            agentName,
            recipient: {
              name: first.approvedEmail?.leadDetails?.personInfo?.fullName || first.approvedEmail?.leadData?.name || '',
              company: first.approvedEmail?.leadDetails?.companyName || first.approvedEmail?.leadData?.company || '',
              to: first.to,
            },
            subject: first.subject,
            scheduledAt: first.scheduledAt,
            appUrl,
          })
        : buildBatchScheduledHTML({ agentName, sentResults, appUrl });

      await sendSystemEmail(
        toEmail,
        `\u{1F4C5} ${agentName}: ${count} scheduled email${count !== 1 ? 's' : ''} sent`,
        html
      );
    }

    // SMS
    if (notifPrefs.smsEnabled && notifPrefs.phone) {
      await sendSMS(
        notifPrefs.phone,
        `Meridian: \u201C${agentName}\u201D sent ${count} scheduled email${count !== 1 ? 's' : ''}. ${appUrl}/email-queue`
      );
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
