import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain()
});

const tableName = process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary';

async function checkTable() {
  try {
    console.log(`🔍 Checking schema for ${tableName}...`);
    
    const command = new DescribeTableCommand({ TableName: tableName });
    const result = await client.send(command);
    
    console.log('\n📋 Key Schema:');
    result.Table.KeySchema.forEach(key => {
      console.log(`  ${key.KeyType}: ${key.AttributeName}`);
    });
    
    console.log('\n📋 Attribute Definitions:');
    result.Table.AttributeDefinitions.forEach(attr => {
      console.log(`  ${attr.AttributeName}: ${attr.AttributeType}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTable();
