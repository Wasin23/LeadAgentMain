import 'dotenv/config';
import AWSEmailQueue from './utils/awsEmailQueue.js';
import AWSManager from './utils/awsManager.js';

const queue = new AWSEmailQueue();
const awsManager = new AWSManager();

const userId = '5344c009-768d-4d7f-a399-4704507bf852';

async function moveEmailsToOrphan() {
  console.log('Moving emails to orphan for user:', userId);
  console.log('(markefidelman@gmail.com)');
  console.log('');

  try {
    // Get all queued emails
    const allQueued = await queue.getAllQueuedEmailsForUser(userId);
    console.log('Total queued emails:', allQueued.length);
    
    // Find emails with deleted agent IDs (954781, 393886)
    const deletedAgentIds = ['954781', '393886'];
    const emailsToMove = allQueued.filter(e => deletedAgentIds.includes(e.agentId));
    
    console.log('Emails to move to orphan:', emailsToMove.length);
    console.log('');
    
    if (emailsToMove.length === 0) {
      console.log('No emails to move!');
      process.exit(0);
      return;
    }
    
    // Move each email to orphan
    let success = 0;
    let failed = 0;
    
    for (const email of emailsToMove) {
      try {
        const emailId = email._id || email.id || email.emailId;
        const oldAgentId = email.agentId;
        
        console.log(`Moving email ${emailId} from agent ${oldAgentId} to orphan...`);
        
        // Use the correct method name
        await queue.reassignEmailToAgent(userId, oldAgentId, emailId, 'orphan');
        
        success++;
        console.log(`  ✅ Success (${success}/${emailsToMove.length})`);
      } catch (err) {
        failed++;
        console.error(`  ❌ Failed:`, err.message);
      }
    }
    
    console.log('');
    console.log('=== COMPLETE ===');
    console.log('Successfully moved:', success);
    console.log('Failed:', failed);
    
    // Verify
    console.log('');
    console.log('=== VERIFICATION ===');
    const orphanedNow = await queue.getQueuedEmails(userId, 'orphan');
    console.log('Orphaned emails now:', orphanedNow.length);

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

moveEmailsToOrphan();
