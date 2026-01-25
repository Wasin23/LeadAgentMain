import 'dotenv/config';
import AWSEmailQueue from './utils/awsEmailQueue.js';

const queue = new AWSEmailQueue();
const userId = '5344c009-768d-4d7f-a399-4704507bf852'; // Dad's account

async function checkOrphanAgentIds() {
  console.log('Checking all queued emails for user:', userId);
  
  try {
    const result = await queue.getAllQueuedEmailsForUser(userId, 200, 0);
    const allQueued = result.emails || result || [];
    console.log('Total queued emails:', allQueued.length);
    
    // Group by agentId
    const byAgentId = {};
    allQueued.forEach(email => {
      const agentId = email.agentId || 'undefined';
      if (!byAgentId[agentId]) byAgentId[agentId] = [];
      byAgentId[agentId].push(email);
    });
    
    console.log('\nEmails grouped by agentId:');
    Object.entries(byAgentId).forEach(([agentId, emails]) => {
      console.log(`  ${agentId}: ${emails.length} emails`);
    });
    
    // Check specifically for 'orphan' agentId
    if (byAgentId['orphan']) {
      console.log('\nFound orphan emails:', byAgentId['orphan'].length);
    } else {
      console.log('\nNo emails with agentId="orphan" found');
    }
    
    // Check for null/undefined
    if (byAgentId['null'] || byAgentId['undefined']) {
      console.log('Found null/undefined agentId emails:', (byAgentId['null']?.length || 0) + (byAgentId['undefined']?.length || 0));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrphanAgentIds();
