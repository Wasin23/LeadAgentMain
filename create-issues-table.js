import dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const tableName = 'meridian-issues-alerts';

console.log(`🔨 Creating DynamoDB table: ${tableName}...`);

try {
  const command = new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },  // Partition key: USER#userId
      { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key: ISSUE#timestamp#issueId
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'  // On-demand pricing
  });

  const response = await client.send(command);
  
  console.log('✅ Table created successfully!');
  console.log('📋 Table status:', response.TableDescription.TableStatus);
  console.log('📍 Table ARN:', response.TableDescription.TableArn);
  console.log('\n⏳ Table is being created, it may take a minute to become active...');
  
} catch (error) {
  if (error.name === 'ResourceInUseException') {
    console.log('ℹ️ Table already exists!');
  } else {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}
