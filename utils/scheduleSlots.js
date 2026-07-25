// Single source of truth for "when does the next queued item go out" — replaces three
// previously-duplicated copies of this date math (utils/autoScheduleJobs.js, a client-side
// copy in moderntask/components/email-queue/email-queue-content.tsx, and a dead copy in
// routes/emailQueue.js). The sending schedule is now global per-user (not per-agent) —
// sending accounts already became global in an earlier refactor, and caps in
// utils/dailySendCaps.js are already computed user-wide, so a per-agent schedule was the
// odd one out.
//
// Main emails and follow-ups are two fully independent slot sequences, each with its own
// per-day cap (mainPerDay / followUpPerDay) and its own running index — a light day for one
// type does not donate its unused capacity to the other. That keeps "N mains + M follow-ups
// per day" literal: once the main queue runs dry, the following days are follow-ups only,
// same as a day with no follow-ups ready is mains-only.

import AWSManager from './awsManager.js';
import { getScheduledEmailJobs } from './scheduledEmailJobs.js';

function localTimeToUTC(year, month, day, hour, minute, timezone) {
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(naive);
  const renderedHour = parseInt(parts.find(part => part.type === 'hour')?.value || '0', 10);
  const renderedMinute = parseInt(parts.find(part => part.type === 'minute')?.value || '0', 10);
  const diffMs = ((hour * 60 + minute) - ((renderedHour === 24 ? 0 : renderedHour) * 60 + renderedMinute)) * 60000;
  return new Date(naive.getTime() + diffMs);
}

// `schedule` here is the generic per-type shape: { activeDays, sendTime, timezone, dailyLimit }
// — callers pass mainPerDay or followUpPerDay in as `dailyLimit` since the two types never
// share a day's capacity.
export function computeSlotDate(index, schedule) {
  const { activeDays, sendTime, dailyLimit, timezone } = schedule;
  const tz = timezone || 'America/New_York';
  const limit = Math.max(1, dailyLimit || 50);
  const targetSlot = Math.floor(index / limit);
  const [scheduleHour, scheduleMinute] = (sendTime || '09:00').split(':').map(Number);

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const nowHour = parseInt(nowParts.find(part => part.type === 'hour')?.value || '0', 10);
  const nowMinute = parseInt(nowParts.find(part => part.type === 'minute')?.value || '0', 10);
  const startOffset = ((nowHour === 24 ? 0 : nowHour) * 60 + nowMinute) >= (scheduleHour * 60 + scheduleMinute) ? 1 : 0;

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let slotsFound = 0;

  for (let offset = startOffset; offset < 400; offset += 1) {
    const probe = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + offset, 12, 0, 0));
    const weekdayString = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(probe);
    const weekday = weekdayMap[weekdayString] ?? probe.getUTCDay();
    if ((activeDays || [1, 2, 3, 4, 5]).includes(weekday)) {
      if (slotsFound === targetSlot) {
        const dateString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(probe);
        const [year, month, day] = dateString.split('-').map(Number);
        return localTimeToUTC(year, month, day, scheduleHour, scheduleMinute, tz);
      }
      slotsFound += 1;
    }
  }

  const fallbackProbe = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + 400, 12, 0, 0));
  const fallbackString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(fallbackProbe);
  const [fallbackYear, fallbackMonth, fallbackDay] = fallbackString.split('-').map(Number);
  return localTimeToUTC(fallbackYear, fallbackMonth, fallbackDay, scheduleHour, scheduleMinute, tz);
}

// The global schedule lives on the user's settings item (parallel to how settingsPresets
// already lives there) — { activeDays, sendTime, timezone, mainPerDay, followUpPerDay }.
export async function getGlobalSchedule(userId, awsManager) {
  const userSettings = await awsManager.getUserSettings(userId).catch(() => null);
  return userSettings?.sendingSchedule || null;
}

