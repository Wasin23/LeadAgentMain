import 'dotenv/config';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function checkTable() {
  try {
    const command = new DescribeTableCommand({
      TableName: 'meridian-agent-state'
    });
    
    const result = await client.send(command);
    
    console.log('📋 Table Name:', result.Table.TableName);
    console.log('🔑 Key Schema:', JSON.stringify(result.Table.KeySchema, null, 2));
    console.log('📊 Attribute Definitions:', JSON.stringify(result.Table.AttributeDefinitions, null, 2));
    console.log('✅ Table Status:', result.Table.TableStatus);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTable();
