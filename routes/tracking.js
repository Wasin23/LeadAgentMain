// Desktop email tracking routes
import express from 'express';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();

// Tracking pixel endpoint (1x1 transparent PNG)
router.get('/pixel/:trackingId.png', async (req, res) => {
  const { trackingId } = req.params;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  console.log('🔔 [TRACKING PIXEL] Endpoint hit!');
  console.log('[TRACKING PIXEL] Tracking ID:', trackingId);
  console.log('[TRACKING PIXEL] User Agent:', userAgent);
  console.log('[TRACKING PIXEL] IP:', ip);
  
  // Record the open in old desktop tracker (for backwards compatibility)
  await desktopEmailTracker.recordOpen(trackingId, userAgent, ip);
  
  // NEW: Log to DynamoDB for AWS-based tracking
  try {
    const userId = trackingId.split('_')[0].replace('tracking-', ''); // Extract userId
    const agentId = trackingId.split('_')[1]; // Extract agentId
    
    await awsManager.logEmailTracking(userId, agentId, trackingId, {
      eventType: 'open',
      ipAddress: ip,
      userAgent: userAgent,
      timestamp: new Date().toISOString()
    });
    console.log('✅ [TRACKING PIXEL] Logged to DynamoDB');
    
    // Broadcast to SSE clients for real-time UI updates
    try {
      const { broadcastAIResponse } = await import('./outreach.js');
      broadcastAIResponse(userId, agentId, {
        type: 'tracking_update',
        trackingId: trackingId,
        eventType: 'open',
        timestamp: new Date().toISOString()
      });
      console.log('✅ [TRACKING PIXEL] SSE broadcast sent');
    } catch (sseError) {
      console.error('[TRACKING PIXEL] SSE broadcast failed:', sseError.message);
    }
  } catch (dbError) {
    console.error('❌ [TRACKING PIXEL] DynamoDB logging failed:', dbError);
  }
  
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
