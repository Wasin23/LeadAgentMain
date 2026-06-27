# Mockup → Real Functionality Translation

The reference mockups give us the visual language (cards, beige bg, serif headings, 2–3 pane detail layouts, sub-tab pattern) and the rough page structure. They do NOT dictate what data appears — almost every stat/label in them is placeholder. This doc translates each mockup element into what we actually have, flags anything with no real equivalent, and calls out judgment calls for you to weigh in on.

Legend: **KEEP** = real data we have, just restyle · **TRANSLATE** = concept is right, mockup's specific version doesn't match how we actually work · **CUT** = no real equivalent / mockup-tool chrome · **DECIDE** = needs your call

---

## HOME

| Mockup element | Translation |
|---|---|
| 4 top stat chips (Emails Queued / Sent / Replies Received / Reply Rate) | **KEEP** — exactly our existing `stats-cards.tsx` data. Drop the ">" chevron unless we actually want click-through (we could: Queued→Outreach/Awaiting, Sent→Outreach/Sent, Replies→Outreach/Sent/Replies) |
| "Outreach Performance" chart, 7D/14D/30D/90D toggle, Sent/Replied lines | **KEEP** — our existing `home-charts.tsx` Email Activity chart. Currently only computes 30-day series; need to extend to support 90D, and the existing toggle is 7D/14D/30D only — add 90D |
| "Agent Status" mini-card (single agent shown, Running now / Idle counts) | **TRANSLATE** — we have `team-collaboration.tsx` which lists ALL agents with activity, not a single-agent summary. Real version: keep the multi-agent list (that's more useful), with running/idle counts as a header stat instead of per-card |
| "Credit Usage" card, progress bar, "Manage credits" button | **KEEP** — we track `creditBalance` already. Need the progress bar (credits used/total — check if plan data exposes a total, not just remaining) and link to `/settings?tab=billing` |
| "Delivery Health" card, Healthy/issue verdict | **TRANSLATE → small new build.** We don't compute a verdict today, but we do have `bouncedCount`/`openedCount`/sent count already in Home's fetch. Simple rule (e.g. bounce rate > X% → flag) gets us a real version of this, not fake |
| "Recent Activity" feed + All/Agents/Alerts filter pills | **KEEP** — our `recent-notifications.tsx`, just add the filter pills (we already have notification `type` field to filter on) |
| "Browse" / "Comment" floating bar, "Lovable" badge | **CUT** — that's the mockup tool's own UI chrome, not part of the design |

**DECIDE:** Do you want the stat chips to be click-through links like the mockup implies (chevron), or static?
 --> click through
---

## PROSPECTING

| Mockup element | Translation |
|---|---|
| Top search bar ("Search prospects, campaigns...") | **DECIDE** — we have an unused `global-search.tsx` component already built. Do you want this wired in for real (and search what — agents? leads once that exists? both?), or was it just mockup chrome? | --> yes
| "Credits 999,900" chip, "Start Outreach" button, bell, avatar | Credits chip → **KEEP** (real balance). "Start Outreach" → **TRANSLATE**, unclear what single button action this maps to (start all agents? go to Outreach tab?) — needs a decision. Bell/avatar → already exist in our `Header` component | --> have it say send emails, which would prompt you to select (or press mass select) all the emails you wanted to send. The auto scheduler would be near this as well. 
| Sub-tabs: "Monitor Agents" / "Agent Setup & Presets" | **KEEP** — exactly the Operations+Agents merge from the plan |
| Left panel: agent list, "Start All" button, "All Agents" row, per-agent mini stats + play button | **KEEP** — this is our existing Operations left panel almost exactly, just restyled |
| Right panel: agent avatar/name/personality badge/status/**Agent ID** | **KEEP** mostly — personality badge and status we have. "Agent ID: ag_k4_8f7b2e" — **CUT or DECIDE**: we don't currently surface raw agentId in UI; only useful for debugging. Could put it in Settings sub-tab instead of the main header | --> you can add the agent id. its fine. we have one for each. 
| Action buttons: Start / Run Cycle / Open Dashboard / "..." | **KEEP** — all real actions we have (start/stop, run-cycle, link to agent detail page). "..." needs defined contents — **DECIDE**: what goes in that overflow menu? (Delete agent? Duplicate? Reset?) | --> delete and reset us fine. 
| Stats row: Queued/Sent/Replied/Reply%/Leads-per-cycle/Last run | **KEEP** — all real fields we already compute per agent |
| Targeting tags + target description paragraph | **KEEP** — real `industries`/`positions`/`specialInstructions` fields from agent settings |
| Sub-tabs: Overview / Activity / Queue / Settings | **KEEP** structurally. "Settings" sub-tab — **DECIDE**: embed inline, or keep linking out to the existing full `/agents/[id]/settings` page (87KB of fields — probably too much to cram into a sub-tab cleanly)? | --> have it link to the full settiungs page we already have built. that will not change.
| Overview → "Recent Activity" card | **KEEP** — our activity log, scoped to this agent, condensed to a card instead of full feed |
| Overview → "Queue Summary" (Leads Found / Drafts Ready counts) | **KEEP** — real counts we can derive (leads found this cycle, queued drafts awaiting approval for this agent) |
| Overview → "Live Status" card, "What k4 is working on", task w/ progress bar ("3/10 companies researched") | **TRANSLATE.** We do have `currentActivity` as a live string (from the agent loop / SSE stream), but NOT a numeric "3/10 companies researched" progress fraction today — that level of granularity doesn't exist in our logging. Real version: show the live `currentActivity` text (already works), but the progress-bar fraction would need new instrumentation in `reasoningLeadAgent.js` to emit — **DECIDE**: worth adding, or skip the fraction and just show the activity text? | --> i actually like the fraction. where we can have leads found so far for the current cycle. i like it. 

---

## LEADS

| Mockup element | Translation |
|---|---|
| Sub-tabs: All Leads / CRM | **KEEP** — per plan |
| Info banner "Select a lead to view its research report..." | **KEEP** — fine as-is | 
| 4 stat cards: Qualified / Research / Rejected / Total Leads | **TRANSLATE** — these map to our real `aiReport.tier` buckets: `HIGHLY_QUALIFIED` + `QUALIFIED` → "Qualified", `SHOTGUN` → "Research" (i.e. lower-confidence, still in play), `REJECTED` → "Rejected". Real, not fake — just needs the bucketing logic written | --> agreed. 
| Table: Company / Fit Score / Confidence / Signal / Status / Assigned | Company/Fit Score/Confidence/Status/Assigned → **KEEP**, all real (`aiReport.score`, `aiReport.confidence`, `aiReport.tier`, `agentId`→agent name). **"Signal"** column ("New territory expansion", "Recent funding") → **CUT or DECIDE**: we don't compute a one-line "signal" summary today. Could derive a short version from `aiReport.reasoning` (truncate to one line) but it'd be lower-quality than the mockup implies — worth deciding if that's good enough or if it should be skipped | --> skip it for now. 
| Pagination + rows-per-page | **KEEP** — standard, matches our existing pagination components |
| Detail panel: company name/status/website/industry/size | **KEEP** — real `leadDetails` fields |
| Detail sub-tabs: Research / Sources / Outreach Draft | **KEEP**. "Outreach Draft" tab → links to the actual queued/sent email for that lead (we have this data already via email-queue records) |
| Research Summary, Fit Score %, Confidence, "Why This Lead Qualifies" bullets | **KEEP** — directly `aiReport.reasoning`, `aiReport.score`, `aiReport.confidence`, `aiReport.keyStrengths` |
| "Top Sources" (Website/LinkedIn/News/Career Page/Company Profile icons + links) | **TRANSLATE** — we have `aiReport.citedEvidence`/`allCitedFacts` with source URLs, but not necessarily categorized by source *type* (Website vs LinkedIn vs News) the way the mockup shows with distinct icons. Real version: list the actual cited sources we have; categorizing by type is a nice-to-have, not guaranteed in the data — **DECIDE** if that's worth the extra parsing or just show a flat source list | --> i think its worth it. would be easy no? keep it in and build it up

---

## OUTREACH — Awaiting Review

| Mockup element | Translation |
|---|---|
| Sub-tabs: Awaiting Review / Sent | **KEEP** — per plan |
| "Bulk Actions" dropdown, "Filter" button | **KEEP** — real, maps to existing select/bulk-send/bulk-reject/search/sort controls in `email-queue-content.tsx`, just restyled as dropdown+button instead of inline toolbar |
| Left list: company/contact/title, "Research Agent" tag, time ago | **KEEP** mostly — company/contact/time are real (`leadDetails`). "Research Agent" tag — **TRANSLATE**: this isn't a distinct concept we have; it's presumably just labeling which agent/role produced it. Real version: show the actual agent name, not a generic "Research Agent" role label, unless we want to introduce agent-role labeling as a real concept (we don't have multiple roles per agent today) | --> agreed. 
| "Medium Personalization" tag | **KEEP** — real, this is the existing `personalizationLevel` setting from agent/preset config |
| "Suggested send: Today, 2:00 PM" | **TRANSLATE** — see your point above. We have real scheduling (`AgentScheduleCard`'s day/time/limit/timezone batch system) — if this email is part of a scheduled batch, show its *actual* scheduled time from that system; if it's not yet scheduled, don't show a fabricated "suggested" time at all | --> agreed as well. have the scheduler HERE. my mistakew fpor mentioning elsewhere. pherals the scheudler button i mesntioend in leads could redirect to this button. 
| Footer: Estimated send time / Assigned Agent / Personalization Level | **TRANSLATE** — drop "Estimated send time" entirely (see above — replace with real scheduledAt if it exists, otherwise omit). "Assigned Agent" and "Personalization Level" are **KEEP**, both real fields | --> agreed. 
| Right pane: company info, "Why this email?" bullets, "Key context" tags | **KEEP** — `aiReport.reasoning`/`keyStrengths` again, same data Leads detail uses | Yes. agreed. 
| "View Full Lead Report" → links to Leads detail | **KEEP** — real cross-link once Leads tab exists |

---

## Open decisions for you (collected from above)

1. Home: stat chips clickable or static?
2. Prospecting: wire up the real `global-search.tsx`, and if so, search what?
3. Prospecting: what does "Start Outreach" actually trigger?
4. Prospecting: show raw Agent ID in the main header, or tuck it into Settings?
5. Prospecting: contents of the "..." overflow menu?
6. Prospecting: Settings sub-tab — embed inline or link out to the existing full settings page?
7. Prospecting: "Live Status" progress fraction (e.g. "3/10 researched") — worth adding new instrumentation to the agent loop for, or just show the live activity text without a fraction?
8. Leads: "Signal" column — derive a one-line summary from `aiReport.reasoning`, or drop the column?
9. Leads: "Top Sources" — categorize by source type (Website/LinkedIn/News/etc.), or just list sources flatly?

---

## PROSPECTING — "Agent Setup & Presets" sub-tab (new screenshots)

| Mockup element | Translation |
|---|---|
| "+ New Agent" button | **KEEP** — existing create-agent flow |
| Per-agent card: avatar/name/personality badge/Active status | **KEEP** — same data as Monitor Agents view |
| "Research Focus" tags / "Target Roles" tags | **KEEP** — these are just relabeled headers over our existing `industries` / `positions` fields |
| "Leads / Cycle", "Last Run" | **KEEP** — real fields |
| "Run Cycle" / "Edit" / "..." buttons | **KEEP** — Run Cycle is real. "Edit" — **DECIDE**: opens what exactly? (full settings page, or an inline panel like the preset editor on the right?) | --> edit would bring up perhaps the settings? have it say settings instead. 
| Description paragraph | **KEEP** — `specialInstructions` |
| "Duplicate" button (agent) | **CUT or small new build** — we don't have agent-duplication today. Doable (copy an existing agent's settings into the create-agent flow) but is new, not existing functionality — **DECIDE** if worth building now | --> should we instead like assign jobs almost to agents? build somethign like that? you create a job then jsut press assign? perhaps the duplciate button could instead be a function that allopws you to map the same settings onto another agent thats already active. i think duplciate ios actually not a bad idea, but should not be so prevalent. perhaps hidden in a three line button.
| "Pause" button | **KEEP** — same as our existing Stop, just relabeled |
| "Delete" button | **KEEP** — existing delete + confirm flow |
| "Saved Presets" section, preset cards (name, created date, tags, lead count, company size, email type, description) | **KEEP** — our existing presets data, restyled as cards |
| "Apply" / "Edit" / "Duplicate" / "Delete" on preset cards | Apply/Edit/Delete → **KEEP** (Apply = assign preset to an agent, which we support). "Duplicate" → **CUT or small new build**, same as agent-duplicate above, we don't have preset cloning today | --> presents dont need duplication. gthey can be applied multiple time to different agents. 
| Right panel "Email Presets" — Email Length pills, Tone dropdown, Call to Action dropdown, Personalization pills, Extra Instructions textarea (char counter), "Include Chat Link" toggle | Email Length/CTA/Personalization/Extra Instructions → **KEEP**, all real fields from our existing preset form, just shown as an inline side panel instead of a modal. **"Tone" dropdown** → **DECIDE**: we don't have a standalone tone field today — personality type (Hunter/Analyst/etc.) already implies a tone. Is this meant to be a separate field, or is it redundant with personality? --> agreed. I think perhaps we keep tone out. 
**"Include Chat Link" toggle** → **DECIDE/verify**: need to check if we already have a setting that controls whether the MQL chat link gets inserted into generated emails, or if this is new | --> mql chat is real. if there isnt a toggle already, make one. very improtant. perhasp build a setting where you can turn them off for all and on for all. 
| "Generate Preview" button + "save first for accurate results" note, preview pane | **NEW BUILD** — we don't have a way to generate a sample email from preset settings without a real lead today. Doable by reusing the existing AI email-writing pipeline against a synthetic/placeholder lead, but it's genuinely new functionality, not a restyle — **DECIDE** if this is worth building now or a later phase | --> we do actually. there is fake lead data i have injected. check again. 

---

## LEADS — "CRM" sub-tab (new screenshot)

| Mockup element | Translation |
|---|---|
| "CRM Connected: Salesforce", "Last synced", "Sync now", "Load from CRM" | "Load from CRM" → **KEEP**, our existing import-leads refresh. **"Sync now"** → **TRANSLATE/DECIDE**: the name implies two-way sync (pushing changes back), but we only import + the auditor can create/update individual CRM records via `crmAction`. Real version should probably just be relabeled to match what we actually do, unless two-way sync is something you want to scope in | --> i like this new structure ui alot better than the current auditor. I ageree with you in function though. the import may be...retyarded. maybe we jhave a import 50 option? i dont know whagt to do if someone has 10k people. we cannot impirt that for storage reasons. TBD.
| 4 stat counters: Imported Contacts / Duplicates Found / Missing Data / Ready to Assign | **TRANSLATE — different concept than ours.** Our current CRM audit is "agent researches & qualifies each contact" (status: fresh/queued/skipped, crmStatus: success/failed/skipped). The mockup describes a *data-hygiene* audit instead — detecting duplicate contacts and missing fields (phone/company size/email) before anything touches an agent. These are genuinely different features. **DECIDE**: do we want real duplicate/missing-data detection added (new build), or should this restyle just show OUR real categories (e.g. Researched / Queued / Skipped / Total) instead of the mockup's hygiene buckets? | --> sure. low priority though. 
| CRM Audit table: Name, CRM Source, Issue/Finding, Confidence, Status, Assigned Agent, Action | Name/Assigned Agent → **KEEP**. **CRM Source** → **KEEP** if multi-CRM, otherwise just shows the one connected provider. **Issue/Finding** ("Missing phone", "Duplicate matches", "Ready to create lead") → **TRANSLATE**, same data-hygiene-vs-research-status mismatch as above; real version would show our actual `crmAction`/`crmMessage`. --> agreed. **Confidence** → we don't compute a hygiene confidence score, but we do have lead-qualification confidence (`aiReport.confidence`) — different meaning, don't conflate. --> i would conflate. anf just explain that it is the same scorer. **Status** badges (Needs Review/Duplicate/Ready/Missing Email) → **TRANSLATE** to our real statuses (fresh/queued/skipped/success/failed). --> yes. **Action** button per row (Review/Merge/Create Lead/Assign) → "Create Lead"/"Assign" map to real actions we have; "Merge" (duplicate resolution) → **new build**, we don't merge duplicate contacts today | --> ill thin kabout it. would hyou know how to do that?
| Search + filter icon, pagination, rows-per-page | **KEEP** — standard, matches existing patterns |
| Right panel "Import Settings": connection details, environment, connected-by, connected-on, last-synced, "View connection logs" | Connection details/dates → **KEEP**, real data we already store on the CRM connection. **"View connection logs"** → **CUT or new build**, we don't have a connection-event log surfaced anywhere today | --> yeah no cut that.
| "Field Mapping (3)": Owner mapping, Email mapping, Lifecycle stage mapping, "Manage mapping" | **CUT for v1 / DECIDE.** We don't have configurable field-mapping today — our CRM integration uses fixed fields per provider. This is a real, sizeable new feature (letting users remap CRM fields ↔ our schema), not a restyle. Recommend treating as a later phase rather than part of this reorg unless you want to scope it in now | --> agreed. 
| "Saved / Assigned Contacts": Assigned this week / this month / total, "View" links | **KEEP if we have timestamps** — derivable from saved-contacts records if they carry a `createdAt`/assigned-date field; **DECIDE/verify** — need to check the data model has this before promising exact weekly/monthly counts | --> if not made, make now. 

---

## OUTREACH — "Sent" sub-tab (new screenshot)

| Mockup element | Translation |
|---|---|
| Pills: "← Follow-Ups", "Chat Qualified Leads" | **KEEP** — these are just quick links into two of our existing six Sent sub-tabs (Follow-ups, Chat Qualified Leads), shown as pills here instead of the full tab strip |
| Table: Thread (lead+contact name) / Sent (time ago) / Delivery (status badge) / Opens (count) / Replies (count) / Follow-up (status text) | **KEEP — all real.** This is a cleaner single-table restyle of our existing Sent Emails tab: "Delivery" consolidates our separate Bounced/Replied/Clicked/Opened/Sent badges into one column, "Opens"/"Replies" are counts we already track, "Follow-up" text ("Scheduled in 2 days", "Awaiting your response") maps directly to our existing follow-up scheduling + reply-detection logic. No new data needed, just a denser table layout instead of the current expandable-row list | --> agreed for all.

---

## Additional open decisions (from new screenshots)

10. Prospecting: agent "Edit" button — full settings page, or inline panel like the preset editor?
11. Prospecting: build agent/preset "Duplicate" now, or skip for v1?
12. Prospecting: is "Tone" a new field, or should it just be inferred from personality type?
13. Prospecting: do we already have an "include chat link in email" setting, or is this new? (needs a code check either way)
14. Prospecting: build "Generate Preview" (sample email without a real lead) now, or later phase?
15. Leads/CRM: real duplicate + missing-data detection (data hygiene) — new feature to build, or keep our existing research-status model and just restyle the table with our real categories?
16. Leads/CRM: build "Merge duplicates" action, or skip for v1?
17. Leads/CRM: build CRM field-mapping UI, or treat as a later phase (recommend later)?
18. Leads/CRM: verify saved-contacts records have timestamps for the weekly/monthly assigned counts

---

## GAP ANALYSIS — everything in FEATURE_INVENTORY.md not yet explicitly placed in the plan

The mockups only showed certain screens, so a lot of existing functionality from `FEATURE_INVENTORY.md` was never explicitly mapped to a new home. Going through it section by section. My recommendation is filled in where it's low-risk ("just carries over here, no real decision"); items marked **DECIDE** are genuine open questions.

| # | Item (from FEATURE_INVENTORY.md) | Recommendation | Your answer |
|---|---|---|---|
| G1 | Home: stat-card customize (drag/hide/reorder, localStorage) | **DECIDE** — mockup shows a fixed clean layout with no customize UI. Keep the drag/hide/reorder system (just restyled), or drop it for the simpler fixed mockup layout? | | --> keep custom. it is wanted.
| G2 | Home: section customize (drag/hide/reorder for the 8 sections) | **DECIDE** — same question as G1, for the section-level customize toggle | | --> same answer.
| G3 | Home: Quick Actions card (Start All Agents/Email Queue/Outreach/Analytics/Settings shortcuts) | **DECIDE** — mockup doesn't show this card. Keep it (relink destinations to new tabs) or drop since Recent Activity + stat chips already cover quick navigation? | | --> relink esstinations and rename. itll be helpful. 
| G4 | Home: Home Actions bar ("Create Agent" button + "Get Started" dropdown checklist) | **DECIDE** — same question, not shown in mockup. This is the main onboarding nudge for new users though — recommend keeping, just restyled | | --> keep it. 
| G5 | Home: standalone Getting Started card | **DECIDE** — likely redundant with G4's dropdown version. Recommend dropping the standalone card and keeping only the Home Actions dropdown version | | --> well getting started is important for new users. we will need ti make a ful flpow for that eventually. 
| G6 | Prospecting: old Operations 4-stat row (Sent/Queued/Cycles/Agents w/ delta% + tooltip + click-through) | Recommend folding into the Monitor Agents header bar as a compact row above the agent list — real data, just needs a place | | --> are we not already using this / doing this? if npot, sure. keep but make small
| G7 | Prospecting: old Agents-page summary stats row (Total Agents/Running/Sent/Queued/Replies/Reply Rate) | Recommend merging with G6 rather than keeping two separate stat rows — redundant once Monitor Agents and Agent Setup share one page | | --> agreed. 
| G8 | Prospecting: Create Agent 3-phase wizard, Delete confirm modal | Carries over unchanged, opened from "+ New Agent" — no decision needed, just confirming it's not lost | | --> yep. keep. is needed.
| G9 | Agent Detail page (`/agents/[id]`): Operations tab (status card, Set Interval modal, Reset Agent, recent-emails edit flow) + Outreach tab (Conversations/Analytics/Viewed/Settings sub-tabs, manual reply, AI auto-response toggle) | Whole page stays exactly as-is, untouched — just linked from Prospecting's "Open Dashboard" button. No decision needed | | --> yep. agreed. 
| G10 | Analytics fold-into-Home: CSV export button, Activity-log filter (All/Cycles/Issues/Agents) | Carries over alongside the charts when Analytics folds into Home — easy to miss since I only mentioned the charts before | | --> yep. merge. 
| G11 | Outreach Awaiting Review: `ScheduledBatchesModal`, `MassReEditModal`, `RebuildModal` (+ "save as agent writing rule?" prompt) | All carry over as toolbar/row actions in the new 3-pane layout — not shown in mockup but core functionality, no decision needed | | --> add these to a ... button. we will have one right?
| G12 | Outreach Sent: `EditFollowUpModal`, `MassRescheduleModal`, `MassFollowUpModal`, `ReplyDetailModal`, Templates tab, Unsubscribed tab | All carry over as part of the existing 6-tab system, just restyled into the denser table — no decision needed | | --> agreed.
| G13 | **Chat-Lab Knowledge Base + System Prompt tabs** — never addressed by the mockup plan at all (only Sessions made it in, as "Chat Qualified Leads" under Outreach/Sent) | **DECIDE** — should these move into Prospecting as part of agent settings (per the earliest plan), or stay on their own page for now? | | --> keep this. add as part of the mql chat section. it is needed. 
| G14 | Chat-Lab "Preview Chat" button (opens `/meet/preview?agentId=`) | Goes wherever G13 lands — with Knowledge Base/System Prompt if moved, otherwise stays put | |  --> yep same as what i said. 
| G15 | **CRM auditor-trigger workflow** (assign agent to contact batch → Run → live SSE progress → results feed) — not shown in your mockup screenshot at all, but it's core functionality, not just the hygiene-audit table | **DECIDE** — prominent button in the CRM tab header (e.g. "Run Auditor" next to Sync/Load), or tucked into row/selection actions (select contacts → "Assign & Run")? | | --> i want the new flow to follow the ui i sent you. this current system is confusing. so rewire anything into what we agreed on and drop anything uncecessary. 
| G16 | Leads/CRM: not-yet-connected state (CRM provider dropdown, 21 providers, dynamic credential form) | Carries over as the empty-state view for the CRM tab before a provider is connected — no decision needed | | --> yep
| G17 | Settings → Presets tab | Already flagged as a duplicate of Prospecting's Presets — recommend removing this tab from Settings now that Prospecting owns it | | --> yep.
| G18 | Calendar (`/calendar`) | Still has no home in the new IA (placeholder/static data only) — still an open question, not resolved by anything since | | --> add as part of outreach. like a little cendar section and connection, but nothing past that yet. 
| G19 | Help-as-agent upgrade | Confirmed still deferred as its own separate track, not part of this reorg | | --> we are making this later

