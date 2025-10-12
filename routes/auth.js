// Authentication and user management routes
import express from 'express';
import fs from 'fs';
import path from 'path';
import { 
  registerUser, 
  loginUser, 
  getUserSettings, 
  updateUserSettings, 
  updateAiPersonality,
  verifyMasterPassword,
  generatePasswordResetToken,
  resetPassword,
  getUserByEmail,
  verifyPasswordResetToken
} from '../lib/userManager.js';
import { sendPasswordResetEmail } from '../tools/emailMailgun.js';
import { generateToken, authenticateToken } from '../middleware/jwt.js';

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
    
    // Generate JWT token
    const token = generateToken(user);
    
    res.json({ 
      success: true, 
      message: 'User registered successfully',
      token: token,
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
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Note: Polling will be started automatically when user becomes active via activity tracker
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: token,
      user: { userId: user.userId, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error.message);
    res.status(401).json({ error: error.message });
  }
});

// User logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`[AUTH] User logging out: ${userId}`);
    
    // Note: Polling will stop automatically when user becomes inactive via activity tracker
    
    res.json({ 
      success: true, 
      message: 'Logout successful' 
    });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get user session status (including polling status)
router.get('/session-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check if user has active polling and activity tracking
    let pollingActive = false;
    let activeUsers = [];
    let activityUsers = [];
    
    try {
      const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
      const { getActiveUsers } = await import('../middleware/activityTracker.js');
      
      activeUsers = desktopEmailTracker.getActiveUserPolling();
      pollingActive = activeUsers.includes(userId);
      activityUsers = getActiveUsers();
    } catch (error) {
      console.error(`[AUTH] Error checking polling status for user ${userId}:`, error);
    }
    
    const userActivity = activityUsers.find(u => u.userId === userId);
    
    res.json({
      success: true,
      userId: userId,
      username: req.user.username,
      pollingActive: pollingActive,
      totalActivePollers: activeUsers.length,
      activityTracking: {
        isActive: !!userActivity,
        lastActivity: userActivity?.lastActivity || null,
        secondsAgo: userActivity?.secondsAgo || null
      },
      totalActiveUsers: activityUsers.length
    });
  } catch (error) {
    console.error('[AUTH] Session status error:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

// Debug endpoint to see all active users and polling status
router.get('/debug-activity', authenticateToken, async (req, res) => {
  try {
    console.log(`[AUTH] Debug activity status requested`);
    
    let pollingUsers = [];
    let activityUsers = [];
    
    try {
      const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
      const { getActiveUsers } = await import('../middleware/activityTracker.js');
      
      pollingUsers = desktopEmailTracker.getActiveUserPolling();
      activityUsers = getActiveUsers();
    } catch (error) {
      console.error(`[AUTH] Error getting debug info:`, error);
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      polling: {
        activeUsers: pollingUsers,
        count: pollingUsers.length
      },
      activity: {
        activeUsers: activityUsers,
        count: activityUsers.length
      },
      currentUser: {
        userId: req.user.userId,
        hasPolling: pollingUsers.includes(req.user.userId),
        hasActivity: activityUsers.some(u => u.userId === req.user.userId)
      }
    });
  } catch (error) {
    console.error('[AUTH] Debug activity error:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

// Get user settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    console.log(`[AUTH] GET /settings - Request received for user: ${userId}`);
    
    const settings = await getUserSettings(userId);
    console.log(`[AUTH] Raw settings for ${userId}:`, settings);
    
    // Remove API keys from settings before sending to frontend
    const { apiKeys, ...safeSettings } = settings;
    
    console.log(`[AUTH] Sending safe settings:`, safeSettings);
    res.json({ success: true, settings: safeSettings });
  } catch (error) {
    console.error('[AUTH] Get settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update AI personality (requires master password)
router.post('/settings/ai-personality', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
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
router.post('/settings/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
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
router.get('/settings/domain-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    console.log(`[AUTH] GET /settings/domain-settings - Request received for user: ${userId}`);
    
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

router.post('/settings/domain-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { domainSettings } = req.body;
    
    console.log(`[AUTH] POST /settings/domain-settings - Request received for user: ${userId}`);
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
router.get('/settings/lead-contact-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`[AUTH] GET /settings/lead-contact-settings - Request received for user: ${userId}`);
    console.log(`[AUTH] User object from token:`, req.user);
    
    // Import the Zilliz settings manager
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    // Get the 8-character user code that will be used for Zilliz search
    const userCode = userId.substring(0, 8);
    console.log(`[AUTH] Using user code for Zilliz search: ${userCode}`);
    
    // Get lead agent settings from Zilliz
    const leadAgentSettings = await zillizSettingsManager.getLeadAgentSettings(userId);
    
    console.log(`[AUTH] Raw settings from Zilliz:`, leadAgentSettings);
    console.log(`[AUTH] Settings type:`, typeof leadAgentSettings);
    console.log(`[AUTH] Settings keys:`, leadAgentSettings ? Object.keys(leadAgentSettings) : 'null');
    
    if (leadAgentSettings) {
      console.log(`[AUTH] ✅ Retrieved lead contact settings from Zilliz for user: ${userId} (code: ${userCode})`);
      console.log(`[AUTH] Sending response:`, { success: true, leadContactSettings: leadAgentSettings });
      res.json({ success: true, leadContactSettings: leadAgentSettings });
    } else {
      console.log(`[AUTH] ⚠️ No lead contact settings found in Zilliz for user: ${userId} (code: ${userCode})`);
      res.json({ success: true, leadContactSettings: null });
    }
  } catch (error) {
    console.error('[AUTH] Get lead contact settings error:', error.message);
    console.error('[AUTH] Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    console.log(`[AUTH] POST /settings/lead-contact-settings - Request received for user: ${userId}`);
    console.log(`[AUTH] Lead contact settings data:`, req.body);
    
    // Import the new Zilliz settings manager
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    // Save directly to Zilliz (replaces any existing record for this user)
    await zillizSettingsManager.saveLeadAgentSettings(userId, req.body.leadContactSettings);
    
    console.log(`[AUTH] ✅ Lead Contact Settings saved to Zilliz for user: ${userId}`);
    res.json({ success: true, message: 'Lead Contact settings saved successfully' });
  } catch (error) {
    console.error('[AUTH] Update lead contact settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Section-specific lead settings update routes
router.post('/settings/lead-contact-settings/company', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating company section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'companyCriteria', req.body);
    
    res.json({ success: true, message: 'Company settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Company settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/contact', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating contact section for user: ${userId}`, req.body);
    
    // The contact data from frontend contains mixed data that needs to be split across sections
    const data = req.body;
    
    // Update contact criteria section
    if (data.targetPositions || data.seniorityLevel || data.departments) {
      const contactCriteria = {
        targetPositions: data.targetPositions,
        seniorityLevel: data.seniorityLevel,
        excludedTitles: data.excludedTitles || [],
        contactKeywords: data.contactKeywords || []
      };
      await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'contactCriteria', contactCriteria);
    }
    
    // Update geographic settings section
    if (data.targetLocations || data.leadLimit) {
      const geographicSettings = {
        targetLocations: data.targetLocations,
        leadLimit: data.leadLimit,
        excludedLocations: data.excludedLocations || [],
        timezone: data.timezone || 'UTC'
      };
      await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'geographicSettings', geographicSettings);
    }
    
    // Update advanced criteria section
    if (data.excludeKeywords || data.fundingStage || data.technologyStack) {
      const advancedCriteria = {
        fundingStage: data.fundingStage || 'any',
        fundingAmount: data.fundingAmount || '',
        growthStage: data.growthStage || 'any',
        technologiesUsed: data.technologyStack || [],
        recentNews: data.recentNews || false
      };
      await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'advancedCriteria', advancedCriteria);
    }
    
    // Update research focus section
    if (data.contactIntent) {
      const researchFocus = {
        focusAreas: data.contactIntent,
        researchDepth: data.researchDepth || 'standard',
        includeCompanyNews: data.includeCompanyNews || false,
        includePersonalInfo: data.includePersonalInfo || false,
        includeSocialMedia: data.includeSocialMedia || false
      };
      await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'researchFocus', researchFocus);
    }
    
    res.json({ success: true, message: 'Contact settings updated successfully across multiple sections' });
  } catch (error) {
    console.error('[AUTH] Contact settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/geographic', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating geographic section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'geographicSettings', req.body);
    
    res.json({ success: true, message: 'Geographic settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Geographic settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/advanced', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating advanced section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'advancedCriteria', req.body);
    
    res.json({ success: true, message: 'Advanced settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Advanced settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/research', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating research section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'researchFocus', req.body);
    
    res.json({ success: true, message: 'Research settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Research settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/email-builder', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating email builder section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'emailBuilder', req.body);
    
    res.json({ success: true, message: 'Email builder settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Email builder settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/branding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating branding section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'companyBranding', req.body);
    
    res.json({ success: true, message: 'Branding settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Branding settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/lead-contact-settings/companyBranding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { default: zillizSettingsManager } = await import('../utils/zillizSettingsManager.js');
    
    console.log(`[AUTH] Updating companyBranding section for user: ${userId}`, req.body);
    
    await zillizSettingsManager.updateLeadAgentSettingsPartial(userId, 'companyBranding', req.body);
    
    res.json({ success: true, message: 'Company branding settings updated successfully' });
  } catch (error) {
    console.error('[AUTH] Company branding settings update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Password reset - request reset token
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const resetResult = await generatePasswordResetToken(email);
    
    console.log(`[AUTH] Password reset token generated: ${resetResult.token}`);
    
    // Try to send email
    const emailSent = await sendPasswordResetEmail(email, resetResult.token, resetResult.username);
    
    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'Password reset instructions sent to your email'
      });
    } else {
      // Email failed, but still provide token for development
      res.json({ 
        success: true, 
        message: 'Password reset instructions sent! (Email service unavailable - check console for token)',
        // REMOVE THIS IN PRODUCTION - only for development
        resetToken: resetResult.token,
        resetUrl: `/auth.html?tab=forgot&token=${resetResult.token}`
      });
    }
  } catch (error) {
    console.error('[AUTH] Forgot password error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Verify reset token (for real-time validation)
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    
    const tokenValid = await verifyPasswordResetToken(token);
    
    if (tokenValid.success) {
      res.json({ 
        success: true, 
        message: '✅ Valid reset token!',
        email: tokenValid.email 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired reset token' 
      });
    }
  } catch (error) {
    console.error('[AUTH] Verify reset token error:', error.message);
    res.status(500).json({ error: 'Server error during token verification' });
  }
});

// Password reset - verify token and reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    
    const result = await resetPassword(token, newPassword);
    console.log(`[AUTH] Password reset successful for user: ${result.username}`);
    
    res.json({ 
      success: true, 
      message: 'Password reset successful! You can now sign in with your new password.',
      username: result.username
    });
  } catch (error) {
    console.error('[AUTH] Reset password error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Change password for authenticated users
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password and new password are required' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 6 characters' 
      });
    }

    // Get user data to verify current password
    const users = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib/data/users.json'), 'utf8'));
    const user = users.find(u => u.userId === userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Verify current password using the same hash comparison as login
    const bcrypt = await import('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in users.json
    user.password = hashedNewPassword;
    fs.writeFileSync(path.join(process.cwd(), 'lib/data/users.json'), JSON.stringify(users, null, 2));
    
    console.log(`[AUTH] Password changed successfully for user: ${user.username}`);
    
    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('[AUTH] Change password error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password change' 
    });
  }
});

// Create new agent for authenticated user
router.post('/create-agent', authenticateToken, async (req, res) => {
  try {
    const { name, type = 'reasoning-lead-agent' } = req.body;
    const userId = req.user.userId;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    // Generate new 6-digit agent ID
    const agentId = Math.floor(100000 + Math.random() * 900000).toString();
    
    const agentData = {
      agentId,
      name: name.trim(),
      type,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastRun: null,
      settings: {
        maxEmails: 50,
        dailyLimit: 25,
        responseDelay: 5,
        smartFiltering: true
      }
    };
    
    // Add agent to user's activeAgents array in AWS
    const { addAgentToUser } = await import('../lib/userManager.js');
    await addAgentToUser(userId, agentData);
    
    console.log(`[AUTH] New agent created: ${agentId} (${name}) for user ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'Agent created successfully',
      agent: agentData
    });
  } catch (error) {
    console.error('[AUTH] Create agent error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get user's agents
router.get('/agents', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log(`[AUTH] Getting agents for user: ${userId}`);
    
    // Get user from AWS to fetch their active agents
    const { getUserById } = await import('../lib/userManager.js');
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const agents = user.activeAgents || [];
    
    res.json({ 
      success: true, 
      agents: agents,
      message: `Found ${agents.length} agents`
    });
  } catch (error) {
    console.error('[AUTH] Get agents error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
