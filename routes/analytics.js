import express from 'express';
import { updateEmailAnalytics } from '../tools/emailMailgun.js';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const awsManager = new AWSManager();
const awsQueue = new AWSEmailQueue();

// Debug endpoint to test tracking pixel HTML generation
router.get('/debug/email-html/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { addTrackingToEmail } = await import('../tools/emailMailgun.js');
    
    const testBody = "Hello! This is a test email.\n\nBest regards,\nMeridian Team";
    const htmlWithTracking = addTrackingToEmail(testBody.replace(/\n/g, '<br>'), trackingId);
    
    res.set('Content-Type', 'text/html');
    res.send(`
      <h2>Debug: Email HTML with Tracking</h2>
      <h3>Generated HTML:</h3>
      <pre>${htmlWithTracking.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      <h3>Rendered HTML:</h3>
      <div style="border: 1px solid #ccc; padding: 10px;">
        ${htmlWithTracking}
      </div>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track email opens (1x1 tracking pixel)
router.get('/track/open/:trackingId', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[TRACKING PIXEL] EMAIL OPENED!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Timestamp:', timestamp);
  try {
    const { trackingId } = req.params;
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    const forwarded = req.get('X-Forwarded-For') || '';
    
    console.log('Tracking ID:', trackingId);
    console.log('IP Address:', req.ip);
    console.log('User Agent:', userAgent);
    console.log('Referer:', referer);
    console.log('X-Forwarded-For:', forwarded);
    
    // Detect actual bots/crawlers (but allow email client proxies like Gmail)
    const imageProxyPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /facebookexternalhit/i,
      /proxymail\.facebook\.com/i,
      /mimecast/i,
      /barracuda/i,
      /proofpoint/i,
      /symantec/i,
      /messagelab/i
    ];
    
    const isImageProxy = imageProxyPatterns.some(pattern => 
      pattern.test(userAgent) || pattern.test(referer)
    );
    
    console.log('Is Image Proxy/Bot:', isImageProxy);
    
    // Only count as real open if not from image proxy
    if (!isImageProxy) {
      console.log('LEGITIMATE HIT - Processing...');
      
      // Parse tracking ID format: tracking-{userId}_{agentId}_{timestamp}_{random}
      const parts = trackingId.split('_');
      const userId = parts[0].replace('tracking-', ''); // Remove "tracking-" prefix
      const agentId = parts[1]; // Extract agentId
      
      console.log('User ID:', userId);
      console.log('Agent ID:', agentId);
      
      // STEP 1: Get email sent time to determine if this is a proxy hit (immediate) or real open (delayed)
      let emailSentTime = null;
      let isProxyHit = false;
      let eventType = 'open'; // Default to open
      
      console.log('⏰ [INBOX DETECTION] Fetching email sent time for timing analysis...');
      console.log('[INBOX DETECTION] userId:', userId, 'agentId:', agentId);
      try {
        // For orphaned emails (agentId is null or 'null'), get all user emails
        let sentEmails;
        if (!agentId || agentId === 'null') {
          console.log('[INBOX DETECTION] Orphaned email detected, fetching all user emails...');
          sentEmails = await awsQueue.getAllSentEmailsForUser(userId);
        } else {
          console.log('[INBOX DETECTION] Fetching emails for specific agent:', agentId);
          sentEmails = await awsQueue.getSentEmails(userId, agentId);
        }
        
        console.log(`[INBOX DETECTION] Found ${sentEmails.length} sent emails to search`);
        const emailData = sentEmails.find(e => e.trackingId === trackingId);
        if (emailData && emailData.sentAt) {
          emailSentTime = new Date(emailData.sentAt).getTime();
          console.log('[INBOX DETECTION] Found email with sentAt:', new Date(emailSentTime).toISOString());
        } else {
          console.warn('[INBOX DETECTION] No email found with sentAt timestamp for trackingId:', trackingId);
          if (sentEmails.length > 0) {
            console.log('[INBOX DETECTION] Sample tracking IDs:', sentEmails.slice(0, 3).map(e => e.trackingId));
          }
        }
      } catch (err) {
        console.error('[INBOX DETECTION] Error fetching email sent time:', err.message);
      }
      
      const now = Date.now();
      const timeSinceSent = emailSentTime ? (now - emailSentTime) / 1000 : null; // seconds
      isProxyHit = timeSinceSent !== null && timeSinceSent < 10; // Less than 10 seconds = proxy/Primary inbox
      
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('⏱️  [INBOX DETECTION] TIMING ANALYSIS');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('Tracking ID:', trackingId);
      console.log('Email sent at:', emailSentTime ? new Date(emailSentTime).toISOString() : 'UNKNOWN');
      console.log('Pixel hit at:', new Date(now).toISOString());
      console.log('⏳ Time since sent:', timeSinceSent !== null ? `${timeSinceSent.toFixed(2)} seconds` : 'UNKNOWN');
      console.log('Classification:', isProxyHit ? 'PRIMARY INBOX (auto-load <10s)' : 'USER OPENED (>10s or unknown timing)');
      console.log('═══════════════════════════════════════════════════════════════');
      
      // Determine event type based on timing
      eventType = isProxyHit ? 'proxy' : 'open';
      console.log(`[INBOX DETECTION] Recording as: ${eventType}`);
      
      // STEP 2: Only update email as "opened" if this is NOT a proxy hit
      if (!isProxyHit) {
        console.log('REAL USER OPEN - Marking email as opened!');
        console.log('Updating analytics in DynamoDB...');
        
        await updateEmailAnalytics(trackingId, {
          opened: true,
          openCount: 1, // Will be incremented if already opened
          lastActivity: new Date().toISOString(),
          ipAddress: req.ip
        });
        
        console.log('Analytics updated successfully!');
      } else {
        console.log('PRIMARY INBOX PROXY HIT - Not marking as opened (just logging event)');
      }
      
      // STEP 3: Log event to DynamoDB (for both proxy and real opens)
      try {
        // Get email details from queue to enrich tracking event
        let recipientEmail = null;
        let leadName = null;
        let subject = null;
        try {
          const sentEmails = agentId && agentId !== 'null' 
            ? await awsQueue.getSentEmails(userId, agentId)
            : await awsQueue.getAllSentEmailsForUser(userId);
          const emailData = sentEmails.find(e => e.trackingId === trackingId);
          if (emailData) {
            recipientEmail = emailData.to;
            leadName = emailData.leadName || 
                       emailData.personInfo?.fullName || 
                       emailData.personInfo?.name || 
                       (emailData.to ? emailData.to.split('@')[0] : null);
            subject = emailData.subject || emailData.emailSubject;
            console.log(`[EMAIL TRACKING] Enriched event: to=${recipientEmail}, leadName=${leadName}, subject=${subject}`);
          }
        } catch (err) {
          console.error('Error fetching email details:', err);
        }
        
        console.log('Logging tracking event to DynamoDB...');
        console.log(`[EMAIL-TRACKING] Logging event: {`);
        console.log(`  eventType: '${eventType}',`);
        console.log(`  recipientEmail: '${recipientEmail}',`);
        console.log(`  leadName: '${leadName}',`);
        console.log(`  subject: '${subject}'`);
        console.log(`}`);
        
        await awsManager.logEmailTracking(userId, agentId, trackingId, {
          eventType: eventType, // Use the calculated eventType (proxy or open)
          recipientEmail,
          leadName,
          subject,
          ipAddress: req.ip,
          userAgent: userAgent,
          timestamp: new Date().toISOString()
        });
        console.log('Tracking event logged to DynamoDB!');
        
        // Broadcast to SSE clients for real-time UI updates
        try {
          const { broadcastAIResponse } = await import('./outreach.js');
          broadcastAIResponse(userId, agentId, {
            type: 'tracking_update',
            trackingId: trackingId,
            eventType: eventType, // Use the calculated eventType (proxy or open)
            recipientEmail,
            leadName,
            subject,
            timestamp: new Date().toISOString()
          });
          console.log('SSE broadcast sent for real-time UI update!');
        } catch (sseError) {
          console.error('SSE broadcast failed:', sseError.message);
        }
      } catch (dbError) {
        console.error('DynamoDB logging failed:', dbError);
      }
      console.log('═══════════════════════════════════════════════════════════════');
      if (eventType === 'proxy') {
        console.log('TRACKING PIXEL PROCESSED - PRIMARY INBOX PROXY HIT (not counted as opened)');
      } else {
        console.log('TRACKING PIXEL PROCESSED - EMAIL MARKED AS OPENED');
      }
      console.log('═══════════════════════════════════════════════════════════════\n');
    } else {
      console.log('IMAGE PROXY/BOT DETECTED - Not counting as real open');
      console.log('═══════════════════════════════════════════════════════════════\n');
    }
    
    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
    
  } catch (error) {
    console.error('[EMAIL TRACKING] Open tracking error:', error);
    res.status(200).end(); // Always return success for tracking pixels
  }
});

// Track link clicks
router.get('/track/click/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query;
    
    console.log('[EMAIL TRACKING] Link clicked:', trackingId, url);
    
    // Update analytics
    await updateEmailAnalytics(trackingId, {
      clicked: true,
      clickCount: 1 // Will be incremented if already clicked
    });
    
    // Log to DynamoDB for Outreach dashboard
    try {
      // Parse tracking ID format: tracking-{userId}_{agentId}_{timestamp}_{random}
      const parts = trackingId.split('_');
      const userId = parts[0].replace('tracking-', ''); // Remove "tracking-" prefix
      const agentId = parts[1]; // Extract agentId
      
      // Get email details from queue to enrich tracking event
      let recipientEmail = null;
      let leadName = null;
      let subject = null;
      try {
        const sentEmails = await awsQueue.getSentEmails(userId, agentId);
        const emailData = sentEmails.find(e => e.trackingId === trackingId);
        if (emailData) {
          recipientEmail = emailData.to;
          leadName = emailData.leadName || 
                     emailData.personInfo?.fullName || 
                     emailData.personInfo?.name || 
                     (emailData.to ? emailData.to.split('@')[0] : null);
          subject = emailData.subject || emailData.emailSubject;
          console.log(`[EMAIL TRACKING] Enriched click event: to=${recipientEmail}, leadName=${leadName}, subject=${subject}`);
        }
      } catch (err) {
        console.error('[EMAIL TRACKING] Error fetching email details:', err);
      }
      
      await awsManager.logEmailTracking(userId, agentId, trackingId, {
        eventType: 'click',
        url: url,
        recipientEmail,
        leadName,
        subject,
        timestamp: new Date().toISOString()
      });
      
      // Broadcast to SSE clients for real-time UI updates
      try {
        const { broadcastAIResponse } = await import('./outreach.js');
        broadcastAIResponse(userId, agentId, {
          type: 'tracking_update',
          trackingId: trackingId,
          eventType: 'click',
          url: url,
          recipientEmail,
          leadName,
          subject,
          timestamp: new Date().toISOString()
        });
        console.log('[EMAIL TRACKING] ✅ SSE broadcast sent for click event');
      } catch (sseError) {
        console.error('[EMAIL TRACKING] SSE broadcast failed:', sseError.message);
      }
    } catch (dbError) {
      console.error('[EMAIL TRACKING] DynamoDB logging failed:', dbError);
    }
    
    // Redirect to original URL
    if (url) {
      res.redirect(url);
    } else {
      res.status(400).send('Invalid tracking URL');
    }
    
  } catch (error) {
    console.error('[EMAIL TRACKING] Click tracking error:', error);
    res.status(500).send('Tracking error');
  }
});

// Analytics API endpoints
router.get('/api/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Load user-specific email logs
    const logPath = path.join(process.cwd(), `email_logs_${userId}.json`);
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch (error) {
      logs = [];
    }
    
    // Calculate analytics summary
    const total = logs.length;
    const sent = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;
    const opened = logs.filter(log => log.analytics?.opened).length;
    const clicked = logs.filter(log => log.analytics?.clicked).length;
    const replied = logs.filter(log => log.analytics?.replied).length;
    
    // Timeline data for the last 7 days (for line chart)
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= dayStart && logDate <= dayEnd;
      });
      
      timeline.push({
        date: dayStart.toISOString().split('T')[0],
        sent: dayLogs.filter(log => log.status === 'sent').length,
        opened: dayLogs.filter(log => log.analytics?.opened).length,
        clicked: dayLogs.filter(log => log.analytics?.clicked).length,
        replied: dayLogs.filter(log => log.analytics?.replied).length
      });
    }
    
    // Response times (in hours) for response time chart
    const responseTimes = logs
      .filter(log => log.analytics?.replied && (log.analytics?.replyTime || log.analytics?.responseDate))
      .map(log => {
        const sentTime = new Date(log.timestamp);
        const replyTime = new Date(log.analytics.replyTime || log.analytics.responseDate);
        const hoursDiff = (replyTime - sentTime) / (1000 * 60 * 60); // Convert to hours
        console.log('[ANALYTICS] Response time calculation:', {
          sent: log.timestamp,
          reply: log.analytics.replyTime || log.analytics.responseDate,
          hours: hoursDiff
        });
        return Math.max(0, hoursDiff); // Ensure non-negative
      });
    
    // Engagement funnel data
    const funnelData = {
      sent: sent,
      delivered: sent - failed, // Assuming delivered = sent - failed
      opened: opened,
      clicked: clicked,
      replied: replied
    };
    
    res.json({
      success: true,
      data: {
        totalEmailsSent: sent,
        emailsOpened: opened,
        linksClicked: clicked,
        responsesReceived: replied,
        emailsFailed: failed,
        timeline: timeline,
        responseTimes: responseTimes,
        funnel: funnelData,
        summary: {
          total,
          sent,
          failed,
          opened,
          clicked,
          replied,
          openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
          clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
          replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
          successRate: total > 0 ? Math.round((sent / total) * 100) : 0
        },
        dailyStats: timeline,
        recentActivity: logs.slice(0, 10) // Last 10 emails for recent activity
      }
    });
    
  } catch (error) {
    console.error('[ANALYTICS API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get detailed email analytics
router.get('/api/analytics/emails', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId; // Optional agentId for agent-specific data
    
    // Load agent-specific or user-specific email logs (legacy file-based)
    const logFileName = agentId ? `email_logs_${userId}_${agentId}.json` : `email_logs_${userId}.json`;
    const logPath = path.join(process.cwd(), logFileName);
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch (error) {
      logs = [];
    }
    
    // Load approved emails and filter by agentId if provided (legacy file-based)
    const approvedPath = path.join(process.cwd(), `email_approved_${userId}.json`);
    let approvedEmails = [];
    
    try {
      const existingApproved = await fs.readFile(approvedPath, 'utf8');
      const allApprovedEmails = JSON.parse(existingApproved);
      
      // Filter by agentId if provided (for agent-specific requests)
      if (agentId) {
        approvedEmails = allApprovedEmails.filter(email => email.agentId === agentId);
        console.log(`[ANALYTICS] Filtered ${approvedEmails.length} approved emails for agent ${agentId} (from ${allApprovedEmails.length} total)`);
      } else {
        approvedEmails = allApprovedEmails;
      }
    } catch (error) {
      approvedEmails = [];
    }
    
    // Normalize approved emails to match expected structure
    const normalizedApproved = approvedEmails.map(email => ({
      ...email,
      sentAt: email.approvedAt || email.timestamp,
      subject: email.finalSubject || email.subject,
      body: email.finalBody || email.body || email.personalizedEmail,
      content: email.finalBody || email.body || email.personalizedEmail,
      personInfo: {
        fullName: email.leadInfo?.name || 'Unknown',
        company: email.leadInfo?.company || 'Unknown Company'
      },
      company: email.leadInfo?.company || 'Unknown Company'
    }));
    
    // Combine legacy logs with normalized approved emails
    logs = [...logs, ...normalizedApproved];
    
    // Load SENT emails from DynamoDB (modern system)
    try {
      const awsEmailQueue = new AWSEmailQueue();
      let sentEmails = [];
      
      // If agentId is provided, get emails for that specific agent
      // Otherwise, get ALL sent emails for the user across all agents
      if (agentId) {
        sentEmails = await awsEmailQueue.getSentEmails(userId, agentId);
        console.log(`[ANALYTICS] Loaded ${sentEmails.length} sent emails from DynamoDB for user ${userId}, agent ${agentId}`);
      } else {
        sentEmails = await awsEmailQueue.getAllSentEmailsForUser(userId);
        console.log(`[ANALYTICS] Loaded ${sentEmails.length} sent emails from DynamoDB for user ${userId} (all agents)`);
      }
      
      // Normalize DynamoDB emails to match expected structure
      const normalizedSent = sentEmails.map(email => ({
        ...email,
        id: email.id || email.emailId,
        trackingId: email.trackingId,
        sentAt: email.sentAt,
        subject: email.subject,
        body: email.body || email.text,
        content: email.html || email.body || email.text,
        to: email.to,
        personInfo: {
          fullName: email.lead?.name || email.leadName || 'Unknown',
          company: email.lead?.company || 'Unknown Company'
        },
        company: email.lead?.company || 'Unknown Company',
        status: (email.status || 'SENT').toLowerCase() // Convert SENT/BOUNCED/etc to lowercase
      }));
      
      // Combine with legacy logs
      logs = [...logs, ...normalizedSent];
    } catch (dynamoError) {
      console.error('[ANALYTICS] Failed to load sent emails from DynamoDB:', dynamoError.message);
      console.error('[ANALYTICS] Error stack:', dynamoError.stack);
      // Continue with legacy logs only
    }
    
    // Add analytics status to each email
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[ANALYTICS] Adding tracking data to', logs.length, 'emails');
    
    // Get all tracking events for this user
    let emailsWithAnalytics = [];
    try {
      let allTrackingEvents = [];
      if (agentId) {
        allTrackingEvents = await awsManager.getEmailTrackingByAgent(userId, agentId);
      } else {
        allTrackingEvents = await awsManager.getEmailTrackingByUser(userId);
      }
      console.log('[ANALYTICS] Found', allTrackingEvents.length, 'tracking events');
      
      // Group tracking events by trackingId for quick lookup
      const trackingByEmail = {};
      allTrackingEvents.forEach(event => {
        if (!trackingByEmail[event.trackingId]) {
          trackingByEmail[event.trackingId] = [];
        }
        trackingByEmail[event.trackingId].push(event);
      });
      
      console.log('[ANALYTICS] Grouped into', Object.keys(trackingByEmail).length, 'unique emails');
      
      emailsWithAnalytics = logs.map(log => {
        const events = trackingByEmail[log.trackingId] || [];
        const hasProxy = events.some(e => e.eventType === 'proxy');
        const hasOpen = events.some(e => e.eventType === 'open');
        const hasClick = events.some(e => e.eventType === 'click');
        
        return {
          ...log,
          analyticsStatus: {
            opened: hasOpen,
            clicked: hasClick,
            replied: log.analytics?.replied || false,
            hasProxy: hasProxy,
            openCount: events.filter(e => e.eventType === 'open').length,
            clickCount: events.filter(e => e.eventType === 'click').length,
            lastActivity: events.length > 0 ? events[events.length - 1].timestamp : null,
            daysSinceLastActivity: events.length > 0 && events[events.length - 1].timestamp ? 
              Math.floor((new Date() - new Date(events[events.length - 1].timestamp)) / (1000 * 60 * 60 * 24)) : null
          }
        };
      });
      
      const withTracking = emailsWithAnalytics.filter(e => e.analyticsStatus.opened || e.analyticsStatus.hasProxy);
      console.log('[ANALYTICS]', withTracking.length, 'emails have tracking data');
      console.log('═══════════════════════════════════════════════════════════════');
      
    } catch (trackingError) {
      console.error('[ANALYTICS] Error loading tracking:', trackingError);
      // Fallback to legacy
      emailsWithAnalytics = logs.map(log => ({
        ...log,
        analyticsStatus: {
          opened: log.analytics?.opened || false,
          clicked: log.analytics?.clicked || false,
          replied: log.analytics?.replied || false,
          hasProxy: log.analytics?.hasProxy || false,
          openCount: log.analytics?.openCount || 0,
          clickCount: log.analytics?.clickCount || 0,
          lastActivity: log.analytics?.lastActivity || null,
          daysSinceLastActivity: log.analytics?.lastActivity ? 
            Math.floor((new Date() - new Date(log.analytics.lastActivity)) / (1000 * 60 * 60 * 24)) : null
        }
      }));
    }
    
    // Cross-reference with unsubscribes
    try {
      const unsubscribes = await awsManager.getUnsubscribes(1000);
      const unsubscribedSet = new Set((unsubscribes || []).map(u => (u.email || '').toLowerCase()));
      if (unsubscribedSet.size > 0) {
        emailsWithAnalytics = emailsWithAnalytics.map(e => ({
          ...e,
          unsubscribed: unsubscribedSet.has((e.to || '').toLowerCase()) || e.unsubscribed || false
        }));
      }
    } catch { /* non-fatal */ }

    res.json({
      success: true,
      data: emailsWithAnalytics
    });
    
  } catch (error) {
    console.error('[ANALYTICS API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Track email responses (manual)
router.post('/api/analytics/track-response', authenticateToken, async (req, res) => {
  try {
    const { trackingId, responseContent, responseDate } = req.body;
    
    if (!trackingId) {
      return res.status(400).json({
        success: false,
        error: 'Tracking ID is required'
      });
    }
    
    console.log('[EMAIL TRACKING] Response received for:', trackingId, responseContent?.substring(0, 50));
    
    // Update analytics with response data
    const updated = await updateEmailAnalytics(trackingId, {
      replied: true,
      responseContent: responseContent || 'Response received',
      responseDate: responseDate || new Date().toISOString(),
      replyTime: responseDate || new Date().toISOString()
    });
    
    if (updated) {
      res.json({
        success: true,
        message: 'Response tracked successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }
    
  } catch (error) {
    console.error('[EMAIL TRACKING] Response tracking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear all email logs for a user
router.delete('/api/analytics/emails', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId; // Optional agentId for agent-specific data
    
    // Delete agent-specific or user-specific email logs file
    const logFileName = agentId ? `email_logs_${userId}_${agentId}.json` : `email_logs_${userId}.json`;
    const logPath = path.join(process.cwd(), logFileName);
    
    try {
      await fs.unlink(logPath);
      const targetDescription = agentId ? `agent ${agentId} for user ${userId}` : `user ${userId}`;
      console.log(`[ANALYTICS] 🗑️ Cleared email logs for ${targetDescription}`);
    } catch (error) {
      // File might not exist, which is fine
      const targetDescription = agentId ? `agent ${agentId} for user ${userId}` : `user ${userId}`;
      console.log(`[ANALYTICS] 📝 No email logs file found for ${targetDescription}, nothing to clear`);
    }

    // Delete approved emails file (this affects the total count)
    const approvedPath = path.join(process.cwd(), `email_approved_${userId}.json`);
    
    try {
      await fs.unlink(approvedPath);
      console.log(`[ANALYTICS] 🗑️ Cleared approved emails for user ${userId}`);
    } catch (error) {
      // File might not exist, which is fine
      console.log(`[ANALYTICS] 📝 No approved emails file found for user ${userId}, nothing to clear`);
    }

    // Delete email queue file too
    const queuePath = path.join(process.cwd(), `email_queue_${userId}.json`);
    
    try {
      await fs.unlink(queuePath);
      console.log(`[ANALYTICS] 🗑️ Cleared email queue for user ${userId}`);
    } catch (error) {
      // File might not exist, which is fine
      console.log(`[ANALYTICS] 📝 No email queue file found for user ${userId}, nothing to clear`);
    }
    
    const targetDescription = agentId ? `agent "${agentId}"` : 'user account';
    res.json({
      success: true,
      message: `All email data and tracking cleared successfully for ${targetDescription}`,
      clearedFor: agentId ? { agentId, userId } : { userId }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error clearing email logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Dashboard stats endpoint for StatsGrid component
router.get('/api/analytics/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId; // Optional agentId for agent-specific data
    
    // Load agent-specific or user-specific email logs
    const logFileName = agentId ? `email_logs_${userId}_${agentId}.json` : `email_logs_${userId}.json`;
    const logPath = path.join(process.cwd(), logFileName);
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch (error) {
      logs = [];
    }
    
    // Calculate current stats
    const totalSent = logs.filter(log => log.status === 'sent').length;
    const totalOpened = logs.filter(log => log.analytics?.opened).length;
    const totalReplied = logs.filter(log => log.analytics?.replied).length;
    const totalClicked = logs.filter(log => log.analytics?.clicked).length;
    
    // Calculate response rate
    const responseRate = totalSent > 0 ? ((totalReplied / totalSent) * 100) : 0;
    
    // Calculate stats for last 30 days for trend comparison
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const last30DaysLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= thirtyDaysAgo;
    });
    
    const last30DaysSent = last30DaysLogs.filter(log => log.status === 'sent').length;
    const last30DaysOpened = last30DaysLogs.filter(log => log.analytics?.opened).length;
    const last30DaysReplied = last30DaysLogs.filter(log => log.analytics?.replied).length;
    const last30DaysResponseRate = last30DaysSent > 0 ? ((last30DaysReplied / last30DaysSent) * 100) : 0;
    
    // Calculate trends (mock percentage changes for now)
    const emailsTrend = totalSent > 0 ? Math.min(50, Math.max(-50, Math.round(Math.random() * 20 - 5))) : 0;
    const opensTrend = totalOpened > 0 ? Math.min(50, Math.max(-50, Math.round(Math.random() * 15 - 2))) : 0;
    const responseTrend = responseRate > 0 ? Math.min(20, Math.max(-20, Math.round(Math.random() * 10 - 3))) : 0;
    
    // Format stats for frontend
    const stats = [
      {
        id: 'leads',
        title: 'Total Leads',
        value: totalSent.toString(),
        change: `${emailsTrend >= 0 ? '+' : ''}${emailsTrend.toFixed(1)}%`,
        trend: emailsTrend >= 0 ? 'up' : 'down',
        icon: 'UserGroupIcon',
      },
      {
        id: 'emails',
        title: 'Emails Sent',
        value: totalSent.toLocaleString(),
        change: `${emailsTrend >= 0 ? '+' : ''}${emailsTrend.toFixed(1)}%`,
        trend: emailsTrend >= 0 ? 'up' : 'down',
        icon: 'EnvelopeIcon',
      },
      {
        id: 'responses',
        title: 'Response Rate',
        value: `${responseRate.toFixed(1)}%`,
        change: `${responseTrend >= 0 ? '+' : ''}${responseTrend.toFixed(1)}%`,
        trend: responseTrend >= 0 ? 'up' : 'down',
        icon: 'ChartBarIcon',
      },
      {
        id: 'views',
        title: 'Email Opens',
        value: totalOpened.toLocaleString(),
        change: `${opensTrend >= 0 ? '+' : ''}${opensTrend.toFixed(1)}%`,
        trend: opensTrend >= 0 ? 'up' : 'down',
        icon: 'EyeIcon',
      },
    ];

    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('[ANALYTICS API] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Recent activity endpoint for StatsGrid component
router.get('/api/analytics/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.query.agentId; // Optional agentId for agent-specific data
    
    // Load agent-specific or user-specific email logs
    const logFileName = agentId ? `email_logs_${userId}_${agentId}.json` : `email_logs_${userId}.json`;
    const logPath = path.join(process.cwd(), logFileName);
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch (error) {
      logs = [];
    }
    
    // Generate recent activity from email logs
    const recentActivity = logs
      .slice(0, 8) // Get last 8 emails
      .map((log, index) => {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        const timeDiff = now - logDate;
        
        // Format time difference
        let timeAgo;
        if (timeDiff < 60000) {
          timeAgo = 'Just now';
        } else if (timeDiff < 3600000) {
          const minutes = Math.floor(timeDiff / 60000);
          timeAgo = `${minutes}m ago`;
        } else if (timeDiff < 86400000) {
          const hours = Math.floor(timeDiff / 3600000);
          timeAgo = `${hours}h ago`;
        } else {
          const days = Math.floor(timeDiff / 86400000);
          timeAgo = `${days}d ago`;
        }
        
        // Determine activity type based on email analytics
        let action, target;
        if (log.analytics?.replied) {
          action = 'Response received';
          target = log.personInfo?.fullName || log.to?.split('@')[0] || 'Contact';
        } else if (log.analytics?.opened) {
          action = 'Email opened';
          target = log.personInfo?.fullName || log.to?.split('@')[0] || 'Contact';
        } else if (log.status === 'sent') {
          action = 'Email sent';
          target = log.personInfo?.company || log.to?.split('@')[1] || 'Contact';
        } else {
          action = 'Email processed';
          target = log.to?.split('@')[1] || 'Contact';
        }
        
        return {
          id: index + 1,
          action,
          target,
          time: timeAgo
        };
      });
    
    // If no logs, provide default activity
    const defaultActivity = [
      { id: 1, action: 'Dashboard initialized', target: 'System ready', time: 'Just now' },
      { id: 2, action: 'Agent configured', target: 'Email tracking active', time: '1m ago' }
    ];
    
    res.json({
      success: true,
      data: recentActivity.length > 0 ? recentActivity : defaultActivity
    });
    
  } catch (error) {
    console.error('[ANALYTICS API] Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete agent and clean up all associated data
router.delete('/api/agents/:agentId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId } = req.params;
    
    console.log(`[AGENT CLEANUP] 🧹 Starting cleanup for agent ${agentId} (user: ${userId})`);
    
    // Delete agent-specific email logs
    const logFileName = `email_logs_${userId}_${agentId}.json`;
    const logPath = path.join(process.cwd(), logFileName);
    
    try {
      await fs.unlink(logPath);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted email logs: ${logFileName}`);
    } catch (error) {
      console.log(`[AGENT CLEANUP] 📝 No email logs found for agent ${agentId}, skipping`);
    }
    
    // Clean up agent-specific email queue file
    const emailQueuePath = path.join(process.cwd(), `email_queue_${userId}_${agentId}.json`);
    try {
      await fs.unlink(emailQueuePath);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted email queue: email_queue_${userId}_${agentId}.json`);
    } catch (error) {
      console.log(`[AGENT CLEANUP] 📝 No email queue found for agent ${agentId}, skipping`);
    }
    
    // Clean up agent-specific approved emails file
    const approvedEmailsPath = path.join(process.cwd(), `email_approved_${userId}_${agentId}.json`);
    try {
      await fs.unlink(approvedEmailsPath);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted approved emails: email_approved_${userId}_${agentId}.json`);
    } catch (error) {
      console.log(`[AGENT CLEANUP] 📝 No approved emails found for agent ${agentId}, skipping`);
    }
    
    // Clean up agent-specific AWS settings
    try {
      const AWSManager = (await import('../utils/awsManager.js')).default;
      const awsManager = new AWSManager();
      await awsManager.deleteAgentSettings(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted agent settings from AWS for ${agentId}`);
      
      // Delete agent state
      await awsManager.deleteAgentState(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted agent state from AWS for ${agentId}`);
      
      // Delete search history for this agent
      await awsManager.deleteSearchHistory(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted search history from AWS for ${agentId}`);
      
      // Delete cycle logs for this agent
      await awsManager.deleteCycleLogs(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted cycle logs from AWS for ${agentId}`);
    } catch (error) {
      console.log(`[AGENT CLEANUP] ⚠️ Error deleting agent data from AWS: ${error.message}`);
    }
    
    // Clean up agent's sent/replied emails from AWS DynamoDB
    try {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      
      // Clear sent emails
      const sentResult = await awsQueue.clearSentEmails(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted ${sentResult.clearedCount} sent emails from AWS for agent ${agentId}`);
      
      // Clear replied emails
      const repliedResult = await awsQueue.clearRepliedEmails(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted ${repliedResult.clearedCount} replied emails from AWS for agent ${agentId}`);
      
      // Clear queued emails
      const queuedResult = await awsQueue.clearQueuedEmails(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted ${queuedResult.clearedCount} queued emails from AWS for agent ${agentId}`);
    } catch (error) {
      console.log(`[AGENT CLEANUP] ⚠️ Error deleting agent emails from AWS: ${error.message}`);
    }
    
    // Remove agent instance from memory
    try {
      const { ReasoningLeadAgent } = require('../agent/reasoningLeadAgent');
      const agentKey = `${userId}_${agentId}`;
      if (ReasoningLeadAgent.activeAgents.has(agentKey)) {
        const agent = ReasoningLeadAgent.activeAgents.get(agentKey);
        if (agent && typeof agent.stop === 'function') {
          await agent.stop();
        }
        ReasoningLeadAgent.activeAgents.delete(agentKey);
        console.log(`[AGENT CLEANUP] 🗑️ Removed agent instance from memory: ${agentKey}`);
      }
    } catch (error) {
      console.log(`[AGENT CLEANUP] ⚠️ Error removing agent from memory: ${error.message}`);
    }
    
    // Remove agent from AWS DynamoDB
    try {
      const { removeAgentFromUser } = await import('../lib/userManager.js');
      await removeAgentFromUser(userId, agentId);
      console.log(`[AGENT CLEANUP] 🗑️ Removed agent ${agentId} from AWS for user ${userId}`);
      
      // Log agent deletion to issues/alerts as an important event
      const AWSManager = (await import('../utils/awsManager.js')).default;
      const awsManager = new AWSManager();
      
      const activityData = {
        type: 'warning',
        category: 'issue',
        title: 'Agent Deleted',
        message: `Agent "${agentId}" was permanently deleted`,
        timestamp: new Date().toISOString(),
        metadata: {
          agentId,
          deletedAt: new Date().toISOString()
        }
      };
      
      await awsManager.addIssue(
        userId,
        activityData.type,
        activityData.title,
        activityData.message,
        activityData.metadata
      );
      
      // Broadcast to SSE clients for real-time updates
      try {
        const { broadcastActivity } = await import('./monitoring.js');
        broadcastActivity(activityData);
      } catch (sseError) {
        console.error('[ANALYTICS] Failed to broadcast activity:', sseError);
      }
    } catch (error) {
      console.error(`[AGENT CLEANUP] ❌ Failed to remove agent from AWS:`, error.message);
      throw error;
    }
    
    console.log(`[AGENT CLEANUP] ✅ Completed cleanup for agent ${agentId}`);
    
    res.json({
      success: true,
      message: `Agent ${agentId} deleted successfully`,
      cleanedFiles: [logFileName, `email_queue_${userId}_${agentId}.json`]
    });
    
  } catch (error) {
    console.error(`[AGENT CLEANUP] ❌ Error cleaning up agent ${req.params.agentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up agent data',
      details: error.message
    });
  }
});

