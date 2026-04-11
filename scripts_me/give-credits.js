/**
 * give-credits.js
 * ----------------
 * Adds credits to any user by email.
 *
 * Usage:
 *   node give-credits.js --email <email> --credits <amount>
 *
 * Examples:
 *   node give-credits.js --email colton.fidd@gmail.com --credits 3
 *   node give-credits.js --email someone@example.com --credits 250
 *
 * - If the user has a creditBalance (new system) → adds directly to creditBalance.
 * - If the user is on legacy trialCredits → bumps trialCreditsLimit up by the amount
 *   (effectively giving them more headroom without touching trialCreditsUsed).
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import AWSManager from '../utils/awsManager.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const email   = get('--email');
const amount  = parseFloat(get('--credits'));

if (!email || isNaN(amount) || amount <= 0) {
  console.error('Usage: node give-credits.js --email <email> --credits <amount>');
  process.exit(1);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function giveCredits() {
  const awsManager = new AWSManager();

  // Find user by email (case-insensitive)
  console.log(`🔍 Looking up user: ${email}`);
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const scan = await awsManager.dynamodb.send(new ScanCommand({
    TableName: awsManager.tables.users,
    FilterExpression: 'email = :e OR email = :el OR email = :eu',
    ExpressionAttributeValues: {
      ':e':  email,
      ':el': email.toLowerCase(),
      ':eu': email.toUpperCase(),
    },
  }));

  if (!scan.Items?.length) {
    console.error(`❌ No user found with email: ${email}`);
    process.exit(1);
  }

  const user = scan.Items[0];
  const { userId } = user;
  console.log(`✅ Found: ${user.username || user.email} (${userId})`);

  // ── Credit system detection ────────────────────────────────────────────────
  if (user.creditBalance !== undefined) {
    // New system: add directly to creditBalance
    const before = user.creditBalance ?? 0;
    const after  = before + amount;

    await awsManager.updateUser(userId, { creditBalance: after });

    console.log(`💳 creditBalance:  ${before}  →  ${after}  (+${amount})`);
  } else {
    // Legacy system: increase the trialCreditsLimit so they get more headroom
    const planConfig   = awsManager.plans[user.plan || 'free-trial'];
    const before       = user.trialCreditsLimit ?? planConfig?.initialCredits ?? 250;
    const after        = before + amount;
    const used         = user.trialCreditsUsed ?? 0;

    await awsManager.updateUser(userId, { trialCreditsLimit: after, trialEligible: true });

    console.log(`🎫 trialCreditsLimit: ${before}  →  ${after}  (+${amount})`);
    console.log(`   trialEligible    : set to true (unblocked)`);
    console.log(`   trialCreditsUsed : ${used} (unchanged)`);
    console.log(`   Remaining credits: ${(after - used).toFixed(2)}`);
  }

  console.log(`\n✅ Done — ${amount} credit(s) added to ${email}`);
  process.exit(0);
}

giveCredits().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
