import 'dotenv/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { desktopEmailTracker } from '../utils/desktopEmailTracker.js';

console.log('MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY);
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

// Function to log email with enhanced analytics data
async function logEmailToFile(to, subject, body, status, trackingId = null, metadata = {}) {
  try {
    console.log('[EMAIL LOG] Attempting to log email:', { to, subject, body, status, trackingId });
    
    const logEntry = {
      id: trackingId || uuidv4(),
      to,
      subject,
      body,
      status,
      timestamp: new Date().toISOString(),
      personInfo: metadata.personInfo || null, // Store person information
      analytics: {
        opened: false,
        clicked: false,
        replied: false,
        bounced: false,
        unsubscribed: false,
        clickCount: 0,
        openCount: 0,
        lastActivity: null,
        ...metadata
      }
    };

    const logPath = path.join(process.cwd(), 'email_logs.json');
    console.log('[EMAIL LOG] Log path:', logPath);
    
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
      console.log('[EMAIL LOG] Loaded existing logs, count:', logs.length);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
      console.log('[EMAIL LOG] No existing logs found, starting fresh');
      logs = [];
    }
    
    logs.unshift(logEntry); // Add to beginning of array
    
    // Keep only last 500 emails to prevent file from growing too large
    if (logs.length > 500) {
      logs = logs.slice(0, 500);
    }
    
    await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    console.log('[EMAIL LOG] Successfully saved email log entry, total logs:', logs.length);
    
    return logEntry.id; // Return tracking ID
  } catch (error) {
    console.error('[EMAIL LOG] Failed to save log:', error);
    return null;
  }
}

// Function to update email analytics
async function updateEmailAnalytics(trackingId, updates) {
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch (error) {
      console.log('[EMAIL ANALYTICS] No logs found');
      return false;
    }
    
    // Find and update the email entry
    const emailIndex = logs.findIndex(log => log.id === trackingId);
    if (emailIndex !== -1) {
      logs[emailIndex].analytics = {
        ...logs[emailIndex].analytics,
        ...updates,
        lastActivity: new Date().toISOString()
      };
      
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
      console.log('[EMAIL ANALYTICS] Updated analytics for:', trackingId, updates);
      return true;
    } else {
      console.log('[EMAIL ANALYTICS] Email not found:', trackingId);
      return false;
    }
  } catch (error) {
    console.error('[EMAIL ANALYTICS] Failed to update analytics:', error);
    return false;
  }
}

// Function to add tracking links to email body
function addTrackingToEmail(body, trackingId) {
  const trackingDomain = process.env.TRACKING_DOMAIN || 'localhost:8080';
  const protocol = trackingDomain.includes('localhost') ? 'http' : 'https';
  
  // Fix: Don't add protocol if domain already includes it
  let trackingUrl;
  if (trackingDomain.startsWith('http://') || trackingDomain.startsWith('https://')) {
    trackingUrl = `${trackingDomain}/track/open/${trackingId}`;
  } else {
    trackingUrl = `${protocol}://${trackingDomain}/track/open/${trackingId}`;
  }
  
  // Invisible tracking pixel (1x1 transparent PNG - Gmail friendly)
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" border="0" alt="">`;
  
  // Convert links to tracked links
  const trackedBody = body.replace(
    /(https?:\/\/[^\s<>"]+)/gi,
    (match) => {
      if (trackingDomain.startsWith('http://') || trackingDomain.startsWith('https://')) {
        return `${trackingDomain}/track/click/${trackingId}?url=${encodeURIComponent(match)}`;
      } else {
        return `${protocol}://${trackingDomain}/track/click/${trackingId}?url=${encodeURIComponent(match)}`;
      }
    }
  );
  
  // Add tracking pixel at the very end
  return trackedBody + trackingPixel;
}

export { logEmailToFile, updateEmailAnalytics, addTrackingToEmail };

export async function sendEmailMailgun(to, subject, body, enableTracking = true, personInfo = null) {
  try {
    // Ensure we always have HTML content for tracking
    let htmlBody = body;
    
    // If it's plain text, wrap it in basic HTML
    if (!body.includes('<html>') && !body.includes('<body>') && !body.includes('<p>')) {
      htmlBody = `<html><body><p>${body.replace(/\n/g, '<br>')}</p></body></html>`;
    } else {
      // Already HTML, just convert line breaks
      htmlBody = body.replace(/\n/g, '<br>');
    }
    
    let trackingId = null;
    
    // Use desktop email tracker for safe, self-contained tracking
    if (enableTracking) {
      const trackingResult = desktopEmailTracker.injectTracking(htmlBody, to, subject);
      htmlBody = trackingResult.html;
      trackingId = trackingResult.trackingId;
      
      console.log(`[DESKTOP TRACKER] Email tracking injected for ${to} with ID: ${trackingId}`);
    }
    
    // Prepare email data
    const emailData = {
      from: `ExaMark <noreply@${process.env.MAILGUN_DOMAIN}>`,
      'h:Reply-To': 'replies@mg.examarkchat.com',
      to,
      subject: subject,
      html: htmlBody,
      text: body,
      'h:Message-ID': `<tracking-${trackingId || uuidv4()}@${process.env.MAILGUN_DOMAIN}>`,
      'h:X-Tracking-ID': trackingId || 'no-tracking'
    };
    
    // Disable Mailgun's tracking to avoid conflicts
    if (enableTracking) {
      emailData['o:tracking'] = 'no';
      emailData['o:tracking-clicks'] = 'no';
      emailData['o:tracking-opens'] = 'no';
    }
    
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, emailData);

    console.log('[MAILGUN] Sent:', result);
    
    // Log successful email with tracking ID
    const loggedId = await logEmailToFile(to, subject, body, 'sent', trackingId, {
      mailgunId: result.id,
      trackingEnabled: enableTracking,
      desktopTracking: true, // Flag to indicate this uses desktop tracking
      personInfo: personInfo // Include person information in the log
    });
    
    return {
      success: true,
      message: `✅ Email sent to ${to}`,
      trackingId: loggedId
    };
  } catch (err) {
    console.error('[MAILGUN] Failed:', err);
    
    // Log failed email
    await logEmailToFile(to, subject, body, 'failed', null, {
      error: err.message || err.toString()
    });
    
    return {
      success: false,
      message: `❌ Failed: ${err.message || err}`,
      trackingId: null
    };
  }
}
