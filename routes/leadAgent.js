import express from 'express';
import { leadContactAgent } from '../agent/leadContactAgent.js';

const router = express.Router();

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
    res.status(500).json({
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
    const result = leadContactAgent.setCycleInterval(minutes);
    
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
    res.status(500).json({
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
    const result = leadContactAgent.resetCycleInterval();
    
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: 'Error getting agent status',
      error: error.message
    });
  }
});

// Reset the Lead Contact Agent (clears state but keeps leads database)
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: 'Error running cycle',
      error: error.message
    });
  }
});

export default router;
