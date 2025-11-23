import express from 'express';
import { sendEmailTool } from '../lib/myEmailTool.js';
import fs from 'fs/promises';
import path from 'path';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

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

// New endpoint to get email logs - USER-SCOPED and AUTHENTICATED
router.get('/logs', authenticateToken, async (req, res) => {
  console.log('[EMAIL LOGS] GET /logs request received');
  try {
    const userId = req.user.userId;
    console.log(`[EMAIL LOGS] Getting logs for user: ${userId}`);
    
    // Use user-specific log file
    const logPath = path.join(process.cwd(), `email_logs_${userId}.json`);
    console.log('[EMAIL LOGS] Reading from:', logPath);
    
    try {
      const logsData = await fs.readFile(logPath, 'utf8');
      const logs = JSON.parse(logsData);
      console.log(`[EMAIL LOGS] Found ${logs.length} logs for user ${userId}`);
      res.json(logs || []);
    } catch (error) {
      console.log(`[EMAIL LOGS] No user-specific file found for user ${userId}, returning empty array`);
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
    // Use user-specific files instead of filtering global files
    const userLogPath = path.join(process.cwd(), `email_logs_${userId}.json`);
    const userApprovedPath = path.join(process.cwd(), `email_approved_${userId}.json`);
    const userQueuePath = path.join(process.cwd(), `email_queue_${userId}.json`);
    
    console.log(`[EMAIL LOGS] Clearing user-specific files for user: ${userCode}`);
    console.log(`[EMAIL LOGS] User log path: ${userLogPath}`);
    console.log(`[EMAIL LOGS] User approved path: ${userApprovedPath}`);
    console.log(`[EMAIL LOGS] User queue path: ${userQueuePath}`);
    
    // Clear user-specific files by writing empty arrays
    const emptyArray = [];
    
    try {
      await fs.writeFile(userLogPath, JSON.stringify(emptyArray, null, 2), 'utf8');
      console.log(`[EMAIL LOGS] ✅ Cleared email logs for user: ${userCode}`);
    } catch (error) {
      console.log(`[EMAIL LOGS] ℹ️ No email logs file to clear for user: ${userCode}`);
    }
    
    try {
      await fs.writeFile(userApprovedPath, JSON.stringify(emptyArray, null, 2), 'utf8');
      console.log(`[EMAIL LOGS] ✅ Cleared approved emails for user: ${userCode}`);
    } catch (error) {
      console.log(`[EMAIL LOGS] ℹ️ No approved emails file to clear for user: ${userCode}`);
    }
    
    try {
      await fs.writeFile(userQueuePath, JSON.stringify(emptyArray, null, 2), 'utf8');
      console.log(`[EMAIL LOGS] ✅ Cleared email queue for user: ${userCode}`);
    } catch (error) {
      console.log(`[EMAIL LOGS] ℹ️ No email queue file to clear for user: ${userCode}`);
    }
    
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
