/**
 * reimburse-credits.js
 *
 * Resets every user's creditBalance to their plan's initialCredits value.
 *
 * Usage:
 *   node scripts_me/reimburse-credits.js --dry-run   # preview only
 *   node scripts_me/reimburse-credits.js             # apply
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
import AWSManager from '../utils/awsManager.js';

const dryRun = process.argv.includes('--dry-run');
const mgr = new AWSManager();

// Users to skip entirely (test/internal accounts)
const SKIP_USER_IDS = new Set([
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', // Test Monitor User
]);

// Force these users to free-trial before reimbursing
const FORCE_FREE_TRIAL = new Set([
  '459e58d2-f249-4586-92c0-4e5590c68bad', // halwendel5672 — never paid for starter
]);

async function main() {
  console.log('💳 Meridian Credit Reimbursement');
  console.log(`   mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (writing)'}\n`);
  console.log('='.repeat(70));

  const users = await mgr.getAllUsers();
  console.log(`Found ${users.length} user(s)\n`);

  let totalGranted = 0;

  for (const user of users) {
    const label = (user.username || user.email || user.userId).padEnd(28);

    if (SKIP_USER_IDS.has(user.userId)) {
      console.log(`⏭️  ${label}  SKIPPED (test/internal account)`);
      continue;
    }

    // Correct plan if needed before calculating credits
    let planId = user.plan || 'free-trial';
    let planNote = '';
    if (FORCE_FREE_TRIAL.has(user.userId) && planId !== 'free-trial') {
      planNote = ` (downgraded from ${planId})`;
      planId = 'free-trial';
    }
    if (planId === 'unlimited') {
      console.log(`⏭️  ${label}  SKIPPED (unlimited plan)`);
      continue;
    }

    const config  = mgr.getPlanConfig(planId);
    const credits = config.initialCredits;
    const before  = user.creditBalance ?? user.trialCreditsLimit ?? 0;
    const delta   = credits - before;

    const tag = delta > 0 ? '⬆️ ' : delta < 0 ? '⬇️ ' : '✅ ';
    console.log(
      `${tag} ${label}` +
      `  plan=${planId.padEnd(12)}` +
      `  before=${String(before).padStart(6)}  →  after=${String(credits).padStart(6)}` +
      `  (${delta >= 0 ? '+' : ''}${delta})${planNote}`
    );

    if (!dryRun) {
      const updates = { creditBalance: credits, trialCreditsUsed: 0, trialCreditsLimit: credits };
      if (FORCE_FREE_TRIAL.has(user.userId)) updates.plan = 'free-trial';
      await mgr.updateUser(user.userId, updates);
    }

    totalGranted += Math.max(0, delta);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`${dryRun ? 'Would grant' : 'Granted'} ${totalGranted} total credits across ${users.length} users.`);
  if (dryRun) console.log('Re-run without --dry-run to apply.');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
