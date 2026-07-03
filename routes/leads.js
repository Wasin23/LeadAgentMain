import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { activeTimelineUsers } from '../utils/leadTimelineProcessor.js';

const router = express.Router();
router.use(authenticateToken);
const awsManager = new AWSManager();

// Star a lead — adds to starred list and enqueues for timeline research
router.post('/star', async (req, res) => {
  try {
    const { leadId, email, name, company, agentId } = req.body;
    if (!leadId) return res.status(400).json({ success: false, error: 'leadId required' });
    await awsManager.starLead(req.user.userId, { leadId, email, name, company, agentId });
    activeTimelineUsers.add(req.user.userId);
    res.json({ success: true });
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

// Get all starred leads
router.get('/starred', async (req, res) => {
  try {
    const starred = await awsManager.getStarredLeads(req.user.userId);
    res.json({ success: true, starred });
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
