import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();

// Apply JWT authentication to all routes
router.use(authenticateToken);

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

// Get active conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

    console.log(`💬 [OUTREACH-CONVERSATIONS] Fetching conversations for userId: ${userId}, agentId: ${agentId}`);

    // Get email tracking events
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 1000);

    console.log(`💬 [OUTREACH-CONVERSATIONS] Retrieved ${events.length} events`);

    // Group events by tracking ID to form conversations
    const conversationMap = {};
    
    events.forEach(event => {
      const trackingId = event.trackingId;
      
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
          type: 'outbound',
          content: event.messagePreview || event.content || 'Email sent',
          timestamp: event.timestamp
        });
      } else if (event.eventType === 'reply') {
        conv.messageCount++;
        conv.status = 'awaiting_ai';
        conv.messages.push({
          type: 'reply',
          content: event.messagePreview || event.content || 'Lead replied',
          timestamp: event.timestamp
        });
      } else if (event.eventType === 'ai_response') {
        conv.messageCount++;
        conv.status = 'ai_responded';
        conv.messages.push({
          type: 'ai_response',
          content: event.aiResponsePreview || event.content || 'AI responded',
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

    // Convert to array and filter conversations with replies
    const conversations = Object.values(conversationMap)
      .filter(conv => conv.messages.some(m => m.type === 'reply' || m.type === 'ai_response'))
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

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
        if (!event.PK || !event.SK) {
          console.error(`❌ [OUTREACH-VIEWED] Event missing PK/SK:`, event);
          continue;
        }
        await awsManager.deleteEmailTrackingEvent(event.PK, event.SK);
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
        
        const email = openedEmailsMap[trackingId];
        email.opened = true;
        email.openCount++;
        
        // Update email details from open event if available
        if (event.leadName && email.leadName === 'Unknown') {
          email.leadName = event.leadName;
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
      
      // Track replies
      if (event.eventType === 'reply' && openedEmailsMap[trackingId]) {
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
    console.log(`⚠️ [OUTREACH-SSE] No connected clients for ${clientKey}`);
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

export default router;
