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

export async function sendEmailMailgun(to, subject, body, enableTracking = true, personInfo = null, userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411') {
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
      const trackingResult = desktopEmailTracker.injectTracking(htmlBody, to, subject, userId);
      htmlBody = trackingResult.html;
      trackingId = trackingResult.trackingId;
      
      console.log(`[DESKTOP TRACKER] Email tracking injected for ${to} with ID: ${trackingId} (User: ${userId})`);
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
      'h:X-Tracking-ID': trackingId || 'no-tracking',
      'o:tag': 'transactional', // Force classification as transactional email
      'o:require-tls': 'yes' // Require TLS for better deliverability
    };
    
    // Disable Mailgun's tracking to avoid conflicts
    if (enableTracking) {
      emailData['o:tracking'] = 'no';
      emailData['o:tracking-clicks'] = 'no';
      emailData['o:tracking-opens'] = 'no';
    }
    
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, emailData);

    console.log('[MAILGUN] Sent:', result);
    
    // Save Message-ID → Tracking-ID mapping for webhook correlation
    if (enableTracking && trackingId && result.id) {
      try {
        const messageId = result.id.replace(/[<>]/g, ''); // Remove angle brackets
        const mappingPath = path.join(process.cwd(), 'message_tracking_map.json');
        
        let mappings = {};
        try {
          const existingMappings = await fs.readFile(mappingPath, 'utf8');
          mappings = JSON.parse(existingMappings);
        } catch (error) {
          // File doesn't exist, start fresh
        }
        
        mappings[messageId] = {
          trackingId: trackingId,
          to: to,
          subject: subject,
          sentAt: new Date().toISOString(),
          source: 'email' // Could be 'manual' or 'lead_agent'
        };
        
        await fs.writeFile(mappingPath, JSON.stringify(mappings, null, 2));
        console.log(`[MAILGUN] Saved Message-ID mapping: ${messageId} → ${trackingId}`);
      } catch (error) {
        console.error('[MAILGUN] Failed to save Message-ID mapping:', error);
      }
    }
    
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

// Send email with custom HTML (for password reset emails)
async function sendEmailMailgunWithCustomHTML(to, subject, textBody, htmlBody, enableTracking = false, personInfo = null, skipLogging = false) {
  try {
    console.log(`[MAILGUN CUSTOM] Sending to: ${to}, Subject: ${subject}`);
    
    let trackingId = null;
    let finalHtmlBody = htmlBody;
    
    // Use desktop email tracker for safe, self-contained tracking
    if (enableTracking) {
      const trackingResult = desktopEmailTracker.injectTracking(htmlBody, to, subject);
      finalHtmlBody = trackingResult.html;
      trackingId = trackingResult.trackingId;
      
      console.log(`[DESKTOP TRACKER] Email tracking injected for ${to} with ID: ${trackingId}`);
    }
    
    // Prepare email data
    const emailData = {
      from: `ExaMark Support <noreply@${process.env.MAILGUN_DOMAIN}>`,
      'h:Reply-To': 'replies@mg.examarkchat.com',
      to,
      subject: subject,
      html: finalHtmlBody,
      text: textBody,
      'h:Message-ID': `<tracking-${trackingId || uuidv4()}@${process.env.MAILGUN_DOMAIN}>`,
      'h:X-Tracking-ID': trackingId || 'no-tracking',
      'o:tag': 'transactional', // Force classification as transactional email
      'o:require-tls': 'yes' // Require TLS for better deliverability
    };
    
    // Disable Mailgun's tracking to avoid conflicts
    if (enableTracking) {
      emailData['o:tracking'] = 'no';
      emailData['o:tracking-clicks'] = 'no';
      emailData['o:tracking-opens'] = 'no';
    }
    
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, emailData);

    console.log('[MAILGUN CUSTOM] Sent:', result);
    
    let loggedId = null;
    
    // Only log if not skipping logging (password reset emails should skip)
    if (!skipLogging) {
      loggedId = await logEmailToFile(to, subject, textBody, 'sent', trackingId, {
        mailgunId: result.id,
        trackingEnabled: enableTracking,
        desktopTracking: enableTracking,
        personInfo: personInfo
      });
    }
    
    return {
      success: true,
      message: `✅ Email sent to ${to}`,
      trackingId: loggedId
    };
  } catch (err) {
    console.error('[MAILGUN CUSTOM] Failed:', err);
    
    // Only log failed emails if not skipping logging
    if (!skipLogging) {
      await logEmailToFile(to, subject, textBody, 'failed', null, {
        error: err.message || err.toString()
      });
    }
    
    return {
      success: false,
      message: `❌ Failed: ${err.message || err}`,
      trackingId: null
    };
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email, resetToken, username) {
  try {
    console.log(`[PASSWORD RESET] Sending reset email to ${email} with token ${resetToken}`);
    
    const subject = 'ExaMark - Password Reset Code';
    
    // Plain text version
    const textBody = `ExaMark - Password Reset Code

Hello ${username || 'there'},

We received a request to reset your password for your ExaMark account.

Enter this code in the app to reset your password: ${resetToken}

This code will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email.`;

    // HTML version (matching the original format)
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #5a67d8; margin: 0;">ExaMark</h1>
          <p style="color: #64748b; margin: 5px 0;">AI-Powered Lead Research & Automation</p>
        </div>
        
        <h2 style="color: #374151;">Password Reset Code</h2>
        
        <p style="color: #4b5563; line-height: 1.6;">
          Hello <strong>${username || 'there'}</strong>,
        </p>
        
        <p style="color: #4b5563; line-height: 1.6;">
          We received a request to reset your password for your ExaMark account.
        </p>
        
        <p style="color: #4b5563; line-height: 1.6;">
          Enter this code in the app to reset your password:
        </p>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px; border: 2px dashed #5a67d8;">
          <div style="font-size: 24px; font-weight: bold; color: #5a67d8; letter-spacing: 3px; font-family: monospace; word-break: break-all; max-width: 100%; overflow-wrap: break-word;">
            ${resetToken}
          </div>
          <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
            Reset Code
          </p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          This code will expire in 1 hour for security reasons.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px;">
          If you didn't request this password reset, you can safely ignore this email.
        </p>
      </div>`;

    // Use the sendEmailMailgun function but with custom HTML - skip logging for password reset
    const result = await sendEmailMailgunWithCustomHTML(email, subject, textBody, htmlBody, false, null, true);
    
    if (result.success) {
      console.log(`[PASSWORD RESET] Reset email sent successfully to ${email}`);
      return true;
    } else {
      console.error(`[PASSWORD RESET] Failed to send reset email: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error('[PASSWORD RESET] Error sending reset email:', error);
    return false;
  }
}
