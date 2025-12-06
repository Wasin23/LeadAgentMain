import express from 'express';
import { EmailQueue } from '../lib/emailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

// Apply JWT authentication middleware to all routes
router.use(authenticateToken);

// Helper function to get user-specific and agent-specific email queue
function getUserEmailQueue(userId, agentId = null) {
  return new EmailQueue(userId, agentId);
}

// Get email queue with formatted data (root route)
router.get('/', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Optional agent-specific filtering
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const queue = await userEmailQueue.getQueue();
    const approved = await userEmailQueue.getApproved();
    
    // Format data for frontend
    const pending = queue.filter(e => e.status === 'pending');
    const rejected = queue.filter(e => e.status === 'rejected');
    
    res.json({
      success: true,
      data: {
        pending,
        rejected,
        approved
      }
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting queue data:', error);
    console.error('[EMAIL QUEUE API] Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get email queue data',
      details: error.message
    });
  }
});

// Get all emails in queue
router.get('/queue', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const emails = await awsQueue.getAllQueuedEmailsForUser(req.user.userId);
      return res.json(emails);
    }
    
    // Otherwise, fetch for specific agent (or null for legacy)
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId || null);
    const queue = await userEmailQueue.getQueue();
    res.json(queue);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting queue:', error);
    res.status(500).json({ error: 'Failed to get email queue' });
  }
});

// Get queue statistics
router.get('/stats', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Optional agent-specific filtering
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const stats = await userEmailQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// Add custom email to queue
router.post('/custom', async (req, res) => {
  console.log('[EMAIL QUEUE] 🚀 CUSTOM EMAIL ENDPOINT HIT!');
  console.log('[EMAIL QUEUE] Raw body type:', typeof req.body);
  console.log('[EMAIL QUEUE] Raw body:', req.body);
  console.log('[EMAIL QUEUE] Headers:', req.headers);
  console.log('[EMAIL QUEUE] User from JWT:', req.user);
  try {
    const { to, subject, body, cc, bcc, leadContext, source = 'custom' } = req.body;
    
    // Validation
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: to, subject, body' 
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email address format' 
      });
    }
    
    // Create custom email object (without id and timestamp, let addToQueue handle those)
    const customEmail = {
      status: 'pending',
      source: source,
      userId: req.user.userId, // Add userId from JWT token for proper tracking
      cc: cc || '', // Add CC field
      bcc: bcc || '', // Add BCC field
      leadData: {
        email: to,
        company: 'Custom Email',
        name: to.split('@')[0], // Use email prefix as name
        title: 'Custom Contact',
        context: leadContext || 'Custom email created by user'
      },
      leadDetails: {
        personInfo: {
          fullName: to.split('@')[0], // Use email prefix as name
          currentPosition: 'Custom Contact',
          company: 'Custom Email',
          email: to
        }
      },
      emailData: {
        subject: subject,
        body: body,
        cc: cc || '', // Add CC to emailData as well
        bcc: bcc || '', // Add BCC to emailData as well
        finalRecipient: to,
        finalSubject: subject,
        finalBody: body
      },
      metadata: {
        customEmail: true,
        createdAt: new Date().toISOString(),
        createdBy: 'user'
      }
    };
    
    // Add to queue (this will add id and timestamp)
    console.log(`[EMAIL QUEUE] req.user object:`, req.user);
    console.log(`[EMAIL QUEUE] req.user.userId:`, req.user?.userId);
    console.log(`[EMAIL QUEUE] Creating user queue for userId: ${req.user?.userId}`);
    const agentId = req.body.agentId || null; // Optional agent-specific queue
    const userEmailQueue = getUserEmailQueue(req.user?.userId, agentId);
    console.log(`[EMAIL QUEUE] Adding email to queue (agentId: ${agentId})...`);
    const addedEmail = await userEmailQueue.addToQueue(customEmail);
    console.log(`[EMAIL QUEUE] Email added successfully:`, addedEmail);
    
    console.log(`[EMAIL QUEUE] ✏️ Added custom email to queue: ${to} - ${subject}`);
    
    res.json({ 
      success: true, 
      message: 'Custom email added to queue successfully',
      email: addedEmail
    });
    
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error adding custom email:', error);
    console.error('[EMAIL QUEUE API] Error stack:', error.stack);
    console.error('[EMAIL QUEUE API] Error details:', {
      name: error.name,
      message: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add custom email to queue',
      error: error.message 
    });
  }
});

