// Gmail Watch Initializer - Sets up watches for existing users on startup
import GmailManager from './gmailManager.js';
import AWSManager from './awsManager.js';

const gmailManager = new GmailManager();
const awsManager = new AWSManager();

/**
 * Initialize Gmail watches for all users who have Gmail connected but no active watch
 * Runs on server startup
 */
export async function initializeGmailWatches() {
  try {
    console.log('📬 [GMAIL WATCH INIT] Checking for users needing watch setup...');
    
    // Get all users
    const users = await awsManager.getAllUsers();
    
    let usersChecked = 0;
    let watchesCreated = 0;
    let alreadyActive = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        const userId = user.userId;
        const userSettings = await awsManager.getUserSettings(userId);
        
        // Check if user has Gmail connected
        const hasGmail = 
          (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) ||
          userSettings?.gmailAuth?.refreshToken;
        
        if (!hasGmail) {
          continue; // Skip users without Gmail
        }
        
        usersChecked++;
        
        // Check if watch exists and is not expired
        const watch = userSettings?.gmailWatch;
        const now = Date.now();
        const isExpired = watch?.expiration ? parseInt(watch.expiration) < now : true;
        
        if (watch && !isExpired) {
          alreadyActive++;
          // Already has active watch - silent
          continue;
        }
        
        // Set up watch
        console.log(`📬 [GMAIL WATCH INIT] Setting up watch for user ${userId.substring(0, 8)}...`);
        await gmailManager.setupPushNotifications(userId);
        watchesCreated++;
        console.log(`✅ [GMAIL WATCH INIT] Watch created for user ${userId.substring(0, 8)}...`);
        
      } catch (userError) {
        errors++;
        const msg = userError.message || '';
        // invalid_grant means the refresh token is permanently dead — clear it so we don't retry every startup
        if (msg.includes('invalid_grant') || userError.response?.data?.error === 'invalid_grant') {
          console.warn(`⚠️  [GMAIL WATCH INIT] Clearing revoked Gmail token for user ${user.userId.substring(0, 8)}...`);
          try {
            const staleSettings = await awsManager.getUserSettings(user.userId);
            if (staleSettings) {
              const cleaned = { ...staleSettings };
              delete cleaned.gmailAuth;
              delete cleaned.gmailWatch;
              if (cleaned.gmailAccounts) cleaned.gmailAccounts = [];
              await awsManager.saveUserSettings(user.userId, cleaned);
            }
          } catch (cleanupErr) {
            console.error(`❌ [GMAIL WATCH INIT] Failed to clear token for ${user.userId.substring(0, 8)}:`, cleanupErr.message);
          }
        } else {
          console.error(`❌ [GMAIL WATCH INIT] Error for user ${user.userId.substring(0, 8)}:`, msg);
        }
      }
    }
    
    // Gmail watch init complete - silent
    
  } catch (error) {
    console.error('❌ [GMAIL WATCH INIT] Fatal error:', error);
  }
}
