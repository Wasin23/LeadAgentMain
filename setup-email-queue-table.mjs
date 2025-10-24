#!/usr/bin/env node

/**
 * AWS DynamoDB EmailQueue Table Setup Script
 * 
 * This script creates the EmailQueue table with the following structure:
 * - Table Name: meridian-email-queue
 * - Partition Key (PK): userId#agentId
 * - Sort Key (SK): STATUS#timestamp#emailId  
 * - GSI: UserStatusIndex for querying across all agents
 */

import dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  CreateTableCommand, 
  DescribeTableCommand,
  UpdateTimeToLiveCommand 
} from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.AWS_DYNAMODB_EMAIL_QUEUE_TABLE || 'meridian-email-queue';

const client = new DynamoDBClient({
  region,
  credentials: fromNodeProviderChain()
});

async function createEmailQueueTable() {
  console.log(`📧 Creating EmailQueue table: ${tableName}`);
  console.log(`🌍 Region: ${region}`);
  
  try {
    // Check if table already exists
    try {
      const describeCommand = new DescribeTableCommand({ TableName: tableName });
      const existingTable = await client.send(describeCommand);
      console.log(`✅ Table ${tableName} already exists!`);
      console.log(`   Status: ${existingTable.Table.TableStatus}`);
      console.log(`   Item Count: ${existingTable.Table.ItemCount}`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
      // Table doesn't exist, continue with creation
    }

    // Create the table
    const createTableCommand = new CreateTableCommand({
      TableName: tableName,
      
      // Key Schema
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },  // Partition key: userId#agentId
        { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key: STATUS#timestamp#emailId
      ],
      
      // Attribute Definitions
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSIPK', AttributeType: 'S' },  // GSI partition key
        { AttributeName: 'GSISK', AttributeType: 'S' }   // GSI sort key
      ],
      
      // Global Secondary Index
      GlobalSecondaryIndexes: [
        {
          IndexName: 'UserStatusIndex',
          KeySchema: [
            { AttributeName: 'GSIPK', KeyType: 'HASH' },   // userId#STATUS
            { AttributeName: 'GSISK', KeyType: 'RANGE' }   // timestamp#emailId
          ],
          Projection: {
            ProjectionType: 'ALL'  // Project all attributes
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      
      // Billing Mode - Using provisioned for cost control
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      
      // Tags
      Tags: [
        { Key: 'Project', Value: 'Meridian' },
        { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
        { Key: 'Purpose', Value: 'EmailQueue' }
      ]
    });

    console.log('⏳ Creating table...');
    const createResult = await client.send(createTableCommand);
    console.log(`✅ Table creation initiated!`);
    console.log(`   Table ARN: ${createResult.TableDescription.TableArn}`);
    
    // Wait for table to become active
    console.log('⏳ Waiting for table to become active...');
    let tableActive = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!tableActive && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const describeCommand = new DescribeTableCommand({ TableName: tableName });
      const description = await client.send(describeCommand);
      
      if (description.Table.TableStatus === 'ACTIVE') {
        tableActive = true;
        console.log('✅ Table is now ACTIVE!');
      } else {
        attempts++;
        console.log(`   Status: ${description.Table.TableStatus} (attempt ${attempts}/${maxAttempts})`);
      }
    }
    
    if (!tableActive) {
      console.warn('⚠️ Table creation timed out. It may still be creating. Check AWS console.');
      return;
    }

    // Enable TTL (Time To Live) for automatic cleanup
    console.log('⏳ Enabling TTL for automatic email cleanup after 90 days...');
    const ttlCommand = new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: 'ttl'
      }
    });
    
    await client.send(ttlCommand);
    console.log('✅ TTL enabled on "ttl" attribute');
    
    console.log('\n🎉 EmailQueue table setup complete!');
    console.log('\n📊 Table Details:');
    console.log(`   Table Name: ${tableName}`);
    console.log(`   Partition Key: PK (userId#agentId)`);
    console.log(`   Sort Key: SK (STATUS#timestamp#emailId)`);
    console.log(`   GSI: UserStatusIndex (GSIPK: userId#STATUS, GSISK: timestamp#emailId)`);
    console.log(`   TTL: Enabled (90 days)`);
    console.log(`   Region: ${region}`);
    console.log('\n✅ Ready to use!');
    
  } catch (error) {
    console.error('❌ Error creating EmailQueue table:', error);
    throw error;
  }
}

// Run the script
createEmailQueueTable()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
