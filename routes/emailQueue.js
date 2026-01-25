import express from 'express';
import { EmailQueue } from '../lib/emailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';
import { authenticateToken } from '../middleware/jwt.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';
import { autoScheduleFollowUp } from '../utils/rebumpChecker.js';
import { desktopNotifications } from '../utils/desktopNotifications.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

// Rate limiting for counts endpoint - kill spam requests
const countRequestTracker = new Map();
function rateLimitCounts(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 10; // Max 10 requests per minute per IP
  
  if (!countRequestTracker.has(ip)) {
    countRequestTracker.set(ip, []);
  }
  
  const requests = countRequestTracker.get(ip);
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    console.log(`🚫 [RATE LIMIT] Blocked ${ip} - ${validRequests.length} requests in 1 minute`);
    return res.status(429).json({ error: 'Rate limit exceeded. Max 10 requests per minute.' });
  }
  
  validRequests.push(now);
  countRequestTracker.set(ip, validRequests);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [key, times] of countRequestTracker.entries()) {
      const validTimes = times.filter(time => now - time < windowMs);
      if (validTimes.length === 0) {
        countRequestTracker.delete(key);
      } else {
        countRequestTracker.set(key, validTimes);
      }
    }
  }
  
  next();
}

// Apply JWT authentication middleware to all routes
router.use(authenticateToken);

// Helper function to get user-specific and agent-specific email queue
function getUserEmailQueue(userId, agentId = null) {
  return new EmailQueue(userId, agentId);
}

// Get email queue with formatted data (root route)
router.get('/', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Optional agent-specific filtering
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const queue = await userEmailQueue.getQueue();
    const approved = await userEmailQueue.getApproved();
    
    // Format data for frontend
    const pending = queue.filter(e => e.status === 'pending');
    const rejected = queue.filter(e => e.status === 'rejected');
    
    res.json({
      success: true,
      data: {
        pending,
        rejected,
        approved
      }
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting queue data:', error);
    console.error('[EMAIL QUEUE API] Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get email queue data',
      details: error.message
    });
  }
});

// Universal counts endpoint - gets all counts in one request to reduce AWS calls
router.get('/counts', rateLimitCounts, async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    
    if (agentId === 'all' || !agentId) {
      // Get all counts for user via GSI and custom queued count
      const [queuedCount, sentResponse, repliedResponse] = await Promise.all([
        awsQueue.getQueuedEmailCount(req.user.userId), // Custom logic for orphaned emails
        awsQueue.dynamodb.send(new QueryCommand({
          TableName: awsQueue.tableName,
          IndexName: awsQueue.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: { ':gsipk': `${req.user.userId}#SENT` },
          Select: 'COUNT'
        })),
        awsQueue.dynamodb.send(new QueryCommand({
          TableName: awsQueue.tableName,
          IndexName: awsQueue.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: { ':gsipk': `${req.user.userId}#REPLIED` },
          Select: 'COUNT'
        }))
      ]);
      
      return res.json({
        queued: queuedCount,
        sent: sentResponse.Count || 0,
        replied: repliedResponse.Count || 0
      });
    }
    
    // For specific agent, get all counts in parallel
    const pk = `${req.user.userId}#${agentId}`;
    const [queuedResponse, sentResponse, repliedResponse] = await Promise.all([
      awsQueue.dynamodb.send(new QueryCommand({
        TableName: awsQueue.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: { ':pk': pk, ':status': 'QUEUED#' },
        Select: 'COUNT'
      })),
      awsQueue.dynamodb.send(new QueryCommand({
        TableName: awsQueue.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: { ':pk': pk, ':status': 'SENT#' },
        Select: 'COUNT'
      })),
      awsQueue.dynamodb.send(new QueryCommand({
        TableName: awsQueue.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: { ':pk': pk, ':status': 'REPLIED#' },
        Select: 'COUNT'
      }))
    ]);
    
    res.json({
      queued: queuedResponse.Count || 0,
      sent: sentResponse.Count || 0,
      replied: repliedResponse.Count || 0
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting counts:', error);
    res.status(500).json({ error: 'Failed to get counts' });
  }
});

// Get count of queued emails (lightweight - no data transfer)
router.get('/queue/count', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // console.log(`📊 [QUEUE COUNT] agentId: ${agentId}, userId: ${req.user.userId}`);
    
    if (agentId === 'all' || !agentId) {
      const count = await awsQueue.getQueuedEmailCount(req.user.userId);
      // console.log(`📊 [QUEUE COUNT] ALL agents: ${count}`);
      return res.json({ count });
    }
    
    // For specific agent, count directly
    const pk = `${req.user.userId}#${agentId}`;
    // console.log(`📊 [QUEUE COUNT] Specific agent PK: ${pk}`);
    const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':status': 'QUEUED#'
      },
      Select: 'COUNT'
    }));
    
    // console.log(`📊 [QUEUE COUNT] Result for ${agentId}: ${countResponse.Count || 0}`);
    res.json({ count: countResponse.Count || 0 });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting queue count:', error);
    res.status(500).json({ error: 'Failed to get queue count' });
  }
});

