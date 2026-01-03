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

// Helper function to generate personality-themed email response prompts
function getEmailResponsePromptForPersonality(personality) {
  // If personality has an emailPrompt field, use it directly
  if (personality?.emailPrompt) {
    return personality.emailPrompt;
  }
  
  // Fallback to type-based lookup if no emailPrompt provided
  const personalityType = personality?.type || 'hunter';
  
  const prompts = {
    hunter: `When responding to emails, maintain a direct and action-oriented tone that creates urgency. Keep responses brief but impactful. Focus on clear value propositions and strong calls-to-action. Use confident, results-driven language that encourages immediate engagement. Your goal is to move prospects quickly toward a meeting or next step.`,
    
    'relationship-builder': `When responding to emails, prioritize building trust and rapport. Use warm, empathetic language that shows you understand their challenges. Ask thoughtful questions to deepen the conversation. Focus on the relationship first, solution second. Your responses should feel personal, not transactional, creating a foundation for long-term partnership.`,
    
    analyst: `When responding to emails, demonstrate deep research and data-driven insights. Reference specific company details, market trends, or industry statistics that show you've done your homework. Use evidence-based language and provide concrete examples. Your responses should position you as a knowledgeable expert who can back up claims with facts.`,
    
    consultant: `When responding to emails, position yourself as a strategic advisor focused on business outcomes. Use professional, advisory language that demonstrates industry expertise. Frame your responses around solutions and strategic value rather than just features. Show that you understand their business challenges at a strategic level and can offer meaningful guidance.`,
    
    networker: `When responding to emails, leverage connection-based language that builds community. Reference mutual contacts, shared interests, or industry relationships when relevant. Use friendly, social tone that feels collaborative rather than sales-focused. Your responses should feel like a conversation between colleagues in the same professional network.`
  };
  
  return prompts[personalityType] || prompts.hunter;
}

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

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    console.log(`[AUTH] GET /profile - Request received for user: ${userId}`);
    
    // Import AWS manager to get user data
    const { default: AWSManager } = await import('../utils/awsManager.js');
    const awsManager = new AWSManager();
    
    const user = await awsManager.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return safe user data (no password hash)
    const { passwordHash, apiKeys, ...safeUser } = user;
    
    res.json({ 
      success: true, 
      user: safeUser 
    });
  } catch (error) {
    console.error('[AUTH] Get profile error:', error.message);
    res.status(500).json({ error: error.message });
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
    res.json({ success: true, userId: userId, settings: safeSettings });
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

// Update email settings
router.post('/settings/email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { emailSettings } = req.body;
    
    const currentSettings = await getUserSettings(userId);
    currentSettings.emailSettings = { ...currentSettings.emailSettings, ...emailSettings };
    
    await updateUserSettings(userId, currentSettings);
    console.log(`[AUTH] Email settings updated for user: ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'Email settings updated successfully',
      emailSettings: currentSettings.emailSettings
    });
  } catch (error) {
    console.error('[AUTH] Update email settings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update calendar settings
router.post('/settings/calendar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const { calendarSettings } = req.body;
    
    const currentSettings = await getUserSettings(userId);
    currentSettings.calendarSettings = { ...currentSettings.calendarSettings, ...calendarSettings };
    
    await updateUserSettings(userId, currentSettings);
    console.log(`[AUTH] Calendar settings updated for user: ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'Calendar settings updated successfully',
      calendarSettings: currentSettings.calendarSettings
    });
  } catch (error) {
    console.error('[AUTH] Update calendar settings error:', error.message);
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
    const { name, type = 'reasoning-lead-agent', personality, preset, specialInstructions, useGmail } = req.body;
    const userId = req.user.userId;
    
    console.log('[AUTH CREATE-AGENT] Request body:', {
      name,
      type,
      hasPersonality: !!personality,
      hasPreset: !!preset,
      hasSpecialInstructions: !!specialInstructions,
      preset: preset ? {
        presetId: preset.presetId,
        name: preset.name,
        targetIndustries: preset.targetIndustries,
        targetPositions: preset.targetPositions,
        companySizeMin: preset.companySizeMin,
        companySizeMax: preset.companySizeMax,
        leadLimit: preset.leadLimit,
        emailLength: preset.emailLength,
        callToAction: preset.callToAction,
        personalizationLevel: preset.personalizationLevel,
        ccEmails: preset.ccEmails,
        bccEmails: preset.bccEmails,
        followupIntervalDays: preset.followupIntervalDays,
        enableAutoResponse: preset.enableAutoResponse,
        useCustomSignature: preset.useCustomSignature,
        signatureName: preset.signatureName,
        signatureTitle: preset.signatureTitle
      } : null
    });
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    // Check for duplicate agent names
    const { getUserById } = await import('../lib/userManager.js');
    const user = await getUserById(userId);
    console.log('[AUTH CREATE-AGENT] User agents:', user.activeAgents?.length || 0);
    
    // Check agent limit (max 10 agents per account)
    const MAX_AGENTS = 10;
    if (user.activeAgents && user.activeAgents.length >= MAX_AGENTS) {
      console.log('[AUTH CREATE-AGENT] ❌ Agent limit reached:', user.activeAgents.length);
      return res.status(400).json({ 
        error: 'Agent limit reached',
        message: `You have reached the maximum limit of ${MAX_AGENTS} agents per account. Please delete an existing agent to create a new one.` 
      });
    }
    
    const existingAgent = user.activeAgents?.find(
      agent => agent.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingAgent) {
      console.log('[AUTH CREATE-AGENT] ❌ Duplicate agent name detected:', name.trim());
      return res.status(400).json({ 
        error: 'Duplicate agent name',
        message: `An agent named "${name.trim()}" already exists. Please choose a different name.` 
      });
    }
    
    console.log('[AUTH CREATE-AGENT] ✅ Agent name is unique, proceeding with creation');
    
    // Generate new 6-digit agent ID
    const agentId = Math.floor(100000 + Math.random() * 900000).toString();
    
    const agentData = {
      agentId,
      name: name.trim(),
      type,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastRun: null,
      personality: personality || {
        type: 'hunter',
        name: 'The Hunter',
        description: 'Default personality',
        avatar: '🎯',
        emailPrompt: 'Write professional sales emails',
        emailStyle: 'Professional and direct',
        traits: ['Professional', 'Direct'],
        color: 'blue'
      },
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
    
    // Also create agent settings entry with personality data
    const awsManager = (await import('../utils/awsManager.js')).default;
    const awsManagerInstance = new awsManager();
    
    // Fetch company profile to auto-populate branding
    let companyProfile = null;
    try {
      const userSettings = await awsManagerInstance.getUserSettings(userId);
      companyProfile = userSettings?.companyProfile;
      console.log('[AUTH] Company profile loaded:', companyProfile ? 'YES' : 'NO');
      if (companyProfile) {
        console.log('[AUTH] Profile data:', {
          companyName: companyProfile.companyName,
          coreOffering: companyProfile.coreOffering,
          keyAdvantages: companyProfile.keyAdvantages
        });
      }
    } catch (profileError) {
      console.log('[AUTH] Error loading company profile:', profileError.message);
    }
    
    const agentSettings = {
      agentId,
      userId,
      name: name.trim(),
      type,
      status: 'active',
      createdAt: new Date().toISOString(),
      personality: agentData.personality, // Copy personality to agent-settings
      specialInstructions: specialInstructions || '',
      companyBranding: {
        agentName: name.trim(),
        companyName: companyProfile?.companyName || 'Your Company',
        agentTitle: 'AI Sales Agent',
        companyWebsite: companyProfile?.website || '',
        primaryService: companyProfile?.services || 'Business solutions',
        coreOffering: companyProfile?.coreOffering || (companyProfile?.description || 'AI-powered outreach'),
        keyAdvantages: companyProfile?.keyAdvantages || 'Automated, personalized, scalable',
        expertiseArea: companyProfile?.industry || 'Sales automation',
        companyDescription: companyProfile?.description || ''
      },
      emailBuilder: {
        length: 'medium',
        callToAction: 'meeting',
        personalization: 'high',
        enableAutoResponse: true,
        rebumpIntervalDays: 7,
        ccEmails: '',
        bccEmails: '',
        useGmail: useGmail || false,
        emailResponsePrompt: getEmailResponsePromptForPersonality(agentData.personality)
      },
      // Initialize targeting criteria structures
      companyCriteria: {
        companyIndustries: [],
        companySizeMin: null,
        companySizeMax: null
      },
      contactCriteria: {
        targetPositions: []
      },
      geographicSettings: {
        leadLimit: null
      }
    };

    // If preset is provided, apply preset settings
    if (preset) {
      // Generate a preset ID if not provided (for onboarding-created presets)
      const presetId = preset.presetId || preset._id || preset.id || `preset-${agentId}`;
      const presetName = preset.name || `${name} Settings`;
      
      // Store the preset ID for reference
      agentSettings.appliedPresetId = presetId;
      agentSettings.appliedPresetName = presetName;
      
      // Override with preset values
      agentSettings.companyCriteria = {
        companyIndustries: preset.targetIndustries || [],
        companySizeMin: preset.companySizeMin || null,
        companySizeMax: preset.companySizeMax || null
      };
      
      agentSettings.contactCriteria = {
        targetPositions: preset.targetPositions || []
      };
      
      agentSettings.geographicSettings = {
        leadLimit: preset.leadLimit || null
      };

      // Apply email response settings from preset
      agentSettings.emailBuilder = {
        ...agentSettings.emailBuilder,
        length: preset.emailLength || agentSettings.emailBuilder?.length || 'medium',
        callToAction: preset.callToAction || agentSettings.emailBuilder?.callToAction || 'schedule-meeting',
        personalization: preset.personalizationLevel || agentSettings.emailBuilder?.personalization || 'high',
        ccEmails: preset.ccEmails || agentSettings.emailBuilder?.ccEmails || '',
        bccEmails: preset.bccEmails || agentSettings.emailBuilder?.bccEmails || '',
        rebumpIntervalDays: preset.followupIntervalDays || agentSettings.emailBuilder?.rebumpIntervalDays || 7,
        enableAutoResponse: preset.enableAutoResponse !== undefined ? preset.enableAutoResponse : (agentSettings.emailBuilder?.enableAutoResponse !== undefined ? agentSettings.emailBuilder.enableAutoResponse : true),
        useCustomSignature: preset.useCustomSignature || agentSettings.emailBuilder?.useCustomSignature || false,
        signatureName: preset.signatureName || agentSettings.emailBuilder?.signatureName || '',
        signatureTitle: preset.signatureTitle || agentSettings.emailBuilder?.signatureTitle || '',
        useGmail: useGmail !== undefined ? useGmail : (user.settings?.preferences?.defaultUseGmail || agentSettings.emailBuilder?.useGmail || false)
      };
      
      // Apply special instructions from preset ONLY if not already set in agent creation
      // Priority: Direct specialInstructions from request > Preset specialInstructions
      if (!specialInstructions && preset.specialInstructions) {
        agentSettings.specialInstructions = preset.specialInstructions;
        console.log(`[AUTH] Using specialInstructions from preset since none provided directly`);
      } else if (specialInstructions) {
        console.log(`[AUTH] Using specialInstructions from direct request (overriding preset)`);
      }
      
      console.log(`[AUTH] ✅ Applied preset "${presetName}" to agent ${agentId}:`, {
        appliedPresetId: presetId,
        industries: preset.targetIndustries || [],
        positions: preset.targetPositions || [],
        companySizeMin: preset.companySizeMin,
        companySizeMax: preset.companySizeMax,
        leadLimit: preset.leadLimit,
        emailSettings: {
          length: preset.emailLength,
          callToAction: preset.callToAction,
          personalization: preset.personalizationLevel,
          ccEmails: preset.ccEmails,
          bccEmails: preset.bccEmails,
          rebumpIntervalDays: preset.followupIntervalDays,
          enableAutoResponse: preset.enableAutoResponse,
          useCustomSignature: preset.useCustomSignature,
          signatureName: preset.signatureName,
          signatureTitle: preset.signatureTitle
        }
      });
    } else {
      console.log(`[AUTH] ⚠️ No preset provided for agent ${agentId}`);
    }
    
    console.log(`[AUTH] 💾 Saving agent settings for ${agentId}:`, {
      appliedPresetId: agentSettings.appliedPresetId,
      appliedPresetName: agentSettings.appliedPresetName,
      companyCriteria: agentSettings.companyCriteria,
      contactCriteria: agentSettings.contactCriteria,
      geographicSettings: agentSettings.geographicSettings,
      emailBuilder: agentSettings.emailBuilder,
      companyBranding: {
        companyName: agentSettings.companyBranding.companyName,
        coreOffering: agentSettings.companyBranding.coreOffering,
        keyAdvantages: agentSettings.companyBranding.keyAdvantages
      }
    });
    
    await awsManagerInstance.saveLeadAgentSettings(userId, agentId, agentSettings);
    
    // Log agent creation to issues/alerts as an important event
    const activityData = {
      type: 'info',
      category: 'issue',
      title: 'Agent Created',
      message: `New agent "${name}" (${agentId}) was successfully created`,
      timestamp: new Date().toISOString(),
      metadata: {
        agentId,
        agentName: name,
        agentType: type,
        personality: personality?.type || 'default',
        timestamp: new Date().toISOString()
      }
    };
    
    await awsManagerInstance.addIssue(
      userId,
      activityData.type,
      activityData.title,
      activityData.message,
      activityData.metadata
    );
    
    // Broadcast to SSE clients for real-time updates
    try {
      const { broadcastActivity } = await import('./monitoring.js');
      broadcastActivity(activityData);
    } catch (sseError) {
      console.error('[AUTH] Failed to broadcast activity:', sseError);
    }
    
    console.log(`[AUTH] New agent created: ${agentId} (${name}) for user ${userId} with personality: ${personality?.type || 'default'}`);
    
    res.json({ 
      success: true, 
      message: 'Agent created successfully',
      agent: agentData
    });
  } catch (error) {
    console.error('[AUTH] Create agent error:', error);
    console.error('[AUTH] Error stack:', error.stack);
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
    
    // Enrich agents with nextCycleTime from their running status and specialInstructions from settings
    const awsManager = (await import('../utils/awsManager.js')).default;
    const awsManagerInstance = new awsManager();
    
    const enrichedAgents = await Promise.all(agents.map(async (agent) => {
      try {
        // Get agent settings to fetch specialInstructions and full settings
        let specialInstructions = '';
        let settings = {};
        try {
          const agentSettings = await awsManagerInstance.getAgentSettings(userId, agent.agentId);
          specialInstructions = agentSettings?.specialInstructions || '';
          settings = agentSettings || {};
        } catch (settingsError) {
          console.log(`[AUTH] Could not load settings for agent ${agent.name}:`, settingsError.message);
        }
        
        // Get the running agent instance to get real-time nextCycleTime
        const { getUserAgent } = await import('../agent/reasoningLeadAgent.js');
        
        let nextCycleTime = null;
        try {
          const runningAgent = getUserAgent(userId, agent.agentId);
          if (runningAgent && runningAgent.isRunning) {
            const status = await runningAgent.getStatus();
            nextCycleTime = status?.nextCycleIn || null;
          }
        } catch (agentError) {
          console.log(`[AUTH] Agent ${agent.name} not found in memory (not started yet)`);
        }
        
        return {
          ...agent,
          nextCycleTime,
          specialInstructions,
          settings
        };
      } catch (err) {
        console.error(`Failed to get status for agent ${agent.agentId}:`, err);
        return agent;
      }
    }));
    
    res.json({ 
      success: true, 
      agents: enrichedAgents,
      message: `Found ${enrichedAgents.length} agents`
    });
  } catch (error) {
    console.error('[AUTH] Get agents error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
