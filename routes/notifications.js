import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

/**
 * Get notification count (unread issues)
 * GET /api/notifications/count
 */
router.get('/count', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(req.user.userId);
    
    // Count unread issues
    const unreadCount = issues.filter(issue => !issue.read).length;
    
    // Group by severity
    const bySeverity = {
      critical: issues.filter(i => !i.read && i.severity === 'critical').length,
      high: issues.filter(i => !i.read && i.severity === 'high').length,
      medium: issues.filter(i => !i.read && i.severity === 'medium').length,
      low: issues.filter(i => !i.read && i.severity === 'low').length
    };
    
    // Group by type
    const byType = {
      billing: issues.filter(i => !i.read && i.type === 'billing').length,
      agent: issues.filter(i => !i.read && i.type === 'agent').length,
      email: issues.filter(i => !i.read && i.type === 'email').length,
      system: issues.filter(i => !i.read && i.type === 'system').length
    };
    
    res.json({
      success: true,
      unreadCount,
      totalIssues: issues.length,
      bySeverity,
      byType,
      hasUnread: unreadCount > 0
    });
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error getting count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification count',
      details: error.message
    });
  }
});

/**
 * Get all notifications (unified endpoint)
 * GET /api/notifications
 * Includes: email replies, views, failed sends, meetings, billing
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const notifications = [];
    
    // Get existing issues from DynamoDB
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(userId);
    
    // Add issues as notifications
    issues.forEach(issue => {
      notifications.push({
        id: issue.issueId,
        type: issue.type,
        severity: issue.severity,
        title: issue.title,
        message: issue.message,
        timestamp: issue.timestamp,
        read: issue.read || false,
        data: issue.data || {}
      });
    });
    
    // Check for email tracking notifications (replies, opens, etc)
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Try to read email logs
      const emailLogPath = path.join(process.cwd(), `email_logs_${userId}.json`);
      try {
        const emailLogsData = await fs.readFile(emailLogPath, 'utf8');
        const emailLogs = JSON.parse(emailLogsData);
        
        emailLogs.forEach(log => {
          const logDate = new Date(log.timestamp);
          const now = new Date();
          const hoursSinceLog = (now - logDate) / (1000 * 60 * 60);
          
          // Email replies (high priority)
          if (log.analytics?.replied && log.analytics.repliedAt && hoursSinceLog <= 168) { // 7 days
            notifications.push({
              id: `reply_${log.emailId || log.messageId || log.timestamp}`,
              type: 'reply',
              severity: 'high',
              title: 'Email Reply Received',
              message: `${log.personInfo?.fullName || log.to} responded to your email`,
              timestamp: log.analytics.repliedAt,
              read: false,
              data: {
                emailId: log.emailId,
                recipient: log.to,
                recipientName: log.personInfo?.fullName,
                company: log.personInfo?.company,
                subject: log.subject
              }
            });
          }
          
          // Email opens (medium priority, last 24 hours only)
          if (log.analytics?.opened && log.analytics.openedAt && !log.analytics?.replied && hoursSinceLog <= 24) {
            notifications.push({
              id: `view_${log.emailId || log.messageId || log.timestamp}`,
              type: 'view',
              severity: 'medium',
              title: 'Email Opened',
              message: `${log.personInfo?.fullName || log.to} opened your email${log.analytics.opens > 1 ? ` (${log.analytics.opens} times)` : ''}`,
              timestamp: log.analytics.openedAt,
              read: false,
              data: {
                emailId: log.emailId,
                recipient: log.to,
                recipientName: log.personInfo?.fullName,
                company: log.personInfo?.company,
                subject: log.subject,
                opens: log.analytics.opens || 1
              }
            });
          }
          
          // Failed sends (critical)
          if ((log.status === 'failed' || log.status === 'bounced') && hoursSinceLog <= 168) { // 7 days
            notifications.push({
              id: `failed_${log.emailId || log.messageId || log.timestamp}`,
              type: 'failed_send',
              severity: 'critical',
              title: 'Email Send Failed',
              message: `Failed to send email to ${log.personInfo?.fullName || log.to}${log.error ? `: ${log.error}` : ''}`,
              timestamp: log.timestamp,
              read: false,
              data: {
                emailId: log.emailId,
                recipient: log.to,
                recipientName: log.personInfo?.fullName,
                error: log.error,
                subject: log.subject
              }
            });
          }
        });
      } catch (error) {
        // No email logs file yet
      }
      
      // Check for calendar events/meetings
      try {
        const calendarPath = path.join(process.cwd(), `calendar_events_${userId}.json`);
        const calendarData = await fs.readFile(calendarPath, 'utf8');
        const calendarEvents = JSON.parse(calendarData);
        
        calendarEvents.forEach(event => {
          if (event.createdAt) {
            const createdDate = new Date(event.createdAt);
            const now = new Date();
            const hoursSinceCreation = (now - createdDate) / (1000 * 60 * 60);
            
            // Show meetings scheduled in last 72 hours
            if (hoursSinceCreation <= 72) {
              notifications.push({
                id: `meeting_${event.eventId || event.id}`,
                type: 'meeting',
                severity: 'high',
                title: 'Meeting Scheduled',
                message: `Meeting with ${event.attendeeName || event.attendeeEmail || 'contact'} on ${new Date(event.startTime).toLocaleDateString()}`,
                timestamp: event.createdAt,
                read: false,
                data: {
                  eventId: event.eventId,
                  attendeeName: event.attendeeName,
                  attendeeEmail: event.attendeeEmail,
                  startTime: event.startTime,
                  endTime: event.endTime,
                  title: event.title || event.summary
                }
              });
            }
          }
        });
      } catch (error) {
        // No calendar events file yet
      }
    } catch (error) {
      // FS module error - non-critical
    }
    
    // Sort by timestamp and limit
    const sortedNotifications = notifications
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    res.json({
      success: true,
      notifications: sortedNotifications,
      count: sortedNotifications.length,
      unreadCount: sortedNotifications.filter(n => !n.read).length
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications',
      details: error.message
    });
  }
});

/**
 * Get recent notifications
 * GET /api/notifications/recent
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(req.user.userId);
    
    // Sort by timestamp (newest first) and limit
    const recentIssues = issues
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    res.json({
      success: true,
      notifications: recentIssues,
      count: recentIssues.length
    });
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error getting recent notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent notifications',
      details: error.message
    });
  }
});

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
router.post('/mark-all-read', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(req.user.userId);
    
    let markedCount = 0;
    for (const issue of issues) {
      if (!issue.read) {
        await awsManager.markIssueAsRead(req.user.userId, issue.issueId);
        markedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Marked ${markedCount} notifications as read`,
      markedCount
    });
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error marking all as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
      details: error.message
    });
  }
});

export default router;
