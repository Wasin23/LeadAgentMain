import { sendEmailMailgun } from './emailMailgun.js';
import AWSManager from '../utils/awsManager.js';

const awsManager = new AWSManager();

/**
 * Fix UTF-8 encoding issues in text
 */
function fixEncoding(text) {
  if (!text) return text;
  try {
    // Common replacements for misencoded UTF-8 characters
    const replacements = {
      '\u00C3\u00A2\u00E2\u0082\u00AC\u00E2\u0084\u00A2': "'",
      '\u00C3\u00A2\u00E2\u0082\u00AC\u00C5\u201C': '"',
      '\u00C3\u00A2\u00E2\u0082\u00AC\u009D': '"',
      '\u00C3\u00A2\u00E2\u0082\u00AC\u201C': '-',
      '\u00C3\u00A2\u00E2\u0082\u00AC\u201D': '-',
      '\u00C3\u00A2\u00E2\u0082\u00AC\u00A2': '•',
      '\u00C3\u00A2\u00E2\u201A\u00AC': '€',
      '\u00C3\u201A\u00C2\u00A0': ' ',
      '\u00C3\u00A9': 'é',
      '\u00C3\u00A8': 'è',
      '\u00C3\u00A0': 'à',
      '\u00C3\u00A7': 'ç',
      '\u00C3\u00AA': 'ê',
      '\u00C3\u00AB': 'ë',
      '\u00C3\u00AE': 'î',
      '\u00C3\u00AF': 'ï',
      '\u00C3\u00B4': 'ô',
      '\u00C3\u00B6': 'ö',
      '\u00C3\u00BB': 'û',
      '\u00C3\u00BC': 'ü',
      '\u00C3\u00B1': 'ñ'
    };
    
    let fixed = text;
    for (const [wrong, right] of Object.entries(replacements)) {
      fixed = fixed.replace(new RegExp(wrong, 'g'), right);
    }
    return fixed;
  } catch (e) {
    console.error('[LEAD EMAIL] Encoding fix failed:', e);
    return text;
  }
}

/**
 * Dedicated email tool for Lead Contact Agent
 * Sends emails via Mailgun with tracking enabled
 * @param {Object} replyOptions - Optional threading options for follow-up emails
 * @param {string} replyOptions.inReplyTo - Message-ID of original email for threading
 * @param {string} replyOptions.references - References header for threading
 * @param {string} replyOptions.threadId - Gmail thread ID for threading
 */
export async function leadEmail(to, subject, body, personInfo = null, userId = null, agentId = null, ccEmails = null, bccEmails = null, senderName = null, replyOptions = null) {
  // Fix encoding issues in subject and body
  subject = fixEncoding(subject);
  body = fixEncoding(body);
  
  console.log('[LEAD EMAIL] Sending email via Mailgun');
  console.log('[LEAD EMAIL] To:', to);
  console.log('[LEAD EMAIL] Subject:', subject);
  console.log('[LEAD EMAIL] Body length:', body?.length || 0);
  console.log('[LEAD EMAIL] Person Info:', personInfo ? `${personInfo.fullName} (${personInfo.currentPosition})` : 'Not provided');
  console.log('[LEAD EMAIL] CC:', ccEmails || 'None');
  console.log('[LEAD EMAIL] BCC:', bccEmails || 'None');
  console.log('[LEAD EMAIL] Sender Name:', senderName || 'Default');
  if (replyOptions) {
    console.log('[LEAD EMAIL] Reply Threading:', replyOptions);
  }
  
  if (!to || !subject || !body) {
    const error = 'Missing required fields: to, subject, or body';
    console.error('[LEAD EMAIL] Error:', error);
    return { success: false, error };
  }
  
  // Check if email is unsubscribed
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
    if (unsubError.name === 'ResourceNotFoundException') {
      console.log('[LEAD EMAIL] Unsubscribe table not found, proceeding with send');
    } else {
      console.error('[LEAD EMAIL] Error checking unsubscribe status, proceeding with send:', unsubError);
    }
  }
  
  try {
    // Get company profile for sender name
    let fromName = senderName;
    if (!fromName && userId) {
      try {
        const userSettings = await awsManager.getUserSettings(userId);
        const companyProfile = userSettings?.companyProfile;
        if (companyProfile?.companyName) {
          fromName = companyProfile.companyName;
          console.log('[LEAD EMAIL] Using company name as sender:', fromName);
        }
      } catch (error) {
        console.warn('[LEAD EMAIL] Could not fetch company profile:', error.message);
      }
    }
    
    // Send via Mailgun with tracking (and optional reply threading)
    console.log('[LEAD EMAIL] Sending via Mailgun...');
    const result = await sendEmailMailgun(to, subject, body, true, personInfo, userId, agentId, ccEmails, bccEmails, fromName, replyOptions);
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

