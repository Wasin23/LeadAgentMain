import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function checkAgentSettings() {
  try {
    console.log('🔍 Checking agent-settings table...');
    
    // Scan the entire agent-settings table
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const command = new ScanCommand({
      TableName: awsManager.tables.agentSettings
    });
    
    const result = await awsManager.dynamodb.send(command);
    
    // Also check for specific agent
    console.log('🔍 Checking for specific agent 637243...');
    const specificAgent = await awsManager.getLeadAgentSettings('76e84c79-9b13-4c55-be86-d0bd9baa9411', '637243');
    console.log('Agent 637243 settings:', specificAgent);
    
    console.log(`📊 Found ${result.Items.length} records in agent-settings table:`);
    console.log('');
    
    if (result.Items.length === 0) {
      console.log('❌ No agent settings found in the table');
    } else {
      result.Items.forEach((item, index) => {
        console.log(`--- Record ${index + 1} ---`);
        console.log(`User ID: ${item.userId}`);
        console.log(`Agent ID: ${item.agentId} (type: ${typeof item.agentId})`);
        console.log(`Settings Type: ${item.settingsType}`);
        console.log(`Settings:`, JSON.stringify(item.settings, null, 2));
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking agent settings:', error);
  }
}

checkAgentSettings();