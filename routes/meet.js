import express from 'express';
import OpenAI from 'openai';
import { chatLabManager } from '../utils/chatLabManager.js';
import { zillizCompanyMemory } from '../utils/zillizCompanyMemory.js';
import { desktopNotifications } from '../utils/desktopNotifications.js';

const router = express.Router();

const mistral = new OpenAI({
  apiKey:  process.env.MISTRAL_API_KEY,
  baseURL: 'https://api.mistral.ai/v1',
});

const PERSONALITY_TONES = {
  HUNTER:       'Direct and observational. Lead with a specific noticed fact. No warmth required, no aggression. The edge is specificity, not tone.',
  RELATIONSHIP: 'Warm and genuinely curious. Specific detail earns the right to continue. Sound like a smart person who finds this interesting, not a salesperson being friendly on purpose.',
  ANALYST:      'Inference-driven. Form a flat take from a data point. The opinion sounds like a logical conclusion, not a feeling. State it and let it work.',
  CONSULTANT:   'Strategic peer. Slightly knowing, not impressive. A quiet reframe — collegial, not condescending. Sound like a trusted advisor who already half-knows the situation.',
  NETWORKER:    'Socially aware. Name what is happening in this space right now. The lead feels part of a moment, not a pitch list. Light, moves fast.',
};

// ── Init: resolve token, create session, fire notification ────────────────────

router.get('/init/:token', async (req, res) => {
  try {
    const tokenData = await chatLabManager.resolveToken(req.params.token);
    if (!tokenData) return res.status(404).json({ error: 'Link expired or invalid' });

    const { userId, agentId, leadId, emailId, leadName, leadCompany, leadTitle, leadEmail, isFirstClick, token } = tokenData;

    // Get system prompt and agent info in parallel
    const [promptData, agentSettings] = await Promise.allSettled([
      chatLabManager.getSystemPrompt(userId, agentId),
      (async () => {
        const { getUserById } = await import('../lib/userManager.js');
        const user = await getUserById(userId);
        return (user?.activeAgents || []).find(a => a.agentId === agentId) || null;
      })(),
    ]);

    const prompt = promptData.status === 'fulfilled' ? promptData.value : null;
    const agent  = agentSettings.status === 'fulfilled' ? agentSettings.value : null;

    // Create or reuse session — one session per token
    let session = tokenData.sessionId
      ? await chatLabManager.getSession(userId, tokenData.sessionId, tokenData.sessionCreatedAt).catch(() => null)
      : null;

    if (!session) {
      const { sessionId, createdAt } = await chatLabManager.createSession(userId, {
        agentId, leadId, emailId,
        leadName, leadCompany, leadTitle, token,
      });

      // Store session ref on the token
      const { DynamoDBDocumentClient: _, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
      await chatLabManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).UpdateCommand({
        TableName: chatLabManager.tokenTable,
        Key: { token },
        UpdateExpression: 'SET sessionId = :s, sessionCreatedAt = :c',
        ExpressionAttributeValues: { ':s': sessionId, ':c': createdAt },
      }));

      session = { sessionId, createdAt, messages: [] };
    }

    // Fire notification on first click
    if (isFirstClick) {
      try {
        const AWSManager = (await import('../utils/awsManager.js')).default;
        const aws = new AWSManager();
        await Promise.allSettled([
          aws.addIssue(
            userId,
            'chat',
            'medium',
            `💬 ${leadName} opened their chat link`,
            `${leadName}${leadCompany ? ` from ${leadCompany}` : ''} just clicked their MQL Chat link and started a conversation.`,
            { token, sessionId: session.sessionId, leadName, leadCompany, leadEmail }
          ),
          Promise.resolve(desktopNotifications.notifyEmailEvent('email_clicked', {
            recipient: leadName,
            company:   leadCompany,
            message:   `${leadName}${leadCompany ? ` at ${leadCompany}` : ''} just started an MQL Chat`,
          })),
        ]);
      } catch { /* notifications are non-critical */ }
    }

    const personalityType = (agent?.personality?.type || 'hunter').toUpperCase();
    const tone = PERSONALITY_TONES[personalityType] || PERSONALITY_TONES.HUNTER;

    res.json({
      sessionId:      session.sessionId,
      sessionCreatedAt: session.createdAt,
      messages:       session.messages || [],
      agent: {
        name:    agent?.name || 'AI Assistant',
        avatar:  agent?.personality?.avatar || null,
        personality: agent?.personality?.name || null,
      },
      lead: { name: leadName, company: leadCompany, title: leadTitle },
      systemPrompt: prompt?.promptText || null,
      tone,
    });
  } catch (err) {
    console.error('[MEET] init:', err);
    res.status(500).json({ error: 'Failed to initialize chat' });
  }
});

