import express from 'express';
import OutlookManager from '../utils/outlookManager.js';
import AWSManager from '../utils/awsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const outlookManager = new OutlookManager();
const awsManager = new AWSManager();

/**
 * Get Outlook OAuth URL (for popup flow)
 * GET /api/auth/outlook/oauth-url
 */
router.get('/oauth-url', authenticateToken, (req, res) => {
  try {
    console.log('🔐 [OUTLOOK AUTH] Generating OAuth URL for user:', req.user.userId);

    const authUrl = outlookManager.getAuthUrl();
    const stateParam = Buffer.from(JSON.stringify({ userId: req.user.userId })).toString('base64');
    const fullAuthUrl = `${authUrl}&state=${stateParam}`;

    console.log('🔐 [OUTLOOK AUTH] Generated auth URL');
    res.json({ success: true, authUrl: fullAuthUrl });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Error generating OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

/**
 * Handle Outlook OAuth callback
 * GET /api/auth/outlook/callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.log('❌ [OUTLOOK AUTH] User denied access:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?outlookAuth=denied`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    console.log('🔐 [OUTLOOK AUTH] Processing callback for user:', userId);

    // Exchange authorization code for tokens
    const tokens = await outlookManager.getTokensFromCode(code);

    if (!tokens.refresh_token) {
      console.error('❌ [OUTLOOK AUTH] No refresh token received');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?outlookAuth=error&reason=no_refresh_token`);
    }

    // Get user's email address
    const outlookAddress = await outlookManager.getUserEmail(tokens.access_token);
    console.log('✅ [OUTLOOK AUTH] Retrieved Outlook address:', outlookAddress);

    // Get profile picture
    const profilePicture = await outlookManager.getProfilePicture(tokens.access_token);

    // Get existing settings
    const existingSettings = await awsManager.getUserSettings(userId) || {};
    const existingAccounts = existingSettings.outlookAccounts || [];
    
    // Check if account already exists
    const existingIndex = existingAccounts.findIndex(acc => acc.email === outlookAddress);
    
    if (existingIndex >= 0) {
      // Update existing account
      existingAccounts[existingIndex] = {
        email: outlookAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        connectedAt: existingAccounts[existingIndex].connectedAt,
        updatedAt: new Date().toISOString(),
        profilePicture,
        isActive: existingAccounts[existingIndex].isActive
      };
    } else {
      // Add new account
      existingAccounts.push({
        email: outlookAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        connectedAt: new Date().toISOString(),
        profilePicture,
        isActive: existingAccounts.length === 0
      });
    }

    const settingsToSave = {
      ...existingSettings,
      outlookAccounts: existingAccounts,
      activeOutlookIndex: existingAccounts.findIndex(acc => acc.isActive)
    };

    console.log('📝 [OUTLOOK AUTH] Saving to DynamoDB:', {
      userId,
      accountsCount: existingAccounts.length,
      accounts: existingAccounts.map(a => ({ email: a.email, isActive: a.isActive })),
      activeIndex: settingsToSave.activeOutlookIndex
    });

    await awsManager.saveUserSettings(userId, settingsToSave);
    console.log('✅ [OUTLOOK AUTH] Outlook connected successfully');

    // Send HTML that closes the popup and signals parent
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Outlook Connected</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #0078d4 0%, #106ebe 100%);
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
            <h1>Outlook Connected!</h1>
            <p class="email">${outlookAddress}</p>
            <p>This window will close automatically...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OUTLOOK_CONNECTED', email: '${outlookAddress}' }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Callback error:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            h1 { color: #dc2626; margin: 0 0 10px; font-size: 28px; }
            p { color: #6b7280; margin: 0; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Connection Failed</h1>
            <p>${error.message || 'Please try again'}</p>
          </div>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * Get Outlook connection status
 * GET /api/auth/outlook/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    const outlookAccounts = userSettings.outlookAccounts || [];
    const activeIndex = userSettings.activeOutlookIndex || 0;

    res.json({
      connected: outlookAccounts.length > 0,
      accounts: outlookAccounts,
      activeIndex: activeIndex
    });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Status check error:', error);
    res.status(500).json({ error: 'Failed to check Outlook status' });
  }
});

/**
 * Disconnect Outlook account
 * POST /api/auth/outlook/disconnect
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;

    const userSettings = await awsManager.getUserSettings(userId) || {};
    const outlookAccounts = userSettings.outlookAccounts || [];

    const updatedAccounts = outlookAccounts.filter(acc => acc.email !== email);
    
    // Update active index if needed
    let activeIndex = userSettings.activeOutlookIndex || 0;
    if (activeIndex >= updatedAccounts.length) {
      activeIndex = Math.max(0, updatedAccounts.length - 1);
    }

    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      outlookAccounts: updatedAccounts,
      activeOutlookIndex: activeIndex
    });

    console.log(`✅ [OUTLOOK AUTH] Disconnected ${email} for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Outlook account' });
  }
});

/**
 * Set active Outlook account
 * POST /api/auth/outlook/set-active
 */
router.post('/set-active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountIndex } = req.body;

    const userSettings = await awsManager.getUserSettings(userId) || {};
    const outlookAccounts = userSettings.outlookAccounts || [];

    if (accountIndex < 0 || accountIndex >= outlookAccounts.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Update isActive flags
    outlookAccounts.forEach((acc, idx) => {
      acc.isActive = idx === accountIndex;
    });

    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      outlookAccounts,
      activeOutlookIndex: accountIndex
    });

    console.log(`✅ [OUTLOOK AUTH] Set active account to ${outlookAccounts[accountIndex].email} for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Set active error:', error);
    res.status(500).json({ error: 'Failed to set active account' });
  }
});

export default router;
