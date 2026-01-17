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
    
    // Load saved settings from DynamoDB
    this.loadSavedSettings();
    
    // Agent memory - learns from experience
    this.memory = {
      searchHistory: [],
      successfulStrategies: [],
      failedStrategies: [],
      industryInsights: {},
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
        description: 'Research a lead/company using Serper to verify Apollo data and gather intelligence',
        parameters: {
          type: 'object',
          properties: {
            companyName: { type: 'string', description: 'Company name to research' },
            personName: { type: 'string', description: 'Person name if researching individual' },
            searchQuery: { type: 'string', description: 'Specific search query for verification' }
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

    console.log('🧠 [REASONING AGENT] Initialized AI reasoning agent for user:', userId);
    
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
        model: 'gpt-3.5-turbo',
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
            model: 'gpt-3.5-turbo',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }
      
      console.log('📝 [PLAN DESCRIPTION]:', description);
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
    console.log('📋 [CAMPAIGN PLAN INPUT] Special Instructions:', specialInstructions);
    console.log('📋 [CAMPAIGN PLAN INPUT] User Settings:', {
      company: userSettings.companyName,
      industries: userSettings.companyIndustries,
      positions: userSettings.targetPositions,
      companySize: `${userSettings.companySizeMin}-${userSettings.companySizeMax}`
    });
    
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
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      const plan = JSON.parse(response.choices[0].message.content);
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'campaign_plan_conversion',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }
      
      console.log('✅ [CAMPAIGN PLAN OUTPUT] Generated structured plan:', JSON.stringify(plan, null, 2));
      console.log('🎯 [CAMPAIGN PLAN SUMMARY]');
      console.log('  Search Strategy:', plan.searchStrategy?.additionalKeywords?.join(', ') || 'None');
      console.log('  Priority Industries:', plan.searchStrategy?.priorityIndustries?.join(', ') || 'None');
      console.log('  Primary Value Prop:', plan.emailMessaging?.primaryValue || 'None');
      console.log('  Qualification Must-Haves:', plan.qualificationCriteria?.mustHave?.length || 0, 'criteria');
      
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
    
    console.log(`📋 [AGENT LOG] ${operation}: ${details}`);
    console.log(`📋 [AGENT LOG] Total logs now: ${this.operationLogs.length}`);
    
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
      '💭 Agent Activity',
      '✅ Process Complete'
    ];

    if (broadcastableOperations.includes(operation)) {
      this.broadcastAgentActivity({
        agentId: this.agentId,
        operation,
        details,
        status,
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
      
      // Create concise card message
      const cardMessage = this.translateToConciseCardMessage(activityData.operation, activityData.details);
      
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
          console.log(`📍 [LOCATION BROADCAST] ${location.city || 'Unknown'}, ${location.state} - ${location.companyName}`);
        } else {
          console.log(`⚠️ [NO LOCATION] Lead has no city/state data:`, {
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
      
      console.log(`📊 [CYCLE LOG] Logged cycle #${this.cycleCount} completion to DynamoDB`);
      
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
        console.log(`📊 [CYCLE COST] Breakdown:`, JSON.stringify(apiUsage.stats, null, 2));
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
      'get_user_settings': '📋 Loading your search preferences and targeting criteria',
      'get_email_settings': '✉️ Loading email templates and branding settings',
      'apollo_search': `🔍 Searching for ${context.targetLeads || 'new'} qualified leads in your target industries`,
      'serper_research': `🔬 Researching ${context.currentLead?.company || 'company'} to personalize outreach`,
      'unlock_email': `🔓 Finding email address for ${context.currentLead?.name || 'contact'}`,
      'build_personalized_email': `✍️ Writing personalized email for ${context.currentLead?.name || 'lead'}${context.currentLead?.company ? ` at ${context.currentLead.company}` : ''}`,
      'queue_email': `📤 Scheduling email to ${context.currentLead?.name || 'contact'}`,
      'think': '💭 Analyzing next steps...',
      'complete': '✅ Finished processing leads'
    };
    
    return messages[action] || `⚙️ ${action}`;
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
      console.log('🔧 [OPENAI] Function call parameter:', JSON.stringify(functionCall));
      console.log('💰 [COST OPTIMIZATION] Using GPT-3.5-Turbo for routine decision making');
      
      // Single OpenAI call with reasoning and function calling - USE GPT-3.5 FOR ROUTINE DECISIONS
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
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
            model: 'gpt-3.5-turbo',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            rateLimitStatus: rateCheck.allowed ? 'within_limits' : 'exceeded'
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));

        // Warn if approaching or exceeding limits
        if (!rateCheck.allowed) {
          console.warn(`⚠️ OpenAI ${rateCheck.reason} rate limit exceeded: ${rateCheck.current}/${rateCheck.limit} tokens`);
        } else if (rateCheck.remaining) {
          const checkRemaining = (limit, type) => {
            if (limit !== null && limit < 1000) {
              console.warn(`⚠️ OpenAI ${type} limit approaching: ${limit} tokens remaining`);
            }
          };
          checkRemaining(rateCheck.remaining.hourly, 'hourly');
          checkRemaining(rateCheck.remaining.daily, 'daily');
          checkRemaining(rateCheck.remaining.monthly, 'monthly');
        }
      }
      
      console.log('🔧 [OPENAI] Response has function_call:', !!response.choices[0].message.function_call);

      const message = response.choices[0].message;
      
      if (message.function_call) {
        // Extract reasoning from the content (even with function calls, GPT can provide reasoning)
        const reasoning = message.content || `Decided to call ${message.function_call.name}`;
        
        console.log('🧠 [DECISION] Agent decided to use tool:', message.function_call.name);
        console.log('🤔 [THINKING] Agent reasoning:', reasoning);
        
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
            console.log('✅ [FALLBACK] Using empty parameters for build_personalized_email');
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
      console.log('🔧 [FUNCTION CALL] Forcing get_user_settings');
      return { name: 'get_user_settings' };
    }
    
    if (!context.hasEmailSettings) {
      console.log('🔧 [FUNCTION CALL] Forcing get_email_settings');
      return { name: 'get_email_settings' };
    }
    
    if (context.cycleComplete) {
      console.log('🔧 [FUNCTION CALL] Cycle complete, allowing natural completion');
      return 'none'; // Let agent complete naturally
    }
    
    if (context.processingPhase === 'paused') {
      console.log('🔧 [FUNCTION CALL] Agent is paused, stopping execution');
      return 'none'; // Don't execute any functions when paused
    }
    
    // Force sequential processing based on phase
    console.log(`🔧 [FUNCTION CALL] Phase: ${context.processingPhase}, Current Lead: ${context.currentLead ? 'YES' : 'NO'}`);
    console.log(`🔧 [DEBUG] Full context processingPhase: '${context.processingPhase}'`);
    
    switch (context.processingPhase) {
      case 'search':
        if (!context.currentLead && (context.leadQueue.length === 0)) {
          console.log('🔧 [FUNCTION CALL] Forcing apollo_search - no current lead and queue is empty');
          return { name: 'apollo_search' };
        }
        break;
        
      case 'pre-qualify':
        if (context.currentLead) {
          console.log('🔧 [FUNCTION CALL] Forcing pre_qualify_lead');
          return { name: 'pre_qualify_lead' };
        }
        break;
        
      case 'research':
        if (context.currentLead) {
          console.log('🔧 [FUNCTION CALL] Forcing serper_research');
          return { name: 'serper_research' };
        }
        break;
        
      case 'qualify':
        if (context.currentLead) {
          console.log('🔧 [FUNCTION CALL] Forcing qualify_lead');
          return { name: 'qualify_lead' };
        }
        break;
        
      case 'email':
        if (context.currentLead) {
          // Skip unlock if email already exists (enriched during search)
          if (context.currentLead.email) {
            console.log('🔧 [FUNCTION CALL] Email already exists, skipping to build_personalized_email');
            return { name: 'build_personalized_email' };
          }
          console.log('🔧 [FUNCTION CALL] Forcing unlock_email');
          return { name: 'unlock_email' };
        }
        break;
        
      case 'build':
        if (context.currentLead) {
          console.log('🔧 [FUNCTION CALL] Forcing build_personalized_email');
          console.log(`🔧 [DEBUG] Build phase - lead has email: ${!!context.currentLead.email}`);
          return { name: 'build_personalized_email' };
        } else {
          console.log('🔧 [DEBUG] Build phase but no current lead!');
        }
        break;
    }
    
    console.log('🔧 [FUNCTION CALL] Defaulting to auto');
    return 'auto'; // Fallback to auto
  }

  // Update cycle state after each action
  async updateCycleState(action, actionResult) {
    console.log(`📊 [CYCLE] Updating state after action: ${action}`);
    
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
                console.log(`🔧 [COMPANY FIX] Generic name "${lead.organization.name}" replaced with domain-based "${companyName}"`);
              }
            }
            
            const normalizedLead = {
              ...lead,
              company: companyName
            };
            this.memory.currentCycle.leadQueue.push(normalizedLead);
          });
          
          console.log(`🔍 [CYCLE] Added ${actionResult.leads.length} leads to queue. Queue size: ${this.memory.currentCycle.leadQueue.length}`);
          
          // Start processing the first lead from queue
          if (this.memory.currentCycle.leadQueue.length > 0 && !this.memory.currentCycle.currentLead) {
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            // Always start with research (Apollo just gave us names, we need Serper data)
            this.memory.currentCycle.processingPhase = 'research';
            const domain = this.memory.currentCycle.currentLead.organization?.primary_domain;
            console.log(`📋 [QUEUE] Processing lead: ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}${domain ? ` (${domain})` : ''}`);
            
            // Broadcast location update immediately when starting first lead
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `🎯 Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast first lead activity:', err.message);
            });
          }
        } else {
          // No new leads found - increment duplicate counter
          this.memory.consecutiveDuplicateSearches++;
          console.log(`🔄 [DUPLICATE TRACKING] Consecutive duplicate searches: ${this.memory.consecutiveDuplicateSearches}`);
          
          // After 3 consecutive duplicate searches, broaden criteria
          if (this.memory.consecutiveDuplicateSearches >= 3) {
            console.log(`⚠️ [SEARCH ADAPTATION] Too many duplicates (${this.memory.consecutiveDuplicateSearches}), broadening search criteria...`);
            
            // Increase page offset to search deeper pages
            this.memory.searchPageOffset += 5;
            console.log(`📄 [SEARCH ADAPTATION] Increasing page offset to ${this.memory.searchPageOffset} (will search pages ${this.memory.searchPageOffset + 1}-${this.memory.searchPageOffset + 10})`);
            
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
            console.log(`🔄 [CYCLE] Need ${totalLeadsNeeded - currentLeadCount} more NEW leads - continuing search (current: ${currentLeadCount}/${totalLeadsNeeded})`);
            
            // Stay in search phase to keep looking for more NEW leads
            this.memory.currentCycle.processingPhase = 'search';
          } else {
            console.log(`✅ [CYCLE] Have enough leads (${currentLeadCount}/${totalLeadsNeeded}) - completing cycle`);
            this.memory.currentCycle.cycleComplete = true;
            this.memory.currentCycle.processingPhase = 'complete';
          }
        }
        break;
        
      case 'pre_qualify_lead':
        if (actionResult?.success) {
          if (actionResult.recommendation === 'SKIP') {
            // Pre-qualification failed, skip lead and get next
            console.log(`❌ [CYCLE] Pre-qualification failed (score: ${actionResult.score}/100), skipping lead`);
            this.memory.currentCycle.currentLead = null;
            
            // Get next lead from queue or search for more
            if (this.memory.currentCycle.leadQueue.length > 0) {
              this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
              this.memory.currentCycle.processingPhase = 'research';
              console.log(`📋 [QUEUE] Next lead from queue: ${this.memory.currentCycle.currentLead.name}`);
              
              // Broadcast location update for skipped lead replacement
              this.broadcastAgentActivity({
                agentId: this.agentId,
                operation: '💭 Agent Activity',
                details: `🎯 Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
                status: 'active',
                timestamp: new Date()
              }).catch(err => {
                console.error('⚠️ [SSE] Failed to broadcast skipped lead replacement:', err.message);
              });
            } else {
              this.memory.currentCycle.processingPhase = 'search';
              console.log(`🔍 [CYCLE] Queue empty, searching for more leads`);
            }
          } else {
            // Pre-qualification passed, proceed to detailed qualification
            this.memory.currentCycle.processingPhase = 'qualify';
            console.log(`✅ [CYCLE] Pre-qualification passed (score: ${actionResult.score}/100), proceeding to detailed qualification`);
          }
        }
        break;
      
      case 'serper_research':
        if (actionResult?.success) {
          // Research complete, move to pre-qualification ONLY if we have criteria to check
          const hasCriteria = this.campaignPlan?.qualificationCriteria?.mustHave?.length > 0 ||
                             this.campaignPlan?.qualificationCriteria?.disqualifiers?.length > 0;
          
          this.memory.currentCycle.processingPhase = hasCriteria ? 'pre-qualify' : 'email';
          
          if (!hasCriteria && this.campaignPlan) {
            console.log(`⏭️ [CYCLE] Skipping pre-qualification - no criteria to check`);
          }
          console.log(`📚 [CYCLE] Research completed for ${this.memory.currentCycle.currentLead?.name}`);
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
          
          console.log('🔍 [AI REPORT DEBUG] Stored in currentQualification:', {
            hasAiReport: !!actionResult.aiReport,
            tier: actionResult.aiReport?.tier,
            score: actionResult.aiReport?.score,
            citedEvidence: actionResult.aiReport?.citedEvidence?.length || 0
          });
          
          if (actionResult.qualified) {
            // Qualification passed, check if we need email unlock or can skip to build
            if (this.memory.currentCycle.currentLead?.email) {
              console.log(`✅ [CYCLE] Lead qualified (score: ${actionResult.score}/100) - email already available, proceeding to build`);
              this.memory.currentCycle.processingPhase = 'build';
            } else {
              this.memory.currentCycle.processingPhase = 'email';
              const confidenceNote = actionResult.confidence === 'LOW' ? ' ⚠️ LOW CONFIDENCE - will mark for review' : '';
              console.log(`✅ [CYCLE] Lead qualified (score: ${actionResult.score}/100)${confidenceNote}, proceeding to email unlock`);
            }
          } else {
            // Qualification failed, skip lead and get next
            console.log(`❌ [CYCLE] Lead disqualified (score: ${actionResult.score}/100), skipping lead`);
            this.memory.currentCycle.currentLead = null;
            
            // Get next lead from queue or search for more
            if (this.memory.currentCycle.leadQueue.length > 0) {
              this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
              this.memory.currentCycle.processingPhase = 'research';
              console.log(`📋 [QUEUE] Next lead from queue: ${this.memory.currentCycle.currentLead.name}`);
              
              // Broadcast location update for disqualified lead replacement
              this.broadcastAgentActivity({
                agentId: this.agentId,
                operation: '💭 Agent Activity',
                details: `🎯 Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
                status: 'active',
                timestamp: new Date()
              }).catch(err => {
                console.error('⚠️ [SSE] Failed to broadcast disqualified lead replacement:', err.message);
              });
            } else {
              this.memory.currentCycle.processingPhase = 'search';
              console.log(`🔍 [CYCLE] Queue empty, searching for more leads`);
            }
          }
        }
        break;
        
      case 'unlock_email':
        console.log(`🔧 [DEBUG] unlock_email success check: success=${actionResult?.success}, email=${!!actionResult?.email}`);
        
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
                console.log(`🔧 [COMPANY FIX] Generic enriched name "${actionResult.person.organization.name}" replaced with "${companyName}"`);
              }
            }
            
            this.memory.currentCycle.currentLead.company = companyName;
            this.memory.currentCycle.currentLead.organization = actionResult.person.organization;
            console.log(`🏢 [CYCLE] Updated company name from enriched data: ${companyName}`);
          }
          
          this.memory.currentCycle.processingPhase = 'build';
          console.log(`🔓 [CYCLE] Email unlocked for ${this.memory.currentCycle.currentLead?.name}: ${actionResult.email}`);
          console.log(`🔧 [DEBUG] Set processingPhase to 'build' after unlock - NEW PHASE: ${this.memory.currentCycle.processingPhase}`);
          console.log(`🔧 [DEBUG] Current lead after unlock:`, this.memory.currentCycle.currentLead?.name, 'has email:', !!this.memory.currentCycle.currentLead?.email);
    
        } else {
          // Email unlock failed, skip this lead and get next from queue or search
          console.log(`⚠️ [CYCLE] Email unlock failed for ${this.memory.currentCycle.currentLead?.name}, skipping lead`);
          console.log(`🔧 [DEBUG] Failure reason: success=${actionResult?.success}, email=${actionResult?.email}, error=${actionResult?.error}`);
          
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
            console.log('📝 [ISSUES] Logged email unlock failure to issues database');
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
            console.log('📝 [CONTACT TRACKING] Added failed email unlock to contacted database to prevent duplicates');
          } catch (trackingError) {
            console.error('❌ [CONTACT TRACKING] Failed to add failed lead to database:', trackingError);
          }
          
          this.memory.currentCycle.currentLead = null;
          
          if (this.memory.currentCycle.leadQueue.length > 0) {
            // Get next lead from queue
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
            console.log(`📋 [QUEUE] Processing next lead after failure: ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`);
            
            // Broadcast location update for lead after email unlock failure
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `🎯 Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast lead after failure:', err.message);
            });
          } else {
            // Queue empty, need to search for more leads
            this.memory.currentCycle.processingPhase = 'search';
            console.log(`🔍 [CYCLE] Queue empty after failure, searching for more leads`);
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
            console.log(`📋 [QUEUE] Processing next lead: ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`);
            
            // Broadcast location update immediately when starting new lead
            this.broadcastAgentActivity({
              agentId: this.agentId,
              operation: '💭 Agent Activity',
              details: `🎯 Starting research on ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`,
              status: 'active',
              timestamp: new Date()
            }).catch(err => {
              console.error('⚠️ [SSE] Failed to broadcast new lead activity:', err.message);
            });
          } else if (this.memory.currentCycle.leadsProcessed < this.memory.currentCycle.targetLeads) {
            // Need more leads - search again
            this.memory.currentCycle.processingPhase = 'search';
            console.log(`🔍 [CYCLE] Queue empty, need ${this.memory.currentCycle.targetLeads - this.memory.currentCycle.leadsProcessed} more leads`);
          } else {
            // Cycle complete
            this.memory.currentCycle.processingPhase = 'complete';
            console.log(`🏁 [CYCLE] Cycle complete! Processed ${this.memory.currentCycle.leadsProcessed} leads`);
          }
          
          console.log(`✉️ [CYCLE] Email built! Leads processed: ${this.memory.currentCycle.leadsProcessed}/${this.memory.currentCycle.targetLeads}, Queue: ${this.memory.currentCycle.leadQueue.length}`);
        }
        break;
        
      case 'pause':
        console.log('⏸️ [CYCLE] Agent paused due to error');
        this.memory.currentCycle.processingPhase = 'paused';
        break;
        
      case 'complete':
        console.log('🏁 [CYCLE] Cycle marked complete');
        this.memory.currentCycle.processingPhase = 'complete';
        this.memory.currentCycle.cycleComplete = true;
        break;
    }
    
    console.log(`📊 [CYCLE] Current state: ${this.memory.currentCycle.leadsProcessed}/${this.memory.currentCycle.targetLeads} leads, phase: ${this.memory.currentCycle.processingPhase}`);
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
      
      // Build context from settings
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

      console.log('🧠 [AI ANALYSIS] Analyzing research findings for:', companyName);
      console.log('� [PREMIUM MODEL] Using GPT-4 for high-quality research analysis');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
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
      console.log('✅ [AI ANALYSIS] Strategic analysis generated for:', companyName);
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'research_analysis',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-4',
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
    console.log('⚙️ [AWS] Getting user lead generation settings from DynamoDB...');
    
    try {
      // Get lead agent settings from AWS DynamoDB with agentId
      const leadContactSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      
      console.log('🔍 [DEBUG] Lead agent settings from AWS:', JSON.stringify(leadContactSettings, null, 2));
      
      if (!leadContactSettings) {
        console.log('❌ [SETTINGS] No lead agent settings found in AWS DynamoDB!');
        return { error: 'No lead agent settings configured for this user' };
      }

      // ALSO load general user settings to get company profile
      console.log('🏢 [AWS] Loading general user settings for company profile...');
      const generalUserSettings = await this.awsManager.getUserSettings(this.userId);
      console.log('🔍 [DEBUG] Company profile from general settings:', generalUserSettings?.companyProfile);
      
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
      
      console.log('✅ [SETTINGS] REAL lead generation settings:', {
        company: actualSettings.companyName,
        agent: actualSettings.agentName,
        service: actualSettings.primaryService,
        industries: actualSettings.companyIndustries?.length || 0,
        positions: actualSettings.targetPositions?.length || 0,
        companySize: `${actualSettings.companySizeMin}-${actualSettings.companySizeMax}`,
        locations: actualSettings.targetLocations?.length || 0,
        leadLimit: actualSettings.leadLimit
      });
      
      return actualSettings;
    } catch (error) {
      console.error('❌ [SETTINGS] Error getting lead agent settings:', error);
      return { error: error.message };
    }
  }

  // Get email builder settings from AWS DynamoDB - lead agent settings
  async getEmailSettings() {
    console.log('📧 [AWS] Getting email builder settings from DynamoDB...');
    
    try {
      // Use the same method to get lead agent settings (includes email builder) with agentId
      const leadContactSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      
      console.log('🔍 [DEBUG] Lead agent settings for email from AWS:', JSON.stringify(leadContactSettings, null, 2));
      
      if (!leadContactSettings) {
        console.log('❌ [EMAIL SETTINGS] No lead agent settings found!');
        return { error: 'No lead agent settings configured for this user' };
      }
      
      // Extract REAL email builder settings
      const emailBuilder = leadContactSettings.emailBuilder;
      
      if (!emailBuilder) {
        console.log('❌ [EMAIL SETTINGS] No emailBuilder found in lead agent settings!');
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
      
      console.log('✅ [EMAIL SETTINGS] REAL email builder settings:', {
        template: actualEmailSettings.emailTemplate,
        tone: actualEmailSettings.tone,
        personalization: actualEmailSettings.personalization,
        callToAction: actualEmailSettings.callToAction,
        hasCustomPrompt: !!actualEmailSettings.customPrompt,
        hasCcEmails: !!emailBuilder.ccEmails,
        ccEmails: emailBuilder.ccEmails,
        hasBccEmails: !!emailBuilder.bccEmails,
        bccEmails: emailBuilder.bccEmails
      });
      
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
    
    console.log(`🎯 [PRE-QUALIFY] Quick check: ${personName} at ${companyName}`);
    
    try {
      // If no campaign plan, skip pre-qualification (accept everyone)
      if (!this.campaignPlan || !this.campaignPlan.qualificationCriteria) {
        console.log('📋 [PRE-QUALIFY] No campaign plan, accepting lead');
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
        
        console.log(`📚 [PRE-QUALIFY] Extracted ${allOrganicResults.slice(0, 5).length} organic results from ${researchData.searches.length} searches (${researchSummary.length} chars)`);
      } else {
        console.log(`⚠️ [PRE-QUALIFY] No Serper organic results available from ${researchData?.searches?.length || 0} searches`);
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
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'pre_qualification',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-3.5-turbo',
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
      
      this.logOperation(`${emoji} Pre-Check: ${personName}`, 
        `${result.recommendation === 'SKIP' ? 'Skipped' : 'Passed'} (${result.score}/100) ${confidenceEmoji} - ${result.reason}`, 
        result.recommendation === 'SKIP' ? 'warning' : (confidence === 'LOW' ? 'warning' : 'completed'),
        { 
          score: result.score, 
          company: companyName,
          confidence: confidence,
          criteriaVerified: criteriaVerified,
          criteriaMissing: criteriaMissing
        }
      );
      
      console.log(`${emoji} [PRE-QUALIFY] Score: ${result.score}/100 - ${result.recommendation} - ${confidenceEmoji}`);
      console.log(`💭 [PRE-QUALIFY] Reason: ${result.reason}`);
      console.log(`📊 [PRE-QUALIFY] Verified ${criteriaVerified}/${criteria.mustHave?.length || 0} must-have criteria`);
      
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
    
    const personName = leadData?.name || 'Unknown';
    const companyName = leadData?.organization?.name || leadData?.company || 'Unknown Company';
    
    console.log(`📊 [QUALIFY] Tiered evaluation: ${personName} at ${companyName}`);
    
    try {
      // If no campaign plan, use default qualification (SHOTGUN tier)
      if (!this.campaignPlan || !this.campaignPlan.qualificationCriteria) {
        console.log('📋 [QUALIFY] No campaign plan, defaulting to SHOTGUN tier');
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
  "emailStrategy": "deep personalization" | "moderate personalization" | "generic template" | "do not send"
}`;

      console.log('💰 [COST OPTIMIZATION] Using GPT-3.5-Turbo for tiered qualification (10x cheaper than GPT-4)');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-1106',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Log tier assignment
      console.log(`📊 [QUALIFY] Result: ${result.tier} (Score: ${result.score}/100)`);
      console.log(`   Strategy: ${result.emailStrategy}`);
      console.log(`   Evidence: ${result.citedEvidence?.length || 0} cited facts`);
      
      // Log API usage
      if (response.usage) {
        await this.awsManager.logApiUsage({
          userId: this.userId,
          agentId: this.agentId,
          service: 'openai',
          operation: 'tiered_qualification',
          usage: response.usage.total_tokens,
          metadata: {
            model: 'gpt-3.5-turbo-1106',
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
      
      console.log(`✅ [QUALIFY] AI Report generated with ${aiReport.citedEvidence.length} evidence items`);
      
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
        `Tier: ${result.tier} (${result.score}/100) ${confidenceEmoji}`,
        `💭 ${result.reasoning}${result.buyerMotivation && result.buyerMotivation !== 'Not articulated' ? ' Buyer motivation: ' + result.buyerMotivation : ''}`,
        `📧 Strategy: ${result.emailStrategy}`,
        result.keyStrengths?.length > 0 ? `💪 Strengths: ${result.keyStrengths.join(', ')}` : null,
        result.weaknesses?.length > 0 ? `⚠️ Concerns: ${result.weaknesses.join(', ')}` : null,
        `📚 Evidence: ${aiReport.citedEvidence.length} cited facts from ${aiReport.totalSources} sources`
      ].filter(Boolean).join(' • ');
      
      this.logOperation(`${emoji} Qualification: ${personName}`, 
        detailsSummary, 
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
      
      console.log(`${emoji} [QUALIFY] Tier: ${result.tier} - Score: ${result.score}/100 - ${confidenceEmoji}`);
      console.log(`📊 [QUALIFY] Research Quality: ${aiReport.researchQuality} (${allCitedFacts.length} cited facts)`);
      console.log(`💭 [QUALIFY] Reasoning: ${result.reasoning}`);
      console.log(`📧 [QUALIFY] Email Strategy: ${result.emailStrategy}`);
      console.log(`💪 [QUALIFY] Strengths: ${result.keyStrengths?.join(', ')}`);
      if (result.weaknesses?.length > 0) {
        console.log(`⚠️ [QUALIFY] Weaknesses: ${result.weaknesses.join(', ')}`);
      }
      
      return {
        success: true,
        qualified: result.qualified,
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
    
    console.log('🔍 [SERPER] Starting intelligent research for:', personName, 'at', companyName);
    
    try {
      // Get agent personality for research approach
      const personality = await this.getAgentPersonality();
      const personalityType = personality?.type || 'hunter';
      
      // Multi-search strategy: Run multiple targeted searches to verify qualification criteria
      const allResearchData = {
        searches: [],
        combinedFindings: []
      };
      
      if (!parameters.searchQuery && this.campaignPlan && this.campaignPlan.qualificationCriteria) {
        console.log(`🎯 [RESEARCH STRATEGY] Running deep research with ${personalityType} personality`);
        
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
        
        // Execute searches and fetch webpages
        console.log(`🔍 [DEEP RESEARCH] Running ${searchQueries.length} searches + fetching top 3 webpages each`);
        
        // Import webpage fetcher
        const { fetchMultipleWebpages } = await import('../tools/webpageFetcher.js');
        
        for (const search of searchQueries) {
          console.log(`🔎 [${search.purpose.toUpperCase()}] ${search.description}`);
          console.log(`   Query: "${search.query}"`);
          
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
            
            console.log(`   📄 Fetching ${topUrls.length} webpages...`);
            
            // Fetch webpage content
            const webpageContents = await fetchMultipleWebpages(topUrls, 3);
            
            // Extract relevant insights from each webpage using AI
            const webpageInsights = [];
            for (const webpage of webpageContents) {
              if (webpage.success && webpage.content) {
                try {
                  // Use GPT-4 to extract only relevant business insights
                  const insightPrompt = `Extract ONLY the most relevant and impressive business facts about ${companyName} from this webpage content. Focus on:
- Recent achievements, growth, funding
- Key partnerships or clients
- Unique value propositions or innovations
- Market position or awards
- Leadership or company culture highlights

Webpage: ${webpage.title}
Content: ${webpage.content}

Return 2-4 concise bullet points (max 50 words each) of the MOST impressive and relevant facts. Skip generic marketing fluff. Format as:
- [fact 1]
- [fact 2]
- [fact 3]`;

                  const insightResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini', // Use mini for cost efficiency on extraction
                    messages: [{ role: 'user', content: insightPrompt }],
                    temperature: 0.3,
                    max_tokens: 300
                  });
                  
                  const extractedInsights = insightResponse.choices[0].message.content;
                  
                  // Parse insights and attach source URL to each fact
                  const insightLines = extractedInsights.split('\n').filter(line => line.trim().startsWith('-'));
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
                  
                  console.log(`   ✅ Extracted insights from: ${webpage.title}`);
                  
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
            
            // Extract findings from snippets (keep for quick reference)
            if (results?.organic && results.organic.length > 0) {
              const findings = results.organic.slice(0, 3).map(r => ({
                snippet: r.snippet,
                title: r.title,
                purpose: search.purpose
              }));
              
              allResearchData.combinedFindings.push(...findings);
              console.log(`   ✅ Found ${findings.length} snippets + ${webpageInsights.length} deep insights`);
            } else {
              console.log(`   ⚠️ No results found`);
            }
            
            // Delay between searches
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (searchError) {
            console.error(`   ❌ Search failed: ${searchError.message}`);
          }
        }
        
        // Build comprehensive cited facts database
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
        
        console.log(`✅ [DEEP RESEARCH] Completed ${allResearchData.searches.length} searches with:`);
        console.log(`   - ${allResearchData.combinedFindings.length} search snippets`);
        console.log(`   - ${totalWebpageInsights} deep webpage insights`);
        console.log(`   - Total data sources: ${allResearchData.combinedFindings.length + totalWebpageInsights}`);
        
      } else {
        // Fallback: Single generic search
        const searchQuery = parameters.searchQuery || `${companyName} company information business model products services`;
        console.log('� [SERPER] Single search query:', searchQuery);
        
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
          console.log('📊 [SERPER] API usage logged');
        } catch (logError) {
          console.error('⚠️ [SERPER] Failed to log API usage:', logError);
        }
      }
      
      // Log detailed findings from allResearchData
      console.log('📊 [SERPER] Research Summary:');
      console.log(`   • Total searches conducted: ${allResearchData.searches.length}`);
      console.log(`   • Combined findings: ${allResearchData.combinedFindings.length}`);
      
      // Log top findings
      if (allResearchData.combinedFindings && allResearchData.combinedFindings.length > 0) {
        console.log('🎯 [SERPER] Top Research Findings:');
        allResearchData.combinedFindings.slice(0, 5).forEach((finding, index) => {
          console.log(`   ${index + 1}. ${finding.title || 'No title'}`);
          console.log(`      Purpose: ${finding.purpose}`);
          if (finding.snippet) {
            console.log(`      Snippet: ${finding.snippet.substring(0, 100)}...`);
          }
        });
      }
      
      console.log('✅ [SERPER] Research complete - Data logged above');
      
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
      return {
        success: false,
        error: error.message,
        companyName: parameters.companyName
      };
    }
  }

  // Unlock email using Apollo - WORKING ENRICH METHOD
  async unlockEmail(parameters) {
    console.log('🔐 [APOLLO] Unlocking email for:', parameters.firstName, parameters.lastName);
    console.log('🔐 [APOLLO] Parameters received:', {
      firstName: parameters.firstName,
      lastName: parameters.lastName,
      companyName: parameters.companyName,
      domain: parameters.domain || 'NOT PROVIDED ❌'
    });
    
    try {
      const apiKey = await this.getApiKey('apollo');
      console.log('🔍 [DEBUG] API key retrieved:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NULL');
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
        console.log('🌍 [APOLLO] Using domain-based search (global) instead of location filter');
      } else if (parameters.companyName) {
        // Use both keyword tags and organization name for better matching
        searchPayload.q_organization_keyword_tags = [parameters.companyName.toLowerCase()];
        searchPayload.q_organization_name = parameters.companyName;
      }

      console.log('🔍 [STEP 1] Searching for person with:', searchPayload);
      
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
      console.log('🔍 [STEP 1] Search results:', searchData.people?.length || 0, 'people found');
      
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
        console.log('⚠️ [STEP 1] No results with current search, trying fallback...');
        
        // FALLBACK 1: Try without domain filtering if we used a domain
        if (parameters.domain) {
          console.log('🔄 [FALLBACK] Retrying without domain filter (global search)...');
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
              console.log('✅ [FALLBACK] Found results without domain filter!');
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

      console.log(`🔍 [STEP 1] Target person: ${targetPerson.name} (ID: ${targetPerson.id})`);

      // STEP 2: Use enrich endpoint to unlock actual emails
      console.log('  [STEP 2] Enriching person to unlock emails...');
      
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
      console.log('🔓 [STEP 2] Enriched person data received');
      
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
        
        console.log(`📧 Work email: ${workEmail}`);
        console.log(`📧 Personal emails: ${personalEmails.join(', ')}`);
        console.log(`📊 [DEBUG] Email status/confidence:`, person.email_status, person.extrapolated_email_confidence);
        
        // Accept ANY email from Apollo, including constructed/guessed emails
        // The bounce handler will validate if they're real
        const allEmails = [workEmail, ...personalEmails].filter(email => {
          return email && 
                 email.trim() !== '' && 
                 !email.includes('email_not_unlocked') &&
                 email.includes('@'); // Basic email format check
        });
        
        console.log(`📊 [DEBUG] Filtered emails count: ${allEmails.length}`);
        if (allEmails.length > 0) {
          console.log(`📊 [DEBUG] First email to use: ${allEmails[0]}`);
        }
        
        // Validate email with ZeroBounce before accepting (non-blocking)
        const emailToValidate = allEmails[0]; // Use first available email
        if (emailToValidate) {
          console.log(`🔍 [ZEROBOUNCE] Validating email: ${emailToValidate}`);
          const zeroBounceResult = await this.validateEmailWithZeroBounce(emailToValidate);
          
          // Only reject if ZeroBounce says it's spamtrap or do_not_mail (accept catch-all and unknown)
          if (['spamtrap', 'do_not_mail'].includes(zeroBounceResult.status?.toLowerCase())) {
            console.log(`❌ [ZEROBOUNCE] Email rejected: ${zeroBounceResult.status} - ${zeroBounceResult.reason}`);
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
          
          console.log(`✅ [ZEROBOUNCE] Email validation: ${zeroBounceResult.status} (accepted)`);
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
        console.log('⚠️ [ZEROBOUNCE] API key not found, skipping validation');
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
    console.log('📝 [EMAIL BUILDER] Creating adaptive personalized email...');
    
    try {
      // Get data from current cycle state instead of parameters
      const leadData = this.memory.currentCycle.currentLead;
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
      
      console.log(`📊 [EMAIL BUILDER] Using ${tier} tier strategy: ${aiReport?.emailStrategy || 'generic template'}`);
      
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
        
        console.log(errorMsg);
        console.log(`   Lead: ${leadData.first_name} ${leadData.last_name} at ${companyName}`);
        console.log(`   Motivation provided: ${buyerMotivation || 'NONE'}`);
        
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
      
      console.log(`✅ [BUYER MOTIVATION VALIDATED] ${buyerMotivation.substring(0, 100)}...`);
      console.log(`   This motivation will guide email personalization strategy`);
      
      // Extract cited facts for personalization
      let citedFactsContext = '';
      if (aiReport?.allCitedFacts && aiReport.allCitedFacts.length > 0) {
        const topFacts = aiReport.allCitedFacts.slice(0, 10);
        citedFactsContext = `\nVERIFIED RESEARCH FACTS (use these for personalization):\n${
          topFacts.map((fact, i) => `${i + 1}. "${fact.text}" [Source: ${fact.sourceTitle || fact.source}]`).join('\n')
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

EMAIL LENGTH: 7-9 sentences (more room for detailed personalization)`;
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
        
        console.log('🎯 [EMAIL] Using campaign-specific messaging strategy');
      }
      
      // Add qualification strengths if available (from qualify_lead tool)
      let qualificationInsights = '';
      if (this.memory.currentQualification?.keyStrengths && this.memory.currentQualification.keyStrengths.length > 0) {
        qualificationInsights = `
LEAD QUALIFICATION INSIGHTS (lead with these strengths):
${this.memory.currentQualification.keyStrengths.map(s => `- ${s}`).join('\n')}
Score: ${this.memory.currentQualification.score}/100`;
        
        console.log('💪 [EMAIL] Incorporating qualification strengths into email');
      }
      
      // Add BUYER MOTIVATION context (validated above - this is CRITICAL)
      const buyerMotivationContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 BUYER-SIDE MOTIVATION (USE THIS TO GUIDE YOUR EMAIL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${buyerMotivation}

Your email MUST connect to this motivation. This is not generic - this is the specific,
evidence-based reason WHY this person would buy from us RIGHT NOW. Use this to:
✓ Frame your opening hook around their current situation
✓ Connect your solution to their immediate needs/timeline
✓ Create urgency based on their actual business context
✓ Demonstrate you understand their strategic priorities

DO NOT write generic emails. Use this buyer motivation to show sophisticated understanding.`;
      
      console.log('🎯 [EMAIL] Incorporating validated buyer motivation into email context');
      
      // Common ruleset for email structure - ALWAYS include lead details and context
      const commonRuleset = `
PROSPECT INFORMATION:
Company: ${companyName}
Contact: ${leadData.first_name} ${leadData.last_name}
Title: ${contactTitle}
Industry: ${industry}
Employee Count: ${employeeCount} employees${citedFactsContext}${qualificationInsights}${campaignStrategy}

YOUR SOLUTION:
Product/Service: ${emailSettings.companyBranding?.primaryService || 'Business solutions and services'}
Key Benefits: ${emailSettings.companyBranding?.keyAdvantages || 'Improved efficiency, streamlined operations, better results'}
Company: ${emailSettings.companyBranding?.companyName || 'Our Company'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY-DRIVEN EMAIL STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on YOUR personality above, adapt your approach:

🎯 THE HUNTER (high-energy, results-driven):
- Lead with ROI/savings when financial data available
- Subject lines: "Save X% on [specific thing]" or "Quick call this week?"
- Get straight to value in sentence 1
- Use direct CTAs: "Worth 15 minutes?" not "Would you be interested in exploring..."
- Create urgency without being pushy

💙 RELATIONSHIP BUILDER (warm, consultative):
- Ask questions instead of pitching immediately  
- Subject lines: "Question about [their company]'s [initiative]" or "Curious about your approach to [X]"
- Show genuine interest in their work
- Softer CTAs: "Curious if this fits your strategy?" or "Would love to learn more about..."
- Build rapport first, sell second

📊 ANALYST (data-driven, research-heavy):
- Lead with specific data/insights from research
- Subject lines: "Quick insight on [their industry]" or "Data on [specific challenge]"
- Use numbers and concrete findings
- Evidence-based recommendations
- CTA should feel consultative: "Happy to share the research" or "Can walk you through the data"

🧠 CONSULTANT (advisory, solution-focused):
- Position as strategic peer, not vendor
- Subject lines: "Strategic thought on [their challenge]" or "Solving [specific problem]"
- Frame from their business perspective
- Offer insights/guidance tone
- CTA: "Happy to outline the approach" or "Can share how others solved this"

🌐 NETWORKER (social, connection-based):
- Reference connections, social proof, community
- Subject lines: "Working with [similar company]" or "[Mutual connection] suggested I reach out"
- Use conversational, friendly tone
- Leverage LinkedIn, mutual contacts
- CTA: "Mind if I share what's working?" or "Quick intro?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH-DRIVEN APPROACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 - ANALYZE YOUR RESEARCH DATA:
Look at the research above. What's your BEST hook?

Priority order:
1. 💰 Financial data (revenue, funding, growth %) → Lead with ROI/savings angle
2. 🔥 Pain point/challenge mentioned → Open with the problem
3. 📰 Recent news (funding, hiring, expansion) → Timely relevance
4. 🛠️ Tech stack/process info → Consultative insight
5. 📈 Growth indicators → Scale/efficiency angle
6. 🤷 Nothing specific? → Direct value prop

STEP 2 - CRAFT SUBJECT LINE:
Choose ONE of these proven high-open-rate patterns with proper capitalization and grammar:

Pattern A - Value/Urgency: "Save [X]% on [their specific challenge]" OR "Cut [process] time by [X]%" OR "Reduce [their pain point] costs"
Pattern B - Direct question: "Have time for a quick call?" OR "Quick chat this week?" OR "15 minutes to discuss [specific topic]?"
Pattern C - Personal research: "Quick question about [specific thing from research]" OR "Saw [their recent news/achievement]" OR "Question about [their company]'s [specific initiative]"
Pattern D - Name drop: "Working with [similar company] on [relevant topic]" OR "[Competitor/peer company] mentioned you"

SUBJECT LINE RULES:
- Use proper Title Case or Sentence case (NO all lowercase)
- Keep under 50 characters
- NO generic pitches like "Transforming X with Y" or "Your Next Strategic Move"
- NO name followed by dash format (NO "Filip - ...")
- Be specific using research data, not vague
- The email body MUST match what the subject line promises

STEP 3 - WRITE EMAIL BODY (7 SENTENCES - MAKE EVERY WORD COUNT):

Write a natural, flowing email that feels like a real person researched them and has something genuinely valuable to say. Don't follow a rigid formula - let the conversation flow based on what you learned about them.

YOUR MISSION: Use the research to show you understand their business, then explain how your solution solves their specific problem with concrete proof.

OPENING (1-2 sentences):
Start with something that proves you did homework. Use a specific number, recent news, or insight about their company. Make it conversational, not robotic.

Examples of good openings:
- "Noticed you just crossed $50M ARR - congrats. At that scale, most SaaS companies start drowning in contractor payments."
- "Saw you're hiring 3 product managers this quarter. That's when coordination overhead usually kills velocity."
- "You're in the sweet spot at 150 employees where manual expense tracking costs about 40 hours a week."

TRANSITION TO PROBLEM (1-2 sentences):
Connect their situation to a specific pain point. Use numbers to show the real cost. Don't guess - either cite research or use industry benchmarks.

Examples:
- "Companies at your size typically waste 35% of finance bandwidth just processing contractor invoices."
- "Teams your scale report 15-20 hours weekly lost to process bottlenecks between departments."
- "At 150 people, expense approval loops average 4.2 days - that's killing your burn rate visibility."

VALUE PROPOSITION (2-3 sentences):
Explain HOW your solution fixes this. Be specific about the mechanism and the outcome. Include social proof with real numbers.

Examples:
- "We automate the entire contractor payment workflow. TechCorp processed 500 contractors without adding finance headcount, cutting processing time from 3 days to 4 hours."
- "Our coordination layer sits between your tools and eliminates 90% of the back-and-forth. Notion went from 2-week feature cycles to 4-day sprints."
- "Real-time expense tracking dashboard cuts approval time to under 6 hours. Stripe reduced month-end close from 12 days to 3."

CLOSE WITH TIMING + CTA (1-2 sentences):
Connect to their current situation (growth, funding, expansion, hiring) and why acting now matters. End with a simple, personality-appropriate ask.

Examples:
- "Given your hiring pace, this gets more painful every quarter. Worth 15 minutes to walk through the numbers?"
- "Post-Series B is when this typically becomes a board-level concern. Want to see how others solved it?"
- "You'll hit 200 people in Q2 based on your job posts - that's when this breaks completely. Quick call to map it out?"

WRITING GUIDELINES:

DO:
✅ Write like you're explaining to a smart friend over coffee
✅ Use specific numbers from research or industry benchmarks
✅ Name drop similar companies with real outcomes
✅ Connect their current stage/situation to the solution timing
✅ Make the value proposition crystal clear: "We do X, which saves Y, proven by Z"
✅ Let sentences flow naturally into each other

DON'T:
❌ Follow a rigid sentence formula (this makes it sound like AI)
❌ Use generic praise ("impressive company", "innovative work")
❌ Include buzzwords without meaning ("transformative", "revolutionary", "cutting-edge")
❌ Make vague claims ("we can help you", "solutions for your needs")
❌ Sound like you're reading a script
❌ Repeat the same sentence structure over and over

RESEARCH-DRIVEN PRIORITY:
1. Financial data (revenue, funding, growth rate) → Lead with ROI angle
2. Pain point from tech stack/process → Open with the problem
3. Recent news (funding round, expansion, hiring) → Timely relevance hook
4. Company stage/size benchmarks → Industry insight angle
5. Nothing specific? → Direct value prop with social proof

VALUE PROPOSITION DEPTH:
Don't just say "we help with X" - explain the mechanism and prove the outcome:

Shallow: "We help companies manage contractors better."
Deep: "We automate contractor payment workflows. TechCorp processes 500 contractors monthly without finance headcount, cutting 3-day cycles to 4 hours. That's 120 hours back per month."

Shallow: "We improve team coordination."
Deep: "Our system eliminates 90% of tool-switching overhead. Notion's product team went from 2-week feature cycles to 4-day sprints by connecting their scattered tools into one workflow."

Shallow: "We provide expense tracking solutions."
Deep: "Real-time expense dashboard with instant approval flows. Stripe cut month-end close from 12 days to 3 by catching issues as they happen instead of reconciling 30 days later."

MAKE THE CONNECTION OBVIOUS:
Always connect three dots:
1. Their current state (from research)
2. The specific problem that causes
3. How your solution fixes it (with proof)

Example full email flow:
"You're at 250 employees based on LinkedIn - that's exactly when contractor payments start consuming 35% of finance team bandwidth. Most companies your size process 200-300 contractor invoices monthly, and each one takes 45 minutes on average with all the back-and-forth.

We built an automation layer that handles the entire workflow. Stripe scaled from 100 to 500 contractors without adding finance headcount, cutting processing time from 3 days to under 4 hours per batch. They're saving about 120 hours monthly.

Given your growth rate (30% YoY based on funding), you'll add another 75 people by Q3. That pushes you into the 300+ contractor range where this becomes a board-level concern. Worth 15 minutes to walk through how they did it?"

LENGTH: Target 7 sentences, but let it flow naturally. If you need 6 or 8 to make your point clearly, that's fine. Quality beats formula.
- Talking about yourself instead of their problems
- Wasting sentences on fluff

EXAMPLES OF VALUE-DRIVEN 7-SENTENCE EMAILS:

Hunter: "Saw Codebridge raised $15M Series B and is scaling from 50 to 150 employees. At that growth rate, contractor payments typically become a 20-hour/week bottleneck for finance teams. We automate the entire workflow - approval, payment, compliance, and reconciliation in one system. Stripe scaled from 100 to 500 contractors without adding finance headcount using our platform. You're hiring 50+ people right now according to LinkedIn - that's exactly when this becomes critical. Most companies wait until it breaks, then spend 6 months fixing it. Worth a 15-minute call this week?"

Relationship Builder: "Noticed you're expanding into EU markets with your Q4 announcement. Companies making that move typically hit multi-currency compliance issues around month 3-4 that cost $50K-100K to sort out retroactively. We've built tools specifically for US companies entering EU that handle VAT, GDPR, and multi-currency automatically. One of your competitors avoided that entire mess by setting this up during expansion planning. You're about 2-3 months from when this usually becomes urgent based on your timeline. Happy to share the playbook we've built from 20+ companies doing exactly this. Quick chat to walk through it?"

Analyst: "Your Q3 report showed 200% revenue growth with a 35-person team. That ratio typically creates 25-30% cash flow gaps due to payment timing mismatches. We've analyzed this pattern across 150+ companies at your stage - the average impact is $200K-500K in working capital tied up unnecessarily. Our system cuts that by 60-70% by optimizing payment cycles and automating reconciliation. Given your growth velocity, you're likely 4-6 weeks from this becoming a board-level discussion. Want to see the financial model we've built? 20-minute call?"

Analyst: "Your Q3 report showed 200% growth in contract work. That growth rate typically creates 25-35% cash flow timing issues - we've tracked this across 100+ companies. Here's the pattern we're seeing."

Consultant: "Most Series B companies hit compliance bottlenecks around 75 employees - Codebridge is right at that threshold. The typical cost is $150K-300K in consulting fees plus 4-6 months of management distraction. We've mapped the exact pattern across 40+ companies at your stage and built automated compliance infrastructure. Two of your competitors used this to skip the entire mess and deploy resources elsewhere. You're about 8-12 weeks from when boards typically flag this as urgent. Want the compliance roadmap? It's a 25-minute walkthrough."

Networker: "We're helping Stripe and Deel with contractor payments at scale - they mentioned companies like Codebridge might be facing similar challenges. At 50+ contractors, the typical pain point is payment reconciliation eating 15-20 hours/week. We've built integrations that cut that to under 2 hours while handling 10x more volume. Given your growth trajectory, this becomes critical in the next quarter. Mind a quick intro to compare notes?"

FORMATTING:
Opening: Hello ${leadData.first_name},
Body: [7 sentences - every word must demonstrate value and connection to their situation]

SIGNATURE (CRITICAL - READ CAREFULLY):
You are NOT signing as "${personality.name || 'your personality'}". 
You are signing as: ${emailSettings.emailBuilder?.useCustomSignature ? (emailSettings.emailBuilder?.signatureName || 'Sales Representative') : (emailSettings.companyBranding?.agentName || 'AI Assistant')}

Signature format:
Best regards,
${emailSettings.emailBuilder?.useCustomSignature ? (emailSettings.emailBuilder?.signatureName || '') : (emailSettings.companyBranding?.agentName || 'AI Assistant')}
${emailSettings.emailBuilder?.useCustomSignature ? (emailSettings.emailBuilder?.signatureTitle || '') + (emailSettings.emailBuilder?.signatureTitle ? '\\n' : '') : ''}${emailSettings.companyBranding?.companyName || 'Our Company'}${!emailSettings.emailBuilder?.useCustomSignature ? ' ' + (emailSettings.companyBranding?.agentTitle || 'Representative') : ''}

Format as:
SUBJECT: [subject line]
BODY: [complete email with greeting, paragraph, and signature]

NOW WRITE YOUR EMAIL matching YOUR personality style above and EXPLICITLY connecting why your solution fits their situation.`;

      // ALWAYS combine personality prompt with common ruleset containing lead details + buyer motivation
      const emailPrompt = `${customPrompt}\n${commonRuleset}${buyerMotivationContext}`;

      console.log('💎 [PREMIUM MODEL] Using GPT-4 for high-quality email generation');
      console.log('📝 [EMAIL PROMPT] Full prompt being sent to GPT-4:');
      console.log('---START PROMPT---');
      console.log(emailPrompt);
      console.log('---END PROMPT---');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: emailPrompt }],
        temperature: 0.7,
        max_tokens: 600
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
            model: 'gpt-4',
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            companyName: companyName,
            leadName: contactName
          }
        }).catch(err => console.error('Failed to log OpenAI usage:', err));
      }
      
      console.log('📧 [GPT-4 RESPONSE] Email content received:');
      console.log('---START EMAIL---');
      console.log(emailContent);
      console.log('---END EMAIL---');
      
      // Extract subject and body if formatted properly
      let subject, body;
      if (emailContent.includes('SUBJECT:') && emailContent.includes('BODY:')) {
        const parts = emailContent.split('BODY:');
        subject = parts[0].replace('SUBJECT:', '').trim();
        body = parts[1].trim();
      } else {
        // Fallback subject generation
        subject = `Quick question about ${companyName}'s ${industry} strategy`;
        body = emailContent;
      }
      
      // Clean up body - remove any stray "SUBJECT:" prefix that AI might have included
      body = body.replace(/^SUBJECT:\s*[^\n]+\n\n?/i, '').trim();
      
      // Generate lead qualification confidence report
      console.log('🔍 [LEAD ANALYSIS] Generating confidence report...');
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

      console.log('📊 [LEAD CONFIDENCE]', confidenceReport);
      
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
      
      console.log('🎯 [CONFIDENCE LEVEL]', confidenceLevel);
      
      // Add legal compliance footer
      const { generateUnsubscribeToken } = await import('../routes/unsubscribe.js');
      const unsubscribeToken = generateUnsubscribeToken(leadData.email);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const unsubscribeUrl = `${frontendUrl}/unsubscribe?token=${unsubscribeToken}`;
      
      // Get company address from settings (use company profile)
      console.log('🔍 [DEBUG] Checking for company address in memory:');
      console.log('this.memory.userSettings?.companyProfile:', this.memory.userSettings?.companyProfile);
      console.log('this.memory.userSettings?.companyAddress:', this.memory.userSettings?.companyAddress);
      console.log('emailSettings.companyBranding?.companyAddress:', emailSettings.companyBranding?.companyAddress);
      
      const companyAddress = this.memory.userSettings?.companyProfile?.companyAddress || 
                            this.memory.userSettings?.companyAddress || 
                            emailSettings.companyBranding?.companyAddress ||
                            'Your Company Address';
      
      console.log('🏢 [ADDRESS] Final company address used:', companyAddress);
      
      // Minimal compliance footer - less promotional looking
      const footer = `\n\n${emailSettings.companyBranding?.companyName || 'Our Company'} | ${companyAddress}\n` +
        `<a href="${unsubscribeUrl}">Stop emails</a>`;
      
      body = body + footer;
      
      console.log('✅ [EMAIL BUILDER] Personalized email created with legal compliance footer');
      
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
    console.log('🔍 [APOLLO] Executing reasoned search:', parameters);
    
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
        console.log(`📋 [KEYWORD INIT] Extracted ${this.memory.baseIndustryKeywords.length} base keywords: ${this.memory.baseIndustryKeywords.join(', ')}`);
      }
      
      // STEP 1.5: Check if campaign specifies a priority industry to search first
      if (!this.memory.campaignPriorityKeyword && this.campaignPlan?.searchStrategy?.priorityIndustries?.length > 0) {
        // Extract first keyword from priority industry
        const priorityIndustry = this.campaignPlan.searchStrategy.priorityIndustries[0];
        this.memory.campaignPriorityKeyword = priorityIndustry.split(/\s*&\s*/)[0].trim().toLowerCase();
        this.memory.leadsFoundWithCurrentKeyword = 0;
        console.log(`🎯 [CAMPAIGN PRIORITY] Will search "${this.memory.campaignPriorityKeyword}" first (from campaign instructions)`);
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
        console.log(`🎯 [CAMPAIGN PRIORITY] Using campaign keyword "${selectedKeyword}" (active until >50% duplicates)`);
      } else {
        // Finished campaign priority OR no campaign priority set
        if (this.memory.campaignPriorityKeyword && this.memory.leadsFoundWithCurrentKeyword >= 999) {
          console.log(`✅ [CAMPAIGN PRIORITY] High duplicate rate with "${this.memory.campaignPriorityKeyword}", moving to rotation`);
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
          console.log(`❌ [ERROR] No keywords or positions available for search`);
          return { found: 0, leads: [], error: 'Industry keywords or positions not configured' };
        }
        
        // Check if we need to rotate to next pair (triggered by high duplicate rate)
        if (this.memory.leadsFoundWithCurrentKeyword >= 999) {
          this.memory.currentKeywordIndex++;
          this.memory.leadsFoundWithCurrentKeyword = 0;
          console.log(`🔄 [ROTATION] High duplicate rate detected, rotating to next keyword+position pair`);
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
          console.log(`🎯 [BASE PAIR] Keyword[${keywordIndex}]: "${selectedKeyword}" + Position[${selectedPositionIndex}]: "${basePositions[selectedPositionIndex]}" (offset: ${this.memory.cycleOffset})`);
        } else {
          // Use AI-generated keyword
          const aiIndex = keywordIndex - totalBaseKeywords;
          selectedKeyword = aiKeywords[aiIndex];
          keywordSource = 'ai';
          // Pair with matching AI position + cycle offset
          selectedPositionIndex = (aiIndex + this.memory.cycleOffset) % aiPositions.length;
          console.log(`🤖 [AI PAIR] Keyword[${aiIndex}]: "${selectedKeyword}" + Position[${selectedPositionIndex}]: "${aiPositions[selectedPositionIndex]}" (offset: ${this.memory.cycleOffset})`);
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
          await this.awsManager.saveAgentState(userSettings.userId, this.agentId, {
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
          
          console.log(`📡 [SSE] Broadcasting search update: ${selectedKeyword} + ${currentSearchPosition}`);
        }
        
        // STEP 2.5: Generate dynamic target positions when keyword changes AND after 20 leads
        if (this.memory.lastKeywordUsed !== selectedKeyword) {
          console.log(`🔄 [KEYWORD CHANGE] Switched from "${this.memory.lastKeywordUsed || 'none'}" to "${selectedKeyword}"`);
          
          // Only generate new positions after we've used the original instructions/settings for 20 leads
          if (this.memory.totalLeadsFoundThisCycle >= 20 && !this.memory.originalTargetPositions) {
            // Store original positions first time
            this.memory.originalTargetPositions = [...(userSettings.targetPositions || [])];
            console.log(`📌 [ORIGINAL SAVED] Saved original positions: ${this.memory.originalTargetPositions.join(', ')}`);
          }
          
          if (this.memory.totalLeadsFoundThisCycle >= 20 && this.memory.originalTargetPositions) {
            // After 20 leads, start dynamically adapting positions
            console.log(`🎯 [DYNAMIC MODE] 20+ leads found, generating industry-specific positions`);
            await this.generateDynamicTargetPositions(
              selectedKeyword, 
              this.memory.originalTargetPositions,
              userSettings.generalInstructions
            );
          } else {
            console.log(`📋 [USING ORIGINAL] Using original positions from instructions/settings (${this.memory.totalLeadsFoundThisCycle}/20 leads)`);
          }
          
          this.memory.lastKeywordUsed = selectedKeyword;
        }
        
        // STEP 3: Generate new AI keywords+positions after cycling through all base + existing AI pairs
        if (this.memory.currentKeywordIndex % totalKeywords === 0 && this.memory.leadsFoundWithCurrentKeyword === 0) {
          // Just completed full cycle!
          console.log(`🎊 [CYCLE COMPLETE] Finished full rotation of ${totalKeywords} industry+position pairs`);
          
          // Increment cycle offset for next cycle variety
          this.memory.cycleOffset++;
          console.log(`🔄 [OFFSET INCREMENT] Cycle offset now: ${this.memory.cycleOffset} (positions will shift by ${this.memory.cycleOffset} next cycle)`);
          
          if (this.memory.aiGeneratedKeywords.length < 5) {
            // Generate new AI keyword+position pairs
            console.log(`🧠 [AI GENERATION] Generating 5 new industry+position pairs...`);
            await this.generateRelatedIndustryKeywordsAndPositions(
              userSettings.companyIndustries,
              this.memory.originalTargetPositions || userSettings.targetPositions
            );
          } else {
            // Reset AI keywords after using 5 generated pairs
            console.log(`🔄 [RESET AI] Used 5 AI-generated pairs, clearing and restarting with base pairs`);
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
      
      console.log(`📊 [TRACKING] "${selectedKeyword}": ${tracker.leadsFound}/100 leads found, ${tracker.cumulativeDuplicateRate.toFixed(1)}% cumulative duplicates (${keywordSource} keyword)`);
      
      // Use pagination and vary search parameters intelligently
      // Apply page offset from search adaptation strategy
      const basePageRange = this.memory.searchPageOffset || 0;
      const searchPage = basePageRange + Math.floor(Math.random() * 10) + 1; // Offset + random 1-10
      console.log(`📄 [PAGINATION] Searching page ${searchPage} (offset: ${basePageRange})`);
      
      // USE PAIRED POSITION (from rotation logic above)
      let targetPosition;
      
      // Determine which position array to use (base or AI)
      const basePositions = this.memory.originalTargetPositions || userSettings.targetPositions || [];
      const aiPositions = this.memory.aiGeneratedPositions || [];
      const usingAI = keywordSource === 'ai';
      const positionArray = usingAI ? aiPositions : basePositions;
      
      if (selectedPositionIndex !== null && positionArray.length > 0) {
        targetPosition = positionArray[selectedPositionIndex];
        console.log(`🎯 [PAIRED POSITION] Using ${usingAI ? 'AI' : 'base'} position[${selectedPositionIndex}]: "${targetPosition}"`);
      } else {
        // Fallback if something went wrong
        if (basePositions.length === 0) {
          console.log(`❌ [CONFIG ERROR] Target positions not set - stopping cycle`);
          return {
            success: false,
            error: 'Target positions not configured. Please set target positions in agent settings.',
            found: 0,
            leads: []
          };
        }
        targetPosition = basePositions[0];
        console.log(`⚠️ [FALLBACK] Using first base position: "${targetPosition}"`);
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
        console.log(`⏭️ [SKIP] Already searched this combo ${historyCheck.daysAgo} days ago`);
        
        // Check if this keyword has high cumulative duplicate rate - if so, skip it entirely
        const tracker = this.memory.industryExhaustion[selectedKeyword];
        if (tracker && tracker.cumulativeDuplicateRate > 50 && tracker.totalAttempts >= 5) {
          console.log(`🔄 [EXHAUSTED] Keyword "${selectedKeyword}" has ${tracker.cumulativeDuplicateRate.toFixed(1)}% cumulative duplicates - forcing rotation`);
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
        console.log(`🔄 [ROTATE] Forcing rotation to next keyword pair`);
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
      
      console.log(`📊 [APOLLO] Leads status: Processed: ${this.memory.currentCycle.leadsProcessed}/${this.memory.currentCycle.targetLeads}, Queue: ${remainingInQueue}, Requesting: ${leadsToRequest}`);
      
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
        console.log(`🎯 [AGENT DECISION] Using agent-reasoned company size: ${sizeMin}-${sizeMax} employees`);
      } else {
        // Fallback to user settings
        if (!userSettings.companySizeMin || !userSettings.companySizeMax) {
          throw new Error('Company size range not configured in user settings');
        }
        sizeMin = userSettings.companySizeMin;
        sizeMax = userSettings.companySizeMax;
        console.log(`🔍 [FALLBACK] Using user settings company size: ${sizeMin}-${sizeMax} employees`);
      }
      
      searchPayload.organization_num_employees_ranges = [`${sizeMin},${sizeMax}`];

      // Use agent-reasoned location or fall back to user settings
      if (parameters.location) {
        searchPayload.person_locations = [parameters.location];
        console.log(`🎯 [AGENT DECISION] Using agent-reasoned location: "${parameters.location}"`);
      } else if (userSettings.targetLocations && userSettings.targetLocations.length > 0) {
        searchPayload.person_locations = userSettings.targetLocations;
        console.log(`🔍 [FALLBACK] Using user settings locations: ${userSettings.targetLocations.join(', ')}`);
      }

      // Use the selected keyword (from rotation system) for Apollo search
      searchPayload.q_organization_keyword_tags = [selectedKeyword];
      
      // Apply campaign plan exclusions to filter out unwanted results (e.g., schools, non-profits)
      if (this.campaignPlan && this.campaignPlan.searchStrategy?.excludeKeywords?.length > 0) {
        searchPayload.organization_not_all_keywords = this.campaignPlan.searchStrategy.excludeKeywords;
        console.log(`🚫 [CAMPAIGN EXCLUSIONS] Filtering out: ${this.campaignPlan.searchStrategy.excludeKeywords.join(', ')}`);
      }
      
      // CAMPAIGN STRATEGY: Keep search broad (baseline settings only)
      // Campaign plan keywords will be used during RESEARCH and QUALIFICATION phases
      // This ensures we actually find leads, then filter them based on campaign criteria
      if (this.campaignPlan && this.campaignPlan.searchStrategy) {
        console.log(`🎯 [CAMPAIGN STRATEGY] Searching for ${selectedKeyword} ${targetPosition}s, will qualify during research phase`);
        console.log(`🎯 [CAMPAIGN CRITERIA] Looking for: ${this.campaignPlan.searchStrategy.additionalKeywords?.join(', ') || 'campaign criteria'}`);
        
        // Note: We intentionally DON'T add campaign keywords to the Apollo search
        // Instead, we'll use them in the research/qualification phase to filter results
        // This prevents 0-result searches when keywords are too specific
      }

      console.log('🔍 [APOLLO] Search payload:', JSON.stringify(searchPayload, null, 2));

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
      console.log(`🔍 [APOLLO] Found ${rawLeads.length} raw leads, enriching contacts...`);
      
      // Enrich leads to get actual email addresses and full names
      const enrichedLeads = [];
      for (const lead of rawLeads) {
        try {
          // Check if lead has email available
          if (!lead.has_email) {
            console.log(`⚠️ [APOLLO] Skipping ${lead.first_name} ${lead.last_name_obfuscated || lead.last_name || ''} at ${lead.organization?.name} - no email available`);
            continue;
          }

          // Call people/enrich to get actual email and full name
          console.log(`🔓 [APOLLO] Enriching ${lead.first_name} at ${lead.organization?.name}...`);
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
            console.log(`⚠️ [APOLLO] Failed to enrich lead ${lead.id}: ${enrichResponse.status}`);
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
          console.log(`✅ [APOLLO] Enriched: ${completeLead.name} (${completeLead.email}) at ${completeLead.company}`);

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
          console.error(`❌ [APOLLO] Error enriching lead ${lead.id}:`, enrichError.message);
          continue;
        }
      }

      console.log(`📊 [APOLLO] Enrichment complete: ${enrichedLeads.length}/${rawLeads.length} leads have valid emails`);

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
            console.warn(`⚠️ Apollo ${type} limit approaching: ${limit} credits remaining`);
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
          const { newLeads, duplicateLeads, summary } = deduplicationResult;
          
          console.log(`📊 [DEDUPLICATION] Found ${summary.newCount} NEW leads, ${summary.duplicateCount} duplicates filtered out`);
          
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
            console.log('🔄 [DUPLICATES] Previously contacted:');
            duplicateLeads.forEach(lead => {
              console.log(`   • ${lead.name} at ${lead.organization?.name || lead.company}`);
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
              
              console.log(`📊 [TRACKING] "${selectedKeyword}": This search ${duplicatePercentage.toFixed(1)}% duplicates (${duplicateLeads.length}/${totalAttempts}), Cumulative ${tracker.cumulativeDuplicateRate.toFixed(1)}% (${tracker.totalDuplicates}/${tracker.totalAttempts}), ${tracker.leadsFound}/100 total`);
              
              // Store performance to Zilliz for persistent learning
              if (this.memoryInitialized) {
                try {
                  console.log(`🧠 [MEMORY STORE] Saving performance for "${selectedKeyword}" to Zilliz...`);
                  const storeResult = await this.leadMemory.storeKeywordPerformance(
                    this.userId, // Use agent's userId, not userSettings.userId
                    this.agentId,
                    selectedKeyword,
                    targetPosition,
                    totalAttempts,
                    duplicateLeads.length,
                    keywordSource
                  );
                  console.log(`✅ [MEMORY STORE] Performance saved to Zilliz successfully`);
                  
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
                console.log('⚠️ [MEMORY] Not initialized yet, skipping storage');
              }
              
              // Rotate if CUMULATIVE duplicate rate exceeds 50%
              if (tracker.cumulativeDuplicateRate > 50 && tracker.totalAttempts >= 5) {
                console.log(`🔄 [AUTO-ROTATE] Cumulative duplicate rate ${tracker.cumulativeDuplicateRate.toFixed(1)}% > 50% threshold (${tracker.totalAttempts} total attempts) - rotating to next keyword`);
                this.memory.leadsFoundWithCurrentKeyword = 999; // Force rotation
                
                // Record this search to DB
                await this.awsManager.recordSearchHistory(
                  userSettings.userId,
                  this.agentId,
                  selectedKeyword,
                  targetPosition,
                  this.memory.leadsFoundWithCurrentKeyword
                );
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
        console.log(`📦 [APOLLO] No enriched leads found after filtering ${rawLeads.length} raw results`);
      }

      console.log(`📦 [APOLLO] Found ${enrichedLeads.length} usable leads from search`);

      // Update keyword tracking (fallback case when deduplication not used)
      if (selectedKeyword && enrichedLeads.length > 0) {
        this.memory.leadsFoundWithCurrentKeyword += enrichedLeads.length;
        this.memory.industryExhaustion[selectedKeyword].leadsFound += enrichedLeads.length;
        this.memory.totalLeadsFoundThisCycle += enrichedLeads.length;
        console.log(`📊 [TRACKING] "${selectedKeyword}": ${this.memory.leadsFoundWithCurrentKeyword}/20 for rotation, ${this.memory.industryExhaustion[selectedKeyword].leadsFound}/100 total`);
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
      
      console.log(`🤖 [AI GENERATION] Generating 5 industry+position PAIRS based on company profile`);
      console.log(`🏢 [COMPANY CONTEXT] ${companyProfile.companyName || 'Unknown'} - ${companyProfile.services || 'No services defined'}`);
      console.log(`📋 [BASE POSITIONS] ${basePositions.join(', ')}`);
      
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
        
        console.log(`✅ [AI GENERATED] ${industries.length} pairs (cycle ${this.memory.aiKeywordCycleCount}):`);
        for (let i = 0; i < industries.length; i++) {
          console.log(`   ${i+1}. "${industries[i]}" + "${positions[i]}"`);
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
      
      console.log(`🤖 [AI GENERATION] Generating keywords based on company profile + industries`);
      console.log(`🏢 [COMPANY CONTEXT] ${companyProfile.companyName || 'Unknown'} - ${companyProfile.services || 'No services defined'}`);
      
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
      
      console.log(`✅ [AI GENERATED] New keywords (cycle ${this.memory.aiKeywordCycleCount}): ${keywords.join(', ')}`);
      
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
      console.log(`🎯 [DYNAMIC POSITIONS] Generating target positions for industry: "${industryKeyword}"`);
      console.log(`📋 [ORIGINAL POSITIONS] Base positions: ${originalPositions.join(', ')}`);
      
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
      
      console.log(`✅ [DYNAMIC POSITIONS] Generated ${positions.length} positions for "${industryKeyword}":`, positions.join(', '));
      
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
      
      console.log(`💾 [SETTINGS UPDATED] Target positions dynamically updated for "${industryKeyword}"`);
      
      return positions;
      
    } catch (error) {
      console.error('❌ [DYNAMIC POSITIONS ERROR]', error.message);
      // Return original positions on error
      return originalPositions || ['CEO', 'CTO', 'CFO', 'VP', 'Director'];
    }
  }

  // Main agent execution loop - keeps reasoning until goal is met
  async findLeads(targetLeads = 5, userSettings = {}) {
    console.log('🧠 [REASONING AGENT] Starting intelligent lead search...');
    console.log('🎯 [GOAL] Find', targetLeads, 'quality leads');
    
    // CRITICAL: Load existing leads database to avoid duplicates
    console.log('📄 [DUPLICATE CHECK] Loading existing leads database...');
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
    
    console.log(`🚫 [DUPLICATE CHECK] Found ${emailedCompanies.size} previously contacted companies`);
    console.log(`🚫 [DUPLICATE CHECK] Found ${processedEmails.size} previously processed emails`);
    
    // Log some example companies to verify
    if (emailedCompanies.size > 0) {
      const exampleCompanies = Array.from(emailedCompanies).slice(0, 3);
      console.log(`🏢 [EXAMPLES] Previously contacted: ${exampleCompanies.join(', ')}`);
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
      console.log(`\n🧠 [REASONING] Attempt ${attempts}/${maxAttempts}`);

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
      console.log('🧠 [DECISION]', decision.reasoning);
      
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
            console.log(`✅ [SUCCESS] Found ${actionResult.found} leads! Total: ${foundLeads.length + actionResult.found}/${targetLeads}`);
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
                console.log(`🚫 [DUPLICATE] Skipping ${lead.name} - company "${companyName}" already contacted`);
                return false;
              }
              
              // Check if email already processed
              if (existingEmail && this.memory.duplicateCheck.processedEmails.has(existingEmail)) {
                console.log(`🚫 [DUPLICATE] Skipping ${lead.name} - email "${existingEmail}" already processed`);
                return false;
              }
              
              return true;
            });
            
            console.log(`✨ [FILTERED] Processing ${newLeads.length}/${actionResult.leads.length} new leads (${actionResult.leads.length - newLeads.length} duplicates filtered)`);
            
            // Process each NEW lead through the full workflow
            for (const lead of newLeads) {
              console.log(`\n🔍 [PROCESSING] Lead: ${lead.name} at ${lead.organization?.name}`);
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
                  console.log(`✅ [EMAIL SUCCESS] Unlocked ${emailUnlock.all_emails?.length || 1} email(s) for ${lead.organization?.name} (${lead.organization?.estimated_num_employees || 'unknown'} employees)`);
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
                  
                  console.log(`✅ [COMPLETE] Lead processed with email and research`);
                } else {
                  console.log(`❌ [EMAIL FAIL] Could not unlock email for ${lead.organization?.name} - ${emailUnlock.error || 'Unknown error'}`);
                  
                  // If it's a constructed/fallback email issue, skip this lead and continue searching
                  if (emailUnlock.error && emailUnlock.error.includes('constructed/fallback')) {
                    console.log(`🔄 [SKIP] Skipping lead with constructed email - will find different lead`);
                    continue; // Skip this lead entirely, don't add to results
                  }
                  
                  console.log(`📊 [LEARNING] Company: ${lead.organization?.name}, Size: ${lead.organization?.estimated_num_employees}, Domain: ${lead.organization?.primary_domain}`);
                  
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
            console.log(`❌ [NO RESULTS] Apollo search returned 0 leads`);
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
          console.log(`🤔 [THINKING] Agent is reasoning: ${decision.reasoning}`);
          break;
      }

      // Small delay between reasoning cycles
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n🏁 [COMPLETE] Found ${foundLeads.length}/${targetLeads} leads in ${attempts} attempts`);
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
      console.log(`📄 [DATABASE] Added lead: ${leadData.name} at ${companyName || 'Unknown Company'}`);
      
      return leadRecord;
    } catch (error) {
      console.error('❌ [DATABASE] Error adding lead:', error);
      throw error;
    }
  }

  async addToEmailQueue(leadData) {
    try {
      if (!leadData.personalizedEmail || !leadData.emailSubject) {
        console.log('⚠️ [EMAIL QUEUE] Skipping lead without personalized email');
        this.logIssue('warning', 'Lead queued without email content', { leadData });
        return;
      }

      // Emit metric: email queued
      this.emitMetric('emails', 'queued', 1, 'increment');

      // Log CC and BCC email settings for debugging
      const ccEmails = this.memory.emailSettings?.emailBuilder?.ccEmails || '';
      const bccEmails = this.memory.emailSettings?.emailBuilder?.bccEmails || '';
      console.log('📧 [EMAIL QUEUE] CC Emails from settings:', ccEmails);
      console.log('📧 [EMAIL QUEUE] BCC Emails from settings:', bccEmails);
      console.log('📧 [EMAIL QUEUE] Confidence Report:', leadData.confidenceReport);
      console.log('📧 [EMAIL QUEUE] Confidence Level:', leadData.confidenceLevel);
      console.log('📧 [EMAIL QUEUE] Full emailSettings:', JSON.stringify(this.memory.emailSettings, null, 2));

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

      console.log('📧 [DEBUG QUEUE DATA] About to queue email with:', {
        to: queueData.to,
        hasConfidenceReport: !!queueData.confidenceReport,
        confidenceReportLength: queueData.confidenceReport?.length || 0,
        confidenceLevel: queueData.confidenceLevel,
        confidenceReportPreview: queueData.confidenceReport?.substring(0, 100),
        hasAiReport: !!queueData.aiReport,
        aiReportTier: queueData.aiReport?.tier,
        aiReportScore: queueData.aiReport?.score,
        aiReportCitedEvidence: queueData.aiReport?.citedEvidence?.length || 0
      });

      await this.emailQueue.addToQueue(queueData);
      console.log(`📧 [EMAIL QUEUE] Added email for ${leadData.company} (${leadData.email})`);

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
          console.log('📝 [CONTACT TRACKING] Lead added to contacted database:', leadInfo.email);
          
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
          console.log('⚠️ [CONTACT TRACKING] Lead was already in database (race condition?):', leadInfo.email);
          
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
        
        if (user.crmConnected && user.crmAutoSync) {
          console.log(`🔄 [CRM SYNC] Auto-syncing lead ${leadData.email} to ${user.crmIntegration}...`);
          
          // Emit SSE progress for CRM sync
          this.emit('progress', {
            id: this.generateUniqueId(),
            timestamp: new Date().toISOString(),
            operation: '🔄 Syncing to CRM',
            details: `Syncing ${leadInfo.name} to ${user.crmIntegration}...`,
            status: 'processing',
            data: { 
              phase: 'crm_sync',
              contactName: leadInfo.name,
              crmIntegration: user.crmIntegration
            }
          });
          
          // Prepare lead data for CRM
          const crmLeadData = {
            firstName: leadData.first_name || leadData.name?.split(' ')[0],
            lastName: leadData.last_name || leadData.name?.split(' ').slice(1).join(' '),
            email: leadData.email,
            phone: leadData.phone_number || null,
            companyName: leadData.company,
            researchSummary: queueData.researchData?.summary || null
          };
          
          const syncResult = await this.mergeManager.syncLeadToCRM(this.userId, crmLeadData);
          
          if (syncResult.success) {
            console.log(`✅ [CRM SYNC] Successfully synced to ${syncResult.crmIntegration}`);
            
            // Emit SSE success for CRM sync
            this.emit('progress', {
              id: this.generateUniqueId(),
              timestamp: new Date().toISOString(),
              operation: '✅ Synced to CRM',
              details: `${leadInfo.name} synced to ${syncResult.crmIntegration}`,
              status: 'completed',
              data: { 
                phase: 'crm_sync_complete',
                crmContactId: syncResult.crmContactId,
                crmIntegration: syncResult.crmIntegration,
                contactName: leadInfo.name
              }
            });
          } else {
            console.warn(`⚠️ [CRM SYNC] Failed to sync: ${syncResult.error}`);
            
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
                contactName: leadInfo.name
              }
            });
          }
        } else {
          console.log('⏭️ [CRM SYNC] Skipped - CRM not connected or auto-sync disabled');
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
      console.log('🚀 [REASONING AGENT] Start method called, current isRunning:', this.isRunning);
      
      if (this.isRunning) {
        console.log('⚠️ [REASONING AGENT] Agent is already running, returning early');
        return {
          success: false,
          message: 'Agent is already running',
          isActive: this.isRunning
        };
      }

      // Set custom interval if provided
      if (minutes) {
        this.customInterval = minutes * 60 * 1000; // Convert to milliseconds
        console.log('⏰ [REASONING AGENT] Custom interval set to:', minutes, 'minutes');
      }

      this.isRunning = true;
      this.startTime = new Date();
      
      console.log('🚀 [REASONING AGENT] Agent started, isRunning now:', this.isRunning);
      
      // Initialize and load memory from Zilliz
      if (!this.memoryInitialized) {
        console.log('🧠 [MEMORY] Initializing lead memory system...');
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
            console.log(`🧠 [MEMORY] Loaded ${memoryData.count} keyword performance records from previous sessions`);
            console.log(`🧠 [MEMORY] Exhausted keywords: ${Object.keys(memoryData.performanceMap).filter(k => memoryData.performanceMap[k].isExhausted).length}`);
            
            // Log to UI
            this.logOperation(
              '🧠 Memory Loaded',
              `Restored ${memoryData.count} keyword records from Zilliz (${Object.keys(memoryData.performanceMap).filter(k => memoryData.performanceMap[k].isExhausted).length} exhausted)`,
              'success'
            );
          } else {
            console.log('🧠 [MEMORY] No existing memory found, starting fresh');
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

      console.log('🚀 [REASONING AGENT] Start result:', result);
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
   * Stop the lead agent
   */
  async stop() {
    try {
      console.log('⏹️ [REASONING AGENT] Stop method called, current isRunning:', this.isRunning);
      
      // Force stop the agent
      this.isRunning = false;
      
      // Clear any running timers
      if (this.cycleTimer) {
        console.log('⏹️ [REASONING AGENT] Clearing cycle timer...');
        clearTimeout(this.cycleTimer);
        this.cycleTimer = null;
      }

      // Reset cycle counter and all state
      console.log('🔄 [REASONING AGENT] Resetting cycle counter from', this.cycleCount, 'to 0');
      this.cycleCount = 0;
      this.startTime = null;
      this.nextRunTime = null;

      // COMPREHENSIVE CACHE CLEARING - Reset ALL memory and state
      console.log('🧹 [CACHE CLEAR] Clearing all agent memory and cached data...');
      
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
        
        console.log('✅ [CACHE CLEAR] All memory cleared - agent ready for fresh start');
      }
      
      // Clear campaign plan (will be regenerated from instructions)
      this.campaignPlan = null;

      console.log('⏹️ [REASONING AGENT] Agent stopped completely, isRunning now:', this.isRunning);

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

      console.log('⏹️ [REASONING AGENT] Stop result:', result);
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
      console.log(`⏰ [REASONING AGENT] Cycle interval set to ${minutes} minutes`);
      
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
        console.log(`✅ [REASONING AGENT] Saved cycle interval to DynamoDB (preserved existing settings)`);
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
      console.log(`⏰ [REASONING AGENT] Reset to default interval: ${defaultMinutes} minutes`);
      
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
        console.log(`✅ [REASONING AGENT] Loaded saved cycle interval: ${basicSettings.customInterval} minutes`);
      }
      
      // Load lead agent settings (contains specialInstructions)
      const leadSettings = await this.awsManager.getLeadAgentSettings(this.userId, this.agentId);
      if (leadSettings && leadSettings.specialInstructions) {
        console.log(`✅ [REASONING AGENT] Loaded special instructions: "${leadSettings.specialInstructions}"`);
      } else {
        console.log(`⚠️ [REASONING AGENT] No special instructions found in lead settings!`);
        console.log(`🔍 [REASONING AGENT] Lead settings object:`, JSON.stringify(leadSettings, null, 2));
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
      console.log('🔄 [REASONING AGENT] Resetting agent...');
      
      // Stop if running
      if (this.isRunning) {
        await this.stop();
      }

      // Clear search history from AWS
      if (this.awsManager && this.userId) {
        console.log('🗑️ [RESET] Clearing search history from AWS...');
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
  async runCycle() {
    try {
      console.log('🔄 [REASONING AGENT] Running manual cycle...');
      
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
    console.log(`🛠️ [EXECUTE] Running function: ${functionName}`, parameters);
    
    try {
      let result;
      
      switch (functionName) {
        case 'get_user_settings':
          result = await this.getUserSettings();
          this.memory.userSettings = result;
          
          // Check if settings have an error
          if (result?.error) {
            console.log('⚠️ [SETTINGS] No user settings configured yet');
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
            console.log('⚠️ [SETTINGS] No email settings configured yet');
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
          console.log('⏸️ [EXECUTE] Pausing agent due to error:', parameters.error);
          result = {
            success: true,
            message: 'Agent paused due to error',
            error: parameters.error,
            shouldStop: true
          };
          break;
          
        case 'complete':
          console.log('🏁 [EXECUTE] Cycle complete');
          result = {
            success: true,
            message: 'Cycle completed',
            cycleComplete: true
          };
          break;
          
        default:
          console.log(`⚠️ [EXECUTE] Unknown function: ${functionName}`);
          result = {
            success: false,
            message: `Unknown function: ${functionName}`
          };
      }
      
      console.log(`✅ [EXECUTE] Function ${functionName} completed:`, result?.message || 'success');
      return result;
      
    } catch (error) {
      console.error(`❌ [EXECUTE] Function ${functionName} failed:`, error);
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
      console.log(`⏰ [REASONING AGENT] Next cycle scheduled for: ${this.nextRunTime.toISOString()}`);
      
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
    console.log(`🧠 [REASONING AGENT] Starting reasoning cycle #${this.cycleCount}`);
    
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
    console.log('🧹 [CACHE CLEAR] Clearing cycle-specific cache for fresh start...');
    this.memory.currentCycle = {
      leadsProcessed: 0,
      targetLeads: 0,
      currentLead: null,
      leadQueue: [],
      processingPhase: 'search'
    };
    
    // Clear last cycle's data
    this.memory.lastResearch = null;
    this.memory.currentQualification = null;
    
    console.log(`🔄 [CYCLE] Reset cycle tracking for cycle #${this.cycleCount} - starting with clean slate`);
    console.log('✅ [CACHE CLEAR] Cycle cache cleared - ready to search for new leads');
    
    // Load campaign plan from special instructions
    if (this.settings?.specialInstructions && !this.campaignPlan) {
      console.log('🎯 [CAMPAIGN PLAN] Special instructions detected, converting to plan...');
      console.log('📋 [CAMPAIGN PLAN] Instructions: "' + this.settings.specialInstructions + '"');
      
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
        
        if (this.campaignPlan) {
          console.log('✅ [CAMPAIGN PLAN] Campaign plan loaded for this cycle');
          console.log('🎯 [CAMPAIGN PLAN] Will search for:', this.campaignPlan.searchStrategy?.additionalKeywords?.join(', ') || 'default criteria');
          console.log('📧 [CAMPAIGN PLAN] Will pitch:', this.campaignPlan.emailMessaging?.primaryValue?.substring(0, 60) + '...' || 'default message');
          
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
        
        // Check if agent was stopped
        if (!this.isRunning) {
          console.log(`⏹️ [REASONING] Cycle stopped by user at step ${stepCount}`);
          break;
        }
        
        // Initialize cycle tracking if needed
        if (!this.memory.currentCycle.targetLeads && this.memory.userSettings?.leadLimit) {
          this.memory.currentCycle.targetLeads = this.memory.userSettings.leadLimit;
          this.memory.currentCycle.leadsProcessed = 0;
          this.memory.currentCycle.leadQueue = [];
          this.memory.currentCycle.processingPhase = 'search';
          console.log(`🎯 [CYCLE] Starting new cycle - Target: ${this.memory.currentCycle.targetLeads} leads`);
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

        // Debug logging for context
        console.log(`🔧 [DEBUG] Step ${stepCount} Context:`, {
          hasUserSettings: context.hasUserSettings,
          hasEmailSettings: context.hasEmailSettings,
          userSettingsError: this.memory.userSettings?.error,
          emailSettingsError: this.memory.emailSettings?.error,
          processingPhase: context.processingPhase,
          hasCurrentLead: !!context.currentLead,
          currentLeadName: context.currentLead?.name,
          currentLeadEmail: context.currentLead?.email,
          leadsProcessed: context.leadsProcessed,
          targetLeads: context.targetLeads,
          queueLength: context.leadQueue?.length || 0
        });
        
        // Check if settings have errors and need to be fetched
        if (!context.hasUserSettings && this.memory.userSettings?.error) {
          console.log('⚠️ [SETTINGS] User settings have error, will attempt to fetch again');
          this.logOperation('⚙️ Configuring Agent', 'Loading your agent settings...', 'in-progress');
        }
        if (!context.hasEmailSettings && this.memory.emailSettings?.error) {
          console.log('⚠️ [SETTINGS] Email settings have error, will attempt to fetch again');
          this.logOperation('📧 Email Setup', 'Loading your email preferences...', 'in-progress');
        }

        // Check if agent was stopped before making next decision
        if (!this.isRunning) {
          console.log(`⏹️ [REASONING] Cycle stopped by user before reasoning decision (step ${stepCount})`);
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
          console.log(`✅ [REASONING] Cycle #${this.cycleCount} completed after ${stepCount} steps`);
          this.logOperation('✅ Process Complete', `Successfully completed lead outreach`, 'completed', {
            cycleNumber: this.cycleCount,
            stepsExecuted: stepCount,
            completedAt: new Date().toISOString()
          });
          break;
        }
        
        // Execute the decided action (don't log it here, log in the specific function handlers)
        console.log(`🎯 [REASONING] Step ${stepCount}: Executing action: ${reasoningResult.action}`);
        const actionResult = await this.executeFunction(reasoningResult.action, reasoningResult.parameters);
        
        // Check if agent was stopped during action execution
        if (!this.isRunning) {
          console.log(`⏹️ [REASONING] Cycle stopped by user after action execution (step ${stepCount})`);
          break;
        }
        
        // Check if action requested to stop the cycle (e.g., due to errors)
        if (actionResult?.shouldStop) {
          console.log(`⏸️ [REASONING] Action requested cycle stop: ${actionResult.message}`);
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
        
        // Debug logging after state update
        console.log(`🔧 [DEBUG] After state update - Phase: ${this.memory.currentCycle.processingPhase}, Current lead: ${this.memory.currentCycle.currentLead?.name}, Has email: ${!!this.memory.currentCycle.currentLead?.email}`);
        
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
    console.log('🔧 [AGENT MANAGER] Creating new ReasoningLeadAgent for user:', userId, 'agentId:', agentId);
    userAgents.set(agentKey, new ReasoningLeadAgent(userId, agentId));
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
    console.log('🗑️ [AGENT MANAGER] Removed ReasoningLeadAgent for user:', userId, 'agentId:', agentId);
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
