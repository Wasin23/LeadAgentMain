import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function clearAllAgentData() {
  try {
    console.log('🔍 Scanning agent-settings table for ALL agents...');
    
    // Scan the entire agent-settings table
    const { ScanCommand, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const scanCommand = new ScanCommand({
      TableName: awsManager.tables.agentSettings
    });
    
    const result = await awsManager.dynamodb.send(scanCommand);
    
    console.log(`📊 Found ${result.Items.length} agent settings records:`);
    
    if (result.Items.length === 0) {
      console.log('❌ No agent settings found to delete');
      return;
    }
    
    // Delete each agent settings record
    for (const item of result.Items) {
      console.log(`🗑️ Deleting agent settings: userId=${item.userId}, agentId=${item.agentId}`);
      
      const deleteCommand = new DeleteCommand({
        TableName: awsManager.tables.agentSettings,
        Key: {
          userId: item.userId,
          agentId: item.agentId
        }
      });
      
      await awsManager.dynamodb.send(deleteCommand);
      console.log(`✅ Deleted agent ${item.agentId} settings`);
    }
    
    console.log('🧹 All agent settings cleared from database');
    
  } catch (error) {
    console.error('❌ Error clearing agent data:', error);
  }
}

clearAllAgentData();