// Desktop email tracking routes
import express from 'express';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';

const router = express.Router();

// Tracking pixel endpoint (1x1 transparent PNG)
router.get('/pixel/:trackingId.png', async (req, res) => {
  const { trackingId } = req.params;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Record the open
  await desktopEmailTracker.recordOpen(trackingId, userAgent, ip);
  
  // Return 1x1 transparent PNG
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.send(pixel);
});

// Click tracking endpoint
router.get('/click/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  const { url, type = 'general' } = req.query;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  if (!url) {
    return res.status(400).send('Missing URL parameter');
  }
  
  // Record the click
  await desktopEmailTracker.recordClick(trackingId, decodeURIComponent(url), type, userAgent, ip);
  
  // Redirect to original URL
  res.redirect(decodeURIComponent(url));
});

// Get tracking statistics (for analytics dashboard)
router.get('/stats', (req, res) => {
  const stats = desktopEmailTracker.getTrackingStats();
  res.json({
    success: true,
    data: stats
  });
});

// Get detailed tracking data for specific email
router.get('/details/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const trackingData = desktopEmailTracker.trackingData;
  
  if (trackingData.has(trackingId)) {
    res.json({
      success: true,
      data: trackingData.get(trackingId)
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Tracking ID not found'
    });
  }
});

export default router;
