# Meridian Outcome Data Layer - DPA / Security Review Answers

Internal reference for enterprise security reviews and DPA negotiations. Pair with
Terms of Service Section 9 (Data Ownership and Platform Learning) and Privacy Policy
Section 6a (GDPR: Recipient Personal Data). **Have counsel review before signing any DPA.**

---

## 1. What we process, and in what role

| Data category | Examples | Our role |
|---|---|---|
| Customer account data | login, billing, settings | Controller |
| Recipient personal data | name, business email, title, company, campaign outcome history | Processor (customer is controller) |
| Campaign outcome records | email as sent, send-time context snapshot, delivery/engagement/reply outcomes, raw reply text | Processor |
| De-identified statistical aggregates | feature-level effects ("soft CTAs outperform hard for founder-titled recipients") | Controller (no personal data) |

## 2. Lawful basis

Legitimate interest (Art. 6(1)(f)) in B2B commercial communication, on behalf of the
customer as controller. Recipients are contacted in their professional capacity using
business contact data. Balancing factors: professional context only, one-click opt-out
in every email, no sensitive data categories, no psychological profiling (see Section 6).

## 3. Retention

- Campaign outcome records: life of the customer account + up to 90 days wind-down
  after account deletion, unless law requires longer.
- Raw reply text: same schedule as outcome records (retained for re-classification
  and accuracy audits, which is the documented purpose).
- De-identified aggregates: indefinite (contain no personal data by construction).

## 4. Erasure path (the append-only log question)

The event log is append-only S3 (NDJSON, date-partitioned). Erasure strategy is
**tombstone + compaction**, decided before the log format shipped:

1. On an erasure request, an erasure tombstone event is appended for the recipient
   identifier (normalized email hash).
2. Every downstream reader (feature extractor, offline model, analytics, dashboards)
   filters tombstoned identities as a first-stage predicate. Masking is therefore
   immediate at the point of use.
3. Scheduled log compaction physically rewrites affected partitions dropping
   tombstoned rows. Target: physical removal within 30 days of the request.
4. Derived feature rows keyed to the recipient are deleted in the same compaction
   pass. De-identified aggregates are out of scope (no personal data).

Why not crypto-shred: per-recipient encryption keys on an NDJSON stream complicate
every reader and make replay (the core architectural property) fragile. Tombstone +
compaction achieves the same end state with immediate logical effect.

## 5. Cross-tenant pooling (the "does my data train my competitors" question)

**What pools:** statistical structure only - derived feature vectors and aggregate
effects. Feature extraction is the de-identification boundary: the pooled layer never
sees content, only its shape.

**What never crosses tenants:** verbatim email copy, prospect identities, research
data, campaign strategy/configuration.

**The honest answer for the review:** a competitor on the platform receives the same
aggregate insight every customer receives - the equivalent of an industry benchmark
report, not your playbook.

**Tiers:**
- Default: contribute-to-benefit. Pooled learning on; account receives continuously
  improving global defaults.
- Enterprise opt-out: data stays tenant-local; account runs on global priors frozen
  at opt-out plus its own accumulation. Costs performance; priced accordingly.
- Named-competitor exclusion: specified domains excluded from any pool feeding the
  requesting customer's vertical model. Implemented as a filter on the training query.

## 6. No inferred-psychology features

Meridian does not build or infer personality, psychological, or behavioral profiles
of individual recipients. Analytics operate on message characteristics and
professional context (industry, role, company attributes). This is a standing product
policy: the schema does not carry such features and no inference of them is built.

## 7. Sub-processors relevant to outcome data

| Sub-processor | Purpose |
|---|---|
| AWS (DynamoDB, S3, Lambda) | operational store, event log, pipeline |
| Anthropic | reply classification, content feature labeling |
| OpenAI | email generation, qualification |
| Apollo.io | recipient business contact data (source) |
| Mailgun / Google / Microsoft | email delivery |
| Stripe | billing (no outcome data) |
| Zilliz | vector store for agent memory |

## 8. Security posture (summary)

Encryption in transit (TLS) and at rest (AWS-managed). JWT-authenticated API. Tenant
isolation by partition key on every operational table; tenant ID carried on every
event log row. Access to production data restricted to operators. The event log is
append-only; mutation happens only via the documented compaction process.
