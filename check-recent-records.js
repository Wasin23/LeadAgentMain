import dotenv from 'dotenv';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

dotenv.config();

async function checkRecentRecords() {
  console.log('\n🔍 Checking most recent records in meridian-api-usage...\n');
  
  try {
    const ddbClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: fromNodeProviderChain()
    });
    
    const dynamodb = DynamoDBDocumentClient.from(ddbClient);
    
    // Scan for most recent records
    const command = new ScanCommand({
      TableName: 'meridian-api-usage',
      Limit: 50
    });
    
    const { Items } = await dynamodb.send(command);
    
    console.log(`📊 Found ${Items?.length || 0} records\n`);
    
    if (Items && Items.length > 0) {
      // Sort by timestamp descending
      const sorted = Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      console.log('🕐 Most recent 10 records:\n');
      sorted.slice(0, 10).forEach(record => {
        const date = new Date(record.timestamp);
        console.log(`${record.timestamp} | ${record.service} | $${record.cost} | ${record.userId.substring(0, 8)}...`);
      });
      
      console.log(`\n📅 Latest timestamp: ${sorted[0].timestamp}`);
      console.log(`📅 Parsed date: ${new Date(sorted[0].timestamp)}`);
      console.log(`📅 Today is: ${new Date()}`);
    } else {
      console.log('❌ NO RECORDS FOUND');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkRecentRecords()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
