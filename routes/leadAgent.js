import express from 'express';
import { getUserAgent } from '../agent/reasoningLeadAgent.js';
import { AgentSettingsManager } from '../utils/agentSettingsManager.js';
import { authenticateToken } from '../middleware/jwt.js';
import { checkPaymentStatus } from '../middleware/paymentStatus.js';
import AWSManager from '../utils/awsManager.js';
import { ZillizLeadMemory } from '../utils/zillizLeadMemory.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const router = express.Router();

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);

// Apply payment status check to agent operations
router.use(checkPaymentStatus);

const agentSettings = new AgentSettingsManager();
const awsManager = new AWSManager();
const leadMemory = new ZillizLeadMemory();

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
    
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);

    // Block normal start if this agent is already reserved for Auditor / CRM mode
    if (userAgent.isCrmMode && userAgent.isRunning) {
      return res.status(409).json({
        success: false,
        message: 'This agent is currently reserved for Auditor (CRM) mode and cannot be started normally. Stop the auditor first.',
        isCrmMode: true,
        isActive: true,
      });
    }
    
    const result = await userAgent.start(minutes, userId);
    
    // Update agent status in database if start was successful
    if (result.success || result.isActive) {
      try {
        const { getUserById } = await import('../lib/userManager.js');
        const user = await getUserById(userId);
        
        if (user && user.activeAgents) {
          const updatedAgents = user.activeAgents.map(agent => 
            agent.agentId === agentId 
              ? { ...agent, status: 'running', lastRun: new Date().toISOString() }
              : agent
          );
          
          const awsManager = (await import('../utils/awsManager.js')).default;
          const awsManagerInstance = new awsManager();
          await awsManagerInstance.updateUser(userId, { activeAgents: updatedAgents });
        }
      } catch (dbError) {
        console.error('⚠️ [LEAD AGENT API] Failed to update agent status in database:', dbError);
        // Continue anyway - agent is running even if DB update failed
      }
    }
    
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

