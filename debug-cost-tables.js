// Debug script to check all cost tracking tables
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(client);

const tables = {
  apiUsage: process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage',
  apiUsageSummary: process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary',
  paymentHistory: process.env.AWS_DYNAMODB_PAYMENT_HISTORY_TABLE || 'meridian-payment-history'
};

const TARGET_USER_ID = '5781c511-2307-4fcf-a763-33e8ec64a638'; // colton.aalogin@gmail.com

async function checkTable(tableName, tableKey) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Checking ${tableKey}: ${tableName}`);
  console.log('='.repeat(60));
  
  try {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': TARGET_USER_ID
      }
    });
    
    const { Items } = await dynamodb.send(command);
    
    console.log(`Found ${Items?.length || 0} records for target user`);
    
    if (Items && Items.length > 0) {
      // Calculate total cost
      let totalCost = 0;
      Items.forEach(item => {
        totalCost += item.cost || item.amount || 0;
      });
      
      console.log(`💰 Total cost/amount: $${totalCost.toFixed(2)}`);
      console.log(`\n📋 Sample records (first 3):`);
      Items.slice(0, 3).forEach((item, i) => {
        console.log(`\nRecord ${i + 1}:`);
        console.log(JSON.stringify(item, null, 2));
      });
      
      // Show date range
      if (Items.length > 0 && Items[0].timestamp) {
        const dates = Items.map(i => new Date(i.timestamp)).sort((a, b) => a - b);
        console.log(`\n📅 Date range: ${dates[0].toLocaleDateString()} to ${dates[dates.length - 1].toLocaleDateString()}`);
      }
    } else {
      console.log('❌ No records found for this user');
    }
    
  } catch (error) {
    console.error(`❌ Error scanning ${tableKey}:`, error.message);
  }
}

async function main() {
  console.log('\n🔍 Cost Tracking Tables Debug Script');
  console.log(`Target User: colton.aalogin@gmail.com`);
  console.log(`User ID: ${TARGET_USER_ID}\n`);
  
  for (const [key, tableName] of Object.entries(tables)) {
    await checkTable(tableName, key);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Debug complete');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
