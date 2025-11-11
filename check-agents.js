import 'dotenv/config';
import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function checkAgents() {
  try {
    // Use the actual user ID
    const userId = '1a2eff3d-2856-4da0-91bf-ab626ce3ef72';
    
    console.log(`\n🔍 Checking agents for user ID: ${userId}\n`);
    
    // Get user data
    const userData = await awsManager.getUserById(userId);
    
    if (!userData) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', userData.username || userData.email);
    console.log('   User ID:', userData.userId);
    
    // Check active agents
    const activeAgents = userData.activeAgents || [];
    console.log(`\n📊 Total Active Agents: ${activeAgents.length}\n`);
    
    if (activeAgents.length > 0) {
      console.log('Agents:');
      activeAgents.forEach((agent, index) => {
        console.log(`\n${index + 1}. ${agent.name} (ID: ${agent.agentId})`);
        console.log(`   Status: ${agent.status}`);
        console.log(`   Type: ${agent.type}`);
        console.log(`   Created: ${agent.createdAt || 'Unknown'}`);
        if (agent.personality) {
          console.log(`   Personality: ${agent.personality.name} (${agent.personality.type})`);
        }
      });
    } else {
      console.log('No agents found');
    }
    
  } catch (error) {
    console.error('❌ Error checking agents:', error);
  }
}

checkAgents();
