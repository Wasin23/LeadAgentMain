/**
 * reconcile-counts.js
 *
 * Fixes two problems caused by DynamoDB throttle events:
 *   1. Counter drift  — rebuilds the userId#COUNTS item from real GSI data
 *   2. Orphaned scheduled jobs — removes entries in meridian-scheduled-email-jobs
 *      that point to emails no longer in QUEUED status (already SENT, REPLIED, or deleted)
 *
 * Usage:
 *   node scripts_me/reconcile-counts.js            # all users
 *   node scripts_me/reconcile-counts.js <userId>   # one user
 *   node scripts_me/reconcile-counts.js --dry-run  # inspect only, no writes
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getAWSEmailQueue } from '../utils/awsEmailQueue.js';
import { getScheduledEmailJobs } from '../utils/scheduledEmailJobs.js';
import AWSManager from '../utils/awsManager.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetUserId = args.find(a => !a.startsWith('--')) || null;

const awsQueue    = getAWSEmailQueue();
const schedJobs   = getScheduledEmailJobs();
const awsManager  = new AWSManager();

// ── helpers ────────────────────────────────────────────────────────────────

function pad(str, len) {
  return String(str).padEnd(len);
}

function sign(n) {
  return n > 0 ? `+${n}` : String(n);
}

async function isStillQueued(userId, agentId, emailId) {
  const resp = await awsQueue.dynamodb.send(new QueryCommand({
    TableName: awsQueue.tableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    FilterExpression: 'id = :emailId',
    ExpressionAttributeValues: {
      ':pk':      awsQueue._getPK(userId, agentId),
      ':prefix':  'QUEUED#',
      ':emailId': emailId,
    },
    Select: 'COUNT',
  }));
  return (resp.Count ?? 0) > 0;
}

// ── per-user reconcile ─────────────────────────────────────────────────────

async function reconcileUser(userId, label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`👤 ${label}  (${userId})`);

  // ── 1. Counter reconcile ────────────────────────────────────────────────
  let before, after;
  try {
    before = await awsQueue.getCountsFromCounters(userId);
  } catch (e) {
    before = { queued: '?', sent: '?', replied: '?' };
  }

  console.log(`\n   COUNTERS`);
  console.log(`   before : queued=${pad(before.queued,5)} sent=${pad(before.sent,5)} replied=${pad(before.replied,5)}`);

  if (!dryRun) {
    after = await awsQueue.reconcileCounters(userId);
    const dq = typeof before.queued  === 'number' ? sign(after.queued  - before.queued)  : '?';
    const ds = typeof before.sent    === 'number' ? sign(after.sent    - before.sent)    : '?';
    const dr = typeof before.replied === 'number' ? sign(after.replied - before.replied) : '?';
    console.log(`   after  : queued=${pad(after.queued,5)} sent=${pad(after.sent,5)} replied=${pad(after.replied,5)}`);
    console.log(`   delta  : queued=${pad(dq,5)} sent=${pad(ds,5)} replied=${pad(dr,5)}`);

    const changed = after.queued !== before.queued || after.sent !== before.sent || after.replied !== before.replied;
    console.log(changed ? `   ⚠️  Counters were drifted — now corrected` : `   ✅ Counters were already accurate`);
  } else {
    console.log(`   (dry-run: skipping counter write)`);
  }

  // ── 2. Orphaned scheduled-jobs cleanup ──────────────────────────────────
  console.log(`\n   SCHEDULED JOBS`);

  let jobs = [];
  try {
    // getScheduledJobsForUser only returns future jobs; pass nowIso='0001' to get ALL
    jobs = await schedJobs.getScheduledJobsForUser(userId, { limit: 500, nowIso: '0001-01-01T00:00:00.000Z' });
  } catch (e) {
    console.log(`   ⚠️  Could not fetch scheduled jobs: ${e.message}`);
    return { before, after: after ?? before, orphaned: 0 };
  }

  console.log(`   found ${jobs.length} scheduled job(s)`);

  let orphaned = 0;
  for (const job of jobs) {
    const stillQueued = await isStillQueued(userId, job.agentId, job.emailId);
    if (!stillQueued) {
      console.log(`   🗑  orphan: emailId=${job.emailId}  agentId=${job.agentId}  scheduledAt=${job.scheduledAt}`);
      if (!dryRun) {
        await schedJobs.deleteScheduledEmail(userId, job.agentId, job.emailId);
      }
      orphaned++;
    }
  }

  if (orphaned === 0) {
    console.log(`   ✅ No orphaned jobs found`);
  } else {
    console.log(`   ${dryRun ? '(dry-run) would remove' : 'removed'} ${orphaned} orphaned job(s)`);
  }

  return { before, after: after ?? before, orphaned };
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧 Meridian Counter + Scheduled-Jobs Reconciler');
  console.log(`   mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (writes enabled)'}`);
  console.log('='.repeat(60));

  let users;
  if (targetUserId) {
    const u = await awsManager.getUserById(targetUserId).catch(() => null);
    users = [{ userId: targetUserId, username: u?.username || u?.email || 'unknown' }];
  } else {
    users = await awsManager.getAllUsers();
    console.log(`\nFound ${users.length} user(s)`);
  }

  let totalOrphaned = 0;
  for (const user of users) {
    const result = await reconcileUser(user.userId, user.username || user.email || 'unknown');
    totalOrphaned += result.orphaned;
    // Throttle between users to avoid bursting GSI read capacity
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Done.  Total orphaned jobs ${dryRun ? 'found' : 'removed'}: ${totalOrphaned}`);
  if (dryRun) console.log('   Re-run without --dry-run to apply fixes.');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
