// Clear poisoned search history entries
import 'dotenv/config';
import AWSManager from './utils/awsManager.js';

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638'; // coletest123
const agentId = '117289'; // mark

const awsManager = new AWSManager();

console.log(`🗑️ Clearing search history for user ${userId}, agent ${agentId}...`);

try {
  const result = await awsManager.deleteSearchHistory(userId, agentId);
  
  if (result.success) {
    console.log(`✅ Deleted ${result.deletedCount} poisoned search history entries`);
    console.log('🎯 Agent can now search Apollo API without blocks');
  } else {
    console.error('❌ Failed to delete search history:', result.error);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

process.exit(0);
