/**
 * One-off script: inspect and clear all QUEUED emails for a specific user.
 * Usage: node clear-email-queue.js
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const TARGET_USER = 'efbb02d8-3a6c-45f9-82f9-a5c21e857913';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE = 'meridian-email-queue';

async function main() {
  // Scan for all items whose PK starts with this userId
  let items = [];
  let lastKey = undefined;

  do {
    const resp = await docClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(PK, :uid)',
      ExpressionAttributeValues: { ':uid': TARGET_USER },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  const queued = items.filter(i => i.SK?.startsWith('QUEUED#'));
  console.log(`\n📋 Total items for user: ${items.length}`);
  console.log(`📥 QUEUED items: ${queued.length}`);

  if (queued.length === 0) {
    console.log('✅ Queue is already empty.');
    return;
  }

  console.log('\nQueued emails:');
  queued.forEach(e => {
    console.log(`  • [${e.id}] ${e.emailData?.finalRecipient || e.to || '?'} | agent: ${e.agentId} | created: ${e.createdAt}`);
  });

  console.log('\n🗑️  Deleting all queued items...');
  for (const item of queued) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: item.PK, SK: item.SK },
    }));
    console.log(`  ✅ Deleted ${item.id}`);
  }
  console.log(`\n🎉 Cleared ${queued.length} queued email(s).`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
