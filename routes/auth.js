// Authentication and user management routes
import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserSettings, 
  updateUserSettings, 
  updateApiKeys, 
  updateAiPersonality,
  verifyMasterPassword 
} from '../lib/userManager.js';

const router = express.Router();

// Add debugging middleware to log all auth requests
router.use((req, res, next) => {
  console.log(`[AUTH] ${req.method} ${req.path} - Request received`);
  next();
});

// Test endpoint to verify auth routes are working
router.get('/test', (req, res) => {
  console.log('[AUTH] Test endpoint hit');
  res.json({ message: 'Auth routes are working!', timestamp: new Date().toISOString() });
});

// User registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const user = await registerUser(username, email, password);
    console.log(`[AUTH] New user registered: ${username} (${email})`);
    
    res.json({ 
      success: true, 
      message: 'User registered successfully',
      user: { userId: user.userId, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await loginUser(username, password);
    console.log(`[AUTH] User logged in: ${username}`);
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { userId: user.userId, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error.message);
    res.status(401).json({ error: error.message });
  }
});

// Get API keys (for frontend that's calling the wrong endpoint) - MUST BE BEFORE THE GENERAL SETTINGS ROUTE
router.get('/settings/:userId/api-keys', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[AUTH] GET /settings/${userId}/api-keys - Request received (SPECIFIC ROUTE)`);
    
    const settings = await getUserSettings(userId);
    console.log(`[AUTH] Raw settings for ${userId}:`, settings);
    
    // Return API key previews (first 8 characters) for display
    const apiKeyPreviews = Object.keys(settings.apiKeys).reduce((acc, key) => {
      if (settings.apiKeys[key]) {
        // Return first 8 characters for preview
        const preview = settings.apiKeys[key].substring(0, 8) + '...';
        acc[key] = preview;
        console.log(`[AUTH] Key ${key}: ${settings.apiKeys[key]} -> ${preview}`);
      } else {
        acc[key] = '';
        console.log(`[AUTH] Key ${key}: empty`);
      }
      return acc;
    }, {});
    
    console.log(`[AUTH] Sending API key previews:`, apiKeyPreviews);
    res.json({ success: true, settings: { apiKeys: apiKeyPreviews } });
  } catch (error) {
    console.error('[AUTH] Get API keys error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get user settings
router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[AUTH] GET /settings/${userId} - Request received`);
    
    const settings = await getUserSettings(userId);
    console.log(`[AUTH] Raw settings for ${userId}:`, settings);
    
    // Return API key previews (first 8 characters) for display
    const safeSettings = {
      ...settings,
      apiKeys: Object.keys(settings.apiKeys).reduce((acc, key) => {
        if (settings.apiKeys[key]) {
          // Return first 8 characters for preview
          const preview = settings.apiKeys[key].substring(0, 8) + '...';
          acc[key] = preview;
          console.log(`[AUTH] Key ${key}: ${settings.apiKeys[key]} -> ${preview}`);
        } else {
          acc[key] = '';
          console.log(`[AUTH] Key ${key}: empty`);
        }
        return acc;
      }, {})
    };
    
    console.log(`[AUTH] Sending safe settings:`, safeSettings);
    res.json({ success: true, settings: safeSettings });
  } catch (error) {
    console.error('[AUTH] Get settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update API keys
router.post('/settings/:userId/api-keys', async (req, res) => {
  console.log('[AUTH] ====== API Keys update request received ======');
  console.log('[AUTH] UserId:', req.params.userId);
  console.log('[AUTH] Request body:', req.body);
  console.log('[AUTH] Request headers:', req.headers);
  
  try {
    const { userId } = req.params;
    const { apiKeys, vectorStore } = req.body;
    
    if (!apiKeys) {
      console.log('[AUTH] No apiKeys in request body');
      return res.status(400).json({ error: 'API keys data is required' });
    }
    
    console.log('[AUTH] Processing API keys for user:', userId);
    console.log('[AUTH] API keys received:', apiKeys);
    console.log('[AUTH] Vector store config received:', vectorStore);
    
    // Don't filter out empty values - allow them to clear existing keys
    // But we need to handle them properly in the tools
    const keysToUpdate = {};
    Object.entries(apiKeys).forEach(([key, value]) => {
      // Always update the key, even if it's empty (allows clearing)
      keysToUpdate[key] = value ? value.trim() : '';
    });
    
    console.log('[AUTH] Keys to update:', keysToUpdate);
    
    const updatedKeys = await updateApiKeys(userId, keysToUpdate);
    
    // Update vector store settings if provided
    if (vectorStore) {
      console.log('[AUTH] Updating vector store settings:', vectorStore);
      await updateUserSettings(userId, { vectorStore });
    }
    
    console.log(`[AUTH] API keys updated successfully for user: ${userId}`);
    console.log('[AUTH] Updated keys result:', updatedKeys);
    
    // Return masked keys for security
    const maskedKeys = Object.keys(updatedKeys).reduce((acc, key) => {
      acc[key] = updatedKeys[key] && updatedKeys[key] !== '' ? '***set***' : '';
      return acc;
    }, {});
    
    console.log('[AUTH] Sending response with masked keys:', maskedKeys);
    
    res.json({ 
      success: true, 
      message: 'API keys updated successfully',
      apiKeys: maskedKeys
    });
  } catch (error) {
    console.error('[AUTH] Update API keys error:', error);
    console.error('[AUTH] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Update AI personality (requires master password)
router.post('/settings/:userId/ai-personality', async (req, res) => {
  try {
    const { userId } = req.params;
    const { masterPassword, aiPersonality } = req.body;
    
    if (!masterPassword) {
      return res.status(400).json({ error: 'Master password is required' });
    }
    
    const updatedPersonality = await updateAiPersonality(userId, masterPassword, aiPersonality);
    console.log(`[AUTH] AI personality updated for user: ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'AI personality updated successfully',
      aiPersonality: updatedPersonality
    });
  } catch (error) {
    console.error('[AUTH] Update AI personality error:', error.message);
    if (error.message === 'Invalid master password') {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update general preferences
router.post('/settings/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
    
    const currentSettings = await getUserSettings(userId);
    currentSettings.preferences = { ...currentSettings.preferences, ...preferences };
    
    await updateUserSettings(userId, currentSettings);
    console.log(`[AUTH] Preferences updated for user: ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'Preferences updated successfully',
      preferences: currentSettings.preferences
    });
  } catch (error) {
    console.error('[AUTH] Update preferences error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Verify master password
router.post('/verify-master-password', (req, res) => {
  try {
    const { password } = req.body;
    const isValid = verifyMasterPassword(password);
    
    res.json({ success: true, valid: isValid });
  } catch (error) {
    console.error('[AUTH] Master password verification error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Domain settings endpoints
router.get('/settings/:userId/domain-settings', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[AUTH] GET /settings/${userId}/domain-settings - Request received`);
    
    const settings = await getUserSettings(userId);
    console.log(`[AUTH] Domain settings for ${userId}:`, settings.domainSettings);
    
    res.json({
      success: true,
      settings: {
        domainSettings: settings.domainSettings || {}
      }
    });
  } catch (error) {
    console.error('[AUTH] Get domain settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/:userId/domain-settings', async (req, res) => {
  try {
    const { userId } = req.params;
    const { domainSettings } = req.body;
    
    console.log(`[AUTH] POST /settings/${userId}/domain-settings - Request received`);
    console.log('[AUTH] Domain settings to save:', domainSettings);
    
    await updateUserSettings(userId, { domainSettings });
    console.log('[AUTH] ✅ Domain settings updated successfully');
    
    res.json({ success: true, message: 'Domain settings saved successfully' });
  } catch (error) {
    console.error('[AUTH] Update domain settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Lead Contact Settings routes
router.post('/settings/:userId/lead-contact-settings', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[AUTH] POST /settings/${userId}/lead-contact-settings - Request received`);
    console.log(`[AUTH] Lead contact settings data:`, req.body);
    
    const settings = await getUserSettings(userId);
    settings.leadContactSettings = req.body.leadContactSettings;
    await updateUserSettings(userId, settings);
    
    console.log(`[AUTH] ✅ Lead Contact Settings saved for user: ${userId}`);
    res.json({ success: true, message: 'Lead Contact settings saved successfully' });
  } catch (error) {
    console.error('[AUTH] Update lead contact settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// General settings routes (without userId in path)
router.get('/settings', async (req, res) => {
  try {
    console.log('[AUTH] GET /settings - Request received');
    
    // Get current user from session or return empty settings
    // For now, we'll use a default approach
    const currentUser = { userId: 'default' }; // This should come from session
    
    const settings = await getUserSettings(currentUser.userId);
    console.log('[AUTH] Settings retrieved:', Object.keys(settings));
    
    res.json(settings);
  } catch (error) {
    console.error('[AUTH] Get settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    console.log('[AUTH] POST /settings - Request received');
    console.log('[AUTH] Request body:', req.body);
    
    // Get current user from session or use default
    const currentUser = { userId: 'default' }; // This should come from session
    
    const result = await updateUserSettings(currentUser.userId, req.body);
    console.log('[AUTH] Settings updated successfully');
    
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('[AUTH] Update settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
