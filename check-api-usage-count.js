import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(ddbClient);
const apiUsageTable = process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage';

async function checkRecordCount() {
  try {
    console.log(`🔍 Checking record count in ${apiUsageTable}...`);
    
    const command = new ScanCommand({
      TableName: apiUsageTable,
      Select: 'COUNT'
    });

    const result = await dynamodb.send(command);
    
    console.log(`📊 Total records in ${apiUsageTable}: ${result.Count}`);
    console.log(`✅ This is why the GSI is taking a while - it's indexing ${result.Count} records`);
    
  } catch (error) {
    console.error('❌ Error checking record count:', error.message);
  }
}

checkRecordCount();
