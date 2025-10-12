import express from 'express';
import { EmailQueue } from '../lib/emailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';
import { authenticateToken } from '../middleware/jwt.js';
import fs from 'fs/promises';

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
    const agentId = req.query.agentId || null; // Optional agent-specific filtering
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
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
    const { to, subject, body, leadContext, source = 'custom' } = req.body;
    
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
    
    console.log('[EMAIL QUEUE] Sending email with data:', {
      finalRecipient,
      finalSubject,
      bodyLength: finalBody?.length,
      personInfo,
      userId,
      emailType: approvedEmail.metadata?.customEmail ? 'custom' : 'regular'
    });
    
    const sendResult = await leadEmail(
      finalRecipient,
      finalSubject,
      finalBody,
      personInfo,
      userId,
      approvedEmail.agentId || req.body.agentId || null // Get agentId from email metadata or request body
    );
    
    if (sendResult.success) {
      console.log(`[EMAIL QUEUE] ✅ Sent approved email to ${finalRecipient}`);
      
      // Save tracking ID to the approved email record for sync purposes
      if (sendResult.result && sendResult.result.trackingId) {
        try {
          const approved = await userEmailQueue.getApproved();
          const emailIndex = approved.findIndex(e => e.id === id);
          if (emailIndex !== -1) {
            approved[emailIndex].trackingId = sendResult.result.trackingId;
            approved[emailIndex].mailgunId = sendResult.result.mailgunId || null;
            approved[emailIndex].sentAt = new Date().toISOString();
            
            // Write back to approved file
            await fs.writeFile(userEmailQueue.approvedFile, JSON.stringify(approved, null, 2));
            console.log(`[EMAIL QUEUE] 💾 Saved tracking ID ${sendResult.result.trackingId} to approved email ${id}`);
          }
        } catch (trackingError) {
          console.error('[EMAIL QUEUE] ⚠️ Failed to save tracking ID:', trackingError);
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

export default router;
