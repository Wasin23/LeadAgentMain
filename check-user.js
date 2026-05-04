/**
 * Check a user's DynamoDB records by email.
 * Usage: node check-user.js coltonfidelman@g.ucla.edu
 */

import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const REGION = process.env.AWS_REGION || 'us-east-1';
const USERS_TABLE = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';
const SETTINGS_TABLE = process.env.AWS_DYNAMODB_USER_SETTINGS_TABLE || 'meridian-user-settings';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: REGION,
  credentials: fromNodeProviderChain(),
}));

const email = process.argv[2];
if (!email) { console.error('Usage: node check-user.js <email>'); process.exit(1); }

console.log(`\nLooking up: ${email}\n`);

// Find user by email
const scan = await client.send(new ScanCommand({
  TableName: USERS_TABLE,
  FilterExpression: 'email = :e',
  ExpressionAttributeValues: { ':e': email },
}));

if (!scan.Items?.length) {
  console.log('❌ No user found with that email.');
  process.exit(0);
}

for (const user of scan.Items) {
  console.log('── USER RECORD ────────────────────────────────────');
  console.log(`userId:      ${user.userId}`);
  console.log(`username:    ${user.username}`);
  console.log(`email:       ${user.email}`);
  console.log(`plan:        ${user.plan}`);
  console.log(`teamId:      ${user.teamId || '(none)'}`);
  console.log(`teamRole:    ${user.teamRole || '(none)'}`);
  console.log(`proxyUserId: ${user.proxyUserId || '(none)'}`);
  console.log(`createdAt:   ${user.createdAt}`);
  console.log(`hasCompletedOnboarding: ${user.hasCompletedOnboarding}`);

  // Fetch settings
  const settings = await client.send(new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { userId: user.userId },
  }));

  const s = settings.Item;
  if (!s) {
    console.log('\n── SETTINGS: (none found)');
  } else {
    const profile = s.companyProfile;
    console.log('\n── SETTINGS ───────────────────────────────────────');
    console.log(`companyProfile exists: ${!!profile}`);
    console.log(`companyName:           ${profile?.companyName || '(empty)'}`);
    console.log(`gmailAccounts:         ${s.gmailAccounts?.length ?? 0} connected`);
    console.log(`gmailAuth exists:      ${!!s.gmailAuth?.refreshToken}`);
  }
  console.log('');
}
