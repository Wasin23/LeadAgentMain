// Webhook routes for domain-based desktop email tracking
import express from 'express';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';

const router = express.Router();

// Simple webhook endpoints for examarkchat.com tracking scripts

// CORS preflight handlers
router.options('/track-open', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

router.options('/track-click', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

router.options('/track-open', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Webhook endpoint for email opens (from examarkchat.com/track/pixel)
router.post('/track-open', async (req, res) => {
  try {
    // Add CORS headers for cross-origin requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle cases where body might not be parsed
    const body = req.body || {};
    
    // Basic debugging (can be removed once stable)
    if (!body.trackingId) {
      console.log('📧 [WEBHOOK] No tracking ID - Headers:', req.headers['content-type']);
      console.log('📧 [WEBHOOK] Body received:', JSON.stringify(body));
    }
    
    let { trackingId, userAgent, ip, timestamp } = body;
    
    if (trackingId) {
      // If we got a shortened tracking ID, try to find the full one
      if (trackingId.length <= 8) {
        const fullTrackingId = desktopEmailTracker.findTrackingIdByPrefix(trackingId);
        if (fullTrackingId) {
          console.log(`📧 [WEBHOOK] Found full tracking ID: ${trackingId} -> ${fullTrackingId}`);
          trackingId = fullTrackingId;
        } else {
          console.log(`📧 [WEBHOOK] No full tracking ID found for prefix: ${trackingId}`);
        }
      }
      
      await desktopEmailTracker.recordOpen(trackingId, userAgent, ip);
      console.log(`📧 [WEBHOOK] Email opened: ${trackingId}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error recording open:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoint for link clicks (from examarkchat.com/track/click)
router.post('/track-click', async (req, res) => {
  try {
    // Add CORS headers for cross-origin requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    let { trackingId, url, userAgent, ip, timestamp } = req.body;
    
    if (trackingId && url) {
      // If we got a shortened tracking ID, try to find the full one
      if (trackingId.length <= 8) {
        const fullTrackingId = desktopEmailTracker.findTrackingIdByPrefix(trackingId);
        if (fullTrackingId) {
          console.log(`🔗 [WEBHOOK] Found full tracking ID: ${trackingId} -> ${fullTrackingId}`);
          trackingId = fullTrackingId;
        } else {
          console.log(`🔗 [WEBHOOK] No full tracking ID found for prefix: ${trackingId}`);
        }
      }
      
      await desktopEmailTracker.recordClick(trackingId, url, 'general', userAgent, ip);
      console.log(`🔗 [WEBHOOK] Link clicked: ${trackingId} -> ${url}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error recording click:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint for domain scripts
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'ExaMark desktop tracking webhooks active',
    timestamp: new Date().toISOString()
  });
});

export default router;
