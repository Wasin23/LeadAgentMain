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
 */
async function handleMailgunEvent(eventData, userId, agentId) {
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

module.exports = {
  handleMailgunEvent,
  parseMailgunEvent
};
