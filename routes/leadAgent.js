import express from 'express';
import { leadContactAgent } from '../agent/leadContactAgent.js';
import { AgentSettingsManager } from '../utils/agentSettingsManager.js';

const router = express.Router();
const agentSettings = new AgentSettingsManager();

// Start the Lead Contact Agent
router.post('/start', async (req, res) => {
  try {
    console.log('[LEAD AGENT API] Starting Lead Contact Agent...');
    const { minutes } = req.body; // Optional custom interval in minutes
    
    const result = await leadContactAgent.start(minutes);
    
    res.json({
      success: result.success,
      message: result.message,
      data: {
        currentCycle: result.currentCycle,
        nextCycleIn: result.nextCycleIn,
        intervalMinutes: result.intervalMinutes,
        customInterval: result.customInterval,
        testingMode: result.testingMode
      }
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error starting agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting Lead Contact Agent',
      error: error.message
    });
  }
});

// Set custom cycle interval
router.post('/set-interval', async (req, res) => {
  try {
    const { minutes } = req.body;
    
    if (!minutes || typeof minutes !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid number of minutes',
        example: { minutes: 30 }
      });
    }
    
    console.log(`[LEAD AGENT API] Setting custom cycle interval to ${minutes} minutes...`);
    const result = await leadContactAgent.setCycleInterval(minutes);
    
    res.json({
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
    console.log('[LEAD AGENT API] Resetting to default cycle interval...');
    const result = await leadContactAgent.resetCycleInterval();
    
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
    console.log('[LEAD AGENT API] Stopping Lead Contact Agent...');
    const result = await leadContactAgent.stop();
    
    res.json({
      success: result.success,
      message: result.message,
      data: {
        cyclesCompleted: result.cyclesCompleted
      }
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error stopping agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Error stopping Lead Contact Agent',
      error: error.message
    });
  }
});

// Get status of the Lead Contact Agent
router.get('/status', async (req, res) => {
  try {
    const status = await leadContactAgent.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error getting status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting agent status',
      error: error.message
    });
  }
});

// Reset the Lead Contact Agent (clears both state and leads database)
router.post('/reset', async (req, res) => {
  try {
    console.log('[LEAD AGENT API] Resetting Lead Contact Agent...');
    const result = await leadContactAgent.resetAgent();
    
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
    console.log('[LEAD AGENT API] Force running cycle...');
    const result = await leadContactAgent.runCycle();
    
    res.json({
      success: result.success,
      message: result.success ? 'Cycle completed successfully' : 'Cycle failed',
      data: result
    });
  } catch (error) {
    console.error('[LEAD AGENT API] Error running cycle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error running cycle',
      error: error.message
    });
  }
});

// Real-time progress streaming via Server-Sent Events
router.get('/progress-stream', (req, res) => {
  console.log('[LEAD AGENT API] Starting progress stream...');
  
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
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send current status immediately
  leadContactAgent.getStatus().then(status => {
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

  // Add event listener to the agent for progress updates
  leadContactAgent.on('progress', progressListener);

  // Handle client disconnect
  req.on('close', () => {
    console.log('[LEAD AGENT API] Progress stream client disconnected');
    leadContactAgent.removeListener('progress', progressListener);
  });

  req.on('aborted', () => {
    console.log('[LEAD AGENT API] Progress stream aborted');
    leadContactAgent.removeListener('progress', progressListener);
  });
});

// Agent Settings Endpoints

// Get current agent settings
router.get('/settings', async (req, res) => {
  try {
    console.log('[AGENT SETTINGS] Loading agent settings...');
    const settings = await agentSettings.getSettings();
    
    res.json({
      success: true,
      settings: settings,
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
    console.log('[AGENT SETTINGS] Saving agent settings...');
    console.log('[AGENT SETTINGS] Settings data:', req.body);
    
    const result = await agentSettings.updateSettings(req.body);
    
    if (result.success) {
      res.json({
        success: true,
        settings: result.settings,
        message: 'Agent settings saved successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to save agent settings'
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
    console.log('[AGENT SETTINGS] Resetting agent settings to defaults...');
    const result = await agentSettings.resetToDefaults();
    
    if (result.success) {
      res.json({
        success: true,
        settings: result.settings,
        message: 'Agent settings reset to defaults successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to reset agent settings'
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

export default router;
