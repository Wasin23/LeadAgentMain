# AI Email Pipeline — Full Audit Map
> What the AI is asked to do, in order, for every lead.
> Source of truth: `agent/reasoningLeadAgent.js`

---

## STEP 0 — Campaign Plan Conversion
**Model:** `gpt-4o-mini`  
**When:** Once at the start of a cycle, if the user has special instructions set.  
**What it's asked:** Parse free-text special instructions into a structured JSON plan with `searchStrategy`, `qualificationCriteria`, `researchFocus`, and `emailMessaging`.

---

## STEP 1 — Orchestration (Reasoning)
**Model:** `gpt-4o-mini`  
**When:** At every step to decide what tool to call next.  
**What it's asked:** Given the current pipeline state (what's been loaded, what phase we're in), pick the next function to call. Highly deterministic — the code overrides it with `determineFunctionCall()` most of the time. Low stakes.

---

## STEP 2 — Lead Search
**No LLM.** Apollo.io API call. Returns name, title, company, company size, industry, LinkedIn URL.

---

## STEP 3 — Prospect Research (Phase 1–2)
**Model:** `gpt-4o-mini` × N calls  
**When:** Before qualification, for every lead.  
**What it does:** Runs 3 Serper searches (company overview, recent news, LinkedIn snippets). Then fetches the top 3 URLs per search and runs an LLM extraction call on each webpage.

### Webpage Fact Extraction Prompt (repeated per URL):
```
Extract ONLY the most relevant and impressive business facts about [companyName] from this webpage.
CRITICAL: The company MUST be mentioned by name. Do not infer.
Focus on: funding, partnerships, clients, awards, innovations, growth.
Return 2-4 bullet points (max 50 words each) or "NO RELEVANT DATA".
```

### LinkedIn Snippet Extraction Prompt:
```
Extract ONLY content that [personName] AUTHORED — their own posts or articles.
Skip comments, likes, shares, profile bio text, or anything they reacted to.
Return 1-3 bullet points (50 words each) or "NO RELEVANT DATA".
```

---

## STEP 4 — Pre-Qualification
**Model:** `gpt-4o-mini`  
**When:** After research, if a campaign plan with `qualificationCriteria` exists.  
**What it's asked:** Quick SKIP/RESEARCH verdict based on research findings vs. must-have criteria and disqualifiers. Score 0–100. Only recommends SKIP if score < 20 (clear disqualifier found). Absence of evidence is not grounds for SKIP.

---

## STEP 5 — Full Qualification (Tiered Scoring)
**Model:** `gpt-4o-mini`  
**When:** After pre-qual passes.  
**What it's asked:** Full tiered scoring with 4 tiers:

| Tier | Score | Meaning |
|---|---|---|
| HIGHLY_QUALIFIED | 80–100 | 5+ cited facts, clear timing signal, verified criteria |
| QUALIFIED | 60–79 | 2+ cited facts OR right title+industry+size with no disqualifiers |
| SHOTGUN | 40–59 | Right criteria but research found nothing useful, or adjacent fit |
| REJECT | 0–39 | Hard disqualifier found or completely wrong industry |

The prompt is very long (~300 lines). Key requirements from it:
- Must articulate a specific, evidence-based **buyer motivation** (WHY would this person buy NOW)
- Must produce `emailHooks`: 2–3 specific, concrete, verifiable facts from research
- Must produce `citedEvidence`: array of facts with source URLs
- Must give `keyStrengths`, `weaknesses`, `reasoning`, `emailStrategy`
- Reasoning must be 3–5 sentences with concrete specifics — "meets criteria" is explicitly banned

---

## STEP 6 — Supporting Research (Phase 3)
**Model:** `gpt-4o-mini` × N calls  
**When:** Runs AFTER qualification, inside `buildPersonalizedEmail` if not already done.  
**What it does:** 2 more searches:
1. `[industry] statistics trends data 2024 2025` — extract numeric stats a salesperson could cite
2. `[yourCompany] news funding clients awards` — extract proof points about the sender's company

Cached for 3 days per industry / per company. Also queries Zilliz RAG for pre-stored industry facts.

---

## STEP 7 — Sales Strategist (Pre-Write Reasoning)
**Model:** `gpt-4o` (full)  
**When:** Inside `buildPersonalizedEmail`, before a single word of the email is written.  
**What it's asked:** Answer 6 questions, then produce a subject line.