// Get count of sent emails (lightweight - no data transfer)
router.get('/sent/count', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    if (agentId === 'all' || !agentId) {
      // Count all sent for user via GSI
      const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
        TableName: awsQueue.tableName,
        IndexName: awsQueue.gsiName,
        KeyConditionExpression: 'GSIPK = :gsipk',
        ExpressionAttributeValues: {
          ':gsipk': `${req.user.userId}#SENT`
        },
        Select: 'COUNT'
      }));
      return res.json({ count: countResponse.Count || 0 });
    }
    
    // For specific agent, count directly
    const pk = `${req.user.userId}#${agentId}`;
    const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':status': 'SENT#'
      },
      Select: 'COUNT'
    }));
    
    res.json({ count: countResponse.Count || 0 });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting sent count:', error);
    res.status(500).json({ error: 'Failed to get sent count' });
  }
});

// Get count of replied emails (lightweight - no data transfer)
router.get('/replied/count', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    if (agentId === 'all' || !agentId) {
      // Count all replied for user via GSI
      const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
        TableName: awsQueue.tableName,
        IndexName: awsQueue.gsiName,
        KeyConditionExpression: 'GSIPK = :gsipk',
        ExpressionAttributeValues: {
          ':gsipk': `${req.user.userId}#REPLIED`
        },
        Select: 'COUNT'
      }));
      return res.json({ count: countResponse.Count || 0 });
    }
    
    // For specific agent, count directly
    const pk = `${req.user.userId}#${agentId}`;
    const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':status': 'REPLIED#'
      },
      Select: 'COUNT'
    }));
    
    res.json({ count: countResponse.Count || 0 });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting replied count:', error);
    res.status(500).json({ error: 'Failed to get replied count' });
  }
});

// Get all emails in queue (with pagination)
router.get('/queue', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    // console.log(`📧 [EMAIL QUEUE] GET /queue - userId: ${req.user.userId}, agentId: ${agentId}, limit: ${limit}, offset: ${offset}`);
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      // console.log(`📧 [EMAIL QUEUE] Fetching ALL queued emails for user ${req.user.userId}`);
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const result = await awsQueue.getAllQueuedEmailsForUser(req.user.userId, limit, offset);
      // console.log(`📧 [EMAIL QUEUE] Found ${result.emails.length} queued emails (total: ${result.total})`);
      return res.json(result);
    }
    
    // If agentId is 'orphan', fetch orphaned emails (from deleted agents)
    if (agentId === 'orphan') {
      // console.log(`📧 [EMAIL QUEUE] Fetching ORPHANED emails for user ${req.user.userId}`);
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const AWSManager = (await import('../utils/awsManager.js')).default;
      const awsManager = new AWSManager();
      const awsQueue = getAWSEmailQueue();
      
      // Get all agents for this user
      const allAgents = await awsManager.getUserAgents(req.user.userId);
      const activeAgentIds = allAgents.map(a => a.agentId);
      // console.log(`📧 [EMAIL QUEUE] Active agent IDs: ${activeAgentIds.join(', ')}`);
      
      // Get paginated emails and filter for orphaned ones
      const result = await awsQueue.getAllQueuedEmailsForUser(req.user.userId, limit + offset, 0);
      const allEmails = result.emails || [];
      const orphanedEmails = allEmails.filter(email => !activeAgentIds.includes(email.agentId));
      const paginatedOrphaned = orphanedEmails.slice(offset, offset + limit);
      
      // console.log(`📧 [EMAIL QUEUE] Found ${orphanedEmails.length} orphaned emails (from ${allEmails.length} total)`);
      return res.json({ emails: paginatedOrphaned, total: orphanedEmails.length, hasMore: offset + limit < orphanedEmails.length });
    }
    
    // Otherwise, fetch for specific agent using AWS directly to avoid full fetch
    // console.log(`📧 [EMAIL QUEUE] Fetching for specific agent: ${agentId || 'null (legacy)'} with pagination`);
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get paginated emails for specific agent using proper PK format
    const pk = `${req.user.userId}#${agentId || 'null'}`;
    // console.log(`📧 [EMAIL QUEUE] Querying with PK: ${pk}`);
    const response = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':status': 'QUEUED#'
      },
      Limit: limit + offset, // Fetch enough to skip offset
      ScanIndexForward: false // Newest first
    }));
    
    const allItems = response.Items || [];
    const paginatedQueue = allItems.slice(offset, offset + limit);
    
    // Get count for total
    const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':status': 'QUEUED#'
      },
      Select: 'COUNT'
    }));
    
    const total = countResponse.Count || 0;
    // console.log(`📧 [EMAIL QUEUE] Found ${paginatedQueue.length} emails (${total} total) for agent ${agentId || 'null'}`);
    res.json({ emails: paginatedQueue, total, hasMore: offset + limit < total });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting queue:', error);
    console.error('[EMAIL QUEUE API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to get email queue' });
  }
});

