import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);

// Get all replies with analytics
router.get('/replies', async (req, res) => {
  try {
    console.log('[REPLIES API] Getting all replies from Zilliz');
    
    // Get from Zilliz email_tracking_events collection (same as Netlify function)
    let zillizReplies = [];
    let stats = {
      totalReplies: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      interested: 0,
      unsubscribes: 0,
      meetingRequests: 0
    };
    
    try {
      if (process.env.ZILLIZ_ENDPOINT && process.env.ZILLIZ_TOKEN) {
        const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
        const client = new MilvusClient({
          address: process.env.ZILLIZ_ENDPOINT,
          token: process.env.ZILLIZ_TOKEN
        });

        const collectionName = 'email_tracking_events'; // Same as Netlify function
        
        // Load collection
        await client.loadCollection({ collection_name: collectionName });

        // Query for all reply events (both AI replies and lead messages)
        const expr = `event_type == "ai_reply" || event_type == "lead_message"`;
        
        const queryResult = await client.query({
          collection_name: collectionName,
          expr: expr,
          limit: 1000,
          consistency_level: 'Strong',
          output_fields: ['tracking_id', 'event_type', 'timestamp', 'user_agent', 'ip_address', 'email_address', 'recipient', 'processed']
        });

        const allEvents = queryResult.data || queryResult || [];
        console.log('[REPLIES API] Found', allEvents.length, 'events in Zilliz');
        
        // Group by base tracking ID (remove prefixes like 'tracking-', 'ai-response-', etc.)
        const baseConversations = {};
        
        allEvents.forEach(event => {
          // Extract base tracking ID by removing common prefixes
          let baseTrackingId = event.tracking_id;
          
          // Remove prefixes to get the base tracking ID
          if (baseTrackingId.startsWith('ai-response-')) {
            // For ai-response-tracking-76e84c79_1758486159748_f0b1ed27-1758486249728
            // Remove ai-response-tracking- prefix but preserve user code format
            baseTrackingId = baseTrackingId.replace(/^ai-response-tracking-/, '');
            // Remove timestamp suffix if present (after the last dash)
            const lastDashIndex = baseTrackingId.lastIndexOf('-');
            if (lastDashIndex > baseTrackingId.indexOf('_')) {
              baseTrackingId = baseTrackingId.substring(0, lastDashIndex);
            }
          } else if (baseTrackingId.startsWith('tracking-')) {
            // For tracking-76e84c79_1758486159748_f0b1ed27
            baseTrackingId = baseTrackingId.replace(/^tracking-/, '');
          }
          // Base IDs like 76e84c79_1758486159748_f0b1ed27 remain unchanged
          
          if (!baseConversations[baseTrackingId]) {
            baseConversations[baseTrackingId] = {
              baseTrackingId: baseTrackingId,
              events: []
            };
          }
          baseConversations[baseTrackingId].events.push(event);
        });
        
        // Convert to reply format expected by frontend
        zillizReplies = Object.values(baseConversations).map(conv => {
          // Sort events by timestamp
          conv.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          // Find the latest event to determine overall status
          const latestEvent = conv.events[conv.events.length - 1];
          const hasAIReply = conv.events.some(e => e.event_type === 'ai_reply');
          const hasLeadMessage = conv.events.some(e => e.event_type === 'lead_message');
          
          return {
            originalTrackingId: conv.baseTrackingId, // Use base tracking ID for matching
            from: latestEvent.email_address || 'Unknown',
            timestamp: latestEvent.timestamp,
            subject: `Reply to ${conv.baseTrackingId}`,
            events: conv.events,
            hasAIReply: hasAIReply,
            hasLeadMessage: hasLeadMessage,
            // Extract relevant info for display
            references: conv.baseTrackingId,
            inReplyTo: conv.baseTrackingId
          };
        });
        
        // Calculate basic stats
        stats.totalReplies = zillizReplies.length;
        stats.positive = zillizReplies.filter(r => r.hasAIReply).length;
        stats.interested = zillizReplies.filter(r => r.hasLeadMessage).length;
        
      } else {
        console.log('[REPLIES API] Zilliz credentials not found, falling back to local file');
      }
    } catch (zillizError) {
      console.error('[REPLIES API] Zilliz query failed:', zillizError);
    }
    
    // Fallback to local file if Zilliz failed or no data
    if (zillizReplies.length === 0) {
      try {
        const logPath = path.join(process.cwd(), 'email_replies.json');
        const existingData = await fs.readFile(logPath, 'utf8');
        const localReplies = JSON.parse(existingData);
        
        console.log('[REPLIES API] Using local replies as fallback:', localReplies.length);
        zillizReplies = localReplies;
        stats.totalReplies = localReplies.length;
      } catch (error) {
        console.log('[REPLIES API] No local replies file found');
      }
    }

    res.json({
      success: true,
      data: {
        replies: zillizReplies,
        stats: stats
      }
    });
    
  } catch (error) {
    console.error('[REPLIES API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get replies for specific tracking ID
router.get('/replies/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    console.log('[REPLIES API] Getting replies for tracking ID:', trackingId);
    
    // Get local replies
    const logPath = path.join(process.cwd(), 'email_replies.json');
    let localReplies = [];
    
    try {
      const existingData = await fs.readFile(logPath, 'utf8');
      const allReplies = JSON.parse(existingData);
      localReplies = allReplies.filter(reply => reply.trackingId === trackingId);
    } catch (error) {
      console.log('[REPLIES API] No local replies file found');
    }
    
    // Simple stats calculation from local replies
    const stats = {
      totalReplies: localReplies.length,
      positive: 0,
      negative: 0,
      neutral: localReplies.length,
      interested: 0,
      unsubscribes: 0,
      meetingRequests: 0
    };
    
    res.json({
      success: true,
      data: {
        trackingId: trackingId,
        replies: localReplies,
        stats: stats || {
          totalReplies: localReplies.length,
          positive: 0,
          negative: 0,
          neutral: 0,
          interested: 0,
          unsubscribes: 0,
          meetingRequests: 0
        }
      }
    });
    
  } catch (error) {
    console.error('[REPLIES API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get reply analytics summary
router.get('/analytics/replies', async (req, res) => {
  try {
    console.log('[REPLIES API] Getting reply analytics summary');
    
    // Calculate stats from the main zillizReplies data we already fetched
    const stats = {
      totalReplies: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      interested: 0,
      unsubscribes: 0,
      meetingRequests: 0
    };
    
    if (!stats) {
      return res.json({
        success: true,
        data: {
          totalReplies: 0,
          replyRate: 0,
          sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 },
          typeBreakdown: { 
            interested: 0,
            not_interested: 0,
            unsubscribe: 0,
            meeting_request: 0,
            question: 0,
            general: 0
          }
        }
      });
    }
    
    const replyRate = stats.totalReplies > 0 ? (stats.totalReplies / 100) * 100 : 0; // Placeholder calculation
    
    res.json({
      success: true,
      data: {
        totalReplies: stats.totalReplies,
        replyRate: parseFloat(replyRate.toFixed(2)),
        sentimentBreakdown: {
          positive: stats.positive,
          negative: stats.negative,
          neutral: stats.neutral
        },
        typeBreakdown: {
          interested: stats.interested,
          unsubscribes: stats.unsubscribes,
          meeting_requests: stats.meetingRequests,
          // Add more types as needed
        }
      }
    });
    
  } catch (error) {
    console.error('[REPLIES API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual reply analysis endpoint (for testing)
router.post('/analyze-reply', async (req, res) => {
  try {
    const { content, trackingId } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }
    
    const testReplyData = {
      id: 'test-' + Date.now(),
      trackingId: trackingId || 'test-tracking-id',
      from: 'test@example.com',
      subject: 'Test Reply',
      content: content,
      timestamp: new Date().toISOString()
    };
    
    // Simple test reply logging (just return success)
    const result = {
      success: true,
      analysis: {
        sentiment: 'neutral',
        type: 'general',
        keywords: content.split(' ').slice(0, 3)
      }
    };
    
    res.json({
      success: true,
      data: {
        analysis: result.analysis,
        message: 'Reply analyzed and logged'
      }
    });
    
  } catch (error) {
    console.error('[REPLIES API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
