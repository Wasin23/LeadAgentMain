import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ddbClient = new DynamoDBClient({
  region: 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(ddbClient);

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';

console.log(`\n🗑️  Deleting ORPHAN emails for user: ${userId}\n`);

try {
  // Query for all orphan emails (all statuses)
  const pk = `${userId}#orphan`;
  const response = await dynamodb.send(new QueryCommand({
    TableName: 'meridian-email-queue',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': pk
    }
  }));

  const items = response.Items || [];
  
  console.log(`📊 Found ${items.length} orphan emails to delete\n`);

  if (items.length === 0) {
    console.log('✅ No orphans to delete');
    process.exit(0);
  }

  // Delete in batches of 25
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

  console.log(`\n✅ Successfully deleted all ${items.length} orphan emails`);

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
