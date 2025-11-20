import express from 'express';
import { getUserAgent } from '../agent/reasoningLeadAgent.js';
import { AgentSettingsManager } from '../utils/agentSettingsManager.js';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);
const agentSettings = new AgentSettingsManager();
const awsManager = new AWSManager();

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
    // Reduced logging for polling endpoint
    
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
    
    // Also clear issues/alerts
    console.log('[LEAD AGENT API] Clearing issues and alerts for user:', userId);
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(userId);
    let deletedIssuesCount = 0;
    for (const issue of issues) {
      const deleteResult = await awsManager.deleteIssue(userId, issue.issueId);
      if (deleteResult.success) {
        deletedIssuesCount++;
      }
    }
    console.log(`[LEAD AGENT API] Cleared ${deletedIssuesCount} issues/alerts`);
    
    res.json({
      success: result.success,
      message: result.message,
      issuesCleared: deletedIssuesCount
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

// Get current search status for all agents
router.get('/current-search', async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('[LEAD AGENT API] Getting current search status for user:', userId);
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    // Get all agent states for this user
    const result = await awsManager.getAllAgentStates(userId);
    
    if (!result.success) {
      return res.json({ success: true, searches: {} });
    }
    
    // Extract current search info from agent states
    const searches = {};
    for (const state of result.states || []) {
      if (state.currentSearchIndustry && state.currentSearchPosition) {
        searches[state.agentId] = {
          industry: state.currentSearchIndustry,
          position: state.currentSearchPosition,
          source: state.searchSource || 'base',
          progress: `${state.leadsFoundWithCurrentPair || 0}/20`,
          cycleOffset: state.cycleOffset || 0
        };
      }
    }
    
    res.json({ success: true, searches });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting current search:', error);
    res.json({ success: true, searches: {} });
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
        personality: agentSettings.personality, // Include personality data
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

// Update agent special instructions
router.put('/instructions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId, instructions } = req.body;
    
    console.log('[AGENT INSTRUCTIONS] Updating instructions for agent:', agentId);
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'agentId is required'
      });
    }
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    // Load current settings
    const currentSettings = await userAgent.awsManager.getLeadAgentSettings(userId, agentId);
    
    // Update only the specialInstructions field
    const updatedSettings = {
      ...currentSettings,
      specialInstructions: instructions || ''
    };
    
    // Save updated settings
    await userAgent.awsManager.saveLeadAgentSettings(userId, agentId, updatedSettings);
    
    res.json({
      success: true,
      message: 'Instructions updated successfully'
    });
  } catch (error) {
    console.error('[AGENT INSTRUCTIONS] Error updating instructions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to update instructions'
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

// Clear agent data (state, search history, cycle logs) - used by reset button
router.delete('/agent-data', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId || 'reasoning-lead-agent';
    console.log(`🗑️ [CLEAR AGENT DATA] Clearing data for agent: ${agentId}, user: ${userId}`);
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    // Delete agent state
    await awsManager.deleteAgentState(userId, agentId);
    console.log(`✅ Deleted agent state for ${agentId}`);
    
    // Delete search history
    const searchResult = await awsManager.deleteSearchHistory(userId, agentId);
    console.log(`✅ Deleted ${searchResult.deletedCount} search history entries`);
    
    // Delete cycle logs
    const cycleResult = await awsManager.deleteCycleLogs(userId, agentId);
    console.log(`✅ Deleted ${cycleResult.deletedCount} cycle logs`);
    
    res.json({
      success: true,
      message: 'Agent data cleared successfully',
      deleted: {
        state: true,
        searchHistory: searchResult.deletedCount,
        cycleLogs: cycleResult.deletedCount
      }
    });
  } catch (error) {
    console.error('[CLEAR AGENT DATA] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
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

// Get cycle logs for analytics
router.get('/cycle-logs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId || null; // Optional: filter by specific agent
    const limit = parseInt(req.query.limit) || 100;
    
    console.log('📊 [LEAD AGENT API] Getting cycle logs for user:', userId, agentId ? `agentId: ${agentId}` : '(all agents)');
    
    // Get agent instance to access AWS manager
    const userAgent = getUserAgent(userId, agentId || 'reasoning-lead-agent');
    const cycleLogs = await userAgent.awsManager.getCycleLogs(userId, agentId, limit);
    
    res.json({
      success: true,
      cycleLogs,
      count: cycleLogs.length
    });
  } catch (error) {
    console.error('❌ [LEAD AGENT API] Error getting cycle logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cycle logs',
      error: error.message
    });
  }
});

// Get API usage stats for a specific agent
router.get('/api-usage', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId } = req.query;
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required'
      });
    }
    
    const userAgent = getUserAgent(userId, agentId);
    const result = await userAgent.awsManager.getAgentApiUsage(agentId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting API usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting API usage',
      error: error.message
    });
  }
});

// Get total API usage for user (all agents)
router.get('/api-usage/total', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userAgent = getUserAgent(userId, 'reasoning-lead-agent');
    const result = await userAgent.awsManager.getUserApiUsage(userId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting total API usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting total API usage',
      error: error.message
    });
  }
});

// Cache for API usage time series (2 minute TTL)
const apiUsageTimeSeriesCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Get API usage time series for graphing
router.get('/api-usage/timeseries', async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.query.days) || 7;
    const interval = req.query.interval || 'day'; // minute, hour, day, month
    
    // Check cache
    const cacheKey = `${userId}-${days}-${interval}`;
    const cached = apiUsageTimeSeriesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[LEAD AGENT API] Returning cached API usage time series');
      return res.json({
        success: true,
        ...cached.data,
        cached: true
      });
    }
    
    const userAgent = getUserAgent(userId, 'reasoning-lead-agent');
    const result = await userAgent.awsManager.getApiUsageTimeSeries(userId, days, interval);
    
    // Cache the result
    apiUsageTimeSeriesCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });
    
    // Cleanup old cache entries (keep last 100)
    if (apiUsageTimeSeriesCache.size > 100) {
      const firstKey = apiUsageTimeSeriesCache.keys().next().value;
      apiUsageTimeSeriesCache.delete(firstKey);
    }
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting API usage time series:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting API usage time series',
      error: error.message
    });
  }
});

// Get user's API rate limit settings
router.get('/rate-limits', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const settings = await awsManager.getUserSettings(userId);
    
    res.json({
      success: true,
      rateLimits: settings?.apiRateLimits || {}
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting rate limits:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting rate limits',
      error: error.message
    });
  }
});

// Update user's API rate limit settings
router.post('/rate-limits', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rateLimits } = req.body;
    
    // Get existing settings
    const settings = await awsManager.getUserSettings(userId) || {};
    
    // Update rate limits
    settings.apiRateLimits = rateLimits;
    
    // Save settings (returns true on success, throws on error)
    await awsManager.saveUserSettings(userId, settings);
    
    res.json({
      success: true,
      message: 'Rate limits updated successfully',
      rateLimits: settings.apiRateLimits
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error updating rate limits:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating rate limits',
      error: error.message
    });
  }
});

export default router;