import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import OpenAI from 'openai';

const awsManager = new AWSManager();
const emailQueue = new AWSEmailQueue();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

Generate 3 SHORT follow-up email templates (2-3 sentences max each) for leads who didn't respond to the initial outreach.

Each template should:
- Be brief and non-pushy
- Match the agent's personality/tone
- Use variables: {name}, {company}, {topic}, {days_ago}
- Have a different angle (gentle nudge, value reminder, time-sensitive)
- End with a simple question or call-to-action

Return ONLY valid JSON with this structure:
{
  "templates": [
    {
      "name": "Gentle Nudge",
      "subject": "Quick follow-up for {company}",
      "body": "Template text here with {variables}"
    },
    {
      "name": "Value Reminder", 
      "subject": "Still relevant for {company}?",
      "body": "Template text here with {variables}"
    },
    {
      "name": "Time Sensitive",
      "subject": "Last call, {name}",
      "body": "Template text here with {variables}"
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
          // Skip if already has reply
          if (email.status === 'REPLIED') continue;
          
          // Skip if already rebumped (check rebumpCount)
          const rebumpCount = email.rebumpCount || 0;
          const maxRebumps = agentSettings.emailBuilder.maxRebumps || 1;
          if (rebumpCount >= maxRebumps) continue;

          // Check if enough time has passed since last outreach
          const sentAt = new Date(email.sentAt || email.timestamp).getTime();
          const lastRebumpAt = email.lastRebumpAt ? new Date(email.lastRebumpAt).getTime() : sentAt;
          const timeSinceLastContact = now - lastRebumpAt;

          if (timeSinceLastContact >= rebumpIntervalMs) {
            console.log(`📧 [REBUMP] Queueing rebump for ${email.lead?.email || 'unknown'}`);
            
            // Get template (rotate through available templates)
            const templateIndex = agentSettings.followUpTemplates?.lastUsedIndex || 0;
            const template = agentSettings.followUpTemplates?.templates[templateIndex];
            
            if (!template) {
              console.log(`⚠️ [REBUMP] No templates available for agent ${agentId}`);
              continue;
            }

            // Fill in template variables
            const lead = email.lead || {};
            const daysAgo = Math.floor(timeSinceLastContact / (24 * 60 * 60 * 1000));
            const topic = email.subject || 'our previous conversation';

            const subject = template.subject
              .replace(/{name}/g, lead.name || 'there')
              .replace(/{company}/g, lead.company || 'your company')
              .replace(/{topic}/g, topic)
              .replace(/{days_ago}/g, daysAgo);

            const body = template.body
              .replace(/{name}/g, lead.name || 'there')
              .replace(/{company}/g, lead.company || 'your company')
              .replace(/{topic}/g, topic)
              .replace(/{days_ago}/g, daysAgo);

            // Queue the rebump email
            await emailQueue.queueEmail(userId, agentId, {
              to: email.to,
              subject: subject,
              body: body,
              html: body.replace(/\n/g, '<br>'),
              lead: lead,
              trackingId: email.trackingId, // Same thread
              isRebump: true,
              rebumpNumber: rebumpCount + 1,
              originalEmailId: email.id,
              templateUsed: template.name,
              aiReport: email.aiReport, // Keep original report
              confidenceLevel: 'medium',
              timestamp: new Date().toISOString()
            });

            // Update original email with rebump info
            await emailQueue.updateEmailStatus(userId, agentId, email.id, 'SENT', 'SENT', {
              rebumpCount: rebumpCount + 1,
              lastRebumpAt: new Date().toISOString()
            });

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

    console.log(`✅ [REBUMP] Queued ${totalRebumpsQueued} follow-up emails`);
  } catch (error) {
    console.error('❌ [REBUMP] Error checking rebumps:', error);
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
