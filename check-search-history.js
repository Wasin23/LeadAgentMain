import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

async function checkSearchHistory() {
  console.log('🔍 Checking search history table...\n');
  
  const awsManager = new AWSManager();
  const userId = process.argv[2];
  const agentId = process.argv[3];
  
  if (!userId || !agentId) {
    console.log('Usage: node check-search-history.js <userId> <agentId>');
    console.log('Example: node check-search-history.js 5781c511-2307-4fcf-a763-33e8ec64a638 513142');
    process.exit(1);
  }
  
  try {
    // Get all search history for this agent
    const PK = `USER#${userId}#AGENT#${agentId}`;
    
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const { fromNodeProviderChain } = await import('@aws-sdk/credential-providers');
    
    const ddbClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: fromNodeProviderChain()
    });
    
    const dynamodb = DynamoDBDocumentClient.from(ddbClient);
    
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.AWS_DYNAMODB_SEARCH_HISTORY_TABLE || 'meridian-search-history',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': PK
      },
      ScanIndexForward: false // Most recent first
    }));
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No search history found for this agent');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} search history entries:\n`);
    
    result.Items.forEach((item, index) => {
      const timestamp = new Date(item.timestamp);
      const daysAgo = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`${index + 1}. ${item.searchKey || item.industry + '#' + item.position}`);
      console.log(`   Leads Found: ${item.leadsFound || 0}`);
      console.log(`   Searched: ${timestamp.toLocaleString()} (${daysAgo} days ago)`);
      if (item.TTL) {
        const ttlDate = new Date(item.TTL * 1000);
        console.log(`   Expires: ${ttlDate.toLocaleString()}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking search history:', error.message);
    process.exit(1);
  }
}

checkSearchHistory();
