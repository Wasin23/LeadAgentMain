import express from 'express';
import { sendEmailTool } from '../lib/myEmailTool.js';
import fs from 'fs/promises';
import path from 'path';
import { authenticateToken } from '../middleware/jwt.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import dns from 'dns';
import { promisify } from 'util';

const router = express.Router();
const resolveTxt = promisify(dns.resolveTxt);

// AWS DynamoDB client setup
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const tableName = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';

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

// New endpoint to get email logs - USER-SCOPED and AUTHENTICATED
router.get('/logs', authenticateToken, async (req, res) => {
  console.log('[EMAIL LOGS] GET /logs request received');
  try {
    const userId = req.user.userId;
    console.log(`[EMAIL LOGS] Getting logs for user: ${userId}`);
    
    // Use user-specific log file
    const logPath = path.join(process.cwd(), `email_logs_${userId}.json`);
    console.log('[EMAIL LOGS] Reading from:', logPath);
    
    try {
      const logsData = await fs.readFile(logPath, 'utf8');
      const logs = JSON.parse(logsData);
      console.log(`[EMAIL LOGS] Found ${logs.length} logs for user ${userId}`);
      res.json(logs || []);
    } catch (error) {
      console.log(`[EMAIL LOGS] No user-specific file found for user ${userId}, returning empty array`);
      // File doesn't exist or is empty
      res.json([]);
    }
  } catch (err) {
    console.error('[EMAIL LOGS] Failed to read logs:', err);
    res.status(500).json({ error: 'Failed to read email logs' });
  }
});

// New endpoint to clear email logs for current user
router.post('/clear-logs', authenticateToken, async (req, res) => {
  console.log('[EMAIL LOGS] POST /clear-logs - Authentication passed, processing request...');
  
  const userId = req.user?.userId;
  if (!userId) {
    console.log('[EMAIL LOGS] ERROR: User ID not found in token');
    return res.status(400).json({ success: false, error: 'User ID not found in token' });
  }

  const userCode = userId.substring(0, 8);
  console.log(`[EMAIL LOGS] POST /clear-logs request received for user: ${userCode}`);
  
  try {
    // Use user-specific files instead of filtering global files
    const userLogPath = path.join(process.cwd(), `email_logs_${userId}.json`);
    const userApprovedPath = path.join(process.cwd(), `email_approved_${userId}.json`);
    const userQueuePath = path.join(process.cwd(), `email_queue_${userId}.json`);
    
    console.log(`[EMAIL LOGS] Clearing user-specific files for user: ${userCode}`);
    console.log(`[EMAIL LOGS] User log path: ${userLogPath}`);
    console.log(`[EMAIL LOGS] User approved path: ${userApprovedPath}`);
    console.log(`[EMAIL LOGS] User queue path: ${userQueuePath}`);
    
    // Clear user-specific files by writing empty arrays
    const emptyArray = [];
    
    try {
      await fs.writeFile(userLogPath, JSON.stringify(emptyArray, null, 2), 'utf8');
      console.log(`[EMAIL LOGS] ✅ Cleared email logs for user: ${userCode}`);
    } catch (error) {
      console.log(`[EMAIL LOGS] ℹ️ No email logs file to clear for user: ${userCode}`);
    }
    
    try {
      await fs.writeFile(userApprovedPath, JSON.stringify(emptyArray, null, 2), 'utf8');
      console.log(`[EMAIL LOGS] ✅ Cleared approved emails for user: ${userCode}`);
    } catch (error) {
      console.log(`[EMAIL LOGS] ℹ️ No approved emails file to clear for user: ${userCode}`);
    }
    
    try {
      await fs.writeFile(userQueuePath, JSON.stringify(emptyArray, null, 2), 'utf8');
      console.log(`[EMAIL LOGS] ✅ Cleared email queue for user: ${userCode}`);
    } catch (error) {
      console.log(`[EMAIL LOGS] ℹ️ No email queue file to clear for user: ${userCode}`);
    }
    
    // Also clear Zilliz tracking data for this user
    try {
      console.log(`[EMAIL LOGS] Clearing Zilliz tracking data for user: ${userCode}...`);
      
      // Get JWT token from request headers
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      const apiBaseUrl = process.env.API_BASE_URL || 'https://meridian-kdew.onrender.com';
      
      const response = await fetch(`${apiBaseUrl}/api/zilliz-tracking/clear`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        console.log(`[EMAIL LOGS] ✅ Zilliz tracking data cleared successfully for user: ${userCode}`);
      } else {
        console.log(`[EMAIL LOGS] ⚠️ Failed to clear Zilliz tracking data for user: ${userCode}`, response.status);
      }
    } catch (zillizError) {
      console.log(`[EMAIL LOGS] ⚠️ Error clearing Zilliz tracking data for user: ${userCode}:`, zillizError.message);
    }

    // Clear local desktop tracking data for this user
    try {
      const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
      desktopEmailTracker.clearUserTrackingData(userId);
      console.log(`[EMAIL LOGS] ✅ Desktop tracking data cleared successfully for user: ${userCode}`);
    } catch (desktopError) {
      console.log(`[EMAIL LOGS] ⚠️ Error clearing desktop tracking data for user: ${userCode}:`, desktopError.message);
    }
    
    console.log(`[EMAIL LOGS] ✅ Successfully cleared email logs and approved emails for user: ${userCode}`);
    
    res.json({ 
      success: true, 
      message: `Email logs, approved emails, and tracking data cleared successfully for user ${userCode}`,
      userCode: userCode
    });
  } catch (err) {
    console.error('[EMAIL LOGS] ❌ Failed to clear logs:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear email logs and approved emails',
      details: err.message
    });
  }
});

