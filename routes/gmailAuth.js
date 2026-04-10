import express from 'express';
import GmailManager from '../utils/gmailManager.js';
import AWSManager from '../utils/awsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const gmailManager = new GmailManager();
const awsManager = new AWSManager();

/**
 * Get Gmail OAuth URL (for popup flow)
 * GET /api/auth/gmail/oauth-url
 */
router.get('/oauth-url', authenticateToken, (req, res) => {
  try {
    console.log('🔐 [GMAIL AUTH] Generating OAuth URL for user:', req.user.userId);

    // Generate OAuth URL with state parameter (to verify callback)
    const authUrl = gmailManager.getAuthUrl();
    const stateParam = Buffer.from(JSON.stringify({ userId: req.user.userId })).toString('base64');
    const fullAuthUrl = `${authUrl}&state=${stateParam}`;

    console.log('🔐 [GMAIL AUTH] Generated auth URL');
    res.json({ success: true, authUrl: fullAuthUrl });
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error generating OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

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

    console.log('🔐 [GMAIL AUTH] Generated auth URL:', fullAuthUrl);
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

    try {
      await awsManager.saveUserSettings(userId, settingsToSave);
      console.log('✅ [GMAIL AUTH] Successfully saved to DynamoDB');
    } catch (saveError) {
      console.error('❌ [GMAIL AUTH] Error saving to DynamoDB:', saveError);
      throw saveError;
    }

    console.log('✅ [GMAIL AUTH] Gmail connected successfully for user:', userId);
    console.log('✅ [GMAIL AUTH] Total accounts:', existingAccounts.length);

    // Set up Gmail Pub/Sub push notifications for bounce detection
    try {
      console.log('📬 [GMAIL AUTH] Setting up Pub/Sub watch for bounce detection...');
      await gmailManager.setupPushNotifications(userId);
      console.log('✅ [GMAIL AUTH] Pub/Sub watch enabled for bounce detection');
    } catch (watchError) {
      console.error('⚠️ [GMAIL AUTH] Failed to set up Pub/Sub watch (non-critical):', watchError.message);
      // Continue even if watch setup fails - it can be set up later
    }

    // Send HTML that closes the popup and signals parent
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Connected</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .checkmark {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: #10b981;
              margin: 0 auto 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              animation: scaleIn 0.3s ease-out;
            }
            .checkmark svg {
              width: 50px;
              height: 50px;
              stroke: white;
              stroke-width: 3;
              stroke-linecap: round;
              stroke-linejoin: round;
              fill: none;
              animation: drawCheck 0.5s ease-out 0.2s forwards;
              stroke-dasharray: 100;
              stroke-dashoffset: 100;
            }
            @keyframes scaleIn {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
            @keyframes drawCheck {
              to { stroke-dashoffset: 0; }
            }
            h1 { color: #1f2937; margin: 0 0 10px; font-size: 28px; }
            p { color: #6b7280; margin: 0; font-size: 16px; }
            .email { color: #1f2937; font-weight: 600; margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">
              <svg viewBox="0 0 52 52">
                <polyline points="14 27 22 35 38 17"/>
              </svg>
            </div>
            <h1>Gmail Connected!</h1>
            <p class="email">${gmailAddress}</p>
            <p>This window will close automatically...</p>
          </div>
          <script>
            // Try multiple methods to signal success
            try {
              // Method 1: postMessage to parent
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GMAIL_CONNECTED',
                  email: '${gmailAddress}',
                  timestamp: Date.now()
                }, '*');
                console.log('Sent postMessage to parent');
              }
              
              // Method 2: localStorage (backup)
              localStorage.setItem('gmailConnected', JSON.stringify({
                email: '${gmailAddress}',
                timestamp: Date.now()
              }));
              console.log('Set localStorage flag');
            } catch (e) {
              console.error('Could not signal parent:', e);
            }
            
            // Close popup after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error in callback:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Connection Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .message {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 1rem;
              backdrop-filter: blur(10px);
            }
          </style>
        </head>
        <body>
          <div class="message">
            <h2>❌ Connection Failed</h2>
            <p>${error.message}</p>
            <p style="opacity: 0.7; font-size: 0.9rem;">This window will close automatically...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
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

    // Revert any agents that were using Gmail back to Mailgun
    const revertedAgents = [];
    try {
      const userData = await awsManager.getUserById(userId);
      const agents = userData?.activeAgents || [];
      for (const agent of agents) {
        try {
          const agentSettings = await awsManager.getLeadAgentSettings(userId, agent.agentId);
          if (agentSettings?.emailBuilder?.useGmail === true) {
            await awsManager.saveLeadAgentSettings(userId, agent.agentId, {
              ...agentSettings,
              emailBuilder: { ...agentSettings.emailBuilder, useGmail: false }
            });
            revertedAgents.push({ agentId: agent.agentId, name: agentSettings.name || agentSettings.agentName || agent.agentId });
          }
        } catch (e) {
          console.error(`[GMAIL AUTH] Failed to revert agent ${agent.agentId}:`, e.message);
        }
      }
    } catch (e) {
      console.error('[GMAIL AUTH] Failed to revert agents:', e.message);
    }

    res.json({ success: true, message: 'Gmail disconnected successfully', revertedAgents });
  } catch (error) {
    console.error('❌ [GMAIL AUTH] Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

export default router;
