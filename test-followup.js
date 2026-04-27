/**
 * Test script for follow-up generation.
 * Shows each research step and the final email.
 *
 * Usage:
 *   node test-followup.js
 *   node test-followup.js "Tim Smith" "AspenView" "VP of Engineering"
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { internetSearch } from './tools/internetSearch.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const mistral = new OpenAI({
  apiKey: process.env.MISTRAL_API_KEY,
  baseURL: 'https://api.mistral.ai/v1'
});

// ── mock data (override via CLI args) ─────────────────────────────────────────
const [,, nameArg, companyArg, titleArg, aiReportArg] = process.argv;

const lead = {
  name: nameArg || 'Mark Fidelman',
  company: companyArg || 'SmartBlocks',
  title: titleArg || 'CEO',
  email: 'mark@smartblocks.xyz',
};

// Example: node test-followup.js "Mark Fidelman" "SmartBlocks" "CEO" "SmartBlocks.xyz is a tokenized real estate investment newsletter"
const mockEmail = {
  subject: 'GPU infrastructure for SmartBlocks',
  body: `Hi Mark,\n\nI was reading about how SmartBlocks is covering the tokenized real estate wave and building tools for accredited investors — and it got me thinking about the compute side of running AI-driven deal analysis at scale.\n\nExabits deploys high-performance GPU clusters quickly, with monitoring and security built in. As you push deeper into AI + RWA, the infrastructure question usually comes up sooner than expected.\n\nWorth a quick call?\n\nBest,\ncole`,
  lead,
  to: lead.email,
  // AI research report — pass via 4th CLI arg or leave blank to test without it
  aiReport: aiReportArg || 'SmartBlocks.xyz is a tokenized real estate investment newsletter (Tokenized Insider) that covers RWA markets and helps accredited investors access tokenized property deals. Focused on AI + tokenization intersection.',
};

const mockAgentSettings = {
  companyBranding: {
    companyName: 'Exabits',
    companyWebsite: 'https://exabits.ai',
    primaryService: 'high-performance GPU infrastructure',
  },
  emailBuilder: { smartRebump: true },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function sub(title) {
  console.log(`\n── ${title} ──`);
}

// ── research steps ────────────────────────────────────────────────────────────
async function testPersonSearch() {
  section('STEP 1 — Person activity search (LinkedIn/web)');
  const name = lead.name;
  const company = lead.company;
  const query = `"${name}" "${company}" post OR interview OR announcement OR award 2025`;
  console.log(`Query: ${query}\n`);

  const results = await internetSearch(query);
  const organic = results?.organic || [];
  sub('Raw Serper results');
  organic.slice(0, 5).forEach((r, i) => {
    console.log(`[${i+1}] ${r.title}`);
    console.log(`    ${r.link}`);
    console.log(`    ${r.snippet}\n`);
  });

  const snippets = organic.slice(0, 3).map(r => r.snippet).filter(Boolean).join(' ');
  if (!snippets || snippets.length < 30) {
    console.log('→ Not enough snippets. Returning null.');
    return null;
  }

  sub('GPT-4o-mini extraction');
  const extraction = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Extract any recent activity (posts, job changes, awards, announcements) for this person from the snippets. Return 1 short fact (max 30 words) or "NOTHING USEFUL".' },
      { role: 'user', content: `Person: ${name} at ${company}\nSnippets: ${snippets}` }
    ],
    temperature: 0.2,
    max_tokens: 60
  });
  const fact = extraction.choices[0].message.content.trim();
  console.log(`Extracted: "${fact}"`);
  return fact.includes('NOTHING USEFUL') ? null : fact;
}

async function testCompanySearch() {
  section('STEP 2 — Company news search');
  const company = lead.company;

  // ── Disambiguation step ──────────────────────────────────────────────────────
  sub('Disambiguation — extracting keywords from existing research');
  const sources = [];
  if (mockEmail.aiReport) sources.push(mockEmail.aiReport);
  const emailBody = mockEmail.body || '';
  if (emailBody.length > 20) sources.push(`Email about them: ${emailBody.slice(0, 300)}`);
  console.log(`Sources available: ${sources.length > 0 ? sources.join(' | ').slice(0, 200) : '(none)'}`);

  let disambig = null;
  if (sources.length > 0) {
    const disambigResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract 3-5 specific keywords that uniquely identify what this company does. Return only space-separated lowercase keywords (e.g. "tokenization newsletter blockchain" or "homebuilder construction residential"). No explanation, no punctuation.' },
        { role: 'user', content: `Company: ${company}\n\n${sources.join('\n').slice(0, 600)}` }
      ],
      temperature: 0.1,
      max_tokens: 30
    });
    disambig = disambigResult.choices[0].message.content.trim();
    if (disambig.length <= 3) disambig = null;
    console.log(`Disambiguation keywords: "${disambig || '(none extracted)'}"`);
  }

  const query = disambig
    ? `"${company}" ${disambig} news 2025`
    : `${company} news announcement funding 2025`;
  console.log(`\nFinal query: ${query}\n`);

  const results = await internetSearch(query);
  const organic = results?.organic || [];
  sub('Raw Serper results');
  organic.slice(0, 5).forEach((r, i) => {
    console.log(`[${i+1}] ${r.title}`);
    console.log(`    ${r.link}`);
    console.log(`    ${r.snippet}\n`);
  });

  const snippets = organic.slice(0, 4).map(r => `${r.title || ''}: ${r.snippet || ''}`).filter(Boolean).join(' ');
  if (!snippets || snippets.length < 30) {
    console.log('→ Not enough snippets. Returning null.');
    return null;
  }

  sub('GPT-4o-mini extraction');
  const extraction = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Extract a raw factual observation about this company from the snippets — something a person could reference naturally in a follow-up email. Accept anything: a funding round, product launch, article they published, market insight they shared, LinkedIn post, or any company activity. Return 1 plain sentence, no editorial commentary ("this is interesting", "great conversation starter", etc.). Only return "NOTHING USEFUL" if the snippets contain zero information about this specific company.' },
      { role: 'user', content: `Company: ${company}\nSnippets: ${snippets}` }
    ],
    temperature: 0.2,
    max_tokens: 80
  });
  const fact = extraction.choices[0].message.content.trim();
  console.log(`Extracted: "${fact}"`);
  return fact.includes('NOTHING USEFUL') ? null : fact;
}

async function testGeneration(freshHook, companyContext, stepNumber = 1) {
  section(`STEP 3 — Mistral generation (follow-up #${stepNumber})`);

  console.log(`freshHook:      ${freshHook || '(none)'}`);
  console.log(`companyContext: ${companyContext || '(none)'}`);

  const firstName = (lead.name || 'there').split(' ')[0];
  const company = lead.company;
  const title = lead.title;
  const companyName = mockAgentSettings.companyBranding.companyName;
  const product = mockAgentSettings.companyBranding.primaryService;

  const stepStrategies = {
    1: `Reference something specific from the ORIGINAL EMAIL SENT (a fact, stat, or observation you already mentioned) and ask a genuine question about it — don't introduce a new pitch or new product angle. If fresh research is available, use that fact as a brief hook instead. 2 sentences max. No jargon. No made-up stats.`,
    2: `Two sentences max. Be direct — reference one specific thing from the original email or fresh research and ask a simple, genuine question. No meta-commentary about the email ("I know you're busy", "just reply yes or no", "circling back"). Sound like a real person checking in, not a sales sequence.`,
    3: `One sentence. Close the loop warmly. No pitch.`,
  };

  const rawBody = mockEmail.body.slice(0, 800);

  const systemPrompt = `You are writing a follow-up cold email. The original email was not replied to. You are a real person following up briefly — not a salesperson, not an AI.

HARD RULES:
- Never use em dash (—). Never.
- Do not repeat the original email's opener, angle, or phrases verbatim.
- Do not say "just following up", "circling back", "touching base", or any template phrase.
- No fabricated stats or percentages. Zero.
- No unnamed social proof. No "companies like yours", "teams we work with".
- No new product pitch or new feature angle.
- No jargon unless the original email used that exact phrase.
- Never write placeholder text or brackets.
- Plain text only.
- Vary the CTA — do not use "Let's find 15 minutes" every time.
- Banned words: streamline, leverage, scalable, robust, cutting-edge, game-changer, revolutionize, operationally, innovative, solution, synergy.
- When context is thin, write 1-2 sentences and stop.`;

  const userPrompt = `ORIGINAL EMAIL SENT:
Subject: ${mockEmail.subject}
Body: ${rawBody}

LEAD:
- Name: ${firstName}
- Company: ${company}
- Title: ${title}

PRODUCT BEING SOLD: ${product} by ${companyName}

${companyContext ? `RECENT COMPANY NEWS (use as hook if relevant): ${companyContext}\n` : ''}${freshHook ? `FRESH PERSON ACTIVITY (use as hook if relevant): ${freshHook}\n` : ''}
FOLLOW-UP STEP: ${stepNumber}
STRATEGY FOR THIS STEP: ${stepStrategies[stepNumber] || stepStrategies[3]}

Write a follow-up email. Greeting ("Hi ${firstName},") on its own line, then the body, then a CTA line.

Output exactly:
SUBJECT: [subject]

BODY:
Hi ${firstName},

[body]`;

  sub('Prompt sent to Mistral');
  console.log(userPrompt);

  const response = await mistral.chat.completions.create({
    model: 'mistral-medium-latest',
    max_tokens: 150,
    temperature: 0.85,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  const content = response.choices[0].message.content
    .replace(/—/g, ' - ')
    .replace(/–/g, ' - ')
    .replace(/\*\*/g, '');

  sub('Raw Mistral output');
  console.log(content);
  console.log(`\nTokens: ${response.usage?.prompt_tokens} in / ${response.usage?.completion_tokens} out`);
}

// ── run ───────────────────────────────────────────────────────────────────────
console.log(`\nTesting follow-up generation for: ${lead.name} @ ${lead.company}`);

const [freshHook, companyContext] = await Promise.all([
  testPersonSearch(),
  testCompanySearch(),
]);

section('RESEARCH SUMMARY');
console.log(`Person hook:    ${freshHook || '(nothing found)'}`);
console.log(`Company context: ${companyContext || '(nothing found)'}`);

await testGeneration(freshHook, companyContext, 1);
await testGeneration(freshHook, companyContext, 2);
await testGeneration(freshHook, companyContext, 3);
