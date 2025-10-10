import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

async function createContactedLeadsTable() {
  console.log('🔧 Creating contacted leads DynamoDB table...');
  
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: fromNodeProviderChain()
  });
  
  const tableName = process.env.AWS_DYNAMODB_CONTACTED_LEADS_TABLE || 'examark-contacted-leads';
  
  try {
    // First check if table already exists
    try {
      const describeCommand = new DescribeTableCommand({ TableName: tableName });
      const existingTable = await client.send(describeCommand);
      console.log('✅ Table already exists:', tableName);
      console.log('📊 Table status:', existingTable.Table.TableStatus);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
      console.log('📝 Table does not exist, creating...');
    }
    
    const createCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        {
          AttributeName: 'contactId',
          KeyType: 'HASH' // Partition key
        },
        {
          AttributeName: 'userId', 
          KeyType: 'RANGE' // Sort key
        }
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'contactId',
          AttributeType: 'S'
        },
        {
          AttributeName: 'userId',
          AttributeType: 'S'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
      GlobalSecondaryIndexes: [
        {
          IndexName: 'UserIdIndex',
          KeySchema: [
            {
              AttributeName: 'userId',
              KeyType: 'HASH'
            }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        }
      ],
      Tags: [
        {
          Key: 'Environment',
          Value: 'Production'
        },
        {
          Key: 'Purpose',
          Value: 'ContactedLeadsDeduplication'
        }
      ]
    });
    
    console.log('🚀 Creating table:', tableName);
    const result = await client.send(createCommand);
    
    console.log('✅ Table creation initiated successfully!');
    console.log('📊 Table ARN:', result.TableDescription.TableArn);
    console.log('📊 Table status:', result.TableDescription.TableStatus);
    console.log('⏳ Note: Table may take a few moments to become ACTIVE');
    
    // Wait for table to become active
    console.log('⏳ Waiting for table to become active...');
    let isActive = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (!isActive && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      try {
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        const description = await client.send(describeCommand);
        const status = description.Table.TableStatus;
        
        console.log(`📊 Attempt ${attempts}: Table status is ${status}`);
        
        if (status === 'ACTIVE') {
          isActive = true;
          console.log('✅ Table is now ACTIVE and ready to use!');
        } else if (status === 'CREATING') {
          console.log('⏳ Still creating...');
        } else {
          console.log('⚠️ Unexpected status:', status);
        }
      } catch (error) {
        console.error(`❌ Error checking table status (attempt ${attempts}):`, error.message);
      }
    }
    
    if (!isActive) {
      console.log('⚠️ Table creation may still be in progress. Please check AWS console.');
    }
    
  } catch (error) {
    console.error('❌ Failed to create table:', error);
    throw error;
  }
}

// Run the setup
createContactedLeadsTable().catch(console.error);