import 'dotenv/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AWSManager from '../utils/awsManager.js';
import GmailManager from '../utils/gmailManager.js';
import OutlookManager from '../utils/outlookManager.js';

// Initialize AWS Manager for API usage tracking
const awsManager = new AWSManager();
const gmailManager = new GmailManager();
const outlookManager = new OutlookManager();

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
  // Using disguised path /r/ instead of /api/tracking/open/ to bypass corporate filters
  let trackingUrl;
  if (trackingDomain.startsWith('http://') || trackingDomain.startsWith('https://')) {
    trackingUrl = `${trackingDomain}/r/${trackingId}.gif`;
  } else {
    trackingUrl = `${protocol}://${trackingDomain}/r/${trackingId}.gif`;
  }
  
  console.log('🎯 [TRACKING PIXEL] Injecting tracking pixel into email');
  console.log('📍 Tracking URL:', trackingUrl);
  console.log('🔑 Tracking ID:', trackingId);
  
  // Invisible tracking pixel (1x1 transparent - Outlook/Gmail friendly)
  // Using multiple hiding techniques for max compatibility
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" alt="" />`;
  console.log('🖼️  Tracking pixel HTML:', trackingPixel);
  
  // Convert links to tracked links - but SKIP URLs already inside href="..." or src="..."
  // so that company website links, logo images, etc. are not overwritten by the tracking redirect
  // Using disguised path /c/ instead of /api/tracking/click/ to bypass corporate filters
  const trackedBody = body.replace(
    /(?<!(?:href|src)=["'])(https?:\/\/[^\s<>"]+)/gi,
    (match) => {
      if (trackingDomain.startsWith('http://') || trackingDomain.startsWith('https://')) {
        return `${trackingDomain}/c/${trackingId}?u=${encodeURIComponent(match)}`;
      } else {
        return `${protocol}://${trackingDomain}/c/${trackingId}?u=${encodeURIComponent(match)}`;
      }
    }
  );
  
  // Add tracking pixel at the very end
  const finalBody = trackedBody + trackingPixel;
  console.log('✅ [TRACKING PIXEL] Pixel injected at end of email body');
  console.log('📏 Final body length:', finalBody.length);
  console.log('🔍 Body includes tracking pixel?', finalBody.includes(trackingUrl));
  
  return finalBody;
}

