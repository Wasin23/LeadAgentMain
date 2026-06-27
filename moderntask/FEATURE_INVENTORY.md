# Meridian Dashboard — Full Feature Inventory (pre-reorg)

Generated as a working checklist for the dashboard reorg. Every button, view, modal, form field, and API connection currently in the app, organized by current page. Edit this directly — strike through / annotate what must carry over, what can be dropped, what changes.

---

## HOME (`/home`)

**Data fetched:** `/api/email-queue/counts?agentId=all`, `/api/auth/agents`, `/api/email-queue/sent?agentId=all`, `/api/email-queue/queue?agentId=all&limit=200`, `/api/email-queue/scheduled-batches`, `/api/notifications/recent?limit=6`, `/api/notifications/count`, `/api/plans/status`. Auto-refresh every 60s.

### Stats Cards (customizable: drag, hide, reorder — saved to localStorage)
- Total Emails Sent, Total Emails Queued, Running Agents, Cycles Completed
- (hidden by default, can be added back) Total Replies, Reply Rate, Total Agents Created, Pending Follow-ups, Scheduled Emails, Bounced Emails, Bounce Rate, Open Rate, Credit Balance
- "Customize" / "Done" toggle, "Reset stat cards" button, per-card hide (X), "Add:" pills to re-show

### Home Sections (customizable: drag, hide, reorder)
- Email Activity Over Time (area chart, Sent vs Replied, 7D/14D/30D toggle)
- Scheduled Sends (next 5 batches, "Soon" badge, click → /email-queue, "View queue →" link)
- Credit Consumption Over Time (bar chart, last 6 months)
- Agent Activity (running/idle agent list, click → /operations, "View operations →")
- Delivery Health (sent/open/bounce stats)
- Agent Progress (rings: sent-this-week vs lead limit, click → /operations, "done" badge)
- Upcoming Follow-ups (next 8, overdue/upcoming badge, click → /outreach, "View all →")
- Recent Notifications (last 6, unread indicator, click → /help, "View all →")
- "Edit Layout" / "Done" toggle, per-section hide (X), "Add section:" pills

### Quick Actions card
- Start All Agents → /operations
- Email Queue → /email-queue
- Outreach → /outreach
- Analytics → /analytics
- Settings → /settings

### Home Actions bar
- "Create Agent" button → /agents?create=true
- "Get Started" dropdown: progress badge (e.g. "2/4"), checklist (Create first agent / Connect email / Start agent / Get first reply or Create another agent), click step → navigates, auto-hides when complete

### Getting Started card (standalone)
- Same checklist as above, with CTA buttons per incomplete step; disappears when all complete

---

## PROSPECTING SOURCES

### Operations (`/operations`) — `components/operations/operations-content.tsx`

**Data fetched:** `/api/auth/agents`, `/api/email-queue/counts?agentId={id}` (parallel per agent), `/api/email-queue/sent?agentId=all`, `/api/plans/status`, SSE `/api/monitoring/stream`.

**Left panel — Agent list**
- Header: agent count badge, Refresh button, "Start All"/"Stop All" toggle button
- "All Agents" filter button (badge: running count)
- Per agent card: avatar w/ running-status dot, name, email-provider icon (Gmail/Outlook/Meridian/none), LinkedIn icon (enabled/disabled), Settings button → `/agents/{id}/settings`, Start/Stop/Refreshing button
  - Stats row: built count, queued count (amber), sent count (green)
  - Inline-editable Lead Limit (1–200) — saves via `/api/lead-agent/settings`
  - Inline-editable Concurrency (1–maxConcurrency) — saves via `/api/lead-agent/settings`
  - Current activity line (live, pulsing dot)
- Footer: "Manage Agents" button → `/agents`

**Right panel — Stats + Activity**
- 4 stat cards: Sent (→ /outreach), Queued (→ /email-queue), Cycles (→ /analytics), Agents (→ /agents) — each with delta %, tooltip
- Activity Log: filtered by selected agent, badges (running count, entry count)
- Per log entry: avatar, agent name, timestamp, score badge (color by score), contextual icon by message type, expandable reasoning panel (strengths/weaknesses/strategy/confidence/cited facts)
- Empty states: no active agents / waiting for activity

### Agents (`/agents`) — `components/agents/agents-content.tsx`, `presets-content.tsx`

**Data fetched:** `/api/auth/agents`, `/api/email-queue/counts?agentId={id}`, `/api/lead-agent/status?agentId={id}`, `/api/plans/status`.

