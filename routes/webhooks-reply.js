import express from 'express';
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "langchain/tools";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";
import crypto from 'crypto';
import { AWSManager } from '../utils/awsManager.js';
import fetch from 'node-fetch';

const router = express.Router();
const awsManager = new AWSManager();

// Import broadcast function for real-time updates
let broadcastAIResponse = null;
try {
  const outreachModule = await import('./outreach.js');
  broadcastAIResponse = outreachModule.broadcastAIResponse;
  console.log('[WEBHOOK] Outreach broadcast function loaded');
} catch (error) {
  console.log('[WEBHOOK] Outreach broadcast not available (will work when loaded)');
}

// Deduplication cache (in-memory, could move to Redis later)
const processedMessages = new Set();
const MESSAGE_CACHE_SIZE = 1000;

// === UTILITY FUNCTIONS ===

function parseMailgunPayload(body) {
  // Mailgun sends form-encoded data
  const formData = new URLSearchParams(body);
  return Object.fromEntries(formData);
}

function parseMessageHeaders(formData) {
  try {
    const headersArray = JSON.parse(formData['message-headers'] || '[]');
    const headers = {};
    for (const [key, value] of headersArray) {
      headers[key.toLowerCase()] = value;
    }
    return headers;
  } catch (error) {
    console.log('[HEADERS] Failed to parse message headers:', error);
    return {};
  }
}

function extractMessageId(headers, field) {
  const raw = headers[field] || "";
  const match = String(raw).match(/<([^>]+)>/);
  return match ? match[1] : null;
}

function extractUserIdFromTrackingId(trackingId) {
  if (!trackingId) return null;
  const match = trackingId.match(/tracking-([a-f0-9]{8})/);
  return match ? match[1] : null;
}

function extractAgentIdFromTrackingId(trackingId) {
  if (!trackingId) return null;
  const match = trackingId.match(/tracking-[a-f0-9]{8}_([^_]+)_/);
  return match ? match[1] : 'reasoning-lead-agent';
}

function isMessageProcessed(messageId) {
  return processedMessages.has(messageId);
}

function markMessageProcessed(messageId) {
  processedMessages.add(messageId);
  // Keep cache size manageable
  if (processedMessages.size > MESSAGE_CACHE_SIZE) {
    const firstItem = processedMessages.values().next().value;
    processedMessages.delete(firstItem);
  }
}

async function getAgentSettings(userId, agentId) {
  try {
    if (!userId || !agentId) return null;
    
    const settings = await awsManager.getAgentSettings(agentId);
    if (settings && settings.userId === userId) {
      console.log('[AWS] Found agent settings:', { agentId, enableAutoResponse: settings.emailBuilder?.enableAutoResponse });
      return settings;
    }
    
    return null;
  } catch (error) {
    console.error('[AWS] Error getting agent settings:', error);
    return null;
  }
}

async function getUserCalendarSettings(userId) {
  try {
    if (!userId) return { calendarId: 'primary' };
    
    const user = await awsManager.getUser(userId);
    if (user?.settings?.calendarSettings) {
      return user.settings.calendarSettings;
    }
    
    return { calendarId: 'primary' };
  } catch (error) {
    console.error('[AWS] Error getting calendar settings:', error);
    return { calendarId: 'primary' };
  }
}

async function getAgentPersonality(userId, agentId) {
  try {
    if (!userId || !agentId) {
      return {
        emailPrompt: 'Write professional, helpful email responses that address the sender\'s needs directly.',
        name: 'AI Assistant',
        style: 'Professional and helpful'
      };
    }

    const settings = await awsManager.getAgentSettings(agentId);
    if (settings?.personality) {
      return {
        emailPrompt: settings.personality.emailPrompt || 'Write professional email responses.',
        name: settings.personality.name || 'AI Assistant',
        style: settings.personality.emailStyle || 'Professional',
        avatar: settings.personality.avatar || '🤖',
        traits: settings.personality.traits || []
      };
    }

    return {
      emailPrompt: 'Write professional, helpful email responses that address the sender\'s needs directly.',
      name: 'AI Assistant',
      style: 'Professional and helpful'
    };
  } catch (error) {
    console.error('[PERSONALITY] Error fetching agent personality:', error);
    return {
      emailPrompt: 'Write professional, helpful email responses that address the sender\'s needs directly.',
      name: 'AI Assistant',
      style: 'Professional and helpful'
    };
  }
}

// === DYNAMODB-BASED TRACKING ===

