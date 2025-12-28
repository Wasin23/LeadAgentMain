import 'dotenv/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AWSManager from '../utils/awsManager.js';
import GmailManager from '../utils/gmailManager.js';

// Initialize AWS Manager for API usage tracking
const awsManager = new AWSManager();
const gmailManager = new GmailManager();

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

// Function to log email with enhanced analytics data
async function logEmailToFile(to, subject, body, status, trackingId = null, metadata = {}, userId = null, agentId = null) {
  try {
    console.log('[EMAIL LOG] Attempting to log email:', { to, subject, body, status, trackingId, userId });
    
    const logEntry = {
      id: trackingId || uuidv4(),
      to,
      subject,
      body,
      status,
      timestamp: new Date().toISOString(),
      personInfo: metadata.personInfo || null, // Store person information
      userId: userId, // Store user ID for tracking
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

    // Email logging to JSON files is now disabled - using AWS DynamoDB instead
    console.log('[EMAIL LOG] Email tracking now handled by AWS DynamoDB, skipping JSON file creation');
    
    return logEntry.id; // Return tracking ID
  } catch (error) {
    console.error('[EMAIL LOG] Failed to save log:', error);
    return null;
  }
}

// Function to update email analytics
async function updateEmailAnalytics(trackingId, updates) {
  // Email analytics updates now handled by AWS DynamoDB via desktopEmailTracker
  console.log('[EMAIL ANALYTICS] Analytics updates now handled by AWS DynamoDB, skipping JSON file updates');
  return false;
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

// Function to build email signature with company logo
async function buildEmailSignature(userId, userSettings) {
  try {
    let signature = '';
    
    // Get company profile to access the logo (automatically inject if available)
    const companyProfile = userSettings?.companyProfile;
    
    if (companyProfile?.logo) {
      console.log(`✅ [EMAIL SIGNATURE] Adding company logo for user ${userId}`);
      
      // Build signature HTML with logo
      signature = `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-family: Arial, sans-serif;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right: 15px; vertical-align: top;">
                <img src="${companyProfile.logo}" alt="${companyProfile.companyName || 'Company'} Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: contain;" />
              </td>
              <td style="vertical-align: top;">
                <div style="font-size: 14px; color: #111827; font-weight: 600; margin-bottom: 4px;">
                  ${companyProfile.companyName || ''}
                </div>
                ${companyProfile.tagline ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${companyProfile.tagline}</div>` : ''}
                ${companyProfile.website ? `<div style="font-size: 12px;"><a href="${companyProfile.website}" style="color: #2563eb; text-decoration: none;">${companyProfile.website}</a></div>` : ''}
                ${companyProfile.email ? `<div style="font-size: 12px; color: #6b7280;">${companyProfile.email}</div>` : ''}
                ${companyProfile.phone ? `<div style="font-size: 12px; color: #6b7280;">${companyProfile.phone}</div>` : ''}
              </td>
            </tr>
          </table>
        </div>
      `;
    }
    
    // Add custom signature if provided (appends after logo)
    if (userSettings?.emailSettings?.signature) {
      signature += `
        <div style="margin-top: 15px; font-family: Arial, sans-serif; font-size: 13px; color: #374151;">
          ${userSettings.emailSettings.signature.replace(/\n/g, '<br>')}
        </div>
      `;
    }
    
    return signature;
  } catch (error) {
    console.error('❌ [EMAIL SIGNATURE] Error building signature:', error);
    return '';
  }
}

export { logEmailToFile, updateEmailAnalytics, addTrackingToEmail, buildEmailSignature };

export async function sendEmailMailgun(to, subject, body, enableTracking = true, personInfo = null, userId, agentId = null, ccEmails = null, bccEmails = null, senderName = null) {
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
    
    // Use new AWS-based tracking system with DynamoDB
    if (enableTracking) {
      trackingId = `tracking-${userId}_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      htmlBody = addTrackingToEmail(htmlBody, trackingId);
      
      console.log(`✅ [AWS TRACKING] Email tracking injected for ${to} with ID: ${trackingId} (User: ${userId}, Agent: ${agentId})`);
    }
    
    // Use custom sender name if provided, otherwise default to "Meridian"
    const fromName = senderName || 'Meridian';
    
    // Fetch user's settings from AWS if userId provided
    let userSettings = null;
    let gmailConnected = false;
    
    if (userId) {
      try {
        userSettings = await awsManager.getUserSettings(userId);
        
        // Build email signature with company logo
        const emailSignature = await buildEmailSignature(userId, userSettings);
        if (emailSignature) {
          // Inject signature before closing body tag, or append if no body tag
          if (htmlBody.includes('</body>')) {
            htmlBody = htmlBody.replace('</body>', `${emailSignature}</body>`);
          } else {
            htmlBody += emailSignature;
          }
          console.log(`✅ [EMAIL SIGNATURE] Signature with logo injected into email`);
        }
        
        // Check if Gmail is connected and agent has Gmail enabled
        let useGmailForAgent = false;
        if (agentId) {
          const agentSettings = await awsManager.getAgentSettings(userId, agentId);
          useGmailForAgent = agentSettings?.emailBuilder?.useGmail === true;
          console.log(`[EMAIL ROUTING] Agent ${agentId} useGmail setting:`, useGmailForAgent);
        }
        
        // Check if Gmail is connected (either legacy or new calendar tokens with Gmail scopes)
        const hasGmailTokens = userSettings?.gmailAuth?.refreshToken || 
                              (userSettings?.calendarTokens?.refresh_token && 
                               userSettings?.calendarTokens?.scope?.includes('gmail'));
        
        if (hasGmailTokens && useGmailForAgent) {
          gmailConnected = true;
          console.log(`✅ [EMAIL ROUTING] Gmail enabled for agent ${agentId} - will use Gmail API`);
          
          // Use Gmail to send the email
          try {
            const gmailResult = await gmailManager.sendEmail({
              userId,
              to,
              subject,
              htmlBody,
              textBody: body,
              ccEmails,
              bccEmails,
              replyTo: null
            });
            
            // Log email to AWS tracking
            if (enableTracking && trackingId) {
              await awsManager.trackEmail({
                trackingId,
                userId,
                agentId,
                to,
                subject,
                body: htmlBody,
                status: 'sent',
                provider: 'gmail',
                metadata: {
                  messageId: gmailResult.messageId,
                  sentFrom: userSettings.gmailAuth.email,
                  personInfo: to
                }
              });
              console.log(`✅ [AWS TRACKING] Email tracked with ID: ${trackingId}`);
            }
            
            console.log(`✅ [GMAIL] Email sent successfully from ${userSettings.gmailAuth.email}`);
            console.log(`✅ [GMAIL] Email will appear in user's Gmail Sent folder`);
            
            return {
              success: true,
              messageId: gmailResult.messageId,
              trackingId: trackingId,
              provider: 'gmail',
              sentFrom: userSettings.gmailAuth.email
            };
          } catch (gmailError) {
            console.error('❌ [GMAIL] Failed to send via Gmail:', gmailError.message);
            console.log('⚠️ [EMAIL ROUTING] Falling back to Mailgun...');
            // Continue to Mailgun fallback below
            gmailConnected = false; // Fallback to Mailgun
          }
        }
      } catch (err) {
        console.log('⚠️ [EMAIL ROUTING] Could not fetch user settings:', err.message);
      }
    }
    
    // If Gmail not connected or failed, use Mailgun
    if (!gmailConnected) {
      console.log(`📧 [EMAIL ROUTING] Using Mailgun for delivery`);
    }
    
    // Fetch custom domain settings for Mailgun
    let fromDomain = process.env.MAILGUN_DOMAIN;
    let fromEmail = `replies@${fromDomain}`;
    let replyToEmail = `replies@${fromDomain}`;
    
    if (userId) {
      try {
        userSettings = await awsManager.getUserSettings(userId);
        if (userSettings?.emailSettings?.customDomain && 
            userSettings?.emailSettings?.domainVerified && 
            userSettings?.emailSettings?.fromEmail) {
          // Use custom domain and email if verified
          fromEmail = userSettings.emailSettings.fromEmail;
          fromDomain = userSettings.emailSettings.customDomain;
          if (userSettings.emailSettings.replyTo) {
            replyToEmail = userSettings.emailSettings.replyTo;
          }
          console.log(`📧 [MAILGUN] Using custom domain email: ${fromEmail}`);
        }
      } catch (err) {
        console.log('⚠️ [MAILGUN] Could not fetch custom domain, using default:', err.message);
      }
    }
    
    // Prepare email data
    const emailData = {
      from: `${fromName} <${fromEmail}>`,
      'h:Reply-To': replyToEmail,
      to,
      subject: subject,
      html: htmlBody,
      text: body,
      'h:Message-ID': `<tracking-${trackingId || uuidv4()}@${fromDomain}>`,
      'h:X-Tracking-ID': trackingId || 'no-tracking',
      'o:tag': 'transactional', // Force classification as transactional email
      'o:require-tls': 'yes' // Require TLS for better deliverability
    };
    
    // Add CC if provided
    if (ccEmails) {
      emailData.cc = ccEmails;
      console.log(`[MAILGUN] Adding CC: ${ccEmails}`);
    }
    
    // Add BCC if provided
    if (bccEmails) {
      emailData.bcc = bccEmails;
      console.log(`[MAILGUN] Adding BCC: ${bccEmails}`);
    }
    
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
    }, userId, agentId);
    
    // Log Mailgun API usage
    if (userId && agentId) {
      try {
        await awsManager.logApiUsage({
          userId: userId,
          agentId: agentId,
          service: 'mailgun',
          operation: 'send_email',
          usage: 1,
          metadata: {
            to: to,
            trackingId: trackingId,
            timestamp: new Date().toISOString()
          }
        });
        console.log('[MAILGUN] API usage logged');
      } catch (logError) {
        console.error('[MAILGUN] Failed to log API usage:', logError);
      }
    }
    
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
    }, userId, agentId);
    
    return {
      success: false,
      message: `❌ Failed: ${err.message || err}`,
      trackingId: null
    };
  }
}

