import express from 'express';
import { getUserAgent } from '../agent/reasoningLeadAgent.js';
import { AgentSettingsManager } from '../utils/agentSettingsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);
const agentSettings = new AgentSettingsManager();

// DEBUG: Test route to verify routes are loading
router.get('/test', (req, res) => {
  console.log('[LEAD AGENT] Test route hit!');
  res.json({ message: 'Lead agent routes working!' });
});

// Start the Lead Contact Agent
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { minutes, agentId = 'reasoning-lead-agent' } = req.body || {}; // Get agentId from request body
    console.log('🚀 [LEAD AGENT API] START endpoint called for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    console.log('🔧 [LEAD AGENT API] Got user agent, calling start method...');
    
    const result = await userAgent.start(minutes, userId);
    console.log('✅ [LEAD AGENT API] Start result:', result);
    
    return res.json({
      success: result.success,
      message: result.message,
      isActive: result.isActive,
      data: {
        currentCycle: result.currentCycle,
        nextCycleIn: result.nextCycleIn,
        intervalMinutes: result.intervalMinutes,
        customInterval: result.customInterval,
        testingMode: result.testingMode,
        isActive: result.isActive
      }
    });
  } catch (error) {
    console.error('❌ [LEAD AGENT API] Error starting agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting Lead Contact Agent',
      error: error.message,
      isActive: false
    });
  }
});

// Set custom cycle interval
router.post('/set-interval', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { minutes, agentId = 'reasoning-lead-agent' } = req.body;
    
    if (!minutes || typeof minutes !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid number of minutes',
        example: { minutes: 30 }
      });
    }
    
    console.log(`[LEAD AGENT API] Setting custom cycle interval to ${minutes} minutes for user:`, userId, 'agentId:', agentId);
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    const result = await userAgent.setCycleInterval(minutes);
    
    return res.json({
      success: result.success,
      message: result.message,
      data: {
        intervalMinutes: result.intervalMinutes,
        nextCycleIn: result.nextCycleIn
      }
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error setting interval:', error);
    return res.status(500).json({
      success: false,
      message: 'Error setting cycle interval',
      error: error.message
    });
  }
});

// Reset to default cycle interval
router.post('/reset-interval', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { agentId = 'reasoning-lead-agent' } = req.body || {};
    console.log('[LEAD AGENT API] Resetting to default cycle interval for user:', userId, 'agentId:', agentId);
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    const result = await userAgent.resetCycleInterval();
    
    res.json({
      success: result.success,
      message: result.message,
      data: {
        intervalMinutes: result.intervalMinutes,
        nextCycleIn: result.nextCycleIn
      }
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error resetting interval:', error);
    return res.status(500).json({
      success: false,
      message: 'Error resetting cycle interval',
      error: error.message
    });
  }
});

// Stop the Lead Contact Agent
router.post('/stop', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { agentId = 'reasoning-lead-agent' } = req.body || {};
    console.log('🛑 [LEAD AGENT API] STOP endpoint called for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    console.log('🔧 [LEAD AGENT API] Got user agent, calling stop method...');
    
    const result = await userAgent.stop();
    console.log('✅ [LEAD AGENT API] Stop result:', result);
    
    res.json({
      success: result.success,
      message: result.message,
      isActive: result.isActive,
      data: {
        cyclesCompleted: result.cyclesCompleted,
        isActive: result.isActive
      }
    });
  } catch (error) {
    console.error('❌ [LEAD AGENT API] Error stopping agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Error stopping Lead Contact Agent',
      error: error.message,
      isActive: true // Assume still running on error
    });
  }
});

// Get status of the Lead Contact Agent
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const agentId = req.query.agentId || 'reasoning-lead-agent'; // Get agentId from query param
    console.log('📊 [LEAD AGENT API] STATUS endpoint called for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    const status = await userAgent.getStatus();
    
    res.json({
      success: true,
      ...status, // Flatten the status object
      data: status
    });
  } catch (error) {
    console.error('❌ [LEAD AGENT API] Error getting status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting agent status',
      error: error.message,
      isActive: false
    });
  }
});

