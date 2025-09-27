import express from 'express';
import { sendEmailTool } from '../lib/myEmailTool.js';
import fs from 'fs/promises';
import path from 'path';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

console.log('DEBUG: sendEmailTool import:', sendEmailTool);

router.post('/email', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing to, subject, or body' });
  }

  try {
    const result = await sendEmailTool(to, subject, body);
    res.json({ result });
  } catch (err) {
    console.error('[EMAIL] Failed:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message || err });
  }
});

// New endpoint to get email logs
router.get('/logs', async (req, res) => {
  console.log('[EMAIL LOGS] GET /logs request received');
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
    console.log('[EMAIL LOGS] Reading from:', logPath);
    
    try {
      const logsData = await fs.readFile(logPath, 'utf8');
      const logs = JSON.parse(logsData);
      console.log('[EMAIL LOGS] Found', logs.length, 'logs');
      res.json(logs || []);
    } catch (error) {
      console.log('[EMAIL LOGS] File not found or empty, returning empty array');
      // File doesn't exist or is empty
      res.json([]);
    }
  } catch (err) {
    console.error('[EMAIL LOGS] Failed to read logs:', err);
    res.status(500).json({ error: 'Failed to read email logs' });
  }
});

// New endpoint to clear email logs for current user
router.post('/clear-logs', authenticateToken, async (req, res) => {
  console.log('[EMAIL LOGS] POST /clear-logs - Authentication passed, processing request...');
  
  const userId = req.user?.userId;
  if (!userId) {
    console.log('[EMAIL LOGS] ERROR: User ID not found in token');
    return res.status(400).json({ success: false, error: 'User ID not found in token' });
  }

  const userCode = userId.substring(0, 8);
  console.log(`[EMAIL LOGS] POST /clear-logs request received for user: ${userCode}`);
  
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
    const approvedPath = path.join(process.cwd(), 'email_approved.json');
    console.log('[EMAIL LOGS] Filtering logs for user:', userCode);
    
    // Filter logs to keep only other users' data
    let emailLogs = [];
    let approvedEmails = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      emailLogs = JSON.parse(existingLogs);
      // Keep only logs that don't belong to this user (tracking IDs that don't start with user code)
      emailLogs = emailLogs.filter(log => {
        const trackingId = log.trackingId || log.id;
        return !trackingId || !trackingId.startsWith(`tracking-${userCode}_`);
      });
    } catch (error) {
      console.log('[EMAIL LOGS] No existing email logs found');
    }

    try {
      const existingApproved = await fs.readFile(approvedPath, 'utf8');
      approvedEmails = JSON.parse(existingApproved);
      // Keep only approved emails that don't belong to this user
      // Check both trackingId pattern AND userId field for comprehensive filtering
      approvedEmails = approvedEmails.filter(email => {
        // Check if it's this user by userId field
        if (email.userId === userId) {
          return false; // Remove this user's approved emails
        }
        // Also check trackingId pattern for other types of entries
        const trackingId = email.trackingId || email.id;
        if (trackingId && trackingId.startsWith(`tracking-${userCode}_`)) {
          return false; // Remove emails with this user's tracking pattern
        }
        return true; // Keep emails that don't belong to this user
      });
    } catch (error) {
      console.log('[EMAIL LOGS] No existing approved emails found');
    }
    
    // Write filtered arrays back to files
    await fs.writeFile(logPath, JSON.stringify(emailLogs, null, 2), 'utf8');
    await fs.writeFile(approvedPath, JSON.stringify(approvedEmails, null, 2), 'utf8');
    
    // Also clear Zilliz tracking data for this user
    try {
      console.log(`[EMAIL LOGS] Clearing Zilliz tracking data for user: ${userCode}...`);
      
      // Get JWT token from request headers
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
      
      const response = await fetch(`${apiBaseUrl}/api/zilliz-tracking/clear`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        console.log(`[EMAIL LOGS] ✅ Zilliz tracking data cleared successfully for user: ${userCode}`);
      } else {
        console.log(`[EMAIL LOGS] ⚠️ Failed to clear Zilliz tracking data for user: ${userCode}`, response.status);
      }
    } catch (zillizError) {
      console.log(`[EMAIL LOGS] ⚠️ Error clearing Zilliz tracking data for user: ${userCode}:`, zillizError.message);
    }

    // Clear local desktop tracking data for this user
    try {
      const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
      desktopEmailTracker.clearUserTrackingData(userId);
      console.log(`[EMAIL LOGS] ✅ Desktop tracking data cleared successfully for user: ${userCode}`);
    } catch (desktopError) {
      console.log(`[EMAIL LOGS] ⚠️ Error clearing desktop tracking data for user: ${userCode}:`, desktopError.message);
    }
    
    console.log(`[EMAIL LOGS] ✅ Successfully cleared email logs and approved emails for user: ${userCode}`);
    
    res.json({ 
      success: true, 
      message: `Email logs, approved emails, and tracking data cleared successfully for user ${userCode}`,
      userCode: userCode
    });
  } catch (err) {
    console.error('[EMAIL LOGS] ❌ Failed to clear logs:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear email logs and approved emails',
      details: err.message
    });
  }
});

// New endpoint to clear search cache
router.post('/clear-search-cache', async (req, res) => {
  console.log('[CACHE] POST /clear-search-cache request received');
  try {
    const cacheDir = path.join(process.cwd(), '.search_cache');
    console.log('[CACHE] Clearing cache directory:', cacheDir);
    
    // Check if directory exists
    if (await fs.access(cacheDir).then(() => true).catch(() => false)) {
      // Read directory contents
      const files = await fs.readdir(cacheDir);
      console.log(`[CACHE] Found ${files.length} cache files to delete`);
      
      // Delete all files in the cache directory
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        await fs.unlink(filePath);
      }
      
      console.log('[CACHE] ✅ Successfully cleared search cache');
      res.json({ 
        success: true, 
        message: 'Search cache cleared successfully',
        clearedCount: files.length
      });
    } else {
      console.log('[CACHE] Cache directory does not exist, nothing to clear');
      res.json({ 
        success: true, 
        message: 'Cache directory does not exist',
        clearedCount: 0
      });
    }
  } catch (err) {
    console.error('[CACHE] ❌ Failed to clear search cache:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear search cache',
      details: err.message
    });
  }
});

export default router;
