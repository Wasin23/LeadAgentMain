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

// Get user settings
router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = await getUserSettings(userId);
    
    // Don't send API keys in response for security
    const safeSettings = {
      ...settings,
      apiKeys: Object.keys(settings.apiKeys).reduce((acc, key) => {
        acc[key] = settings.apiKeys[key] ? '***set***' : '';
        return acc;
      }, {})
    };
    
    res.json({ success: true, settings: safeSettings });
  } catch (error) {
    console.error('[AUTH] Get settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update API keys
router.post('/settings/:userId/api-keys', async (req, res) => {
  try {
    const { userId } = req.params;
    const { apiKeys } = req.body;
    
    // Filter out empty values to avoid overwriting existing keys with empty strings
    const filteredKeys = Object.entries(apiKeys).reduce((acc, [key, value]) => {
      if (value && value.trim() !== '') {
        acc[key] = value.trim();
      }
      return acc;
    }, {});
    
    const updatedKeys = await updateApiKeys(userId, filteredKeys);
    console.log(`[AUTH] API keys updated for user: ${userId}`);
    
    // Return masked keys for security
    const maskedKeys = Object.keys(updatedKeys).reduce((acc, key) => {
      acc[key] = updatedKeys[key] ? '***set***' : '';
      return acc;
    }, {});
    
    res.json({ 
      success: true, 
      message: 'API keys updated successfully',
      apiKeys: maskedKeys
    });
  } catch (error) {
    console.error('[AUTH] Update API keys error:', error.message);
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

export default router;
