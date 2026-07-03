# Meridian Outcome Data Layer — Technical Specification

**Goal:** every send becomes a permanent, replayable record of *this email, in this context, produced this outcome* — accumulating from customer one, acting on nothing until explicitly promoted through three phases.

---

## 1. Architecture overview

Two stores, one stream:

```
[Existing DynamoDB tables]  ──DynamoDB Streams──▶  [S3 event log]  ──▶  [Analytical store]
     operational truth              replayable            queryable (DuckDB/Athena)
                                                                │
                                                    [Feature extractor (versioned)]
                                                                │
                                                    [Offline model → findings]
                                                                │
                                              Phase 1: dashboards   Phase 2: you
                                              Phase 3: bandit (much later)
```

- **DynamoDB stays exactly what it is** — the operational store. No migration.
- **DynamoDB Streams → Lambda → S3** (newline-delimited JSON, partitioned by date) gives you the append-only, replayable event log for free. Every send, open, click, reply lands in S3 as it happens.
- **Analytical store:** start with DuckDB over the S3 files (zero infra, runs anywhere, handles this scale for years) or Athena if you want it serverless. Do NOT build a warehouse. The offline model reads from here.
- **Replay principle:** every downstream component (extractor, classifier, attribution, model) is a pure function over the S3 log. Fix a bug → re-run from timestamp zero. Nothing downstream holds state that can't be regenerated.

---

## 2. Collection layer — changes to existing code

### 2.1 Queue/generation time (`awsEmailQueue.queueEmail()`)

The record already carries `emailData`, `aiReport`, `leadDetails`, `researchData`. Add at queue time:

| New field | Value | Why |
|---|---|---|
| `promptSnapshot` | deep copy of `agentSettings.emailBuilder` **at generation** | agentSettings is mutable; by send time the user may have edited it. The prompt that *wrote this email* must be frozen with it. |
| `promptHash` | SHA-256 of canonicalized `promptSnapshot` | cheap equality: "which sends used identical prompt config" without JSON diffing |
| `sequenceId` | UUID minted when the first email to a prospect is queued; inherited by follow-ups | groups a prospect's touches into one sequence |
| `stepNumber` | 1 for opener, increment per follow-up | the single highest-value missing field |
| `daysSinceLastTouch` | null for step 1; else days since previous send in sequence | learnable timing knob |
| `threadStrategy` | `new_thread` \| `reply_in_thread` | derivable from `replyOptions` but store it explicitly |

### 2.2 Send time (`emailScheduler.sendScheduledEmail()`)

Already written back: `trackingId`, `messageId`, `threadId`, `fromAccount`, `method`. Add:

| New field | Value | Why |
|---|---|---|
| `sentAtUtc` + `sentAtLocalHour` | send timestamp + recipient-local hour if timezone inferable from Apollo location | send-hour is a classic learnable |
| `footerVersion` | identifier of compliance footer template appended | footer content affects spam filtering; it's part of what was actually sent |
| `domainState` | `{domain, accountAgeDays, sendsToday, sendsLast7d}` for `fromAccount` | deliverability confounder — cheap counters, huge analytical value. Without this, domain reputation differences masquerade as copy insights. |

**What is already sufficient (do not touch):** `finalBody` frozen pre-footer verbatim ✓, `finalSubject` ✓, `aiReport` full qualification output ✓, `leadDetails.personInfo` point-in-time Apollo freeze ✓, `researchData` ✓, `agentId` ✓.

### 2.3 Tracking (`routes/tracking.js`)

Keep raw pixel fires exactly as-is (never discard raw events — filtering is a downstream, versioned judgment). Add classification fields to each event:

| New field | Value |
|---|---|
| `secondsSinceSend` | event timestamp − sentAtUtc |
| `proxyClass` | `apple_mpp` \| `google_proxy` \| `security_scanner` \| `direct` \| `unknown` — from IP range + User-Agent lists |
| `userAgent` | raw UA string (currently not stored; needed to reclassify later) |
| `filterVersion` | version of the classification lists used |

Classification rules (v1): known Apple relay IP ranges → `apple_mpp`; `GoogleImageProxy` UA → `google_proxy`; fires < 10s after send → `security_scanner` candidate; existing owner-IP check stays.

**Open events NEVER flow into any success metric.** They are deliverability telemetry only (did it render somewhere = it landed). This is a hard rule, enforced in the offline model's input query, not left to discipline.

**Pixel sampling (later, when volume exists):** pixel only a configurable % of sends per domain as a deliverability canary; send the rest clean. Not needed pre-volume.

### 2.4 Reply ingestion (`processGmailReply()`, Outlook path)