// Reset the Lead Contact Agent (clears both state and leads database)
router.post('/reset', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { agentId = 'reasoning-lead-agent' } = req.body || {};
    console.log('[LEAD AGENT API] Resetting Lead Contact Agent for user:', userId, 'agentId:', agentId);
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    const result = await userAgent.resetAgent();
    
    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error resetting agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Error resetting Lead Contact Agent',
      error: error.message
    });
  }
});

// Force run a cycle (for testing)
router.post('/run-cycle', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { agentId = 'reasoning-lead-agent' } = req.body || {};
    console.log('[LEAD AGENT API] Force running cycle for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    // Start the cycle asynchronously (don't wait for completion)
    userAgent.runCycle().catch(error => {
      console.error('[LEAD AGENT API] Cycle error (async):', error);
    });
    
    // Respond immediately
    res.json({
      success: true,
      message: 'Cycle started successfully',
      data: { status: 'running' }
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error starting cycle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting cycle',
      error: error.message
    });
  }
});

// Real-time progress streaming via Server-Sent Events
router.get('/progress-stream', (req, res) => {
  console.log('[LEAD AGENT API] Starting progress stream for user:', req.user.userId);
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial status
  const sendProgress = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('[LEAD AGENT API] Error sending progress:', err);
    }
  };

  // Send test message to verify connection
  sendProgress({
    type: 'test',
    message: 'Progress stream connected successfully',
    timestamp: new Date().toISOString()
  });

  // Get agent-specific instance
  const userId = req.user.userId;
  const agentId = req.query.agentId || 'reasoning-lead-agent'; // Get agentId from query param
  const userAgent = getUserAgent(userId, agentId);

  // Send current status immediately
  userAgent.getStatus().then(status => {
    sendProgress({
      type: 'status',
      data: status
    });
  }).catch(err => {
    console.error('[LEAD AGENT API] Error getting initial status:', err);
  });

  // Set up progress listener
  const progressListener = (progressData) => {
    sendProgress({
      type: 'progress',
      data: progressData
    });
  };

  // Add event listener to the user's agent for progress updates
  userAgent.on('progress', progressListener);

  // Handle client disconnect
  req.on('close', () => {
    console.log('[LEAD AGENT API] Progress stream client disconnected');
    userAgent.removeListener('progress', progressListener);
  });

  req.on('aborted', () => {
    console.log('[LEAD AGENT API] Progress stream aborted');
    userAgent.removeListener('progress', progressListener);
  });
});

// Agent Settings Endpoints

// Get current agent settings
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const agentId = req.query.agentId || 'lead-agent'; // Get agentId from query parameter
    console.log('[AGENT SETTINGS] Loading agent settings for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    // Get settings from the reasoning agent's AWS DynamoDB integration with agentId
    const agentSettings = await userAgent.awsManager.getLeadAgentSettings(userId, agentId);
    

    
    // If no agent-specific settings found, get default settings
    if (!agentSettings) {
      const userSettings = await userAgent.getUserSettings();
      const emailSettings = await userAgent.getEmailSettings();
      
      // Combine default settings for the UI
      const combinedSettings = {
        agentId,
        userSettings: userSettings,
        emailSettings: emailSettings,
        leadGeneration: userSettings,
        emailBuilder: emailSettings
      };
      
      res.json({
        success: true,
        settings: combinedSettings,
        message: 'Default agent settings loaded (no custom settings found)'
      });
      return;
    }
    
    // Return the agent-specific settings in the format the frontend expects
    res.json({
      success: true,
      settings: {
        agentId,
        userSettings: agentSettings,
        emailSettings: agentSettings.emailBuilder || agentSettings,
        leadGeneration: agentSettings,
        emailBuilder: agentSettings.emailBuilder || agentSettings,
        ...agentSettings
      },
      message: 'Agent settings loaded successfully'
    });
  } catch (error) {
    console.error('[AGENT SETTINGS] Error loading settings:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to load agent settings'
    });
  }
});

// Save/update agent settings
router.post('/settings', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const agentId = req.body.agentId || req.query.agentId || 'lead-agent'; // Get agentId from body or query
    console.log('[AGENT SETTINGS] Saving agent settings for user:', userId, 'agentId:', agentId);
    console.log('[AGENT SETTINGS] Settings data:', req.body);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    // Use the reasoning agent's AWS manager to save settings with agentId
    const result = await userAgent.awsManager.saveLeadAgentSettings(userId, agentId, req.body);
    
    if (result && result.success) {
      res.json({
        success: true,
        settings: req.body,
        message: 'Agent settings saved successfully'
      });
    } else {
      res.json({
        success: true,
        settings: req.body,
        message: 'Agent settings saved successfully'
      });
    }
  } catch (error) {
    console.error('[AGENT SETTINGS] Error saving settings:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to save agent settings'
    });
  }
});

