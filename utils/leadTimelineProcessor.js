import Anthropic from '@anthropic-ai/sdk';
import { findRecentPages } from '../tools/puppeteerSearch.js';
import AWSManager from './awsManager.js';
import { isAgentCycleRunning } from '../agent/reasoningLeadAgent.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const awsManager = new AWSManager();

export const activeTimelineUsers = new Set();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function broadcast(userId, agentId, operation, details, status = 'success') {
  try {
    const { broadcastActivity } = await import('../routes/monitoring.js');
    broadcastActivity({
      type: 'agent_activity',
      userId,
      agentId: agentId || 'timeline',
      operation,
      details,
      cardMessage: details,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch {}
}

async function researchLead(userId, lead, userSettings) {
  const { name, company, leadId, agentId, starredAt } = lead;
  const offering =
    userSettings?.companyProfile?.primaryService ||
    userSettings?.companyProfile?.coreOffering ||
    userSettings?.companyProfile?.companyName ||
    '';
  const customCriteria = (userSettings?.preferences?.timelineResearchCriteria || '').trim();

  // Hard gate: only surface content published AFTER this lead was starred
  const newerThan = starredAt ? new Date(starredAt) : new Date(Date.now() - 30 * 24 * 3600000); // fallback: 30 days ago

  console.log(`[LEAD TIMELINE] Researching ${name} @ ${company} (newer than ${newerThan.toISOString()})`);
  await broadcast(userId, agentId, 'Timeline Research', `Crawling web for ${name} @ ${company}…`, 'active');

  // Two searches — lazy: crawl results one-by-one, stop when we have enough recent pages (max 10 tries each)
  const queries = [
    `"${company}" news ${new Date().getFullYear()}`,
    `"${name}" "${company}"`,
  ];

  const seenUrls = new Set();
  const toScore = [];

  for (const q of queries) {
    try {
      const results = await findRecentPages(q, newerThan, { targetRecent: 3, maxTries: 10 });
      for (const r of results) {
        if (seenUrls.has(r.link)) continue;
        seenUrls.add(r.link);
        if (r.isRecent) toScore.push(r);
      }
    } catch (e) {
      console.error(`[LEAD TIMELINE] Crawl error for "${q}":`, e.message);
    }
  }

  if (toScore.length === 0) {
    console.log(`[LEAD TIMELINE] Nothing newer than starredAt for ${name} @ ${company} — skipping Haiku`);
    await broadcast(userId, agentId, 'Timeline Research', `No new content since lead was starred for ${name} @ ${company}`, 'warning');
    return 0;
  }

  console.log(`[LEAD TIMELINE] ${name} @ ${company}: ${toScore.length} recent pages → sending to Haiku`);

  const itemList = toScore
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.text.slice(0, 600)}\n   URL: ${r.link}`)
    .join('\n\n');

  const genericCriteria = `Score 0-10:
- 8-10: Strong buying signal (funding round, hiring surge, new initiative, expansion, expressed pain point)
- 6-7: Useful context (leadership change, market shift, product launch, company growth)
- 0-5: Not useful — generic, unrelated, or no actionable insight`;

  const scoringGuide = customCriteria
    ? `The user has replaced the default scoring guide with their own criteria:\n"${customCriteria}"\nApply this exactly when scoring.`
    : genericCriteria;

  const prompt = `You are a B2B sales intelligence analyst. Rate each page's relevance to pitching "${offering || 'our product'}" to ${name} at ${company}.

${scoringGuide}

Pages scoring below 6 must NOT appear in your output at all.

Respond ONLY with a JSON array of relevant items (score ≥ 6) — no prose, no markdown fences:
[{"url":"...","score":N,"reason":"one sentence on why this is relevant to the pitch","headline":"punchy 6-10 word headline summarising the finding"}]

Items:
${itemList}`;

  let scored = [];
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0]?.text || '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    scored = match ? JSON.parse(match[0]) : [];
  } catch (e) {
    console.error('[LEAD TIMELINE] Haiku scoring error:', e.message);
    await broadcast(userId, agentId, 'Timeline Research', `Scoring failed for ${name} @ ${company}`, 'error');
    return 0;
  }

  // Double-gate: enforce score >= 6 even if Haiku ignored the instruction
  const relevant = scored.filter(s => typeof s.score === 'number' && s.score >= 6);

  for (const item of relevant) {
    const source = toScore.find(r => r.link === item.url);
    if (!source) continue;
    await awsManager.logLeadTimelineEntry(userId, leadId, {
      headline: item.headline || source.title,
      snippet: source.snippet,
      url: item.url,
      relevanceScore: item.score,
      reason: item.reason,
      type: 'news',
      foundAt: new Date().toISOString(),
    });
  }

  const stored = relevant.length;
  console.log(`[LEAD TIMELINE] ${name} @ ${company}: ${stored}/${toScore.length} items stored`);

  if (stored > 0) {
    const top = relevant.reduce((a, b) => a.score > b.score ? a : b);
    await broadcast(
      userId, agentId,
      'Timeline Research',
      `Found ${stored} signal${stored !== 1 ? 's' : ''} for ${name} @ ${company} — "${top.headline || top.reason}" (${top.score}/10)`,
      'success'
    );
  } else {
    await broadcast(userId, agentId, 'Timeline Research', `No relevant signals for ${name} @ ${company} (${toScore.length} recent pages scored <6)`, 'warning');
  }

  return stored;
}

export async function processLeadTimeline(userId) {
  try {
    const settings = await awsManager.getUserSettings(userId);
    const starredLeads = settings?.starredLeads || [];

    if (starredLeads.length === 0) {
      activeTimelineUsers.delete(userId);
      return;
    }

    const cursor = settings?.leadTimelineCursor || { currentIndex: 0 };
    const idx = ((cursor.currentIndex || 0) % starredLeads.length + starredLeads.length) % starredLeads.length;
    const lead = starredLeads[idx];

    // Skip if this lead's specific agent is mid-cycle — other agents' leads still proceed
    if (lead.agentId && isAgentCycleRunning(userId, lead.agentId)) {
      console.log(`[LEAD TIMELINE] Skipping ${lead.name} @ ${lead.company} — agent ${lead.agentId} is cycling`);
      // Advance cursor so next tick tries the next lead (possibly from a different agent)
      const freshSettings = await awsManager.getUserSettings(userId);
      await awsManager.saveUserSettings(userId, {
        ...freshSettings,
        leadTimelineCursor: {
          currentIndex: (idx + 1) % starredLeads.length,
          lastProcessedAt: freshSettings?.leadTimelineCursor?.lastProcessedAt,
          lastProcessedLeadId: freshSettings?.leadTimelineCursor?.lastProcessedLeadId,
        },
      });
      return;
    }

    await researchLead(userId, lead, settings);

    // Advance cursor regardless of result so we don't re-hammer a stuck lead
    const freshSettings = await awsManager.getUserSettings(userId);
    await awsManager.saveUserSettings(userId, {
      ...freshSettings,
      leadTimelineCursor: {
        currentIndex: (idx + 1) % starredLeads.length,
        lastProcessedAt: new Date().toISOString(),
        lastProcessedLeadId: lead.leadId,
      },
    });
  } catch (err) {
    console.error(`[LEAD TIMELINE] Error for user ${userId}:`, err.message);
  }
}

let _running = false;

export function startLeadTimelineProcessor() {
  if (_running) return;
  _running = true;

  async function loop() {
    while (true) {
      const users = Array.from(activeTimelineUsers);

      if (users.length === 0) {
        await sleep(15000); // idle — no starred leads anywhere, check again in 15s
        continue;
      }

      // Each user is independent — process them in parallel
      // Each user runs in parallel — per-agent cycle checks happen inside processLeadTimeline
      await Promise.allSettled(
        users.map(async userId => {
          await processLeadTimeline(userId);
          await sleep(6000);
        })
      );
    }
  }

  loop().catch(err => {
    console.error('[LEAD TIMELINE] Loop crashed, restarting in 30s:', err.message);
    _running = false;
    setTimeout(startLeadTimelineProcessor, 30000);
  });

  console.log('✅ [LEAD TIMELINE] Processor started (continuous, cycle-aware)');
}
