// Inbound reply detection + tracking (Mailgun webhook + Gmail polling). The AI
// auto-drafted-reply system that used to live here (a LangChain agent with calendar
// tools) was removed — the tool-calling agent was never actually wired up (a comment in
// the old code called it "bypassing broken AgentExecutor"), so no reply was ever
// AI-answered or auto-booked in practice. This file now only detects a genuine lead
// reply, marks the original email REPLIED (suppressing follow-ups), and logs/broadcasts
// the event for the dashboard.
import express from 'express';
import crypto from 'crypto';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();

// Import broadcast function for real-time updates
let broadcastAIResponse = null;
try {
  const outreachModule = await import('./outreach.js');
  broadcastAIResponse = outreachModule.broadcastAIResponse;
  console.log('[WEBHOOK] Outreach broadcast function loaded');
} catch (error) {
  console.log('[WEBHOOK] Outreach broadcast not available (will work when loaded)');
}

// === DEDUPLICATION SYSTEM ===
const processedMessages = new Map(); // Store with timestamps
const MESSAGE_CACHE_SIZE = 1000;

// === UTILITY FUNCTIONS ===

function parseMailgunPayload(body) {
  // Mailgun sends form-encoded data
  const formData = new URLSearchParams(body);
  return Object.fromEntries(formData);
}

function parseMessageHeaders(formData) {
  try {
    const headersArray = JSON.parse(formData['message-headers'] || '[]');
    const headers = {};
    for (const [key, value] of headersArray) {
      headers[key.toLowerCase()] = value;
    }
    return headers;
  } catch (error) {
    console.log('[HEADERS] Failed to parse message headers:', error);
    return {};
  }
}

function extractMessageId(headers, field) {
  const raw = headers[field] || "";
  const match = String(raw).match(/<([^>]+)>/);
  return match ? match[1] : null;
}

function extractUserIdFromTrackingId(trackingId) {
  if (!trackingId) return null;
  // Format: tracking-UUID_AGENTID_TIMESTAMP_HASH
  const match = trackingId.match(/tracking-([a-f0-9-]+)_/);
  return match ? match[1] : null;
}

function extractAgentIdFromTrackingId(trackingId) {
  if (!trackingId) return null;
  // Format: tracking-UUID_AGENTID_TIMESTAMP_HASH
  const match = trackingId.match(/tracking-[a-f0-9-]+_([^_]+)_/);
  return match ? match[1] : null;
}

function isMessageProcessed(messageId) {
  return processedMessages.has(messageId);
}

function markMessageProcessed(messageId) {
  if (messageId) {
    processedMessages.set(messageId, Date.now());
    // Clean up old entries
    if (processedMessages.size > MESSAGE_CACHE_SIZE) {
      const entries = Array.from(processedMessages.entries());
      entries.sort((a, b) => b[1] - a[1]);
      processedMessages.clear();
      entries.slice(0, 500).forEach(([id, time]) => processedMessages.set(id, time));
    }
  }
}

// === MAIN WEBHOOK HANDLER ===

