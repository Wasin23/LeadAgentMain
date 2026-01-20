// Desktop email tracking routes
import express from 'express';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';
import AWSManager from '../utils/awsManager.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';

const router = express.Router();
const awsManager = new AWSManager();
const awsQueue = new AWSEmailQueue();

// Helper function to handle open tracking (shared by multiple routes)
async function handleOpenTracking(trackingId, userAgent, ip, res) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔔 [TRACKING PIXEL] Open tracking endpoint hit!');
  console.log('🔑 [TRACKING PIXEL] Tracking ID:', trackingId);
  console.log('🌐 [TRACKING PIXEL] User Agent:', userAgent);
  console.log('📍 [TRACKING PIXEL] IP:', ip);
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Log to DynamoDB for AWS-based tracking
  try {
    const userId = trackingId.split('_')[0].replace('tracking-', '');
    const agentId = trackingId.split('_')[1];
    
    console.log('👤 [TRACKING] Extracted userId:', userId);
    console.log('🤖 [TRACKING] Extracted agentId:', agentId);
    
    // Check if this is the first hit (proxy hit)
    let existingEvents = [];
    try {
      existingEvents = await awsManager.getEmailTrackingByTracking(trackingId);
      console.log('📊 [TRACKING] Found', existingEvents.length, 'existing tracking events');
    } catch (queryError) {
      console.error('⚠️ [TRACKING PIXEL] Error querying existing events:', queryError.message);
    }
    
    const hasBeenOpenedBefore = existingEvents.some(e => e.eventType === 'open');
    const hasProxyHit = existingEvents.some(e => e.eventType === 'proxy');
    
    console.log('📧 [TRACKING] Has been opened before:', hasBeenOpenedBefore);
    console.log('🔍 [TRACKING] Has proxy hit:', hasProxyHit);
    
    // Get email sent time
    let emailSentTime = null;
    console.log('⏰ [INBOX DETECTION] Fetching email sent time...');
    try {
      let sentEmails;
      if (!agentId || agentId === 'null') {
        console.log('📧 [INBOX DETECTION] Fetching all user emails (orphaned)...');
        sentEmails = await awsQueue.getAllSentEmailsForUser(userId);
      } else {
        console.log('📧 [INBOX DETECTION] Fetching emails for agent:', agentId);
        sentEmails = await awsQueue.getSentEmails(userId, agentId);
      }
      
      console.log(`📊 [INBOX DETECTION] Found ${sentEmails.length} sent emails`);
      const emailData = sentEmails.find(e => e.trackingId === trackingId);
      if (emailData && emailData.sentAt) {
        emailSentTime = new Date(emailData.sentAt).getTime();
        console.log('✅ [INBOX DETECTION] Email sent at:', new Date(emailSentTime).toISOString());
      } else {
        console.warn('⚠️ [INBOX DETECTION] No email found with trackingId:', trackingId);
      }
    } catch (err) {
      console.error('❌ [INBOX DETECTION] Error:', err.message);
    }
    
    const now = Date.now();
    const timeSinceSent = emailSentTime ? (now - emailSentTime) / 1000 : null;
    const isProxyHit = timeSinceSent !== null && timeSinceSent < 10;
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⏱️  [INBOX DETECTION] TIMING ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⏳ Time since sent:', timeSinceSent !== null ? `${timeSinceSent.toFixed(2)}s` : 'UNKNOWN');
    console.log('🎯 Classification:', isProxyHit ? '🟢 PRIMARY INBOX (<10s)' : '📧 PROMOTIONAL/MANUAL (>10s)');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (!hasProxyHit && !hasBeenOpenedBefore) {
      if (isProxyHit) {
        console.log(`🟢 [TRACKING] PRIMARY INBOX - Recording proxy hit`);
        await awsManager.logEmailTracking(userId, agentId, trackingId, {
          eventType: 'proxy',
          ipAddress: ip,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          timeSinceSent: timeSinceSent
        });
        
        try {
          const { broadcastAIResponse } = await import('./outreach.js');
          broadcastAIResponse(userId, {
            type: 'email_primary_inbox',
            trackingId,
            agentId,
            timestamp: new Date().toISOString()
          });
          console.log('📡 [TRACKING] Broadcasted primary inbox event via SSE');
        } catch (broadcastErr) {
          console.error('❌ [TRACKING] Error broadcasting:', broadcastErr.message);
        }
      } else {
        console.log(`📧 [TRACKING] REAL OPEN - Recording open event`);
        await awsManager.logEmailTracking(userId, agentId, trackingId, {
          eventType: 'open',
          ipAddress: ip,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          timeSinceSent: timeSinceSent
        });
        
        try {
          const { broadcastAIResponse } = await import('./outreach.js');
          broadcastAIResponse(userId, {
            type: 'email_opened',
            trackingId,
            agentId,
            timestamp: new Date().toISOString()
          });
          console.log('📡 [TRACKING] Broadcasted email opened event via SSE');
        } catch (broadcastErr) {
          console.error('❌ [TRACKING] Error broadcasting:', broadcastErr.message);
        }
      }
    } else if (hasProxyHit && !hasBeenOpenedBefore) {
      console.log(`📧 [TRACKING] Second hit after proxy - REAL USER OPEN`);
      await awsManager.logEmailTracking(userId, agentId, trackingId, {
        eventType: 'open',
        ipAddress: ip,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
        timeSinceSent: timeSinceSent
      });
      
      try {
        const { broadcastAIResponse } = await import('./outreach.js');
        broadcastAIResponse(userId, {
          type: 'email_opened',
          trackingId,
          agentId,
          timestamp: new Date().toISOString()
        });
        console.log('📡 [TRACKING] Broadcasted email opened event via SSE');
      } catch (broadcastErr) {
        console.error('❌ [TRACKING] Error broadcasting:', broadcastErr.message);
      }
    } else {
      console.log(`🔄 [TRACKING] Already recorded (${existingEvents.length} events) - Ignoring duplicate`);
    }
  } catch (error) {
    console.error('❌ [TRACKING PIXEL] Error logging tracking:', error);
  }
  
  // Return 1x1 transparent PNG
  const img = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': img.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(img);
  console.log('✅ [TRACKING] Pixel image sent');
  console.log('═══════════════════════════════════════════════════════════════');
}

