/**
 * SENDING SCHEDULE PROCESSOR
 *
 * Runs every minute. For each agent that has a sendingSchedule:
 *   - Checks if today is an active day and the current time matches sendTime
 *   - Counts how many emails were already sent today (DynamoDB query)
 *   - Approves + sends oldest-queued emails up to the remaining daily limit
 *
 * Wiring (app.js):
 *   import { startSendingScheduleProcessor } from './utils/sendingScheduleProcessor.js';
 *   startSendingScheduleProcessor();
 */

import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';
import { sendSystemEmail } from '../tools/emailMailgun.js';
import { sendSMS } from './smsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

// How close to sendTime we need to be (in minutes) to fire.
// 1 means: fire within the same minute as the scheduled time.
const TIME_WINDOW_MINUTES = 1;

// Prevent two runs overlapping
let _running = false;

// Track which agent+day combos already fired today (in-memory guard to avoid
// sending the batch again if the cron fires a second time in the same minute).
// Key includes the TZ-aware date so it auto-expires when the calendar date
// changes in the agent's own timezone.
const _firedToday = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return "YYYY-MM-DD" in the given IANA timezone (or UTC if tz is invalid).
 */
function todayInTZ(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); // "YYYY-MM-DD"
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Decompose `date` into { h, m, weekday (0-6) } using the given IANA timezone.
 */
function localTimeParts(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value ?? '';
    const h = parseInt(get('hour'),   10); // 0-23 (note: Intl may give "24" for midnight in some envs)
    const m = parseInt(get('minute'), 10);
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = weekdayMap[get('weekday')] ?? date.getDay();
    return { h: h === 24 ? 0 : h, m, weekday };
  } catch {
    return { h: date.getHours(), m: date.getMinutes(), weekday: date.getDay() };
  }
}

/**
 * Count SENT emails for this agent on the agent's local calendar date.
 * SK format: SENT#<ISO-timestamp>#<emailId>
 * We query begins_with(SK, "SENT#YYYY-MM-DD") using the TZ-aware date.
 */
async function countSentToday(awsQueue, userId, agentId, timezone) {
  try {
    const pk = awsQueue._getPK(userId, agentId);
    const skPrefix = `SENT#${todayInTZ(timezone)}`;
    const response = await awsQueue.dynamodb.send(new QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: { ':pk': pk, ':skPrefix': skPrefix },
      Select: 'COUNT',
    }));
    return response.Count || 0;
  } catch (err) {
    console.error('[SCHEDULE PROCESSOR] Error counting sent-today:', err.message);
    return 0;
  }
}

/**
 * Returns true if `now` is within TIME_WINDOW_MINUTES of the agent's sendTime
 * on an active day of the week — all comparisons done in the agent's timezone.
 */
function isDue(schedule, now, tz) {
  const { h, m, weekday } = localTimeParts(now, tz);

  if (!schedule.activeDays.includes(weekday)) return false;

  const [schedH, schedM] = schedule.sendTime.split(':').map(Number);
  const nowTotalMinutes  = h * 60 + m;
  const schedTotalMinutes = schedH * 60 + schedM;

  return Math.abs(nowTotalMinutes - schedTotalMinutes) < TIME_WINDOW_MINUTES;
}

/**
 * Build the fancy HTML body for the batch-send notification email.
 */
