import { sendEmailMailgun } from '../tools/emailMailgun.js';

// Accepts a single object for compatibility with openai-functions agent
export async function sendEmailTool({ to, subject, body, userId }) {
  if (!to || !subject || !body) return 'Missing fields.';
  if (!userId) return 'UserId is required for email tracking - ensure user is authenticated.';
  return await sendEmailMailgun(to, subject, body, true, null, userId);
}