**Toolbar**
- "X Agent(s)" / running count / plan badge ("{plan}: X/Y agents used") / concurrency limit text
- "+ New Agent" button (or "Upgrade to Add More" if at limit) → `/settings?tab=billing&upgrade=plans`

**Per Agent Card**
- Avatar, name, personality badge, status badge (Running/Idle), LinkedIn icon
- Stats pills: Queued / Sent / Replied / Reply%
- Last run time, next cycle countdown
- Preset tag, lead-limit text, inline-editable concurrency
- Industry/position tags (up to 4)
- Special instructions (truncated)
- Actions: Start/Stop, "Run Cycle", "Dashboard" → `/agents/{id}`, Settings icon → `/agents/{id}/settings`, Delete (trash icon, confirm modal)
- Auditor-mode lock state (disables start/stop)

**Create Agent modal (3-phase wizard)**
1. Personality select (5 types: Hunter, Relationship-Builder, Analyst, Consultant, Networker) + plan-limit warning/tier table
2. Name + special instructions textarea
3. Preset selection (optional) — list of presets w/ industries/positions preview, "Skip & Create" or "Create with Preset"

**Delete confirm modal** — name-specific warning, destructive confirm

**Summary stats row:** Total Agents, Running, Total Sent, Total Queued, Total Replies, Reply Rate

**Presets tab** (`presets-content.tsx`)
- "+ New Preset" button
- Per preset card: name, industries, positions, Edit / Delete (confirm modal)
- Preset form modal: name; targeting (positions tags, industries tags, min/max company size, leads/cycle); email settings (length, CTA, personalization, CC, BCC, follow-up interval); special instructions; writing rules; signature toggle + name/title

### Agent Detail (`/agents/[agentId]`) — 84KB

**Data fetched:** agent list, `/api/lead-agent/status`, `/api/lead-agent/activity-logs`, `/api/email-queue/sent|queue`, `/api/outreach/stats|conversations|viewed`, `/api/lead-agent/settings`, SSE progress + outreach streams.

**Top bar:** Back link, name, personality badge, status badge, Settings button, Start/Stop

**Operations tab**
- Status card (personality, status, last run, next-cycle countdown, current activity)
- Controls: Start/Stop, Run Cycle, Reset Agent, Set Interval (modal: minutes input)
- Recent Emails list: search, filter (All/Sent/Opened/Replied), pagination, click → detail view → Edit form (To/CC/BCC/Subject/Body, Save/Cancel)
- Email Queue / Pending Approvals: search, sort, pagination, Preview/Approve/Reject/Edit per email
- Activity log (last 50)

**Outreach tab**
- Sub-tabs: Conversations / Analytics / Viewed / Settings
- Stats pills: viewed, replied, meetings booked, conversion rate
- Conversations: search, filter (All/Active/Replied/Waiting), thread detail w/ manual reply box + AI auto-response toggle, "Open in Outreach" link
- Analytics: summary stats + time-series chart
- Viewed: paginated list of opened emails
- Settings: AI auto-response toggle, Enable Rebumps toggle, System Prompt textarea (edit/save)

### Agent Settings (`/agents/[agentId]/settings`) — 87KB
- Tabs: Agent Info, Email Settings, Targeting, Follow-ups, Advanced
- Agent Info: name, personality (display), description/instructions, Save
- Email Settings: length, CTA, personalization, signature toggle+fields, CC/BCC, Save
- Targeting: industries, job titles, company size range, lead limit, Save
- Follow-ups: rebump interval, max follow-ups, auto-follow-up toggle, Save
- Advanced: concurrency (w/ plan-limit warning), other advanced opts, Save
- Danger zone: Delete agent (confirm modal)

---

## ANALYTICS (`/analytics`) — `components/analytics/analytics-content.tsx`

**Data fetched:** `/api/auth/agents`, `/api/email-queue/counts?agentId=all|{id}`, `/api/email-queue/sent?agentId=all`, `/api/monitoring/activity`, credit balance.

- "Export Report (.csv)" button — generates multi-section CSV (summary, agent performance, email activity, sender stats, monthly volume, recent sent)
- 4 summary cards (Queued, Sent, Replies, Reply Rate) — live-indicator dot, click-through to /email-queue or /outreach
- Agent Performance Over Time (line chart, day/week/month toggle, one line per agent)
- Reply Trend Over Time (line chart, Sent vs Replied)
- Monthly Credit Consumption (bar chart, last 6 months)
- Sender Delivery Stats (table: sender, total sent, bounced, opened, success rate, open rate — top 10)
- Activity log (filter: All/Cycles/Issues/Agents)

