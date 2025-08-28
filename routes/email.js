import express from 'express';
import { sendEmailTool } from '../lib/myEmailTool.js';
import fs from 'fs/promises';
import path from 'path';

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

// New endpoint to clear email logs
router.post('/clear-logs', async (req, res) => {
  console.log('[EMAIL LOGS] POST /clear-logs request received');
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
    console.log('[EMAIL LOGS] Clearing logs at:', logPath);
    
    // Write empty array to the logs file
    await fs.writeFile(logPath, '[]', 'utf8');
    console.log('[EMAIL LOGS] ✅ Successfully cleared email logs');
    
    res.json({ 
      success: true, 
      message: 'Email logs cleared successfully',
      clearedCount: 0 // Since we just cleared it
    });
  } catch (err) {
    console.error('[EMAIL LOGS] ❌ Failed to clear logs:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear email logs',
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