// Update email content
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const updatedEmail = await userEmailQueue.updateEmail(id, updates);
    res.json(updatedEmail);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error updating email:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// Approve email and send it
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the email from queue first
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const queue = await userEmailQueue.getQueue();
    const email = queue.find(e => e.id === id);
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    // Approve the email (moves it from queue to approved)
    const approvedEmail = await userEmailQueue.approveEmail(id);
    
    // Handle both old format (direct fields) and new format (nested in emailData)
    const emailData = approvedEmail.emailData || {};
    const finalRecipient = emailData.finalRecipient || approvedEmail.finalRecipient;
    const finalSubject = emailData.finalSubject || approvedEmail.finalSubject;
    const finalBody = emailData.finalBody || approvedEmail.finalBody;
    
    // Validate we have all required fields
    if (!finalRecipient || !finalSubject || !finalBody) {
      console.error('[EMAIL QUEUE] Missing email data:', { finalRecipient, finalSubject, finalBody });
      return res.status(400).json({ 
        error: 'Email data incomplete', 
        details: 'Missing recipient, subject, or body'
      });
    }
    
    // Send the actual email with person information
    const personInfo = approvedEmail.leadDetails?.personInfo || null;
    const userId = approvedEmail.userId || null; // Get userId from queue data
    const effectiveAgentId = approvedEmail.agentId || req.body.agentId || null;
    
    // Get CC, BCC emails and sender name from settings
    let ccEmails = approvedEmail.cc || approvedEmail.emailData?.cc || null;
    let bccEmails = approvedEmail.bcc || approvedEmail.emailData?.bcc || null;
    let senderName = null;
    
    // Fetch agent settings for CC, BCC and sender name
    if (userId && effectiveAgentId) {
      try {
        const awsManager = getUserEmailQueue(userId, effectiveAgentId).awsManager;
        if (awsManager) {
          const agentSettings = await awsManager.getLeadAgentSettings(userId, effectiveAgentId);
          if (agentSettings) {
            // Get CC emails if not already set
            if (!ccEmails && agentSettings.emailBuilder && agentSettings.emailBuilder.ccEmails) {
              ccEmails = agentSettings.emailBuilder.ccEmails;
              console.log('[EMAIL QUEUE] Found CC emails in agent settings:', ccEmails);
            }
            // Get BCC emails if not already set
            if (!bccEmails && agentSettings.emailBuilder && agentSettings.emailBuilder.bccEmails) {
              bccEmails = agentSettings.emailBuilder.bccEmails;
              console.log('[EMAIL QUEUE] Found BCC emails in agent settings:', bccEmails);
            }
            // Get sender name for branding
            if (agentSettings.companyName) {
              senderName = agentSettings.companyName;
              console.log('[EMAIL QUEUE] Found sender name in agent settings:', senderName);
            } else if (agentSettings.emailBuilder && agentSettings.emailBuilder.companyName) {
              senderName = agentSettings.emailBuilder.companyName;
              console.log('[EMAIL QUEUE] Found sender name in emailBuilder settings:', senderName);
            }
          }
        }
      } catch (settingsError) {
        console.warn('[EMAIL QUEUE] Could not fetch agent settings:', settingsError.message);
      }
    }
    
    if (ccEmails) {
      console.log('[EMAIL QUEUE] Using CC emails:', ccEmails);
    }
    if (bccEmails) {
      console.log('[EMAIL QUEUE] Using BCC emails:', bccEmails);
    }
    
    console.log('[EMAIL QUEUE] Sending email with data:', {
      finalRecipient,
      finalSubject,
      bodyLength: finalBody?.length,
      personInfo,
      userId,
      ccEmails,
      bccEmails,
      senderName: senderName || 'Default (Meridian)',
      emailType: approvedEmail.metadata?.customEmail ? 'custom' : 'regular'
    });
    
    const sendResult = await leadEmail(
      finalRecipient,
      finalSubject,
      finalBody,
      personInfo,
      userId,
      effectiveAgentId,
      ccEmails, // Pass CC emails to leadEmail
      bccEmails, // Pass BCC emails to leadEmail
      senderName // Pass sender name for branding
    );
    
    if (sendResult.success) {
      console.log(`[EMAIL QUEUE] ✅ Sent approved email to ${finalRecipient}`);
      
      // Mark email as sent in AWS DynamoDB
      if (sendResult.result) {
        try {
          await userEmailQueue.markEmailAsSent(id, {
            id: sendResult.result.mailgunId || sendResult.result.messageId || null,
            message: sendResult.result.messageId || sendResult.result.trackingId,
            trackingId: sendResult.result.trackingId,  // This is the tracking pixel ID
            fromAccount: sendResult.result.fromAccount || null,
            method: sendResult.method || 'mailgun',
            leadName: personInfo?.fullName || personInfo?.name || approvedEmail.leadName || approvedEmail.recipientName,
            subject: finalSubject,
            to: finalRecipient
          });
          console.log(`[EMAIL QUEUE] 💾 Marked email ${id} as sent in AWS with tracking ID ${sendResult.result.trackingId} from ${sendResult.result.fromAccount || 'Mailgun'}`);
        } catch (trackingError) {
          console.error('[EMAIL QUEUE] ⚠️ Failed to mark email as sent in AWS:', trackingError);
        }
      }
      
      res.json({ 
        success: true, 
        email: approvedEmail,
        sendResult: sendResult.result 
      });
    } else {
      console.error(`[EMAIL QUEUE] ❌ Failed to send approved email:`, sendResult.error);
      res.status(500).json({ 
        error: 'Email approved but failed to send', 
        details: sendResult.error,
        email: approvedEmail
      });
    }
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error approving email:', error);
    res.status(500).json({ error: 'Failed to approve email' });
  }
});

