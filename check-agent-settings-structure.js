import dotenv from 'dotenv';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

dotenv.config();

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function checkAgentSettingsStructure() {
  console.log('🔍 Checking exact structure in agent-settings table...\n');
  
  try {
    // Scan the agent-settings table
    const scanCommand = new ScanCommand({
      TableName: 'meridian-agent-settings'
    });
    
    const result = await dynamodb.send(scanCommand);
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No items found in agent-settings table');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} items in agent-settings\n`);
    
    result.Items.forEach((item, index) => {
      console.log(`\n--- Item ${index + 1} ---`);
      console.log('Full item structure:');
      console.log(JSON.stringify(item, null, 2));
      console.log('\n---\n');
      
      // Check if personality exists at different levels
      console.log('Personality checks:');
      console.log('  item.personality:', item.personality ? '✅ EXISTS' : '❌ NOT FOUND');
      console.log('  item.settings.personality:', item.settings?.personality ? '✅ EXISTS' : '❌ NOT FOUND');
      
      if (item.settings?.personality) {
        console.log('\n  Personality data (from item.settings.personality):');
        console.log('  ', JSON.stringify(item.settings.personality, null, 2));
      }
      
      if (item.personality) {
        console.log('\n  Personality data (from item.personality):');
        console.log('  ', JSON.stringify(item.personality, null, 2));
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAgentSettingsStructure();
