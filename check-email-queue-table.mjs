#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DescribeTableCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.AWS_DYNAMODB_EMAIL_QUEUE_TABLE || 'meridian-email-queue';

const client = new DynamoDBClient({
  region,
  credentials: fromNodeProviderChain()
});

const docClient = DynamoDBDocumentClient.from(client);

async function checkTable() {
  console.log(`📧 Checking EmailQueue table: ${tableName}`);
  console.log(`🌍 Region: ${region}\n`);
  
  try {
    // Describe the table
    const describeCommand = new DescribeTableCommand({ TableName: tableName });
    const tableInfo = await client.send(describeCommand);
    
    console.log('📊 TABLE INFORMATION:');
    console.log('─'.repeat(60));
    console.log(`Table Name: ${tableInfo.Table.TableName}`);
    console.log(`Status: ${tableInfo.Table.TableStatus}`);
    console.log(`Item Count: ${tableInfo.Table.ItemCount}`);
    console.log(`Size: ${(tableInfo.Table.TableSizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Created: ${new Date(tableInfo.Table.CreationDateTime).toLocaleString()}`);
    
    console.log('\n🔑 KEY SCHEMA:');
    console.log('─'.repeat(60));
    tableInfo.Table.KeySchema.forEach(key => {
      const attr = tableInfo.Table.AttributeDefinitions.find(a => a.AttributeName === key.AttributeName);
      console.log(`${key.KeyType === 'HASH' ? '🔸 Partition Key' : '🔹 Sort Key'}: ${key.AttributeName} (${attr.AttributeType})`);
    });
    
    if (tableInfo.Table.GlobalSecondaryIndexes) {
      console.log('\n🌐 GLOBAL SECONDARY INDEXES:');
      console.log('─'.repeat(60));
      tableInfo.Table.GlobalSecondaryIndexes.forEach(gsi => {
        console.log(`\nGSI: ${gsi.IndexName}`);
        console.log(`  Status: ${gsi.IndexStatus}`);
        console.log(`  Item Count: ${gsi.ItemCount}`);
        gsi.KeySchema.forEach(key => {
          const attr = tableInfo.Table.AttributeDefinitions.find(a => a.AttributeName === key.AttributeName);
          console.log(`  ${key.KeyType === 'HASH' ? '🔸 Partition Key' : '🔹 Sort Key'}: ${key.AttributeName} (${attr.AttributeType})`);
        });
      });
    }
    
    if (tableInfo.Table.TimeToLiveDescription) {
      console.log('\n⏰ TIME TO LIVE (TTL):');
      console.log('─'.repeat(60));
      console.log(`Status: ${tableInfo.Table.TimeToLiveDescription.TimeToLiveStatus}`);
      console.log(`Attribute: ${tableInfo.Table.TimeToLiveDescription.AttributeName}`);
    }
    
    console.log('\n💰 BILLING:');
    console.log('─'.repeat(60));
    console.log(`Mode: ${tableInfo.Table.BillingModeSummary?.BillingMode || 'PROVISIONED'}`);
    if (tableInfo.Table.ProvisionedThroughput) {
      console.log(`Read Capacity: ${tableInfo.Table.ProvisionedThroughput.ReadCapacityUnits}`);
      console.log(`Write Capacity: ${tableInfo.Table.ProvisionedThroughput.WriteCapacityUnits}`);
    }
    
    // Sample a few items
    console.log('\n📨 SAMPLE ITEMS (first 5):');
    console.log('─'.repeat(60));
    
    const scanCommand = new ScanCommand({
      TableName: tableName,
      Limit: 5
    });
    
    const scanResult = await client.send(scanCommand);
    
    if (scanResult.Items && scanResult.Items.length > 0) {
      scanResult.Items.forEach((item, index) => {
        console.log(`\n${index + 1}. Item:`);
        console.log(`   PK: ${item.PK?.S || 'N/A'}`);
        console.log(`   SK: ${item.SK?.S || 'N/A'}`);
        console.log(`   Status: ${item.status?.S || 'N/A'}`);
        console.log(`   To: ${item.to?.S || 'N/A'}`);
        console.log(`   Subject: ${item.subject?.S || 'N/A'}`);
        console.log(`   Queued At: ${item.queuedAt?.S || 'N/A'}`);
      });
    } else {
      console.log('   No items found in table (empty)');
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Table check complete!');
    
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    throw error;
  }
}

checkTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
