import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ddbClient = new DynamoDBClient({
  region: 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(ddbClient);

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';

console.log(`\n🔍 Checking ORPHAN emails for user: ${userId}\n`);

try {
  // Query for orphan emails specifically
  const pk = `${userId}#orphan`;
  const response = await dynamodb.send(new QueryCommand({
    TableName: 'meridian-email-queue',
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':status': 'QUEUED#'
    }
  }));

  const items = response.Items || [];
  
  console.log(`📊 Found ${items.length} ORPHAN QUEUED emails\n`);

  if (items.length > 0) {
    console.log('Sample orphan emails:');
    items.slice(0, 5).forEach((item, i) => {
      console.log(`\n  ${i + 1}. ID: ${item.id}`);
      console.log(`     To: ${item.to}`);
      console.log(`     Subject: ${item.subject?.substring(0, 50)}...`);
      console.log(`     PK: ${item.PK}`);
      console.log(`     SK: ${item.SK}`);
    });
  }

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
