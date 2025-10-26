/**
 * Setup script for meridian-cycle-logs DynamoDB table
 * Run this once to create the table for tracking agent cycle completions
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain()
});

const tableName = process.env.AWS_DYNAMODB_CYCLE_LOGS_TABLE || 'meridian-cycle-logs';

async function setupCycleLogsTable() {
  try {
    // Check if table already exists
    try {
      const describeCommand = new DescribeTableCommand({ TableName: tableName });
      const existingTable = await client.send(describeCommand);
      console.log(`✅ Table ${tableName} already exists with status:`, existingTable.Table.TableStatus);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
      // Table doesn't exist, continue to create it
    }

    console.log(`📊 Creating DynamoDB table: ${tableName}...`);

    const createCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },  // Partition key
        { AttributeName: 'cycleId', KeyType: 'RANGE' }  // Sort key: timestamp#cycleNumber
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'cycleId', AttributeType: 'S' },
        { AttributeName: 'agentId', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'agentId-cycleId-index',
          KeySchema: [
            { AttributeName: 'agentId', KeyType: 'HASH' },
            { AttributeName: 'cycleId', KeyType: 'RANGE' }
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
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    const result = await client.send(createCommand);
    console.log('✅ Table created successfully!');
    console.log('📋 Table details:');
    console.log('   - Table name:', tableName);
    console.log('   - Partition key: userId (user ID)');
    console.log('   - Sort key: cycleId (timestamp#cycleNumber)');
    console.log('   - GSI: agentId-cycleId-index (for agent-specific queries)');
    console.log('   - Status:', result.TableDescription.TableStatus);
    console.log('\n🎉 Setup complete! The table will be active in a few moments.');
    console.log('\n📝 Data structure:');
    console.log('   {');
    console.log('     userId: string,');
    console.log('     cycleId: string (timestamp#cycleNumber),');
    console.log('     agentId: string,');
    console.log('     cycleNumber: number,');
    console.log('     completedAt: string (ISO timestamp),');
    console.log('     leadsProcessed: number,');
    console.log('     emailsSent: number,');
    console.log('     stepsExecuted: number,');
    console.log('     success: boolean');
    console.log('   }');

  } catch (error) {
    console.error('❌ Error setting up table:', error);
    process.exit(1);
  }
}

setupCycleLogsTable();