// Start agent in CRM mode — skip Apollo, process a provided contact list directly
router.post('/start-from-crm', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId = 'reasoning-lead-agent', contacts = [] } = req.body || {};

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ success: false, message: 'No contacts provided' });
    }

    const userAgent = getUserAgent(userId, agentId);
    const result = await userAgent.startFromCRM(contacts, null, userId);

    if (result.success || result.isActive) {
      try {
        const { getUserById } = await import('../lib/userManager.js');
        const user = await getUserById(userId);
        if (user && user.activeAgents) {
          const updatedAgents = user.activeAgents.map(agent =>
            agent.agentId === agentId
              ? { ...agent, status: 'running', mode: 'crm', lastRun: new Date().toISOString() }
              : agent
          );
          const awsManager = (await import('../utils/awsManager.js')).default;
          const awsManagerInstance = new awsManager();
          await awsManagerInstance.updateUser(userId, { activeAgents: updatedAgents });
        }
      } catch (dbError) {
        console.error('⚠️ [CRM START] Failed to update agent status in DB:', dbError);
      }
    }

    return res.json({
      success: result.success,
      message: result.message,
      isActive: result.isActive,
      contactCount: contacts.length
    });
  } catch (error) {
    console.error('❌ [CRM START] Error:', error);
    return res.status(500).json({ success: false, message: error.message, isActive: false });
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
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    const result = await userAgent.stop();
    
    // Update agent status in database if stop was successful
    if (result.success || !result.isActive) {
      try {
        const { getUserById } = await import('../lib/userManager.js');
        const user = await getUserById(userId);
        
        if (user && user.activeAgents) {
          const updatedAgents = user.activeAgents.map(agent => 
            agent.agentId === agentId 
              ? { ...agent, status: 'idle', mode: null }
              : agent
          );
          
          const awsManager = (await import('../utils/awsManager.js')).default;
          const awsManagerInstance = new awsManager();
          await awsManagerInstance.updateUser(userId, { activeAgents: updatedAgents });
          
          // Broadcast agent stop to all SSE clients for real-time UI update
          try {
            const { broadcastActivity } = await import('./monitoring.js');
            const agent = user.activeAgents.find(a => a.agentId === agentId);
            broadcastActivity({
              type: 'agent_stopped',
              agentId: agentId,
              agentName: agent?.name || 'Agent',
              userId: userId,
              timestamp: new Date().toISOString(),
              isActive: false,
              status: 'idle',
              message: 'Agent stopped'
            });
          } catch (broadcastError) {
            console.error('⚠️ [LEAD AGENT API] Failed to broadcast agent stop:', broadcastError.message);
          }
        }
      } catch (dbError) {
        console.error('⚠️ [LEAD AGENT API] Failed to update agent status in database:', dbError);
        // Continue anyway - agent is stopped even if DB update failed
      }
    }
    
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
        ...agentSettings,
        agentId,
        personality: agentSettings.personality, // Include personality data
        userSettings: agentSettings,
        emailSettings: agentSettings.emailBuilder || agentSettings,
        leadGeneration: agentSettings,
        emailBuilder: agentSettings.emailBuilder || agentSettings,
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

    const user = await awsManager.getUserById(userId);
    const maxConcurrency = user?.maxConcurrency || 1;
    if (req.body?.concurrencyLevel && Number(req.body.concurrencyLevel) > maxConcurrency) {
      return res.status(400).json({
        success: false,
        error: `Your current plan allows up to ${maxConcurrency} concurrent worker${maxConcurrency !== 1 ? 's' : ''}.`,
        message: 'Failed to save agent settings'
      });
    }
    
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

// === QUALIFICATION RUBRICS (per keyword+position combo) ===

// List all AI-generated qualification rubrics for this user, for the settings UI's
// "Who and what we want out of this person and this industry" section.
router.get('/rubrics', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await leadMemory.listRubrics(userId);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    res.json({ success: true, rubrics: result.rubrics });
  } catch (error) {
    console.error('[RUBRICS] Error listing rubrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a rubric's criteria/weights (user edits, once unlocked in the UI). Keeps
// the same sourceInstructionsHash as the existing record so the edit is treated as
// current — it won't get silently overwritten by the auto-regeneration gate unless
// the underlying campaign instructions actually change.
router.put('/rubrics/update', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId = 'reasoning-lead-agent', keyword, position, criteria } = req.body || {};

    if (!keyword || !position || !Array.isArray(criteria)) {
      return res.status(400).json({ success: false, error: 'keyword, position, and criteria[] are required' });
    }

    const existing = await leadMemory.getRubric(userId, keyword, position);
    const sourceInstructionsHash = existing?.sourceInstructionsHash || '';

    // weight is a raw signed log-likelihood-ratio (see qualifyLead()'s scoring
    // model) — NOT a share of 100. No normalization here; only validate it's a
    // finite number so a bad client payload can't inject NaN into the score.
    const cleanedCriteria = criteria.map(c => ({
      criterion: c.criterion || '',
      weight: Number.isFinite(Number(c.weight)) ? Number(c.weight) : 0,
      justification: c.justification || ''
    }));

    const rubric = { criteria: cleanedCriteria, icpSummary: existing?.icpSummary || '' };
    const stored = await leadMemory.storeRubric(userId, agentId, keyword, position, rubric, sourceInstructionsHash, rubric.icpSummary);

    if (!stored.success) {
      return res.status(500).json({ success: false, error: stored.error });
    }
    res.json({ success: true, version: stored.version, criteria: cleanedCriteria });
  } catch (error) {
    console.error('[RUBRICS] Error updating rubric:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset a rubric to auto-generated — deletes the stored record; the next lead
// search for this combo will trigger fresh grounded research to rebuild it.
router.post('/rubrics/reset', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { keyword, position } = req.body || {};

    if (!keyword || !position) {
      return res.status(400).json({ success: false, error: 'keyword and position are required' });
    }

    const result = await leadMemory.deleteRubric(userId, keyword, position);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    res.json({ success: true, message: 'Rubric reset — will be rebuilt via research on the next search for this combo' });
  } catch (error) {
    console.error('[RUBRICS] Error resetting rubric:', error);
    res.status(500).json({ success: false, error: error.message });
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
    
    // Get agent-specific instance
    const userAgent = getUserAgent(userId, agentId);
    
    // Get the agent's operation logs and reasoning history
    const agentLogs = userAgent.getOperationLogs ? userAgent.getOperationLogs() : [];
    const agentMemory = userAgent.memory || {};
    
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
    
    // Delete email tracking/conversations
    console.log(`🗑️ Clearing email tracking for agent ${agentId}...`);
    const events = await awsManager.getEmailTrackingByUser(userId, agentId, 10000);
    let trackingDeleted = 0;
    for (const event of events) {
      try {
        await awsManager.deleteEmailTrackingEvent(event);
        trackingDeleted++;
      } catch (err) {
        console.error(`Failed to delete tracking event:`, err.message);
      }
    }
    console.log(`✅ Deleted ${trackingDeleted} tracking events`);
    
    res.json({
      success: true,
      message: 'Agent data cleared successfully',
      deleted: {
        state: true,
        searchHistory: searchResult.deletedCount,
        cycleLogs: cycleResult.deletedCount,
        trackingEvents: trackingDeleted
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

// Get total API usage for user (all agents) - uses fast summary table
router.get('/api-usage/total', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }
    
    const userAgent = getUserAgent(userId, 'reasoning-lead-agent');
    
    if (!userAgent || !userAgent.awsManager) {
      console.error('[LEAD AGENT API] User agent or AWS manager not initialized for userId:', userId);
      return res.status(500).json({
        success: false,
        message: 'User agent not properly initialized',
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 },
          gmail: { usage: 0, calls: 0, cost: 0 }
        },
        trialCreditsUsed: 0,
        hasPaymentMethod: false,
        outstandingThisMonth: 0
      });
    }
    
    // Use summary table instead of querying all records
    let result = { success: true, stats: {} };
    try {
      result = await userAgent.awsManager.getUserApiUsageSummary(userId);
    } catch (summaryError) {
      console.error('[LEAD AGENT API] Error getting summary:', summaryError);
      result = {
        success: false,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 },
          gmail: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
    
    // Get user to check trial credits and payment status
    let user = null;
    try {
      user = await userAgent.awsManager.getUserById(userId);
    } catch (userError) {
      console.error('[LEAD AGENT API] Error getting user:', userError);
    }
    const trialCreditsUsed = user?.trialCreditsUsed ?? 0;
    const hasPaymentMethod = user?.paymentMethodAdded || false;
    
    // Calculate outstanding (usage minus payments) for ALL months
    let outstandingThisMonth = 0;
    
    try {
      // Check if tables are initialized
      if (!userAgent.awsManager.tables || !userAgent.awsManager.tables.apiUsageSummary) {
        console.error('[LEAD AGENT API] AWS tables not initialized');
        throw new Error('AWS tables not initialized');
      }
      
      // Get ALL usage summaries
      const summaryQuery = new QueryCommand({
        TableName: userAgent.awsManager.tables.apiUsageSummary,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const summaryResult = await userAgent.awsManager.dynamodb.send(summaryQuery);
      const summaries = summaryResult.Items || [];
      
      // Get ALL payments
      const paymentQuery = new QueryCommand({
        TableName: userAgent.awsManager.tables.paymentHistory,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const paymentResult = await userAgent.awsManager.dynamodb.send(paymentQuery);
      const payments = paymentResult.Items || [];
      
      // Calculate outstanding by month: usage - payments for that month
      summaries.forEach(summary => {
        // Calculate total usage cost for this month
        let monthUsage = 0;
        ['apollo', 'openai', 'mailgun', 'zerobounce', 'serper', 'gmail'].forEach(service => {
          if (summary[service]) {
            monthUsage += summary[service].cost || 0;
          }
        });
        
        // Calculate total payments for this month
        let monthPayments = 0;
        payments
          .filter(p => p.status === 'success' && p.billingPeriod)
          .forEach(payment => {
            const paymentMonth = new Date(payment.billingPeriod).toISOString().slice(0, 7);
            if (paymentMonth === summary.month) {
              monthPayments += payment.amount || 0;
            }
          });
        
        // Outstanding = usage - payments (can't be negative)
        const monthOutstanding = Math.max(0, monthUsage - monthPayments);
        outstandingThisMonth += monthOutstanding;
      });
    } catch (monthError) {
      console.error('[LEAD AGENT API] Error calculating outstanding:', monthError);
      // Continue with 0 value
    }
    
    res.json({
      success: true,
      ...result,
      trialCreditsUsed,
      hasPaymentMethod,
      outstandingThisMonth
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

// Get API usage broken down per-agent for billing display
router.get('/api-usage/by-agent', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userAgent = getUserAgent(userId, 'reasoning-lead-agent');
    if (!userAgent?.awsManager) {
      return res.status(500).json({ success: false, message: 'Agent not initialised' });
    }

    // Pull agent list from user record
    const user = await userAgent.awsManager.getUserById(userId);
    const agents = user?.activeAgents || [];

    // Fetch usage for each agent in parallel
    const results = await Promise.all(
      agents.map(async (agent) => {
        const usage = await userAgent.awsManager.getAgentApiUsage(agent.agentId);
        const totalCost = Object.values(usage.stats || {}).reduce((sum, s) => sum + (s.cost || 0), 0);
        return {
          agentId: agent.agentId,
          name: agent.name || `Agent ${agent.agentId.slice(-6)}`,
          totalCost,
          credits: Math.round(totalCost / 0.05),
        };
      })
    );

    res.json({ success: true, agents: results });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting per-agent usage:', error);
    res.status(500).json({ success: false, message: 'Error getting per-agent usage', error: error.message });
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

// Get keyword memory stats
router.get('/memory/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await leadMemory.initialize();
    const stats = await leadMemory.getMemoryStats(userId);
    
    res.json({
      success: stats.success,
      stats: stats.stats || {}
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting memory stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting memory stats',
      error: error.message
    });
  }
});

// Get all keyword performance records
router.get('/memory/keywords', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await leadMemory.initialize();
    const memoryData = await leadMemory.loadKeywordPerformance(userId);
    
    // Convert performanceMap to array for easier display
    const keywords = Object.values(memoryData.performanceMap || {}).map(data => ({
      keyword: data.keyword,
      position: data.position,
      searchCombo: data.searchCombo,
      totalAttempts: data.totalAttempts,
      totalDuplicates: data.totalDuplicates,
      cumulativeDuplicateRate: data.cumulativeDuplicateRate,
      isExhausted: data.isExhausted,
      keywordSource: data.keywordSource,
      lastUpdated: data.lastUpdated
    }));
    
    res.json({
      success: true,
      keywords: keywords,
      count: keywords.length
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting keywords:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting keywords',
      error: error.message
    });
  }
});

// Reset specific keyword combo
router.delete('/memory/keyword/:searchCombo', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { searchCombo } = req.params;
    
    await leadMemory.initialize();
    
    // Delete the specific record
    const deleteResult = await leadMemory.client.delete({
      collection_name: 'lead_agent_memory',
      filter: `user_id == "${userId}" && search_combo == "${searchCombo}"`
    });
    
    res.json({
      success: true,
      message: `Reset ${searchCombo}`,
      deletedCount: deleteResult.delete_cnt || 0
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error resetting keyword:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting keyword',
      error: error.message
    });
  }
});

// Reset all keywords for user
router.delete('/memory/reset-all', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await leadMemory.initialize();
    const result = await leadMemory.resetUserMemory(userId);
    
    res.json({
      success: result.success,
      message: `Reset all keyword memory for user`,
      deletedCount: result.deletedCount || 0
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error resetting all memory:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting memory',
      error: error.message
    });
  }
});

// Test email generation with current settings + mock lead
router.post('/test-email', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId = 'lead-agent', emailSettings } = req.body;
    console.log('[TEST EMAIL] Hit — userId:', userId, 'agentId:', agentId);

    // Create a fresh isolated agent instance so we don't pollute any running agent's memory
    const { ReasoningLeadAgent } = await import('../agent/reasoningLeadAgent.js');
    const testAgent = new ReasoningLeadAgent(userId, agentId);

    // Mock lead in Apollo format
    const mockLead = {
      name: 'Sarah Chen',
      first_name: 'Sarah',
      last_name: 'Chen',
      title: 'VP of Operations',
      email: 'sarah@arclightsolutions.com',
      company: 'Arclight Solutions',
      organization: {
        name: 'Arclight Solutions',
        industry: 'saas',
        estimated_num_employees: 85,
        primary_domain: 'arclightsolutions.com',
      },
    };

    const mockCitedFacts = [
      { text: 'Arclight Solutions raised a $12M Series A to expand their fulfillment automation platform', source: 'https://techcrunch.com', sourceTitle: 'TechCrunch', confidence: 0.9 },
      { text: 'Arclight is actively hiring 8 open operations roles as headcount scales from 60 to 85 employees', source: 'https://linkedin.com', sourceTitle: 'LinkedIn Jobs', confidence: 0.85 },
      { text: 'CEO posted on LinkedIn about scaling challenges in their fulfillment pipeline as team doubled in 12 months', source: 'https://linkedin.com', sourceTitle: 'LinkedIn', confidence: 0.8 },
    ];

    // Mock research — include a phase-3 marker so buildPersonalizedEmail skips runSupportingResearch
    const mockResearch = {
      searches: [
        {
          purpose: 'company_overview',
          webpageInsights: [{ source: 'arclightsolutions.com', title: 'Arclight Solutions', citedFacts: mockCitedFacts }],
        },
        { purpose: 'industry_statistics', webpageInsights: [] },
      ],
      citedFacts: mockCitedFacts,
      totalSources: 2,
    };

    const mockQualification = {
      tier: 'QUALIFIED',
      score: 72,
      qualified: true,
      reasoning: 'Arclight Solutions meets criteria with recent Series A funding and clear operational scaling challenges.',
      aiReport: {
        tier: 'QUALIFIED',
        score: 72,
        confidence: 'MEDIUM',
        qualified: true,
        buyerMotivation: "Arclight just raised $12M Series A and is scaling from 60 to 85 employees. As VP of Ops, Sarah owns the fulfillment pipeline the CEO is publicly struggling with. The funding means budget exists and the hiring spree means the problem is actively getting worse.",
        emailHooks: [
          'Arclight raised a $12M Series A and has 8 open ops roles — classic scaling inflection',
          "CEO posted publicly about fulfillment pipeline challenges as headcount jumped from 60 to 85",
        ],
        emailStrategy: 'moderate personalization',
        citedEvidence: [{ fact: '$12M Series A raised', source: 'TechCrunch', supportsMatch: true }],
        allCitedFacts: mockCitedFacts,
        researchQuality: 'GOOD',
        totalSources: 2,
        tierDescription: 'Good match - Moderate personalization',
      },
    };

    // Seed agent memory
    testAgent.memory.emailSettings = emailSettings;
    testAgent.memory.userSettings = { calendarIntegrationEnabled: false };
    testAgent.memory.lastResearch = mockResearch;
    testAgent.memory.currentQualification = mockQualification;
    testAgent.memory.currentCycle.currentLead = mockLead;

    const result = await testAgent.buildPersonalizedEmail({
      leadData: mockLead,
      researchData: mockResearch,
      qualificationData: mockQualification,
      emailSettings,
    });

    if (!result?.success) {
      return res.status(500).json({ success: false, error: result?.error || 'Email generation failed' });
    }

    // Strip compliance footer for preview — use the sentinel marker we embed before the footer
    const body = (result.email || '')
      .replace(/\n*<!--MERIDIAN_FOOTER-->[\s\S]*$/i, '')
      .trim();

    res.json({
      success: true,
      subject: result.subject,
      body,
    });
  } catch (err) {
    console.error('[TEST EMAIL] Error:', err?.message, err?.stack);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete agent completely
router.delete('/:agentId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId } = req.params;
    
    console.log(`🗑️ [DELETE AGENT] Starting deletion for agent: ${agentId}, user: ${userId}`);
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    // 1. Keep emails - DO NOT delete or reassign them
    // Emails will remain in the queue with their original agentId
    // The frontend will handle displaying orphaned emails
    console.log(`📧 [DELETE AGENT] Keeping emails in queue for agent ${agentId} (orphaned emails)`);
    
    // 2. Delete agent state
    await awsManager.deleteAgentState(userId, agentId);
    console.log(`✅ [DELETE AGENT] Deleted agent state`);
    
    // 3. Delete search history
    const searchResult = await awsManager.deleteSearchHistory(userId, agentId);
    console.log(`✅ [DELETE AGENT] Deleted ${searchResult.deletedCount} search history entries`);
    
    // 4. Delete cycle logs
    const cycleResult = await awsManager.deleteCycleLogs(userId, agentId);
    console.log(`✅ [DELETE AGENT] Deleted ${cycleResult.deletedCount} cycle logs`);
    
    // 5. Delete email tracking/conversations
    const events = await awsManager.getEmailTrackingByUser(userId, agentId, 10000);
    let trackingDeleted = 0;
    for (const event of events) {
      try {
        await awsManager.deleteEmailTrackingEvent(event);
        trackingDeleted++;
      } catch (err) {
        console.error(`Failed to delete tracking event:`, err.message);
      }
    }
    console.log(`✅ [DELETE AGENT] Deleted ${trackingDeleted} tracking events`);
    
    // 6. Delete agent settings
    await awsManager.deleteAgentSettings(userId, agentId);
    console.log(`✅ [DELETE AGENT] Deleted agent settings`);
    
    // 7. Remove agent from user's activeAgents
    const { removeAgentFromUser } = await import('../lib/userManager.js');
    await removeAgentFromUser(userId, agentId);
    console.log(`✅ [DELETE AGENT] Removed agent from user's activeAgents`);
    
    res.json({
      success: true,
      message: 'Agent deleted successfully',
      deleted: {
        state: true,
        searchHistory: searchResult.deletedCount,
        cycleLogs: cycleResult.deletedCount,
        trackingEvents: trackingDeleted,
        settings: true,
        emailsReassigned: 0 // Emails are kept as orphaned, not reassigned
      }
    });
  } catch (error) {
    console.error('[DELETE AGENT] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
