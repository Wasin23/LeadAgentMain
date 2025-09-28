// ...existing code...
import express from 'express';
const router = express.Router();
import { authenticateToken } from '../middleware/jwt.js';

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);

import { chatWithAgent } from '../src/langchainAgent.js';
import { createResearchSession } from '../src/researchAgent.js';
import fs from 'fs';
import { internetSearch } from '../tools/internetSearch.js';

// Active research sessions
const activeResearchSessions = new Map();

// Simple in-memory chat history store (for demo; use DB for production)
const userHistories = {};

// AI-powered recommendations endpoint
router.post('/analyze', async (req, res) => {
  try {
    const { investors, summary, topic } = req.body;
    console.log('[ANALYZE] Received investors:', investors);
    console.log('[ANALYZE] Received summary:', summary);
    console.log('[ANALYZE] Received topic:', topic);

    // Compose a prompt for the AI to summarize all data found
    let summaryText = '';
    if (Array.isArray(summary) && summary.length > 0) {
      summaryText += 'Top relevant info from search results:\n';
      summary.forEach((item, idx) => {
        summaryText += `- ${item.title || ''} (${item.link || ''}): ${item.snippet || ''}\n`;
      });
    }
    if (Array.isArray(investors) && investors.length > 0) {
      summaryText += '\nInvestor results:\n';
      investors.forEach((inv, idx) => {
        summaryText += `- ${inv}\n`;
      });
    }

    const prompt = `You are an expert startup analyst. Given the following data from a deep search on the topic: "${topic}", provide a concise summary of the most important findings and actionable next steps.\n\n${summaryText}\n\nReturn your answer as HTML <ul> and <li> elements for display in a sidebar. If there are no investors, focus on summarizing the key findings and what actions the user should take next.`;

    // Use the same chatWithAgent function for AI analysis
    let aiResponse;
    try {
      aiResponse = await chatWithAgent(prompt, []);
      console.log('[ANALYZE] AI response:', aiResponse);
    } catch (err) {
      console.error('[AI Analyze Error]', err);
      return res.json({ recommendations: '<li>AI analysis failed.</li>' });
    }

    // If the AI returns plain text, wrap in <li>
    let recommendations = aiResponse;
    if (!/<ul|<li/i.test(recommendations)) {
      recommendations = `<li>${recommendations}</li>`;
    }
    res.json({ recommendations });
  } catch (err) {
    console.error('[Analyze Fatal Error]', err);
    res.status(500).json({ recommendations: '<li>Error generating recommendations.</li>' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userInput } = req.body;
    const userId = req.user.userId; // Get from JWT token
    console.log('[CHAT ROUTE] Received request - userId:', userId, 'userInput length:', userInput?.length);
    if (!userInput) {
      return res.status(400).json({ error: 'Missing userInput' });
    }
    
    // Get or initialize chat history for this user
    if (!userHistories[userId]) userHistories[userId] = [];
    const chatHistory = userHistories[userId];

    // Normal chat with AI agent - NOW WITH WORKING EMAIL FUNCTIONALITY AND USER-SPECIFIC SETTINGS
    const result = await chatWithAgent(userInput, chatHistory, userId);
    
    // Handle both old string format and new object format
    let response, thinking;
    if (typeof result === 'object' && result.response) {
      response = result.response;
      thinking = result.thinking;
    } else {
      // Fallback for old string format
      response = result;
      thinking = 'AI processed your request and generated a response.';
    }
    
    chatHistory.push({ input: userInput, output: response });
    userHistories[userId] = chatHistory;

    res.json({ response, thinking });
  } catch (err) {
    console.error('Error in /chat route:', err);
    if (err && err.stack) {
      console.error('Stack trace:', err.stack);
    }
    res.status(500).json({ error: 'Internal server error', details: err && err.message ? err.message : err });
  }
});

// Endpoint to clear chat history (for testing/demo purposes)
router.post('/clear', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    // Clear the chat history for this user
    userHistories[userId] = [];
    console.log('[BACKEND] Cleared chat history for userId:', userId);
    
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    console.error('Error clearing chat history:', err);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Auto-greeting initialization endpoint
router.post('/init', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    
    // Get or initialize chat history for this user
    if (!userHistories[userId]) userHistories[userId] = [];
    
    const chatHistory = userHistories[userId];
    console.log('[BACKEND] Init request for userId:', userId, 'existing history length:', chatHistory.length);
    
    // Only send greeting if this is a fresh session (no previous chat history)
    if (chatHistory.length === 0) {
      console.log('[BACKEND] New session, sending greeting');
      // Use a concise, predefined welcome message
      const greetingResponse = "👋 Hello! I'm ExaMark, the official AI assistant for Exabits. I'm here to help you with questions about Exabits' AI-powered HPC solutions, our H100/H200 GPU infrastructure, and assist with research, analysis, and outreach. What can I help you with today?";
      
      // Add the greeting to chat history
      chatHistory.push({ input: '[System Init]', output: greetingResponse });
      userHistories[userId] = chatHistory;
      
      return res.json({ 
        greeting: greetingResponse,
        isNewSession: true 
      });
    } else {
      console.log('[BACKEND] Returning user, sending existing history');
      // Return the existing chat history for returning users
      return res.json({ 
        greeting: null,
        isNewSession: false,
        chatHistory: chatHistory
      });
    }
  } catch (err) {
    console.error('Error in /init route:', err);
    res.status(500).json({ error: 'Failed to initialize chat', details: err.message });
  }
});