// Reset agent settings to defaults
router.post('/settings/reset', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { agentId = 'reasoning-lead-agent' } = req.body || {};
    console.log('[AGENT SETTINGS] Resetting agent settings to defaults for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    // Create default settings and save them
    const defaultSettings = {
      companyBranding: {
        agentName: "AI Lead Agent",
        companyName: "Your Company",
        primaryService: "Business Services",
        coreOffering: "Professional Solutions",
        keyAdvantages: ["Quality", "Reliability", "Innovation"],
        expertiseArea: "Business Development"
      },
      companyCriteria: {
        companySizeMin: 50,
        companySizeMax: 500,
        companyIndustries: ["Technology", "Healthcare", "Finance"],
        companyKeywords: []
      },
      contactCriteria: {
        targetPositions: ["CEO", "CTO", "VP", "Director", "Manager"],
        seniorityLevel: "senior"
      },
      geographicSettings: {
        targetLocations: ["United States"],
        leadLimit: 50
      },
      researchFocus: {
        focusAreas: ["company growth", "recent news", "technology stack"],
        researchDepth: "medium"
      },
      emailBuilder: {
        emailTemplate: "professional",
        tone: "professional",
        length: "medium",
        callToAction: "schedule a call",
        personalization: "high",
        customPrompt: ""
      }
    };
    
    // Save default settings
    const result = await userAgent.awsManager.saveLeadAgentSettings(userId, agentId, defaultSettings);
    
    if (result && result.success) {
      res.json({
        success: true,
        settings: defaultSettings,
        message: 'Agent settings reset to defaults successfully'
      });
    } else {
      res.json({
        success: true,
        settings: defaultSettings,
        message: 'Agent settings reset to defaults successfully'
      });
    }
  } catch (error) {
    console.error('[AGENT SETTINGS] Error resetting settings:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to reset agent settings'
    });
  }
});

// Test calendar integration
router.post('/calendar/test', async (req, res) => {
  try {
    console.log('[CALENDAR TEST] Testing calendar integration...');
    const { calendar_link } = req.body;
    
    if (!calendar_link) {
      return res.status(400).json({
        success: false,
        error: 'calendar_link is required',
        message: 'Please provide a calendar link to test'
      });
    }
    
    // Import calendar manager
    const { calendarManager } = await import('../utils/calendarIntegrationManager.js');
    
    const testResult = await calendarManager.testCalendarIntegration(calendar_link);
    
    res.json({
      success: true,
      calendar_test: testResult,
      message: 'Calendar integration test completed successfully'
    });
    
  } catch (error) {
    console.error('[CALENDAR TEST] Error testing calendar integration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to test calendar integration'
    });
  }
});

