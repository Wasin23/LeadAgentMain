import express from 'express';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

/**
 * Get all issues/alerts for the authenticated user
 * GET /api/issues
 */
router.get('/', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(req.user.userId);
    
    res.json({
      success: true,
      issues
    });
  } catch (error) {
    console.error('[ISSUES API] Error fetching issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issues',
      details: error.message
    });
  }
});

/**
 * Mark issue as read
 * PUT /api/issues/:issueId/read
 */
router.put('/:issueId/read', async (req, res) => {
  try {
    const { issueId } = req.params;
    const awsManager = new AWSManager();
    
    const result = await awsManager.markIssueAsRead(req.user.userId, issueId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Issue marked as read'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('[ISSUES API] Error marking issue as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark issue as read',
      details: error.message
    });
  }
});

/**
 * Delete a specific issue
 * DELETE /api/issues/:issueId
 */
router.delete('/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const awsManager = new AWSManager();
    
    const result = await awsManager.deleteIssue(req.user.userId, issueId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Issue deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('[ISSUES API] Error deleting issue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete issue',
      details: error.message
    });
  }
});

/**
 * Clear all issues for the authenticated user
 * DELETE /api/issues
 */
router.delete('/', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const issues = await awsManager.getIssues(req.user.userId);
    
    let deletedCount = 0;
    for (const issue of issues) {
      const result = await awsManager.deleteIssue(req.user.userId, issue.issueId);
      if (result.success) {
        deletedCount++;
      }
    }
    
    res.json({
      success: true,
      message: 'All issues cleared',
      deletedCount
    });
  } catch (error) {
    console.error('[ISSUES API] Error clearing issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear issues',
      details: error.message
    });
  }
});

export default router;
