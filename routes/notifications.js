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
