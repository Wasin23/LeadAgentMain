import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ddbClient = new DynamoDBClient({
  region: 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(ddbClient);

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';

console.log(`\n🔍 Checking email queue for user: ${userId}\n`);

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
  
  console.log(`📊 Total items found: ${items.length}\n`);

  // Group by agent
  const byAgent = {};
  const byStatus = {};

  items.forEach(item => {
    const agentId = item.agentId || 'unknown';
    const status = item.status || 'unknown';
    
    if (!byAgent[agentId]) {
      byAgent[agentId] = { QUEUED: 0, APPROVED: 0, SENT: 0, REPLIED: 0, BOUNCED: 0, OTHER: 0 };
    }
    
    if (!byStatus[status]) {
      byStatus[status] = 0;
    }
    
    byAgent[agentId][status] = (byAgent[agentId][status] || 0) + 1;
    byStatus[status]++;
  });

  console.log('📋 Breakdown by Status:');
  Object.keys(byStatus).sort().forEach(status => {
    console.log(`  ${status}: ${byStatus[status]}`);
  });

  console.log('\n📋 Breakdown by Agent:');
  Object.keys(byAgent).sort().forEach(agentId => {
    const counts = byAgent[agentId];
    console.log(`\n  Agent: ${agentId}`);
    console.log(`    QUEUED: ${counts.QUEUED || 0}`);
    console.log(`    APPROVED: ${counts.APPROVED || 0}`);
    console.log(`    SENT: ${counts.SENT || 0}`);
    console.log(`    REPLIED: ${counts.REPLIED || 0}`);
    console.log(`    BOUNCED: ${counts.BOUNCED || 0}`);
    console.log(`    OTHER: ${counts.OTHER || 0}`);
    console.log(`    Total: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  });

  // Show some sample emails
  console.log('\n📧 Sample emails (first 5):');
  items.slice(0, 5).forEach((item, i) => {
    console.log(`\n  ${i + 1}. ID: ${item.id}`);
    console.log(`     To: ${item.to}`);
    console.log(`     Subject: ${item.subject?.substring(0, 50)}...`);
    console.log(`     Status: ${item.status}`);
    console.log(`     AgentId: ${item.agentId}`);
    console.log(`     PK: ${item.PK}`);
    console.log(`     SK: ${item.SK}`);
  });

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
