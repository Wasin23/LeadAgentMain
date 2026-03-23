import express from 'express';
import { industryFacts } from '../utils/zillizIndustryFacts.js';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();

// ── Industry Facts RAG ─────────────────────────────────────────────────────

// GET /api/training/industry-facts — list facts for industries this user has actually used
router.get('/industry-facts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    let usedIndustries = null;
    if (userId) {
      try {
        const aws = new AWSManager();
        const settings = await aws.getUserSettings(userId);
        usedIndustries = settings?.usedIndustryFacts || null;
      } catch {}
    }
    const result = await industryFacts.getAllFacts(usedIndustries);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/training/industry-facts/:id — delete a single fact
router.delete('/industry-facts/:id', async (req, res) => {
  try {
    const result = await industryFacts.deleteFact(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/training/industry-facts/industry/:name — delete all facts for an industry
router.delete('/industry-facts/industry/:name', async (req, res) => {
  try {
    const result = await industryFacts.deleteIndustry(req.params.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
