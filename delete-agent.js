import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();
const awsManager = new AWSManager();

async function deleteAgent() {
  try {
    const user = await awsManager.getUserByEmail('colton.fidd@gmail.com');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 User:', user.username);
    console.log('🗑️ Deleting agent 374319...');
    
    // Remove the agent from AWS
    await awsManager.removeAgentFromUser(user.userId, '374319');
    
    console.log('✅ Agent 374319 deleted successfully!');
    
    // Verify deletion
    const updatedUser = await awsManager.getUserById(user.userId);
    console.log('📊 Remaining agents:', updatedUser.activeAgents ? updatedUser.activeAgents.length : 0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

deleteAgent();