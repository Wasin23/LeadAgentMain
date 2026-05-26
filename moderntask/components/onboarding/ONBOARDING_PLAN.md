# Onboarding Redesign Plan

## Goals
- Reduce from 17+ questions + 13 steps to ~6 clear, fast steps
- Every step should feel purposeful — no filler questions
- Globe background throughout
- Mobile-friendly
- User should be able to finish in under 5 minutes

---

## Proposed 6-Step Flow

### Step 0 — Welcome / Team Check (not counted, happens instantly)
- If invite code in URL → show join screen → done, skip all other steps
- If returning user with profile already set → redirect to /home
- Otherwise, start Step 1

---

### Step 1 — Who Are You? (Company Profile, condensed)
**Current:** 17 questions across 4 steps
**New:** 1 screen, ~4 fields + AI shortcut

Fields:
- Company name (required)
- What you sell / core offering (required, textarea)
- Your key advantage / differentiator (required, textarea)
- Website URL (optional — triggers AI autofill if provided)

AI shortcut:
- Paste URL → scrape → auto-fill all fields instantly (no typing animation, just fills)
- Upload file → same
- Or fill manually

What gets dropped:
- Tagline, LinkedIn, phone, address, location, founded, employees, company size range
- These are not used by the agent and can be filled later in Settings if needed

---

### Step 2 — Who Do You Want to Reach? (Targeting)
**Current:** buried inside the long "configure" step
**New:** Dedicated, focused screen

Fields:
- Target industries (search + quick-select chips)
- Target job titles (search + quick-select chips)
- Company size range (min–max employees, two inputs)
- Leads per cycle (simple number input)

AI shortcut:
- "Autofill from your company profile" button — uses company info to suggest industries + titles

---

### Step 3 — Your Agent's Personality
**Current:** own step, works well
**New:** Keep as-is, just restyled

- Pick one of 5 personalities (Hunter, Relationship Builder, Analyst, Consultant, Networker)
- Show avatar + 2–3 trait chips + one-line description
- Name the agent below the personality picker on the same screen

Combines: personality + name-agent (currently 2 steps → 1)

---

### Step 4 — Connect Your Email
**Current:** own step, works well
**New:** Keep, slightly simplified

- Gmail button (OAuth popup)
- Outlook button (OAuth popup)
- Clear note: "Emails send from your real inbox — your name, your domain"
- Can continue without connecting (skippable, but warned that agent can't send until connected)

What gets dropped:
- LinkedIn setup (move to Settings, not blocking)

---

### Step 5 — Plan & Notifications
**Current:** plan + notifications + payment = 3 separate steps
**New:** One screen, two sections

Top section — Plan:
- Free Trial (default, pre-selected)
- Basic / Starter / Professional / Enterprise
- Credit count + agent limit shown per plan
- If paid plan selected → payment form appears inline

Bottom section — Notifications (collapsed by default, expandable):
- Email alerts on/off
- SMS on/off
- Feels lightweight, not a blocker

What gets dropped:
- Separate payment step (inline now)
- CRM setup (move to Settings — too technical for onboarding)
- Preset naming (happens silently using agent name as preset name)

---

### Step 6 — Review & Launch
**Current:** review + creating = 2 steps
**New:** One clean summary screen

Show:
- Company: [name] — [offering snippet]
- Targeting: [industries] · [titles] · [size range]
- Agent: [avatar] [name] · [personality]
- Email: [Gmail/Outlook connected ✓] or [Not connected ⚠]
- Plan: [Free Trial / paid plan]

Each section has an "Edit" link that jumps back to that step.

Big "Launch Agent →" button at bottom.

Then the "creating" animation plays (same as current), redirect to /home.

---

## What Gets Removed Entirely
| Removed | Reason |
|---------|--------|
| Tagline, phone, address, founded, employees | Not used by agent, can fill in Settings |
| LinkedIn setup | Optional, belongs in Settings |
| CRM setup | Too technical for onboarding, belongs in Settings |
| Preset naming | Silently uses agent name |
| Email template | Advanced feature, available in agent Settings after setup |
| Separate payment step | Inline in Plan step |
| 4-slide intro slideshow | Replace with a single punchy welcome screen or remove |

---

## Step Order Summary
```
[Welcome / team check]
     ↓
Step 1 — Company (who you are)
     ↓
Step 2 — Targeting (who you want)
     ↓
Step 3 — Personality + Agent Name
     ↓
Step 4 — Connect Email
     ↓
Step 5 — Plan + Notifications
     ↓
Step 6 — Review + Launch
     ↓
[Creating animation → /home]
```

---

## Open Questions (decide before building)
1. Should Step 1 show the AI URL scraper upfront, or start with manual fields and offer scraper as a secondary option?
2. Should the intro slideshow be kept (re-styled) or replaced with a single welcome screen?
3. Should CRM/LinkedIn be shown as optional "bonus" steps at the end, or fully removed to Settings?
4. Should connecting email be hard-required before launching, or skippable with a warning?