// Get scheduled events from polling data
router.get('/api/analytics/scheduled-events', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || 'reasoning-lead-agent'; // Get agentId from query param
    console.log('[SCHEDULED EVENTS] Fetching scheduled events for user:', req.user.userId, 'agentId:', agentId);
    
    // Import the desktop email tracker to get scheduled events from polling
    const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
    
    // Get scheduled events from the polling data (filtered by agentId if supported)
    const rawEvents = desktopEmailTracker.getUserScheduledEvents(req.user.userId);
    
    // Filter by agentId if the events have agent information
    const filteredEvents = rawEvents.filter(event => {
      // If event has agentId, match it; if no agentId in event, include for main agent
      return !event.agentId || event.agentId === agentId || (agentId === 'reasoning-lead-agent' && !event.agentId);
    });
    
    // Transform Zilliz event data to frontend format
    const scheduledEvents = filteredEvents.map(event => ({
      id: event.id,
      title: event.event_title || 'Meeting',
      contactName: event.attendee_name || 'Contact',
      company: event.company || 'Unknown Company',
      scheduledTime: event.scheduled_time || event.timestamp,
      status: event.status || 'scheduled',
      calendarLink: event.calendar_link || '',
      description: event.description || '',
      meetingUrl: event.meeting_url || '',
      attendeeEmail: event.attendee_email || ''
    }));
    
    console.log(`[SCHEDULED EVENTS] Found ${scheduledEvents.length} scheduled events`);
    res.json(scheduledEvents);
    
  } catch (error) {
    console.error('[SCHEDULED EVENTS] Error fetching scheduled events:', error);
    res.status(500).json({
      error: 'Failed to fetch scheduled events',
      details: error.message
    });
  }
});

export default router;
