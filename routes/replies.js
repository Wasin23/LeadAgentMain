import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const awsManager = new AWSManager();

router.use(authenticateToken);

const OUTBOUND_EVENT_TYPES = new Set(['sent', 'outbound']);
const LEAD_REPLY_EVENT_TYPES = new Set(['reply', 'lead_message']);
const AGENT_REPLY_EVENT_TYPES = new Set(['ai_response', 'ai_reply', 'manual']);

function parseTimeRange(timeRange) {
  if (timeRange === '24h') return new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (timeRange === '7d') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (timeRange === '30d') return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (timeRange === '90d') return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return null;
}

function normalizeMessageContent(event) {
  return (
    event.content ||
    event.messagePreview ||
    event.aiResponsePreview ||
    event.subject ||
    ''
  ).trim();
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(content) {
  if (!content) return '';

  let text = String(content);
  const hasHtml = /<\/?(html|body|div|p|br|a|img|span|table|tr|td)\b/i.test(text);
  if (!hasHtml) {
    return decodeHtmlEntities(text).trim();
  }

  text = text
    .replace(/<img[^>]*tracking-[^>]*>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<a[^>]*>(.*?)<\/a>/gis, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(text)
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n +/g, '\n')
    .trim();
}

function parseEmailContact(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { name: '', email: '' };
  }

  const angleMatch = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1].replace(/^"|"$/g, '').trim(),
      email: angleMatch[2].trim().toLowerCase()
    };
  }

  if (raw.includes('@')) {
    return { name: '', email: raw.toLowerCase() };
  }

  return { name: raw, email: '' };
}

function titleCaseWords(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeLeadName(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const contact = parseEmailContact(candidate);
    if (contact.name) return titleCaseWords(contact.name);
    if (contact.email) {
      const local = contact.email.split('@')[0].replace(/[._-]+/g, ' ').trim();
      if (local) return titleCaseWords(local);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return titleCaseWords(candidate.trim());
    }
  }

  return 'Lead';
}

function normalizeLeadEmail(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const contact = parseEmailContact(candidate);
    if (contact.email) return contact.email;
    if (typeof candidate === 'string' && candidate.includes('@')) return candidate.trim().toLowerCase();
  }

  return 'Unknown';
}

function normalizeSubject(subject, trackingId = null) {
  const value = String(subject || '').trim();
  if (!value) return 'Email reply';

  if (trackingId && value.toLowerCase() === `reply to ${trackingId}`.toLowerCase()) {
    return 'Email reply';
  }

  return value.replace(/^(re|fwd):\s*/i, '').trim() || 'Email reply';
}

function stripQuotedText(content) {
  if (!content) return '';

  content = stripHtml(content);

  const lines = content.split(/\r?\n/);
  const cleaned = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      /^on\s.+wrote:$/i.test(trimmed) ||
      /^from:\s/i.test(trimmed) ||
      /^sent:\s/i.test(trimmed) ||
      /^subject:\s/i.test(trimmed) ||
      /^to:\s/i.test(trimmed) ||
      /^cc:\s/i.test(trimmed) ||
      /^stop emails$/i.test(trimmed)
    ) {
      break;
    }

    if (trimmed.startsWith('>')) {
      continue;
    }

    if (/^https?:\/\//i.test(trimmed) && cleaned.length > 0) {
      continue;
    }

    cleaned.push(line);
  }

  return cleaned
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return true;
    })
    .join('\n')
    .trim();
}

function compactPreview(content, maxLength = 180) {
  const text = stripQuotedText(content).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function cleanMessageBody(content) {
  return stripQuotedText(content)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\bStop emails\b/gi, '')
    .replace(/meridian-kdew\.onrender\.com\/r\/tracking-[^\s]+/gi, '')
    .trim();
}

