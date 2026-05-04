/**
 * Mark a user's onboarding as complete so Google sign-in stops redirecting them.
 * Usage: node fix-user-onboarding.js <email>
 */

import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain(),
}));

const USERS_TABLE = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';

const email = process.argv[2];
if (!email) { console.error('Usage: node fix-user-onboarding.js <email>'); process.exit(1); }

const scan = await client.send(new ScanCommand({
  TableName: USERS_TABLE,
  FilterExpression: 'email = :e',
  ExpressionAttributeValues: { ':e': email },
}));

if (!scan.Items?.length) { console.log('No user found.'); process.exit(1); }

const user = scan.Items[0];
console.log(`Found: ${user.username} (${user.userId})`);

await client.send(new UpdateCommand({
  TableName: USERS_TABLE,
  Key: { userId: user.userId },
  UpdateExpression: 'SET hasCompletedOnboarding = :t',
  ExpressionAttributeValues: { ':t': true },
}));

console.log('✅ hasCompletedOnboarding set to true.');
