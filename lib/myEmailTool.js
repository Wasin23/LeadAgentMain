import { sendEmailMailgun } from '../tools/emailMailgun.js';

// Accepts a single object for compatibility with openai-functions agent
export async function sendEmailTool({ to, subject, body }) {
  if (!to || !subject || !body) return 'Missing fields.';
  return await sendEmailMailgun(to, subject, body);
}