// Send email with custom HTML (for password reset emails)
async function sendEmailMailgunWithCustomHTML(to, subject, textBody, htmlBody, enableTracking = false, personInfo = null, skipLogging = false, userId = null, agentId = null, senderName = null) {
  try {
    console.log(`[MAILGUN CUSTOM] Sending to: ${to}, Subject: ${subject}`);
    
    let trackingId = null;
    let finalHtmlBody = htmlBody;
    
    // Use desktop email tracker for safe, self-contained tracking
    if (enableTracking && userId) {
      const trackingResult = desktopEmailTracker.injectTracking(htmlBody, to, subject, userId, agentId);
      finalHtmlBody = trackingResult.html;
      trackingId = trackingResult.trackingId;
      
      console.log(`[DESKTOP TRACKER] Email tracking injected for ${to} with ID: ${trackingId}`);
    }
    
    // Use custom sender name if provided, otherwise default to "Meridian Support"
    const fromName = senderName || 'Meridian Support';
    
    // Prepare email data
    const emailData = {
      from: `${fromName} <noreply@${process.env.MAILGUN_DOMAIN}>`,
      'h:Reply-To': 'replies@mg.meridianagent.xyz',
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
      }, userId, agentId);
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
      }, userId, agentId);
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
    
    const subject = 'Meridian - Password Reset Code';
    
    // Plain text version
    const textBody = `Meridian - Password Reset Code

Hello ${username || 'there'},

We received a request to reset your password for your Meridian account.

Enter this code in the app to reset your password: ${resetToken}

This code will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email.`;

    // HTML version (matching the original format)
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #5a67d8; margin: 0;">Meridian</h1>
          <p style="color: #64748b; margin: 5px 0;">AI-Powered Lead Research & Automation</p>
        </div>
        
        <h2 style="color: #374151;">Password Reset Code</h2>
        
        <p style="color: #4b5563; line-height: 1.6;">
          Hello <strong>${username || 'there'}</strong>,
        </p>
        
        <p style="color: #4b5563; line-height: 1.6;">
          We received a request to reset your password for your Meridian account.
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
