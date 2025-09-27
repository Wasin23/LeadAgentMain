import fs from 'fs/promises';
import fetch from 'node-fetch';

async function manualSyncAnalytics() {
  try {
    // Check deployment mode - this script should only be used in desktop mode
    const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'desktop';
    
    if (DEPLOYMENT_MODE === 'web') {
      console.error('🚫 [DEPLOYMENT GUARD] This standalone sync script is NOT SAFE for web deployment!');
      console.error('🌐 [DEPLOYMENT GUARD] Use the /api/sync/manual-sync endpoint instead for user-scoped syncing.');
      console.error('❌ [DEPLOYMENT GUARD] Aborting to prevent data leakage between users.');
      process.exit(1);
    }
    
    console.log('🔄 [DESKTOP MODE] Starting manual sync of analytics with Zilliz data...');
    
    // Get tracking events from Zilliz
    console.log('📊 Fetching events from Zilliz...');
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
    const response = await fetch(`${apiBaseUrl}/api/zilliz-tracking/events`);
    const zillizData = await response.json();
    
    if (!zillizData.success || !zillizData.events) {
      console.error('❌ Failed to fetch Zilliz events');
      return;
    }
    
    console.log(`📊 Found ${zillizData.events.length} tracking events in Zilliz`);
    
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
    
    console.log('📊 Events grouped by tracking ID:', eventsByTrackingId);
    
    // Load email logs
    console.log('📧 Loading email logs...');
    const logPath = 'email_logs.json';
    let emailLogs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      emailLogs = JSON.parse(existingLogs);
    } catch (error) {
      console.log('📧 No existing email logs found');
      return;
    }
    
    console.log(`📧 Loaded ${emailLogs.length} email logs`);
    
    // Update analytics for each email
    let updated = false;
    for (let i = 0; i < emailLogs.length; i++) {
      const log = emailLogs[i];
      const trackingId = log.trackingId || log.id;
      
      if (eventsByTrackingId[trackingId]) {
        const zillizStats = eventsByTrackingId[trackingId];
        
        console.log(`🔄 Updating analytics for ${trackingId}:`, zillizStats);
        
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
        console.log(`✅ Updated ${trackingId}: opened=${zillizStats.opens > 0}, openCount=${zillizStats.opens}, clickCount=${zillizStats.clicks}`);
      }
    }
    
    if (updated) {
      // Save updated logs
      await fs.writeFile(logPath, JSON.stringify(emailLogs, null, 2));
      console.log('✅ Email logs updated successfully!');
      console.log('🎯 Analytics should now show the correct open/click counts');
    } else {
      console.log('ℹ️ No updates needed');
    }
    
  } catch (error) {
    console.error('❌ Error during manual sync:', error);
  }
}

// Run the sync
manualSyncAnalytics();
