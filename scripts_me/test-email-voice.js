#!/usr/bin/env node
/**
 * Email voice tester — run different system prompt strategies against Claude
 * using the real data format the production agent sends.
 *
 * Usage:
 *   node scripts_me/test-email-voice.js
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Fake lead data — mirrors real production data fields ───────────────────
const LEAD = {
  firstName: 'Patrick',
  lastName: 'Moore',
  company: 'Globe Media Group',
  title: 'VP of Infrastructure',
  industry: 'Media / Publishing',
  employees: '400-600',
  personalityType: 'HUNTER',
  buyerContext: 'Infrastructure decision-maker managing multi-publication uptime under reduced headcount. Pain point is compute reliability during high-traffic news events without being able to hire.',
  topFacts: [
    'Boston Globe and Irish Times both run on their infrastructure',
    'Headcount down 18% in the last 6 months',
    'Recent job posts show they are looking for a single senior DevOps lead to cover both properties',
    'They had a 40-minute outage during the 2024 election night — their highest-traffic event of the year',
  ],
  extraResearch: 'Globe Media has been consolidating its tech stack since 2023. The Irish Times acquisition added compute load without adding infra staff. Patrick joined 14 months ago from a cloud background.',
  industryStats: 'Media companies average 3.2 major outage events per year. Election cycles and breaking news create 8-12x normal traffic spikes. 67% of media IT leaders say compute capacity is their top infrastructure concern.',
  product: 'High-performance GPU clusters that spin up in under 48 hours, fully managed, no additional DevOps headcount required',
  benefits: 'Handles traffic spikes without on-call burden, no infra team expansion needed, proven in media environments',
  company: 'Exabits',
  proofPoints: [
    'One media infrastructure team cut costs 71% and got 30% faster processing after switching',
    'Customers average 48-hour spin-up from signed contract to live cluster',
  ],
  salesAngle: { suggestedSubject: 'election night' },
  signatureName: 'Alex',
  signatureCompany: 'Exabits AI',
};

// ─── Build the real user prompt (mirrors claudeUserPrompt in production) ────
function buildRealUserPrompt(writingGuidance) {
  return `Year: 2026

WRITING GUIDANCE:
${writingGuidance}

PROSPECT:
- Company: ${LEAD.company}
- Contact: ${LEAD.firstName} ${LEAD.lastName}
- Title: ${LEAD.title}
- Industry: ${LEAD.industry}
- Employees: ${LEAD.employees}

BUYER CONTEXT:
${LEAD.buyerContext}

TOP FACTS:
${LEAD.topFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}

EXTRA RESEARCH:
${LEAD.extraResearch}

INDUSTRY STATS:
${LEAD.industryStats}

SOLUTION:
- Product: ${LEAD.product}
- Benefits: ${LEAD.benefits}
- Company: ${LEAD.company}
- Proof points:
${LEAD.proofPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}

SUBJECT:
Suggested: "${LEAD.salesAngle.suggestedSubject}". Use this or write a sharper statement/intrigue subject grounded in the research. NEVER a question.

SIGNATURE:
Best,
${LEAD.signatureName}
${LEAD.signatureCompany}

Write the email now. First sentence must be specific to this company.`;
}

// ─── Prompt strategies — same user data, different system prompts ────────────
const STRATEGIES = [
  {
    name: 'PRODUCTION (current system prompt)',
    system: `HARD RULE: Never use the em dash character anywhere in your output.

You noticed something about a company and you're writing a short message to someone there. You are not a salesperson writing a cold email. You are a person who found something genuinely interesting and decided to reach out.

YOUR PERSONALITY: HUNTER

PERSONALITY DISPOSITIONS: HUNTER: blunt, willing to challenge. Lead with a provocation or direct observation implying the reader has a problem they haven't solved. No softening.

HUMAN OPENER PATTERNS: "Blunt question -", "Was debating whether to send this, but", "Not a typical pitch, so bear with me", "Was just arguing about [topic] and your name came up"

HARD RULES:
- Write exactly 2 short paragraphs plus 1 CTA line. Under 60 words total. Short sentences only. Use the simplest word that works. No big abstract nouns. Verbs that do things.
- Paragraph 1: open with the human moment + your take on this specific company or person. End on the observation, never on the implication.
- Paragraph 2: one thing you do and why it is directly relevant to that specific take. One capability, no feature list.
- CTA: low friction, specific to the problem or timing.
- SUBJECT LINE: short, specific, sounds like a human wrote it in 3 seconds. NEVER a question.
- No setup-conflict pivot.
- Never tell the reader how to feel about what you just said.
- Banned words: mismatch, creates drag, operationally, streamline, cutting-edge, leverage, robust, revolutionize, game-changer, scalable, widening gap.

Output exactly:
SUBJECT: [subject]

BODY: Hi [FirstName], ...`,
    user: buildRealUserPrompt('Write short, plain emails. Simple words. Short sentences. Nothing fancy.'),
  },
  {
    name: 'NO STRUCTURE — voice only, same data',
    system: `You noticed something about a company and you are writing them a quick note. You are not trying to impress anyone. You are not performing. You just have something worth saying and you are saying it. Keep it under 60 words. Do not sell. Do not pitch. Just talk. Include a subject line.`,
    user: buildRealUserPrompt('Write short, plain emails. Simple words. Short sentences. Nothing fancy.'),
  },
  {
    name: 'SINGLE REACTION — voice + data, no blueprint',
    system: `You are reaching out cold. Open with one honest reaction to something specific in the research — not a compliment, not a diagnosis, just a reaction. One sentence on what you do. One soft ask. That is the whole email. No arc. No structure. No performing. Include a subject line.`,
    user: buildRealUserPrompt('Write short, plain emails. Simple words. Short sentences. Nothing fancy.'),
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────
async function runStrategy(strategy) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    temperature: 0.9,
    system: strategy.system,
    messages: [{ role: 'user', content: strategy.user }],
  });

  return response.content[0].text.trim();
}

async function main() {
  console.log('═'.repeat(70));
  console.log(' EMAIL VOICE TESTER');
  console.log(' Lead: ' + LEAD.firstName + ', ' + LEAD.title + ' @ ' + LEAD.company);
  console.log('═'.repeat(70));

  for (const strategy of STRATEGIES) {
    console.log('\n' + '─'.repeat(70));
    console.log('STRATEGY: ' + strategy.name);
    console.log('─'.repeat(70));

    try {
      const result = await runStrategy(strategy);
      console.log(result);
    } catch (err) {
      console.error('ERROR:', err.message);
    }
  }

  console.log('\n' + '═'.repeat(70));
}

main();
