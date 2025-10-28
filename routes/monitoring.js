import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

/**
 * MONITORING ROUTES
 * 
 * Provides API endpoints for agent monitoring system:
 * - Real-time metrics aggregation
 * - Issue tracking and logging
 * - SSE stream for live updates
 * - Multi-agent performance tracking
 */

// In-memory metric store (could be moved to DynamoDB later)
class MetricStore {
  constructor() {
    this.metrics = {
      emails: { queued: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 },
      leads: { searched: 0, found: 0, qualified: 0, contacted: 0 },
      meetings: { booked: 0 },
      agents: {},
      integrations: {
        apollo: { status: 'unknown', usage: 0, quota: 1000, lastCall: null },
        mailgun: { status: 'unknown', sent: 0, delivered: 0, lastCall: null },
        serper: { status: 'unknown', searches: 0, quota: 500, lastCall: null },
        zerobounce: { status: 'unknown', validations: 0, credits: 1000, lastCall: null }
      },
      systemHealth: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        startTime: Date.now()
      }
    };
    
    this.issues = [];
    this.maxIssues = 100;
    
    // SSE clients
    this.clients = [];
  }
  
  // Update metric
  updateMetric(category, key, value) {
    if (this.metrics[category] && this.metrics[category][key] !== undefined) {
      if (typeof value === 'number') {
        this.metrics[category][key] = value;
      }
    }
    this.broadcastUpdate('metric_update', { category, key, value });
  }
  
  // Increment metric
  incrementMetric(category, key, amount = 1) {
    if (this.metrics[category] && typeof this.metrics[category][key] === 'number') {
      this.metrics[category][key] += amount;
      this.broadcastUpdate('metric_update', { category, key, value: this.metrics[category][key] });
    }
  }
  
  // Update agent status
  updateAgentStatus(agentId, agentType, status, metrics = {}) {
    if (!this.metrics.agents[agentId]) {
      this.metrics.agents[agentId] = {
        type: agentType,
        status: 'idle',
        metrics: {},
        lastActivity: null
      };
    }
    
    this.metrics.agents[agentId].status = status;
    this.metrics.agents[agentId].lastActivity = Date.now();
    
    if (Object.keys(metrics).length > 0) {
      this.metrics.agents[agentId].metrics = { ...this.metrics.agents[agentId].metrics, ...metrics };
    }
    
    this.broadcastUpdate('agent_status_change', { agentId, status, metrics });
  }
  
  // Update integration status
  updateIntegration(service, data) {
    if (this.metrics.integrations[service]) {
      this.metrics.integrations[service] = {
        ...this.metrics.integrations[service],
        ...data,
        lastCall: Date.now()
      };
      this.broadcastUpdate('integration_update', { service, data: this.metrics.integrations[service] });
    }
  }
  
  // Add issue
  addIssue(severity, message, agentId, details = {}) {
    const issue = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      severity, // 'error', 'warning', 'info'
      message,
      agentId,
      details,
      resolved: false
    };
    
    this.issues.unshift(issue);
    
    // Keep only last maxIssues
    if (this.issues.length > this.maxIssues) {
      this.issues = this.issues.slice(0, this.maxIssues);
    }
    
    this.broadcastUpdate('issue_detected', issue);
    
    return issue;
  }
  
  // Resolve issue
  resolveIssue(issueId) {
    const issue = this.issues.find(i => i.id === issueId);
    if (issue) {
      issue.resolved = true;
      issue.resolvedAt = new Date().toISOString();
      this.broadcastUpdate('issue_resolved', issue);
      return issue;
    }
    return null;
  }
  
  // Get all metrics
  getMetrics() {
    return {
      ...this.metrics,
      systemHealth: {
        ...this.metrics.systemHealth,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    };
  }
  
  // Get issues (optionally filtered)
  getIssues(filters = {}) {
    let filteredIssues = this.issues;
    
    if (filters.severity) {
      filteredIssues = filteredIssues.filter(i => i.severity === filters.severity);
    }
    
    if (filters.agentId) {
      filteredIssues = filteredIssues.filter(i => i.agentId === filters.agentId);
    }
    
    if (filters.resolved !== undefined) {
      filteredIssues = filteredIssues.filter(i => i.resolved === filters.resolved);
    }
    
    return filteredIssues;
  }
  
  // SSE: Add client
  addClient(res) {
    const clientId = Date.now();
    this.clients.push({ id: clientId, res });
    
    console.log(`📡 [MONITORING] SSE client connected: ${clientId} (Total: ${this.clients.length})`);
    
    return clientId;
  }
  
  // SSE: Remove client
  removeClient(clientId) {
    this.clients = this.clients.filter(c => c.id !== clientId);
    console.log(`📡 [MONITORING] SSE client disconnected: ${clientId} (Total: ${this.clients.length})`);
  }
  
  // SSE: Broadcast update
  broadcastUpdate(eventType, data) {
    const message = {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    };
    
    const sseData = `data: ${JSON.stringify(message)}\n\n`;
    
    this.clients.forEach(client => {
      try {
        client.res.write(sseData);
      } catch (error) {
        console.error(`📡 [MONITORING] Failed to send to client ${client.id}:`, error.message);
        this.removeClient(client.id);
      }
    });
  }
}

