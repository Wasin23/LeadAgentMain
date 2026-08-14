import express from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { authenticateToken } from '../middleware/jwt.js';
import AWSEmailQueue from '../utils/awsEmailQueue.js';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
const emailQueue = new AWSEmailQueue();
const awsManager = new AWSManager();

// System knowledge base about Meridian platform
const SYSTEM_KNOWLEDGE = `You are Meridian's AI assistant, an expert on the platform's features and functionality.

# PLATFORM OVERVIEW
Meridian is an AI-powered lead research and email automation platform. Users create AI agents that automatically find leads, research companies, and send personalized emails.

# KEY FEATURES

## 1. AGENTS
- **Reasoning Lead Agents**: AI agents that autonomously find and qualify leads
- **Agent Settings**: Each agent has configurable settings including:
  * Company Branding (company name, primary service, agent name)
  * Target Criteria (industries, positions, company size, locations)
  * Research Focus (areas of focus, research depth)
  * Email Builder (length, tone, personalization level, CTA)
- **Agent Personalities**: Agents can have different personas (Hunter, Consultant, Networker, Data-Driven)
- **Agent Presets**: Save agent configurations as templates to quickly create new agents

## 2. LEAD GENERATION
- **Apollo Integration**: Search for leads based on industry, position, company size
- **Smart Qualification**: AI pre-qualifies leads before expensive research
- **Research**: Uses Serper to research companies and gather intelligence
- **Email Unlock**: Uses Apollo credits to find email addresses

## 3. EMAIL SYSTEM
- **Two Email Providers**:
  * Gmail (primary): Send from user's own Gmail account via OAuth
  * Mailgun (fallback): Send from replies@mg.meridianagent.xyz
- **Personalization**: AI writes customized emails based on research
- **Email Queue**: Review and approve emails before sending
- **Auto-Response**: AI can automatically respond to replies (max 3 per thread)
- **Delivery Tracking**: Track delivered/bounced/pending status
- **Reply Tracking**: Classify replies as positive/negative/question/out-of-office/unsubscribe

## 4. DASHBOARD
- **Interactive Globe**: Visual representation of lead locations
- **Email Queue Panel**: Left side panel showing pending emails to review
- **Agent Cards**: Click to view agent details and run queue
- **Stats**: Email sent count, active agents count
- **Success Rate**: Shows percentage of delivered vs bounced emails

## 5. SETTINGS
- **Gmail Connection**: Connect Gmail account for sending emails
  * OAuth flow opens popup window
  * Supports multiple Gmail accounts
  * Auto-detects connection status
- **Agent Configuration**: Configure targeting, research, and email settings
- **Presets**: Save and reuse agent configurations
- **Payment Status**: Billing info and subscription management

## 6. OUTREACH TRACKING
- **Sent Emails**: View all sent emails with delivery status badges
- **Replies**: See replies with AI-generated classifications
- **Performance**: Success rate graph showing delivery statistics
- **Filters**: Filter by agent, status, date range

# COMMON WORKFLOWS

## Creating a New Agent:
1. Click "Create New Agent" button
2. Fill in agent name and persona
3. Configure company branding (your company name, service)
4. Set target criteria (industries, positions, company size)
5. Configure email settings (length, tone, CTA)
6. Choose Gmail or Mailgun for sending
7. Save agent settings

## Running an Agent:
1. Click on agent card in dashboard
2. Review agent settings and target leads count
3. Click "Run Queue" or "Start Agent"
4. Agent will automatically:
   - Search for leads matching criteria
   - Research each company
   - Write personalized emails
   - Add emails to queue for approval

## Approving Emails:
1. Click "Email Queue" panel on left side
2. Review each email and research
3. Click "Approve" to queue for sending
4. Click "Reject" to skip the lead
5. Approved emails send automatically

## Connecting Gmail:
1. Go to Settings (gear icon in dashboard)
2. Click "Connect Gmail Account"
3. OAuth popup opens
4. Sign in with Google
5. Grant permissions
6. Connection confirmed automatically

## Viewing Performance:
1. Navigate to "Outreach" page
2. See email success rate graph
3. View sent emails with delivery status
4. Read replies with AI classifications
5. Filter by agent or status

# TECHNICAL DETAILS

## Agent Settings Structure:
- companyBranding: Company name, agent name, primary service
- targetCriteria: Industries (array), positions (array), company size (min/max)
- geographicSettings: Target locations, lead limit
- researchFocus: Focus areas, research depth (basic/standard/deep)
- emailBuilder: Length (short/medium/long), tone, personalization (low/medium/high), CTA (meeting/reply/call/demo/website)

## Email Builder Options:
- Length: short (3-4 sentences), medium (5-7 sentences), long (8-10 sentences)
- CTA: meeting, reply, call, demo, website
- Personalization: low (generic), medium (company-specific), high (role-specific + research)
- CC/BCC: Optional email addresses to copy
- Auto-response: Enable/disable AI replies to incoming emails
- Follow-up: Set rebump interval in days

## Research Depth:
- basic: Quick validation, minimal research
- standard: Company overview, basic intelligence
- deep: Full research, competitive analysis, detailed insights

# TROUBLESHOOTING

## Agent Not Finding Leads:
- Check target criteria is not too narrow
- Verify industries and positions are correctly configured
- Ensure company size range is reasonable
- Check lead limit is sufficient

## Gmail Not Connecting:
- Ensure popup blocker is disabled
- Try refreshing the page and reconnecting
- Check you granted all required permissions
- Verify Gmail account is not restricted

## Emails Not Sending:
- Check payment status (subscription active)
- Verify a Gmail/Outlook account is connected and active in Outreach, or Mailgun is configured
- Ensure email queue has approved emails
- Check for bounced/failed emails in outreach page

## Low Success Rate:
- Review email content for personalization quality
- Check sender reputation (Gmail vs Mailgun)
- Verify email addresses are valid (check Apollo credits)
- Consider adjusting email tone/length

When answering questions:
1. Be specific and reference exact UI elements
2. Provide step-by-step instructions when needed
3. Explain the "why" behind features
4. Suggest best practices when relevant
5. If unsure, acknowledge limitations but provide related helpful info`;

