import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';

const router = express.Router();
const awsManager = new AWSManager();
const awsQueue = new AWSEmailQueue();

/**
 * Record agent metrics snapshot
 * This should be called periodically (e.g., every hour) via cron job
 */
router.post('/api/agent-metrics/record', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const timestamp = new Date().toISOString();
    
    console.log(`📊 Recording agent metrics for user ${userId} at ${timestamp}`);
    
    // Get all agents from user record
    const { getUserById } = await import('../lib/userManager.js');
    const user = await getUserById(userId);
    const agents = user?.activeAgents || [];
    
    if (!agents || agents.length === 0) {
      return res.json({ success: true, recorded: 0, metrics: [] });
    }
    
    // Record metrics for each agent
    const metricsPromises = agents.map(async (agent) => {
      try {
        // Get current queue counts
        const [queuedEmails, sentEmails] = await Promise.all([
          awsQueue.getQueuedEmailsForAgent(userId, agent.agentId),
          awsQueue.getSentEmailsForAgent(userId, agent.agentId)
        ]);
        
        const repliedEmails = sentEmails.filter(e => e.replied || e.status === 'REPLIED');
        
        // Store metrics snapshot
        await awsManager.recordAgentMetrics({
          userId,
          agentId: agent.agentId,
          timestamp,
          metrics: {
            queued: queuedEmails.length,
            sent: sentEmails.length,
            replied: repliedEmails.length
          }
        });
        
        return {
          agentId: agent.agentId,
          name: agent.name,
          queued: queuedEmails.length,
          sent: sentEmails.length,
          replied: repliedEmails.length
        };
      } catch (error) {
        console.error(`Error recording metrics for agent ${agent.agentId}:`, error);
        return null;
      }
    });
    
    const results = (await Promise.all(metricsPromises)).filter(r => r !== null);
    
    console.log(`✅ Recorded metrics for ${results.length} agents`);
    res.json({ success: true, recorded: results.length, metrics: results });
  } catch (error) {
    console.error('Error recording agent metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get historical metrics for an agent
 * Returns time-series data for the last 24 hours (hourly snapshots)
 */
router.get('/api/agent-metrics/history/:agentId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { agentId } = req.params;
    const hours = parseInt(req.query.hours) || 12;
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const history = await awsManager.getAgentMetricsHistory(userId, agentId, startTime);
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching agent metrics history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get historical metrics for all agents
 * Computes time-series data directly from email timestamps
 */
router.get('/api/agent-metrics/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const hours = parseInt(req.query.hours) || 12;
    
    // Get all agents from user record
    const { getUserById } = await import('../lib/userManager.js');
    const user = await getUserById(userId);
    const agents = user?.activeAgents || [];
    
    // Handle case where no agents exist
    if (!agents || agents.length === 0) {
      return res.json({ success: true, agents: [] });
    }
    
    // Create time buckets (one per hour for the last N hours)
    const now = Date.now();
    const buckets = [];
    for (let i = hours; i >= 0; i--) {
      buckets.push({
        start: now - (i + 1) * 60 * 60 * 1000,
        end: now - i * 60 * 60 * 1000,
        timestamp: new Date(now - i * 60 * 60 * 1000).toISOString()
      });
    }
    
    // Fetch history for each agent by computing from actual emails
    const historyPromises = agents.map(async (agent) => {
      try {
        // Get all emails for this agent
        const [queuedEmails, sentEmails] = await Promise.all([
          awsQueue.getQueuedEmailsForAgent(userId, agent.agentId),
          awsQueue.getSentEmailsForAgent(userId, agent.agentId)
        ]);
        
        // Current totals
        const currentQueued = queuedEmails.length;
        const currentSent = sentEmails.length;
        const currentReplied = sentEmails.filter(e => e.replied || e.repliedAt).length;
        
        // Compute metrics for each time bucket
        const history = buckets.map((bucket, bucketIdx) => {
          // Count emails SENT in this time window (between bucket.start and bucket.end)
          const sentInBucket = sentEmails.filter(e => {
            const sentTime = new Date(e.sentAt || e.timestamp || e.createdAt).getTime();
            return sentTime >= bucket.start && sentTime <= bucket.end;
          }).length;
          
          // Count emails REPLIED in this time window
          const repliedInBucket = sentEmails.filter(e => {
            if (!e.replied && !e.repliedAt) return false;
            const repliedTime = new Date(e.repliedAt || e.timestamp).getTime();
            return repliedTime >= bucket.start && repliedTime <= bucket.end;
          }).length;
          
          // Count emails ADDED TO QUEUE in this time window
          const queuedInBucket = queuedEmails.filter(e => {
            const addedTime = new Date(e.timestamp || e.createdAt || e.queuedAt).getTime();
            return addedTime >= bucket.start && addedTime <= bucket.end;
          }).length;
          
          // For cumulative sent/replied, count everything up to this bucket
          const sentCumulative = sentEmails.filter(e => {
            const sentTime = new Date(e.sentAt || e.timestamp || e.createdAt).getTime();
            return sentTime <= bucket.end;
          }).length;
          
          const repliedCumulative = sentEmails.filter(e => {
            if (!e.replied && !e.repliedAt) return false;
            const repliedTime = new Date(e.repliedAt || e.timestamp).getTime();
            return repliedTime <= bucket.end;
          }).length;
          
          // Queue depth at this point = current queue + emails sent after this time - emails added after this time
          // (working backwards from current state)
          const sentAfterBucket = sentEmails.filter(e => {
            const sentTime = new Date(e.sentAt || e.timestamp || e.createdAt).getTime();
            return sentTime > bucket.end;
          }).length;
          
          const addedAfterBucket = queuedEmails.filter(e => {
            const addedTime = new Date(e.timestamp || e.createdAt || e.queuedAt).getTime();
            return addedTime > bucket.end;
          }).length;
          
          // Queue at time T = current queue + (sent after T) - (added after T)
          const queueAtTime = Math.max(0, currentQueued + sentAfterBucket - addedAfterBucket);
          
          return {
            timestamp: bucket.timestamp,
            queued: queueAtTime,
            sent: sentCumulative,
            replied: repliedCumulative
          };
        });
        
        return {
          agentId: agent.agentId,
          name: agent.name,
          history
        };
      } catch (error) {
        console.error(`Error computing history for agent ${agent.agentId}:`, error);
        return { agentId: agent.agentId, name: agent.name, history: [] };
      }
    });
    
    // Also compute for orphaned emails
    const orphanHistoryPromise = (async () => {
      try {
        const [queuedEmails, sentEmails] = await Promise.all([
          awsQueue.getQueuedEmailsForAgent(userId, 'orphan'),
          awsQueue.getSentEmailsForAgent(userId, 'orphan')
        ]);
        
        const currentQueued = queuedEmails.length;
        
        const history = buckets.map(bucket => {
          const sentCumulative = sentEmails.filter(e => {
            const sentTime = new Date(e.sentAt || e.timestamp || e.createdAt).getTime();
            return sentTime <= bucket.end;
          }).length;
          
          const repliedCumulative = sentEmails.filter(e => {
            if (!e.replied && !e.repliedAt) return false;
            const repliedTime = new Date(e.repliedAt || e.timestamp).getTime();
            return repliedTime <= bucket.end;
          }).length;
          
          const sentAfterBucket = sentEmails.filter(e => {
            const sentTime = new Date(e.sentAt || e.timestamp || e.createdAt).getTime();
            return sentTime > bucket.end;
          }).length;
          
          const addedAfterBucket = queuedEmails.filter(e => {
            const addedTime = new Date(e.timestamp || e.createdAt || e.queuedAt).getTime();
            return addedTime > bucket.end;
          }).length;
          
          const queueAtTime = Math.max(0, currentQueued + sentAfterBucket - addedAfterBucket);
          
          return {
            timestamp: bucket.timestamp,
            queued: queueAtTime,
            sent: sentCumulative,
            replied: repliedCumulative
          };
        });
        
        return {
          agentId: 'orphan',
          name: 'Orphaned Emails',
          history
        };
      } catch (error) {
        return { agentId: 'orphan', name: 'Orphaned Emails', history: [] };
      }
    })();
    
    const [agentResults, orphanResult] = await Promise.all([
      Promise.all(historyPromises),
      orphanHistoryPromise
    ]);
    
    // Add orphan to results if it has data
    const results = [...agentResults];
    if (orphanResult.history.some(h => h.queued > 0 || h.sent > 0)) {
      results.unshift(orphanResult);
    }
    
    res.json({ success: true, agents: results });
  } catch (error) {
    console.error('Error fetching agent metrics history:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;