// Get queue statistics
router.get('/stats', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    
    // If agentId is 'all' or not provided, get stats across ALL agents
    if (agentId === 'all' || !agentId) {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const stats = await awsQueue.getAllStats(req.user.userId);
      return res.json(stats);
    }
    
    // Otherwise, get stats for specific agent
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const stats = await userEmailQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// Add custom email to queue
router.post('/custom', async (req, res) => {
  // console.log('[EMAIL QUEUE] 🚀 CUSTOM EMAIL ENDPOINT HIT!');
  // console.log('[EMAIL QUEUE] Raw body type:', typeof req.body);
  // console.log('[EMAIL QUEUE] Raw body:', req.body);
  // console.log('[EMAIL QUEUE] Headers:', req.headers);
  // console.log('[EMAIL QUEUE] User from JWT:', req.user);
  try {
    const { to, subject, body, cc, bcc, leadContext, source = 'custom' } = req.body;
    
    // Validation
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: to, subject, body' 
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email address format' 
      });
    }
    
    // Create custom email object (without id and timestamp, let addToQueue handle those)
    const customEmail = {
      status: 'pending',
      source: source,
      userId: req.user.userId, // Add userId from JWT token for proper tracking
      cc: cc || '', // Add CC field
      bcc: bcc || '', // Add BCC field
      leadData: {
        email: to,
        company: 'Custom Email',
        name: to.split('@')[0], // Use email prefix as name
        title: 'Custom Contact',
        context: leadContext || 'Custom email created by user'
      },
      leadDetails: {
        personInfo: {
          fullName: to.split('@')[0], // Use email prefix as name
          currentPosition: 'Custom Contact',
          company: 'Custom Email',
          email: to
        }
      },
      emailData: {
        subject: subject,
        body: body,
        cc: cc || '', // Add CC to emailData as well
        bcc: bcc || '', // Add BCC to emailData as well
        finalRecipient: to,
        finalSubject: subject,
        finalBody: body
      },
      metadata: {
        customEmail: true,
        createdAt: new Date().toISOString(),
        createdBy: 'user'
      }
    };
    
    // Add to queue (this will add id and timestamp)
    // console.log(`[EMAIL QUEUE] req.user object:`, req.user);
    // console.log(`[EMAIL QUEUE] req.user.userId:`, req.user?.userId);
    // console.log(`[EMAIL QUEUE] Creating user queue for userId: ${req.user?.userId}`);
    const agentId = req.body.agentId || null; // Optional agent-specific queue
    const userEmailQueue = getUserEmailQueue(req.user?.userId, agentId);
    // console.log(`[EMAIL QUEUE] Adding email to queue (agentId: ${agentId})...`);
    const addedEmail = await userEmailQueue.addToQueue(customEmail);
    // console.log(`[EMAIL QUEUE] Email added successfully:`, addedEmail);
    
    // console.log(`[EMAIL QUEUE] ✏️ Added custom email to queue: ${to} - ${subject}`);
    
    res.json({ 
      success: true, 
      message: 'Custom email added to queue successfully',
      email: addedEmail
    });
    
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error adding custom email:', error);
    console.error('[EMAIL QUEUE API] Error stack:', error.stack);
    console.error('[EMAIL QUEUE API] Error details:', {
      name: error.name,
      message: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add custom email to queue',
      error: error.message 
    });
  }
});

