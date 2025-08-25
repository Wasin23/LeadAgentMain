import 'dotenv/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import fs from 'fs/promises';
import path from 'path';

console.log('MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY);
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

// Function to log email to JSON file
async function logEmailToFile(to, subject, body, status) {
  try {
    console.log('[EMAIL LOG] Attempting to log email:', { to, subject, body, status });
    
    const logEntry = {
      to,
      subject,
      body,
      status,
      timestamp: new Date().toISOString()
    };

    const logPath = path.join(process.cwd(), 'email_logs.json');
    console.log('[EMAIL LOG] Log path:', logPath);
    
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logPath, 'utf8');
      logs = JSON.parse(existingLogs);
      console.log('[EMAIL LOG] Loaded existing logs, count:', logs.length);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
      console.log('[EMAIL LOG] No existing logs found, starting fresh');
      logs = [];
    }
    
    logs.unshift(logEntry); // Add to beginning of array
    
    // Keep only last 100 emails to prevent file from growing too large
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }
    
    await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    console.log('[EMAIL LOG] Successfully saved email log entry, total logs:', logs.length);
  } catch (error) {
    console.error('[EMAIL LOG] Failed to save log:', error);
  }
}

export { logEmailToFile };

export async function sendEmailMailgun(to, subject, body) {
  try {
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `ExaMark <mailgun@${process.env.MAILGUN_DOMAIN}>`,
      to,
      subject,
      text: body
    });

    console.log('[MAILGUN] Sent:', result);
    
    // Log successful email
    await logEmailToFile(to, subject, body, 'sent');
    
    return `✅ Email sent to ${to}`;
  } catch (err) {
    console.error('[MAILGUN] Failed:', err);
    
    // Log failed email
    await logEmailToFile(to, subject, body, 'failed');
    
    return `❌ Failed: ${err.message || err}`;
  }
}
