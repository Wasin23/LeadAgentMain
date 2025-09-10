// Webhook routes for domain-based desktop email tracking
import express from 'express';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';

const router = express.Router();

// Simple webhook endpoints for examarkchat.com tracking scripts

// Webhook endpoint for email opens (from examarkchat.com/track/pixel)
router.post('/track-open', async (req, res) => {
  try {
    let { trackingId, userAgent, ip, timestamp } = req.body;
    
    if (trackingId) {
      // If we got a shortened tracking ID, try to find the full one
      if (trackingId.length === 8) {
        const fullTrackingId = desktopEmailTracker.findTrackingIdByPrefix(trackingId);
        if (fullTrackingId) {
          trackingId = fullTrackingId;
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
    const { trackingId, url, userAgent, ip, timestamp } = req.body;
    
    if (trackingId && url) {
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
