import 'dotenv/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
  const trackingPixel = `<img src="${protocol}://${trackingDomain}/track/open/${trackingId}" width="1" height="1" style="display:none;" />`;
  
  // Convert links to tracked links
  const trackedBody = body.replace(
    /(https?:\/\/[^\s<>"]+)/gi,
    `${protocol}://${trackingDomain}/track/click/${trackingId}?url=$1`
  );
  
  // Add tracking pixel (for HTML emails)
  return trackedBody + '\n\n' + trackingPixel;
}

export { logEmailToFile, updateEmailAnalytics, addTrackingToEmail };

export async function sendEmailMailgun(to, subject, body, enableTracking = true) {
  try {
    const trackingId = uuidv4();
    let finalBody = body;
    
    // Add tracking if enabled
    if (enableTracking) {
      finalBody = addTrackingToEmail(body, trackingId);
    }
    
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `ExaMark <mailgun@${process.env.MAILGUN_DOMAIN}>`,
      to,
      subject,
      html: finalBody, // Use HTML to support tracking pixel
      text: body // Keep original as text version
    });

    console.log('[MAILGUN] Sent:', result);
    
    // Log successful email with tracking ID
    const loggedId = await logEmailToFile(to, subject, body, 'sent', trackingId, {
      mailgunId: result.id,
      trackingEnabled: enableTracking
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
