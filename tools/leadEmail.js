import { sendEmailMailgun } from './emailMailgun.js';

/**
 * Dedicated email tool for Lead Contact Agent
 * Handles email sending specifically for automated lead outreach
 * Separated from general email functionality to prevent interference
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
  
  try {
    // Use the tracking-enabled email function with person info, userId, agentId, ccEmails, bccEmails, and senderName
    const result = await sendEmailMailgun(to, subject, body, true, personInfo, userId, agentId, ccEmails, bccEmails, senderName);
    console.log('[LEAD EMAIL] Mailgun result:', result);
    
    if (result.success) {
      console.log('[LEAD EMAIL] ✅ Email sent successfully with tracking and person info');
      return { success: true, result };
    } else {
      console.error('[LEAD EMAIL] ❌ Mailgun returned error:', result);
      return { success: false, error: result.message || 'Email sending failed' };
    }
  } catch (error) {
    console.error('[LEAD EMAIL] ❌ Exception occurred:', error);
    return { success: false, error: error.message || error };
  }
}
