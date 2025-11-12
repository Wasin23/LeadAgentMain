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
    
    console.log('📦 [SETTINGS] Fetching presets from AWS, count:', presets.length);
    if (presets.length > 0) {
      console.log('📦 [SETTINGS] First preset example:', JSON.stringify(presets[0], null, 2));
    }
    
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
    console.log('📥 [SETTINGS] Received preset creation request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      name, 
      targetIndustries, 
      targetPositions, 
      companySizeMin, 
      companySizeMax, 
      leadLimit,
      emailLength,
      callToAction,
      personalizationLevel,
      ccEmails,
      bccEmails,
      followupIntervalDays,
      enableAutoResponse
    } = req.body;
    
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
      emailLength: emailLength || 'medium',
      callToAction: callToAction || 'schedule-meeting',
      personalizationLevel: personalizationLevel || 'high',
      ccEmails: ccEmails || '',
      bccEmails: bccEmails || '',
      followupIntervalDays: followupIntervalDays || 7,
      enableAutoResponse: enableAutoResponse !== undefined ? enableAutoResponse : true,
      createdAt: new Date().toISOString()
    };
    
    userSettings.settingsPresets = [...(userSettings.settingsPresets || []), newPreset];
    
    console.log('💾 [SETTINGS] Saving preset to AWS:', JSON.stringify(newPreset, null, 2));
    await awsManager.saveUserSettings(userId, userSettings);
    
    console.log('✅ [SETTINGS] Returning preset to frontend:', JSON.stringify(newPreset, null, 2));
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

/**
 * PUT /api/settings/presets/:id
 * Update a settings preset
 */
router.put('/presets/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { 
      name, 
      targetIndustries, 
      targetPositions, 
      companySizeMin, 
      companySizeMax, 
      leadLimit,
      emailLength,
      callToAction,
      personalizationLevel,
      ccEmails,
      bccEmails,
      followupIntervalDays,
      enableAutoResponse
    } = req.body;
    
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    const presetIndex = (userSettings.settingsPresets || []).findIndex(p => p.id === id);
    
    if (presetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Preset not found'
      });
    }
    
    const updatedPreset = {
      ...userSettings.settingsPresets[presetIndex],
      name,
      targetIndustries,
      targetPositions,
      companySizeMin,
      companySizeMax,
      leadLimit,
      emailLength: emailLength || 'medium',
      callToAction: callToAction || 'schedule-meeting',
      personalizationLevel: personalizationLevel || 'high',
      ccEmails: ccEmails || '',
      bccEmails: bccEmails || '',
      followupIntervalDays: followupIntervalDays || 7,
      enableAutoResponse: enableAutoResponse || false,
      updatedAt: new Date().toISOString()
    };
    
    userSettings.settingsPresets[presetIndex] = updatedPreset;
    
    await awsManager.saveUserSettings(userId, userSettings);
    
    res.json({
      success: true,
      preset: updatedPreset
    });
  } catch (error) {
    console.error('Error updating preset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
