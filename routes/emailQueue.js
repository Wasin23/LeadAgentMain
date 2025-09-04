import express from 'express';
import { emailQueue } from '../lib/emailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';

const router = express.Router();

// Get email queue with formatted data (root route)
router.get('/', async (req, res) => {
  try {
    const queue = await emailQueue.getQueue();
    const approved = await emailQueue.getApproved();
    
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
    const queue = await emailQueue.getQueue();
    res.json(queue);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting queue:', error);
    res.status(500).json({ error: 'Failed to get email queue' });
  }
});

// Get queue statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await emailQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// Add custom email to queue
router.post('/custom', async (req, res) => {
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
      leadData: {
        email: to,
        company: 'Custom Email',
        name: to.split('@')[0], // Use email prefix as name
        title: 'Custom Contact',
        context: leadContext || 'Custom email created by user'
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
    const addedEmail = await emailQueue.addToQueue(customEmail);
    
    console.log(`[EMAIL QUEUE] ✏️ Added custom email to queue: ${to} - ${subject}`);
    
    res.json({ 
      success: true, 
      message: 'Custom email added to queue successfully',
      email: addedEmail
    });
    
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error adding custom email:', error);
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
    
    const updatedEmail = await emailQueue.updateEmail(id, updates);
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
    const queue = await emailQueue.getQueue();
    const email = queue.find(e => e.id === id);
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    // Approve the email (moves it from queue to approved)
    const approvedEmail = await emailQueue.approveEmail(id);
    
    // Send the actual email
    const sendResult = await leadEmail(
      approvedEmail.finalRecipient,
      approvedEmail.finalSubject,
      approvedEmail.finalBody
    );
    
    if (sendResult.success) {
      console.log(`[EMAIL QUEUE] ✅ Sent approved email to ${approvedEmail.finalRecipient}`);
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
    
    const rejectedEmail = await emailQueue.rejectEmail(id, reason);
    res.json({ success: true, email: rejectedEmail });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error rejecting email:', error);
    res.status(500).json({ success: false, error: 'Failed to reject email' });
  }
});

// Get approved emails history
router.get('/approved', async (req, res) => {
  try {
    const approved = await emailQueue.getApproved();
    res.json(approved);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting approved emails:', error);
    res.status(500).json({ error: 'Failed to get approved emails' });
  }
});

// Clear rejected emails
router.post('/clear-rejected', async (req, res) => {
  try {
    const result = await emailQueue.clearRejected();
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

export default router;
