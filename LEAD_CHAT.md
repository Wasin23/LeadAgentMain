# Meridian Lead Chat — Architecture & Vision

## What It Is

A branded, AI-powered chat interface embedded inside Meridian's outbound pipeline. Every cold email sent through Meridian includes a personalized link. When a lead clicks it, they land on a live chat page that already knows who they are, what their company does, what pain points the outreach targeted, and everything the sending company has ever published about themselves. The AI picks up the conversation where the email left off — intelligently, immediately, at any hour.

This turns Meridian from an email tool into a full top-of-funnel system. The email is the door. The chat is the room.

---

## User Flow

1. Meridian generates and sends a cold outreach email to a lead
2. After the value proposition, the email includes a link — e.g. *"See exactly how we'd approach your situation →"*
3. The link resolves to `/chat/{token}` on Meridian's domain
4. The token is short-lived and encodes `userId`, `agentId`, and `leadId`
5. On load, the server resolves the token and initializes a personalized chat session
6. The lead starts chatting — the AI already knows everything relevant
7. If intent crosses a threshold, the Meridian user is notified in real time
8. The Meridian user can observe the conversation live and take over at any point

---

## Lead Identity & Token System

- The tracking ID already embeds `userId` and `agentId` — `leadId` is added the same way
- On email send, a short-lived signed token is generated: `{userId, agentId, leadId, emailId, exp}`
- Token maps to a session row in DynamoDB: resolved once on first load, then the session is live
- URL format: `/chat/{agentSlug}/{token}` — e.g. `/chat/hunter/abc123xyz`
  - `agentSlug` is the agent's name, lowercased and hyphenated — visible in the URL so the lead sees a branded name, not a random hash
  - `token` resolves server-side to `{userId, agentId, leadId, emailId}` and redirects into the live session
  - Two-step: email link → `/chat/{agentSlug}/{token}` → session initialized → chat UI loads
- If the same lead clicks again from a future email, the token resolves to the same lead context and conversation history is retrieved from the vector DB

---

## What the AI Is Fed at Session Start

Every chat session is initialized with a rich context bundle:

### Lead Context
- Full lead research profile (company, role, seniority, industry, recent news, signals)
- The AI-generated research report Meridian already produced for this lead
- The original outreach email that generated the click — so the AI never repeats what was already said
- Any prior conversation history retrieved from the vector DB

### Company Context (RAG)
- The Meridian user's uploaded company documents: case studies, pricing, product docs, FAQs, testimonials, battle cards, whitepapers — anything they provide
- Chunked, embedded, and stored per `userId` in the vector DB
- At query time, the top-k most relevant chunks are retrieved based on what the lead is asking and injected into the prompt

### Agent Personality
- The same agent personality configured for outreach carries through to chat
- Tone, style, name, avatar — everything consistent
- The lead experiences the same "voice" from first email to live conversation

---

## RAG — Company Knowledge Base

This is not a simple document search. The RAG layer is designed to give the AI genuine reasoning ability about the company — not just retrieval of facts, but the capacity to synthesize, compare, and apply company knowledge to the specific situation of a specific lead.

### What Gets Ingested
- Product and service documentation
- Case studies and client success stories
- Pricing structures and packaging tiers
- Competitive battle cards — how the company beats specific competitors
- FAQs and common objection responses
- Whitepapers, thought leadership, research reports
- Team bios and credentials
- Process documentation — how engagements work, what onboarding looks like
- Any free-form context the user wants to provide

### How Ingestion Works
- User uploads files (PDF, DOCX, TXT, MD) or pastes raw text directly in Meridian
- Documents are chunked with overlap to preserve context across boundaries
- Each chunk is embedded and stored in the vector DB under `{userId}`
- Metadata is stored alongside each chunk: source document, section, date added, type tag
- User can label chunks by type (e.g. "objection handler", "case study", "pricing") to improve retrieval precision

### How Retrieval Works at Inference Time
- The lead's question is embedded and used to query the vector DB
- Top-k chunks are retrieved by semantic similarity
- Chunk type metadata is used to weight retrieval — e.g. if the lead mentions a competitor, battle cards are prioritized
- Retrieved chunks are injected into the system prompt alongside lead context
- The AI reasons across all of it — it does not just quote chunks, it synthesizes an answer specific to this lead's situation

### What the AI Can Do With It
- Answer specific technical questions with accurate company-sourced detail
- Reference a relevant case study unprompted when it matches the lead's industry or problem
- Handle pricing questions with nuance — not just stating numbers but explaining value
- Counter objections using pre-loaded responses, adapted to the conversation tone
- Explain process and what working together would actually look like
- Identify which part of the company's offer is most relevant to this specific lead and lead with that

