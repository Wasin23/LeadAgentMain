// Gmail Pub/Sub Push Notification Webhook
import express from 'express';
import GmailManager from '../utils/gmailManager.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const gmailManager = new GmailManager();
const awsManager = new AWSManager();

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

    // Find user by Gmail address
    const users = await awsManager.getAllUsers();
    const user = users.find(u => 
      u.gmailAuth?.email === emailAddress || 
      u.email === emailAddress
    );

    if (!user) {
      console.log(`⚠️ [GMAIL PUBSUB] No user found for email: ${emailAddress}`);
      return;
    }

    console.log(`👤 [GMAIL PUBSUB] Processing notification for user: ${user.userId}`);

    // Get user's last known historyId
    const userSettings = await awsManager.getUserSettings(user.userId);
    const lastHistoryId = userSettings?.gmailWatch?.historyId;

    if (!lastHistoryId) {
      console.log('⚠️ [GMAIL PUBSUB] No lastHistoryId found, skipping');
      return;
    }

    // Get history of changes since last check
    const history = await gmailManager.getHistory(user.userId, lastHistoryId);
    console.log(`📜 [GMAIL PUBSUB] Found ${history.length} history items`);

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
router.post('/setup-watch', async (req, res) => {
  try {
    const { userId } = req.user;
    
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
 * Stop push notifications for a user
 */
router.post('/stop-watch', async (req, res) => {
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

export default router;