```
1. CAREER FEAR — personal, role-specific. What is this person afraid of getting wrong?
2. DEFERRED DECISION — what are they pushing back that they know they should address?
3. WINNING MOVE — what does THIS person get credit for internally if the product works?
4. TOP OBJECTION — single most likely reason they won't reply. How to preempt without stating it.
5. SHARPEST INTERSECTION — what specific tension connects their situation to our product?
6. ONE-LINE ANGLE — "Because [true thing about their world], [consequence], [product] is the clearest way to [resolve it]."

Then: SUBJECT_TYPE (statement/tension/intrigue) and SUBJECT (max 8 words, never a question).
```

Output is JSON. This drives the entire email.

---

## STEP 8 — Email Generation
**Model:** `claude-sonnet-4-5`  
**When:** Final step per lead. Uses all prior research + sales angle.  
**Max tokens:** 600  
**Temperature:** 0.5

### System Prompt (summarized):
- "You are not a salesperson. You are a person who found something interesting and decided to reach out."
- Personality type injected (HUNTER / RELATIONSHIP / ANALYST / CONSULTANT / NETWORKER)
- Personality-specific opener patterns (fabricated moments to make it feel unscripted)
- 3 randomly-sampled style nudges from a pool of 10 per personality
- Hard rules:
  - Exactly 2 short paragraphs + 1 CTA line, under 120 words
  - Paragraph 1: human moment + observation, ends on the observation — NOT the implication
  - Paragraph 2: one capability, no feature list
  - CTA: low friction, specific, NOT a generic demo ask
  - Subject: short, specific, never a question
  - No setup-conflict pivot ("X is great, but Y is a problem")
  - Never explain why the observation is relevant
  - Never tell the reader how to feel
  - **Banned words:** mismatch, creates drag, operationally, streamline, cutting-edge, leverage, robust, revolutionize, game-changer, scalable, widening gap
  - Never reference unnamed client groups
  - Fabrication budget is the opener moment ONLY — everything after must come from facts
  - Never use em dash (—)
  - Enterprise rule: 500+ employee companies get no questions implying they're naive

### User Prompt (summarized):
```
Year: [current year]

WRITING GUIDANCE: [user's customPrompt / personality emailPrompt]

PROSPECT: company, contact name, title, industry, employees

BUYER CONTEXT:
[One-line angle from sales strategist]
[Sharpest intersection]
[Top objection]
[Suggested subject]

TOP FACTS: [top 2-4 scored emailHooks from qualification]

EXTRA RESEARCH: [3 best snippets from Serper searches]

INDUSTRY STATS: [2 RAG facts from Zilliz]

SOLUTION: product, benefits, company name, proof points

CAMPAIGN: [campaign value, key points, CTA style, tone — if campaign plan exists]

SUBJECT: [suggested subject from strategist, or instruction to write one]

SIGNATURE: [name, title, company]
```

Output format: `SUBJECT: [...]\n\nBODY: Hi [FirstName], ...`

---

## STEP 9 — Subject Line (fallback only)
**Model:** `gpt-4o-mini`  
**When:** Only if the sales strategist didn't produce a subject (rare).  
**What it's asked:** Read the email body and write a subject line under 50 chars. Specific claim, named flaw, sharp tension. Never generic FOMO. Enterprise rule applies.

---

## STEP 10 — Lead Confidence Report
**Model:** `gpt-4o-mini`  
**When:** After email is generated.  
**What it's asked:** 4-sentence assessment of the lead's quality (research quality, role fit, response likelihood, overall confidence LOW/MEDIUM/HIGH). For UI display only — doesn't affect sending.

---

## Summary Table

| Step | Model | Cost tier | Output |
|---|---|---|---|
| 0 Campaign Plan | gpt-4o-mini | cheap | structured JSON plan |
| 1 Orchestration | gpt-4o-mini | cheap | next function name |
| 2 Lead Search | Apollo API | per-lead | name / email / company |
| 3 Research × N | gpt-4o-mini × ~6 | medium | cited facts per webpage |
| 4 Pre-Qualify | gpt-4o-mini | cheap | SKIP / RESEARCH + score |
| 5 Full Qualify | gpt-4o-mini | medium | tier, buyer motivation, email hooks |
| 6 Supporting Research | gpt-4o-mini × ~4 | medium | industry stats, company proof points |
| 7 Sales Strategist | **gpt-4o (full)** | expensive | 6-question reasoning + subject |
| 8 Email Generation | **claude-sonnet-4-5** | expensive | final email body + subject |
| 9 Subject Fallback | gpt-4o-mini | cheap | subject line only |
| 10 Confidence Report | gpt-4o-mini | cheap | UI display only |

---

---

## All System Prompts (Verbatim)

