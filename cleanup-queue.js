import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ddbClient = new DynamoDBClient({
  region: 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(ddbClient);

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';

console.log(`\n🗑️  CLEANUP: Deleting all queue items for user: ${userId}\n`);

try {
  // Scan for all items belonging to this user
  const response = await dynamodb.send(new ScanCommand({
    TableName: 'meridian-email-queue',
    FilterExpression: 'begins_with(PK, :userId)',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));

  const items = response.Items || [];
  
  console.log(`📊 Found ${items.length} items to delete\n`);

  if (items.length === 0) {
    console.log('✅ Nothing to delete');
    process.exit(0);
  }

  // Show breakdown before deleting
  const byStatus = {};
  items.forEach(item => {
    const status = item.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  console.log('📋 Items to delete:');
  Object.keys(byStatus).sort().forEach(status => {
    console.log(`  ${status}: ${byStatus[status]}`);
  });
  console.log('');

  // Delete in batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  console.log(`🔄 Deleting ${items.length} items in ${batches.length} batches...\n`);

  let deleted = 0;
  for (const batch of batches) {
    const deleteRequests = batch.map(item => ({
      DeleteRequest: {
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }
    }));

    await dynamodb.send(new BatchWriteCommand({
      RequestItems: {
        'meridian-email-queue': deleteRequests
      }
    }));

    deleted += batch.length;
    console.log(`  ✅ Deleted ${deleted}/${items.length}`);
  }

  console.log(`\n✅ Successfully deleted all ${items.length} queue items for user ${userId}`);

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