// Test route for debugging
router.get('/activity-logs-test', (req, res) => {
  console.log('🔍 [TEST] Activity logs test endpoint hit!');
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// Get agent activity logs
router.get('/activity-logs', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const agentId = req.query.agentId || 'reasoning-lead-agent'; // Get agentId from query param
    console.log('🔍 [AGENT LOGS] ===== ACTIVITY LOGS ENDPOINT HIT =====');
    console.log('🔍 [AGENT LOGS] Loading activity logs for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    console.log('🔍 [AGENT LOGS] User agent found:', !!userAgent);
    console.log('🔍 [AGENT LOGS] User agent type:', typeof userAgent);
    
    // Get the agent's operation logs and reasoning history
    const agentLogs = userAgent.getOperationLogs ? userAgent.getOperationLogs() : [];
    const agentMemory = userAgent.memory || {};
    
    console.log(`🔍 [AGENT LOGS] Found ${agentLogs.length} operation logs for user ${userId}`);
    console.log(`🔍 [AGENT LOGS] Raw agent logs:`, JSON.stringify(agentLogs, null, 2));
    console.log(`🔍 [AGENT LOGS] Agent status: isRunning=${userAgent.isRunning}, isActive=${userAgent.isActive}`);
    console.log(`🔍 [AGENT LOGS] Agent has getOperationLogs method:`, typeof userAgent.getOperationLogs);
    console.log(`🔍 [AGENT LOGS] Direct operationLogs array length:`, userAgent.operationLogs?.length || 'undefined');
    
    // Format logs for the frontend
    const formattedLogs = agentLogs.map(log => ({
      id: log.id || Date.now().toString(),
      timestamp: log.timestamp || new Date().toISOString(),
      operation: log.operation || 'Unknown Operation',
      details: log.details || log.message || 'No details available',
      status: log.status || 'completed',
      data: log.data || {}
    }));
    
    // Always add current agent state as a log entry
    formattedLogs.unshift({
      id: 'agent-status',
      timestamp: new Date().toISOString(),
      operation: 'Agent Status', 
      details: `Agent is currently ${userAgent.isRunning ? 'running' : 'stopped'}. Cycle count: ${userAgent.cycleCount || 0}. Logs: ${agentLogs.length}`,
      status: userAgent.isRunning ? 'active' : 'inactive',
      data: {
        isRunning: userAgent.isRunning,
        isActive: userAgent.isActive,
        cycleCount: userAgent.cycleCount,
        startTime: userAgent.startTime,
        totalLogs: agentLogs.length
      }
    });
    
    // If no operation logs exist, add a helpful message
    if (agentLogs.length === 0) {
      formattedLogs.push({
        id: 'no-activity',
        timestamp: new Date().toISOString(),
        operation: 'System Message',
        details: 'No agent activity recorded yet. Start the agent to see reasoning operations and cycles here.',
        status: 'info',
        data: {
          message: 'Click the Start button to begin agent operations'
        }
      });
    }
    
    console.log(`🔍 [AGENT LOGS] Returning ${formattedLogs.length} log entries`);
    console.log('🔍 [AGENT LOGS] Formatted logs:', JSON.stringify(formattedLogs, null, 2));
    
    res.json(formattedLogs);
  } catch (error) {
    console.error('[AGENT LOGS] Error loading activity logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to load agent activity logs'
    });
  }
});

// Get contacted leads history
router.get('/contacted-leads', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId || 'reasoning-lead-agent'; // Get agentId from query param
    const limit = parseInt(req.query.limit) || 50;
    console.log('📊 [CONTACTED LEADS] Getting history for user:', userId, 'agentId:', agentId, 'limit:', limit);
    
    // Get agent-specific instance to access AWS manager
    const userAgent = getUserAgent(userId, agentId);
    
    if (!userAgent.awsManager) {
      return res.status(500).json({
        success: false,
        error: 'AWS manager not available'
      });
    }
    
    const result = await userAgent.awsManager.getContactedLeadsHistory(userId, limit);
    
    if (result.success) {
      res.json({
        success: true,
        contacts: result.contacts,
        count: result.count,
        message: `Found ${result.count} contacted leads`
      });
    } else {
      console.error('❌ [CONTACTED LEADS] Failed to get history:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to get contacted leads history'
      });
    }
    
  } catch (error) {
    console.error('[CONTACTED LEADS] Error getting history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get contacted leads history'
    });
  }
});

// Clear contacted leads database for testing
router.delete('/clear-contacts', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId || 'reasoning-lead-agent'; // Get agentId from query param
    console.log('🗑️ [CLEAR CONTACTS] Clearing contacted leads for user:', userId, 'agentId:', agentId);
    
    // Get agent-specific instance to access AWS manager
    const userAgent = getUserAgent(userId, agentId);
    
    if (!userAgent.awsManager) {
      return res.status(500).json({
        success: false,
        error: 'AWS manager not available'
      });
    }
    
    const result = await userAgent.awsManager.clearContactedLeads(userId);
    
    if (result.success) {
      console.log('✅ [CLEAR CONTACTS] Successfully cleared contacts:', result);
      res.json({
        success: true,
        message: `Successfully cleared ${result.deletedCount} contacted leads`,
        deletedCount: result.deletedCount,
        totalFound: result.totalFound
      });
    } else {
      console.error('❌ [CLEAR CONTACTS] Failed to clear contacts:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to clear contacted leads'
      });
    }
    
  } catch (error) {
    console.error('[CLEAR CONTACTS] Error clearing contacted leads:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear contacted leads database'
    });
  }
});

export default router;