import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

export async function sendEmail({ to, subject, text, from }) {
  try {
    const data = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: from || `Mailgun Sandbox <mailgun@${process.env.MAILGUN_DOMAIN}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    });
    console.log('[MAILGUN] Sent:', data);
    return data;
  } catch (error) {
    console.error('[MAILGUN] Failed:', error);
    return error;
  }
}
