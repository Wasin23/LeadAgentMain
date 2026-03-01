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
import { EventEmitter } from 'events';
import { getUserSettings } from '../lib/userManager.js';
import AWSManager from '../utils/awsManager.js';
import { EmailQueue } from '../lib/emailQueue.js';
import { internetSearch } from '../tools/internetSearch.js';
import { companyIntelligence } from '../tools/companyIntelligence.js';
import { deepResearch } from '../tools/deepResearch.js';
import { ZillizLeadMemory } from '../utils/zillizLeadMemory.js';
import { industryFacts, ZillizIndustryFacts } from '../utils/zillizIndustryFacts.js';
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
      searchPageOffset: 0, // Increase page numbers when exhausting early pages
      industryExhaustion: {}, // Track leads found per industry: { "Hotels & Resorts": { leadsFound: 45, lastSearched: timestamp }, ... }
      totalLeadsFoundThisCycle: 0,
      aiGeneratedKeywords: [], // AI-generated related industry keywords
      aiGeneratedPositions: [], // AI-generated positions paired with keywords
      aiKeywordCycleCount: 0, // Track how many AI keywords used (reset after 5)
      baseIndustryKeywords: [], // Flattened list of all keywords from user's industries
      campaignPriorityKeyword: null, // Campaign-specified industry to search first
      leadsFoundWithCurrentKeyword: 0, // Track leads found with current keyword (rotate every 20)
      lastKeywordUsed: null, // Track the last keyword used to detect changes
      originalTargetPositions: null, // Store the original positions from instructions/settings
      cycleOffset: 0, // Offset for position pairing - increases each full cycle for variety
      searchHistoryDB: new Map(), // Cache of searched industry+position combos from DB
      lastSearchKey: null, // Track last search combo to detect changes for SSE updates
      
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
        name: 'apollo_search',
        description: 'Search for leads using Apollo API. You must intelligently determine what to search for based on: 1) User\'s configured target positions, industries, company size, and locations (baseline criteria), 2) Special instructions/campaign plan (what specific prospects to find). IMPORTANT: You can INTELLIGENTLY SELECT which configured industry best fits the campaign goal - if "Hotels & Resorts" aligns with "independent hospitality", use it. If campaign requires a different configured industry, select the most relevant one. NEVER use industries not in user settings. Always validate industry choice matches campaign intent.',
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
            firstName: { type: 'string', description: 'Lead first name' },
            lastName: { type: 'string', description: 'Lead last name' },
            companyName: { type: 'string', description: 'Lead company name' },
            domain: { type: 'string', description: 'Company domain (e.g., example.com) - CRITICAL for accurate matching when company name is generic' }
          }
        }
      },
      {
        name: 'build_personalized_email',
        description: 'Create personalized email using research data and email builder settings',
        parameters: {
          type: 'object',
          properties: {
            leadData: { type: 'object', description: 'Lead information from Apollo' },
            researchData: { type: 'object', description: 'Company research from Serper' },
            emailSettings: { type: 'object', description: 'Email builder settings from AWS DynamoDB' }
          }
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
        description: 'Detailed qualification after research. Scores lead against campaign criteria and decides if they should receive email.',
        parameters: {
          type: 'object',
          properties: {
            leadData: { type: 'object', description: 'Lead information from Apollo' },
            researchData: { type: 'object', description: 'Company research from Serper' }
          }
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
        model: 'gpt-4o',
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
            model: 'gpt-4o',
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
      'Lead Qualification',
      '💭 Agent Activity',
      '✅ Process Complete'
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
      'apollo_search': `Searching for ${context.targetLeads || 'new'} qualified leads in your target industries`,
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

  // Core reasoning function - the agent's "brain"
  // 🎯 OPTIMIZED: Trimmed prompt for 61% cost savings (700 → 150 tokens)
  async reason(context) {
    // Build lead info string with domain when available
    let leadInfo = 'none';
    if (context.currentLead) {
      const domain = context.currentLead.organization?.primary_domain || context.currentLead.domain;
      leadInfo = domain 
        ? `${context.currentLead.name} (${context.currentLead.company}, domain: ${domain})`
        : `${context.currentLead.name} (${context.currentLead.company})`;
    }
    
    const prompt = `Lead agent cycle decision:

STATUS:
Settings: ${context.hasUserSettings ? '✓' : '✗'} | Email templates: ${context.hasEmailSettings ? '✓' : '✗'}
Progress: ${context.leadsProcessed}/${context.targetLeads} | Phase: ${context.processingPhase}
Lead: ${leadInfo}
Complete: ${context.cycleComplete}

Call the appropriate function to continue the workflow.`;

    try {
      const functionCall = this.determineFunctionCall(context);
      
      // Single OpenAI call with reasoning and function calling
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ 
          role: 'user', 
          content: prompt + '\n\nYou MUST call a function. Briefly explain your reasoning, then immediately call the appropriate function to execute the action.'
        }],
        functions: this.tools,
        function_call: functionCall,
        temperature: 0.7
      });
      
      // Log OpenAI API usage
      if (response.usage) {
        // Check rate limit before logging (for tracking purposes)
        const rateCheck = await this.awsManager.checkApiRateLimit(
          this.userId, 
          'openai', 
          response.usage.total_tokens
        ).catch(err => {
          console.error('⚠️ Rate limit check failed, allowing request:', err);
          return { allowed: true };
        });

        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'chat_completion',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            rateLimitStatus: rateCheck.allowed ? 'within_limits' : 'exceeded'
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));

        // Warn if approaching or exceeding limits
        if (!rateCheck.allowed) {
          console.warn(`[WARN] OpenAI ${rateCheck.reason} rate limit exceeded: ${rateCheck.current}/${rateCheck.limit} tokens`);
        } else if (rateCheck.remaining) {
          const checkRemaining = (limit, type) => {
            if (limit !== null && limit < 1000) {
              console.warn(`[WARN] OpenAI ${type} limit approaching: ${limit} tokens remaining`);
            }
          };
          checkRemaining(rateCheck.remaining.hourly, 'hourly');
          checkRemaining(rateCheck.remaining.daily, 'daily');
          checkRemaining(rateCheck.remaining.monthly, 'monthly');
        }
      }
      
      const message = response.choices[0].message;
      
      if (message.function_call) {
        // Extract reasoning from the content (even with function calls, GPT can provide reasoning)
        const reasoning = message.content || `Decided to call ${message.function_call.name}`;
        
        console.log('[DECISION] Agent decided to use tool:', message.function_call.name);
        console.log('[THINKING] Agent reasoning:', reasoning);
        
        // Safely parse function call arguments with error handling
        let parameters = {};
        try {
          if (message.function_call.arguments) {
            parameters = JSON.parse(message.function_call.arguments);
          }
        } catch (parseError) {
          console.error('❌ [JSON PARSE] Invalid function arguments:', message.function_call.arguments);
          console.error('❌ [JSON PARSE] Parse error:', parseError.message);
          
          // For build_personalized_email, we don't need parameters anyway
          if (message.function_call.name === 'build_personalized_email') {
            parameters = {};
          } else {
            // For other functions, return an error
            return {
              reasoning: `JSON parse error in function arguments: ${parseError.message}`,
              action: 'pause',
              parameters: { error: `Invalid JSON in ${message.function_call.name}: ${parseError.message}` }
            };
          }
        }
        
        // Don't log the technical reasoning, just the action
        
        return {
          reasoning: reasoning,
          action: message.function_call.name,
          parameters: parameters
        };
      }

      const reasoning = message.content || 'Agent is thinking...';
      console.log('🤔 [THINKING] Agent reasoning:', reasoning);
      
      // Don't log pure thinking states to keep logs clean

      return {
        reasoning: reasoning,
        action: 'think',
        parameters: {}
      };

    } catch (error) {
      console.error('❌ [REASONING] Error:', error);
      
      // Log OpenAI API errors as issues
      if (error.status || error.code) {
        const errorMsg = error.status === 401 ? 'OpenAI API authentication failed - check API key' :
                        error.status === 429 ? 'OpenAI API rate limit exceeded' :
                        error.status === 500 ? 'OpenAI API server error' :
                        error.code === 'ENOTFOUND' ? 'OpenAI API connection failed - check internet connection' :
                        `OpenAI API error: ${error.message}`;
        this.logIssue('error', errorMsg, {
          status: error.status,
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle specific OpenAI rate limit errors
      if (error.status === 429) {
        console.log('🚨 [EMERGENCY] OpenAI quota exceeded - initiating emergency stop');
        
        // Check if it's an insufficient_quota error (account has no credits)
        if (error.code === 'insufficient_quota') {
          console.error('❌ [CRITICAL] OpenAI account has no credits remaining!');
          console.error('❌ [CRITICAL] Emergency stopping agent to prevent infinite retry loop');
          
          // Log the critical issue to monitoring
          this.logIssue('critical', 'OpenAI quota exceeded - agent emergency stopped', {
            error: error.message,
            code: error.code,
            status: error.status,
            timestamp: new Date().toISOString(),
            action: 'Add credits at https://platform.openai.com/account/billing'
          });
          
          // Emit alert event for immediate notification
          this.emitProgress('alert', {
            type: 'critical',
            title: '🚨 Emergency Stop: OpenAI Quota Exceeded',
            message: 'Agent stopped due to insufficient OpenAI credits. Please add credits to your account.',
            action: 'https://platform.openai.com/account/billing',
            timestamp: new Date().toISOString()
          });
          
          // Add emergency log
          this.addLog('🚨 Emergency Stop: OpenAI quota exceeded. Please add credits to your OpenAI account.');
          
          // Stop the agent immediately
          await this.stop();
          
          throw new Error('EMERGENCY STOP: OpenAI quota exceeded. Please add credits to your OpenAI account at https://platform.openai.com/account/billing');
        }
        
        console.log('⚠️ [REASONING] OpenAI rate limit hit, using deterministic fallback logic');
        
        // Use deterministic logic when OpenAI is unavailable
        if (!context.hasUserSettings) {
          return {
            reasoning: 'OpenAI unavailable, using fallback: need user settings',
            action: 'get_user_settings',
            parameters: {}
          };
        }
        
        if (!context.hasEmailSettings) {
          return {
            reasoning: 'OpenAI unavailable, using fallback: need email settings', 
            action: 'get_email_settings',
            parameters: {}
          };
        }
        
        if (context.cycleComplete) {
          return {
            reasoning: 'OpenAI unavailable, cycle complete',
            action: 'complete',
            parameters: {}
          };
        }
        
        // Deterministic phase-based logic
        switch (context.processingPhase) {
          case 'search':
            if (!context.currentLead && (context.leadQueue?.length || 0) === 0) {
              return {
                reasoning: 'OpenAI unavailable, using fallback: need to search for leads',
                action: 'apollo_search',
                parameters: {
                  query: 'CEO',
                  companySize: '300-5000',
                  location: 'United States',
                  industries: ['SaaS'],
                  position: 'CEO'
                }
              };
            }
            break;
            
          case 'research':
            if (context.currentLead) {
              return {
                reasoning: 'OpenAI unavailable, using fallback: research current lead',
                action: 'serper_research',
                parameters: {
                  companyName: context.currentLead.company || context.currentLead.organization?.name,
                  personName: context.currentLead.name
                }
              };
            }
            break;
            
          case 'email':
            if (context.currentLead) {
              return {
                reasoning: 'OpenAI unavailable, using fallback: unlock email',
                action: 'unlock_email',
                parameters: {
                  firstName: context.currentLead.first_name,
                  lastName: context.currentLead.last_name,
                  companyName: context.currentLead.company || context.currentLead.organization?.name,
                  domain: context.currentLead.organization?.primary_domain || context.currentLead.domain
                }
              };
            }
            break;
            
          case 'build':
            if (context.currentLead) {
              return {
                reasoning: 'OpenAI unavailable, using fallback: build email',
                action: 'build_personalized_email',
                parameters: {}
              };
            }
            break;
        }
      }
      
      return {
        reasoning: 'Error in reasoning process - pausing cycle',
        action: 'pause',
        parameters: { error: error.message }
      };
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
          return { name: 'apollo_search' };
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
      case 'apollo_search':
        if (actionResult?.leads?.length > 0) {
          // Reset duplicate counter when we find new leads
          this.memory.consecutiveDuplicateSearches = 0;
          
          // Add all leads to the queue for sequential processing
          actionResult.leads.forEach(lead => {
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
              company: companyName
            };
            this.memory.currentCycle.leadQueue.push(normalizedLead);
          });
          
          // Start processing the first lead from queue
          if (this.memory.currentCycle.leadQueue.length > 0 && !this.memory.currentCycle.currentLead) {
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
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
            // Increase page offset to search deeper pages
            this.memory.searchPageOffset += 5;
            
            // Reset duplicate counter after adaptation
            this.memory.consecutiveDuplicateSearches = 0;
            
            // Log to user
            this.logOperation(
              '🔍 Search Strategy Adapted',
              `Exhausted recent leads - now searching deeper pages (${this.memory.searchPageOffset + 1}+) for fresh prospects`,
              'info',
              {
                pageOffset: this.memory.searchPageOffset,
                timestamp: new Date().toISOString()
              }
            );
            
            // Also emit as an issue/alert for the Agent Director alerts section
            this.logIssue('info', 'Search Strategy Adapted', {
              message: `Exhausted recent leads in pages 1-${this.memory.searchPageOffset}. Now searching deeper pages (${this.memory.searchPageOffset + 1}+) for fresh prospects.`,
              pageOffset: this.memory.searchPageOffset,
              searchRange: `${this.memory.searchPageOffset + 1}-${this.memory.searchPageOffset + 10}`,
              reason: 'consecutive_duplicates',
              timestamp: new Date().toISOString()
            });
          }
          
          // Check if we still need more leads for our target
          const totalLeadsNeeded = this.memory.currentCycle.targetLeads;
          const currentLeadCount = this.memory.currentCycle.leadQueue.length + this.memory.currentCycle.leadsProcessed;
          
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
            // Pre-qualification failed, skip lead and get next
            console.log(`[SKIP] Pre-qualification failed (score: ${actionResult.score}/100), skipping lead`);
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
            // Qualification passed, check if we need email unlock or can skip to build
            if (this.memory.currentCycle.currentLead?.email) {
              this.memory.currentCycle.processingPhase = 'build';
            } else {
              this.memory.currentCycle.processingPhase = 'email';
            }
          } else {
            // Qualification failed, skip lead and get next
            console.log(`[DISQ] Lead disqualified (score: ${actionResult.score}/100), skipping lead`);
            this.memory.currentCycle.currentLead = null;
            
            // Get next lead from queue or search for more
            if (this.memory.currentCycle.leadQueue.length > 0) {
              this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
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
          const leadData = {
            ...this.memory.currentCycle.currentLead,
            email: this.memory.currentCycle.currentLead.email,
            company: this.memory.currentCycle.currentLead.company || this.memory.currentCycle.currentLead.organization?.name,
            personalizedEmail: actionResult.email,
            emailSubject: actionResult.subject,
            generatedEmail: actionResult.email,
            research: this.memory.lastResearch, // Include the research data from memory
            // Add AI confidence report from email generation
            confidenceReport: actionResult.confidenceReport,
            confidenceLevel: actionResult.confidenceLevel,
            // Add qualification metadata
            qualificationScore: qualification.score,
            qualificationConfidence: confidence,
            researchQuality: qualification.researchQuality,
            requiresReview: requiresReview,
            keyStrengths: qualification.keyStrengths,
            weaknesses: qualification.weaknesses
          };
          
          await this.addToEmailQueue(leadData);
          
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
          this.memory.currentCycle.currentLead = null;
          
          // Get next lead from queue or search for more
          if (this.memory.currentCycle.leadQueue.length > 0) {
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
          } else if (this.memory.currentCycle.leadsProcessed < this.memory.currentCycle.targetLeads) {
            // Need more leads - search again
            this.memory.currentCycle.processingPhase = 'search';
          } else {
            // Cycle complete
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
          } else if (this.memory.currentCycle.leadsProcessed < this.memory.currentCycle.targetLeads) {
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
    // Get data from current cycle state (NOT from parameters - GPT-3.5 calls with empty {})
    const leadData = this.memory.currentCycle.currentLead;
    const researchData = this.memory.lastResearch;
    const emailSettings = this.memory.emailSettings;
    const primaryService = emailSettings?.companyBranding?.primaryService || '';
    const coreOffering = emailSettings?.companyBranding?.coreOffering || '';
    
    const personName = leadData?.name || 'Unknown';
    const companyName = leadData?.organization?.name || leadData?.company || 'Unknown Company';
    
    
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

⚠️ PRODUCT-FIT GATE (generous — SHOTGUNs exist for a reason):
Ask: does this prospect's industry/role make them a plausible buyer for [${primaryService || 'the product being sold'}]?
- STRONG FIT with evidence → normal scoring, can reach HIGHLY_QUALIFIED
- PLAUSIBLE / SPECULATIVE (adjacent industry, possible but unproven use case) → SHOTGUN range (40-60), send generic outreach
- WEAK but not impossible (lateral industry, stretch connection) → low SHOTGUN (40-50), still gets emailed
- GENUINELY IRRELEVANT (completely wrong industry, clear zero use case, active disqualifier) → REJECT (≤35), skip email
Title and company size CAN push a weak-fit lead up to SHOTGUN — they just can't push it to QUALIFIED without real evidence.
When in doubt, land in SHOTGUN rather than REJECT.

QUALIFICATION CRITERIA:
Must Have (required): ${criteria.mustHave?.join(', ') || 'None'}
Nice to Have (bonus points): ${criteria.niceToHave?.join(', ') || 'None'}
Disqualifiers (instant reject): ${criteria.disqualifiers?.join(', ') || 'None'}

TIERED EVALUATION SYSTEM:

TIER 1: HIGHLY_QUALIFIED (Score 80-100)
- STRONG, SPECIFIC buyer motivation articulated with urgency/timeline
- All must-have criteria verified with strong evidence
- Multiple specific facts from research confirm fit (5+ facts)
- Clear reason WHY they would buy NOW
- Ready for deeply personalized email with cited research
- Example: Independent hotel owner, 50 rooms, uses legacy PMS, just posted about seeking upgrade solutions, budget allocated Q1 2026

TIER 2: QUALIFIED (Score 60-79)
- DECENT buyer motivation with some evidence-based reasoning
- Most must-have criteria met
- Some evidence from research (2-4 facts)
- Plausible reason they might buy soon
- Ready for moderate personalization
- Example: Hotel manager, right size, unclear if independent, but growing and mentions operational challenges

TIER 3: SHOTGUN (Score 40-59)
- WEAK or GENERIC buyer motivation (speculative, not evidence-based)
- Generally in target industry/role
- Limited/weak research evidence (0-1 facts)
- No clear urgency or timeline
- Send generic template, no personalization
- Example: Hospitality worker, some relevant keywords, unclear fit, no specific motivation

TIER 4: REJECT (Score 0-39)
- CANNOT articulate any plausible buyer motivation OR
- Disqualifier found OR
- Does not meet critical must-have criteria
- Do NOT send email
- Example: Chain hotel (when seeking independent), wrong industry, or no reason they'd buy

YOUR TASK:
1. Check for disqualifiers FIRST (instant REJECT if found)
2. ARTICULATE BUYER MOTIVATION - This is the PRIMARY qualification factor
3. Analyze research evidence quality (strong vs weak)
4. Assign tier and confidence based on buyer motivation clarity + evidence strength
5. List specific cited facts that support the tier assignment

🎯 BUYER MOTIVATION IS THE HIGHEST PRIORITY:
- If you can articulate SPECIFIC, EVIDENCE-BASED buyer motivation → HIGH confidence possible
- Strong buyer motivation = they should act NOW = HIGHLY_QUALIFIED or QUALIFIED tier
- Weak/generic motivation = speculative = SHOTGUN tier at best
- No buyer motivation = REJECT or SHOTGUN (never HIGHLY_QUALIFIED)

CONFIDENCE LEVEL LOGIC:
- HIGH confidence: Strong buyer motivation + 5+ cited facts + clear urgency/timeline
- MEDIUM confidence: Decent buyer motivation + 2-4 cited facts + general fit
- LOW confidence: Weak/speculative motivation OR insufficient evidence

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
→ The lead should be REJECT or SHOTGUN (not HIGHLY_QUALIFIED/QUALIFIED)
→ Without clear motivation, personalization is guesswork

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
            } catch (logError) {
              console.error(`   ⚠️ Failed to log API usage: ${logError.message}`);
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
      }

      // Find matching person with flexible matching
      let targetPerson = searchData.people.find(p => 
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

      // Get data from current cycle state instead of parameters
      const leadData = this.memory.currentCycle.currentLead;

      // Query industry facts RAG with prospect-specific context for maximum relevance
      // This runs regardless of whether phase 3 was cached — always get the best stat for THIS lead
      const _ragIndustry = leadData?.organization?.industry || '';
      const _ragTopic = `${leadData?.title || ''} ${this.memory.currentQualification?.buyerMotivation || ''}`.trim();
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
      const researchData = this.memory.lastResearch;
      const emailSettings = this.memory.emailSettings;
      const qualification = this.memory.currentQualification; // Get tier from qualification
      
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
      // SHOTGUN tier is exempt — it uses generic templates and doesn't require specific evidence
      const isShotgun = tier === 'SHOTGUN';
      const hasValidMotivation = buyerMotivation && 
        buyerMotivation !== 'Not articulated' &&
        buyerMotivation.length > 50 && // Must be substantial
        !buyerMotivation.toLowerCase().includes('might need') &&
        !buyerMotivation.toLowerCase().includes('probably') &&
        !buyerMotivation.toLowerCase().includes('could benefit');
      
      if (!hasValidMotivation && !isShotgun) {
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

      // For SHOTGUN, fall back to a generic role/industry motivation if none was articulated
      const resolvedMotivation = hasValidMotivation
        ? buyerMotivation
        : `${leadData.title || 'Professional'} at ${companyName} — general industry fit with potential need for our solution based on role and company profile.`;

      if (isShotgun && !hasValidMotivation) {
      } else {
      }
      
      // Extract cited facts for personalization
      let citedFactsContext = '';
      
      // Prefer qualification-extracted emailHooks (already filtered for specificity)
      const emailHooks = aiReport?.emailHooks || [];
      if (emailHooks.length > 0) {
        citedFactsContext = `\nEMAIL HOOKS (specific facts extracted from research — use these to anchor para 1):\n${
          emailHooks.map((hook, i) => `${i + 1}. ${hook}`).join('\n')
        }`;
      } else if (aiReport?.allCitedFacts && aiReport.allCitedFacts.length > 0) {
        const topFacts = aiReport.allCitedFacts.slice(0, 10);
        citedFactsContext = `\nVERIFIED RESEARCH FACTS (use these naturally in the email - do NOT include source citations):\n${
          topFacts.map((fact, i) => `${i + 1}. "${fact.text}"`).join('\n')
        }`;
      }
      
      // Build tier-specific email instructions
      let tierInstructions = '';
      let personalizationLevel = 'DEEP';
      
      switch (tier) {
        case 'HIGHLY_QUALIFIED':
          personalizationLevel = 'DEEP';
          tierInstructions = `
🌟 TIER: HIGHLY QUALIFIED - DEEP PERSONALIZATION
This lead is a PERFECT MATCH with verified research. Write a highly personalized email using specific cited facts.

REQUIREMENTS:
✓ Use 3-5 specific facts from the VERIFIED RESEARCH FACTS above
✓ Cite each fact naturally (e.g., "I saw you recently raised $10M...")
✓ Show you deeply understand their business
✓ Make specific recommendations based on their situation
✓ Email should feel like it was written by a human who spent 30 minutes researching them

STRENGTHS TO LEVERAGE:
${qualification?.keyStrengths?.map(s => `- ${s}`).join('\n') || 'N/A'}

EMAIL LENGTH: 6-7 sentences (highly personalized but concise)`;
          break;
          
        case 'QUALIFIED':
          personalizationLevel = 'MODERATE';
          tierInstructions = `
✅ TIER: QUALIFIED - MODERATE PERSONALIZATION
This lead is a GOOD MATCH with some verified research. Write a moderately personalized email.

REQUIREMENTS:
✓ Use 1-2 facts from research if available
✓ Focus on industry/role relevance
✓ Show understanding of their general challenges
✓ Less specific than HIGHLY_QUALIFIED but more than generic template

STRENGTHS TO LEVERAGE:
${qualification?.keyStrengths?.map(s => `- ${s}`).join('\n') || 'General industry fit'}

EMAIL LENGTH: 6-7 sentences (standard personalization)`;
          break;
          
        case 'SHOTGUN':
          personalizationLevel = 'MINIMAL';
          tierInstructions = `
🎯 TIER: SHOTGUN - MINIMAL PERSONALIZATION
This lead is TANGENTIALLY RELATED. Write a generic template email focusing on value proposition.

REQUIREMENTS:
✓ DO NOT use specific research facts (not enough verified data)
✓ Focus on general industry/role pain points
✓ Lead with value proposition immediately
✓ Keep it brief and scannable
✓ Use generic but professional language

EMAIL LENGTH: 5-6 sentences (short and generic)`;
          break;
          
        default:
          personalizationLevel = 'MODERATE';
          tierInstructions = `
STANDARD PERSONALIZATION - Use available research but don't force it.
EMAIL LENGTH: 6-7 sentences`;
      }
      
      // Get agent personality for email style
      const personality = await this.getAgentPersonality();
      
      // Get calendar link from user settings
      const calendarLink = this.memory.userSettings?.calendarIntegrationEnabled && this.memory.userSettings?.calendarTokens
        ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar/book/${this.userId}`
        : (this.memory.userSettings?.calendly_link || this.memory.userSettings?.calendar_link || 'your scheduling link');
      
      // Get custom prompt from email builder settings (editable in UI) - this is the personality/style
      // Replace [SCHEDULING_LINK] placeholder with actual calendar link
      let customPrompt = emailSettings.customPrompt || emailSettings.emailBuilder?.customPrompt || personality?.emailPrompt || 'Write professional sales emails';
      customPrompt = customPrompt.replace(/\[SCHEDULING_LINK\]/g, calendarLink);
      
      // Build campaign-specific messaging if plan exists
      let campaignStrategy = '';
      
      if (this.campaignPlan && this.campaignPlan.emailMessaging) {
        const messaging = this.campaignPlan.emailMessaging;
        campaignStrategy = `
CAMPAIGN STRATEGY (use this to guide your messaging):
Primary Value Proposition: ${messaging.primaryValue}
Key Points to Emphasize: ${messaging.keyPoints?.join(', ') || 'Standard benefits'}
Call to Action: ${messaging.callToAction || 'Schedule a call'}
Tone: ${messaging.tone || 'professional'}`;
        
      }
      
      // Add BUYER MOTIVATION context (validated above - this is CRITICAL)
      const buyerMotivationContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 BUYER-SIDE MOTIVATION (USE THIS TO GUIDE YOUR EMAIL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${resolvedMotivation}

Your email MUST connect to this motivation. This is not generic - this is the specific,
evidence-based reason WHY this person would buy from us RIGHT NOW. Use this to:
✓ Frame your opening hook around their current situation
✓ Connect your solution to their immediate needs/timeline
✓ Create urgency based on their actual business context
✓ Demonstrate you understand their strategic priorities

DO NOT write generic emails. Use this buyer motivation to show sophisticated understanding.`;
      
      
      // Build research findings summary for the prompt
      let researchFindings = '';
      if (this.memory.lastResearch && this.memory.lastResearch.searches) {
        const searches = this.memory.lastResearch.searches;
        // Extract research context        
        researchFindings = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 RESEARCH FINDINGS (USE THESE IN YOUR EMAIL)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ CRITICAL ANTI-HALLUCINATION WARNING:\n- ONLY use facts that explicitly mention the prospect\'s company name\n- If a "fact" could apply to ANY company, it\'s probably hallucinated - DO NOT USE IT\n- When in doubt, skip the fact. Better to be conservative than confidently wrong.\n- NEVER attribute achievements from one company to another\n\n';
        
        searches.forEach((search, index) => {
          
          if (search.purpose === 'company_overview') {
            const facts = search.results?.organic?.slice(0, 3).map(r => `• ${r.snippet}`).join('\n') || '';
            if (facts) researchFindings += `📍 ABOUT THE PROSPECT'S COMPANY (${companyName}):\n${facts}\n\n`;
          } else if (search.purpose === 'recent_developments') {
            const news = search.results?.organic?.slice(0, 3).map(r => `• ${r.snippet}`).join('\n') || '';
            if (news) researchFindings += `📰 ${companyName}'S RECENT NEWS (use these for opening hooks):\n${news}\n\n`;
          } else if (search.purpose === 'industry_statistics') {
            const stats = search.webpageInsights?.slice(0, 2).map(insight => `• ${insight.insights}`).join('\n') || '';
            if (stats) researchFindings += `📊 INDUSTRY STATISTICS (neutral third-party data - cite for credibility):\n${stats}\n\n`;
          } else if (search.purpose === 'user_company_success') {
            const wins = search.webpageInsights?.filter(w => w.insights && !w.insights.includes('NO RELEVANT DATA')).map(w => w.insights).join('\n') || '';
            
            // Only include if we found actual verified wins
            if (wins.length > 50) {
              const userCompanyName = this.memory.emailSettings?.companyBranding?.companyName
                || this.memory.userSettings?.companyName
                || this.memory.userSettings?.companyProfile?.companyName
                || 'Your Company';
              researchFindings += `🏆 ${userCompanyName.toUpperCase()}'S RECENT WINS (about YOUR company - NOT the prospect):\n${wins}\n⚠️ Use ONLY if truly impressive and relevant. DO NOT confuse these with ${companyName}'s achievements.\n\n`;
            } else {
            }
          }
        });
        
        if (researchFindings.length > 200) {
        } else {
        }
      } else {
      }
      
      // Pre-compute RAG facts block to avoid triple-nested backtick syntax issues
      const ragFactsBlock = this.memory.industryFactsFromRAG?.length > 0
        ? '⚠️ MANDATORY: Anchor the critique with one of these verified stats — use the actual number, don\'t generalize:\n' +
          this.memory.industryFactsFromRAG.slice(0, 4).map((f, i) => `${i + 1}. ${f}`).join('\n') + '\n' +
          'Bad: "Many companies struggle with this." | Good: "With GPU demand up 40% YoY, waiting on on-prem procurement is a 6-month gap your competitors won\'t wait for."'
        : 'If RESEARCH FINDINGS contains an INDUSTRY STATISTICS section, anchor the critique with a specific number from it. If no stat exists, make the case qualitatively — do NOT invent a percentage.';

      // Common ruleset for email structure - ALWAYS include lead details and context
      const commonRuleset = `
PROSPECT INFORMATION:
Company: ${companyName}
Contact: ${leadData.first_name} ${leadData.last_name}
Title: ${contactTitle}
Industry: ${industry}
Employee Count: ${employeeCount} employees${citedFactsContext}${campaignStrategy}${researchFindings}

YOUR SOLUTION:
Product/Service: ${emailSettings.companyBranding?.primaryService || 'Business solutions and services'}
Key Benefits: ${emailSettings.companyBranding?.keyAdvantages || 'Improved efficiency, streamlined operations, better results'}
Company: ${emailSettings.companyBranding?.companyName || 'Our Company'}${this.memory.platformMetrics?.raw ? `

YOUR COMPANY INTEL (scraped from your website — extract specific numbers, claims, and proof points from this for paragraph 3):
${this.memory.platformMetrics.raw}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING STYLE BY PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 HUNTER: Direct, ROI-focused. Subject: "Save X% on [thing]" CTA: "Worth 15 minutes?"
💙 RELATIONSHIP: Questions, consultative. Subject: "Question about [initiative]" CTA: "Curious if this fits?"
📊 ANALYST: Data-led. Subject: "Data on [challenge]" CTA: "Happy to share the research"
🧠 CONSULTANT: Strategic peer. Subject: "Strategic thought on [problem]" CTA: "Can outline the approach"
🌐 NETWORKER: Social proof. Subject: "Working with [similar company]" CTA: "Mind if I share?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ USE RESEARCH: Open with a specific fact, event, or number from the RESEARCH FINDINGS above
✅ STATE FACTS NATURALLY: "I saw your team expanded into 17 markets" not "According to research..."
✅ NUMBERS: ONLY use numbers that appear in RESEARCH FINDINGS or PLATFORM METRICS above. If no real numbers exist, make the case qualitatively — never invent statistics or percentages.
✅ NAME COMPANIES: "Stripe saw X" not "Companies see X" — only if that company appears in research above
✅ NO SOURCE CITATIONS: State facts as if you know them — no "[Source: ...]" or "(McKinsey, 2024)"

❌ NO INVENTED STATS: "30% more effective", "2x faster", "$200K savings" — if it's not in the research data above, do not write it
❌ NEVER HALLUCINATE: If a fact doesn't explicitly name the prospect's company, skip it
❌ NO GENERIC BULLETS: "Feature = Benefit" format is forbidden
❌ NO FLUFF: Skip "visionary leader", "imagine a world where", "I hope this finds you well"

WRITE THE EMAIL BODY ONLY — the subject line is handled separately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL STRUCTURE: FLAW → FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write exactly 2 paragraphs (2-3 sentences each) + 1 line CTA. Keep it tight — under 120 words total.

SUBJECT LINE + PARAGRAPH 1 ARE LOCKED:
The subject is provocative — a statement, claim, or question that names a flaw, risk, or mistake.
Paragraph 1 MUST immediately deliver the argument behind the subject. If subject says "X is broken" then para 1 opens with WHY it's broken — specific to them, from research.
❌ Never open with a compliment, award, or positive framing. Lead with the problem.

PARAGRAPH 1 — THE FLAW (critique a specific mistake or risk they have):
Name the specific thing they're doing wrong, ignoring, or underestimating — based on real research signals.
❌ No "you're doing great but..." setup. Open cold on the problem.
${ragFactsBlock}

PARAGRAPH 2 — THE FIX (your product solves exactly that flaw):
Connect your solution directly to the specific flaw named in para 1 — explain the mechanism, not just the category.
If YOUR COMPANY INTEL has real client metrics, use them verbatim. If not, explain WHAT you do and WHY it addresses THAT specific problem.
❌ NEVER invent performance claims. No "our clients see X%" unless it appears word-for-word in YOUR COMPANY INTEL.

CTA (1 line):
One direct question tied to the specific problem or their timeline — not a generic "hop on a call."


FORMATTING RULES:
✅ Short paragraphs — 1-2 sentences max. Use line breaks between each.
✅ Em dashes (—) where natural
✅ Open with "Hi [FirstName]," not "Hello"
✅ No exclamation marks, no corporate buzzwords, no "I hope this finds you well"
✅ Sound like a smart human, not a template
❌ No invented stats. No "X% of companies" unless that stat appears in the research above.
❌ No invented client results. No "our clients see X% improvement" unless that appears verbatim in YOUR COMPANY INTEL above.
❌ No bullet lists in the body
❌ No multi-sentence compliments


SIGNATURE FORMAT:
Best,
${emailSettings.emailBuilder?.useCustomSignature ? (emailSettings.emailBuilder?.signatureName || 'Sales Representative') : (emailSettings.companyBranding?.agentName || 'AI Assistant')}
${emailSettings.emailBuilder?.useCustomSignature ? (emailSettings.emailBuilder?.signatureTitle || '') + (emailSettings.emailBuilder?.signatureTitle ? '\n' : '') : ''}${emailSettings.companyBranding?.companyName || 'Our Company'}${!emailSettings.emailBuilder?.useCustomSignature ? ' ' + (emailSettings.companyBranding?.agentTitle || 'Representative') : ''}


CRITICAL OUTPUT FORMAT:
- Line 1: "SUBJECT: [your subject line]"
- Line 2: blank line
- Line 3+: "BODY: [email starting with Hi ${leadData.first_name},]"
- DO NOT put the subject line in the body

NOW WRITE YOUR EMAIL following the ISSUE → NEED → SOLVE structure above.`;

      // ALWAYS combine personality prompt with common ruleset containing lead details + buyer motivation
      const emailPrompt = `${customPrompt}\n${commonRuleset}${buyerMotivationContext}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: emailPrompt }],
        temperature: 0.7,
        max_tokens: 400
      });

      const emailContent = response.choices[0].message.content;
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'email_generation',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4o',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            companyName: companyName,
            leadName: contactName
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }
      
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
      
      // 🚀 DYNAMIC SUBJECT LINE GENERATION
      // ALWAYS generate subject line from email body content for maximum relevance
      let subject = 'Quick question'; // Fallback only if API fails completely
      
      try {
        const subjectPrompt = `Read this cold sales email and write a subject line that will make the recipient open it.

EMAIL BODY:
${body}

LEAD:
- Name: ${leadData.first_name} ${leadData.last_name}
- Company: ${companyName}
- Title: ${leadData.title}

RULES FOR THE SUBJECT LINE:
- Under 50 characters
- Provocative — a bold statement, a named flaw, a sharp claim, or a pointed question. Any format works if it's specific and creates discomfort or curiosity.
- Must connect directly to the specific argument in the email body
- Sentence case, no exclamation marks, no spam words
- Read like something a sharp human wrote, not a marketing template

GOOD EXAMPLES (style only, not content):
- "Your agency BD is probably broken"
- "Why 17 markets makes this worse"
- "Retiina's automation gap"
- "Is your GPU pipeline ready for 2026?"
- "Most agencies lose here"
- "What manual outreach costs at scale"
- "Black Sesame's infrastructure bet"

BAD EXAMPLES (never do these):
- "Quick question about Brandy" — weak, no claim
- "Exciting opportunity for you" — spam
- "Improve your outreach" — vague
- "Are traditional methods holding you back?" — generic non-question

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
      
      // Generate lead qualification confidence report
      const analysisPrompt = `Analyze this lead's qualification and likelihood to respond positively.

LEAD DETAILS:
- Name: ${leadData.first_name} ${leadData.last_name}
- Title: ${leadData.title}
- Company: ${companyName}
- Industry: ${industry}

RESEARCH DATA QUALITY:
${citedFactsContext || 'Limited research data available'}

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
      
      
      // Add legal compliance footer
      const { generateUnsubscribeToken } = await import('../routes/unsubscribe.js');
      const unsubscribeToken = generateUnsubscribeToken(leadData.email);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const unsubscribeUrl = `${frontendUrl}/unsubscribe?token=${unsubscribeToken}`;
      
      // Get company address from settings (use company profile)
      
      const companyAddress = this.memory.userSettings?.companyProfile?.companyAddress || 
                            this.memory.userSettings?.companyAddress || 
                            emailSettings.companyBranding?.companyAddress ||
                            'Your Company Address';
      
      
      // Minimal compliance footer - less promotional looking
      const companyWebsite = this.memory.userSettings?.companyProfile?.website ||
                             emailSettings.companyBranding?.website || '';
      const footerParts = [emailSettings.companyBranding?.companyName || 'Our Company'];
      if (companyWebsite) footerParts.push(companyWebsite);
      const footer = `\n\n${footerParts.join(' | ')}\n` +
        `<a href="${unsubscribeUrl}">Stop emails</a>`;
      
      body = body + footer;
      
      
      return {
        success: true,
        email: body,
        subject: subject,
        confidenceReport: confidenceReport,
        confidenceLevel: confidenceLevel
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
  async apolloSearch(parameters) {
    
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
        this.memory.campaignPriorityKeyword = priorityIndustry.split(/\s*&\s*/)[0].trim().toLowerCase();
        this.memory.leadsFoundWithCurrentKeyword = 0;
      }
      
      // STEP 2: SYNCHRONIZED KEYWORD + POSITION ROTATION (Paired by Index)
      let selectedKeyword = null;
      let selectedPositionIndex = null;
      let keywordSource = 'base';
      
      // Priority 1: Campaign-specific keyword (until high duplicate rate)
      if (this.memory.campaignPriorityKeyword && this.memory.leadsFoundWithCurrentKeyword < 999) {
        selectedKeyword = this.memory.campaignPriorityKeyword;
        keywordSource = 'campaign';
        selectedPositionIndex = 0; // Use first position for campaign priority
      } else {
        // Finished campaign priority OR no campaign priority set
        if (this.memory.campaignPriorityKeyword && this.memory.leadsFoundWithCurrentKeyword >= 999) {
          this.memory.campaignPriorityKeyword = null; // Clear it
          this.memory.leadsFoundWithCurrentKeyword = 0;
        }
        
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
        
        // Determine which keyword+position pair to use
        const keywordIndex = this.memory.currentKeywordIndex % totalKeywords;
        
        if (keywordIndex < totalBaseKeywords) {
          // Use base keyword from user settings
          selectedKeyword = baseKeywords[keywordIndex];
          keywordSource = 'base';
          // Pair with matching position index + cycle offset for variety
          selectedPositionIndex = (keywordIndex + this.memory.cycleOffset) % basePositions.length;
        } else {
          // Use AI-generated keyword
          const aiIndex = keywordIndex - totalBaseKeywords;
          selectedKeyword = aiKeywords[aiIndex];
          keywordSource = 'ai';
          // Pair with matching AI position + cycle offset
          selectedPositionIndex = (aiIndex + this.memory.cycleOffset) % aiPositions.length;
        }
        
        // Determine the actual position being used
        const currentSearchPosition = (keywordIndex < totalBaseKeywords) 
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
        
        // Check if this keyword has high cumulative duplicate rate - if so, skip it entirely
        const tracker = this.memory.industryExhaustion[selectedKeyword];
        if (tracker && tracker.cumulativeDuplicateRate > 20 && tracker.totalAttempts >= 5) {
          this.memory.leadsFoundWithCurrentKeyword = 999; // Force rotation to next keyword
          return {
            success: true,
            found: 0,
            leads: [],
            skipped: true,
            reason: `Keyword exhausted (${tracker.cumulativeDuplicateRate.toFixed(1)}% duplicates)`
          };
        }
        
        // Otherwise just force rotation to try next keyword
        this.memory.leadsFoundWithCurrentKeyword = 999;
        return {
          success: true,
          found: 0,
          leads: [],
          skipped: true,
          reason: `Already searched ${selectedKeyword} + ${targetPosition} recently`
        };
      }
      
      // Reset duplicate search counter on successful new search
      this.memory.consecutiveDuplicateSearches = 0;
      
      // Calculate how many leads we still need
      const leadsNeeded = this.memory.currentCycle.targetLeads - this.memory.currentCycle.leadsProcessed;
      const remainingInQueue = this.memory.currentCycle.leadQueue.length;
      const leadsToRequest = Math.max(1, leadsNeeded - remainingInQueue);
      
      
      const searchPayload = {
        q_keywords: targetPosition,
        page: searchPage,
        per_page: leadsToRequest,
        reveal_personal_emails: true,
        reveal_phone_number: true
      };

      // Use agent-reasoned company size or fall back to user settings
      let sizeMin, sizeMax;
      if (parameters.companySize) {
        // Parse agent's company size parameter (e.g. "300-5000" or "300,5000")
        const sizeRange = parameters.companySize.toString().split(/[-,]/);
        sizeMin = parseInt(sizeRange[0]);
        sizeMax = parseInt(sizeRange[1]) || sizeMin;
      } else {
        // Fallback to user settings
        if (!userSettings.companySizeMin || !userSettings.companySizeMax) {
          throw new Error('Company size range not configured in user settings');
        }
        sizeMin = userSettings.companySizeMin;
        sizeMax = userSettings.companySizeMax;
      }
      
      searchPayload.organization_num_employees_ranges = [`${sizeMin},${sizeMax}`];

      // Use agent-reasoned location or fall back to user settings
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
      
      // Enrich leads to get actual email addresses and full names
      const enrichedLeads = [];
      for (const lead of rawLeads) {
        try {
          // Check if lead has email available
          if (!lead.has_email) {
            continue;
          }

          // Call people/enrich to get actual email and full name
          const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/enrich', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Api-Key': apiKey
            },
            body: JSON.stringify({
              id: lead.id,
              reveal_personal_emails: true
            })
          });

          if (!enrichResponse.ok) {
            console.log(`[APOLLO] Failed to enrich lead ${lead.id}: ${enrichResponse.status}`);
            continue;
          }

          const enrichedData = await enrichResponse.json();
          const enrichedPerson = enrichedData.person;

          // Build complete lead object with enriched data
          const completeLead = {
            id: lead.id,
            name: `${enrichedPerson.first_name} ${enrichedPerson.last_name}`,
            email: enrichedPerson.email,
            title: enrichedPerson.title,
            company: enrichedPerson.organization?.name || lead.organization?.name,
            organization: enrichedPerson.organization || lead.organization,
            city: enrichedPerson.city,
            state: enrichedPerson.state,
            country: enrichedPerson.country,
            linkedin_url: enrichedPerson.linkedin_url,
            phone: enrichedPerson.phone_number || enrichedPerson.direct_phone,
            ...enrichedPerson // Include all other fields from enriched data
          };

          enrichedLeads.push(completeLead);

          // Log each enrichment for API usage tracking
          await this.awsManager.logApiUsage({
            userId: this.userId,
            agentId: this.agentId,
            service: 'apollo',
            operation: 'email_enrichment',
            usage: 1,
            metadata: {
              personName: completeLead.name,
              company: completeLead.company,
              hasEmail: !!completeLead.email
            }
          }).catch(err => console.error('Failed to log enrichment:', err));

        } catch (enrichError) {
          console.error(`[APOLLO] Error enriching lead ${lead.id}:`, enrichError.message);
          continue;
        }
      }


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
          
          
          // Emit SSE progress for deduplication results
          this.emit('progress', {
            id: this.generateUniqueId(),
            timestamp: new Date().toISOString(),
            operation: 'Deduplication Check',
            details: `✅ Found ${summary.newCount} new leads, filtered ${summary.duplicateCount} duplicates`,
            status: 'completed',
            data: { 
              phase: 'deduplication_complete',
              newLeads: summary.newCount,
              duplicatesFiltered: summary.duplicateCount,
              totalChecked: summary.totalChecked
            }
          });
          
          // Log duplicates for visibility
          if (duplicateLeads.length > 0) {
            duplicateLeads.forEach(lead => {
            });
          }
          
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
              tracker.leadsFound += newLeads.length;
              tracker.totalAttempts += totalAttempts;
              tracker.totalDuplicates += duplicateLeads.length;
              tracker.cumulativeDuplicateRate = (tracker.totalDuplicates / tracker.totalAttempts) * 100;
              
              
              // Store performance to Zilliz for persistent learning
              if (this.memoryInitialized) {
                try {
                  const storeResult = await this.leadMemory.storeKeywordPerformance(
                    this.userId, // Use agent's userId, not userSettings.userId
                    this.agentId,
                    selectedKeyword,
                    targetPosition,
                    totalAttempts,
                    duplicateLeads.length,
                    keywordSource
                  );
                  
                  // Log to UI so user can see RAG is working
                  this.logOperation(
                    '🧠 Memory Updated',
                    `Stored performance for "${selectedKeyword}" - ${storeResult.totalAttempts} total attempts, ${storeResult.cumulativeRate.toFixed(1)}% duplicate rate`,
                    'info'
                  );
                } catch (memError) {
                  console.error('⚠️ [MEMORY] Failed to store performance:', memError.message);
                  this.logOperation('⚠️ Memory Error', `Failed to store performance: ${memError.message}`, 'warning');
                }
              } else {
              }
              
              // Rotate if CUMULATIVE duplicate rate exceeds 50%
              if (tracker.cumulativeDuplicateRate > 20 && tracker.totalAttempts >= 5) {
                
                // Record this search to DB with ACTUAL new leads (before setting rotation flag)
                await this.awsManager.recordSearchHistory(
                  this.userId,
                  this.agentId,
                  selectedKeyword,
                  targetPosition,
                  newLeads.length // Save actual leads found, not rotation flag
                );
                
                this.memory.leadsFoundWithCurrentKeyword = 999; // Force rotation AFTER recording
              }
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

  // Generate AI-related industry keywords by analyzing company profile + current targeting
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
          
        case 'apollo_search':
          this.logOperation('Lead Search', `🔍 [SEARCH] Searching Apollo for ${decision.parameters.title || 'leads'} at ${decision.parameters.industry || 'various industries'}`, 'in-progress', decision.parameters);
          actionResult = await this.apolloSearch(decision.parameters);
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
                  
                  const personalizedEmail = await this.buildPersonalizedEmail({
                    leadData: lead,
                    researchData: research,
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
                    target: targetLeads
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
                    service === 'serper' ? 'SERPER_API_KEY' : null;
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
        aiReport: this.memory.currentQualification?.aiReport || null,
        
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

      // ==========================================
      // CRM SYNC - Automatically sync lead to CRM
      // ==========================================
      try {
        const user = await this.awsManager.getUserById(this.userId);
        
        if (user && user.crmConnected && user.crmAutoSync) {
          console.log(`[CRM SYNC] Starting sync for ${leadData.name || leadData.first_name} to ${user.crmIntegration || 'CRM'}`);
          
          // Emit SSE progress for CRM sync
          this.emit('progress', {
            id: this.generateUniqueId(),
            timestamp: new Date().toISOString(),
            operation: '🔄 Syncing to CRM',
            details: `Syncing ${leadData.name || leadData.first_name} to ${user.crmIntegration}...`,
            status: 'processing',
            data: { 
              phase: 'crm_sync',
              contactName: leadData.name || leadData.first_name,
              crmIntegration: user.crmIntegration
            }
          });
          
          // Prepare comprehensive lead data for CRM with full research and context
          const crmLeadData = {
            firstName: leadData.first_name || leadData.name?.split(' ')[0],
            lastName: leadData.last_name || leadData.name?.split(' ').slice(1).join(' '),
            email: leadData.email,
            phone: leadData.phone_number || null,
            companyName: leadData.company,
            title: leadData.title || null,
            linkedinUrl: leadData.linkedin_url || null,
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
            confidenceReport: queueData.confidenceReport || leadData.confidenceReport || null
          };
          
          // Use unified sync which handles both Merge and direct API integrations
          const syncResult = await this.mergeManager.syncLeadToCRMUnified(this.userId, crmLeadData);
          
          if (syncResult.success) {
            console.log(`[CRM SYNC] OK - ${leadData.name || leadData.first_name} synced to ${syncResult.crmIntegration} (contactId: ${syncResult.crmContactId || 'n/a'})`);
            
            // Emit SSE success for CRM sync
            this.emit('progress', {
              id: this.generateUniqueId(),
              timestamp: new Date().toISOString(),
              operation: '✅ Synced to CRM',
              details: `${leadData.name || leadData.first_name} synced to ${syncResult.crmIntegration}`,
              status: 'completed',
              data: { 
                phase: 'crm_sync_complete',
                crmContactId: syncResult.crmContactId,
                crmIntegration: syncResult.crmIntegration,
                contactName: leadData.name || leadData.first_name
              }
            });
          } else {
            console.warn(`[CRM SYNC] Failed to sync: ${syncResult.error}`);
            
            // Emit SSE warning for CRM sync failure
            this.emit('progress', {
              id: this.generateUniqueId(),
              timestamp: new Date().toISOString(),
              operation: 'CRM Sync',
              details: `⚠️ CRM sync failed - ${syncResult.error}`,
              status: 'warning',
              data: { 
                phase: 'crm_sync_failed',
                error: syncResult.error,
                contactName: leadData.name || leadData.first_name
              }
            });
          }
        } else {
          const skipReason = !user ? 'user not found' : 
                            !user.crmConnected ? 'CRM not connected' : 
                            !user.crmAutoSync ? 'auto-sync disabled' : 'unknown';
          console.log(`[CRM SYNC] Skipped (${skipReason}) for ${leadData.name || leadData.first_name}`);
        }
      } catch (crmError) {
        console.error('❌ [CRM SYNC] Error syncing to CRM:', crmError.message);
        // Don't fail the email queue if CRM sync fails
      }

      // Emit progress event for email queue update
      this.emit('progress', {
        type: 'email_queue',
        message: `Email queued for ${leadData.company}`,
        data: queueData
      });
      
      return queueData.id;
    } catch (error) {
      console.error('❌ [EMAIL QUEUE] Error adding to queue:', error);
      console.error('❌ [EMAIL QUEUE FAILED] User:', this.userId, '| Agent:', this.agentId, '| Lead:', leadData.email, '| Error:', error.message);
      throw error;
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
            
            // Restore memory into industryExhaustion tracker
            Object.keys(memoryData.performanceMap).forEach(keyword => {
              const data = memoryData.performanceMap[keyword];
              this.memory.industryExhaustion[keyword] = {
                leadsFound: 0, // Reset current cycle count
                lastSearched: data.lastUpdated,
                exhausted: data.isExhausted,
                totalAttempts: data.totalAttempts,
                totalDuplicates: data.totalDuplicates,
                cumulativeDuplicateRate: data.cumulativeDuplicateRate
              };
            });
            
            // Log to UI
            this.logOperation(
              '🧠 Memory Loaded',
              `Restored ${memoryData.count} keyword records from Zilliz (${Object.keys(memoryData.performanceMap).filter(k => memoryData.performanceMap[k].isExhausted).length} exhausted)`,
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
    this.crmContactList = crmContacts; // picked up by executeReasoningCycle
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
        this.memory.originalTargetPositions = null;
        this.memory.totalLeadsFoundThisCycle = 0;
        this.memory.industryExhaustion = {};
        this.memory.searchHistoryDB = new Map();
        
      }
      
      // Clear campaign plan (will be regenerated from instructions)
      this.campaignPlan = null;


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
          this.emit('progress', {
            stage: 'credit-limit-reached',
            message: 'Credit balance exhausted. Purchase more credits to continue.',
            timestamp: new Date().toISOString(),
            remainingCredits: 0
          });
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
        const creditsUsed = user.trialCreditsUsed || 0;
        const creditsLimit = user.trialCreditsLimit || this.awsManager.plans[user.plan || 'free-trial'].initialCredits;
        const remainingCredits = creditsLimit - creditsUsed;

        // Check if exhausted
        if (remainingCredits <= 0) {
          this.emit('progress', {
            stage: 'credit-limit-reached',
            message: 'Trial credits exhausted. Please upgrade or purchase credits.',
            timestamp: new Date().toISOString(),
            creditsUsed,
            creditsLimit,
            remainingCredits: 0
          });
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
          
        case 'apollo_search':
          result = await this.apolloSearch(parameters);
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

    try {
      await this.executeReasoningCycle();
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
    
    // Broadcast cycle start event
    try {
      const { broadcastActivity } = await import('../routes/monitoring.js');
      broadcastActivity({
        type: 'cycle_start',
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
      this.memory.currentCycle.leadQueue     = crmLeads;
      this.memory.currentCycle.targetLeads   = crmLeads.length;
      this.memory.currentCycle.processingPhase = 'research'; // Skip apollo_search
      this.crmContactList = null; // Consumed — clear so next cycle uses Apollo normally
      console.log(`[CRM MODE] Pre-loaded ${crmLeads.length} contacts from CRM, skipping Apollo search`);
      this.logOperation('📋 CRM Mode', `Processing ${crmLeads.length} contacts imported from CRM`, 'running');
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

    try {
      let stepCount = 0;
      const maxSteps = 5000; // Safety limit - increased for high-volume lead processing
      const cycleStartTime = Date.now(); // Track cycle start time
      
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
          cycleComplete: this.memory.currentCycle.leadsProcessed >= this.memory.currentCycle.targetLeads
        };

        // Check if settings have errors and need to be fetched
        if (!context.hasUserSettings && this.memory.userSettings?.error) {
          this.logOperation('⚙️ Configuring Agent', 'Loading your agent settings...', 'in-progress');
        }
        if (!context.hasEmailSettings && this.memory.emailSettings?.error) {
          this.logOperation('📧 Email Setup', 'Loading your email preferences...', 'in-progress');
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
