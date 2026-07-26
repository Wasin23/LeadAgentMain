// Single source of truth for "when does the next queued item go out" — replaces three
// previously-duplicated copies of this date math (utils/autoScheduleJobs.js, a client-side
// copy in moderntask/components/email-queue/email-queue-content.tsx, and a dead copy in
// routes/emailQueue.js). The sending schedule is now global per-user (not per-agent) —
// sending accounts already became global in an earlier refactor, and caps in
// utils/dailySendCaps.js are already computed user-wide, so a per-agent schedule was the
// odd one out.
//
// Main emails are the only thing configured here — "Max Emails/Day", bounded by the plan's
// total daily cap. Follow-ups are never configured as a ratio: they are PREDICTED, derived
// from how many mains go out shifted forward by the global follow-up interval, and bounded
// by the per-mailbox (50/day) cap across all connected sending accounts — not by the main
// cap. That's the whole point of the structural redesign: the main cap is the bottleneck for
// mains, mailbox capacity is the bottleneck for follow-ups, and the two never compete.

import AWSManager from './awsManager.js';
import { getScheduledEmailJobs } from './scheduledEmailJobs.js';
import { getPlanDailyCap, PER_ACCOUNT_DAILY_CAP } from './dailySendCaps.js';

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

// Spreads a day's batch across a window around the base send time instead of firing every
// item at the exact same instant — a bunch of emails going out at 09:00:00.000 sharp every
// day is itself a spam signal. Items are ordered across the window by their position in the
// day (`indexWithinDay`), plus a small extra wobble so it doesn't look like a perfectly even
// robotic spacing either. Clamped to the same calendar day (never spills into the next/prior
// day's window).
function applyJitter(hour, minute, jitterMinutes, indexWithinDay, limit) {
  if (!jitterMinutes) return { hour, minute };
  const fraction = limit > 1 ? indexWithinDay / (limit - 1) : 0.5; // 0..1 across the day's batch
  const spread = (fraction - 0.5) * 2 * jitterMinutes; // -jitter..+jitter, ordered by position
  const wobble = (Math.random() - 0.5) * (jitterMinutes / Math.max(1, limit));
  const totalMinutes = Math.max(0, Math.min(1439, hour * 60 + minute + Math.round(spread + wobble)));
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

// `schedule` here is the generic per-type shape: { activeDays, sendTime, timezone, dailyLimit }
export function computeSlotDate(index, schedule) {
  const { activeDays, sendTime, dailyLimit, timezone, sendTimeJitterMinutes } = schedule;
  const tz = timezone || 'America/New_York';
  const limit = Math.max(1, dailyLimit || 50);
  const targetSlot = Math.floor(index / limit);
  const indexWithinDay = index % limit;
  const jitterMinutes = Math.max(0, Math.min(180, sendTimeJitterMinutes || 0));
  const [baseHour, baseMinute] = (sendTime || '09:00').split(':').map(Number);
  const { hour: scheduleHour, minute: scheduleMinute } = applyJitter(baseHour, baseMinute, jitterMinutes, indexWithinDay, limit);

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
  // Decided off the BASE (non-jittered) time, not this item's own jittered instant — every
  // item sharing a targetSlot must agree on which calendar day that is, and a per-item jitter
  // roll could otherwise push some items over the "has today's window passed" line and not
  // others, splitting one slot across two different days.
  const startOffset = ((nowHour === 24 ? 0 : nowHour) * 60 + nowMinute) >= (baseHour * 60 + baseMinute) ? 1 : 0;

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
// already lives there) — { activeDays, sendTime, timezone, mainPerDay }. Main emails only —
// follow-ups are never configured here, see header comment.
export async function getGlobalSchedule(userId, awsManager) {
  const userSettings = await awsManager.getUserSettings(userId).catch(() => null);
  return userSettings?.sendingSchedule || null;
}

function isCompleteSchedule(schedule) {
  return !!(schedule && schedule.activeDays?.length && schedule.sendTime && schedule.mainPerDay);
}

// Total across-all-mailboxes follow-up capacity per day — independent of the main cap.
// Follow-ups only answer to the per-mailbox limit ("the rule of sending limits for the
// email address being sent from"), never to the plan's max-emails-per-day.
async function getFollowUpCapacityPerDay(userId, awsManager) {
  const userSettings = await awsManager.getUserSettings(userId).catch(() => null);
  const numAccounts = (userSettings?.gmailAccounts?.length || 0) + (userSettings?.outlookAccounts?.length || 0);
  return Math.max(1, numAccounts) * PER_ACCOUNT_DAILY_CAP;
}

async function getFollowUpSettings(userId, awsManager) {
  const userSettings = await awsManager.getUserSettings(userId).catch(() => null);
  return {
    enabled: true,
    intervalDays: 7,
    maxRebumps: 1,
    smartRebump: false,
    ...(userSettings?.followUpSettings || {}),
  };
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

  // Main emails are bounded only by the plan's total daily cap — never shared with follow-ups.
  const planDailyCap = await getPlanDailyCap(userId).catch(() => null);
  const effectiveMainPerDay = schedule
    ? (planDailyCap != null ? Math.min(schedule.mainPerDay, planDailyCap) : schedule.mainPerDay)
    : 0;

  // Follow-ups are bounded only by aggregate per-mailbox capacity — never by the main cap.
  const followUpCapacityPerDay = await getFollowUpCapacityPerDay(userId, awsManager);

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
      const scheduledAt = computeSlotDate(mainIndex, { ...schedule, dailyLimit: effectiveMainPerDay }).toISOString();
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

  if (followUpCapacityPerDay > 0) {
    // Follow-ups use the schedule's active days/send time/timezone (when to send), but their
    // own independent daily capacity (how many) — mains never gate this.
    const followUpSchedule = {
      activeDays: schedule?.activeDays?.length ? schedule.activeDays : [1, 2, 3, 4, 5],
      sendTime: schedule?.sendTime || '09:00',
      timezone: schedule?.timezone,
    };
    let followUpIndex = 0;
    for (const email of readyFollowUps) {
      const scheduledAt = computeSlotDate(followUpIndex, { ...followUpSchedule, dailyLimit: followUpCapacityPerDay }).toISOString();
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

// Simulates what a schedule config would actually do to today's queue AND predicts follow-up
// volume, day by day, for the schedule-builder preview and the calendar overhaul. Main volume
// is a real backlog count draining against mainPerDay (bounded by the plan cap). Follow-up
// volume is PREDICTED, not configured: every main sent on day D is projected to produce a
// follow-up on day D + intervalDays (and, if maxRebumps > 1, additional follow-ups at each
// further interval), bounded by aggregate per-mailbox capacity for that day — never by the
// main cap. Pure function: takes the CURRENT queue depth as a starting snapshot, not live
// data, so the caller decides what "pending" means (real counts from the DB, or a
// hypothetical draft while editing).
export function previewSchedule({
  mainQueueCount = 0,
  schedule,
  days = 30,
  totalCapPerDay = null,
  followUpCapacityPerDay = PER_ACCOUNT_DAILY_CAP,
  followUpSettings = null,
}) {
  const tz = schedule?.timezone || 'America/New_York';
  const activeDays = schedule?.activeDays?.length ? schedule.activeDays : [1, 2, 3, 4, 5];
  const mainPerDay = Math.max(0, schedule?.mainPerDay || 0);
  const effectiveMainPerDay = totalCapPerDay != null ? Math.min(mainPerDay, totalCapPerDay) : mainPerDay;
  const [scheduleHour, scheduleMinute] = (schedule?.sendTime || '09:00').split(':').map(Number);

  const fu = {
    enabled: true,
    intervalDays: 7,
    maxRebumps: 1,
    ...(followUpSettings || {}),
  };

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const nowHour = parseInt(nowParts.find(p => p.type === 'hour')?.value || '0', 10);
  const nowMinute = parseInt(nowParts.find(p => p.type === 'minute')?.value || '0', 10);
  const startOffset = ((nowHour === 24 ? 0 : nowHour) * 60 + nowMinute) >= (scheduleHour * 60 + scheduleMinute) ? 1 : 0;

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let remainingMain = mainQueueCount;

  // mainCountByOffset[offset] = how many mains actually went out that day — used to project
  // follow-ups forward. Computed for the full walk up front so a follow-up predicted beyond
  // the visible `days` window still gets counted if it lands within it.
  const walkLength = Math.max(days, days + fu.maxRebumps * fu.intervalDays + 7);
  const mainCountByOffset = {};
  const activeByOffset = {};
  const dateByOffset = {};

  for (let offset = startOffset; offset < walkLength; offset += 1) {
    const probe = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + offset, 12, 0, 0));
    const weekdayString = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(probe);
    const weekday = weekdayMap[weekdayString] ?? probe.getUTCDay();
    const active = activeDays.includes(weekday);
    activeByOffset[offset] = active;
    dateByOffset[offset] = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(probe);

    const mainCount = active ? Math.min(remainingMain, effectiveMainPerDay) : 0;
    if (active) remainingMain -= mainCount;
    mainCountByOffset[offset] = mainCount;
  }

  // Predicted follow-up demand per offset, before capping by mailbox capacity — a main sent
  // on offset O predicts a follow-up on O + intervalDays, and (if maxRebumps > 1) another at
  // each further interval, up to maxRebumps steps.
  const followUpDemandByOffset = {};
  if (fu.enabled && fu.intervalDays > 0) {
    for (let offset = startOffset; offset < walkLength; offset += 1) {
      const mains = mainCountByOffset[offset] || 0;
      if (!mains) continue;
      for (let step = 1; step <= fu.maxRebumps; step += 1) {
        const targetOffset = offset + step * fu.intervalDays;
        if (targetOffset >= walkLength) continue;
        followUpDemandByOffset[targetOffset] = (followUpDemandByOffset[targetOffset] || 0) + mains;
      }
    }
  }

  // Walk again, this time draining predicted follow-up demand against daily mailbox capacity,
  // with overflow rolling forward to the next active day (same as main backlog draining).
  let followUpBacklog = 0;
  const result = [];
  for (let offset = startOffset; result.length < days; offset += 1) {
    const active = activeByOffset[offset];
    followUpBacklog += followUpDemandByOffset[offset] || 0;

    const mainCount = mainCountByOffset[offset] || 0;
    const followUpCap = active ? followUpCapacityPerDay : 0;
    const followUpCount = active ? Math.min(followUpBacklog, followUpCap) : 0;
    if (active) followUpBacklog -= followUpCount;

    result.push({
      date: dateByOffset[offset],
      active,
      mainCount,
      mainCap: active ? effectiveMainPerDay : 0,
      followUpCount,
      followUpCap,
    });
  }

  return result;
}