// Global metric store instance
const metricStore = new MetricStore();

// Helper function for broadcasting activity events from other modules
export function broadcastActivity(activity) {
  if (metricStore && metricStore.broadcastUpdate) {
    metricStore.broadcastUpdate('activity_added', activity);
  }
}

// Export for use by other modules
router.metricStore = metricStore;

/**
 * GET /api/monitoring/metrics
 * Get current metrics snapshot with real-time AWS email queue data
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = metricStore.getMetrics();
    
    // Fetch real-time email queue stats from AWS
    if (req.user && req.user.userId) {
      try {
        const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
        const awsQueue = getAWSEmailQueue();
        const awsStats = await awsQueue.getAllStats(req.user.userId);
        
        // Override the in-memory metrics with real AWS data
        metrics.emails = {
          ...metrics.emails,
          queued: awsStats.queued || 0,
          sent: awsStats.sent || 0,
          replied: awsStats.replied || 0,
          // Keep other metrics from in-memory store
          delivered: metrics.emails.delivered || 0,
          opened: metrics.emails.opened || 0,
          clicked: metrics.emails.clicked || 0
        };
        
        console.log(`📊 [MONITORING] AWS Email Stats for user ${req.user.userId}:`, awsStats);
      } catch (awsError) {
        console.error('⚠️ [MONITORING] Error fetching AWS email stats:', awsError);
        // Continue with in-memory metrics if AWS fails
      }
    }
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [MONITORING] Error getting metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monitoring/issues
 * Get issue log (with optional filters)
 */
