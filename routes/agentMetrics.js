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
    
    // Get all agents for user
    const agents = await awsManager.getAgents(userId);
    
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
 * Returns time-series data for all agents
 */
router.get('/api/agent-metrics/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const hours = parseInt(req.query.hours) || 12;
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Get all agents
    const agents = await awsManager.getAgents(userId);
    
    // Fetch history for each agent
    const historyPromises = agents.map(async (agent) => {
      try {
        const history = await awsManager.getAgentMetricsHistory(userId, agent.agentId, startTime);
        return {
          agentId: agent.agentId,
          name: agent.name,
          history
        };
      } catch (error) {
        console.error(`Error fetching history for agent ${agent.agentId}:`, error);
        return { agentId: agent.agentId, name: agent.name, history: [] };
      }
    });
    
    const results = await Promise.all(historyPromises);
    
    res.json({ success: true, agents: results });
  } catch (error) {
    console.error('Error fetching agent metrics history:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
