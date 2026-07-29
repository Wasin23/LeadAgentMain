/**
 * fix-user-email.js
 * ------------------
 * Repairs a user record whose email field isn't actually a valid email shape (e.g. created
 * via create-beta-user.js before it validated/auto-generated one). Nothing at signup
 * validates email format, so a bad value like "beta1" saves silently and breaks anything
 * downstream that assumes user.email looks like an email (system emails, x.split('@')[0]
 * parsing, etc).
 *
 * Usage:
 *   node fix-user-email.js --username <name> --email <new-email>
 *   node fix-user-email.js --username <name>              (auto-generates username@beta.invalid)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import AWSManager from '../utils/awsManager.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : null; };

const username = get('--username');
let   email    = get('--email');

if (!username) {
  console.error('Usage: node fix-user-email.js --username <name> [--email <new-email>]');
  process.exit(1);
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!email) {
  email = `${username}@beta.invalid`;
  console.log(`ℹ️  No --email given, using placeholder: ${email}`);
} else if (!EMAIL_SHAPE.test(email)) {
  console.error(`❌ "${email}" isn't a valid email shape either — pick something like x@y.z.`);
  process.exit(1);
}

async function main() {
  const awsManager = new AWSManager();
  const user = await awsManager.getUserByUsername(username);
  if (!user) {
    console.error(`❌ No user found with username: ${username}`);
    process.exit(1);
  }

  console.log(`Found ${username} (${user.userId}) — current email: "${user.email}"`);
  await awsManager.updateUser(user.userId, { email });
  console.log(`✅ Updated email to: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