---

## Vector DB Usage

The vector DB serves two purposes:

### 1. Company Knowledge (RAG)
- User uploads documents via Meridian UI
- Documents are chunked and embedded on upload
- Indexed by `userId` so each company's knowledge is isolated
- Queried semantically at inference time — the AI pulls only what's relevant to the current question

### 2. Conversation Memory
- Every message in every chat session is embedded and stored in the vector DB keyed by `{userId, leadId}`
- On session start, relevant prior exchanges are retrieved and injected as memory context
- The AI remembers across sessions — if the lead comes back a week later, it picks up naturally
- Enables long-horizon relationship context without bloating the prompt with raw history

---

## AI Capabilities Inside the Chat

The chat AI is not a passive Q&A bot. It is an active sales agent:

- **Answers product/service questions** with depth, backed by the company's actual documents
- **References the lead's specific situation** — pulled from their research profile
- **Handles objections** using battle cards and case studies from the RAG corpus
- **Offers to connect on LinkedIn** — generates a personalized connection message the lead can copy or approve
- **Books meetings** — integrates with the Meridian user's calendar, proposes real available times, sends invite
- **Sends follow-up emails** — can dispatch a follow-up directly from the conversation if the lead agrees
- **Escalates to a human** — if the lead requests it, or if AI detects high intent, notifies the Meridian user immediately
- **Suggests next steps** proactively — does not wait to be asked

---

## Engagement Tracking

Every interaction a lead has with the chat is tracked and stored:

- **Link clicked** — timestamp, which email triggered it, device/browser
- **Session opened** — how long before they engaged after clicking
- **Messages sent** — count, timestamps, average response time from the lead
- **Topics discussed** — AI-tagged by subject (pricing, competitors, process, objections, etc.)
- **Intent signals** — questions that indicate buying readiness (timeline, budget, team size, next steps)
- **Session ended** — how, when, and what the last message was
- **Return visits** — whether the lead came back and when

All of this is stored per lead in DynamoDB and surfaced in the Meridian dashboard so the user can see exactly where each lead is in the funnel and what they cared about.

---

## Conversation Display in Meridian

Every chat conversation is saved and viewable inside Meridian, linked to the lead's profile:

- Full message-by-message transcript
- AI messages and lead messages visually distinguished
- Any human takeover portion is labeled separately
- Intent score shown per message — the AI's assessment of lead readiness at each point
- Topics and signals tagged inline
- One-click to resume the conversation or send a follow-up email off the back of it
- Conversations searchable across all leads

This means the Meridian user has a complete picture of every lead interaction — not just "they replied to the email" but what they actually asked, what concerned them, and how close they are.

---

## Real-Time Notifications & Human Takeover

### Notification Triggers
- Lead opens the chat page (presence signal)
- Lead sends first message
- Sentiment or intent crosses a configurable threshold (e.g. asking about pricing, timelines, team size)
- Lead explicitly asks to speak to a human

### Notification Channels
- In-app notification in Meridian dashboard with live conversation preview
- Email alert to the Meridian user
- (Future) Slack / webhook

### Takeover
- Meridian user sees a live indicator: "Lead is in chat right now"
- Full conversation visible in real time before they join
- One-click join — they enter the conversation as themselves
- AI hands off gracefully: *"Actually, let me connect you with [Name] directly"*

---

## AI Test Screen — Fine-Tuning Inside Meridian

Before any chat goes live, and at any point after, the Meridian user can test and tune the AI from inside the app.

### What It Is
A split-screen interface inside Meridian where the user can simulate a conversation with their own chat AI — seeing exactly what a lead would see, with the full context bundle active.

### What the User Can Do

**Test mode:**
- Select any lead from their list and simulate a conversation as that lead
- The AI initializes with that lead's full context exactly as it would for a real session
- User types as the lead, sees the AI respond in real time
- No data is saved to the lead's actual conversation history during testing

**Tune the system prompt:**
- Live editable system prompt panel alongside the chat
- Changes take effect immediately in the test conversation
- User can iterate — try a message, adjust the prompt, try it again
- Save a new version when satisfied — versioned so they can roll back

**Insert and manage knowledge:**
- Upload new documents or paste raw text directly in the test screen
- See what chunks get retrieved for a given question — the retrieval is transparent, showing which documents were pulled and why
- Delete, re-label, or re-chunk specific documents without leaving the screen
- Test how a new document changes AI answers before committing it

