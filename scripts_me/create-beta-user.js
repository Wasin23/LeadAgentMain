/**
 * create-beta-user.js
 * --------------------
 * Creates a brand-new account and immediately upgrades it to the Beta Tester plan
 * (Team-tier limits, free — see utils/awsManager.js's 'beta' plan config). Beta isn't
 * offered at signup or in the billing upgrade picker; this script is the only way in.
 *
 * --email is optional — if you don't have a real inbox to give a tester, omit it and one
 * gets generated for you (username@beta.invalid). ".invalid" is a reserved TLD (RFC 2606)
 * that's guaranteed to never resolve, so it's clearly a placeholder rather than a typo'd
 * real domain, and nothing will ever try to actually deliver mail there. Login still works
 * fine by username regardless — the account's email only matters for system emails
 * (password reset, receipts) and anywhere the app assumes user.email looks like an email.
 *
 * Usage:
 *   node create-beta-user.js --username <name> --password <password> [--email <email>]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import AWSManager from '../utils/awsManager.js';
import { registerUser } from '../lib/userManager.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : null; };

const username = get('--username');
const password = get('--password');
let   email    = get('--email');

if (!username || !password) {
  console.error('Usage: node create-beta-user.js --username <name> --password <password> [--email <email>]');
  process.exit(1);
}

if (password.length < 6) {
  console.error('❌ Password must be at least 6 characters (same rule as normal signup).');
  process.exit(1);
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!email) {
  email = `${username}@beta.invalid`;
  console.log(`ℹ️  No --email given, using placeholder: ${email}`);
} else if (!EMAIL_SHAPE.test(email)) {
  console.error(`❌ "${email}" isn't a valid email shape (needs a real-looking x@y.z form).`);
  console.error(`   Nothing validates this at signup, so it would silently save wrong and`);
  console.error(`   break anything downstream that assumes user.email looks like an email.`);
  console.error(`   Omit --email entirely to auto-generate a safe placeholder instead.`);
  process.exit(1);
}

async function main() {
  console.log(`🔧 Creating account: ${username} <${email}>`);
  const created = await registerUser(username, email, password, {
    termsAcceptedAt: new Date().toISOString()
  });
  console.log(`✅ Account created (${created.userId}) — currently on free-trial, upgrading now...`);

  const awsManager = new AWSManager();
  const result = await awsManager.upgradeUserToBeta(created.userId);

  console.log(`\n🚀 Beta account ready`);
  console.log(`   Username: ${username}`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Plan:     beta (Team-tier limits — 6 agents, 2,000 leads/mo, 8,000 emails/mo)`);
  console.log(`   Credits:  ${result.credits}`);
  console.log(`\nHand these credentials to the tester — they can log in immediately.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
