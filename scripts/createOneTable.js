import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function createSingleTable() {
  try {
    console.log('🔧 Creating ExaMark Agent Settings table...');
    
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    const tableName = 'examark-agent-settings';
    
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'settingsType', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'settingsType', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    };

    console.log('📋 Creating table with params:', JSON.stringify(params, null, 2));
    
    const createResult = await client.send(new CreateTableCommand(params));
    console.log('✅ Table created successfully!');
    console.log('📊 Table ARN:', createResult.TableDescription.TableArn);
    
    // List tables to confirm
    const listResult = await client.send(new ListTablesCommand({}));
    console.log('📋 All tables:', listResult.TableNames);
    
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️ Table already exists, that\'s okay!');
      
      // List tables anyway
      const client = new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });
      
      const listResult = await client.send(new ListTablesCommand({}));
      console.log('📋 Existing tables:', listResult.TableNames);
    } else {
      console.error('❌ Error creating table:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
    }
  }
}

createSingleTable();