router.get('/issues', (req, res) => {
  try {
    const { severity, agentId, resolved } = req.query;
    
    const filters = {};
    if (severity) filters.severity = severity;
    if (agentId) filters.agentId = agentId;
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    
    const issues = metricStore.getIssues(filters);
    
    res.json({
      success: true,
      issues,
      count: issues.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [MONITORING] Error getting issues:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monitoring/activity
 * Returns merged activity: important issues (agent created/deleted/budget) + cycle logs
 */
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();

    // Fetch persistent issues (from DynamoDB)
    const persistentIssues = await awsManager.getIssues(userId, 200).catch(err => {
      console.error('[MONITORING] Failed to fetch persistent issues:', err);
      return [];
    });

    // Fetch recent cycle logs
    const cycleLogs = await awsManager.getCycleLogs(userId, null, 200).catch(err => {
      console.error('[MONITORING] Failed to fetch cycle logs:', err);
      return [];
    });

    // Normalize persistentIssues to unified activity shape
    const issuesActivity = (persistentIssues || []).map(item => ({
      type: item.type || 'info',
      category: 'issue',
      title: item.title || item.issueId || 'Issue',
      message: item.message || '',
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      metadata: item.metadata || {},
      raw: item
    }));

    // Normalize cycle logs
    const cyclesActivity = (cycleLogs || []).map(cycle => ({
      type: cycle.success === false ? 'error' : 'info',
      category: 'cycle',
      title: `Cycle ${cycle.cycleNumber || ''} - ${cycle.agentId || ''}`.trim(),
      message: `Cycle ${cycle.cycleNumber || ''} completed. Leads: ${cycle.leadsProcessed || 0}, Emails: ${cycle.emailsSent || 0}`,
      timestamp: cycle.completedAt || cycle.timestamp || new Date().toISOString(),
      metadata: {
        agentId: cycle.agentId,
        duration: cycle.duration,
        leadsProcessed: cycle.leadsProcessed,
        emailsSent: cycle.emailsSent,
        cycleNumber: cycle.cycleNumber
      },
      raw: cycle
    }));

    // Merge and sort by timestamp desc
    const merged = [...issuesActivity, ...cyclesActivity].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, activities: merged, count: merged.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ [MONITORING] Error getting activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monitoring/stream
 * SSE endpoint for real-time updates with AWS email queue data
 */
router.get('/stream', authenticateToken, async (req, res) => {
  console.log('📊 [MONITORING] New client connected, userId:', req.user?.userId);
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Add client
  const clientId = metricStore.addClient(res);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: new Date().toISOString() })}\n\n`);
  
  // Send initial metrics with AWS email queue data
  const initialMetrics = metricStore.getMetrics();
  
  // Fetch real-time email queue stats from AWS
  if (req.user && req.user.userId) {
    try {
      const { getAWSEmailQueue } = await import('../utils/awsEmailQueue.js');
      const awsQueue = getAWSEmailQueue();
      const awsStats = await awsQueue.getAllStats(req.user.userId);
      
      // Override with real AWS data
      initialMetrics.emails = {
        ...initialMetrics.emails,
        queued: awsStats.queued || 0,
        sent: awsStats.sent || 0,
        replied: awsStats.replied || 0
      };
      
      console.log(`📊 [MONITORING SSE] AWS Email Stats:`, awsStats);
    } catch (awsError) {
      console.error('⚠️ [MONITORING SSE] Error fetching AWS email stats:', awsError);
    }
  }
  
  res.write(`data: ${JSON.stringify({ type: 'initial_metrics', data: initialMetrics, timestamp: new Date().toISOString() })}\n\n`);
  
  // Handle client disconnect
  req.on('close', () => {
    metricStore.removeClient(clientId);
  });
  
  // Keep alive ping every 30 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`: keepalive\n\n`);
    } catch (error) {
      clearInterval(keepAliveInterval);
      metricStore.removeClient(clientId);
    }
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });
});

/**
 * POST /api/monitoring/issue/:id/resolve
 * Mark an issue as resolved
 */
router.post('/issue/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const issue = metricStore.resolveIssue(id);
    
    if (issue) {
      res.json({
        success: true,
        issue,
        message: 'Issue marked as resolved'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }
  } catch (error) {
    console.error('❌ [MONITORING] Error resolving issue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monitoring/agents/:agentId/metrics
 * Get metrics for specific agent
 */
router.get('/agents/:agentId/metrics', (req, res) => {
  try {
    const { agentId } = req.params;
    const metrics = metricStore.getMetrics();
    
    if (metrics.agents[agentId]) {
      res.json({
        success: true,
        agent: metrics.agents[agentId],
        agentId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
  } catch (error) {
    console.error('❌ [MONITORING] Error getting agent metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/monitoring/metric
 * Manually update a metric (for testing or external integrations)
 */
router.post('/metric', (req, res) => {
  try {
    const { category, key, value, operation = 'set' } = req.body;
    
    if (!category || !key) {
      return res.status(400).json({
        success: false,
        error: 'category and key are required'
      });
    }
    
    if (operation === 'increment') {
      metricStore.incrementMetric(category, key, value || 1);
    } else {
      metricStore.updateMetric(category, key, value);
    }
    
    res.json({
      success: true,
      message: 'Metric updated',
      category,
      key,
      value
    });
  } catch (error) {
    console.error('❌ [MONITORING] Error updating metric:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/monitoring/activity/:issueId/mark-read
 * Mark activity/issue as read
 */
router.post('/activity/:issueId/mark-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { issueId } = req.params;
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    const result = await awsManager.markIssueAsRead(userId, issueId);
    
    if (result.success) {
      res.json({ success: true, message: 'Activity marked as read' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ [MONITORING] Error marking activity as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/monitoring/activity/clear-all
 * Clear all activity logs from DynamoDB (both issues and cycle logs)
 */
router.delete('/activity/clear-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    // Clear all issues for this user
    const issuesResult = await awsManager.clearAllIssues(userId);
    
    // Clear all cycle logs for this user
    const cycleLogsResult = await awsManager.clearAllCycleLogs(userId);
    
    if (issuesResult.success && cycleLogsResult.success) {
      res.json({ 
        success: true, 
        message: 'All activity logs cleared',
        deleted: {
          issues: issuesResult.deleted,
          cycleLogs: cycleLogsResult.deleted
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: issuesResult.error || cycleLogsResult.error 
      });
    }
  } catch (error) {
    console.error('❌ [MONITORING] Error clearing all activities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
export { metricStore };
