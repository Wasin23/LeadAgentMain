import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import OpenAI from 'openai';
import { leadEmail } from '../tools/leadEmail.js';

const awsManager = new AWSManager();
const emailQueue = new AWSEmailQueue();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Batch update email statuses with delay to prevent DynamoDB throttling
 */
async function updateEmailStatusWithDelay(userId, agentId, emailId, status, reasoning, metadata = {}, delay = 0) {
  try {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    await emailQueue.updateEmailStatus(userId, agentId, emailId, status, reasoning, metadata);
  } catch (error) {
    if (error.name === 'ProvisionedThroughputExceededException') {
      console.log(`⚠️ [REBUMP] DynamoDB throttled, retrying ${emailId} in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        await emailQueue.updateEmailStatus(userId, agentId, emailId, status, reasoning, metadata);
      } catch (retryError) {
        console.error(`❌ [REBUMP] Retry failed for ${emailId}:`, retryError.message);
      }
    } else {
      throw error;
    }
  }
}

/**
 * Generate follow-up templates for an agent (weekly)
 */
async function generateFollowUpTemplates(userId, agentId) {
  try {
    console.log(`🤖 [REBUMP] Generating follow-up templates for agent ${agentId}`);
    
    // Get agent settings for personality
    const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
    if (!agentSettings) {
      console.log(`⚠️ [REBUMP] No settings found for agent ${agentId}`);
      return null;
    }

    const personality = agentSettings.personality || {};
    const companyInfo = agentSettings.companyInfo || {};

    // Generate 3 different follow-up templates
    const prompt = `You are writing follow-up email templates for a sales agent with this personality:

Name: ${personality.name || 'Sales Agent'}
Tone: ${personality.tone || 'professional'}
Communication Style: ${personality.communicationStyle || 'direct and value-focused'}
Company: ${companyInfo.companyName || 'our company'}
Value Prop: ${companyInfo.valueProposition || 'our solution'}

Generate 3 short follow-up email templates (2-3 sentences each, MAX 4 sentences) for leads who didn't respond.

Each template should:
- Be SHORT and punchy - busy people don't read long emails
- Use {name} (this will be replaced with FIRST NAME only)
- Use other variables: {company}, {topic}, {days_ago}
- Sound casual and human, not corporate
- Have a different approach (value add, insight share, direct ask)
- End with a simple question

Return ONLY valid JSON with this structure:
{
  "templates": [
    {
      "name": "Value Add",
      "subject": "Quick thought on {company}",
      "body": "Short 2-3 sentence template with {variables}"
    },
    {
      "name": "Insight Share", 
      "subject": "Quick thought",
      "body": "Short 2-3 sentence template with {variables}"
    },
    {
      "name": "Direct Ask",
      "subject": "Quick question, {name}?",
      "body": "Short 2-3 sentence template with {variables}"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a follow-up email template generator. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const response = JSON.parse(completion.choices[0].message.content);
    
    // Store templates in agent settings
    const updatedSettings = {
      ...agentSettings,
      followUpTemplates: {
        templates: response.templates,
        generatedAt: new Date().toISOString(),
        lastUsedIndex: 0
      }
    };

    await awsManager.saveLeadAgentSettings(userId, agentId, updatedSettings);
    
    console.log(`✅ [REBUMP] Generated ${response.templates.length} templates for agent ${agentId}`);
    return response.templates;
  } catch (error) {
    console.error('❌ [REBUMP] Error generating templates:', error);
    return null;
  }
}

/**
 * Auto-schedule a follow-up for a newly sent email
 */
export async function autoScheduleFollowUp(userId, agentId, sentEmail) {
  try {
    
    // Get agent settings
    const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
    
    if (!agentSettings || !agentSettings.emailBuilder) {
      return { success: false, reason: 'no_settings' };
    }

    const rebumpEnabled = agentSettings.emailBuilder.enableRebump !== false;
    
    if (!rebumpEnabled) {
      return { success: false, reason: 'disabled' };
    }

    // Check if follow-up already scheduled
    if (sentEmail.followUpScheduled) {
      return { success: false, reason: 'already_scheduled' };
    }

    // Generate templates if needed
    let templates = agentSettings.followUpTemplates?.templates;
    const lastGenerated = agentSettings.followUpTemplates?.generatedAt;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    
    if (!templates || !lastGenerated || new Date(lastGenerated) < weekAgo) {
      const newTemplates = await generateFollowUpTemplates(userId, agentId);
      if (newTemplates) templates = newTemplates;
    }

    // Get interval days from settings
    const rawIntervalDays = agentSettings.emailBuilder.rebumpIntervalDays;
    const intervalDays = parseInt(rawIntervalDays, 10) || 7;
    
    // Calculate exact follow-up date - use current time since email was just sent
    const sentDate = new Date(); // Use NOW since email was just sent moments ago
    const followUpDate = new Date(sentDate.getTime() + (intervalDays * 24 * 60 * 60 * 1000));
    
    
    // Get selected default template or use first one
    const selectedTemplateId = agentSettings.emailBuilder.selectedFollowUpTemplate || 0;
    const templateToUse = templates?.[selectedTemplateId] || templates?.[0];
    

    // Mark email with calculated follow-up date and assigned template
    await updateEmailStatusWithDelay(userId, agentId, sentEmail.id, 'SENT', 'SENT', {
      followUpScheduled: true,
      followUpScheduledAt: new Date().toISOString(),
      followUpDate: followUpDate.toISOString(),
      assignedTemplateId: selectedTemplateId,
      assignedTemplate: templateToUse
    });

    
    return { success: true, followUpDate: followUpDate.toISOString() };
  } catch (error) {
    console.error('❌ [REBUMP] Error auto-scheduling follow-up:', error);
    console.error('❌ [REBUMP] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel all scheduled follow-ups for an agent
 */
export async function cancelScheduledFollowUps(userId, agentId) {
  try {
    console.log(`🚫 [REBUMP] Canceling all scheduled follow-ups for agent ${agentId}`);
    
    // Get all SENT emails for this agent
    const sentEmails = await emailQueue.getSentEmails(userId, agentId);
    if (!sentEmails || sentEmails.length === 0) return;

    let canceledCount = 0;

    // Update all emails that have scheduled follow-ups
    for (const email of sentEmails) {
      if (email.followUpScheduled) {
        await updateEmailStatusWithDelay(userId, agentId, email.id, 'SENT', 'SENT', {
          followUpScheduled: false,
          followUpCanceledAt: new Date().toISOString()
        }, 200);
        canceledCount++;
      }
    }

    console.log(`✅ [REBUMP] Canceled ${canceledCount} scheduled follow-ups`);
    return { canceledCount };
  } catch (error) {
    console.error('❌ [REBUMP] Error canceling follow-ups:', error);
    return { canceledCount: 0 };
  }
}

/**
 * Check for emails that need rebumps and queue them
 */
export async function checkForRebumps() {
  console.log('🕐 [REBUMP] Checking for emails needing follow-ups...');
  
  try {
    // Get all users
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const scanCommand = new ScanCommand({
      TableName: awsManager.tables.userSettings
    });
    
    const { Items: users } = await awsManager.dynamodb.send(scanCommand);
    
    if (!users || users.length === 0) {
      console.log('✅ [REBUMP] No users found');
      return;
    }

    let totalRebumpsQueued = 0;

    // Process each user
    for (const user of users) {
      const userId = user.userId;
      
      // Skip suspended users
      if (user.accountStatus === 'suspended') {
        continue;
      }

      // Get all agents for this user
      const agents = await awsManager.getUserAgents(userId);
      if (!agents || agents.length === 0) continue;

      for (const agent of agents) {
        const agentId = agent.agentId;
        
        // Get agent settings
        const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
        if (!agentSettings || !agentSettings.emailBuilder) continue;

        const rebumpIntervalDays = agentSettings.emailBuilder.rebumpIntervalDays || 7;
        const rebumpEnabled = agentSettings.emailBuilder.enableRebump !== false; // Default true
        
        if (!rebumpEnabled) continue;

        // Check if templates need regeneration (weekly)
        const templates = agentSettings.followUpTemplates?.templates;
        const lastGenerated = agentSettings.followUpTemplates?.generatedAt;
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        if (!templates || !lastGenerated || new Date(lastGenerated) < weekAgo) {
          console.log(`🔄 [REBUMP] Regenerating templates for agent ${agentId}`);
          await generateFollowUpTemplates(userId, agentId);
          // Reload settings after generation
          const updatedSettings = await awsManager.getLeadAgentSettings(userId, agentId);
          agentSettings.followUpTemplates = updatedSettings.followUpTemplates;
        }

        // Get SENT emails for this agent
        const sentEmails = await emailQueue.getSentEmails(userId, agentId);
        if (!sentEmails || sentEmails.length === 0) continue;

        const now = Date.now();
        const rebumpIntervalMs = rebumpIntervalDays * 24 * 60 * 60 * 1000;

        // Filter emails that need rebumps
        for (const email of sentEmails) {
          const emailTo = email.to || 'unknown';
          
          // Skip if no follow-up scheduled
          if (!email.followUpScheduled) {
            continue;
          }
          
          // Skip if already has reply
          if (email.status === 'REPLIED') {
            continue;
          }
          
          // Skip if bounced
          if (email.status === 'BOUNCED') {
            continue;
          }
          
          // Skip if already rebumped (check rebumpCount)
          const rebumpCount = email.rebumpCount || 0;
          const maxRebumps = agentSettings.emailBuilder.maxRebumps || 1;
          if (rebumpCount >= maxRebumps) {
            continue;
          }

          // Skip if no follow-up date set
          if (!email.followUpDate) {
            continue;
          }

          // FIX: Check if followUpDate is BEFORE sentAt (bug from old code)
          // If so, recalculate the follow-up date properly
          let followUpDate = new Date(email.followUpDate);
          const sentAt = new Date(email.sentAt || email.timestamp);
          
          if (followUpDate.getTime() < sentAt.getTime()) {
            // BUG DETECTED: Follow-up date is before sent date, recalculate
            console.log(`🐛 [REBUMP] ${emailTo}: BUG - followUpDate (${followUpDate.toISOString()}) is BEFORE sentAt (${sentAt.toISOString()})`);
            console.log(`🔧 [REBUMP] ${emailTo}: Recalculating follow-up date...`);
            
            // Recalculate: sentAt + rebumpIntervalDays
            followUpDate = new Date(sentAt.getTime() + rebumpIntervalMs);
            
            // Update the email with corrected follow-up date
            await updateEmailStatusWithDelay(userId, agentId, email.id, 'SENT', 'SENT', {
              followUpDate: followUpDate.toISOString(),
              followUpDateFixed: true
            }, 400);
            console.log(`✅ [REBUMP] ${emailTo}: Fixed followUpDate to ${followUpDate.toISOString()}`);
          }

          // Check if we've reached the follow-up date
          if (now < followUpDate.getTime()) {
            const daysUntil = Math.ceil((followUpDate.getTime() - now) / (24 * 60 * 60 * 1000));
            continue;
          }

          // We've reached the follow-up date!
          console.log(`✅ [REBUMP] ${emailTo}: READY for follow-up! (scheduled: ${followUpDate.toISOString()}, now: ${new Date(now).toISOString()})`);
          const timeSinceLastContact = now - sentAt.getTime();
          {
            console.log(`📧 [REBUMP] Queueing rebump for ${email.to} (scheduled: ${followUpDate.toISOString()})`);
            
            // Use the assigned template from when email was sent
            let template = email.assignedTemplate;
            let templateIndex = email.assignedTemplateId || 0;
            
            // Fallback to templates if assigned template is missing
            if (!template) {
              template = agentSettings.followUpTemplates?.templates[templateIndex];
            }
            
            if (!template) {
              console.log(`⚠️ [REBUMP] No templates available for agent ${agentId}`);
              continue;
            }

            // Fill in template variables
            const lead = email.lead || {};
            const daysAgo = Math.floor(timeSinceLastContact / (24 * 60 * 60 * 1000));
            const topic = email.subject || 'our previous conversation';
            
            // Extract first name only (e.g., "John Smith" -> "John")
            const firstName = (lead.name || 'there').split(' ')[0];

            const subject = template.subject
              .replace(/{name}/g, firstName)
              .replace(/{company}/g, lead.company || 'your company')
              .replace(/{topic}/g, topic)
              .replace(/{days_ago}/g, daysAgo);

            const body = template.body
              .replace(/{name}/g, firstName)
              .replace(/{company}/g, lead.company || 'your company')
              .replace(/{topic}/g, topic)
              .replace(/{days_ago}/g, daysAgo);

            // Build threading info for sending as a reply to the original email
            const replyOptions = {
              // Use original email's tracking ID for In-Reply-To header
              // trackingId already contains the full tracking ID (e.g., "tracking-userId_agentId_timestamp_random")
              inReplyTo: email.trackingId ? `<${email.trackingId}@gmail.com>` : null,
              // References header for threading (same as In-Reply-To)
              references: email.trackingId ? `<${email.trackingId}@gmail.com>` : null,
              // Gmail thread ID for threading in Gmail
              threadId: email.gmailThreadId || null
            };
            
            console.log(`🧵 [REBUMP] Threading info for follow-up:`, replyOptions);

            // SEND the rebump email directly (no queue - auto-send)
            console.log(`📤 [REBUMP] Sending follow-up #${rebumpCount + 1} directly to ${email.to}`);
            
            try {
              const sendResult = await leadEmail(
                email.to,
                subject,
                body,
                lead, // personInfo
                userId,
                agentId,
                null, // ccEmails
                null, // bccEmails
                null, // senderName (will use agent settings)
                replyOptions // threading info
              );
              
              if (sendResult.success) {
                console.log(`✅ [REBUMP] Successfully sent follow-up #${rebumpCount + 1} to ${email.to}`);
                
                // Update original email with rebump info - mark that follow-up was SENT
                await updateEmailStatusWithDelay(userId, agentId, email.id, 'SENT', 'SENT', {
                  rebumpCount: rebumpCount + 1,
                  lastRebumpAt: new Date().toISOString(),
                  lastFollowUpSentAt: new Date().toISOString(),
                  followUpStatus: 'SENT'
                }, 600);
                
                // Calculate next follow-up date if more follow-ups remaining
                if (rebumpCount + 1 < maxRebumps) {
                  const nextFollowUpDate = new Date(Date.now() + rebumpIntervalMs);
                  await updateEmailStatusWithDelay(userId, agentId, email.id, 'SENT', 'SENT', {
                    followUpDate: nextFollowUpDate.toISOString()
                  });
                  console.log(`📅 [REBUMP] Scheduled next follow-up for ${nextFollowUpDate.toISOString()}`);
                }
                
                totalRebumpsQueued++; // Actually sent, but keeping the counter name
              } else {
                console.error(`❌ [REBUMP] Failed to send follow-up to ${email.to}:`, sendResult.error);
              }
            } catch (sendError) {
              console.error(`❌ [REBUMP] Error sending follow-up to ${email.to}:`, sendError);
            }
            
            console.log(`✅ [REBUMP] Updated original email ${email.id} with rebumpCount=${rebumpCount + 1}`);

            // Update template rotation
            const nextIndex = (templateIndex + 1) % agentSettings.followUpTemplates.templates.length;
            await awsManager.saveLeadAgentSettings(userId, agentId, {
              ...agentSettings,
              followUpTemplates: {
                ...agentSettings.followUpTemplates,
                lastUsedIndex: nextIndex
              }
            });

            totalRebumpsQueued++;
          }
        }
      }
    }

    console.log(`📊 [REBUMP] Check complete - ${totalRebumpsQueued} follow-ups queued`);
  } catch (error) {
    console.error('❌ [REBUMP] Error checking rebumps:', error);
    console.error('❌ [REBUMP] Stack:', error.stack);
  }
}

/**
 * Start rebump checker (runs every 6 hours)
 */
export function startRebumpChecker() {
  // Run every 6 hours
  const interval = 6 * 60 * 60 * 1000; // 6 hours in ms
  
  console.log('⏰ [REBUMP] Starting rebump checker (runs every 6 hours)');
  
  // Run immediately on startup
  checkForRebumps();
  
  // Then run every 6 hours
  setInterval(() => {
    checkForRebumps();
  }, interval);
}
