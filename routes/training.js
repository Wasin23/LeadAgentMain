// AI Training routes with Zilliz integration
import express from 'express';
import zillizTraining from '../utils/zillizTraining.js';
import { industryFacts } from '../utils/zillizIndustryFacts.js';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

// Initialize Zilliz connection for a user
router.post('/zilliz/connect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    console.log(`[TRAINING] Connecting to Zilliz for user: ${userId}`);
    
    const result = await zillizTraining.initialize(userId);
    
    if (result.success) {
      console.log(`[TRAINING] Zilliz connected successfully for user: ${userId}`);
      res.json({ 
        success: true, 
        message: 'Zilliz training database connected successfully' 
      });
    } else {
      console.error(`[TRAINING] Zilliz connection failed for user: ${userId}`, result.error);
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Failed to connect to Zilliz' 
      });
    }
    
  } catch (error) {
    console.error('[TRAINING] Zilliz connect error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get Zilliz connection status and analytics
router.get('/zilliz/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const status = zillizTraining.getStatus();
    
    let analytics = null;
    if (status.connected) {
      const analyticsResult = await zillizTraining.getTrainingAnalytics(userId);
      if (analyticsResult.success) {
        analytics = analyticsResult.analytics;
      }
    }
    
    res.json({ 
      success: true, 
      status,
      analytics
    });
    
  } catch (error) {
    console.error('[TRAINING] Zilliz status error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Store training data with embeddings
router.post('/zilliz/store', async (req, res) => {
  try {
    const { userId, text, trainingType, performanceScore, metadata } = req.body;
    
    if (!userId || !text || trainingType === undefined || performanceScore === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, text, trainingType, and performanceScore are required' 
      });
    }

    console.log(`[TRAINING] Storing training data for user: ${userId}, type: ${trainingType}, score: ${performanceScore}`);
    
    const result = await zillizTraining.storeTrainingData({
      text,
      trainingType,
      performanceScore,
      userId,
      metadata: metadata || {}
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Training data stored successfully',
        id: result.id
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Failed to store training data' 
      });
    }
    
  } catch (error) {
    console.error('[TRAINING] Store training data error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Search for similar training examples
router.post('/zilliz/search', async (req, res) => {
  try {
    const { userId, query, options } = req.body;
    
    if (!userId || !query) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and query are required' 
      });
    }

    console.log(`[TRAINING] Searching similar training data for user: ${userId}, query: ${query.substring(0, 50)}...`);
    
    const searchOptions = {
      ...options,
      userId // Filter by user
    };
    
    const result = await zillizTraining.findSimilarTraining(query, searchOptions);
    
    if (result.success) {
      res.json({ 
        success: true, 
        results: result.results
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Failed to search training data' 
      });
    }
    
  } catch (error) {
    console.error('[TRAINING] Search training data error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get comprehensive training analytics
router.get('/zilliz/analytics', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    console.log(`[TRAINING] Getting analytics for user: ${userId}`);
    
    const result = await zillizTraining.getTrainingAnalytics(userId);
    
    if (result.success) {
      res.json({ 
        success: true, 
        analytics: result.analytics
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Failed to get training analytics' 
      });
    }
    
  } catch (error) {
    console.error('[TRAINING] Get analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Disconnect from Zilliz (cleanup)
router.post('/zilliz/disconnect', async (req, res) => {
  try {
    await zillizTraining.disconnect();
    
    res.json({ 
      success: true, 
      message: 'Disconnected from Zilliz training database' 
    });
    
  } catch (error) {
    console.error('[TRAINING] Zilliz disconnect error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ── Industry Facts RAG ─────────────────────────────────────────────────────

// GET /api/training/industry-facts — list facts for industries this user has actually used
router.get('/industry-facts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    let usedIndustries = null;
    if (userId) {
      try {
        const aws = new AWSManager();
        const settings = await aws.getUserSettings(userId);
        usedIndustries = settings?.usedIndustryFacts || null;
      } catch {}
    }
    const result = await industryFacts.getAllFacts(usedIndustries);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/training/industry-facts/:id — delete a single fact
router.delete('/industry-facts/:id', async (req, res) => {
  try {
    const result = await industryFacts.deleteFact(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/training/industry-facts/industry/:name — delete all facts for an industry
router.delete('/industry-facts/industry/:name', async (req, res) => {
  try {
    const result = await industryFacts.deleteIndustry(req.params.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
