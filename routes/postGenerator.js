import express from 'express';
import { postGeneratorAgent } from '../agent/postGeneratorAgent.js';

const router = express.Router();

// Generate a single post
router.post('/generate', async (req, res) => {
  try {
    const { topic, tone = 'professional' } = req.body;
    
    console.log('[POST GENERATOR API] Generating single post:', { topic, tone });
    
    const result = await postGeneratorAgent.generatePost(topic, tone);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Post generated successfully',
        post: result.post
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate post',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[POST GENERATOR API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate multiple posts
router.post('/generate-batch', async (req, res) => {
  try {
    const { count = 3, topics = [], tone = 'professional' } = req.body;
    
    console.log('[POST GENERATOR API] Generating batch:', { count, topics, tone });
    
    const result = await postGeneratorAgent.generateMultiplePosts(count, topics, tone);
    
    res.json({
      success: true,
      message: `Generated ${result.count} posts`,
      posts: result.posts,
      count: result.count
    });
  } catch (error) {
    console.error('[POST GENERATOR API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all posts
router.get('/posts', async (req, res) => {
  try {
    const posts = await postGeneratorAgent.getAllPosts();
    
    res.json({
      success: true,
      posts: posts,
      count: posts.length
    });
  } catch (error) {
    console.error('[POST GENERATOR API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await postGeneratorAgent.getStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('[POST GENERATOR API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Approve post
router.post('/approve/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const result = await postGeneratorAgent.approvePost(postId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('[POST GENERATOR API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reject post
router.post('/reject/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const result = await postGeneratorAgent.rejectPost(postId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('[POST GENERATOR API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
