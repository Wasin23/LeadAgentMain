import 'dotenv/config';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node get-user-agents.js <userId>');
  process.exit(1);
}

async function getUserAgents() {
  try {
    console.log(`🔍 Finding agents for userId: ${userId}\n`);
    
    const command = new ScanCommand({
      TableName: 'meridian-agent-settings',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId }
      }
    });
    
    const result = await client.send(command);
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No agents found for this user');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} agent(s):\n`);
    
    result.Items.forEach((item, index) => {
      console.log(`🤖 Agent ${index + 1}:`);
      console.log(`   Agent ID: ${item.agentId?.S}`);
      console.log(`   User ID: ${item.userId?.S}`);
      console.log(`   Name: ${item.name?.S || 'Unnamed'}`);
      console.log(`   Created: ${item.createdAt?.S || 'Unknown'}`);
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getUserAgents();
