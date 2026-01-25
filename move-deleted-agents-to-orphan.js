import 'dotenv/config';
import AWSEmailQueue from './utils/awsEmailQueue.js';

const queue = new AWSEmailQueue();
const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
const deletedAgentIds = ['415456', '809678', '898397'];

async function moveToOrphan() {
  console.log('Moving emails from deleted agents to orphan...');
  console.log('Deleted agents:', deletedAgentIds.join(', '));
  
  try {
    const result = await queue.getAllQueuedEmailsForUser(userId, 100, 0);
    const allQueued = result.emails || result || [];
    
    const emailsToMove = allQueued.filter(e => deletedAgentIds.includes(e.agentId));
    console.log(`Found ${emailsToMove.length} emails to move to orphan`);
    
    let success = 0;
    let failed = 0;
    
    for (const email of emailsToMove) {
      try {
        const emailId = email._id || email.id || email.emailId;
        const oldAgentId = email.agentId;
        
        console.log(`Moving email ${emailId} from agent ${oldAgentId} to orphan...`);
        
        await queue.reassignEmailToAgent(userId, oldAgentId, emailId, 'orphan');
        
        success++;
        console.log(`  ✅ Success (${success}/${emailsToMove.length})`);
        
        // Add delay to avoid throughput issues
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        failed++;
        console.error(`  ❌ Failed:`, err.message);
      }
    }
    
    console.log(`\n✅ Successfully moved ${success} emails to orphan`);
    if (failed > 0) {
      console.log(`❌ Failed to move ${failed} emails`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

moveToOrphan();
