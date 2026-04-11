/**
 * purge-email-queue.js
 *
 * Deletes every item from meridian-email-queue.
 *
 * Usage:
 *   node scripts_me/purge-email-queue.js --dry-run   # count only
 *   node scripts_me/purge-email-queue.js             # delete everything
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const dryRun = process.argv.includes('--dry-run');
const TABLE  = process.env.AWS_DYNAMODB_EMAIL_QUEUE_TABLE || 'meridian-email-queue';

const client  = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', credentials: fromNodeProviderChain() });
const dynamodb = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

async function main() {
  console.log(`🗑  Purge ${TABLE}`);
  console.log(`   mode: ${dryRun ? 'DRY RUN' : 'LIVE — deleting everything'}\n`);

  // Scan all PKs and SKs (minimal projection)
  const keys = [];
  let lastKey;
  do {
    const r = await client.send(new ScanCommand({
      TableName: TABLE,
      ProjectionExpression: 'PK, SK',
      ExclusiveStartKey: lastKey,
    }));
    for (const item of r.Items || []) {
      keys.push({ PK: item.PK.S, SK: item.SK.S });
    }
    lastKey = r.LastEvaluatedKey;
    process.stdout.write(`\r   Scanned ${keys.length} items...`);
  } while (lastKey);

  console.log(`\n   Found ${keys.length} items total.\n`);

  if (dryRun) {
    console.log('Dry run — no deletes performed.');
    return;
  }

  // BatchWrite in chunks of 25
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    await dynamodb.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: chunk.map(k => ({ DeleteRequest: { Key: k } }))
      }
    }));
    deleted += chunk.length;
    process.stdout.write(`\r   Deleted ${deleted}/${keys.length}...`);
  }

  console.log(`\n\n✅ Done. Deleted ${deleted} items from ${TABLE}.`);
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
