// Desktop app with domain-based email tracking
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class DomainDesktopTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Your domain for tracking (you'll set this)
    this.trackingDomain = options.trackingDomain || 'your-domain.com';
    this.localPort = options.localPort || 8080;
    
    // Local storage
    this.trackingDataFile = path.join(process.cwd(), 'lib', 'data', 'email_tracking.json');
    this.trackingData = new Map();
    
    // Webhook secret for security
    this.webhookSecret = options.webhookSecret || crypto.randomBytes(32).toString('hex');
    
    this.loadTrackingData();
  }

  // Load existing tracking data
  async loadTrackingData() {
    try {
      const data = await fs.readFile(this.trackingDataFile, 'utf8');
      const parsed = JSON.parse(data);
      this.trackingData = new Map(Object.entries(parsed));
      console.log(`[DESKTOP TRACKER] Loaded ${this.trackingData.size} tracking records`);
    } catch (error) {
      this.trackingData = new Map();
      console.log('[DESKTOP TRACKER] Starting with fresh tracking data');
    }
  }

  // Save tracking data
  async saveTrackingData() {
    try {
      const obj = Object.fromEntries(this.trackingData);
      await fs.writeFile(this.trackingDataFile, JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error('[DESKTOP TRACKER] Error saving tracking data:', error);
    }
  }

  // Generate unique tracking ID with user code
  generateTrackingId(recipient, subject, userCode = '76e84c79') {
    const unique = `${userCode}-${recipient}-${subject}-${Date.now()}`;
    const hash = crypto.createHash('md5').update(unique).digest('hex');
    // Format: tracking-userCode_timestamp_hash
    return `tracking-${userCode}_${Date.now()}_${hash.substring(0, 8)}`;
  }

  // Create tracking pixel URL (uses your domain)
  createTrackingPixel(trackingId) {
    return `https://${this.trackingDomain}/track/pixel/${trackingId}.png?webhook=${encodeURIComponent(`http://localhost:${this.localPort}/webhook/open`)}&secret=${this.webhookSecret}`;
  }

  // Create trackable link (uses your domain)
  createTrackableLink(originalUrl, trackingId, linkType = 'general') {
    const encodedUrl = encodeURIComponent(originalUrl);
    const webhookUrl = encodeURIComponent(`http://localhost:${this.localPort}/webhook/click`);
    return `https://${this.trackingDomain}/track/click/${trackingId}?url=${encodedUrl}&type=${linkType}&webhook=${webhookUrl}&secret=${this.webhookSecret}`;
  }

  // Inject tracking into email HTML
  injectTracking(emailHtml, recipient, subject, userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411') {
    const trackingId = this.generateTrackingId(recipient, subject, userId);
    
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

    // Add tracking pixel at end of email
    const trackingPixel = `<img src="${this.createTrackingPixel(trackingId)}" width="1" height="1" style="display:none;" alt="" />`;
    
    // Replace links with trackable versions
    let trackedHtml = emailHtml.replace(
      /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi,
      (match, attributes, url) => {
        // Don't track tracking URLs or images
        if (url.includes(this.trackingDomain) || url.includes('.png') || url.includes('.jpg')) {
          return match;
        }
        
        const trackableUrl = this.createTrackableLink(url, trackingId);
        return match.replace(url, trackableUrl);
      }
    );

    // Add tracking pixel before closing body tag
    if (trackedHtml.includes('</body>')) {
      trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`);
    } else {
      trackedHtml += trackingPixel;
    }
    
    console.log(`[DESKTOP TRACKER] Tracking injected for ${recipient} (ID: ${trackingId})`);
    
    return { html: trackedHtml, trackingId };
  }

  // Handle webhook from your domain (when someone opens email)
  async handleOpenWebhook(trackingId, data = {}) {
    if (this.trackingData.has(trackingId)) {
      const tracking = this.trackingData.get(trackingId);
      tracking.opens.push({
        timestamp: new Date().toISOString(),
        userAgent: data.userAgent || '',
        ip: data.ip || '',
        source: 'domain-webhook'
      });
      
      await this.saveTrackingData();
      await this.logEvent('open', {
        trackingId,
        recipient: tracking.recipient,
        subject: tracking.subject,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📧 [OPEN] ${tracking.recipient} opened email "${tracking.subject}"`);
      this.emit('email-opened', { trackingId, recipient: tracking.recipient });
      
      return true;
    }
    return false;
  }

  // Handle webhook from your domain (when someone clicks link)
  async handleClickWebhook(trackingId, url, data = {}) {
    if (this.trackingData.has(trackingId)) {
      const tracking = this.trackingData.get(trackingId);
      tracking.clicks.push({
        timestamp: new Date().toISOString(),
        url,
        userAgent: data.userAgent || '',
        ip: data.ip || '',
        source: 'domain-webhook'
      });
      
      await this.saveTrackingData();
      await this.logEvent('click', {
        trackingId,
        recipient: tracking.recipient,
        subject: tracking.subject,
        url,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🔗 [CLICK] ${tracking.recipient} clicked: ${url}`);
      this.emit('email-clicked', { trackingId, recipient: tracking.recipient, url });
      
      return true;
    }
    return false;
  }

  // Log event to email_logs.json for analytics
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
      
      // Keep only last 1000 entries to prevent file bloat
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
      
      await fs.writeFile(logsFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('[DESKTOP TRACKER] Error logging event:', error);
    }
  }

  // Get tracking statistics
  getTrackingStats() {
    const stats = {
      totalEmails: this.trackingData.size,
      totalOpens: 0,
      totalClicks: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
      openRate: 0,
      clickRate: 0,
      recentActivity: []
    };

    const openedEmails = new Set();
    const clickedEmails = new Set();

    for (const [trackingId, data] of this.trackingData) {
      stats.totalOpens += data.opens.length;
      stats.totalClicks += data.clicks.length;
      
      if (data.opens.length > 0) openedEmails.add(trackingId);
      if (data.clicks.length > 0) clickedEmails.add(trackingId);
      
      // Add recent activity
      data.opens.forEach(open => {
        stats.recentActivity.push({
          type: 'open',
          recipient: data.recipient,
          subject: data.subject,
          timestamp: open.timestamp
        });
      });
      
      data.clicks.forEach(click => {
        stats.recentActivity.push({
          type: 'click',
          recipient: data.recipient,
          subject: data.subject,
          url: click.url,
          timestamp: click.timestamp
        });
      });
    }

    stats.uniqueOpens = openedEmails.size;
    stats.uniqueClicks = clickedEmails.size;
    
    if (stats.totalEmails > 0) {
      stats.openRate = (stats.uniqueOpens / stats.totalEmails) * 100;
      stats.clickRate = (stats.uniqueClicks / stats.totalEmails) * 100;
    }

    // Sort recent activity by timestamp
    stats.recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    stats.recentActivity = stats.recentActivity.slice(0, 50);

    return stats;
  }

  // Generate setup instructions for your domain
  generateDomainSetup() {
    return {
      domain: this.trackingDomain,
      webhookSecret: this.webhookSecret,
      redirectRules: [
        {
          path: '/track/pixel/*',
          action: 'Return 1x1 transparent PNG and POST to webhook URL',
          example: `/track/pixel/abc123.png?webhook=http%3A//localhost%3A${this.localPort}/webhook/open&secret=${this.webhookSecret}`
        },
        {
          path: '/track/click/*',
          action: 'Redirect to original URL and POST to webhook URL',
          example: `/track/click/abc123?url=https%3A//example.com&webhook=http%3A//localhost%3A${this.localPort}/webhook/click&secret=${this.webhookSecret}`
        }
      ],
      instructions: [
        '1. Set up these redirect rules on your domain',
        '2. Use Cloudflare Workers, Netlify Functions, or simple PHP scripts',
        '3. When rules trigger, POST tracking data to your local webhook endpoints',
        '4. Your desktop app receives real-time tracking data',
        '5. No hosting costs - just simple redirects!'
      ]
    };
  }
}

export default DomainDesktopTracker;
