import express from 'express';
import AWSManager from '../utils/awsManager.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();
const awsManager = new AWSManager();

const UNIPILE_API_URL = (process.env.UNIPILE_API_URL || '').replace(/\/$/, '');
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const APP_URL        = (process.env.API_BASE_URL || '').replace(/\/$/, '');

console.log('[LINKEDIN AUTH] Module loaded. UNIPILE_API_URL set:', !!UNIPILE_API_URL, '| APP_URL set:', !!APP_URL);

/**
 * GET /api/auth/linkedin/oauth-url
 * Creates a Unipile hosted auth link and returns the URL to open in a popup.
 */
router.get('/oauth-url', authenticateToken, async (req, res) => {
  try {
    console.log('[LINKEDIN AUTH] /oauth-url hit. UNIPILE_API_URL:', UNIPILE_API_URL ? 'set' : 'MISSING', '| UNIPILE_API_KEY:', UNIPILE_API_KEY ? 'set' : 'MISSING');
    if (!UNIPILE_API_URL || !UNIPILE_API_KEY) {
      return res.status(503).json({ error: 'LinkedIn integration not configured' });
    }

    const userId = req.user.userId;
    const state  = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response;
    try {
      response = await fetch(`${UNIPILE_API_URL}/api/v1/hosted/accounts/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': UNIPILE_API_KEY,
        },
        body: JSON.stringify({
          type: 'LINKEDIN',
          api_url: UNIPILE_API_URL,
          expiresOn: new Date(Date.now() + 1000 * 60 * 30).toISOString(), // 30 min
          success_redirect_url: `${APP_URL}/api/auth/linkedin/callback?state=${encodeURIComponent(state)}`,
          failure_redirect_url: `${APP_URL}/api/auth/linkedin/callback?error=1&state=${encodeURIComponent(state)}`,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const err = await response.text();
      console.error('[LINKEDIN AUTH] Unipile link error:', response.status, err);
      return res.status(502).json({ error: 'Failed to create LinkedIn auth link', detail: err });
    }

    const data = await response.json();
    console.log('[LINKEDIN AUTH] Unipile response keys:', Object.keys(data));
    res.json({ success: true, authUrl: data.url || data.auth_url || data.link });
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.error('[LINKEDIN AUTH] Unipile request timed out after 10s');
      return res.status(504).json({ error: 'LinkedIn auth request timed out — Unipile API unreachable' });
    }
    console.error('[LINKEDIN AUTH] oauth-url error:', error);
    res.status(500).json({ error: 'Failed to generate LinkedIn OAuth URL' });
  }
});

/**
 * GET /api/auth/linkedin/callback
 * Unipile redirects here after LinkedIn auth.
 * Saves the Unipile account_id to the user record, then closes the popup.
 */
router.get('/callback', async (req, res) => {
  const { account_id, state, error } = req.query;

  let userId = null;
  try {
    if (state) userId = JSON.parse(Buffer.from(decodeURIComponent(state), 'base64').toString()).userId;
  } catch { /* ignore */ }

  if (error || !account_id || !userId) {
    return res.send(`<html><body><script>
      window.opener?.postMessage({ type: 'LINKEDIN_ERROR', error: ${JSON.stringify(error || 'missing account')} }, '*');
      window.close();
    </script></body></html>`);
  }

  try {
    await awsManager.updateUser(userId, {
      linkedinAccountId: account_id,
      linkedinConnectedAt: new Date().toISOString(),
    });
    console.log(`[LINKEDIN AUTH] Connected account ${account_id} for user ${userId}`);
  } catch (err) {
    console.error('[LINKEDIN AUTH] Failed to save account_id:', err);
    return res.send(`<html><body><script>
      window.opener?.postMessage({ type: 'LINKEDIN_ERROR', error: 'Failed to save account' }, '*');
      window.close();
    </script></body></html>`);
  }

  res.send(`<html><body><script>
    window.opener?.postMessage({ type: 'LINKEDIN_CONNECTED', accountId: ${JSON.stringify(account_id)} }, '*');
    window.close();
  </script></body></html>`);
});

/**
 * GET /api/auth/linkedin/status
 * Returns whether the user has a connected LinkedIn account.
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await awsManager.getUser(req.user.userId);
    const accountId = user?.linkedinAccountId || null;
    res.json({ success: true, connected: !!accountId, accountId });
  } catch (error) {
    console.error('[LINKEDIN AUTH] status error:', error);
    res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
});

/**
 * POST /api/auth/linkedin/disconnect
 * Clears the stored Unipile account from the user record.
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const user = await awsManager.getUser(req.user.userId);
    const accountId = user?.linkedinAccountId;

    if (accountId && UNIPILE_API_URL && UNIPILE_API_KEY) {
      try {
        await fetch(`${UNIPILE_API_URL}/api/v1/accounts/${accountId}`, {
          method: 'DELETE',
          headers: { 'X-API-KEY': UNIPILE_API_KEY },
        });
      } catch { /* best-effort — remove from our side either way */ }
    }

    await awsManager.updateUser(req.user.userId, {
      linkedinAccountId: null,
      linkedinConnectedAt: null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[LINKEDIN AUTH] disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect LinkedIn' });
  }
});

export default router;
