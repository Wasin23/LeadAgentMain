import express from 'express';
import { sendEmailTool } from '../lib/myEmailTool.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

console.log('DEBUG: sendEmailTool import:', sendEmailTool);

router.post('/email', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing to, subject, or body' });
  }

  try {
    const result = await sendEmailTool(to, subject, body);
    res.json({ result });
  } catch (err) {
    console.error('[EMAIL] Failed:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message || err });
  }
});

// New endpoint to get email logs
router.get('/logs', async (req, res) => {
  console.log('[EMAIL LOGS] GET /logs request received');
  try {
    const logPath = path.join(process.cwd(), 'email_logs.json');
    console.log('[EMAIL LOGS] Reading from:', logPath);
    
    try {
      const logsData = await fs.readFile(logPath, 'utf8');
      const logs = JSON.parse(logsData);
      console.log('[EMAIL LOGS] Found', logs.length, 'logs');
      res.json(logs || []);
    } catch (error) {
      console.log('[EMAIL LOGS] File not found or empty, returning empty array');
      // File doesn't exist or is empty
      res.json([]);
    }
  } catch (err) {
    console.error('[EMAIL LOGS] Failed to read logs:', err);
    res.status(500).json({ error: 'Failed to read email logs' });
  }
});

export default router;
