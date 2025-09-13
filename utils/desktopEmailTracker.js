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
    this.loadTrackingData();
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

  // Generate unique tracking ID for each email
  generateTrackingId(recipient, subject) {
    const unique = `${recipient}-${subject}-${Date.now()}`;
    return crypto.createHash('md5').update(unique).digest('hex');
  }

  // Create tracking pixel URL (embedded in email) - Make it look like a legitimate image
  createTrackingPixel(trackingId) {
    return `${this.baseUrl}/images/spacer-${trackingId.substring(0,8)}.png`;
  }

  // Create trackable link - ALWAYS use domain for external recipients  
  createTrackableLink(originalUrl, trackingId, linkType = 'general') {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${this.baseUrl}/track/click/${trackingId}?url=${encodedUrl}&type=${linkType}`;
  }

  // Inject tracking into email HTML
  injectTracking(emailHtml, recipient, subject) {
    const trackingId = this.generateTrackingId(recipient, subject);
    
    // Store tracking info
    this.trackingData.set(trackingId, {
      recipient,
      subject,
      sentAt: new Date().toISOString(),
      opens: [],
      clicks: [],
      replies: []
    });
    
    this.saveTrackingData();

    // Add tracking pixel as a legitimate-looking image element (not hidden)
    const trackingPixel = `<img src="${this.createTrackingPixel(trackingId)}" width="3" height="3" style="opacity:0.1; margin:2px;" alt="." title="spacer" />`;
    
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
}

// Create singleton instance
export const desktopEmailTracker = new DesktopEmailTracker();

export default DesktopEmailTracker;
