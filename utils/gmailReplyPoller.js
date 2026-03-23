// Gmail Reply Polling Service
import cron from 'node-cron';
import GmailManager from './gmailManager.js';
import AWSManager from './awsManager.js';

const gmailManager = new GmailManager();
const awsManager = new AWSManager();

// Track processed messages to avoid duplicates
const processedMessageIds = new Set();
const MAX_CACHE_SIZE = 10000;

// Store last check timestamps per user
const lastCheckTimestamps = new Map();

export class GmailReplyPoller {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start polling for Gmail replies every 40 seconds
   * DISABLED: Using Mailgun webhooks instead of Gmail polling
   */
  start() {
    console.log('⏰ [GMAIL POLLER] DISABLED - Using Mailgun webhooks for reply tracking');
    return; // Disabled - no longer polling Gmail
    
    // if (this.isRunning) {
    //   return;
    // }

    // // Run every 40 seconds (*/40 * * * * * would be seconds, but node-cron doesn't support that)
    // // So we'll use setInterval for 40 seconds
    
    // // Run immediately on start
    // this.checkAllUsers();
    
    // // Then run every 40 seconds
    // this.intervalId = setInterval(() => {
    //   this.checkAllUsers();
    // }, 40000); // 40 seconds

    // this.isRunning = true;
  }

  /**
   * Stop the polling service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏰ [GMAIL POLLER] Stopped');
  }

  /**
   * Check all users with connected Gmail accounts
   */
  async checkAllUsers() {
    try {
      console.log('🔍 [GMAIL POLLER] Checking for new replies...');
      
      // Get all users from DynamoDB
      const users = await awsManager.getAllUsersWithGmail();
      
      if (!users || users.length === 0) {
        console.log('📭 [GMAIL POLLER] No users with Gmail configured');
        return;
      }

      console.log(`👥 [GMAIL POLLER] Checking ${users.length} user(s) for replies`);

      // Check each user's Gmail
      for (const user of users) {
        try {
          await this.checkUserReplies(user.userId);
        } catch (error) {
          console.error(`❌ [GMAIL POLLER] Error checking user ${user.userId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ [GMAIL POLLER] Error in checkAllUsers:', error);
    }
  }

  /**
   * Check a specific user's Gmail for new replies
   */
  async checkUserReplies(userId) {
    try {
      // Get last check timestamp for this user
      const afterTimestamp = lastCheckTimestamps.get(userId);
      
      // Check for new messages
      const messages = await gmailManager.checkForReplies(userId, afterTimestamp);
      
      if (messages.length === 0) {
        return;
      }

      console.log(`📬 [GMAIL POLLER] Found ${messages.length} new message(s) for user ${userId}`);

      // Update last check timestamp
      lastCheckTimestamps.set(userId, Date.now());

      // Process each message
      for (const message of messages) {
        // Skip if already processed
        if (processedMessageIds.has(message.id)) {
          continue;
        }

        // Mark as processed
        processedMessageIds.add(message.id);
        
        // Clean up cache if it gets too large
        if (processedMessageIds.size > MAX_CACHE_SIZE) {
          const firstItems = Array.from(processedMessageIds).slice(0, 1000);
          firstItems.forEach(id => processedMessageIds.delete(id));
        }

        // Fetch full message details
        const fullMessage = await gmailManager.getMessage(userId, message.id);
        
        if (fullMessage) {
          const trackingId = gmailManager.extractTrackingId(fullMessage);

          if (trackingId) {
            console.log(`📧 [GMAIL POLLER] Message is a reply to tracked email, processing...`);
            // Process the reply through webhook logic
            await this.processReplyMessage(userId, fullMessage);
          } else {
            console.log(`📭 [GMAIL POLLER] Message is not a reply to tracked email, skipping: ${fullMessage.from}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ [GMAIL POLLER] Error checking replies for user ${userId}:`, error);
    }
  }

  /**
   * Process a reply message through the AI webhook logic
   */
  async processReplyMessage(userId, message) {
    try {
      console.log(`🤖 [GMAIL POLLER] Processing reply from ${message.from}`);

      // Import webhook processing function
      const { processGmailReply } = await import('../routes/webhooks-reply.js');
      
      // Process through webhook logic
      await processGmailReply(userId, message);
      
      console.log(`✅ [GMAIL POLLER] Successfully processed reply from ${message.from}`);
    } catch (error) {
      console.error(`❌ [GMAIL POLLER] Error processing reply:`, error);
    }
  }
}

// Export singleton instance
export const gmailReplyPoller = new GmailReplyPoller();
