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

export function computeAutoScheduleDate(index, schedule) {
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

export async function syncAutoScheduleJobsForAgent(userId, agentId, options = {}) {
  const awsManager = options.awsManager || new AWSManager();
  const awsQueue = options.awsQueue || new (await import('./awsEmailQueue.js')).default();
  const scheduledJobs = options.scheduledJobs || getScheduledEmailJobs();

  const settings = options.settings !== undefined
    ? options.settings
    : await awsManager.getLeadAgentSettings(userId, agentId).catch(() => null);

  const queuedEmails = options.queuedEmails || await awsQueue.getQueuedEmails(userId, agentId).catch(() => []);
  const sorted = [...queuedEmails].sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
  const schedule = settings?.sendingSchedule;

  let slotIndex = 0;
  for (const email of sorted) {
    if (email.scheduledAt) {
      continue;
    }

    if (!schedule || !schedule.activeDays?.length || !schedule.sendTime || !schedule.dailyLimit || email.batchExcluded) {
      await scheduledJobs.deleteScheduledEmail(userId, agentId, email.id).catch(() => {});
      continue;
    }

    const scheduledAt = computeAutoScheduleDate(slotIndex, schedule).toISOString();
    slotIndex += 1;

    await scheduledJobs.upsertScheduledEmail({
      userId,
      agentId,
      emailId: email.id,
      scheduledAt,
      scheduleType: 'auto'
    });
  }
}