function isCompleteSchedule(schedule) {
  return !!(schedule && schedule.activeDays?.length && schedule.sendTime && schedule.mainPerDay);
}

// Recomputes every unscheduled main email's and every ready follow-up's scheduledAt across
// ALL of the user's agents combined, per the global schedule. Called opportunistically from
// the same trigger points that used to call the old per-agent syncAutoScheduleJobsForAgent
// (queue mutations, the schedule-settings save route), plus once per user at the end of
// utils/rebumpChecker.js's periodic sweep whenever it marks new follow-ups ready.
export async function syncGlobalScheduleForUser(userId, options = {}) {
  const awsManager = options.awsManager || new AWSManager();
  const awsQueue = options.awsQueue || new (await import('./awsEmailQueue.js')).default();
  const scheduledJobs = options.scheduledJobs || getScheduledEmailJobs();

  const schedule = options.schedule !== undefined ? options.schedule : await getGlobalSchedule(userId, awsManager);

  // ── Main emails: every QUEUED item across all agents without a manual scheduledAt ──
  const { emails: queuedEmails } = await awsQueue.getAllQueuedEmailsForUser(userId, 2000, 0).catch(() => ({ emails: [] }));
  const pendingMains = (queuedEmails || [])
    .filter(e => !e.scheduledAt)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  if (!isCompleteSchedule(schedule)) {
    // No global schedule configured (or it was just cleared) — retract any auto-assigned
    // slots so nothing fires on a stale schedule, matching today's per-agent behavior.
    await Promise.all(pendingMains.map(e =>
      scheduledJobs.deleteScheduledEmail(userId, e.agentId, e.id).catch(() => {})
    ));
  } else {
    let mainIndex = 0;
    for (const email of pendingMains) {
      if (email.batchExcluded) {
        await scheduledJobs.deleteScheduledEmail(userId, email.agentId, email.id).catch(() => {});
        continue;
      }
      const scheduledAt = computeSlotDate(mainIndex, { ...schedule, dailyLimit: schedule.mainPerDay }).toISOString();
      mainIndex += 1;
      await scheduledJobs.upsertScheduledEmail({
        userId, agentId: email.agentId, emailId: email.id, scheduledAt, scheduleType: 'auto', type: 'main',
      });
    }
  }

  // ── Follow-ups: sent-email records rebumpChecker flagged ready, not yet given a slot ──
  const sentEmails = await awsQueue.getAllSentEmailsForUser(userId).catch(() => []);
  const readyFollowUps = (sentEmails || [])
    .filter(e => e.followUpReadyForSchedule === true)
    .sort((a, b) => new Date(a.followUpReadySince || 0) - new Date(b.followUpReadySince || 0));

  if (isCompleteSchedule(schedule) && schedule.followUpPerDay > 0) {
    let followUpIndex = 0;
    for (const email of readyFollowUps) {
      const scheduledAt = computeSlotDate(followUpIndex, { ...schedule, dailyLimit: schedule.followUpPerDay }).toISOString();
      followUpIndex += 1;

      await scheduledJobs.upsertScheduledEmail({
        userId,
        agentId: email.agentId,
        emailId: email.id,
        scheduledAt,
        scheduleType: 'auto',
        type: 'followup',
        payload: {
          to: email.to,
          subject: email.followUpReadyContent?.subject,
          body: email.followUpReadyContent?.body,
          replyOptions: email.followUpReadyReplyOptions || null,
          originalEmailId: email.id,
          stepNumber: email.followUpReadyStepNumber,
        },
      });

      // Consume the flag so the next sync pass doesn't reassign (and reshuffle) this
      // follow-up a new slot — mirrors how a main email stops being "pending" once it
      // has a scheduledAt.
      await awsQueue.updateEmailStatus(userId, email.agentId, email.id, 'SENT', 'SENT', {
        followUpReadyForSchedule: false,
        followUpJobScheduledAt: scheduledAt,
      }).catch(() => {});
    }
  }
}
