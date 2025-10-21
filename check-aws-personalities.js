import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import 'dotenv/config';

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
});
const dynamodb = DynamoDBDocumentClient.from(ddbClient);

async function checkPersonalities() {
  try {
    console.log('🔍 Checking AWS DynamoDB for personality data...\n');
    
    // Check agent-settings table
    const agentSettingsTable = process.env.AWS_DYNAMODB_AGENT_SETTINGS_TABLE || 'meridian-agent-settings';
    console.log(`📊 Scanning ${agentSettingsTable}...`);
    
    const agentSettingsCommand = new ScanCommand({
      TableName: agentSettingsTable,
      Limit: 10
    });
    
    const agentSettingsResult = await dynamodb.send(agentSettingsCommand);
    
    console.log(`\n✅ Found ${agentSettingsResult.Items?.length || 0} agent settings:\n`);
    
    if (agentSettingsResult.Items) {
      agentSettingsResult.Items.forEach((item, index) => {
        console.log(`\n--- Agent ${index + 1} ---`);
        console.log(`Agent ID: ${item.agentId}`);
        console.log(`User ID: ${item.userId}`);
        console.log(`Name: ${item.name || 'N/A'}`);
        console.log(`Status: ${item.status || 'N/A'}`);
        
        if (item.personality) {
          console.log('\n📝 Personality Data:');
          console.log(`  Type: ${item.personality.type}`);
          console.log(`  Name: ${item.personality.name}`);
          console.log(`  Avatar: ${item.personality.avatar}`);
          console.log(`  Color: ${item.personality.color}`);
          console.log(`  Email Style: ${item.personality.emailStyle}`);
          console.log(`  Email Prompt: ${item.personality.emailPrompt?.substring(0, 100)}...`);
          console.log(`  Traits: ${item.personality.traits?.join(', ')}`);
        } else {
          console.log('❌ No personality data found');
        }
        
        if (item.emailBuilder) {
          console.log('\n📧 Email Builder Settings:');
          console.log(`  CC Emails: ${item.emailBuilder.ccEmails || 'None'}`);
          console.log(`  Auto Response: ${item.emailBuilder.enableAutoResponse !== false ? 'Enabled' : 'Disabled'}`);
          console.log(`  Rebump Days: ${item.emailBuilder.rebumpIntervalDays || 'Not set'}`);
        }
      });
    }
    
    // Also check users table
    console.log('\n\n📊 Checking users table for activeAgents...');
    const usersTable = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';
    
    const usersCommand = new ScanCommand({
      TableName: usersTable,
      Limit: 5
    });
    
    const usersResult = await dynamodb.send(usersCommand);
    
    if (usersResult.Items) {
      usersResult.Items.forEach((user) => {
        if (user.activeAgents && user.activeAgents.length > 0) {
          console.log(`\n👤 User: ${user.userId} (${user.username})`);
          console.log(`   Has ${user.activeAgents.length} active agents:`);
          
          user.activeAgents.forEach((agent) => {
            console.log(`\n   🤖 Agent ID: ${agent.agentId}`);
            console.log(`      Name: ${agent.name}`);
            if (agent.personality) {
              console.log(`      Personality: ${agent.personality.name} (${agent.personality.type})`);
              console.log(`      Avatar: ${agent.personality.avatar}`);
            }
          });
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkPersonalities();
