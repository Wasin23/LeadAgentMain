import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/jwt.js';
import { chatLabManager } from '../utils/chatLabManager.js';
import { zillizCompanyMemory } from '../utils/zillizCompanyMemory.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const mistral = new OpenAI({
  apiKey:  process.env.MISTRAL_API_KEY,
  baseURL: 'https://api.mistral.ai/v1',
});

router.use(authenticateToken);

const uid = req => req.user?.userId || req.user?.id;

// ── Sessions ──────────────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
  try {
    const { agentId, limit } = req.query;
    const sessions = await chatLabManager.listSessions(uid(req), {
      agentId: agentId || undefined,
      limit:   limit ? Number(limit) : 50,
    });
    res.json({ sessions });
  } catch (err) {
    console.error('[CHAT LAB] list sessions:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.get('/sessions/count', async (req, res) => {
  try {
    const count = await chatLabManager.getSessionCount(uid(req));
    res.json({ count });
  } catch (err) {
    console.error('[CHAT LAB] count sessions:', err);
    res.status(500).json({ error: 'Failed to count sessions' });
  }
});

router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { createdAt } = req.query;
    if (!createdAt) return res.status(400).json({ error: 'createdAt required' });
    const session = await chatLabManager.getSession(uid(req), req.params.sessionId, createdAt);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    console.error('[CHAT LAB] get session:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

router.get('/sessions/:sessionId/context', async (req, res) => {
  try {
    const { createdAt } = req.query;
    if (!createdAt) return res.status(400).json({ error: 'createdAt required' });

    const session = await chatLabManager.getSession(uid(req), req.params.sessionId, createdAt);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const awsManager = (await import('../utils/awsManager.js')).default;
    const aws = new awsManager();

    // Fetch lead data and email in parallel
    const [leadData, emailData, promptData, docList] = await Promise.allSettled([
      session.leadId
        ? aws.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).GetCommand({
            TableName: process.env.AWS_DYNAMODB_LEAD_DATA_TABLE || 'meridian-lead-data',
            Key: { userId: uid(req), leadId: session.leadId },
          })).then(r => r.Item || null)
        : null,
      session.emailId
        ? aws.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).GetCommand({
            TableName: process.env.AWS_DYNAMODB_EMAIL_TRACKING_TABLE || 'meridian-email-tracking-v2',
            Key: { userId: uid(req), emailId: session.emailId },
          })).then(r => r.Item || null)
        : null,
      chatLabManager.getSystemPrompt(uid(req), session.agentId),
      zillizCompanyMemory.listDocuments(uid(req)),
    ]);

    res.json({
      session,
      leadData:   leadData.status   === 'fulfilled' ? leadData.value   : null,
      emailData:  emailData.status  === 'fulfilled' ? emailData.value  : null,
      promptData: promptData.status === 'fulfilled' ? promptData.value : null,
      docs:       docList.status    === 'fulfilled' ? docList.value    : [],
    });
  } catch (err) {
    console.error('[CHAT LAB] session context:', err);
    res.status(500).json({ error: 'Failed to get session context' });
  }
});

// ── System Prompt ─────────────────────────────────────────────────────────────

