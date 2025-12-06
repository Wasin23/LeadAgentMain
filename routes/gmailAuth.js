import express from 'express';
import GmailManager from '../utils/gmailManager.js';
import AWSManager from '../utils/awsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const gmailManager = new GmailManager();
const awsManager = new AWSManager();

/**
 * Initiate Gmail OAuth flow
 * GET /api/auth/gmail/authorize
 */
router.get('/authorize', (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('🔐 [GMAIL AUTH] Starting OAuth flow for user:', userId);

    // Generate OAuth URL with state parameter (to verify callback)
    const authUrl = gmailManager.getAuthUrl();
    const stateParam = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const fullAuthUrl = `${authUrl}&state=${stateParam}`;

    console.log('🔐 [GMAIL AUTH] Redirecting to Google OAuth consent screen');
    res.redirect(fullAuthUrl);
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error in authorize:', error);
    res.status(500).json({ error: 'Failed to start OAuth flow' });
  }
});

/**
 * Handle Gmail OAuth callback
 * GET /api/auth/gmail/callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth denial
    if (error) {
      console.log('❌ [GMAIL AUTH] User denied access:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?gmailAuth=denied`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    console.log('🔐 [GMAIL AUTH] Processing callback for user:', userId);

    // Exchange authorization code for tokens
    const tokens = await gmailManager.getTokensFromCode(code);

    if (!tokens.refresh_token) {
      console.error('❌ [GMAIL AUTH] No refresh token received. User may have already authorized before.');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?gmailAuth=error&reason=no_refresh_token`);
    }

    // Get user's Gmail address
    const gmailAddress = await gmailManager.getUserEmail(tokens);
    console.log('✅ [GMAIL AUTH] Retrieved Gmail address:', gmailAddress);

    // Get profile picture
    const profilePicture = await gmailManager.getProfilePicture(tokens);

    // Get existing settings
    const existingSettings = await awsManager.getUserSettings(userId) || {};
    const existingAccounts = existingSettings.gmailAccounts || [];
    
    // Check if account already exists
    const existingIndex = existingAccounts.findIndex(acc => acc.email === gmailAddress);
    
    if (existingIndex >= 0) {
      // Update existing account
      existingAccounts[existingIndex] = {
        email: gmailAddress,
        refreshToken: tokens.refresh_token,
        connectedAt: existingAccounts[existingIndex].connectedAt,
        updatedAt: new Date().toISOString(),
        profilePicture,
        isActive: existingAccounts[existingIndex].isActive
      };
    } else {
      // Add new account
      existingAccounts.push({
        email: gmailAddress,
        refreshToken: tokens.refresh_token,
        connectedAt: new Date().toISOString(),
        profilePicture,
        isActive: existingAccounts.length === 0 // First account is active by default
      });
    }

    const settingsToSave = {
      ...existingSettings,
      gmailAccounts: existingAccounts,
      activeGmailIndex: existingAccounts.findIndex(acc => acc.isActive)
    };

    console.log('📝 [GMAIL AUTH] Saving to DynamoDB:', {
      userId,
      accountsCount: existingAccounts.length,
      accounts: existingAccounts.map(a => ({ email: a.email, isActive: a.isActive })),
      activeIndex: settingsToSave.activeGmailIndex
    });

    await awsManager.saveUserSettings(userId, settingsToSave);

    console.log('✅ [GMAIL AUTH] Gmail connected successfully for user:', userId);
    console.log('✅ [GMAIL AUTH] Total accounts:', existingAccounts.length);

    // Redirect back to dashboard with success message
    res.redirect(`${process.env.FRONTEND_URL || 'https://meridianagent.xyz'}/dashboard?gmailAuth=success&email=${encodeURIComponent(gmailAddress)}`);
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error in callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://meridianagent.xyz'}/dashboard?gmailAuth=error&reason=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Check Gmail connection status
 * GET /api/auth/gmail/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    console.log('[GMAIL AUTH] Status check for user:', req.user.userId);
    const userId = req.user.userId;

    const userSettings = await awsManager.getUserSettings(userId);
    
    // Check for new format (gmailAccounts array)
    if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
      console.log(`[GMAIL AUTH] Found ${userSettings.gmailAccounts.length} Gmail accounts`);
      res.json({
        connected: true,
        accounts: userSettings.gmailAccounts,
        activeIndex: userSettings.activeGmailIndex || 0
      });
    } 
    // Migrate from old format (gmailAuth) to new format
    else if (userSettings?.gmailAuth?.refreshToken) {
      console.log('[GMAIL AUTH] Migrating old gmailAuth format to gmailAccounts array');
      const migratedAccount = {
        email: userSettings.gmailAuth.email,
        refreshToken: userSettings.gmailAuth.refreshToken,
        connectedAt: userSettings.gmailAuth.connectedAt,
        profilePicture: null,
        isActive: true
      };
      
      // Save migrated format
      await awsManager.saveUserSettings(userId, {
        ...userSettings,
        gmailAccounts: [migratedAccount],
        activeGmailIndex: 0,
        gmailAuth: undefined // Remove old format
      });
      
      res.json({
        connected: true,
        accounts: [migratedAccount],
        activeIndex: 0
      });
    } 
    else {
      console.log('[GMAIL AUTH] No Gmail accounts found');
      res.json({ connected: false, accounts: [] });
    }
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error checking status:', error);
    res.status(500).json({ error: 'Failed to check Gmail connection status' });
  }
});

/**
 * Test Gmail connection
 * POST /api/auth/gmail/test
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await gmailManager.testConnection(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test Gmail connection' });
  }
});

/**
 * Set active Gmail account
 * POST /api/auth/gmail/set-active
 */
