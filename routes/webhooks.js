import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Function to verify Mailgun webhook signature
function verifyWebhookSignature(token, timestamp, signature, signingKey) {
  const value = timestamp + token;
  const hash = crypto
    .createHmac('sha256', signingKey)
    .update(value)
    .digest('hex');
  return hash === signature;
}

// Function to save reply to logs
async function saveReplyLog(replyData) {
  try {
    const logPath = path.join(process.cwd(), 'email_replies.json');
    let replies = [];
    
    try {
      const existingData = await fs.readFile(logPath, 'utf8');
      replies = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist yet, start with empty array
      console.log('[REPLY LOGS] Creating new reply log file');
    }
    
    replies.push(replyData);
    await fs.writeFile(logPath, JSON.stringify(replies, null, 2));
    console.log('[REPLY LOGS] Saved reply:', replyData.id);
    
    return true;
  } catch (error) {
    console.error('[REPLY LOGS] Error saving reply:', error);
    return false;
  }
}

// Function to extract tracking ID from email headers or subject
function extractTrackingId(headers, subject, body) {
  // Look for tracking ID in various places
  
  // 1. Check References header (standard email threading)
  const references = headers['References'] || headers['references'];
  if (references) {
    const trackingMatch = references.match(/tracking-([a-f0-9-]+)/);
    if (trackingMatch) return trackingMatch[1];
  }
  
  // 2. Check In-Reply-To header
  const inReplyTo = headers['In-Reply-To'] || headers['in-reply-to'];
  if (inReplyTo) {
    const trackingMatch = inReplyTo.match(/tracking-([a-f0-9-]+)/);
    if (trackingMatch) return trackingMatch[1];
  }
  
  // 3. Check subject line for tracking ID
  if (subject) {
    const trackingMatch = subject.match(/\[#([a-f0-9-]+)\]/);
    if (trackingMatch) return trackingMatch[1];
  }
  
  // 4. Check email body for tracking pixel URL
  if (body) {
    const trackingMatch = body.match(/tracking\/([a-f0-9-]+)/);
    if (trackingMatch) return trackingMatch[1];
  }
  
  return null;
}

// Mailgun webhook endpoint for incoming emails (replies)
router.post('/mailgun/incoming', express.raw({type: 'application/x-www-form-urlencoded'}), async (req, res) => {
  try {
    console.log('[WEBHOOK] Incoming email webhook received');
    
    // Parse the form data
    const body = new URLSearchParams(req.body.toString());
    const formData = Object.fromEntries(body);
    
    // Verify webhook signature if signing key is available
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    if (signingKey) {
      const signature = formData.signature;
      const token = formData.token;
      const timestamp = formData.timestamp;
      
      if (!verifyWebhookSignature(token, timestamp, signature, signingKey)) {
        console.log('[WEBHOOK] Invalid signature');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    // Extract email data
    const emailData = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      from: formData.From || formData.from,
      to: formData.To || formData.to,
      subject: formData.Subject || formData.subject,
      body: formData['body-plain'] || formData['stripped-text'] || '',
      bodyHtml: formData['body-html'] || formData['stripped-html'] || '',
      messageId: formData['Message-Id'] || formData['message-id'],
      references: formData.References || formData.references,
      inReplyTo: formData['In-Reply-To'] || formData['in-reply-to']
    };
    
    console.log('[WEBHOOK] Reply received from:', emailData.from);
    console.log('[WEBHOOK] Subject:', emailData.subject);
    console.log('[WEBHOOK] Body preview:', emailData.body?.substring(0, 100));
    
    // Try to extract tracking ID to link this reply to original email
    const trackingId = extractTrackingId(formData, emailData.subject, emailData.body);
    
    if (trackingId) {
      console.log('[WEBHOOK] Found tracking ID:', trackingId);
      emailData.originalTrackingId = trackingId;
      
      // Update the original email analytics with reply info
      try {
        const { updateEmailAnalytics } = await import('../tools/emailMailgun.js');
        await updateEmailAnalytics(trackingId, {
          replied: true,
          responseContent: emailData.body?.substring(0, 500) || 'Reply received',
          responseDate: emailData.timestamp,
          replyTime: emailData.timestamp,
          replyFrom: emailData.from,
          replySubject: emailData.subject
        });
        console.log('[WEBHOOK] Updated analytics for tracking ID:', trackingId);
      } catch (error) {
        console.error('[WEBHOOK] Failed to update analytics:', error);
      }
    } else {
      console.log('[WEBHOOK] No tracking ID found in reply');
    }
    
    // Save the reply to our logs
    const saved = await saveReplyLog(emailData);
    
    if (saved) {
      console.log('[WEBHOOK] Reply saved successfully');
    } else {
      console.error('[WEBHOOK] Failed to save reply');
    }
    
    // Respond to Mailgun
    res.status(200).json({ 
      success: true, 
      message: 'Email processed',
      trackingId: trackingId || 'none'
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Error processing incoming email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email replies endpoint
router.get('/api/replies', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'email_replies.json');
    
    try {
      const repliesData = await fs.readFile(logPath, 'utf8');
      const replies = JSON.parse(repliesData);
      res.json(replies || []);
    } catch (error) {
      // File doesn't exist yet
      res.json([]);
    }
  } catch (error) {
    console.error('[REPLIES] Error reading replies:', error);
    res.status(500).json({ error: 'Failed to read replies' });
  }
});

// Clear email replies endpoint
router.post('/api/replies/clear', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'email_replies.json');
    await fs.writeFile(logPath, JSON.stringify([], null, 2));
    res.json({ success: true, message: 'Replies cleared' });
  } catch (error) {
    console.error('[REPLIES] Error clearing replies:', error);
    res.status(500).json({ error: 'Failed to clear replies' });
  }
});

export default router;