router.post('/mailgun-reply', async (req, res) => {
  console.log('[WEBHOOK] Received Mailgun webhook');
  console.log('[WEBHOOK] Raw body keys:', Object.keys(req.body).slice(0, 10));
  
  try {
    // Parse Mailgun payload
    const formData = parseMailgunPayload(req.body);
    
    // Check if this is a bounce/failure event (not an incoming email)
    if (formData.event && formData.event !== 'stored') {
      console.log(`[WEBHOOK] Handling Mailgun event: ${formData.event}`);
      console.log(`[WEBHOOK] Event data:`, {
        event: formData.event,
        recipient: formData.recipient,
        severity: formData.severity,
        reason: formData.reason,
        code: formData.code,
        timestamp: formData.timestamp,
        variables: formData['X-Mailgun-Variables']
      });
      
      // Import bounce handler
      const { handleMailgunEvent, parseMailgunEvent } = await import('../utils/bounceHandler.js');
      
      // Extract user and agent IDs from tracking
      const trackingId = formData['X-Mailgun-Variables']?.split('tracking_id=')[1]?.split(',')[0];
      const userId = extractUserIdFromTrackingId(trackingId);
      const agentId = extractAgentIdFromTrackingId(trackingId);
      
      console.log(`[WEBHOOK] Bounce event trackingId: ${trackingId}, userId: ${userId}, agentId: ${agentId}`);
      
      // Parse and handle the event
      const eventData = parseMailgunEvent(formData);
      await handleMailgunEvent(eventData, userId, agentId, trackingId);
      
      return res.json({
        success: true,
        message: `Processed ${formData.event} event`,
        event_type: formData.event
      });
    }
    
    // Continue with normal email processing
    const headers = parseMessageHeaders(formData);
    
    // Extract email data
    const inboundMessageId = extractMessageId(headers, 'message-id');
    const inReplyTo = extractMessageId(headers, 'in-reply-to');
    const references = extractMessageId(headers, 'references');
    
    const emailData = {
      from: formData.sender || formData.From,
      to: formData.recipient || formData.To,
      subject: formData.subject || formData.Subject || '',
      body: formData['stripped-text'] || formData['body-plain'] || '',
      messageId: inboundMessageId,
      inReplyTo: inReplyTo,
      references: references
    };
    
    console.log(`[WEBHOOK] Email from: ${emailData.from}`);
    console.log(`[WEBHOOK] Subject: ${emailData.subject}`);
    
    // Deduplication check
    if (isMessageProcessed(inboundMessageId)) {
      console.log('[WEBHOOK] Message already processed, skipping');
      return res.json({ success: true, deduped: true });
    }
    
    markMessageProcessed(inboundMessageId);
    
    // Extract or determine tracking ID
    let trackingId = null;
    
    // First, try to extract from Mailgun custom variables
    if (formData['X-Mailgun-Variables']) {
      const vars = formData['X-Mailgun-Variables'];
      const trackingMatch = vars.match(/tracking_id[=:]([^,}\s]+)/);
      if (trackingMatch) {
        trackingId = trackingMatch[1];
        console.log(`[WEBHOOK] Found tracking ID in X-Mailgun-Variables: ${trackingId}`);
      }
    }
    
    // Try custom X-Meridian-Tracking-Id header
    if (!trackingId && headers['x-meridian-tracking-id']) {
      trackingId = headers['x-meridian-tracking-id'];
      console.log(`[WEBHOOK] Found tracking ID in X-Meridian-Tracking-Id header: ${trackingId}`);
    }
    
    // Try to extract from In-Reply-To or References
    // Format: <tracking-UUID_AGENTID_TIMESTAMP_HASH@domain>
    if (!trackingId && inReplyTo && inReplyTo.includes('tracking-')) {
      const match = inReplyTo.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/);
      if (match) trackingId = match[1];
      console.log(`[WEBHOOK] Found tracking ID in In-Reply-To: ${trackingId}`);
    }
    
    if (!trackingId && references && references.includes('tracking-')) {
      const match = references.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/);
      if (match) trackingId = match[1];
      console.log(`[WEBHOOK] Found tracking ID in References: ${trackingId}`);
    }
    
    console.log(`[WEBHOOK] Using tracking ID: ${trackingId || 'NOT FOUND'}`);
    
    // Extract userId and agentId
    let userId = extractUserIdFromTrackingId(trackingId);
    let agentId = extractAgentIdFromTrackingId(trackingId);
    
    // If no tracking ID found, we cannot process this reply
    if (!trackingId || !userId || !agentId) {
      console.error(`[WEBHOOK] ❌ Cannot process reply - missing tracking context. trackingId: ${trackingId}, userId: ${userId}, agentId: ${agentId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot determine conversation context - no tracking ID found',
        details: {
          hasInReplyTo: !!inReplyTo,
          hasReferences: !!references,
          hasMailgunVars: !!formData['X-Mailgun-Variables'],
          from: emailData.from
        }
      });
    }

    // Restart-proof dedup: check DynamoDB for an existing event with this exact messageId
    if (inboundMessageId) {
      try {
        const existingEvents = await awsManager.getEmailTrackingByTracking(trackingId);
        const alreadyStored = existingEvents.some(e => e.messageId === inboundMessageId);
        if (alreadyStored) {
          console.log('[WEBHOOK] Message already stored in DB, skipping (restart-proof dedup)');
          return res.json({ success: true, deduped: true });
        }
      } catch (dedupErr) {
        console.warn('[WEBHOOK] DB dedup check failed, continuing:', dedupErr.message);
      }
    }
    
    // Get original email metadata for enrichment and mark email as REPLIED
    let leadName = null;
    let originalSubject = null;
    try {
      const awsQueue = (await import('../utils/awsEmailQueue.js')).default;
      const queueInstance = new awsQueue();
      const sentEmails = await queueInstance.getSentEmails(userId, agentId);
      const emailData_original = sentEmails.find(e => e.trackingId === trackingId);
      if (emailData_original) {
        leadName = emailData_original.leadName || 
                   emailData_original.personInfo?.fullName || 
                   emailData_original.personInfo?.name || 
                   (emailData.from ? emailData.from.split('@')[0] : null);
        originalSubject = emailData_original.subject || emailData_original.emailSubject;
        console.log(`[WEBHOOK] Enriched reply metadata: leadName=${leadName}, subject=${originalSubject}`);

        // Mark email status as REPLIED so rebumpChecker skips all follow-ups for this lead
        const emailId = emailData_original.id;
        if (emailId && emailData_original.status !== 'REPLIED') {
          try {
            await queueInstance.markEmailAsReplied(userId, agentId, emailId, {
              from: emailData.from,
              subject: emailData.subject,
              body: emailData.body?.substring(0, 500)
            });
            console.log(`✅ [WEBHOOK] Marked email ${emailId} as REPLIED — follow-ups will be suppressed`);
          } catch (markErr) {
            console.error(`❌ [WEBHOOK] Failed to mark email as REPLIED:`, markErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[WEBHOOK] Error fetching original email metadata:', err.message);
    }
    
    // Log reply event to DynamoDB for Outreach dashboard
    console.log(`📊 [OUTREACH] Logging reply event to DynamoDB`, { userId, agentId, trackingId, from: emailData.from });
    try {
      await awsManager.logEmailTracking(userId, agentId, trackingId, {
        eventType: 'reply',
        recipientEmail: emailData.from,
        leadName: leadName,
        subject: originalSubject || emailData.subject,
        messagePreview: emailData.body.substring(0, 200),
        content: emailData.body,
        timestamp: new Date().toISOString()
      });
      console.log(`✅ [OUTREACH] Reply event logged successfully`);
      
      // Broadcast to SSE clients for real-time UI updates
      try {
        const { broadcastAIResponse } = await import('./outreach.js');
        broadcastAIResponse(userId, agentId, {
          type: 'tracking_update',
          trackingId: trackingId,
          eventType: 'reply',
          recipientEmail: emailData.from,
          leadName: leadName,
          subject: originalSubject || emailData.subject,
          messagePreview: emailData.body.substring(0, 200),
          timestamp: new Date().toISOString()
        });
        console.log(`✅ [OUTREACH] SSE broadcast sent for reply event`);
      } catch (sseError) {
        console.error('❌ [OUTREACH] SSE broadcast failed:', sseError.message);
      }
    } catch (dbError) {
      console.error('❌ [OUTREACH] DynamoDB logging failed:', dbError);
    }
    
    return res.json({
      success: true,
      processed: true,
      tracking_id: trackingId
    });

  } catch (error) {
    console.error('[WEBHOOK] Error processing email:', error);
    console.error('[WEBHOOK] Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export function for Gmail polling
export async function processGmailReply(userId, message) {
  try {
    console.log(`[GMAIL REPLY] Processing Gmail reply from ${message.from}`);
    
    // Extract tracking ID from message headers
    let trackingId = message.resolvedTrackingId || null;

    if (!trackingId && message.xMeridianTrackingId && message.xMeridianTrackingId.includes('tracking-')) {
      const match = message.xMeridianTrackingId.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/i);
      if (match) trackingId = match[1];
      console.log(`[GMAIL REPLY] Found tracking ID in X-Meridian-Tracking-Id: ${trackingId}`);
    }
    
    // Try to extract from In-Reply-To or References
    if (!trackingId && message.inReplyTo && message.inReplyTo.includes('tracking-')) {
      const match = message.inReplyTo.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/i);
      if (match) trackingId = match[1];
      console.log(`[GMAIL REPLY] Found tracking ID in In-Reply-To: ${trackingId}`);
    }
    
    if (!trackingId && message.references && message.references.includes('tracking-')) {
      const match = message.references.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/i);
      if (match) trackingId = match[1];
      console.log(`[GMAIL REPLY] Found tracking ID in References: ${trackingId}`);
    }

    if (!trackingId && message.messageId && message.messageId.includes('tracking-')) {
      const match = message.messageId.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/i);
      if (match) trackingId = match[1];
      console.log(`[GMAIL REPLY] Found tracking ID in Message-ID: ${trackingId}`);
    }

    if (!trackingId && message.body && message.body.includes('tracking-')) {
      const match = message.body.match(/(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/i);
      if (match) trackingId = match[1];
      console.log(`[GMAIL REPLY] Found tracking ID in body: ${trackingId}`);
    }
    
    // If no tracking ID found, create one (new conversation)
    if (!trackingId) {
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString('hex');
      const shortUserId = userId.substring(0, 8);
      trackingId = `tracking-${shortUserId}_reasoning-lead-agent_${timestamp}_${hash}`;
      console.log(`[GMAIL REPLY] Created new tracking ID: ${trackingId}`);
    }
    
    // Extract userId and agentId for logging
    const extractedUserId = extractUserIdFromTrackingId(trackingId);
    const agentId = extractAgentIdFromTrackingId(trackingId);

    // Log reply event to DynamoDB for Outreach dashboard
    console.log(`📊 [OUTREACH] Logging Gmail reply event to DynamoDB`, { userId: extractedUserId, agentId, trackingId, from: message.from });
    try {
      await awsManager.logEmailTracking(extractedUserId || userId, agentId, trackingId, {
        eventType: 'reply',
        recipientEmail: message.from,
        messagePreview: message.body.substring(0, 200),
        timestamp: new Date().toISOString()
      });
      console.log(`✅ [OUTREACH] Reply event logged successfully`);

      // Mark the original email as REPLIED so follow-ups are suppressed
      if (extractedUserId && agentId) {
        try {
          const awsQueue = (await import('../utils/awsEmailQueue.js')).default;
          const queueInstance = new awsQueue();
          const sentEmails = await queueInstance.getSentEmails(extractedUserId, agentId);
          const originalEmail = sentEmails.find(e => e.trackingId === trackingId);
          if (originalEmail && originalEmail.id && originalEmail.status !== 'REPLIED') {
            await queueInstance.markEmailAsReplied(extractedUserId, agentId, originalEmail.id, {
              from: message.from,
              subject: message.subject,
              body: message.body?.substring(0, 500)
            });
            console.log(`✅ [GMAIL REPLY] Marked email ${originalEmail.id} as REPLIED — follow-ups will be suppressed`);
          }
        } catch (markErr) {
          console.error(`❌ [GMAIL REPLY] Failed to mark email as REPLIED:`, markErr.message);
        }
      }
      
      // Broadcast to SSE clients for real-time UI updates
      if (broadcastAIResponse) {
        broadcastAIResponse(extractedUserId || userId, agentId, {
          type: 'tracking_update',
          trackingId: trackingId,
          eventType: 'reply',
          recipientEmail: message.from,
          messagePreview: message.body.substring(0, 200),
          timestamp: new Date().toISOString()
        });
        console.log(`✅ [OUTREACH] SSE broadcast sent for Gmail reply event`);
      }
    } catch (dbError) {
      console.error('❌ [OUTREACH] DynamoDB logging failed:', dbError);
    }
    
    return { success: true, processed: true, tracking_id: trackingId };

  } catch (error) {
    console.error('[GMAIL REPLY] Error processing Gmail reply:', error);
    console.error('[GMAIL REPLY] Error stack:', error.stack);
    throw error;
  }
}

export default router;
