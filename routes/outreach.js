import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';

// Helper function to fix UTF-8 encoding issues
function fixEncoding(text) {
  if (!text) return text;
  try {
    // Common UTF-8 corruption patterns
    return text
      .replace(/Ã¢Â€Â™/g, "'") // Right single quotation mark
      .replace(/Ã¢Â€Â"/g, '"')  // Left double quotation mark  
      .replace(/Ã¢Â€Â�/g, '"')  // Right double quotation mark
      .replace(/Ã¢Â€Â"/g, '–')  // En dash
      .replace(/Ã¢Â€Â"/g, '—')  // Em dash
      .replace(/Ã‚Â´/g, "'")     // Acute accent
      .replace(/Ã‚Â /g, ' ');    // Non-breaking space
  } catch (e) {
    return text;
  }
}

const router = express.Router();
const awsManager = new AWSManager();
const emailQueue = new AWSEmailQueue();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// Send overdue follow-ups immediately
router.post('/send-overdue', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId } = req.body;

    console.log(`🚀 [SEND-OVERDUE] Checking for overdue follow-ups for user ${userId}, agent ${agentId || 'all'}`);

    // Get agents to check
    let agents = [];
    if (agentId && agentId !== 'all') {
      agents = [{ agentId }];
    } else {
      agents = await awsManager.getUserAgents(userId);
    }

    let totalSent = 0;
    const results = [];

    for (const agent of agents) {
      const currentAgentId = agent.agentId;
      
      // Get agent settings
      const agentSettings = await awsManager.getLeadAgentSettings(userId, currentAgentId);
      if (!agentSettings || !agentSettings.emailBuilder) continue;

      const rebumpEnabled = agentSettings.emailBuilder.enableRebump !== false;
      if (!rebumpEnabled) continue;

      // Get sent emails with scheduled follow-ups
      const sentEmails = await emailQueue.getSentEmails(userId, currentAgentId);
      if (!sentEmails || sentEmails.length === 0) continue;

      const now = Date.now();
      const rebumpIntervalDays = agentSettings.emailBuilder.rebumpIntervalDays || 7;
      const rebumpIntervalMs = rebumpIntervalDays * 24 * 60 * 60 * 1000;

      for (const email of sentEmails) {
        // Only process emails with scheduled follow-ups that are overdue
        if (!email.followUpScheduled || !email.followUpDate) {
          console.log(`[SEND-OVERDUE] Skipping ${email.to}: No follow-up scheduled`);
          continue;
        }
        if (email.status === 'REPLIED' || email.status === 'BOUNCED') {
          console.log(`[SEND-OVERDUE] Skipping ${email.to}: Status is ${email.status}`);
          continue;
        }

        const rebumpCount = email.rebumpCount || 0;
        const maxRebumps = agentSettings.emailBuilder.maxRebumps || 1;
        if (rebumpCount >= maxRebumps) {
          console.log(`[SEND-OVERDUE] Skipping ${email.to}: Already sent ${rebumpCount}/${maxRebumps} follow-ups`);
          continue;
        }

        const followUpDate = new Date(email.followUpDate);
        const sentAt = new Date(email.sentAt || email.timestamp);

        // Check if overdue (follow-up date has passed)
        if (now < followUpDate.getTime()) {
          console.log(`[SEND-OVERDUE] Skipping ${email.to}: Not yet time (${followUpDate.toISOString()})`);
          continue;
        }

        console.log(`📤 [SEND-OVERDUE] Sending overdue follow-up to ${email.to}`);

        // Get template
        let template = email.assignedTemplate;
        let templateIndex = email.assignedTemplateId || 0;
        
        if (!template) {
          template = agentSettings.followUpTemplates?.templates[templateIndex];
        }

        if (!template) {
          console.log(`⚠️ [SEND-OVERDUE] No template available for email ${email.id}`);
          continue;
        }

        // Fill in template variables
        const lead = email.lead || {};
        const timeSinceLastContact = now - sentAt.getTime();
        const daysAgo = Math.floor(timeSinceLastContact / (24 * 60 * 60 * 1000));
        const topic = email.subject || 'our previous conversation';
        const firstName = (lead.name || 'there').split(' ')[0];

        const subject = template.subject
          .replace(/{name}/g, firstName)
          .replace(/{company}/g, lead.company || 'your company')
          .replace(/{topic}/g, topic)
          .replace(/{days_ago}/g, daysAgo);

        const body = template.body
          .replace(/{name}/g, firstName)
          .replace(/{company}/g, lead.company || 'your company')
          .replace(/{topic}/g, topic)
          .replace(/{days_ago}/g, daysAgo);

        // Build threading info
        const replyOptions = {
          inReplyTo: email.gmailMessageId ? `<${email.gmailMessageId}@gmail.com>` : 
                    (email.trackingId ? `<tracking-${email.trackingId}@${process.env.MAILGUN_DOMAIN || 'mg.meridianagent.xyz'}>` : null),
          references: email.gmailMessageId ? `<${email.gmailMessageId}@gmail.com>` : 
                     (email.trackingId ? `<tracking-${email.trackingId}@${process.env.MAILGUN_DOMAIN || 'mg.meridianagent.xyz'}>` : null),
          threadId: email.gmailThreadId || null
        };

        // Send the follow-up
        try {
          const sendResult = await leadEmail(
            email.to,
            subject,
            body,
            lead,
            userId,
            currentAgentId,
            null,
            null,
            null,
            replyOptions
          );

          if (sendResult.success) {
            console.log(`✅ [SEND-OVERDUE] Sent follow-up to ${email.to}`);
            
            // Update email status
            await emailQueue.updateEmailStatus(userId, currentAgentId, email.id, 'SENT', 'SENT', {
              rebumpCount: rebumpCount + 1,
              lastRebumpAt: new Date().toISOString(),
              lastFollowUpSentAt: new Date().toISOString(),
              followUpStatus: 'SENT'
            });

            // Schedule next follow-up if more remaining
            if (rebumpCount + 1 < maxRebumps) {
              const nextFollowUpDate = new Date(Date.now() + rebumpIntervalMs);
              await emailQueue.updateEmailStatus(userId, currentAgentId, email.id, 'SENT', 'SENT', {
                followUpDate: nextFollowUpDate.toISOString()
              });
            }

            totalSent++;
            results.push({ email: email.to, success: true });
          } else {
            console.error(`❌ [SEND-OVERDUE] Failed to send to ${email.to}:`, sendResult.error);
            results.push({ email: email.to, success: false, error: sendResult.error });
          }
        } catch (error) {
          console.error(`❌ [SEND-OVERDUE] Error sending to ${email.to}:`, error);
          results.push({ email: email.to, success: false, error: error.message });
        }
      }
    }

    console.log(`✅ [SEND-OVERDUE] Sent ${totalSent} overdue follow-ups`);
    res.json({ success: true, sent: totalSent, results });
  } catch (error) {
    console.error('❌ [SEND-OVERDUE] Error:', error);
    res.status(500).json({ error: 'Failed to send overdue follow-ups', details: error.message });
  }
});