**Tune retrieval:**
- Adjust how many chunks are retrieved (top-k)
- Weight certain document types higher for certain query types
- See the raw retrieved context the AI was given for any response

**Persona testing:**
- Switch between different agent personalities in the test screen
- See how tone and style shift across the same question
- Lock in the personality that performs best

### Why This Matters

This is effectively fine-tuning without fine-tuning. The user shapes the AI's behavior by controlling three levers — the system prompt, the knowledge base, and the retrieval logic — and they can see the results instantly. No engineering required. No waiting. The test screen is the lab and the product ships the same day.

---

## Data Architecture

```
VectorDB (Zilliz)
├── company_memory                  ← RAG knowledge base collection
│   └── fields: id, user_id, doc_id, chunk_index, type, source, text, embedding (1536-dim COSINE)
└── lead_agent_memory               ← existing lead research memory collection

DynamoDB
├── chat_sessions/
│   └── {token} → { userId, agentId, leadId, emailId, createdAt, exp, status }
├── chat_conversations/
│   └── {userId}/{leadId} → { messages[], intentScore, topics[], lastActive }
└── chat_engagement/
    └── {userId}/{leadId} → { clickedAt, sessionsCount, messagesCount, returnVisits, signals[] }
```

---

## Chat Page (Frontend)

- Hosted at `/chat/{agentSlug}/{token}` on Meridian's domain
- Fully branded to the sending company (name, colors, logo if provided)
- Mobile-responsive
- No login required for the lead
- Typing indicators, streaming responses
- "Talk to a real person" button always visible
- If session expires or token is invalid — graceful fallback with contact info

---

## Onboarding & UI Integration

The chat system is not a feature buried in settings. It is the product. Every surface in Meridian reinforces this.

### Onboarding

When a user creates their first agent, immediately after naming it they see a screen explaining what the agent actually is: not just an email sender, but a thing that exists — with a name, a personality, a live chat link, and a brain. The screen shows the agent's real URL (`/chat/hunter/...`) and prompts them to upload their company documents to power it. Doc upload happens here, in onboarding, not later in a settings menu. If they skip it, the chat link falls back to normal email until docs are added — but the gap is visible and the CTA to fix it follows them.

### Agent Cards

Each agent card in the Meridian UI has a dedicated **Chat Link** section showing:
- The live URL with a copy button
- A **Preview** button that opens a test session as a simulated lead
- Document count and status — how many docs are ingested and ready
- If no docs are uploaded: an amber warning — *"Add your company knowledge to activate this agent's chat"* — with a direct upload button inline

The chat link is not in a submenu. It is on the card.

### Email Queue & Outreach

Every outreach email shows a chat link status indicator:
- **Green** — docs uploaded, link is live and will be inserted automatically after the value proposition
- **Amber** — no docs yet, link will not be included, with a prompt to upload
- The link is visible and editable in the email preview before send

The user never has to think about inserting the link manually. It goes in. If they want to remove it they can. But the default is always on.

### Dashboard

A dedicated stats block for chat performance sits on the main dashboard alongside sent / opened / replied:
- Links clicked
- Sessions started
- Messages exchanged
- Hot leads — leads whose intent score crossed the threshold
- Active right now — leads currently in a live session

This makes the feature feel alive. If nobody is clicking, the user sees that and knows to fix the email copy or the link framing. If someone is live in chat, they see it immediately.

### Knowledge Base Tab

Each agent has a **Knowledge** tab — not a global settings page, per-agent, because agents can have different knowledge bases. From here the user can:
- Upload documents (PDF, DOCX, TXT, MD) or paste raw text
- See every ingested document with its type label, chunk count, and date added
- Delete or re-label documents
- Jump directly into the test screen to see how a new doc changes AI answers

### Test Screen

One click from the agent card — *"Test your chat AI"* — opens the split-screen lab. The user can simulate a full conversation as any lead, edit the system prompt live, see which chunks were retrieved for any response, and tune everything before a single real lead sees it. It closes the feedback loop instantly.

### The Mental Model

Every touchpoint reinforces one idea: the agent is not a thing that sends emails. It is a thing that exists — it has a name, a personality, a URL, and a brain. The email is just how it introduces itself to the world.

---

## Why This Wins

Most cold email tools stop at the send. Meridian closes the loop. The AI that researched the lead, wrote the email, and sent it is the same AI that answers their questions, handles their objections, books the meeting, and hands them off when they're ready — all without the Meridian user doing anything until the moment it matters.

And unlike a black box AI, the Meridian user can see every conversation, tune every response, and understand exactly why the AI said what it said.

That's not an email tool. That's a pipeline.
