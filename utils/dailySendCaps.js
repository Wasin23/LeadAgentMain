import AWSManager from './awsManager.js';
import { getAWSEmailQueue } from './awsEmailQueue.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const awsManager = new AWSManager();

// Flat regardless of plan — a deliverability guardrail per connected mailbox
// (Gmail/Outlook throttle or flag an address that suddenly sends a large
// volume in one day), not a plan-tier feature. Doesn't apply to Mailgun sends
// (no single mailbox reputation to protect there).
export const PER_ACCOUNT_DAILY_CAP = 50;

// Single source of truth for both the /daily-cap-status display endpoint and
// the actual send-time enforcement in tools/leadEmail.js — so the numbers
// shown to the user and the numbers that block a send never drift apart.
export async function getDailySendCapStatus(userId) {
  const awsQueue = getAWSEmailQueue();
  const userSettings = await awsManager.getUserSettings(userId);
  const timezone = userSettings?.timezone || 'America/New_York';

  const gmailAccounts = (userSettings?.gmailAccounts || []).map((acc, i) => ({
    email: acc.email, provider: 'gmail', isActive: !!acc.isActive, index: i,
  }));
  const outlookAccounts = (userSettings?.outlookAccounts || []).map((acc, i) => ({
    email: acc.email, provider: 'outlook', isActive: !!acc.isActive, index: i,
  }));
  // Legacy accounts predating the isActive field won't have it set on any
  // account — default to the first one so something is always shown as active.
  if (outlookAccounts.length > 0 && !outlookAccounts.some(a => a.isActive) && !gmailAccounts.some(a => a.isActive)) {
    outlookAccounts[0].isActive = true;
  }
  const connectedAccounts = [...gmailAccounts, ...outlookAccounts];
  const activeAccount = connectedAccounts.find(a => a.isActive) || null;

  // Today's date string in the user's timezone. SK is SENT#<UTC-ISO-timestamp>#<emailId> —
  // the embedded date is UTC, but "today" is local. Query all 3 UTC-dated prefixes a local
  // day can touch and filter by the real local date parsed from each item's own timestamp,
  // otherwise evening sends get stamped with tomorrow's UTC date and leak into the next
  // local day's count instead of resetting cleanly.
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  const utcDateStrings = [...new Set([-1, 0, 1].map(offset =>
    new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10)
  ))];

  const agents = await awsManager.getUserAgents(userId);
  const agentIds = (agents || []).map(a => a.agentId).filter(Boolean);

  let sentToday = 0;
  let sentTodayByActiveAccount = 0;
  await Promise.all(agentIds.map(async agentId => {
    const responses = await Promise.all(utcDateStrings.map(dateStr =>
      awsQueue.dynamodb.send(new QueryCommand({
        TableName: awsQueue.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `${userId}#${agentId}`,
          ':skPrefix': `SENT#${dateStr}`,
        },
        ProjectionExpression: 'SK, fromAccount',
      })).then(r => r.Items || []).catch(() => [])
    ));
    for (const items of responses) {
      for (const item of items) {
        const ts = String(item.SK).split('#')[1];
        if (ts && new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(ts)) === todayStr) {
          sentToday++;
          if (activeAccount && item.fromAccount === activeAccount.email) sentTodayByActiveAccount++;
        }
      }
    }
  }));

  const user = await awsManager.getUserById(userId);
  const planConfig = awsManager.getPlanConfig(user?.plan || 'free-trial');
  // emailAllowance already bakes in follow-ups (leadAllowance x4); plans without an
  // explicit emailAllowance spend credits 1:1 per email, so initialCredits is the
  // equivalent monthly figure.
  const monthlyEmailAllowance = planConfig.emailAllowance || planConfig.initialCredits || 250;
  const totalCap = Math.max(10, Math.round((monthlyEmailAllowance / 30) / 10) * 10);
  const perAccountCap = PER_ACCOUNT_DAILY_CAP;

  return {
    accounts: connectedAccounts,
    activeAccount,
    sentToday,
    sentTodayByActiveAccount,
    totalCap,
    perAccountCap,
    totalRemaining: Math.max(0, totalCap - sentToday),
    perAccountRemaining: activeAccount ? Math.max(0, perAccountCap - sentTodayByActiveAccount) : null,
    totalCapReached: sentToday >= totalCap,
    perAccountCapReached: !!activeAccount && sentTodayByActiveAccount >= perAccountCap,
  };
}
