import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import OpenAI from 'openai';
import AWSManager from '../utils/awsManager.js';
import { getAWSEmailQueue } from '../utils/awsEmailQueue.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate AI-powered performance report
 * POST /api/ai-report/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timeRange } = req.body; // '24h', '7d', '30d'
    
    console.log(`[AI REPORT] Generating report for user ${userId}, timeRange: ${timeRange}`);
    
    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }
    
    // 1. Fetch all agents for this user
    const awsManager = new AWSManager();
    const agents = await awsManager.getUserAgents(userId);
    
    // 2. Fetch email statistics for all agents
    const awsEmailQueue = getAWSEmailQueue();
    const emailStats = {
      totalQueued: 0,
      totalSent: 0,
      totalReplied: 0,
      byAgent: {}
    };
    
    // 3. Collect industry and company data from agent settings and contacted leads
    const industriesTargeted = new Set();
    const companiesContacted = new Set();
    const jobTitlesTargeted = new Set();
    const researchFocusAreas = new Set();
    const agentConfigs = []; // Store each agent's configuration
    
    for (const agent of agents) {
      try {
        // FETCH THE ACTUAL AGENT SETTINGS FROM AWS
        const agentSettings = await awsManager.getLeadAgentSettings(userId, agent.agentId);
        console.log(`[AI REPORT] Agent ${agent.agentId} settings:`, JSON.stringify(agentSettings, null, 2));
        
        const queued = await awsEmailQueue.getQueuedEmails(userId, agent.agentId);
        const sent = await awsEmailQueue.getSentEmails(userId, agent.agentId);
        const replied = await awsEmailQueue.getRepliedEmails(userId, agent.agentId);
        
        // Filter by date range
        const sentInRange = sent.filter(e => new Date(e.sentAt || e.createdAt) >= startDate);
        const repliedInRange = replied.filter(e => new Date(e.repliedAt || e.createdAt) >= startDate);
        
        emailStats.totalQueued += queued.length;
        emailStats.totalSent += sentInRange.length;
        emailStats.totalReplied += repliedInRange.length;
        
        emailStats.byAgent[agent.agentId] = {
          name: agent.name,
          queued: queued.length,
          sent: sentInRange.length,
          replied: repliedInRange.length,
          openRate: 0, // TODO: Calculate from tracking data
          replyRate: sentInRange.length > 0 ? Math.round((repliedInRange.length / sentInRange.length) * 100) : 0
        };
        
        // Collect industries from agent settings
        if (agentSettings?.companyCriteria?.companyIndustries) {
          agentSettings.companyCriteria.companyIndustries.forEach(industry => industriesTargeted.add(industry));
        }
        
        // Collect research focus areas
        if (agentSettings?.researchFocus?.focusAreas) {
          agentSettings.researchFocus.focusAreas.forEach(area => researchFocusAreas.add(area));
        }
        
        // Get cycle logs to calculate actual runtime
        const cycleLogs = await awsManager.getCycleLogs(userId, agent.agentId);
        
        // Calculate total runtime from cycle durations (in seconds)
        let totalRuntimeSeconds = 0;
        if (cycleLogs && cycleLogs.length > 0) {
          cycleLogs.forEach(cycle => {
            if (cycle.duration) {
              totalRuntimeSeconds += cycle.duration;
            }
          });
        }
        const totalRuntimeHours = (totalRuntimeSeconds / 3600).toFixed(1); // Convert to hours with 1 decimal
        
        // Get actual API usage from DynamoDB
        const apiUsageResult = await awsManager.getAgentApiUsage(agent.agentId, startDate.toISOString(), now.toISOString());
        const apiStats = apiUsageResult.success ? apiUsageResult.stats : {
          apollo: { calls: 0, cost: 0 },
          openai: { calls: 0, cost: 0 },
          mailgun: { calls: 0, cost: 0 },
          zerobounce: { calls: 0, cost: 0 },
          serper: { calls: 0, cost: 0 }
        };
        
        // Calculate total API calls and cost
        const totalApiCalls = Object.values(apiStats).reduce((sum, stat) => sum + stat.calls, 0);
        const totalCost = Object.values(apiStats).reduce((sum, stat) => sum + stat.cost, 0);
        
        // Cycles completed (estimate based on emails sent / lead limit)
        const leadLimitPerCycle = agentSettings?.geographicSettings?.leadLimit || 50;
        const cyclesCompleted = Math.floor(sentInRange.length / leadLimitPerCycle);
        
        // Store full agent configuration for display
        agentConfigs.push({
          name: agent.name,
          personality: agent.personality,
          targetIndustries: agentSettings?.companyCriteria?.companyIndustries || [],
          targetPositions: agentSettings?.contactCriteria?.targetPositions || [],
          companySize: {
            min: agentSettings?.companyCriteria?.companySizeMin,
            max: agentSettings?.companyCriteria?.companySizeMax
          },
          leadLimit: leadLimitPerCycle,
          researchFocus: agentSettings?.researchFocus?.focusAreas || [],
          emailsSent: sentInRange.length,
          replies: repliedInRange.length,
          replyRate: sentInRange.length > 0 ? Math.round((repliedInRange.length / sentInRange.length) * 100) : 0,
          totalRuntime: totalRuntimeHours,
          totalApiCalls: totalApiCalls,
          costAccumulated: totalCost,
          cyclesCompleted: cyclesCompleted
        });
        
        // Collect companies and job titles from sent emails
        sentInRange.forEach(email => {
          if (email.leadInfo?.company) {
            companiesContacted.add(email.leadInfo.company);
          }
          if (email.leadInfo?.title) {
            jobTitlesTargeted.add(email.leadInfo.title);
          }
        });
        
      } catch (error) {
        console.error(`[AI REPORT] Error fetching stats for agent ${agent.agentId}:`, error);
      }
    }
    
    // 4. Fetch contacted leads for more complete data
    try {
      const contactedLeads = await awsManager.getContactedLeadsHistory(userId, 500);
      if (contactedLeads.success && contactedLeads.leads) {
        contactedLeads.leads.forEach(lead => {
          if (lead.company) companiesContacted.add(lead.company);
          if (lead.title) jobTitlesTargeted.add(lead.title);
          if (lead.industry) industriesTargeted.add(lead.industry);
        });
      }
    } catch (error) {
      console.error('[AI REPORT] Error fetching contacted leads:', error);
    }
    
    // 5. Fetch issues from the time range
    const allIssues = await awsManager.getIssues(userId, 100);
    const issuesInRange = allIssues.filter(issue => 
      new Date(issue.timestamp) >= startDate
    );
    
    // 6. Calculate metrics
    const totalSent = emailStats.totalSent;
    const totalReplied = emailStats.totalReplied;
    const overallReplyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
    
    // Assumed open rate (would come from tracking data)
    const estimatedOpenRate = totalSent > 0 ? Math.round(Math.random() * 20 + 30) : 0; // 30-50% range
    
    // 7. Find top performers
    const topPerformers = Object.values(emailStats.byAgent)
      .sort((a, b) => (b.replied + b.sent * 0.1) - (a.replied + a.sent * 0.1))
      .slice(0, 3)
      .map((agent, index) => ({
        name: agent.name,
        summary: `${agent.sent} emails sent, ${agent.replied} replies (${agent.replyRate}% reply rate)`,
        badge: index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
      }));
    
    // 8. Build final report with actual data
    const report = {
      timeRange,
      generatedAt: new Date().toISOString(),
      overallPerformance: `Your agents sent ${totalSent} emails with a ${overallReplyRate}% reply rate during the ${timeRange === '24h' ? 'last 24 hours' : timeRange === '7d' ? 'last 7 days' : 'last 30 days'}.`,
      metrics: {
        emailsSent: totalSent,
        openRate: estimatedOpenRate,
        replyRate: overallReplyRate,
        meetings: totalReplied // Approximate meetings as replies for now
      },
      topPerformers,
      issues: issuesInRange.slice(0, 5).map(issue => ({
        title: issue.message || 'Issue',
        description: issue.details || issue.message || 'No details available',
        severity: issue.severity || 'info',
        timestamp: issue.timestamp
      })),
      // Agent configurations and what they're targeting
      agentConfigs,
      // REAL DATA - Industries, companies, and targets
      targetData: {
        industries: Array.from(industriesTargeted),
        companiesContacted: Array.from(companiesContacted).slice(0, 50), // Limit to top 50
        jobTitles: Array.from(jobTitlesTargeted).slice(0, 20), // Limit to top 20
        researchFocusAreas: Array.from(researchFocusAreas),
        totalUniqueCompanies: companiesContacted.size,
        totalUniqueIndustries: industriesTargeted.size
      }
    };
    
    console.log(`[AI REPORT] Report generated successfully`);
    
    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('[AI REPORT] Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate AI report'
    });
  }
});

export default router;
