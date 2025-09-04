import express from 'express';
import { updateEmailAnalytics } from '../tools/emailMailgun.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Debug endpoint to test tracking pixel HTML generation
router.get('/debug/email-html/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { addTrackingToEmail } = await import('../tools/emailMailgun.js');
    
    const testBody = "Hello! This is a test email.\n\nBest regards,\nExaMark Team";
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
  try {
    const { trackingId } = req.params;
    
    console.log('[EMAIL TRACKING] ===== EMAIL OPENED =====');
    console.log('[EMAIL TRACKING] Tracking ID:', trackingId);
    console.log('[EMAIL TRACKING] User Agent:', req.get('User-Agent'));
    console.log('[EMAIL TRACKING] Referer:', req.get('Referer'));
    console.log('[EMAIL TRACKING] IP:', req.ip);
    console.log('[EMAIL TRACKING] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[EMAIL TRACKING] ========================');
    
    // Update analytics
    await updateEmailAnalytics(trackingId, {
      opened: true,
      openCount: 1, // Will be incremented if already opened
      lastActivity: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });
    
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
router.get('/api/analytics/summary', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
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
router.get('/api/analytics/emails', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch (error) {
      logs = [];
    }
    
    // Add analytics status to each email
    const emailsWithAnalytics = logs.map(log => ({
      ...log,
      analyticsStatus: {
        hasOpened: log.analytics?.opened || false,
        hasClicked: log.analytics?.clicked || false,
        hasReplied: log.analytics?.replied || false,
        openCount: log.analytics?.openCount || 0,
        clickCount: log.analytics?.clickCount || 0,
        lastActivity: log.analytics?.lastActivity || null,
        daysSinceLastActivity: log.analytics?.lastActivity ? 
          Math.floor((new Date() - new Date(log.analytics.lastActivity)) / (1000 * 60 * 60 * 24)) : null
      }
    }));
    
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
router.post('/api/analytics/track-response', async (req, res) => {
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

export default router;
