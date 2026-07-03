/*
 * 🧠 REASONING LEAD AGENT
 * 
 * A TRUE AI agent that can:
 * - Think about problems and adapt strategies
 * - Learn from successes and failures  
 * - Make intelligent decisions about search parameters
 * - Reason about why searches fail and adjust accordingly
 * 
 * This is NOT hardcoded logic - it's an LLM-powered reasoning agent
 * that can dynamically solve lead research problems.
 */

import 'dotenv/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { getUserSettings } from '../lib/userManager.js';
import AWSManager from '../utils/awsManager.js';
import { EmailQueue } from '../lib/emailQueue.js';
import { internetSearch } from '../tools/internetSearch.js';
import { companyIntelligence } from '../tools/companyIntelligence.js';
import { deepResearch } from '../tools/deepResearch.js';
import { ZillizLeadMemory } from '../utils/zillizLeadMemory.js';
import { industryFacts, ZillizIndustryFacts } from '../utils/zillizIndustryFacts.js';
import { LeadSourceBandit } from '../utils/leadSourceBandit.js';
import { getAvailableSources, getSourceById } from '../utils/leadSourceRegistry.js';
import MergeManager from '../utils/mergeManager.js';
import fs from 'fs/promises';
import path from 'path';

// ======================
// MONITORING INTEGRATION
// ======================
let monitoringStore = null;

async function getMonitoringStore() {
  if (!monitoringStore) {
    try {
      const monitoringModule = await import('../routes/monitoring.js');
      monitoringStore = monitoringModule.metricStore;
    } catch (error) {
    }
  }
  return monitoringStore;
}

// Initialize monitoring on module load
getMonitoringStore();

class ReasoningLeadAgent extends EventEmitter {
  constructor(userId, agentId = 'reasoning-lead-agent') {
    super(); // Call EventEmitter constructor
    this.userId = userId;
    this.agentId = agentId; // Use provided agentId for agent-specific behavior
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.mistral = new OpenAI({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: 'https://api.mistral.ai/v1'
    });
    this.emailGenerationInFlight = 0;
    this.emailGenerationWaiters = [];
    this.emailGenerationConcurrency = 1;
    
    // Initialize user-specific file paths and agent-specific email queue
    const userCode = this.userId ? this.userId.substring(0, 8) : 'default';
    this.leadsFile = path.join(process.cwd(), 'agent', `reasoning_leads_${userCode}.json`);
    this.emailQueue = new EmailQueue(userId, this.agentId);
    
    // AWS manager for settings and data storage
    this.awsManager = new AWSManager();
    
    // CRM manager for syncing leads
    this.mergeManager = new MergeManager();
    
    // Zilliz lead memory for persistent learning
    this.leadMemory = new ZillizLeadMemory();
    this.memoryInitialized = false;

    /**
     * THOMPSON SAMPLING BANDIT
     * ------------------------
     * Decides which lead source (Apollo, Proxycurl, etc.) to use for each
     * keyword. Learns from results over time — sources that return clean,
     * non-duplicate leads are preferred, but alternatives are still explored.
     * See utils/leadSourceBandit.js for the full algorithm explanation.
     */
    this.bandit = new LeadSourceBandit(userId, this.awsManager);
    this.banditInitialized = false;
    
    // Report agent initialization to monitoring
    this.emitAgentStatus('initialized');
    
    // Agent state for UI integration
    this.isRunning = false;
    this.cycleCount = 0;
    this.startTime = null;
    this.nextRunTime = null; // Track when next cycle is scheduled
    
    // ID counter for unique progress events
    this.progressIdCounter = 0;
    this.customInterval = null;
    this.cycleTimer = null;
    this.crmContactList = null; // CRM mode: contacts to process instead of Apollo search
    this.auditorStateUpdateChain = Promise.resolve();
    
    // Load saved settings from DynamoDB
    this.loadSavedSettings();
    
    // Agent memory - learns from experience
    this.memory = {
      searchHistory: [],
      successfulStrategies: [],
      failedStrategies: [],
      industryInsights: {},
      industryStatsCache: {}, // Cache industry statistics: { "blockchain": { data: "...", timestamp: Date.now() }, ... }
      currentGoal: null,
      currentIndustryIndex: 0, // Track which industry to search next
      currentKeywordIndex: 0, // Track which keyword within industry (for & splits)
      consecutiveDuplicateSearches: 0, // Track consecutive failed searches
      consecutiveDisqualifications: 0, // Track consecutive SKIP/DISQ leads — triggers keyword rotation at 3
      searchPageOffset: 0, // Increase page numbers when exhausting early pages
      industryExhaustion: {}, // Track leads found per industry: { "Hotels & Resorts": { leadsFound: 45, lastSearched: timestamp }, ... }
      sourceExhaustion: {}, // Per-source duplicate rates: { apollo: { "saas": { cumulativeDuplicateRate, totalAttempts } }, hunter: {...} }
      totalLeadsFoundThisCycle: 0,
      aiGeneratedKeywords: [], // AI-generated related industry keywords
      aiGeneratedPositions: [], // AI-generated positions paired with keywords
      aiKeywordCycleCount: 0, // Track how many AI keywords used (reset after 5)
      baseIndustryKeywords: [], // Flattened list of all keywords from user's industries
      campaignPriorityKeyword: null, // Campaign-specified industry to search first
      exhaustedCampaignKeywords: new Set(), // Keywords permanently rotated past due to high dup rate
      leadsFoundWithCurrentKeyword: 0, // Track leads found with current keyword (rotate every 20)
      lastKeywordUsed: null, // Track the last keyword used to detect changes
      originalTargetPositions: null, // Store the original positions from instructions/settings
      cycleOffset: 0, // Offset for position pairing - increases each full cycle for variety
      searchHistoryDB: new Map(), // Cache of searched industry+position combos from DB
      lastSearchKey: null, // Track last search combo to detect changes for SSE updates

      /**
       * LEAD SOURCE BANDIT STATE
       * ------------------------
       * These fields track the active source per keyword and the depth counter
       * used to trigger forced source switches.
       *
       * keywordSourceAssignments:
       *   Maps each keyword to the sourceId currently assigned to it.
       *   e.g. { "saas": "apollo", "fintech": "proxycurl" }
       *   The bandit selects the source on first search, then this assignment
       *   is used for subsequent searches on the same keyword until a switch
       *   trigger fires (depth or dup-rate).
       *   Survives agent restarts — reloaded from bandit DB on startup.
       *
       * sourcePageDepthCount:
       *   Tracks how many times the page offset was incremented for a
       *   specific source × keyword pair.
       *   Key format: "sourceId#keyword" e.g. "apollo#saas"
       *   When this hits 3, we force a source switch instead of going deeper.
       *
       * sourceSwitchLog:
       *   Audit trail of every source switch, with reason.
       *   Useful for debugging, admin views, and future analytics.
       */
      keywordSourceAssignments: {},
      sourcePageDepthCount: {},
      sourceSwitchLog: [],
      
      // Current cycle lead tracking with queue system
      currentCycle: {
        leadsProcessed: 0,
        targetLeads: 0,
        currentLead: null,
        leadQueue: [], // Queue of leads from Apollo search
        processingPhase: 'search' // 'search' | 'research' | 'email' | 'complete'
      }
    };    // Operation logs for UI activity tracking
    this.operationLogs = [];
    this.maxLogs = 100; // Keep last 100 operations
    
    // Available tools the agent can reason about and use
    this.tools = [
      {
        name: 'get_user_settings',
        description: 'Get user lead generation settings from AWS DynamoDB (company size, industries, target positions, etc.)',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_email_settings', 
        description: 'Get user email builder settings from AWS DynamoDB (templates, tone, personalization rules)',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'lead_search',
        description: 'Search for leads using the configured lead source (Apollo or other registered sources). You must intelligently determine what to search for based on: 1) User\'s configured target positions, industries, company size, and locations (baseline criteria), 2) Special instructions/campaign plan (what specific prospects to find). IMPORTANT: You can INTELLIGENTLY SELECT which configured industry best fits the campaign goal - if "Hotels & Resorts" aligns with "independent hospitality", use it. If campaign requires a different configured industry, select the most relevant one. NEVER use industries not in user settings. Always validate industry choice matches campaign intent.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Additional search keywords from campaign plan to narrow results WITHIN the configured industries/positions' },
            companySize: { type: 'string', description: 'Employee range like "100,1000" - only override user settings if campaign explicitly requires different size' },
            location: { type: 'string', description: 'Geographic location - only override if campaign explicitly requires different location' },
            industries: { type: 'array', items: { type: 'string' }, description: 'SELECT the configured industry that BEST FITS the campaign goal. Must be from user\'s configured list. Validate it matches campaign intent (e.g., "Hotels & Resorts" fits "independent hospitality"). ONLY use industries from user settings.' },
            position: { type: 'string', description: 'SELECT the configured position that BEST FITS the campaign goal. Must be from user\'s configured list. ONLY use positions from user settings.' },
            reasoning: { type: 'string', description: 'Brief explanation of why you chose this industry/position for the campaign (e.g., "Hotels & Resorts aligns with independent hospitality goal")' }
          }
        }
      },
      {
        name: 'serper_research',
        description: 'Research a lead/company. Leave searchQuery EMPTY to trigger automatic 4-phase deep research. Only provide searchQuery for specific ad-hoc queries.',
        parameters: {
          type: 'object',
          properties: {
            companyName: { type: 'string', description: 'Company name to research' },
            personName: { type: 'string', description: 'Person name if researching individual' },
            searchQuery: { type: 'string', description: 'LEAVE EMPTY for deep research. Only use for specific verification.' }
          }
        }
      },
      {
        name: 'unlock_email',
        description: 'Unlock email address for a lead using Apollo credits. IMPORTANT: Always include domain when available for better accuracy.',
        parameters: {
          type: 'object',
          properties: {
            apolloId: { type: 'string', description: 'Apollo person ID from a prior search — skips re-search and enriches directly (1 credit instead of 2)' },
            firstName: { type: 'string', description: 'Lead first name' },
            lastName: { type: 'string', description: 'Lead last name' },
            companyName: { type: 'string', description: 'Lead company name' },
            domain: { type: 'string', description: 'Company domain (e.g., example.com) - CRITICAL for accurate matching when company name is generic' }
          }
        }
      },
      {
        name: 'build_personalized_email',
        description: 'Create personalized email using research data and email builder settings from current cycle memory.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'pre_qualify_lead',
        description: 'Quick qualification check before expensive research. Evaluates if lead is worth researching based on basic information.',
        parameters: {
          type: 'object',
          properties: {
            companyName: { type: 'string', description: 'Company name' },
            personName: { type: 'string', description: 'Person name and title' },
            companyDescription: { type: 'string', description: 'Brief company description or industry' }
          }
        }
      },
      {
        name: 'qualify_lead',
        description: 'Detailed qualification after research. Scores lead against campaign criteria and decides if they should receive email. Uses lead and research data from current cycle memory.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];

    
    // Campaign plan from instructions (populated at cycle start)
    this.campaignPlan = null;
    
    // Add initial log entry
    this.logOperation('🤖 Agent Ready', `Ready to find and contact leads`, 'completed', {
      userId,
      timestamp: new Date().toISOString()
    });
  }

  async withEmailGenerationSlot(task) {
    while (this.emailGenerationInFlight >= this.emailGenerationConcurrency) {
      await new Promise(resolve => this.emailGenerationWaiters.push(resolve));
    }

    this.emailGenerationInFlight++;
    try {
      return await task();
    } finally {
      this.emailGenerationInFlight = Math.max(0, this.emailGenerationInFlight - 1);
      const next = this.emailGenerationWaiters.shift();
      if (next) next();
    }
  }

  async waitForRetryAfter(headers, fallbackMs = 15000) {
    const retryAfterRaw = headers?.get?.('retry-after') ?? headers?.['retry-after'] ?? null;
    const retryAfterSeconds = Number.parseInt(retryAfterRaw, 10);
    const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : fallbackMs;

    console.warn(`⏳ [EMAIL BUILDER] Waiting ${Math.ceil(waitMs / 1000)}s before retrying email generation`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  truncateForPrompt(value, maxLength = 500) {
    if (!value) return '';
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  estimateTokenCount(value) {
    if (!value) return 0;
    const chars = String(value).length;
    return Math.ceil(chars / 4);
  }

  logEmailPromptMetrics({ companyName, contactName, systemPrompt, userPrompt }) {
    const systemChars = systemPrompt?.length || 0;
    const userChars = userPrompt?.length || 0;
    const totalChars = systemChars + userChars;
    const systemTokens = this.estimateTokenCount(systemPrompt);
    const userTokens = this.estimateTokenCount(userPrompt);
    const totalTokens = systemTokens + userTokens;

    console.log(
      `📏 [EMAIL PROMPT SIZE] ${contactName} @ ${companyName} | ` +
      `chars(system=${systemChars}, user=${userChars}, total=${totalChars}) | ` +
      `estTokens(system=${systemTokens}, user=${userTokens}, total=${totalTokens})`
    );

    return {
      systemChars,
      userChars,
      totalChars,
      systemTokens,
      userTokens,
      totalTokens
    };
  }

  scoreEmailFact(text = '', companyName = '') {
    const lower = text.toLowerCase();
    const company = companyName.toLowerCase();
    let score = 0;

    if (company && lower.includes(company)) score += 8;
    if (lower.startsWith('[linkedin]')) score += 7;
    if (/\b(raised|funding|hiring|launch|launched|expanding|expansion|opened|acquired|announced|rolled out|partnership|posted|migration|modernization|initiative)\b/i.test(text)) score += 6;
    if (/\b(january|february|march|april|may|june|july|august|september|october|november|december|q1|q2|q3|q4|2025|2026|2027)\b/i.test(text)) score += 4;
    if (/[$%\d]/.test(text)) score += 3;
    if (text.length > 40 && text.length < 220) score += 2;

    return score;
  }

  selectTopEmailFacts(aiReport, companyName, maxFacts = 3) {
    const hookFacts = (aiReport?.emailHooks || [])
      .filter(Boolean)
      .map(text => ({ text, source: 'hook' }));

    const citedFacts = (aiReport?.allCitedFacts || [])
      .filter(fact => fact?.text)
      .map(fact => ({ text: fact.text, source: fact.sourceTitle || fact.source || 'research' }));

    const seen = new Set();
    const ranked = [...hookFacts, ...citedFacts]
      .map(fact => {
        const cleaned = this.truncateForPrompt(String(fact.text).replace(/^\[LinkedIn\]\s*/i, ''), 180);
        return {
          text: cleaned,
          score: this.scoreEmailFact(cleaned, companyName) + (fact.source === 'hook' ? 5 : 0)
        };
      })
      .filter(fact => {
        if (!fact.text) return false;
        const key = fact.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score);

    return ranked.slice(0, maxFacts).map(fact => fact.text);
  }

  summarizeResearchForEmail(researchData, companyName, maxItems = 3) {
    if (!researchData?.searches?.length) return [];

    const items = [];
    for (const search of researchData.searches) {
      const organic = search?.results?.organic || [];
      const webpageInsights = search?.webpageInsights || [];

      for (const result of organic.slice(0, 2)) {
        if (result?.snippet) items.push(result.snippet);
      }
      for (const insight of webpageInsights.slice(0, 2)) {
        if (insight?.insights && !insight.insights.includes('NO RELEVANT DATA')) items.push(insight.insights);
      }
    }

    const seen = new Set();
    return items
      .map(text => this.truncateForPrompt(text, 180))
      .filter(text => {
        if (!text) return false;
        const key = text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => this.scoreEmailFact(b, companyName) - this.scoreEmailFact(a, companyName))
      .slice(0, maxItems);
  }

  summarizeCompanyProofPoints(raw, maxItems = 2) {
    if (!raw) return [];

    const candidates = String(raw)
      .split(/\n+/)
      .flatMap(line => line.split(/(?<=[.!?])\s+/))
      .map(line => this.truncateForPrompt(line, 160))
      .filter(Boolean);

    const seen = new Set();
    return candidates
      .filter(text => {
        const key = text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return /[$%\d]|\b(reduce|improve|increase|save|faster|automation|pipeline|conversion|reply|deliverability)\b/i.test(text);
      })
      .sort((a, b) => this.scoreEmailFact(b) - this.scoreEmailFact(a))
      .slice(0, maxItems);
  }

  // === CAMPAIGN PLAN CONVERSION ===
  
  /**
   * Generate a concise human-readable description of the campaign plan
   */
  async generatePlanDescription(plan, originalInstructions) {
    try {
      const prompt = `Summarize this campaign targeting plan in ONE concise sentence (max 15 words).

ORIGINAL GOAL: ${originalInstructions}

PLAN:
- Search Keywords: ${plan.searchStrategy?.additionalKeywords?.join(', ') || 'None'}
- Target Industries: ${plan.searchStrategy?.priorityIndustries?.join(', ') || 'None'}
- Must-Have Criteria: ${plan.qualificationCriteria?.mustHave?.join(', ') || 'None'}

Write a brief, clear description of WHO we're targeting and WHY. Be specific and concise.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50
      });

      const description = response.choices[0].message.content.trim();
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'plan_description',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o-mini',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }
      
      return description;
      
    } catch (error) {
      console.error('❌ [PLAN DESCRIPTION] Failed to generate description:', error);
      // Fallback to basic summary
      const keywords = plan.searchStrategy?.additionalKeywords?.slice(0, 3).join(', ') || 'custom criteria';
      return `Targeting prospects matching: ${keywords}`;
    }
  }
  
  /**
   * Convert special instructions into a structured campaign plan using GPT-4
   * This is the "brain" that interprets user goals and converts them into actionable strategies
   */
  async convertInstructionsToPlan(specialInstructions, userSettings) {
    console.log('🎯 [CAMPAIGN PLAN] Converting instructions to structured plan...');
    
    // If no instructions provided, return null (use default behavior)
    if (!specialInstructions || specialInstructions.trim() === '') {
      console.log('📋 [CAMPAIGN PLAN] No special instructions provided, using default behavior');
      console.log('⚠️ [CAMPAIGN PLAN] WARNING: Without special instructions, agent will skip research/pre-qualify/qualify phases!');
      return null;
    }
    
    console.log('📋 [CAMPAIGN PLAN] Special instructions received:', specialInstructions.substring(0, 100) + '...');
    
    try {
      const prompt = `You are an AI campaign strategist. Convert these campaign instructions into a structured plan for lead generation and outreach.

CAMPAIGN INSTRUCTIONS (USER'S SEARCH GOAL):
${specialInstructions}

YOUR COMPANY CONTEXT (the sender of emails - DO NOT use as search criteria):
- Your Company: ${userSettings.companyName || 'Not specified'}
- Your Service: ${userSettings.primaryService || 'Not specified'}
- Core Offering: ${userSettings.coreOffering || 'Not specified'}
- Key Advantages: ${Array.isArray(userSettings.keyAdvantages) ? userSettings.keyAdvantages.join(', ') : userSettings.keyAdvantages || 'Not specified'}

BASELINE TARGETING SETTINGS (use as minimum requirements, can be expanded based on instructions):
- Target Industries: ${userSettings.companyIndustries?.join(', ') || 'Not specified'}
- Target Positions: ${userSettings.targetPositions?.join(', ') || 'Not specified'}
- Company Size: ${userSettings.companySizeMin || 'Any'} - ${userSettings.companySizeMax || 'Any'} employees

CRITICAL INSTRUCTIONS:
1. The "Campaign Instructions" are what to SEARCH FOR (target prospects)
2. The "Your Company Context" describes who is SENDING the emails (never use as search criteria)
3. Use baseline targeting settings as hard guidelines (don't change industry/position/size unless instructions explicitly say so)
4. Extract search criteria FROM THE CAMPAIGN INSTRUCTIONS ONLY
5. ALWAYS exclude educational institutions (schools, universities, institutes) unless explicitly targeting them
6. Use SPECIFIC industry terms (not broad categories)

Convert the campaign instructions into a JSON plan with these fields:

{
  "searchStrategy": {
    "additionalKeywords": ["keyword1", "keyword2"],
    "priorityIndustries": ["industry1", "industry2"],
    "excludeKeywords": ["Institute", "University", "College", "School", "Education", "keyword1"]
  },
  "qualificationCriteria": {
    "mustHave": ["requirement1", "requirement2"],
    "niceToHave": ["bonus1", "bonus2"],
    "disqualifiers": ["Educational institution", "Non-profit organization", "Government agency", "dealbreaker1"]
  },
  "researchFocus": {
    "keyQuestions": ["question1", "question2"],
    "signalsToLookFor": ["signal1", "signal2"],
    "verificationNeeds": ["verify1", "verify2"]
  },
  "emailMessaging": {
    "primaryValue": "main value proposition FROM YOUR COMPANY to the prospect",
    "keyPoints": ["point1", "point2", "point3"],
    "callToAction": "what to ask for",
    "tone": "professional/casual/technical"
  }
}

IMPORTANT RULES:
- searchStrategy: Extract keywords FROM the campaign instructions about what prospects to find
- qualificationCriteria: Based on campaign instructions, what makes a prospect qualified
- emailMessaging: Use YOUR COMPANY CONTEXT to craft value props (not prospect's business)
- Return ONLY valid JSON, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      const rawContent = response.choices[0].message.content.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const plan = JSON.parse(rawContent);
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'campaign_plan_conversion',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o-mini',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }
      
      console.log('🎯 [CAMPAIGN PLAN SUMMARY] Loaded:', {
        keywords: plan.searchStrategy?.additionalKeywords?.length || 0,
        industries: plan.searchStrategy?.priorityIndustries?.length || 0,
        mustHave: plan.qualificationCriteria?.mustHave?.length || 0
      });
      
      // Generate AI description of the plan
      const planDescription = await this.generatePlanDescription(plan, specialInstructions);
      
      this.logOperation('🎯 Campaign Strategy', planDescription || 'Custom targeting campaign', 'completed', {
        hasSearchStrategy: !!plan.searchStrategy,
        hasCriteria: !!plan.qualificationCriteria,
        hasEmailStrategy: !!plan.emailMessaging
      });
      
      return plan;
      
    } catch (error) {
      console.error('❌ [CAMPAIGN PLAN] Failed to convert instructions:', error);
      this.logIssue('warning', 'Failed to convert campaign instructions to plan', {
        error: error.message,
        instructions: specialInstructions.substring(0, 100)
      });
      return null; // Fall back to default behavior
    }
  }

  // === MONITORING INTEGRATION METHODS ===
  
  /**
   * Emit agent status change to monitoring system
   */
  emitAgentStatus(status, metrics = {}) {
    if (monitoringStore) {
      try {
        monitoringStore.updateAgentStatus(
          this.agentId,
          'ReasoningLeadAgent',
          status,
          {
            userId: this.userId,
            cycleCount: this.cycleCount,
            isRunning: this.isRunning,
            ...metrics
          }
        );
      } catch (error) {
        console.error('📊 [MONITORING] Failed to emit agent status:', error.message);
      }
    }
  }

  /**
   * Emit metric event to monitoring system
   */
  emitMetric(category, key, value, operation = 'increment') {
    if (monitoringStore) {
      try {
        if (operation === 'increment') {
          monitoringStore.incrementMetric(category, key, value || 1);
        } else {
          monitoringStore.updateMetric(category, key, value);
        }
      } catch (error) {
        console.error('📊 [MONITORING] Failed to emit metric:', error.message);
      }
    }
  }

  /**
   * Log issue to monitoring system
   */
  async logIssue(severity, message, details = {}) {
    if (monitoringStore) {
      try {
        monitoringStore.addIssue(severity, message, this.agentId, {
          userId: this.userId,
          ...details
        });
      } catch (error) {
        console.error('📊 [MONITORING] Failed to log issue:', error.message);
      }
    }

    // Also save to DynamoDB issues database
    try {
      const AWSManager = (await import('../utils/awsManager.js')).default;
      const awsManager = new AWSManager();
      await awsManager.addIssue(
        this.userId,
        severity === 'critical' ? 'error' : severity, // Map critical to error for DynamoDB
        message,
        details.reason || details.error || message,
        {
          agentId: this.agentId,
          ...details
        }
      );
    } catch (issueError) {
      console.error('❌ [ISSUES] Failed to log issue to database:', issueError);
    }
  }

  /**
   * Update integration status
   */
  updateIntegrationStatus(service, data) {
    if (monitoringStore) {
      try {
        monitoringStore.updateIntegration(service, data);
      } catch (error) {
        console.error('📊 [MONITORING] Failed to update integration:', error.message);
      }
    }
  }

  // === OPERATION LOGGING METHODS ===
  logOperation(operation, details, status = 'completed', data = {}) {
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      operation,
      details,
      status,
      data
    };
    
    this.operationLogs.unshift(logEntry);
    
    // Keep only the last maxLogs entries
    if (this.operationLogs.length > this.maxLogs) {
      this.operationLogs = this.operationLogs.slice(0, this.maxLogs);
    }
    

    
    // Emit progress event for real-time updates
    this.emit('progress', {
      id: logEntry.id,
      timestamp: logEntry.timestamp,
      operation: operation,
      details: details,
      status: status,
      data: data
    });

    // Broadcast specific operations via SSE for Director dashboard cards
    const broadcastableOperations = [
      'Lead Search',
      'Lead Processing',
      'Email Processing',
      'Lead Complete',
      '✅ Lead Complete',
      'Lead Qualification',
      '💭 Agent Activity',
      '✅ Process Complete',
      '🔗 CRM Sync'
    ];

    if (broadcastableOperations.includes(operation)) {
      this.broadcastAgentActivity({
        agentId: this.agentId,
        operation,
        details,
        status,
        data,
        timestamp: logEntry.timestamp
      }).catch(err => {
        console.error('⚠️ [SSE] Failed to broadcast agent activity:', err.message);
      });
    }
  }

  // Broadcast agent activity to SSE clients
  async broadcastAgentActivity(activityData) {
    try {
      const { broadcastActivity } = await import('../routes/monitoring.js');
      
      // Get agent name from settings
      let agentName = 'Agent';
      try {
        const agentSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
        if (agentSettings && agentSettings.name) {
          agentName = agentSettings.name;
        }
      } catch (error) {
        console.error('⚠️ [AGENT NAME] Could not fetch agent name:', error);
      }
      
      // Strip emojis from details before broadcast
      const stripEmoji = s => (s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u{1F300}-\u{1F9FF}]/gu, '').replace(/\s{2,}/g, ' ').trim();
      activityData.details = stripEmoji(activityData.details);
      activityData.isCrmMode = !!this.isCrmMode; // Tag so frontend can route/filter

      // Create concise card message
      const baseCardMessage = this.translateToConciseCardMessage(activityData.operation, activityData.details);
      const cardMessage = `${agentName} is ${baseCardMessage}`;
      
      // Extract location from current lead if available
      let location = null;
      const currentLead = this.memory?.currentCycle?.currentLead;
      if (currentLead && currentLead.organization) {
        // Try to get city and state/country for geocoding
        const city = currentLead.organization.city || currentLead.organization.primary_city;
        const state = currentLead.organization.state || currentLead.organization.primary_state;
        const country = currentLead.organization.country || currentLead.organization.primary_country || 'United States';
        
        // Only create location if we have at least city or state (not just default country)
        if (city || state) {
          location = {
            city: city || '',
            state: state || '',
            country: country,
            companyName: currentLead.organization.name || currentLead.company || 'Unknown'
          };
        } else {
          console.log(`[NO LOCATION] Lead has no city/state data:`, {
            name: currentLead.name,
            company: currentLead.organization?.name || currentLead.company,
            org: currentLead.organization
          });
        }
      }
      
      broadcastActivity({
        type: 'agent_activity',
        userId: this.userId,
        agentId: activityData.agentId,
        operation: activityData.operation,
        details: activityData.details, // Full details for activity logs
        cardMessage: cardMessage, // Concise message for cards
        status: activityData.status,
        timestamp: activityData.timestamp,
        data: activityData.data || undefined, // Qualification data (score, reasoning, etc.)
        location: location, // Include location data for globe positioning
        targeting: currentLead ? {
          company: currentLead.organization?.name || currentLead.company,
          industry: currentLead.organization?.industry,
          position: currentLead.title
        } : null
      });
    } catch (error) {
      console.error('❌ [SSE BROADCAST] Error:', error);
    }
  }

  // Fire-and-forget CRM SSE event (userId-scoped so only that user's browser tab sees it)
  _emitCRMEvent(type, data = {}) {
    import('../routes/monitoring.js')
      .then(({ broadcastActivity }) => broadcastActivity({
        type,
        userId: this.userId,
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        ...data
      }))
      .catch(() => {});
  }

  _getCRMContactId(lead) {
    return lead?.crmId || lead?.email || null;
  }

  _getCRMContactName(lead) {
    return lead?.name || lead?.first_name || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.email || 'Contact';
  }

  _getCRMCompanyName(lead) {
    return lead?.company || lead?.organization?.name || null;
  }

  _queueAuditorStateUpdate(mutator) {
    this.auditorStateUpdateChain = this.auditorStateUpdateChain
      .then(async () => {
        const currentState = await this.awsManager.getAuditorState(this.userId);
        const nextPatch = await mutator(currentState || {});
        if (!nextPatch) return;
        await this.awsManager.saveAuditorState(this.userId, nextPatch);
      })
      .catch(error => {
        console.error('❌ [AUDITOR STATE] Failed to update auditor state:', error.message);
      });

    return this.auditorStateUpdateChain;
  }

  async _markAuditorContactActive(lead) {
    if (!lead?._fromCRM) return;

    const contactId = this._getCRMContactId(lead);
    if (!contactId) return;

    await this._queueAuditorStateUpdate(async (currentState) => {
      const activeContactIds = new Set(currentState?.activeContactIds || []);
      activeContactIds.add(contactId);

      return {
        launched: true,
        agentId: this.agentId,
        activeContactIds: [...activeContactIds]
      };
    });
  }

  async _markAuditorContactComplete(lead, { crmSync = null, queueId = null, completedAt = null } = {}) {
    if (!lead?._fromCRM) return;

    const contactId = this._getCRMContactId(lead);
    if (!contactId) return;

    const result = {
      contactId,
      contactName: this._getCRMContactName(lead),
      company: this._getCRMCompanyName(lead),
      email: lead?.email || null,
      crmStatus: crmSync?.status === 'failed' ? 'failed' : crmSync?.status === 'skipped' ? 'skipped' : 'success',
      crmAction: crmSync?.action || 'queued',
      crmMessage: crmSync?.message || 'Email queued',
      crmIntegration: crmSync?.crmIntegration || null,
      crmContactId: crmSync?.crmContactId || null,
      completedAt: completedAt || new Date().toISOString()
    };

    await this._queueAuditorStateUpdate(async (currentState) => {
      const pendingContacts = (currentState?.pendingContacts || []).filter(contact => (contact.crmId || contact.email) !== contactId);
      const activeContactIds = new Set(currentState?.activeContactIds || []);
      activeContactIds.delete(contactId);
      const existingResults = (currentState?.results || []).filter(entry => entry?.contactId !== contactId);
      const totalQueued = currentState?.totalQueued || pendingContacts.length + (currentState?.completedCount || 0) + 1;
      const completedCount = Math.max(0, totalQueued - pendingContacts.length);

      return {
        launched: pendingContacts.length > 0,
        agentId: this.agentId,
        totalQueued,
        completedCount,
        pendingContacts,
        results: [result, ...existingResults].slice(0, 25),
        activeContactIds: [...activeContactIds]
      };
    });

    this._emitCRMEvent('crm_contact_complete', {
      contactId,
      contactName: result.contactName,
      company: result.company,
      email: result.email,
      queueId,
      crmSync
    });
  }

  getOperationLogs() {
    return this.operationLogs;
  }

  clearOperationLogs() {
    this.operationLogs = [];
    this.logOperation('System', 'Operation logs cleared', 'completed');
  }

  // Log cycle completion to DynamoDB for analytics
  async logCycleCompletion(cycleData = {}) {
    try {
      const timestamp = new Date().toISOString();
      const cycleLog = {
        userId: this.userId,
        agentId: this.agentId,
        cycleNumber: this.cycleCount,
        timestamp,
        completedAt: timestamp,
        ...cycleData
      };

      // Save to DynamoDB
      await this.awsManager.saveCycleLog(this.userId, this.agentId, cycleLog);
      
      
      // Broadcast cycle completion event
      try {
        const { broadcastActivity } = await import('../routes/monitoring.js');
        broadcastActivity({
          type: 'cycle_complete',
          userId: this.userId,
          agentId: this.agentId,
          cycleNumber: this.cycleCount,
          leadsFound: cycleData.leadsSearched || 0,
          qualified: cycleData.leadsQualified || 0,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Failed to broadcast cycle completion:', err);
      }
      
      // Get current total API usage from summary table and log it
      const apiUsage = await this.awsManager.getUserApiUsageSummary(this.userId);
      if (apiUsage.success && apiUsage.stats) {
        const totalCost = Object.values(apiUsage.stats).reduce((sum, service) => sum + (service.cost || 0), 0);
        console.log(`💰 [CYCLE COST] Total API cost after cycle #${this.cycleCount}: $${totalCost.toFixed(4)}`);
      }
    } catch (error) {
      console.error('❌ [CYCLE LOG] Failed to log cycle completion:', error);
    }
  }

  // Generate unique ID for progress events
  generateUniqueId() {
    return `${Date.now()}-${++this.progressIdCounter}-${Math.random().toString(36).substr(2, 4)}`;
  }

  // Translate technical actions into user-friendly messages
  translateThinkingToFriendly(action, context) {
    const messages = {
      'get_user_settings': 'Loading your search preferences and targeting criteria',
      'get_email_settings': 'Loading email templates and branding settings',
      'lead_search': `Searching for ${context.targetLeads || 'new'} qualified leads${context.memory?.lastSearchKey ? ` — ${context.memory.lastSearchKey.replace('#', ' · ')}` : ' in your target industries'}`,
      'serper_research': `Researching ${context.currentLead?.company || 'company'} to personalize outreach`,
      'unlock_email': `Finding email address for ${context.currentLead?.name || 'contact'}`,
      'build_personalized_email': `Writing personalized email for ${context.currentLead?.name || 'lead'}${context.currentLead?.company ? ` at ${context.currentLead.company}` : ''}`,
      'queue_email': `Scheduling email to ${context.currentLead?.name || 'contact'}`,
      'pre_qualify_lead': `Pre-screening ${context.currentLead?.name || 'lead'} at ${context.currentLead?.company || 'company'}`,
      'qualify_lead': `Qualifying ${context.currentLead?.name || 'lead'} at ${context.currentLead?.company || 'company'}`,
      'think': 'Analyzing next steps...',
      'complete': 'Finished processing leads'
    };
    
    return messages[action] || action;
  }

  // Translate operations to concise card messages (no emojis, simplified)
  translateToConciseCardMessage(operation, details) {
    // Strip emojis first
    const cleaned = details.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    
    // Extract lead name if present
    const leadNameMatch = cleaned.match(/(?:for|researching lead:|email for)\s+([^\s]+)/i);
    const leadName = leadNameMatch ? leadNameMatch[1] : null;
    
    let message = '';
    
    // Check operation name first
    if (operation === 'pre_qualification' || operation === 'detailed_qualification' || 
        operation === 'Lead Processing' || operation.includes('Pre-Check') || 
        operation.includes('Qualification') || cleaned.toLowerCase().includes('qualifying')) {
      message = 'Qualifying lead';
    } else if (operation === 'email_generation' || operation === 'Email Processing' || 
               operation.includes('EMAIL') || cleaned.toLowerCase().includes('writing') || 
               cleaned.toLowerCase().includes('personalized email')) {
      message = leadName ? `Writing email for ${leadName}` : 'Writing email';
    } else if (operation === 'Action Execution' && cleaned.includes('settings')) {
      message = 'Loading settings';
    } else if (operation === 'Lead Search' || cleaned.includes('SEARCH') || cleaned.toLowerCase().includes('searching')) {
      message = 'Searching for leads';
    } else if (operation === 'Lead Complete' || cleaned.toLowerCase().includes('completed')) {
      message = leadName ? `Completed ${leadName}` : 'Lead complete';
    } else {
      // Take first 8 words
      const words = cleaned.split(/\s+/).slice(0, 8);
      message = words.join(' ');
    }
    
    // Enforce 8 word maximum on all messages
    const finalWords = message.split(/\s+/).slice(0, 8);
    return finalWords.join(' ');
  }

  // Get agent personality data from AWS
  async getAgentPersonality() {
    try {
      const agentSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      if (agentSettings && agentSettings.personality) {
        return agentSettings.personality;
      }

      // Fallback: read from the agent list entry (older agents stored personality there)
      const user = await this.awsManager.getUserById(this.userId);
      const agentData = user?.activeAgents?.find(a => String(a.agentId) === String(this.agentId));
      if (agentData?.personality) {
        return agentData.personality;
      }
      
      // Default personality if none found
      return {
        type: 'hunter',
        name: 'The Hunter',
        description: 'Default personality',
        avatar: '🎯',
        emailPrompt: 'Write professional, direct sales emails that create urgency and drive action. Use confident language and clear value propositions.',
        emailStyle: 'Professional and direct',
        traits: ['Professional', 'Direct'],
        color: 'blue'
      };
    } catch (error) {
      console.error('❌ [PERSONALITY] Error getting agent personality:', error);
      return null;
    }
  }

  // Core routing function - deterministic, no LLM call
  async reason(context) {
    const functionCall = this.determineFunctionCall(context);

    let action, parameters;

    if (!functionCall || functionCall === 'auto' || functionCall === 'none') {
      action = 'think';
      parameters = {};
    } else {
      action = functionCall.name;
      parameters = this._buildParametersForAction(action, context);
    }

    console.log('[DECISION] Agent decided to use tool:', action);

    return { reasoning: `Proceeding to ${action}`, action, parameters };
  }

  // Build parameters for each action from context — no LLM needed
  _buildParametersForAction(action, context) {
    const lead = context.currentLead;
    switch (action) {
      case 'unlock_email':
        return {
          apolloId: lead?._leadSource === 'apollo' ? lead?.apolloId : undefined,
          firstName: lead?.first_name,
          lastName: lead?.last_name,
          companyName: lead?.company || lead?.organization?.name,
          domain: lead?.organization?.primary_domain || lead?.domain
        };
      case 'serper_research':
        return {
          companyName: lead?.company || lead?.organization?.name,
          personName: lead?.name
        };
      default:
        return {};
    }
  }

  // Determine which function to force based on context
  determineFunctionCall(context) {
    // Force specific functions based on sequential workflow
    if (!context.hasUserSettings) {
      return { name: 'get_user_settings' };
    }
    
    if (!context.hasEmailSettings) {
      return { name: 'get_email_settings' };
    }
    
    if (context.cycleComplete) {
      return 'none'; // Let agent complete naturally
    }
    
    if (context.processingPhase === 'paused') {
      return 'none'; // Don't execute any functions when paused
    }
    
    switch (context.processingPhase) {
      case 'search':
        if (!context.currentLead && (context.leadQueue.length === 0)) {
          return { name: 'lead_search' };
        }
        break;
        
      case 'pre-qualify':
        if (context.currentLead) {
          return { name: 'pre_qualify_lead' };
        }
        break;
        
      case 'research':
        if (context.currentLead) {
          return { name: 'serper_research' };
        }
        break;
        
      case 'qualify':
        if (context.currentLead) {
          return { name: 'qualify_lead' };
        }
        break;
        
      case 'email':
        if (context.currentLead) {
          // Skip unlock if email already exists (enriched during search)
          if (context.currentLead.email) {
            return { name: 'build_personalized_email' };
          }
          return { name: 'unlock_email' };
        }
        break;
        
      case 'build':
        if (context.currentLead) {
          return { name: 'build_personalized_email' };
        }
        break;
    }
    
    return 'auto'; // Fallback to auto
  }

  // Update cycle state after each action
  async updateCycleState(action, actionResult) {
    switch (action) {
      case 'lead_search':
        if (actionResult?.leads?.length > 0) {
          // Reset duplicate counter when we find new leads
          this.memory.consecutiveDuplicateSearches = 0;

          // Accumulate Apollo search cost and lead count for per-lead refund math
          if (!this.memory.cycleCosts) this.memory.cycleCosts = { apollo: 0, leadsFound: 0 };
          this.memory.cycleCosts.apollo += this.awsManager.apiCosts.apollo;
          this.memory.cycleCosts.leadsFound += actionResult.leads.length;

          // Add leads to the queue, capped to remaining capacity
          const capacity = this.memory.currentCycle.targetLeads > 0
            ? Math.max(0, this.memory.currentCycle.targetLeads
                - this.memory.currentCycle.leadsProcessed
                - (this.memory.currentCycle.currentLead ? 1 : 0)
                - this.memory.currentCycle.leadQueue.length)
            : actionResult.leads.length;
          const leadsToAdd = actionResult.leads.slice(0, capacity);
          leadsToAdd.forEach(lead => {
            // Detect generic company names (industry terms)
            const genericTerms = ['Real Estate', 'Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing'];
            let companyName = lead.organization?.name || lead.company || 'Unknown Company';
            
            // If company name is generic, try to use domain-based name or employment history
            if (genericTerms.includes(companyName) && lead.organization?.primary_domain) {
              // Extract domain name (e.g., zillow.com -> Zillow)
              const domainParts = lead.organization.primary_domain.split('.');
              if (domainParts.length > 0) {
                companyName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
                        }
            }
            
            const normalizedLead = {
              ...lead,
              company: companyName,
              // Preserve _leadSource tag from search — if the lead came through
              // the registry it already has one; Apollo leads are tagged at enrich time.
              // Fall back to 'apollo' for any legacy leads that predate this system.
              _leadSource: lead._leadSource || 'apollo'
            };
            this.memory.currentCycle.leadQueue.push(normalizedLead);
          });
          
          // Start processing the first lead from queue
          if (this.memory.currentCycle.leadQueue.length > 0 && !this.memory.currentCycle.currentLead) {
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentLeadCost = 0; // reset per-lead cost tracker
            // Always start with research (Apollo just gave us names, we need Serper data)
            this.memory.currentCycle.processingPhase = 'research';
            const domain = this.memory.currentCycle.currentLead.organization?.primary_domain;
            // Broadcast location update immediately when starting first lead
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast first lead activity:', err.message);
            });
          }
        } else {
          // No new leads found - increment duplicate counter
          this.memory.consecutiveDuplicateSearches++;
          // After 3 consecutive duplicate searches, broaden criteria
          if (this.memory.consecutiveDuplicateSearches >= 3) {
            // ─────────────────────────────────────────────────────────────
            // DEPTH TRIGGER: SOURCE SWITCH
            // ─────────────────────────────────────────────────────────────
            // Before going deeper into pagination, check if we've already
            // gone deep 3+ times on this source × keyword pair. If so,
            // the source is genuinely exhausted for this keyword right now.
            // Switch to the best alternative source instead of digging deeper
            // into the same database.
            //
            // This prevents the agent from spending credits on page 20+ of
            // Apollo when another source might have fresh leads on page 1.
            // ─────────────────────────────────────────────────────────────
            const currentKeyword = this.memory.lastKeywordUsed || this.memory.campaignPriorityKeyword;
            const currentSource = currentKeyword
              ? this.memory.keywordSourceAssignments[currentKeyword]
              : null;
            const depthKey = `${currentSource}#${currentKeyword}`;
            if (!this.memory.sourcePageDepthCount[depthKey]) {
              this.memory.sourcePageDepthCount[depthKey] = 0;
            }
            this.memory.sourcePageDepthCount[depthKey]++;

            const depthCount = this.memory.sourcePageDepthCount[depthKey];

            if (depthCount >= 3 && currentKeyword && currentSource) {
              // We've gone deep 3 times on this source — try an alternative
              const available = getAvailableSources();
              const alt = this.bandit.selectAlternative(currentKeyword, currentSource, available);

              if (alt) {
                // Switch source assignment for this keyword
                const prevSource = currentSource;
                this.memory.keywordSourceAssignments[currentKeyword] = alt.id;
                // Reset depth counter for the new source
                this.memory.sourcePageDepthCount[`${alt.id}#${currentKeyword}`] = 0;
                // Also reset page offset since we're starting fresh with a new source
                this.memory.searchPageOffset = 0;
                this.memory.consecutiveDuplicateSearches = 0;

                // Audit log
                this.memory.sourceSwitchLog.push({
                  timestamp: new Date().toISOString(),
                  keyword: currentKeyword,
                  from: prevSource,
                  to: alt.id,
                  reason: 'depth_trigger',
                  depthCount
                });

                this.logOperation(
                  '🔀 Source Switched (Depth)',
                  `Keyword "${currentKeyword}": switched from ${prevSource} → ${alt.label} after ${depthCount} deep-page searches`,
                  'info',
                  { keyword: currentKeyword, from: prevSource, to: alt.id, depthCount }
                );
              } else {
                // No alternative available — fall back to regular page deepening
                this.memory.searchPageOffset += 5;
                this.memory.consecutiveDuplicateSearches = 0;
                this.logOperation(
                  '🔍 Search Strategy Adapted',
                  `Exhausted recent leads - now searching deeper pages (${this.memory.searchPageOffset + 1}+) for fresh prospects (no alternative source available)`,
                  'info',
                  { pageOffset: this.memory.searchPageOffset }
                );
              }
            } else {
              // Normal depth increase — haven't hit the source-switch threshold yet
              this.memory.searchPageOffset += 5;
              this.memory.consecutiveDuplicateSearches = 0;

              this.logOperation(
                '🔍 Search Strategy Adapted',
                `Exhausted recent leads - now searching deeper pages (${this.memory.searchPageOffset + 1}+) for fresh prospects`,
                'info',
                {
                  pageOffset: this.memory.searchPageOffset,
                  timestamp: new Date().toISOString()
                }
              );

              this.logIssue('info', 'Search Strategy Adapted', {
                message: `Exhausted recent leads in pages 1-${this.memory.searchPageOffset}. Now searching deeper pages (${this.memory.searchPageOffset + 1}+) for fresh prospects.`,
                pageOffset: this.memory.searchPageOffset,
                searchRange: `${this.memory.searchPageOffset + 1}-${this.memory.searchPageOffset + 10}`,
                reason: 'consecutive_duplicates',
                timestamp: new Date().toISOString()
              });
            }
          }
          
          // Check if we still need more leads for our target
          const totalLeadsNeeded = this.memory.currentCycle.targetLeads;
          const currentLeadCount = this.memory.currentCycle.leadQueue.length
            + this.memory.currentCycle.leadsProcessed
            + (this.memory.currentCycle.currentLead ? 1 : 0);
          
          if (currentLeadCount < totalLeadsNeeded) {
            // Stay in search phase to keep looking for more NEW leads
            this.memory.currentCycle.processingPhase = 'search';
          } else {
            this.memory.currentCycle.cycleComplete = true;
            this.memory.currentCycle.processingPhase = 'complete';
          }
        }
        break;
        
      case 'pre_qualify_lead':
        if (actionResult?.success) {
          if (actionResult.recommendation === 'SKIP') {
            // Pre-qualification failed — increment streak and maybe rotate keyword
            console.log(`[SKIP] Pre-qualification failed (score: ${actionResult.score}/100), skipping lead`);
            this._rotateKeywordOnDisq();
            this.memory.currentCycle.currentLead = null;
            
            // Get next lead from queue or search for more
            if (this.memory.currentCycle.leadQueue.length > 0) {
              this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
              this.memory.currentCycle.processingPhase = 'research';
              
              // Broadcast location update for skipped lead replacement
              this.broadcastAgentActivity({
                agentId: this.agentId,
                operation: '💭 Agent Activity',
                details: `Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
                status: 'active',
                timestamp: new Date()
              }).catch(err => {
                console.error('⚠️ [SSE] Failed to broadcast skipped lead replacement:', err.message);
              });
            } else {
              this.memory.currentCycle.processingPhase = 'search';
            }
          } else {
            // Pre-qualification passed, proceed to detailed qualification
            this.memory.currentCycle.processingPhase = 'qualify';
          }
        }
        break;
      
      case 'serper_research':
        if (actionResult?.success) {
          // Research complete, move to pre-qualification ONLY if we have criteria to check
          const hasCriteria = this.campaignPlan?.qualificationCriteria?.mustHave?.length > 0 ||
                             this.campaignPlan?.qualificationCriteria?.disqualifiers?.length > 0;
          
          this.memory.currentCycle.processingPhase = hasCriteria ? 'pre-qualify' : 'email';
        }
        break;
        
      case 'qualify_lead':
        if (actionResult?.success) {
          // Store qualification results for email generation
          this.memory.currentQualification = {
            score: actionResult.score,
            keyStrengths: actionResult.keyStrengths,
            weaknesses: actionResult.weaknesses,
            reasoning: actionResult.reasoning,
            confidence: actionResult.confidence,
            researchQuality: actionResult.researchQuality,
            requiresReview: actionResult.requiresReview,
            aiReport: actionResult.aiReport // Store full AI report for email building
          };
          
          if (actionResult.qualified) {
            // Qualification passed — reset disqualification streak
            this.memory.consecutiveDisqualifications = 0;
            // Check if we need email unlock or can skip to build
            if (this.memory.currentCycle.currentLead?.email) {
              this.memory.currentCycle.processingPhase = 'build';
            } else {
              this.memory.currentCycle.processingPhase = 'email';
            }
          } else {
            // Qualification failed — refund per-lead costs + proportional Apollo share
            const disqLead = this.memory.currentCycle.currentLead;
            const apolloShare = this.memory.cycleCosts.leadsFound > 0
              ? this.memory.cycleCosts.apollo / this.memory.cycleCosts.leadsFound
              : 0;
            const totalRefund = (this.memory.currentLeadCost || 0) + apolloShare;
            console.log(`[DISQ] Lead disqualified (score: ${actionResult.score}/100), refunding $${totalRefund.toFixed(4)}`);
            this.awsManager.refundCredits(this.userId, totalRefund, {
              leadName: disqLead?.name,
              leadCompany: disqLead?.company || disqLead?.organization?.name,
              reason: 'disqualified',
              agentId: this.agentId
            }).catch(err => console.error('[REFUND] Failed to refund disqualified lead:', err));

            this._rotateKeywordOnDisq();
            this.memory.currentCycle.currentLead = null;

            // Get next lead from queue or search for more
            if (this.memory.currentCycle.leadQueue.length > 0) {
              this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
              this.memory.currentLeadCost = 0; // reset for next lead
              this.memory.currentCycle.processingPhase = 'research';
              this.broadcastAgentActivity({
                agentId: this.agentId,
                operation: '💭 Agent Activity',
                details: `Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
                status: 'active',
                timestamp: new Date()
              }).catch(err => {
                console.error('⚠️ [SSE] Failed to broadcast disqualified lead replacement:', err.message);
              });
            } else {
              this.memory.currentCycle.processingPhase = 'search';
            }
          }
        } else {
          // Qualification FAILED (API error) - skip lead and move on
          const failedLeadName = this.memory.currentCycle.currentLead?.name || 'Unknown';
          console.log(`[WARN] Qualification failed for ${failedLeadName}: ${actionResult?.error || 'Unknown error'}`);
          this.memory.currentCycle.currentLead = null;
          
          if (this.memory.currentCycle.leadQueue.length > 0) {
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
          } else {
            this.memory.currentCycle.processingPhase = 'search';
          }
        }
        break;
        
      case 'unlock_email':

        if (actionResult?.success && actionResult?.email) {
          // Dedup-by-name+company already ran before enrichment (in lead_search),
          // but the unsubscribe-by-email check couldn't run then since there was
          // no email yet. Check now, right after the email becomes available.
          const isUnsub = await this.awsManager.isUnsubscribed(actionResult.email).catch(() => false);
          if (isUnsub) {
            console.log(`[SKIP] ${actionResult.email} is unsubscribed, skipping lead`);
            this.memory.currentCycle.currentLead = null;
            if (this.memory.currentCycle.leadQueue.length > 0) {
              this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
              this.memory.currentCycle.processingPhase = 'research';
            } else {
              this.memory.currentCycle.processingPhase = 'search';
            }
            break;
          }

          // Email unlocked successfully, UPDATE the lead email and company name from enriched data
          this.memory.currentCycle.currentLead.email = actionResult.email;
          
          // Update company name from enriched Apollo data (person.organization.name)
          if (actionResult.person?.organization?.name) {
            // Detect generic company names
            const genericTerms = ['Real Estate', 'Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing'];
            let companyName = actionResult.person.organization.name;
            
            // If enriched name is generic but we have a domain, derive from domain
            if (genericTerms.includes(companyName) && actionResult.person.organization.primary_domain) {
              const domainParts = actionResult.person.organization.primary_domain.split('.');
              if (domainParts.length > 0) {
                companyName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
              }
            }
            
            this.memory.currentCycle.currentLead.company = companyName;
            this.memory.currentCycle.currentLead.organization = actionResult.person.organization;
          }
          
          this.memory.currentCycle.processingPhase = 'build';
    
        } else {
          // Email unlock failed, skip this lead and get next from queue or search
          console.log(`[WARN] Email unlock failed for ${this.memory.currentCycle.currentLead?.name}, skipping lead`);
          
          // Emit SSE log for email unlock failure so user can see it
          this.logOperation(
            '❌ Email Unlock Failed', 
            `Could not unlock email for ${this.memory.currentCycle.currentLead?.name} at ${this.memory.currentCycle.currentLead?.company || 'Unknown Company'}. Reason: ${actionResult?.error || 'No valid email found'}. Skipping to next lead.`,
            'warning',
            {
              leadName: this.memory.currentCycle.currentLead?.name,
              company: this.memory.currentCycle.currentLead?.company,
              reason: actionResult?.error,
              timestamp: new Date().toISOString()
            }
          );
          
          // Log to issues/alerts database
          try {
            const AWSManager = (await import('../utils/awsManager.js')).default;
            const awsManager = new AWSManager();
            await awsManager.addIssue(
              this.userId,
              'warning',
              'Email Unlock Failed',
              `Could not unlock email for ${this.memory.currentCycle.currentLead?.name} at ${this.memory.currentCycle.currentLead?.company || 'Unknown Company'}`,
              {
                agentId: this.agentId,
                leadName: this.memory.currentCycle.currentLead?.name,
                company: this.memory.currentCycle.currentLead?.company,
                reason: actionResult?.error || 'No valid email found',
                timestamp: new Date().toISOString()
              }
            );
          } catch (issueError) {
            console.error('❌ [ISSUES] Failed to log issue:', issueError);
          }
          
          // Add failed lead to contacted database to prevent duplicates
          try {
            const leadInfo = {
              name: this.memory.currentCycle.currentLead?.name,
              email: 'email_unlock_failed', // Mark as failed
              company: this.memory.currentCycle.currentLead?.company || 'Unknown Company',
              position: this.memory.currentCycle.currentLead?.position || 'Unknown Position',
              linkedinUrl: this.memory.currentCycle.currentLead?.linkedinUrl,
              status: 'email_unlock_failed',
              failureReason: actionResult?.error || 'No valid email found',
              contactedAt: new Date().toISOString(),
              agentId: this.agentId
            };
            
            await this.awsManager.addContactedLead(this.userId, leadInfo);
          } catch (trackingError) {
            console.error('❌ [CONTACT TRACKING] Failed to add failed lead to database:', trackingError);
          }
          
          this.memory.currentCycle.currentLead = null;
          
          if (this.memory.currentCycle.leadQueue.length > 0) {
            // Get next lead from queue
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
            
            // Broadcast location update for lead after email unlock failure
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast lead after failure:', err.message);
            });
          } else {
            // Queue empty, need to search for more leads
            this.memory.currentCycle.processingPhase = 'search';
          }
        }
        break;
        
      case 'build_personalized_email':
        if (actionResult?.success) {
          // Determine if email should be marked for review based on qualification confidence
          const qualification = this.memory.currentQualification || {};
          const requiresReview = qualification.requiresReview || qualification.confidence === 'LOW';
          const confidence = qualification.confidence || 'MEDIUM';
          
          // Add email to queue with confidence metadata
          const currentLead = this.memory.currentCycle?.currentLead;
          if (!currentLead) {
            console.error('❌ [CYCLE] updateCycleState called but currentLead is null — skipping queue add');
            return;
          }
          const leadData = {
            ...currentLead,
            email: currentLead.email,
            company: currentLead.company || currentLead.organization?.name,
            personalizedEmail: actionResult.email,
            emailSubject: actionResult.subject,
            generatedEmail: actionResult.email,
            research: this.memory.lastResearch, // Include the research data from memory
            // Add AI confidence report from email generation
            confidenceReport: actionResult.confidenceReport,
            confidenceLevel: actionResult.confidenceLevel,
            // Explicitly carry aiReport so addToEmailQueue doesn't need shared-memory fallback
            aiReport: qualification.aiReport || null,
            // Add qualification metadata
            qualificationScore: qualification.score,
            qualificationConfidence: confidence,
            researchQuality: qualification.researchQuality,
            requiresReview: requiresReview,
            keyStrengths: qualification.keyStrengths,
            weaknesses: qualification.weaknesses,
            // Cost tracking for refund if user rejects this email
            leadCost: this.memory.currentLeadCost || 0
          };
          
          const queueResult = await this.addToEmailQueue(leadData);
          
          const reviewNote = requiresReview ? ' ⚠️ MARKED FOR REVIEW (low confidence)' : '';
          console.log(`📧 [QUEUE] Email added to queue for ${this.memory.currentCycle.currentLead?.name}${reviewNote}`);
          
          // Broadcast email built event with location for white dot placement
          this.broadcastAgentActivity({
            agentId: this.agentId,
            operation: 'Email Processing',
            details: `✅ Email built for ${this.memory.currentCycle.currentLead?.company}`,
            status: 'active',
            timestamp: new Date()
          }).catch(err => {
            console.error('⚠️ [SSE] Failed to broadcast email built event:', err.message);
          });
          
          // Email built, lead complete - move to next lead
          this.memory.currentCycle.leadsProcessed++;
          // Notify CRM page this contact is done
          if (this.memory.currentCycle.currentLead?._fromCRM) {
            this._emitCRMEvent('crm_contact_complete', {
              contactId: this.memory.currentCycle.currentLead.crmId || this.memory.currentCycle.currentLead.email,
              contactName: this.memory.currentCycle.currentLead.name || this.memory.currentCycle.currentLead.first_name || this.memory.currentCycle.currentLead.email,
              company: this.memory.currentCycle.currentLead.company || this.memory.currentCycle.currentLead.organization?.name || null,
              email: this.memory.currentCycle.currentLead.email || null,
              queueId: queueResult?.id || null,
              crmSync: queueResult?.crmSync || null
            });
          }
          this.memory.currentCycle.currentLead = null;

          // Get next lead from queue or search for more
          const targetReached = this.memory.currentCycle.targetLeads > 0
            && this.memory.currentCycle.leadsProcessed >= this.memory.currentCycle.targetLeads;
          if (!targetReached && this.memory.currentCycle.leadQueue.length > 0) {
            // Process next lead from queue
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';

            // Broadcast location update immediately when starting new lead
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast new lead activity:', err.message);
            });
          } else if (!targetReached && !this.isCrmMode) {
            // Need more leads - search again
            this.memory.currentCycle.processingPhase = 'search';
          } else {
            // Cycle complete - clear any remaining queued leads
            this.memory.currentCycle.leadQueue = [];
            this.memory.currentCycle.processingPhase = 'complete';
          }
          

        } else {
          // Email generation FAILED - skip this lead and move to next
          const failedLeadName = this.memory.currentCycle.currentLead?.name || 'Unknown';
          const failedLeadCompany = this.memory.currentCycle.currentLead?.company || 'Unknown';
          const errorMsg = actionResult?.error || actionResult?.message || 'Unknown error';
          
          console.log(`[WARN] Email generation failed for ${failedLeadName} at ${failedLeadCompany}: ${errorMsg}`);
          
          // Track the failed lead to avoid retrying
          if (!this.memory.failedLeads) {
            this.memory.failedLeads = [];
          }
          this.memory.failedLeads.push({
            name: failedLeadName,
            company: failedLeadCompany,
            email: this.memory.currentCycle.currentLead?.email,
            reason: errorMsg,
            timestamp: new Date().toISOString()
          });
          
          // Broadcast skip event
          this.broadcastAgentActivity({
            agentId: this.agentId,
            operation: 'Email Skip',
            details: `⏭️ Skipped ${failedLeadName} at ${failedLeadCompany} - insufficient research data`,
            status: 'warning',
            timestamp: new Date()
          }).catch(err => {
            console.error('⚠️ [SSE] Failed to broadcast skip event:', err.message);
          });
          
          // Clear current lead and move to next
          this.memory.currentCycle.currentLead = null;
          
          // Get next lead from queue or search for more
          if (this.memory.currentCycle.leadQueue.length > 0) {
            // Process next lead from queue
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
            
            // Broadcast location update
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast new lead activity:', err.message);
            });
          } else if (!this.isCrmMode && this.memory.currentCycle.leadsProcessed < this.memory.currentCycle.targetLeads) {
            // Need more leads - search again
            this.memory.currentCycle.processingPhase = 'search';
          } else {
            // Cycle complete (all done, some skipped)
            this.memory.currentCycle.processingPhase = 'complete';
              }
        }
        break;
        
      case 'pause':
        this.memory.currentCycle.processingPhase = 'paused';
        break;
        
      case 'complete':
        this.memory.currentCycle.processingPhase = 'complete';
        this.memory.currentCycle.cycleComplete = true;
        break;
    }
    
  }

  // Increment consecutive-disqualification counter; rotate keyword when threshold (3) is hit.
  // Cross-checks the candidate new keyword against the Zilliz-seeded industryExhaustion
  // tracker and skips keywords that already carry a >20% duplicate rate.
  _rotateKeywordOnDisq() {
    this.memory.consecutiveDisqualifications = (this.memory.consecutiveDisqualifications || 0) + 1;

    if (this.memory.consecutiveDisqualifications < 3) return;

    this.memory.consecutiveDisqualifications = 0;

    const baseKeywords = this.memory.baseIndustryKeywords || [];
    const aiKeywords   = this.memory.aiGeneratedKeywords  || [];
    const allKeywords  = [...baseKeywords, ...aiKeywords];
    const total        = allKeywords.length;

    // If a campaign priority keyword is active, clear it so normal rotation resumes
    if (this.memory.campaignPriorityKeyword) {
      const cleared = this.memory.campaignPriorityKeyword;
      this.memory.campaignPriorityKeyword = null;
      this.memory.leadsFoundWithCurrentKeyword = 0;
      this.memory.searchPageOffset = 0;
      this.logOperation(
        '🔄 DISQ Rotate (Campaign)',
        `3 consecutive SKIP/DISQ leads — cleared campaign keyword "${cleared}", resuming normal rotation`,
        'warn'
      );
      return;
    }

    if (total === 0) return;

    // Advance to next keyword
    this.memory.currentKeywordIndex = (this.memory.currentKeywordIndex || 0) + 1;
    this.memory.leadsFoundWithCurrentKeyword = 0;
    this.memory.searchPageOffset = 0;

    // Cross-check the candidate keyword against the Zilliz-seeded exhaustion tracker.
    // Skip keywords that already have a high duplicate rate (>20% with >=5 attempts).
    let skipped = 0;
    while (skipped < total) {
      const idx     = this.memory.currentKeywordIndex % total;
      const kw      = allKeywords[idx];
      const tracker = this.memory.industryExhaustion?.[kw];
      if (tracker && tracker.cumulativeDuplicateRate > 40 && tracker.totalAttempts >= 5) {
        this.logOperation(
          '⏭️ DISQ Rotate Skip',
          `Skipping "${kw}" (${tracker.cumulativeDuplicateRate.toFixed(1)}% dup rate in Zilliz memory, ${tracker.totalAttempts} attempts)`,
          'info'
        );
        this.memory.currentKeywordIndex++;
        skipped++;
      } else {
        break;
      }
    }

    const chosenKw = allKeywords[this.memory.currentKeywordIndex % total] || 'unknown';
    this.logOperation(
      '🔄 DISQ Keyword Rotate',
      `3 consecutive SKIP/DISQ leads — rotating search keyword to "${chosenKw}"`,
      'warn'
    );
  }

  // Extract business type from research content
  extractBusinessType(content) {
    const text = content.toLowerCase();
    
    // SaaS/Software patterns
    if (text.includes('saas') || text.includes('software-as-a-service')) {
      return 'SaaS Platform';
    }
    if (text.includes('software') && (text.includes('platform') || text.includes('solutions'))) {
      return 'Software Solutions';
    }
    if (text.includes('cloud') && text.includes('platform')) {
      return 'Cloud Platform';
    }
    
    // Service patterns
    if (text.includes('management platform')) {
      return 'Management Platform';
    }
    if (text.includes('automation') && text.includes('platform')) {
      return 'Automation Platform';
    }
    
    // Industry patterns
    if (text.includes('fintech') || text.includes('financial services')) {
      return 'FinTech Company';
    }
    if (text.includes('healthcare') || text.includes('medical')) {
      return 'Healthcare';
    }
    if (text.includes('e-commerce') || text.includes('ecommerce')) {
      return 'E-commerce Platform';
    }
    
    // Generic fallback
    if (text.includes('platform')) {
      return 'Technology Platform';
    }
    if (text.includes('solutions')) {
      return 'Solutions Provider';
    }
    if (text.includes('services')) {
      return 'Service Provider';
    }
    
    return 'Technology Company';
  }
  
  // Extract key services/products from research content
  extractKeyServices(content) {
    const text = content.toLowerCase();
    const services = [];
    
    // Common service patterns
    if (text.includes('automation')) services.push('Automation');
    if (text.includes('analytics')) services.push('Analytics');
    if (text.includes('security')) services.push('Security');
    if (text.includes('management')) services.push('Management');
    if (text.includes('integration')) services.push('Integration');
    if (text.includes('compliance')) services.push('Compliance');
    if (text.includes('reporting')) services.push('Reporting');
    if (text.includes('monitoring')) services.push('Monitoring');
    if (text.includes('optimization')) services.push('Optimization');
    if (text.includes('onboarding')) services.push('User Onboarding');
    
    // Industry-specific services
    if (text.includes('crm') || text.includes('customer relationship')) services.push('CRM');
    if (text.includes('erp') || text.includes('enterprise resource')) services.push('ERP');
    if (text.includes('hr') || text.includes('human resources')) services.push('HR Solutions');
    if (text.includes('payroll')) services.push('Payroll');
    if (text.includes('marketing')) services.push('Marketing Tools');
    
    return services.slice(0, 3).join(' & '); // Limit to top 3 services
  }

  // AI analyzes research findings to explain strategic importance
  async analyzeResearchFindings(companyName, findings) {
    try {
      // Compile research content for AI analysis
      const researchContent = findings.map(f => 
        `${f.type}: ${f.title}\n${f.content}`
      ).join('\n\n');

      // Get user settings for personalized analysis
      const userSettings = this.memory.userSettings;
      const emailSettings = this.memory.emailSettings;
      
      // Build context from settings (check both nested and flat structures)
      const yourProduct = userSettings?.productName || emailSettings?.productName || '[YOUR PRODUCT]';
      const yourCompany = userSettings?.companyName || emailSettings?.companyName || '[YOUR COMPANY]';
      const valueProps = userSettings?.valuePropositions || emailSettings?.valuePropositions || [];
      const targetIndustries = userSettings?.companyIndustries || [];

      const settingsContext = `
OUTREACH CONTEXT:
- Your Product/Service: ${yourProduct}
- Your Company: ${yourCompany}
${valueProps.length > 0 ? `- Your Value Propositions: ${valueProps.join(', ')}` : ''}
${targetIndustries.length > 0 ? `- Target Industries: ${targetIndustries.join(', ')}` : ''}`;

      const analysisPrompt = `
You are a lead generation AI analyzing research findings about a potential business prospect. 

COMPANY: ${companyName}

RESEARCH FINDINGS:
${researchContent}

${settingsContext}

Analyze this research and explain:
1. What type of business this is and why it's strategically important
2. Key pain points or operational challenges they likely face
3. What makes them a high-value prospect (consider your target industries and value props if provided)
4. Specific conversation starters or engagement angles based on their business needs

Provide a concise but insightful analysis focused on business intelligence and lead qualification.

Format your response as:
BUSINESS TYPE: [one-liner description]
KEY INSIGHTS: [2-3 strategic insights about their business model/challenges]
LEAD VALUE: [why they're a high-value prospect for your outreach]
APPROACH: [specific outreach angles or conversation starters based on their business needs]
`;

      // Research analysis completed
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system', 
            content: 'You are an expert business intelligence analyst and lead qualification specialist. Provide actionable insights about prospects without referencing specific products or services.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const analysis = response.choices[0]?.message?.content || 'Analysis completed';
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'research_analysis',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o-mini',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            companyName: companyName
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }

      // Parse the structured response - capture multi-line content
      const lines = analysis.split('\n');
      const parsed = {};
      let currentSection = '';
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        if (line.includes('BUSINESS TYPE:')) {
          currentSection = 'businessType';
          parsed.businessType = line.replace('BUSINESS TYPE:', '').trim();
        } else if (line.includes('KEY INSIGHTS:')) {
          currentSection = 'keyInsights';
          parsed.keyInsights = line.replace('KEY INSIGHTS:', '').trim();
        } else if (line.includes('LEAD VALUE:')) {
          currentSection = 'leadValue';
          parsed.leadValue = line.replace('LEAD VALUE:', '').trim();
        } else if (line.includes('APPROACH:')) {
          currentSection = 'approach';
          parsed.approach = line.replace('APPROACH:', '').trim();
        } else if (currentSection && trimmedLine) {
          // Continue capturing content for the current section
          parsed[currentSection] = (parsed[currentSection] || '') + ' ' + trimmedLine;
        }
      });

      // Trim all parsed values
      Object.keys(parsed).forEach(key => {
        if (parsed[key]) parsed[key] = parsed[key].trim();
      });

      // Create summary for SSE display
      const summary = `${parsed.businessType || 'Analysis completed'} • ${parsed.keyInsights?.substring(0, 80) || 'Strategic insights generated'}...`;

      return {
        summary,
        fullAnalysis: analysis,
        businessType: parsed.businessType,
        keyInsights: parsed.keyInsights,
        leadValue: parsed.leadValue,
        approach: parsed.approach,
        analysisTimestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [AI ANALYSIS] Failed to analyze research findings:', error);
      return {
        summary: `Research findings collected for ${companyName}`,
        fullAnalysis: 'Analysis temporarily unavailable',
        error: error.message
      };
    }
  }

  // Get user settings from AWS DynamoDB - lead agent settings
  async getUserSettings() {
    
    try {
      // Get lead agent settings from AWS DynamoDB with agentId
      const leadContactSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      
      
      if (!leadContactSettings) {
        console.log('❌ [SETTINGS] No lead agent settings found in AWS DynamoDB!');
        return { error: 'No lead agent settings configured for this user' };
      }

      // ALSO load general user settings to get company profile
      const generalUserSettings = await this.awsManager.getUserSettings(this.userId);
      
      const actualSettings = {
        // Company branding (REAL DATA)
        companyBranding: leadContactSettings.companyBranding,
        agentName: leadContactSettings.companyBranding?.agentName,
        companyName: leadContactSettings.companyBranding?.companyName,
        primaryService: leadContactSettings.companyBranding?.primaryService,
        coreOffering: leadContactSettings.companyBranding?.coreOffering,
        keyAdvantages: leadContactSettings.companyBranding?.keyAdvantages,
        expertiseArea: leadContactSettings.companyBranding?.expertiseArea,
        
        // Company profile (from general user settings)
        companyProfile: generalUserSettings?.companyProfile,
        
        // Company criteria (REAL DATA) 
        companySizeMin: leadContactSettings.companyCriteria?.companySizeMin,
        companySizeMax: leadContactSettings.companyCriteria?.companySizeMax,
        companyIndustries: leadContactSettings.companyCriteria?.companyIndustries,
        companyKeywords: leadContactSettings.companyCriteria?.companyKeywords,
        
        // Contact criteria (REAL DATA)
        targetPositions: leadContactSettings.contactCriteria?.targetPositions,
        seniorityLevel: leadContactSettings.contactCriteria?.seniorityLevel,
        
        // Geographic settings (REAL DATA)
        targetLocations: leadContactSettings.geographicSettings?.targetLocations,
        leadLimit: leadContactSettings.geographicSettings?.leadLimit,
        
        // Research focus (REAL DATA)
        focusAreas: leadContactSettings.researchFocus?.focusAreas,
        researchDepth: leadContactSettings.researchFocus?.researchDepth
      };
      
      return actualSettings;
    } catch (error) {
      console.error('❌ [SETTINGS] Error getting lead agent settings:', error);
      return { error: error.message };
    }
  }

  // Get email builder settings from AWS DynamoDB - lead agent settings
  async getEmailSettings() {
    try {
      // Use the same method to get lead agent settings (includes email builder) with agentId
      const leadContactSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      
      
      if (!leadContactSettings) {
        return { error: 'No lead agent settings configured for this user' };
      }
      
      // Extract REAL email builder settings
      const emailBuilder = leadContactSettings.emailBuilder;
      
      if (!emailBuilder) {
        return { error: 'No email builder settings configured' };
      }
      
      const actualEmailSettings = {
        // Email builder settings (REAL DATA)
        emailTemplate: emailBuilder.emailTemplate,
        customPrompt: emailBuilder.customPrompt,
        tone: emailBuilder.tone,
        length: emailBuilder.length,
        callToAction: emailBuilder.callToAction,
        personalization: emailBuilder.personalization,
        
        // Include the full emailBuilder object so CC and other settings are accessible
        emailBuilder: emailBuilder,
        
        // Company branding for email templates
        companyBranding: leadContactSettings.companyBranding
      };
      
      return actualEmailSettings;
    } catch (error) {
      console.error('❌ [EMAIL SETTINGS] Error getting email settings:', error);
      return { error: error.message };
    }
  }

  // === QUALIFICATION TOOLS ===
  
  /**
   * Pre-qualify lead - Quick check AFTER Serper research
   * Uses research data + campaign plan for fast filtering (saves money on email unlock)
   */
  async preQualifyLead(parameters) {
    // Get data from current cycle state
    const leadData = this.memory.currentCycle.currentLead;
    const researchData = this.memory.lastResearch;

    const personName = leadData?.name || 'Unknown';
    const companyName = leadData?.organization?.name || leadData?.company || 'Unknown Company';

    console.log('[PRE-QUALIFY] ── INPUT ──────────────────────────────────');
    console.log('[PRE-QUALIFY] lead:', JSON.stringify({ name: personName, company: companyName, title: leadData?.title, industry: leadData?.organization?.industry }));
    console.log('[PRE-QUALIFY] researchData present:', !!researchData, '| searches:', researchData?.searches?.length ?? 0, '| citedFacts:', researchData?.citedFacts?.length ?? 0);
    const _preQualOrganicCount = researchData?.searches?.reduce((n, s) => n + (s.results?.organic?.length ?? 0), 0) ?? 0;
    console.log('[PRE-QUALIFY] total organic results across searches:', _preQualOrganicCount);
    
    
    try {
      // If no campaign plan, skip pre-qualification (accept everyone)
      if (!this.campaignPlan || !this.campaignPlan.qualificationCriteria) {
        return {
          success: true,
          score: 70,
          recommendation: 'RESEARCH',
          reason: 'No specific criteria configured, proceeding to detailed qualification'
        };
      }
      
      const criteria = this.campaignPlan.qualificationCriteria;
      
      // Extract research summary - OPTION B: Pass raw Serper organic results from searches array
      let researchSummary = 'No research data available';
      const allOrganicResults = [];
      
      // Collect all organic results from all searches
      if (researchData?.searches && Array.isArray(researchData.searches)) {
        researchData.searches.forEach(search => {
          if (search.results?.organic && Array.isArray(search.results.organic)) {
            allOrganicResults.push(...search.results.organic);
          }
        });
      }
      
      if (allOrganicResults.length > 0) {
        // Take top 5 organic results and extract their titles + snippets for better context
        researchSummary = allOrganicResults
          .slice(0, 5)
          .map(result => {
            const title = result.title || '';
            const snippet = result.snippet || '';
            return `${title}\n${snippet}`.trim();
          })
          .filter(text => text.length > 0)
          .join('\n\n');
        
      } else {
      }
      
      const prompt = `You are a lead qualification AI. Quickly evaluate if this lead is worth pursuing based on available information.

LEAD INFORMATION:
Company: ${companyName}
Person: ${personName}
Title: ${leadData?.title || 'Unknown'}
Industry: ${leadData?.organization?.industry || 'Unknown'}

RESEARCH FINDINGS (from Serper):
${researchSummary}

MUST-HAVE CRITERIA (ideal qualifications):
${criteria.mustHave?.map(c => `- ${c}`).join('\n') || '- No specific requirements'}

DISQUALIFIERS (instant rejection):
${criteria.disqualifiers?.map(d => `- ${d}`).join('\n') || '- None specified'}

IMPORTANT: Even if you cannot find evidence of the must-have criteria, the lead may still be worth pursuing. Absence of evidence is not evidence of absence. Only recommend SKIP if you find clear disqualifiers or the company is completely unrelated to the target criteria.

Give a score 0-100:
- 80-100: Strong evidence of criteria match
- 50-79: Limited evidence but good fit (e.g., right industry, position, size)
- 20-49: Weak fit, missing key evidence but not disqualified
- 0-19: Clear disqualifier or completely wrong target

Recommend RESEARCH unless score < 20 (clear disqualifier found).

Respond in JSON format:
{
  "score": 0-100,
  "recommendation": "SKIP" or "RESEARCH",
  "reason": "brief explanation"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.3
      });

      let result = JSON.parse(response.choices[0].message.content);
      
      // Penalize score if 0 insights were extracted (webpage fetch/analysis failures)
      const totalWebpageInsights = researchData?.searches
        ?.flatMap(s => s.webpageInsights || [])
        ?.length || 0;
      
      if (totalWebpageInsights === 0) {
        const penalty = 30;
        const originalScore = result.score;
        result.score = Math.max(0, result.score - penalty);
        result.reason += ` (Note: Limited research data available - ${penalty} point penalty applied)`;
      }
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'pre_qualification',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o-mini',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            score: result.score,
            recommendation: result.recommendation
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
        // Accumulate for per-lead refund tracking
        if (this.memory.currentLeadCost !== undefined) {
          this.memory.currentLeadCost += response.usage.total_tokens * this.awsManager.apiCosts.openaiMini;
        }
      }
      
      // Calculate confidence based on how well research answered our questions
      let confidence = 'HIGH'; // Default
      let criteriaVerified = 0;
      let criteriaMissing = 0;
      
      // Check if we verified the must-have criteria with research
      if (criteria.mustHave && criteria.mustHave.length > 0) {
        const researchText = researchSummary.toLowerCase();
        criteria.mustHave.forEach(requirement => {
          const keywords = requirement.toLowerCase().split(' ').filter(w => w.length > 3);
          const found = keywords.some(kw => researchText.includes(kw));
          if (found) {
            criteriaVerified++;
          } else {
            criteriaMissing++;
          }
        });
        
        // Calculate confidence
        const verificationRate = criteriaVerified / criteria.mustHave.length;
        if (verificationRate >= 0.8) {
          confidence = 'HIGH';
        } else if (verificationRate >= 0.5) {
          confidence = 'MEDIUM';
        } else {
          confidence = 'LOW';
        }
      }
      
      // Emit activity log
      const emoji = result.recommendation === 'SKIP' ? '❌' : '✅';
      const confidenceEmoji = confidence === 'HIGH' ? '🟢' : confidence === 'MEDIUM' ? '🟡' : '🔴';
      
      this.logOperation('Lead Qualification', 
        `Pre-screen: ${personName} at ${companyName} — ${result.recommendation === 'SKIP' ? 'Skipped' : 'Passed'} (${result.score}/100) - ${result.reason}`, 
        result.recommendation === 'SKIP' ? 'warning' : (confidence === 'LOW' ? 'warning' : 'completed'),
        { 
          score: result.score,
          tier: result.recommendation === 'SKIP' ? 'SKIP' : 'PASS',
          company: companyName,
          confidence: confidence,
          reasoning: result.reason,
          criteriaVerified: criteriaVerified,
          criteriaMissing: criteriaMissing
        }
      );
      
      
      console.log('[PRE-QUALIFY] ── OUTPUT ─────────────────────────────────');
      console.log(`[PRE-QUALIFY] score: ${result.score}/100 | recommendation: ${result.recommendation} | reason: ${result.reason}`);
      return {
        success: true,
        score: result.score,
        recommendation: result.recommendation,
        reason: result.reason,
        confidence: confidence,
        criteriaVerified: criteriaVerified,
        criteriaMissing: criteriaMissing
      };

    } catch (error) {
      console.error('❌ [PRE-QUALIFY] Error:', error);
      // On error, don't block the lead - proceed with research
      return {
        success: true,
        score: 50,
        recommendation: 'RESEARCH',
        reason: 'Pre-qualification error, proceeding with research'
      };
    }
  }

  /**
   * Detailed qualification after research
   * Uses full research data and campaign plan for comprehensive scoring
   */
  async qualifyLead(parameters) {
    // Prefer explicit parameters so concurrent workers do not clobber each other.
    // Fall back to shared cycle state for the sequential path.
    const leadData = parameters?.leadData || this.memory.currentCycle.currentLead;
    const researchData = parameters?.researchData || this.memory.lastResearch;
    const emailSettings = this.memory.emailSettings;
    const primaryService = emailSettings?.companyBranding?.primaryService || '';
    const coreOffering = emailSettings?.companyBranding?.coreOffering || '';

    const personName = leadData?.name || 'Unknown';
    const companyName = leadData?.organization?.name || leadData?.company || 'Unknown Company';

    console.log('[QUALIFY] ── INPUT ───────────────────────────────────────');
    console.log('[QUALIFY] explicit params.leadData?', !!parameters?.leadData, '| explicit params.researchData?', !!parameters?.researchData);
    console.log('[QUALIFY] memory.currentCycle.currentLead?', !!this.memory.currentCycle?.currentLead, '| memory.lastResearch?', !!this.memory.lastResearch);
    console.log('[QUALIFY] resolved lead:', JSON.stringify({ name: personName, company: companyName, title: leadData?.title, industry: leadData?.organization?.industry, employees: leadData?.organization?.estimated_num_employees }));
    console.log('[QUALIFY] researchData.citedFacts:', researchData?.citedFacts?.length ?? 'MISSING', '| searches:', researchData?.searches?.length ?? 'MISSING');
    
    
    try {
      // If no campaign plan, use default qualification (SHOTGUN tier)
      if (!this.campaignPlan || !this.campaignPlan.qualificationCriteria) {
        return {
          success: true,
          qualified: true,
          tier: 'SHOTGUN',
          score: 50,
          reasoning: 'No specific criteria configured, lead accepted for generic outreach',
          keyStrengths: ['Meets basic targeting criteria'],
          weaknesses: ['No research verification available'],
          aiReport: {
            tier: 'SHOTGUN',
            tierDescription: 'Generic outreach - limited research data',
            citedFacts: [],
            confidence: 0.3,
            emailStrategy: 'Use generic template without personalization'
          }
        };
      }
      
      const criteria = this.campaignPlan.qualificationCriteria;
      
      // Extract research insights with citations
      let researchSummary = 'No research data available';
      let allCitedFacts = [];
      
      if (researchData?.citedFacts && researchData.citedFacts.length > 0) {
        allCitedFacts = researchData.citedFacts;
        researchSummary = allCitedFacts
          .map(fact => `${fact.text} [Source: ${fact.sourceTitle}]`)
          .join('\n');
      } else if (researchData?.data?.organic && researchData.data.organic.length > 0) {
        // Fallback to old format
        researchSummary = researchData.data.organic.slice(0, 5)
          .map(r => r.snippet)
          .join(' ');
      }
      
      const prompt = `You are an expert lead qualification analyst. Evaluate this lead using TIERED QUALIFICATION.

LEAD PROFILE:
Name: ${personName}
Title: ${leadData?.title || 'Unknown'}
Company: ${companyName}
Industry: ${leadData?.organization?.industry || 'Unknown'}
Company Size: ${leadData?.organization?.estimated_num_employees || 'Unknown'} employees

RESEARCH FINDINGS (WITH SOURCES):
${researchSummary}

PRODUCT BEING SOLD:
${primaryService ? `- Primary Service: ${primaryService}` : ''}
${coreOffering ? `- Core Offering: ${coreOffering}` : ''}

⚠️ PRODUCT-FIT GATE:
Ask: does this prospect's industry/role make them a direct or plausible buyer for [${primaryService || 'the product being sold'}]?
- CONFIRMED CRITERIA MATCH (right title + right industry + meets mustHave) + 2+ research facts → QUALIFIED (60+)
- CONFIRMED CRITERIA MATCH + strong timing signal + 5+ facts → HIGHLY_QUALIFIED (80+)
- CONFIRMED CRITERIA MATCH + 0-1 research facts (weak/no web presence) → SHOTGUN (40-59)
- SPECULATIVE / ADJACENT (neighboring industry, plausible but unproven) → SHOTGUN (40-59)
- GENUINELY IRRELEVANT (wrong industry, active disqualifier) → REJECT (≤35)
When in doubt between SHOTGUN and QUALIFIED: you need at least 2 real, cited facts about this company/person to reach QUALIFIED.
When in doubt between SHOTGUN and REJECT: choose SHOTGUN.

QUALIFICATION CRITERIA:
Must Have (required): ${criteria.mustHave?.join(', ') || 'None'}
Nice to Have (bonus points): ${criteria.niceToHave?.join(', ') || 'None'}
Disqualifiers (instant reject): ${criteria.disqualifiers?.join(', ') || 'None'}

TIERED EVALUATION SYSTEM:

TIER 1: HIGHLY_QUALIFIED (Score 80-100)
- Confirmed criteria match PLUS strong, specific buyer motivation with urgency/timeline
- All must-have criteria verified with research evidence
- Multiple specific facts from research confirm fit (5+ facts)
- Clear reason WHY they would buy NOW (funding, job posts, initiative, leadership change, etc.)
- Ready for deeply personalized email with cited research
- Example: Independent hotel owner, 50 rooms, uses legacy PMS, just posted about seeking upgrade solutions, budget allocated Q1 2026

TIER 2: QUALIFIED (Score 60-79)
TWO paths to QUALIFIED:
  PATH A — Research-confirmed: Decent buyer motivation with some evidence + most must-have criteria met (2-4 facts)
  PATH B — Criteria-confirmed: Right title + right industry + right company size + no disqualifiers, even if research found no specific timing signal. The absence of a buying signal is NOT a disqualifier.
- Ready for moderate personalization (use what research found, even if limited)
- Example: CTO at a mid-size SaaS company in the right industry, meets all mustHave, research found general company info but no specific initiative

TIER 3: SHOTGUN (Score 40-59)
TWO paths to SHOTGUN:
  PATH A — Speculative fit: neighboring/adjacent industry, plausible but not confirmed use case, title only partially matches mustHave
  PATH B — Criteria met but research returned nothing useful: right title + right industry BUT research found 0-1 real facts (company is too small, no web presence, no verifiable info). Criteria alone without any research substance = SHOTGUN.
- Send generic template
- Example: Director at a company that SHOULD be a good fit but research returned only LinkedIn and a homepage with no substance

TIER 4: REJECT (Score 0-39)
- Hard disqualifier found (meets disqualifiers list) OR
- Completely wrong industry/role with zero plausible use case OR
- Research confirms they explicitly do not need this product
- Do NOT send email
- Example: Chain hotel employee (when targeting independent owners), government agency (when targeting SaaS companies)

YOUR TASK:
1. Check for disqualifiers FIRST (instant REJECT if found)
2. Check mustHave criteria — criteria match is REQUIRED for QUALIFIED or above; without it you cannot exceed SHOTGUN
3. Assess research quality — count how many real, cited facts you have about this specific company/person
4. Assign tier using the HOW CRITERIA AND RESEARCH INTERACT rules above: criteria + 2+ facts = QUALIFIED, criteria + strong signal + 5+ facts = HIGHLY_QUALIFIED, criteria + 0-1 facts = SHOTGUN

🎯 HOW CRITERIA AND RESEARCH INTERACT:
- Confirmed mustHave criteria + 2+ research facts about this company → QUALIFIED (60-79)
- Confirmed mustHave criteria + strong timing signal + 5+ cited facts → HIGHLY_QUALIFIED (80+)
- Confirmed mustHave criteria + 0-1 research facts (no web presence / nothing useful found) → SHOTGUN (40-59)
- Speculative/adjacent fit regardless of research → SHOTGUN (40-59)
- Hard disqualifier OR completely wrong industry → REJECT (≤35)

Research quality is the tiebreaker between SHOTGUN and QUALIFIED when criteria are confirmed. If you could not find meaningful information about this person or company, that is a real limitation — assign SHOTGUN.

CONFIDENCE LEVEL LOGIC:
- HIGH confidence: Strong buyer motivation + 5+ cited facts + clear urgency/timeline → HIGHLY_QUALIFIED
- MEDIUM confidence: Criteria confirmed (title/industry/size) + 2-4 cited facts OR decent motivation even without timing signal → QUALIFIED
- LOW confidence: Speculative/adjacent fit, limited evidence, mustHave unverifiable → SHOTGUN

REASONING REQUIREMENTS:
- Be SPECIFIC: Reference actual facts found in research (names, numbers, technologies, initiatives)
- Cite EVIDENCE: Quote or paraphrase specific details from the sources
- Explain WHY: Connect the evidence to qualification criteria
- Be DETAILED: 3-5 sentences minimum with concrete examples
- Avoid GENERIC phrases like "meets criteria", "good fit", "strong evidence"

GOOD EXAMPLE:
"Research reveals MITA (Malta's IT Agency) recently launched a €12M digital transformation fund specifically targeting SME modernization, with Emanuel Darmanin leading the initiative as CEO. His LinkedIn shows 3 recent posts about cloud migration challenges in government systems, directly aligning with our Azure integration solutions. MITA's procurement page lists 'legacy system modernization' as a Q1 2026 priority. The company employs 150+ IT professionals and operates independently from central government IT."

BAD EXAMPLE:
"Emanuel Darmanin meets all criteria as CEO of MITA in tech industry. Strong evidence confirms good fit. Company size significant. Interest aligns with goals. Highly qualified prospect."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL REQUIREMENT: BUYER-SIDE MOTIVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST articulate a plausible buyer-side motivation before qualifying this lead.
No email may be generated unless you can answer: "WHY would this person buy from us?"

HOW TO IDENTIFY BUYER MOTIVATION (analyze research for these signals):

1. TIMING SIGNALS (strongest motivation - they need it NOW):
   - Recent funding round → spending mode, scaling initiatives
   - Job postings → hiring = growth = new problems to solve
   - Recent news/announcements → new initiatives requiring solutions
   - Fiscal year timing → budget cycles, Q1 priorities
   - Leadership changes → new direction, shake-up opportunities
   - Expansion (new markets/offices) → operational scaling needs

2. PAIN SIGNALS (they're actively suffering):
   - Public complaints/challenges mentioned in content
   - LinkedIn posts about specific problems
   - Tech stack gaps visible in job descriptions
   - Company size inflection points (50→150 employees = process breakdown)
   - Industry-specific challenges at their scale

3. INITIATIVE SIGNALS (they're already looking):
   - Active projects mentioned (digital transformation, modernization)
   - RFPs or procurement pages
   - Technology mentions in job posts (seeking specific skills)
   - Conference attendance/speaking (researching solutions)
   - Budget allocations or investment announcements

4. URGENCY INDICATORS (why NOW vs later):
   - Specific deadlines or timelines mentioned
   - Regulatory/compliance pressures
   - Competitive threats
   - Growth rate creating pressure
   - Executive visibility (CEO posting = high priority)

CONSTRUCT BUYER MOTIVATION BY COMBINING:
[TIMING SIGNAL] + [PAIN/NEED] + [URGENCY] + [EVIDENCE]

Example: "Just raised $15M Series B" [TIMING] + "scaling from 50 to 150 employees per job posts" [PAIN: scaling] + "manual processes become bottleneck at this inflection" [URGENCY: growth rate] + "finance teams spend 35% time on contractor payments at this scale" [EVIDENCE: industry benchmark]

BUYER MOTIVATION must be:
✓ SPECIFIC to their current situation (not generic pain points)
✓ EVIDENCE-BASED from the research findings
✓ TIED to their business objectives, growth stage, or initiatives
✓ ACTIONABLE - something they would realistically act on NOW
✓ SOPHISTICATED - demonstrate deep understanding of their context

GOOD BUYER MOTIVATIONS:
"MITA is in month 3 of a €12M digital transformation initiative with Q1 2026 legacy system modernization as a stated priority. Emanuel, as CEO, is personally posting about cloud migration challenges, indicating this is top-of-mind and he's actively seeking solutions. The €12M budget is allocated, timeline is urgent, and his public engagement shows he's in the decision-making phase."

"Company just raised Series B ($15M) and is scaling from 50 to 150 employees according to job postings. At this inflection point, manual contractor payment processes that worked at 50 employees become a board-level bottleneck. Finance teams at this stage spend 35% of time on payments - that's a $200K+ annual cost in wasted labor. Buyer motivation: eliminate scaling bottleneck before it becomes a crisis."

BAD BUYER MOTIVATIONS:
"They might need our solution because they're in the right industry."
"Company is growing so they probably have challenges."
"CEO would want to improve efficiency." (Too generic)
"They use legacy systems." (Not tied to current urgency)

IF YOU CANNOT ARTICULATE A SPECIFIC, EVIDENCE-BASED BUYER MOTIVATION:
→ If they MEET the mustHave criteria (right title/industry/size) → still QUALIFIED, just note "no specific timing signal found"
→ If they DO NOT meet mustHave criteria AND you can't find buyer motivation → SHOTGUN or REJECT
→ Inability to find timing signals online is NOT the same as "no motivation exists" — QUALIFIED leads get emailed anyway

Respond in JSON:
{
  "tier": "HIGHLY_QUALIFIED" | "QUALIFIED" | "SHOTGUN" | "REJECT",
  "score": 0-100,
  "qualified": true/false (false only if REJECT),
  "reasoning": "detailed explanation with specific facts, numbers, and evidence (3-5 sentences minimum)",
  "buyerMotivation": "specific, evidence-based explanation of WHY this person would buy from us RIGHT NOW (required - 2-4 sentences with concrete reasoning)",
  "keyStrengths": ["specific strength with actual evidence/data"],
  "weaknesses": ["specific concerns with reasoning"],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "citedEvidence": [
    {"fact": "specific fact from research", "source": "source title or domain", "supportsMatch": true/false}
  ],
  "emailStrategy": "deep personalization" | "moderate personalization" | "generic template" | "do not send",
  "emailHooks": [
    "Specific, concrete fact from research that could open an email — e.g. 'Baanyan is actively hiring across 3 new verticals and posted 12 engineering roles in January'",
    "A second specific hook — a tension, milestone, or problem derived from the research",
    "Optional third hook — a number, quote, or event that makes the email feel researched"
  ]
}

For emailHooks: extract the 2-3 most specific, concrete, verifiable facts from the research that a salesperson could open an email with. Not summaries like 'the company is growing' — actual details: job postings, acquisitions, product launches, customer counts, market moves, quotes from their site. If the research is thin, return 1 hook with whatever is most specific. Never invent hooks.`;

      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Log tier assignment
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'tiered_qualification',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o-mini',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            score: result.score,
            tier: result.tier,
            qualified: result.qualified
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
        // Accumulate for per-lead refund tracking
        if (this.memory.currentLeadCost !== undefined) {
          this.memory.currentLeadCost += response.usage.total_tokens * this.awsManager.apiCosts.openaiMini;
        }
      }
      
      // Build comprehensive AI Report
      const aiReport = {
        tier: result.tier || 'UNKNOWN',
        score: result.score || 0,
        confidence: result.confidence || 'UNKNOWN',
        qualified: result.qualified !== false,
        
        // Tier description for UI
        tierDescription: {
          'HIGHLY_QUALIFIED': 'Perfect match - Deep personalization with verified facts',
          'QUALIFIED': 'Good match - Moderate personalization',
          'SHOTGUN': 'Generic match - Template email only',
          'REJECT': 'Not a fit - Do not send'
        }[result.tier] || 'Unknown tier',
        
        // Email strategy guidance
        emailStrategy: result.emailStrategy || 'generic template',
        
        // Buyer-side motivation (CRITICAL for email generation)
        buyerMotivation: result.buyerMotivation || 'Not articulated',
        emailHooks: result.emailHooks || [],
        
        // Evidence and citations
        citedEvidence: result.citedEvidence || [],
        totalSources: researchData?.totalSources || 0,
        researchQuality: allCitedFacts.length >= 10 ? 'EXCELLENT' :
                        allCitedFacts.length >= 5 ? 'GOOD' :
                        allCitedFacts.length >= 2 ? 'FAIR' : 'LIMITED',
        
        // Full reasoning
        reasoning: result.reasoning,
        keyStrengths: result.keyStrengths || [],
        weaknesses: result.weaknesses || [],
        
        // Metadata
        evaluatedAt: new Date().toISOString(),
        companyName: companyName,
        contactName: personName,
        
        // All cited facts from research (for email builder to use)
        allCitedFacts: allCitedFacts
      };
      
      
      // Emit detailed activity log with tier information
      const tierEmojis = {
        'HIGHLY_QUALIFIED': '⭐',
        'QUALIFIED': '✅',
        'SHOTGUN': '🎯',
        'REJECT': '❌'
      };
      const emoji = tierEmojis[result.tier] || '❓';
      const confidenceEmoji = result.confidence === 'HIGH' ? '🟢' : result.confidence === 'MEDIUM' ? '🟡' : '🔴';
      
      // Build detailed summary with AI's full reasoning
      const detailsSummary = [
        `Tier: ${result.tier} (${result.score}/100) — ${result.confidence} confidence`,
        result.reasoning || null,
        `Strategy: ${result.emailStrategy}`,
        result.keyStrengths?.length > 0 ? `Strengths: ${result.keyStrengths.join(', ')}` : null,
        result.weaknesses?.length > 0 ? `Concerns: ${result.weaknesses.join(', ')}` : null,
        `Evidence: ${aiReport.citedEvidence.length} cited facts from ${aiReport.totalSources} sources`
      ].filter(Boolean).join(' • ');
      
      this.logOperation('Lead Qualification', 
        `${personName} at ${companyName} — ${detailsSummary}`, 
        result.qualified ? 'completed' : 'warning',
        { 
          tier: result.tier,
          score: result.score,
          company: companyName,
          confidence: result.confidence,
          researchQuality: aiReport.researchQuality,
          reasoning: result.reasoning,
          strengths: result.keyStrengths,
          weaknesses: result.weaknesses,
          emailStrategy: result.emailStrategy,
          citedEvidence: aiReport.citedEvidence.length
        }
      );
      
      if (result.weaknesses?.length > 0) {
      }
      
      console.log('[QUALIFY] ── OUTPUT ──────────────────────────────────────');
      console.log(`[QUALIFY] tier: ${result.tier} | score: ${result.score}/100 | qualified: ${result.tier !== 'REJECT'} | confidence: ${result.confidence}`);
      console.log(`[QUALIFY] citedEvidence: ${aiReport.citedEvidence.length} | researchQuality: ${aiReport.researchQuality} | reasoning: ${result.reasoning?.substring(0, 120)}`);
      return {
        success: true,
        qualified: result.tier !== 'REJECT', // derive from tier — don't trust GPT's boolean
        tier: result.tier,
        score: result.score,
        reasoning: result.reasoning,
        confidence: result.confidence,
        researchQuality: aiReport.researchQuality,
        requiresReview: result.tier === 'SHOTGUN' || result.confidence === 'LOW',
        keyStrengths: result.keyStrengths || [],
        weaknesses: result.weaknesses || [],
        aiReport: aiReport // Include full AI report for email builder and UI
      };

      
    } catch (error) {
      console.error('❌ [QUALIFY] Error:', error);
      // On error, don't block the lead - default to SHOTGUN tier
      return {
        success: true,
        qualified: true,
        tier: 'SHOTGUN',
        score: 50,
        reasoning: 'Qualification error, proceeding with generic outreach',
        keyStrengths: ['Error in qualification process'],
        weaknesses: ['Unable to complete research verification'],
        aiReport: {
          tier: 'SHOTGUN',
          score: 50,
          confidence: 'LOW',
          qualified: true,
          tierDescription: 'Generic match - Template email only (error fallback)',
          emailStrategy: 'generic template',
          citedEvidence: [],
          totalSources: 0,
          researchQuality: 'ERROR',
          reasoning: 'Qualification error occurred',
          keyStrengths: [],
          weaknesses: ['Qualification system error'],
          evaluatedAt: new Date().toISOString(),
          companyName: this.memory.currentCycle.currentLead?.organization?.name || 'Unknown',
          contactName: this.memory.currentCycle.currentLead?.name || 'Unknown',
          allCitedFacts: []
        }
      };
    }
  }

  // Research company/lead using Serper - Multi-search with personality
  async serperResearch(parameters) {
    const leadData = this.memory.currentCycle.currentLead;
    
    // Notify CRM page which contact is now being worked on
    if (leadData?._fromCRM) {
      this._emitCRMEvent('crm_contact_scanning', {
        contactId: leadData.crmId || leadData.email,
        contactName: leadData.name || leadData.first_name || leadData.email,
        company: leadData.company || leadData.organization?.name || null,
        email: leadData.email || null
      });
    }
    
    // Use provided parameters first, fallback to memory
    const companyName = parameters?.companyName || leadData?.organization?.name || leadData?.company || 'Unknown Company';
    const personName = parameters?.personName || leadData?.name || 'Unknown';
    const industry = leadData?.organization?.industry || leadData?.industry || '';
    
    
    try {
      // Get agent personality for research approach
      const personality = await this.getAgentPersonality();
      const personalityType = personality?.type || 'hunter';
      
      // Multi-search strategy: Run multiple targeted searches to verify qualification criteria
      const allResearchData = {
        searches: [],
        combinedFindings: []
      };
      
      // Always run deep research if campaign plan exists (ignore searchQuery parameter from GPT)
      console.log(`[RESEARCH BRANCH] campaignPlan: ${!!this.campaignPlan} | qualificationCriteria: ${!!this.campaignPlan?.qualificationCriteria} => ${this.campaignPlan?.qualificationCriteria ? 'DEEP (4-phase)' : 'FALLBACK (single search)'}`)
      if (this.campaignPlan && this.campaignPlan.qualificationCriteria) {
        if (parameters.searchQuery) {
        }
        
        const criteria = this.campaignPlan.qualificationCriteria;
        const searchQueries = [];
        
        // SIMPLIFIED: Only 2 searches for better depth
        
        // Search 1: Company overview with key criteria
        const keyTerms = criteria.mustHave && criteria.mustHave.length > 0
          ? criteria.mustHave
              .join(' ')
              .replace(/Active in|Company size between|Looking to|uses?|has|have|needs?|requires?|employees|[0-9-]+/gi, '')
              .split(/\s+/)
              .filter(word => word.length > 3)
              .slice(0, 2)
              .join(' ')
              .trim()
          : '';
        
        searchQueries.push({
          query: keyTerms ? `${companyName} ${keyTerms} company` : `${companyName} company overview`,
          purpose: 'company_overview',
          description: 'Company information and key criteria verification'
        });
        
        // Search 2: Recent news and growth signals
        searchQueries.push({
          query: `${companyName} news recent growth`,
          purpose: 'recent_developments',
          description: 'Recent news, growth, and developments'
        });
        
        // Search 3: LinkedIn posts by the prospect
        const nameParts = personName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts[nameParts.length - 1] || '';
        if (firstName && lastName && personName !== 'Unknown') {
          searchQueries.push({
            query: `"${firstName} ${lastName}" site:linkedin.com`,
            purpose: 'linkedin_activity',
            description: 'LinkedIn posts and activity by the prospect',
            skipWebpageFetch: true // LinkedIn blocks scrapers — extract from snippets only
          });
        }
        
        // Execute searches and fetch webpages (Phase 1-2 only - qualification research)
        
        // Import webpage fetcher
        const { fetchMultipleWebpages } = await import('../tools/webpageFetcher.js');
        
        for (const search of searchQueries) {
          
          // If using cached data, skip the search
          if (search.cachedData) {
            allResearchData.searches.push({
              purpose: search.purpose,
              query: null,
              description: search.description,
              cached: true,
              webpageInsights: search.cachedData.insights || []
            });
            continue; // Skip to next search
          }
          
          
          try {
            const results = await internetSearch(search.query);
            
            // Log API usage for search
            try {
              await this.awsManager.logApiUsage({
                userId: this.userId,
                agentId: this.agentId,
                service: 'serper',
                operation: 'search',
                usage: 1,
                metadata: {
                  companyName: companyName,
                  purpose: search.purpose,
                  timestamp: new Date().toISOString()
                }
              });
              // Accumulate for per-lead refund tracking
              if (this.memory.currentLeadCost !== undefined) {
                this.memory.currentLeadCost += this.awsManager.apiCosts.serper;
              }
            } catch (logError) {
              console.error(`   ⚠️ Failed to log API usage: ${logError.message}`);
            }
            
            // LINKEDIN: Skip webpage fetch — extract insights from Serper snippets directly
            if (search.skipWebpageFetch) {
              const organicResults = results?.organic || results?.data?.organic || [];
              const snippets = organicResults
                .slice(0, 5)
                .map(r => `[${r.title}] ${r.snippet}`)
                .filter(s => s.length > 40)
                .join('\n');
              
              const webpageInsights = [];
              if (snippets.length > 0) {
                try {
                  const linkedinPrompt = `You are analyzing LinkedIn search results snippets for ${personName}, ${leadData?.title || 'executive'} at ${companyName}.

Extract ONLY content that ${personName} AUTHORED — their own posts or articles with a real opinion, insight, or topic they wrote about.

STRICT RULES:
- ✅ Include: posts they wrote, articles they published, clear first-person opinions they expressed
- ❌ Skip: comments they left on others' posts, likes, shares, profile bio text, "X commented on Y's post", endorsements, generic activity
- ❌ Skip: anything where you're not confident ${personName} authored it (not just reacted to it)
- ❌ If only comments/reactions are found, return "NO RELEVANT DATA" — a comment is not usable

Focus on professional topics with enough substance to reference naturally in a cold email opener.

Snippets:
${snippets}

Return 1-3 bullet points max (50 words each). Format:
- [topic/opinion they posted about, with enough context to reference it]

If no authored content found, return exactly: "NO RELEVANT DATA"`;
                  
                  const linkedinResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: linkedinPrompt }],
                    temperature: 0.1,
                    max_tokens: 200
                  });
                  
                  const extractedInsights = linkedinResponse.choices[0].message.content;
                  
                  if (!extractedInsights.includes('NO RELEVANT DATA')) {
                    const insightLines = extractedInsights.split('\n').filter(line => line.trim().startsWith('-'));
                    if (insightLines.length > 0) {
                      const citedInsights = insightLines.map(insight => ({
                        text: `[LinkedIn] ${insight.replace(/^-\s*/, '').trim()}`,
                        source: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
                        sourceTitle: `${personName} on LinkedIn`,
                        confidence: 0.75
                      }));
                      webpageInsights.push({
                        source: 'linkedin.com',
                        title: `${personName} LinkedIn Activity`,
                        insights: extractedInsights,
                        citedFacts: citedInsights
                      });
                    }
                  }
                  
                  if (linkedinResponse.usage) {
                    await this.awsManager.logApiUsage({
                      userId: this.userId,
                      agentId: this.agentId,
                      service: 'openai',
                      operation: 'insight_extraction',
                      usage: linkedinResponse.usage.total_tokens,
                      metadata: { model: 'gpt-4o-mini', companyName, source: 'linkedin.com' }
                    }).catch(err => console.error('Failed to log OpenAI usage:', err));
                  }
                } catch (aiError) {
                  console.error(`   ⚠️ Failed to extract LinkedIn insights:`, aiError.message);
                }
              }
              
              allResearchData.searches.push({
                purpose: search.purpose,
                query: search.query,
                description: search.description,
                results: results,
                webpageInsights
              });
              
              await new Promise(resolve => setTimeout(resolve, 500));
              continue; // Skip standard webpage fetch path
            }
            
            // Extract top 3 URLs from organic results
            const organicResults = results?.organic || results?.data?.organic || [];
            const topUrls = organicResults
              .slice(0, 3)
              .map(r => r.link)
              .filter(url => url && !url.includes('youtube.com') && !url.includes('pdf')); // Skip videos and PDFs
            
            
            // Fetch webpage content
            const webpageContents = await fetchMultipleWebpages(topUrls, 3);
            
            // Extract relevant insights from each webpage using AI
            const webpageInsights = [];
            for (const webpage of webpageContents) {
              if (webpage.success && webpage.content) {
                try {
                  // CRITICAL: Validate that the webpage actually mentions the company
                  const companyMentioned = webpage.content.toLowerCase().includes(companyName.toLowerCase()) ||
                                          webpage.title.toLowerCase().includes(companyName.toLowerCase());
                  
                  if (!companyMentioned && search.purpose === 'user_company_success') {
                    continue;
                  }
                  
                  // Use GPT-4 to extract only relevant business insights
                  const insightPrompt = `Extract ONLY the most relevant and impressive business facts about ${companyName} from this webpage content.

CRITICAL RULES:
1. The webpage MUST explicitly mention "${companyName}" - if it doesn't, return "NO RELEVANT DATA"
2. Do NOT infer, assume, or make connections to similar-sounding companies
3. Only extract facts that directly reference "${companyName}" by name
4. If you're not 100% certain the fact is about "${companyName}", DO NOT include it

Focus on:
- Recent achievements, growth, funding (with specific numbers/dates)
- Key partnerships or clients (actual names)
- Unique value propositions or innovations
- Market position or awards (with specific award names)
- Leadership or company culture highlights
${search.purpose === 'user_company_success' ? `
🎯 SPECIAL: Also extract PLATFORM METRICS if found (for ${companyName}):
- Average returns/yields (e.g., "12-18% returns", "6-9% yields")
- Number of customers/investors/users (e.g., "50,000+ investors")
- Total capital/revenue deployed (e.g., "$500M+ deployed")
- Number of properties/locations/markets (e.g., "150+ properties in 25 countries")
- Performance comparisons (e.g., "outperformed REITs by 4.2%")
If found, prefix these with "[METRIC]" for easy extraction.` : ''}

Webpage: ${webpage.title}
Content: ${webpage.content}

Return 2-4 concise bullet points (max 50 words each) of the MOST impressive and relevant facts about ${companyName} specifically.
If ${companyName} is not mentioned or you cannot confirm facts are about ${companyName}, return exactly: "NO RELEVANT DATA"

Format as:
- [fact 1]
- [fact 2]
- [fact 3]`;

                  const insightResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini', // Use mini for cost efficiency on extraction
                    messages: [{ role: 'user', content: insightPrompt }],
                    temperature: 0.1, // Lower temperature for more factual extraction
                    max_tokens: 300
                  });
                  
                  const extractedInsights = insightResponse.choices[0].message.content;
                  
                  // Skip if no relevant data found
                  if (extractedInsights.includes('NO RELEVANT DATA')) {
                    continue;
                  }
                  
                  // Parse insights and attach source URL to each fact
                  const insightLines = extractedInsights.split('\n').filter(line => line.trim().startsWith('-'));
                  
                  // Additional validation: skip if no bullet points extracted
                  if (insightLines.length === 0) {
                    continue;
                  }
                  
                  const citedInsights = insightLines.map(insight => ({
                    text: insight.replace(/^-\s*/, '').trim(),
                    source: webpage.url,
                    sourceTitle: webpage.title,
                    confidence: 0.9 // High confidence from direct webpage content
                  }));
                  
                  webpageInsights.push({
                    source: webpage.url,
                    title: webpage.title,
                    insights: extractedInsights,
                    citedFacts: citedInsights // NEW: Individual facts with source attribution
                  });
                  
                  
                  // Log OpenAI usage
                  if (insightResponse.usage) {
                    await this.awsManager.logApiUsage({
                      userId: this.userId,
                      agentId: this.agentId,
                      service: 'openai',
                      operation: 'insight_extraction',
                      usage: insightResponse.usage.total_tokens,
                      metadata: {
                        model: 'gpt-4o-mini',
                        companyName: companyName,
                        source: webpage.url
                      }
                    }).catch(err => console.error('Failed to log OpenAI usage:', err));
                  }
                  
                } catch (aiError) {
                  console.error(`   ⚠️ Failed to extract insights:`, aiError.message);
                }
              }
            }
            
            allResearchData.searches.push({
              purpose: search.purpose,
              query: search.query,
              description: search.description,
              results: results,
              webpageInsights: webpageInsights // NEW: AI-extracted insights from full webpages
            });
            
            // Cache industry statistics for future use (if this was a stats search)
            if (search.purpose === 'industry_statistics' && webpageInsights.length > 0) {
              const cacheKey = industryKeyword.toLowerCase();
              this.memory.industryStatsCache[cacheKey] = {
                data: {
                  insights: webpageInsights,
                  query: search.query,
                  industry: industryKeyword
                },
                timestamp: Date.now()
              };
            }
            
            // Extract findings from snippets (keep for quick reference)
            if (results?.organic && results.organic.length > 0) {
              const findings = results.organic.slice(0, 3).map(r => ({
                snippet: r.snippet,
                title: r.title,
                purpose: search.purpose
              }));
              
              allResearchData.combinedFindings.push(...findings);
            } else {
            }
            
            // Delay between searches
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (searchError) {
            console.error(`   ❌ Search failed: ${searchError.message}`);
          }
        }
        
        // Build comprehensive cited facts database (Phase 1-2 only at this point)
        const allCitedFacts = allResearchData.searches
          .flatMap(search => search.webpageInsights || [])
          .flatMap(insight => insight.citedFacts || []);
        
        allResearchData.citedFacts = allCitedFacts;
        allResearchData.totalSources = new Set(allCitedFacts.map(f => f.source)).size;
        
        // Store all research data
        this.memory.lastResearch = allResearchData;
        
        // Count total insights
        const totalWebpageInsights = allResearchData.searches
          .flatMap(s => s.webpageInsights || [])
          .length;
        
        
        // Log to UI for visibility (commented out - will show after qualification)
        // this.logOperation('🔍 Phase 1-2: Prospect Research Complete', 
        //   `Gathered ${totalWebpageInsights} insights from ${allResearchData.searches.length} research streams:\n` +
        //   `• Company Overview (${allResearchData.searches.find(s => s.purpose === 'company_overview')?.webpageInsights?.length || 0} insights)\n` +
        //   `• Recent News (${allResearchData.searches.find(s => s.purpose === 'recent_developments')?.webpageInsights?.length || 0} insights)\n\n` +
        //   `📚 Key Findings:\n${allCitedFacts.slice(0, 5).map((f, i) => `${i + 1}. ${f.text.substring(0, 80)}...`).join('\n')}`,
        //   'success',
        //   {
        //     totalSources: allResearchData.totalSources,
        //     citedFactsCount: allCitedFacts.length,
        //     researchPhases: allResearchData.searches.map(s => s.purpose)
        //   }
        // );
        
      } else {
        // Fallback: Single generic search
        const searchQuery = parameters.searchQuery || `${companyName} company information business model products services`;
        
        const results = await internetSearch(searchQuery);
        
        allResearchData.searches.push({
          purpose: 'general',
          query: searchQuery,
          description: 'General company research',
          results: results
        });
        
        if (results?.data?.organic) {
          allResearchData.combinedFindings = results.data.organic.slice(0, 5).map(r => ({
            snippet: r.snippet,
            title: r.title,
            purpose: 'general'
          }));
        }
        
        this.memory.lastResearch = allResearchData;
        
        // Log API usage for single search
        try {
          await this.awsManager.logApiUsage({
            userId: this.userId,
            agentId: this.agentId,
            service: 'serper',
            operation: 'search',
            usage: 1, // 1 credit per search
            metadata: {
              companyName: companyName,
              queryLength: searchQuery.length,
              timestamp: new Date().toISOString()
            }
          });
          } catch (logError) {
          console.error('⚠️ [SERPER] Failed to log API usage:', logError);
        }
      }
      
      // Emit detailed research findings to Activity Logs
      const researchSummary = [];
      
      if (allResearchData.data?.knowledgeGraph) {
        researchSummary.push(`🧠 Knowledge Graph: ${allResearchData.data.knowledgeGraph.title} (${allResearchData.data.knowledgeGraph.type})`);
      }
      
      if (allResearchData.data?.answerBox) {
        researchSummary.push(`💡 Answer: ${allResearchData.data.answerBox.answer?.substring(0, 100)}...`);
      }
      
      if (allResearchData.data?.organic && allResearchData.data.organic.length > 0) {
        researchSummary.push(`🎯 Found ${allResearchData.data.organic.length} search results`);
        researchSummary.push(`📖 Top result: ${allResearchData.data.organic[0].title}`);
      }
      
      const summaryText = researchSummary.length > 0 
        ? researchSummary.join(' • ')
        : 'Basic search results found';
      
      this.emit('progress', {
        type: 'info',
        message: `🔍 Research Results: ${summaryText}`,
        timestamp: new Date().toISOString(),
        details: {
          company: companyName,
          query: allResearchData.searches[0]?.query || 'research query',
          resultsCount: allResearchData.data?.organic?.length || 0,
          hasKnowledgeGraph: !!allResearchData.data?.knowledgeGraph,
          hasAnswerBox: !!allResearchData.data?.answerBox
        }
      });

      // Emit detailed content findings in a separate event
      const contentFindings = [];
      
      // Add answer box content if available
      if (allResearchData.data?.answerBox) {
        contentFindings.push({
          type: 'Answer Box',
          content: allResearchData.data.answerBox.answer || allResearchData.data.answerBox.snippet,
          source: allResearchData.data.answerBox.link,
          title: allResearchData.data.answerBox.title
        });
      }
      
      // Add knowledge graph info if available
      if (allResearchData.data?.knowledgeGraph) {
        contentFindings.push({
          type: 'Knowledge Graph',
          content: allResearchData.data.knowledgeGraph.description,
          title: allResearchData.data.knowledgeGraph.title,
          attributes: allResearchData.data.knowledgeGraph.attributes
        });
      }
      
      // Add top 3 search results
      if (allResearchData.data?.organic && allResearchData.data.organic.length > 0) {
        allResearchData.data.organic.slice(0, 3).forEach((result, index) => {
          contentFindings.push({
            type: `Search Result #${index + 1}`,
            content: result.snippet,
            title: result.title,
            source: result.link
          });
        });
      }
      
      // Emit the actual content findings with AI analysis
      if (contentFindings.length > 0) {
        // Have AI analyze the research findings for strategic insights
        const aiInsights = await this.analyzeResearchFindings(companyName, contentFindings);
        
        this.emit('progress', {
          type: 'info',
          message: `🧠 Research Analysis: ${aiInsights.summary}`,
          timestamp: new Date().toISOString(),
          details: {
            company: companyName,
            contentType: 'ai_research_analysis',
            aiInsights: aiInsights,
            sourcesAnalyzed: contentFindings.length,
            rawFindings: contentFindings
          }
        });
      }
      
      // Store research results in memory for email building
      // Keep the multi-search structure intact + add legacy fields for compatibility
      const researchResults = {
        success: true,
        ...allResearchData, // Preserve searches[], combinedFindings[]
        companyName: parameters.companyName,
        contentFindings: contentFindings,
        // Legacy fields for backward compatibility
        data: allResearchData.searches?.[0]?.results, // First search results as fallback
        insights: allResearchData.combinedFindings || [],
        knowledgeGraph: allResearchData.searches?.[0]?.results?.knowledgeGraph,
        answerBox: allResearchData.searches?.[0]?.results?.answerBox
      };
      
      this.memory.lastResearch = researchResults;
      
      return researchResults;
    } catch (error) {
      console.error('❌ [SERPER] Research failed:', error);
      throw error;
    }
  }

  // Phase 3: Supporting research (industry stats + user company wins) - Only runs AFTER qualification
  async runSupportingResearch(parameters) {
    const leadData = this.memory.currentCycle.currentLead;
    const companyName = parameters?.companyName || leadData?.organization?.name || leadData?.company || 'Unknown Company';
    const industry = leadData?.organization?.industry || leadData?.industry || '';
    
    
    try {
      const supportingSearches = [];
      
      // Get key terms from campaign plan
      const criteria = this.campaignPlan?.qualificationCriteria;
      const keyTerms = criteria?.mustHave && criteria.mustHave.length > 0
        ? criteria.mustHave
            .join(' ')
            .replace(/Active in|Company size between|Looking to|uses?|has|have|needs?|requires?|employees|[0-9-]+/gi, '')
            .split(/\\s+/)
            .filter(word => word.length > 3)
            .slice(0, 2)
            .join(' ')
            .trim()
        : '';
      
      // Search 1: Industry statistics and third-party data for credibility
      const industryKeyword = industry || keyTerms.split(' ')[0] || 'business';
      
      // Check Zilliz RAG first — skip search entirely if we have fresh industry facts
      const cacheKey = industryKeyword.toLowerCase();
      const cachedStats = this.memory.industryStatsCache[cacheKey];
      const cacheMaxAge = 3 * 24 * 60 * 60 * 1000; // 3 days in ms

      let zillizFacts = { hasFresh: false, facts: [] };
      try {
        zillizFacts = await industryFacts.getFreshFacts(industryKeyword);
      } catch (zErr) {
        console.log('[IndustryFacts] Zilliz unavailable, falling back to search:', zErr.message);
      }

      if (zillizFacts.hasFresh) {
        // Store in memory so email builder can access them
        this.memory.industryFactsFromRAG = zillizFacts.facts;
        supportingSearches.push({
          query: null,
          purpose: 'industry_statistics',
          description: 'Third-party industry data (Zilliz RAG cache)',
          cachedData: { insights: zillizFacts.facts.map(f => ({ insights: `- ${f}` })) }
        });
      } else if (cachedStats && (Date.now() - cachedStats.timestamp) < cacheMaxAge) {
        supportingSearches.push({
          query: null,
          purpose: 'industry_statistics',
          description: 'Third-party industry data and statistics (cached)',
          cachedData: cachedStats.data
        });
      } else {
        supportingSearches.push({
          query: `${industryKeyword} industry statistics trends data 2024 2025`,
          purpose: 'industry_statistics',
          description: 'Third-party industry data and statistics'
        });
      }
      
      // Search 2: User's company recent successes (for social proof)
      const userCompanyName = this.memory.emailSettings?.companyBranding?.companyName
        || this.memory.userSettings?.companyName
        || this.memory.userSettings?.companyProfile?.companyName
        || null;
      
      // Check cache for user company wins (valid for 3 days)
      const companyCacheMaxAge = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
      
      // Initialize cache if doesn't exist
      if (!this.memory.companyWinsCache) {
        this.memory.companyWinsCache = {};
      }
      
      const companyCacheKey = userCompanyName ? userCompanyName.toLowerCase().replace(/\s+/g, '_') : null;

      if (!userCompanyName) {
        // No company name configured — skip this search entirely
        console.log('⚠️ [SUPPORTING RESEARCH] No company name configured, skipping company wins search');
      } else {
        const cachedCompanyWins = this.memory.companyWinsCache?.[companyCacheKey];
        if (cachedCompanyWins && (Date.now() - cachedCompanyWins.timestamp) < companyCacheMaxAge) {
          supportingSearches.push({
            query: null,
            purpose: 'user_company_success',
            description: 'Recent noteworthy achievements of user\'s company (cached)',
            cachedData: cachedCompanyWins.data
          });
        } else {
          supportingSearches.push({
            query: `${userCompanyName} news funding clients partnerships awards success 2025 2026`,
            purpose: 'user_company_success',
            description: 'Recent noteworthy achievements of user\'s company (last 6 months only)'
          });
        }
      }
      
      // Execute supporting searches
      
      const { fetchMultipleWebpages } = await import('../tools/webpageFetcher.js');
      
      for (const search of supportingSearches) {
        
        // If using cached data, skip the search
        if (search.cachedData) {
          this.memory.lastResearch.searches.push({
            purpose: search.purpose,
            query: null,
            description: search.description,
            cached: true,
            webpageInsights: search.cachedData.insights || []
          });
          continue;
        }
        
        
        try {
          const results = await internetSearch(search.query);
          
          // Log API usage
          await this.awsManager.logApiUsage({
            userId: this.userId,
            agentId: this.agentId,
            service: 'serper',
            operation: 'search',
            usage: 1,
            metadata: {
              companyName: companyName,
              purpose: search.purpose,
              timestamp: new Date().toISOString()
            }
          }).catch(err => console.error('⚠️ Failed to log API usage:', err));
          
          // Extract top 3 URLs
          const organicResults = results?.organic || results?.data?.organic || [];
          const topUrls = organicResults
            .slice(0, 3)
            .map(r => r.link)
            .filter(url => url && !url.includes('youtube.com') && !url.includes('pdf'));
          
          
          // Fetch webpage content
          const webpageContents = await fetchMultipleWebpages(topUrls, 3);
          
          // Extract insights from webpages
          const webpageInsights = [];
          for (const webpage of webpageContents) {
            if (webpage.success && webpage.content) {
              try {
                // For industry stats pages, use a separate prompt that extracts numbers/trends — not company facts
                if (search.purpose === 'industry_statistics') {
                  const industryInsightPrompt = `Extract 3-5 specific, numeric industry statistics from this webpage that a salesperson could cite in a cold email.

RULES:
- Must be a real number, percentage, dollar figure, or growth rate with context (e.g. "Global IT spending to reach $5.1T in 2024, up 8% YoY")
- No vague statements like "AI is growing fast" — must have a concrete figure
- If no concrete stats found, return exactly: NO RELEVANT DATA
- Each stat on its own line starting with "-"

Webpage: ${webpage.title}
Content: ${webpage.content}`;

                  const industryResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: industryInsightPrompt }],
                    temperature: 0.1,
                    max_tokens: 300
                  });

                  const extracted = industryResponse.choices[0].message.content;
                  if (!extracted.includes('NO RELEVANT DATA')) {
                    const lines = extracted.split('\n').filter(l => l.trim().startsWith('-'));
                    if (lines.length > 0) {
                      webpageInsights.push({
                        source: webpage.url,
                        title: webpage.title,
                        insights: extracted,
                        citedFacts: lines.map(l => ({ text: l.replace(/^-\s*/, '').trim(), source: webpage.url }))
                      });
                    }
                  }
                  continue;
                }

                const companyMentioned = webpage.content.toLowerCase().includes(userCompanyName.toLowerCase()) ||
                                        webpage.title.toLowerCase().includes(userCompanyName.toLowerCase());
                
                if (!companyMentioned && search.purpose === 'user_company_success') {
                  continue;
                }
                
                // Extract insights with metrics tagging
                const insightPrompt = `Extract ONLY the most relevant and impressive business facts about ${userCompanyName} from this webpage content.

CRITICAL RULES:
1. The webpage MUST explicitly mention \"${userCompanyName}\" - if it doesn't, return \"NO RELEVANT DATA\"
2. Do NOT infer, assume, or make connections to similar-sounding companies
3. Only extract facts that directly reference \"${userCompanyName}\" by name
4. If you're not 100% certain the fact is about \"${userCompanyName}\", DO NOT include it

Focus on:
- Recent achievements, growth, funding (with specific numbers/dates)
- Key partnerships or clients (actual names)
- Unique value propositions or innovations
- Market position or awards (with specific award names)
- Leadership or company culture highlights
${search.purpose === 'user_company_success' ? `
🎯 SPECIAL: Also extract PLATFORM METRICS if found (for ${userCompanyName}):
- Average returns/yields (e.g., \"12-18% returns\", \"6-9% yields\")
- Number of customers/investors/users (e.g., \"50,000+ investors\")
- Total capital/revenue deployed (e.g., \"$500M+ deployed\")
- Number of properties/locations/markets (e.g., \"150+ properties in 25 countries\")
- Performance comparisons (e.g., \"outperformed REITs by 4.2%\")
If found, prefix these with \"[METRIC]\" for easy extraction.` : ''}

Webpage: ${webpage.title}
Content: ${webpage.content}

Return 2-4 concise bullet points (max 50 words each) of the MOST impressive and relevant facts about ${userCompanyName} specifically.
If ${userCompanyName} is not mentioned or you cannot confirm facts are about ${userCompanyName}, return exactly: \"NO RELEVANT DATA\"

Format as:
- [fact 1]
- [fact 2]
- [fact 3]`;

                const insightResponse = await this.openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [{ role: 'user', content: insightPrompt }],
                  temperature: 0.1,
                  max_tokens: 300
                });
                
                const extractedInsights = insightResponse.choices[0].message.content;
                
                if (extractedInsights.includes('NO RELEVANT DATA')) {
                  continue;
                }
                
                const insightLines = extractedInsights.split('\\n').filter(line => line.trim().startsWith('-'));
                
                if (insightLines.length === 0) {
                  continue;
                }
                
                const citedInsights = insightLines.map(insight => ({
                  text: insight.replace(/^-\\s*/, '').trim(),
                  source: webpage.url,
                  sourceTitle: webpage.title,
                  confidence: 0.9
                }));
                
                webpageInsights.push({
                  source: webpage.url,
                  title: webpage.title,
                  insights: extractedInsights,
                  citedFacts: citedInsights
                });
                
                
                // Log OpenAI usage
                if (insightResponse.usage) {
                  await this.awsManager.logApiUsage({
                    userId: this.userId,
                    agentId: this.agentId,
                    service: 'openai',
                    operation: 'insight_extraction',
                    usage: insightResponse.usage.total_tokens,
                    metadata: {
                      model: 'gpt-4o-mini',
                      companyName: userCompanyName,
                      source: webpage.url
                    }
                  }).catch(err => console.error('Failed to log OpenAI usage:', err));
                }
                
              } catch (aiError) {
                console.error(`   ⚠️ Failed to extract insights:`, aiError.message);
              }
            }
          }
          
          // Add to existing research
          this.memory.lastResearch.searches.push({
            purpose: search.purpose,
            query: search.query,
            description: search.description,
            results: results,
            webpageInsights: webpageInsights
          });
          
          // Cache industry statistics
          if (search.purpose === 'industry_statistics' && webpageInsights.length > 0) {
            this.memory.industryStatsCache[cacheKey] = {
              data: {
                insights: webpageInsights,
                query: search.query,
                industry: industryKeyword
              },
              timestamp: Date.now()
            };

            // Upsert facts into Zilliz RAG for future leads in the same industry
            try {
              const factStrings = ZillizIndustryFacts.extractFactStrings(webpageInsights);
              if (factStrings.length > 0) {
                await industryFacts.upsertFacts(industryKeyword, factStrings);
              }
            } catch (zErr) {
              console.log('[IndustryFacts] Upsert skipped:', zErr.message);
            }
          }
          
          // Cache user company wins
          if (search.purpose === 'user_company_success' && webpageInsights.length > 0) {
            this.memory.companyWinsCache[companyCacheKey] = {
              data: {
                insights: webpageInsights,
                query: search.query,
                company: userCompanyName
              },
              timestamp: Date.now()
            };
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (searchError) {
          console.error(`   ❌ Search failed: ${searchError.message}`);
        }
      }
      
      // Store raw user company intel for email prompt injection
      // Don't use narrow regex - let the email AI extract what's relevant for any product type
      const userCompanySuccessData = this.memory.lastResearch.searches.find(s => s.purpose === 'user_company_success');
      const platformMetrics = {}; // kept for legacy compat
      if (userCompanySuccessData?.webpageInsights) {
        const rawIntel = userCompanySuccessData.webpageInsights
          .filter(w => w.insights && !w.insights.includes('NO RELEVANT DATA'))
          .map(w => w.insights)
          .join('\n');
        this.memory.platformMetrics = rawIntel.length > 50 ? { raw: rawIntel } : {};
      } else {
        this.memory.platformMetrics = {};
      }
      
      // Build comprehensive cited facts
      const allCitedFacts = this.memory.lastResearch.searches
        .flatMap(search => search.webpageInsights || [])
        .flatMap(insight => insight.citedFacts || []);
      
      this.memory.lastResearch.citedFacts = allCitedFacts;
      this.memory.lastResearch.totalSources = this.memory.lastResearch.searches
        .flatMap(s => s.webpageInsights || []).length;
      
      // Count insights by type
      const totalWebpageInsights = this.memory.lastResearch.searches
        .flatMap(s => s.webpageInsights || [])
        .length;
      
      
      // Log to UI
      this.logOperation('🎯 Phase 3: Supporting Research Complete',
        `Gathered email supporting data:\\n` +
        `• Industry Stats (${this.memory.lastResearch.searches.find(s => s.purpose === 'industry_statistics')?.webpageInsights?.length || 0} insights)\\n` +
        `• Your Company Wins (${this.memory.lastResearch.searches.find(s => s.purpose === 'user_company_success')?.webpageInsights?.length || 0} insights)\\n` +
        `${Object.keys(platformMetrics).length > 0 ? `\\n📊 Platform Metrics Extracted:\\n${Object.entries(platformMetrics).map(([k, v]) => `• ${k}: ${v}`).join('\\n')}` : ''}`,
        'success',
        {
          platformMetrics: platformMetrics,
          industryStatsCount: this.memory.lastResearch.searches.find(s => s.purpose === 'industry_statistics')?.webpageInsights?.length || 0,
          companyWinsCount: this.memory.lastResearch.searches.find(s => s.purpose === 'user_company_success')?.webpageInsights?.length || 0
        }
      );
      
      return { success: true, platformMetrics };
      
    } catch (error) {
      console.error('❌ [PHASE 3] Supporting research failed:', error);
      return {
        success: false,
        error: error.message,
        companyName: parameters.companyName
      };
    }
  }

  // Unlock email using Apollo - WORKING ENRICH METHOD
  async unlockEmail(parameters) {
    try {
      const apiKey = await this.getApiKey('apollo');
      if (!apiKey) {
        throw new Error('Apollo API key not configured');
      }

      // FAST PATH: if we already have this lead's Apollo ID (from a prior
      // mixed_people/search), skip the redundant re-search entirely and go
      // straight to people/enrich. Saves 1 credit per lead (search + enrich
      // -> just enrich) vs. the name/company re-search path below.
      let targetPerson = null;
      if (parameters.apolloId) {
        targetPerson = { id: parameters.apolloId };
      }

      if (!targetPerson) {
      // STEP 1: First search for the person to get their Apollo ID
      const searchPayload = {
        per_page: 10,
        page: 1,
        reveal_personal_emails: true,
        reveal_phone_number: true
      };
      
      // Only filter by location if we DON'T have a domain (domain is more specific)
      // This allows us to find people globally when we have their company domain
      if (!parameters.domain) {
        searchPayload.person_locations = ["United States"];
      }
      
      // Search by person name first for better accuracy
      if (parameters.firstName && parameters.lastName) {
        searchPayload.q_person_name = `${parameters.firstName} ${parameters.lastName}`;
      }
      
      // Add company targeting (try multiple approaches)
      if (parameters.domain) {
        searchPayload.q_organization_domains = [parameters.domain];
      } else if (parameters.companyName) {
        // Use both keyword tags and organization name for better matching
        searchPayload.q_organization_keyword_tags = [parameters.companyName.toLowerCase()];
        searchPayload.q_organization_name = parameters.companyName;
      }

      // Emit API call metric
      this.updateIntegrationStatus('apollo', { status: 'active' });
      
      const searchResponse = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify(searchPayload)
      });

      if (!searchResponse.ok) {
        this.updateIntegrationStatus('apollo', { status: 'error' });
        const errorMsg = searchResponse.status === 401 ? 'Apollo API authentication failed - check API key' : 
                        searchResponse.status === 429 ? 'Apollo API rate limit exceeded' :
                        `Apollo search failed with status ${searchResponse.status}`;
        this.logIssue('error', errorMsg, { 
          status: searchResponse.status,
          searchPayload,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      let searchData = await searchResponse.json();
      
      // Log Apollo search usage for email unlock
      await this.awsManager.logApiUsage({
        userId: this.userId,
        agentId: this.agentId,
        service: 'apollo',
        operation: 'person_search',
        usage: 1, // 1 credit per search
        metadata: {
          personName: `${parameters.firstName} ${parameters.lastName}`,
          companyName: parameters.companyName,
          domain: parameters.domain || 'none',
          resultsFound: searchData.people?.length || 0
        }
      }).catch(err => console.error('Failed to log Apollo search usage:', err));
      
      // Emit metric: leads found
      if (searchData.people && searchData.people.length > 0) {
        this.emitMetric('leads', 'searched', 1, 'increment');
        this.emitMetric('leads', 'found', searchData.people.length, 'increment');
        this.updateIntegrationStatus('apollo', { status: 'healthy', usage: searchData.people.length });
      }
      
      if (!searchData.people || searchData.people.length === 0) {
        
        // FALLBACK 1: Try without domain filtering if we used a domain
        if (parameters.domain) {
          const fallbackPayload = {
            per_page: 10,
            page: 1,
            reveal_personal_emails: true,
            reveal_phone_number: true
            // NO location filter - search globally
          };
          
          if (parameters.firstName && parameters.lastName) {
            fallbackPayload.q_person_name = `${parameters.firstName} ${parameters.lastName}`;
          }
          
          if (parameters.companyName) {
            fallbackPayload.q_organization_name = parameters.companyName;
          }
          
          const fallbackResponse = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Api-Key': apiKey
            },
            body: JSON.stringify(fallbackPayload)
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (fallbackData.people && fallbackData.people.length > 0) {
              // Continue with fallback data
              searchData = fallbackData;
              
              // Log fallback search usage
              await this.awsManager.logApiUsage({
                userId: this.userId,
                agentId: this.agentId,
                service: 'apollo',
                operation: 'person_search_fallback',
                usage: 1, // 1 credit per search
                metadata: {
                  personName: `${parameters.firstName} ${parameters.lastName}`,
                  companyName: parameters.companyName,
                  fallbackType: 'global_search',
                  resultsFound: fallbackData.people?.length || 0
                }
              }).catch(err => console.error('Failed to log Apollo fallback search usage:', err));
            }
          }
        }
        
        // If still no results, return error
        if (!searchData.people || searchData.people.length === 0) {
          return {
            success: false,
            error: 'No people found in search (tried with and without domain)'
          };
        }
      } // end of "if no results from initial search, try fallback"

      // Find matching person with flexible matching
      targetPerson = searchData.people.find(p =>
        p.first_name?.toLowerCase() === parameters.firstName?.toLowerCase() &&
        p.last_name?.toLowerCase() === parameters.lastName?.toLowerCase()
      );

      // If exact match fails, try partial name matching
      if (!targetPerson && parameters.firstName && parameters.lastName) {
        targetPerson = searchData.people.find(p =>
          p.first_name?.toLowerCase().includes(parameters.firstName.toLowerCase()) ||
          p.last_name?.toLowerCase().includes(parameters.lastName.toLowerCase())
        );
      }

      // Final fallback to first person if from same company
      if (!targetPerson && parameters.companyName) {
        targetPerson = searchData.people.find(p =>
          p.organization?.name?.toLowerCase().includes(parameters.companyName.toLowerCase())
        );
      }

      // Ultimate fallback
      if (!targetPerson) {
        targetPerson = searchData.people[0];
      }
      } // end of !targetPerson (apolloId fast path) block

      // STEP 2: Use enrich endpoint to unlock actual emails
      
      // Check rate limit BEFORE enrichment
      const rateCheck = await this.awsManager.checkApiRateLimit(
        this.userId,
        'apollo',
        1 // 1 credit per enrichment
      ).catch(err => {
        console.error('⚠️ Rate limit check failed, allowing request:', err);
        return { allowed: true };
      });

      if (!rateCheck.allowed) {
        const resetTime = new Date(rateCheck.resetTime).toLocaleString();
        throw new Error(
          `Apollo ${rateCheck.reason} rate limit exceeded. ` +
          `Current usage: ${rateCheck.current}/${rateCheck.limit} credits. ` +
          `Resets at: ${resetTime}`
        );
      }

      const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify({
          id: targetPerson.id,
          reveal_personal_emails: true
        })
      });

      if (!enrichResponse.ok) {
        const errorMsg = enrichResponse.status === 401 ? 'Apollo API authentication failed during enrichment' :
                        enrichResponse.status === 429 ? 'Apollo enrichment rate limit exceeded' :
                        enrichResponse.status === 404 ? 'Apollo person not found for enrichment' :
                        `Apollo enrichment failed with status ${enrichResponse.status}`;
        this.logIssue('error', errorMsg, {
          status: enrichResponse.status,
          personId: targetPerson.id,
          personName: targetPerson.name,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Enrich failed: ${enrichResponse.status}`);
      }

      const enrichData = await enrichResponse.json();
      
      // Log Apollo email enrichment usage
      await this.awsManager.logApiUsage({
        userId: this.userId,
        agentId: this.agentId,
        service: 'apollo',
        operation: 'email_enrichment',
        usage: 1, // 1 credit per enrichment
        metadata: {
          personName: `${parameters.firstName} ${parameters.lastName}`,
          company: parameters.organization
        }
      }).catch(err => console.error('Failed to log Apollo enrichment usage:', err));
      
      if (enrichData && enrichData.person) {
        const person = enrichData.person;
        const workEmail = person.email;
        const personalEmails = person.personal_emails || [];
        

        
        // Accept ANY email from Apollo, including constructed/guessed emails
        // The bounce handler will validate if they're real
        const allEmails = [workEmail, ...personalEmails].filter(email => {
          return email && 
                 email.trim() !== '' && 
                 !email.includes('email_not_unlocked') &&
                 email.includes('@'); // Basic email format check
        });
        
        if (allEmails.length > 0) {
        }
        
        // Validate email with ZeroBounce before accepting (non-blocking)
        const emailToValidate = allEmails[0]; // Use first available email
        if (emailToValidate) {
          const zeroBounceResult = await this.validateEmailWithZeroBounce(emailToValidate);
          
          // Only reject if ZeroBounce says it's spamtrap or do_not_mail (accept catch-all and unknown)
          if (['spamtrap', 'do_not_mail'].includes(zeroBounceResult.status?.toLowerCase())) {
            console.log(`[ZEROBOUNCE] Email rejected: ${zeroBounceResult.status} - ${zeroBounceResult.reason}`);
            this.logIssue('warning', `Email rejected for ${emailToValidate}`, {
              email: emailToValidate,
              status: zeroBounceResult.status,
              reason: zeroBounceResult.reason,
              person: `${person.first_name} ${person.last_name}`,
              company: person.organization?.name
            });
            return {
              success: false,
              error: `Email rejected: ${zeroBounceResult.status}`
            };
          }
          
        }
        
        // Check if we have valid emails (already filtered above)
        if (allEmails.length > 0) {
          console.log('✅ [APOLLO] Email unlocked successfully!');
          
          // Add activity log for SSE stream
          this.logOperation('🔓 Email Found', `${allEmails[0]} for ${person.first_name} ${person.last_name} at ${person.organization?.name}`, 'success', {
            type: 'email_unlocked',
            email: allEmails[0],
            personName: `${person.first_name} ${person.last_name}`,
            company: person.organization?.name,
            totalEmails: allEmails.length
          });
          
          return {
            success: true,
            email: allEmails[0], // Primary email
            all_emails: allEmails,
            person: person
          };
        } else {
          console.log('❌ [APOLLO] No emails available after filtering (empty or contains email_not_unlocked)');
        }
      }

      console.log('❌ [APOLLO] No emails found - Apollo did not return any email addresses');
      return {
        success: false,
        error: 'No email addresses available from Apollo (not even constructed emails)'
      };

    } catch (error) {
      console.error('❌ [APOLLO] Email unlock failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validate email using ZeroBounce API
  async validateEmailWithZeroBounce(email) {
    try {
      const apiKey = process.env.ZEROBOUNCE_API_KEY;
      if (!apiKey) {
        return { isValid: true, status: 'skipped', reason: 'No API key' };
      }

      const response = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorMsg = response.status === 401 ? 'ZeroBounce API authentication failed - check API key' :
                        response.status === 429 ? 'ZeroBounce rate limit exceeded' :
                        `ZeroBounce API error: ${response.status}`;
        this.logIssue('error', errorMsg, {
          status: response.status,
          email: email,
          timestamp: new Date().toISOString()
        });
        throw new Error(`ZeroBounce API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Log ZeroBounce usage (1 credit per validation)
      await this.awsManager.logApiUsage({
        userId: this.userId,
        agentId: this.agentId,
        service: 'zerobounce',
        operation: 'email_validation',
        usage: 1,
        metadata: {
          email: email,
          status: data.status,
          sub_status: data.sub_status
        }
      });
      
      // ZeroBounce status values: valid, invalid, catch-all, unknown, spamtrap, abuse, do_not_mail
      // Accept: valid, catch-all, unknown, invalid (let bounce handler deal with it)
      // Reject only: spamtrap, do_not_mail
      const validStatuses = ['valid', 'catch-all', 'unknown', 'invalid'];
      const isValid = validStatuses.includes(data.status.toLowerCase());
      
      return {
        isValid: isValid,
        status: data.status,
        subStatus: data.sub_status,
        account: data.account,
        domain: data.domain,
        reason: data.sub_status || data.status
      };
    } catch (error) {
      console.error('❌ [ZEROBOUNCE] Validation error:', error);
      // If ZeroBounce fails, default to accepting the email
      return { isValid: true, status: 'validation_error', reason: error.message };
    }
  }

  // Build personalized email
  async buildPersonalizedEmail(parameters) {
    try {
      // Run Phase 3 supporting research (industry stats + user company wins) if not already done
      const hasPhase3Data = this.memory.lastResearch?.searches?.some(s => 
        s.purpose === 'industry_statistics' || s.purpose === 'user_company_success'
      );
      
      if (!hasPhase3Data) {
        await this.runSupportingResearch(parameters);
      } else {
      }

      // Get data from current cycle state.
      // IMPORTANT: parameters.leadData takes priority so concurrent workers don't clobber each other.
      const leadData = parameters?.leadData || this.memory.currentCycle.currentLead;
      // Capture qualification snapshot at call-time (concurrent-safe)
      const _localQualification = parameters?.qualificationData || this.memory.currentQualification;

      // Query industry facts RAG with prospect-specific context for maximum relevance
      // This runs regardless of whether phase 3 was cached — always get the best stat for THIS lead
      const _ragIndustry = leadData?.organization?.industry || '';
      const _ragTopic = `${leadData?.title || ''} ${_localQualification?.buyerMotivation || ''}`.trim();
      if (_ragIndustry) {
        try {
          const targeted = await industryFacts.queryRelevantFacts(_ragIndustry, _ragTopic || _ragIndustry, 4);
          if (targeted.length > 0) {
            this.memory.industryFactsFromRAG = targeted;
            // Record this industry as used for this user (for UI filtering) — fire and forget
            this.awsManager.getUserSettings(this.userId).then(settings => {
              const existing = settings?.usedIndustryFacts || [];
              const ind = _ragIndustry.toLowerCase();
              if (!existing.includes(ind)) {
                return this.awsManager.saveUserSettings(this.userId, {
                  ...settings,
                  usedIndustryFacts: [...existing, ind]
                });
              }
            }).catch(() => {});
          }
        } catch (e) {
          // non-fatal — falls back to whatever was set during research phase
        }
      }
      const researchData = parameters?.researchData || this.memory.lastResearch;
      const emailSettings = parameters?.emailSettings || this.memory.emailSettings;
      // Use the snapshot captured above (concurrent-safe)
      const qualification = _localQualification;
      
      if (!leadData) {
        throw new Error('No current lead data available for email building');
      }
      
      // Extract proper field values from Apollo lead data
      const contactName = leadData.name || (leadData.first_name && leadData.last_name ? 
        `${leadData.first_name} ${leadData.last_name}` : 'there');
      const contactTitle = leadData.title || 'team member';
      
      // Get company name from correct Apollo field structure
      const companyName = leadData.organization?.name || leadData.company || leadData.organization_name;
      if (!companyName) {
        throw new Error('No company name found in lead data - cannot generate personalized email');
      }
      
      const industry = leadData.organization?.industry || 'business';
      const employeeCount = leadData.organization?.estimated_num_employees || 'Unknown';
      
      // Determine personalization tier from AI Report
      const aiReport = qualification?.aiReport;
      const tier = aiReport?.tier || qualification?.tier || 'SHOTGUN';
      
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🎯 CRITICAL VALIDATION: BUYER-SIDE MOTIVATION REQUIRED
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      const buyerMotivation = aiReport?.buyerMotivation || qualification?.buyerMotivation;
      
      // Check if buyer motivation is articulated and sophisticated
      const hasValidMotivation = buyerMotivation && 
        buyerMotivation !== 'Not articulated' &&
        buyerMotivation.length > 50 && // Must be substantial
        !buyerMotivation.toLowerCase().includes('might need') &&
        !buyerMotivation.toLowerCase().includes('probably') &&
        !buyerMotivation.toLowerCase().includes('could benefit');
      
      if (!hasValidMotivation) {
        const errorMsg = !buyerMotivation || buyerMotivation === 'Not articulated' 
          ? '❌ [BUYER MOTIVATION] Not articulated - cannot generate email'
          : '❌ [BUYER MOTIVATION] Too generic or speculative - requires specific evidence-based reasoning';
        
        
        this.logOperation('Email Generation Blocked', 
          `No plausible buyer-side motivation articulated for ${leadData.first_name} ${leadData.last_name}. ` +
          `Email generation requires specific, evidence-based understanding of WHY they would buy. ` +
          `Current motivation: ${buyerMotivation || 'Not provided'}`,
          'error',
          { 
            leadName: `${leadData.first_name} ${leadData.last_name}`,
            companyName: companyName,
            tier: tier,
            buyerMotivation: buyerMotivation || 'NONE',
            reason: 'Missing or insufficient buyer motivation'
          }
        );
        
        throw new Error(
          'Email generation blocked: Cannot articulate plausible buyer-side motivation. ' +
          'Lead needs deeper research or different qualification tier. ' +
          `Motivation provided: ${buyerMotivation || 'NONE'}`
        );
      }

      const resolvedMotivation = buyerMotivation;
      
      const topEmailFacts = this.selectTopEmailFacts(aiReport, companyName, 4);
      const compactResearchFacts = this.summarizeResearchForEmail(researchData, companyName, 3);
      const companyProofPoints = this.summarizeCompanyProofPoints(this.memory.platformMetrics?.raw, 2);
      const ragFacts = (this.memory.industryFactsFromRAG || []).slice(0, 2).map(fact => this.truncateForPrompt(fact, 140));

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 📄 TEMPLATE MODE: Skip AI generation, fill merge tags
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const agentTemplates = emailSettings.emailBuilder?.templates || emailSettings.templates || [];
      const useTemplates = emailSettings.emailBuilder?.useTemplates ?? emailSettings.useTemplates ?? false;
      if (useTemplates && agentTemplates.length > 0) {
        // Pick template — rotate by a hash of the lead email so it's stable per lead
        const hashIndex = leadData.email
          ? leadData.email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % agentTemplates.length
          : Math.floor(Math.random() * agentTemplates.length);
        const tpl = agentTemplates[hashIndex];

        // Resolve merge tag values from available data
        const tplSignatureName = emailSettings.emailBuilder?.useCustomSignature
          ? (emailSettings.emailBuilder?.signatureName || 'Sales Representative')
          : (emailSettings.companyBranding?.agentName || 'AI Assistant');

        const painPoint = (() => {
          const raw = qualification?.buyerMotivation || topEmailFacts[0] || compactResearchFacts[0] || '';
          // Trim to a short phrase (first sentence, max 120 chars)
          const sentence = raw.split('.')[0].trim();
          return sentence.length > 120 ? sentence.substring(0, 120) + '…' : sentence;
        })();

        const recentNews = (() => {
          const raw = topEmailFacts[0] || compactResearchFacts[0] || '';
          const sentence = raw.split('.')[0].trim();
          return sentence.length > 120 ? sentence.substring(0, 120) + '…' : sentence;
        })();

        const fillTags = (text) => (text || '')
          .replace(/\{\{firstName\}\}/g, leadData.first_name || '')
          .replace(/\{\{lastName\}\}/g, leadData.last_name || '')
          .replace(/\{\{company\}\}/g, companyName || '')
          .replace(/\{\{role\}\}/g, contactTitle || '')
          .replace(/\{\{painPoint\}\}/g, painPoint)
          .replace(/\{\{recentNews\}\}/g, recentNews)
          .replace(/\{\{senderName\}\}/g, tplSignatureName);

        let tplBody = fillTags(tpl.body);
        let tplSubject = tpl.subject ? fillTags(tpl.subject) : null;

        // If no subject on template, generate a cheap one
        if (!tplSubject) {
          try {
            const subRes = await this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: `Write a subject line (max 8 words, no quotes) for this cold email:\n\n${tplBody}` }],
              temperature: 0.6,
              max_tokens: 20,
            });
            tplSubject = subRes.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
          } catch {
            tplSubject = `Quick question for ${leadData.first_name || companyName}`;
          }
        }

        // Append compliance footer
        const { generateUnsubscribeToken } = await import('../routes/unsubscribe.js');
        const unsubscribeToken = generateUnsubscribeToken(leadData.email);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const unsubscribeUrl = `${frontendUrl}/unsubscribe?token=${unsubscribeToken}&uid=${this.userId}`;
        const companyWebsite = emailSettings.companyBranding?.companyWebsite || '';
        const footerParts = [emailSettings.companyBranding?.companyName || 'Our Company'];
        if (companyWebsite) {
          const displayHost = companyWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '');
          footerParts.push(`<a href="${companyWebsite}" style="color:#6b7280;text-decoration:none;">${displayHost}</a>`);
        }
        const tplFooter = `\n\n${footerParts.join(' | ')}\n<a href="${unsubscribeUrl}">Stop emails</a>`;

        console.log(`📄 [TEMPLATE MODE] Using template "${tpl.name}" for ${leadData.first_name} ${leadData.last_name} @ ${companyName}`);
        return {
          success: true,
          email: tplBody + tplFooter,
          subject: tplSubject,
          confidenceReport: `Template mode — skipped AI qualification analysis.`,
          confidenceLevel: 'medium',
          salesAngle: null,
          templateUsed: tpl.name,
        };
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🧠 SALES STRATEGIST: Forced pre-write reasoning chain
      // Answers 6 questions before a single word of email is written.
      // Output drives the angle — not the product features.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let salesAngle = null;
      try {
        const ragStats = ragFacts.length > 0
          ? ragFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')
          : 'None available';

        const strategistPrompt = [
          `You are an elite B2B sales strategist — not a copywriter, not an assistant.`,
          `Your only job: find the sharpest possible angle for a cold email BEFORE a single word is written.`,
          `Output is NOT the email. It is the *thinking* that determines whether the email is undeniable or forgettable.`,
          ``,
          `━━ PROSPECT ━━`,
          `Name: ${leadData.first_name} ${leadData.last_name}`,
          `Title: ${contactTitle}`,
          `Company: ${companyName}`,
          `Industry: ${industry}`,
          `Size: ${employeeCount} employees`,
          ``,
          `━━ PRODUCT BEING SOLD ━━`,
          `Product/Service: ${emailSettings.companyBranding?.primaryService || 'Unknown'}`,
          `Key advantages: ${emailSettings.companyBranding?.keyAdvantages || 'Unknown'}`,
          `Selling company: ${emailSettings.companyBranding?.companyName || 'Unknown'}`,
          ``,
          `━━ COMPANY-SPECIFIC RESEARCH ━━`,
          topEmailFacts.length > 0
            ? topEmailFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')
            : 'No specific company facts found.',
          ``,
          `━━ VERIFIED INDUSTRY STATISTICS (RAG knowledge base) ━━`,
          ragStats,
          ``,
          `━━ QUALIFICATION TEAM ASSESSMENT ━━`,
          resolvedMotivation,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `ANSWER THESE 6 QUESTIONS. No filler. Vague = failure.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `1. CAREER FEAR — not a company pain point, a personal one. What is this specific person in this specific role afraid of getting wrong? What outcome would make them look bad to their boss, board, or peers? Be role-specific, not generic.`,
          ``,
          `2. DEFERRED DECISION — What is one thing this person almost certainly knows they should address, but keeps pushing back? What's the rational-sounding excuse they tell themselves for not acting yet?`,
          ``,
          `3. WINNING MOVE — If they act on our product and it works, what does THIS specific person get credit for internally? Name the outcome in terms of their own role, reputation, or decision-making — not a company metric. No peer groups, no "like other firms", no unnamed social proof. The win is personal and specific to them.`,
          ``,
          ``,
          `4. TOP OBJECTION — What is the single most likely reason they will NOT reply? State it plainly. Then in one sentence, explain how the email should preempt it without addressing it directly.`,
          ``,
          `5. SHARPEST INTERSECTION — Given the company research AND the industry stats above, what is the single most specific tension you can name that connects THEIR situation to OUR product? This is the email's argument. It must be a claim about their world — not our features. If an industry stat creates an insight the prospect wouldn't naturally make themselves, use it. That's what makes the email feel smart.`,
          ``,
          `6. ONE-LINE ANGLE — The argument in one sentence. Form: "Because [something specifically true about their world right now], [a consequence they haven't fully reckoned with], and [product] is the clearest way to [resolve it specifically]." If you cannot complete this with actual specifics from the research, write "INSUFFICIENT DATA:" and explain what's missing.`,
          ``,
          `Then:`,
          `SUBJECT_TYPE: "statement" = bold claim you can defend with a specific named fact | "tension" = a named gap, misalignment, or unresolved problem | "intrigue" = the frame alone creates curiosity, no question asked`,
          `SUBJECT: The actual subject line. Max 8 words. NEVER a question — rephrase any question as a statement, named fact, or named tension. Use a specific thing from the research — a deal, person, event, or gap — not a generic observation.`,
          `The subject should create mild discomfort or sharp curiosity. Safe, diplomatic, or corporate subjects will be ignored.`,
          `GOOD: specific claim about their world, a named tension, a named fact from the research, a blunt company + noun combo`,
          `BAD: any question, generic FOMO, vague compliments, anything that sounds like a marketing headline`,
          ``,
          ...(employeeCount && parseInt(employeeCount) >= 500 ? [
            `⚠️  ENTERPRISE TONE RULE: This company has ${employeeCount} employees — they are a large, established organization.`,
            `DO NOT use framing that implies they are naive, behind, or missing something obvious. They have smart people.`,
            `Peer-level framing only. You are a peer with a specific insight, not a challenger showing them what they missed.`,
            `SUBJECT TYPE for large enterprises: "statement" or "intrigue" only.`,
          ] : []),
          ``,
          `Respond ONLY in JSON:`,
          `{`,
          `  "careerFear": "...",`,
          `  "deferredDecision": "...",`,
          `  "winningMove": "...",`,
          `  "topObjection": "...",`,
          `  "sharpestIntersection": "...",`,
          `  "oneLineAngle": "...",`,
          `  "subjectType": "statement | tension | intrigue",`,
          `  "suggestedSubject": "..."`,
          `}`
        ].join('\n');

        const strategistResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: strategistPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.4,
          max_tokens: 900
        });

        salesAngle = JSON.parse(strategistResponse.choices[0].message.content);
        console.log(`[SALES STRATEGIST] ${companyName} | type=${salesAngle.subjectType} | subject="${salesAngle.suggestedSubject}"`);
        console.log(`[SALES STRATEGIST] Angle: ${salesAngle.oneLineAngle?.substring(0, 100)}`);

        if (strategistResponse.usage) {
          await this.awsManager.logApiUsage({
            userId: this.userId,
            agentId: this.agentId,
            service: 'openai',
            operation: 'sales_strategist_reasoning',
            usage: strategistResponse.usage.total_tokens,
            metadata: {
              model: 'gpt-4o',
              prompt_tokens: strategistResponse.usage.prompt_tokens,
              completion_tokens: strategistResponse.usage.completion_tokens,
              companyName,
              subjectType: salesAngle.subjectType
            }
          }).catch(err => console.error('Failed to log strategist usage:', err));
        }
      } catch (err) {
        console.error('[SALES STRATEGIST] Reasoning step failed, continuing without angle:', err.message);
      }

      // Get agent personality for email style
      const personality = await this.getAgentPersonality();
      
      // Get calendar link from user settings
      const calendarLink = this.memory.userSettings?.calendarIntegrationEnabled && this.memory.userSettings?.calendarTokens
        ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar/book/${this.userId}`
        : (this.memory.userSettings?.calendly_link || this.memory.userSettings?.calendar_link || 'your scheduling link');
      
      // Get custom prompt from email builder settings (editable in UI) - this is the personality/style
      // Replace [SCHEDULING_LINK] placeholder with actual calendar link
      let customPrompt = emailSettings.customPrompt || emailSettings.emailBuilder?.customPrompt || null;
      if (customPrompt) {
        customPrompt = customPrompt.replace(/\[SCHEDULING_LINK\]/g, calendarLink);
        customPrompt = this.truncateForPrompt(customPrompt, 500);
      }
      
      // Build campaign-specific messaging if plan exists
      let campaignStrategy = '';
      
      if (this.campaignPlan && this.campaignPlan.emailMessaging) {
        const messaging = this.campaignPlan.emailMessaging;
        campaignStrategy = [
          `Campaign value: ${this.truncateForPrompt(messaging.primaryValue || 'Standard benefits', 140)}`,
          `Key points: ${this.truncateForPrompt(messaging.keyPoints?.join(', ') || 'Standard benefits', 160)}`,
          `CTA style: ${this.truncateForPrompt(messaging.callToAction || 'Schedule a call', 80)}`,
          `Tone: ${messaging.tone || 'professional'}`
        ].join('\n');
        
      }
      
      // Add SALES ANGLE context — the pre-reasoned argument that drives the entire email
      const buyerMotivationContext = salesAngle
        ? [
          `ANGLE: ${this.truncateForPrompt(salesAngle.oneLineAngle, 180)}`,
          `TENSION: ${this.truncateForPrompt(salesAngle.sharpestIntersection, 180)}`,
          `OBJECTION: ${this.truncateForPrompt(salesAngle.topObjection, 140)}`,
          `SUBJECT: ${this.truncateForPrompt(salesAngle.suggestedSubject, 60)}`
        ].join('\n')
        : `BUYER MOTIVATION: ${this.truncateForPrompt(resolvedMotivation, 220)}`;
      
      
      // Build research findings summary for the prompt
      const researchFindings = compactResearchFacts.length > 0
        ? compactResearchFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')
        : 'No extra research facts.';

      const ragFactsBlock = ragFacts.length > 0
        ? ragFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')
        : 'No verified industry stats.';

      // ── SYSTEM PROMPT (rules — Claude treats these as inviolable constraints) ──────
      const personalityType = (personality?.type || 'hunter')
        .toUpperCase()
        .replace(/-/g, ' ')  // replace ALL hyphens, not just the first
        .replace('RELATIONSHIP BUILDER', 'RELATIONSHIP')
        .trim();
      console.log(`🎭 [EMAIL BUILDER] personalityType resolved: "${personalityType}" (from raw: "${personality?.type}")`);

      // ── SOFT STYLE NUDGE POOLS (personality-specific, 3 sampled per email) ────────
      const softRulePools = {
        HUNTER: [
          'One sentence in this email exists purely because you noticed something interesting.',
          'Let the reader finish one thought themselves. You do not need to close every loop.',
          'Dry is more charismatic than trying to be charming. One raised eyebrow, then move on.',
          'One beat of self-awareness, then immediately back to business.',
          'The most interesting line in this email should feel slightly unexpected.',
          'Do not soften the observation. If it is true, say it plainly.',
          'One sentence that sounds like something said out loud, not written.',
        ],
        RELATIONSHIP: [
          'Admit something small. You spent too long reading about them, something surprised you, you were not sure whether to reach out.',
          'One sentence that exists purely because the writer found it genuinely interesting, not because it earns the reply.',
          'Warmth comes from specificity, not from warmth. Name something real.',
          'One parenthetical that is slightly unguarded.',
          'Do not perform enthusiasm. Real curiosity is quieter than that.',
          'Let one sentence be a little vulnerable. Not much. Just a crack.',
          'One moment where you are more interested in them than in the reply.',
          'Do not rush to the product. The opener earns the right to get there.',
          'One sentence that sounds like something a smart friend would say, not a salesperson.',
          'If you are genuinely surprised by something you found, say so. Once, briefly.',
        ],
        ANALYST: [
          'Say less than expected. Let the implication carry the weight.',
          'One precise word instead of three vague ones.',
          'Restraint is the personality here. Do not perform confidence. It is already present in the logic.',
          'If you could explain more, do not. The reader can follow.',
          'The most interesting thing in this email should feel like a quiet observation, not a reveal.',
          'One sentence a sharp person would want to think about after reading.',
          'Do not decorate facts. State them flat and let them work.',
          'If a sentence can be cut without losing meaning, cut it. The email gets smarter.',
          'One moment where the logic lands slightly ahead of where the reader expects.',
          'Confidence looks like not needing to be believed. State it and move on.',
        ],
        CONSULTANT: [
          'One conspiratorial beat. You and the reader are in on something together.',
          'Assume they already half-know what you are about to say. Speak from that assumption.',
          'One sentence that reframes how they see their own situation, slightly.',
          'Knowing is different from showing off. Quiet, not impressive.',
          'One line that implies you have seen this before. Not as social proof, just as context.',
          'Let one sentence feel like it is just between the two of you.',
          'Do not sell the product. Sell the clarity of the observation.',
          'One moment of "you have probably thought about this". Collegial, not condescending.',
          'The best line here should feel like advice from a trusted peer, not a pitch.',
          'One sentence that sounds like something said in a room, not in a deck.',
        ],
        NETWORKER: [
          'Reference the human texture. Who is talking about this, what the room feels like.',
          'One sentence that makes the reader feel like they are already in a conversation that is happening.',
          'Light, moves fast. Do not try too hard.',
          'One socially fluent observation about the pattern or the moment in this space.',
          'The best line here should feel like something said at dinner, not in a slide.',
          'One beat of "you have probably noticed this too". Inclusive, not assuming.',
          'Do not be formal. This personality reads like a sharp person in a good mood.',
          'One sentence that sounds like you have been watching the space and found something worth sharing.',
          'Let one line feel slightly off-the-cuff, like it came to you mid-sentence.',
          'The email should feel like the start of a conversation, not the start of a process.',
        ],
      };

      const nudgePool = softRulePools[personalityType] || softRulePools['HUNTER'];
      const _nudgeArr = [...nudgePool];
      for (let i = _nudgeArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_nudgeArr[i], _nudgeArr[j]] = [_nudgeArr[j], _nudgeArr[i]];
      }
      const selectedNudges = _nudgeArr.slice(0, 3);

      const personalityDispositions = {
        HUNTER: 'Direct and observational. You noticed something specific — a number, a move, a pattern — and you lead with it, plainly, without preamble. No warmth required, but no aggression either. The opener is a real moment of noticing, not a declaration that you are about to pitch. Do not announce what the email is doing. Just start with the observation. The edge comes from the specificity of what you noticed, not from the tone.',
        RELATIONSHIP: 'Warm and perceptive. Lead with genuine curiosity or a specific detail that earns the right to continue. The edge is in the specificity, not performed warmth. Sound like a smart person who finds this genuinely interesting — not a salesperson being friendly on purpose.',
        ANALYST: 'Inference-driven. Form a take from a specific data point or pattern in the research. The opinion sounds like a logical conclusion someone arrived at, not a feeling. State the inference flatly and let it work.',
        CONSULTANT: 'Strategic peer. Sound like a trusted advisor who already half-knows the situation. Slightly knowing, not impressive. A quiet reframe of how they might see their own position — collegial, not condescending.',
        NETWORKER: 'Socially aware. Name what is happening in this space right now — what people in this industry are noticing or talking about. The reader feels like part of a moment, not a pitch list. Never name other clients, unnamed groups, or fabricated peer companies.',
      };

      const personalityOpeners = {
        HUNTER: '"Was looking at [specific fact] and it stuck with me", "[Company] came up while I was reading about [topic] - one number stood out", "Noticed [specific thing] in your recent [news/report/move] and had a thought", "Ran across [specific fact] and it raised a question"',
        RELATIONSHIP: '"Randomly landed on [company] and spent longer than I should have reading about what you\'re doing", "Was telling a colleague about [specific thing] this morning and realized I hadn\'t reached out", "Something about [specific thing you do] made me want to ask directly", "Sat with this for a few days before deciding to send it"',
        ANALYST: '"[Company]\'s position in [space] didn\'t quite add up until I saw [fact]", "[Company] keeps showing up somewhere I didn\'t expect", "[Fact] is an unusual combination, made me want to understand it better", "The numbers here don\'t follow the usual pattern - [specific observation]"',
        CONSULTANT: '"Was in a conversation last week about exactly this kind of situation", "Something came up with another team in [space] and it made me think of [company]", "Was reviewing some notes and one thing kept coming back", "Had a conversation recently that made [company]\'s situation click differently for me"',
        NETWORKER: '"A few people in [industry] have mentioned [topic] lately and I wanted to get your take", "Keep hearing [company] come up in conversations about [space]", "Was just talking about [topic] and your name came up more than once", "The conversation in [space] has shifted lately - curious if you\'re seeing the same thing"',
      };

      const disposition = personalityDispositions[personalityType] || personalityDispositions.HUNTER;
      const openers = personalityOpeners[personalityType] || personalityOpeners.HUNTER;

      const claudeSystemPrompt = `HARD RULE: Never use the em dash character (—) anywhere in your output. Not once.

Write observations. Do not narrate them. If you describe a situation, do not follow it with a sentence that tells the reader what to conclude from it. Cut every sentence that starts with "That means", "That math", "That doesn't", "That's the", "That's why", or any variation that summarizes what the previous sentence already showed. Do not announce your point. Make it and move on.

Simple words. No performance. Each sentence exists because it adds a new fact or detail, not because it sounds smart.

You noticed something about a company and you are writing a short message to someone there. You are not a salesperson. You are a person who found something interesting and decided to reach out.

PERSONALITY: ${personalityType}
DISPOSITION: ${disposition}

OPENER PATTERNS - weave one into the opening sentence. Adapt freely, do not copy verbatim. These are fabricated moments, that is intentional:
${openers}

STYLE NUDGES - apply all three to this email:
${selectedNudges.map((n, i) => `${i + 1}. ${n}`).join('\n')}

RULES:
- SUBJECT LINE: short, specific, sounds like a human wrote it in 3 seconds. Reference something real from the research. Never a question.
- Never use the em dash character (—). Never.
- Never reference unnamed client groups. No unverifiable social proof.
- Everything after the opener must come from provided facts. No invented stats or results.
- End with a single short CTA — one sentence asking for a call or conversation. Not a question with a question mark, just a direct ask.
- Do not use the "not X, it's Y" sentence structure. No contrast pivots. Just say the thing.
- ${{
  'short': 'Write one paragraph only. 3-4 sentences maximum. Target under 60 words for the body. The greeting ("Hi [FirstName],") goes on its own line, then ONE tight block of text, then the signature. Cut ruthlessly.',
  'medium': 'Write one paragraph only. 4-5 sentences maximum. Target 80-120 words for the body. The greeting ("Hi [FirstName],") goes on its own line, then ONE block of text, then the signature.',
  'long': 'Write 2-3 short paragraphs. Target 150-200 words total. The greeting ("Hi [FirstName],") goes on its own line. Each paragraph is 2-3 sentences and serves a different purpose.',
}[emailSettings?.length || emailSettings?.emailBuilder?.length || 'medium'] || 'Write one paragraph only. 4-5 sentences maximum. The greeting ("Hi [FirstName],") goes on its own line, then ONE block of text, then the signature.'}${(emailSettings?.maxWords || emailSettings?.emailBuilder?.maxWords) ? ` Hard cap: body must be ${emailSettings?.maxWords || emailSettings?.emailBuilder?.maxWords} words or fewer.` : ''}
- Banned words: mismatch, streamline, cutting-edge, leverage, robust, revolutionize, game-changer, scalable, operationally, stack, scale.

Output exactly:
SUBJECT: [subject]

BODY:
Hi [FirstName],

[body paragraph]`;

      // ── USER MESSAGE (lead-specific data + instructions) ─────────────────────────
      const signatureName = emailSettings.emailBuilder?.useCustomSignature
        ? (emailSettings.emailBuilder?.signatureName || 'Sales Representative')
        : (emailSettings.companyBranding?.agentName || 'AI Assistant');
      const signatureTitle = emailSettings.emailBuilder?.useCustomSignature
        ? (emailSettings.emailBuilder?.signatureTitle ? emailSettings.emailBuilder.signatureTitle + '\n' : '')
        : '';
      const signatureCompany = `${emailSettings.companyBranding?.companyName || 'Our Company'}${!emailSettings.emailBuilder?.useCustomSignature ? ' ' + (emailSettings.companyBranding?.agentTitle || 'Representative') : ''}`;

      const claudeUserPrompt = `Year: ${new Date().getFullYear()}

${customPrompt ? `WRITING GUIDANCE:\n${customPrompt}\n\n` : ''}PROSPECT:
- Company: ${companyName}
- Contact: ${leadData.first_name} ${leadData.last_name}
- Title: ${contactTitle}
- Industry: ${industry}
- Employees: ${employeeCount}

BUYER CONTEXT:
${buyerMotivationContext}

TOP FACTS:
${topEmailFacts.length > 0 ? topEmailFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n') : 'No top facts available.'}

EXTRA RESEARCH:
${researchFindings}

INDUSTRY STATS:
${ragFactsBlock}

SOLUTION:
- Product: ${this.truncateForPrompt(emailSettings.companyBranding?.primaryService || 'Business solutions and services', 120)}
- Benefits: ${this.truncateForPrompt(emailSettings.companyBranding?.keyAdvantages || 'Improved efficiency, streamlined operations, better results', 180)}
- Company: ${emailSettings.companyBranding?.companyName || 'Our Company'}
${companyProofPoints.length > 0 ? `- Proof points:\n${companyProofPoints.map((fact, i) => `  ${i + 1}. ${fact}`).join('\n')}` : ''}

${campaignStrategy ? `CAMPAIGN:\n${campaignStrategy}\n` : ''}SUBJECT:
${salesAngle
  ? `Suggested: "${this.truncateForPrompt(salesAngle.suggestedSubject, 60)}". Use this or write a sharper statement/intrigue subject grounded in the research. NEVER a question.`
  : 'Write a sharp subject tied to the specific tension.'}

SIGNATURE:
Best,
${signatureName}
${signatureTitle}${signatureCompany}

Write the email now. First sentence must be specific to this company.`;

      const promptMetrics = this.logEmailPromptMetrics({
        companyName,
        contactName,
        systemPrompt: claudeSystemPrompt,
        userPrompt: claudeUserPrompt
      });

      const createEmail = () => this.withEmailGenerationSlot(() =>
        this.mistral.chat.completions.create({
          model: 'mistral-medium-latest',
          max_tokens: 300,
          temperature: 0.9,
          messages: [
            { role: 'system', content: claudeSystemPrompt },
            { role: 'user', content: claudeUserPrompt }
          ]
        })
      );

      let emailResponse;
      try {
        emailResponse = await createEmail();
      } catch (error) {
        if (error?.status === 429) {
          console.warn('⚠️ [EMAIL BUILDER] Mistral rate limit hit, retrying after cooldown');
          await this.waitForRetryAfter(error.headers, 15000);
          emailResponse = await createEmail();
        } else {
          throw error;
        }
      }

      const emailContent = emailResponse.choices[0].message.content
        .replace(/\u2014/g, ' - ')  // em dash
        .replace(/\u2013/g, ' - ')  // en dash
        .replace(/\*\*/g, '');      // bold markdown

      // Log API usage
      const claudeInputTokens = emailResponse.usage?.prompt_tokens || 0;
      const claudeOutputTokens = emailResponse.usage?.completion_tokens || 0;
      console.log(
        `📊 [EMAIL PROMPT ACTUAL] ${contactName} @ ${companyName} | ` +
        `actualInput=${claudeInputTokens} actualOutput=${claudeOutputTokens} | ` +
        `estimatedInput=${promptMetrics.totalTokens}`
      );
      await this.awsManager.logApiUsage({
        userId: this.userId,
        agentId: this.agentId,
        service: 'mistral',
        operation: 'email_generation',
        usage: claudeInputTokens + claudeOutputTokens,
        metadata: {
          model: 'mistral-medium-latest',
          prompt_tokens: claudeInputTokens,
          completion_tokens: claudeOutputTokens,
          companyName: companyName,
          leadName: contactName
        }
      }).catch(err => console.error('Failed to log Mistral usage:', err));
      
      // Extract body from AI response
      let body;
      let extractedSubject = null;
      
      if (emailContent.includes('SUBJECT:') && emailContent.includes('BODY:')) {
        const parts = emailContent.split('BODY:');
        body = parts[1].trim();
        
        // Try to extract the subject from the first part
        const subjectMatch = parts[0].match(/SUBJECT:\s*(.+?)$/im);
        if (subjectMatch) {
          extractedSubject = subjectMatch[1].trim();
        }
      } else {
        body = emailContent;
      }
      
      const originalBody = body;
      
      // Remove "SUBJECT:" variants (case insensitive)
      body = body.replace(/^SUBJECT:\s*[^\n]+\n+/gi, '').trim();
      body = body.replace(/^Subject:\s*[^\n]+\n+/gi, '').trim();
      body = body.replace(/^Subject Line:\s*[^\n]+\n+/gi, '').trim();
      
      // Remove quoted subject lines at start
      body = body.replace(/^['"].*?['"]\n+/s, '').trim();
      
      // Remove any line at the very start that looks like a subject (short, ends before first paragraph)
      // This catches edge cases where GPT outputs: "quick question\n\nHello..."
      const lines = body.split('\n');
      if (lines.length > 2 && lines[0].length < 80 && lines[0].length > 5 && !lines[0].includes('Hello') && !lines[0].includes('Hi ') && !lines[0].match(/^Dear /i) && lines[1] === '') {
        // First line is short, second is blank - likely a subject line
        body = lines.slice(2).join('\n').trim();
      }
      
      if (originalBody !== body) {
        // cleaned up subject line from body
      }
      
      // 🚀 SUBJECT LINE SELECTION
      // If sales strategist produced a subject, use it directly — no need for a second generation call.
      // Only run the dynamic generator as fallback when no strategist ran.
      let subject = 'Quick question'; // Fallback only if everything else fails

      if (salesAngle?.suggestedSubject && salesAngle.suggestedSubject.length > 5) {
        // Strategist already reasoned about the best subject — trust it
        subject = salesAngle.suggestedSubject;
        console.log(`[SUBJECT] Using strategist subject (type=${salesAngle.subjectType}): "${subject}"`);
      } else if (extractedSubject && extractedSubject.length > 5) {
        // Email body contained a subject line — use that
        subject = extractedSubject;
        console.log(`[SUBJECT] Using extracted subject from body: "${subject}"`);
      } else {
      // No strategist output — fall back to dynamic generation
      try {
        const isLargeEnterprise = employeeCount && parseInt(employeeCount) >= 500;
        const subjectPrompt = `Read this cold sales email and write a subject line that will make the recipient open it.

EMAIL BODY:
${body}

LEAD:
- Name: ${leadData.first_name} ${leadData.last_name}
- Company: ${companyName}
- Title: ${leadData.title}
- Company size: ${employeeCount || 'unknown'} employees

RULES FOR THE SUBJECT LINE:
- Under 50 characters
- Provocative — a bold statement, a named flaw, a sharp claim, or a pointed question. Any format works if it's specific and creates discomfort or curiosity.
- Must connect directly to the specific argument in the email body
- Sentence case, no exclamation marks, no spam words
- Read like something a sharp human wrote, not a marketing template${isLargeEnterprise ? `
- ENTERPRISE RULE: This is a large company (${employeeCount} employees). NO questions implying they are naive/missing something obvious (e.g. "Is X ready for Y?"). Use a statement or intriguing frame instead.` : ''}

GOOD SUBJECT STYLE: specific claim, named flaw, sharp tension, or pointed non-obvious question. Generated from actual facts in the email — never from examples.
BAD SUBJECT STYLE: generic FOMO, vague compliments, marketing headline, blog title, anything that doesn't come from the email content.

Output ONLY the subject line. Nothing else.`;

        const subjectResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: subjectPrompt }],
          temperature: 0.7,
          max_tokens: 30
        });

        const dynamicSubject = subjectResponse.choices[0].message.content.trim()
          .replace(/^["']|["']$/g, '') // Remove quotes if AI adds them
          .replace(/^Subject:\s*/i, '') // Remove "Subject:" prefix if present
          .substring(0, 80); // Enforce 80 char limit

        // Log subject generation API usage
        if (subjectResponse.usage) {
          await this.awsManager.logApiUsage({
            userId: this.userId,
            agentId: this.agentId,
            service: 'openai',
            operation: 'subject_line_generation',
            usage: subjectResponse.usage.total_tokens,
            metadata: {
              model: 'gpt-4o-mini',
              prompt_tokens: subjectResponse.usage.prompt_tokens,
              completion_tokens: subjectResponse.usage.completion_tokens,
              generated_subject: dynamicSubject
            }
          }).catch(err => console.error('Failed to log subject gen usage:', err));
        }

        if (dynamicSubject && dynamicSubject.length > 5) {
          subject = dynamicSubject;
        }
      } catch (error) {
        console.error('❌ [SUBJECT GEN] Failed to generate dynamic subject:', error.message);
      }
      } // end fallback dynamic subject generator

      // Generate lead qualification confidence report
      const analysisPrompt = `Analyze this lead's qualification and likelihood to respond positively.

LEAD DETAILS:
- Name: ${leadData.first_name} ${leadData.last_name}
- Title: ${leadData.title}
- Company: ${companyName}
- Industry: ${industry}

RESEARCH DATA QUALITY:
${topEmailFacts.length > 0 ? topEmailFacts.join('\n') : 'Limited research data available'}

QUALIFICATION INSIGHTS:
${leadData.qualificationScore ? `Qualification Score: ${leadData.qualificationScore}/100` : 'Not scored'}
${leadData.keyStrengths ? `Strengths: ${leadData.keyStrengths}` : ''}
${leadData.weaknesses ? `Concerns: ${leadData.weaknesses}` : ''}

YOUR TASK: Assess this lead's potential in 4 sentences or less:
1. Research quality: How much relevant data did we find about this lead/company?
2. Fit assessment: How well does their role/company match what we're offering?
3. Response likelihood: Based on their profile, how likely are they to engage?
4. Overall confidence: Low/Medium/High confidence this lead will convert

Be analytical and realistic. Focus on the LEAD'S quality, not the email quality.`;

      const analysisResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      const confidenceReport = analysisResponse.choices[0].message.content.trim();
      
      // Log analysis API usage
      if (analysisResponse.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'lead_confidence_analysis',
          usage: analysisResponse.usage.total_tokens,
          metadata: {
            model: 'gpt-4o-mini',
            prompt_tokens: analysisResponse.usage.prompt_tokens,
            completion_tokens: analysisResponse.usage.completion_tokens
          }
        }).catch(err => console.error('Failed to log analysis usage:', err));
      }

      // Extract confidence level from report - look for conversion likelihood
      let confidenceLevel = 'medium';
      const reportLower = confidenceReport.toLowerCase();
      
      // Check for explicit confidence markers in various formats
      if (reportLower.includes('high confidence') || 
          reportLower.includes('strong confidence') || 
          reportLower.includes('confidence: high') ||
          reportLower.includes('confidence level: high') ||
          reportLower.includes('likely to convert') ||
          reportLower.includes('high likelihood')) {
        confidenceLevel = 'high';
      } else if (reportLower.includes('low confidence') || 
                 reportLower.includes('weak confidence') || 
                 reportLower.includes('confidence: low') ||
                 reportLower.includes('confidence level: low') ||
                 reportLower.includes('unlikely to convert') ||
                 reportLower.includes('low likelihood')) {
        confidenceLevel = 'low';
      } else if (reportLower.includes('medium confidence') || 
                 reportLower.includes('moderate confidence') ||
                 reportLower.includes('confidence: medium')) {
        confidenceLevel = 'medium';
      }
      
      
      // Legal compliance footer (company branding + unsubscribe link) is now appended
      // fresh at actual send time (routes/emailQueue.js, utils/sendingScheduleProcessor.js,
      // utils/emailScheduler.js) instead of being baked into the draft here — keeps it out
      // of the editable preview so reviewers can't accidentally edit or strip it.

      return {
        success: true,
        email: body,
        subject: subject,
        confidenceReport: confidenceReport,
        confidenceLevel: confidenceLevel,
        salesAngle: salesAngle || null
      };
    } catch (error) {
      console.error('❌ [EMAIL BUILDER] Failed to create email:', error);
      return {
        success: false,
        error: error.message,
        email: 'Email generation failed',
        subject: 'Follow-up'
      };
    }
  }

  // Execute Apollo search with reasoning
  async leadSearch(parameters) {
    
    try {
      const apiKey = await this.getApiKey('apollo');
      if (!apiKey) {
        throw new Error('Apollo API key not configured');
      }

      // Use REAL user settings from memory - NO hardcoded fallbacks
      const userSettings = this.memory.userSettings;
      
      if (!userSettings) {
        console.error('❌ [APOLLO] User settings not loaded yet!');
        return {
          success: false,
          error: 'User settings must be loaded before searching for leads'
        };
      }
      
      // STEP 1: Build base keyword list from user industries (if not already done)
      // Initialize arrays and objects if they don't exist (safety check after reset)
      if (!this.memory.baseIndustryKeywords) {
        this.memory.baseIndustryKeywords = [];
      }
      if (!this.memory.aiGeneratedKeywords) {
        this.memory.aiGeneratedKeywords = [];
      }
      if (!this.memory.aiGeneratedPositions) {
        this.memory.aiGeneratedPositions = [];
      }
      if (!this.memory.industryExhaustion) {
        this.memory.industryExhaustion = {};
      }
      if (!this.memory.searchHistoryDB) {
        this.memory.searchHistoryDB = new Map();
      }
      if (this.memory.currentIndustryIndex === undefined) {
        this.memory.currentIndustryIndex = 0;
      }
      if (this.memory.currentKeywordIndex === undefined) {
        this.memory.currentKeywordIndex = 0;
      }
      if (this.memory.cycleOffset === undefined) {
        this.memory.cycleOffset = 0;
      }
      if (this.memory.leadsFoundWithCurrentKeyword === undefined) {
        this.memory.leadsFoundWithCurrentKeyword = 0;
      }
      if (this.memory.totalLeadsFoundThisCycle === undefined) {
        this.memory.totalLeadsFoundThisCycle = 0;
      }
      if (this.memory.aiKeywordCycleCount === undefined) {
        this.memory.aiKeywordCycleCount = 0;
      }
      
      if (this.memory.baseIndustryKeywords.length === 0 && userSettings.companyIndustries) {
        this.memory.baseIndustryKeywords = userSettings.companyIndustries.flatMap(ind =>
          ind.split(/\s*&\s*/).map(k => k.trim().toLowerCase())
        );
      }
      
      // STEP 1.5: Check if campaign specifies a priority industry to search first
      if (!this.memory.campaignPriorityKeyword && this.campaignPlan?.searchStrategy?.priorityIndustries?.length > 0) {
        // Extract first keyword from priority industry
        const priorityIndustry = this.campaignPlan.searchStrategy.priorityIndustries[0];
        const candidateKeyword = priorityIndustry.split(/\s*&\s*/)[0].trim().toLowerCase();
        // Reject if permanently exhausted OR already high-dup (>20%) in Zilliz memory
        const candidateDupRate = this.memory.industryExhaustion?.[candidateKeyword]?.cumulativeDuplicateRate || 0;
        const candidateExhausted = this.memory.exhaustedCampaignKeywords?.has(candidateKeyword) || candidateDupRate > 40;
        if (!candidateExhausted) {
          this.memory.campaignPriorityKeyword = candidateKeyword;
          this.memory.leadsFoundWithCurrentKeyword = 0;
        } else {
          console.log(`[CAMPAIGN PRIORITY] Skipping "${candidateKeyword}" — ${candidateDupRate.toFixed(1)}% dup rate, falling through to normal rotation`);
        }
      }
      
      // STEP 2: SYNCHRONIZED KEYWORD + POSITION ROTATION (Paired by Index)
      let selectedKeyword = null;
      let selectedPositionIndex = null;
      let keywordSource = 'base';
      
      // Priority 1: Campaign-specific keyword (until high duplicate rate)
      // IMPORTANT: clear campaign priority BEFORE the rotation reset below so that
      // the rotation (which sets leadsFoundWithCurrentKeyword=0) doesn't prevent
      // us from seeing the 999 signal that means "move on from this keyword".
      if (this.memory.campaignPriorityKeyword && this.memory.leadsFoundWithCurrentKeyword >= 999) {
        if (!this.memory.exhaustedCampaignKeywords) this.memory.exhaustedCampaignKeywords = new Set();
        this.memory.exhaustedCampaignKeywords.add(this.memory.campaignPriorityKeyword);
        this.memory.campaignPriorityKeyword = null; // Clear before reset so normal rotation takes over
      }

      if (this.memory.campaignPriorityKeyword && this.memory.leadsFoundWithCurrentKeyword < 999) {
        selectedKeyword = this.memory.campaignPriorityKeyword;
        keywordSource = 'campaign';
        selectedPositionIndex = 0; // Use first position for campaign priority
      } else {
        
        // Get base and AI arrays
        const baseKeywords = this.memory.baseIndustryKeywords;
        const basePositions = this.memory.originalTargetPositions || userSettings.targetPositions || [];
        const aiKeywords = this.memory.aiGeneratedKeywords;
        const aiPositions = this.memory.aiGeneratedPositions || [];
        
        const totalBaseKeywords = baseKeywords.length;
        const totalAIKeywords = aiKeywords.length;
        const totalKeywords = totalBaseKeywords + totalAIKeywords;
        
        if (totalKeywords === 0 || basePositions.length === 0) {
          console.log(`[ERR] No keywords or positions available for search`);
          return { found: 0, leads: [], error: 'Industry keywords or positions not configured' };
        }
        
        // Check if we need to rotate to next pair (triggered by high duplicate rate)
        if (this.memory.leadsFoundWithCurrentKeyword >= 999) {
          this.memory.currentKeywordIndex++;
          this.memory.leadsFoundWithCurrentKeyword = 0;
        }
        
        // Track cycle offset for infinite variety (increases after full cycle)
        if (!this.memory.cycleOffset) this.memory.cycleOffset = 0;
        
        // Fast-forward past already-exhausted keywords so we don't waste a full
        // round-trip (LLM reason call + leadSearch call) just to hit pre-skip.
        // At most iterate totalKeywords times; if all are exhausted we fall through
        // to the pre-skip handler below which will trigger AI keyword generation.
        for (let _skip = 0; _skip < totalKeywords; _skip++) {
          const _idx = this.memory.currentKeywordIndex % totalKeywords;
          const _kw = _idx < totalBaseKeywords
            ? baseKeywords[_idx]
            : aiKeywords[_idx - totalBaseKeywords];
          const _dup = this.memory.industryExhaustion[_kw]?.cumulativeDuplicateRate || 0;
          if (_dup > 40) {
            console.log(`[KEYWORD FAST-FORWARD] Skipping exhausted keyword "${_kw}" (${_dup.toFixed(1)}% dup) — advancing index`);
            this.memory.currentKeywordIndex++;
          } else {
            break; // Found a viable keyword
          }
        }

        const resolvedKeywordIndex = this.memory.currentKeywordIndex % totalKeywords;
        if (resolvedKeywordIndex < totalBaseKeywords) {
          // Use base keyword from user settings
          selectedKeyword = baseKeywords[resolvedKeywordIndex];
          keywordSource = 'base';
          // Pair with matching position index + cycle offset for variety
          selectedPositionIndex = (resolvedKeywordIndex + this.memory.cycleOffset) % basePositions.length;
        } else {
          // Use AI-generated keyword
          const aiIndex = resolvedKeywordIndex - totalBaseKeywords;
          selectedKeyword = aiKeywords[aiIndex];
          keywordSource = 'ai';
          // Pair with matching AI position + cycle offset
          selectedPositionIndex = (aiIndex + this.memory.cycleOffset) % aiPositions.length;
        }
        
        // Determine the actual position being used
        const currentSearchPosition = (resolvedKeywordIndex < totalBaseKeywords) 
          ? basePositions[selectedPositionIndex] 
          : aiPositions[selectedPositionIndex];
        
        // Update agent state and broadcast current search via SSE when keyword/position changes
        const searchKey = `${selectedKeyword}#${currentSearchPosition}`;
        if (!this.memory.lastSearchKey || this.memory.lastSearchKey !== searchKey) {
          this.memory.lastSearchKey = searchKey;
          
          // Update agent state in AWS
          await this.awsManager.saveAgentState(this.userId, this.agentId, {
            currentSearchIndustry: selectedKeyword,
            currentSearchPosition: currentSearchPosition,
            searchSource: keywordSource,
            cycleOffset: this.memory.cycleOffset,
            leadsFoundWithCurrentPair: this.memory.leadsFoundWithCurrentKeyword,
            lastSearchUpdate: Date.now()
          });
          
          // Emit SSE update
          this.emit('progress', {
            type: 'search-update',
            agentId: this.agentId,
            currentSearch: {
              industry: selectedKeyword,
              position: currentSearchPosition,
              source: keywordSource,
              progress: `${this.memory.leadsFoundWithCurrentKeyword}/20`,
              cycleOffset: this.memory.cycleOffset
            },
            timestamp: new Date().toISOString()
          });
          
        }
        
        // STEP 2.5: Generate dynamic target positions when keyword changes AND after 20 leads
        if (this.memory.lastKeywordUsed !== selectedKeyword) {
          
          // Only generate new positions after we've used the original instructions/settings for 20 leads
          if (this.memory.totalLeadsFoundThisCycle >= 20 && !this.memory.originalTargetPositions) {
            // Store original positions first time
            this.memory.originalTargetPositions = [...(userSettings.targetPositions || [])];
          }
          
          if (this.memory.totalLeadsFoundThisCycle >= 20 && this.memory.originalTargetPositions) {
            // After 20 leads, start dynamically adapting positions
            await this.generateDynamicTargetPositions(
              selectedKeyword, 
              this.memory.originalTargetPositions,
              this.settings.specialInstructions
            );
          } else {
          }
          
          this.memory.lastKeywordUsed = selectedKeyword;
        }
        
        // STEP 3: Generate new AI keywords+positions after cycling through all base + existing AI pairs
        if (this.memory.currentKeywordIndex % totalKeywords === 0 && this.memory.leadsFoundWithCurrentKeyword === 0) {
          // Just completed full cycle!
          
          // Increment cycle offset for next cycle variety
          this.memory.cycleOffset++;
          
          if (this.memory.aiGeneratedKeywords.length < 5) {
            // Generate new AI keyword+position pairs
            await this.generateRelatedIndustryKeywordsAndPositions(
              userSettings.companyIndustries,
              this.memory.originalTargetPositions || userSettings.targetPositions
            );
          } else {
            // Reset AI keywords after using 5 generated pairs
            this.memory.aiGeneratedKeywords = [];
            this.memory.aiGeneratedPositions = [];
            this.memory.aiKeywordCycleCount = 0;
            this.memory.currentKeywordIndex = 0; // Restart from first base pair
          }
        }
      }
      
      // STEP 4: Track exhaustion per keyword (use selectedKeyword as key)
      if (!this.memory.industryExhaustion[selectedKeyword]) {
        this.memory.industryExhaustion[selectedKeyword] = {
          leadsFound: 0,
          lastSearched: Date.now(),
          exhausted: false,
          totalAttempts: 0,
          totalDuplicates: 0,
          cumulativeDuplicateRate: 0
        };
      }
      
      const tracker = this.memory.industryExhaustion[selectedKeyword];
      tracker.lastSearched = Date.now();

      // PREEMPTIVE EXHAUSTION CHECK
      // If memory was loaded at startup (from Zilliz) and this keyword is already
      // above 20% dup rate, skip it without making an Apollo API call. The in-memory
      // tracker is seeded from the aggregated Zilliz data at agent start(), so we can
      // trust this number immediately.
      //
      // Requirements: >= 5 total attempts (to avoid skipping on noise from tiny samples).
      if (tracker.cumulativeDuplicateRate > 40 && tracker.totalAttempts >= 5) {
        // Check if there are ANY other keywords to rotate to. If this is the only
        // keyword (or all keywords are exhausted), rotating is a no-op and the agent
        // will loop forever burning API credits. In that case, return shouldStop=true
        // so the LLM and the run loop know to halt rather than retry.
        const baseKws   = this.memory.baseIndustryKeywords || [];
        const aiKws     = this.memory.aiGeneratedKeywords || [];
        const totalKws  = baseKws.length + aiKws.length;

        // A keyword is *viable* if it is NOT the currently-exhausted keyword AND either:
        //   (a) it has never been tried (no tracker entry), OR
        //   (b) its cumulative dup rate is still ≤ 20%.
        // Using the full base+AI list catches newly-generated AI keywords that have
        // no tracker entry yet — they should be tried before we stop the agent.
        const viableAlternatives = [...baseKws, ...aiKws].filter(kw =>
          kw !== selectedKeyword &&
          (!this.memory.industryExhaustion[kw] ||
           (this.memory.industryExhaustion[kw]?.cumulativeDuplicateRate || 0) <= 40)
        ).length;
        const allExhausted = viableAlternatives === 0;

        console.log(`[EXHAUST PRE-SKIP] "${selectedKeyword}": ${tracker.cumulativeDuplicateRate.toFixed(1)}% dup rate (${tracker.totalAttempts} attempts). totalKeywords=${totalKws} viableAlternatives=${viableAlternatives} allExhausted=${allExhausted}`);

        if (allExhausted) {
          // No viable keywords remain — try generating new AI keywords before giving up.
          const basePositions = this.memory.originalTargetPositions || userSettings.targetPositions || [];
          const canGenerate = this.memory.aiGeneratedKeywords.length < 5;

          if (canGenerate) {
            this.logOperation(
              '🔄 Finding New Markets',
              `"${selectedKeyword}" has been fully searched. Discovering related industries to keep finding leads...`,
              'info'
            );
            try {
              await this.generateRelatedIndustryKeywordsAndPositions(
                userSettings.companyIndustries,
                basePositions
              );
            } catch (genErr) {
              console.error('[EXHAUST] AI keyword generation failed:', genErr.message);
            }
          }

          // Check again after (attempted) generation
          const freshAiKws = this.memory.aiGeneratedKeywords || [];
          const hasNewKeywords = freshAiKws.filter(kw =>
            kw !== selectedKeyword &&
            (!this.memory.industryExhaustion[kw] ||
             (this.memory.industryExhaustion[kw]?.cumulativeDuplicateRate || 0) <= 40)
          ).length > 0;

          if (hasNewKeywords) {
            // New keywords generated — rotate to them
            const newKws = (this.memory.aiGeneratedKeywords || []).slice(-3).join(', ');
            this.logOperation(
              '✅ New Markets Found',
              `Switching from "${selectedKeyword}" to fresh target industries: ${newKws || 'newly generated'}`,
              'info'
            );

            // ── Settings swap ─────────────────────────────────────────────
            // Replace the exhausted keyword in the agent settings DB so on the
            // next start the base list is already clean. Old keyword stays in
            // Zilliz memory (high dup rate keeps it from being re-added).
            try {
              const freshSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
              if (freshSettings?.companyCriteria?.companyIndustries) {
                const oldIndustries = freshSettings.companyCriteria.companyIndustries;
                // Remove the exhausted keyword (case-insensitive match)
                const filtered = oldIndustries.filter(ind =>
                  ind.toLowerCase().replace(/\s+/g, '_') !== selectedKeyword.replace(/\s+/g, '_') &&
                  ind.toLowerCase() !== selectedKeyword
                );
                // Add new AI keywords (title-cased, no duplicates)
                const toAdd = (this.memory.aiGeneratedKeywords || []).filter(kw =>
                  !filtered.some(ind => ind.toLowerCase() === kw.toLowerCase())
                ).map(kw => kw.charAt(0).toUpperCase() + kw.slice(1));
                const updatedIndustries = [...filtered, ...toAdd];
                const updatedSettings = {
                  ...freshSettings,
                  companyCriteria: {
                    ...freshSettings.companyCriteria,
                    companyIndustries: updatedIndustries
                  },
                  _industrySwapLog: [
                    ...(freshSettings._industrySwapLog || []),
                    {
                      removedAt: new Date().toISOString(),
                      removed: selectedKeyword,
                      added: toAdd,
                      reason: `${tracker.cumulativeDuplicateRate.toFixed(1)}% duplicate rate after ${tracker.totalAttempts} searches`
                    }
                  ]
                };
                await this.awsManager.saveLeadAgentSettings(this.userId, this.agentId, updatedSettings);
                console.log(`[INDUSTRY SWAP] Removed "${selectedKeyword}" → added [${toAdd.join(', ')}] to agent settings`);
              }
            } catch (swapErr) {
              console.error('[INDUSTRY SWAP] Failed to update settings, continuing anyway:', swapErr.message);
            }

            this.memory.leadsFoundWithCurrentKeyword = 999;
            return {
              success: true,
              found: 0,
              leads: [],
              skipped: true,
              reason: `Rotated to newly generated keywords after "${selectedKeyword}" exhausted`
            };
          }

          // Truly nothing left — stop
          this.logOperation(
            '🛑 Search Complete',
            `All target industries and generated markets have been fully searched. Stopping to avoid duplicate outreach.`,
            'warning'
          );
          return {
            success: false,
            found: 0,
            leads: [],
            skipped: true,
            shouldStop: true,
            reason: `All keywords exhausted — "${selectedKeyword}" at ${tracker.cumulativeDuplicateRate.toFixed(1)}% dup rate, generation failed or capped`
          };
        }

        // Other keywords exist — rotate to them
        this.logOperation(
          '🔄 Switching Target Industry',
          `"${selectedKeyword}" is saturated (${tracker.cumulativeDuplicateRate.toFixed(1)}% already contacted). Moving to the next industry to find fresh leads.`,
          'info'
        );
        this.memory.leadsFoundWithCurrentKeyword = 999;
        return {
          success: true,
          found: 0,
          leads: [],
          skipped: true,
          reason: `Keyword pre-skipped (${tracker.cumulativeDuplicateRate.toFixed(1)}% cumulative dup rate from memory)`
        };
      }

      // Use pagination and vary search parameters intelligently
      // Apply page offset from search adaptation strategy
      const basePageRange = this.memory.searchPageOffset || 0;
      const searchPage = basePageRange + Math.floor(Math.random() * 10) + 1; // Offset + random 1-10
      
      // USE PAIRED POSITION (from rotation logic above)
      let targetPosition;
      
      // Determine which position array to use (base or AI)
      const basePositions = this.memory.originalTargetPositions || userSettings.targetPositions || [];
      const aiPositions = this.memory.aiGeneratedPositions || [];
      const usingAI = keywordSource === 'ai';
      const positionArray = usingAI ? aiPositions : basePositions;
      
      if (selectedPositionIndex !== null && positionArray.length > 0) {
        targetPosition = positionArray[selectedPositionIndex];
      } else {
        // Fallback if something went wrong
        if (basePositions.length === 0) {
          return {
            success: false,
            error: 'Target positions not configured. Please set target positions in agent settings.',
            found: 0,
            leads: []
          };
        }
        targetPosition = basePositions[0];
      }
      
      // STEP 5: Check search history for duplicates (30 day window)
      const historyCheck = await this.awsManager.checkSearchHistory(
        userSettings.userId,
        this.agentId,
        selectedKeyword,
        targetPosition,
        30
      );
      
      if (historyCheck.isDuplicate) {
        // This exact combo (keyword + position) was already searched within the 30-day
        // window and is stored in DynamoDB search history.
        
        // Check if this keyword has high cumulative duplicate rate - if so, skip it entirely
        const tracker = this.memory.industryExhaustion[selectedKeyword];
        if (tracker && tracker.cumulativeDuplicateRate > 40 && tracker.totalAttempts >= 5) {
          console.log(`[EXHAUST HISTORY-SKIP] "${selectedKeyword}" + "${targetPosition}": already in 30-day history AND ${tracker.cumulativeDuplicateRate.toFixed(1)}% dup rate. Force-rotating keyword.`);
          this.logOperation(
            '⏭ Keyword Exhausted (History)',
            `"${selectedKeyword}" + "${targetPosition}" already searched recently — and keyword has ${tracker.cumulativeDuplicateRate.toFixed(1)}% dup rate (${tracker.totalAttempts} attempts). Rotating keyword.`,
            'warning'
          );
          this.memory.leadsFoundWithCurrentKeyword = 999; // Force rotation to next keyword
          return {
            success: true,
            found: 0,
            leads: [],
            skipped: true,
            reason: `Keyword exhausted (${tracker.cumulativeDuplicateRate.toFixed(1)}% duplicates)`
          };
        }
        
        // Otherwise just force rotation to try next keyword + position combo
        console.log(`[HISTORY-SKIP] "${selectedKeyword}" + "${targetPosition}": already searched within 30 days. Rotating to next keyword.`);
        this.logOperation(
          '⏭ Combo Already Searched',
          `"${selectedKeyword}" + "${targetPosition}" was already searched within the last 30 days. Rotating to next keyword/position.`,
          'info'
        );
        this.memory.leadsFoundWithCurrentKeyword = 999;
        return {
          success: true,
          found: 0,
          leads: [],
          skipped: true,
          reason: `Already searched ${selectedKeyword} + ${targetPosition} recently`
        };
      }
      
      // Reset search counters on successful new search
      this.memory.consecutiveDuplicateSearches = 0;
      this.memory.consecutiveDisqualifications = 0;

      // Validate that this keyword+position pair makes sense before burning Apollo credits
      const pairKey = `${selectedKeyword}#${targetPosition}`.toLowerCase();
      if (!this.memory.validatedPairs) this.memory.validatedPairs = {};
      if (this.memory.validatedPairs[pairKey] === false) {
        this.logOperation(
          '⚠️ Pair Skipped',
          `"${selectedKeyword}" + "${targetPosition}" was flagged as an invalid search pair — rotating`,
          'info',
          { keyword: selectedKeyword, position: targetPosition }
        );
        return { found: 0, leads: [], skipped: true, reason: `Invalid pair: "${selectedKeyword}" + "${targetPosition}"` };
      }
      if (!(pairKey in this.memory.validatedPairs)) {
        const valid = await this.validateSearchPair(selectedKeyword, targetPosition);
        this.memory.validatedPairs[pairKey] = valid;
        if (!valid) {
          this.logOperation(
            '⚠️ Pair Skipped',
            `"${selectedKeyword}" + "${targetPosition}" doesn't match real-world titles — rotating to next pair`,
            'info',
            { keyword: selectedKeyword, position: targetPosition }
          );
          return { found: 0, leads: [], skipped: true, reason: `Invalid pair: "${selectedKeyword}" + "${targetPosition}"` };
        }
      }

      // Calculate how many leads we still need
      const leadsNeeded = this.memory.currentCycle.targetLeads - this.memory.currentCycle.leadsProcessed;
      const remainingInQueue = this.memory.currentCycle.leadQueue.length;
      const leadsToRequest = Math.max(1, leadsNeeded - remainingInQueue);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3.5: BANDIT SOURCE SELECTION
      // ─────────────────────────────────────────────────────────────────────
      // Determine which lead source (Apollo, Proxycurl, etc.) should execute
      // this search. The bandit learns over time — sources that produce clean,
      // non-duplicate leads get preferred. New or uncertain sources are still
      // explored occasionally so the system can detect when quality shifts.
      //
      // If only one source is available (just Apollo), this is a no-op and
      // Apollo is used as always. No behaviour change until a second source
      // is added to the registry.
      // ─────────────────────────────────────────────────────────────────────
      const availableSources = getAvailableSources();

      if (!this.memory.keywordSourceAssignments[selectedKeyword]) {
        /**
         * First time we're searching this keyword — ask the bandit to pick.
         * With only Apollo in the registry, this always returns Apollo.
         * With multiple sources, Thompson Sampling chooses based on priors
         * and any past observations for this keyword.
         */
        const chosenSource = this.bandit.select(selectedKeyword, availableSources);
        this.memory.keywordSourceAssignments[selectedKeyword] = chosenSource.id;
        console.log(`🎰 [BANDIT] Assigned source "${chosenSource.id}" to keyword "${selectedKeyword}"`);
      }

      const activeSourceId = this.memory.keywordSourceAssignments[selectedKeyword];
      const activeSource = getSourceById(activeSourceId) || availableSources[0];

      // Build the normalized params object every source's search() expects
      let sizeMin, sizeMax;
      if (parameters.companySize) {
        const sizeRange = parameters.companySize.toString().split(/[-,]/);
        sizeMin = parseInt(sizeRange[0]);
        sizeMax = parseInt(sizeRange[1]) || sizeMin;
      } else {
        if (!userSettings.companySizeMin || !userSettings.companySizeMax) {
          throw new Error('Company size range not configured in user settings');
        }
        sizeMin = userSettings.companySizeMin;
        sizeMax = userSettings.companySizeMax;
      }

      const sourceParams = {
        keyword: selectedKeyword,
        position: targetPosition,
        companySizeMin: sizeMin,
        companySizeMax: sizeMax,
        locations: parameters.location
          ? [parameters.location]
          : (userSettings.targetLocations || []),
        page: searchPage,
        perPage: leadsToRequest,
        excludeKeywords: this.campaignPlan?.searchStrategy?.excludeKeywords || []
      };

      // ─────────────────────────────────────────────────────────────────────
      // ROUTE: non-Apollo sources bypass the Apollo-specific payload builder
      // and rate-limit logic below. They go straight to the registry adapter.
      // Apollo still follows its existing path for backwards compatibility.
      // ─────────────────────────────────────────────────────────────────────
      if (activeSource.id !== 'apollo') {
        const sourceApiKey = process.env[activeSource.envKey];
        if (!sourceApiKey) {
          // Key missing — fall back to Apollo silently and log a warning
          console.warn(`⚠️ [BANDIT] No API key for source "${activeSource.id}", falling back to Apollo`);
          this.memory.keywordSourceAssignments[selectedKeyword] = 'apollo';
        } else {
          this.logOperation(
            `🔍 Searching via ${activeSource.label}`,
            `Using ${activeSource.label} for "${selectedKeyword}" (${targetPosition})`,
            'info'
          );
          try {
            const sourceResult = await activeSource.search(sourceParams, sourceApiKey);
            // Tag every lead with the source that found it
            const taggedLeads = (sourceResult.leads || []).map(l => ({ ...l, _leadSource: activeSource.id }));
            // Fall through to the shared deduplication + tracking logic below
            // by returning an enrichedLeads-compatible object
            return await this._processSearchResults(
              taggedLeads, selectedKeyword, targetPosition, keywordSource, activeSource.id, parameters
            );
          } catch (sourceErr) {
            console.error(`❌ [SOURCE ${activeSource.id}] Search failed:`, sourceErr.message);
            // Fall through to Apollo as safety net
            console.warn(`⚠️ Falling back to Apollo for this search`);
            this.memory.keywordSourceAssignments[selectedKeyword] = 'apollo';
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // APOLLO PATH (original logic, now source-aware)
      // Continues below exactly as before, except:
      //   1. We re-use the already-built sizeMin/sizeMax/locations from above
      //   2. Enriched leads get tagged with _leadSource: 'apollo'
      // ─────────────────────────────────────────────────────────────────────

      const searchPayload = {
        q_keywords: targetPosition,
        page: searchPage,
        per_page: leadsToRequest,
        reveal_personal_emails: true,
        reveal_phone_number: true
      };

      searchPayload.organization_num_employees_ranges = [`${sizeMin},${sizeMax}`];

      if (parameters.location) {
        searchPayload.person_locations = [parameters.location];
      } else if (userSettings.targetLocations && userSettings.targetLocations.length > 0) {
        searchPayload.person_locations = userSettings.targetLocations;
      }

      // Use the selected keyword (from rotation system) for Apollo search
      searchPayload.q_organization_keyword_tags = [selectedKeyword];
      
      // Apply campaign plan exclusions to filter out unwanted results (e.g., schools, non-profits)
      if (this.campaignPlan && this.campaignPlan.searchStrategy?.excludeKeywords?.length > 0) {
        searchPayload.organization_not_all_keywords = this.campaignPlan.searchStrategy.excludeKeywords;
      }
      
      // CAMPAIGN STRATEGY: Keep search broad (baseline settings only)
      // Campaign plan keywords will be used during RESEARCH and QUALIFICATION phases
      // This ensures we actually find leads, then filter them based on campaign criteria
      if (this.campaignPlan && this.campaignPlan.searchStrategy) {
        
        // Note: We intentionally DON'T add campaign keywords to the Apollo search
        // Instead, we'll use them in the research/qualification phase to filter results
        // This prevents 0-result searches when keywords are too specific
      }

      // Check rate limit BEFORE making Apollo API call
      const rateCheck = await this.awsManager.checkApiRateLimit(
        this.userId,
        'apollo',
        1 // 1 credit per search
      ).catch(err => {
        console.error('⚠️ Rate limit check failed, allowing request:', err);
        return { allowed: true };
      });

      if (!rateCheck.allowed) {
        const resetTime = new Date(rateCheck.resetTime).toLocaleString();
        throw new Error(
          `Apollo ${rateCheck.reason} rate limit exceeded. ` +
          `Current usage: ${rateCheck.current}/${rateCheck.limit} credits. ` +
          `Resets at: ${resetTime}`
        );
      }

      const response = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify(searchPayload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Apollo API error: ${data.error || response.statusText}`);
      }

      const rawLeads = data.people || [];

      // Build lead stubs from the FREE search response only — do NOT spend an
      // Apollo enrichment credit here. Enrichment (people/enrich, 1 credit)
      // is deferred until after dedup + pre-qualification via unlockEmail(),
      // so credits are never spent on leads that get filtered out before
      // qualification. See unlockEmail()'s apolloId fast path.
      const enrichedLeads = rawLeads
        .filter(lead => lead.has_email)
        .map(lead => ({
          apolloId: lead.id,
          name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          first_name: lead.first_name,
          last_name: lead.last_name,
          title: lead.title,
          company: lead.organization?.name,
          organization: lead.organization,
          city: lead.city,
          state: lead.state,
          country: lead.country,
          linkedin_url: lead.linkedin_url,
          has_email: true,
          _leadSource: 'apollo' // Tag with source so all downstream code knows where this lead came from
        }));


      // Log Apollo search usage
      await this.awsManager.logApiUsage({
        userId: this.userId,
        agentId: this.agentId,
        service: 'apollo',
        operation: 'search',
        usage: rawLeads.length, // Number of results returned
        metadata: {
          industries: parameters.industries || userSettings.targetIndustries,
          location: parameters.location || userSettings.targetLocations?.[0],
          positions: parameters.positions || userSettings.targetPositions,
          rateLimitStatus: 'within_limits'
        }
      }).catch(err => console.error('Failed to log Apollo search usage:', err));

      // Warn if approaching limits
      if (rateCheck.remaining) {
        const checkRemaining = (limit, type) => {
          if (limit !== null && limit < 10) {
            console.warn(`[WARN] Apollo ${type} limit approaching: ${limit} credits remaining`);
          }
        };
        checkRemaining(rateCheck.remaining.hourly, 'hourly');
        checkRemaining(rateCheck.remaining.daily, 'daily');
        checkRemaining(rateCheck.remaining.monthly, 'monthly');
      }

      // Check for duplicates immediately after enrichment
      if (enrichedLeads.length > 0) {
        // Emit SSE progress for deduplication check start
        this.emit('progress', {
          id: this.generateUniqueId(),
          timestamp: new Date().toISOString(),
          operation: 'Deduplication Check',
          details: `🔍 Checking ${enrichedLeads.length} leads for duplicates...`,
          status: 'processing',
          data: { 
            phase: 'deduplication_start',
            totalLeads: enrichedLeads.length
          }
        });
        
        const deduplicationResult = await this.awsManager.checkForDuplicateContacts(this.userId, enrichedLeads);
        
        if (deduplicationResult.success) {
          let { newLeads, duplicateLeads, summary } = deduplicationResult;

          // Filter junk leads where company name is a generic keyword, not a real company
          const junkCompanyPatterns = [
            /^artificial intelligence$/i,
            /^machine learning$/i,
            /^deep learning$/i,
            /^data science$/i,
            /^technology$/i,
            /^software$/i,
            /^information technology$/i,
            /^ai\/ml$/i,
            /^n\/a$/i,
            /^none$/i,
            /^unknown$/i,
          ];
          const junkFiltered = newLeads.filter(lead => {
            const co = (lead.organization?.name || lead.company || lead.organization_name || '').trim();
            if (!co) return false; // no company = skip
            return !junkCompanyPatterns.some(p => p.test(co));
          });
          if (junkFiltered.length < newLeads.length) {
            console.log(`🚫 [JUNK FILTER] Removed ${newLeads.length - junkFiltered.length} leads with generic company names`);
          }
          newLeads = junkFiltered;
          summary = { ...summary, newCount: newLeads.length };
          
          
          // Compute how many more leads are still needed after this batch
          const alreadyQueued = this.memory.currentCycle.leadQueue.length;
          const alreadyProcessed = this.memory.currentCycle.leadsProcessed;
          const target = this.memory.currentCycle.targetLeads;
          const stillNeeded = Math.max(0, target - alreadyProcessed - alreadyQueued - summary.newCount);

          // Build duplicate names list for visibility
          const dupNames = duplicateLeads.slice(0, 5).map(l => `${l.name || l.first_name || '?'} @ ${l.organization?.name || l.company || '?'}`);
          const dupSuffix = duplicateLeads.length > 5 ? ` (+${duplicateLeads.length - 5} more)` : '';

          let dedupMsg = '';
          if (summary.newCount === 0 && summary.duplicateCount === 0) {
            dedupMsg = `Apollo returned 0 leads for this search.`;
          } else if (summary.duplicateCount === 0) {
            dedupMsg = `✅ ${summary.newCount} new leads found — no duplicates.`;
          } else if (summary.newCount === 0) {
            dedupMsg = `⚠️ All ${summary.duplicateCount} leads were already contacted: ${dupNames.join(', ')}${dupSuffix}`;
          } else {
            dedupMsg = `✅ ${summary.newCount} new / 🔁 ${summary.duplicateCount} already contacted (${dupNames.join(', ')}${dupSuffix})`;
          }

          if (stillNeeded > 0) {
            dedupMsg += ` — searching ${stillNeeded} more to reach target of ${target}.`;
          } else if (summary.newCount > 0) {
            dedupMsg += ` — target of ${target} reached.`;
          }

          this.logOperation('🔍 Lead Search Results', dedupMsg, summary.newCount > 0 ? 'completed' : 'info', {
            phase: 'deduplication_complete',
            newLeads: summary.newCount,
            duplicatesFiltered: summary.duplicateCount,
            totalChecked: summary.totalChecked,
            stillNeeded,
            target
          });
          
          const results = {
            found: newLeads.length,
            totalFound: rawLeads.length,
            leads: newLeads,
            duplicatesFiltered: duplicateLeads,
            query: parameters.query,
            parameters: parameters
          };

          // Update keyword tracking and calculate duplicate percentage
          if (newLeads.length > 0 || duplicateLeads.length > 0) {
            const totalAttempts = newLeads.length + duplicateLeads.length;
            const duplicatePercentage = (duplicateLeads.length / totalAttempts) * 100;
            
            this.memory.leadsFoundWithCurrentKeyword += newLeads.length;
            this.memory.totalLeadsFoundThisCycle += newLeads.length;
            
            // Track cumulative duplicate rate per keyword
            if (selectedKeyword) {
              const tracker = this.memory.industryExhaustion[selectedKeyword];
              if (!tracker) {
                // Memory was reset mid-flight (e.g. stop signal received) — skip tracking
                console.warn(`[APOLLO] industryExhaustion tracker missing for "${selectedKeyword}" (memory reset?), skipping update`);
              } else {
              tracker.leadsFound += newLeads.length;
              tracker.totalAttempts += totalAttempts;
              tracker.totalDuplicates += duplicateLeads.length;
              tracker.cumulativeDuplicateRate = (tracker.totalDuplicates / tracker.totalAttempts) * 100;
              
              
              // Store performance to Zilliz for persistent learning
              if (this.memoryInitialized) {
                try {
                  const storeResult = await this.leadMemory.storeKeywordPerformance(
                    this.userId,
                    this.agentId,
                    selectedKeyword,
                    targetPosition,
                    totalAttempts,
                    duplicateLeads.length,
                    keywordSource
                  );
                  
                  this.logOperation(
                    '🧠 Memory Updated',
                    `Stored performance for "${selectedKeyword}" - ${storeResult.totalAttempts} total attempts, ${storeResult.cumulativeRate.toFixed(1)}% duplicate rate`,
                    'info'
                  );
                } catch (memError) {
                  console.error('⚠️ [MEMORY] Failed to store performance:', memError.message);
                  this.logOperation('⚠️ Memory Error', `Failed to store performance: ${memError.message}`, 'warning');
                }
              }

              /**
               * BANDIT REWARD — update Thompson Sampling stats for this search batch.
               *
               * We call reward() here because this is the point where we know the
               * actual outcome: how many leads were valid vs. duplicates.
               *
               * successes = newLeads.length  (valid, non-duplicate leads)
               * failures  = duplicateLeads.length  (duplicates caught by dedup)
               *
               * The bandit accumulates these across every search on this source ×
               * keyword pair. Over time, sources that produce more successes than
               * failures will be preferred by Thompson Sampling.
               *
               * Future: multiply successes by a reply-rate weight once that data
               * is available. The formula here doesn't need to change.
               */
              if (this.banditInitialized && activeSourceId) {
                this.bandit.reward(selectedKeyword, activeSourceId, newLeads.length, duplicateLeads.length);
                // Flush updated stats to DynamoDB (non-blocking)
                this.bandit.flushToDB().catch(e => console.warn('⚠️ [BANDIT] Flush failed:', e.message));
              }

              // ─────────────────────────────────────────────────────────────
              // DUP-RATE TRIGGER: SOURCE SWITCH BEFORE KEYWORD ROTATION
              // ─────────────────────────────────────────────────────────────
              // When cumulative dup rate > 40%, the old behaviour was to
              // immediately rotate to the next keyword. Instead, we now first
              // try switching to a different source on the SAME keyword.
              //
              // Rationale: the keyword may still be a good targeting choice,
              // but the current source's coverage of that keyword is exhausted.
              // Another source may have an entirely fresh audience for the same
              // industry + position.
              //
              // We only rotate the keyword if:
              //   a) There is no alternative source available, OR
              //   b) The alternative source is ALSO exhausted for this keyword
              //      (its bandit mean is below 0.2, meaning it has a history of
              //       failures too). In that case, the keyword itself is done.
              // ─────────────────────────────────────────────────────────────
              if (tracker.cumulativeDuplicateRate > 40 && tracker.totalAttempts >= 5) {

                await this.awsManager.recordSearchHistory(
                  this.userId,
                  this.agentId,
                  selectedKeyword,
                  targetPosition,
                  newLeads.length
                );

                if (selectedKeyword === this.memory.campaignPriorityKeyword) {
                  if (!this.memory.exhaustedCampaignKeywords) this.memory.exhaustedCampaignKeywords = new Set();
                  this.memory.exhaustedCampaignKeywords.add(selectedKeyword);
                }

                // Attempt source switch before keyword rotation
                const available = getAvailableSources();
                const altSource = available.length > 1
                  ? this.bandit.selectAlternative(selectedKeyword, activeSourceId, available)
                  : null;

                if (altSource) {
                  // Check if the alternative source is also likely exhausted for this keyword
                  // by looking at its bandit stats mean. If its mean is > 0.2, it's worth trying.
                  const altStats = this.bandit._getStats(selectedKeyword, altSource);
                  const altMean = altStats.alpha / (altStats.alpha + altStats.beta);

                  if (altMean > 0.2) {
                    // Switch source, don't rotate keyword yet
                    const prev = activeSourceId;
                    // Capture rate BEFORE resetting so the log shows the triggering value
                    const triggeringDupRate = tracker.cumulativeDuplicateRate;
                    this.memory.keywordSourceAssignments[selectedKeyword] = altSource.id;
                    // Reset the tracker's counters so the new source gets a fair chance
                    tracker.totalAttempts = 0;
                    tracker.totalDuplicates = 0;
                    tracker.cumulativeDuplicateRate = 0;

                    this.memory.sourceSwitchLog.push({
                      timestamp: new Date().toISOString(),
                      keyword: selectedKeyword,
                      from: prev,
                      to: altSource.id,
                      reason: 'dup_rate_trigger',
                      dupRate: triggeringDupRate
                    });

                    this.logOperation(
                      '🔀 Source Switched (Dup Rate)',
                      `Keyword "${selectedKeyword}": switched ${prev} → ${altSource.label} (dup rate was ${triggeringDupRate.toFixed(1)}%, alt source looks fresh)`,
                      'info'
                    );
                  } else {
                    // Alt source also looks exhausted for this keyword — rotate keyword
                    this.memory.leadsFoundWithCurrentKeyword = 999;
                  }
                } else {
                  // No alternative — rotate keyword as before
                  this.memory.leadsFoundWithCurrentKeyword = 999;
                }
              }
              } // end tracker null-guard
            }
          }

          // Record this search in memory
          this.memory.searchHistory.push({
            timestamp: new Date().toISOString(),
            parameters: parameters,
            results: { found: results.found, totalFound: results.totalFound, duplicatesFiltered: duplicateLeads.length },
            success: results.found > 0
          });

          return results;
        } else {
          console.error('⚠️ [DEDUPLICATION] Check failed, proceeding with all leads:', deduplicationResult.error);
        }
      } else {
      }


      // Update keyword tracking (fallback case when deduplication not used)
      if (selectedKeyword && enrichedLeads.length > 0) {
        this.memory.leadsFoundWithCurrentKeyword += enrichedLeads.length;
        this.memory.industryExhaustion[selectedKeyword].leadsFound += enrichedLeads.length;
        this.memory.totalLeadsFoundThisCycle += enrichedLeads.length;
      }

      // Return enriched leads with actual emails
      const results = {
        found: enrichedLeads.length,
        leads: enrichedLeads,
        query: parameters.query,
        parameters: parameters
      };

      // Record this search in memory
      this.memory.searchHistory.push({
        timestamp: new Date().toISOString(),
        parameters: parameters,
        results: { found: results.found },
        success: results.found > 0
      });

      return results;

    } catch (error) {
      console.error('❌ [APOLLO] Search failed:', error);
      
      // Record failed search
      this.memory.searchHistory.push({
        timestamp: new Date().toISOString(),
        parameters: parameters,
        error: error.message,
        success: false
      });

      return {
        found: 0,
        leads: [],
        error: error.message,
        parameters: parameters
      };
    }
  }

  /**
   * _processSearchResults
   * ─────────────────────
   * Shared deduplication + keyword tracking path used by ALL lead sources.
   *
   * Previously this logic was inlined inside leadSearch(). Now that non-Apollo
   * sources can run via the registry, they need to go through the same pipeline:
   *   1. Deduplication check against contacted-leads DB
   *   2. Junk company-name filter
   *   3. Keyword exhaustion tracking (industryExhaustion)
   *   4. Bandit reward for the source that ran this search
   *   5. Dup-rate → source switch or keyword rotation
   *
   * Apollo still calls this indirectly (its results are deduped in the same
   * block later in leadSearch), but non-Apollo sources call it directly
   * and return early via the `if (activeSource.id !== 'apollo')` branch above.
   *
   * @param {object[]} enrichedLeads — leads already tagged with _leadSource
   * @param {string} selectedKeyword
   * @param {string} targetPosition
   * @param {string} keywordSource — 'base' | 'ai' | 'campaign'
   * @param {string} activeSourceId — source ID that ran this search
   * @param {object} parameters — original parameters passed to leadSearch
   * @returns standard leadSearch result shape: { found, leads, ... }
   */
  async _processSearchResults(enrichedLeads, selectedKeyword, targetPosition, keywordSource, activeSourceId, parameters) {
    if (!enrichedLeads || enrichedLeads.length === 0) {
      return { found: 0, totalFound: 0, leads: [], duplicatesFiltered: [], query: parameters.query, parameters };
    }

    // Emit dedup start for UI
    this.emit('progress', {
      id: this.generateUniqueId(),
      timestamp: new Date().toISOString(),
      operation: 'Deduplication Check',
      details: `🔍 Checking ${enrichedLeads.length} leads for duplicates...`,
      status: 'processing',
      data: { phase: 'deduplication_start', totalLeads: enrichedLeads.length }
    });

    const deduplicationResult = await this.awsManager.checkForDuplicateContacts(this.userId, enrichedLeads);
    if (!deduplicationResult.success) {
      return { found: enrichedLeads.length, leads: enrichedLeads, query: parameters.query, parameters };
    }

    let { newLeads, duplicateLeads, summary } = deduplicationResult;

    // Junk company filter
    const junkCompanyPatterns = [
      /^artificial intelligence$/i, /^machine learning$/i, /^deep learning$/i,
      /^data science$/i, /^technology$/i, /^software$/i,
      /^information technology$/i, /^ai\/ml$/i, /^n\/a$/i, /^none$/i, /^unknown$/i
    ];
    newLeads = newLeads.filter(lead => {
      const co = (lead.organization?.name || lead.company || '').trim();
      if (!co) return false;
      return !junkCompanyPatterns.some(p => p.test(co));
    });
    summary = { ...summary, newCount: newLeads.length };

    // Keyword + bandit tracking
    if (newLeads.length > 0 || duplicateLeads.length > 0) {
      const totalAttempts = newLeads.length + duplicateLeads.length;

      this.memory.leadsFoundWithCurrentKeyword += newLeads.length;
      this.memory.totalLeadsFoundThisCycle += newLeads.length;

      const tracker = this.memory.industryExhaustion[selectedKeyword];
      if (tracker) {
        tracker.leadsFound += newLeads.length;
        tracker.totalAttempts += totalAttempts;
        tracker.totalDuplicates += duplicateLeads.length;
        tracker.cumulativeDuplicateRate = (tracker.totalDuplicates / tracker.totalAttempts) * 100;
      }

      // Bandit reward for this source
      if (this.banditInitialized && activeSourceId) {
        this.bandit.reward(selectedKeyword, activeSourceId, newLeads.length, duplicateLeads.length);
        this.bandit.flushToDB().catch(e => console.warn('⚠️ [BANDIT] Flush failed:', e.message));
      }
    }

    this.memory.searchHistory.push({
      timestamp: new Date().toISOString(),
      parameters,
      results: { found: newLeads.length, totalFound: enrichedLeads.length, duplicatesFiltered: duplicateLeads.length },
      success: newLeads.length > 0
    });

    return {
      found: newLeads.length,
      totalFound: enrichedLeads.length,
      leads: newLeads,
      duplicatesFiltered: duplicateLeads,
      query: parameters.query,
      parameters
    };
  }
  async validateSearchPair(keyword, position) {
    try {
      const company = this.memory.userSettings?.companyProfile || this.memory.userSettings || {};
      const companyContext = [
        company.companyName && `Company: ${company.companyName}`,
        company.services && `Sells: ${company.services}`,
        company.targetMarket && `Target market: ${company.targetMarket}`,
      ].filter(Boolean).join(' | ') || 'Not specified';

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Does the job title "${position}" realistically appear on LinkedIn/Apollo profiles at companies in the "${keyword}" industry? Would someone actually list this exact title (or a close variant)?

Context about the company doing outreach: ${companyContext}

Answer with JSON: {"valid": true/false, "reason": "one sentence"}`
        }],
        temperature: 0,
        max_tokens: 80,
      });

      const raw = response.choices[0].message.content.trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        console.log(`[PAIR VALIDATE] "${keyword}" + "${position}": ${result.valid ? '✅' : '❌'} — ${result.reason}`);
        return result.valid !== false;
      }
      return true; // default allow on parse failure
    } catch (err) {
      console.warn(`[PAIR VALIDATE] Error validating "${keyword}" + "${position}", allowing:`, err.message);
      return true;
    }
  }

  async generateRelatedIndustryKeywordsAndPositions(userIndustries, basePositions) {
    try {
      const userSettings = this.memory.userSettings;
      const companyProfile = userSettings?.companyProfile || {};
      
      
      const prompt = `You are an intelligent B2B lead generation strategist. Generate 5 SPECIFIC industry+position PAIRS of prospects WHO WOULD BUY from this company.

COMPANY SELLING (THE SENDER):
- Company: ${companyProfile.companyName || 'Not specified'}
- What They Sell: ${companyProfile.services || companyProfile.coreOffering || companyProfile.description || 'Not specified'}
- Target Market: ${companyProfile.targetMarket || 'Not specified'}

BASE POSITIONS (for seniority reference):
${basePositions.join(', ')}

YOUR TASK: Generate 5 industry+position PAIRS of BUYERS (not sellers).

Think: "WHO would want to BUY ${companyProfile.services || 'this service'}?"

Examples:
- Selling "Real Estate Investment Platform" → Target: "wealth management" + "VP of Investments"
- Selling "HR Software" → Target: "manufacturing" + "Chief People Officer"
- Selling "Cybersecurity Services" → Target: "healthcare" + "Chief Information Security Officer"
- Selling "Marketing Automation" → Target: "ecommerce" + "VP of Marketing"

IMPORTANT: 
- Generate BUYER industries (who needs this product/service)
- NOT industries similar to the seller
- Match seniority level of base positions
- Make positions relevant to the industry
- Think about who has budget authority

Format as JSON array of objects:
[
  {"industry": "wealth_management", "position": "VP of Investments"},
  {"industry": "manufacturing", "position": "Chief People Officer"},
  ...
]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });
      
      const content = response.choices[0].message.content.trim();
      
      // Parse JSON response
      let pairs = [];
      try {
        // Extract JSON if wrapped in markdown code blocks
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          pairs = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('❌ [JSON PARSE ERROR] Could not parse AI response:', parseError.message);
        throw new Error('AI response not valid JSON');
      }
      
      // Validate and extract
      if (Array.isArray(pairs) && pairs.length > 0) {
        const industries = pairs.map(p => p.industry?.toLowerCase()).filter(Boolean).slice(0, 5);
        const positions = pairs.map(p => p.position).filter(Boolean).slice(0, 5);
        
        this.memory.aiGeneratedKeywords = industries;
        this.memory.aiGeneratedPositions = positions;
        this.memory.aiKeywordCycleCount++;
        
        for (let i = 0; i < industries.length; i++) {
        }
      } else {
        throw new Error('No valid pairs generated');
      }
      
    } catch (error) {
      console.error('❌ [AI GENERATION ERROR]', error.message);
      // Fallback: keep current arrays empty (will use base pairs)
      this.memory.aiGeneratedKeywords = [];
      this.memory.aiGeneratedPositions = [];
    }
  }

  // DEPRECATED: Old function for backwards compatibility (not used anymore)
  async generateRelatedIndustryKeywords(userIndustries) {
    try {
      const userSettings = this.memory.userSettings;
      const companyProfile = userSettings?.companyProfile || {};
      
      
      const prompt = `You are an intelligent B2B lead generation strategist. Generate SPECIFIC sub-industries or niches within the target industries.

USER'S COMPANY PROFILE:
- Company: ${companyProfile.companyName || 'Not specified'}
- Industry: ${companyProfile.industry || 'Not specified'}
- Services/Products: ${companyProfile.services || 'Not specified'}
- Core Offering: ${companyProfile.coreOffering || companyProfile.description || 'Not specified'}
- Target Market: ${companyProfile.targetMarket || 'Not specified'}

CURRENTLY TARGETING (GENERAL INDUSTRIES):
${userIndustries.join(', ')}

Generate 5 SPECIFIC variations/sub-industries within these general categories. Examples:
- If "tech" or "technology" → provide: "saas", "cloud computing", "cybersecurity", "fintech", "ai/ml"
- If "healthcare" → provide: "telemedicine", "medical devices", "pharmaceuticals", "health tech", "biotech"
- If "finance" → provide: "fintech", "investment banking", "insurance tech", "wealth management", "crypto"
- If "real estate" → provide: "property management", "commercial real estate", "proptech", "construction", "real estate investment"

IMPORTANT: Stay within the SAME general industry but be MORE SPECIFIC. Focus on decision-makers (CTOs, CFOs, VPs) if relevant.

Requirements:
- Return ONLY lowercase keywords (single-word or two-word terms)
- Keywords must be SPECIFIC niches within the base industries
- Avoid generic terms like "business" or "company"
- Format as comma-separated list

Specific Niche Keywords:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100
      });
      
      const keywords = response.choices[0].message.content
        .trim()
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0 && !k.includes('\n'))
        .slice(0, 5);
      
      this.memory.aiGeneratedKeywords = keywords;
      this.memory.aiKeywordCycleCount++;
      
      
    } catch (error) {
      console.error('❌ [AI GENERATION ERROR]', error.message);
      // Fallback to base keywords if generation fails
      this.memory.aiGeneratedKeywords = [];
    }
  }

  /**
   * Generate industry-specific target positions based on current keyword
   * ONLY called after 20 leads with the base instructions/settings positions
   */
  async generateDynamicTargetPositions(industryKeyword, originalPositions, generalInstructions) {
    try {
      
      const userSettings = this.memory.userSettings;
      const companyProfile = userSettings?.companyProfile || {};
      
      const prompt = `Generate 5-7 specific job titles/positions to target for the industry: "${industryKeyword}"

Company Context:
- Services: ${companyProfile.services || 'B2B services'}
- Target Market: ${companyProfile.targetMarket || 'Business decision-makers'}
- General Instructions: ${generalInstructions || 'None specified'}

Original Target Positions (from user): ${originalPositions.join(', ')}
Current Industry Focus: ${industryKeyword}

Based on this industry, what are the MOST RELEVANT decision-maker positions to target?

Examples by industry:
- "saas" or "cloud computing" → CTO, VP Engineering, Head of DevOps, Technical Director, VP Product
- "fintech" or "finance" → CFO, VP Finance, Head of Finance Operations, Financial Controller, Treasurer
- "healthcare" or "medical devices" → Chief Medical Officer, VP Clinical Operations, Healthcare Administrator, Medical Director
- "real estate" or "proptech" → VP Real Estate, Head of Property Management, Director of Real Estate Operations, Real Estate Manager
- "marketing" or "adtech" → CMO, VP Marketing, Head of Digital Marketing, Marketing Director, Brand Manager

IMPORTANT: If the original positions are highly specific (e.g., "CEO only"), try to maintain that level/seniority but adapt to this industry.

Requirements:
- Return 5-7 job titles that would be decision-makers for this industry
- Focus on C-level, VP-level, Directors, and Heads of departments
- Be specific to the industry (not generic like "Manager")
- Format as comma-separated list
- Use full titles (not abbreviations unless commonly used like CEO, CTO, CFO, CMO)

Target Positions:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 150
      });
      
      const positions = response.choices[0].message.content
        .trim()
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.includes('\n'))
        .slice(0, 7);
      
      
      // Update settings in AWS (for display purposes)
      const updatedSettings = {
        ...userSettings,
        targetPositions: positions,
        lastDynamicUpdate: new Date().toISOString(),
        currentIndustryKeyword: industryKeyword,
        originalTargetPositions: originalPositions // Store original for reference
      };
      
      // Save to AWS
      await this.awsManager.updateLeadAgentSettings(this.userId, this.agentId, updatedSettings);
      
      // Update memory
      this.memory.userSettings = updatedSettings;
      
      
      return positions;
      
    } catch (error) {
      console.error('❌ [DYNAMIC POSITIONS ERROR]', error.message);
      // Return original positions on error
      return originalPositions || ['CEO', 'CTO', 'CFO', 'VP', 'Director'];
    }
  }

  // Main agent execution loop - keeps reasoning until goal is met
  async findLeads(targetLeads = 5, userSettings = {}) {
    
    // CRITICAL: Load existing leads database to avoid duplicates
    const existingDatabase = await this.loadLeadsDatabase();
    
    // Build comprehensive list of contacted companies from multiple sources
    const emailedCompanies = new Set();
    
    // Add from emailedCompanies array
    (existingDatabase.emailedCompanies || []).forEach(company => {
      if (company) emailedCompanies.add(company.toLowerCase());
    });
    
    // Add company names from all existing leads (in case emailedCompanies tracking failed before)
    (existingDatabase.allLeads || []).forEach(lead => {
      const companyName = lead.company || lead.organization?.name;
      if (companyName) emailedCompanies.add(companyName.toLowerCase());
    });
    
    // Build list of processed emails
    const processedEmails = new Set((existingDatabase.allLeads || []).map(lead => lead.email?.toLowerCase()).filter(Boolean));
    
    
    // Log some example companies to verify
    if (emailedCompanies.size > 0) {
      const exampleCompanies = Array.from(emailedCompanies).slice(0, 3);
    }
    
    // Store in memory for use during processing
    this.memory.duplicateCheck = {
      emailedCompanies,
      processedEmails,
      existingDatabase
    };

    this.memory.currentGoal = { targetLeads, userSettings };
    const foundLeads = [];
    let attempts = 0;
    const maxAttempts = 10;

    while (foundLeads.length < targetLeads && attempts < maxAttempts) {
      attempts++;

      // Agent reasons about current situation
      const context = {
        targetLeads: targetLeads,
        currentLeads: foundLeads.length,
        userSettings: userSettings,
        attemptNumber: attempts,
        hasUserSettings: this.memory.userSettings && !this.memory.userSettings.error && Object.keys(this.memory.userSettings).length > 0,
        hasEmailSettings: this.memory.emailSettings && !this.memory.emailSettings.error && Object.keys(this.memory.emailSettings).length > 0
      };

      const decision = await this.reason(context);
      
      // Log the decision to activity logs
      this.logOperation('Agent Decision', `🧠 [DECISION] ${decision.reasoning}`, 'info', {
        action: decision.action,
        attempt: attempts,
        context: context
      });

      // Execute the agent's decision
      let actionResult = null;
      
      switch (decision.action) {
        case 'get_user_settings':
          this.logOperation('Action Execution', '🔧 [ACTION] Retrieving user settings from AWS', 'in-progress');
          actionResult = await this.getUserSettings();
          this.memory.userSettings = actionResult;
          this.logOperation('Action Execution', '✅ [COMPLETE] User settings retrieved successfully', 'success', { hasSettings: !!actionResult });
          break;
          
        case 'get_email_settings':
          this.logOperation('Action Execution', '🔧 [ACTION] Retrieving email settings from AWS', 'in-progress');
          actionResult = await this.getEmailSettings();
          this.memory.emailSettings = actionResult;
          this.logOperation('Action Execution', '✅ [COMPLETE] Email settings retrieved successfully', 'success', { hasSettings: !!actionResult });
          break;
          
        case 'lead_search':
          this.logOperation('Lead Search', `🔍 [SEARCH] Searching for ${decision.parameters.title || 'leads'} at ${decision.parameters.industry || 'various industries'}`, 'in-progress', decision.parameters);
          actionResult = await this.leadSearch(decision.parameters);
          if (actionResult.found > 0) {
            this.logOperation('Lead Search', `✅ [SEARCH SUCCESS] Found ${actionResult.found} leads! Total progress: ${foundLeads.length + actionResult.found}/${targetLeads}`, 'success', { 
              found: actionResult.found, 
              total: foundLeads.length + actionResult.found,
              target: targetLeads 
            });
            
            // FILTER OUT DUPLICATES before processing
            const newLeads = actionResult.leads.filter(lead => {
              const companyName = lead.organization?.name?.toLowerCase();
              const existingEmail = lead.email?.toLowerCase();
              
              // Check if company already contacted
              if (companyName && this.memory.duplicateCheck.emailedCompanies.has(companyName)) {
                return false;
              }
              
              // Check if email already processed
              if (existingEmail && this.memory.duplicateCheck.processedEmails.has(existingEmail)) {
                return false;
              }
              
              return true;
            });
            
            
            // Process each NEW lead through the full workflow
            for (const lead of newLeads) {
              this.logOperation('Lead Processing', `🔍 [PROCESSING] Researching lead: ${lead.name} at ${lead.organization?.name}`, 'in-progress', { 
                lead: lead.name, 
                company: lead.organization?.name 
              });
              
              // Research the lead's company
              const research = await this.serperResearch({
                companyName: lead.organization?.name,
                searchQuery: `${lead.organization?.name} company business model products services`
              });
              
              // Unlock email if research looks good
              if (research.success) {
                const emailUnlock = await this.unlockEmail({
                  firstName: lead.first_name,
                  lastName: lead.last_name,
                  companyName: lead.organization?.name,
                  domain: lead.organization?.primary_domain
                });
                
                // Track email unlock success and handle both success/failure cases
                if (emailUnlock.success && this.memory.emailSettings) {
                  this.logOperation('Email Processing', `📧 [EMAIL SUCCESS] Unlocked ${emailUnlock.all_emails?.length || 1} email(s) for ${lead.name} at ${lead.organization?.name}`, 'success', { 
                    emails: emailUnlock.all_emails?.length || 1,
                    company: lead.organization?.name,
                    employees: lead.organization?.estimated_num_employees || 'unknown'
                  });
                  
                  // Qualify lead to generate AI research report
                  const qualification = await this.qualifyLead({
                    leadData: lead,
                    researchData: research
                  });

                  // Skip leads that don't meet qualification criteria
                  if (qualification?.tier === 'REJECT' || qualification?.qualified === false) {
                    this.logOperation('Lead Rejected', `Skipping ${lead.name} at ${lead.organization?.name} — qualification tier ${qualification?.tier || 'REJECT'}`, 'info');
                    continue;
                  }

                  const personalizedEmail = await this.buildPersonalizedEmail({
                    leadData: lead,
                    researchData: research,
                    qualificationData: qualification,
                    emailSettings: this.memory.emailSettings
                  });

                  // Create complete lead data
                  const completeLead = {
                    ...lead,
                    email: emailUnlock.email,
                    all_emails: emailUnlock.all_emails || [emailUnlock.email],
                    research: research.data,
                    personalizedEmail: personalizedEmail.email,
                    emailSubject: personalizedEmail.subject,
                    confidenceReport: personalizedEmail.confidenceReport,
                    confidenceLevel: personalizedEmail.confidenceLevel,
                    salesAngle: personalizedEmail.salesAngle || null,
                    aiReport: qualification?.aiReport || null,
                    emailUnlockStatus: 'success'
                  };
                  
                  // Add to local results
                  foundLeads.push(completeLead);
                  
                  // Save to database like normal lead agent
                  await this.addLeadToDatabase(completeLead);
                  
                  this.logOperation('Lead Complete', `✅ [LEAD COMPLETE] Successfully processed and saved ${lead.name} at ${lead.organization?.name}`, 'success', {
                    leadName: lead.name,
                    company: lead.organization?.name,
                    email: emailUnlock.email,
                    totalFound: foundLeads.length,
                    target: targetLeads,
                    leadsProcessed: foundLeads.length,
                    targetLeads: targetLeads
                  });
                  
                  // Add to email queue for approval/sending
                  await this.addToEmailQueue(completeLead);
                  
                  // Update real-time duplicate tracking to prevent duplicates within same session
                  const companyName = lead.organization?.name?.toLowerCase();
                  const emailAddress = emailUnlock.email?.toLowerCase();
                  
                  if (companyName) {
                    this.memory.duplicateCheck.emailedCompanies.add(companyName);
                  }
                  if (emailAddress) {
                    this.memory.duplicateCheck.processedEmails.add(emailAddress);
                  }
                  
                } else {
                  
                  // If it's a constructed/fallback email issue, skip this lead and continue searching
                  if (emailUnlock.error && emailUnlock.error.includes('constructed/fallback')) {
                    continue; // Skip this lead entirely, don't add to results
                  }
                  
                  
                  const partialLead = {
                    ...lead,
                    email: 'Email not available - ' + (emailUnlock.error || 'Apollo limitation'),
                    research: research.data,
                    emailUnlockStatus: 'failed',
                    emailUnlockError: emailUnlock.error
                  };
                  
                  foundLeads.push(partialLead);
                  
                  // Still save to database even without email
                  await this.addLeadToDatabase(partialLead);
                  
                  // Update duplicate tracking for company (even without email)
                  const companyName = lead.organization?.name?.toLowerCase();
                  if (companyName) {
                    this.memory.duplicateCheck.emailedCompanies.add(companyName);
                  }
                }
              }
            }
            
            // Remember successful strategy
            this.memory.successfulStrategies.push({
              parameters: decision.parameters,
              results: actionResult.found,
              timestamp: new Date().toISOString()
            });
          } else {
            this.logOperation('Lead Search', `❌ [SEARCH FAILED] Apollo search returned 0 leads for ${decision.parameters.title || 'specified criteria'}`, 'warning', { 
              parameters: decision.parameters,
              reason: actionResult.error || 'No leads found'
            });
            
            // Remember failed strategy
            this.memory.failedStrategies.push({
              parameters: decision.parameters,
              reason: actionResult.error || 'No leads found',
              timestamp: new Date().toISOString()
            });
          }
          break;
          
        default:
          break;
      }

      // Small delay between reasoning cycles
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return foundLeads;
  }

  // Helper to get API keys
  async getApiKey(service) {
    try {
      // Use cached settings if available, otherwise fetch from AWS DynamoDB
      let userSettings = null;
      if (this.memory.userSettings && !this.memory.userSettings.error) {
        userSettings = this.memory.userSettings.rawLeadContactSettings || this.memory.userSettings;
      } else {
        userSettings = await getUserSettings(this.userId);
      }
      
      const apiKeys = userSettings?.apiKeys || {};
      if (apiKeys[service]) {
        return apiKeys[service];
      }
      
      // Fallback to environment variables
      const envKey = service === 'apollo' ? 'APOLLO_API_KEY' :
                    service === 'serper' ? 'SERPER_API_KEY' :
                    service === 'hunter' ? 'HUNTER_API_KEY' : null;
      return envKey ? process.env[envKey] : null;
    } catch (error) {
      console.error(`Error getting ${service} API key:`, error.message);
      return null;
    }
  }

  // Extract specific interesting insights from research data
  extractSpecificInsights(researchData) {
    const insights = [];
    
    if (!researchData) return insights;
    
    // Combine ALL available research text for comprehensive analysis
    const allText = [];
    const originalText = []; // Keep original case for proper names
    
    // Extract from answer box (check both locations)
    if (researchData.answerBox?.snippet || researchData.answerBox?.answer) {
      const answerText = researchData.answerBox.snippet || researchData.answerBox.answer;
      allText.push(answerText.toLowerCase());
      originalText.push(answerText);
    }
    if (researchData.data?.answerBox?.snippet || researchData.data?.answerBox?.answer) {
      const answerText = researchData.data.answerBox.snippet || researchData.data.answerBox.answer;
      allText.push(answerText.toLowerCase());
      originalText.push(answerText);
    }
    
    // Extract from organic results (check nested structure)
    const organicResults = researchData.data?.organic || researchData.organic || [];
    organicResults.slice(0, 8).forEach(result => {
      if (result.snippet) {
        allText.push(result.snippet.toLowerCase());
        originalText.push(result.snippet);
      }
      if (result.title) {
        allText.push(result.title.toLowerCase());
        originalText.push(result.title);
      }
    });
    
    // Also check any company details or key insights
    if (researchData.companyDetails) {
      allText.push(researchData.companyDetails.toLowerCase());
      originalText.push(researchData.companyDetails);
    }
    
    if (researchData.keyInsights && Array.isArray(researchData.keyInsights)) {
      researchData.keyInsights.forEach(insight => {
        const insightText = typeof insight === 'string' ? insight : JSON.stringify(insight);
        allText.push(insightText.toLowerCase());
        originalText.push(insightText);
      });
    }
    
    const fullText = allText.join(' ');
    const fullOriginalText = originalText.join(' ');
    
    // Extract highly specific business insights that show deep research
    const businessPatterns = [
      // Recent financial achievements (very impressive to mention)
      { pattern: /raised \$(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i, type: 'recent_funding', extract: (match) => `Recently secured $${match[1]} ${match[2].replace(/[MB]/, match[2].includes('B') ? 'billion' : 'million')} in funding` },
      { pattern: /(\$\d+(?:\.\d+)?)\s*(million|billion|M|B)\s*(Series [ABC]|seed|funding|round)/i, type: 'recent_funding', extract: (match) => `Completed ${match[3]} funding of ${match[1]} ${match[2]}` },
      { pattern: /valued at \$(\d+(?:\.\d+)?)\s*(billion|million|B|M)/i, type: 'valuation', extract: (match) => `Current valuation of $${match[1]} ${match[2].replace(/[BM]/, match[2].includes('B') ? 'billion' : 'million')}` },
      { pattern: /IPO|went public|public offering/i, type: 'ipo', extract: () => `Recently went public` },
      
      // Impressive growth metrics (people love seeing their growth recognized)
      { pattern: /grew (\d+)%|growth of (\d+)%|increased (\d+)%/i, type: 'growth', extract: (match) => `Achieved ${match[1] || match[2] || match[3]}% growth` },
      { pattern: /(doubled|tripled|quadrupled)\s*(revenue|sales|customers)/i, type: 'growth', extract: (match) => `${match[1].charAt(0).toUpperCase() + match[1].slice(1)} their ${match[2]}` },
      { pattern: /expanded to (\d+)\s*(new\s*)?(countries|markets|states|cities)/i, type: 'expansion', extract: (match) => `Expanded to ${match[1]} ${match[2] || ''}${match[3]}` },
      { pattern: /opened (\d+)\s*(new\s*)?(offices?|locations?|stores?)/i, type: 'expansion', extract: (match) => `Opened ${match[1]} new ${match[3]}` },
      
      // Product launches and innovations (shows they're forward-thinking)
      { pattern: /(recently|just|newly)\s*(launched|released|unveiled|introduced)\s*([^.]{10,80})/i, type: 'product_launch', extract: (match) => `Recently ${match[2]} ${match[3].trim()}` },
      { pattern: /new\s*(product|platform|service|feature)\s*([^.]{5,60})/i, type: 'innovation', extract: (match) => `Launched new ${match[1]} ${match[2].trim()}` },
      { pattern: /beta\s*(testing|launch|release)|pilot\s*program/i, type: 'innovation', extract: (match) => `Currently in beta testing phase` },
      
      // Partnerships and integrations (shows market credibility)
      { pattern: /partnership with ([A-Z][a-zA-Z\s&®™]{2,40})/i, type: 'partnership', extract: (match) => `Formed strategic partnership with ${match[1].trim()}` },
      { pattern: /acquired ([A-Z][a-zA-Z\s&]{2,30})/i, type: 'acquisition', extract: (match) => `Recently acquired ${match[1].trim()}` },
      { pattern: /integration with ([A-Z][a-zA-Z\s&®™]{2,40})/i, type: 'integration', extract: (match) => `Integrated with ${match[1].trim()}` },
      { pattern: /collaborating with ([A-Z][a-zA-Z\s&]{2,30})/i, type: 'collaboration', extract: (match) => `Collaborating with ${match[1].trim()}` },
      
      // Awards and recognition (everyone loves recognition)
      { pattern: /(award|recognized|named|ranked)\s*([^.]{10,80})/i, type: 'recognition', extract: (match) => `${match[1].charAt(0).toUpperCase() + match[1].slice(1)} ${match[2].trim()}` },
      { pattern: /top\s*(\d+)\s*([^.]{5,40})/i, type: 'ranking', extract: (match) => `Ranked in top ${match[1]} ${match[2].trim()}` },
      { pattern: /best\s*([^.]{5,40})\s*(company|platform|service)/i, type: 'recognition', extract: (match) => `Recognized as best ${match[1].trim()} ${match[2]}` },
      
      // Market position and scale (impressive numbers)
      { pattern: /(\d+(?:\.\d+)?)\s*(million|billion|k|thousand)\s*(users|customers|clients|members)/i, type: 'scale', extract: (match) => `Serves ${match[1]} ${match[2].replace('k', 'thousand')} ${match[3]}` },
      { pattern: /market leader|leading (platform|provider|company)/i, type: 'market_position', extract: (match) => `Market-leading ${match[1] || 'company'}` },
      { pattern: /(\d+)\s*countries|global presence/i, type: 'global', extract: (match) => match[1] ? `Operating in ${match[1]} countries` : `Global presence` },
      
      // Company culture and values (shows you understand their mission)
      { pattern: /mission\s*(?:is\s*)?to\s*([^.]{10,60})/i, type: 'mission', extract: (match) => `Mission to ${match[1].trim()}` },
      { pattern: /committed to\s*([^.]{10,50})/i, type: 'values', extract: (match) => `Committed to ${match[1].trim()}` },
      { pattern: /focuses?\s*on\s*([^.]{10,50})/i, type: 'focus', extract: (match) => `Focuses on ${match[1].trim()}` },
      
      // Specific product mentions (shows detailed knowledge)
      { pattern: /(behind|powers|operates)\s*([A-Z][a-zA-Z®™]{2,20})/i, type: 'key_product', extract: (match) => `Company ${match[1]} ${match[2]}` },
      { pattern: /developed\s*([A-Z][a-zA-Z\s®™]{5,30})/i, type: 'development', extract: (match) => `Developed ${match[1].trim()}` },
      
      // Recent news and developments (very timely and impressive)
      { pattern: /(this year|2024|2025)\s*([^.]{10,60})/i, type: 'recent_news', extract: (match) => `In ${match[1]}, ${match[2].trim()}` },
      { pattern: /announced\s*([^.]{10,80})/i, type: 'announcement', extract: (match) => `Announced ${match[1].trim()}` }
    ];
    
    // Extract multiple insights for maximum personalization (up to 8 different insights)
    const usedTypes = new Set();
    
    businessPatterns.forEach(({ pattern, type, extract }) => {
      // Skip if we already have this type of insight (for diversity)
      if (usedTypes.has(type) && insights.length >= 4) return;
      
      // Check both original text (for proper names) and lowercase text
      let matches = fullOriginalText.match(pattern);
      if (!matches) {
        matches = fullText.match(pattern);
      }
      
      if (matches && insights.length < 8) {
        try {
          const insight = extract(matches);
          if (insight && insight.length > 15 && insight.length < 200) {
            // Check if this insight is meaningfully different from existing ones
            const isDuplicate = insights.some(existing => {
              const similarity = this.calculateSimilarity(existing.insight.toLowerCase(), insight.toLowerCase());
              return similarity > 0.7;
            });
            
            if (!isDuplicate) {
              insights.push({
                type,
                insight: insight.charAt(0).toUpperCase() + insight.slice(1),
                confidence: 'high'
              });
              usedTypes.add(type);
            }
          }
        } catch (e) {
          // Skip invalid extractions
        }
      }
    });
    
    // Add additional context insights if we have room
    if (insights.length < 6) {
      // Look for executive mentions or leadership changes
      const leadershipPatterns = [
        /CEO ([A-Z][a-zA-Z\s]{2,25})/i,
        /founded by ([A-Z][a-zA-Z\s]{2,25})/i,
        /([A-Z][a-zA-Z\s]{2,25})\s*(joined|appointed|named)\s*(CEO|CTO|CFO)/i,
        /new\s*(CEO|CTO|CFO|president)\s*([A-Z][a-zA-Z\s]{2,25})/i
      ];
      
      leadershipPatterns.forEach(pattern => {
        if (insights.length < 8) {
          const match = fullOriginalText.match(pattern);
          if (match) {
            let leadershipInsight = '';
            if (match[0].toLowerCase().includes('ceo')) {
              leadershipInsight = `Led by CEO ${match[1] || match[2]}`;
            } else if (match[0].toLowerCase().includes('founded')) {
              leadershipInsight = `Founded by ${match[1]}`;
            } else {
              leadershipInsight = `Recently appointed ${match[2] || match[1]} as ${match[3] || match[1]}`;
            }
            
            if (leadershipInsight && !insights.some(i => i.insight.toLowerCase().includes('ceo') || i.insight.toLowerCase().includes('founded'))) {
              insights.push({
                type: 'leadership',
                insight: leadershipInsight,
                confidence: 'high'
              });
            }
          }
        }
      });
      
      // Look for impressive numbers or statistics
      const statsPatterns = [
        /(\d+)%\s*(growth|increase|improvement)/i,
        /save[sd]?\s*(\$?\d+[kmb]?)\s*(million|billion|dollars|%)/i,
        /process[es]*\s*(\$?\d+[kmb]?)\s*(million|billion|transactions|payments)/i,
        /(\d+[kmb]?)\s*(transactions|payments|requests)\s*(per|daily|monthly)/i
      ];
      
      statsPatterns.forEach(pattern => {
        if (insights.length < 8) {
          const match = fullText.match(pattern);
          if (match && !insights.some(i => i.type === 'statistics')) {
            let stat = match[0];
            insights.push({
              type: 'statistics',
              insight: `Processes ${stat}`,
              confidence: 'medium'
            });
          }
        }
      });
    }
    
    // Sort by confidence and return the most impactful insights
    return insights
      .sort((a, b) => (b.confidence === 'high' ? 1 : 0) - (a.confidence === 'high' ? 1 : 0))
      .slice(0, 6); // Return top 6 most interesting insights
  }

  // Helper method to calculate text similarity (prevent duplicate insights)
  calculateSimilarity(text1, text2) {
    const words1 = text1.split(' ').filter(w => w.length > 3);
    const words2 = text2.split(' ').filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords / totalWords;
  }

  // Extract comprehensive company details from Serper research data
  extractCompanyDetailsFromResearch(researchData, leadData) {
    if (!researchData) {
      return {
        name: leadData.company || leadData.organization?.name || 'Unknown',
        industry: leadData.organization?.industry || 'Unknown',
        size: leadData.organization?.estimated_num_employees || 'Unknown',
        domain: leadData.organization?.primary_domain || leadData.email?.split('@')[1] || 'Unknown'
      };
    }

    // Combine all research text for analysis - check both nested and top-level structure
    const allText = [];
    
    // Extract from answer box (check both locations)
    if (researchData.answerBox?.snippet || researchData.answerBox?.answer) {
      allText.push(researchData.answerBox.snippet || researchData.answerBox.answer);
    }
    if (researchData.data?.answerBox?.snippet || researchData.data?.answerBox?.answer) {
      allText.push(researchData.data.answerBox.snippet || researchData.data.answerBox.answer);
    }
    
    // Extract from organic results (check nested structure)
    const organicResults = researchData.data?.organic || researchData.organic || [];
    organicResults.forEach(result => {
      if (result.snippet) allText.push(result.snippet);
      if (result.title) allText.push(result.title);
    });
    
    const fullText = allText.join(' ').toLowerCase();
    const originalText = allText.join(' '); // Keep original case for extraction

    // Extract industry from research content
    const industryPatterns = [
      // Specific SaaS/Tech patterns
      { pattern: /saas\s*(platform|company|provider|solution)/i, industry: 'SaaS Platform' },
      { pattern: /software.as.a.service/i, industry: 'SaaS Platform' },
      { pattern: /(cloud|web).*(platform|software|service)/i, industry: 'Cloud Software' },
      { pattern: /(business|workflow|project)\s*management\s*(software|platform|tool)/i, industry: 'Business Management Software' },
      { pattern: /customer.*relationship.*management|crm\s*(platform|software)/i, industry: 'CRM Software' },
      { pattern: /marketing\s*(automation|technology|platform|software)/i, industry: 'Marketing Technology' },
      { pattern: /enterprise\s*(software|resource|planning)/i, industry: 'Enterprise Software' },
      { pattern: /analytics\s*(platform|software|tool)/i, industry: 'Analytics & Data' },
      { pattern: /security\s*(software|platform|solution)/i, industry: 'Cybersecurity' },
      
      // Financial/Fintech
      { pattern: /fintech|financial.*technology/i, industry: 'FinTech' },
      { pattern: /payment\s*(processing|platform|solution)/i, industry: 'Payment Processing' },
      { pattern: /banking\s*(software|platform|technology)/i, industry: 'Banking Technology' },
      { pattern: /accounting\s*(software|platform)/i, industry: 'Accounting Software' },
      
      // Healthcare/Medical
      { pattern: /healthcare\s*(technology|software|platform)/i, industry: 'Healthcare Technology' },
      { pattern: /medical\s*(software|platform|device)/i, industry: 'Medical Technology' },
      { pattern: /telemedicine|telehealth/i, industry: 'Telemedicine' },
      { pattern: /pharmaceutical|pharma/i, industry: 'Pharmaceuticals' },
      
      // E-commerce/Retail
      { pattern: /e.commerce|ecommerce/i, industry: 'E-commerce' },
      { pattern: /retail\s*(technology|software)/i, industry: 'Retail Technology' },
      { pattern: /point.of.sale|pos\s*system/i, industry: 'Point of Sale' },
      
      // Other industries
      { pattern: /real.*estate\s*(technology|software)/i, industry: 'Real Estate Technology' },
      { pattern: /education.*technology|edtech/i, industry: 'Education Technology' },
      { pattern: /hr\s*(technology|software|platform)/i, industry: 'HR Technology' },
      { pattern: /logistics\s*(software|platform)/i, industry: 'Logistics Technology' },
      { pattern: /construction\s*(software|technology)/i, industry: 'Construction Technology' },
      { pattern: /manufacturing|industrial/i, industry: 'Manufacturing' },
      
      // Generic tech fallbacks
      { pattern: /software\s*(company|developer|provider)/i, industry: 'Software Development' },
      { pattern: /technology\s*(company|provider|solution)/i, industry: 'Technology Services' },
      { pattern: /digital\s*(platform|solution|transformation)/i, industry: 'Digital Solutions' }
    ];

    let detectedIndustry = leadData.organization?.industry || 'Technology';
    for (const { pattern, industry } of industryPatterns) {
      if (pattern.test(fullText)) {
        detectedIndustry = industry;
        break; // Use first match for most specific categorization
      }
    }

    // Extract company size from research content
    const sizePatterns = [
      { pattern: /(\d+(?:,\d+)?)\s*employees?/i, extract: (match) => `${match[1]} employees` },
      { pattern: /team\s*of\s*(\d+(?:,\d+)?)/i, extract: (match) => `${match[1]} employees` },
      { pattern: /(\d+)\+\s*people/i, extract: (match) => `${match[1]}+ employees` },
      { pattern: /workforce\s*of\s*(\d+(?:,\d+)?)/i, extract: (match) => `${match[1]} employees` },
      { pattern: /staff\s*of\s*(\d+(?:,\d+)?)/i, extract: (match) => `${match[1]} employees` },
      // Size indicators
      { pattern: /startup|early.stage/i, extract: () => 'Startup (1-50 employees)' },
      { pattern: /small.*business|SMB/i, extract: () => 'Small Business (10-100 employees)' },
      { pattern: /enterprise|large.*company/i, extract: () => 'Enterprise (1000+ employees)' },
      { pattern: /fortune\s*500|f500/i, extract: () => 'Fortune 500 (10,000+ employees)' },
      { pattern: /mid.size|medium.*company/i, extract: () => 'Mid-size (100-1000 employees)' }
    ];

    let detectedSize = leadData.organization?.estimated_num_employees || 'Unknown';
    for (const { pattern, extract } of sizePatterns) {
      const match = originalText.match(pattern);
      if (match) {
        detectedSize = extract(match);
        break;
      }
    }

    // Extract revenue/funding information (adds credibility)
    const revenuePatterns = [
      { pattern: /revenue\s*of\s*\$?(\d+(?:\.\d+)?)\s*(billion|million|B|M)/i, extract: (match) => `$${match[1]}${match[2].charAt(0).toUpperCase()} revenue` },
      { pattern: /\$(\d+(?:\.\d+)?)\s*(billion|million|B|M)\s*valuation/i, extract: (match) => `$${match[1]}${match[2].charAt(0).toUpperCase()} valuation` },
      { pattern: /raised\s*\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i, extract: (match) => `Raised $${match[1]}${match[2].charAt(0).toUpperCase()}` },
      { pattern: /publicly.*traded|nasdaq|nyse/i, extract: () => 'Publicly traded' }
    ];

    let financialInfo = null;
    for (const { pattern, extract } of revenuePatterns) {
      const match = originalText.match(pattern);
      if (match) {
        financialInfo = extract(match);
        break;
      }
    }

    // Extract founding information
    const foundingPatterns = [
      { pattern: /founded\s*in\s*(\d{4})/i, extract: (match) => `Founded in ${match[1]}` },
      { pattern: /established\s*(\d{4})/i, extract: (match) => `Established ${match[1]}` },
      { pattern: /since\s*(\d{4})/i, extract: (match) => `Operating since ${match[1]}` }
    ];

    let foundingInfo = null;
    for (const { pattern, extract } of foundingPatterns) {
      const match = originalText.match(pattern);
      if (match) {
        foundingInfo = extract(match);
        break;
      }
    }

    // Extract location information
    const locationPatterns = [
      { pattern: /headquartered\s*in\s*([A-Z][a-zA-Z\s,]+(?:USA?|United States)?)/i, extract: (match) => `HQ: ${match[1].trim()}` },
      { pattern: /based\s*in\s*([A-Z][a-zA-Z\s,]+(?:USA?|United States)?)/i, extract: (match) => `Based in ${match[1].trim()}` },
      { pattern: /offices?\s*in\s*([A-Z][a-zA-Z\s,&]+)/i, extract: (match) => `Offices in ${match[1].trim()}` }
    ];

    let locationInfo = null;
    for (const { pattern, extract } of locationPatterns) {
      const match = originalText.match(pattern);
      if (match && match[1].length < 50) { // Avoid overly long matches
        locationInfo = extract(match);
        break;
      }
    }

    return {
      name: leadData.company || leadData.organization?.name || 'Unknown',
      industry: detectedIndustry,
      size: detectedSize,
      domain: leadData.organization?.primary_domain || leadData.email?.split('@')[1] || 'Unknown',
      // Additional enriched details from research
      financialInfo,
      foundingInfo,
      locationInfo,
      businessModel: this.extractBusinessType(fullText), // Use existing method
      keyServices: this.extractKeyServices(fullText) // Use existing method
    };
  }

  // Calculate relevance score for search results
  calculateRelevanceScore(result, companyName) {
    if (!result || !companyName) return 0;
    
    let score = 0;
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const company = companyName.toLowerCase();
    
    // Company name mentions (highest weight)
    if (title.includes(company)) score += 10;
    if (snippet.includes(company)) score += 5;
    
    // Business-relevant keywords
    const businessKeywords = ['company', 'business', 'platform', 'software', 'service', 'solution', 'technology'];
    businessKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 2;
      if (snippet.includes(keyword)) score += 1;
    });
    
    // Recency indicators
    const recentKeywords = ['2024', '2025', 'recent', 'new', 'latest', 'announced'];
    recentKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 3;
      if (snippet.includes(keyword)) score += 1;
    });
    
    return score;
  }

  // Extract competitive positioning from research
  extractCompetitivePosition(researchData) {
    const organicResults = researchData?.data?.organic || researchData?.organic || [];
    if (organicResults.length === 0) return 'Competitive Player';
    
    const allText = organicResults.map(r => r.snippet || '').join(' ').toLowerCase();
    
    const positionKeywords = [
      { pattern: /market leader|leading (platform|provider|company)/i, position: 'Market Leader' },
      { pattern: /number one|#1|top (platform|provider|company)/i, position: 'Top Provider' },
      { pattern: /fastest.growing|rapid.growth|emerging leader/i, position: 'Fast Growing' },
      { pattern: /innovative|cutting.edge|pioneering/i, position: 'Innovation Leader' },
      { pattern: /enterprise.grade|enterprise.ready|enterprise.leader/i, position: 'Enterprise Leader' },
      { pattern: /startup|early.stage|emerging/i, position: 'Emerging Player' },
      { pattern: /established|trusted|proven/i, position: 'Established Provider' }
    ];
    
    for (const { pattern, position } of positionKeywords) {
      if (pattern.test(allText)) {
        return position;
      }
    }
    
    return 'Competitive Player';
  }

  // Extract technology stack mentions from research
  extractTechnologyStack(researchData) {
    const organicResults = researchData?.data?.organic || researchData?.organic || [];
    if (organicResults.length === 0) return [];
    
    const allText = organicResults.map(r => r.snippet || '').join(' ');
    const technologies = [];
    
    const techPatterns = [
      // Cloud platforms
      /AWS|Amazon Web Services/i,
      /Google Cloud|GCP/i,
      /Microsoft Azure|Azure/i,
      /Kubernetes|Docker/i,
      
      // Databases
      /PostgreSQL|MySQL|MongoDB|Redis/i,
      /Elasticsearch|Snowflake/i,
      
      // Programming languages/frameworks
      /React|Angular|Vue\.js/i,
      /Node\.js|Python|Java|Ruby/i,
      /Django|Flask|Express/i,
      
      // SaaS tools
      /Salesforce|HubSpot|Slack/i,
      /Stripe|PayPal|Shopify/i,
      /Zendesk|Intercom|Twilio/i,
      
      // Analytics/Marketing
      /Google Analytics|Mixpanel|Amplitude/i,
      /Marketo|Mailchimp|SendGrid/i
    ];
    
    techPatterns.forEach(pattern => {
      const match = allText.match(pattern);
      if (match && !technologies.includes(match[0])) {
        technologies.push(match[0]);
      }
    });
    
    return technologies.slice(0, 8); // Return top 8 technologies
  }

  // Assess overall quality of research data
  assessResearchQuality(researchData) {
    if (!researchData) return 'poor';
    
    let score = 0;
    
    // Number of results
    if (researchData.organic?.length >= 8) score += 3;
    else if (researchData.organic?.length >= 5) score += 2;
    else if (researchData.organic?.length >= 3) score += 1;
    
    // Has answer box (direct company info)
    if (researchData.answerBox) score += 2;
    
    // Has knowledge graph
    if (researchData.knowledgeGraph) score += 2;
    
    // Quality of content (length and variety)
    const organicResults = researchData?.data?.organic || researchData?.organic || [];
    if (organicResults.length > 0) {
      const totalContentLength = organicResults.reduce((sum, r) => sum + (r.snippet?.length || 0), 0);
      if (totalContentLength > 2000) score += 2;
      else if (totalContentLength > 1000) score += 1;
    }
    
    // Variety of sources
    if (organicResults.length > 0) {
      const uniqueDomains = new Set(organicResults.map(r => {
        try {
          return new URL(r.link).hostname;
        } catch {
          return r.link;
        }
      }));
      if (uniqueDomains.size >= 5) score += 2;
      else if (uniqueDomains.size >= 3) score += 1;
    }
    
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'fair';
    return 'poor';
  }

  // Database management methods (like normal lead agent)
  async loadLeadsDatabase() {
    try {
      const data = await fs.readFile(this.leadsFile, 'utf8');
      const leadsData = JSON.parse(data);
      
      // Ensure structure exists
      if (!leadsData.rejectedLeads) leadsData.rejectedLeads = [];
      if (!leadsData.emailedCompanies) leadsData.emailedCompanies = [];
      if (!leadsData.allLeads) leadsData.allLeads = [];
      
      return leadsData;
    } catch (error) {
      // File doesn't exist, start fresh
      return {
        allLeads: [],
        emailedCompanies: [],
        rejectedLeads: []
      };
    }
  }

  async saveLeadsDatabase(data) {
    try {
      await fs.mkdir(path.dirname(this.leadsFile), { recursive: true });
      await fs.writeFile(this.leadsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ [DATABASE] Error saving leads database:', error);
    }
  }

  async addLeadToDatabase(leadData) {
    try {
      const db = await this.loadLeadsDatabase();
      
      // Add lead with timestamp and reasoning agent flag
      const leadRecord = {
        ...leadData,
        id: `reasoning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: 'reasoning_agent',
        timestamp: new Date().toISOString(),
        userId: this.userId
      };
      
      db.allLeads.push(leadRecord);
      
      // Track company to avoid duplicates - check both formats
      const companyName = leadData.company || leadData.organization?.name;
      if (companyName && !db.emailedCompanies.includes(companyName)) {
        db.emailedCompanies.push(companyName);
      }
      
      await this.saveLeadsDatabase(db);
      
      return leadRecord;
    } catch (error) {
      console.error('❌ [DATABASE] Error adding lead:', error);
      throw error;
    }
  }

  async addToEmailQueue(leadData) {
    try {
      if (!leadData.personalizedEmail || !leadData.emailSubject) {
        this.logIssue('warning', 'Lead queued without email content', { leadData });
        return;
      }

      // Emit metric: email queued
      this.emitMetric('emails', 'queued', 1, 'increment');

      const ccEmails = this.memory.emailSettings?.emailBuilder?.ccEmails || '';
      const bccEmails = this.memory.emailSettings?.emailBuilder?.bccEmails || '';

      const queueData = {
        id: `reasoning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: this.userId,
        agentId: this.agentId, // Add agentId for proper data isolation
        timestamp: new Date().toISOString(),
        status: 'pending',
        source: 'reasoning_agent',
        
        // Email content
        to: leadData.email,
        subject: leadData.emailSubject,
        body: leadData.personalizedEmail,
        cc: ccEmails, // Add CC from settings
        bcc: bccEmails, // Add BCC from settings
        
        // AI Confidence Report
        confidenceReport: leadData.confidenceReport,
        confidenceLevel: leadData.confidenceLevel,
        
        // AI Report (NEW - for verification and UI display)
        aiReport: leadData.aiReport || this.memory.currentQualification?.aiReport || null,
        
        // Lead information
        leadInfo: {
          name: leadData.name || leadData.first_name + ' ' + leadData.last_name,
          title: leadData.title,
          company: leadData.company,
          linkedinUrl: leadData.linkedin_url,
          email: leadData.email
        },
        
        // Research data for context - include comprehensive research intelligence
        researchData: leadData.research ? {
          summary: `Comprehensive research completed: ${(leadData.research.data?.organic || leadData.research.organic || []).length} sources analyzed with ${this.extractSpecificInsights(leadData.research).length} key insights extracted`,
          hasIntelligence: true,
          searchQuery: leadData.research.searchParameters?.q || `${leadData.company || leadData.organization?.name} company research`,
          
          // Extract specific business details that show deep research
          specificInsights: this.extractSpecificInsights(leadData.research),
          
          // Include key insights from organic results with enhanced data (check nested structure)
          keyInsights: (leadData.research.data?.organic || leadData.research.organic || []).slice(0, 5).map(result => ({
            title: result.title,
            snippet: result.snippet?.substring(0, 200) + (result.snippet?.length > 200 ? '...' : ''),
            source: result.link,
            domain: result.link ? new URL(result.link).hostname : null,
            date: result.date || null,
            relevanceScore: this.calculateRelevanceScore(result, leadData.company || leadData.organization?.name)
          })).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)),
          
          // Include answer box if available with enhanced processing (check both locations)
          answerBox: (leadData.research.answerBox || leadData.research.data?.answerBox) ? {
            title: (leadData.research.answerBox || leadData.research.data?.answerBox).title,
            snippet: (leadData.research.answerBox || leadData.research.data?.answerBox).snippet || (leadData.research.answerBox || leadData.research.data?.answerBox).answer,
            source: (leadData.research.answerBox || leadData.research.data?.answerBox).link,
            highlights: (leadData.research.answerBox || leadData.research.data?.answerBox).snippetHighlighted || [],
            isDirectAnswer: true
          } : null,
          
          // Company details extracted from comprehensive research analysis
          companyDetails: this.extractCompanyDetailsFromResearch(leadData.research, leadData),
          
          // Business intelligence extracted from research
          businessIntelligence: {
            businessModel: this.extractBusinessType((leadData.research.data?.organic || leadData.research.organic || []).map(r => r.snippet).join(' ')),
            keyServices: this.extractKeyServices((leadData.research.data?.organic || leadData.research.organic || []).map(r => r.snippet).join(' ')),
            competitivePosition: this.extractCompetitivePosition(leadData.research),
            technologyStack: this.extractTechnologyStack(leadData.research)
          },
          
          // Full research data for debugging and advanced processing
          fullResearch: {
            totalResults: (leadData.research.data?.organic || leadData.research.organic || []).length,
            hasAnswerBox: !!(leadData.research.answerBox || leadData.research.data?.answerBox),
            hasKnowledgeGraph: !!(leadData.research.knowledgeGraph || leadData.research.data?.knowledgeGraph),
            searchTimestamp: new Date().toISOString(),
            researchQuality: this.assessResearchQuality(leadData.research)
          }
        } : {
          summary: 'No research data available',
          hasIntelligence: false
        }
      };

      await this.emailQueue.addToQueue(queueData);

      // Emit SSE event so frontend updates count immediately
      this.emit('email_queued', {
        type: 'email_queued',
        agentId: this.agentId,
        emailId: queueData.id,
        to: queueData.to,
        company: leadData.company,
        timestamp: new Date().toISOString()
      });

      // NOW track this contact in the database since email was successfully queued
      try {
        const leadInfo = {
          name: leadData.name || leadData.first_name + ' ' + leadData.last_name,
          email: leadData.email,
          company: leadData.company,
          title: leadData.title
        };
        
        // Emit SSE progress for contact tracking
        this.emit('progress', {
          id: this.generateUniqueId(),
          timestamp: new Date().toISOString(),
          operation: '📝 Saving Contact',
          details: `Saving ${leadInfo.name} from ${leadInfo.company} to database...`,
          status: 'processing',
          data: { 
            phase: 'tracking_contact',
            contactName: leadInfo.name,
            contactEmail: leadInfo.email,
            company: leadInfo.company
          }
        });
        
        const trackingResult = await this.awsManager.addContactedLead(this.userId, leadInfo);
        
        if (trackingResult.success) {
          
          // Emit SSE success for contact tracking
          this.emit('progress', {
            id: this.generateUniqueId(),
            timestamp: new Date().toISOString(),
            operation: '✅ Contact Saved',
            details: `${leadInfo.name} at ${leadInfo.company} saved successfully`,
            status: 'completed',
            data: { 
              phase: 'tracking_complete',
              contactId: trackingResult.contactId,
              contactName: leadInfo.name,
              company: leadInfo.company
            }
          });
        } else if (trackingResult.reason === 'already_contacted') {
          
          // Emit SSE warning for already contacted
          this.emit('progress', {
            id: this.generateUniqueId(),
            timestamp: new Date().toISOString(),
            operation: 'Contact Tracking',
            details: `⚠️ Contact already exists - ${leadInfo.name} was previously contacted`,
            status: 'warning',
            data: { 
              phase: 'already_contacted',
              contactName: leadInfo.name,
              company: leadInfo.company,
              reason: 'duplicate_contact'
            }
          });
        } else {
          console.error('❌ [CONTACT TRACKING] Failed to add to database:', trackingResult.error);
          
          // Emit SSE error for tracking failure
          this.emit('progress', {
            id: this.generateUniqueId(),
            timestamp: new Date().toISOString(),
            operation: 'Contact Tracking',
            details: `❌ Failed to save contact - ${trackingResult.error}`,
            status: 'error',
            data: { 
              phase: 'tracking_failed',
              error: trackingResult.error,
              contactName: leadInfo.name
            }
          });
        }
      } catch (trackingError) {
        console.error('❌ [CONTACT TRACKING] Error tracking contact:', trackingError.message);
        
        // Emit SSE error for tracking exception
        this.emit('progress', {
          id: this.generateUniqueId(),
          timestamp: new Date().toISOString(),
          operation: 'Contact Tracking',
          details: `❌ Contact tracking error - ${trackingError.message}`,
          status: 'error',
          data: { 
            phase: 'tracking_exception',
            error: trackingError.message
          }
        });
        // Don't fail the queue addition if tracking fails
      }

      let crmSyncSummary = {
        status: 'skipped',
        action: 'crm_skipped',
        message: 'CRM sync skipped',
        crmIntegration: null,
        crmContactId: leadData.crmId || null
      };

      // ==========================================
      // CRM SYNC - Automatically sync lead to CRM
      // ==========================================
      try {
        const user = await this.awsManager.getUserById(this.userId);
        
        if (user && user.crmConnected && user.crmAutoSync) {
          console.log(`[CRM SYNC] Starting sync for ${leadData.name || leadData.first_name} to ${user.crmIntegration || 'CRM'}`);
          
          // Log CRM sync start
          this.logOperation('🔗 CRM Sync', `Syncing ${leadData.name || leadData.first_name} to ${user.crmIntegration}...`, 'processing', { phase: 'crm_sync', contactName: leadData.name || leadData.first_name, crmIntegration: user.crmIntegration });
          
          // Prepare comprehensive lead data for CRM with full research and context
          const crmLeadData = {
            firstName: leadData.first_name || leadData.name?.split(' ')[0],
            lastName: leadData.last_name || leadData.name?.split(' ').slice(1).join(' '),
            email: leadData.email,
            phone: leadData.phone_number || null,
            companyName: leadData.company,
            title: leadData.title || null,
            linkedinUrl: leadData.linkedin_url || null,
            // CRM Mode: preserve the original contact ID so we update, not create
            crmId: leadData.crmId || null,
            // Timestamps
            queuedAt: queueData.timestamp || new Date().toISOString(),
            agentName: this.memory.personality?.name || 'Meridian Agent',
            // Full AI Report
            aiReport: queueData.aiReport || this.memory.currentQualification?.aiReport || null,
            // Research data
            researchSummary: queueData.researchData?.summary || null,
            specificInsights: queueData.researchData?.specificInsights || [],
            keyInsights: queueData.researchData?.keyInsights || [],
            companyDetails: queueData.researchData?.companyDetails || null,
            businessIntelligence: queueData.researchData?.businessIntelligence || null,
            // Confidence data
            confidenceLevel: queueData.confidenceLevel || leadData.confidenceLevel || null,
            confidenceReport: queueData.confidenceReport || leadData.confidenceReport || null,
            // Sales angle intelligence
            salesAngle: leadData.salesAngle || null
          };

          // Auditor Mode: contact already exists in CRM — add note to existing record, never create duplicate
          // Normal agent: contact is new (from Apollo) — create it
          const isAuditorContact = !!(leadData._fromCRM && leadData.crmId);
          const syncResult = isAuditorContact
            ? await this.mergeManager.addNoteToExistingCRMContact(this.userId, crmLeadData)
            : await this.mergeManager.syncLeadToCRMUnified(this.userId, crmLeadData);
          
          if (syncResult.success) {
            const action = isAuditorContact ? 'report added to' : 'synced to';
            crmSyncSummary = {
              status: 'success',
              action: isAuditorContact ? 'report_added' : 'contact_synced',
              message: `${leadData.name || leadData.first_name} ${action} ${syncResult.crmIntegration}`,
              crmIntegration: syncResult.crmIntegration || user.crmIntegration || null,
              crmContactId: syncResult.crmContactId || leadData.crmId || null
            };
            console.log(`[CRM SYNC] OK - ${leadData.name || leadData.first_name} ${action} ${syncResult.crmIntegration} (contactId: ${syncResult.crmContactId || 'n/a'})`);
            this.logOperation('🔗 CRM Sync', `${leadData.name || leadData.first_name} ${action} ${syncResult.crmIntegration} ✓`, 'completed', { phase: 'crm_sync_complete', crmContactId: syncResult.crmContactId, crmIntegration: syncResult.crmIntegration, contactName: leadData.name || leadData.first_name });
          } else {
            crmSyncSummary = {
              status: 'failed',
              action: 'crm_failed',
              message: syncResult.error || 'CRM sync failed',
              crmIntegration: syncResult.crmIntegration || user.crmIntegration || null,
              crmContactId: syncResult.crmContactId || leadData.crmId || null
            };
            console.warn(`[CRM SYNC] Failed to sync: ${syncResult.error}`);
            this.logOperation('🔗 CRM Sync', `CRM sync failed for ${leadData.name || leadData.first_name} - ${syncResult.error}`, 'failed', { phase: 'crm_sync_failed', error: syncResult.error, contactName: leadData.name || leadData.first_name });
          }
        } else {
          const skipReason = !user ? 'user not found' : 
                            !user.crmConnected ? 'CRM not connected' : 
                            !user.crmAutoSync ? 'auto-sync disabled' : 'unknown';
          crmSyncSummary = {
            status: 'skipped',
            action: 'crm_skipped',
            message: `CRM sync skipped: ${skipReason}`,
            crmIntegration: user?.crmIntegration || null,
            crmContactId: leadData.crmId || null
          };
          console.log(`[CRM SYNC] Skipped (${skipReason}) for ${leadData.name || leadData.first_name}`);
        }
      } catch (crmError) {
        crmSyncSummary = {
          status: 'failed',
          action: 'crm_failed',
          message: crmError.message || 'CRM sync error',
          crmIntegration: null,
          crmContactId: leadData.crmId || null
        };
        console.error('❌ [CRM SYNC] Error syncing to CRM:', crmError.message);
        // Don't fail the email queue if CRM sync fails
      }

      // Emit progress event for email queue update
      this.emit('progress', {
        type: 'email_queue',
        message: `Email queued for ${leadData.company}`,
        data: queueData
      });
      
      return {
        id: queueData.id,
        crmSync: crmSyncSummary
      };
    } catch (error) {
      console.error('❌ [EMAIL QUEUE] Error adding to queue:', error);
      console.error('❌ [EMAIL QUEUE FAILED] User:', this.userId, '| Agent:', this.agentId, '| Lead:', leadData.email, '| Error:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // CONCURRENT LEAD PROCESSING
  // Used when concurrencyLevel > 1 to drain the lead queue in parallel
  // ============================================================================

  /**
   * Run the complete research → unlock → email pipeline for a single lead.
   * Designed to be called concurrently — does not touch shared mutable state
   * except for thread-safe Set operations and the leadsProcessed counter.
   */
  async processLeadPipeline(lead) {
    const leadName    = lead.name || `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim();
    const companyName = lead.company || lead.organization?.name || 'Unknown';
    const isCRMLead = !!lead?._fromCRM;

    try {
      if (isCRMLead) {
        this._emitCRMEvent('crm_contact_scanning', {
          contactId: this._getCRMContactId(lead),
          contactName: this._getCRMContactName(lead),
          company: this._getCRMCompanyName(lead),
          email: lead.email || null
        });
        await this._markAuditorContactActive(lead);
      }

      // 1 ─ Research
      this.broadcastAgentActivity({
        agentId:   this.agentId,
        operation: '🔬 Researching',
        details:   `${leadName} at ${companyName}`,
        status:    'active',
        timestamp: new Date()
      }).catch(() => {});

      const research = await this.serperResearch({
        companyName: lead.organization?.name || lead.company,
        searchQuery: `${lead.organization?.name || lead.company} company business model products services`
      });

      if (!research?.success) {
        this.logOperation('⏭️ Research Failed', `Skipping ${leadName} — research returned no data`, 'warning');
        await this._markAuditorContactComplete(lead, {
          crmSync: { status: 'failed', action: 'research_failed', message: 'Research returned no usable data' }
        });
        return { success: false, leadName, company: companyName };
      }

      // 1.5 ─ Qualification / AI report
      const qualification = await this.qualifyLead({
        leadData: lead,
        researchData: research
      });

      if (!qualification?.success) {
        this.logOperation('⏭️ Qualification Failed', `Skipping ${leadName} — qualification returned no decision`, 'warning');
        await this._markAuditorContactComplete(lead, {
          crmSync: { status: 'failed', action: 'qualification_failed', message: 'Qualification returned no decision' }
        });
        return { success: false, leadName, company: companyName };
      }

      if (qualification.tier === 'REJECT' || qualification.qualified === false) {
        this.logOperation('⏭️ Lead Rejected', `Skipping ${leadName} at ${companyName} — qualification tier ${qualification.tier || 'REJECT'}`, 'info');
        await this._markAuditorContactComplete(lead, {
          crmSync: { status: 'skipped', action: 'qualification_rejected', message: `Lead did not meet qualification criteria (${qualification.tier || 'REJECT'})` }
        });
        return { success: false, leadName, company: companyName, rejected: true };
      }

      // 2 ─ Email unlock (skip if email already present)
      let emailAddress = lead.email || null;
      if (!emailAddress) {
        const emailUnlock = await this.unlockEmail({
          firstName:   lead.first_name,
          lastName:    lead.last_name,
          companyName: lead.organization?.name || lead.company,
          domain:      lead.organization?.primary_domain
        });

        if (!emailUnlock?.success) {
          this.logOperation(
            '❌ Email Unlock Failed',
            `Could not unlock email for ${leadName} at ${companyName}. Reason: ${emailUnlock?.error || 'No valid email found'}. Skipping.`,
            'warning'
          );
          try {
            await this.awsManager.addContactedLead(this.userId, {
              name:          leadName,
              email:         'email_unlock_failed',
              company:       companyName,
              status:        'email_unlock_failed',
              failureReason: emailUnlock?.error || 'No valid email found',
              contactedAt:   new Date().toISOString(),
              agentId:       this.agentId
            });
          } catch { /* non-fatal */ }
          await this._markAuditorContactComplete(lead, {
            crmSync: { status: 'failed', action: 'email_unlock_failed', message: emailUnlock?.error || 'No valid email found' }
          });
          return { success: false, leadName, company: companyName };
        }

        emailAddress = emailUnlock.email;
        lead = { ...lead, email: emailAddress, all_emails: emailUnlock.all_emails || [emailAddress] };
      }

      // 3 ─ Build personalized email
      if (!this.memory.emailSettings) {
        this.logOperation('⚠️ No Email Settings', `Email settings not loaded — skipping ${leadName}`, 'warning');
        await this._markAuditorContactComplete(lead, {
          crmSync: { status: 'failed', action: 'email_settings_missing', message: 'Email settings were not loaded' }
        });
        return { success: false, leadName, company: companyName };
      }

      const personalizedEmail = await this.buildPersonalizedEmail({
        leadData:      lead,
        researchData:  research,
        qualificationData: qualification,
        emailSettings: this.memory.emailSettings
      });

      if (!personalizedEmail?.success) {
        this.logOperation('⏭️ Email Build Failed', `Skipping ${leadName} — could not generate email`, 'warning');
        await this._markAuditorContactComplete(lead, {
          crmSync: { status: 'failed', action: 'email_build_failed', message: 'Could not generate a personalized email' }
        });
        return { success: false, leadName, company: companyName };
      }

      // 4 ─ Assemble + queue
      const completeLead = {
        ...lead,
        email:            emailAddress,
        research:         research.data,
        personalizedEmail: personalizedEmail.email,
        emailSubject:     personalizedEmail.subject,
        confidenceReport: personalizedEmail.confidenceReport,
        confidenceLevel:  personalizedEmail.confidenceLevel,
        salesAngle:       personalizedEmail.salesAngle || null,
        aiReport:         qualification.aiReport || null,
        emailUnlockStatus: 'success'
      };

      await this.addLeadToDatabase(completeLead);
      // Nullify shared qualification so addToEmailQueue doesn't pick up a stale value from another worker
      this.memory.currentQualification = null;
      const queueResult = await this.addToEmailQueue(completeLead);

      // Update duplicate tracking (safe in JS single-threaded event loop)
      const lcCompany = companyName.toLowerCase();
      const lcEmail   = emailAddress?.toLowerCase();
      if (lcCompany && this.memory.duplicateCheck?.emailedCompanies) this.memory.duplicateCheck.emailedCompanies.add(lcCompany);
      if (lcEmail   && this.memory.duplicateCheck?.processedEmails)  this.memory.duplicateCheck.processedEmails.add(lcEmail);

      this.memory.currentCycle.leadsProcessed++;

      this.logOperation(
        '✅ Lead Complete',
        `${leadName} at ${companyName} — email queued (${this.memory.currentCycle.leadsProcessed}/${this.memory.currentCycle.targetLeads})`,
        'success',
        {
          leadName, company: companyName, email: emailAddress,
          leadsProcessed: this.memory.currentCycle.leadsProcessed,
          targetLeads: this.memory.currentCycle.targetLeads,
        }
      );

      await this._markAuditorContactComplete(lead, {
        queueId: queueResult?.id || null,
        crmSync: queueResult?.crmSync || { status: 'success', action: 'queued', message: 'Email queued' }
      });

      return { success: true, leadName, company: companyName };
    } catch (err) {
      this.logOperation('❌ Pipeline Error', `${leadName}: ${err.message}`, 'error');
      await this._markAuditorContactComplete(lead, {
        crmSync: { status: 'failed', action: 'pipeline_error', message: err.message || 'Unexpected pipeline error' }
      });
      return { success: false, leadName, company: companyName, error: err.message };
    }
  }

  /**
  * Drain the current lead queue using `concurrencyLevel` parallel workers.
  * Pulls all leads (including `currentLead`) into a local array, then keeps
  * up to `f` leads in flight until the queue is exhausted.
   * @param {number} concurrencyLevel  1–10, clamped internally
   */
  async drainQueueConcurrently(concurrencyLevel) {
    const f = Math.min(Math.max(1, Math.floor(concurrencyLevel)), 10);

    // Collect everything: the lead already shifted to currentLead + the remainder
    const allLeads = [];
    if (this.memory.currentCycle.currentLead) {
      allLeads.push(this.memory.currentCycle.currentLead);
      this.memory.currentCycle.currentLead = null;
    }
    allLeads.push(...this.memory.currentCycle.leadQueue);
    this.memory.currentCycle.leadQueue = [];

    if (allLeads.length === 0) {
      this.memory.currentCycle.processingPhase = 'complete';
      this.memory.currentCycle.cycleComplete   = true;
      return;
    }

    this.logOperation(
      `⚡ Parallel Processing`,
      `Processing ${allLeads.length} lead${allLeads.length !== 1 ? 's' : ''} with ${f} concurrent worker${f !== 1 ? 's' : ''}`,
      'info'
    );

    const workerCount = Math.min(f, allLeads.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (this.isRunning && allLeads.length > 0) {
        const nextLead = allLeads.shift();
        if (!nextLead) break;
        await this.processLeadPipeline(nextLead);
      }
    });

    await Promise.allSettled(workers);

    // Check if we still need more leads to hit the target
    const processed = this.memory.currentCycle.leadsProcessed;
    const target = this.memory.currentCycle.targetLeads;
    if (this.isRunning && !this.isCrmMode && processed < target) {
      console.log(`⚡ [CONCURRENCY] ${processed}/${target} leads done — searching for ${target - processed} more`);
      this.memory.currentCycle.processingPhase = 'search';
      this.memory.currentCycle.cycleComplete   = false;
    } else {
      this.memory.currentCycle.processingPhase = 'complete';
      this.memory.currentCycle.cycleComplete   = true;
    }
  }

  // ============================================================================
  // UI INTEGRATION METHODS
  // Methods required by the frontend UI and API routes
  // ============================================================================

  /**
   * Start the lead agent with optional custom interval
   */
  async start(minutes = null, userId = null) {
    try {
      
      if (this.isRunning) {
        return {
          success: false,
          message: 'Agent is already running',
          isActive: this.isRunning
        };
      }

      // Set custom interval if provided
      if (minutes) {
        this.customInterval = minutes * 60 * 1000; // Convert to milliseconds
      }

      this.isRunning = true;
      this.startTime = new Date();
      
      
      // Initialize and load memory from Zilliz
      if (!this.memoryInitialized) {
        try {
          await this.leadMemory.initialize();
          const memoryData = await this.leadMemory.loadKeywordPerformance(this.userId);
          
          if (memoryData.success && memoryData.count > 0) {
            // Ensure industryExhaustion exists before restoring
            if (!this.memory.industryExhaustion) {
              this.memory.industryExhaustion = {};
            }
            
            // Restore memory into industryExhaustion tracker.
            //
            // Zilliz stores one row per search_combo (keyword + position). The
            // agent's industryExhaustion is keyed by keyword only — it rotates at
            // the keyword level, not per-position. So we must AGGREGATE all combos
            // that share the same keyword: sum their totalAttempts and totalDuplicates,
            // then recompute the rate. This gives the true per-keyword exhaustion
            // signal rather than one arbitrary combo's stats overwriting the others.
            const keywordAggMap = {};
            Object.values(memoryData.performanceMap).forEach(data => {
              const kw = data.keyword;
              if (!keywordAggMap[kw]) {
                keywordAggMap[kw] = {
                  totalAttempts: 0,
                  totalDuplicates: 0,
                  lastSearched: data.lastUpdated,
                  exhausted: false,
                  combos: [] // for logging
                };
              }
              keywordAggMap[kw].totalAttempts += data.totalAttempts;
              keywordAggMap[kw].totalDuplicates += data.totalDuplicates;
              if (data.isExhausted) keywordAggMap[kw].exhausted = true;
              // Keep the most recent lastSearched across all combos
              if (new Date(data.lastUpdated) > new Date(keywordAggMap[kw].lastSearched)) {
                keywordAggMap[kw].lastSearched = data.lastUpdated;
              }
              keywordAggMap[kw].combos.push(`${data.position} (${data.cumulativeDuplicateRate.toFixed(1)}%)`);
            });

            let preSkippedCount = 0;
            Object.keys(keywordAggMap).forEach(keyword => {
              const agg = keywordAggMap[keyword];
              agg.cumulativeDuplicateRate = agg.totalAttempts > 0
                ? (agg.totalDuplicates / agg.totalAttempts) * 100
                : 0;
              this.memory.industryExhaustion[keyword] = {
                leadsFound: 0,
                lastSearched: agg.lastSearched,
                exhausted: agg.exhausted,
                totalAttempts: agg.totalAttempts,
                totalDuplicates: agg.totalDuplicates,
                cumulativeDuplicateRate: agg.cumulativeDuplicateRate
              };
              const rate = agg.cumulativeDuplicateRate;
              const flag = agg.exhausted ? '🔴 EXHAUSTED' : rate > 40 ? '🟠 HIGH-DUP' : rate > 10 ? '🟡 WARNING' : '🟢 OK';
              console.log(`[MEMORY RESTORE] ${flag} "${keyword}": ${rate.toFixed(1)}% dup rate (${agg.totalAttempts} attempts across ${agg.combos.length} position(s): ${agg.combos.join(', ')})`);
              if (rate > 40 && agg.totalAttempts >= 5) preSkippedCount++;
            });

            const exhaustedCount = Object.values(keywordAggMap).filter(a => a.exhausted).length;
            const highDupCount = Object.values(keywordAggMap).filter(a => !a.exhausted && a.cumulativeDuplicateRate > 40).length;

            // Log to UI
            this.logOperation(
              '🧠 Memory Loaded',
              `Restored ${memoryData.count} combo records → ${Object.keys(keywordAggMap).length} keywords. ${exhaustedCount} exhausted (Zilliz), ${highDupCount} high-dup (>40%, will be pre-skipped this run).`,
              'success'
            );
          } else {
            this.logOperation('🧠 Memory Initialized', 'No previous memory found, starting fresh', 'info');
          }
          this.memoryInitialized = true;
        } catch (memError) {
          console.error('⚠️ [MEMORY] Failed to load memory, continuing without it:', memError.message);
          this.logOperation('⚠️ Memory Error', `Failed to load memory: ${memError.message}`, 'warning');
        }
      }

      /**
       * BANDIT STARTUP LOAD
       * -------------------
       * Load Thompson Sampling stats (α, β per keyword × source) from DynamoDB.
       * This gives the bandit its "memory" of which sources performed well for
       * which keywords, so it doesn't start blind on every agent restart.
       *
       * We also restore keywordSourceAssignments here — if a keyword was
       * already being searched by a specific source, we keep that assignment
       * rather than re-randomizing, so the bandit's learning is continuous.
       */
      if (!this.banditInitialized) {
        try {
          await this.bandit.loadFromDB();

          // Restore keyword → source assignments from the bandit stats we just loaded.
          // For every keyword that has at least one source with observations, pre-assign
          // the highest-estimated source so the agent doesn't re-pick randomly on restart.
          const availableSources = getAvailableSources();
          if (availableSources.length > 0) {
            const summary = this.bandit.getSummary();
            // Group by keyword → pick the source with the highest estimated rate
            const bestByKeyword = {};
            for (const entry of summary) {
              if (
                !bestByKeyword[entry.keyword] ||
                entry.estimatedRate > bestByKeyword[entry.keyword].estimatedRate
              ) {
                bestByKeyword[entry.keyword] = entry;
              }
            }
            for (const [keyword, best] of Object.entries(bestByKeyword)) {
              // Only restore if the source is still available in env
              if (availableSources.find(s => s.id === best.sourceId)) {
                this.memory.keywordSourceAssignments[keyword] = best.sourceId;
              }
            }
            const restored = Object.keys(bestByKeyword).length;
            if (restored > 0) {
              this.logOperation(
                '🎰 Bandit Loaded',
                `Restored source assignments for ${restored} keyword(s) from previous learning`,
                'success'
              );
            }
          }

          this.banditInitialized = true;
        } catch (banditErr) {
          console.warn('⚠️ [BANDIT] Failed to load from DB, starting with priors:', banditErr.message);
          this.banditInitialized = true; // Still mark initialized — priors are fine
        }
      }
      
      // Log the start operation
      this.logOperation('Agent Started', `Reasoning Lead Agent started with ${minutes ? minutes + ' minute' : 'default'} interval`, 'active', {
        customInterval: minutes,
        startTime: this.startTime.toISOString(),
        userId: this.userId
      });
      
      // Start the main reasoning loop
      this.runLoop();
      
      // Emit progress update
      this.emit('progress', {
        stage: 'startup',
        message: 'Reasoning Lead Agent started successfully',
        timestamp: new Date().toISOString(),
        isActive: true,
        level: 'success'
      });

      const result = {
        success: true,
        message: 'Reasoning Lead Agent started successfully',
        currentCycle: this.cycleCount,
        nextCycleIn: this.getNextCycleTime(),
        intervalMinutes: this.getIntervalMinutes(),
        customInterval: !!this.customInterval,
        testingMode: false,
        isActive: true
      };

      return result;
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error starting agent:', error);
      // Force stop on error
      this.isRunning = false;
      return {
        success: false,
        message: 'Failed to start agent: ' + error.message,
        isActive: false
      };
    }
  }

  /**
   * Start the agent in CRM mode — pre-loads contacts and skips Apollo search for this cycle.
   * @param {Array} crmContacts  Normalized contacts from readLeadsFromCRM: {email,firstName,lastName,title,company,phone,crmId,source}
   */
  async startFromCRM(crmContacts = [], minutes = null, userId = null) {
    if (!crmContacts || crmContacts.length === 0) {
      return { success: false, message: 'No contacts provided', isActive: false };
    }
    await this.awsManager.saveAuditorState(this.userId, {
      launched: true,
      agentId: this.agentId,
      totalQueued: crmContacts.length,
      completedCount: 0,
      pendingContacts: crmContacts,
      results: [],
      activeContactIds: []
    });
    this.crmContactList = crmContacts; // picked up by executeReasoningCycle
    this.isCrmMode = true;             // marks agent as reserved for auditor mode
    return await this.start(minutes, userId);
  }

  /**
   * Stop the lead agent
   */
  async stop() {
    try {
      
      // Force stop the agent
      this.isRunning = false;
      
      // Clear any running timers
      if (this.cycleTimer) {
        clearTimeout(this.cycleTimer);
        this.cycleTimer = null;
      }

      // Reset cycle counter and all state
      this.cycleCount = 0;
      this.startTime = null;
      this.nextRunTime = null;

      // COMPREHENSIVE CACHE CLEARING - Reset ALL memory and state
      
      if (this.memory) {
        // Clear current goal and cycle state
        this.memory.currentGoal = null;
        this.memory.currentCycle = {
          currentLead: null,
          leadsProcessed: 0,
          leadQueue: [],
          targetLeads: 0,
          processingPhase: 'search'
        };
        
        // Clear cached settings (will be reloaded on next start)
        this.memory.userSettings = null;
        this.memory.emailSettings = null;
        
        // Clear last research data
        this.memory.lastResearch = null;
        
        // Clear qualification cache
        this.memory.currentQualification = null;
        
        // Reset search adaptation counters
        this.memory.consecutiveDuplicateSearches = 0;
        this.memory.searchPageOffset = 0;
        
        // Reset search rotation tracking arrays
        this.memory.baseIndustryKeywords = [];
        this.memory.aiGeneratedKeywords = [];
        this.memory.aiGeneratedPositions = [];
        this.memory.currentIndustryIndex = 0;
        this.memory.currentKeywordIndex = 0;
        this.memory.cycleOffset = 0;
        this.memory.leadsFoundWithCurrentKeyword = 0;
        this.memory.lastKeywordUsed = null;
        this.memory.lastSearchKey = null;
        this.memory.campaignPriorityKeyword = null;
        this.memory.exhaustedCampaignKeywords = new Set();
        this.memory.originalTargetPositions = null;
        this.memory.totalLeadsFoundThisCycle = 0;
        this.memory.industryExhaustion = {};
        this.memory.searchHistoryDB = new Map();

        // Reset memory flag so Zilliz is re-queried on the next start().
        // If we don't do this, the exhaustion tracker starts empty on restart
        // but the memoryInitialized guard skips the Zilliz reload, so the
        // preemptive dup-rate check never has accurate data until the agent
        // re-accumulates 5+ attempts from scratch.
        this.memoryInitialized = false;
      }
      
      // Clear campaign plan (will be regenerated from instructions)
      this.campaignPlan = null;
      this.isCrmMode = false; // Release auditor-mode lock on stop


      // Emit progress update
      this.emit('progress', {
        stage: 'shutdown',
        message: 'Reasoning Lead Agent stopped by user',
        timestamp: new Date().toISOString(),
        isActive: false,
        level: 'info'
      });

      const result = {
        success: true,
        message: 'Reasoning Lead Agent stopped successfully',
        cyclesCompleted: 0,
        isActive: false
      };

      return result;
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error stopping agent:', error);
      // Force stop even on error
      this.isRunning = false;
      this.cycleCount = 0;
      this.startTime = null;
      this.nextRunTime = null;
      if (this.cycleTimer) {
        clearTimeout(this.cycleTimer);
        this.cycleTimer = null;
      }
      
      return {
        success: false,
        message: 'Failed to stop agent: ' + error.message,
        isActive: false // Force false even on error
      };
    }
  }

  /**
   * Get current agent status
   */
  async getStatus() {
    try {
      const emailQueue = this.emailQueue || new EmailQueue(this.userId, this.agentId);
      const queueStats = await emailQueue.getStats();
      
      return {
        isActive: this.isRunning,
        status: this.isRunning ? 'active' : 'stopped',
        name: 'Reasoning Lead Agent',
        lastRun: this.startTime ? this.startTime.toISOString() : null,
        currentInterval: this.getIntervalMinutes(),
        totalEmails: queueStats.total || 0,
        successRate: this.calculateSuccessRate(),
        cycleCount: this.cycleCount,
        nextCycleIn: this.isRunning ? this.getNextCycleTime() : null,
        currentProgress: this.getCurrentProgress(),
        emailStats: {
          pending: queueStats.pending || 0,
          approved: queueStats.approved || 0,
          rejected: queueStats.rejected || 0,
          total: queueStats.total || 0
        },
        memory: {
          searchHistory: this.memory.searchHistory.length,
          successfulStrategies: this.memory.successfulStrategies.length,
          failedStrategies: this.memory.failedStrategies.length
        }
      };
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error getting status:', error);
      return {
        isActive: false,
        status: 'error',
        name: 'Reasoning Lead Agent',
        error: error.message
      };
    }
  }

  /**
   * Set custom cycle interval
   */
  async setCycleInterval(minutes) {
    try {
      this.customInterval = minutes * 60 * 1000; // Convert to milliseconds
      
      // Save to DynamoDB - MERGE with existing settings to preserve configuration
      try {
        // Get existing lead agent settings first
        const existingSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId) || {};
        
        // Merge with new interval
        const updatedSettings = {
          ...existingSettings,
          customInterval: minutes,
          updatedAt: new Date().toISOString()
        };
        
        // Save merged settings to preserve all configuration
        await this.awsManager.saveLeadAgentSettings(this.userId, this.agentId, updatedSettings);
      } catch (dbError) {
        console.error('❌ [REASONING AGENT] Failed to save interval to DB:', dbError);
      }
      
      return {
        success: true,
        message: `Cycle interval set to ${minutes} minutes`,
        intervalMinutes: minutes,
        nextCycleIn: this.getNextCycleTime()
      };
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error setting interval:', error);
      return {
        success: false,
        message: 'Failed to set cycle interval: ' + error.message
      };
    }
  }

  /**
   * Reset to default cycle interval
   */
  async resetCycleInterval() {
    try {
      this.customInterval = null;
      const defaultMinutes = this.getIntervalMinutes();
      
      return {
        success: true,
        message: `Reset to default interval: ${defaultMinutes} minutes`,
        intervalMinutes: defaultMinutes,
        nextCycleIn: this.getNextCycleTime()
      };
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error resetting interval:', error);
      return {
        success: false,
        message: 'Failed to reset cycle interval: ' + error.message
      };
    }
  }

  /**
   * Load saved settings from DynamoDB
   */
  async loadSavedSettings() {
    try {
      // Load basic agent settings (interval, etc)
      const basicSettings = await this.awsManager.getAgentSettings(this.userId, this.agentId);
      if (basicSettings && basicSettings.customInterval) {
        this.customInterval = basicSettings.customInterval * 60 * 1000; // Convert to milliseconds
      }
      
      // Load lead agent settings (contains specialInstructions)
      const leadSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      if (leadSettings && leadSettings.specialInstructions) {
      } else {
      }
      
      // Store lead settings for campaign plan conversion (has specialInstructions field)
      this.settings = leadSettings;
      
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error loading saved settings:', error);
      // Continue with default settings if load fails
    }
  }


  /**
   * Reset the agent (clear state and memory)
   */
  async resetAgent() {
    try {
      
      // Stop if running
      if (this.isRunning) {
        await this.stop();
      }

      // Clear search history from AWS
      if (this.awsManager && this.userId) {
        await this.awsManager.deleteSearchHistory(this.userId, this.agentId);
      }

      // Reset memory and state
      this.memory = {
        searchHistory: [],
        successfulStrategies: [],
        failedStrategies: [],
        industryInsights: {},
        currentGoal: null,
        currentIndustryIndex: 0,
        consecutiveDuplicateSearches: 0,
        consecutiveDisqualifications: 0,
        searchPageOffset: 0,
        
        currentCycle: {
          leadsProcessed: 0,
          targetLeads: 0,
          currentLead: null,
          leadQueue: [],
          processingPhase: 'search'
        }
      };

      this.cycleCount = 0;
      this.customInterval = null;
      this.startTime = null;

      // Clear leads file
      try {
        await fs.writeFile(this.leadsFile, JSON.stringify([], null, 2));
      } catch (fileError) {
        console.warn('⚠️ [REASONING AGENT] Could not clear leads file:', fileError.message);
      }

      // Emit progress update
      this.emit('progress', {
        stage: 'reset',
        message: 'Agent reset completed',
        timestamp: new Date().toISOString(),
        isActive: false
      });

      return {
        success: true,
        message: 'Reasoning Lead Agent reset successfully'
      };
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error resetting agent:', error);
      return {
        success: false,
        message: 'Failed to reset agent: ' + error.message
      };
    }
  }

  /**
   * Run a single cycle (for testing/manual execution)
   */
  // Monitor credits during agent operation
  async checkCreditsStatus() {
    try {
      const user = await this.awsManager.getUserById(this.userId);
      if (!user) {
        return { canContinue: true, reason: 'user-lookup-failed' };
      }

      // Check if user has the new creditBalance system or legacy trial credits
      if (user.creditBalance !== undefined) {
        // New credit balance system (purchased credits)
        const remainingCredits = user.creditBalance || 0;
        
        if (remainingCredits <= 0) {
          this.isRunning = false;
          console.warn(`🚫 [CREDITS] Agent ${this.agentId} stopped — credit balance exhausted (balance: ${user.creditBalance})`);
          this.emit('progress', {
            stage: 'credit-limit-reached',
            message: 'Credit balance exhausted. Purchase more credits to continue.',
            timestamp: new Date().toISOString(),
            remainingCredits: 0
          });
          // Persist a notification so it appears in the user's notification panel
          this.logIssue('critical', 'Agent stopped — credits exhausted', {
            severity: 'critical',
            agentId: this.agentId,
            system: 'creditBalance',
            balance: user.creditBalance,
            message: 'Your agent has been stopped because your credit balance reached 0. Purchase more credits to resume.',
            timestamp: new Date().toISOString()
          }).catch(() => {});
          return { 
            canContinue: false, 
            reason: 'credits-exhausted',
            remainingCredits: 0,
            system: 'creditBalance'
          };
        }

        // Warn when getting low
        if (remainingCredits <= 100) {
          this.emit('progress', {
            stage: 'credit-warning',
            message: `Warning: Only ${remainingCredits.toFixed(2)} credits remaining`,
            timestamp: new Date().toISOString(),
            remainingCredits
          });
        }

        return { 
          canContinue: true, 
          reason: 'sufficient-credits',
          remainingCredits,
          system: 'creditBalance'
        };
      } else {
        // Legacy trial credits system
        const creditsUsed = user.trialCreditsUsed ?? 0;
        const creditsLimit = user.trialCreditsLimit ?? this.awsManager.plans[user.plan || 'free-trial'].initialCredits;
        const remainingCredits = creditsLimit - creditsUsed;

        // Check if exhausted
        if (remainingCredits <= 0) {
          this.isRunning = false;
          console.warn(`🚫 [CREDITS] Agent ${this.agentId} stopped — trial credits exhausted (used: ${creditsUsed}/${creditsLimit})`);
          this.emit('progress', {
            stage: 'credit-limit-reached',
            message: 'Trial credits exhausted. Please upgrade or purchase credits.',
            timestamp: new Date().toISOString(),
            creditsUsed,
            creditsLimit,
            remainingCredits: 0
          });
          // Persist a notification so it appears in the user's notification panel
          this.logIssue('critical', 'Agent stopped — trial credits exhausted', {
            severity: 'critical',
            agentId: this.agentId,
            system: 'trialCredits',
            creditsUsed,
            creditsLimit,
            message: `Your agent has been stopped because all ${creditsLimit} trial credits have been used. Upgrade your plan or purchase credits to continue.`,
            timestamp: new Date().toISOString()
          }).catch(() => {});
          return { 
            canContinue: false, 
            reason: 'credits-exhausted',
            creditsUsed,
            creditsLimit,
            remainingCredits: 0,
            system: 'trialCredits'
          };
        }

        // Warn when getting low
        if (remainingCredits <= 50) {
          this.emit('progress', {
            stage: 'credit-warning',
            message: `Warning: Only ${remainingCredits.toFixed(2)} trial credits remaining`,
            timestamp: new Date().toISOString(),
            creditsUsed,
            creditsLimit,
            remainingCredits
          });
        }

        return { 
          canContinue: true, 
          reason: 'sufficient-credits',
          creditsUsed,
          creditsLimit,
          remainingCredits,
          system: 'trialCredits'
        };
      }
    } catch (error) {
      console.error('⚠️ [CREDITS] Error checking credit status:', error);
      // Allow operation to continue on error to prevent blocking
      return { canContinue: true, reason: 'credit-check-error' };
    }
  }

  async runCycle() {
    try {
      
      // Check credits before running
      const creditCheck = await this.checkCreditsStatus();
      if (!creditCheck.canContinue) {
        return { 
          success: false, 
          error: 'Credits exhausted',
          ...creditCheck
        };
      }

      
      // Emit progress update
      this.emit('progress', {
        stage: 'manual-cycle',
        message: 'Starting manual cycle',
        timestamp: new Date().toISOString(),
        isActive: this.isRunning
      });

      const result = await this.executeReasoningCycle();
      
      // Emit completion
      this.emit('progress', {
        stage: 'manual-cycle-complete',
        message: `Manual cycle completed: ${result.success ? 'Success' : 'Failed'}`,
        timestamp: new Date().toISOString(),
        data: result
      });

      return result;
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error running manual cycle:', error);
      
      // Log cycle error as issue
      this.logIssue('error', `Agent cycle failed unexpectedly: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      this.emit('progress', {
        stage: 'error',
        message: 'Manual cycle failed: ' + error.message,
        timestamp: new Date().toISOString(),
        level: 'error'
      });

      return {
        success: false,
        message: 'Manual cycle failed: ' + error.message,
        error: error.message
      };
    }
  }

  // Execute function by name with parameters
  async executeFunction(functionName, parameters = {}) {
    
    try {
      let result;
      
      switch (functionName) {
        case 'get_user_settings':
          result = await this.getUserSettings();
          this.memory.userSettings = result;
          
          // Check if settings have an error
          if (result?.error) {
            this.logOperation('⚙️ Settings Required', 'Please configure your lead agent settings in the dashboard', 'warning', {
              error: result.error,
              action: 'Configure settings to start finding leads'
            });
            
            // Return a shouldStop so the cycle pauses until settings are configured
            return {
              success: false,
              message: 'Agent settings not configured yet. Please set up your targeting criteria.',
              shouldStop: true,
              requiresConfiguration: true
            };
          }
          break;
          
        case 'get_email_settings':
          result = await this.getEmailSettings();
          this.memory.emailSettings = result;
          
          // Check if email settings have an error
          if (result?.error) {
            this.logOperation('📧 Email Settings Required', 'Please configure your email builder settings in the dashboard', 'warning', {
              error: result.error,
              action: 'Configure email settings to start sending emails'
            });
            
            // Return a shouldStop so the cycle pauses until settings are configured
            return {
              success: false,
              message: 'Email settings not configured yet. Please set up your email templates.',
              shouldStop: true,
              requiresConfiguration: true
            };
          }
          break;
          
        case 'lead_search':
          result = await this.leadSearch(parameters);
          break;
          
        case 'serper_research':
          result = await this.serperResearch(parameters);
          break;
          
        case 'unlock_email':
          result = await this.unlockEmail(parameters);
          break;
          
        case 'build_personalized_email':
          result = await this.buildPersonalizedEmail(parameters);
          break;
          
        case 'pre_qualify_lead':
          result = await this.preQualifyLead(parameters);
          break;
          
        case 'qualify_lead':
          result = await this.qualifyLead(parameters);
          break;
          
        case 'pause':
          result = {
            success: true,
            message: 'Agent paused due to error',
            error: parameters.error,
            shouldStop: true
          };
          break;
          
        case 'complete':
          result = {
            success: true,
            message: 'Cycle completed',
            cycleComplete: true
          };
          break;
          
        default:
          result = {
            success: false,
            message: `Unknown function: ${functionName}`
          };
      }
      
      return result;
      
    } catch (error) {
      console.error(`[ERR] Function ${functionName} failed:`, error);
      return {
        success: false,
        message: `Function ${functionName} failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  getIntervalMinutes() {
    if (this.customInterval) {
      return this.customInterval / (60 * 1000);
    }
    return 30; // Default 30 minutes
  }

  getNextCycleTime() {
    if (!this.isRunning || !this.nextRunTime) return null;
    // Return timestamp of next run
    return this.nextRunTime.toISOString();
  }

  getCurrentProgress() {
    if (!this.isRunning) {
      return null;
    }
    
    return {
      stage: this.memory.currentGoal || 'waiting',
      progress: Math.min((this.cycleCount * 10) % 100, 95),
      message: `Cycle ${this.cycleCount} - ${this.memory.currentGoal || 'Reasoning about leads'}`
    };
  }

  calculateSuccessRate() {
    if (this.memory.searchHistory.length === 0) return 0;
    
    const successful = this.memory.successfulStrategies.length;
    const total = this.memory.searchHistory.length;
    return Math.round((successful / total) * 100);
  }

  // Main reasoning loop
  async runLoop() {
    if (!this.isRunning) return;

    let cycleResult;
    try {
      cycleResult = await this.executeReasoningCycle();
    } catch (error) {
      console.error('❌ [REASONING AGENT] Cycle error:', error);
      this.emit('progress', {
        stage: 'error',
        message: 'Cycle failed: ' + error.message,
        timestamp: new Date().toISOString(),
        level: 'error'
      });
    }

    // Schedule next cycle AFTER current cycle completes (so countdown shows immediately)
    if (cycleResult?.reason === 'credits-exhausted-mid-cycle' || cycleResult?.reason === 'credits-exhausted') {
      this.isRunning = false;
    }
    if (this.isRunning) {
      const interval = this.customInterval || (30 * 60 * 1000); // Default 30 minutes
      this.nextRunTime = new Date(Date.now() + interval);
      
      // Emit progress so frontend updates immediately with countdown
      this.emit('progress', {
        stage: 'cycle-complete',
        message: `Cycle completed. Next cycle in ${Math.round(interval / 60000)} minutes`,
        timestamp: new Date().toISOString(),
        nextRunTime: this.nextRunTime.toISOString(),
        level: 'success'
      });
      
      this.cycleTimer = setTimeout(() => this.runLoop(), interval);
    }
  }

  // Execute one reasoning cycle
  async executeReasoningCycle() {
    this.cycleCount++;
    let crmContactsLoadedThisCycle = false;

    // Refresh settings every cycle so changes (e.g. concurrencyLevel) take effect without restart
    try {
      const freshSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      if (freshSettings) {
        this.settings = freshSettings;
        console.log(`🔄 [CYCLE SETTINGS] Agent ${this.agentId}: concurrencyLevel=${freshSettings.concurrencyLevel ?? 1}`);
      }
    } catch (err) {
      console.warn(`⚠️ [CYCLE SETTINGS] Failed to refresh settings for agent ${this.agentId}:`, err.message);
    }
    
    // Broadcast cycle start event
    try {
      const { broadcastActivity } = await import('../routes/monitoring.js');
      broadcastActivity({
        type: 'cycle_start',
        userId: this.userId,
        agentId: this.agentId,
        cycleNumber: this.cycleCount,
        targeting: this.settings?.companyCriteria?.companyIndustries?.[0] || 'Mixed',
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to broadcast cycle start:', err);
    }
    
    // CACHE CLEARING: Reset cycle tracking for new cycle (ensures fresh state)
    this.memory.currentCycle = {
      leadsProcessed: 0,
      targetLeads: 0,
      currentLead: null,
      leadQueue: [],
      processingPhase: 'search'
    };
    // Cost tracking for refunds
    this.memory.cycleCosts = { apollo: 0, leadsFound: 0 };
    this.memory.currentLeadCost = 0;

    // CRM MODE: If contacts were pre-loaded from a CRM, inject them now and skip Apollo search
    if (this.crmContactList && this.crmContactList.length > 0) {
      const crmLeads = this.crmContactList.map(c => ({
        first_name: c.firstName || '',
        last_name:  c.lastName  || '',
        name:       [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown',
        email:      c.email || '',
        title:      c.title   || '',
        organization: { name: c.company || '', primary_domain: '' },
        company:    c.company || '',
        phone_numbers: c.phone ? [{ sanitized_number: c.phone }] : [],
        _fromCRM:   true,
        crmId:      c.crmId,
        crmSource:  c.source
      }));
      this.memory.currentCycle.currentLead   = crmLeads[0];           // Prime the first lead NOW
      this.memory.currentCycle.leadQueue     = crmLeads.slice(1);     // Rest wait in queue
      this.memory.currentCycle.targetLeads   = crmLeads.length;
      this.memory.currentCycle.processingPhase = 'research'; // Skip lead_search
      this.crmContactList = null; // Consumed — clear so next cycle uses Apollo normally
      crmContactsLoadedThisCycle = true;
      console.log(`[CRM MODE] Pre-loaded ${crmLeads.length} contacts from CRM, skipping Apollo search — starting with ${crmLeads[0]?.name}`);
      this.logOperation('📋 CRM Mode', `Processing ${crmLeads.length} contacts imported from CRM`, 'running');
      // Broadcast CRM session start so the frontend knows the full contact list
      this._emitCRMEvent('crm_session_start', {
        contacts: crmLeads.map(l => ({ id: l.crmId || l.email, name: l.name, company: l.company }))
      });
    }

    // Clear last cycle's data
    this.memory.lastResearch = null;
    this.memory.currentQualification = null;
    
    
    // Load campaign plan from special instructions
    if (this.settings?.specialInstructions && !this.campaignPlan) {
      console.log('🎯 [CAMPAIGN PLAN] Special instructions detected, converting to plan...');
      
      // We'll get userSettings in the cycle, but we can try to load them now for the plan
      const tempSettings = await this.getUserSettings();
      if (!tempSettings.error) {
        console.log('📋 [CAMPAIGN PLAN] Converting with baseline settings:', {
          industries: tempSettings.companyIndustries,
          positions: tempSettings.targetPositions,
          companySize: `${tempSettings.companySizeMin}-${tempSettings.companySizeMax}`,
          yourCompany: tempSettings.companyName
        });
        
        this.campaignPlan = await this.convertInstructionsToPlan(
          this.settings.specialInstructions,
          tempSettings
        );
        
        console.log(`[CAMPAIGN PLAN] convertInstructionsToPlan result: ${this.campaignPlan ? 'OK' : 'NULL/UNDEFINED'} | hasQualificationCriteria: ${!!this.campaignPlan?.qualificationCriteria} | mustHave items: ${this.campaignPlan?.qualificationCriteria?.mustHave?.length ?? 'n/a'}`);

        // If user has manually saved qualification criteria in settings, override the auto-generated ones
        const userCriteria = tempSettings.qualificationCriteria;
        if (this.campaignPlan && userCriteria && (userCriteria.mustHave?.length > 0 || userCriteria.disqualifiers?.length > 0)) {
          this.campaignPlan.qualificationCriteria = {
            mustHave: userCriteria.mustHave || [],
            niceToHave: userCriteria.niceToHave || [],
            disqualifiers: userCriteria.disqualifiers || [],
          };
          console.log(`[CAMPAIGN PLAN] User criteria override applied — mustHave: ${userCriteria.mustHave?.length}, disqualifiers: ${userCriteria.disqualifiers?.length}`);
        }
        
        if (this.campaignPlan) {
          this.emit('progress', {
            stage: 'campaign-plan',
            message: `🎯 Campaign Strategy: ${this.campaignPlan.emailMessaging?.primaryValue || 'Custom targeting'}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            data: {
              hasSearchStrategy: !!this.campaignPlan.searchStrategy,
              hasCriteria: !!this.campaignPlan.qualificationCriteria,
              searchKeywords: this.campaignPlan.searchStrategy?.additionalKeywords,
              instructions: this.settings.specialInstructions
            }
          });
        }
      }
    }
    
    // Log cycle start
    this.logOperation('🔄 Starting Search', `Looking for new leads to contact`, 'running', {
      cycleNumber: this.cycleCount,
      timestamp: new Date().toISOString()
    });
    
    this.emit('progress', {
      stage: 'reasoning',
      message: `Starting reasoning cycle #${this.cycleCount}`,
      timestamp: new Date().toISOString(),
      level: 'info'
    });

    let stepCount = 0;
    let consecutiveEmptySearches = 0;
    const MAX_EMPTY_SEARCHES = 2; // bail out after 2 consecutive real-API searches returning 0 leads
    const cycleStartTime = Date.now(); // Hoisted so catch block can reference it
    try {
      const maxSteps = 5000; // Safety limit - increased for high-volume lead processing
      
      while (stepCount < maxSteps && this.isRunning) {
        stepCount++;
        
        // Check credits every 5 steps to prevent expensive operations with insufficient credits
        if (stepCount % 5 === 0) {
          const creditCheck = await this.checkCreditsStatus();
          if (!creditCheck.canContinue) {
            this.logOperation('🚫 Agent Stopped', 'Credits exhausted during operation', 'error', creditCheck);
            return { 
              success: false, 
              reason: 'credits-exhausted-mid-cycle',
              stepsCompleted: stepCount,
              ...creditCheck
            };
          }
        }
        
        // Check if agent was stopped
        if (!this.isRunning) {
          break;
        }
        
        // Initialize cycle tracking if needed
        if (!this.memory.currentCycle.targetLeads && this.memory.userSettings?.leadLimit) {
          this.memory.currentCycle.targetLeads = this.memory.userSettings.leadLimit;
          this.memory.currentCycle.leadsProcessed = 0;
          this.memory.currentCycle.leadQueue = [];
          this.memory.currentCycle.processingPhase = 'search';
        }

        // Execute the full reasoning workflow
        const context = {
          hasUserSettings: !!this.memory.userSettings && !this.memory.userSettings.error,
          hasEmailSettings: !!this.memory.emailSettings && !this.memory.emailSettings.error,
          memory: this.memory,
          
          // Sequential processing context
          leadsProcessed: this.memory.currentCycle.leadsProcessed,
          targetLeads: this.memory.currentCycle.targetLeads,
          currentLead: this.memory.currentCycle.currentLead,
          leadQueue: this.memory.currentCycle.leadQueue,
          processingPhase: this.memory.currentCycle.processingPhase,
          cycleComplete: this.memory.currentCycle.targetLeads > 0
            && this.memory.currentCycle.leadsProcessed >= this.memory.currentCycle.targetLeads
        };

        // Check if settings have errors and need to be fetched
        if (!context.hasUserSettings && this.memory.userSettings?.error) {
          this.logOperation('⚙️ Configuring Agent', 'Loading your agent settings...', 'in-progress');
        }
        if (!context.hasEmailSettings && this.memory.emailSettings?.error) {
          this.logOperation('📧 Email Setup', 'Loading your email preferences...', 'in-progress');
        }

        if (
          crmContactsLoadedThisCycle &&
          (this.settings?.concurrencyLevel || 1) > 1 &&
          this.memory.currentCycle.processingPhase === 'research' &&
          (this.memory.currentCycle.currentLead || this.memory.currentCycle.leadQueue.length > 0) &&
          this.memory.currentCycle.leadsProcessed === 0 &&
          !this.memory.lastResearch &&
          !this.memory.currentQualification
        ) {
          if (!context.hasUserSettings) {
            const freshUserSettings = await this.getUserSettings();
            if (freshUserSettings && !freshUserSettings.error) {
              this.memory.userSettings = freshUserSettings;
            }
          }

          if (!context.hasEmailSettings) {
            const freshEmailSettings = await this.getEmailSettings();
            if (freshEmailSettings && !freshEmailSettings.error) {
              this.memory.emailSettings = freshEmailSettings;
            }
          }

          if (this.memory.emailSettings && !this.memory.emailSettings.error) {
            const concurrencyLevel = this.settings?.concurrencyLevel || 1;
            console.log(`⚡ [CRM CONCURRENCY] Agent ${this.agentId}: draining CRM contacts with concurrencyLevel=${concurrencyLevel}`);
            await this.drainQueueConcurrently(concurrencyLevel);
            continue;
          }
        }

        // Check if agent was stopped before making next decision
        if (!this.isRunning) {
          break;
        }

        // Get reasoning decision from OpenAI
        const reasoningResult = await this.reason(context);
        
        // Log what the agent is thinking in user-friendly terms
        if (reasoningResult.reasoning) {
          const friendlyThinking = this.translateThinkingToFriendly(reasoningResult.action, context);
          this.logOperation('💭 Agent Activity', friendlyThinking, 'info', {
            action: reasoningResult.action,
            step: stepCount
          });
        }
        
        if (!reasoningResult.action || reasoningResult.action === 'think' || reasoningResult.action === 'complete') {
          this.logOperation('✅ Process Complete', `Successfully completed lead outreach`, 'completed', {
            cycleNumber: this.cycleCount,
            stepsExecuted: stepCount,
            completedAt: new Date().toISOString()
          });
          break;
        }
        
        const actionResult = await this.executeFunction(reasoningResult.action, reasoningResult.parameters);
        
        // Check if agent was stopped during action execution
        if (!this.isRunning) {
          break;
        }
        
        // Check if action requested to stop the cycle (e.g., due to errors)
        if (actionResult?.shouldStop) {
          this.logOperation('Cycle Stopped', `Cycle #${this.cycleCount} stopped due to action result: ${actionResult.message}`, 'paused', {
            cycleNumber: this.cycleCount,
            stepNumber: stepCount,
            reason: actionResult.message,
            error: actionResult.error
          });
          break;
        }
        
        // Update cycle state based on action results
        await this.updateCycleState(reasoningResult.action, actionResult);

        // ── Consecutive empty search guard ─────────────────────────────────
        // If lead_search keeps returning 0 leads, the agent has nowhere to go.
        // Break the cycle rather than burning credits in an infinite loop.
        // Pre-skipped searches (intentional keyword rotation) do NOT count — only
        // searches that actually ran against the API and returned nothing.
        if (reasoningResult.action === 'lead_search') {
          if (!actionResult?.leads?.length && !actionResult?.skipped) {
            consecutiveEmptySearches++;
            const targetMet = this.memory.currentCycle.targetLeads > 0
              && this.memory.currentCycle.leadsProcessed >= this.memory.currentCycle.targetLeads;
            const hardLimit = consecutiveEmptySearches >= 8;
            if (targetMet || hardLimit) {
              this.logOperation('⚠️ Search Exhausted', `No new leads found after ${consecutiveEmptySearches} consecutive searches — ending cycle`, 'warning', {
                cycleNumber: this.cycleCount,
                stepNumber: stepCount,
                consecutiveEmptySearches,
                targetMet,
                hardLimit
              });
              break;
            }
          } else {
            consecutiveEmptySearches = 0; // reset on any success
          }
        }

        // ── Concurrent lead processing ─────────────────────────────────────
        // After Apollo fills the queue, if concurrencyLevel > 1, drain all
        // leads in parallel instead of one-by-one through the LLM loop.
        if (
          reasoningResult.action === 'lead_search' &&
          actionResult?.leads?.length > 0
        ) {
          const concurrencyLevel = this.settings?.concurrencyLevel || 1;
          console.log(`⚡ [CONCURRENCY] Agent ${this.agentId}: using concurrencyLevel=${concurrencyLevel} (raw setting: ${this.settings?.concurrencyLevel})`);
          if (concurrencyLevel > 1) {
            console.log(`⚡ [CONCURRENCY] Draining ${actionResult?.leads?.length ?? 0} leads with ${concurrencyLevel} parallel workers`);
            await this.drainQueueConcurrently(concurrencyLevel);
            // drainQueueConcurrently sets phase='search' if more leads are needed,
            // or phase='complete'/cycleComplete=true if target is reached — let the
            // while loop continue and it will either search again or exit naturally.
          } else {
            console.log(`⚡ [CONCURRENCY] Sequential mode (concurrencyLevel=1) — processing leads one by one`);
          }
        }
        // ──────────────────────────────────────────────────────────────────
        
        this.emit('progress', {
          stage: 'action',
          message: `Step ${stepCount}: Executed ${reasoningResult.action}`,
          timestamp: new Date().toISOString(),
          level: 'success'
        });
      }

      // Log successful cycle completion to DynamoDB
      const cycleEndTime = Date.now();
      const cycleDuration = Math.floor((cycleEndTime - cycleStartTime) / 1000); // Duration in seconds
      
      await this.logCycleCompletion({
        success: true,
        stepsExecuted: stepCount,
        leadsProcessed: this.memory.currentCycle?.leadsProcessed || 0,
        targetLeads: this.memory.currentCycle?.targetLeads || 0,
        duration: cycleDuration, // Add duration in seconds
        startedAt: new Date(cycleStartTime).toISOString(),
        completedAt: new Date(cycleEndTime).toISOString()
      });

      // Broadcast cycle completion to SSE clients for real-time updates
      try {
        const { broadcastActivity } = await import('../routes/monitoring.js');
        broadcastActivity({
          type: 'info',
          category: 'cycle',
          userId: this.userId,
          title: `Cycle ${this.cycleCount} - ${this.agentId}`,
          message: `Agent ${this.agentId} completed cycle #${this.cycleCount}: ${this.memory.currentCycle?.leadsProcessed || 0} leads processed`,
          timestamp: new Date().toISOString(),
          metadata: {
            agentId: this.agentId,
            cycleNumber: this.cycleCount,
            duration: cycleDuration,
            leadsProcessed: this.memory.currentCycle?.leadsProcessed || 0
          }
        });
      } catch (sseError) {
        console.error('❌ [REASONING AGENT] Failed to broadcast cycle completion:', sseError);
      }

      return {
        success: true,
        message: `Reasoning cycle #${this.cycleCount} completed with ${stepCount} steps`,
        cycleNumber: this.cycleCount,
        stepsExecuted: stepCount
      };

    } catch (error) {
      console.error('❌ [REASONING AGENT] Cycle error:', error);
      
      // Log failed cycle to DynamoDB
      const cycleEndTime = Date.now();
      const cycleDuration = Math.floor((cycleEndTime - cycleStartTime) / 1000); // Duration in seconds
      
      await this.logCycleCompletion({
        success: false,
        error: error.message,
        stepsExecuted: stepCount || 0,
        leadsProcessed: this.memory.currentCycle?.leadsProcessed || 0,
        duration: cycleDuration,
        startedAt: new Date(cycleStartTime).toISOString(),
        completedAt: new Date(cycleEndTime).toISOString()
      });
      
      this.logOperation('Cycle Failed', `Reasoning cycle #${this.cycleCount} encountered an error: ${error.message}`, 'error', {
        cycleNumber: this.cycleCount,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      this.emit('progress', {
        stage: 'error',
        message: `Cycle #${this.cycleCount} failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        level: 'error'
      });
      
      return {
        success: false,
        message: `Cycle #${this.cycleCount} failed: ${error.message}`,
        cycleNumber: this.cycleCount,
        error: error.message
      };
    }
  }
}

// ============================================================================
// USER AGENT MANAGEMENT
// Store user-specific agent instances
// ============================================================================

const userAgents = new Map();

/**
 * Get or create an agent-specific reasoning agent instance
 */
export function getUserAgent(userId, agentId = 'reasoning-lead-agent') {
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Create unique key for user+agent combination
  const agentKey = `${userId}_${agentId}`;

  if (!userAgents.has(agentKey)) {
    const agent = new ReasoningLeadAgent(userId, agentId);
    
    // Set up listener to broadcast email_queued events through monitoring stream
    agent.on('email_queued', async (eventData) => {
      try {
        const { broadcastActivity } = await import('../routes/monitoring.js');
        broadcastActivity({
          type: 'email_queued',
          userId: userId,
          ...eventData
        });
      } catch (error) {
        console.error('⚠️ [AGENT MANAGER] Failed to broadcast email_queued event:', error);
      }
    });
    
    userAgents.set(agentKey, agent);
  }

  return userAgents.get(agentKey);
}

/**
 * Remove a user's agent instance (cleanup)
 */
export function removeUserAgent(userId, agentId = 'reasoning-lead-agent') {
  const agentKey = `${userId}_${agentId}`;
  if (userAgents.has(agentKey)) {
    const agent = userAgents.get(agentKey);
    agent.stop(); // Stop the agent before removing
    userAgents.delete(agentKey);
  }
}

/**
 * Get all active agent IDs for a user (for future multi-agent support)
 */
export function getUserActiveAgents(userId) {
  const agents = [];
  // Check for all agent instances for this user (userId_*)
  for (const [agentKey, agent] of userAgents.entries()) {
    if (agentKey.startsWith(`${userId}_`)) {
      agents.push({
        agentId: agent.agentId,
        isRunning: agent.isRunning,
        userId: userId
      });
    }
  }
  return agents;
}

/**
 * Returns true if any agent instance for this user is currently in an active cycle.
 */
export function isAnyCycleRunning(userId) {
  for (const [key, agent] of userAgents.entries()) {
    if (key.startsWith(`${userId}_`) && agent.isRunning) return true;
  }
  return false;
}

/**
 * Returns true if the specific agent for this user is currently in an active cycle.
 */
export function isAgentCycleRunning(userId, agentId) {
  const agent = userAgents.get(`${userId}_${agentId}`);
  return agent?.isRunning ?? false;
}

/**
 * Get all active agents across all users (for system-wide polling)
 */
export function getAllActiveAgents() {
  const allAgents = [];
  for (const [agentKey, agent] of userAgents.entries()) {
    // Extract userId from the agentKey (format: userId_agentId)
    const userId = agentKey.split('_')[0];
    allAgents.push({
      agentId: agent.agentId,
      isRunning: agent.isRunning,
      userId: userId,
      agentKey: agentKey
    });
  }
  return allAgents;
}

export { ReasoningLeadAgent };
