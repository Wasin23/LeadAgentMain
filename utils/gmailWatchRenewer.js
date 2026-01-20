// Gmail Watch Auto-Renewal Service
import cron from 'node-cron';
import GmailManager from './gmailManager.js';
import AWSManager from './awsManager.js';

const gmailManager = new GmailManager();
const awsManager = new AWSManager();

export class GmailWatchRenewer {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start the watch renewal cron job (runs daily)
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ [GMAIL WATCH] Renewal service already running');
      return;
    }

    // Run every day at 3 AM
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      await this.renewExpiredWatches();
    });

    console.log('⏰ [GMAIL WATCH] Auto-renewal service started (runs daily at 3 AM)');
    
    // Also run immediately on startup
    this.renewExpiredWatches();
    
    this.isRunning = true;
  }

  /**
   * Stop the renewal service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('⏰ [GMAIL WATCH] Auto-renewal service stopped');
  }

  /**
   * Check all users and renew watches that are expiring soon
   */
  async renewExpiredWatches() {
    try {
      console.log('🔄 [GMAIL WATCH] Checking for watches that need renewal...');

      const users = await awsManager.getAllUsers();
      let renewedCount = 0;
      let skippedCount = 0;

      for (const user of users) {
        try {
          const userSettings = await awsManager.getUserSettings(user.userId);
          
          // Check if user has Gmail connected and a watch setup
          if (!userSettings?.gmailAuth?.refreshToken || !userSettings?.gmailWatch) {
            skippedCount++;
            continue;
          }

          const watch = userSettings.gmailWatch;
          const expirationTime = parseInt(watch.expiration);
          const now = Date.now();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

          // Renew if expiring within 7 days (Gmail watch lasts ~7 days, we renew early to be safe)
          if (expirationTime - now < sevenDaysMs) {
            console.log(`🔄 [GMAIL WATCH] Renewing watch for user ${user.userId} (expires in ${Math.round((expirationTime - now) / 1000 / 60 / 60)} hours)`);
            
            await gmailManager.setupPushNotifications(user.userId);
            renewedCount++;
            
            console.log(`✅ [GMAIL WATCH] Watch renewed for user ${user.userId}`);
          } else {
            const hoursUntilExpiration = Math.round((expirationTime - now) / 1000 / 60 / 60);
            console.log(`⏳ [GMAIL WATCH] User ${user.userId} watch expires in ${hoursUntilExpiration} hours - no renewal needed`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ [GMAIL WATCH] Error renewing watch for user ${user.userId}:`, error.message);
        }
      }

      // Renewal check complete - silent
    } catch (error) {
      console.error('❌ [GMAIL WATCH] Error in renewal check:', error);
    }
  }

  /**
   * Manually trigger renewal check (useful for testing)
   */
  async triggerRenewal() {
    return await this.renewExpiredWatches();
  }
}

// Export singleton instance
export const gmailWatchRenewer = new GmailWatchRenewer();
