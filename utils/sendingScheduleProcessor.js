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
// Cleared at midnight via day-change detection.
const _firedToday = new Set();
let _lastDay = new Date().getDate();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Count SENT emails for this agent today.
 * SK format: SENT#<ISO-timestamp>#<emailId>
 * We query begins_with(SK, "SENT#YYYY-MM-DD") to get today's sent count.
 */
async function countSentToday(awsQueue, userId, agentId) {
  try {
    const pk = awsQueue._getPK(userId, agentId);
    const skPrefix = `SENT#${todayDateString()}`;
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
 * on an active day of the week.
 */
function isDue(schedule, now) {
  const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
  if (!schedule.activeDays.includes(dayOfWeek)) return false;

  const [schedH, schedM] = schedule.sendTime.split(':').map(Number);
  const schedTotalMinutes = schedH * 60 + schedM;
  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();

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

    // Reset fired-today set at midnight
    if (now.getDate() !== _lastDay) {
      _firedToday.clear();
      _lastDay = now.getDate();
    }

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

        if (!isDue(schedule, now)) continue;

        // Guard: only fire once per agent per day
        const firedKey = `${userId}#${agentId}#${todayDateString()}`;
        if (_firedToday.has(firedKey)) continue;

        // Count how many already sent today
        const sentToday = await countSentToday(awsQueue, userId, agentId);
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

        console.log(`[SCHEDULE PROCESSOR] 📅 Agent ${agentId}: sending ${toSend.length}/${remaining} remaining (limit ${schedule.dailyLimit}, sent today ${sentToday})`);
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