function classifyReply(content) {
  const text = stripQuotedText(content).toLowerCase();

  if (!text) return { label: 'neutral', sentiment: 'neutral' };
  if (/(unsubscribe|remove me|take me off|opt me out|stop emailing|do not contact|don't contact)/i.test(text)) {
    return { label: 'unsubscribe', sentiment: 'negative' };
  }
  if (/(out of office|ooo|vacation|away from the office|currently away|auto.?reply)/i.test(text)) {
    return { label: 'out_of_office', sentiment: 'neutral' };
  }
  if (/(book|schedule|calendar|calendly|meet|meeting|available at|available on|works for me|let'?s talk|let'?s meet)/i.test(text)) {
    return { label: 'meeting_request', sentiment: 'positive' };
  }
  if (/(interested|sounds good|looks good|yes|yeah|yep|absolutely|let'?s do it|tell me more|open to|keen to|would love to)/i.test(text)) {
    return { label: 'positive', sentiment: 'positive' };
  }
  if (/(not interested|no thanks|no thank you|pass|leave me alone|not a fit|not relevant|not now|not currently)/i.test(text)) {
    return { label: 'negative', sentiment: 'negative' };
  }
  if (text.includes('?') || /(how|what|when|where|why|which|can you|could you|would you)/i.test(text)) {
    return { label: 'question', sentiment: 'neutral' };
  }
  return { label: 'neutral', sentiment: 'neutral' };
}

function buildMessage(event) {
  let type = 'system';
  if (OUTBOUND_EVENT_TYPES.has(event.eventType)) type = 'outbound';
  else if (LEAD_REPLY_EVENT_TYPES.has(event.eventType)) type = 'reply';
  else if (event.eventType === 'manual') type = 'manual';
  else if (AGENT_REPLY_EVENT_TYPES.has(event.eventType)) type = 'ai_response';

  const fromValue = event.from || event.recipientEmail || event.email || null;
  const name = type === 'reply'
    ? normalizeLeadName(event.leadName, fromValue)
    : null;

  return {
    id: event.eventId,
    type,
    timestamp: event.timestamp,
    subject: event.subject ? normalizeSubject(event.subject) : null,
    content: cleanMessageBody(normalizeMessageContent(event)),
    from: fromValue,
    name,
    rawEventType: event.eventType
  };
}

function areLikelySameOutboundMessage(primaryEvent, candidateEvent) {
  const primaryTo = normalizeLeadEmail(primaryEvent.to, primaryEvent.recipientEmail, primaryEvent.email);
  const candidateTo = normalizeLeadEmail(candidateEvent.to, candidateEvent.recipientEmail, candidateEvent.email);

  if (primaryTo !== candidateTo) {
    return false;
  }

  const primarySubject = normalizeSubject(primaryEvent.subject);
  const candidateSubject = normalizeSubject(candidateEvent.subject);
  if (primarySubject !== candidateSubject) {
    return false;
  }

  const primaryContent = compactPreview(normalizeMessageContent(primaryEvent), 220);
  const candidateContent = compactPreview(normalizeMessageContent(candidateEvent), 220);
  const timeDeltaMs = Math.abs(new Date(primaryEvent.timestamp).getTime() - new Date(candidateEvent.timestamp).getTime());

  return primaryContent && candidateContent && primaryContent === candidateContent && timeDeltaMs <= 2 * 60 * 1000;
}

function areLikelySameLeadReply(primaryEvent, candidateEvent) {
  const primaryFrom = normalizeLeadEmail(primaryEvent.recipientEmail, primaryEvent.email, primaryEvent.from);
  const candidateFrom = normalizeLeadEmail(candidateEvent.recipientEmail, candidateEvent.email, candidateEvent.from);

  if (primaryFrom !== candidateFrom) {
    return false;
  }

  if (primaryEvent.messageId && candidateEvent.messageId && primaryEvent.messageId === candidateEvent.messageId) {
    return true;
  }

  const primaryContent = compactPreview(normalizeMessageContent(primaryEvent), 220);
  const candidateContent = compactPreview(normalizeMessageContent(candidateEvent), 220);
  const timeDeltaMs = Math.abs(new Date(primaryEvent.timestamp).getTime() - new Date(candidateEvent.timestamp).getTime());

  return primaryContent && candidateContent && primaryContent === candidateContent && timeDeltaMs <= 2 * 60 * 1000;
}

function collapseConversationEvents(events) {
  const collapsed = [];

  for (const event of events) {
    if (!LEAD_REPLY_EVENT_TYPES.has(event.eventType) && !OUTBOUND_EVENT_TYPES.has(event.eventType)) {
      collapsed.push(event);
      continue;
    }

    const existingIndex = collapsed.findIndex((existingEvent) => {
      if (LEAD_REPLY_EVENT_TYPES.has(existingEvent.eventType) && LEAD_REPLY_EVENT_TYPES.has(event.eventType)) {
        return areLikelySameLeadReply(existingEvent, event);
      }

      if (OUTBOUND_EVENT_TYPES.has(existingEvent.eventType) && OUTBOUND_EVENT_TYPES.has(event.eventType)) {
        return areLikelySameOutboundMessage(existingEvent, event);
      }

      return false;
    });

    if (existingIndex === -1) {
      collapsed.push(event);
      continue;
    }

    const existingEvent = collapsed[existingIndex];
    let preferredEvent;

    if (LEAD_REPLY_EVENT_TYPES.has(existingEvent.eventType) && LEAD_REPLY_EVENT_TYPES.has(event.eventType)) {
      preferredEvent = existingEvent.eventType === 'lead_message'
        ? {
            ...existingEvent,
            recipientEmail: existingEvent.recipientEmail || event.recipientEmail,
            email: existingEvent.email || event.email,
            from: existingEvent.from || event.from,
            messagePreview: existingEvent.messagePreview || event.messagePreview,
            messageId: existingEvent.messageId || event.messageId
          }
        : {
            ...event,
            content: event.content || existingEvent.content,
            messagePreview: event.messagePreview || existingEvent.messagePreview,
            messageId: event.messageId || existingEvent.messageId,
            recipientEmail: event.recipientEmail || existingEvent.recipientEmail,
            email: event.email || existingEvent.email,
            from: event.from || existingEvent.from
          };
    } else {
      preferredEvent = existingEvent.eventType === 'outbound'
        ? {
            ...existingEvent,
            content: existingEvent.content || event.content,
            messagePreview: existingEvent.messagePreview || event.messagePreview,
            subject: existingEvent.subject || event.subject,
            to: existingEvent.to || event.to,
            recipientEmail: existingEvent.recipientEmail || event.recipientEmail,
            email: existingEvent.email || event.email,
            messageId: existingEvent.messageId || event.messageId
          }
        : {
            ...event,
            content: event.content || existingEvent.content,
            messagePreview: event.messagePreview || existingEvent.messagePreview,
            subject: event.subject || existingEvent.subject,
            to: event.to || existingEvent.to,
            recipientEmail: event.recipientEmail || existingEvent.recipientEmail,
            email: event.email || existingEvent.email,
            messageId: event.messageId || existingEvent.messageId
          };
    }

    collapsed[existingIndex] = preferredEvent;
  }

  return collapsed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function summarizeConversation(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const canonicalEvents = collapseConversationEvents(sorted);
  const leadReplyEvents = canonicalEvents.filter((event) => LEAD_REPLY_EVENT_TYPES.has(event.eventType));
  const outboundEvents = sorted.filter((event) => OUTBOUND_EVENT_TYPES.has(event.eventType));
  const aiReplyEvents = sorted.filter((event) => AGENT_REPLY_EVENT_TYPES.has(event.eventType));

  const latestEvent = sorted[sorted.length - 1] || null;
  const latestLeadReply = leadReplyEvents[leadReplyEvents.length - 1] || null;
  const firstLeadReply = leadReplyEvents[0] || null;
  const firstOutbound = outboundEvents[0] || null;
  const classification = classifyReply(latestLeadReply ? normalizeMessageContent(latestLeadReply) : '');

  const replyTimeHours = firstOutbound && firstLeadReply
    ? Number((((new Date(firstLeadReply.timestamp) - new Date(firstOutbound.timestamp)) / (1000 * 60 * 60))).toFixed(2))
    : null;

  let status = 'replied';
  if (classification.label === 'meeting_request') status = 'meeting_requested';
  else if (classification.label === 'unsubscribe') status = 'unsubscribed';
  else if (classification.label === 'negative') status = 'not_interested';
  else if (latestEvent?.eventType === 'manual') status = 'manual_replied';
  else if (aiReplyEvents.length > 0) status = 'ai_responded';

  return {
    trackingId: latestEvent?.trackingId || null,
    originalTrackingId: latestEvent?.trackingId || null,
    agentId: latestEvent?.agentId || null,
    agentName: latestEvent?.agentName || null,
    from: normalizeLeadEmail(latestLeadReply?.recipientEmail, latestLeadReply?.email, latestLeadReply?.from, latestEvent?.recipientEmail, latestEvent?.email, latestEvent?.from),
    leadEmail: normalizeLeadEmail(latestLeadReply?.recipientEmail, latestLeadReply?.email, latestLeadReply?.from, latestEvent?.recipientEmail, latestEvent?.email, latestEvent?.from),
    leadName: normalizeLeadName(latestLeadReply?.leadName, latestLeadReply?.recipientEmail, latestLeadReply?.email, latestLeadReply?.from, latestEvent?.leadName, latestEvent?.recipientEmail, latestEvent?.email, latestEvent?.from),
    company: latestLeadReply?.company || latestEvent?.company || null,
    subject: normalizeSubject(latestLeadReply?.subject || firstOutbound?.subject || latestEvent?.subject, latestEvent?.trackingId),
    timestamp: latestLeadReply?.timestamp || latestEvent?.timestamp || null,
    firstReplyAt: firstLeadReply?.timestamp || null,
    lastReplyAt: latestLeadReply?.timestamp || null,
    lastActivityAt: latestEvent?.timestamp || null,
    replyTimeHours,
    status,
    classification: classification.label,
    sentiment: classification.sentiment,
    preview: latestLeadReply ? compactPreview(normalizeMessageContent(latestLeadReply), 140) : '',
    hasAIReply: aiReplyEvents.length > 0,
    hasLeadMessage: leadReplyEvents.length > 0,
    replyCount: leadReplyEvents.length,
    aiReplyCount: aiReplyEvents.length,
    references: latestEvent?.trackingId || null,
    inReplyTo: latestEvent?.trackingId || null,
    events: canonicalEvents,
    messages: canonicalEvents
      .filter((event) => OUTBOUND_EVENT_TYPES.has(event.eventType) || LEAD_REPLY_EVENT_TYPES.has(event.eventType) || AGENT_REPLY_EVENT_TYPES.has(event.eventType))
      .map(buildMessage)
  };
}

function buildStats(conversations, allEvents) {
  const stats = {
    totalReplies: conversations.length,
    totalReplyEvents: conversations.reduce((sum, conversation) => sum + conversation.replyCount, 0),
    positive: 0,
    negative: 0,
    neutral: 0,
    interested: 0,
    unsubscribes: 0,
    meetingRequests: 0,
    questions: 0,
    outOfOffice: 0,
    aiResponded: 0,
    avgReplyTimeHours: null,
    replyRate: 0
  };

  conversations.forEach((conversation) => {
    if (conversation.sentiment === 'positive') stats.positive += 1;
    if (conversation.sentiment === 'negative') stats.negative += 1;
    if (conversation.sentiment === 'neutral') stats.neutral += 1;
    if (conversation.classification === 'positive') stats.interested += 1;
    if (conversation.classification === 'unsubscribe') stats.unsubscribes += 1;
    if (conversation.classification === 'meeting_request') stats.meetingRequests += 1;
    if (conversation.classification === 'question') stats.questions += 1;
    if (conversation.classification === 'out_of_office') stats.outOfOffice += 1;
    if (conversation.hasAIReply) stats.aiResponded += 1;
  });

  const replyTimes = conversations
    .map((conversation) => conversation.replyTimeHours)
    .filter((value) => typeof value === 'number' && value >= 0);

  if (replyTimes.length > 0) {
    const average = replyTimes.reduce((sum, value) => sum + value, 0) / replyTimes.length;
    stats.avgReplyTimeHours = Number(average.toFixed(2));
  }

  const sentTrackingIds = new Set(
    allEvents
      .filter((event) => OUTBOUND_EVENT_TYPES.has(event.eventType))
      .map((event) => event.trackingId)
      .filter(Boolean)
  );

  stats.replyRate = sentTrackingIds.size > 0
    ? Number(((conversations.length / sentTrackingIds.size) * 100).toFixed(2))
    : 0;

  return stats;
}

async function getScopedEvents(userId, agentId, timeRange) {
  const cutoff = parseTimeRange(timeRange);
  const allEvents = await awsManager.getEmailTrackingByUser(userId, agentId !== 'all' ? agentId : null, 10000);
  return cutoff ? allEvents.filter((event) => new Date(event.timestamp) >= cutoff) : allEvents;
}

function buildConversationList(events) {
  const grouped = new Map();

  for (const event of events) {
    if (!event.trackingId) continue;
    if (!grouped.has(event.trackingId)) grouped.set(event.trackingId, []);
    grouped.get(event.trackingId).push(event);
  }

  return [...grouped.values()]
    .map(summarizeConversation)
    .filter((conversation) => conversation.hasLeadMessage)
    .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0));
}

router.get('/replies', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId = 'all', timeRange = '30d' } = req.query;

    console.log('[REPLIES API] Building reply feed from AWS tracking', { userId, agentId, timeRange });

    const events = await getScopedEvents(userId, agentId, timeRange);
    const replies = buildConversationList(events);
    const stats = buildStats(replies, events);

    res.json({
      success: true,
      data: {
        replies,
        stats
      }
    });
  } catch (error) {
    console.error('[REPLIES API] Error building replies feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/replies/:trackingId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { trackingId } = req.params;

    console.log('[REPLIES API] Fetching reply thread', { userId, trackingId });

    const events = (await awsManager.getEmailTrackingByTracking(trackingId))
      .filter((event) => event.userId === userId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Reply thread not found' });
    }

    const conversation = summarizeConversation(events);

    res.json({
      success: true,
      data: {
        trackingId,
        replies: conversation.messages.filter((message) => message.type === 'reply' || message.type === 'ai_response' || message.type === 'manual'),
        conversation,
        stats: {
          totalReplies: conversation.replyCount,
          positive: conversation.sentiment === 'positive' ? 1 : 0,
          negative: conversation.sentiment === 'negative' ? 1 : 0,
          neutral: conversation.sentiment === 'neutral' ? 1 : 0,
          interested: conversation.classification === 'positive' ? 1 : 0,
          unsubscribes: conversation.classification === 'unsubscribe' ? 1 : 0,
          meetingRequests: conversation.classification === 'meeting_request' ? 1 : 0,
          questions: conversation.classification === 'question' ? 1 : 0,
          outOfOffice: conversation.classification === 'out_of_office' ? 1 : 0,
          replyTimeHours: conversation.replyTimeHours
        }
      }
    });
  } catch (error) {
    console.error('[REPLIES API] Error fetching reply thread:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analytics/replies', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agentId = 'all', timeRange = '30d' } = req.query;

    console.log('[REPLIES API] Building reply analytics', { userId, agentId, timeRange });

    const events = await getScopedEvents(userId, agentId, timeRange);
    const replies = buildConversationList(events);
    const stats = buildStats(replies, events);

    res.json({
      success: true,
      data: {
        totalReplies: stats.totalReplies,
        totalReplyEvents: stats.totalReplyEvents,
        replyRate: stats.replyRate,
        avgReplyTimeHours: stats.avgReplyTimeHours,
        sentimentBreakdown: {
          positive: stats.positive,
          negative: stats.negative,
          neutral: stats.neutral
        },
        typeBreakdown: {
          interested: stats.interested,
          questions: stats.questions,
          unsubscribes: stats.unsubscribes,
          meeting_requests: stats.meetingRequests,
          out_of_office: stats.outOfOffice
        },
        aiResponded: stats.aiResponded
      }
    });
  } catch (error) {
    console.error('[REPLIES API] Error building reply analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/analyze-reply', async (req, res) => {
  try {
    const { content = '' } = req.body || {};

    if (!content.trim()) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const classification = classifyReply(content);

    res.json({
      success: true,
      data: {
        analysis: {
          sentiment: classification.sentiment,
          type: classification.label,
          preview: stripQuotedText(content).slice(0, 200)
        },
        message: 'Reply analyzed successfully'
      }
    });
  } catch (error) {
    console.error('[REPLIES API] Error analyzing reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