| Change | Detail |
|---|---|
| **Store raw reply text** | verbatim body + headers on the reply event. Currently classification happens and raw is not durably kept → re-classification impossible. This is the reply-side equivalent of freezing `finalBody`. |
| **Attribution: threadId primary, trackingId secondary** | Gmail/Outlook `threadId` / `In-Reply-To` correlation is more robust than pixel-ID correlation (replies arrive with images blocked; pixels don't survive forwarding). You already write `threadId` at send. Rule: match reply → most recent send in that thread = **last-touch attribution**. `sequenceId` on every send preserves sequence-level re-analysis later. |
| **Classifier upgrade** | `classifyReply(rawText) → {label, confidence, classifierVersion}`. Labels: `interested` \| `not_interested` \| `unsubscribe` \| `out_of_office` \| `bounce` \| `referral` \| `question` (regex misses the last two; they matter — a referral is a *win*). Implementation: single Haiku-class LLM call with strict JSON output; regex kept as pre-filter for obvious OOO/bounce to save tokens. Pure function, versioned, replayable over stored raw text. |
| `replyTimeHours` | already computed ✓ — keep. |

### 2.5 CRM (phase 2+, design-for now, build later)

Push-only today. The eventual prize: **meeting booked / deal created flowing back** = ground truth deeper than replies (an `interested` reply that never books is a weaker signal than one that does). For now: reserve `downstreamOutcome` field on the send record, and when you next touch `lib/crm-configs.ts`, note which providers expose webhooks for meeting/deal events. Zero build now.

---

## 3. Feature extraction service

Pure function, versioned, runs over the S3 log (never inline in the send path):

```
extractFeatures(finalBody, finalSubject, extractorVersion) → {features…}
```

**v1 feature set (content — all derivable, all recomputable):**
- subjectLengthChars, subjectHasQuestion, subjectHasRecipientName/Company
- bodyWordCount, paragraphCount, avgSentenceLength, readingLevel
- questionCount, linkCount, hasCalendarLink
- ctaType: `hard_meeting_ask` \| `soft_interest_ask` \| `question_close` \| `resource_offer` \| `none` (LLM-labeled, cached by body hash)
- toneVector: formal↔casual, direct↔warm, brief↔elaborate (LLM-labeled, 1–5 scales)
- personalizationDepth: `none` \| `name_only` \| `company_fact` \| `person_specific_research` (cross-reference body against `researchData` — you have the receipts for this, which is rare)
- spamTriggerDensity (wordlist)
- bodyEmbedding (small model, e.g. voyage/text-embedding-3-small; store `embeddingModelVersion`)

**Context features (already snapshotted, just surfaced in analytics):** aiReport.score, aiReport.tier, aiReport.confidence; title/seniority bucket, industry, companySize from `personInfo`; stepNumber, daysSinceLastTouch, threadStrategy; sentAtLocalHour, dayOfWeek; agentId, promptHash; domain state; userId (client) — **every analytical query is segment-aware; pooled "what works" claims without context columns are banned.**

Every derived row carries `extractorVersion`. New extractor → full re-run over history → new columns everywhere. This is the payoff of freezing raw text.

---

## 4. Offline model (Phase 1–2 brain)

Periodic batch job (weekly is plenty at early volume):

1. **Input:** one row per send from the analytical store — content features + context features + outcome label. Outcome = `interested` or `referral` reply attributed to that send (opens excluded by construction, clicks excluded until proxy filtering is proven).
2. **Model:** gradient-boosted trees (XGBoost/LightGBM) or plain logistic regression on reply-positive. Nothing fancier — the job is *feature importance and effect direction*, not production prediction.
3. **Hierarchy:** always fit global first; segment-level (industry, seniority, client) reported only where cell size clears a floor (start: ≥30 sends, ≥5 positives per cell — tune later). Below floor → segment inherits global. This is the manual version of hierarchical priors; the bandit inherits the same structure in Phase 3.
4. **Output:** a findings report — "soft CTAs +X% vs hard for founders (n=…, CI=…)" — with sample sizes and intervals on every line. No finding without an n.
5. **Calibration loop (the bonus flywheel):** same job plots aiReport.score deciles vs realized reply rate. If 85-score leads don't outreply 60-score leads, the qualifier is miscalibrated — feed that back into Stage 1 prompts. You are now training the *qualifier* on outcomes, not just the email writer. Nobody else in this market closes that loop.

---

## 5. Rollout phases (permission levels, not architectures)

| Phase | Who acts on data | Gate to advance |
|---|---|---|
| **1 — Observe** | Nobody. Dashboards only (per-client analytics = day-one retention feature: "here's what converted in your campaign and why"). | Findings exist with real n |
| **2 — Advise** | You. Read findings report, sanity-check n and CI, manually fold validated ones into `agentSettings.emailBuilder` defaults and prompt templates. | Segments clear volume floors consistently; classifier accuracy audited |
| **3 — Closed loop** | Thompson sampling bandit, one decision domain at a time (send timing first — cheapest to get wrong — then CTA/tone strategy). Hierarchical priors pooled toward global; **forced exploration slice (start 10%) that never goes to zero.** | Per-segment: enough positives that the sampler beats your manual defaults in offline replay |

Convergence-collapse guard (Phase 3 only): exploration slice is a hard floor, monitored; plus quarterly injection of human-written variants that ignore the learned optimum entirely. Human-authored copy in Phases 1–2 *is* the exploration — the risk only switches on when the loop closes.

---

## 6. Simulator (build-now validation harness)

Synthetic generator so the entire loop is testable pre-customer:

- Fake prospects with segment attributes; fake emails with feature vectors.
- Ground-truth reply model you define: `P(reply | features, segment)` — e.g. soft-CTA→founder = 4%, hard-CTA→founder = 2%, interaction terms you plant deliberately.
- Run: generate sends → simulate outcomes → S3 log → extractor → offline model. **Test: does the model recover the truths you planted, at realistic volumes?** Then Phase 3 dry-run: does the bandit converge on planted optima; do pooled priors behave with starved cells; does the exploration floor hold.
- Keep it forever as the regression suite. Swap simulator for reality on customer one; nothing downstream changes.

---

## 7. Legal/paper (do before customer one — cheap now, catastrophic later)

- **TOS clause:** Meridian may use campaign and outcome data, aggregated and de-identified, to improve the platform and train models. Every client signed without this is data you can't train on.
- **GDPR posture:** per-recipient outcome histories keyed to individuals = personal data processing. Have the DPA answer ready for the first enterprise security review: lawful basis, retention window, deletion path (S3 log needs a crypto-shred or tombstone strategy for erasure requests — decide now, it shapes the log format).
- **No inferred-psychology features** (personality profiling) — noisiest signal, hottest compliance surface. Schema supports it as columns if ever justified; do not build inference.

---

## 8. Cross-client pooling policy

The global model pools across clients — necessary for statistical power, and the source of the platform-scale flywheel. The policy that makes it defensible:

**What pools: statistical structure, never content.** Cross-tenant learning operates exclusively on derived feature vectors and aggregate effects ("soft CTAs outperform hard for founder-titled recipients"). Never crosses tenants: verbatim email copy, prospect identities, research data, client campaign strategy. Feature extraction is the tokenization boundary — the pooled layer is de-identified by construction. (Security-review answer to "does my data train my competitors": a competitor receives the same aggregate insight the entire platform receives — an industry benchmark, not your playbook.)

**Tiers:**
- **Default (contribute-to-benefit):** pooled learning on; client receives continuously improving global defaults.
- **Enterprise opt-out:** data stays tenant-local; client runs on global priors frozen at signup plus their own accumulation. Costs performance; prices itself.
- **Named-competitor exclusion:** specific domains excluded from any pool feeding the requesting client's vertical model. A WHERE clause on the training query; kills the objection in sales calls.

**TOS language must state pooling explicitly** — "aggregated and de-identified" alone doesn't cover cross-tenant model improvement. Say it plainly: feature-level, de-identified campaign outcome data improves models serving all customers; content and identities never cross tenants.

**Power math (the pitch paragraph):** distinguishing a 2% vs 3% reply rate at 80% power needs ~4,000 sends per arm (~8–10k total per clean contrast). At 10 clients × 1k sends/month, global findings reach significance within a quarter; a single client alone takes a year. Pooling is why the product gets smart at platform scale instead of client scale → defaults improve for everyone → retention story → more clients → more data. Per-client significance was never the plan; per-client *benefit* from global significance is.

**Calibration chart, day-one version:** score-vs-replied scatter with running mean for customer one; quintiles when volume allows; deciles later. Deciles need a few hundred replied-to sends before bins mean anything.

---

## 9. Build order

1. **Queue/send field additions** (§2.1–2.2) — days, not weeks; mostly writing more of what's already in scope
2. **DynamoDB Streams → S3 pipeline** — the one new infra piece; small Lambda
3. **Raw reply storage + threadId attribution** (§2.4)
4. **Tracking classification fields** (§2.3)
5. **TOS/DPA language** (§7, incl. explicit pooling clause §8) — parallel, non-engineering
6. **Feature extractor v1** (§3) — pure function + tests
7. **Simulator + planted-truth validation** (§6)
8. **Offline model + findings report** (§4)
9. **Dashboards** (Phase 1 client-facing analytics)
10. **Bandit** — last, thin, and dark until Phase 3 gates clear

Items 1–5 are the "unfixable if skipped" set. Everything after is replayable and can be rebuilt from the log at any time — which is exactly the point.
