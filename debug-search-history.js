// Debug search history table to see what's actually there
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
const agentId = '117289';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(client);
const tableName = 'meridian-search-history';

console.log(`🔍 Debugging search history table: ${tableName}`);
console.log(`👤 User: ${userId}`);
console.log(`🤖 Agent: ${agentId}`);
console.log('');

try {
  // Try Query first (what deleteSearchHistory does)
  const pk = `USER#${userId}#AGENT#${agentId}`;
  console.log(`📋 Query 1: Trying PK = "${pk}"`);
  
  const queryResult = await docClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': pk
    }
  }));
  
  console.log(`✅ Query returned ${queryResult.Items?.length || 0} items`);
  if (queryResult.Items && queryResult.Items.length > 0) {
    console.log('📄 Sample items:');
    queryResult.Items.slice(0, 3).forEach((item, i) => {
      console.log(`  ${i + 1}. PK: ${item.PK}, SK: ${item.SK}, searchKey: ${item.searchKey}, leadsFound: ${item.leadsFound}`);
    });
  }
  console.log('');
  
  // Try full table scan to see ALL entries
  console.log('📋 Scan: Getting ALL entries in table (may be slow)...');
  const scanResult = await docClient.send(new ScanCommand({
    TableName: tableName,
    Limit: 50
  }));
  
  console.log(`✅ Scan returned ${scanResult.Items?.length || 0} total items in table`);
  
  // Filter for this user's entries
  const userEntries = scanResult.Items?.filter(item => 
    item.PK?.includes(userId) || item.PK?.includes(agentId)
  ) || [];
  
  console.log(`👤 Found ${userEntries.length} entries for this user/agent`);
  
  if (userEntries.length > 0) {
    console.log('📄 User entries:');
    userEntries.slice(0, 10).forEach((item, i) => {
      console.log(`  ${i + 1}. PK: ${item.PK}, SK: ${item.SK}, searchKey: ${item.searchKey}, leadsFound: ${item.leadsFound}, daysAgo: ${Math.floor((Date.now() - item.timestamp) / (24 * 60 * 60 * 1000))}`);
    });
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
}
