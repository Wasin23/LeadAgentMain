import express from 'express';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

// Manual sync endpoint to force update analytics with Zilliz data
router.post('/manual-sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`🔄 [MANUAL SYNC] Starting manual sync for user ${userId}...`);
    
    // Get tracking events from Zilliz - filtered by user
    const apiBaseUrl = process.env.API_BASE_URL || 'https://meridian-kdew.onrender.com';
    const response = await fetch(`${apiBaseUrl}/api/zilliz-tracking/events?userId=${userId}`);
    const zillizData = await response.json();
    
    if (!zillizData.success || !zillizData.events) {
      throw new Error('Failed to fetch Zilliz events');
    }
    
    console.log(`📊 [MANUAL SYNC] Found ${zillizData.events.length} tracking events for user ${userId}`);
    
    // Group events by tracking ID
    const eventsByTrackingId = {};
    for (const event of zillizData.events) {
      const trackingId = event.tracking_id;
      if (!eventsByTrackingId[trackingId]) {
        eventsByTrackingId[trackingId] = { opens: 0, clicks: 0 };
      }
      
      if (event.event_type === 'email_open') {
        eventsByTrackingId[trackingId].opens++;
      } else if (event.event_type === 'email_click' || event.event_type === 'link_click') {
        eventsByTrackingId[trackingId].clicks++;
      }
    }
    
    // Load user-specific email logs
    const logPath = `email_logs_${userId}.json`;
    let emailLogs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      emailLogs = JSON.parse(existingLogs);
    } catch (error) {
      emailLogs = [];
    }
    
    // Update analytics for each email
    let updated = false;
    let updateCount = 0;
    
    for (let i = 0; i < emailLogs.length; i++) {
      const log = emailLogs[i];
      const trackingId = log.trackingId || log.id;
      
      if (eventsByTrackingId[trackingId]) {
        const zillizStats = eventsByTrackingId[trackingId];
        
        // Update analytics object
        emailLogs[i].analytics = {
          ...log.analytics,
          opened: zillizStats.opens > 0,
          clicked: zillizStats.clicks > 0,
          openCount: zillizStats.opens,
          clickCount: zillizStats.clicks,
          lastActivity: zillizStats.opens > 0 || zillizStats.clicks > 0 ? new Date().toISOString() : log.analytics?.lastActivity
        };
        
        updated = true;
        updateCount++;
        console.log(`✅ [MANUAL SYNC] Updated ${trackingId}: opened=${zillizStats.opens > 0}, openCount=${zillizStats.opens}, clickCount=${zillizStats.clicks}`);
      }
    }
    
    if (updated) {
      // Save updated user-specific logs
      await fs.writeFile(logPath, JSON.stringify(emailLogs, null, 2));
      console.log(`✅ [MANUAL SYNC] Updated ${updateCount} email analytics for user ${userId}!`);
    }
    
    res.json({
      success: true,
      message: `Sync completed successfully`,
      zillizEventsFound: zillizData.events.length,
      emailsUpdated: updateCount,
      updated: updated
    });
    
  } catch (error) {
    console.error('❌ [MANUAL SYNC] Error during manual sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check sync status endpoint
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user-specific Zilliz events
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
    const zillizResponse = await fetch(`${apiBaseUrl}/api/zilliz-tracking/events?userId=${userId}`);
    const zillizData = await zillizResponse.json();
    
    // Get user-specific email logs
    const logPath = `email_logs_${userId}.json`;
    let emailLogs = [];
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      emailLogs = JSON.parse(existingLogs);
    } catch (error) {
      emailLogs = [];
    }
    
    res.json({
      success: true,
      zillizEvents: zillizData.events?.length || 0,
      emailLogs: emailLogs.length,
      lastZillizEvent: zillizData.events?.[zillizData.events.length - 1] || null,
      lastEmailLog: emailLogs[emailLogs.length - 1] || null
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
