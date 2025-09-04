import { sendEmailMailgun } from './emailMailgun.js';

/**
 * Dedicated email tool for Lead Contact Agent
 * Handles email sending specifically for automated lead outreach
 * Separated from general email functionality to prevent interference
 */
export async function leadEmail(to, subject, body) {
  console.log('[LEAD EMAIL] Sending email via dedicated lead email tool');
  console.log('[LEAD EMAIL] To:', to);
  console.log('[LEAD EMAIL] Subject:', subject);
  console.log('[LEAD EMAIL] Body length:', body?.length || 0);
  
  if (!to || !subject || !body) {
    const error = 'Missing required fields: to, subject, or body';
    console.error('[LEAD EMAIL] Error:', error);
    return { success: false, error };
  }
  
  try {
    // Use the tracking-enabled email function
    const result = await sendEmailMailgun(to, subject, body, true);
    console.log('[LEAD EMAIL] Mailgun result:', result);
    
    if (result.success) {
      console.log('[LEAD EMAIL] ✅ Email sent successfully with tracking');
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