// ── Chat: handle a message and return AI reply ────────────────────────────────

router.post('/chat', async (req, res) => {
  try {
    const { token, sessionId, sessionCreatedAt, message, history = [] } = req.body;
    if (!token || !sessionId || !message?.trim()) {
      return res.status(400).json({ error: 'token, sessionId, and message required' });
    }

    const tokenData = await chatLabManager.resolveToken(token);
    if (!tokenData) return res.status(404).json({ error: 'Link expired or invalid' });

    const { userId, agentId, leadName, leadCompany, leadTitle } = tokenData;

    // Save user message
    await chatLabManager.addMessage(userId, sessionId, sessionCreatedAt, {
      role: 'user', content: message,
    });

    // RAG retrieval
    let chunks = [];
    try {
      chunks = await zillizCompanyMemory.retrieve(userId, message, { topK: 4 });
    } catch { /* no docs */ }

    const ragContext = chunks.length
      ? `\n\nRELEVANT COMPANY KNOWLEDGE:\n${chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.text}`).join('\n\n')}`
      : '';

    // System prompt
    const [promptData, agentData] = await Promise.allSettled([
      chatLabManager.getSystemPrompt(userId, agentId),
      (async () => {
        const { getUserById } = await import('../lib/userManager.js');
        const user = await getUserById(userId);
        return (user?.activeAgents || []).find(a => a.agentId === agentId) || null;
      })(),
    ]);

    const promptText = promptData.status === 'fulfilled' && promptData.value?.promptText
      ? promptData.value.promptText
      : `You are an AI sales representative having a live chat with ${leadName} from ${leadCompany}.`;

    const agent = agentData.status === 'fulfilled' ? agentData.value : null;
    const personalityType = (agent?.personality?.type || 'hunter').toUpperCase();
    const tone = PERSONALITY_TONES[personalityType] || PERSONALITY_TONES.HUNTER;

    const resolvedPrompt = promptText
      .replace(/{lead_name}/g,        leadName    || 'the lead')
      .replace(/{lead_company}/g,     leadCompany || 'their company')
      .replace(/{lead_title}/g,       leadTitle   || '')
      .replace(/{personality_tone}/g, tone)
      .replace(/{company_name}/g,     'the company')
      .replace(/{original_email}/g,   '');

    const systemContent = resolvedPrompt + ragContext;

    const messages = [
      { role: 'system', content: systemContent },
      ...history.slice(-10).map((m) => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await mistral.chat.completions.create({
      model:       'mistral-medium-latest',
      messages,
      temperature: 0.7,
      max_tokens:  600,
    });

    const reply = completion.choices[0]?.message?.content || '';

    // Save assistant reply
    await chatLabManager.addMessage(userId, sessionId, sessionCreatedAt, {
      role: 'assistant', content: reply,
    });

    res.json({ reply });
  } catch (err) {
    console.error('[MEET] chat:', err);
    res.status(500).json({ error: 'Chat failed: ' + err.message });
  }
});

export default router;
