/**
 * Dedicated email function for Lead Contact Agent
 * Uses correct sender address for reliable delivery
 */
async function sendLeadEmailMailgun(to, subject, body) {
  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = process.env.MAILGUN_DOMAIN;

  if (!mailgunApiKey || !mailgunDomain) {
    throw new Error('Mailgun API key or domain not configured');
  }

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
  
  const formData = new URLSearchParams();
  formData.append('from', `ExaMark <exa.mark@${mailgunDomain}>`); // Use the working sender address
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('text', body);

  try {
    const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('[LEAD EMAIL MAILGUN] ✅ Email sent successfully:', result);
      return { success: true, result };
    } else {
      console.error('[LEAD EMAIL MAILGUN] ❌ Error response:', result);
      return { success: false, error: result.message || 'Unknown error' };
    }
  } catch (error) {
    console.error('[LEAD EMAIL MAILGUN] ❌ Network error:', error);
    return { success: false, error: error.message };
  }
}

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
    const result = await sendLeadEmailMailgun(to, subject, body);
    console.log('[LEAD EMAIL] Mailgun result:', result);
    
    if (result.success) {
      console.log('[LEAD EMAIL] ✅ Email sent successfully');
      return { success: true, result };
    } else {
      console.error('[LEAD EMAIL] ❌ Mailgun returned error:', result);
      return { success: false, error: result.error || 'Unknown error from Mailgun' };
    }
  } catch (error) {
    console.error('[LEAD EMAIL] ❌ Exception occurred:', error);
    return { success: false, error: error.message || error };
  }
}
