import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();
const awsManager = new AWSManager();

async function checkAgentIds() {
  try {
    const user = await awsManager.getUserByEmail('colton.fidd@gmail.com');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 User:', user.username);
    console.log('📊 Current agents in AWS:');
    
    if (user.activeAgents && user.activeAgents.length > 0) {
      user.activeAgents.forEach((agent, index) => {
        console.log(`  ${index + 1}. Agent ID: ${agent.agentId} (${typeof agent.agentId})`);
        console.log(`     Name: ${agent.name}`);
        console.log(`     Type: ${agent.type}`);
        console.log(`     Status: ${agent.status}`);
        console.log('');
      });
    } else {
      console.log('  ✅ No agents found - successfully deleted all agents!');
    }
    
    console.log('💾 Total agents count:', user.activeAgents ? user.activeAgents.length : 0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAgentIds();