// LangChain-powered Email Automation Agent (ported from Netlify)
import express from 'express';
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "langchain/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";
import crypto from 'crypto';
import AWSManager from '../utils/awsManager.js';
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

// === DEDUPLICATION SYSTEM ===
const processedMessages = new Map(); // Store with timestamps
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
  // Format: tracking-UUID_AGENTID_TIMESTAMP_HASH
  const match = trackingId.match(/tracking-([a-f0-9-]+)_/);
  return match ? match[1] : null;
}

function extractAgentIdFromTrackingId(trackingId) {
  if (!trackingId) return null;
  // Format: tracking-UUID_AGENTID_TIMESTAMP_HASH
  const match = trackingId.match(/tracking-[a-f0-9-]+_([^_]+)_/);
  return match ? match[1] : null;
}

function getTimezoneOffset(timezone) {
  const now = new Date();
  
  const checkDST = (tz) => {
    const currentOffset = new Intl.DateTimeFormat('en', {
      timeZoneName: 'longOffset',
      timeZone: tz
    }).formatToParts(now).find(part => part.type === 'timeZoneName').value;
    
    return currentOffset.replace('GMT', '');
  };
  
  switch (timezone) {
    case 'America/Los_Angeles':
      return checkDST('America/Los_Angeles');
    case 'America/New_York':
      return checkDST('America/New_York');
    case 'America/Chicago':
      return checkDST('America/Chicago');
    case 'America/Denver':
      return checkDST('America/Denver');
    default:
      return checkDST('America/Los_Angeles');
  }
}

function isBusinessHours(date, userTimezone) {
  const hour = parseInt(date.toLocaleString("en-US", {
    timeZone: userTimezone,
    hour: 'numeric',
    hour12: false
  }));
  return hour >= 8 && hour < 20; // 8am-8pm
}

function isMessageProcessed(messageId) {
  return processedMessages.has(messageId);
}

function markMessageProcessed(messageId) {
  if (messageId) {
    processedMessages.set(messageId, Date.now());
    // Clean up old entries
    if (processedMessages.size > MESSAGE_CACHE_SIZE) {
      const entries = Array.from(processedMessages.entries());
      entries.sort((a, b) => b[1] - a[1]);
      processedMessages.clear();
      entries.slice(0, 500).forEach(([id, time]) => processedMessages.set(id, time));
    }
  }
}