// DEBUG: Inspect tracking table contents
router.get('/debug/tracking', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, limit = 50 } = req.query;

    console.log(`🔍 [DEBUG] Fetching tracking events for userId: ${userId}, agentId: ${agentId}`);

    // Get email tracking events from DynamoDB
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, parseInt(limit));
    
    console.log(`🔍 [DEBUG] Retrieved ${events.length} tracking events`);

    // Group events by tracking ID for easier viewing
    const eventsByTracking = events.reduce((acc, event) => {
      const id = event.trackingId;
      if (!acc[id]) {
        acc[id] = [];
      }
      acc[id].push({
        eventType: event.eventType,
        timestamp: event.timestamp,
        recipientEmail: event.recipientEmail,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        url: event.url,
        messagePreview: event.messagePreview,
        leadName: event.leadName
      });
      return acc;
    }, {});

    res.json({
      success: true,
      totalEvents: events.length,
      uniqueTrackingIds: Object.keys(eventsByTracking).length,
      eventsByTracking,
      rawEvents: events.slice(0, 10) // First 10 raw events for inspection
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error fetching tracking events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get outreach statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

    console.log(`📊 [OUTREACH-STATS] Fetching stats for userId: ${userId}, agentId: ${agentId}, timeRange: ${timeRange}`);

    // Calculate time filter
    let startTime = null;
    if (timeRange === '24h') {
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeRange === '7d') {
      startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get email tracking events from DynamoDB
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 1000);
    
    console.log(`📊 [OUTREACH-STATS] Retrieved ${events.length} total events`);
    
    // Filter by time range
    const filteredEvents = startTime 
      ? events.filter(e => new Date(e.timestamp) >= startTime)
      : events;

    console.log(`📊 [OUTREACH-STATS] Filtered to ${filteredEvents.length} events within time range`);

    // Calculate stats
    const trackingIds = new Set();
    const opens = new Set();
    const clicks = new Set();
    const replies = new Set();
    const aiResponses = new Set();
    const meetingsBooked = new Set();
    const sendTimes = [];

    filteredEvents.forEach(event => {
      trackingIds.add(event.trackingId);
      
      if (event.eventType === 'sent') {
        sendTimes.push(new Date(event.timestamp));
      } else if (event.eventType === 'open') {
        opens.add(event.trackingId);
      } else if (event.eventType === 'click') {
        clicks.add(event.trackingId);
      } else if (event.eventType === 'reply') {
        replies.add(event.trackingId);
      } else if (event.eventType === 'ai_response') {
        aiResponses.add(event.trackingId);
      } else if (event.eventType === 'meeting_booked') {
        meetingsBooked.add(event.trackingId);
      }
    });

    const totalSent = trackingIds.size;
    const totalOpened = opens.size;
    const totalClicked = clicks.size;
    const totalReplies = replies.size;
    const totalAIResponses = aiResponses.size;
    const totalMeetingsBooked = meetingsBooked.size;

    // Calculate best send time
    let bestSendTime = null;
    if (sendTimes.length > 0) {
      const hourCounts = {};
      const dayOfWeekCounts = {};
      
      sendTimes.forEach(time => {
        const hour = time.getHours();
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][time.getDay()];
        
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
      });
      
      const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
      const bestDay = Object.entries(dayOfWeekCounts).sort((a, b) => b[1] - a[1])[0];
      
      if (bestHour && bestDay) {
        bestSendTime = {
          hour: parseInt(bestHour[0]),
          dayOfWeek: bestDay[0]
        };
      }
    }

    res.json({
      success: true,
      stats: {
        totalSent,
        totalOpened,
        totalClicked,
        totalReplies,
        totalAIResponses,
        totalMeetingsBooked,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
        bestSendTime
      }
    });
    
    console.log(`✅ [OUTREACH-STATS] Stats calculated and returned`, {
      totalSent,
      totalOpened,
      totalReplies,
      totalAIResponses,
      openRate: totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('❌ [OUTREACH-STATS] Error fetching outreach stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all conversations for an agent
router.delete('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId } = req.query;

    console.log(`🗑️ [OUTREACH-CONVERSATIONS] Clearing conversations for userId: ${userId}, agentId: ${agentId}`);

    // Get all events for this agent
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 10000);
    
    // Delete all tracking events
    let deletedCount = 0;
    for (const event of events) {
      try {
        await awsManager.deleteEmailTrackingEvent(event);
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete event ${event.eventId}:`, err.message);
      }
    }

    console.log(`✅ [OUTREACH-CONVERSATIONS] Cleared ${deletedCount} events`);

    res.json({
      success: true,
      deletedCount
    });
  } catch (error) {
    console.error('❌ [OUTREACH-CONVERSATIONS] Error clearing conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

    console.log(`💬 [OUTREACH-CONVERSATIONS] Fetching conversations for userId: ${userId}, agentId: ${agentId}`);

    // Get email tracking events
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 1000);

    console.log(`💬 [OUTREACH-CONVERSATIONS] Retrieved ${events.length} events`);

    // Sort events by timestamp for chronological order
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Group events by tracking ID to form conversations
    const conversationMap = {};
    const processedEventIds = new Set(); // Track processed events to prevent duplicates
    
    events.forEach(event => {
      const trackingId = event.trackingId;
      
      // Skip if we've already processed this eventId (deduplication)
      if (processedEventIds.has(event.eventId)) {
        console.log(`⚠️ [DUPLICATE] Skipping duplicate eventId: ${event.eventId}`);
        return;
      }
      processedEventIds.add(event.eventId);
      
      console.log(`🔍 [EVENT] Processing event:`, {
        trackingId,
        eventType: event.eventType,
        eventId: event.eventId,
        timestamp: event.timestamp,
        leadEmail: event.recipientEmail
      });
      
      if (!conversationMap[trackingId]) {
        conversationMap[trackingId] = {
          trackingId,
          leadName: event.leadName || 'Unknown',
          leadEmail: event.recipientEmail || event.email || 'unknown@email.com',
          company: event.company,
          agentId: event.agentId,
          agentName: event.agentName || 'Unknown Agent',
          status: 'sent',
          lastActivity: event.timestamp,
          messageCount: 0,
          messages: []
        };
      }

      const conv = conversationMap[trackingId];
      conv.lastActivity = event.timestamp; // Update to latest
      
      if (event.eventType === 'sent' || event.eventType === 'outbound') {
        conv.messageCount++;
        conv.messages.push({
          id: event.eventId,
          type: 'outbound',
          content: event.content || event.messagePreview || 'Email sent',
          timestamp: event.timestamp
        });
      } else if (event.eventType === 'reply' || event.eventType === 'lead_message') {
        conv.messageCount++;
        conv.status = 'awaiting_ai';
        conv.messages.push({
          id: event.eventId,
          type: 'reply',
          content: event.content || event.messagePreview || 'Lead replied',
          timestamp: event.timestamp
        });
      } else if (event.eventType === 'ai_response' || event.eventType === 'ai_reply') {
        conv.messageCount++;
        conv.status = 'ai_responded';
        conv.messages.push({
          id: event.eventId,
          type: 'ai_response',
          content: event.content || event.aiResponsePreview || event.messagePreview || 'AI responded',
          timestamp: event.timestamp
        });
      } else if (event.eventType === 'manual') {
        conv.messageCount++;
        conv.status = 'manual_replied';
        conv.messages.push({
          id: event.eventId,
          type: 'manual',
          content: event.content || event.messagePreview || 'Manual reply sent',
          timestamp: event.timestamp
        });
      } else if (event.eventType === 'meeting_booked') {
        conv.status = 'meeting_booked';
      } else if (event.sentiment === 'positive') {
        conv.status = 'interested';
      } else if (event.sentiment === 'negative') {
        conv.status = 'not_interested';
      }
    });

    console.log(`💬 [OUTREACH-CONVERSATIONS] Grouped into ${Object.keys(conversationMap).length} conversations`);
    
    // Log some conversation details for debugging
    Object.entries(conversationMap).slice(0, 3).forEach(([trackingId, conv]) => {
      console.log(`🔍 [CONVERSATION] ${trackingId}:`, {
        leadEmail: conv.leadEmail,
        messageCount: conv.messageCount,
        messages: conv.messages.map(m => ({ type: m.type, timestamp: m.timestamp }))
      });
    });
    
    // Convert to array and filter conversations with replies
    const allConversations = Object.values(conversationMap);
    console.log(`💬 [OUTREACH-CONVERSATIONS] Sample conversation:`, JSON.stringify(allConversations[0], null, 2));
    
    const conversations = allConversations
      .filter(conv => conv.messages.some(m => m.type === 'reply' || m.type === 'ai_response'))
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    console.log(`💬 [OUTREACH-CONVERSATIONS] After filtering: ${conversations.length} conversations with replies`);

    // Load AI control state for each conversation
    for (const conv of conversations) {
      try {
        const aiEnabled = await awsManager.getConversationAIControl(userId, agentId, conv.trackingId);
        conv.aiEnabled = aiEnabled;
        console.log(`🤖 [AI-CONTROL] Loaded state for ${conv.trackingId}: ${aiEnabled ? 'ENABLED' : 'PAUSED'}`);
      } catch (error) {
        console.error(`⚠️ [AI-CONTROL] Failed to load state for ${conv.trackingId}, defaulting to enabled`);
        conv.aiEnabled = true; // Default to enabled on error
      }
    }

    console.log(`✅ [OUTREACH-CONVERSATIONS] Processed ${conversations.length} conversations with replies`);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('❌ [OUTREACH-CONVERSATIONS] Error fetching conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Control AI auto-response for specific conversation
router.post('/control-ai', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { trackingId, conversationId, enabled, agentId } = req.body;

    // Support both trackingId (new) and conversationId (legacy)
    const id = trackingId || conversationId;

    console.log(`🤖 [AI-CONTROL] Setting AI for trackingId ${id} to ${enabled ? 'ENABLED' : 'PAUSED'}`);

    if (!id || !agentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'trackingId and agentId are required' 
      });
    }

    // Store AI control state in DynamoDB
    await awsManager.setConversationAIControl(userId, agentId, id, enabled);

    res.json({
      success: true,
      trackingId: id,
      aiEnabled: enabled
    });
  } catch (error) {
    console.error('❌ [AI-CONTROL] Error controlling AI:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear viewed/opened email tracking data
router.delete('/viewed', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId } = req.query;

    console.log(`🗑️ [OUTREACH-VIEWED] Clearing tracking data for userId: ${userId}, agentId: ${agentId}`);

    if (!agentId || agentId === 'all') {
      return res.status(400).json({ success: false, error: 'Agent ID is required' });
    }

    // Get all tracking events for this agent
    const events = await awsManager.getEmailTrackingByUser(userId, agentId, 10000);
    console.log(`🗑️ [OUTREACH-VIEWED] Found ${events.length} events to delete`);
    
    if (events.length > 0) {
      console.log(`🗑️ [OUTREACH-VIEWED] Sample event structure:`, {
        PK: events[0].PK,
        SK: events[0].SK,
        eventId: events[0].eventId,
        keys: Object.keys(events[0])
      });
    }

    // Delete each event
    let deletedCount = 0;
    for (const event of events) {
      try {
        if (!event.trackingId || !event.eventId) {
          console.error(`❌ [OUTREACH-VIEWED] Event missing trackingId/eventId:`, event);
          continue;
        }
        await awsManager.deleteEmailTrackingEvent(event);
        deletedCount++;
      } catch (err) {
        console.error(`❌ [OUTREACH-VIEWED] Failed to delete event ${event.eventId}:`, err.message);
      }
    }

    console.log(`✅ [OUTREACH-VIEWED] Deleted ${deletedCount}/${events.length} tracking events`);

    res.json({
      success: true,
      deletedCount,
      totalEvents: events.length
    });
  } catch (error) {
    console.error('❌ [OUTREACH-VIEWED] Error clearing tracking data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get viewed/opened emails
router.get('/viewed', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

    console.log(`👁️ [OUTREACH-VIEWED] Fetching viewed emails for userId: ${userId}, agentId: ${agentId}`);

    // Calculate time filter
    let startTime = null;
    if (timeRange === '24h') {
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeRange === '7d') {
      startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get email tracking events
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 1000);

    console.log(`👁️ [OUTREACH-VIEWED] Retrieved ${events.length} events`);

    // Group by trackingId and filter for opened emails
    const openedEmailsMap = {};
    
    events.forEach(event => {
      const trackingId = event.trackingId;
      
      // Initialize email entry if we see a sent event
      if (event.eventType === 'sent' || event.eventType === 'outbound') {
        if (!openedEmailsMap[trackingId]) {
          openedEmailsMap[trackingId] = {
            trackingId,
            leadName: event.leadName || 'Unknown',
            leadEmail: event.recipientEmail || event.email || 'unknown@email.com',
            company: event.company,
            subject: event.subject,
            sentAt: event.timestamp,
            opened: false,
            openedAt: null,
            openCount: 0,
            replied: false,
            agentId: event.agentId,
            agentName: event.agentName
          };
        }
      }
      
      // Track opens
      if (event.eventType === 'open') {
        if (!openedEmailsMap[trackingId]) {
          // Create entry even if we don't have sent event
          openedEmailsMap[trackingId] = {
            trackingId,
            leadName: event.leadName || 'Unknown',
            leadEmail: event.recipientEmail || event.email || 'unknown@email.com',
            company: event.company,
            subject: fixEncoding(event.subject),
            sentAt: event.timestamp,
            opened: false,
            openedAt: null,
            openCount: 0,
            replied: false,
            agentId: event.agentId,
            agentName: event.agentName
          };
        }
        
        const email = openedEmailsMap[trackingId];
        email.opened = true;
        email.openCount++;
        
        // Update email details from open event if available (with encoding fix)
        if (event.leadName && email.leadName === 'Unknown') {
          email.leadName = event.leadName;
        }
        if (event.recipientEmail && email.leadEmail === 'unknown@email.com') {
          email.leadEmail = event.recipientEmail;
        }
        if (event.subject && !email.subject) {
          email.subject = fixEncoding(event.subject);
        }
        if (event.recipientEmail && email.leadEmail === 'unknown@email.com') {
          email.leadEmail = event.recipientEmail;
        }
        if (event.subject && !email.subject) {
          email.subject = event.subject;
        }
        if (event.company && !email.company) {
          email.company = event.company;
        }
        
        // Track first open time
        if (!email.openedAt || new Date(event.timestamp) < new Date(email.openedAt)) {
          email.openedAt = event.timestamp;
          email.ipAddress = event.ipAddress;
          email.userAgent = event.userAgent;
        }
      }
      
      // Track replies (check both 'reply' and 'lead_message' event types)
      if (event.eventType === 'reply' || event.eventType === 'lead_message') {
        if (!openedEmailsMap[trackingId]) {
          // Create entry if doesn't exist
          openedEmailsMap[trackingId] = {
            trackingId,
            leadName: event.leadName || 'Unknown',
            leadEmail: event.recipientEmail || event.email || 'unknown@email.com',
            company: event.company,
            subject: fixEncoding(event.subject),
            sentAt: event.timestamp,
            opened: true,
            openedAt: event.timestamp,
            openCount: 1,
            replied: false,
            agentId: event.agentId,
            agentName: event.agentName
          };
        }
        openedEmailsMap[trackingId].replied = true;
      }
      
      // Also mark as replied if there's an AI response (means there was a reply)
      if (event.eventType === 'ai_response' || event.eventType === 'ai_reply') {
        if (!openedEmailsMap[trackingId]) {
          // Create entry if doesn't exist
          openedEmailsMap[trackingId] = {
            trackingId,
            leadName: event.leadName || 'Unknown',
            leadEmail: event.recipientEmail || event.email || 'unknown@email.com',
            company: event.company,
            subject: fixEncoding(event.subject),
            sentAt: event.timestamp,
            opened: true,
            openedAt: event.timestamp,
            openCount: 1,
            replied: false,
            agentId: event.agentId,
            agentName: event.agentName
          };
        }
        openedEmailsMap[trackingId].replied = true;
      }
    });

    // Convert to array, filter for opened emails only, and apply time filter
    const viewedEmails = Object.values(openedEmailsMap)
      .filter(email => email.opened)
      .filter(email => {
        if (!startTime) return true;
        return new Date(email.openedAt || email.sentAt) >= startTime;
      })
      .sort((a, b) => new Date(b.openedAt || b.sentAt) - new Date(a.openedAt || a.sentAt));

    console.log(`✅ [OUTREACH-VIEWED] Processed ${viewedEmails.length} viewed emails`);

    res.json({
      success: true,
      viewedEmails
    });
  } catch (error) {
    console.error('❌ [OUTREACH-VIEWED] Error fetching viewed emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get timeline events
router.get('/timeline', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

    console.log(`📅 [OUTREACH-TIMELINE] Fetching timeline for userId: ${userId}, agentId: ${agentId}, timeRange: ${timeRange}`);

    // Calculate time filter
    let startTime = null;
    if (timeRange === '24h') {
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeRange === '7d') {
      startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get email tracking events
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 1000);

    console.log(`📅 [OUTREACH-TIMELINE] Retrieved ${events.length} events`);

    // Filter and format events
    const filteredEvents = events
      .filter(e => {
        if (startTime && new Date(e.timestamp) < startTime) return false;
        // Only show engagement events
        return ['open', 'click', 'reply', 'ai_response', 'meeting_booked'].includes(e.eventType);
      })
      .map(e => ({
        id: e.eventId || `${e.trackingId}-${e.timestamp}`,
        trackingId: e.trackingId,
        agentId: e.agentId,
        agentName: e.agentName,
        eventType: e.eventType,
        timestamp: e.timestamp,
        recipientEmail: e.recipientEmail || e.email,
        leadName: e.leadName,
        company: e.company,
        ipAddress: e.ipAddress,
        url: e.url,
        messagePreview: e.messagePreview || e.content,
        aiResponsePreview: e.aiResponsePreview,
        sentiment: e.sentiment
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`✅ [OUTREACH-TIMELINE] Filtered to ${filteredEvents.length} engagement events`);

    res.json({
      success: true,
      events: filteredEvents
    });
  } catch (error) {
    console.error('❌ [OUTREACH-TIMELINE] Error fetching timeline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-time SSE streaming for live AI responses
router.get('/stream', async (req, res) => {
  const { agentId } = req.query;
  const userId = req.user?.userId;

  console.log(`🔌 [OUTREACH-SSE] Stream endpoint hit`);
  console.log(`🔌 [OUTREACH-SSE] Query params:`, req.query);
  console.log(`🔌 [OUTREACH-SSE] User from JWT:`, req.user ? 'Present' : 'MISSING');
  console.log(`🔌 [OUTREACH-SSE] New client connected - userId: ${userId}, agentId: ${agentId}`);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable buffering for nginx
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }
  }, 30000); // Every 30 seconds

  // Store this connection for broadcasting
  if (!global.outreachSSEClients) {
    global.outreachSSEClients = new Map();
  }
  
  const clientKey = `${userId}_${agentId}`;
  if (!global.outreachSSEClients.has(clientKey)) {
    global.outreachSSEClients.set(clientKey, []);
  }
  global.outreachSSEClients.get(clientKey).push(res);

  console.log(`✅ [OUTREACH-SSE] Client registered: ${clientKey}, total clients: ${global.outreachSSEClients.get(clientKey).length}`);
  console.log(`📊 [OUTREACH-SSE] Total client keys: ${global.outreachSSEClients.size}`);

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
    
    // Remove this client from the list
    const clients = global.outreachSSEClients.get(clientKey);
    if (clients) {
      const index = clients.indexOf(res);
      if (index > -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        global.outreachSSEClients.delete(clientKey);
        console.log(`🗑️ [OUTREACH-SSE] All clients disconnected for ${clientKey}, key removed`);
      } else {
        console.log(`📊 [OUTREACH-SSE] Client removed. Remaining clients for ${clientKey}: ${clients.length}`);
      }
    }
    
    console.log(`🔌 [OUTREACH-SSE] Client disconnected: ${clientKey}`);
    res.end();
  });
});

// Helper function to broadcast AI response events to connected clients
export function broadcastAIResponse(userId, agentId, eventData) {
  if (!global.outreachSSEClients) {
    console.log(`⚠️ [OUTREACH-SSE] No SSE clients map available for broadcast`);
    return;
  }
  
  const clientKey = `${userId}_${agentId}`;
  const clients = global.outreachSSEClients.get(clientKey);
  
  if (!clients || clients.length === 0) {
    // console.log(`⚠️ [OUTREACH-SSE] No connected clients for ${clientKey}`);
    return;
  }
  
  console.log(`📡 [OUTREACH-SSE] Broadcasting to ${clients.length} client(s): ${clientKey}`, {
    eventType: eventData.type,
    recipientEmail: eventData.recipientEmail,
    hasChunk: !!eventData.chunk
  });
  
  const data = JSON.stringify(eventData);
  let successCount = 0;
  
  clients.forEach((client, index) => {
    try {
      if (!client.writableEnded) {
        client.write(`data: ${data}\n\n`);
        successCount++;
      } else {
        console.log(`⚠️ [OUTREACH-SSE] Client ${index} connection ended, removing...`);
      }
    } catch (error) {
      console.error(`❌ [OUTREACH-SSE] Error writing to client ${index}:`, error.message);
      // Remove dead client
      clients.splice(index, 1);
    }
  });
  
  console.log(`✅ [OUTREACH-SSE] Broadcast complete. Sent to ${successCount}/${clients.length} client(s)`);
}

// Manual reply endpoint
router.post('/manual-reply', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { trackingId, leadEmail, leadName, agentId, message, pauseAI } = req.body;

    console.log(`📧 [MANUAL-REPLY] Sending manual reply:`, {
      userId,
      trackingId,
      leadEmail,
      agentId,
      pauseAI
    });

    // Validate required fields
    if (!trackingId || !leadEmail || !agentId || !message) {
      console.error(`❌ [MANUAL-REPLY] Missing required fields:`, {
        hasTrackingId: !!trackingId,
        hasLeadEmail: !!leadEmail,
        hasAgentId: !!agentId,
        hasMessage: !!message
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: trackingId, leadEmail, agentId, and message are required'
      });
    }

    // Get user settings for from address
    const userSettings = await awsManager.getUserSettings(userId);
    
    // Use replies@ domain (same as AI responses) for better deliverability
    const fromEmail = userSettings?.emailSettings?.fromEmail || 
                     userSettings?.companyProfile?.fromEmail || 
                     `replies@${process.env.MAILGUN_DOMAIN}`;
    
    const companyName = userSettings?.companyProfile?.companyName || 
                       userSettings?.emailSettings?.fromName ||
                       'Your Company';

    console.log(`🔍 [MANUAL-REPLY] From email: ${fromEmail}, Company: ${companyName}`);

    // Get original email subject and message ID from tracking events
    let originalSubject = 'your inquiry';
    let originalMessageId = null;
    let references = null;
    
    try {
      console.log(`🔍 [MANUAL-REPLY] Fetching tracking events for trackingId: ${trackingId}`);
      const trackingEvents = await awsManager.getEmailTrackingByTracking(trackingId);
      console.log(`🔍 [MANUAL-REPLY] Retrieved ${trackingEvents.length} tracking events`);
      
      // Log all event types to debug
      const eventTypes = trackingEvents.map(e => e.eventType);
      console.log(`🔍 [MANUAL-REPLY] Event types found:`, eventTypes);
      
      // Look for the most recent message in the thread (sent, outbound, ai_response, OR reply)
      const latestMessage = trackingEvents
        .filter(e => ['sent', 'outbound', 'ai_response', 'reply'].includes(e.eventType))
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];
        
      if (latestMessage) {
        if (latestMessage.subject) {
          originalSubject = latestMessage.subject;
          console.log(`📋 [MANUAL-REPLY] Found original subject: ${originalSubject} (from ${latestMessage.eventType})`);
        }
        if (latestMessage.messageId) {
          originalMessageId = latestMessage.messageId;
          references = originalMessageId;
          console.log(`📋 [MANUAL-REPLY] Found Message-ID: ${originalMessageId} (from ${latestMessage.eventType})`);
        }
        console.log(`✅ [MANUAL-REPLY] Threading with most recent ${latestMessage.eventType} event`);
      } else {
        console.log(`⚠️ [MANUAL-REPLY] No threadable events found in tracking events`);
      }
    } catch (error) {
      console.error(`❌ [MANUAL-REPLY] Error fetching tracking events:`, error);
      // Continue with defaults
    }

    console.log(`📨 [MANUAL-REPLY] Preparing email data...`);

    // Generate a unique message ID for tracking
    const timestamp = Date.now();
    const hash = Math.random().toString(36).substring(2, 10);
    const messageId = `<manual_${trackingId}_${timestamp}_${hash}@mg.meridianagent.xyz>`;

    // Send email via Mailgun with proper reply headers
    const emailData = {
      from: `${companyName} <${fromEmail}>`,
      to: leadEmail,
      subject: `Re: ${originalSubject}`,
      text: message,
      html: message.replace(/\n/g, '<br>'),
      'h:Message-ID': messageId,
      'v:tracking_id': trackingId
    };
    
    console.log(`📧 [MANUAL-REPLY] Generated Message-ID: ${messageId}`);
    
    // Add reply headers if we have the original message ID
    if (originalMessageId) {
      emailData['h:In-Reply-To'] = originalMessageId;
      emailData['h:References'] = references;
      console.log(`📧 [MANUAL-REPLY] Adding reply headers for threading`);
    } else {
      console.log(`⚠️ [MANUAL-REPLY] No original message ID - email will not thread properly`);
    }

    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const mailgunKey = process.env.MAILGUN_API_KEY;

    console.log(`📧 [MANUAL-REPLY] Mailgun config:`, {
      domain: mailgunDomain,
      hasKey: !!mailgunKey,
      url: `https://api.mailgun.net/v3/${mailgunDomain}/messages`
    });

    const formData = new URLSearchParams();
    Object.keys(emailData).forEach(key => {
      formData.append(key, emailData[key]);
    });

    console.log(`📤 [MANUAL-REPLY] Sending to Mailgun...`);
    console.log(`📝 [MANUAL-REPLY] Email data:`, JSON.stringify({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      messageLength: message.length,
      hasInReplyTo: !!emailData['h:In-Reply-To'],
      hasReferences: !!emailData['h:References']
    }, null, 2));
    console.log(`💬 [MANUAL-REPLY] Message content:`, message);

    const mailgunResponse = await fetch(
      `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`api:${mailgunKey}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      }
    );

    console.log(`📬 [MANUAL-REPLY] Mailgun response status:`, mailgunResponse.status);

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text();
      console.error(`❌ [MANUAL-REPLY] Mailgun error:`, {
        status: mailgunResponse.status,
        statusText: mailgunResponse.statusText,
        body: errorText
      });
      throw new Error(`Mailgun error: ${mailgunResponse.statusText} - ${errorText}`);
    }

    const mailgunResult = await mailgunResponse.json();
    console.log(`✅ [MANUAL-REPLY] Mailgun response:`, mailgunResult);
    console.log(`📨 [MANUAL-REPLY] Email queued for delivery:`, {
      mailgunId: mailgunResult.id,
      message: mailgunResult.message,
      recipient: leadEmail,
      from: emailData.from
    });
    
    console.log(`⚠️ [MANUAL-REPLY] IMPORTANT: Check Mailgun logs at https://app.mailgun.com/mg/logs`);
    console.log(`⚠️ [MANUAL-REPLY] Search for recipient: ${leadEmail} or Mailgun ID: ${mailgunResult.id}`);

    // Log the manual reply event
    await awsManager.logEmailTracking(userId, agentId, trackingId, {
      eventType: 'manual',
      recipientEmail: leadEmail,
      leadName,
      messagePreview: message.substring(0, 200),
      content: message
    });

    // If pauseAI flag is set, disable AI for this conversation
    if (pauseAI) {
      console.log(`⏸️ [MANUAL-REPLY] Pausing AI for trackingId: ${trackingId}`);
      try {
        await awsManager.setConversationAIControl(userId, agentId, trackingId, false);
        console.log(`✅ [MANUAL-REPLY] AI paused successfully for trackingId: ${trackingId}`);
      } catch (error) {
        console.error(`⚠️ [MANUAL-REPLY] Failed to pause AI:`, error);
        // Don't fail the whole request if AI control fails
      }
    }

    console.log(`✅ [MANUAL-REPLY] Manual reply sent successfully`);

    res.json({
      success: true,
      message: 'Reply sent successfully'
    });

  } catch (error) {
    console.error('❌ [MANUAL-REPLY] Error sending manual reply:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
