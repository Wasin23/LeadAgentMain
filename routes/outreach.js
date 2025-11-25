import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import { AWSManager } from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// Get outreach statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

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
    
    // Filter by time range
    const filteredEvents = startTime 
      ? events.filter(e => new Date(e.timestamp) >= startTime)
      : events;

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
  } catch (error) {
    console.error('Error fetching outreach stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

    // Get email tracking events
    const events = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 1000);

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

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get timeline events
router.get('/timeline', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, timeRange } = req.query;

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

    res.json({
      success: true,
      events: filteredEvents
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
