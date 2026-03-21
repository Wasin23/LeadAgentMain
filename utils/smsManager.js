/**
 * SMS notifications via Twilio REST API.
 * No npm SDK needed — uses Node.js native fetch.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (E.164 format, e.g. +15551234567)
 */

/**
 * Send an SMS message.
 * @param {string} to     - Recipient phone number in E.164 format (e.g. +15551234567)
 * @param {string} body   - Message body (max 1600 chars; Twilio splits >160)
 * @returns {Promise<{ success: boolean, sid?: string, error?: string }>}
 */
export async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.warn('[SMS] Twilio credentials not configured — skipping send');
    return { success: false, reason: 'not_configured' };
  }

  const url     = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const authB64 = Buffer.from(`${sid}:${token}`).toString('base64');
  const payload = new URLSearchParams({ From: from, To: to, Body: body }).toString();

  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization':  `Basic ${authB64}`,
        'Content-Type':   'application/x-www-form-urlencoded',
      },
      body: payload,
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`[SMS] Twilio error ${resp.status}:`, data.message || data.code || JSON.stringify(data));
      return { success: false, error: data.message || `HTTP ${resp.status}` };
    }

    console.log(`[SMS] ✅ Sent to ${to} — SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (err) {
    console.error('[SMS] Failed to send:', err.message);
    return { success: false, error: err.message };
  }
}