async function storeConversationEvent(trackingId, eventType, eventData) {
  try {
    const userId = extractUserIdFromTrackingId(trackingId);
    const agentId = extractAgentIdFromTrackingId(trackingId);
    
    const event = {
      trackingId,
      userId,
      agentId,
      eventType,
      timestamp: new Date().toISOString(),
      ...eventData
    };
    
    await awsManager.logEmailTracking(userId, agentId, trackingId, event);
    console.log(`[TRACKING] Stored ${eventType} event for ${trackingId}`);
    return true;
  } catch (error) {
    console.error('[TRACKING] Error storing event:', error);
    return false;
  }
}

async function getConversationHistory(trackingId) {
  try {
    const userId = extractUserIdFromTrackingId(trackingId);
    if (!userId) return [];
    
    // Get all tracking events for this conversation
    const events = await awsManager.getEmailTrackingByTracking(userId, trackingId);
    
    // Format into conversation history
    const history = events
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(event => ({
        role: event.eventType === 'lead_message' ? 'user' : 'assistant',
        content: event.content || event.subject || '',
        timestamp: event.timestamp
      }));
    
    return history;
  } catch (error) {
    console.error('[TRACKING] Error getting conversation history:', error);
    return [];
  }
}

// === LANGCHAIN AGENT TOOLS ===

const getConversationTool = new DynamicStructuredTool({
  name: "get_conversation_history",
  description: "Retrieve past conversation history for this email thread to maintain context",
  schema: z.object({
    tracking_id: z.string().describe("Tracking ID for this conversation")
  }),
  func: async ({ tracking_id }) => {
    try {
      console.log(`[TOOL] Getting conversation history for: ${tracking_id}`);
      const history = await getConversationHistory(tracking_id);
      
      if (history.length === 0) {
        return JSON.stringify({
          history: [],
          message: "No previous conversation found - this is a new thread"
        });
      }
      
      return JSON.stringify({
        history: history.map(msg => ({
          role: msg.role,
          content: msg.content.substring(0, 500),
          timestamp: msg.timestamp
        })),
        total_messages: history.length
      });
    } catch (error) {
      console.error('[TOOL] Error getting conversation:', error);
      return JSON.stringify({
        history: [],
        error: error.message
      });
    }
  }
});

const getUserSettingsTool = new DynamicStructuredTool({
  name: "get_user_settings",
  description: "Get user's email response settings, calendar preferences, and response templates",
  schema: z.object({
    tracking_id: z.string().describe("Tracking ID to extract user information")
  }),
  func: async ({ tracking_id }) => {
    try {
      const userId = extractUserIdFromTrackingId(tracking_id);
      const agentId = extractAgentIdFromTrackingId(tracking_id);
      
      if (!userId) {
        return JSON.stringify({ settings: null, message: "No user ID found" });
      }
      
      const agentSettings = await getAgentSettings(userId, agentId);
      const personality = await getAgentPersonality(userId, agentId);
      const calendarSettings = await getUserCalendarSettings(userId);
      
      return JSON.stringify({
        agent_personality: personality,
        email_settings: agentSettings?.emailBuilder || {},
        calendar_settings: calendarSettings,
        auto_response_enabled: agentSettings?.emailBuilder?.enableAutoResponse !== false
      });
    } catch (error) {
      console.error('[TOOL] Error getting user settings:', error);
      return JSON.stringify({ settings: null, error: error.message });
    }
  }
});

const checkAvailabilityTool = new DynamicStructuredTool({
  name: "check_calendar_availability",
  description: "Check if a proposed meeting time is available on the user's calendar",
  schema: z.object({
    tracking_id: z.string().describe("Tracking ID for user context"),
    proposed_time: z.string().describe("ISO 8601 datetime string for proposed meeting time"),
    duration_minutes: z.number().describe("Meeting duration in minutes"),
    timezone: z.string().optional().describe("Timezone for the meeting (default: America/New_York)")
  }),
  func: async ({ tracking_id, proposed_time, duration_minutes, timezone = 'America/New_York' }) => {
    try {
      console.log(`[TOOL] Checking availability for: ${proposed_time}`);
      
      const userId = extractUserIdFromTrackingId(tracking_id);
      const calendarSettings = await getUserCalendarSettings(userId);
      
      // Import calendar manager dynamically
      const { checkAvailability } = await import('../utils/calendarIntegrationManager.js');
      
      const availability = await checkAvailability(
        calendarSettings.calendarId || 'primary',
        proposed_time,
        duration_minutes,
        timezone
      );
      
      return JSON.stringify(availability);
    } catch (error) {
      console.error('[TOOL] Error checking availability:', error);
      return JSON.stringify({
        available: false,
        error: error.message
      });
    }
  }
});