function buildBatchEmailHTML({ agentName, emailCount, dailyLimit, sendTime, timezone, recipients, appUrl }) {
  const recipientRows = recipients.slice(0, 5).map(r => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #27272a;">
        <span style="color:#e4e4e7;font-size:13px;font-weight:500;">${r.name || ''}</span>
        ${r.company ? `<span style="color:#71717a;font-size:12px;"> &middot; ${r.company}</span>` : ''}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #27272a;text-align:right;">
        <span style="color:#71717a;font-size:12px;">${r.to || ''}</span>
      </td>
    </tr>`).join('');

  const overflowRow = recipients.length > 5
    ? `<tr><td colspan="2" style="padding:10px 16px;color:#71717a;font-size:12px;text-align:center;">+ ${recipients.length - 5} more recipient${recipients.length - 5 !== 1 ? 's' : ''}</td></tr>`
    : '';

  const recipientsSection = recipients.length > 0 ? `
  <tr><td style="padding:0 40px 28px;">
    <p style="margin:0 0 10px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Recipients</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:10px;border-collapse:collapse;overflow:hidden;">
      ${recipientRows}${overflowRow}
    </table>
  </td></tr>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">

  <!-- accent bar -->
  <tr><td style="background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);height:3px;font-size:0;">&nbsp;</td></tr>

  <!-- header row -->
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
        <span style="background:#16a34a22;color:#4ade80;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid #4ade8044;">&#x2713; BATCH SENT</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- title -->
  <tr><td style="padding:0 40px 24px;">
    <h1 style="margin:0 0 8px;font-size:30px;font-weight:700;color:#fafafa;line-height:1.2;">&#x1F4C5; ${emailCount} email${emailCount !== 1 ? 's' : ''} sent</h1>
    <p style="margin:0;color:#71717a;font-size:15px;">Your agent <strong style="color:#a1a1aa;">${agentName}</strong> completed its scheduled batch.</p>
  </td></tr>

  <!-- stats -->
  <tr><td style="padding:0 40px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:12px;border-collapse:collapse;overflow:hidden;">
      <tr>
        <td width="33%" style="padding:20px;border-right:1px solid #27272a;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#6366f1;">${emailCount}</div>
          <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">Sent</div>
        </td>
        <td width="33%" style="padding:20px;border-right:1px solid #27272a;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#8b5cf6;">${dailyLimit}</div>
          <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">Daily Limit</div>
        </td>
        <td width="33%" style="padding:20px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:#4ade80;">${sendTime}</div>
          <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">${timezone.replace(/_/g, ' ')}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${recipientsSection}

  <!-- CTA button -->
  <tr><td style="padding:4px 40px 32px;">
    <a href="${appUrl}/email-queue" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;">View Email Queue &rarr;</a>
  </td></tr>

  <!-- footer -->
  <tr><td style="padding:20px 40px;border-top:1px solid #27272a;">
    <p style="margin:0;color:#52525b;font-size:12px;line-height:1.7;">
      You received this because email batch notifications are enabled on your account.
      <a href="${appUrl}/notifications" style="color:#6366f1;text-decoration:none;">Manage preferences</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

/**
 * Send all batch-send notifications after a scheduled send fires:
 *   1. DynamoDB issue (shown in Notifications page)
 *   2. SSE broadcast (in-app toast)
 *   3. Email via Mailgun (if not opted out)
 *   4. SMS via Twilio (if user has phone + sms enabled)
 */
async function notifyBatchSent(awsManager, userId, user, agentId, settings, sentEmails, successCount) {
  const agentName = settings.name || agentId;
  const schedule  = settings.sendingSchedule || {};
  const tz        = schedule.timezone || settings.geographicSettings?.timezone || 'America/New_York';

  const [rawH, rawM] = (schedule.sendTime || '09:00').split(':').map(Number);
  const pm        = rawH >= 12;
  const h12       = rawH % 12 || 12;
  const sendTimeStr = `${h12}:${String(rawM).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;

  // 1 — Create DynamoDB issue (shows up in notifications list)
  await awsManager.addIssue(
    userId,
    'batch_send',
    `\u{1F4C5} ${agentName}: ${successCount} email${successCount !== 1 ? 's' : ''} auto-sent`,
    `Agent \u201C${agentName}\u201D completed its scheduled batch \u2014 ${successCount} email${successCount !== 1 ? 's' : ''} sent at ${sendTimeStr} (${tz}).`,
    {
      severity: 'low',
      agentId,
      agentName,
      emailCount: successCount,
      sendTime: sendTimeStr,
      timezone: tz,
    }
  );

  // 2 — SSE broadcast for in-app real-time toast
  try {
    const { broadcastNotification } = await import('../routes/monitoring.js');
    broadcastNotification(userId, {
      title:   `\u{1F4C5} ${agentName}: ${successCount} email${successCount !== 1 ? 's' : ''} sent`,
      message: `Scheduled batch complete \u2014 ${successCount} email${successCount !== 1 ? 's' : ''} sent at ${sendTimeStr} (${tz})`,
      agentId,
    });
  } catch (err) {
    console.warn('[SCHEDULE PROCESSOR] SSE broadcast skipped:', err.message);
  }

  // Load user notification settings
  const userSettings = await awsManager.getUserSettings(userId).catch(() => null);
  // Preferences are saved as userSettings.preferences.notifPrefs.emailNotifications
  const notifPrefs = userSettings?.preferences?.notifPrefs || {};

  // 3 — Mailgun email (always send unless user explicitly turned off emailNotifications)
  // Default: opt-in (send when undefined / true). Only skip when === false.
  const emailEnabled = notifPrefs.emailNotifications !== false;
  console.log(`[SCHEDULE PROCESSOR] 📧 Batch notif for agent ${agentId}: emailEnabled=${emailEnabled}, notifPrefs.emailNotifications=${notifPrefs.emailNotifications}`);

  if (emailEnabled) {
    const toEmail = user.email || userSettings?.email;
    console.log(`[SCHEDULE PROCESSOR] 📧 Sending batch email notif to: ${toEmail || '(none found)'}`);
    if (toEmail) {
      const appUrl = process.env.FRONTEND_URL || 'https://app.meridianai.co';
      const recipients = sentEmails.map(e => ({
        name:    e.leadDetails?.personInfo?.fullName || e.leadData?.name || '',
        to:      e.emailData?.finalRecipient || e.to || '',
        company: e.leadDetails?.personInfo?.company || e.leadData?.company || '',
      }));
      const html = buildBatchEmailHTML({
        agentName,
        emailCount: successCount,
        dailyLimit: schedule.dailyLimit || '—',
        sendTime:   sendTimeStr,
        timezone:   tz,
        recipients,
        appUrl,
      });
      const result = await sendSystemEmail(
        toEmail,
        `\u{1F4C5} ${agentName}: ${successCount} email${successCount !== 1 ? 's' : ''} auto-sent`,
        html
      );
      if (!result.success) {
        console.error(`[SCHEDULE PROCESSOR] ❌ Batch email notif failed for ${toEmail}:`, result.error);
      }
    } else {
      console.warn(`[SCHEDULE PROCESSOR] ⚠️ No email address found for userId ${userId} — skipping email notification`);
    }
  }

  // 4 — SMS (opt-in: only fires when phone is set and smsEnabled is true)
  if (notifPrefs.smsEnabled && notifPrefs.phone) {
    const appUrl = process.env.FRONTEND_URL || 'https://app.meridianai.co';
    await sendSMS(
      notifPrefs.phone,
      `Meridian: \u201C${agentName}\u201D auto-sent ${successCount} email${successCount !== 1 ? 's' : ''} at ${sendTimeStr} (${tz}). ${appUrl}/email-queue`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve + send one queued email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approve and send a single queued email — mirrors the logic in routes/emailQueue.js /:id/approve
 */
async function approveAndSend(awsQueue, awsManagerInst, userId, agentId, email) {
  const emailId = email.id;
  try {
    // Get full queued record (approveEmail returns the item)
    const approvedEmail = await awsQueue.approveEmail(userId, agentId, emailId);

    const emailData    = approvedEmail.emailData || {};
    const finalRecipient = emailData.finalRecipient || approvedEmail.finalRecipient || approvedEmail.to;
    const finalSubject   = emailData.finalSubject   || approvedEmail.finalSubject   || approvedEmail.subject;
    const finalBody      = emailData.finalBody      || approvedEmail.finalBody      || approvedEmail.body;

    if (!finalRecipient || !finalSubject || !finalBody) {
      console.warn(`[SCHEDULE PROCESSOR] ⚠️  Email ${emailId} missing required fields, skipping`);
      return false;
    }

    const personInfo = approvedEmail.leadDetails?.personInfo || null;

    // Fetch CC / BCC / senderName from agent settings
    let ccEmails = approvedEmail.cc || approvedEmail.emailData?.cc || null;
    let bccEmails = approvedEmail.bcc || approvedEmail.emailData?.bcc || null;
    let senderName = null;
    try {
      const agentSettings = await awsManagerInst.getLeadAgentSettings(userId, agentId);
      if (agentSettings) {
        if (!ccEmails && agentSettings.emailBuilder?.ccEmails)  ccEmails  = agentSettings.emailBuilder.ccEmails;
        if (!bccEmails && agentSettings.emailBuilder?.bccEmails) bccEmails = agentSettings.emailBuilder.bccEmails;
        senderName = agentSettings.companyName || agentSettings.emailBuilder?.companyName || null;
      }
    } catch { /* non-fatal */ }

    const replyOptions = approvedEmail.replyOptions || null;

    const sendResult = await leadEmail(
      finalRecipient,
      finalSubject,
      finalBody,
      personInfo,
      userId,
      agentId,
      ccEmails,
      bccEmails,
      senderName,
      replyOptions,
    );

    if (sendResult.success) {
      await awsQueue.markEmailAsSent(userId, agentId, emailId, {
        id: sendResult.result?.id,
        message: sendResult.result?.message,
        trackingId: sendResult.result?.trackingId,
        fromAccount: sendResult.fromAccount || null,
        method: sendResult.method || 'schedule',
        messageId: sendResult.result?.messageId || null,
        threadId: sendResult.result?.threadId || null,
      });
      console.log(`[SCHEDULE PROCESSOR] ✅ Sent ${emailId} → ${finalRecipient}`);
      return true;
    } else {
      console.error(`[SCHEDULE PROCESSOR] ❌ Send failed for ${emailId}:`, sendResult.error);
      return false;
    }
  } catch (err) {
    console.error(`[SCHEDULE PROCESSOR] ❌ Error processing ${emailId}:`, err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tick
// ─────────────────────────────────────────────────────────────────────────────

async function tick() {
  if (_running) return;
  _running = true;

  try {
    const now = new Date();

    const awsManager = new AWSManager();
    const awsQueue   = new AWSEmailQueue();

    // Get all users
    const users = await awsManager.getAllUsers();

    for (const user of users) {
      const userId = user.userId || user.id;
      if (!userId) continue;

      const agents = user.activeAgents || [];

      for (const agent of agents) {
        const agentId = agent.agentId;
        if (!agentId) continue;

        // Load full settings to get sendingSchedule
        let settings;
        try {
          settings = await awsManager.getLeadAgentSettings(userId, agentId);
        } catch { continue; }

        const schedule = settings?.sendingSchedule;
        if (!schedule || !schedule.activeDays?.length || !schedule.sendTime || !schedule.dailyLimit) continue;

        // Use timezone from sendingSchedule, fall back to geographicSettings.timezone (where the UI saves it)
        const tz = schedule.timezone || settings.geographicSettings?.timezone || 'America/New_York';

        if (!isDue(schedule, now, tz)) continue;

        // Guard: only fire once per agent per local calendar day
        const firedKey = `${userId}#${agentId}#${todayInTZ(tz)}`;
        if (_firedToday.has(firedKey)) continue;

        // Count how many already sent today (in the agent's timezone)
        const sentToday = await countSentToday(awsQueue, userId, agentId, tz);
        const remaining = Math.max(0, schedule.dailyLimit - sentToday);

        if (remaining === 0) {
          console.log(`[SCHEDULE PROCESSOR] Daily limit reached for agent ${agentId} (${schedule.dailyLimit} sent)`);
          _firedToday.add(firedKey); // Don't check again today
          continue;
        }

        // Get queued emails, oldest first
        let queued = [];
        try {
          queued = await awsQueue.getQueuedEmails(userId, agentId);
        } catch { continue; }

        // Sort by createdAt ascending (oldest = index 0)
        queued.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        // Skip emails explicitly excluded from batch sending by the user
        queued = queued.filter(e => !e.batchExcluded);

        const toSend = queued.slice(0, remaining);
        if (toSend.length === 0) {
          console.log(`[SCHEDULE PROCESSOR] No queued emails for agent ${agentId}`);
          _firedToday.add(firedKey);
          continue;
        }

        console.log(`[SCHEDULE PROCESSOR] 📅 Agent ${agentId} (${tz}): sending ${toSend.length}/${remaining} remaining (limit ${schedule.dailyLimit}, sent today ${sentToday})`);
        _firedToday.add(firedKey);

        let successCount = 0;
        for (const email of toSend) {
          const ok = await approveAndSend(awsQueue, awsManager, userId, agentId, email);
          if (ok) successCount++;
        }

        if (successCount > 0) {
          try {
            await notifyBatchSent(awsManager, userId, user, agentId, settings, toSend, successCount);
          } catch (err) {
            console.error('[SCHEDULE PROCESSOR] ⚠️ Batch notification failed:', err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SCHEDULE PROCESSOR] ❌ Tick error:', err.message);
  } finally {
    _running = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

let _interval = null;

export function startSendingScheduleProcessor() {
  if (_interval) return;
  console.log('📅 [SCHEDULE PROCESSOR] Starting — checks every 60 seconds');
  tick(); // run immediately on start
  _interval = setInterval(tick, 60 * 1000);
}

export function stopSendingScheduleProcessor() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    console.log('🛑 [SCHEDULE PROCESSOR] Stopped');
  }
}
