import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';

console.log('🔍 Direct DynamoDB query to examark-agent-settings...');
console.log('User ID:', userId);
console.log('');

async function checkTableData() {
  try {
    // First, scan all items to see what's in the table
    console.log('📋 Scanning all items in examark-agent-settings table...');
    const scanResponse = await docClient.send(new ScanCommand({
      TableName: 'examark-agent-settings'
    }));
    
    console.log('Items found:', scanResponse.Items?.length || 0);
    
    if (scanResponse.Items && scanResponse.Items.length > 0) {
      console.log('');
      console.log('📊 All items in table:');
      scanResponse.Items.forEach((item, index) => {
        console.log(`Item ${index + 1}:`);
        console.log('  userId:', item.userId);
        console.log('  companyName:', item.companyBranding?.companyName);
        console.log('  agentName:', item.companyBranding?.agentName);
        console.log('  updatedAt:', item.updatedAt);
        console.log('');
      });
      
      // Try to get specific user settings
      console.log('🎯 Trying to get settings for specific user...');
      const getResponse = await docClient.send(new GetCommand({
        TableName: 'examark-agent-settings',
        Key: {
          userId: userId
        }
      }));
      
      if (getResponse.Item) {
        console.log('✅ Found settings for user!');
        console.log('Company:', getResponse.Item.companyBranding?.companyName);
        console.log('Agent:', getResponse.Item.companyBranding?.agentName);
        console.log('Industries:', getResponse.Item.companyCriteria?.companyIndustries?.length);
        console.log('Positions:', getResponse.Item.contactCriteria?.targetPositions?.length);
      } else {
        console.log('❌ No settings found for this specific user ID');
      }
      
    } else {
      console.log('❌ Table is empty');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error name:', error.name);
  }
}

checkTableData();