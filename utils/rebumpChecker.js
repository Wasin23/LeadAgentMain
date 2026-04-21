import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import OpenAI from 'openai';
import { leadEmail } from '../tools/leadEmail.js';
import { internetSearch } from '../tools/internetSearch.js';

const awsManager = new AWSManager();
const emailQueue = new AWSEmailQueue();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const mistral = new OpenAI({
  apiKey: process.env.MISTRAL_API_KEY,
  baseURL: 'https://api.mistral.ai/v1'
});

// Mistral medium rates with 1.2x platform margin
const MISTRAL_INPUT_COST_PER_TOKEN = (0.40 / 1_000_000) * 1.2;
const MISTRAL_OUTPUT_COST_PER_TOKEN = (2.40 / 1_000_000) * 1.2;

/**
 * Scrape recent LinkedIn activity for a lead to find a fresh hook.
 * Returns a short string summary or null if nothing useful found.
 */
async function scrapeLinkedInActivity(lead) {
  try {
    const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || '';
    const company = lead.company || lead.organization?.name || '';
    if (!name) return null;

    const query = `"${name}" "${company}" post OR interview OR announcement OR award 2025`;
    const results = await internetSearch(query);
    const snippets = (results?.organic || [])
      .slice(0, 3)
      .map(r => r.snippet)
      .filter(Boolean)
      .join(' ');

    if (!snippets || snippets.length < 30) return null;

    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract any recent activity (posts, job changes, awards, announcements) for this person from the snippets. Return 1 short fact (max 30 words) or "NOTHING USEFUL".' },
        { role: 'user', content: `Person: ${name} at ${company}\nSnippets: ${snippets}` }
      ],
      temperature: 0.2,
      max_tokens: 60
    });

    const fact = extraction.choices[0].message.content.trim();
    return fact.includes('NOTHING USEFUL') ? null : fact;
  } catch {
    return null;
  }
}

/**
 * Search for recent company news and announcements to use as a fresh hook.
 * Returns a short string summary or null if nothing useful found.
 */
async function searchCompanyContext(lead) {
  try {
    const company = lead.company || lead.organization?.name || '';
    if (!company) return null;

    const query = `${company} news announcement funding 2025`;
    const results = await internetSearch(query);
    const snippets = (results?.organic || [])
      .slice(0, 4)
      .map(r => `${r.title || ''}: ${r.snippet || ''}`)
      .filter(Boolean)
      .join(' ');

    if (!snippets || snippets.length < 30) return null;

    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract the most recent and specific company development (funding round, product launch, partnership, hire, award, expansion) from these snippets. Return 1-2 sentences max or "NOTHING USEFUL".' },
        { role: 'user', content: `Company: ${company}\nSnippets: ${snippets}` }
      ],
      temperature: 0.2,
      max_tokens: 80
    });

    const fact = extraction.choices[0].message.content.trim();
    return fact.includes('NOTHING USEFUL') ? null : fact;
  } catch {
    return null;
  }
}

/**
 * Stub for future Proxycurl LinkedIn profile scraping.
 * Will return enriched profile data once the tool is implemented.
 */
async function getProxycurlProfile(lead) {
  // TODO: implement when Proxycurl tool is created
  return null;
}

/**
 * Generate a smart follow-up email using Mistral, with context from the original email.
 * Returns { subject, body } or null on failure.
 */