### 1. Email Generation — Claude System Prompt
**File:** `agent/reasoningLeadAgent.js` ~line 4774  
**Model:** `claude-sonnet-4-5`  
**This is the primary email writing prompt.**

```
HARD RULE — READ THIS FIRST: Never use the em dash character (—) anywhere in your output. Not once. Not in any sentence. Replace every em dash with a comma, a period, or rewrite the sentence. This applies to every word you write below.

You noticed something about a company and you're writing a short message to someone there. You are not a salesperson writing a cold email. You are a person who found something genuinely interesting and decided to reach out.

    YOUR PERSONALITY: ${personalityType}

    PERSONALITY DISPOSITIONS — apply the one matching YOUR PERSONALITY above:
    - HUNTER: blunt, willing to challenge. Lead with a provocation or direct observation implying the reader has a problem they haven't solved. No softening.
    - RELATIONSHIP: warm and perceptive. Lead with genuine curiosity or a specific compliment that earns the right to continue. The edge is in the specificity, not the tone.
    - ANALYST: inference-driven. Form a take from a specific data point or pattern in the research. The opinion sounds like a logical conclusion, not a feeling.
    - CONSULTANT: strategic peer. The opener sounds like something a trusted advisor in the room would say, slightly knowing, a reframe of how they see their own situation.
    - NETWORKER: socially aware. Name the atmosphere — what is shifting in this space right now, what people in this industry are thinking about. The reader feels part of a moment, not a pitch list. Never name other clients, unnamed groups, or fabricated peer companies.

    HUMAN OPENER PATTERNS — weave one of these into the opening sentence to make it feel unscripted. Adapt freely, do not copy verbatim. These are fabricated moments — that is intentional and fine:
    [HUNTER]:    "Blunt question -", "Was debating whether to send this, but", "Not a typical pitch, so bear with me", "Was just arguing about [topic] and your name came up"
    [RELATIONSHIP]: "Randomly landed on [company] and spent longer than I should have reading about what you're doing", "Was telling my colleague about [specific thing] this morning", "Not sure what made me reach out today but", "Spilled my coffee reading about [specific thing you do] - genuinely did not expect that"
    [ANALYST]:   "[Company]'s position in [space] didn't quite add up until I saw [fact]", "[Company] keeps showing up somewhere I didn't expect", "[Fact] is an unusual combination — made me want to understand it better"
    [CONSULTANT]:"Was in a conversation earlier about exactly this", "A client brought up [topic] and honestly [company] was the first name I thought of", "Was reviewing some notes from last week and something clicked"
    [NETWORKER]: "A few people in [industry] have mentioned [topic] lately and I wanted to get your take", "Keep hearing [company] come up in conversations about [space]", "Was just on a call about [topic] and your name came up"

    STYLE NUDGES — for this email only, apply these three:
    [3 randomly sampled from a pool of 10 per personality — see nudge pools below]

    HARD RULES — always apply:
    - Write exactly 2 short paragraphs plus 1 CTA line. Under 120 words.
    - Paragraph 1: open with the human moment + your take on this specific company or person. Not a diagnosis. Not a market overview. End on the observation — never on the implication. Do not narrate what the observation means to the reader. They already know. Trust the opener. Let it breathe. The connection to what you do belongs in paragraph 2.
    - Paragraph 2: one thing you do and why it is directly relevant to that specific take. One capability, no feature list.
    - CTA: low friction, specific to the problem or timing. Not a generic demo ask. Never reference unnamed groups in the CTA.
    - SUBJECT LINE: short, specific, sounds like a human wrote it in 3 seconds. Reference a real thing from the research — a deal, person, product, or specific fact. NEVER a question of any kind — statements and intrigue frames only. Never a blog post title or LinkedIn ad. Do not use any example verbatim.
    - No setup-conflict pivot. No "X is great, but Y is a problem" framing.
    - Never write "not a replacement for what you do", "not here to reinvent", "this isn't about replacing" or any variation.
    - Never explain why your observation is relevant. Do not write "this maps directly to how you think about X", "which connects to your work in Y", "given your background in Z, this will resonate". The reader can make the connection.
    - Never tell the reader how to feel about what you just said.
    - Banned words: mismatch, creates drag, operationally, streamline, cutting-edge, leverage, robust, revolutionize, game-changer, scalable, widening gap.
    - Never use the em dash character (—). Never.
    - Never reference unnamed client groups — no "a few PE shops", "firms we work with", "companies like yours". No unverifiable social proof.
    - Fabrication budget is the opener moment ONLY. Everything after must come from provided facts. No invented stats, client counts, firm names, or results.
    - If the opener could work for any company, rewrite it.

    Output exactly:
    SUBJECT: [subject]

    BODY: Hi [FirstName], ...
```

