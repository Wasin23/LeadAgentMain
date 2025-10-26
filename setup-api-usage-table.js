import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
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

const docClient = DynamoDBDocumentClient.from(client);

async function createApiUsageTable() {
  const tableName = 'meridian-api-usage';
  
  try {
    // Check if table exists
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`✅ Table ${tableName} already exists`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create table
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },  // Partition key
        { AttributeName: 'timestamp', KeyType: 'RANGE' } // Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
        { AttributeName: 'agentId', AttributeType: 'S' },
        { AttributeName: 'service', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'agentId-timestamp-index',
          KeySchema: [
            { AttributeName: 'agentId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        },
        {
          IndexName: 'service-timestamp-index',
          KeySchema: [
            { AttributeName: 'service', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    await client.send(command);
    console.log(`✅ Created table: ${tableName}`);

    // Wait for table to be active
    console.log('⏳ Waiting for table to be active...');
    let tableActive = false;
    while (!tableActive) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const describeResult = await client.send(new DescribeTableCommand({ TableName: tableName }));
      tableActive = describeResult.Table.TableStatus === 'ACTIVE';
      console.log(`Table status: ${describeResult.Table.TableStatus}`);
    }

    console.log('✅ Table is active and ready to use!');

  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

createApiUsageTable()
  .then(() => {
    console.log('✅ Setup complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
