/**
 * Email Bounce Handler
 * Processes Mailgun webhook events for bounces, complaints, and failures
 */

const monitoringStore = require('../routes/monitoring').monitoringStore;

/**
 * Handle Mailgun webhook event
 * @param {object} eventData - Mailgun event data
 * @param {string} userId - User ID extracted from tracking
 * @param {string} agentId - Agent ID extracted from tracking
 * @param {string} trackingId - Tracking ID from email
 */
async function handleMailgunEvent(eventData, userId, agentId, trackingId) {
  const eventType = eventData.event;
  const recipient = eventData.recipient;
  const timestamp = eventData.timestamp;

  console.log(`📧 [BOUNCE HANDLER] Processing ${eventType} event for ${recipient}`);

  switch (eventType) {
    case 'failed':
    case 'bounced':
      // Email bounced - hard or soft bounce
      const severity = eventData.severity === 'permanent' ? 'error' : 'warning';
      const bounceReason = eventData.reason || eventData['delivery-status']?.description || 'Unknown';
      
      if (monitoringStore) {
        monitoringStore.addIssue(
          severity,
          `Email bounced: ${recipient}`,
          agentId || 'unknown',
          {
            userId,
            recipient,
            bounceType: eventData.severity || 'unknown',
            reason: bounceReason,
            code: eventData.code,
            timestamp: new Date(timestamp * 1000).toISOString()
          }
        );
      }

      // Also save to DynamoDB
      if (userId) {
        try {
          const AWSManager = require('./awsManager').default || require('./awsManager');
          const awsManager = new AWSManager();
          await awsManager.addIssue(
            userId,
            severity,
            'Email Bounced',
            `Email bounced for ${recipient}: ${bounceReason}`,
            {
              agentId: agentId || 'unknown',
              recipient,
              bounceType: eventData.severity || 'unknown',
              reason: bounceReason,
              code: eventData.code,
              timestamp: new Date(timestamp * 1000).toISOString()
            }
          );
        } catch (error) {
          console.error('❌ [ISSUES] Failed to log bounce to database:', error);
        }
      }
      
      // Log bounce event to email tracking
      if (userId && agentId && trackingId) {
        try {
          const AWSManager = require('./awsManager').default || require('./awsManager');
          const awsManager = new AWSManager();
          
          // Log bounce event to tracking
          await awsManager.logEmailTracking(userId, agentId, trackingId, {
            eventType: 'bounced',
            recipientEmail: recipient,
            bounceType: eventData.severity || 'unknown',
            reason: bounceReason,
            code: eventData.code,
            timestamp: new Date(timestamp * 1000).toISOString()
          });
          
          console.log(`✅ [BOUNCE] Logged bounce event to tracking for ${trackingId}`);
          
          // Update email status to bounced
          const awsQueue = (await import('./awsEmailQueue.js')).default;
          const queueInstance = new awsQueue();
          
          // Find the email first to get its current status
          const sentEmails = await queueInstance.getSentEmails(userId, agentId);
          const email = sentEmails.find(e => e.trackingId === trackingId);
          
          if (email) {
            // Update from current status to BOUNCED
            const currentStatus = email.status || 'SENT';
            await queueInstance.updateEmailStatus(userId, agentId, trackingId, currentStatus, 'BOUNCED', {
              bounceType: eventData.severity || 'unknown',
              bounceReason: bounceReason,
              bounceCode: eventData.code,
              bouncedAt: new Date(timestamp * 1000).toISOString()
            });
            
            console.log(`✅ [BOUNCE] Updated email status from ${currentStatus} to BOUNCED for ${trackingId}`);
          } else {
            console.warn(`⚠️ [BOUNCE] Email not found in sent emails for trackingId: ${trackingId}`);
          }
        } catch (error) {
          console.error('❌ [BOUNCE] Failed to log bounce to tracking:', error);
        }
      } else {
        console.warn(`⚠️ [BOUNCE] Missing context - cannot update email status. userId: ${userId}, agentId: ${agentId}, trackingId: ${trackingId}`);
      }
      
      console.log(`⚠️ [BOUNCE] ${eventData.severity || 'Unknown'} bounce for ${recipient}: ${bounceReason}`);
      break;

    case 'complained':
      // Recipient marked email as spam
      if (monitoringStore) {
        monitoringStore.addIssue(
          'warning',
          `Email marked as spam: ${recipient}`,
          agentId || 'unknown',
          {
            userId,
            recipient,
            timestamp: new Date(timestamp * 1000).toISOString()
          }
        );
      }

      // Also save to DynamoDB
      if (userId) {
        try {
          const AWSManager = require('./awsManager').default || require('./awsManager');
          const awsManager = new AWSManager();
          await awsManager.addIssue(
            userId,
            'warning',
            'Spam Complaint',
            `Email marked as spam by ${recipient}`,
            {
              agentId: agentId || 'unknown',
              recipient,
              timestamp: new Date(timestamp * 1000).toISOString()
            }
          );
        } catch (error) {
          console.error('❌ [ISSUES] Failed to log spam complaint to database:', error);
        }
      }
      
      console.log(`🚫 [SPAM COMPLAINT] ${recipient} marked email as spam`);
      break;

    case 'unsubscribed':
      // Recipient unsubscribed
      if (monitoringStore) {
        monitoringStore.addIssue(
          'info',
          `Recipient unsubscribed: ${recipient}`,
          agentId || 'unknown',
          {
            userId,
            recipient,
            timestamp: new Date(timestamp * 1000).toISOString()
          }
        );
      }

      // Also save to DynamoDB
      if (userId) {
        try {
          const AWSManager = require('./awsManager').default || require('./awsManager');
          const awsManager = new AWSManager();
          await awsManager.addIssue(
            userId,
            'info',
            'Recipient Unsubscribed',
            `${recipient} unsubscribed from emails`,
            {
              agentId: agentId || 'unknown',
              recipient,
              timestamp: new Date(timestamp * 1000).toISOString()
            }
          );
        } catch (error) {
          console.error('❌ [ISSUES] Failed to log unsubscribe to database:', error);
        }
      }
      
      console.log(`📪 [UNSUBSCRIBE] ${recipient} unsubscribed`);
      break;

    case 'delivered':
      // Email successfully delivered - log as info only if it was previously failing
      console.log(`✅ [DELIVERED] Email successfully delivered to ${recipient}`);
      break;

    case 'opened':
    case 'clicked':
      // Engagement events - don't log as issues
      console.log(`📊 [ENGAGEMENT] ${eventType} event for ${recipient}`);
      break;

    default:
      console.log(`ℹ️ [MAILGUN EVENT] Unhandled event type: ${eventType}`);
  }
}

/**
 * Parse Mailgun event from webhook payload
 * @param {object} formData - Parsed form data from webhook
 * @returns {object} Event data object
 */
function parseMailgunEvent(formData) {
  return {
    event: formData.event,
    recipient: formData.recipient,
    timestamp: parseInt(formData.timestamp) || Math.floor(Date.now() / 1000),
    severity: formData.severity,
    reason: formData.reason,
    code: formData.code,
    'delivery-status': formData['delivery-status'] ? JSON.parse(formData['delivery-status']) : null
  };
}

export {
  handleMailgunEvent,
  parseMailgunEvent
};