// Function to build email signature with company logo
async function buildEmailSignature(userId, userSettings) {
  try {
    let signature = '';
    
    // Get company profile to access the logo (automatically inject if available)
    const companyProfile = userSettings?.companyProfile;
    
    if (companyProfile?.logo) {
      console.log(`✅ [EMAIL SIGNATURE] Adding company logo for user ${userId}`);
      
      // Use companyWebsite first (correct field name), fall back to legacy .website
      const sigWebsite = companyProfile.companyWebsite || companyProfile.website || '';
      const sigWebsiteDisplay = sigWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
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
                ${sigWebsiteDisplay ? `<div style="font-size: 12px;"><a href="${sigWebsite}" style="color: #2563eb; text-decoration: none;">${sigWebsiteDisplay}</a></div>` : ''}
                ${companyProfile.email ? `<div style="font-size: 12px; color: #6b7280;">${companyProfile.email}</div>` : ''}
                ${companyProfile.phone ? `<div style="font-size: 12px; color: #6b7280;">${companyProfile.phone}</div>` : ''}
                ${companyProfile.companyAddress ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${companyProfile.companyAddress}</div>` : ''}
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

export async function sendEmailMailgun(to, subject, body, enableTracking = true, personInfo = null, userId, agentId = null, ccEmails = null, bccEmails = null, senderName = null, replyOptions = null) {
  // replyOptions: { inReplyTo: string, references: string, threadId: string } - for threading follow-up emails
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📧 [SEND EMAIL MAILGUN] Function called with:');
    console.log('📧 to:', to);
    console.log('📧 subject:', subject);
    console.log('📧 enableTracking:', enableTracking);
    console.log('📧 userId:', userId);
    console.log('📧 agentId:', agentId);
    if (replyOptions) {
      console.log('📧 replyOptions (threading):', replyOptions);
    }
    console.log('═══════════════════════════════════════════════════════════════');
    
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
    // IMPORTANT: Generate tracking ID and inject pixel BEFORE checking Gmail routing
    // so that Gmail emails also get the tracking pixel
    if (enableTracking) {
      trackingId = `tracking-${userId}_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('🎯 [TRACKING] Tracking enabled! Injecting tracking pixel...');
      console.log('🎯 [TRACKING] Generated tracking ID:', trackingId);
      console.log('🎯 [TRACKING] About to call addTrackingToEmail()');
      console.log('═══════════════════════════════════════════════════════════════');
      
      htmlBody = addTrackingToEmail(htmlBody, trackingId);
      
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('🎯 [TRACKING] addTrackingToEmail() completed');
      console.log('🎯 [TRACKING] htmlBody length after tracking:', htmlBody.length);
      console.log('🎯 [TRACKING] htmlBody contains tracking ID?', htmlBody.includes(trackingId));
      console.log('🎯 [TRACKING] Tracking pixel injected BEFORE Gmail/Mailgun routing');
      console.log('═══════════════════════════════════════════════════════════════');
      
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
        let useOutlookForAgent = false;
        if (agentId) {
          const agentSettings = await awsManager.getAgentSettings(userId, agentId);
          useGmailForAgent = agentSettings?.emailBuilder?.useGmail === true;
          useOutlookForAgent = agentSettings?.emailBuilder?.useOutlook === true;
          console.log(`[EMAIL ROUTING] Agent ${agentId} useGmail setting:`, useGmailForAgent);
          console.log(`[EMAIL ROUTING] Agent ${agentId} useOutlook setting:`, useOutlookForAgent);
        } else {
          // No agentId (orphaned email or manual send) - check if user has active Gmail/Outlook account
          // If they have either connected and active, assume they want to use it for orphaned emails
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('🏴 [EMAIL ROUTING] ORPHANED EMAIL DETECTED - No agentId provided');
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('📧 Checking user email accounts for fallback routing...');
          console.log('👤 User ID:', userId);
          console.log('📬 Gmail accounts:', userSettings?.gmailAccounts?.map(acc => ({
            email: acc.email,
            isActive: acc.isActive,
            hasToken: !!acc.refreshToken
          })));
          console.log('📬 Outlook accounts:', userSettings?.outlookAccounts?.map(acc => ({
            email: acc.email,
            hasToken: !!acc.refreshToken
          })));
          
          const hasActiveGmailAccount = userSettings?.gmailAccounts?.some(acc => acc.isActive && acc.refreshToken);
          const hasActiveOutlookAccount = userSettings?.outlookAccounts?.some(acc => acc.refreshToken);
          useGmailForAgent = hasActiveGmailAccount || false;
          useOutlookForAgent = hasActiveOutlookAccount || false;
          
          console.log('✅ Has active Gmail account?', hasActiveGmailAccount);
          console.log('✅ Has active Outlook account?', hasActiveOutlookAccount);
          console.log('🎯 Will use Gmail for orphaned email?', useGmailForAgent);
          console.log('🎯 Will use Outlook for orphaned email?', useOutlookForAgent);
          console.log('═══════════════════════════════════════════════════════════════\n');
        }
        
        // Debug: Log what Gmail-related data we have for this user
        console.log(`🔍 [DEBUG GMAIL TOKENS] userId: ${userId}`);
        console.log(`🔍 [DEBUG GMAIL TOKENS] Has gmailAuth?`, !!userSettings?.gmailAuth);
        console.log(`🔍 [DEBUG GMAIL TOKENS] gmailAuth.refreshToken?`, !!userSettings?.gmailAuth?.refreshToken);
        console.log(`🔍 [DEBUG GMAIL TOKENS] gmailAuth.email?`, userSettings?.gmailAuth?.email);
        console.log(`🔍 [DEBUG GMAIL TOKENS] Has gmailAccounts?`, !!userSettings?.gmailAccounts);
        console.log(`🔍 [DEBUG GMAIL TOKENS] gmailAccounts length:`, userSettings?.gmailAccounts?.length || 0);
        console.log(`🔍 [DEBUG GMAIL TOKENS] gmailAccounts:`, userSettings?.gmailAccounts?.map(acc => ({ email: acc.email, hasToken: !!acc.refreshToken, isActive: acc.isActive })));
        console.log(`🔍 [DEBUG GMAIL TOKENS] Has calendarTokens?`, !!userSettings?.calendarTokens);
        console.log(`🔍 [DEBUG GMAIL TOKENS] calendarTokens.refresh_token?`, !!userSettings?.calendarTokens?.refresh_token);
        console.log(`🔍 [DEBUG GMAIL TOKENS] calendarTokens.scope?`, userSettings?.calendarTokens?.scope);
        
        // Check if Gmail is connected (legacy gmailAuth, new gmailAccounts array, or calendar tokens with Gmail scopes)
        const hasGmailTokens = userSettings?.gmailAuth?.refreshToken || 
                              (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) ||
                              (userSettings?.calendarTokens?.refresh_token && 
                               userSettings?.calendarTokens?.scope?.includes('gmail'));
        
        // Check if Outlook is connected
        const hasOutlookTokens = userSettings?.outlookAccounts && userSettings.outlookAccounts.length > 0;
        
        console.log(`🔍 [DEBUG GMAIL TOKENS] Final hasGmailTokens result:`, hasGmailTokens);
        console.log(`🔍 [DEBUG OUTLOOK TOKENS] Final hasOutlookTokens result:`, hasOutlookTokens);
        console.log(`🔍 [DEBUG GMAIL TOKENS] useGmailForAgent:`, useGmailForAgent);
        console.log(`🔍 [DEBUG OUTLOOK TOKENS] useOutlookForAgent:`, useOutlookForAgent);
        console.log(`🔍 [DEBUG GMAIL TOKENS] Both conditions met (will use Gmail)?`, hasGmailTokens && useGmailForAgent);
        console.log(`🔍 [DEBUG OUTLOOK TOKENS] Both conditions met (will use Outlook)?`, hasOutlookTokens && useOutlookForAgent);
        
        // Try Outlook first if configured for this agent
        if (hasOutlookTokens && useOutlookForAgent) {
          gmailConnected = true; // Using this flag for "external email provider" (not Mailgun)
          console.log(`✅ [EMAIL ROUTING] Outlook enabled for agent ${agentId} - will use Outlook API`);
          
          try {
            const outlookResult = await outlookManager.sendEmail({
              userId,
              to,
              subject,
              htmlBody,
              textBody: body,
              ccEmails,
              bccEmails,
              replyTo: null,
              trackingId: trackingId,
              inReplyTo: replyOptions?.inReplyTo || null,
              threadId: replyOptions?.threadId || null
            });
            
            console.log(`✅ [OUTLOOK] Email sent successfully from ${outlookResult.fromEmail}`);
            console.log(`🚀 [EMAIL ROUTING] Outlook send complete - exiting function, NOT sending via Mailgun`);
            
            return {
              success: true,
              messageId: outlookResult.messageId,
              threadId: outlookResult.threadId,
              trackingId: trackingId,
              provider: 'outlook',
              sentFrom: outlookResult.fromEmail
            };
          } catch (outlookError) {
            console.error('❌ [OUTLOOK] Failed to send via Outlook:', outlookError.message);
            console.log('⚠️  [EMAIL ROUTING] Falling back to Gmail or Mailgun...');
            gmailConnected = false;
          }
        }
        
        // Try Gmail if Outlook not available/failed
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
              replyTo: null,
              trackingId: trackingId,
              // Threading options for follow-up emails (send as reply)
              inReplyTo: replyOptions?.inReplyTo || null,
              references: replyOptions?.references || null,
              threadId: replyOptions?.threadId || null
            });
            
            // Get the email address for logging
            const gmailEmail = userSettings?.gmailAuth?.email || 
                              gmailResult.sentFrom || 
                              'gmail';
            
            console.log(`✅ [GMAIL] Email sent successfully from ${gmailEmail}`);
            console.log(`✅ [GMAIL] Email will appear in user's Gmail Sent folder`);
            console.log(`🚀 [EMAIL ROUTING] Gmail send complete - exiting function, NOT sending via Mailgun`);
            
            // Note: Gmail emails are already tracked via the tracking pixel in the email body
            // No need for separate AWS tracking call here
            
            return {
              success: true,
              messageId: gmailResult.messageId,
              threadId: gmailResult.threadId, // Return threadId for reply threading
              trackingId: trackingId,
              provider: 'gmail',
              sentFrom: gmailEmail
            };
          } catch (gmailError) {
            console.error('❌ [GMAIL] Failed to send via Gmail:', gmailError.message);
            console.error('❌ [GMAIL] Error details:', gmailError);
            console.log('⚠️ [EMAIL ROUTING] Falling back to Mailgun...');
            // Continue to Mailgun fallback below
            gmailConnected = false; // Fallback to Mailgun
          }
        }
      } catch (err) {
        console.log('⚠️ [EMAIL ROUTING] Could not fetch user settings:', err.message);
        gmailConnected = false; // Ensure we fallback to Mailgun on error
      }
    }
    
    // CRITICAL: Only send via Mailgun if Gmail was NOT used successfully
    if (gmailConnected) {
      console.error(`🚨 [EMAIL ROUTING] CRITICAL ERROR: gmailConnected=true but code reached Mailgun section! This should never happen!`);
      throw new Error('Email routing error: Gmail was successful but Mailgun was also attempted');
    }
    
    console.log(`📧 [EMAIL ROUTING] Using Mailgun for delivery (Gmail not enabled or failed)`);
    console.log(`🔧 [DEBUG] Preparing Mailgun email data. gmailConnected=${gmailConnected}`);
    
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
    
    // Add threading headers for follow-up emails (send as reply to original thread)
    if (replyOptions?.inReplyTo) {
      emailData['h:In-Reply-To'] = replyOptions.inReplyTo;
      console.log(`[MAILGUN] Adding In-Reply-To header for threading: ${replyOptions.inReplyTo}`);
    }
    if (replyOptions?.references) {
      emailData['h:References'] = replyOptions.references;
      console.log(`[MAILGUN] Adding References header for threading: ${replyOptions.references}`);
    }
    
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
      trackingId: loggedId,
      fromAccount: fromEmail,
      sentFrom: fromEmail
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
      trackingId: loggedId,
      fromAccount: fromEmail,
      sentFrom: fromEmail
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
