import express from 'express';
import OutlookManager from '../utils/outlookManager.js';
import AWSManager from '../utils/awsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const outlookManager = new OutlookManager();
const awsManager = new AWSManager();
const processedNotifications = new Map();
const PROCESSED_NOTIFICATION_LIMIT = 1000;

function markNotificationProcessed(key) {
  processedNotifications.set(key, Date.now());
  if (processedNotifications.size > PROCESSED_NOTIFICATION_LIMIT) {
    const newest = [...processedNotifications.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.floor(PROCESSED_NOTIFICATION_LIMIT / 2));
    processedNotifications.clear();
    newest.forEach(([entryKey, timestamp]) => processedNotifications.set(entryKey, timestamp));
  }
}

function extractMessageIdFromResource(resource = '') {
  const match = String(resource).match(/messages\/([^/?]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractTrackingId(message = {}) {
  const candidates = [message.inReplyTo, message.references, message.messageId];
  for (const value of candidates) {
    if (!value || !String(value).includes('tracking-')) {
      continue;
    }

    const match = String(value).match(/tracking-([a-f0-9]{8}_[^_]+_\d+_[a-f0-9]+)/i);
    if (match) {
      return `tracking-${match[1]}`;
    }
  }

  return null;
}

async function findSubscriptionOwner(subscriptionId) {
  const users = await awsManager.getAllUsers();

  for (const user of users) {
    const userSettings = await awsManager.getUserSettings(user.userId);
    const outlookAccounts = userSettings?.outlookAccounts || [];

    for (let accountIndex = 0; accountIndex < outlookAccounts.length; accountIndex += 1) {
      const account = outlookAccounts[accountIndex];
      if (account?.replySubscription?.subscriptionId === subscriptionId) {
        return { userId: user.userId, userSettings, accountIndex, account };
      }
    }
  }

  return null;
}

async function processOutlookNotification(notification) {
  const owner = await findSubscriptionOwner(notification.subscriptionId);
  if (!owner) {
    console.log(`⚠️ [OUTLOOK WEBHOOK] No owner found for subscription ${notification.subscriptionId}`);
    return;
  }

  if (
    owner.account?.replySubscription?.clientState &&
    notification.clientState &&
    owner.account.replySubscription.clientState !== notification.clientState
  ) {
    console.log(`⚠️ [OUTLOOK WEBHOOK] Client state mismatch for ${owner.account.email}`);
    return;
  }

  const messageId = notification.resourceData?.id || extractMessageIdFromResource(notification.resource);
  if (!messageId) {
    console.log('⚠️ [OUTLOOK WEBHOOK] Notification missing message ID');
    return;
  }

  const dedupeKey = `${notification.subscriptionId}:${notification.changeType || 'created'}:${messageId}`;
  if (processedNotifications.has(dedupeKey)) {
    return;
  }
  markNotificationProcessed(dedupeKey);

  const fullMessage = await outlookManager.getMessage(owner.userId, messageId, owner.accountIndex);
  const normalizedMessage = outlookManager.normalizeReplyMessage(fullMessage);
  const trackingId = extractTrackingId(normalizedMessage);

  if (!trackingId) {
    console.log(`📭 [OUTLOOK WEBHOOK] Ignoring untracked inbox message for ${owner.account.email}`);
    return;
  }

  if (
    normalizedMessage.from &&
    owner.account?.email &&
    normalizedMessage.from.toLowerCase() === owner.account.email.toLowerCase()
  ) {
    return;
  }

  console.log(`📧 [OUTLOOK WEBHOOK] Processing tracked reply from ${normalizedMessage.from}`);
  const { processGmailReply } = await import('./webhooks-reply.js');
  await processGmailReply(owner.userId, normalizedMessage);
}

async function processNotificationBatch(notifications = []) {
  for (const notification of notifications) {
    try {
      await processOutlookNotification(notification);
    } catch (error) {
      console.error('❌ [OUTLOOK WEBHOOK] Notification processing error:', error.response?.data || error.message);
    }
  }
}

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
    
    let targetAccountIndex = existingIndex;

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
      targetAccountIndex = existingAccounts.length - 1;
    }

    if (!existingAccounts.some(acc => acc.isActive)) {
      existingAccounts[0].isActive = true;
    }

    const activeIndex = existingAccounts.findIndex(acc => acc.isActive);

    const settingsToSave = {
      ...existingSettings,
      outlookAccounts: existingAccounts,
      activeOutlookIndex: activeIndex >= 0 ? activeIndex : 0
    };

    console.log('📝 [OUTLOOK AUTH] Saving to DynamoDB:', {
      userId,
      accountsCount: existingAccounts.length,
      accounts: existingAccounts.map(a => ({ email: a.email, isActive: a.isActive })),
      activeIndex: settingsToSave.activeOutlookIndex
    });

    await awsManager.saveUserSettings(userId, settingsToSave);
    console.log('✅ [OUTLOOK AUTH] Outlook connected successfully');

    try {
      await outlookManager.setupReplySubscription(userId, targetAccountIndex >= 0 ? targetAccountIndex : settingsToSave.activeOutlookIndex, true);
    } catch (subscriptionError) {
      console.error('❌ [OUTLOOK AUTH] Failed to activate reply subscription:', subscriptionError.response?.data || subscriptionError.message);
    }

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

    const accountIndex = outlookAccounts.findIndex(acc => acc.email === email);
    if (accountIndex >= 0) {
      try {
        await outlookManager.deleteReplySubscription(userId, accountIndex);
      } catch (error) {
        console.error(`❌ [OUTLOOK AUTH] Failed to delete subscription for ${email}:`, error.response?.data || error.message);
      }
    }

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

    // Revert any agents that were using Outlook back to Mailgun
    const revertedAgents = [];
    try {
      const userData = await awsManager.getUserById(userId);
      const agents = userData?.activeAgents || [];
      for (const agent of agents) {
        try {
          const agentSettings = await awsManager.getLeadAgentSettings(userId, agent.agentId);
          if (agentSettings?.emailBuilder?.useOutlook === true) {
            await awsManager.saveLeadAgentSettings(userId, agent.agentId, {
              ...agentSettings,
              emailBuilder: { ...agentSettings.emailBuilder, useOutlook: false }
            });
            revertedAgents.push({ agentId: agent.agentId, name: agentSettings.name || agentSettings.agentName || agent.agentId });
          }
        } catch (e) {
          console.error(`[OUTLOOK AUTH] Failed to revert agent ${agent.agentId}:`, e.message);
        }
      }
    } catch (e) {
      console.error('[OUTLOOK AUTH] Failed to revert agents:', e.message);
    }

    console.log(`✅ [OUTLOOK AUTH] Disconnected ${email} for user ${userId}`);
    res.json({ success: true, revertedAgents });
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

    try {
      await outlookManager.setupReplySubscription(userId, accountIndex);
    } catch (error) {
      console.error('❌ [OUTLOOK AUTH] Failed to ensure reply subscription:', error.response?.data || error.message);
    }

    console.log(`✅ [OUTLOOK AUTH] Set active account to ${outlookAccounts[accountIndex].email} for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Set active error:', error);
    res.status(500).json({ error: 'Failed to set active account' });
  }
});

router.post('/setup-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountIndex } = req.body || {};
    const subscription = await outlookManager.setupReplySubscription(userId, Number.isInteger(accountIndex) ? accountIndex : null, true);

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Setup subscription error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to set up Outlook reply subscription' });
  }
});

router.post('/stop-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountIndex } = req.body || {};
    const result = await outlookManager.deleteReplySubscription(userId, Number.isInteger(accountIndex) ? accountIndex : null);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Stop subscription error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to stop Outlook reply subscription' });
  }
});

router.get('/subscription-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSettings = await awsManager.getUserSettings(userId) || {};
    const accounts = (userSettings.outlookAccounts || []).map((account, index) => {
      const expiry = account.replySubscription?.expirationDateTime ? new Date(account.replySubscription.expirationDateTime).getTime() : 0;
      return {
        email: account.email,
        isActive: account.isActive,
        accountIndex: index,
        replySubscription: account.replySubscription || null,
        subscriptionActive: !!account.replySubscription?.subscriptionId && expiry > Date.now()
      };
    });

    res.json({ success: true, accounts });
  } catch (error) {
    console.error('❌ [OUTLOOK AUTH] Subscription status error:', error);
    res.status(500).json({ error: 'Failed to fetch Outlook subscription status' });
  }
});

router.all('/webhook', async (req, res) => {
  const validationToken = typeof req.query.validationToken === 'string'
    ? req.query.validationToken
    : Array.isArray(req.query.validationToken)
      ? req.query.validationToken[0]
      : null;

  if (validationToken) {
    res.set('Content-Type', 'text/plain');
    return res.status(200).send(validationToken);
  }

  const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
  res.status(202).send('Accepted');

  if (notifications.length === 0) {
    return;
  }

  setImmediate(() => {
    processNotificationBatch(notifications);
  });
});

export default router;
