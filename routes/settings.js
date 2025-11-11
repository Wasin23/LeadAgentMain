import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/settings/presets
 * Get all settings presets for user
 */
router.get('/presets', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    const userSettings = await awsManager.getUserSettings(userId);
    const presets = userSettings?.settingsPresets || [];
    
    res.json({
      success: true,
      presets
    });
  } catch (error) {
    console.error('Error getting presets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/settings/presets
 * Create a new settings preset
 */
router.post('/presets', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, targetIndustries, targetPositions, companySizeMin, companySizeMax, leadLimit } = req.body;
    
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    const newPreset = {
      id: uuidv4(),
      name,
      targetIndustries,
      targetPositions,
      companySizeMin,
      companySizeMax,
      leadLimit,
      createdAt: new Date().toISOString()
    };
    
    userSettings.settingsPresets = [...(userSettings.settingsPresets || []), newPreset];
    
    await awsManager.saveUserSettings(userId, userSettings);
    
    res.json({
      success: true,
      preset: newPreset
    });
  } catch (error) {
    console.error('Error creating preset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/settings/presets/:id
 * Delete a settings preset
 */
router.delete('/presets/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    userSettings.settingsPresets = (userSettings.settingsPresets || []).filter(p => p.id !== id);
    
    await awsManager.saveUserSettings(userId, userSettings);
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting preset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
