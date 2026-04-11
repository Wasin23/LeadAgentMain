import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import AWSManager from '../utils/awsManager.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const email = process.argv[2];
if (!email) { console.error('Usage: node check-credits.js <email>'); process.exit(1); }

const awsManager = new AWSManager();
const r = await awsManager.dynamodb.send(new ScanCommand({
  TableName: awsManager.tables.users,
  FilterExpression: 'email = :e OR email = :el',
  ExpressionAttributeValues: { ':e': email, ':el': email.toLowerCase() },
}));

const u = r.Items?.[0];
if (!u) { console.error('No user found'); process.exit(1); }

console.log(JSON.stringify({
  userId: u.userId,
  email: u.email,
  plan: u.plan,
  creditBalance: u.creditBalance,
  trialCreditsUsed: u.trialCreditsUsed,
  trialCreditsLimit: u.trialCreditsLimit,
}, null, 2));
process.exit(0);
