// Desktop-safe email tracking system
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class DesktopEmailTracker {
  constructor() {
    this.trackingDataFile = path.join(process.cwd(), 'lib', 'data', 'email_tracking.json');
    this.baseUrl = process.env.TRACKING_DOMAIN || 'https://meridian-kdew.onrender.com'; // Use env var for tracking domain
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080'; // API server URL
    this.renderWebhookUrl = process.env.TRACKING_DOMAIN || 'https://meridian-kdew.onrender.com'; // Your Render app URL
    this.trackingData = new Map();
    
    // User session polling management
    this.userPollingIntervals = new Map(); // userId -> polling interval reference
    this.userLastPolledTimestamp = new Map(); // userId -> last poll timestamp
    this.userScheduledEvents = new Map(); // userId -> scheduled events from polling
    
    this.loadTrackingData();
    
    // No automatic polling - will be started per user session
    console.log('📧 [EMAIL TRACKER] Ready for user session-based polling');
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

  // Generate unique tracking ID for each email with user code (first 8 chars of user ID) and optional agentId
  generateTrackingId(recipient, subject, userCode, agentId = null) {
    const agentPart = agentId ? `-${agentId}` : '';
    const unique = `${userCode}${agentPart}-${recipient}-${subject}-${Date.now()}`;
    const hash = crypto.createHash('md5').update(unique).digest('hex');
    // Format: tracking-userCode_agentId_timestamp_hash for proper webhook processing
    const agentSuffix = agentId ? `_${agentId}` : '';
    return `tracking-${userCode}${agentSuffix}_${Date.now()}_${hash.substring(0, 8)}`;
  }

  // Create trackable link - ALWAYS use domain for external recipients  
  createTrackableLink(originalUrl, trackingId, linkType = 'general') {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${this.baseUrl}/track/click/${trackingId}?url=${encodedUrl}&type=${linkType}`;
  }

  // Inject tracking into email HTML with optional agentId for agent-specific tracking
  injectTracking(emailHtml, recipient, subject, userId, agentId = null) {
    // Extract user code from full user ID - REQUIRE userId for proper multi-user support
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required for email tracking - ensure user is authenticated');
    }
    
    const userCode = userId.substring(0, 8);
    const trackingId = this.generateTrackingId(recipient, subject, userCode, agentId);
    
    // Store tracking info with user ID and optional agentId
    this.trackingData.set(trackingId, {
      userId,
      agentId,
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

  // DISABLED: Global email logging - use user-specific files only
  async logEvent(type, data) {
    console.log('[DESKTOP EMAIL] Skipping global email logging - use user-specific files only');
    return;
    /*
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
    */
  }

  // DISABLED: Global email log tracking - use user-specific files only  
  async updateEmailLogTracking(trackingId, eventType) {
    console.log('[DESKTOP EMAIL] Skipping global email log tracking - use user-specific files only');
    return;
    /*
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
    */
  }

  // REMOVED: Old global polling - now using user session-based polling

  // Stop polling Zilliz
  stopZillizPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('📧 [ZILLIZ POLLING] Stopped Zilliz polling');
    }
  }

  // REMOVED: Old global polling method - replaced with user-specific polling

  // Sync email logs with actual Zilliz data (don't increment, just set correct counts)
  async syncWithZillizData(zillizEvents, userId = null, agentId = null) {
    try {
      // Load current email logs for specific user
      const emailLogs = await this.loadEmailLogs(userId);
      let logsChanged = false;

      // Group Zilliz events by tracking ID (deduplicated)
      const eventsByTrackingId = {};
      for (const event of zillizEvents) {
        const trackingId = event.tracking_id;
        if (!eventsByTrackingId[trackingId]) {
          eventsByTrackingId[trackingId] = { 
            opens: 0, 
            clicks: 0, 
            replies: 0,
            aiReplies: [],
            leadMessages: [],
            uniqueOpens: new Set(), 
            uniqueClicks: new Set(),
            uniqueReplies: new Set()
          };
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
        } else if (event.event_type === 'ai_reply') {
          // Track AI replies - use timestamp + content for deduplication
          const uniqueKey = `ai_reply_${event.timestamp}_${event.recipient}`;
          if (!eventsByTrackingId[trackingId].uniqueReplies.has(uniqueKey)) {
            eventsByTrackingId[trackingId].uniqueReplies.add(uniqueKey);
            eventsByTrackingId[trackingId].replies++;
            

            
            eventsByTrackingId[trackingId].aiReplies.push({
              timestamp: event.timestamp,
              recipient: event.recipient || event.email_address,
              content: event.user_agent, // AI reply content is stored in user_agent field
              type: 'ai_reply'
            });
          }
        } else if (event.event_type === 'lead_message') {
          // Track lead messages - use timestamp + content for deduplication
          const uniqueKey = `lead_message_${event.timestamp}_${event.email_address}`;
          if (!eventsByTrackingId[trackingId].uniqueReplies.has(uniqueKey)) {
            eventsByTrackingId[trackingId].uniqueReplies.add(uniqueKey);
            eventsByTrackingId[trackingId].replies++;
            

            
            eventsByTrackingId[trackingId].leadMessages.push({
              timestamp: event.timestamp,
              from: event.email_address,
              content: event.user_agent, // Lead message content is stored in user_agent field
              type: 'lead_message'
            });
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
          const shouldBeReplied = zillizData.replies > 0;
          const correctOpenCount = zillizData.opens;
          const correctClickCount = zillizData.clicks;
          const correctReplyCount = zillizData.replies;
          
          // Update the analytics object within the log
          if (!log.analytics) {
            log.analytics = {};
          }
          
          const currentOpened = log.analytics.opened || false;
          const currentOpenCount = log.analytics.openCount || 0;
          const currentClickCount = log.analytics.clickCount || 0;
          const currentClicked = log.analytics.clicked || false;
          const currentReplied = log.analytics.replied || false;
          const currentReplyCount = log.analytics.replyCount || 0;
          
          if (currentOpened !== shouldBeOpened || currentOpenCount !== correctOpenCount || 
              currentClickCount !== correctClickCount || currentClicked !== shouldBeClicked ||
              currentReplied !== shouldBeReplied || currentReplyCount !== correctReplyCount) {
            
            // Create unified replies array for frontend compatibility
            const unifiedReplies = [];
            
            // Add lead messages as replies
            if (zillizData.leadMessages && zillizData.leadMessages.length > 0) {
              zillizData.leadMessages.forEach(msg => {
                unifiedReplies.push({
                  timestamp: msg.timestamp,
                  from_email: msg.from,
                  sender: msg.from,
                  lead_message: msg.content,
                  type: 'lead_message',
                  subject: msg.content.includes('Subject:') ? 
                    msg.content.split('\n').find(line => line.startsWith('Subject:'))?.replace('Subject: ', '') : 
                    'Re: ' + (log.subject || 'No Subject')
                });
              });
            }
            
            // Add AI replies as replies
            if (zillizData.aiReplies && zillizData.aiReplies.length > 0) {
              zillizData.aiReplies.forEach(reply => {
                unifiedReplies.push({
                  timestamp: reply.timestamp,
                  ai_response: reply.content,
                  ai_response_timestamp: reply.timestamp,
                  ai_response_sent: true,
                  type: 'ai_reply',
                  to_email: reply.recipient,
                  subject: reply.content.includes('Subject:') ? 
                    reply.content.split('\n').find(line => line.startsWith('Subject:'))?.replace('Subject: ', '') : 
                    'Re: ' + (log.subject || 'No Subject')
                });
              });
            }
            
            // Sort replies by timestamp
            unifiedReplies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            emailLogs[i].analytics = {
              ...log.analytics,
              opened: shouldBeOpened,
              clicked: shouldBeClicked,
              replied: shouldBeReplied,
              openCount: correctOpenCount,
              clickCount: correctClickCount,
              replyCount: correctReplyCount,
              aiReplies: zillizData.aiReplies || [],
              leadMessages: zillizData.leadMessages || [],
              lastActivity: (shouldBeOpened || shouldBeClicked || shouldBeReplied) ? new Date().toISOString() : log.analytics.lastActivity
            };
            
            // Add unified replies array for frontend
            emailLogs[i].replies = unifiedReplies;
            
            // Also update the legacy fields for backward compatibility
            emailLogs[i].opened = shouldBeOpened;
            emailLogs[i].openCount = correctOpenCount;
            emailLogs[i].clickCount = correctClickCount;
            
            logsChanged = true;
            console.log(`📧 [SYNC] Updated ${trackingId}: opens=${correctOpenCount}, clicks=${correctClickCount}, replies=${correctReplyCount}`);
          }
        }
      }

      // Save if changes were made - DISABLED: No longer using JSON files, all data in AWS
      if (logsChanged) {
        console.log(`📧 [SYNC] Email logs changes detected but not saving to JSON (using AWS instead)`);
      }

      // IMPORTANT: Sync tracking data to AWS approved emails
      if (userId) {
        await this.syncTrackingDataToAWSApprovedEmails(eventsByTrackingId, userId, agentId);
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
            const replyUrl = `${this.apiBaseUrl}/api/zilliz-tracking/replies/${trackingId}`;
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

  // Sync tracking data directly to AWS approved emails (this is where the UI gets the data!)
  async syncTrackingDataToAWSApprovedEmails(eventsByTrackingId, userId, agentId = null) {
    try {
      console.log(`📧 [AWS SYNC] Syncing tracking data to AWS for user ${userId}, agent ${agentId || 'all'}`);
      
      // Dynamically import AWS email queue
      const { getAWSEmailQueue } = await import('./awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      
      // Get approved/sent emails from AWS
      let approvedEmails = [];
      try {
        if (agentId && agentId !== 'all') {
          approvedEmails = await awsQueue.getSentEmails(userId, agentId);
        } else {
          approvedEmails = await awsQueue.getAllSentEmailsForUser(userId);
        }
      } catch (error) {
        console.error(`📧 [AWS SYNC] Error fetching emails from AWS:`, error);
        return;
      }
      
      if (approvedEmails.length === 0) {
        console.log(`📧 [AWS SYNC] No approved emails to sync for user ${userId}`);
        return;
      }
      
      console.log(`📧 [AWS SYNC] Syncing tracking data to ${approvedEmails.length} AWS emails`);
      
      let updatedCount = 0;
      
      // Update approved emails with tracking data
      for (let i = 0; i < approvedEmails.length; i++) {
        const email = approvedEmails[i];
        
        // Try to match by tracking ID from multiple possible fields
        // Priority: direct trackingId field (from markEmailAsSent) > nested sentMailgunId > email.id
        const emailTrackingId = email.trackingId ||                      // NEW: Direct trackingId field
                               email.sentMailgunId?.trackingId || 
                               email.sentMailgunId?.message ||
                               email.mailgunMessage ||                    // NEW: Also check mailgunMessage field
                               email.id;
        
        if (!emailTrackingId) {
          console.log(`📧 [APPROVED SYNC] Email has no tracking ID:`, email.to || email.leadData?.email);
          continue;
        }
        
        // Look for matching tracking data
        let trackingData = eventsByTrackingId[emailTrackingId];
        if (!trackingData) {
          // Try a partial match if full tracking ID doesn't match (in case formats differ)
          let found = false;
          for (const [zillizTrackingId, data] of Object.entries(eventsByTrackingId)) {
            if (emailTrackingId.includes(zillizTrackingId) || zillizTrackingId.includes(emailTrackingId)) {
              console.log(`📧 [APPROVED SYNC] Partial match found: ${emailTrackingId} ≈ ${zillizTrackingId}`);
              trackingData = data;
              found = true;
              break;
            }
          }
          if (!found) {
            continue;
          }
        }
        
        // Update the approved email with tracking info
        const shouldBeOpened = trackingData.opens > 0;
        const shouldBeClicked = trackingData.clicks > 0;
        const shouldBeReplied = trackingData.replies > 0;
        
        // Initialize analytics if not present
        if (!email.analytics) email.analytics = {};
        
        // Update tracking status
        email.analytics.opened = shouldBeOpened;
        email.analytics.clicked = shouldBeClicked; 
        email.analytics.replied = shouldBeReplied;
        email.analytics.openCount = trackingData.opens;
        email.analytics.clickCount = trackingData.clicks;
        email.analytics.replyCount = trackingData.replies;
        email.analytics.lastActivity = shouldBeOpened || shouldBeClicked || shouldBeReplied ? new Date().toISOString() : email.analytics.lastActivity;
        
        // Also add top-level fields for compatibility
        email.opened = shouldBeOpened;
        email.clicked = shouldBeClicked;
        email.replied = shouldBeReplied;
        
        // Add agent context if provided
        if (agentId && !email.agentId) {
          email.agentId = agentId;
        }
        
        updatedCount++;
        console.log(`📧 [AWS SYNC] Updated email ${email.leadData?.email || email.to || 'unknown'}: opened=${shouldBeOpened}, clicked=${shouldBeClicked}, replied=${shouldBeReplied}`);
      }
      
      // Save the updated emails back to AWS
      if (updatedCount > 0) {
        try {
          // Update each email in AWS with full context
          for (const email of approvedEmails) {
            if (email.analytics && email.id) {
              // Extract userId and agentId from the email object
              const emailUserId = email.userId || userId;
              const emailAgentId = email.agentId || agentId || 'unknown';
              
              await awsQueue.updateEmailAnalyticsWithContext(
                emailUserId, 
                emailAgentId, 
                email.id, 
                email.analytics
              );
            }
          }
          console.log(`📧 [AWS SYNC] Successfully updated ${updatedCount} emails in AWS with tracking data`);
        } catch (saveError) {
          console.error(`📧 [AWS SYNC] Error saving updates to AWS:`, saveError);
        }
      } else {
        console.log(`📧 [AWS SYNC] No emails matched tracking IDs - check tracking ID formats`);
        // Log some examples for debugging
        if (Object.keys(eventsByTrackingId).length > 0) {
          const sampleZillizId = Object.keys(eventsByTrackingId)[0];
          console.log(`📧 [AWS SYNC] Sample Zilliz tracking ID: ${sampleZillizId}`);
        }
        if (approvedEmails.length > 0) {
          const sampleEmail = approvedEmails[0];
          const sampleEmailId = sampleEmail.trackingId || 
                                sampleEmail.sentMailgunId?.trackingId || 
                                sampleEmail.sentMailgunId?.message ||
                                sampleEmail.id;
          console.log(`📧 [AWS SYNC] Sample email tracking ID: ${sampleEmailId}`);
        }
      }
      
    } catch (error) {
      console.error('📧 [AWS SYNC] Error syncing to AWS emails:', error);
    }
  }

  // OLD JSON-based sync function - DEPRECATED, keeping for backwards compatibility
  async syncTrackingDataToApprovedEmails(eventsByTrackingId, userId, agentId = null) {
    console.log(`📧 [DEPRECATED] syncTrackingDataToApprovedEmails called - redirecting to AWS sync`);
    return this.syncTrackingDataToAWSApprovedEmails(eventsByTrackingId, userId, agentId);
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

  // Clear tracking data for a specific user
  clearUserTrackingData(userId) {
    const userCode = userId.substring(0, 8);
    console.log(`🗑️ [DESKTOP TRACKER] Clearing local tracking data for user: ${userCode}...`);
    
    let clearedCount = 0;
    for (const [key, value] of this.trackingData.entries()) {
      if (key.startsWith(`tracking-${userCode}_`)) {
        this.trackingData.delete(key);
        clearedCount++;
      }
    }
    
    console.log(`✅ [DESKTOP TRACKER] Cleared ${clearedCount} local tracking entries for user: ${userCode}`);
    this.saveTrackingData(); // Save changes to file
  }

  // Clear all tracking data (admin function)
  clearAllTrackingData() {
    console.log('🗑️ [DESKTOP TRACKER] Clearing all local tracking data...');
    this.trackingData.clear();
    console.log('✅ [DESKTOP TRACKER] Local tracking data cleared');
    this.saveTrackingData(); // Save changes to file
  }

  // Load email logs from file - now user-specific
  async loadEmailLogs(userId = null) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // If userId provided, use user-specific file, otherwise try to load all user files
      if (userId) {
        const logPath = path.join(process.cwd(), `email_logs_${userId}.json`);
        const data = await fs.readFile(logPath, 'utf8');
        return JSON.parse(data);
      } else {
        // Load all user-specific files and combine them
        const allLogs = [];
        try {
          const files = await fs.readdir(process.cwd());
          const userLogFiles = files.filter(f => f.startsWith('email_logs_') && f.endsWith('.json') && f !== 'email_logs.json');
          
          for (const file of userLogFiles) {
            try {
              const filePath = path.join(process.cwd(), file);
              const data = await fs.readFile(filePath, 'utf8');
              const logs = JSON.parse(data);
              allLogs.push(...logs);
            } catch (fileError) {
              console.log(`📧 [SYNC] Skipping file ${file}:`, fileError.message);
            }
          }
        } catch (dirError) {
          console.log('📧 [SYNC] Error reading directory:', dirError.message);
        }
        
        return allLogs;
      }
    } catch (error) {
      // If file doesn't exist, return empty array (don't create files here)
      if (error.code === 'ENOENT') {
        console.log(`📧 [SYNC] No email logs found for user ${userId || 'all users'}`);
        return [];
      }
      console.error('📧 [SYNC] Error loading email logs:', error);
      return [];
    }
  }

  // Save email logs to user-specific files
  async saveEmailLogs(emailLogs, userId = null) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      if (userId) {
        // Save to specific user file
        const logPath = path.join(process.cwd(), `email_logs_${userId}.json`);
        await fs.writeFile(logPath, JSON.stringify(emailLogs, null, 2), 'utf8');
        console.log(`📧 [SYNC] Saved ${emailLogs.length} emails for user ${userId}`);
      } else {
        // Group logs by userId and save to separate files
        const logsByUser = {};
        
        emailLogs.forEach(log => {
          // Extract userId from tracking ID
          const trackingId = log.trackingId || log.id;
          let logUserId = null;
          
          if (trackingId && trackingId.includes('_')) {
            const match = trackingId.match(/tracking-([^_]+)_/);
            if (match) {
              logUserId = match[1];
            }
          }
          
          if (logUserId) {
            if (!logsByUser[logUserId]) {
              logsByUser[logUserId] = [];
            }
            logsByUser[logUserId].push(log);
          }
        });
        
        // Save each user's logs to their specific file
        for (const [uId, logs] of Object.entries(logsByUser)) {
          const logPath = path.join(process.cwd(), `email_logs_${uId}.json`);
          await fs.writeFile(logPath, JSON.stringify(logs, null, 2), 'utf8');
          console.log(`📧 [SYNC] Saved ${logs.length} emails for user ${uId}`);
        }
      }
    } catch (error) {
      console.error('📧 [SYNC] Error saving email logs:', error);
    }
  }

  // Start polling for a specific user session
  startUserPolling(userId) {
    // Don't start if already polling for this user
    if (this.userPollingIntervals.has(userId)) {
      console.log(`📧 [USER POLLING] Already polling for user ${userId}`);
      return;
    }

    console.log(`📧 [USER POLLING] Starting polling for user ${userId}`);
    this.userLastPolledTimestamp.set(userId, Date.now());

    // Start polling every 30 seconds for this user
    const intervalId = setInterval(async () => {
      await this.pollZillizEventsForUser(userId);
    }, 30000);

    this.userPollingIntervals.set(userId, intervalId);
    
    // Do an immediate poll
    this.pollZillizEventsForUser(userId);
  }

  // Stop polling for a specific user session
  stopUserPolling(userId) {
    const intervalId = this.userPollingIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.userPollingIntervals.delete(userId);
      this.userLastPolledTimestamp.delete(userId);
      console.log(`📧 [USER POLLING] Stopped polling for user ${userId}`);
    }
  }

  // Poll Zilliz for events specific to a user and their active agents
  async pollZillizEventsForUser(userId) {
    try {
      // Get active agents for this user
      const { getUserActiveAgents } = await import('../agent/reasoningLeadAgent.js');
      const activeAgents = getUserActiveAgents(userId);
      
      // Only log if agents exist (reduce polling noise)
      if (activeAgents.length > 0) {
        console.log(`📧 [USER POLLING] User ${userId}: Found ${activeAgents.length} active agents`);
      }
      
      // Poll for each active agent (future-proofed for multiple agents)
      for (const agentInfo of activeAgents) {
        await this.pollZillizEventsForUserAgent(userId, agentInfo.agentId);
      }
      
    } catch (error) {
      console.error(`📧 [USER POLLING] Error polling for user ${userId}:`, error);
    }
  }

  // Poll Zilliz for events specific to a user and optionally an agent
  async pollZillizEventsForUserAgent(userId, agentId = null) {
    try {
      // Use the internal events endpoint with server secret for polling, filtered by userId and agentId
      const serverSecret = process.env.SERVER_SECRET || 'internal-polling-secret-2024';
      let zillizApiUrl = `${this.apiBaseUrl}/api/zilliz-tracking/internal/events?userId=${encodeURIComponent(userId)}`;
      
      if (agentId) {
        zillizApiUrl += `&agentId=${encodeURIComponent(agentId)}`;
        // Reduced logging for polling endpoint
      }
      
      const response = await fetch(zillizApiUrl, {
        headers: {
          'x-server-secret': serverSecret,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const context = agentId ? `user ${userId}, agent ${agentId}` : `user ${userId}`;
        console.error(`📧 [AGENT POLLING] Failed to fetch events for ${context}: ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.success && data.events) {
        // Handle the new structure with both tracking and scheduled events
        const { trackingEvents, scheduledEvents, totalCount } = data.events;
        
        if (totalCount > 0) {
          const context = agentId ? `user ${userId}, agent ${agentId}` : `user ${userId}`;
          console.log(`📧 [AGENT POLLING] ${context}: Syncing ${trackingEvents?.length || 0} tracking events and ${scheduledEvents?.length || 0} scheduled events`);
          
          // Sync tracking events if they exist, including agent context
          if (trackingEvents && trackingEvents.length > 0) {
            await this.syncWithZillizData(trackingEvents, userId, agentId);
          }
          
          // Handle scheduled events separately - we'll just log them for now
          if (scheduledEvents && scheduledEvents.length > 0) {
            // Reduced logging - only if events exist
            // Store scheduled events in memory for the frontend to access
            this.userScheduledEvents = this.userScheduledEvents || new Map();
            const eventKey = agentId ? `${userId}_${agentId}` : userId;
            this.userScheduledEvents.set(eventKey, scheduledEvents);
          }
        }
      }
      
    } catch (error) {
      const context = agentId ? `user ${userId}, agent ${agentId}` : `user ${userId}`;
      console.error(`📧 [AGENT POLLING] Error polling for ${context}:`, error);
    }
  }

  // Get list of users currently being polled
  getActiveUserPolling() {
    return Array.from(this.userPollingIntervals.keys());
  }

  // Stop all user polling (for shutdown)
  stopAllUserPolling() {
    console.log('📧 [USER POLLING] Stopping all user polling sessions');
    for (const userId of this.userPollingIntervals.keys()) {
      this.stopUserPolling(userId);
    }
  }

  // Get scheduled events for a specific user
  getUserScheduledEvents(userId) {
    if (!this.userScheduledEvents) {
      return [];
    }
    return this.userScheduledEvents.get(userId) || [];
  }
}

// Create singleton instance
export const desktopEmailTracker = new DesktopEmailTracker();

export default DesktopEmailTracker;
