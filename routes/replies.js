import express from 'express';
import { replyTracker } from '../utils/zillizReplyTracker.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Get all replies with analytics
router.get('/replies', async (req, res) => {
  try {
    console.log('[REPLIES API] Getting all replies');
    
    // Try to get from local file first
    const logPath = path.join(process.cwd(), 'email_replies.json');
    let localReplies = [];
    
    try {
      const existingData = await fs.readFile(logPath, 'utf8');
      localReplies = JSON.parse(existingData);
    } catch (error) {
      console.log('[REPLIES API] No local replies file found');
    }
    
    // Get reply stats from Zilliz
    const stats = await replyTracker.getReplyStats();
    
    res.json({
      success: true,
      data: {
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
    
    // Get stats for this tracking ID
    const stats = await replyTracker.getReplyStats(trackingId);
    
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
    
    const stats = await replyTracker.getReplyStats();
    
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
    
    const result = await replyTracker.logReply(testReplyData);
    
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