---

## OUTREACH SOURCES

### Email Queue (`/email-queue`) — `components/email-queue/email-queue-content.tsx`, 84KB

- Agent selector (All / individual), font-size zoom controls
- Queue header: count badge, auto-send status badge(s), "Active Schedules" button (modal), "Schedule for Send" toggle
- **AgentScheduleCard:** day-of-week toggles, send-time (hour/min/AM-PM), daily limit input, timezone selector, Save (→ `/api/auth/agents/{id}/settings`)
- **Queue list toolbar:** Select All, Send/Reject (selected), Bulk Send/Reject, Mass Re-edit (modal), Refresh (auto every 15s), Search
- Pagination (first/prev/page indicator/next/last)
- **Per email row:** checkbox, expand (full body, badges: follow-up / auto-schedule / scheduled-send, "View Report" link), more-actions menu (Schedule/Reschedule modal, Edit modal, Rebuild modal), Send button, Reject button
- **ScheduleModal:** datetime input, timezone selector, clear schedule, Save
- **EditModal:** To/CC/BCC/Subject/Body, Save/Cancel
- **MassReEditModal:** instruction textarea (300 char/30 word limit), progress bar, per-email AI rewrite, completion summary
- **ScheduledBatchesModal:** list of batches, edit time inline, delete (confirm)
- **RebuildModal:** instruction textarea, AI rebuild, "save as agent writing rule?" follow-up prompt
- **AIReportModal:** score/confidence/tier/sources badges, analysis (reasoning, strengths), concerns, key evidence (linked sources), all-sources list, metadata

### Contacted / Sent (`/outreach`) — `components/outreach/contacted-content.tsx`

- Agent filter dropdown, Refresh button
- **6 sub-tabs:** Sent Emails, Replies, Follow-ups, Unsubscribed, Templates, Chat Qualified Leads (formerly "MQL Chat" — now has an explanatory info box)

**Sent Emails tab:** search; selection mode (Reschedule modal, Schedule Follow-ups, Send Now, Done); per-row status badge (Bounced/Replied/Clicked/Opened/Primary inbox/Sent), follow-up badge, engagement icons, more-menu (schedule/edit/send-now/cancel-all), expand row (full body, "View Research Report"); pagination

**Replies tab:** search; per-row classification badge, status badge, sentiment badge, engagement counters; click → **ReplyDetailModal** (full thread, metadata)

**Follow-ups tab:** search; per-row status (scheduled/sent/overdue), edit/cancel/retry; **right sidebar:** Auto Follow-ups toggle + interval/max-sends inputs + save, Smart Follow-ups (AI) toggle, pending-follow-ups stack w/ per-item cancel

**Unsubscribed tab:** list (name, company, email, time, agent, source)

**Templates tab:** agent selector pills; "+ Add template" form (name, subject w/ placeholders, body); "+ Mass Follow-up" modal (template picker); per-template card (delete)

**Chat Qualified Leads tab:** explanatory info box (what it is); refresh; per-session row (lead name/company, intent score badge, status, message count, time); "View in MQL Chat" link → `/chat-lab?session={id}`

**Modals:** EditFollowUpModal, MassRescheduleModal, MassFollowUpModal, ReplyDetailModal

### Chat Lab (`/chat-lab`) — `components/chat-lab/chat-lab-content.tsx`, 49KB

- Agent selector, total-sessions counter, docs counter, "Preview Chat" button (opens `/meet/preview?agentId=`)
- **Knowledge Base tab:** drag/drop upload (.pdf/.docx/.txt/.md) → chunked+embedded; per-doc: type badge (Case Study/Pricing/Objection Handler/Battle Card/FAQ/Process/General), chunk count, edit type, view chunks (read-only), delete
- **System Prompt tab:** version selector (history), "unsaved" badge, Save; large prompt textarea; available-variables reference box
- **Sessions tab:** total-in-DB count; per-session card (lead name, intent score badge, company, expiry status, created time, message count, delete w/ confirm); selected-session panel:
  - Conversation: Export Chat (as .txt), message list
  - Research Context ("What the AI knows"): Your Company / Why they'd buy / Email hooks used / Research facts / Original email — view mode and full edit mode (all fields editable)
  - Chat link expiry selector (1wk–6mo–forever), saves via PATCH

