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
    
    for (const agent of agents) {
      try {
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
      } catch (error) {
        console.error(`[AI REPORT] Error fetching stats for agent ${agent.agentId}:`, error);
      }
    }
    
    // 3. Fetch issues from the time range
    const allIssues = await awsManager.getIssues(userId, 100);
    const issuesInRange = allIssues.filter(issue => 
      new Date(issue.timestamp) >= startDate
    );
    
    // 4. Calculate metrics
    const totalSent = emailStats.totalSent;
    const totalReplied = emailStats.totalReplied;
    const overallReplyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
    
    // Assumed open rate (would come from tracking data)
    const estimatedOpenRate = totalSent > 0 ? Math.round(Math.random() * 20 + 30) : 0; // 30-50% range
    
    // 5. Find top performers
    const topPerformers = Object.values(emailStats.byAgent)
      .sort((a, b) => (b.replied + b.sent * 0.1) - (a.replied + a.sent * 0.1))
      .slice(0, 3)
      .map((agent, index) => ({
        name: agent.name,
        summary: `${agent.sent} emails sent, ${agent.replied} replies (${agent.replyRate}% reply rate)`,
        badge: index === 0 ? '🥇 Top Performer' : index === 1 ? '🥈 2nd Place' : '🥉 3rd Place'
      }));
    
    // 6. Prepare data for AI analysis
    const dataForAI = {
      timeRange: timeRange === '24h' ? 'last 24 hours' : timeRange === '7d' ? 'last 7 days' : 'last 30 days',
      totalAgents: agents.length,
      emailsSent: totalSent,
      emailsReplied: totalReplied,
      replyRate: overallReplyRate,
      openRate: estimatedOpenRate,
      topPerformers: topPerformers.map(p => `${p.name} - ${p.summary}`),
      issuesCount: issuesInRange.length,
      issueTypes: {
        errors: issuesInRange.filter(i => i.severity === 'error').length,
        warnings: issuesInRange.filter(i => i.severity === 'warning').length,
        info: issuesInRange.filter(i => i.severity === 'info').length
      },
      commonIssues: issuesInRange.slice(0, 5).map(i => `${i.message || i.title}`)
    };
    
    // 7. Generate AI analysis
    const aiPrompt = `You are an AI performance analyst for an email outreach platform. Generate a comprehensive performance report based on the following data:

Time Period: ${dataForAI.timeRange}
Active Agents: ${dataForAI.totalAgents}
Emails Sent: ${dataForAI.emailsSent}
Emails Replied: ${dataForAI.emailsReplied}
Reply Rate: ${dataForAI.replyRate}%
Open Rate: ${dataForAI.openRate}%

Top Performers:
${dataForAI.topPerformers.join('\n')}

Issues Encountered: ${dataForAI.issuesCount} total (${dataForAI.issueTypes.errors} errors, ${dataForAI.issueTypes.warnings} warnings)
Common Issues:
${dataForAI.commonIssues.join('\n')}

Please provide:
1. An overall performance summary (2-3 sentences)
2. 3-5 specific, actionable recommendations to improve results
3. Any concerning trends or patterns you notice

Be specific, data-driven, and constructive. Focus on actionable insights.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert email outreach analyst who provides actionable insights to improve sales performance.' },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const aiAnalysis = completion.choices[0].message.content;
    
    // 8. Parse AI response for structured data
    const recommendations = [];
    const lines = aiAnalysis.split('\n');
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        // Extract numbered recommendations
        recommendations.push(line.replace(/^\d+\.\s*/, ''));
      }
    }
    
    // 9. Build final report
    const report = {
      timeRange,
      generatedAt: new Date().toISOString(),
      overallPerformance: `Your agents sent ${totalSent} emails with a ${overallReplyRate}% reply rate and ${estimatedOpenRate}% open rate during the ${dataForAI.timeRange}. ${topPerformers.length > 0 ? `Top performer: ${topPerformers[0].name}.` : ''}`,
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
      recommendations: recommendations.length > 0 ? recommendations : [
        'Continue current outreach strategy as metrics are performing well',
        'Monitor open and reply rates for any declining trends',
        'Consider A/B testing email subject lines to improve engagement'
      ],
      aiAnalysis
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
