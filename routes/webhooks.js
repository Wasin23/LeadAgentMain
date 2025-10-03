import express from 'express';
const router = express.Router();

// Basic webhook routes - placeholder
router.post('/track', (req, res) => {
  res.json({ success: true, message: 'Webhook received' });
});

export default router;