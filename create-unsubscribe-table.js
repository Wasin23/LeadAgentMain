import dotenv from 'dotenv';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';

dotenv.config();

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const tableName = process.env.AWS_DYNAMODB_UNSUBSCRIBES_TABLE || 'meridian-unsubscribes';

async function createUnsubscribeTable() {
  try {
    console.log(`📋 Creating DynamoDB table: ${tableName}`);
    
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' }  // Partition key: UNSUBSCRIBE#email@example.com
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand billing
      Tags: [
        { Key: 'Project', Value: 'Meridian' },
        { Key: 'Purpose', Value: 'Email Unsubscribe Management' }
      ]
    });

    const result = await dynamodb.send(command);
    
    console.log('✅ Table created successfully!');
    console.log('📊 Table ARN:', result.TableDescription.TableArn);
    console.log('📅 Creation Time:', result.TableDescription.CreationDateTime);
    console.log('');
    console.log('🎯 Table Structure:');
    console.log('   PK: UNSUBSCRIBE#<email>');
    console.log('   Example: UNSUBSCRIBE#user@example.com');
    console.log('');
    console.log('💡 Usage:');
    console.log('   - Add unsubscribe: Put item with PK="UNSUBSCRIBE#email@example.com"');
    console.log('   - Check unsubscribe: Query with PK="UNSUBSCRIBE#email@example.com"');
    console.log('   - Remove unsubscribe: Delete item with PK="UNSUBSCRIBE#email@example.com"');
    
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️  Table already exists:', tableName);
      console.log('✅ No action needed - table is ready to use');
    } else {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }
}

createUnsubscribeTable()
  .then(() => {
    console.log('');
    console.log('✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
