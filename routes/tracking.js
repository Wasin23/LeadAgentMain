// Desktop email tracking routes
import express from 'express';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';
import AWSManager from '../utils/awsManager.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';

const router = express.Router();
const awsManager = new AWSManager();
const awsQueue = new AWSEmailQueue();

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
    
    // Check if this is the first open
    const existingEvents = await awsManager.getEmailTrackingByTracking(trackingId);
    const isFirstOpen = !existingEvents.some(e => e.eventType === 'open');
    console.log(`[TRACKING PIXEL] Existing events: ${existingEvents.length}, isFirstOpen: ${isFirstOpen}`);
    
    // Get email details from queue to get recipient info
    let recipientEmail = null;
    let leadName = null;
    let subject = null;
    try {
      console.log(`[TRACKING PIXEL] Fetching sent emails for userId: ${userId}, agentId: ${agentId}`);
      const sentEmails = await awsQueue.getSentEmails(userId, agentId);
      console.log(`[TRACKING PIXEL] Found ${sentEmails.length} sent emails`);
      
      const emailData = sentEmails.find(e => e.trackingId === trackingId);
      if (emailData) {
        recipientEmail = emailData.to;
        leadName = emailData.leadName;
        subject = emailData.subject;
        console.log(`[TRACKING PIXEL] Found email data: to=${recipientEmail}, leadName=${leadName}, subject=${subject}`);
      } else {
        console.log(`[TRACKING PIXEL] No email found with trackingId: ${trackingId}`);
        console.log(`[TRACKING PIXEL] Available tracking IDs: ${sentEmails.map(e => e.trackingId).join(', ')}`);
      }
    } catch (err) {
      console.error('[TRACKING PIXEL] Error fetching email details:', err);
    }
    
    await awsManager.logEmailTracking(userId, agentId, trackingId, {
      eventType: 'open',
      recipientEmail,
      leadName,
      subject,
      ipAddress: ip,
      userAgent: userAgent,
      timestamp: new Date().toISOString()
    });
    console.log('✅ [TRACKING PIXEL] Logged to DynamoDB');
    
    // Log activity entry for first open
    if (isFirstOpen && recipientEmail) {
      try {
        await awsManager.logActivity(userId, agentId, {
          action: 'Email Viewed',
          details: `${leadName || recipientEmail} opened email${subject ? `: "${subject}"` : ''}`,
          metadata: {
            trackingId,
            recipientEmail,
            leadName,
            ipAddress: ip,
            userAgent
          }
        });
        console.log('✅ [TRACKING PIXEL] Activity logged for first open');
      } catch (activityErr) {
        console.error('[TRACKING PIXEL] Failed to log activity:', activityErr.message);
      }
    }
    
    // Broadcast to SSE clients for real-time UI updates
    try {
      const { broadcastAIResponse } = await import('./outreach.js');
      broadcastAIResponse(userId, agentId, {
        type: 'tracking_update',
        trackingId: trackingId,
        eventType: 'open',
        recipientEmail,
        leadName,
        isFirstOpen,
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
