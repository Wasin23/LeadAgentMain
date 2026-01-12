# Meridian Agent - Technical Documentation

**Last Updated:** December 30, 2025  
**Status:** Help chat AI assistant implemented, outreach tracking page launched, Gmail OAuth popup implemented, navigation redesigned

---

## Architecture Overview

Meridian is a multi-agent AI platform for automated lead outreach and email management. The system uses:

- **Backend:** Node.js 18+ / Express 5.1.0 on Render (https://meridian-kdew.onrender.com)
- **Frontend:** Next.js 15.5.7 with TypeScript 5, React 19.1.0, Tailwind CSS 4
- **Database:** AWS DynamoDB (tables: UserSettings, AgentSettings, LeadEmails, EmailTracking)
- **Email Providers:** 
  - Mailgun (replies@mg.meridianagent.xyz) - legacy/fallback
  - Gmail API (user's own Gmail account) - new primary method
- **AI Models:** 
  - OpenAI GPT-4 (via openai ^5.12.0) for email generation and reasoning
  - Anthropic Claude (via @anthropic-ai/sdk) for specific research tasks
  - Langchain 0.3.30 for agent orchestration
- **Vector DB:** Zilliz Cloud for lead memory, training data, email tracking
- **Message Queue:** AWS SQS for email queue processing
- **Storage:** AWS S3 for backups and attachments

---

## Critical Features & Systems

### 1. Orphan Email Management System

**Purpose:** Automatically track and reassign emails from deleted agents to prevent lost leads.

**How It Works:**
- When an agent is deleted, all associated emails are automatically reassigned to a special "orphan" agent ID
- Emails retain their `originalAgentId` field for tracking purposes
- `reassignedAt` timestamp added to track when reassignment occurred
- Orphaned emails display with a red "ORPHANED" badge in the dashboard

**Implementation:**
- **Backend:** `utils/awsEmailQueue.js` - `reassignEmailToAgent(userId, oldAgentId, emailId, newAgentId)` method
- **Deletion Flow:** `routes/leadAgent.js` - DELETE endpoint (lines 1134-1235)
- **Frontend Display:** Dashboard shows orphan badge and original agent ID

**Reassignment Process:**
1. Agent deletion triggered
2. Fetch all emails (QUEUED, APPROVED, SENT, REPLIED) for agent
3. Loop through each email and call `reassignEmailToAgent`
4. Delete old DynamoDB item, create new with "orphan" agent ID
5. Preserve `originalAgentId` for reference
6. Complete agent cleanup (state, history, settings)

### 2. Agent Preset Management System

**Purpose:** Create reusable agent configurations to quickly set up new agents with consistent settings.

**Features:**
- Create, view, and delete agent presets
- Configure targeting criteria (industries, positions, company size)
- Set email parameters (length, CTA, personalization level)
- Apply presets to multiple agents
- Track preset usage across agents

**Preset Configuration:**
- Target industries (comma-separated)
- Target positions (comma-separated)
- Company size range (min/max employees)
- Lead limit per cycle
- Email length (short/medium/long)
- Call to action (meeting, reply, call, demo, website)
- Personalization level (low/medium/high)
- CC emails (optional)

**Implementation:**
- **Backend:** `routes/settings.js` - GET/POST/PUT/DELETE `/api/settings/presets` endpoints
- **Storage:** DynamoDB UserSettings table under `settingsPresets` array
- **Frontend:** Agent overview page with dedicated Presets tab
- **UI:** Tabbed interface to switch between Agents and Presets

### 3. Gmail Integration (Pub/Sub + OAuth)

**Purpose:** Allow users to send emails from their own Gmail account instead of Mailgun, improving deliverability and sender reputation.

#### OAuth Flow (routes/calendar.js)

**Scopes Required:**
```javascript
[
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',  // Added for Gmail
  'https://www.googleapis.com/auth/gmail.send',      // Added for Gmail
  'https://www.googleapis.com/auth/gmail.modify'     // Added for Gmail
]
```

**Endpoints:**
- `GET /api/calendar/google-oauth-url` - Generates OAuth URL with Gmail scopes
- `GET /api/calendar/google-oauth-callback` - Handles OAuth callback, stores tokens, auto-setup Gmail watch

**Token Storage:**
```javascript
// Stored in DynamoDB UserSettings table
userSettings.calendarTokens = {
  access_token: "...",
  refresh_token: "...",
  scope: "calendar.events calendar.readonly gmail.readonly gmail.send gmail.modify",
  token_type: "Bearer",
  expiry_date: 1234567890
}

// Legacy format also supported:
userSettings.gmailAuth = {
  refreshToken: "...",
  accessToken: "..."
}

// Multi-account format:
userSettings.gmailAccounts = [
  { email: "user@gmail.com", refreshToken: "..." }
]
```

**Auto-Setup Gmail Watch:**
After OAuth success (lines 78-87 in calendar.js):
```javascript
const gmailManager = new GmailManager();
await gmailManager.setupPushNotifications(userId, {
  refresh_token: tokens.refresh_token,
  access_token: tokens.access_token
});
```

#### Gmail Pub/Sub System (routes/gmail-pubsub.js)

**GCP Setup Required:**
1. Create Pub/Sub topic: `gmail-push-notifications`
2. Create subscription pointing to: `https://meridian-kdew.onrender.com/api/gmail-pubsub/gmail-notification`
3. Grant Gmail API permission to publish to topic
4. Set watch expiration: 7 days (requires renewal)

**Webhook Endpoint:**
`POST /api/gmail-pubsub/gmail-notification`

**Flow:**
1. Gmail receives email → Publishes to Pub/Sub topic
2. Pub/Sub pushes to webhook with base64 encoded message
3. Decode message to get `emailAddress` and `historyId`
4. Fetch user from DynamoDB via email
5. Get last processed historyId: `await getGmailLastHistoryId(userId)`
6. Call `gmailManager.getHistory(userId, tokens, startHistoryId)`
7. Extract new messages from history changes
8. Check for `In-Reply-To` header matching tracking IDs
9. Process replies via `/api/webhooks/handle-reply` route

**Reply Classification:**
```javascript
// Intent types (gmail-pubsub.js lines 100-145):
OUT_OF_OFFICE    // Auto-responder detected
UNSUBSCRIBE      // User wants to be removed
NEGATIVE         // Hard no, stop contact
BOUNCE           // Delivery failure
POSITIVE         // Interested/engaged
QUESTION         // Asking for info
```

**Reply Guardrails:**
- Max 3 AI-generated replies per conversation thread
- Stored in DynamoDB: `await getConversationReplyCount(trackingId)`
- Increment on each reply: `await incrementConversationReplyCount(trackingId)`
- If UNSUBSCRIBE detected: `await markAsUnsubscribed(leadEmail)`

#### Gmail Manager (utils/gmailManager.js)

**Key Methods:**

**sendEmail(userId, userSettings, to, subject, body, trackingId)**
- Lines 83-261: Core Gmail sending logic
- Supports 3 token formats: gmailAuth, gmailAccounts, calendarTokens
- Creates RFC 2822 message with tracking headers
- Returns: `{ success, messageId, trackingId, sentFrom, provider: 'gmail' }`

**Message Format:**
```javascript
// Lines 155-175: RFC 2822 construction
const message = [
  `From: ${fromEmail}`,
  `To: ${to}`,
  `Subject: ${subject}`,
  `Message-ID: <${trackingId}@gmail.com>`,  // CRITICAL for reply tracking
  `MIME-Version: 1.0`,
  `Content-Type: text/plain; charset=UTF-8`,
  ``,
  body
].join('\r\n');

// Base64 URL-safe encoding
const encodedMessage = Buffer.from(message)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
```

**setupPushNotifications(userId, tokens)**
- Lines 418-500: Gmail watch setup
- Topic: `projects/YOUR_PROJECT/topics/gmail-push-notifications`
- Label filtering: `['INBOX']`
- Returns watchResponse with historyId
- Stores: `await saveGmailLastHistoryId(userId, historyId)`

**stopPushNotifications(userId, tokens)**
- Lines 502-528: Stop Gmail watch
- Calls `gmail.users.stop({ userId: 'me' })`

**getHistory(userId, tokens, startHistoryId)**
- Lines 530-555: Fetch history changes
- Returns all messages added since startHistoryId
- Used by Pub/Sub webhook to process new emails

### 2. Email Routing System (tools/emailMailgun.js)

**Decision Tree (lines 193-330):**

```javascript
// Step 1: Check agent setting
const useGmailForAgent = agentSettings?.emailBuilder?.useGmail === true;

// Step 2: Check token availability
const hasGmailTokens = 
  userSettings?.gmailAuth?.refreshToken || 
  (userSettings?.calendarTokens?.refresh_token && 
   userSettings?.calendarTokens?.scope?.includes('gmail'));

// Step 3: Route decision
if (hasGmailTokens && useGmailForAgent) {
  gmailConnected = true;
  
  // Attempt Gmail send (lines 212-257)
  try {
    const gmailManager = new GmailManager();
    const result = await gmailManager.sendEmail(
      userId, userSettings, leadEmail, subject, emailBody, trackingId
    );
    
    if (result.success) {
      // Store tracking data with Gmail provider
      await storeTrackingData({
        trackingId,
        userId,
        agentId,
        leadEmail,
        leadName,
        companyName,
        sentFrom: result.sentFrom,  // user@gmail.com
        provider: 'gmail',
        messageId: result.messageId
      });
      
      console.log('🚀 RETURNING FROM GMAIL - SHOULD NOT CONTINUE TO MAILGUN');
      return {
        success: true,
        trackingId,
        provider: 'gmail',
        fromAccount: result.sentFrom
      };  // SHOULD EXIT FUNCTION HERE
    }
  } catch (error) {
    console.log('Gmail send failed, falling back to Mailgun:', error);
    gmailConnected = false;
  }
}

// Step 4: Mailgun fallback (lines 270-330)
// ⚠️ ACTIVE BUG: This code executes even when Gmail succeeds
if (gmailConnected) {
  console.log('⚠️ BUG: gmailConnected=true but still reached Mailgun code!');
}

// Mailgun send logic...
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: 'mg.meridianagent.xyz' });
const data = {
  from: 'Meridian Agent <replies@mg.meridianagent.xyz>',
  to: leadEmail,
  subject: subject,
  text: emailBody,
  'h:Message-ID': `<tracking-${trackingId}@mg.meridianagent.xyz>`,
  'h:Reply-To': 'replies@mg.meridianagent.xyz'
};
```

**Known Issue - Dual Send Bug:**
- Symptom: When `useGmail=true`, emails send from BOTH Gmail and Mailgun
- Status: Debug logging added (lines 250, 275-277) to trace execution
- Hypothesis: Return statement not exiting function properly
- Next Steps: Run test and check logs to determine root cause

### 3. Agent Settings System

#### Database Schema (DynamoDB AgentSettings table)

**Primary Key:** `agentId` (string)

**Critical Fields:**
```javascript
{
  agentId: "uuid",
  userId: "uuid",
  name: "Agent Name",
  persona: "Hunter" | "Relationship Builder" | "Analyst" | "Consultant" | "Networker",
  targetProfile: "...",
  
  // EMAIL BUILDER SETTINGS (NEW)
  emailBuilder: {
    length: "short" | "medium" | "long",
    callToAction: "meeting" | "demo" | "info" | "call",
    personalization: "low" | "medium" | "high",
    enableAutoResponse: true,
    rebumpIntervalDays: 7,
    ccEmails: "email1@example.com, email2@example.com",
    bccEmails: "",
    useGmail: false,  // ⭐ KEY FIELD - Toggle Gmail vs Mailgun
    emailResponsePrompt: "Custom AI response instructions..."
  },
  
  // Other settings...
  researchDepth: "basic" | "standard" | "deep",
  dailyLeadLimit: 50,
  timezone: "America/New_York",
  active: true
}
```

**Setting Storage Flow:**

1. **Agent Creation** (routes/auth.js line 800+):
```javascript
POST /api/auth/create-agent
Body: {
  name: "Agent Name",
  persona: "Hunter",
  useGmail: true,  // ⭐ Passed from frontend
  // ... other fields
}

// Line 933: Initialize emailBuilder
const initialSettings = {
  emailBuilder: {
    length: 'medium',
    callToAction: 'meeting',
    personalization: 'high',
    enableAutoResponse: true,
    rebumpIntervalDays: 7,
    ccEmails: '',
    bccEmails: '',
    useGmail: useGmail || false,  // ⭐ Stored here
    emailResponsePrompt: '...'
  }
  // ... rest of settings
};

// Line 988: Apply preset overrides if provided
if (preset?.useGmail !== undefined) {
  initialSettings.emailBuilder.useGmail = preset.useGmail;
}

// Line 1036: Persist to DynamoDB
await saveLeadAgentSettings(agentId, initialSettings);
```

2. **Settings Update** (routes/settings.js):
```javascript
POST /api/settings/save-agent-settings
Body: {
  agentId: "uuid",
  settings: {
    emailBuilder: {
      useGmail: true,  // ⭐ Toggle updated
      // ... other fields
    }
  }
}

// Calls: await saveLeadAgentSettings(agentId, settings);
```

#### Frontend Components

**AgentOnboarding.tsx** (frontend/src/components/agents/)
- Lines 161: `const [useGmail, setUseGmail] = useState(false)`
- Lines 168: Added `'gmail-setup'` step to onboarding wizard
- Lines 1631-1752: GmailSetupStep UI component
```javascript
<div className="flex items-center justify-between">
  <div>
    <h3>Send from your Gmail account</h3>
    <p>Better deliverability and reply tracking</p>
  </div>
  <Switch
    checked={useGmail}
    onCheckedChange={setUseGmail}
  />
</div>

{useGmail && (
  <Button onClick={handleConnectGmail}>
    {gmailConnected ? '✓ Connected' : 'Connect Gmail'}
  </Button>
)}
```

**AgentSettingsModal.tsx** (frontend/src/components/agents/)
- Lines 213: Default `emailBuilder.useGmail = false` in state
- Lines 1339-1367: Gmail toggle in settings modal
```javascript
<div className="space-y-2">
  <Label>Email Sending Method</Label>
  <div className="flex items-center justify-between p-3 border rounded">
    <div>
      <div className="font-medium">
        {editedSettings.emailBuilder.useGmail 
          ? '✓ Sending from your Gmail account' 
          : 'Sending via Mailgun'}
      </div>
      <p className="text-sm text-muted-foreground">
        {editedSettings.emailBuilder.useGmail
          ? 'Using your connected Google account'
          : 'Using Meridian\'s email service'}
      </p>
    </div>
    <Switch
      checked={editedSettings.emailBuilder.useGmail}
      onCheckedChange={(value) => updateField('emailBuilder', 'useGmail', !value)}
    />
  </div>
</div>
```

### 4. Email Generation System

#### AI Prompt Architecture (agent/reasoningLeadAgent.js)

**Location:** Lines 3139-3318 (`commonRuleset` variable)

**Prompt Structure:**

1. **Prospect Information Template** (lines 3140-3145)
2. **Solution Information** (lines 3147-3150)
3. **Personality-Driven Strategies** (lines 3155-3200)
4. **Research-Driven Approach** (lines 3205-3225)
5. **Subject Line Patterns** (lines 3230-3250)
6. **Email Body Guidelines** (lines 3255-3318) ⭐ RECENTLY UPDATED

**Personality Types (lines 3155-3200):**

```javascript
// HUNTER - aggressive, urgent, FOMO-driven
"Short, punchy sentences. Lead with urgency. Use numbers and deadlines. 
Example: 'You're leaving $X on the table. Here's why.'"

// RELATIONSHIP BUILDER - warm, conversational, long-term focused
"Friendly tone, show genuine interest. Focus on partnership over transaction.
Example: 'Love what you're building at [Company]...'"

// ANALYST - data-driven, logical, detailed
"Lead with data and research. Use industry benchmarks. Structured arguments.
Example: 'At $XM ARR, companies typically face [specific challenge]...'"

// CONSULTANT - advisory, educational, thought leadership
"Position as expert. Share insights. Educate before selling.
Example: 'Most [industry] companies at your stage overlook [insight]...'"

// NETWORKER - referral-based, name-dropping, social proof heavy
"Mention mutual connections, similar companies, social proof.
Example: 'Worked with [Similar Company] on [outcome]...'"
```

**Email Body Guidelines (lines 3255-3318) - RECENTLY UPDATED:**

**Previous (Rigid):**
```
"Sentence 1: Open with SPECIFIC data point..."
"Sentence 2: State the exact pain point..."
[etc]
```

**Current (Dynamic Flow):**
```
Write a natural, flowing email that feels like a real person researched them.

OPENING (1-2 sentences):
Start with something that proves you did homework. Use specific numbers.
Examples:
- "Noticed you just crossed $50M ARR - congrats. At that scale, most SaaS 
   companies start drowning in contractor payments."

TRANSITION TO PROBLEM (1-2 sentences):
Connect their situation to specific pain. Use numbers to show real cost.
Examples:
- "Companies at your size typically waste 35% of finance bandwidth just 
   processing contractor invoices."

VALUE PROPOSITION (2-3 sentences):
Explain HOW your solution fixes this. Include social proof with numbers.
Examples:
- "We automate the entire contractor payment workflow. TechCorp processed 
   500 contractors without adding finance headcount, cutting time from 
   3 days to 4 hours."

CLOSE WITH TIMING + CTA (1-2 sentences):
Connect to their current situation and why acting now matters.
Examples:
- "Given your hiring pace, this gets more painful every quarter. Worth 
   15 minutes to walk through the numbers?"

TARGET: 7 sentences, but flow naturally (6-8 is fine for clarity)
```

**Research Priority (lines 3205-3225):**
1. Financial data (revenue, funding, growth rate) → ROI angle
2. Pain point from tech stack/process → Problem-first approach
3. Recent news (funding, expansion, hiring) → Timely relevance
4. Company stage/size benchmarks → Industry insight
5. Nothing specific → Direct value prop with social proof

**Banned Phrases (lines 3290-3310):**
- "impressive company" / "innovative work"
- "transformative" / "revolutionary" / "cutting-edge" / "game-changing"
- "we can help" / "solutions for your needs"
- "reach out" / "circle back" / "touch base"
- "best-in-class" / "industry-leading" / "world-class"
- Any generic buzzword without specific meaning

### 5. Reply Tracking & Webhooks

#### Mailgun Webhooks (routes/webhooks-reply.js)

**Endpoint:** `POST /api/webhooks/replies`

**Trigger:** Mailgun forwards replies to replies@mg.meridianagent.xyz

**Flow:**
1. Extract `In-Reply-To` header from incoming email
2. Parse tracking ID from Message-ID: `<tracking-{trackingId}@mg.meridianagent.xyz>`
3. Fetch lead and agent data from DynamoDB
4. Classify reply intent (OUT_OF_OFFICE, POSITIVE, NEGATIVE, etc.)
5. Check conversation reply count (max 3 AI responses)
6. If under limit: Generate AI response via reasoning agent
7. Send response and increment counter
8. Update lead status and tracking data

#### Desktop Email Webhooks (routes/webhooks-desktop.js)

**Purpose:** Track emails sent from user's desktop email client

**Endpoint:** `POST /api/webhooks/desktop-email-sent`

**Use Case:** If user manually sends email to lead from Gmail/Outlook, system tracks it

### 6. AWS Infrastructure

#### DynamoDB Tables

**UserSettings** (Primary Key: userId)
```javascript
{
  userId: "uuid",
  email: "user@example.com",
  name: "User Name",
  subscription: {
    status: "active" | "trialing" | "past_due" | "canceled",
    tier: "free" | "starter" | "pro" | "enterprise",
    stripeCustomerId: "cus_xxx",
    currentPeriodEnd: 1234567890
  },
  calendarTokens: {
    refresh_token: "...",
    access_token: "...",
    scope: "calendar.events gmail.readonly gmail.send...",
    expiry_date: 1234567890
  },
  gmailAuth: { ... },  // Legacy format
  gmailAccounts: [ ... ],  // Multi-account format
  apiUsage: {
    openai: { calls: 0, cost: 0 },
    anthropic: { calls: 0, cost: 0 }
  }
}
```

**AgentSettings** (Primary Key: agentId)
- See "Agent Settings System" section above

**LeadEmails** (Primary Key: leadId)
```javascript
{
  leadId: "uuid",
  agentId: "uuid",
  email: "lead@company.com",
  name: "Lead Name",
  company: "Company Name",
  status: "pending" | "sent" | "replied" | "bounced" | "unsubscribed",
  lastContactDate: "2025-12-28T10:00:00Z",
  conversationHistory: [
    { timestamp, from, to, subject, body, trackingId }
  ],
  researchData: {
    revenue: "$50M",
    employees: 250,
    funding: "Series B",
    techStack: ["React", "AWS"],
    painPoints: ["..."]
  }
}
```

**EmailTracking** (Primary Key: trackingId)
```javascript
{
  trackingId: "uuid",
  userId: "uuid",
  agentId: "uuid",
  leadEmail: "lead@company.com",
  leadName: "Lead Name",
  companyName: "Company Name",
  sentFrom: "user@gmail.com" | "replies@mg.meridianagent.xyz",
  provider: "gmail" | "mailgun",
  messageId: "...",
  subject: "...",
  sentAt: "2025-12-28T10:00:00Z",
  opens: 0,
  clicks: 0,
  replied: false,
  bounced: false
}
```

**GmailWatchState** (Composite Key: userId + email)
```javascript
{
  userId: "uuid",
  email: "user@gmail.com",
  lastHistoryId: "12345678",
  watchExpiration: 1234567890,
  conversationReplyCounts: {
    "trackingId1": 2,
    "trackingId2": 1
  },
  unsubscribedEmails: ["lead@example.com"]
}
```

#### AWS Manager Methods (utils/awsManager.js)

**Gmail-Specific Methods (lines 226-275):**
```javascript
// Store last processed history ID
async getGmailLastHistoryId(userId)
async saveGmailLastHistoryId(userId, historyId)

// Track reply counts per conversation
async getConversationReplyCount(trackingId)
async incrementConversationReplyCount(trackingId)

// Unsubscribe management
async markAsUnsubscribed(leadEmail)
async isUnsubscribed(leadEmail)
```

**Agent Settings (lines 665-683):**
```javascript
async saveLeadAgentSettings(agentId, settings)
async getLeadAgentSettings(agentId)
```

**User Settings (lines 100-150):**
```javascript
async getUserSettings(userId)
async updateUserSettings(userId, updates)
```

### 7. Research & Intelligence Systems

#### Lead Research Agent (src/researchAgent.js)

**Tools Available:**
- `companyIntelligence.js` - Financial data, tech stack, news
- `deepResearch.js` - Deep dive into specific topics
- `internetSearch.js` - Google search via SerpAPI
- `webpageFetcher.js` - Fetch and parse webpage content

**Research Output:**
```javascript
{
  company: {
    name: "Company Inc",
    domain: "company.com",
    revenue: "$50M ARR",
    employees: 250,
    funding: "Series B - $30M",
    lastFundingDate: "2024-06-15"
  },
  techStack: ["React", "AWS", "Stripe", "Segment"],
  recentNews: [
    { title: "...", date: "...", url: "..." }
  ],
  painPoints: [
    "Scaling customer support team",
    "Manual payment reconciliation"
  ],
  keyPeople: [
    { name: "John Doe", title: "CEO", linkedin: "..." }
  ]
}
```

#### Reasoning Lead Agent (agent/reasoningLeadAgent.js)

**Purpose:** Orchestrates email generation using research data

**Flow:**
1. Receive lead data (email, company, research)
2. Fetch agent settings (persona, emailBuilder config)
3. Build prompt with commonRuleset + research
4. Call GPT-4 for email generation
5. Validate email meets guidelines
6. Return subject + body

### 8. Monitoring & Analytics

#### Cost Tracking (middleware/apiCostTracker.js)

**Tracked Services:**
- OpenAI (gpt-4, gpt-3.5-turbo, embeddings)
- Anthropic (claude-3-opus, claude-3-sonnet)
- SerpAPI (search queries)
- Zilliz (vector operations)

**Storage:** DynamoDB UserSettings.apiUsage

#### Activity Tracking (middleware/activityTracker.js)

**Events Logged:**
- Agent creation/deletion
- Email sends
- Lead imports
- Settings changes
- API calls

#### Memory Monitoring (utils/memoryMonitor.js)

**Alerts when:**
- Heap usage > 80%
- RSS > 1GB on Render free tier

### 9. Environment Variables

**Required:**
```bash
# Database
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
DYNAMODB_USER_SETTINGS_TABLE=UserSettings
DYNAMODB_AGENT_SETTINGS_TABLE=AgentSettings

# Email Providers
MAILGUN_API_KEY=
MAILGUN_DOMAIN=mg.meridianagent.xyz
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://meridian-kdew.onrender.com/api/calendar/google-oauth-callback
GOOGLE_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-push-notifications

# AI Services
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Vector DB
ZILLIZ_CLOUD_URI=
ZILLIZ_CLOUD_TOKEN=

# Search
SERP_API_KEY=

# Auth
JWT_SECRET=
FRONTEND_URL=https://meridianagent.xyz

# Stripe (Billing)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# AWS SES (Optional)
AWS_SES_SENDER=
```

---

## UI/UX Design System

### Theme & Styling

**Color Palette:**
- **Primary Gradient:** `from-cyan-400 via-blue-500 to-indigo-600` (light mode)
- **Dark Overlay:** `from-cyan-500 via-blue-600 to-indigo-700` (loading screens, modals)
- **Accent Colors:** Cyan for highlights, blue for primary actions, indigo for depth

**Design Principles:**
- **Glassy UI:** Backdrop blur effects with white/10 backgrounds
- **Consistent Gradients:** Applied across all pages (dashboard, agents, profile, settings, analytics, signin)
- **Border Styling:** `border-white/20` with hover states at `border-white/40`
- **Button States:** Active scale-95, hover opacity changes, smooth transitions

**Component Standards:**
- **Cards:** `bg-white/10 backdrop-blur-md rounded-2xl border border-white/20`
- **Buttons:** `bg-white/10 hover:bg-white/20 rounded-lg border border-white/20`
- **Modals:** Solid white background (`bg-white`) with neutral borders for forms
- **Badges:** Status indicators with color-coded backgrounds (green for active, red for stopped, cyan for presets)

### Navigation Structure

**Main Routes:**
- `/dashboard` - Main hub with globe visualization, email queue, analytics overview
- `/agents-overview` - Tabbed interface for managing agents and presets
- `/agents?agent={id}` - Individual agent dashboard with full settings
- `/outreach` - Outreach tracking with meeting management
- `/analytics` - Performance metrics and charts
- `/profile` - Company profile and user settings
- `/settings` - Account settings, billing, API keys

**Navigation Flow:**
- All back buttons and `returnTo` parameters redirect to `/dashboard`
- Agent detail pages return to `/agents-overview` when closed
- Consistent back button in top-left with ArrowLeftIcon
- UserMenu in top-right with gradient avatar and settings access
- **Dashboard Navigation:** 5-button layout with Agents/Outreach prominent (larger), Profile/Analytics/Settings secondary (smaller)

### Page-Specific Features

**Dashboard:**
- 3D globe showing sent email locations with "Your Outreach Network" header
- Interactive satellites representing active agents
- Real-time email queue with status badges
- Orphaned emails highlighted with red "ORPHANED" badge
- Quick stats cards (agents, emails sent, meetings scheduled, active campaigns)
- Enhanced navigation with prominent Agents and Outreach buttons

**Outreach Page:**
- **Meeting Tracking:** Log manually scheduled meetings with localStorage persistence
- **Stats Cards:** Emails viewed (coming soon), Responses (coming soon), Meetings booked (active)
- **Meeting Details:** Lead name, email, date/time, associated agent, notes
- **Chronological Sorting:** Meetings displayed in upcoming order
- **CRUD Operations:** Add new meetings, delete existing meetings
- **Agent Association:** Link meetings to specific agents for tracking

**Agents Overview:**
- **Tabs:** Switch between "Agents" and "Presets" sections
- **Agent Cards:** 
  - Personality avatar with name
  - Status badge (running/stopped) with countdown timer
  - Targeting info with preset badge display
  - Stats (queued, sent, meetings)
  - Action buttons (Start/Stop, Instructions, Settings, Delete)
  - Enhanced green Start button (40% opacity, stronger border)
- **Preset Cards:**
  - Preset name and usage count
  - Industries and positions (first 3 + count)
  - Company size range and lead limit
  - Delete button with confirmation

**Settings:**
- Glassy UserMenu dropdown with solid white background
- Settings redirect button
- Clean button styling without extra padding
- Gradient avatar (from-cyan-400 to-blue-600)

---

## Frontend Architecture

### Technology Stack
- **Framework:** Next.js 15.5.7 with App Router
- **Language:** TypeScript 5
- **UI Library:** React 19.1.0
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion
- **Icons:** Heroicons
- **API Client:** Axios with custom interceptors
- **3D Graphics:** Three.js (for globe visualization)

### Key Components

**AgentPersonalitySelector** (`frontend/src/components/agents/`)
- Modal for selecting agent personality types
- Personality options with avatars, descriptions, traits
- Custom name input for personalization

**UserMenu** (`frontend/src/components/UserMenu.tsx`)
- Dropdown menu with user profile, settings, sign out
- Glassy button design with backdrop blur
- Conditional settings redirect (router.push or onSettingsClick prop)

**Dashboard** (`frontend/src/components/Dashboard.tsx`)
- Onboarding flow handler with useEffect cleanup
- 404 error handling for missing company profiles
- Automatic redirect when onboarding complete

**CountdownBadge** (`frontend/src/app/agents-overview/page.tsx`)
- Real-time countdown to next agent cycle
- Color-coded by urgency (blue > 30s, orange ≤ 30s, green when running)
- "Starting..." animation on cycle initiation

### API Integration

**Base Configuration** (`frontend/src/lib/api.ts`)
```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  withCredentials: true
});
```

**Key Endpoints Used:**
- `GET /api/lead-agent` - Fetch all agents
- `POST /api/lead-agent` - Create new agent
- `DELETE /api/lead-agent/:agentId` - Delete agent (triggers orphan reassignment)
- `PUT /api/lead-agent/instructions` - Update agent instructions
- `POST /api/lead-agent/toggle` - Start/stop agent
- `GET /api/settings/presets` - Fetch all presets
- `POST /api/settings/presets` - Create new preset
- `DELETE /api/settings/presets/:id` - Delete preset
- `GET /api/company-profile` - Get company profile (with 404 handling)

### Real-Time Features

**Server-Sent Events (SSE):**
- Endpoint: `GET /api/monitoring/stream`
- Used for live agent activity updates
- Updates current activity messages on agent cards
- Connection maintained throughout session

**State Management:**
- Local useState for component state
- Real-time updates via SSE for agent activity
- Optimistic UI updates (immediate feedback before API confirmation)

---

## CRM Integration System

**Purpose:** Automatically sync researched leads to connected CRM platforms using Merge.dev unified API.

### Features
- **Multi-CRM Support:** Works with 40+ CRMs (Salesforce, HubSpot, Pipedrive, Zoho, etc.)
- **OAuth Connection:** Secure authentication via Merge Link popup
- **Auto-Sync:** Automatically syncs leads after research completes
- **Research Notes:** Attaches research summaries as CRM notes
- **Real-time Status:** Shows connection status, integration name, and sync activity

### How It Works

**1. User connects CRM (Profile page):**
- User clicks "Connect" on desired CRM
- Backend generates Merge Link token (`POST /api/crm/link-token`)
- Popup opens for OAuth authentication
- After auth, public token exchanged for account token (`POST /api/crm/exchange-token`)
- User record updated with CRM connection details

**2. Lead research completes:**
- Agent finishes researching lead and queuing email
- If user has `crmConnected=true` and `crmAutoSync=true`:
  - Lead data prepared with name, email, company, research summary
  - Merge API called to create contact in CRM
  - Research summary attached as CRM note
  - SSE progress events emitted ("Syncing to CRM...", "Synced to Salesforce")

**3. Manual sync (optional):**
- API endpoint available: `POST /api/crm/sync-lead`
- Accepts lead data and syncs to user's connected CRM

### Implementation

**Backend:**
- `utils/mergeManager.js` - Merge.dev API wrapper (axios-based)
  - `createLinkToken()` - Generate OAuth link token
  - `exchangeToken()` - Exchange public token for account token
  - `syncLeadToCRM()` - Sync lead with contact + notes creation
  - `getCRMStatus()` - Get user's CRM connection status
  - `disconnectCRM()` - Remove CRM connection

- `routes/crm.js` - API endpoints
  - `GET /api/crm/status`
  - `POST /api/crm/link-token`
  - `POST /api/crm/exchange-token`
  - `POST /api/crm/sync-lead`
  - `POST /api/crm/disconnect`
  - `POST /api/crm/toggle-auto-sync`

- `agent/reasoningLeadAgent.js` - Auto-sync integration
  - After email queued, checks if CRM connected
  - Calls `mergeManager.syncLeadToCRM()` with lead data
  - Emits SSE progress events for UI feedback

**Frontend:**
- `frontend/src/components/CRMDashboard.tsx` - CRM UI component
  - Shows connected/not connected state
  - Displays CRM options (Salesforce, HubSpot, Pipedrive, Zoho)
  - Connect button opens Merge Link popup
  - Auto-sync toggle switch
  - Disconnect button

- `frontend/src/app/profile/page.tsx` - Profile page
  - Two-column layout: Company profile (left), CRM dashboard (right)
  - Shows CRM integration status and controls

**Database:**
- User table (`meridian-users`) includes CRM fields:
  - `crmConnected` (Boolean) - Connection status
  - `crmAccountToken` (String) - Merge account token
  - `crmIntegration` (String) - Platform name (e.g., "salesforce")
  - `crmConnectedAt` (String) - ISO timestamp
  - `crmAutoSync` (Boolean) - Auto-sync enabled/disabled

**Environment:**
- `MERGE_API_KEY` - Merge.dev API key for authentication

### User Flow

1. Navigate to Profile page
2. Click "Connect" on desired CRM (e.g., Salesforce)
3. Merge Link popup opens for OAuth
4. User authenticates with CRM credentials
5. Popup closes, CRM shows as "Connected"
6. Toggle auto-sync ON (default)
7. Agent researches lead and queues email
8. Lead automatically synced to CRM with research notes
9. SSE updates show "Synced to Salesforce" in real-time

---

## API Endpoints Reference

### Agent Management
- `GET /api/lead-agent` - List all agents
- `POST /api/lead-agent` - Create new agent
- `DELETE /api/lead-agent/:agentId` - Delete agent (auto-reassigns orphaned emails)
- `PUT /api/lead-agent/instructions` - Update agent instructions
- `POST /api/lead-agent/toggle` - Start/stop agent

### Preset Management
- `GET /api/settings/presets` - Get all presets
- `POST /api/settings/presets` - Create new preset
- `PUT /api/settings/presets/:id` - Update preset
- `DELETE /api/settings/presets/:id` - Delete preset

### Email Queue
- `GET /api/email-queue/queued` - Get queued emails
- `GET /api/email-queue/sent` - Get sent emails
- `DELETE /api/email-queue/sent/clear` - Clear sent emails

### CRM Integration (Merge.dev)
- `GET /api/crm/status` - Get user's CRM connection status
- `POST /api/crm/link-token` - Generate Merge Link token for OAuth connection
- `POST /api/crm/exchange-token` - Exchange public token for account token (after OAuth)
- `POST /api/crm/sync-lead` - Manually sync a specific lead to connected CRM
- `POST /api/crm/disconnect` - Disconnect CRM integration
- `POST /api/crm/toggle-auto-sync` - Enable/disable automatic lead syncing

**Supported CRMs:** Salesforce, HubSpot, Pipedrive, Zoho CRM (40+ via Merge.dev unified API)

**Auto-Sync:** When enabled, researched leads are automatically synced to the connected CRM with research notes attached as CRM notes.

## Key Dependencies

### Backend (Node.js)
- **Web Framework:** Express 5.1.0, CORS, Helmet (security)
- **Database:** AWS SDK 3.x (DynamoDB, SES, S3)
- **AI/LLM:** OpenAI 5.12.0, Langchain 0.3.30, Anthropic SDK
- **Email:** Mailgun.js 12.0.3, Nodemailer 7.0.5, SendGrid 8.1.5
- **Google APIs:** googleapis 144.0.0 (Gmail, Calendar)
- **Vector DB:** @zilliz/milvus2-sdk-node 2.6.0
- **Payment:** Stripe 20.0.0
- **Auth:** jsonwebtoken 9.0.2
- **Automation:** node-cron 4.2.1 (scheduled jobs)
- **Web Scraping:** Puppeteer 24.16.0, Cheerio 1.1.2, Axios 1.11.0
- **Logging:** Winston 3.17.0

### Frontend (Next.js + React)
- **Framework:** Next.js 15.5.7, React 19.1.0, TypeScript 5
- **Styling:** Tailwind CSS 4, @tailwindcss/typography
- **UI Components:** Lucide React 0.544.0, Heroicons 2.2.0
- **Animation:** Framer Motion 12.23.22
- **Data Fetching:** @tanstack/react-query 5.90.2, Axios 1.12.2
- **Payment:** @stripe/react-stripe-js 5.4.0, @stripe/stripe-js 8.5.2
- **Charts:** Recharts 3.3.0, D3-geo 3.1.1
- **Markdown:** React-markdown 10.1.0, remark-gfm 4.0.1
- **Real-time:** Socket.io-client 4.8.1

---

## Key Files & Their Purposes

### Backend Routes
- `routes/auth.js` - User auth, agent creation (useGmail storage)
- `routes/calendar.js` - Google OAuth with Gmail scopes
- `routes/gmail-pubsub.js` - Gmail push notification webhook
- `routes/webhooks-reply.js` - Mailgun reply processing
- `routes/webhooks.js` - General webhook handler
- `routes/settings.js` - Agent settings CRUD
- `routes/billing.js` - Stripe subscription management
- `routes/chat.js` - AI chat interface
- `routes/leadAgent.js` - Lead outreach orchestration
- `routes/crm.js` - CRM integration (Merge.dev API wrapper)

### Backend Utils
- `utils/gmailManager.js` - Gmail API wrapper (send, watch, history)
- `utils/awsManager.js` - DynamoDB operations
- `utils/zillizEmailTracker.js` - Vector DB email tracking
- `utils/calendarIntegrationManager.js` - Google Calendar sync
- `utils/mergeManager.js` - Merge.dev CRM integration manager
- `utils/gracePeriodChecker.js` - Subscription grace period logic
- `utils/billingEmails.js` - Payment reminder emails
- `utils/backup.js` - Automated database backups to S3
- `utils/memoryMonitor.js` - Heap usage monitoring and alerts
- `utils/bounceHandler.js` - Email bounce detection and processing

### Backend Tools
- `tools/emailMailgun.js` - Email routing (Gmail vs Mailgun)
- `tools/companyIntelligence.js` - Company research
- `tools/leadResearch.js` - Lead-specific research
- `tools/internetSearch.js` - Google search wrapper
- `tools/webpageFetcher.js` - Webpage content extraction

### Backend Agents
- `agent/reasoningLeadAgent.js` - Main email generation agent
- `src/researchAgent.js` - Research orchestration agent

### Admin & Test Scripts
- `admin-user-tools.js` - User management utilities
- `check-api-usage-count.js` - View API usage statistics
- `check-summary-costs.js` - Calculate billing summaries
- `check-table-schema.js` - Validate DynamoDB schemas
- `checkdb.js` - Database inspection tool
- `test-billing.js` - Test billing system
- `test-manual-agent.js` - Manual agent testing
- `test-payment-history.js` - Payment history verification

### Frontend Components
- `frontend/src/components/agents/AgentOnboarding.tsx` - Agent creation wizard
- `frontend/src/components/agents/AgentSettingsModal.tsx` - Settings editor
- `frontend/src/components/agents/AgentDashboard.tsx` - Agent management
- `frontend/src/components/CRMDashboard.tsx` - CRM integration UI
- `frontend/src/app/dashboard/page.tsx` - Main dashboard
- `frontend/src/app/profile/page.tsx` - Profile page with CRM dashboard

### Frontend API
- `frontend/src/lib/api.js` - API client with auth

---

## Setup Instructions

### 1. Google Cloud Platform Setup

**Enable APIs:**
- Gmail API
- Google Calendar API
- Cloud Pub/Sub API

**Create OAuth Credentials:**
1. Go to GCP Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://meridian-kdew.onrender.com/api/calendar/google-oauth-callback`
4. Copy Client ID and Client Secret to `.env`

**Create Pub/Sub Topic:**
```bash
# Set your GCP project ID
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID

gcloud pubsub topics create gmail-push-notifications

gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://meridian-kdew.onrender.com/api/gmail-pubsub/gmail-notification

# Update your .env with:
# GOOGLE_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-push-notifications
```

**Grant Gmail API Permissions:**
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

### 2. Mailgun Setup (Fallback)

1. Add domain: `mg.meridianagent.xyz`
2. Configure DNS records (MX, TXT, CNAME)
3. Set webhook for replies: `https://meridian-kdew.onrender.com/api/webhooks/replies`
4. Add routing rule: Forward replies@mg.meridianagent.xyz → webhook

### 3. DynamoDB Tables

**meridian-users (User accounts):**
```bash
aws dynamodb create-table \
  --table-name meridian-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

**User Schema:**
- `userId` (String, Primary Key) - Unique user identifier
- `username` (String) - Username for login
- `email` (String) - Email address
- `passwordHash` (String) - Hashed password
- `createdAt` (String) - ISO timestamp
- `lastLogin` (String) - ISO timestamp
- `activeAgents` (Array) - List of active agent configurations
- `trialCreditsUsed` (Number) - Trial credits consumed
- `trialCreditsLimit` (Number) - Trial credit limit (default: 25)
- `paymentMethodAdded` (Boolean) - Has payment method
- `stripeCustomerId` (String) - Stripe customer ID
- **CRM Integration Fields:**
  - `crmConnected` (Boolean) - Whether CRM is connected
  - `crmAccountToken` (String) - Merge.dev account token
  - `crmIntegration` (String) - CRM platform name (salesforce, hubspot, etc.)
  - `crmConnectedAt` (String) - ISO timestamp of connection
  - `crmAutoSync` (Boolean) - Auto-sync leads to CRM (default: true)
- `apiKeys` (Object) - API keys for integrations (openai, serper, apollo, mailgun, sendgrid)

**UserSettings:**
```bash
aws dynamodb create-table \
  --table-name UserSettings \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

**AgentSettings:**
```bash
aws dynamodb create-table \
  --table-name AgentSettings \
  --attribute-definitions AttributeName=agentId,AttributeType=S \
  --key-schema AttributeName=agentId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### 4. Backup Management

```bash
# Create full backup to S3
npm run backup

# Cleanup old backups (keeps last 30 days)
npm run backup:cleanup

# Health check
npm run health  # Checks http://localhost:8080/health
```

### 5. Running Locally

```bash
# Backend
npm install

# Standard start
npm start  # Runs: node app.js (Port 10000)

# Production mode
npm run start:prod  # With NODE_ENV=production

# With memory monitoring
npm run start:monitoring  # Enables GC monitoring

# Frontend
cd frontend
npm install
npm run dev  # Port 3000
```

### 6. Deployment (Render)

**Backend:**
- Build command: `npm install`
- Start command: `node app.js`
- Environment: Node 18+
- Auto-deploy from: `main` branch

**Frontend:**
- Build command: `cd frontend && npm install && npm run build`
- Start command: `cd frontend && npm start`
- Auto-deploy from: `main` branch

---

## Known Issues & TODOs

### Active Bugs

**1. Dual Email Send Bug** ⚠️ CRITICAL
- **Status:** Debug logging added, awaiting test results
- **Symptom:** When `useGmail=true`, sends from BOTH Gmail and Mailgun
- **Location:** tools/emailMailgun.js lines 252-280
- **Debug Logs:**
  - Line 250: "🚀 RETURNING FROM GMAIL - SHOULD NOT CONTINUE TO MAILGUN"
  - Line 275: "⚠️ BUG: gmailConnected=true but still reached Mailgun code!"
- **Hypothesis:** Return statement not exiting function properly
- **Next Steps:** Run email send test, check logs, investigate async flow

### Pending Features

- [ ] Gmail watch auto-renewal (expires after 7 days)
- [ ] Multi-Gmail account support UI
- [ ] Email template library
- [ ] A/B testing for subject lines
- [ ] Bounce detection and auto-removal
- [ ] Spam score checking before send
- [ ] Email warmup scheduler for new Gmail accounts
- [ ] Reply sentiment analysis
- [ ] Lead scoring based on engagement

### Technical Debt

- [ ] Migrate all Mailgun webhooks to Gmail Pub/Sub
- [ ] Consolidate token storage formats (gmailAuth vs calendarTokens vs gmailAccounts)
- [ ] Add retry logic for failed Gmail API calls
- [ ] Implement rate limiting per agent (Gmail has 500/day send limit)
- [ ] Add email preview before send
- [ ] Improve error handling in email routing
- [ ] Add tests for email generation prompt

---

## Testing Checklist

### Gmail Integration
- [ ] OAuth flow grants all 5 scopes
- [ ] Tokens stored correctly in DynamoDB
- [ ] Gmail watch setup successful
- [ ] Pub/Sub receives notifications
- [ ] History API returns new messages
- [ ] In-Reply-To header extracted correctly
- [ ] Reply tracking matches tracking IDs

### Email Sending
- [ ] Gmail send works with useGmail=true
- [ ] Email appears in user's Sent folder
- [ ] Message-ID header includes tracking ID
- [ ] Mailgun send works as fallback
- [ ] Only ONE email sent (no duplicates)
- [ ] Tracking data stored correctly
- [ ] sentFrom field matches provider

### Email Generation
- [ ] 7-sentence target length maintained
- [ ] Content flows naturally (not rigid)
- [ ] Specific research data included
- [ ] No banned phrases present
- [ ] Personality voice evident
- [ ] CTA matches persona
- [ ] Value proposition clear

### Reply Processing
- [ ] Replies classified correctly (POSITIVE, NEGATIVE, etc.)
- [ ] Reply count incremented
- [ ] Max 3 AI responses enforced
- [ ] Unsubscribe requests honored
- [ ] Out-of-office detected
- [ ] Conversation history updated

---

## API Endpoints Reference

### Auth & Users
- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - User login (returns JWT)
- `POST /api/auth/create-agent` - Create new lead agent
- `GET /api/auth/agents` - List user's agents
- `DELETE /api/auth/agents/:agentId` - Delete agent

### Google Integration
- `GET /api/calendar/google-oauth-url` - Generate OAuth URL
- `GET /api/calendar/google-oauth-callback` - Handle OAuth callback
- `POST /api/calendar/disconnect` - Disconnect Google account
- `POST /api/gmail-pubsub/gmail-notification` - Gmail push webhook

### Email & Webhooks
- `POST /api/webhooks/replies` - Mailgun reply webhook
- `POST /api/webhooks/desktop-email-sent` - Desktop email tracking
- `POST /api/leadAgent/send-email` - Send email to lead
- `GET /api/tracking/pixel/:trackingId.png` - Email open tracking
- `GET /api/tracking/click/:trackingId` - Link click tracking

### Settings
- `GET /api/settings/agent-settings/:agentId` - Get agent settings
- `POST /api/settings/save-agent-settings` - Update agent settings
- `GET /api/settings/user-settings` - Get user settings
- `POST /api/settings/update-user-settings` - Update user settings

### Analytics
- `GET /api/analytics/email-performance` - Email metrics
- `GET /api/analytics/agent-performance/:agentId` - Agent metrics
- `GET /api/monitoring/api-costs` - API usage and costs

---

## Development Workflow

### Making Changes

1. **Backend Changes:**
   - Edit files in `routes/`, `utils/`, `tools/`, `agent/`
   - Test locally: `node app.js`
   - Commit and push to trigger Render auto-deploy

2. **Frontend Changes:**
   - Edit files in `frontend/src/`
   - Test locally: `cd frontend && npm run dev`
   - Build: `npm run build`
   - Commit and push to trigger Render auto-deploy

3. **Database Schema Changes:**
   - Update DynamoDB table definitions
   - Update corresponding TypeScript interfaces
   - Update awsManager.js methods
   - Test with real data

4. **Email Prompt Changes:**
   - Edit `agent/reasoningLeadAgent.js` lines 3139-3318
   - Test with various lead profiles
   - Check output for banned phrases
   - Verify personality voice matches

### Debugging

**Backend Logs:**
```bash
# Render dashboard → Logs tab
# Or locally:
node app.js | grep "ERROR\|🚀\|⚠️"
```

**Gmail Issues:**
```bash
# Check token validity
node checkdb.js  # View userSettings.calendarTokens

# Check watch status
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  https://gmail.googleapis.com/gmail/v1/users/me/settings/forwardingAddresses
```

**DynamoDB Queries:**
```bash
# Check agent settings
node -e "
const { getLeadAgentSettings } = require('./utils/awsManager.js');
getLeadAgentSettings('AGENT_ID').then(console.log);
"

# Check user settings
node -e "
const { getUserSettings } = require('./utils/awsManager.js');
getUserSettings('USER_ID').then(console.log);
"
```

---

## Important Notes for Context Resets

1. **Gmail Integration is COMPLETE** - OAuth, Pub/Sub, watch management all working
2. **Orphan Email System is ACTIVE** - Automatic reassignment on agent deletion
3. **Preset Management is LIVE** - Create/view/delete presets in agents overview
4. **UI Theme Updated** - Cyan-blue-indigo gradient across all pages
5. **Navigation Centralized** - All paths redirect to /dashboard as main hub
6. **Agent setting `emailBuilder.useGmail`** controls routing - stored in DynamoDB
7. **Dual-send bug** is ACTIVE - emails send from both providers when toggle is ON
8. **Email prompt** was UPDATED (Dec 28, 2025) - removed rigid structure, now flows naturally
9. **Token formats** - System supports 3 formats: gmailAuth, gmailAccounts, calendarTokens
10. **Reply tracking** - Gmail uses In-Reply-To header, Mailgun uses Message-ID parsing
11. **Max 3 AI replies** per conversation - enforced via DynamoDB counter
12. **GCP Pub/Sub topic** needs manual setup - not automated yet
13. **Frontend toggles** exist in both AgentOnboarding AND AgentSettingsModal
14. **Mailgun is fallback** - primary method is now Gmail for better deliverability
15. **Tabbed Interface** - Agents overview now has separate tabs for Agents and Presets
16. **Enhanced Buttons** - Start button more visible (green-500/40 with stronger border)

**When resuming work:**
- First check: Dual-send bug logs (tools/emailMailgun.js)
- Test: Create agent with Gmail toggle, send email, verify only one sends
- Monitor: Gmail watch expiration (7 days) - add auto-renewal
- Improve: Email generation quality based on user feedback
- Verify: Orphan email reassignment works on agent deletion
- Check: Preset management UI in agents-overview page

**Recent Updates (Dec 29, 2025):**
- ✅ Orphan email system with automatic reassignment
- ✅ Preset management with full CRUD operations
- ✅ UI redesign with cyan-blue-indigo gradient theme
- ✅ UserMenu glassy theme with gradient avatar
- ✅ Navigation standardization to /dashboard
- ✅ Tabbed interface for agents and presets
- ✅ Enhanced Start button visibility

**Recent Updates (Dec 30, 2025):**
- ✅ **Instant Loading States** - Agent card clicks now trigger loading indicators immediately (no delay)
- ✅ **Dark Theme Text Fix** - All input fields in AgentSettingsModal now have white text on dark backgrounds
  - Fixed: Agent name, company name, agent title, website URL
  - Fixed: Primary service, core offering, key advantages, expertise area, company description
  - Fixed: Company size range inputs (min/max)
  - Fixed: Lead limit input
  - Fixed: Industry and job title search fields
  - Fixed: All dark blue text (text-blue-600/800) converted to light blue (text-blue-300)
  - Fixed: Hover states for dropdowns (hover:bg-blue-50 → hover:bg-[#1B2F52])
- ✅ **Email Success Rate Dashboard** - New visualization for sent email analytics
  - Large percentage display showing overall delivery success rate
  - Three-category breakdown: Delivered (green), Bounced (red), Pending (yellow)
  - Visual progress bars showing distribution of email statuses
  - Automatic calculation: `(delivered / total) * 100%`
  - Only displays for 'sent' emails queue
- ✅ **Delivery Status Badges** - Each sent email now shows real-time delivery status
  - ✓ Delivered (green badge) - Email successfully landed in inbox
  - ✗ Bounced (red badge) - Email failed to deliver
  - ⏳ Pending (yellow badge) - Email sent but status unknown
  - Status pulled from `email.deliveryStatus` field
- ✅ **Settings Modal Optimistic UI** - Settings now save with instant feedback
  - Modal closes immediately when clicking save (optimistic)
  - Loading spinner shows during brief save operation
  - Saves happen in background after modal closes
- ✅ **Help Chat AI Assistant** - Intelligent assistant to help users navigate the platform
  - Button in top-right corner next to user profile dropdown
  - Chat modal with conversation history
  - AI powered by GPT-4o with comprehensive platform knowledge
  - Context-aware responses using Langchain ConversationChain
  - Message editing with context regeneration (removes subsequent messages)
  - Knows about agents, email system, settings, workflows, troubleshooting
  - Provides step-by-step instructions and best practices
  - Backend endpoint: `/api/help/chat`
  - Frontend component: `HelpChat.tsx`

**Implementation Details:**
- **Loading State:** `setLoadingQueue(true)` called synchronously in `handleAgentSelect` before async operations
- **Text Visibility:** All inputs use `bg-[#0F1E35] text-white` for consistent dark theme
- **Success Rate Location:** Dashboard → Sent Emails → Top of modal (above pagination)
- **Status Badge Location:** Email list → Next to subject line (before email title)
- **Backend Field Required:** `email.deliveryStatus` must be set to 'delivered', 'bounced', or 'pending'
- **Help Chat Architecture:**
  - Frontend sends full message history + new message to backend
  - Backend uses Langchain BufferMemory to maintain conversation context
  - System prompt contains comprehensive knowledge base about platform features
  - AI model: GPT-4o with temperature 0.7 for balanced creativity/accuracy
  - Edit functionality: Clicking edit on a user message removes all subsequent messages and regenerates from that point

---

## Recent Critical Bug Fixes (January 2, 2026)

### Issue #1: Special Instructions Not Being Applied from Presets
**Problem:** Agents created through the regular "Create Agent" flow (AgentManager, AgentDirectorDashboard) were not using special instructions from presets, causing them to skip research/pre-qualify/qualify workflow entirely.

**Root Cause:** 
- Frontend was sending `specialInstructions` nested inside `preset` object only
- Backend at `routes/auth.js` line 930 reads from top-level `specialInstructions` field
- Backend fallback check `if (!specialInstructions && preset.specialInstructions)` failed because empty string `''` is truthy in JavaScript
- Result: `specialInstructions` set to empty string, campaign plan generation returned null, agent skipped straight to email phase

**Fix Applied:**
1. **Frontend Changes:**
   - [AgentManager.tsx](frontend/src/components/agents/AgentManager.tsx) line 415 - Added `specialInstructions: preset?.specialInstructions || ''` at top level of request
   - [AgentDirectorDashboard.tsx](frontend/src/components/agents/AgentDirectorDashboard.tsx) line 1910 - Same fix applied
2. **Backend Changes:**
   - [auth.js](routes/auth.js) line 1010 - Changed condition to `if ((!specialInstructions || specialInstructions.trim() === '') && preset.specialInstructions)` to properly handle empty strings
3. **Agent Logging:**
   - [reasoningLeadAgent.js](agent/reasoningLeadAgent.js) line 5872 - Enhanced logging to show when special instructions are missing and warn about skipped workflow phases

**Impact:** Agents now properly execute full research → pre-qualify → qualify → email workflow when created with presets.

---

### Issue #2: All Presets Showing as Selected in UI
**Problem:** When opening preset selection modal, all presets briefly showed green selection styling and checkmarks, making it impossible to know which preset was actually selected.

**Root Cause:** 
- Condition `(selectedPreset?._id || selectedPreset?.id) === (preset._id || preset.id)` evaluated to `true` when both sides were `undefined`
- `undefined === undefined` returns true in JavaScript
- Initial state `selectedPreset = null` didn't prevent this because the OR operators returned undefined before comparison

**Fix Applied:**
- [AgentPersonalitySelector.tsx](frontend/src/components/agents/AgentPersonalitySelector.tsx) lines 505-510
- Changed to: `selectedPreset && (selectedPreset._id || selectedPreset.id) === (preset._id || preset.id)`
- Ensures `selectedPreset` exists before checking ID equality

**Impact:** Preset selection UI now correctly shows only the actively selected preset.

---

### Issue #3: Gmail Default Preference Not Being Respected
**Problem:** Users set "Prioritize Gmail" to true in settings, but new agents were still being created with Mailgun as default email sender.

**Investigation:** 
- Backend logic at `routes/auth.js` line 1005 already correctly checks: `useGmail: useGmail !== undefined ? useGmail : (user.settings?.preferences?.defaultUseGmail || agentSettings.emailBuilder?.useGmail || false)`
- Frontend was NOT sending `useGmail` field at all in agent creation requests
- This means backend should fall back to `defaultUseGmail` preference

**Fix Applied:**
- Added detailed debug logging at [auth.js](routes/auth.js) after line 1005:
```javascript
console.log(`[AUTH] 🔍 Gmail Setting Debug:`, {
  useGmailFromRequest: useGmail,
  defaultUseGmailFromUserSettings: user.settings?.preferences?.defaultUseGmail,
  finalUseGmail: agentSettings.emailBuilder.useGmail,
  userHasGmailAuth: !!user.gmailAuth,
  userHasGmailAccounts: user.gmailAccounts?.length || 0,
  userHasCalendarTokens: !!user.calendarTokens
});
```

**Impact:** Can now diagnose why Gmail preference isn't being applied by checking server logs during agent creation.

---

### Issue #4: Research Workflow Not Executing Even With Instructions
**Problem:** Agents were skipping research/pre-qualify/qualify phases and going straight to email, even when special instructions were provided.

**Root Cause:**
- `convertInstructionsToPlan()` in [reasoningLeadAgent.js](agent/reasoningLeadAgent.js) returns `null` when no special instructions provided
- Null campaign plan causes agent to skip qualification phases (see line 1237)
- With Issue #1 fix, special instructions should now flow through properly

**Fix Applied:**
- Enhanced logging at line 297-299 to warn when campaign plan is null:
```javascript
console.log('⚠️ [CAMPAIGN PLAN] WARNING: Without special instructions, agent will skip research/pre-qualify/qualify phases!');
console.log('📋 [CAMPAIGN PLAN] Special instructions received:', specialInstructions.substring(0, 100) + '...');
```
- Added detailed settings logging at line 5872-5876 to show exactly what instructions are loaded at agent startup

**Impact:** Clear visibility into why workflow phases are being skipped, combined with Issue #1 fix ensures workflow executes properly.

---

### Issue #5: Orphaned Emails Not Showing Up After Agent Deletion
**Problem:** When agents were deleted, their emails should appear in "Orphaned Emails" section at top of email queue, but they weren't showing up reliably.

**Root Cause:**
- Frontend calls `/api/email-queue/queue?agentId=orphan` to fetch orphaned emails
- Backend at [emailQueue.js](routes/emailQueue.js) line 48 treated "orphan" as a literal agentId
- Backend tried to query DynamoDB for emails where `agentId = "orphan"`, but deleted agents' emails still have their REAL agent IDs
- No special logic existed to identify which emails belong to deleted agents

**Fix Applied:**
- [emailQueue.js](routes/emailQueue.js) lines 64-83 - Added special case handling:
```javascript
if (agentId === 'orphan') {
  // Get all active agent IDs for user
  const allAgents = await awsManager.getUserAgents(req.user.userId);
  const activeAgentIds = allAgents.map(a => a.agentId);
  
  // Get all emails and filter for orphaned ones
  const allEmails = await awsQueue.getAllQueuedEmailsForUser(req.user.userId);
  const orphanedEmails = allEmails.filter(email => !activeAgentIds.includes(email.agentId));
  
  return res.json(orphanedEmails);
}
```

**Logic:**
1. Fetch list of all active agents for user
2. Get all emails for user across all agents
3. Filter emails where `email.agentId` is NOT in active agent list
4. These are orphaned emails from deleted agents

**Impact:** Orphaned emails now reliably appear in queue after agent deletion, preventing lost leads and allowing users to reassign or delete them.

---

## Contact & Links

- **Backend:** https://meridian-kdew.onrender.com
- **Frontend:** https://meridianagent.xyz
- **Repo:** (Add GitHub link if applicable)
- **Docs:** This README
- **Billing:** BILLING_SYSTEM.md

---

**Last Modified:** January 2, 2026  
**Version:** 2.4.0 (Critical Bug Fixes - Agent Presets, Gmail Preferences, Orphaned Emails)  
**Next Major Features:** Gmail watch auto-renewal, delivery status tracking improvements

