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
function isDue(schedule, now) {
  const tz = schedule.timezone || 'UTC';
  const { h, m, weekday } = localTimeParts(now, tz);

  if (!schedule.activeDays.includes(weekday)) return false;

  const [schedH, schedM] = schedule.sendTime.split(':').map(Number);
  const nowTotalMinutes  = h * 60 + m;
  const schedTotalMinutes = schedH * 60 + schedM;

  return Math.abs(nowTotalMinutes - schedTotalMinutes) < TIME_WINDOW_MINUTES;
}

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

        const tz = schedule.timezone || 'UTC';

        if (!isDue(schedule, now)) continue;

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

        const toSend = queued.slice(0, remaining);
        if (toSend.length === 0) {
          console.log(`[SCHEDULE PROCESSOR] No queued emails for agent ${agentId}`);
          _firedToday.add(firedKey);
          continue;
        }

        console.log(`[SCHEDULE PROCESSOR] 📅 Agent ${agentId} (${tz}): sending ${toSend.length}/${remaining} remaining (limit ${schedule.dailyLimit}, sent today ${sentToday})`);
        _firedToday.add(firedKey);

        for (const email of toSend) {
          await approveAndSend(awsQueue, awsManager, userId, agentId, email);
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
