import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { activeTimelineUsers } from '../utils/leadTimelineProcessor.js';

const router = express.Router();
router.use(authenticateToken);
const awsManager = new AWSManager();

// Star a lead — adds to starred list and enqueues for timeline research.
// Capped per plan (maxStarredLeads in plan config).
router.post('/star', async (req, res) => {
  try {
    const { leadId, email, name, company, agentId } = req.body;
    if (!leadId) return res.status(400).json({ success: false, error: 'leadId required' });

    const [user, starred] = await Promise.all([
      awsManager.getUserById(req.user.userId),
      awsManager.getStarredLeads(req.user.userId),
    ]);
    const planConfig = awsManager.getPlanConfig(user?.plan || 'free-trial');
    const limit = planConfig.maxStarredLeads ?? 3;
    const alreadyStarred = starred.some(l => l.leadId === leadId);

    if (!alreadyStarred && starred.length >= limit) {
      return res.status(403).json({
        success: false,
        error: `Your ${planConfig.name} plan allows up to ${limit} starred lead${limit !== 1 ? 's' : ''}. Unstar one or upgrade your plan.`,
        limit,
        current: starred.length,
      });
    }

    await awsManager.starLead(req.user.userId, { leadId, email, name, company, agentId });
    activeTimelineUsers.add(req.user.userId);
    res.json({ success: true, limit, current: alreadyStarred ? starred.length : starred.length + 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unstar a lead
router.delete('/star/:leadId', async (req, res) => {
  try {
    await awsManager.unstarLead(req.user.userId, req.params.leadId);
    const remaining = await awsManager.getStarredLeads(req.user.userId);
    if (remaining.length === 0) activeTimelineUsers.delete(req.user.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all starred leads (includes the plan's starred-lead limit and hidden ids for the UI)
router.get('/starred', async (req, res) => {
  try {
    const [user, starred, hidden] = await Promise.all([
      awsManager.getUserById(req.user.userId),
      awsManager.getStarredLeads(req.user.userId),
      awsManager.getHiddenLeadIds(req.user.userId),
    ]);
    const planConfig = awsManager.getPlanConfig(user?.plan || 'free-trial');
    res.json({ success: true, starred, hidden, limit: planConfig.maxStarredLeads ?? 3 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hide a lead from the Leads page (display-only; email records are untouched)
router.post('/hide', async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ success: false, error: 'leadId required' });
    await awsManager.hideLead(req.user.userId, leadId);
    // A hidden lead shouldn't keep burning research; unstar it too
    await awsManager.unstarLead(req.user.userId, leadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Batch-check which of the given emails have unsubscribed (for lead list badges)
router.post('/check-unsubscribed', async (req, res) => {
  try {
    const emails = [...new Set((req.body?.emails || [])
      .filter((e) => typeof e === 'string' && e.includes('@'))
      .map((e) => e.toLowerCase().trim()))].slice(0, 500);

    const unsubscribed = [];
    // Chunked so a big list doesn't fire 500 parallel DynamoDB queries at once
    for (let i = 0; i < emails.length; i += 25) {
      const chunk = emails.slice(i, i + 25);
      const results = await Promise.all(chunk.map(e => awsManager.isUnsubscribed(e).catch(() => false)));
      results.forEach((isUnsub, j) => { if (isUnsub) unsubscribed.push(chunk[j]); });
    }
    res.json({ success: true, unsubscribed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get timeline entries for a specific lead
router.get('/:leadId/timeline', async (req, res) => {
  try {
    const timeline = await awsManager.getLeadTimeline(req.user.userId, req.params.leadId);
    res.json({ success: true, timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