---

### 2. WRITING GUIDANCE — injected into Claude's user message as `customPrompt`
**File:** `agent/reasoningLeadAgent.js` line 4661  
**How it gets there:**
```js
let customPrompt = emailSettings.customPrompt
  || emailSettings.emailBuilder?.customPrompt
  || personality?.emailPrompt
  || 'Write professional sales emails';   // ← THE FALLBACK
```

**Priority chain:**
1. User-edited custom prompt (set in the agent settings UI → "System Prompt" field)
2. Agent emailBuilder `customPrompt`
3. Personality `emailPrompt` (see below)
4. **Hardcoded fallback: `'Write professional sales emails'`** ← This is the one that tells Claude it's writing a professional sales email when nothing else is configured.

---

### 3. Personality `emailPrompt` strings
**File:** `routes/auth.js` lines 80–88  
These are the **fallback prompts** used when the user hasn't written a custom one. They get injected as the `WRITING GUIDANCE` block in the Claude user message.

```
hunter:
"When responding to emails, maintain a direct and action-oriented tone that creates urgency. Keep responses brief but impactful. Focus on clear value propositions and strong calls-to-action. Use confident, results-driven language that encourages immediate engagement. Your goal is to move prospects quickly toward a meeting or next step."

relationship-builder:
"When responding to emails, prioritize building trust and rapport. Use warm, empathetic language that shows you understand their challenges. Ask thoughtful questions to deepen the conversation. Focus on the relationship first, solution second. Your responses should feel personal, not transactional, creating a foundation for long-term partnership."

analyst:
"When responding to emails, demonstrate deep research and data-driven insights. Reference specific company details, market trends, or industry statistics that show you've done your homework. Use evidence-based language and provide concrete examples. Your responses should position you as a knowledgeable expert who can back up claims with facts."

consultant:
"When responding to emails, position yourself as a strategic advisor focused on business outcomes. Use professional, advisory language that demonstrates industry expertise. Frame your responses around solutions and strategic value rather than just features. Show that you understand their business challenges at a strategic level and can offer meaningful guidance."

networker:
"When responding to emails, leverage connection-based language that builds community. Reference mutual contacts, shared interests, or industry relationships when relevant. Use friendly, social tone that feels collaborative rather than sales-focused. Your responses should feel like a conversation between colleagues in the same professional network."
```

**Default personality `emailPrompt` when no personality is set:**
```
"Write professional sales emails"
```
(line 1032, `routes/auth.js`)

---

### 4. Research Analysis System Prompt
**File:** `agent/reasoningLeadAgent.js` line 2153  
**Model:** `gpt-4o-mini`, Step 3 research analysis  
**Used for:** Analyzing webpage content into strategic insights. Runs during research phase, output feeds into the email builder's facts.

```
You are an expert business intelligence analyst and lead qualification specialist. Provide actionable insights about prospects without referencing specific products or services.
```

---

### 5. Reply Agent System Prompt
**File:** `routes/webhooks-reply.js` line 160 (fallback) / line 173 (custom)  
**Used for:** Auto-drafting replies to inbound leads. Not the outbound email pipeline, but uses the same `emailPrompt` field.

**Fallback (no personality configured):**
```
Write professional, helpful email responses that address the sender's needs directly.
```

**Generated from company profile (when no custom prompt):**
```
You are an AI assistant representing [companyName].

Industry: [industry]
Value Proposition: [valueProposition]
Target Market: [targetMarket]
Key Products/Services: [keyProducts]

Write professional, helpful email responses that address the sender's needs directly while showcasing our value proposition.
```

---

## Where Claude "Sees" That It's Writing a Professional Email

In order of most to least influential:

1. **`WRITING GUIDANCE` block in the user message** — injected as the very first instruction in the user message Claude reads. If `customPrompt` is blank, falls through to personality `emailPrompt`, which for the default Hunter is *"Write professional, direct sales emails that create urgency and drive action. Use confident language and clear value propositions."* That single line overrides everything the system prompt tried to set up.

2. **The system prompt's own structure** — it uses the word "HARD RULES", "SUBJECT LINE", "Output exactly:" — all formatting cues that signal to Claude this is a structured task, not a natural message. The frame says "be human" but the formatting says "be a machine following a spec."

