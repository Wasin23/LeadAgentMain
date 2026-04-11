# LinkedIn Integration Plan

## Overview
When a lead is highly qualified and has a LinkedIn profile URL, a subsystem scrapes their profile via Proxycurl, builds a short LinkedIn-native message, and queues it in the outreach queue alongside email. Users connect their LinkedIn account via Unipile OAuth. The outreach queue distinguishes email vs LinkedIn messages with an "in" icon.

---

## Adaptive Account-Type System

When the user connects their LinkedIn account via Unipile, query the account capabilities and store the detected tier. The agent adjusts send method, cap, and message format automatically — no manual configuration required.

| Detected Tier | Send Method | Cap | Message Format |
|---|---|---|---|
| Sales Navigator Core/Advanced | InMail | 50/month (rolls over to 150) | Up to 400 chars, slightly more structured |
| Premium Business/Career | InMail | 15/month (rolls over to 45) | Same |
| Free / Basic | Connection request + note | ~100/week | Max 300 chars, very short |
| 1st-degree connection | Direct message | Unlimited | Casual, no cold-message constraints |

**Detection logic on Unipile OAuth callback:**
1. Call Unipile account info endpoint
2. Parse account type → map to one of the four tiers above
3. Store tier + caps in user's DynamoDB settings under `linkedinAccount`
4. Re-check on each agent run (tier can change if user upgrades/downgrades)

**Scheduler behavior per tier:**
- InMail tiers: monthly counter, distribute evenly (~1-2/day), burst allowed if rollover credits available
- Connection request tier: weekly counter, max ~15/day to stay safely under LinkedIn's limit and avoid account flags
- If cap exhausted mid-month: stop queuing new LinkedIn messages, continue email

> **TODO**: Verify Unipile's capability detection endpoint — confirm it exposes account type (Sales Navigator vs Premium vs Free). Also confirm InMail support via their API.

---

## Architecture

### 0. Subprocess Trigger (agent loop integration)
The LinkedIn subsystem runs as a conditional branch inside the existing email generation step — not a separate cycle. It only fires if the lead grader returns **highly qualified** — mid or low qualified leads get email only. After a highly qualified lead is graded and an email is generated:

1. Check if `linkedinAccount` is configured for this user (Unipile connected)
2. Check if lead has a LinkedIn URL (from Apollo or Proxycurl lookup)
3. Check dedup rule — is lead already in email queue for this campaign?
4. Check monthly/weekly LinkedIn cap — credits remaining?
5. **If all pass:** run Proxycurl fetch → build LinkedIn message → push to outreach queue with `channel: "linkedin"`
6. **If any fail:** skip LinkedIn silently, email-only for this lead

This means one agent cycle can produce both an email queue item and a LinkedIn queue item for the same lead, or just email if LinkedIn conditions aren't met.

---

### 1. Profile URL Sourcing
- Apollo often includes LinkedIn URL on lead record — use that first
- If missing: Proxycurl reverse lookup by name + company (~$0.01/call, less reliable)
- If still missing: skip LinkedIn for this lead, email only
- Only attempt LinkedIn for leads above a configurable qualification score threshold

### 2. Profile Scraping (Proxycurl)
- Called after lead qualifies and LinkedIn URL is confirmed
- Returns: headline, current role summary, recent activity, skills, education
- This data replaces/supplements Apollo research for LinkedIn message generation

### 3. Message Generation
- **Two sub-prompts based on detected tier:**
  - **InMail** (Sales Nav / Premium): up to 400 chars, reads like a short email, can have a subject line, slightly more structured
  - **Connection request note** (Free/Basic): hard 300-char limit, one sentence observation + one CTA, no subject
- No formal sign-off, no company boilerplate, no unsubscribe link
- Same personality system (HUNTER/ANALYST/etc.) but adapted for LinkedIn tone
- No feature lists, one observation + one hook + soft CTA
- No em dashes, no rhetorical questions (same hard rules as email)
- Proxycurl data (headline, recent activity, role summary) used as primary context instead of Apollo enrichment

### 4. Outreach Queue Changes
- Add `channel` field to outreach queue items: `"email"` | `"linkedin"`
- LinkedIn items render with a LinkedIn "in" icon in the UI
- Separate send action — LinkedIn messages go through Unipile, not Mailgun
- Queue can hold both channel types for the same lead (dedup logic below)

### 5. Channel Dedup Rules
- A lead cannot be in the email queue AND LinkedIn queue simultaneously for the same campaign
- Default strategy: email first, LinkedIn follow-up after X days with no reply (configurable)
- Alternative: LinkedIn only (user opt-in per agent)
- No double-touch on the same day

### 6. Sending Cap Enforcement
- Monthly LinkedIn counter per user per agent stored in DynamoDB
- Auto-scheduler checks remaining LinkedIn credits before queuing new messages
- If monthly cap hit: stop queuing LinkedIn, continue email
- UI shows LinkedIn messages sent this month vs cap

### 7. Unipile OAuth
- Similar flow to Gmail/Outlook OAuth already built
- User connects LinkedIn account in settings → Unipile handles OAuth
- Store Unipile account ID in user settings
- Required before LinkedIn queue items can be sent

### 8. Reply Tracking
- Unipile provides webhooks for LinkedIn message replies
- Plug into existing reply tracking system (same as email replies)
- Mark lead as replied, stop further outreach on that lead

---

## Build Order

1. **Unipile OAuth** — connect LinkedIn account in settings UI (blocker for everything else)
2. **Proxycurl integration** — profile fetch on qualified leads with LinkedIn URL
3. **LinkedIn message prompt** — separate Claude prompt, LinkedIn-native tone
4. **Queue schema update** — add `channel` field, LinkedIn icon in UI
5. **Dedup logic** — prevent simultaneous email + LinkedIn on same lead
6. **Sending cap** — monthly counter, scheduler awareness
7. **Reply webhook** — Unipile LinkedIn reply → reply tracking

---

## Open Questions

- Does Unipile support InMail programmatically, or only connection requests + direct messages?
- What qualification score threshold triggers LinkedIn inclusion?
- Is LinkedIn opt-in per agent or per user account?
- Do LinkedIn messages count against credits in Meridian's credit system?
- Rollover handling: does the monthly cap reset hard on the 1st, or track by rolling 30-day window?