---

## LEADS SOURCES

### CRM (`/crm`) — `components/crm/crm-content.tsx`, 40KB

- Saved Contacts: Clear all, Load from CRM (refresh)
- Search, company filter, source filter, clear filters
- Selection: select all / +this page / clear selection, per-contact checkbox/click
- Agent roster: click or drag-assign agent to auditor slot; remove (X)
- Run Auditor (start), Stop, Start New Batch (after completion)
- Pagination (50/page)
- Live progress indicator + status line (SSE) while auditor runs
- Recent Auditor Results feed (last 12): contact, company, email, CRM sync status/message, integration, timestamp

### CRM Connection (currently under Settings, moving to Leads)

- CRM status indicator, CRM platform dropdown (21 providers: ActiveCampaign, HubSpot, Salesforce, Pipedrive, Zoho, Copper, Close, Affinity, Capsule, Insightly, Keap, Dynamics 365, Nutshell, Pipeliner, Salesflare, SugarCRM, Teamleader, Teamwork, Vtiger, Zendesk Sell, Accelo)
- Dynamic credential form per provider (API URL / API Key / Access Token, varies)
- Connect / Change / Reconnect / Disconnect
- Import Contacts (collapsible list), Refresh

### (New) All Leads list — does not exist yet
- To be built from existing `aiReport` (score/tier/confidence) + `leadDetails` already present on email-queue/sent records — no backend schema change needed for v1, just a new aggregating list view + detail panel (research report links, email link-through)

---

## GENERAL TABS (staying in place)

### Settings (`/settings`) — `components/settings/settings-content.tsx`, 114KB, 9 sub-tabs

- **Profile:** account info (username/email/userId/member-since), copy userId, change password form, forgot-password link, Reset Account Data (confirm modal, types "reset account")
- **Appearance:** Light / Dark / System theme buttons
- **Notifications:** notification feed (refresh, mark-all-read, filter pills: All/Unread/Replies/Opens/Meetings/Failed, click-to-read), preference toggles (Email/Agent Activity/Lead Response/Error Alerts)
- **Company Profile:** basic info, contact & links, market & offering fields; "Reset from website" (scrape), Save
- **Outreach/Email:** Gmail connect/add-account/set-active/disconnect (multi-account), Outlook same, LinkedIn connect/disconnect, reassign-agents flow + reverted-agents banner, Meridian/Gmail/Outlook/Follow-up sending toggles
- **CRM Connection:** *(moving to Leads — see above)*
- **Memory:** keyword stats (total/exhausted/avg dup rate/total searches), filter pills (All/Exhausted/High Dup/Good), keyword table (attempts/duplicates/rate bar/status), reset single/reset all, Industry Intelligence (expand by industry, delete fact, delete industry)
- **Presets:** *(now lives under Prospecting → reuses same `presets-content.tsx`; consider removing this duplicate tab)*
- **Billing:** plan info, payment history table (filter All/Paid/Failed), via `billing/payment-history-section.tsx`

### Calendar (`/calendar`) — placeholder only
- Month grid, prev/next month, "Today's Events" sidebar — all static/sample data, **no real backend integration yet**. No defined home in the new IA — flagged open item.

### Team (`/team`) — `components/team/team-content.tsx`
- No-team state: Create team (name input), Join team (code/link input + preview)
- With-team state: team header, invite link (copy, refresh), members list, role change dropdown (per member), remove member, Leave (member) / Disband (owner) — all with confirm dialogs

### Help (`/help`) — `components/help/help-content.tsx`
- Chat view: message list, send box, edit/resend own messages, "Need more help?" → contact form
- Contact form view: name/email/subject/message, Send Message, Quick Help sidebar, Contact Info sidebar
- **Planned upgrade (separate track):** Help becomes an agent with read access across app state/settings to proactively direct users — not yet built

### Notifications (`/notifications`, header-icon panel)
- Filter tabs (All/Unread/Replies/Opens/Meetings/Batches/Failed), mark-all-read, click-to-read
- Preferences: email toggle, SMS toggle + phone input

---

## Cross-cutting API surface (for reference)
~80+ distinct REST endpoints plus SSE streams (`/api/monitoring/stream`, `/api/lead-agent/progress-stream`, `/api/outreach/stream`). Full per-page list is in each section above — nothing here should be assumed gone just because a page moves; only the **container** changes, not the underlying calls, unless explicitly decided otherwise.
