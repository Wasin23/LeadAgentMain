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

    // Backfill placeholder names from the lead table
    const isPlaceholder = n => !n || n === 'Unknown' || n === 'Lead' || n === 'Guest';
    const needsName = sessions.filter(s => isPlaceholder(s.leadName) && s.leadId);
    if (needsName.length) {
      const { default: AWSManager } = await import('../utils/awsManager.js');
      const { GetCommand: GC, UpdateCommand: UC } = await import('@aws-sdk/lib-dynamodb');
      const aws = new AWSManager();
      await Promise.allSettled(needsName.map(async session => {
        const lead = await aws.dynamodb.send(new GC({
          TableName: process.env.AWS_DYNAMODB_LEAD_DATA_TABLE || 'meridian-lead-data',
          Key: { userId: uid(req), leadId: session.leadId },
        })).then(r => r.Item || null).catch(() => null);
        const realName = lead?.fullName || lead?.name || lead?.leadName;
        if (realName && !isPlaceholder(realName)) {
          session.leadName = realName;
          chatLabManager.dynamodb.send(new UC({
            TableName: chatLabManager.sessionTable,
            Key: { PK: chatLabManager._sessionPK(uid(req)), SK: chatLabManager._sessionSK(session.createdAt, session.sessionId) },
            UpdateExpression: 'SET leadName = :n',
            ExpressionAttributeValues: { ':n': realName },
          })).catch(() => {});
        }
      }));
    }

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

    // Backfill leadName on the session if it's a placeholder and we have real lead data
    const lead = leadData.status === 'fulfilled' ? leadData.value : null;
    const isPlaceholder = n => !n || n === 'Lead' || n === 'Guest';
    if (isPlaceholder(session.leadName) && lead) {
      const realName = lead.fullName || lead.name || lead.leadName;
      if (realName && !isPlaceholder(realName)) {
        session.leadName = realName;
        chatLabManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).UpdateCommand({
          TableName: chatLabManager.sessionTable,
          Key: { PK: chatLabManager._sessionPK(uid(req)), SK: chatLabManager._sessionSK(createdAt, req.params.sessionId) },
          UpdateExpression: 'SET leadName = :n',
          ExpressionAttributeValues: { ':n': realName },
        })).catch(() => {});
      }
    }

    res.json({
      session,
      leadData:   lead,
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

router.get('/docs/:docId/chunks', async (req, res) => {
  try {
    const chunks = await zillizCompanyMemory.getDocumentChunks(uid(req), req.params.docId);
    res.json({ chunks });
  } catch (err) {
    console.error('[CHAT LAB] get doc chunks:', err);
    res.status(500).json({ error: 'Failed to get chunks' });
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

// ── Session delete ────────────────────────────────────────────────────────────

router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { createdAt } = req.query;
    if (!createdAt) return res.status(400).json({ error: 'createdAt required' });
    const session = await chatLabManager.getSession(uid(req), req.params.sessionId, createdAt);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await chatLabManager.deleteSession(uid(req), req.params.sessionId, createdAt, session.token || null);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CHAT LAB] delete session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ── Session expiry ────────────────────────────────────────────────────────────

router.patch('/sessions/:sessionId/expiry', async (req, res) => {
  try {
    const { createdAt, expiryDays } = req.body;
    if (!createdAt) return res.status(400).json({ error: 'createdAt required' });
    const result = await chatLabManager.updateSessionExpiry(uid(req), req.params.sessionId, createdAt, expiryDays ?? null);
    res.json({ ok: true, expiresAt: result.expiresAt });
  } catch (err) {
    console.error('[CHAT LAB] update expiry:', err);
    res.status(500).json({ error: 'Failed to update expiry' });
  }
});

// ── Session snapshot edit ─────────────────────────────────────────────────────

router.patch('/sessions/:sessionId/snapshot', async (req, res) => {
  try {
    const { createdAt, researchSnapshot } = req.body;
    if (!createdAt || !researchSnapshot) return res.status(400).json({ error: 'createdAt and researchSnapshot required' });
    await chatLabManager.updateSessionSnapshot(uid(req), req.params.sessionId, createdAt, researchSnapshot);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CHAT LAB] update snapshot:', err);
    res.status(500).json({ error: 'Failed to update snapshot' });
  }
});

// ── Test Chat (Mistral) ───────────────────────────────────────────────────────

const PERSONALITY_TONES = {
  HUNTER:       'Direct and specific. Open with one precise observation — nothing generic. Plain prose only, no markdown, no bullet points. Two to three short sentences. Sound like someone who already knows the situation. Use "we" and "our" — you represent the company, not just yourself.',
  RELATIONSHIP: 'Warm and genuinely curious. Use one real detail to earn the right to continue. Plain prose only, no lists, no formatting. Write like a sharp person who actually finds this interesting — not a salesperson being friendly on purpose. Use "we" and "our" — you represent the company.',
  ANALYST:      'Inference-driven. State one logical conclusion from the data — flat, confident, not emotional. Plain prose only, no markdown. Two to three sentences. Let the take do the work. Use "we" and "our" — you represent the company, not just yourself.',
  CONSULTANT:   'Strategic peer. One quiet reframe that shows you half-know the situation already. Plain prose only, collegial, never condescending. Sound like a trusted advisor who has nothing to prove. Use "we" and "our" — you speak for the team.',
  NETWORKER:    'Light and fast. One observation about what is actually happening right now in this space. Plain prose only, no lists. Two sentences max. The lead should feel like they are part of a moment, not a sales sequence. Use "we" and "our" — you represent the company.',
};

const CHAT_STYLE = '\n\nCHAT FORMAT RULES: Write in plain, natural prose — no markdown whatsoever. No asterisks for bold, no bullet points, no numbered lists, no headers, no checkboxes. Keep replies conversational and concise. Use "we" and "our" instead of "I" and "my" — you represent the company, not just yourself. Sound like a real person in a text conversation, not a formatted email or sales pitch.';

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
      CHAT_STYLE,
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
