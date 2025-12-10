import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://meridian-kdew.onrender.com/api/calendar/oauth-callback'
);

// Get Google OAuth URL
router.get('/google-oauth-url', authenticateToken, async (req, res) => {
  try {
    console.log('[CALENDAR] Generating OAuth URL with redirect:', oauth2Client.redirectUri);
    console.log('[CALENDAR] Client ID:', process.env.GOOGLE_CLIENT_ID);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      state: req.user.userId, // Pass userId in state to identify user after OAuth
      prompt: 'consent' // Force consent screen to get refresh token
    });

    console.log('[CALENDAR] Generated auth URL:', authUrl);
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate OAuth URL' 
    });
  }
});

// OAuth callback handler
router.get('/oauth-callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Missing authorization code or user ID');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Get existing user settings
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    // Store tokens in user settings
    await awsManager.saveUserSettings(userId, {
      ...userSettings,
      calendarTokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
        token_type: tokens.token_type
      }
    });

    console.log(`[CALENDAR] Google Calendar connected for user ${userId}`);

    // Show success page that auto-closes
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected</title>
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">
              <svg viewBox="0 0 52 52">
                <polyline points="14 27 22 35 38 17"/>
              </svg>
            </div>
            <h1>Calendar Connected!</h1>
            <p>This window will close automatically...</p>
          </div>
          <script>
            // Close window after 2 seconds
            setTimeout(() => {
              window.close();
              // Fallback if window.close() doesn't work
              if (!window.closed) {
                document.querySelector('p').textContent = 'You can close this window now.';
              }
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
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
              max-width: 400px;
            }
            .error-icon {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: #ef4444;
              margin: 0 auto 20px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .error-icon svg {
              width: 50px;
              height: 50px;
              stroke: white;
              stroke-width: 3;
            }
            h1 { color: #1f2937; margin: 0 0 10px; font-size: 28px; }
            p { color: #6b7280; margin: 0 0 20px; font-size: 14px; }
            button {
              background: #3b82f6;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
            }
            button:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </div>
            <h1>Connection Failed</h1>
            <p>${error.message}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
        </body>
      </html>
    `);
  }
});

// Get calendar connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userSettings = await awsManager.getUserSettings(req.user.userId);
    
    const googleConnected = !!(userSettings?.calendarTokens?.refresh_token);
    const calendlyLink = userSettings?.calendlyLink || '';

    res.json({ 
      success: true, 
      googleConnected,
      calendlyLink
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check calendar status' 
    });
  }
});

// Save Calendly link
router.post('/calendly-link', authenticateToken, async (req, res) => {
  try {
    const { calendlyLink } = req.body;
    
    // Get existing settings
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};

    await awsManager.saveUserSettings(req.user.userId, {
      ...userSettings,
      calendlyLink: calendlyLink || ''
    });

    console.log(`[CALENDAR] Calendly link saved for user ${req.user.userId}`);

    res.json({ 
      success: true, 
      message: 'Calendly link saved successfully' 
    });
  } catch (error) {
    console.error('Error saving Calendly link:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save Calendly link' 
    });
  }
});

// Disconnect Google Calendar
router.post('/disconnect-google', authenticateToken, async (req, res) => {
  try {
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    
    if (userSettings?.calendarTokens?.access_token) {
      // Revoke token with Google
      try {
        await oauth2Client.revokeToken(userSettings.calendarTokens.access_token);
      } catch (revokeError) {
        console.log('Token revocation failed (may already be invalid):', revokeError.message);
      }
    }

    // Remove tokens from settings
    delete userSettings.calendarTokens;
    
    await awsManager.saveUserSettings(req.user.userId, userSettings);

    console.log(`[CALENDAR] Google Calendar disconnected for user ${req.user.userId}`);

    res.json({ 
      success: true, 
      message: 'Google Calendar disconnected successfully' 
    });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to disconnect Google Calendar' 
    });
  }
});

export default router;