// Update email content
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const updatedEmail = await userEmailQueue.updateEmail(id, updates);
    res.json(updatedEmail);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error updating email:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// Approve email and send it
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const isOrphaned = req.body.isOrphaned || false;
    
    // Get the email from queue first
    let agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    
    // For orphaned emails, we need to get all queued emails and find this one
    if (isOrphaned || agentId === 'orphan') {
      // console.log('[EMAIL QUEUE] 🏴 Processing ORPHANED email:', id);
      const awsQueue = new AWSEmailQueue();
      const allQueuedEmails = await awsQueue.getAllQueuedEmailsForUser(req.user.userId);
      const orphanedEmail = allQueuedEmails.find(e => e.id === id);
      
      if (orphanedEmail) {
        agentId = orphanedEmail.agentId;
        // console.log('[EMAIL QUEUE] Found orphaned email with original agentId:', agentId);
      } else {
        console.error('[EMAIL QUEUE] Orphaned email not found in queued emails');
        return res.status(404).json({ error: 'Orphaned email not found' });
      }
    }
    
    const awsEmailQueue = new AWSEmailQueue();
    const queue = await awsEmailQueue.getQueuedEmails(req.user.userId, agentId);
    const email = queue.find(e => e.id === id);
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    // Approve the email (moves it from queue to approved)
    const approvedEmail = await awsEmailQueue.approveEmail(req.user.userId, agentId, id);
    
    // Handle both old format (direct fields) and new format (nested in emailData)
    const emailData = approvedEmail.emailData || {};
    const finalRecipient = emailData.finalRecipient || approvedEmail.finalRecipient || approvedEmail.to;
    const finalSubject = emailData.finalSubject || approvedEmail.finalSubject || approvedEmail.subject;
    const finalBody = emailData.finalBody || approvedEmail.finalBody || approvedEmail.body;
    
    // Validate we have all required fields
    if (!finalRecipient || !finalSubject || !finalBody) {
      console.error('[EMAIL QUEUE] Missing email data:', { finalRecipient, finalSubject, finalBody, approvedEmail });
      return res.status(400).json({ 
        error: 'Email data incomplete', 
        details: 'Missing recipient, subject, or body'
      });
    }
    
    // Send the actual email with person information
    const personInfo = approvedEmail.leadDetails?.personInfo || null;
    const userId = approvedEmail.userId || null; // Get userId from queue data
    const originalAgentId = approvedEmail.agentId || req.body.agentId || null; // Keep for tracking
    
    // For orphaned emails, pass null as agentId so it uses user-level Gmail preference
    // Otherwise use the original agentId for agent-specific settings
    const effectiveAgentId = (isOrphaned || agentId === 'orphan') ? null : originalAgentId;
    
    console.log('[EMAIL QUEUE] 🔍 Marking email as sent - Debug info:', {
      emailId: id,
      userId: req.user.userId,
      originalAgentId: originalAgentId,
      effectiveAgentId: effectiveAgentId || 'null (user-level settings)',
      trackingId: sendResult.result?.trackingId || 'No tracking ID',
      leadNameForTracking: personInfo?.fullName || 'Unknown',
      personInfo: personInfo ? {
        fullName: personInfo.fullName,
        name: personInfo.name
      } : null,
      approvedEmail: { leadName: approvedEmail?.leadName, recipientName: approvedEmail?.recipientName },
      sentVia: sendResult.method || 'Unknown'
    });

    // console.log('EMAIL QUEUE routing info and person info (commented out for cleaner logs)');
    
    // Get CC, BCC emails and sender name from settings
    let ccEmails = approvedEmail.cc || approvedEmail.emailData?.cc || null;
    let bccEmails = approvedEmail.bcc || approvedEmail.emailData?.bcc || null;
    let senderName = null;
    
    // Fetch agent settings for CC, BCC and sender name
    if (userId && effectiveAgentId) {
      try {
        const awsManager = getUserEmailQueue(userId, effectiveAgentId).awsManager;
        if (awsManager) {
          const agentSettings = await awsManager.getLeadAgentSettings(userId, effectiveAgentId);
          if (agentSettings) {
            // Get CC emails if not already set
            if (!ccEmails && agentSettings.emailBuilder && agentSettings.emailBuilder.ccEmails) {
              ccEmails = agentSettings.emailBuilder.ccEmails;
              // console.log('[EMAIL QUEUE] Found CC emails in agent settings:', ccEmails);
            }
            // Get BCC emails if not already set
            if (!bccEmails && agentSettings.emailBuilder && agentSettings.emailBuilder.bccEmails) {
              bccEmails = agentSettings.emailBuilder.bccEmails;
              // console.log('[EMAIL QUEUE] Found BCC emails in agent settings:', bccEmails);
            }
            // Get sender name for branding
            if (agentSettings.companyName) {
              senderName = agentSettings.companyName;
              // console.log('[EMAIL QUEUE] Found sender name in agent settings:', senderName);
            } else if (agentSettings.emailBuilder && agentSettings.emailBuilder.companyName) {
              senderName = agentSettings.emailBuilder.companyName;
              // console.log('[EMAIL QUEUE] Found sender name in emailBuilder settings:', senderName);
            }
          }
        }
      } catch (settingsError) {
        console.warn('[EMAIL QUEUE] Could not fetch agent settings:', settingsError.message);
      }
    }
    
    if (ccEmails) {
      console.log('[EMAIL QUEUE] Using CC emails:', ccEmails);
    }
    if (bccEmails) {
      console.log('[EMAIL QUEUE] Using BCC emails:', bccEmails);
    }
    
    console.log('[EMAIL QUEUE] Sending email with data:', {
      finalRecipient,
      finalSubject,
      bodyLength: finalBody?.length,
      personInfo,
      userId,
      ccEmails,
      bccEmails,
      senderName: senderName || 'Default (Meridian)',
      emailType: approvedEmail.metadata?.customEmail ? 'custom' : 'regular'
    });
    
    console.log('🎯 [EMAIL QUEUE] About to send email via leadEmail() with tracking enabled');
    console.log('🔑 [EMAIL QUEUE] userId:', userId);
    console.log('🔑 [EMAIL QUEUE] effectiveAgentId:', effectiveAgentId);
    
    // Check for replyOptions (threading info for follow-up emails)
    const replyOptions = approvedEmail.replyOptions || null;
    if (replyOptions) {
      console.log('🧵 [EMAIL QUEUE] This is a follow-up email - will send as reply to original thread');
      console.log('🧵 [EMAIL QUEUE] Reply options:', replyOptions);
    }
    
    const sendResult = await leadEmail(
      finalRecipient,
      finalSubject,
      finalBody,
      personInfo,
      userId,
      effectiveAgentId,
      ccEmails, // Pass CC emails to leadEmail
      bccEmails, // Pass BCC emails to leadEmail
      senderName, // Pass sender name for branding
      replyOptions // Pass reply options for threading
    );
    
    if (sendResult.success) {
      console.log(`[EMAIL QUEUE] ✅ Sent approved email to ${finalRecipient}`);
      console.log('📦 [EMAIL QUEUE] sendResult object:', JSON.stringify(sendResult, null, 2));
      
      // Create in-app notification for email approval/send
      try {
        const leadName = personInfo?.fullName || personInfo?.name || approvedEmail.leadName || approvedEmail.recipientName || 'Lead';
        const companyName = approvedEmail.leadDetails?.companyName || 'Unknown Company';
        
        const awsManager = new AWSManager();
        await awsManager.addIssue(
          userId,
          'email',
          'low',
          `✅ Email sent to ${leadName}`,
          `Your email to ${leadName} at ${companyName} has been sent successfully.`,
          {
            emailId: id,
            recipient: finalRecipient,
            subject: finalSubject,
            leadName,
            companyName,
            sentAt: new Date().toISOString()
          }
        );
        console.log('[EMAIL QUEUE] 📬 In-app notification created for email send');
      } catch (notifError) {
        console.error('[EMAIL QUEUE] ⚠️ Failed to create notification:', notifError.message);
      }
      
      // Send desktop notification
      try {
        const leadName = personInfo?.fullName || personInfo?.name || approvedEmail.leadName || approvedEmail.recipientName || 'Lead';
        const companyName = approvedEmail.leadDetails?.companyName || 'Unknown Company';
        await desktopNotifications.sendNotification(
          userId,
          '✅ Email Sent Successfully',
          `Email to ${leadName} at ${companyName} has been sent`,
          'email_sent',
          { 
            emailId: id, 
            recipient: finalRecipient,
            subject: finalSubject,
            leadName,
            companyName
          }
        );
        console.log('[EMAIL QUEUE] 🔔 Desktop notification sent for approved email');
      } catch (notifError) {
        console.error('[EMAIL QUEUE] ⚠️ Failed to send desktop notification:', notifError.message);
        // Don't fail the email send if notification fails
      }
      
      // Mark email as sent in AWS DynamoDB - use AWS queue directly
      if (sendResult.result) {
        try {
          const leadNameForTracking = personInfo?.fullName || personInfo?.name || approvedEmail.leadName || approvedEmail.recipientName;
          
          // console.log('═══════════════════════════════════════════════════════════');
          // console.log('🎯 [TRACKING PIXEL] Tracking ID from sendResult:', sendResult.result.trackingId);
          // console.log('🎯 [TRACKING PIXEL] Has tracking ID?', !!sendResult.result.trackingId);
          // console.log('═══════════════════════════════════════════════════════════');
          
          console.log('[EMAIL QUEUE] 🔍 Marking email as sent - Debug info:', {
            emailId: id,
            userId: approvedEmail.userId,
            originalAgentId,
            effectiveAgentId: effectiveAgentId || 'null (user-level routing)',
            trackingId: sendResult.result.trackingId,
            leadNameForTracking,
            personInfo: personInfo ? { fullName: personInfo.fullName, name: personInfo.name } : null,
            approvedEmail: { leadName: approvedEmail.leadName, recipientName: approvedEmail.recipientName },
            sentVia: sendResult.method || 'mailgun'
          });
          
          // Use AWS queue directly with original agentId (not wrapper class)
          await awsEmailQueue.markEmailAsSent(req.user.userId, originalAgentId, id, {
            id: sendResult.result.mailgunId || sendResult.result.messageId || null,
            message: sendResult.result.messageId || sendResult.result.trackingId,
            trackingId: sendResult.result.trackingId,  // This is the tracking pixel ID
            fromAccount: sendResult.result.fromAccount || null,
            method: sendResult.method || 'mailgun',
            leadName: leadNameForTracking,
            subject: finalSubject,
            to: finalRecipient,
            // Store message ID and thread ID for reply threading in follow-ups
            messageId: sendResult.result.messageId || null,
            threadId: sendResult.result.threadId || null
          });
          console.log(`[EMAIL QUEUE] 💾 Marked email ${id} as sent in AWS with tracking ID ${sendResult.result.trackingId} from ${sendResult.result.fromAccount || 'Mailgun'}`);
          if (sendResult.result.threadId) {
            console.log(`[EMAIL QUEUE] 🧵 Thread ID stored for reply threading: ${sendResult.result.threadId}`);
          }
          
          // If this is a follow-up/rebump email, update the original email's followUpStatus
          if (approvedEmail.isRebump && approvedEmail.originalEmailId) {
            try {
              // console.log(`[EMAIL QUEUE] 🔄 This is a rebump email - updating original email ${approvedEmail.originalEmailId}`);
              const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
              const awsQueue = getAWSEmailQueue();
              
              // Update the original email to mark that follow-up was actually SENT
              await awsQueue.updateEmailStatus(userId, effectiveAgentId, approvedEmail.originalEmailId, 'SENT', 'SENT', {
                followUpStatus: 'SENT',
                lastFollowUpSentAt: new Date().toISOString()
              });
              // console.log(`[EMAIL QUEUE] ✅ Updated original email ${approvedEmail.originalEmailId} followUpStatus to SENT`);
            } catch (rebumpUpdateError) {
              console.error('[EMAIL QUEUE] ⚠️ Failed to update original email after rebump:', rebumpUpdateError);
              // Don't fail the whole operation if this fails
            }
          }
          
          // Auto-schedule follow-up if enabled for this agent
          try {
            console.log('═══════════════════════════════════════════════════════════');
            console.log('📅 [FOLLOW-UP] Starting auto-schedule follow-up process');
            console.log('📅 [FOLLOW-UP] userId:', userId);
            console.log('📅 [FOLLOW-UP] effectiveAgentId:', effectiveAgentId);
            console.log('📅 [FOLLOW-UP] emailId:', id);
            console.log('═══════════════════════════════════════════════════════════');
            
            // Get the sent email to pass to autoScheduleFollowUp
            const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
            const awsQueue = getAWSEmailQueue();
            
            console.log('📅 [FOLLOW-UP] Fetching sent emails from AWS...');
            const sentEmails = await awsQueue.getSentEmails(userId, effectiveAgentId);
            // console.log('📅 [FOLLOW-UP] Found', sentEmails.length, 'sent emails');
            
            const sentEmail = sentEmails.find(e => e.id === id);
            // console.log('📅 [FOLLOW-UP] Found sent email?', !!sentEmail);
            
            if (sentEmail) {
              // console.log('📅 [FOLLOW-UP] Sent email details:', {
              //   id: sentEmail.id,
              //   to: sentEmail.to,
              //   subject: sentEmail.subject,
              //   sentAt: sentEmail.sentAt,
              //   hasTrackingId: !!sentEmail.trackingId
              // });
              
              // console.log('📅 [FOLLOW-UP] Calling autoScheduleFollowUp...');
              const result = await autoScheduleFollowUp(userId, effectiveAgentId, sentEmail);
              // console.log('📅 [FOLLOW-UP] autoScheduleFollowUp result:', result);
              // console.log(`[EMAIL QUEUE] 📅 Auto-scheduled follow-up for email ${id}`);
            } else {
              console.log('⚠️ [FOLLOW-UP] Could not find sent email with id:', id);
              console.log('⚠️ [FOLLOW-UP] Available sent email IDs:', sentEmails.map(e => e.id));
            }
          } catch (followUpError) {
            console.error('[EMAIL QUEUE] ⚠️ Failed to auto-schedule follow-up:', followUpError);
            console.error('[EMAIL QUEUE] ⚠️ Follow-up error stack:', followUpError.stack);
            // Don't fail the email send if follow-up scheduling fails
          }
        } catch (trackingError) {
          console.error('[EMAIL QUEUE] ⚠️ Failed to mark email as sent in AWS:', trackingError);
          console.error('[EMAIL QUEUE] ⚠️ Error details:', trackingError.stack);
        }
      }
      
      res.json({ 
        success: true, 
        email: approvedEmail,
        sendResult: sendResult.result 
      });
    } else {
      console.error(`[EMAIL QUEUE] ❌ Failed to send approved email:`, sendResult.error);
      res.status(500).json({ 
        error: 'Email approved but failed to send', 
        details: sendResult.error,
        email: approvedEmail
      });
    }
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error approving email:', error);
    res.status(500).json({ error: 'Failed to approve email' });
  }
});

// Reject email
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || ''; // Handle undefined body
    
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const rejectedEmail = await userEmailQueue.rejectEmail(id, reason);
    res.json({ success: true, email: rejectedEmail });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error rejecting email:', error);
    res.status(500).json({ success: false, error: 'Failed to reject email' });
  }
});

// Get approved emails history
router.get('/approved', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Optional agent-specific filtering
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const approved = await userEmailQueue.getApproved();
    res.json(approved);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting approved emails:', error);
    res.status(500).json({ error: 'Failed to get approved emails' });
  }
});

// Get sent emails only (emails that have been approved and actually sent)
router.get('/sent', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Getting sent emails - silent
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const emails = await awsQueue.getAllSentEmailsForUser(req.user.userId);
      // Found sent emails - silent
      return res.json(emails);
    }
    
    // For specific agent, use AWS method (includes orphaned emails from deleted agents)
    const emails = await awsQueue.getSentEmails(req.user.userId, agentId);
    // Found sent emails - silent
    res.json(emails);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting sent emails:', error);
    res.status(500).json({ error: 'Failed to get sent emails' });
  }
});

// Get replied emails
router.get('/replied', async (req, res) => {
  try {
    const agentId = req.query.agentId;
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const emails = await awsQueue.getAllRepliedEmailsForUser(req.user.userId);
      return res.json(emails);
    }
    
    // Otherwise, fetch for specific agent (or null for legacy)
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId || null);
    const replied = await userEmailQueue.getReplied();
    res.json(replied);
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting replied emails:', error);
    res.status(500).json({ error: 'Failed to get replied emails' });
  }
});

// Clear rejected emails
router.post('/clear-rejected', async (req, res) => {
  try {
    const agentId = req.query.agentId || req.body.agentId || null; // Support agentId from query or body
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    const result = await userEmailQueue.clearRejected();
    res.json({ 
      success: true, 
      message: 'Rejected emails cleared',
      clearedCount: result.clearedCount
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error clearing rejected emails:', error);
    res.status(500).json({ error: 'Failed to clear rejected emails' });
  }
});

// Delete all approved emails for an agent
router.delete('/approved', async (req, res) => {
  try {
    const agentId = req.query.agentId || null; // Support agent-specific clearing
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    
    // Clear approved emails by setting to empty array
    const result = await userEmailQueue.clearApproved();
    
    res.json({ 
      success: true, 
      message: 'Approved emails cleared successfully',
      clearedCount: result?.clearedCount || 0
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error clearing approved emails:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear approved emails',
      details: error.message 
    });
  }
});

// Reject/delete a single email from queue
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.query.agentId || req.body.agentId || null;
    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    
    await userEmailQueue.rejectEmail(id);
    
    res.json({ 
      success: true, 
      message: 'Email rejected successfully'
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error rejecting email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject email',
      details: error.message 
    });
  }
});

// Clear all sent emails
router.delete('/sent/clear', async (req, res) => {
  try {
    const agentId = req.query.agentId || null;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    const result = await awsQueue.clearSentEmails(req.user.userId, agentId);
    
    res.json({ 
      success: true, 
      message: agentId 
        ? `Cleared ${result.clearedCount} sent emails and ${result.zillizCleared} tracking events for agent`
        : `Cleared ${result.clearedCount} sent emails and ${result.zillizCleared} tracking events for all agents`,
      clearedCount: result.clearedCount,
      zillizCleared: result.zillizCleared
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error clearing sent emails:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear sent emails',
      details: error.message 
    });
  }
});

// Bulk edit/replace text in queued emails
router.post('/bulk-edit', async (req, res) => {
  try {
    const { findText, replaceText, useRegex = false, agentId } = req.body;
    
    if (!findText && findText !== '') {
      return res.status(400).json({ 
        success: false,
        error: 'Find text is required' 
      });
    }
    
    console.log(`🔧 [EMAIL QUEUE] Bulk edit: "${findText}" → "${replaceText}" (regex: ${useRegex}, agent: ${agentId || 'all'})`);
    
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get all queued emails for this user (and optionally specific agent)
    let emails = await awsQueue.getAllQueuedEmailsForUser(req.user.userId);
    
    // Filter by agent if specified
    if (agentId && agentId !== 'all') {
      emails = emails.filter(e => e.agentId === agentId);
    }
    
    console.log(`🔧 [EMAIL QUEUE] Found ${emails.length} queued emails to process`);
    
    let updatedCount = 0;
    const updates = [];
    
    // Process emails with delay to avoid AWS throttling
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      let bodyChanged = false;
      let subjectChanged = false;
      let newBody = email.body;
      let newSubject = email.subject;
      
      // Replace in email body
      if (email.body) {
        if (useRegex) {
          const regex = new RegExp(findText, 'g');
          const replaced = email.body.replace(regex, replaceText);
          if (replaced !== email.body) {
            newBody = replaced;
            bodyChanged = true;
          }
        } else {
          const replaced = email.body.split(findText).join(replaceText);
          if (replaced !== email.body) {
            newBody = replaced;
            bodyChanged = true;
          }
        }
      }
      
      // Replace in subject
      if (email.subject) {
        if (useRegex) {
          const regex = new RegExp(findText, 'g');
          const replaced = email.subject.replace(regex, replaceText);
          if (replaced !== email.subject) {
            newSubject = replaced;
            subjectChanged = true;
          }
        } else {
          const replaced = email.subject.split(findText).join(replaceText);
          if (replaced !== email.subject) {
            newSubject = replaced;
            subjectChanged = true;
          }
        }
      }
      
      // Update if changes were made
      if (bodyChanged || subjectChanged) {
        await awsQueue.updateEmail(email.emailId, {
          body: newBody,
          subject: newSubject
        });
        updatedCount++;
        updates.push({
          emailId: email.emailId,
          to: email.to,
          bodyChanged,
          subjectChanged
        });
        
        console.log(`✅ [EMAIL QUEUE] Updated email ${updatedCount}/${emails.length} (${email.to})`);
        
        // Delay 500ms between updates to avoid AWS throttling
        if (i < emails.length - 1) {
          await delay(500);
        }
      }
    }
    
    console.log(`✅ [EMAIL QUEUE] Bulk edit complete: ${updatedCount}/${emails.length} emails updated`);
    
    res.json({
      success: true,
      updatedCount,
      totalProcessed: emails.length,
      updates
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error in bulk edit:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to bulk edit emails',
      details: error.message 
    });
  }
});

