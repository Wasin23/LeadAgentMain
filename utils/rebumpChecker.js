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
 * Extract 3-5 disambiguation keywords for a company from all available research
 * (Apollo org data, AI report, email body) so Serper doesn't return the wrong company.
 * Returns a keyword string like "tokenization newsletter blockchain" or null.
 */
async function extractCompanyDisambiguation(lead, email) {
  const sources = [];

  const org = lead.organization || {};
  if (org.description) sources.push(org.description);
  if (org.short_description) sources.push(org.short_description);
  if (org.industry) sources.push(`Industry: ${org.industry}`);
  if (Array.isArray(org.keywords) && org.keywords.length) sources.push(org.keywords.slice(0, 5).join(', '));
  if (org.website_url) sources.push(`Website: ${org.website_url}`);

  if (email) {
    if (email.aiReport) sources.push(email.aiReport);
    if (email.researchSummary) sources.push(email.researchSummary);
    if (email.personalizedContext) sources.push(email.personalizedContext);
    if (email.leadQualification) {
      const q = email.leadQualification;
      sources.push(typeof q === 'string' ? q : JSON.stringify(q));
    }
    const body = email.body || email.bodyText || '';
    if (body.length > 20) sources.push(`Email about them: ${body.slice(0, 300)}`);
  }

  if (!sources.length) return null;

  try {
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract 3-5 specific keywords that uniquely identify what this company does. Return only space-separated lowercase keywords (e.g. "tokenization newsletter blockchain" or "homebuilder construction residential"). No explanation, no punctuation.' },
        { role: 'user', content: `Company: ${lead.company || lead.organization?.name || ''}\n\n${sources.join('\n').slice(0, 600)}` }
      ],
      temperature: 0.1,
      max_tokens: 30
    });
    const keywords = extraction.choices[0].message.content.trim();
    return keywords.length > 3 ? keywords : null;
  } catch {
    return null;
  }
}

/**
 * Scrape recent LinkedIn activity for a lead to find a fresh hook.
 * Returns a short string summary or null if nothing useful found.
 */
async function scrapeLinkedInActivity(lead, email) {
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
 * Reads existing research first to build a disambiguated query.
 * Returns a short string summary or null if nothing useful found.
 */
async function searchCompanyContext(lead, email) {
  try {
    const company = lead.company || lead.organization?.name || '';
    if (!company) return null;

    // Read existing research to avoid returning results for the wrong company
    const disambig = await extractCompanyDisambiguation(lead, email);
    const query = disambig
      ? `"${company}" ${disambig} news 2025`
      : `${company} news announcement funding 2025`;

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
        { role: 'system', content: 'Extract a raw factual observation about this company from the snippets — something a person could reference naturally in a follow-up email. Accept anything: a funding round, product launch, article they published, market insight they shared, LinkedIn post, or any company activity. Return 1 plain sentence, no editorial commentary ("this is interesting", "great conversation starter", etc.). Only return "NOTHING USEFUL" if the snippets contain zero information about this specific company.' },
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

    // Gather fresh context in parallel: person activity, company news, Proxycurl profile
    const [freshHook, companyContext] = await Promise.all([
      scrapeLinkedInActivity(lead, email),
      searchCompanyContext(lead, email),
      getProxycurlProfile(lead),
    ]);

    const stepStrategies = {
      1: `Reference something specific from the ORIGINAL EMAIL SENT (a fact, stat, or observation you already mentioned) and ask a genuine question about it — don't introduce a new pitch or new product angle. If fresh research is available, use that fact as a brief hook instead. 2 sentences max. No jargon. No made-up stats.`,
      2: `Two sentences max. Be direct — reference one specific thing from the original email or fresh research and ask a simple, genuine question. No meta-commentary about the email ("I know you're busy", "just reply yes or no", "circling back"). Sound like a real person checking in, not a sales sequence.`,
      3: `One sentence. Close the loop warmly. No pitch. Something like "closing the loop — happy to connect whenever the timing is better." Nothing else.`,
    };

    const strategy = stepStrategies[stepNumber] || stepStrategies[3];

    const systemPrompt = `You are writing a follow-up cold email. The original email was not replied to. You are a real person following up briefly — not a salesperson, not an AI.

HARD RULES:
- Never use em dash (—). Never.
- Do not repeat the original email's opener, angle, or phrases verbatim.
- Do not say "just following up", "circling back", "touching base", or any template phrase.
- No fabricated stats or percentages. Zero. If you don't have a verified number, do not write one.
- No unnamed social proof. No "companies like yours", "teams we work with", "clients in your space".
- No new product pitch or new feature angle. Follow-ups are not second chances to pitch — they are human nudges.
- No jargon: no "Trusted Execution Environments", "GPU clusters", "AI workloads", "infrastructure at scale" unless the original email used that exact phrase.
- Never write placeholder text or brackets. If you lack a specific fact, write fewer sentences.
- No contrast pivots ("not X, just Y").
- Plain text only. No bold, no bullets.
- Vary the CTA — do not use "Let's find 15 minutes" every time. Use natural alternatives: "Worth a quick call?", "Open to a chat?", "Happy to jump on a call if useful."
- Banned words: streamline, leverage, scalable, robust, cutting-edge, game-changer, revolutionize, operationally, innovative, solution, synergy.
- When context (company news, LinkedIn activity) is thin, write 1-2 sentences and stop. Do not pad.`;

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
      max_tokens: 150,
      temperature: 0.85,
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

    // Follow-ups are not charged against the user's credit balance — logged at cost:0
    // for internal cost visibility only (see docs/accounting.md).
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    await awsManager.logApiUsage({
      userId,
      agentId,
      service: 'mistral',
      operation: 'smart_followup_generation',
      usage: response.usage?.total_tokens || 0,
      cost: 0,
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

    const { generateUnsubscribeToken } = await import('../routes/unsubscribe.js');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const leadEmail = lead.email || email.to || '';
    const unsubscribeUrl = `${frontendUrl}/unsubscribe?token=${generateUnsubscribeToken(leadEmail)}&uid=${userId}`;
    const companyWebsite = agentSettings.companyBranding?.companyWebsite || '';
    const footerParts = [agentSettings.companyBranding?.companyName || companyName];
    if (companyWebsite) {
      const displayHost = companyWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '');
      footerParts.push(`<a href="${companyWebsite}" style="color:#6b7280;text-decoration:none;">${displayHost}</a>`);
    }
    const footer = `\n\n${footerParts.join(' | ')}\n<a href="${unsubscribeUrl}">Stop emails</a>`;

    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim() + footer
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

          // Skip if recipient has unsubscribed
          if (email.unsubscribed || await awsManager.isUnsubscribed(email.to).catch(() => false)) {
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