// Research Agent Endpoints (Legacy - Commented Out)
/*
// Simple test endpoint first
router.post('/research/test', (req, res) => {
  res.json({ success: true, message: 'Research endpoints are working!' });
});

// Start a new research session
router.post('/research/start', async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    if (!query || !sessionId) {
      return res.status(400).json({ error: 'Missing query or sessionId' });
    }

    console.log(`[Research] Starting session ${sessionId} with query: ${query}`);

    const { agent } = await createResearchSession(sessionId, query);
    
    // Set up real-time progress updates
    agent.onProgress((progress) => {
      // Store progress for SSE endpoint
      activeResearchSessions.set(sessionId, progress);
      console.log(`[Research] Progress update:`, progress);
    });

    // Start research in background
    agent.research(query).then(result => {
      console.log(`[Research] Session ${sessionId} completed:`, result.success ? 'SUCCESS' : 'FAILED');
      // Final result stored in session
      activeResearchSessions.set(sessionId, {
        ...activeResearchSessions.get(sessionId),
        finalResult: result,
        completed: true
      });
    }).catch(err => {
      console.error(`[Research] Session ${sessionId} failed:`, err);
      activeResearchSessions.set(sessionId, {
        status: 'failed',
        error: err.message,
        completed: true
      });
    });

    res.json({ 
      success: true, 
      sessionId,
      message: 'Research started. Use /research/progress to track status.'
    });

  } catch (err) {
    console.error('Research start error:', err);
    res.status(500).json({ error: err.message });
  }
});
*/
// Get research progress (SSE endpoint)
router.get('/research/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial status
  const currentProgress = activeResearchSessions.get(sessionId);
  if (currentProgress) {
    res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
  }

  // Set up periodic updates
  const interval = setInterval(() => {
    const progress = activeResearchSessions.get(sessionId);
    if (progress) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
      
      // Close connection when completed
      if (progress.completed || progress.status === 'completed' || progress.status === 'failed') {
        res.write(`event: end\ndata: ${JSON.stringify(progress)}\n\n`);
        clearInterval(interval);
        res.end();
      }
    }
  }, 1000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// Get research results
router.get('/research/results/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = activeResearchSessions.get(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (sessionData.finalResult) {
      res.json(sessionData.finalResult);
    } else {
      res.json({ 
        success: false, 
        message: 'Research still in progress',
        progress: sessionData 
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resume a research session
router.post('/research/resume/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agent } = await createResearchSession(sessionId);
    
    const result = await agent.resume();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deep Research Endpoint - Multi-Source Research with Wikipedia, arXiv, GitHub
router.post('/research/deep', async (req, res) => {
  try {
    const { query, mode, limit } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing required field: query' });
    }

    console.log(`[DeepResearch] Starting multi-source research for: "${query}" (mode: ${mode || 'fresh'})`);

    // Import the deep research tool
    const { deepResearch } = await import('../tools/deepResearch.js');
    
    // Configure options
    const options = {
      mode: mode || 'fresh',
      limit: limit || 15
    };

    // Execute deep research
    const userId = req.user?.userId;
    const result = await deepResearch(query, options, userId);
    
    console.log(`[DeepResearch] Completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.success) {
      const numSources = Array.isArray(result.sources) ? result.sources.length : 0;
      const numTypes = result.metadata && result.metadata.sourceBreakdown ? Object.keys(result.metadata.sourceBreakdown).length : 0;
      console.log(`[DeepResearch] Found ${numSources} sources across ${numTypes} source types`);
    }

    res.json(result);
    
  } catch (err) {
    console.error('[DeepResearch] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      sources: [],
      summary: "Deep research failed due to technical issues. Please try again."
    });
  }
});

// Deep Research with Real-time Progress Updates
router.post('/research/deep-stream', async (req, res) => {
  console.log(`[DeepResearch] Route hit - User: ${req.user?.userId || 'unknown'}`);
  
  try {
    const { query, mode, limit } = req.body;
    
    if (!query) {
      console.log(`[DeepResearch] ERROR: Missing query parameter`);
      return res.status(400).json({ error: 'Missing required field: query' });
    }

    console.log(`[DeepResearch] Starting streamed research for: "${query}" (mode: ${mode || 'fresh'}) - User: ${req.user?.userId}`);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Import the deep research tool
    const { deepResearch } = await import('../tools/deepResearch.js');
    
    // Configure options with progress callback
    const options = {
      mode: mode || 'fresh',
      limit: limit || 15,
      progressCallback: (progress) => {
        console.log(`[DeepResearch] Progress: ${progress.stage} - ${progress.progress}% - ${progress.message}`);
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
    };

    // Execute deep research with progress updates
    const userId = req.user?.userId;
    const result = await deepResearch(query, options, userId);
    
    console.log(`[DeepResearch] Completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Send final result
    res.write(`data: ${JSON.stringify({ 
      stage: 'complete', 
      progress: 100, 
      message: 'Research completed!', 
      result 
    })}\n\n`);
    
    res.end();
    
  } catch (err) {
    console.error('[DeepResearch] Stream Error:', err);
    res.write(`data: ${JSON.stringify({ 
      stage: 'error', 
      progress: 0, 
      message: 'Research failed: ' + err.message,
      error: err.message 
    })}\n\n`);
    res.end();
  }
});

// Get user's research history
router.get('/research/history', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getUserResearchHistory } = await import('../tools/deepResearch.js');
    const userHistory = getUserResearchHistory(userId);

    res.json({
      success: true,
      userId: userId,
      totalQueries: userHistory.results.length,
      lastActivity: userHistory.lastActivity,
      history: userHistory.results.map((result, index) => ({
        id: index + 1,
        query: result.query,
        timestamp: result.timestamp,
        totalSources: result.totalSources,
        summary: result.summary.substring(0, 200) + (result.summary.length > 200 ? '...' : '') // Truncated summary
      }))
    });

  } catch (err) {
    console.error('[Research History] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message
    });
  }
});

export default router;