// Helper function to fetch user data for context
async function fetchUserContext(userId) {
  try {
    const context = {
      agents: [],
      queuedEmails: [],
      sentEmails: [],
      userSettings: null
    };

    // Fetch user's agents
    try {
      const userData = await awsManager.getUserById(userId);
      if (userData) {
        context.agents = userData.activeAgents || [];
        context.userSettings = {
          email: userData.email,
          name: userData.name,
          billingEnabled: userData.billingEnabled,
          gmailConnected: !!userData.gmail?.accessToken
        };
      }
    } catch (err) {
      console.log('[HELP] Could not fetch user data:', err.message);
    }

    // Fetch queued emails (all agents including orphan)
    try {
      const allQueued = await emailQueue.getAllQueuedEmailsForUser(userId);
      context.queuedEmails = allQueued.map(e => ({
        id: e._id || e.emailId,
        agentId: e.agentId,
        recipientEmail: e.recipientEmail,
        recipientName: e.recipientName,
        company: e.company,
        status: e.status,
        createdAt: e.createdAt
      }));
    } catch (err) {
      console.log('[HELP] Could not fetch queued emails:', err.message);
    }

    // Fetch sent emails (limit to recent 50)
    try {
      const allSent = await emailQueue.getAllSentEmailsForUser(userId);
      context.sentEmails = allSent.slice(0, 50).map(e => ({
        id: e._id || e.emailId,
        agentId: e.agentId,
        recipientEmail: e.recipientEmail,
        recipientName: e.recipientName,
        company: e.company,
        status: e.status,
        sentAt: e.sentAt,
        opened: e.analyticsStatus?.opened || false,
        replied: e.analyticsStatus?.replied || false
      }));
    } catch (err) {
      console.log('[HELP] Could not fetch sent emails:', err.message);
    }

    return context;
  } catch (error) {
    console.error('[HELP] Error fetching user context:', error);
    return null;
  }
}

