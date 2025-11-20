import express from 'express';
import AWSManager from '../utils/awsManager.js';
import crypto from 'crypto';

const router = express.Router();
const awsManager = new AWSManager();

// In-memory token store (in production, use Redis or DynamoDB with TTL)
const tokens = new Map();

/**
 * Generate unsubscribe token for an email
 * Token format: base64(email:timestamp:hmac)
 */
function generateUnsubscribeToken(email) {
  const timestamp = Date.now();
  const secret = process.env.UNSUBSCRIBE_SECRET || 'meridian-unsubscribe-secret-change-me';
  const hmac = crypto.createHmac('sha256', secret)
    .update(`${email}:${timestamp}`)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars
  
  const tokenData = `${email}:${timestamp}:${hmac}`;
  const token = Buffer.from(tokenData).toString('base64url');
  
  // Store for validation (expires in 30 days)
  tokens.set(token, { email, createdAt: timestamp });
  
  return token;
}

/**
 * Validate unsubscribe token
 */
function validateUnsubscribeToken(token) {
  try {
    const tokenData = Buffer.from(token, 'base64url').toString('utf-8');
    const [email, timestamp, hmac] = tokenData.split(':');
    
    // Verify HMAC
    const secret = process.env.UNSUBSCRIBE_SECRET || 'meridian-unsubscribe-secret-change-me';
    const expectedHmac = crypto.createHmac('sha256', secret)
      .update(`${email}:${timestamp}`)
      .digest('hex')
      .substring(0, 16);
    
    if (hmac !== expectedHmac) {
      return { valid: false, error: 'Invalid token signature' };
    }
    
    // Check expiration (30 days)
    const age = Date.now() - parseInt(timestamp);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (age > maxAge) {
      return { valid: false, error: 'Token expired' };
    }
    
    return { valid: true, email };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
}

/**
 * GET /api/unsubscribe/generate
 * Generate unsubscribe token for testing
 */
router.get('/generate', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const token = generateUnsubscribeToken(email);
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?token=${token}`;
    
    res.json({
      success: true,
      email,
      token,
      url: unsubscribeUrl
    });
  } catch (error) {
    console.error('Error generating unsubscribe token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * GET /api/unsubscribe
 * Show unsubscribe confirmation page (can be called directly or via email link)
 */
router.get('/', async (req, res) => {
  try {
    const { token, email } = req.query;
    
    // If token provided, validate it
    if (token) {
      const validation = validateUnsubscribeToken(token);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          error: validation.error,
          message: 'Invalid or expired unsubscribe link' 
        });
      }
      
      // Return email for confirmation
      return res.json({
        success: true,
        email: validation.email,
        message: 'Ready to unsubscribe'
      });
    }
    
    // If email provided directly (for manual unsubscribe)
    if (email) {
      return res.json({
        success: true,
        email,
        message: 'Ready to unsubscribe'
      });
    }
    
    res.status(400).json({ error: 'Token or email required' });
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

/**
 * POST /api/unsubscribe
 * Actually unsubscribe the email
 */
router.post('/', async (req, res) => {
  try {
    const { token, email, reason } = req.body;
    
    let emailToUnsubscribe;
    
    // Validate token if provided
    if (token) {
      const validation = validateUnsubscribeToken(token);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          error: validation.error,
          message: 'Invalid or expired unsubscribe link' 
        });
      }
      
      emailToUnsubscribe = validation.email;
    } else if (email) {
      emailToUnsubscribe = email;
    } else {
      return res.status(400).json({ error: 'Token or email required' });
    }
    
    // Add to unsubscribe list
    const result = await awsManager.addUnsubscribe(
      emailToUnsubscribe, 
      reason || 'User request',
      {
        timestamp: new Date().toISOString(),
        source: token ? 'email_link' : 'manual',
        userAgent: req.headers['user-agent']
      }
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    console.log(`🚫 [UNSUBSCRIBE] Email unsubscribed: ${emailToUnsubscribe}`);
    
    res.json({
      success: true,
      email: emailToUnsubscribe,
      message: 'Successfully unsubscribed from all future emails'
    });
  } catch (error) {
    console.error('Error unsubscribing email:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * POST /api/unsubscribe/resubscribe
 * Re-subscribe an email (remove from unsubscribe list)
 */
router.post('/resubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const result = await awsManager.removeUnsubscribe(email);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    console.log(`✅ [RESUBSCRIBE] Email re-subscribed: ${email}`);
    
    res.json({
      success: true,
      email,
      message: 'Successfully re-subscribed'
    });
  } catch (error) {
    console.error('Error re-subscribing email:', error);
    res.status(500).json({ error: 'Failed to re-subscribe' });
  }
});

/**
 * GET /api/unsubscribe/check
 * Check if email is unsubscribed
 */
router.get('/check', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const isUnsubscribed = await awsManager.isUnsubscribed(email);
    
    res.json({
      success: true,
      email,
      isUnsubscribed
    });
  } catch (error) {
    console.error('Error checking unsubscribe status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * GET /api/unsubscribe/list
 * Get all unsubscribed emails (admin only)
 */
router.get('/list', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    const unsubscribes = await awsManager.getUnsubscribes(1000);
    
    res.json({
      success: true,
      count: unsubscribes.length,
      unsubscribes
    });
  } catch (error) {
    console.error('Error fetching unsubscribes:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribes' });
  }
});

// Export token generation function for use in email generation
export { generateUnsubscribeToken };
export default router;