3. **The user message data blocks** — `PROSPECT:`, `BUYER CONTEXT:`, `TOP FACTS:`, `EXTRA RESEARCH:`, `SOLUTION:`, `CAMPAIGN:`, `SUBJECT:`, `SIGNATURE:` — eight labeled sections. Claude has been trained on millions of documents. A message with eight labeled sections in all-caps is not how humans think when they're writing an email. It's how engineers prompt LLMs. Claude reads the meta-signal and writes accordingly.

---

## Where the "Strange" Voice Likely Comes From

1. **Step 8 system prompt** — The opener patterns are fine in theory but if the personality is vague or the model ignores the nudges, you get the default "Claude trying to be human" voice, which is exactly what sounds quirky. Claude 3.5 Sonnet has a very distinctive overly-literary tone at temp 0.5 when left room to be expressive.

2. **The human opener patterns** — phrases like "Spilled my coffee reading about..." and "Not sure what made me reach out today but" are designed to sound casual but Claude tends to write them in a way that reads as affected and precious rather than natural.

3. **Step 7 output leaking into Step 8** — If the sales angle has anything abstract or over-intellectualized, those phrases can bleed through since they're injected directly into the user prompt.

4. **No negative examples** — The system prompt bans specific words but doesn't show the model examples of what BAD sounds like vs. what GOOD sounds like. LLMs respond much better to `BAD: [example] GOOD: [example]` pairs than to word lists.

5. **Personality prompts may be too broad** — The `emailPrompt` field that gets injected as `customPrompt` in Step 8 (coming from the user-editable personality settings) could be contributing generic AI-speak that overrides the good instructions.


## FIX ADVICE

When I was an SDR I spent hours researching everything there is to know about emailing. Which subject lines perform best, what time do emails get opened, how many characters should it have, etc. I wrote the perfect cadence and automated it so I never had to think about it again. I would drop 100-500 new prospects into it a week and would book 6-7 meetings per week.

Here are some of the things I found in my research:

58% of adults check their email first thing in the morning (Try sending your emails between 7-9:30))

2.7 seconds is how long people take to decide if they are going to read your email or delete it - get to the point quickly

80% of people only scan your email - write short sentences with bold words and use lots of white space

Emails written at a 3rd grade reading level perform the best - don't use big words and jargon to sound cool, it lowers the readability

The perfect email should:

be less than 90 words

Use 2-sentence paragraphs so it can be scanned

Never include more than 1 link or attachment

Write like you talk

Imagine the reader is a high schooler - use simple language

Avoid email clichés

Only ask 1 question

----

So, here are my top 2 performing emails.

The structure of the first one is what I use on every single intro email. Why it works: it's short, it's to the point, and it begins by tailoring to the prospect and what they care about. I don't overly pitch my company, I don't go on and on about our features our clients. And there are NO LINKS or ATTACHMENTS, which is very important because some email systems will automatically flag outside emailers as spam if they include links.


The structure is:

Hey you handle _____ so I bet you care about _______. We do ______, wanna chat?


Here is what it looks like:

Hi first name - I saw that you are the title and are likely focused on one of their objectives that you know you can solve so I wanted to send you a quick note about my company.

My company helps companies your unique selling point which leads to the benefit.

Would you be open to a quick intro call on Friday?


Example:

Hey sales people of r/sales - I saw that you post in this sub for selling advice so I wanted to make you a quick post about sales emails. I help sales reps write awesome emails which leads to higher reply rates and more SQLs. Wanna give it an upvote?

----

The second email is the best performer. I usually get a good amount of opens and replies on the first, but the second one is nearly double. I once booked 12 meetings in a day from this email alone.

It's a feature specific email. I choose a cool feature about my company, one that I know is interesting, and share a case study. Most reps make the mistake of trying to talk about every single feature and benefit their company has in every single email.

You should never find yourself writing "we offer this, and this, and this, AND this, with a side of this and we help brands like Brand, Brand, and Brand!" -- its info overload! Focus and be specific!

Here it is:


Hey first name - I'm not sure if you've ever looked into cool thing your company does but I thought you might find our feature interesting.

We worked with relevant client to do the cool thing and they saw a impressive result.

Just wanted to send you a message and see if company might be interested in checking this out.

If so, let me know and we can set up a quick call!


Example:

Hey cat owner - I'm not sure if you've looked into using a tool to remove cat hair but I thought you might find the furminator interesting.

I recently worked with a dog owner who used our furminator to eliminate 30% of his dog's excess hair which saved him tons of time on vacuuming.

Just wanted to send you a message to see if you might be interested ini checking this out.

If so let me know and we can set up a quick call!