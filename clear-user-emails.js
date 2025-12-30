import dotenv from 'dotenv';
import { getAWSEmailQueue } from './utils/awsEmailQueue.js';

dotenv.config();

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';

async function clearUserEmails() {
  try {
    console.log(`🗑️ Clearing all emails for user: ${userId}`);
    
    const awsQueue = getAWSEmailQueue();
    
    // Get all emails for this user
    console.log('📧 Fetching all queued emails...');
    const queuedEmails = await awsQueue.getAllQueuedEmailsForUser(userId);
    console.log(`Found ${queuedEmails.length} queued emails`);
    
    console.log('📧 Fetching all sent emails...');
    const sentEmails = await awsQueue.getAllSentEmailsForUser(userId);
    console.log(`Found ${sentEmails.length} sent emails`);
    
    console.log('📧 Fetching all replied emails...');
    const repliedEmails = await awsQueue.getAllRepliedEmailsForUser(userId);
    console.log(`Found ${repliedEmails.length} replied emails`);
    
    // Clear all queued emails
    if (queuedEmails.length > 0) {
      console.log(`\n🗑️ Clearing ${queuedEmails.length} queued emails...`);
      const result = await awsQueue.clearQueuedEmails(userId, null);
      console.log(`✅ Cleared ${result.clearedCount} queued emails`);
    }
    
    // Clear all sent emails
    if (sentEmails.length > 0) {
      console.log(`\n🗑️ Clearing ${sentEmails.length} sent emails...`);
      const result = await awsQueue.clearSentEmails(userId, null);
      console.log(`✅ Cleared ${result.clearedCount} sent emails and ${result.zillizCleared} tracking events`);
    }
    
    // Clear all replied emails
    if (repliedEmails.length > 0) {
      console.log(`\n🗑️ Clearing ${repliedEmails.length} replied emails...`);
      const result = await awsQueue.clearRepliedEmails(userId, null);
      console.log(`✅ Cleared ${result.clearedCount} replied emails`);
    }
    
    console.log('\n✅ All emails cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing emails:', error);
    process.exit(1);
  }
}

clearUserEmails();
