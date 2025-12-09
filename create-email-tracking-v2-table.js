import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamodb = DynamoDBDocumentClient.from(client);

async function createEmailTrackingV2Table() {
  const tableName = 'meridian-email-tracking-v2';
  
  console.log(`📊 Creating new email tracking table: ${tableName}`);
  
  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },  // Partition key: USER#{userId}#AGENT#{agentId}
      { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key: EVENT#{timestamp}#{eventId}
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'trackingId', AttributeType: 'S' },
      { AttributeName: 'eventType', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TrackingIdIndex',
        KeySchema: [
          { AttributeName: 'trackingId', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'EventTypeIndex',
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'eventType', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };

  try {
    const command = new CreateTableCommand(params);
    const result = await client.send(command);
    
    console.log('✅ Table created successfully!');
    console.log('\n📋 Table Details:');
    console.log('   Name:', tableName);
    console.log('   Status:', result.TableDescription.TableStatus);
    console.log('\n🔑 Key Schema:');
    console.log('   PK: USER#{userId}#AGENT#{agentId} (Partition Key)');
    console.log('   SK: EVENT#{timestamp}#{eventId} (Sort Key)');
    console.log('\n📊 Global Secondary Indexes:');
    console.log('   1. TrackingIdIndex: Query by trackingId');
    console.log('   2. EventTypeIndex: Query by eventType within user/agent');
    console.log('\n⏳ Table is being created. Wait ~30 seconds for it to become ACTIVE.');
    console.log('\n💡 Benefits:');
    console.log('   ✓ Efficient queries by userId + agentId (primary key)');
    console.log('   ✓ Efficient queries by trackingId (GSI)');
    console.log('   ✓ Efficient queries by eventType (GSI)');
    console.log('   ✓ Chronological ordering by timestamp (sort key)');
    console.log('   ✓ No slow table scans needed');
    
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️ Table already exists');
    } else {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }
}

createEmailTrackingV2Table();
