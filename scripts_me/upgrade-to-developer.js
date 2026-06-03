/**
 * upgrade-to-developer.js
 * ------------------------
 * Upgrades any user to the Developer plan (999,999 credits, unlimited agents).
 *
 * Usage:
 *   node upgrade-to-developer.js --email <email>
 *   node upgrade-to-developer.js --userId <userId>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import AWSManager from '../utils/awsManager.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : null; };

const email  = get('--email');
const userId = get('--userId');

if (!email && !userId) {
  console.error('Usage: node upgrade-to-developer.js --email <email>');
  console.error('       node upgrade-to-developer.js --userId <userId>');
  process.exit(1);
}

async function main() {
  const awsManager = new AWSManager();
  let targetUserId = userId;

  if (!targetUserId) {
    console.log(`🔍 Looking up user: ${email}`);
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const scan = await awsManager.dynamodb.send(new ScanCommand({
      TableName: awsManager.tables.users,
      FilterExpression: 'email = :e OR email = :el',
      ExpressionAttributeValues: { ':e': email, ':el': email.toLowerCase() },
    }));

    if (!scan.Items?.length) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    const user = scan.Items[0];
    targetUserId = user.userId;
    console.log(`✅ Found: ${user.username || user.email} (${targetUserId}) — currently on "${user.plan || 'free-trial'}" plan`);
  }

  const result = await awsManager.upgradeUserToDeveloper(targetUserId);
  console.log(`\n🚀 Upgraded to Developer plan`);
  console.log(`   Email:   ${result.email || targetUserId}`);
  console.log(`   Credits: 999,999`);
  console.log(`   Agents:  unlimited`);
  console.log(`   Concurrency: unlimited`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
