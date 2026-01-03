import 'dotenv/config';
import { getAWSEmailQueue } from './utils/awsEmailQueue.js';

const TARGET_USER_ID = '76e84c79-9b13-4c55-be86-d0bd9baa9411';

async function deleteAllEmailsForUser() {
  console.log(`🗑️ Starting email deletion for user: ${TARGET_USER_ID}`);
  console.log('=' .repeat(80));
  
  const awsEmailQueue = getAWSEmailQueue();
  
  try {
    // Get all queued emails for this user (across all agents)
    console.log('\n📧 Fetching all queued emails...');
    const queuedEmails = await awsEmailQueue.getAllQueuedEmailsForUser(TARGET_USER_ID);
    console.log(`   Found ${queuedEmails.length} queued emails`);
    
    // Get all sent emails for this user (across all agents)
    console.log('\n📤 Fetching all sent emails...');
    const sentEmails = await awsEmailQueue.getAllSentEmailsForUser(TARGET_USER_ID);
    console.log(`   Found ${sentEmails.length} sent emails`);
    
    // Get all replied emails for this user (across all agents)
    console.log('\n💬 Fetching all replied emails...');
    const repliedEmails = await awsEmailQueue.getAllRepliedEmailsForUser(TARGET_USER_ID);
    console.log(`   Found ${repliedEmails.length} replied emails`);
    
    const totalEmails = queuedEmails.length + sentEmails.length + repliedEmails.length;
    console.log(`\n📊 Total emails to delete: ${totalEmails}`);
    
    if (totalEmails === 0) {
      console.log('\n✅ No emails found to delete!');
      return;
    }
    
    console.log('\n⚠️  WARNING: This will permanently delete all these emails!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🗑️ Starting deletion...\n');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete queued emails
    if (queuedEmails.length > 0) {
      console.log(`📧 Deleting ${queuedEmails.length} queued emails...`);
      for (const email of queuedEmails) {
        try {
          // Extract agentId from the email data
          const agentId = email.agentId || email.PK.split('#')[1];
          await awsEmailQueue.deleteQueuedEmail(TARGET_USER_ID, agentId, email.id);
          deletedCount++;
          if (deletedCount % 10 === 0) {
            console.log(`   Deleted ${deletedCount}/${totalEmails} emails...`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to delete queued email ${email.id}:`, error.message);
          errorCount++;
        }
        // Small delay to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Delete sent emails - use clearSentEmails for each agent
    if (sentEmails.length > 0) {
      console.log(`\n📤 Deleting ${sentEmails.length} sent emails...`);
      // Group by agentId
      const sentByAgent = {};
      for (const email of sentEmails) {
        const agentId = email.agentId || email.PK.split('#')[1];
        if (!sentByAgent[agentId]) {
          sentByAgent[agentId] = [];
        }
        sentByAgent[agentId].push(email);
      }
      
      // Clear sent emails for each agent
      for (const [agentId, emails] of Object.entries(sentByAgent)) {
        console.log(`   Clearing ${emails.length} sent emails for agent ${agentId}...`);
        try {
          await awsEmailQueue.clearSentEmails(TARGET_USER_ID, agentId);
          deletedCount += emails.length;
          console.log(`   ✅ Cleared ${emails.length} sent emails for agent ${agentId}`);
        } catch (error) {
          console.error(`   ❌ Failed to clear sent emails for agent ${agentId}:`, error.message);
          errorCount += emails.length;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Delete replied emails - use clearRepliedEmails for each agent
    if (repliedEmails.length > 0) {
      console.log(`\n💬 Deleting ${repliedEmails.length} replied emails...`);
      // Group by agentId
      const repliedByAgent = {};
      for (const email of repliedEmails) {
        const agentId = email.agentId || email.PK.split('#')[1];
        if (!repliedByAgent[agentId]) {
          repliedByAgent[agentId] = [];
        }
        repliedByAgent[agentId].push(email);
      }
      
      // Clear replied emails for each agent
      for (const [agentId, emails] of Object.entries(repliedByAgent)) {
        console.log(`   Clearing ${emails.length} replied emails for agent ${agentId}...`);
        try {
          await awsEmailQueue.clearRepliedEmails(TARGET_USER_ID, agentId);
          deletedCount += emails.length;
          console.log(`   ✅ Cleared ${emails.length} replied emails for agent ${agentId}`);
        } catch (error) {
          console.error(`   ❌ Failed to clear replied emails for agent ${agentId}:`, error.message);
          errorCount += emails.length;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ DELETION COMPLETE!');
    console.log(`   Successfully deleted: ${deletedCount} emails`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed to delete: ${errorCount} emails`);
    }
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error during deletion process:', error);
    console.error(error.stack);
  }
}

// Run the deletion
deleteAllEmailsForUser()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