async function generateSmartFollowUp(userId, agentId, email, agentSettings, stepNumber) {
  try {
    const lead = email.lead || {};
    const firstName = (lead.name || lead.first_name || 'there').split(' ')[0];
    const company = lead.company || lead.organization?.name || 'your company';
    const title = lead.title || lead.headline || '';
    const companyName = agentSettings.companyBranding?.companyName || 'our company';
    const product = agentSettings.companyBranding?.primaryService || 'our solution';

    // Gather fresh context in parallel: LinkedIn activity, company news, Proxycurl profile
    const linkedinScrape = agentSettings.emailBuilder?.rebumpLinkedinScrape !== false;
    const [freshHook, companyContext] = await Promise.all([
      linkedinScrape ? scrapeLinkedInActivity(lead) : Promise.resolve(null),
      searchCompanyContext(lead),
      getProxycurlProfile(lead),
    ]);

    const stepStrategies = {
      1: `New angle — don't repeat the original pitch. Notice something you didn't mention before, or reframe the same observation from a different direction. 2-3 sentences max.`,
      2: `Shorter and more direct. One sentence observation, one sentence ask. No pitch. If they haven't replied to two emails, they are busy, not uninterested. Make it trivially easy to say yes.`,
      3: `Closing the loop. This is the last one. One sentence max. Light, no pressure, leave the door open. Something like "closing the loop on this — genuinely happy to connect whenever timing is better."`,
    };

    const strategy = stepStrategies[stepNumber] || stepStrategies[3];

    const systemPrompt = `You are writing a follow-up cold email. The original email was not replied to. You are not a salesperson — you are someone who found something interesting and is following up briefly.

HARD RULES:
- Never use em dash (—). Never.
- Do not repeat the original email's opener, angle, or phrases.
- Do not reference the original email directly ("just following up on my last email") — that sounds like a template.
- No fabricated stats or percentages. If you don't have a real number, don't use one.
- No unnamed social proof ("teams we've worked with", "companies like yours").
- Never write placeholder text or brackets like [specific area] or [example]. If you don't have a real specific fact, skip that sentence entirely.
- No contrast pivots ("not X, just Y").
- Write in plain text. No bold, no bullets.
- Banned words: streamline, leverage, scalable, robust, cutting-edge, game-changer, revolutionize, operationally.
- If the provided context is thin, write a shorter email rather than inventing details.`;

    // Strip HTML tags and tracking pixels from body so Mistral gets clean plain text
    const rawBody = email.body || email.bodyText || '';
    const plainBody = rawBody
      .replace(/<img[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .slice(0, 800); // cap to avoid huge prompts

    const userPrompt = `ORIGINAL EMAIL SENT:
Subject: ${email.subject || '(no subject)'}
Body: ${plainBody || '(not available)'}

LEAD:
- Name: ${firstName}
- Company: ${company}
- Title: ${title}

PRODUCT BEING SOLD: ${product} by ${companyName}

${companyContext ? `RECENT COMPANY NEWS (use as hook if relevant): ${companyContext}\n` : ''}${freshHook ? `FRESH LINKEDIN ACTIVITY (use as hook if relevant): ${freshHook}\n` : ''}
FOLLOW-UP STEP: ${stepNumber}
STRATEGY FOR THIS STEP: ${strategy}

Write a follow-up email. Greeting ("Hi ${firstName},") on its own line, then one short paragraph, then "Let's find 15 minutes." or similar direct CTA.

Output exactly:
SUBJECT: [subject — can be same thread subject with "Re:" or a new one]

BODY:
Hi ${firstName},

[body]`;

    const response = await mistral.chat.completions.create({
      model: 'mistral-medium-latest',
      max_tokens: 200,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0].message.content
      .replace(/\u2014/g, ' - ')
      .replace(/\u2013/g, ' - ')
      .replace(/\*\*/g, '');

    // Parse SUBJECT and BODY
    const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

    if (!subjectMatch || !bodyMatch) {
      console.warn('[SMART REBUMP] Could not parse Mistral output. Raw response:');
      console.warn(content);
      return null;
    }

    // Charge credits based on actual token usage × 1.2x platform margin
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const mistralCost = (promptTokens * MISTRAL_INPUT_COST_PER_TOKEN) + (completionTokens * MISTRAL_OUTPUT_COST_PER_TOKEN);
    await awsManager.logApiUsage({
      userId,
      agentId,
      service: 'mistral',
      operation: 'smart_followup_generation',
      usage: response.usage?.total_tokens || 0,
      cost: mistralCost,
      metadata: {
        model: 'mistral-medium-latest',
        step: stepNumber,
        companyName: company,
        usedLinkedinHook: !!freshHook,
        usedCompanyContext: !!companyContext,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens
      }
    }).catch(err => console.error('[SMART REBUMP] Failed to log credit usage:', err.message));

    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim()
    };
  } catch (err) {
    console.error('[SMART REBUMP] Generation failed:', err.message);
    console.error('[SMART REBUMP] Stack:', err.stack);
    return null;
  }
}

/**
 * Batch update email statuses with delay to prevent DynamoDB throttling
 */
async function updateEmailStatusWithDelay(userId, agentId, emailId, status, reasoning, metadata = {}, delay = 0) {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  const maxAttempts = 5;
  const retryDelays = [1000, 2000, 3000, 4000];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await emailQueue.updateEmailStatus(userId, agentId, emailId, status, reasoning, metadata);
      return;
    } catch (error) {
      const isThrottle = error.name === 'ProvisionedThroughputExceededException';
      const isNotFound = error.message && error.message.includes('not found with status');
      if ((isThrottle || isNotFound) && attempt < maxAttempts - 1) {
        const wait = retryDelays[attempt];
        console.log(`⚠️ [REBUMP] ${isNotFound ? 'Record not visible yet' : 'DynamoDB throttled'}, retrying ${emailId} in ${wait}ms (attempt ${attempt + 1})...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      } else {
        console.error(`❌ [REBUMP] updateEmailStatus failed for ${emailId} after ${attempt + 1} attempt(s):`, error.message);
        throw error;
      }
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

    // Don't schedule follow-ups on follow-up emails — only on original outreach
    if (sentEmail.isRebump) {
      return { success: false, reason: 'is_rebump' };
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
    

    const useSmartRebump = agentSettings.emailBuilder.smartRebump === true;

    // For smart mode: generate the follow-up NOW so the preview shows real content
    let assignedTemplate = templateToUse;
    if (useSmartRebump) {
      try {
        const smart = await generateSmartFollowUp(userId, agentId, sentEmail, agentSettings, 1);
        if (smart) {
          assignedTemplate = { name: 'Smart AI follow-up', subject: smart.subject, body: smart.body };
          console.log(`✅ [REBUMP] Smart follow-up pre-generated for ${sentEmail.id}: "${smart.subject}"`);
        } else {
          console.warn(`⚠️ [REBUMP] Smart generation returned null for ${sentEmail.id}, storing template as fallback`);
        }
      } catch (smartErr) {
        console.error(`❌ [REBUMP] Smart pre-generation failed for ${sentEmail.id}:`, smartErr.message);
      }
    }

    // Mark email with calculated follow-up date and pre-generated content
    await updateEmailStatusWithDelay(userId, agentId, sentEmail.id, 'SENT', 'SENT', {
      followUpScheduled: true,
      followUpScheduledAt: new Date().toISOString(),
      followUpDate: followUpDate.toISOString(),
      assignedTemplateId: selectedTemplateId,
      assignedTemplate,
      isSmartFollowUp: useSmartRebump,
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
          
          // Skip if already has reply (check both status field and tracking-enriched replied flag)
          if (email.status === 'REPLIED' || email.replied === true) {
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

            const stepNumber = rebumpCount + 1;
            const useSmartRebump = agentSettings.emailBuilder?.smartRebump === true;

            let subject, body;
            let templateIndex = email.assignedTemplateId || 0;

            if (useSmartRebump) {
              // Always regenerate at fire time for fresh research — pre-generated content is only for UI preview
              console.log(`🤖 [REBUMP] Smart mode — generating fresh follow-up #${stepNumber} for ${email.to}`);
              const smart = await generateSmartFollowUp(userId, agentId, email, agentSettings, stepNumber);
              if (smart) {
                subject = smart.subject;
                body = smart.body;
                console.log(`✅ [REBUMP] Smart follow-up generated. Subject: "${subject}"`);
              } else {
                console.warn(`⚠️ [REBUMP] Smart generation failed, falling back to template for ${email.to}`);
              }
            }

            // Lead info — must be defined before template substitution
            const lead = email.lead || {};

            if (!subject || !body) {
              // ── TEMPLATE MODE (default or smart fallback) ─────────────────────
              let template = email.assignedTemplate;

              if (!template) {
                template = agentSettings.followUpTemplates?.templates[templateIndex];
              }

              if (!template) {
                console.log(`⚠️ [REBUMP] No templates available for agent ${agentId}`);
                continue;
              }

              const daysAgo = Math.floor(timeSinceLastContact / (24 * 60 * 60 * 1000));
              const topic = email.subject || 'our previous conversation';
              const firstName = (lead.name || lead.first_name || 'there').split(' ')[0];

              subject = template.subject
                .replace(/{name}/g, firstName)
                .replace(/{company}/g, lead.company || 'your company')
                .replace(/{topic}/g, topic)
                .replace(/{days_ago}/g, daysAgo);

              body = template.body
                .replace(/{name}/g, firstName)
                .replace(/{company}/g, lead.company || 'your company')
                .replace(/{topic}/g, topic)
                .replace(/{days_ago}/g, daysAgo);
            }
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

            // Update template rotation (only if templates exist)
            const templates = agentSettings.followUpTemplates?.templates;
            if (templates && templates.length > 0) {
              const nextIndex = (templateIndex + 1) % templates.length;
              await awsManager.saveLeadAgentSettings(userId, agentId, {
                ...agentSettings,
                followUpTemplates: {
                  ...agentSettings.followUpTemplates,
                  lastUsedIndex: nextIndex
                }
              });
            }
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
 * Fire a follow-up for a single email immediately (used by the retry endpoint).
 */
export async function fireSingleFollowUp(userId, agentId, emailId) {
  const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
  if (!agentSettings) throw new Error('No agent settings found');

  const sentEmails = await emailQueue.getSentEmails(userId, agentId);
  const email = sentEmails.find(e => e.id === emailId || e.trackingId === emailId);
  if (!email) throw new Error('Email not found');

  const rebumpCount = 0; // always fire as step 1 on retry
  const stepNumber = 1;
  const timeSinceLastContact = Date.now() - new Date(email.sentAt || email.timestamp || Date.now()).getTime();
  const useSmartRebump = agentSettings.emailBuilder?.smartRebump === true;
  const lead = email.lead || {};
  let subject, body;

  if (useSmartRebump) {
    // Use pre-generated content if available
    if (email.assignedTemplate?.name === 'Smart AI follow-up') {
      subject = email.assignedTemplate.subject;
      body = email.assignedTemplate.body;
      console.log(`✅ [REBUMP RETRY] Using pre-generated smart content for ${email.to}: "${subject}"`);
    } else {
      console.log(`🤖 [REBUMP RETRY] Smart mode — generating now for ${email.to}`);
      const smart = await generateSmartFollowUp(userId, agentId, email, agentSettings, stepNumber);
      if (smart) { subject = smart.subject; body = smart.body; }
      else throw new Error('Smart follow-up generation failed — Mistral returned null or could not be parsed. Check server logs for the raw response.');
    }
  }

  if (!subject || !body) {
    const templates = agentSettings.followUpTemplates?.templates;
    const template = templates?.[email.assignedTemplateId || 0] || templates?.[0];
    if (!template) throw new Error('No templates available');
    const daysAgo = Math.floor(timeSinceLastContact / (24 * 60 * 60 * 1000));
    const topic = email.subject || 'our previous conversation';
    const firstName = (lead.name || lead.first_name || 'there').split(' ')[0];
    subject = template.subject.replace(/{name}/g, firstName).replace(/{company}/g, lead.company || 'your company').replace(/{topic}/g, topic).replace(/{days_ago}/g, daysAgo);
    body = template.body.replace(/{name}/g, firstName).replace(/{company}/g, lead.company || 'your company').replace(/{topic}/g, topic).replace(/{days_ago}/g, daysAgo);
  }

  const replyOptions = {
    inReplyTo: email.trackingId ? `<${email.trackingId}@gmail.com>` : null,
    references: email.trackingId ? `<${email.trackingId}@gmail.com>` : null,
    threadId: email.gmailThreadId || null
  };

  const sendResult = await leadEmail(email.to, subject, body, lead, userId, agentId, null, null, null, replyOptions);
  if (!sendResult.success) throw new Error(sendResult.error || 'Send failed');

  const maxRebumps = agentSettings.emailBuilder?.maxRebumps || 1;
  const rebumpIntervalMs = (agentSettings.emailBuilder?.rebumpIntervalDays || 7) * 24 * 60 * 60 * 1000;
  const updates = { rebumpCount: 1, lastRebumpAt: new Date().toISOString(), lastFollowUpSentAt: new Date().toISOString(), followUpStatus: 'SENT' };
  if (1 < maxRebumps) updates.followUpDate = new Date(Date.now() + rebumpIntervalMs).toISOString();
  await emailQueue.updateEmailStatus(userId, agentId, emailId, 'SENT', 'SENT', updates);

  return { success: true, to: email.to };
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