const createCalendarEventTool = new DynamicStructuredTool({
  name: "create_calendar_event",
  description: "Create a calendar event when a meeting time is confirmed",
  schema: z.object({
    tracking_id: z.string().describe("Tracking ID for user context"),
    summary: z.string().describe("Meeting title/summary"),
    start_time: z.string().describe("ISO 8601 datetime string for meeting start"),
    end_time: z.string().describe("ISO 8601 datetime string for meeting end"),
    attendee_email: z.string().describe("Email address of the attendee"),
    description: z.string().optional().describe("Meeting description"),
    timezone: z.string().optional().describe("Timezone (default: America/New_York)")
  }),
  func: async ({ tracking_id, summary, start_time, end_time, attendee_email, description, timezone = 'America/New_York' }) => {
    try {
      console.log(`[TOOL] Creating calendar event: ${summary}`);
      
      const userId = extractUserIdFromTrackingId(tracking_id);
      const calendarSettings = await getUserCalendarSettings(userId);
      
      // Import calendar manager dynamically
      const { createCalendarEvent } = await import('../utils/calendarIntegrationManager.js');
      
      const event = await createCalendarEvent(
        calendarSettings.calendarId || 'primary',
        {
          summary,
          description: description || '',
          start: { dateTime: start_time, timeZone: timezone },
          end: { dateTime: end_time, timeZone: timezone },
          attendees: [{ email: attendee_email }]
        }
      );
      
      // Log calendar event creation
      await storeConversationEvent(tracking_id, 'calendar_created', {
        summary,
        start_time,
        attendee_email,
        event_id: event.id
      });
      
      return JSON.stringify({
        success: true,
        event_id: event.id,
        event_link: event.htmlLink
      });
    } catch (error) {
      console.error('[TOOL] Error creating calendar event:', error);
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  }
});

const sendEmailTool = new DynamicStructuredTool({
  name: "send_email_reply",
  description: "Send an email reply to the lead. This is how you RESPOND to emails - use this tool to actually send your response.",
  schema: z.object({
    tracking_id: z.string().describe("Tracking ID for this conversation"),
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content"),
    in_reply_to: z.string().optional().describe("Message-ID being replied to"),
    references: z.string().optional().describe("Reference Message-IDs")
  }),
  func: async ({ tracking_id, to, subject, body, in_reply_to, references }) => {
    try {
      console.log(`[TOOL] Sending email to: ${to}`);
      
      const userId = extractUserIdFromTrackingId(tracking_id);
      const agentId = extractAgentIdFromTrackingId(tracking_id);
      
      // Broadcast response start event
      if (broadcastAIResponse) {
        console.log(`📡 [OUTREACH] Broadcasting response_start`, { userId, agentId, to, tracking_id });
        broadcastAIResponse(userId, agentId, {
          type: 'response_start',
          conversationId: tracking_id,
          leadName: to.split('@')[0],
          leadEmail: to,
          timestamp: new Date().toISOString()
        });
      }
      
      // Broadcast the response content in chunks for streaming effect
      if (broadcastAIResponse) {
        const words = body.split(' ');
        const chunkSize = 5; // Send 5 words at a time
        const totalChunks = Math.ceil(words.length / chunkSize);
        
        console.log(`📡 [OUTREACH] Streaming ${words.length} words in ${totalChunks} chunks to userId: ${userId}, agentId: ${agentId}`);
        
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
          broadcastAIResponse(userId, agentId, {
            type: 'response_chunk',
            conversationId: tracking_id,
            chunk
          });
          // Small delay for visual effect
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log(`✅ [OUTREACH] Streaming complete`);
      }
      
      // Generate message ID with tracking
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString('hex');
      const messageId = `<${tracking_id}_${timestamp}_${hash}@mg.examarkchat.com>`;
      
      // Prepare Mailgun request
      const formData = new URLSearchParams();
      formData.append('from', 'replies@mg.examarkchat.com');
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', body);
      formData.append('h:Message-ID', messageId);
      formData.append('v:tracking_id', tracking_id);
      
      if (in_reply_to) {
        formData.append('h:In-Reply-To', in_reply_to);
      }
      if (references) {
        formData.append('h:References', references);
      }
      
      const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Mailgun send failed: ${result.message || JSON.stringify(result)}`);
      }
      
      console.log(`[TOOL] Email sent successfully: ${messageId}`);
      
      // Broadcast response complete event
      if (broadcastAIResponse) {
        console.log(`📡 [OUTREACH] Broadcasting response_complete`, { messageLength: body.length, messageId });
        broadcastAIResponse(userId, agentId, {
          type: 'response_complete',
          conversationId: tracking_id,
          fullResponse: body,
          messageId: messageId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Log the sent email
      await storeConversationEvent(tracking_id, 'ai_reply', {
        subject,
        to,
        body,
        messageId,
        mailgunId: result.id
      });
      
      // Log AI response to DynamoDB for Outreach dashboard
      console.log(`📊 [OUTREACH] Logging AI response event to DynamoDB`, { userId, agentId, tracking_id, to });
      try {
        await awsManager.logEmailTracking(userId, agentId, tracking_id, {
          eventType: 'ai_response',
          recipientEmail: to,
          aiResponsePreview: body.substring(0, 200),
          timestamp: new Date().toISOString(),
          leadName: to.split('@')[0]
        });
        console.log(`✅ [OUTREACH] AI response event logged successfully`);
      } catch (dbError) {
        console.error('❌ [OUTREACH] DynamoDB logging failed:', dbError);
      }
      
      return JSON.stringify({
        success: true,
        message_id: messageId,
        mailgun_id: result.id
      });
      
    } catch (error) {
      console.error('[TOOL] Error sending email:', error);
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  }
});

// === MAIN WEBHOOK HANDLER ===

router.post('/mailgun-reply', async (req, res) => {
  console.log('[WEBHOOK] Received Mailgun webhook');
  
  try {
    // Parse Mailgun payload
    const formData = parseMailgunPayload(req.body);
    
    // Check if this is a bounce/failure event (not an incoming email)
    if (formData.event && formData.event !== 'stored') {
      console.log(`[WEBHOOK] Handling Mailgun event: ${formData.event}`);
      
      // Import bounce handler
      const { handleMailgunEvent, parseMailgunEvent } = await import('../utils/bounceHandler.js');
      
      // Extract user and agent IDs from tracking
      const trackingId = formData['X-Mailgun-Variables']?.split('tracking_id=')[1]?.split(',')[0];
      const userId = extractUserIdFromTrackingId(trackingId);
      const agentId = extractAgentIdFromTrackingId(trackingId);
      
      // Parse and handle the event
      const eventData = parseMailgunEvent(formData);
      await handleMailgunEvent(eventData, userId, agentId);
      
      return res.json({
        success: true,
        message: `Processed ${formData.event} event`,
        event_type: formData.event
      });
    }
    
    // Continue with normal email processing
    const headers = parseMessageHeaders(formData);
    
    // Extract email data
    const inboundMessageId = extractMessageId(headers, 'message-id');
    const inReplyTo = extractMessageId(headers, 'in-reply-to');
    const references = extractMessageId(headers, 'references');
    
    const emailData = {
      from: formData.sender || formData.From,
      to: formData.recipient || formData.To,
      subject: formData.subject || formData.Subject || '',
      body: formData['stripped-text'] || formData['body-plain'] || '',
      messageId: inboundMessageId,
      inReplyTo: inReplyTo,
      references: references
    };
    
    console.log(`[WEBHOOK] Email from: ${emailData.from}`);
    console.log(`[WEBHOOK] Subject: ${emailData.subject}`);
    
    // Deduplication check
    if (isMessageProcessed(inboundMessageId)) {
      console.log('[WEBHOOK] Message already processed, skipping');
      return res.json({ success: true, deduped: true });
    }
    
    markMessageProcessed(inboundMessageId);
    
    // Extract or determine tracking ID
    let trackingId = null;
    
    // Try to extract from In-Reply-To or References
    if (inReplyTo && inReplyTo.includes('tracking-')) {
      const match = inReplyTo.match(/tracking-([a-f0-9]{8}_[^_]+_\d+_[a-f0-9]+)/);
      if (match) trackingId = `tracking-${match[1]}`;
    }
    
    if (!trackingId && references && references.includes('tracking-')) {
      const match = references.match(/tracking-([a-f0-9]{8}_[^_]+_\d+_[a-f0-9]+)/);
      if (match) trackingId = `tracking-${match[1]}`;
    }
    
    // If no tracking ID found, create one (new conversation)
    if (!trackingId) {
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString('hex');
      trackingId = `tracking-76e84c79_reasoning-lead-agent_${timestamp}_${hash}`;
    }
    
    console.log(`[WEBHOOK] Using tracking ID: ${trackingId}`);
    
    // Extract userId and agentId for logging
    const userId = extractUserIdFromTrackingId(trackingId);
    const agentId = extractAgentIdFromTrackingId(trackingId);
    
    // Store the incoming message
    await storeConversationEvent(trackingId, 'lead_message', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      content: emailData.body,
      messageId: inboundMessageId
    });
    
    // Log reply event to DynamoDB for Outreach dashboard
    console.log(`📊 [OUTREACH] Logging reply event to DynamoDB`, { userId, agentId, trackingId, from: emailData.from });
    try {
      await awsManager.logEmailTracking(userId, agentId, trackingId, {
        eventType: 'reply',
        recipientEmail: emailData.from,
        messagePreview: emailData.body.substring(0, 200),
        timestamp: new Date().toISOString()
      });
      console.log(`✅ [OUTREACH] Reply event logged successfully`);
      
      // Broadcast to SSE clients for real-time UI updates
      try {
        const { broadcastAIResponse } = await import('./outreach.js');
        broadcastAIResponse(userId, agentId, {
          type: 'tracking_update',
          trackingId: trackingId,
          eventType: 'reply',
          recipientEmail: emailData.from,
          messagePreview: emailData.body.substring(0, 200),
          timestamp: new Date().toISOString()
        });
        console.log(`✅ [OUTREACH] SSE broadcast sent for reply event`);
      } catch (sseError) {
        console.error('❌ [OUTREACH] SSE broadcast failed:', sseError.message);
      }
    } catch (dbError) {
      console.error('❌ [OUTREACH] DynamoDB logging failed:', dbError);
    }
    
    // Get agent settings to check if auto-response is enabled
    const agentSettings = await getAgentSettings(userId, agentId);
    
    if (agentSettings?.emailBuilder?.enableAutoResponse === false) {
      console.log('[WEBHOOK] Auto-response is DISABLED for this agent, skipping AI response');
      return res.json({
        success: true,
        message: 'Email logged, auto-response disabled'
      });
    }
    
    // Set up the LangChain agent
    console.log('[WEBHOOK] Initializing LangChain agent...');
    
    const model = new ChatOpenAI({
      temperature: 0.1,
      modelName: "gpt-4o-mini",
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    const tools = [
      getConversationTool,
      getUserSettingsTool,
      checkAvailabilityTool,
      createCalendarEventTool,
      sendEmailTool
    ];
    
    // Get personality for system prompt
    const personality = await getAgentPersonality(userId, agentId);
    
    const systemPrompt = `You are ${personality.name}, an AI email assistant that helps manage business communications.

YOUR COMMUNICATION STYLE:
${personality.emailPrompt}

CRITICAL INSTRUCTIONS:
1. You must RESPOND DIRECTLY to emails using the send_email_reply tool
2. DO NOT say "I will send..." or "I have sent..." - just send it
3. When you use send_email_reply, that IS your response
4. Always check conversation history first to maintain context
5. If someone proposes a meeting, check availability and create the event
6. Be helpful, professional, and match the sender's communication style
7. Keep responses concise unless detail is required

Remember: YOU ARE THE RESPONDER. When you send an email with the tool, that completes your task.`;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("agent_scratchpad"),
      ["human", "{input}"]
    ]);
    
    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools,
      prompt
    });
    
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
      maxIterations: 10
    });
    
    // Prepare input for agent
    const agentInput = `You received an email:

From: ${emailData.from}
Subject: ${emailData.subject}
Message:
${emailData.body}

Tracking ID: ${trackingId}
In-Reply-To: ${emailData.inReplyTo || 'N/A'}

Analyze this email and respond appropriately. First check the conversation history, then respond using send_email_reply.`;
    
    console.log('[WEBHOOK] Executing agent...');
    
    // Execute agent
    const agentResponse = await agentExecutor.invoke({
      input: agentInput
    });
    
    console.log('[WEBHOOK] Agent processing completed successfully');
    
    return res.json({
      success: true,
      processed: true,
      tracking_id: trackingId,
      agent_response: agentResponse.output || 'Agent executed successfully'
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Error processing email:', error);
    console.error('[WEBHOOK] Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
