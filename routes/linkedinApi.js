import express from 'express';

const router = express.Router();

// Store access tokens (in production, use a proper database)
const userTokens = new Map();

// Helper function to get LinkedIn credentials for a user
async function getLinkedInCredentials(userId) {
  // Use LinkedIn credentials from environment variables only
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:8080/api/linkedin-api/callback'
  };
}

// LinkedIn OAuth flow - initiate
router.get('/auth', async (req, res) => {
  const userId = req.query.userId; // Should come from session in production
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const credentials = await getLinkedInCredentials(userId);
  
  if (!credentials.clientId) {
    return res.status(400).json({
      success: false,
      error: 'LinkedIn API not configured. Please add LinkedIn credentials in Settings → API Keys.'
    });
  }

  const scope = 'openid,profile,email,w_member_social';
  const state = Math.random().toString(36).substring(7);
  
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${credentials.clientId}&` +
    `redirect_uri=${encodeURIComponent(credentials.redirectUri)}&` +
    `state=${state}&` +
    `scope=${encodeURIComponent(scope)}`;

  res.json({
    success: true,
    authUrl: authUrl,
    state: state
  });
});

// LinkedIn OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const userId = req.query.userId; // Should come from session in production
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'LinkedIn authorization failed: ' + error
    });
  }

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'No authorization code received'
    });
  }

  try {
    const credentials = await getLinkedInCredentials(userId);
    
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('LinkedIn API credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }

    // Get user profile to use as identifier
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const profile = await profileResponse.json();
    
    // Store token (in production, associate with user session)
    const userId = profile.sub;
    userTokens.set(userId, {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      profile: profile,
      createdAt: Date.now()
    });

    // Return success page
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 2rem;">
          <h2 style="color: #0077b5;">✅ LinkedIn Connected Successfully!</h2>
          <p>You can now close this window and return to ExaMark.</p>
          <p><strong>Connected as:</strong> ${profile.name}</p>
          <script>
            // Try to notify parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'linkedin_connected', profile: ${JSON.stringify(profile)} }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete LinkedIn authorization: ' + error.message
    });
  }
});

// Check connection status
router.get('/status', (req, res) => {
  // In production, get userId from session
  const userId = req.query.userId;
  
  if (!userId) {
    return res.json({
      success: true,
      connected: false,
      message: 'No user ID provided'
    });
  }

  const tokenData = userTokens.get(userId);
  
  if (!tokenData) {
    return res.json({
      success: true,
      connected: false
    });
  }

  // Check if token is expired
  const isExpired = Date.now() - tokenData.createdAt > (tokenData.expiresIn * 1000);
  
  if (isExpired) {
    userTokens.delete(userId);
    return res.json({
      success: true,
      connected: false,
      message: 'Token expired'
    });
  }

  res.json({
    success: true,
    connected: true,
    profile: tokenData.profile
  });
});

// Post to LinkedIn
router.post('/post', async (req, res) => {
  const { content, userId } = req.body;
  
  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Post content is required'
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  const tokenData = userTokens.get(userId);
  
  if (!tokenData) {
    return res.status(401).json({
      success: false,
      error: 'LinkedIn not connected. Please authorize first.'
    });
  }

  try {
    // Create LinkedIn post
    const postData = {
      author: `urn:li:person:${userId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error('LinkedIn API error: ' + JSON.stringify(result));
    }

    res.json({
      success: true,
      message: 'Post published to LinkedIn successfully',
      postId: result.id
    });

  } catch (error) {
    console.error('LinkedIn posting error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post to LinkedIn: ' + error.message
    });
  }
});

// Disconnect LinkedIn
router.post('/disconnect', (req, res) => {
  const { userId } = req.body;
  
  if (userId && userTokens.has(userId)) {
    userTokens.delete(userId);
  }
  
  res.json({
    success: true,
    message: 'LinkedIn disconnected successfully'
  });
});

export default router;
