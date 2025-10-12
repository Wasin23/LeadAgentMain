import express from 'express';
import { updateEmailAnalytics } from '../tools/emailMailgun.js';
import { authenticateToken } from '../middleware/jwt.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

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
  try {
    const { trackingId } = req.params;
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    
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
    
    console.log('[EMAIL TRACKING] ===== EMAIL OPENED =====');
    console.log('[EMAIL TRACKING] Tracking ID:', trackingId);
    console.log('[EMAIL TRACKING] User Agent:', userAgent);
    console.log('[EMAIL TRACKING] Is Image Proxy:', isImageProxy);
    console.log('[EMAIL TRACKING] IP:', req.ip);
    console.log('[EMAIL TRACKING] ========================');
    
    // Only count as real open if not from image proxy
    if (!isImageProxy) {
      console.log('[EMAIL TRACKING] ✅ Real user open detected');
      // Update analytics
      await updateEmailAnalytics(trackingId, {
        opened: true,
        openCount: 1, // Will be incremented if already opened
        lastActivity: new Date().toISOString(),
        ipAddress: req.ip
      });
    } else {
      console.log('[EMAIL TRACKING] 🤖 Image proxy request ignored (not counted as open)');
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
    
    // Load approved emails and filter by agentId if provided
    const approvedPath = path.join(process.cwd(), `email_approved_${userId}.json`);
    let approvedEmails = [];
    
    try {
      const existingApproved = await fs.readFile(approvedPath, 'utf8');
      const allApprovedEmails = JSON.parse(existingApproved);
      
      // Filter by agentId if provided (for agent-specific requests)
      if (agentId) {
        approvedEmails = allApprovedEmails.filter(email => email.agentId === agentId);
        console.log(`📧 [ANALYTICS] Filtered ${approvedEmails.length} approved emails for agent ${agentId} (from ${allApprovedEmails.length} total)`);
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
    
    // Combine logs and normalized approved emails
    logs = [...logs, ...normalizedApproved];
    
    // Add analytics status to each email
    const emailsWithAnalytics = logs.map(log => ({
      ...log,
      analyticsStatus: {
        opened: log.analytics?.opened || false,
        clicked: log.analytics?.clicked || false,
        replied: log.analytics?.replied || false,
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
    
    // Clear Zilliz tracking data - try to import and use zilliz functions
    try {
      const { ZillizEmailTracker } = await import('../utils/zillizEmailTracker.js');
      const tracker = new ZillizEmailTracker();
      await tracker.initialize();
      await tracker.clearUserTrackingEvents(userId);
      console.log(`[ANALYTICS] 🗑️ Cleared Zilliz tracking data for user ${userId}`);
    } catch (error) {
      console.log(`[ANALYTICS] ⚠️ Could not clear Zilliz tracking data:`, error.message);
      // Don't fail the whole request if Zilliz clearing fails
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
    
    // Clean up any other agent-specific files (email queue, etc.)
    const emailQueuePath = path.join(process.cwd(), `email_queue_${userId}_${agentId}.json`);
    try {
      await fs.unlink(emailQueuePath);
      console.log(`[AGENT CLEANUP] 🗑️ Deleted email queue: email_queue_${userId}_${agentId}.json`);
    } catch (error) {
      console.log(`[AGENT CLEANUP] 📝 No email queue found for agent ${agentId}, skipping`);
    }
    
    // TODO: Add cleanup for other agent-specific data (training data, settings, etc.)
    
    console.log(`[AGENT CLEANUP] ✅ Completed cleanup for agent ${agentId}`);
    
    res.json({
      success: true,
      message: `Agent ${agentId} data cleaned up successfully`,
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
    console.log('📅 [SCHEDULED EVENTS] Fetching scheduled events for user:', req.user.userId);
    
    // Import the desktop email tracker to get scheduled events from polling
    const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
    
    // Get scheduled events from the polling data
    const rawEvents = desktopEmailTracker.getUserScheduledEvents(req.user.userId);
    
    // Transform Zilliz event data to frontend format
    const scheduledEvents = rawEvents.map(event => ({
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
    
    console.log(`📅 [SCHEDULED EVENTS] Found ${scheduledEvents.length} scheduled events`);
    res.json(scheduledEvents);
    
  } catch (error) {
    console.error('❌ [SCHEDULED EVENTS] Error fetching scheduled events:', error);
    res.status(500).json({
      error: 'Failed to fetch scheduled events',
      details: error.message
    });
  }
});

export default router;