// POST /api/help/chat - Chat with AI assistant
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, newMessage } = req.body;
    const userId = req.user?.userId;

    if (!newMessage) {
      return res.status(400).json({ error: 'No message provided' });
    }

    // Fetch user-specific context from database
    let userContextStr = '';
    if (userId) {
      const userContext = await fetchUserContext(userId);
      if (userContext) {
        userContextStr = `

# USER'S CURRENT DATA (Real-time from database)
## User Account
- Email: ${userContext.userSettings?.email || 'Unknown'}
- Name: ${userContext.userSettings?.name || 'Unknown'}
- Gmail Connected: ${userContext.userSettings?.gmailConnected ? 'Yes' : 'No'}
- Billing Enabled: ${userContext.userSettings?.billingEnabled ? 'Yes' : 'No'}

## User's Agents (${userContext.agents.length} total)
${userContext.agents.length > 0 ? userContext.agents.map(a => `- ${a.name} (ID: ${a.agentId}) - ${a.personality?.type || 'Standard'} agent`).join('\n') : '- No agents created yet'}

## Email Queue (${userContext.queuedEmails.length} emails waiting)
${userContext.queuedEmails.length > 0 ? 
  `Top 10 queued:\n${userContext.queuedEmails.slice(0, 10).map(e => `- To: ${e.recipientName || e.recipientEmail} at ${e.company || 'Unknown company'} (Agent: ${e.agentId})`).join('\n')}` : 
  '- No emails in queue'}

## Sent Emails (${userContext.sentEmails.length} recent emails)
${userContext.sentEmails.length > 0 ?
  `Recent sends:\n${userContext.sentEmails.slice(0, 10).map(e => `- To: ${e.recipientName || e.recipientEmail} - ${e.opened ? 'Opened' : 'Not opened'}${e.replied ? ', Replied' : ''}`).join('\n')}` :
  '- No emails sent yet'}
`;
      }
    }

    // Initialize OpenAI chat model
    const model = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create prompt template with system knowledge AND user-specific data
    const prompt = PromptTemplate.fromTemplate(`${SYSTEM_KNOWLEDGE}
${userContextStr}

# CONVERSATION HISTORY
{history}

# USER QUESTION
{input}

# ASSISTANT RESPONSE
Provide a helpful, specific answer based on the Meridian platform knowledge and the user's actual data above. When the user asks about their emails, agents, or account status, reference their real data. Be concise but thorough. Use bullet points when listing steps or features.`);

    // Initialize memory with conversation history
    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'history'
    });

    // Load previous messages into memory
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        if (msg.role === 'user') {
          await memory.chatHistory.addUserMessage(msg.content);
        } else if (msg.role === 'assistant') {
          await memory.chatHistory.addAIChatMessage(msg.content);
        }
      }
    }

    // Create conversation chain
    const chain = new ConversationChain({
      llm: model,
      memory: memory,
      prompt: prompt
    });

    // Get AI response
    const response = await chain.call({
      input: newMessage
    });

    res.json({
      success: true,
      message: response.response
    });

  } catch (error) {
    console.error('❌ [HELP CHAT] Error processing chat:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// POST /api/help/contact - Submit help/contact request
router.post('/contact', authenticateToken, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const userId = req.user.id;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    console.log('📧 [HELP CONTACT] Processing contact request from:', email);

    // Send email to support team (Colton)
    const emailBody = `
Help Request from Meridian User

From: ${name} (${email})
User ID: ${userId}

Subject: ${subject}

Message:
${message}

---
Sent from Meridian Help System
    `.trim();

    // Send to Colton's email
    await awsManager.sendEmail({
      to: 'colton.fidd@gmail.com',
      subject: `[Meridian Help] ${subject}`,
      textBody: emailBody,
      from: process.env.FROM_EMAIL || 'noreply@meridianagent.xyz'
    });

    // Send confirmation to user
    const confirmationBody = `
Hi ${name},

Thank you for contacting Meridian support. We've received your message and will get back to you within 24-48 hours.

Your request:
Subject: ${subject}
Message: ${message}

Best regards,
The Meridian Team
    `.trim();

    await awsManager.sendEmail({
      to: email,
      subject: 'We received your help request',
      textBody: confirmationBody,
      from: process.env.FROM_EMAIL || 'support@meridianagent.xyz'
    });

    console.log('✅ [HELP CONTACT] Contact request processed successfully');
    res.json({ success: true, message: 'Help request sent successfully' });
  } catch (error) {
    console.error('❌ [HELP CONTACT] Error processing help request:', error);
    res.status(500).json({ error: 'Failed to send help request' });
  }
});

export default router;