router.get('/prompt', async (req, res) => {
  try {
    const { agentId } = req.query;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });
    const prompt = await chatLabManager.getSystemPrompt(uid(req), agentId);
    res.json({ prompt });
  } catch (err) {
    console.error('[CHAT LAB] get prompt:', err);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

router.get('/prompt/versions', async (req, res) => {
  try {
    const { agentId } = req.query;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });
    const versions = await chatLabManager.listPromptVersions(uid(req), agentId);
    res.json({ versions });
  } catch (err) {
    console.error('[CHAT LAB] list prompt versions:', err);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

router.post('/prompt', async (req, res) => {
  try {
    const { agentId, promptText } = req.body;
    if (!agentId || !promptText) return res.status(400).json({ error: 'agentId and promptText required' });
    const version = await chatLabManager.saveSystemPrompt(uid(req), agentId, promptText);
    res.json({ version });
  } catch (err) {
    console.error('[CHAT LAB] save prompt:', err);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

router.delete('/prompt/versions/:version', async (req, res) => {
  try {
    const { agentId } = req.query;
    const version = Number(req.params.version);
    if (!agentId || isNaN(version)) return res.status(400).json({ error: 'agentId and version required' });
    await chatLabManager.deletePromptVersion(uid(req), agentId, version);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CHAT LAB] delete prompt version:', err);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// ── Knowledge Base (RAG) ──────────────────────────────────────────────────────

router.get('/docs', async (req, res) => {
  try {
    const docs = await zillizCompanyMemory.listDocuments(uid(req));
    res.json({ docs });
  } catch (err) {
    console.error('[CHAT LAB] list docs:', err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.post('/docs', upload.single('file'), async (req, res) => {
  try {
    const { type = 'general' } = req.body;
    let text = '';
    const file = req.file;

    if (file) {
      const name = file.originalname?.toLowerCase() || '';
      if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
        const parsed = await pdfParse(file.buffer);
        text = parsed.text;
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else {
        text = file.buffer.toString('utf-8');
      }
    } else if (req.body.text) {
      text = req.body.text;
    }

    if (!text?.trim()) return res.status(400).json({ error: 'No text content found' });

    const source = file?.originalname || 'manual';
    const result = await zillizCompanyMemory.ingestDocument(uid(req), { text, source, type });
    res.json({ ok: true, ...result, source });
  } catch (err) {
    console.error('[CHAT LAB] ingest doc:', err);
    res.status(500).json({ error: 'Failed to ingest document' });
  }
});

router.patch('/docs/:docId/type', async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) return res.status(400).json({ error: 'type required' });
    await zillizCompanyMemory.updateDocType(uid(req), req.params.docId, type);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CHAT LAB] update doc type:', err);
    res.status(500).json({ error: 'Failed to update type' });
  }
});

router.delete('/docs/:docId', async (req, res) => {
  try {
    await zillizCompanyMemory.deleteDocument(uid(req), req.params.docId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CHAT LAB] delete doc:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Semantic search — chunks inspector
router.post('/docs/retrieve', async (req, res) => {
  try {
    const { query, topK, type } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const chunks = await zillizCompanyMemory.retrieve(uid(req), query, {
      topK: topK || 4,
      type: type || null,
    });
    res.json({ chunks });
  } catch (err) {
    console.error('[CHAT LAB] retrieve chunks:', err);
    res.status(500).json({ error: 'Failed to retrieve chunks' });
  }
});

// ── Test Chat (Mistral) ───────────────────────────────────────────────────────

const PERSONALITY_TONES = {
  HUNTER:       'Direct and observational. Lead with a specific noticed fact. No warmth required, no aggression. The edge is specificity, not tone.',
  RELATIONSHIP: 'Warm and genuinely curious. Specific detail earns the right to continue. Sound like a smart person who finds this interesting, not a salesperson being friendly on purpose.',
  ANALYST:      'Inference-driven. Form a flat take from a data point. The opinion sounds like a logical conclusion, not a feeling. State it and let it work.',
  CONSULTANT:   'Strategic peer. Slightly knowing, not impressive. A quiet reframe — collegial, not condescending. Sound like a trusted advisor who already half-knows the situation.',
  NETWORKER:    'Socially aware. Name what is happening in this space right now. The lead feels part of a moment, not a pitch list. Light, moves fast.',
};

router.post('/test-chat', async (req, res) => {
  try {
    const {
      lead       = {},
      personality = 'HUNTER',
      systemPrompt,
      messages   = [],
      agentId,
    } = req.body;

    const lastUserMessage = messages.at(-1)?.content || '';

    // RAG: retrieve relevant chunks based on the last message
    let chunks = [];
    try {
      chunks = await zillizCompanyMemory.retrieve(uid(req), lastUserMessage, { topK: 4 });
    } catch { /* no docs yet — that's fine */ }

    const ragContext = chunks.length
      ? `\n\nRELEVANT COMPANY KNOWLEDGE:\n${chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.text}`).join('\n\n')}`
      : '';

    const tone     = PERSONALITY_TONES[personality] || PERSONALITY_TONES.HUNTER;
    const basePrompt = systemPrompt || `You are an AI sales representative having a live chat with ${lead.name || 'a prospect'} from ${lead.company || 'their company'}.`;

    const resolvedPrompt = basePrompt
      .replace(/{lead_name}/g,       lead.name       || 'the lead')
      .replace(/{lead_company}/g,    lead.company    || 'their company')
      .replace(/{lead_title}/g,      lead.title      || '')
      .replace(/{personality_tone}/g, tone)
      .replace(/{company_name}/g,    'the company')
      .replace(/{original_email}/g,  '');

    const systemContent = [
      resolvedPrompt,
      lead.painPoints    ? `\nLead pain points: ${lead.painPoints}` : '',
      lead.recentSignals ? `\nRecent signals: ${lead.recentSignals}` : '',
      ragContext,
    ].join('');

    const history = messages.slice(-10).map(m => ({
      role:    m.role === 'lead' ? 'user' : 'assistant',
      content: m.content,
    }));

    const completion = await mistral.chat.completions.create({
      model:    'mistral-medium-latest',
      messages: [
        { role: 'system', content: systemContent },
        ...history,
      ],
      temperature: 0.7,
      max_tokens:  600,
    });

    const reply = completion.choices[0]?.message?.content || '';

    res.json({
      reply,
      retrievedChunks: chunks.map(c => `(${c.source}) ${c.text.slice(0, 200)}...`),
    });
  } catch (err) {
    console.error('[CHAT LAB] test-chat:', err);
    res.status(500).json({ error: 'Chat failed: ' + err.message });
  }
});

export default router;