// New endpoint to clear search cache
router.post('/clear-search-cache', async (req, res) => {
  console.log('[CACHE] POST /clear-search-cache request received');
  try {
    const cacheDir = path.join(process.cwd(), '.search_cache');
    console.log('[CACHE] Clearing cache directory:', cacheDir);
    
    // Check if directory exists
    if (await fs.access(cacheDir).then(() => true).catch(() => false)) {
      // Read directory contents
      const files = await fs.readdir(cacheDir);
      console.log(`[CACHE] Found ${files.length} cache files to delete`);
      
      // Delete all files in the cache directory
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        await fs.unlink(filePath);
      }
      
      console.log('[CACHE] ✅ Successfully cleared search cache');
      res.json({ 
        success: true, 
        message: 'Search cache cleared successfully',
        clearedCount: files.length
      });
    } else {
      console.log('[CACHE] Cache directory does not exist, nothing to clear');
      res.json({ 
        success: true, 
        message: 'Cache directory does not exist',
        clearedCount: 0
      });
    }
  } catch (err) {
    console.error('[CACHE] ❌ Failed to clear search cache:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear search cache',
      details: err.message
    });
  }
});

// POST /api/email/check-domain-health
router.post('/check-domain-health', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    console.log(`[DOMAIN HEALTH] Checking health for domain: ${domain}`);

    const health = {
      spf: false,
      dkim: false,
      dmarc: false
    };

    // Check SPF record
    try {
      const spfRecords = await resolveTxt(domain);
      const spfRecord = spfRecords.find(record => 
        record.join('').includes('v=spf1')
      );
      health.spf = !!spfRecord;
      console.log(`[DOMAIN HEALTH] SPF: ${health.spf ? 'Found' : 'Not found'}`);
    } catch (error) {
      console.log(`[DOMAIN HEALTH] SPF check failed:`, error.message);
    }

    // Check DKIM record (check for default._domainkey subdomain)
    try {
      const dkimDomain = `default._domainkey.${domain}`;
      const dkimRecords = await resolveTxt(dkimDomain);
      health.dkim = dkimRecords.length > 0;
      console.log(`[DOMAIN HEALTH] DKIM: ${health.dkim ? 'Found' : 'Not found'}`);
    } catch (error) {
      console.log(`[DOMAIN HEALTH] DKIM check failed:`, error.message);
      // Try alternative DKIM selector
      try {
        const altDkimDomain = `ses._domainkey.${domain}`;
        const altDkimRecords = await resolveTxt(altDkimDomain);
        health.dkim = altDkimRecords.length > 0;
      } catch (altError) {
        console.log(`[DOMAIN HEALTH] Alternative DKIM check also failed`);
      }
    }

    // Check DMARC record
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const dmarcRecords = await resolveTxt(dmarcDomain);
      const dmarcRecord = dmarcRecords.find(record =>
        record.join('').includes('v=DMARC1')
      );
      health.dmarc = !!dmarcRecord;
      console.log(`[DOMAIN HEALTH] DMARC: ${health.dmarc ? 'Found' : 'Not found'}`);
    } catch (error) {
      console.log(`[DOMAIN HEALTH] DMARC check failed:`, error.message);
    }

    // Store domain health in user settings
    try {
      const healthData = {
        ...health,
        lastChecked: new Date().toISOString()
      };
      
      const updateCommand = new UpdateCommand({
        TableName: tableName,
        Key: { userId },
        UpdateExpression: 'SET emailSettings = if_not_exists(emailSettings, :emptyObj), emailSettings.domainHealth = :healthObj',
        ExpressionAttributeValues: {
          ':healthObj': healthData,
          ':emptyObj': {}
        }
      });
      await dynamodb.send(updateCommand);
    } catch (dbError) {
      console.error('[DOMAIN HEALTH] Failed to store health status:', dbError);
    }

    res.json({
      success: true,
      domain,
      health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DOMAIN HEALTH] Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST /api/email/verify-domain-ses
router.post('/verify-domain-ses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    console.log(`[AWS SES VERIFY] Initiating verification for domain: ${domain}`);

    // Import AWSManager
    const { default: AWSManager } = await import('../utils/awsManager.js');
    const awsManager = new AWSManager();

    // Start verification process
    const verificationResult = await awsManager.verifyDomainWithSES(domain);

    // Store in user settings
    const updateCommand = new UpdateCommand({
      TableName: tableName,
      Key: { userId },
      UpdateExpression: 'SET emailSettings.customDomain = :domain, emailSettings.sesVerificationToken = :token, emailSettings.sesVerificationStatus = :status',
      ExpressionAttributeValues: {
        ':domain': domain,
        ':token': verificationResult.verificationToken,
        ':status': 'Pending'
      }
    });
    await dynamodb.send(updateCommand);

    res.json({
      success: true,
      domain,
      verificationToken: verificationResult.verificationToken,
      instructions: verificationResult.instructions,
      message: 'Domain verification initiated. Please add the DNS records to complete verification.'
    });

  } catch (error) {
    console.error('[AWS SES VERIFY] Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/email/check-domain-verification
router.get('/check-domain-verification', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    console.log(`[AWS SES CHECK] Checking verification status for: ${domain}`);

    // Import AWSManager
    const { default: AWSManager } = await import('../utils/awsManager.js');
    const awsManager = new AWSManager();

    // Check verification status
    const statusResult = await awsManager.checkDomainVerificationStatus(domain);

    // Update user settings with current status
    if (statusResult.verified) {
      const updateCommand = new UpdateCommand({
        TableName: tableName,
        Key: { userId },
        UpdateExpression: 'SET emailSettings.domainVerified = :verified, emailSettings.sesVerificationStatus = :status',
        ExpressionAttributeValues: {
          ':verified': true,
          ':status': 'Success'
        }
      });
      await dynamodb.send(updateCommand);
    }

    res.json({
      success: true,
      domain,
      verified: statusResult.verified,
      status: statusResult.status,
      message: statusResult.message
    });

  } catch (error) {
    console.error('[AWS SES CHECK] Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
