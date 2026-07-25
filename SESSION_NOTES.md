# Session Progress Notes

Continuation notes for the next conversation. Covers everything done in this session, in chronological order. Repo root = `c:\Users\colto\OneDrive\Meridian` (Express backend); frontend = `moderntask/` (Next.js).

---

## 1. Error-audit fixes (early in session)

- **`utils/circuitBreaker.js`** — `logCircuitOpened()` no longer calls `awsManager.addIssue('system', ...)` (literal `'system'` userId orphaned every alert). Now broadcasts via SSE instead.
- **`agent/reasoningLeadAgent.js`** — CRM sync failures now persist via `awsManager.addIssue()` in addition to the live SSE log, so they survive a page refresh.
- **`utils/gmailManager.js` / `utils/outlookManager.js`** — token-expiry failures now call `awsManager.addIssue(..., severity:'high')` so they're visible in the issues feed, not just thrown into whatever request triggered them.
- **`components/dashboard/activity-feed.tsx`** — added a real `Severity` type (`critical/warning/success/neutral`) and a color legend; previously everything was flattened to red or green.

## 2. Location / Apollo search improvements

- Apollo `person_locations` now sends bare city/state/country terms (verified against Apollo's docs — never combined "City, ST" strings). Original "City, ST" tags are preserved separately (`originalLocationTags`) for broadening.
- Zero-result searches broaden gracefully: city → full state name → drop the filter entirely, capped at 3 API calls, each step logged via `logOperation('Search Strategy Adapted', ...)` (no emoji).
- `excludedLocations` — was being read from Apollo's (nonexistent) `person_not_locations` param; fixed to a client-side post-filter on the response. Also fixed a bug where `excludedLocations` was never flattened into `userSettings` at all in `getUserSettings()`.
- City autocomplete: `moderntask/app/api/cities/route.ts` + `moderntask/data/cities.json` (135k cities, static JSON — the `all-the-cities` npm package was tried first but broke production builds via `fs.readFileSync` on a binary file Next.js doesn't bundle; uninstalled, baked into a committed JSON file instead).

## 3. Agent settings UX

- Settings now genuinely lock while an agent is running: switched from `pointer-events-none` (only blocks mouse) to the `inert` HTML attribute (blocks keyboard too) + a defensive blur effect, in `moderntask/app/agents/[agentId]/settings/page.tsx`.
- Added a **Stop Agent** button directly in the lock banner.
- Status poll tightened from 15s → 4s to shrink the race window.

## 4. Branded animations (from Lovable-built components, integrated into `moderntask`)

- **`components/ui/mailbox-loader.tsx`** — the Meridian mailbox/envelope loading animation (Framer Motion). Light/dark theme aware via `useTheme()`. Timing fix: `onComplete` (which triggers navigation) fires ~350ms *before* the visual fade-out starts, so the destination page has a head start rendering underneath the still-opaque overlay — otherwise there was a visible lag/flash between the animation ending and the dashboard painting.
  - Wired into: sign-in, sign-up, Google OAuth callback, and the "already logged in" redirect path in `moderntask/app/signin/page.tsx` (this last one was the actual fix for the "flash the login page then cut to dashboard" bug — it had been using a raw `router.push` bypassing the loader entirely). Also added an early-render guard so the sign-in form never paints at all while auth status is still resolving.
  - Also wired into onboarding's final "Launching your agent…" step (`components/onboarding/onboarding-flow.tsx`) — plays after the real setup API calls finish, before navigating into the dashboard.
- **`components/ui/star-button.tsx`** — pop/ring/spark burst animation for starring a lead, keyframes in `moderntask/app/globals.css` (`star-pop`, `star-ring`, `star-spark`). Wired into the leads table's star toggle in `components/leads/leads-content.tsx`.
- **Send button animation** — added `send-check`/`send-ring`/`send-fly`/`row-out` keyframes + `--animate-*` tokens to `moderntask/app/globals.css`'s `@theme inline` block (Tailwind v4). Wired into `components/email-queue/email-queue-content.tsx`: clicking Send (single or bulk) plays a check-pop + ring pulse on the button, then the row collapses out (`row-out`) before removal. The actual API send call still fires immediately in the background — only the visual removal is delayed, so the animation never slows down the real send.

## 5. Emoji cleanup

Standing rule from the user: **no emojis anywhere in the app**, including server logs. Did a targeted sweep (regex: strip any emoji character immediately following a quote character, across `logOperation`/`addIssue`/`console.log` calls) across ~20 backend files — **855 instances removed total**, including `agent/reasoningLeadAgent.js` (208), `utils/awsManager.js` (217), `utils/gmailManager.js` (69), `routes/billing.js` (71), `routes/analytics.js` (53), `routes/gmail-pubsub.js` (48), and others. All files re-verified with `node --check` after.

## 6. Daily email cap widget (Outreach page) — redesign + plan-based cap

**UI** (`components/email-queue/email-queue-content.tsx`, `DailyCapWidget`):
- Moved out of the "Queued Emails" title row into its own block directly beneath it.
- No more pill/border styling — plain row, bigger bold headline stat: `sentToday/totalCap sent today`.
- The dropdown chevron was originally on the wrong side (next to the stat, but the dropdown opens under the account/email on the left) — moved to sit next to the account email where the dropdown actually appears.
- **Immediate update**: clicking Send (single or bulk) instantly bumps the visible count via an `onSent(count)` callback threaded from `EmailQueueContent` → `QueuedList` → `DailyCapWidget`'s `bump` prop, before reconciling with the real server count ~1.2s later. No more waiting on the 30s poll.
- **Threshold notification**: a destructive toast fires once when the count reaches the daily cap ("Daily sending limit reached... Remaining sends will queue until tomorrow"), re-arms if the count drops back under.
- Gmail/Outlook brand icons (extracted to `components/ui/provider-icons.tsx`, see §7) now show for the active account, in the header and in the account-switcher dropdown.

**Backend** (`routes/emailQueue.js`, `/api/email-queue/daily-cap-status`):
- `TOTAL_CAP` is no longer a flat `250`. Now computed from the user's plan: `Math.round((emailAllowance || initialCredits) / 30 / 10) * 10`. E.g. Solo (3000/mo) → 100/day, Team (8000/mo) → 270/day, Agency (16000/mo) → 530/day, Free Trial (250 credits) → 10/day.
- `PER_ACCOUNT_CAP` stays fixed at `50` regardless of plan (per explicit instruction).
- **Important caveat surfaced but not yet acted on**: this cap is still purely informational/display-only. **Nothing in the codebase actually blocks a send once the cap is hit** — not `/approve`, not the auto-send scheduler, not follow-up firing. If the cap should become a real enforcement mechanism (blocking sends, rescheduling follow-ups to the next day when the daily budget is exhausted), that's a distinct, not-yet-scoped feature. Flagged to the user; they haven't asked for it to be built yet.

## 7. Big refactor: moved Gmail/Outlook sending responsibility off agents, into Outreach only

This was the largest change this session — a full architectural consolidation, done after two research passes (mapping the account-selection code, then the full per-agent-provider-flag audit) because the user explicitly warned "it's all intertwined."

**Decisions locked in via user confirmation before implementing:**
1. Remove the automatic post-send account auto-rotation entirely (it was silently overwriting whatever account the user manually picked in Outreach).
2. Mailgun is a silent fallback only — not an explicit selectable option in Outreach's account switcher.
3. Onboarding's "Connect Email" step stays, same 3 buttons/OAuth flow, but now sets the *global* active account instead of baking a choice into the new agent.

**What changed, by file:**

Backend:
- `tools/emailMailgun.js` — collapsed the send-routing decision. No longer reads `agentSettings.emailBuilder.useGmail/useOutlook` (a per-agent flag). Always uses the account-level active-provider check (previously only used for "orphaned"/no-agentId emails) — every agent now shares one global active sender.
- `utils/gmailManager.js` / `utils/outlookManager.js` — removed the auto-rotation-to-next-account logic that ran after every successful send. The active account is now a pure manual choice that persists until changed.
- `routes/emailQueue.js` — fixed `daily-cap-status`'s Outlook active-account computation to trust the real per-account `isActive` flag (previously it hardcoded `isActive:false` for all Outlook accounts and had a separate fallback guess).
- `routes/auth.js` — `POST /create-agent` no longer accepts/writes `useGmail`/`useOutlook`.
- `routes/gmailAuth.js` / `routes/outlookAuth.js` — removed the disconnect-triggered "auto-revert agents to Mailgun" logic (existed only to manage the now-removed per-agent flag).
- `routes/settings.js` — removed the bulk `POST /reassign-agents` endpoint (same reason).
- `routes/help.js` — updated a stale help-text line mentioning `"useGmail"`.

Frontend (`moderntask/`):
- New `components/ui/provider-icons.tsx` — shared `GmailIcon`/`OutlookIcon`/`MeridianSendingIcon`, extracted from what used to be an inline per-agent badge in `components/operations/operations-content.tsx` (that badge is now removed — provider is global, so a per-agent badge no longer makes sense; the LinkedIn per-agent badge, which is still legitimately per-agent, was left untouched).
- `components/email-queue/email-queue-content.tsx` — `DailyCapWidget` now shows the real brand icon instead of a generic mail icon (see §6).
- `app/agents/[agentId]/settings/page.tsx` — removed the "Use Gmail for Sending"/"Use Outlook for Sending" toggles entirely, replaced with a one-line note pointing to Outreach.
- `components/settings/settings-content.tsx` — removed the "Default Sending for New Agents" section (`defaultUseGmail`/`defaultUseOutlook`/`defaultEmailSource` — all obsolete once there's no more per-agent/per-new-agent provider concept) and the "reverted agents" banner + reassign-provider dropdown that went with it.
- `components/onboarding/onboarding-flow.tsx` — Step 4 ("Connect Email") visually unchanged (same Gmail/Outlook/LinkedIn/Mailgun cards), but clicking Gmail/Outlook now calls the real `/api/auth/{gmail,outlook}/set-active` endpoint to set the *global* active account, instead of setting local state that got baked into the new agent's `create-agent` payload. Mailgun card is now purely informational (no click handler — there's no "clear active provider" concept). The mount effect that used to read `defaultUseGmail`/`defaultUseOutlook` preferences now instead checks the real `isActive` flags returned by the Gmail/Outlook status endpoints.
- `components/dashboard/use-getting-started.ts` — the "email connected" onboarding-checklist check no longer looks at per-agent `emailBuilder.useGmail/useOutlook` (removed); now checks whether any Gmail/Outlook account is connected globally via `/api/email-queue/daily-cap-status`'s `accounts` array.

**Explicitly left untouched (confirmed dead/unreachable code, not worth the risk of editing):**
- `moderntask/components/onboarding/agent-setup.tsx` — an orphaned duplicate of the onboarding email-connect step. Not imported anywhere in the app (`onboarding/page.tsx` only imports `onboarding-flow.tsx`). Has its own copy of `useGmail`/`useOutlook` state that was **not** refactored. Do not confuse this file with the real onboarding flow if it comes up again.

**Verification done:** full `npx tsc --noEmit` across `moderntask/` (clean) + `node --check` on every touched backend file (all clean). Not yet manually tested in a running browser session — no dev server was started this session.

---

## Open items / things flagged but not built

1. **Real daily-cap enforcement** (§6) — the cap is display-only today. If it should actually block sends and push follow-ups to the next day, that's unscoped future work.
2. **`defaultEmailSource` preference** — was found to be write-only from the frontend with no backend reader, before it was removed entirely as part of the §7 refactor. No longer relevant since the whole section is gone, but worth knowing if `preferences.defaultEmailSource` still exists as stale data in old user records.
3. No manual/browser testing was done on any of this session's UI changes (animations, daily cap widget, onboarding step, settings page) — only `tsc`/`node --check` static verification. Worth a real click-through pass, especially:
   - Sign-in flow (fresh login, already-logged-in-via-Google, sign-up)
   - Outreach's account switcher (connect Gmail, connect Outlook, switch between them, confirm it *stays* switched — the whole point of removing auto-rotation)
   - Onboarding Step 4 end-to-end with a real Google account
   - The send-button animation and daily-cap immediate-update/notification on a real queued email