// Reject email
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || ''; // Handle undefined body
    
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const rejectedEmail = await userEmailQueue.rejectEmail(id, reason);
    res.json({ success: true, email: rejectedEmail });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error rejecting email:', error);
    res.status(500).json({ success: false, error: 'Failed to reject email' });
  }
});

// Get approved emails history
router.get('/approved', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Optional agent-specific filtering
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const approved = await userEmailQueue.getApproved();
    res.json(approved);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting approved emails:', error);
    res.status(500).json({ error: 'Failed to get approved emails' });
  }
});

// Get sent emails only (emails that have been approved and actually sent)
router.get('/sent', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    console.log(`[EMAIL QUEUE API] Getting sent emails for agentId: ${agentId}, userId: ${req.user.userId}`);
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const emails = await awsQueue.getAllSentEmailsForUser(req.user.userId);
      console.log(`[EMAIL QUEUE API] Found ${emails.length} sent emails for all agents`);
      return res.json(emails);
    }
    
    // For specific agent, use AWS method (includes orphaned emails from deleted agents)
    const emails = await awsQueue.getSentEmails(req.user.userId, agentId);
    console.log(`[EMAIL QUEUE API] Found ${emails.length} sent emails for agent ${agentId}`);
    res.json(emails);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting sent emails:', error);
    res.status(500).json({ error: 'Failed to get sent emails' });
  }
});

// Get replied emails
router.get('/replied', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const emails = await awsQueue.getAllRepliedEmailsForUser(req.user.userId);
      return res.json(emails);
    }
    
    // Otherwise, fetch for specific agent (or null for legacy)
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId || null);
    const replied = await userEmailQueue.getReplied();
    res.json(replied);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting replied emails:', error);
    res.status(500).json({ error: 'Failed to get replied emails' });
  }
});

// Clear rejected emails
router.post('/clear-rejected', async (req, res) => {
  try {
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const result = await userEmailQueue.clearRejected();
    res.json({ 
      success: true, 
      message: 'Rejected emails cleared',
      clearedCount: result.clearedCount
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error clearing rejected emails:', error);
    res.status(500).json({ error: 'Failed to clear rejected emails' });
  }
});

// Delete all approved emails for an agent
router.delete('/approved', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Support agent-specific clearing
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    
    // Clear approved emails by setting to empty array
    const result = await userEmailQueue.clearApproved();
    
    res.json({ 
      success: true, 
      message: 'Approved emails cleared successfully',
      clearedCount: result?.clearedCount || 0
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error clearing approved emails:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear approved emails',
      details: error.message 
    });
  }
});

// Reject/delete a single email from queue
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.query.agentId || req.body.agentId || null;
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    
    await userEmailQueue.rejectEmail(id);
    
    res.json({ 
      success: true, 
      message: 'Email rejected successfully'
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error rejecting email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject email',
      details: error.message 
    });
  }
});

// Clear all sent emails
router.delete('/sent/clear', async (req, res) => {
  try {
    const agentId = req.query.agentId || null;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    const result = await awsQueue.clearSentEmails(req.user.userId, agentId);
    
    res.json({ 
      success: true, 
      message: agentId 
        ? `Cleared ${result.clearedCount} sent emails and ${result.zillizCleared} tracking events for agent`
        : `Cleared ${result.clearedCount} sent emails and ${result.zillizCleared} tracking events for all agents`,
      clearedCount: result.clearedCount,
      zillizCleared: result.zillizCleared
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error clearing sent emails:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear sent emails',
      details: error.message 
    });
  }
});

export default router;
