// Desktop-safe email tracking system
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class DesktopEmailTracker {
  constructor() {
    this.trackingDataFile = path.join(process.cwd(), 'lib', 'data', 'email_tracking.json');
    this.baseUrl = 'https://examarkchat.com'; // Your domain for tracking
    this.localPort = process.env.PORT || 8080; // Desktop app port
    this.renderWebhookUrl = process.env.TRACKING_DOMAIN || 'https://examark-ga2o.onrender.com'; // Your Render app URL
    this.trackingData = new Map();
    this.lastPolledTimestamp = Date.now(); // Track last poll time for Zilliz
    this.pollingInterval = null; // Store polling interval reference
    this.loadTrackingData();
    
    // Start Zilliz polling when tracker is created
    this.startZillizPolling();
  }

  // Load existing tracking data
  async loadTrackingData() {
    try {
      const data = await fs.readFile(this.trackingDataFile, 'utf8');
      const parsed = JSON.parse(data);
      this.trackingData = new Map(Object.entries(parsed));
    } catch (error) {
      // File doesn't exist yet, start fresh
      this.trackingData = new Map();
    }
  }

  // Save tracking data
  async saveTrackingData() {
    try {
      const obj = Object.fromEntries(this.trackingData);
      await fs.writeFile(this.trackingDataFile, JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error('Error saving tracking data:', error);
    }
  }

  // Generate unique tracking ID for each email with user ID
  generateTrackingId(recipient, subject, userId = 'default') {
    const unique = `${userId}-${recipient}-${subject}-${Date.now()}`;
    const hash = crypto.createHash('md5').update(unique).digest('hex');
    // Format: userId_timestamp_hash for easy parsing
    return `${userId}_${Date.now()}_${hash.substring(0, 8)}`;
  }

  // Create trackable link - ALWAYS use domain for external recipients  
  createTrackableLink(originalUrl, trackingId, linkType = 'general') {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${this.baseUrl}/track/click/${trackingId}?url=${encodedUrl}&type=${linkType}`;
  }

  // Inject tracking into email HTML
  injectTracking(emailHtml, recipient, subject, userId = 'default') {
    const trackingId = this.generateTrackingId(recipient, subject, userId);
    
    // Store tracking info with user ID
    this.trackingData.set(trackingId, {
      userId,
      recipient,
      subject,
      sentAt: new Date().toISOString(),
      opens: [],
      clicks: [],
      replies: []
    });
    
    this.saveTrackingData();

    // Add tracking pixel that will call Zilliz webhook
    const trackingPixel = `<img src="${this.baseUrl}/track/pixel/${trackingId}" width="16" height="16" style="margin:0; display:block;" alt="Email tracking" />`;
    
    // Replace links with trackable versions
    let trackedHtml = emailHtml.replace(
      /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi,
      (match, attributes, url) => {
        // Don't track pixel or already tracked links
        if (url.includes('/track/') || url.includes('.png')) {
          return match;
        }
        
        const trackableUrl = this.createTrackableLink(url, trackingId);
        return match.replace(url, trackableUrl);
      }
    );

    // Add tracking pixel before closing body tag
    trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`);
    
    return { html: trackedHtml, trackingId };
  }

  // Find full tracking ID by prefix (for shortened URLs)
  findTrackingIdByPrefix(prefix) {
    for (const [fullId] of this.trackingData) {
      if (fullId.startsWith(prefix)) {
        return fullId;
      }
    }
    return null;
  }

  // Record email open
  async recordOpen(trackingId, userAgent = '', ip = '') {
    if (this.trackingData.has(trackingId)) {
      const data = this.trackingData.get(trackingId);
      data.opens.push({
        timestamp: new Date().toISOString(),
        userAgent,
        ip
      });
      
      // Update the email_logs.json record with tracking info
      await this.updateEmailLogTracking(trackingId, 'open');
      
      // Log to email_logs.json for compatibility
      await this.logEvent('open', {
        trackingId,
        recipient: data.recipient,
        subject: data.subject,
        timestamp: new Date().toISOString()
      });
      
      await this.saveTrackingData();
      console.log(`📧 Email opened by ${data.recipient}`);
    }
  }

  // Record link click
  async recordClick(trackingId, url, linkType = 'general', userAgent = '', ip = '') {
    if (this.trackingData.has(trackingId)) {
      const data = this.trackingData.get(trackingId);
      data.clicks.push({
        timestamp: new Date().toISOString(),
        url,
        linkType,
        userAgent,
        ip
      });
      
      // Update the email_logs.json record with tracking info
      await this.updateEmailLogTracking(trackingId, 'click');
      
      // Log to email_logs.json for compatibility
      await this.logEvent('click', {
        trackingId,
        recipient: data.recipient,
        subject: data.subject,
        url,
        timestamp: new Date().toISOString()
      });
      
      await this.saveTrackingData();
      console.log(`🔗 Link clicked by ${data.recipient}: ${url}`);
    }
  }

  // Log event to email_logs.json (for analytics compatibility)
  async logEvent(type, data) {
    try {
      const logsFile = path.join(process.cwd(), 'email_logs.json');
      let logs = [];
      
      try {
        const existing = await fs.readFile(logsFile, 'utf8');
        logs = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist, start fresh
      }
      
      logs.push({
        id: crypto.randomUUID(),
        type,
        ...data
      });
      
      await fs.writeFile(logsFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  // Update the main email log record with tracking events
  async updateEmailLogTracking(trackingId, eventType) {
    try {
      const logsFile = path.join(process.cwd(), 'email_logs.json');
      let logs = [];
      
      try {
        const existing = await fs.readFile(logsFile, 'utf8');
        logs = JSON.parse(existing);
      } catch (error) {
        console.log('📧 [TRACKER] No email logs file found');
        return;
      }
      
      // Find the email record with this tracking ID
      const emailRecord = logs.find(log => log.id === trackingId);
      if (emailRecord && emailRecord.analytics) {
        const now = new Date().toISOString();
        
        if (eventType === 'open') {
          emailRecord.analytics.opened = true;
          emailRecord.analytics.openCount += 1;
          emailRecord.analytics.lastActivity = now;
          console.log(`📧 [TRACKER] Updated email record - Opens: ${emailRecord.analytics.openCount}`);
        } else if (eventType === 'click') {
          emailRecord.analytics.clicked = true;
          emailRecord.analytics.clickCount += 1;
          emailRecord.analytics.lastActivity = now;
          console.log(`📧 [TRACKER] Updated email record - Clicks: ${emailRecord.analytics.clickCount}`);
        }
        
        // Save the updated logs
        await fs.writeFile(logsFile, JSON.stringify(logs, null, 2));
        console.log(`📧 [TRACKER] Email analytics updated for ${trackingId}`);
      } else {
        console.log(`📧 [TRACKER] Email record not found for tracking ID: ${trackingId}`);
      }
    } catch (error) {
      console.error('Error updating email log tracking:', error);
    }
  }

  // Start polling Zilliz for new tracking events
  startZillizPolling() {
    console.log('📧 [ZILLIZ POLLING] Starting Zilliz polling every 20 seconds...');
    
    // Wait 5 seconds for server to be ready before starting polling
    setTimeout(() => {
      // Poll immediately on start
      this.pollZillizEvents();
      
      // Set up interval polling
      this.pollingInterval = setInterval(() => {
        this.pollZillizEvents();
      }, 20000); // Poll every 20 seconds
    }, 5000);
  }

  // Stop polling Zilliz
  stopZillizPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('📧 [ZILLIZ POLLING] Stopped Zilliz polling');
    }
  }

  // Poll Zilliz for new tracking events
  async pollZillizEvents() {
    try {
      const zillizApiUrl = `http://localhost:${this.localPort}/api/zilliz-tracking/events`;
      
      const response = await fetch(zillizApiUrl);
      
      if (!response.ok) {
        console.error(`📧 [ZILLIZ POLLING] Failed to fetch events: ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.success && data.events && data.events.length > 0) {
        console.log(`📧 [ZILLIZ POLLING] Syncing with ${data.events.length} Zilliz events`);
        
        // Sync email logs with Zilliz data instead of incrementing
        await this.syncWithZillizData(data.events);
        
        console.log(`📧 [ZILLIZ POLLING] Sync completed`);
      }
      
    } catch (error) {
      console.error('📧 [ZILLIZ POLLING] Error polling Zilliz:', error);
    }
  }

  // Sync email logs with actual Zilliz data (don't increment, just set correct counts)
  async syncWithZillizData(zillizEvents) {
    try {
      // Load current email logs
      const emailLogs = await this.loadEmailLogs();
      let logsChanged = false;

      // Group Zilliz events by tracking ID (deduplicated)
      const eventsByTrackingId = {};
      for (const event of zillizEvents) {
        const trackingId = event.tracking_id;
        if (!eventsByTrackingId[trackingId]) {
          eventsByTrackingId[trackingId] = { opens: 0, clicks: 0, uniqueOpens: new Set(), uniqueClicks: new Set() };
        }
        
        if (event.event_type === 'email_open') {
          // Use IP + timestamp for deduplication (same email opened from same IP within timeframe)
          const uniqueKey = `${event.ip_address}_${Math.floor(new Date(event.timestamp).getTime() / (5 * 60 * 1000))}`; // 5-minute windows
          if (!eventsByTrackingId[trackingId].uniqueOpens.has(uniqueKey)) {
            eventsByTrackingId[trackingId].uniqueOpens.add(uniqueKey);
            eventsByTrackingId[trackingId].opens++;
          }
        } else if (event.event_type === 'email_click' || event.event_type === 'link_click') {
          const uniqueKey = `${event.ip_address}_${event.clicked_url}_${Math.floor(new Date(event.timestamp).getTime() / (5 * 60 * 1000))}`;
          if (!eventsByTrackingId[trackingId].uniqueClicks.has(uniqueKey)) {
            eventsByTrackingId[trackingId].uniqueClicks.add(uniqueKey);
            eventsByTrackingId[trackingId].clicks++;
          }
        }
      }

      // Update email logs to match Zilliz data exactly
      for (let i = 0; i < emailLogs.length; i++) {
        const log = emailLogs[i];
        const trackingId = log.trackingId || log.id; // Use trackingId or id
        
        if (eventsByTrackingId[trackingId]) {
          const zillizData = eventsByTrackingId[trackingId];
          
          // Set opened status and counts to match Zilliz exactly
          const shouldBeOpened = zillizData.opens > 0;
          const shouldBeClicked = zillizData.clicks > 0;
          const correctOpenCount = zillizData.opens;
          const correctClickCount = zillizData.clicks;
          
          // Update the analytics object within the log
          if (!log.analytics) {
            log.analytics = {};
          }
          
          const currentOpened = log.analytics.opened || false;
          const currentOpenCount = log.analytics.openCount || 0;
          const currentClickCount = log.analytics.clickCount || 0;
          const currentClicked = log.analytics.clicked || false;
          
          if (currentOpened !== shouldBeOpened || currentOpenCount !== correctOpenCount || 
              currentClickCount !== correctClickCount || currentClicked !== shouldBeClicked) {
            
            emailLogs[i].analytics = {
              ...log.analytics,
              opened: shouldBeOpened,
              clicked: shouldBeClicked,
              openCount: correctOpenCount,
              clickCount: correctClickCount,
              lastActivity: shouldBeOpened || shouldBeClicked ? new Date().toISOString() : log.analytics.lastActivity
            };
            
            // Also update the legacy fields for backward compatibility
            emailLogs[i].opened = shouldBeOpened;
            emailLogs[i].openCount = correctOpenCount;
            emailLogs[i].clickCount = correctClickCount;
            
            logsChanged = true;
            console.log(`📧 [SYNC] Updated ${trackingId}: opens=${correctOpenCount}, clicks=${correctClickCount}`);
          }
        }
      }

      // Save if changes were made
      if (logsChanged) {
        await this.saveEmailLogs(emailLogs);
        console.log(`📧 [SYNC] Email logs synchronized with Zilliz data`);
      }

      // Also fetch and sync reply data for emails that have tracking IDs
      await this.syncReplyData(emailLogs);

    } catch (error) {
      console.error('📧 [SYNC] Error syncing with Zilliz data:', error);
    }
  }

  // Fetch and sync reply data for emails
  async syncReplyData(emailLogs) {
    try {
      console.log(`📧 [REPLY SYNC] Syncing reply data for ${emailLogs.length} emails`);
      let repliesUpdated = false;

      for (let i = 0; i < emailLogs.length; i++) {
        const log = emailLogs[i];
        const trackingId = log.trackingId || log.id;
        
        if (trackingId) {
          try {
            const replyUrl = `http://localhost:${this.localPort}/api/zilliz-tracking/replies/${trackingId}`;
            const response = await fetch(replyUrl);
            
            if (response.ok) {
              const replyData = await response.json();
              
              if (replyData.success && replyData.replies && replyData.replies.length > 0) {
                // Store reply data in the email log
                emailLogs[i].replies = replyData.replies;
                
                // Update analytics to show replied status
                if (!emailLogs[i].analytics) {
                  emailLogs[i].analytics = {};
                }
                
                emailLogs[i].analytics.replied = true;
                emailLogs[i].analytics.replyCount = replyData.replies.length;
                emailLogs[i].analytics.lastActivity = new Date().toISOString();
                
                repliesUpdated = true;
                
                console.log(`📧 [REPLY SYNC] Found ${replyData.replies.length} replies for ${trackingId}`);
                
                // Log AI response summary for debugging
                replyData.replies.forEach((reply, idx) => {
                  if (reply.ai_response) {
                    console.log(`📧 [AI REPLY ${idx + 1}] Sentiment: ${reply.sentiment}, AI sent: ${reply.ai_response_sent}`);
                  }
                });
              }
            }
          } catch (replyError) {
            console.error(`📧 [REPLY SYNC] Error fetching replies for ${trackingId}:`, replyError.message);
          }
        }
      }

      // Save if replies were updated
      if (repliesUpdated) {
        await this.saveEmailLogs(emailLogs);
        console.log(`📧 [REPLY SYNC] Reply data synchronized`);
      }

    } catch (error) {
      console.error('📧 [REPLY SYNC] Error syncing reply data:', error);
    }
  }

  // Get tracking stats for analytics
  getTrackingStats() {
    const stats = {
      totalEmails: this.trackingData.size,
      totalOpens: 0,
      totalClicks: 0,
      openRate: 0,
      clickRate: 0,
      recentActivity: []
    };

    for (const [trackingId, data] of this.trackingData) {
      stats.totalOpens += data.opens.length;
      stats.totalClicks += data.clicks.length;
      
      // Add recent activity
      data.opens.forEach(open => {
        stats.recentActivity.push({
          type: 'open',
          recipient: data.recipient,
          timestamp: open.timestamp
        });
      });
      
      data.clicks.forEach(click => {
        stats.recentActivity.push({
          type: 'click',
          recipient: data.recipient,
          url: click.url,
          timestamp: click.timestamp
        });
      });
    }

    // Calculate rates
    if (stats.totalEmails > 0) {
      const uniqueOpens = new Set();
      const uniqueClicks = new Set();
      
      for (const [trackingId, data] of this.trackingData) {
        if (data.opens.length > 0) uniqueOpens.add(trackingId);
        if (data.clicks.length > 0) uniqueClicks.add(trackingId);
      }
      
      stats.openRate = (uniqueOpens.size / stats.totalEmails) * 100;
      stats.clickRate = (uniqueClicks.size / stats.totalEmails) * 100;
    }

    // Sort recent activity by timestamp
    stats.recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    stats.recentActivity = stats.recentActivity.slice(0, 50); // Last 50 events

    return stats;
  }

  // Clear all tracking data
  clearAllTrackingData() {
    console.log('🗑️ [DESKTOP TRACKER] Clearing all local tracking data...');
    this.trackingData.clear();
    console.log('✅ [DESKTOP TRACKER] Local tracking data cleared');
  }

  // Load email logs from file
  async loadEmailLogs() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const logPath = path.join(process.cwd(), 'email_logs.json');
      const data = await fs.readFile(logPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('📧 [SYNC] Error loading email logs:', error);
      return [];
    }
  }

  // Save email logs to file
  async saveEmailLogs(emailLogs) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const logPath = path.join(process.cwd(), 'email_logs.json');
      await fs.writeFile(logPath, JSON.stringify(emailLogs, null, 2), 'utf8');
    } catch (error) {
      console.error('📧 [SYNC] Error saving email logs:', error);
    }
  }
}

// Create singleton instance
export const desktopEmailTracker = new DesktopEmailTracker();

export default DesktopEmailTracker;
