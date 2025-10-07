import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const tables = [
  {
    TableName: 'examark-user-settings',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  },
  {
    TableName: 'examark-lead-data',
    KeySchema: [
      { AttributeName: 'leadId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'leadId', AttributeType: 'S' }
    ]
  },
  {
    TableName: 'examark-email-tracking',
    KeySchema: [
      { AttributeName: 'emailId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'emailId', AttributeType: 'S' }
    ]
  },
  {
    TableName: 'examark-agent-state',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  }
];

async function createTables() {
  try {
    // First check existing tables
    const listResponse = await client.send(new ListTablesCommand({}));
    const existingTables = listResponse.TableNames || [];
    
    console.log('📋 Existing tables:', existingTables);
    
    for (const tableConfig of tables) {
      if (existingTables.includes(tableConfig.TableName)) {
        console.log(`⏭️  Skipping ${tableConfig.TableName} - already exists`);
        continue;
      }
      
      console.log(`🔧 Creating table: ${tableConfig.TableName}`);
      
      const command = new CreateTableCommand({
        ...tableConfig,
        BillingMode: 'PAY_PER_REQUEST'
      });
      
      try {
        const response = await client.send(command);
        console.log(`✅ Created ${tableConfig.TableName} successfully`);
      } catch (error) {
        console.error(`❌ Failed to create ${tableConfig.TableName}:`, error.message);
      }
    }
    
    console.log('\n🔍 Final table list:');
    const finalList = await client.send(new ListTablesCommand({}));
    console.log('Tables:', finalList.TableNames);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTables();