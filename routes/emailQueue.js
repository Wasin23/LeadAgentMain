import express from 'express';
import { EmailQueue } from '../lib/emailQueue.js';
import { leadEmail } from '../tools/leadEmail.js';
import { authenticateToken } from '../middleware/jwt.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';
import { autoScheduleFollowUp } from '../utils/rebumpChecker.js';
import { buildComplianceFooter } from './unsubscribe.js';
import { desktopNotifications } from '../utils/desktopNotifications.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

// Rate limiting for counts endpoint - more lenient for email clients
const countRequestTracker = new Map();
function rateLimitCounts(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  
  // More lenient limits for mobile/email clients
  const isMobileEmailClient = /iPhone|Android|Mobile|Mail/i.test(userAgent);
  const maxRequests = isMobileEmailClient ? 30 : 10; // 30 for mobile, 10 for others
  
  if (!countRequestTracker.has(ip)) {
    countRequestTracker.set(ip, []);
  }
  
  const requests = countRequestTracker.get(ip);
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    console.log(`[RATE LIMIT] Blocked ${ip} (${userAgent}) - ${validRequests.length} requests in 1 minute (limit: ${maxRequests})`);
    return res.status(429).json({ error: `Rate limit exceeded. Max ${maxRequests} requests per minute.` });
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
      // Single counter item read — 1 DynamoDB read regardless of email volume
      const counts = await awsQueue.getCountsFromCounters(req.user.userId);
      return res.json({
        ...counts,
        sent: (counts.sent || 0) + (counts.replied || 0)
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
    
    const repliedCount = repliedResponse.Count || 0;
    res.json({
      queued: queuedResponse.Count || 0,
      sent: (sentResponse.Count || 0) + repliedCount,
      replied: repliedCount
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
    
    if (agentId === 'all' || !agentId) {
      const count = await awsQueue.getQueuedEmailCount(req.user.userId);
      return res.json({ count });
    }
    
    // For specific agent, count directly
    const pk = `${req.user.userId}#${agentId}`;
    const countResponse = await awsQueue.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
      TableName: awsQueue.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':status': 'QUEUED#'
      },
      Select: 'COUNT'
    }));
    
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
      const QueryCommand = (await import('@aws-sdk/lib-dynamodb')).QueryCommand;
      const [sentCountResponse, repliedCountResponse] = await Promise.all([
        awsQueue.dynamodb.send(new QueryCommand({
          TableName: awsQueue.tableName,
          IndexName: awsQueue.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: {
            ':gsipk': `${req.user.userId}#SENT`
          },
          Select: 'COUNT'
        })),
        awsQueue.dynamodb.send(new QueryCommand({
          TableName: awsQueue.tableName,
          IndexName: awsQueue.gsiName,
          KeyConditionExpression: 'GSIPK = :gsipk',
          ExpressionAttributeValues: {
            ':gsipk': `${req.user.userId}#REPLIED`
          },
          Select: 'COUNT'
        }))
      ]);
      return res.json({ count: (sentCountResponse.Count || 0) + (repliedCountResponse.Count || 0) });
    }

    // For specific agent, count directly
    const pk = `${req.user.userId}#${agentId}`;
    const QueryCommand = (await import('@aws-sdk/lib-dynamodb')).QueryCommand;
    const [sentCountResponse, repliedCountResponse] = await Promise.all([
      awsQueue.dynamodb.send(new QueryCommand({
        TableName: awsQueue.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':status': 'SENT#'
        },
        Select: 'COUNT'
      })),
      awsQueue.dynamodb.send(new QueryCommand({
        TableName: awsQueue.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':status': 'REPLIED#'
        },
        Select: 'COUNT'
      }))
    ]);

    res.json({ count: (sentCountResponse.Count || 0) + (repliedCountResponse.Count || 0) });
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
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const result = await awsQueue.getAllQueuedEmailsForUser(req.user.userId, limit, offset);
      return res.json(result);
    }
    
    // If agentId is 'orphan', fetch orphaned emails (from deleted agents)
    if (agentId === 'orphan') {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const AWSManager = (await import('../utils/awsManager.js')).default;
      const awsManager = new AWSManager();
      const awsQueue = getAWSEmailQueue();
      
      // Get all agents for this user
      const allAgents = await awsManager.getUserAgents(req.user.userId);
      const activeAgentIds = allAgents.map(a => a.agentId);
      
      // Get paginated emails and filter for orphaned ones
      const result = await awsQueue.getAllQueuedEmailsForUser(req.user.userId, limit + offset, 0);
      const allEmails = result.emails || [];
      const orphanedEmails = allEmails.filter(email => !activeAgentIds.includes(email.agentId));
      const paginatedOrphaned = orphanedEmails.slice(offset, offset + limit);
      
      return res.json({ emails: paginatedOrphaned, total: orphanedEmails.length, hasMore: offset + limit < orphanedEmails.length });
    }
    
    // Otherwise, fetch for specific agent using AWS directly to avoid full fetch
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get paginated emails for specific agent using proper PK format
    const pk = `${req.user.userId}#${agentId || 'null'}`;
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
    const agentId = req.body.agentId || null; // Optional agent-specific queue
    const userEmailQueue = getUserEmailQueue(req.user?.userId, agentId);
    const addedEmail = await userEmailQueue.addToQueue(customEmail);
    
    
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
    const agentId = req.query.agentId || req.body.agentId || null;
    
    const updates = { ...req.body };
    delete updates.agentId;
    
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
      const awsQueue = new AWSEmailQueue();
      const allQueuedEmails = await awsQueue.getAllQueuedEmailsForUser(req.user.userId);
      const orphanedEmail = allQueuedEmails.find(e => e.id === id);
      
      if (orphanedEmail) {
        agentId = orphanedEmail.agentId;
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
    
    // Get CC, BCC emails and sender name from settings
    let ccEmails = approvedEmail.cc || approvedEmail.emailData?.cc || null;
    let bccEmails = approvedEmail.bcc || approvedEmail.emailData?.bcc || null;
    let senderName = null;
    let agentEmailBuilder = null;
    let agentCompanyBranding = null;

    // Fetch agent settings for CC, BCC, sender name, and chat link config
    if (userId && effectiveAgentId) {
      try {
        const awsManager = getUserEmailQueue(userId, effectiveAgentId).awsManager;
        if (awsManager) {
          const agentSettings = await awsManager.getLeadAgentSettings(userId, effectiveAgentId);
          if (agentSettings) {
            agentEmailBuilder = agentSettings.emailBuilder || null;
            agentCompanyBranding = agentSettings.companyBranding || null;
            // Get CC emails if not already set
            if (!ccEmails && agentEmailBuilder?.ccEmails) {
              ccEmails = agentEmailBuilder.ccEmails;
            }
            // Get BCC emails if not already set
            if (!bccEmails && agentEmailBuilder?.bccEmails) {
              bccEmails = agentEmailBuilder.bccEmails;
            }
            // Get sender name for branding
            if (agentSettings.companyName) {
              senderName = agentSettings.companyName;
            } else if (agentEmailBuilder?.companyName) {
              senderName = agentEmailBuilder.companyName;
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
    
    // Final unsubscribe gate: the recipient may have unsubscribed while this email
    // sat in the queue. Never send to an unsubscribed address.
    const recipientUnsubscribed = await new AWSManager().isUnsubscribed(finalRecipient).catch(() => false);
    if (recipientUnsubscribed) {
      console.log(`[EMAIL QUEUE] Blocking send — ${finalRecipient} has unsubscribed`);
      return res.status(409).json({
        success: false,
        error: `${finalRecipient} has unsubscribed and cannot be emailed.`,
        unsubscribed: true,
      });
    }

    console.log('[EMAIL QUEUE] About to send email via leadEmail() with tracking enabled');
    console.log('[EMAIL QUEUE] userId:', userId);
    console.log('[EMAIL QUEUE] effectiveAgentId:', effectiveAgentId);
    
    // Check for replyOptions (threading info for follow-up emails)
    const replyOptions = approvedEmail.replyOptions || null;
    if (replyOptions) {
      console.log('[EMAIL QUEUE] This is a follow-up email - will send as reply to original thread');
      console.log('[EMAIL QUEUE] Reply options:', replyOptions);
    }
    
    // Inject MQL Chat button if enabled in agent settings
    let emailBodyWithChat = finalBody;
    if (agentEmailBuilder?.includeChatLink) {
      try {
        const { chatLabManager } = await import('../utils/chatLabManager.js');
        const leadName    = personInfo?.fullName || personInfo?.name || approvedEmail.leadName || approvedEmail.leadInfo?.name || 'Lead';
        const leadCompany = approvedEmail.leadDetails?.companyName || personInfo?.company || '';
        const leadTitle   = personInfo?.title || personInfo?.currentPosition || '';
        const leadId      = approvedEmail.leadId || approvedEmail.leadDetails?.leadId || null;
        const researchSnapshot = {
          buyerMotivation: approvedEmail.aiReport?.buyerMotivation || null,
          emailHooks:      (approvedEmail.aiReport?.emailHooks || []).slice(0, 3),
          tier:            approvedEmail.aiReport?.tier || null,
          score:           approvedEmail.aiReport?.score || null,
          citedFacts:      (approvedEmail.aiReport?.allCitedFacts || approvedEmail.aiReport?.citedEvidence || []).slice(0, 8).map(f => ({
            fact:   f.fact || f.text || '',
            source: f.source || '',
          })),
          specificInsights: (approvedEmail.researchData?.specificInsights || []).slice(0, 5),
          originalEmail:    (approvedEmail.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200),
          companyBranding: {
            name:        agentCompanyBranding?.companyName || null,
            description: agentCompanyBranding?.companyDescription || null,
            offering:    agentCompanyBranding?.primaryService || agentCompanyBranding?.coreOffering || null,
            advantages:  agentCompanyBranding?.keyAdvantages || null,
            website:     agentCompanyBranding?.companyWebsite || null,
          },
        };

        const { token, url } = await chatLabManager.createChatToken(userId, {
          agentId:   originalAgentId,
          leadId,
          emailId:   id,
          leadName,
          leadCompany,
          leadTitle,
          leadEmail: finalRecipient,
          researchSnapshot,
        });
        const cardText = agentEmailBuilder.chatLinkInstructions?.trim() || 'Want to ask me anything directly? I\'m available now:';
        const chatLinkHtml = `\n<div style="margin-top:24px;padding:16px 20px;background:#f8f9ff;border-left:3px solid #3b82f6;border-radius:4px;font-family:Arial,sans-serif;">
  <p style="margin:0 0 8px;font-size:13px;color:#374151;">${cardText}</p>
  <a href="${url}" style="display:inline-block;padding:8px 18px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Start a conversation →</a>
</div>\n\n`;
        if (emailBodyWithChat.includes('<!--MERIDIAN_FOOTER-->')) {
          emailBodyWithChat = emailBodyWithChat.replace('<!--MERIDIAN_FOOTER-->', `${chatLinkHtml}`);
        } else if (emailBodyWithChat.includes('</body>')) {
          emailBodyWithChat = emailBodyWithChat.replace('</body>', `${chatLinkHtml}</body>`);
        } else {
          emailBodyWithChat += chatLinkHtml;
        }
        console.log(`[EMAIL QUEUE] 💬 MQL Chat link injected — token: ${token}`);
      } catch (chatErr) {
        console.error('[EMAIL QUEUE] ⚠️ Failed to inject chat link:', chatErr.message);
      }
    }

    // Strip sentinel if chat was disabled or injection failed
    emailBodyWithChat = emailBodyWithChat.replace('<!--MERIDIAN_FOOTER-->', '');

    // Append legal compliance footer (company branding + unsubscribe link) — built fresh
    // at actual send time, never baked into the editable draft.
    emailBodyWithChat += buildComplianceFooter({
      recipientEmail: finalRecipient,
      userId,
      companyBranding: agentCompanyBranding,
    }).replace('<!--MERIDIAN_FOOTER-->', '');

    const sendResult = await leadEmail(
      finalRecipient,
      finalSubject,
      emailBodyWithChat,
      personInfo,
      userId,
      effectiveAgentId,
      ccEmails,
      bccEmails,
      senderName,
      replyOptions
    );

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
    
    if (sendResult.success) {
      console.log(`[EMAIL QUEUE] ✅ Sent approved email to ${finalRecipient}`);
      console.log('[EMAIL QUEUE] sendResult object:', JSON.stringify(sendResult, null, 2));
      
      // Create in-app notification for email approval/send
      try {
        const leadName = personInfo?.fullName || personInfo?.name || approvedEmail.leadName || approvedEmail.recipientName || 'Lead';
        const companyName = approvedEmail.leadDetails?.companyName || 'Unknown Company';
        
        const awsManager = new AWSManager();
        await awsManager.addIssue(
          userId,
          'email',
          `Email sent to ${leadName}`,
          `Your email to ${leadName} at ${companyName} has been sent successfully.`,
          {
            severity: 'low',
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
          'Email Sent Successfully',
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
            fromAccount: sendResult.result.fromAccount || sendResult.result.sentFrom || null,
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
              const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
              const awsQueue = getAWSEmailQueue();
              
              // Update the original email to mark that follow-up was actually SENT
              await awsQueue.updateEmailStatus(userId, effectiveAgentId, approvedEmail.originalEmailId, 'SENT', 'SENT', {
                followUpStatus: 'SENT',
                lastFollowUpSentAt: new Date().toISOString()
              });
            } catch (rebumpUpdateError) {
              console.error('[EMAIL QUEUE] ⚠️ Failed to update original email after rebump:', rebumpUpdateError);
              // Don't fail the whole operation if this fails
            }
          }
          
          // Auto-schedule follow-up if enabled for this agent
          try {
            console.log('═══════════════════════════════════════════════════════════');
            console.log('[FOLLOW-UP] Starting auto-schedule follow-up process');
            console.log('[FOLLOW-UP] userId:', userId);
            console.log('[FOLLOW-UP] effectiveAgentId:', effectiveAgentId);
            console.log('[FOLLOW-UP] emailId:', id);
            console.log('═══════════════════════════════════════════════════════════');
            
            // Build the email object directly from available data — avoids a DynamoDB
            // eventual-consistency race condition where getSentEmails() misses the
            // record that was written moments earlier by markEmailAsSent().
            // autoScheduleFollowUp only needs id, isRebump, and followUpScheduled.
            const emailForFollowUp = {
              id,
              isRebump: approvedEmail.isRebump || false,
              followUpScheduled: false
            };
            
            const result = await autoScheduleFollowUp(userId, effectiveAgentId, emailForFollowUp);
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

    const mergeVisibleSent = (sentEmails = [], repliedEmails = []) => {
      const byId = new Map();

      for (const email of [...sentEmails, ...repliedEmails]) {
        if (!email?.id) continue;
        byId.set(email.id, email);
      }

      return [...byId.values()].sort((a, b) => {
        const aTime = new Date(a.repliedAt || a.sentAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.repliedAt || b.sentAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    };
    
    // Getting sent emails - silent
    
    // If agentId is 'all', fetch from all agents using AWS
    if (agentId === 'all') {
      const [sentEmails, repliedEmails] = await Promise.all([
        awsQueue.getAllSentEmailsForUser(req.user.userId),
        awsQueue.getAllRepliedEmailsForUser(req.user.userId)
      ]);
      const emails = mergeVisibleSent(sentEmails, repliedEmails);
      // Found sent emails - silent
      return res.json(emails);
    }
    
    // For specific agent, use AWS method (includes orphaned emails from deleted agents)
    const [sentEmails, repliedEmails] = await Promise.all([
      awsQueue.getSentEmails(req.user.userId, agentId),
      awsQueue.getRepliedEmails(req.user.userId, agentId)
    ]);
    const emails = mergeVisibleSent(sentEmails, repliedEmails);
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
        ? `Cleared ${result.clearedCount} sent emails for agent`
        : `Cleared ${result.clearedCount} sent emails for all agents`,
      clearedCount: result.clearedCount
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
    
    console.log(`[EMAIL QUEUE] Bulk edit: "${findText}" → "${replaceText}" (regex: ${useRegex}, agent: ${agentId || 'all'})`);
    
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get all queued emails for this user (and optionally specific agent)
    let emails = await awsQueue.getAllQueuedEmailsForUser(req.user.userId);
    
    // Filter by agent if specified
    if (agentId && agentId !== 'all') {
      emails = emails.filter(e => e.agentId === agentId);
    }
    
    console.log(`[EMAIL QUEUE] Found ${emails.length} queued emails to process`);
    
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
        
        console.log(`[EMAIL QUEUE] Updated email ${updatedCount}/${emails.length} (${email.to})`);
        
        // Delay 500ms between updates to avoid AWS throttling
        if (i < emails.length - 1) {
          await delay(500);
        }
      }
    }
    
    console.log(`[EMAIL QUEUE] Bulk edit complete: ${updatedCount}/${emails.length} emails updated`);
    
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

// Reset batchExcluded flag on all queued emails for an agent (called when schedule is saved)
router.post('/reset-batch-excluded', async (req, res) => {
  try {
    const { agentId } = req.body;
    const userId = req.user.userId;
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const { syncAutoScheduleJobsForAgent } = await import('../utils/autoScheduleJobs.js');
    const awsQueue = getAWSEmailQueue();

    const queued = agentId
      ? await awsQueue.getQueuedEmails(userId, agentId)
      : (await awsQueue.getAllQueuedEmailsForUser(userId, 500, 0)).emails ?? [];

    const excluded = (queued ?? []).filter(e => e.batchExcluded);
    await Promise.all(excluded.map(e =>
      awsQueue.updateEmail(userId, e.agentId || agentId, e.id, { batchExcluded: false }, { skipAutoScheduleSync: true })
    ));

    if (agentId) {
      await syncAutoScheduleJobsForAgent(userId, agentId, { awsQueue });
    }

    res.json({ success: true, reset: excluded.length });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error resetting batch excluded:', error);
    res.status(500).json({ error: 'Failed to reset batch excluded emails' });
  }
});

// Schedule mass follow-up for all eligible emails
router.post('/schedule-mass-followup', async (req, res) => {
  try {
    const { agentId, emailIds } = req.body; // emailIds: optional array to restrict which emails to schedule
    const userId = req.user.userId;
    
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'Agent ID is required' });
    }
    
    console.log(`[EMAIL QUEUE] Scheduling mass follow-up for agent ${agentId}`);
    
    let emailsToSchedule;

    if (Array.isArray(emailIds) && emailIds.length > 0) {
      // Frontend passed specific IDs — schedule exactly those (skip eligibility checks, caller is responsible)
      emailsToSchedule = emailIds.map(id => ({ id, isRebump: false, followUpScheduled: false }));
    } else {
      // No list provided — fetch all and filter eligible
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const sentEmails = await awsQueue.getSentEmails(userId, agentId);
      emailsToSchedule = sentEmails.filter(email =>
        !email.followUpScheduled && email.status !== 'REPLIED' && email.status !== 'BOUNCED' && !email.isRebump
      );
    }

    console.log(`[EMAIL QUEUE] Scheduling follow-ups for ${emailsToSchedule.length} emails`);
    
    let scheduledCount = 0;
    for (const email of emailsToSchedule) {
      try {
        const result = await autoScheduleFollowUp(userId, agentId, email);
        if (result.success) scheduledCount++;
      } catch (error) {
        console.error(`[EMAIL QUEUE] Failed to schedule follow-up for email ${email.id}:`, error);
      }
    }
    
    console.log(`[EMAIL QUEUE] Mass follow-up complete: ${scheduledCount}/${emailsToSchedule.length} emails scheduled`);
    
    res.json({ success: true, scheduledCount, eligibleCount: emailsToSchedule.length });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error in mass follow-up:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule mass follow-up', details: error.message });
  }
});

// Update follow-up details for a specific email
router.put('/:emailId/followup', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { agentId, followUpDate, templateId, assignedTemplate: incomingTemplate } = req.body;
    const userId = req.user.userId;
    
    if (!agentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Agent ID is required' 
      });
    }
    
    console.log(`[EMAIL QUEUE] Updating follow-up for email ${emailId}`);
    
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    
    // Get agent settings for templates
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
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

    if (incomingTemplate) {
      updates.assignedTemplate = incomingTemplate;
    }
    
    // Update the email
    await awsQueue.updateEmailStatus(userId, agentId, emailId, 'SENT', 'SENT', updates);
    
    console.log(`[EMAIL QUEUE] Updated follow-up details for email ${emailId}`);
    
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

// Schedule a follow-up for a single email (without sending it now)
router.post('/:emailId/followup/schedule', authenticateToken, async (req, res) => {
  try {
    const { emailId } = req.params;
    const { agentId } = req.body;
    const userId = req.user.userId;

    if (!agentId) {
      return res.status(400).json({ success: false, error: 'Agent ID is required' });
    }

    const emailForFollowUp = { id: emailId, isRebump: false, followUpScheduled: false };
    const result = await autoScheduleFollowUp(userId, agentId, emailForFollowUp);

    if (result.success) {
      console.log(`[EMAIL QUEUE] Scheduled follow-up for ${emailId}: ${result.followUpDate}`);
      res.json({ success: true, followUpDate: result.followUpDate });
    } else {
      res.status(400).json({ success: false, reason: result.reason, error: result.error });
    }
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error scheduling follow-up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retry a follow-up immediately — fires it now, does not wait for cron
router.post('/:emailId/followup/retry', authenticateToken, async (req, res) => {
  try {
    const { emailId } = req.params;
    const { agentId } = req.body;
    const userId = req.user.userId;

    if (!agentId) {
      return res.status(400).json({ success: false, error: 'Agent ID is required' });
    }

    const { fireSingleFollowUp } = await import('../utils/rebumpChecker.js');
    const result = await fireSingleFollowUp(userId, agentId, emailId);

    console.log(`[EMAIL QUEUE] Fired immediate follow-up for ${emailId} → ${result.to}`);
    res.json({ success: true, to: result.to });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error retrying follow-up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk reschedule all pending follow-ups for an agent when interval changes
router.post('/reschedule-pending-followups', authenticateToken, async (req, res) => {
  try {
    const { agentId, intervalDays } = req.body;
    const userId = req.user.userId;
    if (!agentId || !intervalDays) return res.status(400).json({ success: false, error: 'agentId and intervalDays required' });

    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();
    const emails = await awsQueue.getSentEmails(userId, agentId);
    const pending = (emails || []).filter(e => e.followUpScheduled && e.followUpDate);

    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    let updated = 0;
    for (const email of pending) {
      const base = email.lastRebumpAt || email.sentAt || email.timestamp;
      if (!base) continue;
      const newDate = new Date(new Date(base).getTime() + intervalMs).toISOString();
      await awsQueue.updateEmailStatus(userId, agentId, email.id, 'SENT', 'SENT', { followUpDate: newDate });
      updated++;
    }

    res.json({ success: true, updated });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error bulk rescheduling follow-ups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel a scheduled follow-up for a specific email
router.delete('/:emailId/followup', authenticateToken, async (req, res) => {
  try {
    const { emailId } = req.params;
    const { agentId } = req.body;
    const userId = req.user.userId;

    if (!agentId) {
      return res.status(400).json({ success: false, error: 'Agent ID is required' });
    }

    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const awsQueue = getAWSEmailQueue();

    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
    const maxRebumps = agentSettings?.emailBuilder?.maxRebumps ?? 1;

    await awsQueue.updateEmailStatus(userId, agentId, emailId, 'SENT', 'SENT', {
      followUpScheduled: false,
      followUpDate: null,
      followUpCanceledAt: new Date().toISOString(),
      rebumpCount: maxRebumps, // mark as fully done so cron never reschedules
    });

    console.log(`[EMAIL QUEUE] Canceled follow-up for email ${emailId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error canceling follow-up:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel follow-up', details: error.message });
  }
});

// ── Scheduled batches helper (same algorithm as email-queue-content.tsx) ───────
// Converts HH:MM on a given calendar day (year/month/day) in `tz` to a UTC Date.
// Uses the inverse-offset trick: build a naive UTC candidate at that clock time,
// measure how far Intl renders it vs. the desired time, then shift to correct.
function localTimeToUTC(year, month, day, h, m, tz) {
  const naive = new Date(Date.UTC(year, month - 1, day, h, m, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(naive);
  const rendH = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const rendM = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const diffMs = ((h * 60 + m) - ((rendH === 24 ? 0 : rendH) * 60 + rendM)) * 60000;
  return new Date(naive.getTime() + diffMs);
}

function computeSlotDate(index, schedule) {
  const { activeDays, sendTime, dailyLimit, timezone } = schedule;
  const tz = timezone || 'America/New_York';
  const limit = Math.max(1, dailyLimit || 50);
  const targetSlot = Math.floor(index / limit);
  const [schedH, schedM] = (sendTime || '09:00').split(':').map(Number);

  const now = new Date();
  // Today's date in the agent's configured timezone
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // "YYYY-MM-DD"
  const [todayY, todayMo, todayD] = todayStr.split('-').map(Number);

  // Has today's send window already passed in the agent's timezone?
  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const nowH = parseInt(nowParts.find(p => p.type === 'hour').value, 10);
  const nowM = parseInt(nowParts.find(p => p.type === 'minute').value, 10);
  const startOffset = ((nowH === 24 ? 0 : nowH) * 60 + nowM) >= (schedH * 60 + schedM) ? 1 : 0;

  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let slotsFound = 0;
  for (let i = startOffset; i < 400; i++) {
    // Use UTC noon as probe to avoid DST-at-midnight edge cases
    const probe = new Date(Date.UTC(todayY, todayMo - 1, todayD + i, 12, 0, 0));
    const wdStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(probe);
    const wd = wdMap[wdStr] ?? probe.getUTCDay();
    if ((activeDays || [1, 2, 3, 4, 5]).includes(wd)) {
      if (slotsFound === targetSlot) {
        const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(probe);
        const [dY, dMo, dD] = dateStr.split('-').map(Number);
        return localTimeToUTC(dY, dMo, dD, schedH, schedM, tz);
      }
      slotsFound++;
    }
  }
  // fallback — very far future
  const fbProbe = new Date(Date.UTC(todayY, todayMo - 1, todayD + 400, 12, 0, 0));
  const fbStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(fbProbe);
  const [fY, fMo, fD] = fbStr.split('-').map(Number);
  return localTimeToUTC(fY, fMo, fD, schedH, schedM, tz);
}

// GET /daily-cap-status — connected sending accounts + how many sent today vs caps
router.get('/daily-cap-status', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const awsQueue = getAWSEmailQueue();

    const userSettings = await awsManager.getUserSettings(userId);
    const timezone = userSettings?.timezone || 'America/New_York';

    // Build list of connected sending accounts
    const gmailAccounts = (userSettings?.gmailAccounts || []).map((acc, i) => ({
      email: acc.email,
      provider: 'gmail',
      isActive: !!acc.isActive,
      index: i,
    }));
    const outlookAccounts = (userSettings?.outlookAccounts || []).map((acc, i) => ({
      email: acc.email,
      provider: 'outlook',
      isActive: false, // Outlook doesn't have per-account isActive; first is default
      index: i,
    }));
    // Mark first Outlook account active if no Gmail active account
    if (outlookAccounts.length > 0 && !gmailAccounts.some(a => a.isActive)) {
      outlookAccounts[0].isActive = true;
    }

    const connectedAccounts = [...gmailAccounts, ...outlookAccounts];

    // Today's date string in user's timezone
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
    // SK is SENT#<UTC-ISO-timestamp>#<emailId> — the embedded date is UTC, but
    // "today" is local. Query all 3 UTC-dated prefixes a local day can touch
    // and filter by the real local date parsed from each item's own timestamp,
    // otherwise evening sends get stamped with tomorrow's UTC date and leak
    // into the next local day's count instead of resetting cleanly.
    const utcDateStrings = [...new Set([-1, 0, 1].map(offset =>
      new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10)
    ))];

    // Count sent today across all agents
    const agents = await awsManager.getUserAgents(userId);
    const agentIds = (agents || []).map(a => a.agentId).filter(Boolean);
    const perAgentCounts = await Promise.all(
      agentIds.map(async agentId => {
        const responses = await Promise.all(utcDateStrings.map(dateStr =>
          awsQueue.dynamodb.send(new QueryCommand({
            TableName: awsQueue.tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `${userId}#${agentId}`,
              ':skPrefix': `SENT#${dateStr}`,
            },
            ProjectionExpression: 'SK',
          })).then(r => r.Items || []).catch(() => [])
        ));
        let count = 0;
        for (const items of responses) {
          for (const item of items) {
            const ts = String(item.SK).split('#')[1];
            if (ts && new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(ts)) === todayStr) count++;
          }
        }
        return count;
      })
    );
    const sentToday = perAgentCounts.reduce((sum, c) => sum + c, 0);

    const PER_ACCOUNT_CAP = 50;
    const TOTAL_CAP = 250;
    const activeAccount = connectedAccounts.find(a => a.isActive) || null;

    res.json({
      success: true,
      accounts: connectedAccounts,
      activeAccount,
      sentToday,
      perAccountCap: PER_ACCOUNT_CAP,
      totalCap: TOTAL_CAP,
      remaining: Math.max(0, TOTAL_CAP - sentToday),
      perAccountRemaining: Math.max(0, PER_ACCOUNT_CAP - sentToday),
    });
  } catch (error) {
    console.error('[EMAIL QUEUE] Error getting daily cap status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /scheduled-batches — server-computed send schedule grouped by time slot
router.get('/scheduled-batches', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { getScheduledEmailJobs } = await import('../utils/scheduledEmailJobs.js');
    const AWSManagerMod = await import('../utils/awsManager.js');
    const scheduledJobs = getScheduledEmailJobs();
    const awsManager = new AWSManagerMod.default();
    const jobs = await scheduledJobs.getScheduledJobsForUser(userId, { limit: 500 });

    const agentIds = [...new Set(jobs.map(job => job.agentId).filter(Boolean))];
    const agentNames = {};
    await Promise.all(agentIds.map(async agentId => {
      try {
        const settings = await awsManager.getAgentSettings(userId, agentId);
        agentNames[agentId] = settings?.name || '';
      } catch {
        agentNames[agentId] = '';
      }
    }));

    const batchMap = new Map();

    for (const job of jobs) {
      const key = new Date(job.scheduledAt).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          count: 0,
          agentName: agentNames[job.agentId] || '',
          agentId:   job.agentId || '',
          emailIds:  [],
        });
      }
      const entry = batchMap.get(key);
      entry.count++;
      entry.emailIds.push({ id: job.emailId, agentId: job.agentId });
    }

    const batches = Array.from(batchMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 20)
      .map(([time, info]) => ({
        scheduledSendTime: time,
        count:     info.count,
        agentName: info.agentName,
        agentId:   info.agentId,
        emailIds:  info.emailIds,
      }));

    res.json({ batches });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error getting scheduled batches:', error);
    res.status(500).json({ error: 'Failed to get scheduled batches', batches: [] });
  }
});

// PATCH /scheduled-batches — reschedule all emails in a batch to a new time
router.patch('/scheduled-batches', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emailIds, newScheduledAt } = req.body;
    if (!Array.isArray(emailIds) || !newScheduledAt) {
      return res.status(400).json({ error: 'emailIds and newScheduledAt are required' });
    }
    const { getScheduledEmailJobs } = await import('../utils/scheduledEmailJobs.js');
    const scheduledJobs = getScheduledEmailJobs();
    const awsQueue = (await import('../utils/awsEmailQueue.js')).default;
    const queue = new awsQueue();

    await Promise.all(emailIds.map(async ({ id, agentId }) => {
      await queue.updateEmail(userId, agentId, id, { scheduledAt: newScheduledAt });
      await scheduledJobs.upsertScheduledEmail({ userId, agentId, emailId: id, scheduledAt: newScheduledAt, scheduleType: 'manual' });
    }));

    res.json({ success: true, updated: emailIds.length });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error updating batch schedule:', error);
    res.status(500).json({ error: 'Failed to update batch schedule' });
  }
});

// DELETE /scheduled-batches — cancel (unschedule) all emails in a batch
router.delete('/scheduled-batches', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emailIds } = req.body;
    if (!Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'emailIds is required' });
    }
    const { getScheduledEmailJobs } = await import('../utils/scheduledEmailJobs.js');
    const scheduledJobs = getScheduledEmailJobs();
    const awsQueue = (await import('../utils/awsEmailQueue.js')).default;
    const queue = new awsQueue();

    await Promise.all(emailIds.map(async ({ id, agentId }) => {
      await queue.updateEmail(userId, agentId, id, { scheduledAt: null });
      await scheduledJobs.deleteScheduledEmail(userId, agentId, id);
    }));

    res.json({ success: true, deleted: emailIds.length });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error deleting batch schedule:', error);
    res.status(500).json({ error: 'Failed to delete batch schedule' });
  }
});

// Rebuild email content with AI
router.post('/rebuild', async (req, res) => {
  try {
    const { emailId, agentId, instruction, currentSubject, currentBody, aiReport } = req.body;

    if (!emailId || !agentId || !instruction?.trim()) {
      return res.status(400).json({ error: 'emailId, agentId, and instruction are required' });
    }

    // Extract and preserve the compliance footer (unsubscribe block).
    // ^([\s\S]*) is greedy, so it consumes as much as possible — meaning \n\n matches
    // the LAST double-newline before a block containing an unsubscribe signal.
    let bodyForAI = currentBody || '';
    let preservedFooter = '';
    const footerMatch = bodyForAI.match(/^([\s\S]*)\r?\n\r?\n([\s\S]*(?:unsubscribe|stop emails|\/unsubscribe\?token=)[\s\S]*)$/i);
    if (footerMatch) {
      bodyForAI = footerMatch[1];
      preservedFooter = '\n\n' + footerMatch[2];
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const reportLines = [];
    if (aiReport) {
      if (aiReport.companyName) reportLines.push(`Company: ${aiReport.companyName}`);
      if (aiReport.contactName) reportLines.push(`Contact: ${aiReport.contactName}`);
      if (aiReport.reasoning)   reportLines.push(`Research: ${aiReport.reasoning}`);
      if (aiReport.keyStrengths?.length) reportLines.push(`Strengths: ${aiReport.keyStrengths.join(', ')}`);
      if (aiReport.allCitedFacts?.length) reportLines.push(`Key Facts: ${aiReport.allCitedFacts.slice(0, 5).map(f => f.fact).join('; ')}`);
    }
    const reportText = reportLines.length ? `\n\nResearch context:\n${reportLines.join('\n')}` : '';

    const systemPrompt = `You are an expert cold-email copywriter. Rewrite the provided outreach email based on the user's instruction. Keep it professional, concise (under 150 words), and natural-sounding. You may use the research context to improve personalization. Do NOT include any footer, unsubscribe link, or company address — those are added automatically. Return ONLY a JSON object with "subject" and "body" fields — no explanations, no markdown fences.`;

    const userPrompt = `Current subject: ${currentSubject || '(none)'}

Current body:
${bodyForAI || '(none)'}${reportText}

Rewrite instruction: ${instruction.trim()}

Return JSON only: {"subject": "...", "body": "..."}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      temperature: 0.6,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content[0].text.trim();
    let parsed;
    try {
      const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid JSON' });
    }

    if (!parsed.subject || !parsed.body) {
      return res.status(500).json({ error: 'AI response missing subject or body' });
    }

    // Re-attach the preserved compliance footer
    const finalBody = parsed.body + preservedFooter;

    const userEmailQueue = getUserEmailQueue(req.user.userId, agentId);
    await userEmailQueue.updateEmail(emailId, { subject: parsed.subject, body: finalBody });

    res.json({ success: true, subject: parsed.subject, body: finalBody });
  } catch (error) {
    console.error('[EMAIL QUEUE API] Error rebuilding email:', error);
    res.status(500).json({ error: 'Failed to rebuild email', details: error.message });
  }
});

export default router;
