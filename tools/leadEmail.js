import { sendEmailMailgun } from './emailMailgun.js';
import AWSManager from '../utils/awsManager.js';
import GmailManager from '../utils/gmailManager.js';

const awsManager = new AWSManager();
const gmailManager = new GmailManager();

/**
 * Dedicated email tool for Lead Contact Agent
 * Handles email sending specifically for automated lead outreach
 * Prioritizes Gmail OAuth when available, falls back to Mailgun
 */
export async function leadEmail(to, subject, body, personInfo = null, userId = null, agentId = null, ccEmails = null, bccEmails = null, senderName = null) {
  console.log('[LEAD EMAIL] Sending email via dedicated lead email tool');
  console.log('[LEAD EMAIL] To:', to);
  console.log('[LEAD EMAIL] Subject:', subject);
  console.log('[LEAD EMAIL] Body length:', body?.length || 0);
  console.log('[LEAD EMAIL] Person Info:', personInfo ? `${personInfo.fullName} (${personInfo.currentPosition})` : 'Not provided');
  console.log('[LEAD EMAIL] CC:', ccEmails || 'None');
  console.log('[LEAD EMAIL] BCC:', bccEmails || 'None');
  console.log('[LEAD EMAIL] Sender Name:', senderName || 'Default (Meridian)');
  
  if (!to || !subject || !body) {
    const error = 'Missing required fields: to, subject, or body';
    console.error('[LEAD EMAIL] Error:', error);
    return { success: false, error };
  }
  
  // Check if email is unsubscribed (skip if table doesn't exist)
  try {
    const isUnsubscribed = await awsManager.isUnsubscribed(to);
    if (isUnsubscribed) {
      console.warn(`🚫 [LEAD EMAIL] Email address is unsubscribed: ${to}`);
      return { 
        success: false, 
        error: 'Email address has unsubscribed',
        skipped: true,
        reason: 'unsubscribed'
      };
    }
  } catch (unsubError) {
    // If table doesn't exist, just proceed with sending
    if (unsubError.name === 'ResourceNotFoundException') {
      console.log('[LEAD EMAIL] Unsubscribe table not found, proceeding with send');
    } else {
      console.error('[LEAD EMAIL] Error checking unsubscribe status, proceeding with send:', unsubError);
    }
  }
  
  try {
    // Try Gmail first if user has it connected
    if (userId) {
      try {
        console.log('[LEAD EMAIL] Attempting to send via Gmail OAuth...');
        
        // Prepare HTML body
        let htmlBody = body;
        if (!body.includes('<html>') && !body.includes('<body>') && !body.includes('<p>')) {
          htmlBody = `<html><body><p>${body.replace(/\n/g, '<br>')}</p></body></html>`;
        } else {
          htmlBody = body.replace(/\n/g, '<br>');
        }
        
        const gmailResult = await gmailManager.sendEmail({
          userId,
          to,
          subject,
          htmlBody: htmlBody,
          textBody: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
          ccEmails,
          bccEmails,
          replyTo: null,
          agentId: agentId, // Pass agentId for tracking
          enableTracking: true // Enable open/reply tracking
        });
        
        if (gmailResult.success) {
          console.log('[LEAD EMAIL] ✅ Email sent successfully via Gmail OAuth from:', gmailResult.fromAccount);
          return { 
            success: true, 
            result: { 
              ...gmailResult, 
              mailgunId: gmailResult.messageId,
              fromAccount: gmailResult.fromAccount 
            }, 
            method: 'gmail' 
          };
        }
      } catch (gmailError) {
        console.warn('[LEAD EMAIL] Gmail send failed, falling back to Mailgun:', gmailError.message);
      }
    }
    
    // Fallback to Mailgun with tracking
    console.log('[LEAD EMAIL] Sending via Mailgun fallback...');
    const result = await sendEmailMailgun(to, subject, body, true, personInfo, userId, agentId, ccEmails, bccEmails, senderName);
    console.log('[LEAD EMAIL] Mailgun result:', result);
    
    if (result.success) {
      console.log('[LEAD EMAIL] ✅ Email sent successfully via Mailgun');
      return { success: true, result, method: 'mailgun' };
    } else {
      console.error('[LEAD EMAIL] ❌ Mailgun returned error:', result);
      return { success: false, error: result.message || 'Email sending failed' };
    }
  } catch (error) {
    console.error('[LEAD EMAIL] ❌ Exception occurred:', error);
    return { success: false, error: error.message || error };
  }
}