async function getAgentSettings(userId, agentId) {
  try {
    if (!userId || !agentId) return null;
    
    const settings = await awsManager.getAgentSettings(userId, agentId);
    if (settings) {
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
    
    const { getUserById } = await import('../lib/userManager.js');
    const user = await getUserById(userId);
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

    const settings = await awsManager.getAgentSettings(userId, agentId);
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
      console.log(`\n🔧 [TOOL START] get_conversation_history`);
      console.log(`   Tracking ID: ${tracking_id}`);
      const history = await getConversationHistory(tracking_id);
      console.log(`   Found ${history.length} messages in history`);
      console.log(`✅ [TOOL END] get_conversation_history completed\n`);
      
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
      console.log(`\n🔧 [TOOL START] send_email_reply`);
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body length: ${body.length} chars`);
      console.log(`   Tracking ID: ${tracking_id}`);
      
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
      
      // Get personality and user info for from name
      const personality = await getAgentPersonality(userId, agentId);
      const userInfo = await awsManager.getUserById(userId);
      
      const fromName = userInfo?.company_name || personality.name || 'AI Assistant';
      formData.append('from', `${fromName} <replies@mg.examarkchat.com>`);
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
      console.error(`\n❌ [TOOL ERROR] send_email_reply failed:`, error.message);
      console.error(error.stack);
      return JSON.stringify({
        success: false,
        error: error.message
      });
    } finally {
      console.log(`✅ [TOOL END] send_email_reply completed\n`);
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
    
    // First, try to extract from custom X-Meridian-Tracking-Id header
    if (headers['x-meridian-tracking-id']) {
      trackingId = headers['x-meridian-tracking-id'];
      console.log(`[WEBHOOK] Found tracking ID in X-Meridian-Tracking-Id header: ${trackingId}`);
    }
    
    // Try to extract from In-Reply-To or References
    // Format: <tracking-tracking-UUID_AGENTID_TIMESTAMP_HASH@domain>
    if (!trackingId && inReplyTo && inReplyTo.includes('tracking-')) {
      const match = inReplyTo.match(/tracking-(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/);
      if (match) trackingId = match[1];
      console.log(`[WEBHOOK] Found tracking ID in In-Reply-To: ${trackingId}`);
    }
    
    if (!trackingId && references && references.includes('tracking-')) {
      const match = references.match(/tracking-(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/);
      if (match) trackingId = match[1];
      console.log(`[WEBHOOK] Found tracking ID in References: ${trackingId}`);
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
    
    // Get original email metadata for enrichment
    let leadName = null;
    let originalSubject = null;
    try {
      const awsQueue = (await import('../utils/awsEmailQueue.js')).default;
      const queueInstance = new awsQueue();
      const sentEmails = await queueInstance.getSentEmails(userId, agentId);
      const emailData_original = sentEmails.find(e => e.trackingId === trackingId);
      if (emailData_original) {
        leadName = emailData_original.leadName || 
                   emailData_original.personInfo?.fullName || 
                   emailData_original.personInfo?.name || 
                   (emailData.from ? emailData.from.split('@')[0] : null);
        originalSubject = emailData_original.subject || emailData_original.emailSubject;
        console.log(`[WEBHOOK] Enriched reply metadata: leadName=${leadName}, subject=${originalSubject}`);
      }
    } catch (err) {
      console.error('[WEBHOOK] Error fetching original email metadata:', err.message);
    }
    
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
        leadName: leadName,
        subject: originalSubject || emailData.subject,
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
          leadName: leadName,
          subject: originalSubject || emailData.subject,
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
      console.log('[WEBHOOK] Auto-response is disabled globally for this agent');
      return res.json({ 
        success: true, 
        processed: false, 
        reason: 'Auto-response disabled globally'
      });
    }

    // TODO: Re-enable conversation-level AI control after fixing DynamoDB schema
    // const aiEnabled = await awsManager.getConversationAIControl(userId, agentId, trackingId);
    // if (!aiEnabled) {
    //   console.log(`[WEBHOOK] AI auto-response is PAUSED for conversation ${trackingId}`);
    //   return res.json({ 
    //     success: true, 
    //     processed: false, 
    //     reason: 'AI paused for this conversation'
    //   });
    // }
    
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
    
    // Get user settings for comprehensive system prompt
    let userSettings = null;
    try {
      const { getUserById } = await import('../lib/userManager.js');
      const user = await getUserById(userId);
      if (user?.emailResponseSettings) {
        userSettings = user.emailResponseSettings;
      }
    } catch (error) {
      console.error('[WEBHOOK] Failed to get user settings:', error);
    }

    // Get personality for system prompt
    const personality = await getAgentPersonality(userId, agentId);
    const emailResponsePrompt = agentSettings?.emailBuilder?.emailResponsePrompt || null;
    
    // Create comprehensive system prompt - FULLY DRIVEN BY AI PERSONALITY
    const systemPrompt = userSettings ? `You are ${personality.name}, ${personality.style || 'a professional'} AI assistant for ${userSettings.company_name || 'our company'}.

YOUR PERSONALITY & IDENTITY:
- Name: ${personality.name}
- Avatar: ${personality.avatar || '🤖'}
- Style: ${personality.style || 'Professional and helpful'}
- Traits: ${personality.traits?.join(', ') || 'Professional, helpful, efficient'}

YOUR COMMUNICATION MANDATE (THIS IS WHO YOU ARE):
${personality.emailPrompt}

${emailResponsePrompt ? `SPECIFIC EMAIL RESPONSE GUIDELINES FOR THIS AGENT:\n${emailResponsePrompt}\n` : ''}
COMPANY CONTEXT:
- Company: ${userSettings.company_name}
- Product: ${userSettings.product_name}
- Value Props: ${userSettings.value_propositions?.join(', ') || 'Not specified'}
- Your Role: Represent ${userSettings.company_name} with your unique ${personality.style} personality
- Response Tone: ${userSettings.response_tone} (adapt to your personality)
- Calendar ID: ${userSettings.calendar_id}

USER TIMEZONE: ${userSettings.timezone}
- Current date: ${new Date().toISOString().split('T')[0]}
- Tomorrow: ${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}
- Date format for scheduling: "YYYY-MM-DDTHH:MM:SS${getTimezoneOffset(userSettings.timezone)}"

YOUR OPERATIONAL PROTOCOL:
1. ALWAYS use get_conversation_history tool first to understand context
2. ALWAYS use get_user_settings tool to get current configuration
3. CRITICAL SCHEDULING LOGIC:
   - When prospect ASKS about availability: Use check_calendar_availability and LIST options, DON'T auto-schedule
   - When prospect CONFIRMS a time: Check availability, then create event if free
   - NEVER auto-schedule when prospect is just asking about availability
4. MANDATORY: Use send_email_reply tool to actually send responses
5. Use store_event tool only for significant events

CALENDAR RULES:
- Business hours: 8am-8pm in timezone ${userSettings.timezone}
- Default duration: 30 minutes
- ALWAYS check availability before scheduling
- Timezone: ALWAYS use ${userSettings.timezone}

WRITING STYLE (EMBODY YOUR PERSONALITY):
- Write as ${personality.name} would write - let your ${personality.style} personality shine through
- Your traits (${personality.traits?.join(', ') || 'professional, helpful'}) should be evident in every response
- Respond DIRECTLY to the email sender as ${personality.name}
- NEVER use bullet points or markdown - write natural, flowing paragraphs in YOUR voice
- Be conversational and match their style while maintaining YOUR personality
- After first exchange, always suggest meeting times (but in your personality's style)

CRITICAL: YOU MUST SEND ACTUAL EMAIL REPLIES AS ${personality.name.toUpperCase()}
- Use send_email_reply tool - don't just describe sending
- When you send via tool, that IS your response as ${personality.name}
- Write emails that sound like ${personality.name}, not a generic assistant
- Include proper In-Reply-To and References headers for threading` : `You are ${personality.name}, an AI email assistant with a ${personality.style} personality.

YOUR PERSONALITY:
${personality.emailPrompt}
- Traits: ${personality.traits?.join(', ') || 'Professional, helpful'}
- Style: ${personality.style}

${emailResponsePrompt ? `SPECIFIC EMAIL GUIDELINES:\n${emailResponsePrompt}\n` : ''}
CRITICAL PROTOCOL:
1. Use send_email_reply tool to actually send responses AS ${personality.name}
2. Check conversation history first with get_conversation_history
3. For meetings: check availability before scheduling
4. Respond directly to the sender in YOUR personality's voice
5. No markdown formatting - natural conversation that reflects ${personality.style} style

Remember: You ARE ${personality.name}. Every email should sound like YOU, not a generic assistant.`;
    
    console.log('\n🚀 [WEBHOOK] ========== EXECUTING AI RESPONSE ==========');
    console.log(`   Strategy: Manual tool execution (bypassing broken AgentExecutor)`);
    console.log(`   Step 1: Get conversation history`);
    console.log(`   Step 2: Generate and send reply`);
    console.log('=' .repeat(50) + '\n');
    
    // WORKAROUND: Manually execute tools since OpenAIFunctionsAgent is broken
    // Step 1: Get conversation history
    console.log('🔧 [STEP 1] Getting conversation history...');
    const historyResult = await getConversationTool.func({ tracking_id: trackingId });
    const history = JSON.parse(historyResult);
    console.log(`✅ [STEP 1] Retrieved ${history.history?.length || 0} messages\n`);
    
    // Step 2: Generate response using LLM
    console.log('🔧 [STEP 2] Generating AI response...');
    const responsePrompt = `You received an email from ${emailData.from}:

Subject: ${emailData.subject}
Message: ${emailData.body}

Conversation history: ${history.message || 'First message in thread'}

Write a ${personality.style} response email as ${personality.name}. Keep it brief and action-oriented. Focus on moving toward a meeting.

Response:`;

    const llmResponse = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: responsePrompt }
    ]);
    
    const responseBody = llmResponse.content;
    console.log(`✅ [STEP 2] Generated ${responseBody.length} char response\n`);
    
    // Step 3: Send the email
    console.log('🔧 [STEP 3] Sending email reply...');
    const sendResult = await sendEmailTool.func({
      tracking_id: trackingId,
      to: emailData.from,
      subject: `Re: ${emailData.subject.replace(/^Re:\s*/i, '')}`,
      body: responseBody,
      in_reply_to: emailData.inReplyTo,
      references: emailData.references
    });
    
    const sendData = JSON.parse(sendResult);
    console.log(`✅ [STEP 3] Email sent successfully!`);
    console.log('\n🏁 [WEBHOOK] ========== AI RESPONSE COMPLETE ==========\n');
    
    return res.json({
      success: true,
      processed: true,
      tracking_id: trackingId,
      agent_response: 'Email reply sent successfully'
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

// Export function for Gmail polling
export async function processGmailReply(userId, message) {
  try {
    console.log(`[GMAIL REPLY] Processing Gmail reply from ${message.from}`);
    
    // Extract tracking ID from message headers
    let trackingId = null;
    
    // Try to extract from In-Reply-To or References
    if (message.inReplyTo && message.inReplyTo.includes('tracking-')) {
      const match = message.inReplyTo.match(/tracking-([a-f0-9]{8}_[^_]+_\d+_[a-f0-9]+)/);
      if (match) trackingId = `tracking-${match[1]}`;
      console.log(`[GMAIL REPLY] Found tracking ID in In-Reply-To: ${trackingId}`);
    }
    
    if (!trackingId && message.references && message.references.includes('tracking-')) {
      const match = message.references.match(/tracking-([a-f0-9]{8}_[^_]+_\d+_[a-f0-9]+)/);
      if (match) trackingId = `tracking-${match[1]}`;
      console.log(`[GMAIL REPLY] Found tracking ID in References: ${trackingId}`);
    }
    
    // If no tracking ID found, create one (new conversation)
    if (!trackingId) {
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString('hex');
      const shortUserId = userId.substring(0, 8);
      trackingId = `tracking-${shortUserId}_reasoning-lead-agent_${timestamp}_${hash}`;
      console.log(`[GMAIL REPLY] Created new tracking ID: ${trackingId}`);
    }
    
    // Extract userId and agentId for logging
    const extractedUserId = extractUserIdFromTrackingId(trackingId);
    const agentId = extractAgentIdFromTrackingId(trackingId);
    
    // Store the incoming message
    await storeConversationEvent(trackingId, 'lead_message', {
      from: message.from,
      to: message.to,
      subject: message.subject,
      content: message.body,
      messageId: message.messageId
    });
    
    // Log reply event to DynamoDB for Outreach dashboard
    console.log(`📊 [OUTREACH] Logging Gmail reply event to DynamoDB`, { userId: extractedUserId, agentId, trackingId, from: message.from });
    try {
      await awsManager.logEmailTracking(extractedUserId || userId, agentId, trackingId, {
        eventType: 'reply',
        recipientEmail: message.from,
        messagePreview: message.body.substring(0, 200),
        timestamp: new Date().toISOString()
      });
      console.log(`✅ [OUTREACH] Reply event logged successfully`);
      
      // Broadcast to SSE clients for real-time UI updates
      if (broadcastAIResponse) {
        broadcastAIResponse(extractedUserId || userId, agentId, {
          type: 'tracking_update',
          trackingId: trackingId,
          eventType: 'reply',
          recipientEmail: message.from,
          messagePreview: message.body.substring(0, 200),
          timestamp: new Date().toISOString()
        });
        console.log(`✅ [OUTREACH] SSE broadcast sent for Gmail reply event`);
      }
    } catch (dbError) {
      console.error('❌ [OUTREACH] DynamoDB logging failed:', dbError);
    }
    
    // Get agent settings to check if auto-response is enabled
    const agentSettings = await getAgentSettings(extractedUserId || userId, agentId);
    
    if (agentSettings?.emailBuilder?.enableAutoResponse === false) {
      console.log('[GMAIL REPLY] Auto-response is DISABLED for this agent, skipping AI response');
      return { success: true, message: 'Email logged, auto-response disabled' };
    }
    
    // Set up the LangChain agent
    console.log('[GMAIL REPLY] Initializing LangChain agent...');
    
    const model = new ChatOpenAI({
      temperature: 0.1,
      modelName: "gpt-4o-mini",
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    const tools = [
      getConversationTool,
      sendEmailTool,
      getAvailabilityTool,
      researchCompanyTool,
      searchInternetTool,
      getBusinessHoursTool
    ];
    
    // Get user timezone
    const userSettings = await getUserSettings(extractedUserId || userId);
    const userTimezone = userSettings?.timezone || 'America/Los_Angeles';
    
    // Get AI personality
    const aiPersonality = agentSettings?.aiPersonality || 'Professional';
    
    // Build personality-specific system prompt
    let personalityTraits = '';
    let toneGuidance = '';
    
    switch (aiPersonality) {
      case 'Professional':
        personalityTraits = 'You are professional, polished, and business-focused';
        toneGuidance = 'Use formal language, clear structure, and maintain a respectful, corporate tone';
        break;
      case 'Friendly':
        personalityTraits = 'You are warm, approachable, and personable';
        toneGuidance = 'Use conversational language, show enthusiasm, and build rapport naturally';
        break;
      case 'Casual':
        personalityTraits = 'You are relaxed, informal, and down-to-earth';
        toneGuidance = 'Use simple language, short sentences, and a conversational style';
        break;
      case 'Formal':
        personalityTraits = 'You are highly formal, precise, and diplomatic';
        toneGuidance = 'Use sophisticated vocabulary, complex sentences, and maintain strict professionalism';
        break;
      default:
        personalityTraits = 'You are professional and courteous';
        toneGuidance = 'Use clear, respectful language';
    }
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are an AI sales assistant helping to manage email conversations with potential leads.
${personalityTraits}. ${toneGuidance}.

Your timezone is ${userTimezone} (UTC${getTimezoneOffset(userTimezone)}).

IMPORTANT INSTRUCTIONS:
1. ALWAYS check conversation history FIRST using get_conversation_history
2. Read their message carefully and understand the context
3. If they're asking about availability or meetings:
   - Use get_business_hours to see when you're available
   - Use get_availability to check specific dates/times
   - Suggest 2-3 specific time options if they haven't proposed times
4. Keep responses concise (2-3 paragraphs max)
5. End with a clear call-to-action or question
6. Use send_email_reply to send your response
7. If you need to research their company, use research_company
8. For general questions, use search_internet

MEETING SCHEDULING RULES:
- Only suggest times during business hours (9 AM - 5 PM in your timezone)
- When proposing times, give specific dates and times (e.g., "Tuesday, March 15th at 2:00 PM ${userTimezone}")
- If they propose a time outside business hours, politely suggest an alternative
- Always confirm timezone when scheduling

Remember: You represent the user professionally. Be helpful, responsive, and clear in all communications.`],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad")
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
      maxIterations: 10,
      returnIntermediateSteps: true
    });
    
    // Prepare input for agent
    const agentInput = `You received an email from Gmail:

From: ${message.from}
Subject: ${message.subject}
Message:
${message.body}

Tracking ID: ${trackingId}
In-Reply-To: ${message.inReplyTo || 'N/A'}

REQUIRED ACTIONS (you MUST complete all steps):
1. Use get_conversation_history tool with tracking_id: ${trackingId}
2. After reviewing history, you MUST use send_email_reply tool to send your response
3. Do NOT stop after checking history - you MUST send a reply

This is mandatory - complete both steps.`;
    
    console.log('[GMAIL REPLY] Executing agent...');
    
    // Execute agent - use call() to ensure tools are executed
    const agentResponse = await agentExecutor.call({
      input: agentInput
    });
    
    console.log('[GMAIL REPLY] Agent response:', agentResponse);
    console.log('[GMAIL REPLY] Agent processing completed successfully');
    
    return {
      success: true,
      processed: true,
      tracking_id: trackingId,
      agent_response: agentResponse.output || 'Agent executed successfully'
    };
    
  } catch (error) {
    console.error('[GMAIL REPLY] Error processing Gmail reply:', error);
    console.error('[GMAIL REPLY] Error stack:', error.stack);
    throw error;
  }
}

export default router;