// NEW: Disguised tracking pixel route - /r/:trackingId.gif (looks like a regular image)
router.get('/:trackingId.gif', async (req, res) => {
  let { trackingId } = req.params;
  // Remove .gif extension if present in the trackingId
  trackingId = trackingId.replace('.gif', '');
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  await handleOpenTracking(trackingId, userAgent, ip, res);
});

// Tracking pixel endpoint (1x1 transparent PNG)
// Both /pixel/ and /open/ routes for compatibility
router.get('/open/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  await handleOpenTracking(trackingId, userAgent, ip, res);
});

// Legacy /pixel/ route for backwards compatibility
router.get('/pixel/:trackingId.png', async (req, res) => {
  const { trackingId } = req.params;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  console.log('🔔 [TRACKING PIXEL] Endpoint hit!');
  console.log('[TRACKING PIXEL] Tracking ID:', trackingId);
  console.log('[TRACKING PIXEL] User Agent:', userAgent);
  console.log('[TRACKING PIXEL] IP:', ip);
  
  // NEW: Log to DynamoDB for AWS-based tracking
  try {
    const userId = trackingId.split('_')[0].replace('tracking-', ''); // Extract userId
    const agentId = trackingId.split('_')[1]; // Extract agentId
    
    // Check if this is the first hit (proxy hit) - if so, skip recording
    let existingEvents = [];
    try {
      existingEvents = await awsManager.getEmailTrackingByTracking(trackingId);
    } catch (queryError) {
      console.error('⚠️ [TRACKING PIXEL] Error querying existing events, assuming first hit:', queryError.message);
    }
    
    const hasBeenOpenedBefore = existingEvents.some(e => e.eventType === 'open');
    const hasProxyHit = existingEvents.some(e => e.eventType === 'proxy');
    
    // Get email sent time to determine if this is a proxy hit (immediate) or real open (delayed)
    let emailSentTime = null;
    console.log('⏰ [INBOX DETECTION] Fetching email sent time for timing analysis...');
    console.log('🔍 [INBOX DETECTION] userId:', userId, 'agentId:', agentId);
    try {
      // For orphaned emails (agentId is null or 'null'), get all user emails
      let sentEmails;
      if (!agentId || agentId === 'null') {
        console.log('📧 [INBOX DETECTION] Orphaned email detected, fetching all user emails...');
        sentEmails = await awsQueue.getAllSentEmailsForUser(userId);
      } else {
        console.log('📧 [INBOX DETECTION] Fetching emails for specific agent:', agentId);
        sentEmails = await awsQueue.getSentEmails(userId, agentId);
      }
      
      console.log(`📊 [INBOX DETECTION] Found ${sentEmails.length} sent emails to search`);
      const emailData = sentEmails.find(e => e.trackingId === trackingId);
      if (emailData && emailData.sentAt) {
        emailSentTime = new Date(emailData.sentAt).getTime();
        console.log('✅ [INBOX DETECTION] Found email with sentAt:', new Date(emailSentTime).toISOString());
      } else {
        console.warn('⚠️ [INBOX DETECTION] No email found with sentAt timestamp for trackingId:', trackingId);
        if (sentEmails.length > 0) {
          console.log('📋 [INBOX DETECTION] Sample tracking IDs:', sentEmails.slice(0, 3).map(e => e.trackingId));
        }
      }
    } catch (err) {
      console.error('❌ [INBOX DETECTION] Error fetching email sent time:', err.message);
    }
    
    const now = Date.now();
    const timeSinceSent = emailSentTime ? (now - emailSentTime) / 1000 : null; // seconds
    const isProxyHit = timeSinceSent !== null && timeSinceSent < 10; // Less than 10 seconds = proxy/Primary inbox
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⏱️  [INBOX DETECTION] TIMING ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📧 Tracking ID:', trackingId);
    console.log('📅 Email sent at:', emailSentTime ? new Date(emailSentTime).toISOString() : 'UNKNOWN');
    console.log('🕐 Pixel hit at:', new Date(now).toISOString());
    console.log('⏳ Time since sent:', timeSinceSent !== null ? `${timeSinceSent.toFixed(2)} seconds` : 'UNKNOWN');
    console.log('🎯 Classification:', isProxyHit ? '🟢 PRIMARY INBOX (auto-load <10s)' : '📧 PROMOTIONAL/MANUAL OPEN (>10s or unknown timing)');
    console.log('📊 Has previous proxy hit:', hasProxyHit);
    console.log('📊 Has previous open event:', hasBeenOpenedBefore);
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (!hasProxyHit && !hasBeenOpenedBefore) {
      // First hit ever for this email
      if (isProxyHit) {
        console.log(`🟢 [TRACKING PIXEL] First hit within ${timeSinceSent?.toFixed(1)}s of sending - PRIMARY INBOX (proxy)`);
        
        // Record as proxy hit (Gmail auto-loaded images in Primary inbox)
        await awsManager.logEmailTracking(userId, agentId, trackingId, {
          eventType: 'proxy',
          ipAddress: ip,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          timeSinceSent: timeSinceSent
        });
        
        // Broadcast proxy hit to SSE
        try {
          const { broadcastAIResponse } = await import('./outreach.js');
          broadcastAIResponse(userId, agentId, {
            type: 'tracking_update',
            trackingId: trackingId,
            eventType: 'proxy',
            timestamp: new Date().toISOString()
          });
          console.log('✅ [TRACKING PIXEL] SSE broadcast sent for proxy hit');
        } catch (sseError) {
          console.error('[TRACKING PIXEL] SSE broadcast failed:', sseError.message);
        }
        
        // Send the pixel but don't record as open
        const pixel = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          'base64'
        );
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': pixel.length,
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          'Expires': '0'
        });
        return res.end(pixel);
      } else {
        console.log(`📧 [TRACKING PIXEL] First hit ${timeSinceSent ? `after ${timeSinceSent.toFixed(1)}s` : 'with unknown timing'} - REAL USER OPEN (likely Promotions/Social)`);
        // Continue to record as real open below
      }
    } else if (hasProxyHit && !hasBeenOpenedBefore) {
      console.log('✅ [TRACKING PIXEL] Second hit after proxy - recording as real open');
    } else {
      console.log('✅ [TRACKING PIXEL] Subsequent open detected');
    }
    
    console.log(`[TRACKING PIXEL] Existing events: ${existingEvents.length}, hasBeenOpenedBefore: ${hasBeenOpenedBefore}`);
    
    // Get email details from queue to get recipient info
    let recipientEmail = null;
    let leadName = null;
    let subject = null;
    try {
      console.log(`[TRACKING PIXEL] Fetching sent emails for userId: ${userId}, agentId: ${agentId}`);
      
      // For orphaned emails (agentId is null or 'null'), get all user emails
      let sentEmails;
      if (!agentId || agentId === 'null') {
        console.log('[TRACKING PIXEL] Using getAllSentEmailsForUser for orphaned email');
        sentEmails = await awsQueue.getAllSentEmailsForUser(userId);
      } else {
        sentEmails = await awsQueue.getSentEmails(userId, agentId);
      }
      
      console.log(`[TRACKING PIXEL] Found ${sentEmails.length} sent emails`);
      
      if (sentEmails.length > 0) {
        console.log(`[TRACKING PIXEL] Sample email structure:`, {
          trackingId: sentEmails[0].trackingId,
          to: sentEmails[0].to,
          subject: sentEmails[0].subject,
          leadName: sentEmails[0].leadName
        });
      }
      
      const emailData = sentEmails.find(e => e.trackingId === trackingId);
      if (emailData) {
        console.log(`[TRACKING PIXEL] Full email data keys:`, Object.keys(emailData));
        console.log(`[TRACKING PIXEL] Email data sample:`, {
          to: emailData.to,
          leadName: emailData.leadName,
          recipientName: emailData.recipientName,
          personInfo: emailData.personInfo,
          leadInfo: emailData.leadInfo,
          lead: emailData.lead,
          recipient: emailData.recipient
        });
        
        recipientEmail = emailData.to;
        leadName = emailData.leadName || 
                   emailData.personInfo?.fullName || 
                   emailData.personInfo?.name || 
                   emailData.leadInfo?.name || 
                   emailData.lead?.name ||
                   emailData.lead?.fullName ||
                   emailData.recipientName ||
                   emailData.recipient?.name ||
                   (emailData.to ? emailData.to.split('@')[0] : null);
        subject = emailData.subject || emailData.emailSubject;
        console.log(`[TRACKING PIXEL] Found email data: to=${recipientEmail}, leadName=${leadName}, subject=${subject}`);
      } else {
        console.log(`[TRACKING PIXEL] No email found with trackingId: ${trackingId}`);
        console.log(`[TRACKING PIXEL] Available tracking IDs:`, sentEmails.slice(0, 3).map(e => ({ 
          trackingId: e.trackingId, 
          id: e.id,
          mailgunId: e.mailgunId 
        })));
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
    
    // Broadcast to SSE clients for real-time UI updates
    try {
      const { broadcastAIResponse } = await import('./outreach.js');
      const isFirstOpen = !hasBeenOpenedBefore;
      broadcastAIResponse(userId, agentId, {
        type: 'tracking_update',
        trackingId: trackingId,
        eventType: 'open',
        recipientEmail,
        leadName,
        subject,
        isFirstOpen,
        timestamp: new Date().toISOString()
      });
      console.log('✅ [TRACKING PIXEL] SSE broadcast sent for open event');
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

// Click tracking endpoint - supports both /click/:trackingId and when mounted at /c/:trackingId
// Accepts both ?url= (legacy) and ?u= (new disguised) parameters
router.get('/click/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  const url = req.query.url || req.query.u; // Support both 'url' and 'u' params
  const type = req.query.type || 'general';
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

// NEW: Disguised click tracking - /:trackingId (when mounted at /c)
// This allows /c/trackingId123?u=https://... format
router.get('/:trackingId', async (req, res, next) => {
  const { trackingId } = req.params;
  const url = req.query.url || req.query.u;
  
  // If no URL param, this might be a different route - pass to next handler
  if (!url) {
    return next();
  }
  
  const type = req.query.type || 'general';
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
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