// Schedule mass follow-up for all eligible emails
router.post('/schedule-mass-followup', async (req, res) => {
  try {
    const { agentId, templateId } = req.body;
    const userId = req.user.userId;
    
    if (!agentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Agent ID is required' 
      });
    }
    
    console.log(`🔧 [EMAIL QUEUE] Scheduling mass follow-up for agent ${agentId}`);
    
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get all sent emails for this agent
    const sentEmails = await awsQueue.getSentEmails(userId, agentId);
    
    // Filter for eligible emails (not already scheduled, not replied)
    const eligibleEmails = sentEmails.filter(email => {
      // Skip if already scheduled for follow-up
      if (email.followUpScheduled) return false;
      
      // Skip if email has been replied to
      if (email.status === 'REPLIED') return false;
      
      // Skip if email bounced
      if (email.status === 'BOUNCED') return false;
      
      return true;
    });
    
    console.log(`🔧 [EMAIL QUEUE] Found ${eligibleEmails.length} eligible emails out of ${sentEmails.length} total sent emails`);
    
    // Schedule follow-up for each eligible email
    let scheduledCount = 0;
    for (const email of eligibleEmails) {
      try {
        await autoScheduleFollowUp(userId, agentId, email);
        scheduledCount++;
      } catch (error) {
        console.error(`[EMAIL QUEUE] Failed to schedule follow-up for email ${email.id}:`, error);
      }
    }
    
    console.log(`✅ [EMAIL QUEUE] Mass follow-up complete: ${scheduledCount}/${eligibleEmails.length} emails scheduled`);
    
    res.json({
      success: true,
      scheduledCount,
      eligibleCount: eligibleEmails.length,
      totalSent: sentEmails.length
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error in mass follow-up:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to schedule mass follow-up',
      details: error.message 
    });
  }
});

// Update follow-up details for a specific email
router.put('/:emailId/followup', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { agentId, followUpDate, templateId } = req.body;
    const userId = req.user.userId;
    
    if (!agentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Agent ID is required' 
      });
    }
    
    console.log(`🔧 [EMAIL QUEUE] Updating follow-up for email ${emailId}`);
    
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get agent settings for templates
    const awsManager = (await import('../utils/awsManager.js')).default;
    const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
    const templates = agentSettings?.followUpTemplates?.templates || [];
    
    // Build update object
    const updates = {};
    
    if (followUpDate) {
      updates.followUpDate = new Date(followUpDate).toISOString();
    }
    
    if (templateId !== undefined) {
      updates.assignedTemplateId = templateId;
      updates.assignedTemplate = templates[templateId];
    }
    
    // Update the email
    await awsQueue.updateEmailStatus(userId, agentId, emailId, 'SENT', 'SENT', updates);
    
    console.log(`✅ [EMAIL QUEUE] Updated follow-up details for email ${emailId}`);
    
    res.json({
      success: true,
      updates
    });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error updating follow-up:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update follow-up',
      details: error.message 
    });
  }
});

export default router;
