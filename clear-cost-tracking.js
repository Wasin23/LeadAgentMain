// Clear all API usage and cost tracking data by dropping and recreating tables
import 'dotenv/config';
import { DynamoDBClient, DeleteTableCommand, CreateTableCommand, waitUntilTableNotExists } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const region = process.env.AWS_REGION || 'us-east-1';
const dynamoClient = new DynamoDBClient({
  region: region,
  credentials: fromNodeProviderChain()
});

const tables = {
  apiUsage: process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage',
  apiUsageSummary: process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary'
};

async function clearCostTracking() {
  try {
    // Delete API Usage table
    console.log('🗑️  Deleting API usage table...');
    await dynamoClient.send(new DeleteTableCommand({
      TableName: tables.apiUsage
    }));
    
    console.log('⏳ Waiting for API usage table to be deleted...');
    await waitUntilTableNotExists({
      client: dynamoClient,
      maxWaitTime: 60
    }, {
      TableName: tables.apiUsage
    });
    
    // Delete API Usage Summary table
    console.log('🗑️  Deleting API usage summary table...');
    await dynamoClient.send(new DeleteTableCommand({
      TableName: tables.apiUsageSummary
    }));
    
    console.log('⏳ Waiting for API usage summary table to be deleted...');
    await waitUntilTableNotExists({
      client: dynamoClient,
      maxWaitTime: 60
    }, {
      TableName: tables.apiUsageSummary
    });
    
    // Recreate API Usage table
    console.log('🔨 Recreating API usage table...');
    await dynamoClient.send(new CreateTableCommand({
      TableName: tables.apiUsage,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));
    
    // Recreate API Usage Summary table
    console.log('🔨 Recreating API usage summary table...');
    await dynamoClient.send(new CreateTableCommand({
      TableName: tables.apiUsageSummary,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'month', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'month', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));
    
    console.log('✅ Tables dropped and recreated successfully! All cost tracking cleared.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing cost tracking:', error);
    process.exit(1);
  }
}

clearCostTracking();
