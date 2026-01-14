// Gmail Pub/Sub Push Notification Webhook
import express from 'express';
import GmailManager from '../utils/gmailManager.js';
import AWSManager from '../utils/awsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const gmailManager = new GmailManager();
const awsManager = new AWSManager();

/**
 * Process a bounce message from Gmail
 */
async function processBounce(userId, agentId, trackingId, recipient, message) {
  try {
    console.log(`⚠️ [GMAIL BOUNCE] Processing bounce for ${recipient}`);
    
    // Log bounce event to tracking
    await awsManager.logEmailTracking(userId, agentId, trackingId, {
      eventType: 'bounced',
      recipientEmail: recipient,
      bounceType: 'gmail',
      reason: 'Gmail bounce notification',
      source: 'gmail-pubsub',
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ [GMAIL BOUNCE] Logged bounce event to tracking for ${trackingId}`);
    
    // Update email status to bounced
    const awsQueue = (await import('../utils/awsEmailQueue.js')).default;
    const queueInstance = new awsQueue();
    
    // Find and update the email - retry a few times in case of race condition
    let updateSuccessful = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!updateSuccessful && attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 [GMAIL BOUNCE] Looking for email, attempt ${attempts}/${maxAttempts}`);
      
      try {
        const sentEmails = await queueInstance.getSentEmails(userId, agentId);
        const email = sentEmails.find(e => e.trackingId === trackingId);
        
        if (email) {
          // Update from current status to BOUNCED
          const currentStatus = email.status || 'SENT';
          const emailId = email.id; // Use the actual email ID, not tracking ID
          console.log(`📧 [GMAIL BOUNCE] Found email ${emailId} with trackingId ${trackingId}`);
          
          await queueInstance.updateEmailStatus(userId, agentId, emailId, currentStatus, 'BOUNCED', {
            bounceType: 'gmail',
            bounceReason: 'Gmail delivery failure',
            bounceSource: 'gmail-pubsub',
            bouncedAt: new Date().toISOString()
          });
          
          console.log(`✅ [GMAIL BOUNCE] Updated email status from ${currentStatus} to BOUNCED for ${emailId}`);
          updateSuccessful = true;
        } else {
          console.log(`⏳ [GMAIL BOUNCE] Email not found yet, waiting 2 seconds...`);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.log(`⚠️ [GMAIL BOUNCE] Update attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log(`⏳ [GMAIL BOUNCE] Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw error;
        }
      }
    }
    
    if (!updateSuccessful) {
      console.warn(`⚠️ [GMAIL BOUNCE] Failed to update email status after ${maxAttempts} attempts for trackingId: ${trackingId}`);
    }
    
    // Also log to issues system
    await awsManager.addIssue(
      userId,
      'warning',
      'Email Bounced',
      `Gmail delivery failed for ${recipient}`,
      {
        agentId: agentId || 'unknown',
        recipient,
        trackingId,
        bounceType: 'gmail',
        source: 'gmail-pubsub',
        timestamp: new Date().toISOString()
      }
    );
    
    console.log(`✅ [GMAIL BOUNCE] Bounce processing complete for ${trackingId}`);
  } catch (error) {
    console.error('❌ [GMAIL BOUNCE] Error processing bounce:', error);
  }
}

/**
 * Receive Gmail push notifications from Google Cloud Pub/Sub
 * This endpoint is called by Google when new emails arrive
 */
router.post('/gmail-notification', async (req, res) => {
  try {
    console.log('📬 [GMAIL PUBSUB] Received notification');
    
    // Acknowledge immediately (Pub/Sub expects quick response)
    res.status(200).send('OK');

    // Parse the Pub/Sub message
    const pubsubMessage = req.body.message;
    if (!pubsubMessage || !pubsubMessage.data) {
      console.log('⚠️ [GMAIL PUBSUB] No message data');
      return;
    }

    // Decode the base64 data
    const decodedData = Buffer.from(pubsubMessage.data, 'base64').toString('utf-8');
    const notification = JSON.parse(decodedData);
    
    console.log('📧 [GMAIL PUBSUB] Notification data:', notification);

    // Extract email address to identify user
    const emailAddress = notification.emailAddress;
    const historyId = notification.historyId;

    console.log(`📧 [GMAIL PUBSUB] Looking for user with Gmail: ${emailAddress}`);

    // Find user by Gmail address
    const users = await awsManager.getAllUsers();
    
    // Check multiple sources for Gmail email
    let matchedUser = null;
    
    for (const u of users) {
      // Check user's main email first
      if (u.email === emailAddress) {
        matchedUser = u;
        console.log(`✅ [GMAIL PUBSUB] Found user by main email: ${u.userId.substring(0, 8)}...`);
        break;
      }
      
      // Need to fetch settings to check gmailAccounts/gmailAuth
      try {
        const settings = await awsManager.getUserSettings(u.userId);
        
        // Check legacy gmailAuth
        if (settings?.gmailAuth?.email === emailAddress) {
          matchedUser = u;
          console.log(`✅ [GMAIL PUBSUB] Found user by gmailAuth: ${u.userId.substring(0, 8)}...`);
          break;
        }
        
        // Check gmailAccounts array
        if (settings?.gmailAccounts && settings.gmailAccounts.some(acc => acc.email === emailAddress)) {
          matchedUser = u;
          console.log(`✅ [GMAIL PUBSUB] Found user by gmailAccounts: ${u.userId.substring(0, 8)}...`);
          break;
        }
      } catch (err) {
        // Skip users with no settings
        continue;
      }
    }

    if (!matchedUser) {
      console.log(`⚠️ [GMAIL PUBSUB] No user found for email: ${emailAddress}`);
      return;
    }
    
    const user = matchedUser;

    console.log(`👤 [GMAIL PUBSUB] Processing notification for user: ${user.userId}`);

    // Get user's last known historyId
    const userSettings = await awsManager.getUserSettings(user.userId);
    const lastHistoryId = userSettings?.gmailWatch?.historyId;

    if (!lastHistoryId) {
      console.log('⚠️ [GMAIL PUBSUB] No lastHistoryId found, skipping');
      return;
    }

    // Get history of changes since last check
    let history;
    try {
      history = await gmailManager.getHistory(user.userId, lastHistoryId);
      console.log(`📜 [GMAIL PUBSUB] Found ${history.length} history items`);
    } catch (error) {
      // If history ID is expired (404), reset to current history ID
      if (error.status === 404 || error.code === 404) {
        console.log('⚠️ [GMAIL PUBSUB] History ID expired, resetting to current...');
        
        // Get current profile to get fresh historyId
        const profile = await gmailManager.getUserProfile(user.userId);
        const currentHistoryId = profile.historyId;
        
        console.log(`🔄 [GMAIL PUBSUB] Reset historyId from ${lastHistoryId} to ${currentHistoryId}`);
        
        // Save the new historyId
        await awsManager.saveUserSettings(user.userId, {
          ...userSettings,
          gmailWatch: {
            ...userSettings.gmailWatch,
            historyId: currentHistoryId
          }
        });
        
        // Skip processing this notification since we can't get history
        return;
      }
      throw error;
    }

    // Update the historyId for next time
    await awsManager.saveUserSettings(user.userId, {
      ...userSettings,
      gmailWatch: {
        ...userSettings.gmailWatch,
        historyId: historyId
      }
    });

    // Process new messages
    for (const historyItem of history) {
      if (historyItem.messagesAdded) {
        for (const msgAdded of historyItem.messagesAdded) {
          const messageId = msgAdded.message.id;
          
          // Fetch full message details
          const fullMessage = await gmailManager.getMessage(user.userId, messageId);
          
          // Check if this is a bounce message
          if (gmailManager.isBounceMessage(fullMessage)) {
            console.log(`⚠️ [GMAIL PUBSUB] Detected bounce message from: ${fullMessage.from}`);
            console.log(`📧 [GMAIL PUBSUB] Bounce subject: ${fullMessage.subject}`);
            
            // Extract tracking ID from bounce
            const trackingId = gmailManager.extractTrackingIdFromBounce(fullMessage);
            const recipient = gmailManager.extractRecipientFromBounce(fullMessage);
            
            if (trackingId) {
              console.log(`📧 [GMAIL PUBSUB] Bounce for tracking ID: ${trackingId}, recipient: ${recipient}`);
              
              // Extract userId and agentId from tracking ID
              const userIdMatch = trackingId.match(/tracking-([a-f0-9-]+)_/);
              const agentIdMatch = trackingId.match(/tracking-[a-f0-9-]+_([^_]+)_/);
              
              const userId = userIdMatch ? userIdMatch[1] : null;
              const agentId = agentIdMatch ? agentIdMatch[1] : null;
              
              if (userId && agentId) {
                // Process bounce
                await processBounce(userId, agentId, trackingId, recipient, fullMessage);
              } else {
                console.log(`⚠️ [GMAIL PUBSUB] Could not extract userId/agentId from tracking ID: ${trackingId}`);
              }
            } else {
              console.log(`⚠️ [GMAIL PUBSUB] Could not extract tracking ID from bounce message`);
            }
            continue;
          }
          
          // Check if this is a reply to one of our tracked emails
          const hasTrackingId = 
            (fullMessage.inReplyTo && fullMessage.inReplyTo.includes('tracking-')) ||
            (fullMessage.references && fullMessage.references.includes('tracking-'));
          
          if (hasTrackingId) {
            console.log(`📧 [GMAIL PUBSUB] Found reply to tracked email from: ${fullMessage.from}`);
            
            // Process through webhook logic
            const { processGmailReply } = await import('./webhooks-reply.js');
            await processGmailReply(user.userId, fullMessage);
          } else {
            console.log(`📭 [GMAIL PUBSUB] Message is not a reply to tracked email: ${fullMessage.from}`);
          }
        }
      }
    }

    console.log('✅ [GMAIL PUBSUB] Notification processed successfully');
  } catch (error) {
    console.error('❌ [GMAIL PUBSUB] Error processing notification:', error);
  }
});

/**
 * Manually set up push notifications for a user
 */
router.post('/setup-watch', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    console.log(`📬 [GMAIL PUBSUB] Manually setting up watch for user: ${userId}`);
    const result = await gmailManager.setupPushNotifications(userId);
    
    res.json({
      success: true,
      message: 'Gmail push notifications enabled',
      ...result
    });
  } catch (error) {
    console.error('❌ [GMAIL PUBSUB] Error setting up watch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check watch status for a user
 */
router.get('/watch-status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    const userSettings = await awsManager.getUserSettings(userId);
    const watch = userSettings?.gmailWatch;
    
    if (!watch) {
      return res.json({
        success: true,
        isActive: false,
        message: 'No watch configured'
      });
    }
    
    const now = Date.now();
    const isExpired = watch.expiration && parseInt(watch.expiration) < now;
    
    res.json({
      success: true,
      isActive: !isExpired,
      watch: {
        historyId: watch.historyId,
        expiration: watch.expiration,
        expirationDate: watch.expiration ? new Date(parseInt(watch.expiration)).toISOString() : null,
        setupAt: watch.setupAt,
        isExpired
      }
    });
  } catch (error) {
    console.error('❌ [GMAIL PUBSUB] Error checking watch status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop push notifications for a user
 */
router.post('/stop-watch', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    await gmailManager.stopPushNotifications(userId);
    
    res.json({
      success: true,
      message: 'Gmail push notifications disabled'
    });
  } catch (error) {
    console.error('❌ [GMAIL PUBSUB] Error stopping watch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test endpoint - manually trigger notification processing
 * Useful for debugging
 */
router.post('/test-notification', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    console.log('🧪 [GMAIL PUBSUB TEST] Manually checking for new messages for user:', userId);
    
    // Get user settings
    const userSettings = await awsManager.getUserSettings(userId);
    const lastHistoryId = userSettings?.gmailWatch?.historyId;
    
    if (!lastHistoryId) {
      return res.json({
        success: false,
        error: 'No watch configured. Run /setup-watch first.',
        hasWatch: false
      });
    }
    
    console.log('🧪 [GMAIL PUBSUB TEST] Last history ID:', lastHistoryId);
    
    // Get history manually
    const history = await gmailManager.getHistory(userId, lastHistoryId);
    console.log(`🧪 [GMAIL PUBSUB TEST] Found ${history.length} history items`);
    
    let bouncesFound = 0;
    let repliesFound = 0;
    let messagesProcessed = 0;
    
    // Process messages
    for (const historyItem of history) {
      if (historyItem.messagesAdded) {
        for (const msgAdded of historyItem.messagesAdded) {
          const messageId = msgAdded.message.id;
          messagesProcessed++;
          
          // Fetch full message details
          const fullMessage = await gmailManager.getMessage(userId, messageId);
          
          console.log('🧪 [GMAIL PUBSUB TEST] Message:', {
            from: fullMessage.from,
            subject: fullMessage.subject?.substring(0, 50),
            isBounce: gmailManager.isBounceMessage(fullMessage)
          });
          
          // Check if this is a bounce message
          if (gmailManager.isBounceMessage(fullMessage)) {
            bouncesFound++;
            console.log(`⚠️ [GMAIL PUBSUB TEST] Found bounce from: ${fullMessage.from}`);
            
            const trackingId = gmailManager.extractTrackingIdFromBounce(fullMessage);
            const recipient = gmailManager.extractRecipientFromBounce(fullMessage);
            
            if (trackingId) {
              console.log(`📧 [GMAIL PUBSUB TEST] Bounce for tracking ID: ${trackingId}`);
              
              // Extract userId and agentId
              const userIdMatch = trackingId.match(/tracking-([a-f0-9-]+)_/);
              const agentIdMatch = trackingId.match(/tracking-[a-f0-9-]+_([^_]+)_/);
              
              const extractedUserId = userIdMatch ? userIdMatch[1] : null;
              const agentId = agentIdMatch ? agentIdMatch[1] : null;
              
              if (extractedUserId && agentId) {
                await processBounce(extractedUserId, agentId, trackingId, recipient, fullMessage);
              }
            }
            continue;
          }
          
          // Check if this is a reply
          const hasTrackingId = 
            (fullMessage.inReplyTo && fullMessage.inReplyTo.includes('tracking-')) ||
            (fullMessage.references && fullMessage.references.includes('tracking-'));
          
          if (hasTrackingId) {
            repliesFound++;
            console.log(`📧 [GMAIL PUBSUB TEST] Found reply from: ${fullMessage.from}`);
          }
        }
      }
    }
    
    res.json({
      success: true,
      historyItems: history.length,
      messagesProcessed,
      bouncesFound,
      repliesFound,
      message: `Processed ${messagesProcessed} messages, found ${bouncesFound} bounces and ${repliesFound} replies`
    });
    
  } catch (error) {
    console.error('❌ [GMAIL PUBSUB TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