router.post('/set-active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountIndex } = req.body;

    const userSettings = await awsManager.getUserSettings(userId);
    const gmailAccounts = userSettings?.gmailAccounts || [];

    if (!gmailAccounts[accountIndex]) {
      return res.status(400).json({ error: 'Invalid account index' });
    }

    // Update active status
    gmailAccounts.forEach((acc, i) => {
      acc.isActive = (i === accountIndex);
    });

    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      gmailAccounts,
      activeGmailIndex: accountIndex
    });

    res.json({ 
      success: true, 
      message: 'Active account updated',
      activeAccount: gmailAccounts[accountIndex].email
    });
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error setting active account:', error);
    res.status(500).json({ error: 'Failed to set active account' });
  }
});

/**
 * Disconnect Gmail
 * POST /api/auth/gmail/disconnect
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email, disconnectAll } = req.body;

    const userSettings = await awsManager.getUserSettings(userId);
    let gmailAccounts = userSettings?.gmailAccounts || [];

    if (disconnectAll) {
      // Revoke all tokens
      for (const account of gmailAccounts) {
        try {
          await gmailManager.revokeToken(account.refreshToken);
        } catch (error) {
          console.error(`Failed to revoke token for ${account.email}:`, error);
        }
      }
      gmailAccounts = [];
    } else if (email) {
      // Disconnect specific account
      const account = gmailAccounts.find(acc => acc.email === email);
      if (account) {
        try {
          await gmailManager.revokeToken(account.refreshToken);
        } catch (error) {
          console.error(`Failed to revoke token for ${email}:`, error);
        }
      }
      gmailAccounts = gmailAccounts.filter(acc => acc.email !== email);
      
      // If we removed the active account, set first remaining as active
      if (account?.isActive && gmailAccounts.length > 0) {
        gmailAccounts[0].isActive = true;
      }
    }

    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      gmailAccounts,
      activeGmailIndex: gmailAccounts.findIndex(acc => acc.isActive)
    });

    res.json({ success: true, message: 'Gmail disconnected successfully' });
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

export default router;
