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
import fs from 'fs/promises';
import path from 'path';

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
    
    // Agent state for UI integration
    this.isRunning = false;
    this.cycleCount = 0;
    this.startTime = null;
    
    // ID counter for unique progress events
    this.progressIdCounter = 0;
    this.customInterval = null;
    this.cycleTimer = null;
    
    // Agent memory - learns from experience
    this.memory = {
      searchHistory: [],
      successfulStrategies: [],
      failedStrategies: [],
      industryInsights: {},
      currentGoal: null,
      currentIndustryIndex: 0, // Track which industry to search next
      
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
        description: 'Search for leads using Apollo API based on user criteria',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for leads' },
            companySize: { type: 'string', description: 'Employee range like "100,1000"' },
            location: { type: 'string', description: 'Geographic location' },
            industries: { type: 'array', items: { type: 'string' }, description: 'Industry keywords' },
            position: { type: 'string', description: 'Target job title/position' }
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
        description: 'Unlock email address for a lead using Apollo credits',
        parameters: {
          type: 'object',
          properties: {
            firstName: { type: 'string', description: 'Lead first name' },
            lastName: { type: 'string', description: 'Lead last name' },
            companyName: { type: 'string', description: 'Lead company name' }
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
      }
    ];

    console.log('🧠 [REASONING AGENT] Initialized AI reasoning agent for user:', userId);
    
    // Add initial log entry
    this.logOperation('Agent Initialized', `Reasoning Lead Agent initialized for user ${userId}`, 'completed', {
      userId,
      timestamp: new Date().toISOString()
    });
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
  }

  getOperationLogs() {
    return this.operationLogs;
  }

  clearOperationLogs() {
    this.operationLogs = [];
    this.logOperation('System', 'Operation logs cleared', 'completed');
  }

  // Generate unique ID for progress events
  generateUniqueId() {
    return `${Date.now()}-${++this.progressIdCounter}-${Math.random().toString(36).substr(2, 4)}`;
  }

  // Core reasoning function - the agent's "brain"
  async reason(context) {
    const prompt = `You are an intelligent lead research and email generation agent working SEQUENTIALLY on one lead at a time.

SEQUENTIAL WORKFLOW (Process ONE lead completely before finding the next):
1. Find Lead → 2. Research Lead → 3. Unlock Email → 4. Build Email → REPEAT until target reached

CURRENT CYCLE STATUS:
- Has User Settings: ${context.hasUserSettings}  
- Has Email Settings: ${context.hasEmailSettings}
- Leads Processed: ${context.leadsProcessed}/${context.targetLeads}
- Lead Queue: ${context.leadQueue?.length || 0} leads waiting
- Current Processing Phase: ${context.processingPhase}
- Cycle Complete: ${context.cycleComplete}

${context.currentLead ? `
CURRENT LEAD BEING PROCESSED:
- Name: ${context.currentLead.name || 'Unknown'}
- Company: ${context.currentLead.company || 'Unknown'}  
- Title: ${context.currentLead.title || 'Unknown'}
- Phase: ${context.processingPhase}
` : 'No current lead'}

USER SETTINGS:
${context.hasUserSettings ? `
- Target: ${context.targetLeads} leads per cycle
- Industries: ${JSON.stringify(this.memory.userSettings?.companyIndustries || [])}
- Positions: ${JSON.stringify(this.memory.userSettings?.targetPositions || [])}
- Company Size: ${this.memory.userSettings?.companySizeMin}-${this.memory.userSettings?.companySizeMax}
- Locations: ${JSON.stringify(this.memory.userSettings?.targetLocations || [])}
` : 'Settings not loaded yet'}

DECISION LOGIC (choose ONE action):

1. IF hasUserSettings = false → CALL get_user_settings

2. IF hasUserSettings = true AND hasEmailSettings = false → CALL get_email_settings

3. IF cycleComplete = true → CALL complete (cycle finished, wait for next cycle)

4. IF processingPhase = 'search' AND currentLead = null AND leadQueue = empty → CALL apollo_search
   (Search for leads only when queue is empty and no current lead being processed)

5. IF processingPhase = 'research' AND currentLead exists → CALL serper_research  
   (Research the current lead to gather intelligence)

6. IF processingPhase = 'email' AND currentLead exists → CALL unlock_email
   (Unlock email address for researched lead)

7. IF processingPhase = 'build' AND currentLead exists → CALL build_personalized_email
   (Create personalized email using research data)

REASONING INSTRUCTIONS:
- You MUST call a function - don't just think about it!
- For apollo_search, use terms related to "${this.memory.userSettings?.primaryService || 'business solutions'}" and "${this.memory.userSettings?.coreOffering || 'services'}" - NOT generic HR terms
- Use the user's REAL industries/positions/company size from settings above
- Use user's actual preferences (industries, company size, positions) for Apollo searches
- Always research leads with Serper to verify they're real and gather intelligence
- Unlock emails for qualified leads only
- Create personalized emails based on research insights
- If searches fail, reason about why and adjust (broader criteria, different industries, etc.)
- Learn from your memory - what worked before?

CRITICAL: You MUST call a function. Do not just explain what to do - actually call the appropriate function from the available tools.

Choose your next action and explain your reasoning:`;

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
        
        // Log detailed reasoning to activity logs
        this.logOperation('Agent Reasoning', `🤔 [THINKING] ${reasoning}`, 'success', {
          action: message.function_call.name,
          parameters: parameters
        });
        
        return {
          reasoning: reasoning,
          action: message.function_call.name,
          parameters: parameters
        };
      }

      const reasoning = message.content || 'Agent is thinking...';
      console.log('🤔 [THINKING] Agent reasoning:', reasoning);
      
      // Log pure reasoning to activity logs
      this.logOperation('Agent Thinking', `🤔 [THINKING] ${reasoning}`, 'info', {
        action: 'think'
      });

      return {
        reasoning: reasoning,
        action: 'think',
        parameters: {}
      };

    } catch (error) {
      console.error('❌ [REASONING] Error:', error);
      
      // Handle specific OpenAI rate limit errors
      if (error.status === 429) {
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
                  companyName: context.currentLead.company || context.currentLead.organization?.name
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
        
      case 'research':
        if (context.currentLead) {
          console.log('🔧 [FUNCTION CALL] Forcing serper_research');
          return { name: 'serper_research' };
        }
        break;
        
      case 'email':
        if (context.currentLead) {
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
          // Add all leads to the queue for sequential processing
          actionResult.leads.forEach(lead => {
            const normalizedLead = {
              ...lead,
              company: lead.organization?.name || lead.company || 'Unknown Company'
            };
            this.memory.currentCycle.leadQueue.push(normalizedLead);
          });
          
          console.log(`🔍 [CYCLE] Added ${actionResult.leads.length} leads to queue. Queue size: ${this.memory.currentCycle.leadQueue.length}`);
          
          // Start processing the first lead from queue
          if (this.memory.currentCycle.leadQueue.length > 0 && !this.memory.currentCycle.currentLead) {
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
            console.log(`� [QUEUE] Processing lead: ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`);
          }
        } else {
          // No new leads found - check if we still need more leads for our target
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
        
      case 'serper_research':
        if (actionResult?.success) {
          // Research complete, move to email unlock
          this.memory.currentCycle.processingPhase = 'email';
          console.log(`📚 [CYCLE] Research completed for ${this.memory.currentCycle.currentLead?.name}`);
        }
        break;
        
      case 'unlock_email':
        console.log(`🔧 [DEBUG] unlock_email success check: success=${actionResult?.success}, email=${!!actionResult?.email}`);
        
        if (actionResult?.success && actionResult?.email) {
          // Email unlocked successfully, UPDATE the lead email and move to build
          this.memory.currentCycle.currentLead.email = actionResult.email;
          this.memory.currentCycle.processingPhase = 'build';
          console.log(`🔓 [CYCLE] Email unlocked for ${this.memory.currentCycle.currentLead?.name}: ${actionResult.email}`);
          console.log(`🔧 [DEBUG] Set processingPhase to 'build' after unlock - NEW PHASE: ${this.memory.currentCycle.processingPhase}`);
          console.log(`🔧 [DEBUG] Current lead after unlock:`, this.memory.currentCycle.currentLead?.name, 'has email:', !!this.memory.currentCycle.currentLead?.email);
    
        } else {
          // Email unlock failed, skip this lead and get next from queue or search
          console.log(`⚠️ [CYCLE] Email unlock failed for ${this.memory.currentCycle.currentLead?.name}, skipping lead`);
          console.log(`🔧 [DEBUG] Failure reason: success=${actionResult?.success}, email=${actionResult?.email}, error=${actionResult?.error}`);
          this.memory.currentCycle.currentLead = null;
          
          if (this.memory.currentCycle.leadQueue.length > 0) {
            // Get next lead from queue
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
            console.log(`📋 [QUEUE] Processing next lead after failure: ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`);
          } else {
            // Queue empty, need to search for more leads
            this.memory.currentCycle.processingPhase = 'search';
            console.log(`🔍 [CYCLE] Queue empty after failure, searching for more leads`);
          }
        }
        break;
        
      case 'build_personalized_email':
        if (actionResult?.success) {
          // Add email to queue with correct field names
          const leadData = {
            ...this.memory.currentCycle.currentLead,
            email: this.memory.currentCycle.currentLead.email,
            personalizedEmail: actionResult.email,
            emailSubject: actionResult.subject,
            generatedEmail: actionResult.email,
            research: this.memory.lastResearch // Include the research data from memory
          };
          await this.addToEmailQueue(leadData);
          console.log(`📧 [QUEUE] Email added to queue for ${this.memory.currentCycle.currentLead?.name}`);
          
          // Email built, lead complete - move to next lead
          this.memory.currentCycle.leadsProcessed++;
          this.memory.currentCycle.currentLead = null;
          
          // Get next lead from queue or search for more
          if (this.memory.currentCycle.leadQueue.length > 0) {
            // Process next lead from queue
            this.memory.currentCycle.currentLead = this.memory.currentCycle.leadQueue.shift();
            this.memory.currentCycle.processingPhase = 'research';
            console.log(`📋 [QUEUE] Processing next lead: ${this.memory.currentCycle.currentLead.name} at ${this.memory.currentCycle.currentLead.company}`);
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
    if (text.includes('fintech') || text.includes('financial technology')) {
      return 'FinTech Company';
    }
    if (text.includes('healthcare') || text.includes('medical')) {
      return 'Healthcare Technology';
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

      // Parse the structured response
      const lines = analysis.split('\n').filter(line => line.trim());
      const parsed = {};
      let currentSection = '';
      
      lines.forEach(line => {
        if (line.includes('BUSINESS TYPE:')) {
          parsed.businessType = line.replace('BUSINESS TYPE:', '').trim();
        } else if (line.includes('KEY INSIGHTS:')) {
          parsed.keyInsights = line.replace('KEY INSIGHTS:', '').trim();
        } else if (line.includes('LEAD VALUE:')) {
          parsed.leadValue = line.replace('LEAD VALUE:', '').trim();
        } else if (line.includes('APPROACH:')) {
          parsed.approach = line.replace('APPROACH:', '').trim();
        }
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
      
      const actualSettings = {
        // Company branding (REAL DATA)
        companyBranding: leadContactSettings.companyBranding,
        agentName: leadContactSettings.companyBranding?.agentName,
        companyName: leadContactSettings.companyBranding?.companyName,
        primaryService: leadContactSettings.companyBranding?.primaryService,
        coreOffering: leadContactSettings.companyBranding?.coreOffering,
        keyAdvantages: leadContactSettings.companyBranding?.keyAdvantages,
        expertiseArea: leadContactSettings.companyBranding?.expertiseArea,
        
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
        
        // Company branding for email templates
        companyBranding: leadContactSettings.companyBranding
      };
      
      console.log('✅ [EMAIL SETTINGS] REAL email builder settings:', {
        template: actualEmailSettings.emailTemplate,
        tone: actualEmailSettings.tone,
        personalization: actualEmailSettings.personalization,
        callToAction: actualEmailSettings.callToAction,
        hasCustomPrompt: !!actualEmailSettings.customPrompt
      });
      
      return actualEmailSettings;
    } catch (error) {
      console.error('❌ [EMAIL SETTINGS] Error getting email settings:', error);
      return { error: error.message };
    }
  }

  // Research company/lead using Serper
  async serperResearch(parameters) {
    const companyName = parameters.companyName || 'Unknown Company';
    console.log('🔍 [SERPER] Starting research for:', companyName);
    
    try {
      const searchQuery = parameters.searchQuery || 
        `${parameters.companyName} company information business model products services`;
      
      console.log('🔎 [SERPER] Search Query:', searchQuery);
      
      const results = await internetSearch(searchQuery);
      
      // Log detailed findings
      console.log('📊 [SERPER] Raw Results Summary:');
      console.log(`   • Total organic results: ${results.organic?.length || 0}`);
      console.log(`   • Knowledge graph: ${results.knowledgeGraph ? 'YES' : 'NO'}`);
      console.log(`   • Answer box: ${results.answerBox ? 'YES' : 'NO'}`);
      console.log(`   • Related searches: ${results.relatedSearches?.length || 0}`);
      
      // Log top organic results
      if (results.organic && results.organic.length > 0) {
        console.log('🎯 [SERPER] Top Search Results Found:');
        results.organic.slice(0, 5).forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.title}`);
          console.log(`      URL: ${result.link}`);
          console.log(`      Snippet: ${result.snippet?.substring(0, 100)}...`);
        });
      }
      
      // Log knowledge graph data if available
      if (results.knowledgeGraph) {
        console.log('🧠 [SERPER] Knowledge Graph Found:');
        console.log(`   • Title: ${results.knowledgeGraph.title}`);
        console.log(`   • Type: ${results.knowledgeGraph.type}`);
        console.log(`   • Description: ${results.knowledgeGraph.description?.substring(0, 150)}...`);
        if (results.knowledgeGraph.attributes) {
          console.log('   • Key Attributes:');
          Object.entries(results.knowledgeGraph.attributes).slice(0, 3).forEach(([key, value]) => {
            console.log(`     - ${key}: ${value}`);
          });
        }
      }
      
      // Log answer box if available
      if (results.answerBox) {
        console.log('💡 [SERPER] Answer Box Found:');
        console.log(`   • Answer: ${results.answerBox.answer?.substring(0, 200)}...`);
        console.log(`   • Source: ${results.answerBox.link}`);
      }
      
      console.log('✅ [SERPER] Research complete - Data logged above');
      
      // Emit detailed research findings to Activity Logs
      const researchSummary = [];
      
      if (results.knowledgeGraph) {
        researchSummary.push(`🧠 Knowledge Graph: ${results.knowledgeGraph.title} (${results.knowledgeGraph.type})`);
      }
      
      if (results.answerBox) {
        researchSummary.push(`💡 Answer: ${results.answerBox.answer?.substring(0, 100)}...`);
      }
      
      if (results.organic && results.organic.length > 0) {
        researchSummary.push(`🎯 Found ${results.organic.length} search results`);
        researchSummary.push(`📖 Top result: ${results.organic[0].title}`);
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
          query: searchQuery,
          resultsCount: results.organic?.length || 0,
          hasKnowledgeGraph: !!results.knowledgeGraph,
          hasAnswerBox: !!results.answerBox
        }
      });

      // Emit detailed content findings in a separate event
      const contentFindings = [];
      
      // Add answer box content if available
      if (results.answerBox) {
        contentFindings.push({
          type: 'Answer Box',
          content: results.answerBox.answer || results.answerBox.snippet,
          source: results.answerBox.link,
          title: results.answerBox.title
        });
      }
      
      // Add knowledge graph info if available
      if (results.knowledgeGraph) {
        contentFindings.push({
          type: 'Knowledge Graph',
          content: results.knowledgeGraph.description,
          title: results.knowledgeGraph.title,
          attributes: results.knowledgeGraph.attributes
        });
      }
      
      // Add top 3 search results
      if (results.organic && results.organic.length > 0) {
        results.organic.slice(0, 3).forEach((result, index) => {
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
      const researchResults = {
        success: true,
        data: results,
        companyName: parameters.companyName,
        insights: results.organic?.slice(0, 3) || [],
        knowledgeGraph: results.knowledgeGraph,
        answerBox: results.answerBox,
        contentFindings: contentFindings
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
        person_locations: ["United States"]
      };
      
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

      console.log('🔍 [STEP 1] Searching for person with:', searchPayload);
      const searchResponse = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify(searchPayload)
      });

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      let searchData = await searchResponse.json();
      console.log('🔍 [STEP 1] Search results:', searchData.people?.length || 0, 'people found');
      
      if (!searchData.people || searchData.people.length === 0) {
        console.log('⚠️ [STEP 1] No results with current search, trying fallback...');
        
        // FALLBACK 1: Try without domain filtering if we used a domain
        if (parameters.domain) {
          console.log('🔄 [FALLBACK] Retrying without domain filter...');
          const fallbackPayload = {
            per_page: 10,
            page: 1,
            person_locations: ["United States"]
          };
          
          if (parameters.firstName && parameters.lastName) {
            fallbackPayload.q_person_name = `${parameters.firstName} ${parameters.lastName}`;
          }
          
          if (parameters.companyName) {
            fallbackPayload.q_organization_name = parameters.companyName;
          }
          
          const fallbackResponse = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
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
        throw new Error(`Enrich failed: ${enrichResponse.status}`);
      }

      const enrichData = await enrichResponse.json();
      console.log('🔓 [STEP 2] Enriched person data received');
      
      if (enrichData && enrichData.person) {
        const person = enrichData.person;
        const workEmail = person.email;
        const personalEmails = person.personal_emails || [];
        
        console.log(`📧 Work email: ${workEmail}`);
        console.log(`📧 Personal emails: ${personalEmails.join(', ')}`);
        console.log(`📊 [DEBUG] Email status/confidence:`, person.email_status, person.extrapolated_email_confidence);
        
        // Validate email with ZeroBounce before accepting (non-blocking)
        const emailToValidate = workEmail;
        if (emailToValidate) {
          console.log(`🔍 [ZEROBOUNCE] Validating email: ${emailToValidate}`);
          const zeroBounceResult = await this.validateEmailWithZeroBounce(emailToValidate);
          
          // Only reject if ZeroBounce specifically says it's invalid or spamtrap
          if (!zeroBounceResult.isValid && ['invalid', 'spamtrap', 'abuse', 'do_not_mail'].includes(zeroBounceResult.status?.toLowerCase())) {
            console.log(`❌ [ZEROBOUNCE] Email validation failed: ${zeroBounceResult.status} - ${zeroBounceResult.reason}`);
            return {
              success: false,
              error: `Email validation failed: ${zeroBounceResult.status}`
            };
          }
          
          console.log(`✅ [ZEROBOUNCE] Email validation: ${zeroBounceResult.status} (accepted)`);
        }
        
        // Accept emails with actual confidence scores
        const allEmails = [workEmail, ...personalEmails].filter(email => {
          return email && !email.includes('email_not_unlocked');
        });
        
        if (allEmails.length > 0) {
          console.log('✅ [APOLLO] Email unlocked successfully!');
          
          // Add activity log for SSE stream
          this.logOperation('Email Unlocked', `🔓 Email unlocked: ${allEmails[0]} for ${person.first_name} ${person.last_name} at ${person.organization?.name}`, 'success', {
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
          console.log('❌ [APOLLO] No emails available');
        }
      }

      console.log('❌ [APOLLO] No real emails found - need to find different lead');
      return {
        success: false,
        error: 'No real emails found - only constructed/fallback emails available'
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
        throw new Error(`ZeroBounce API error: ${response.status}`);
      }

      const data = await response.json();
      
      // ZeroBounce status values: valid, invalid, catch-all, unknown, spamtrap, abuse, do_not_mail
      const validStatuses = ['valid', 'catch-all'];
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
    console.log('📝 [EMAIL BUILDER] Creating personalized email...');
    
    try {
      // Get data from current cycle state instead of parameters
      const leadData = this.memory.currentCycle.currentLead;
      const researchData = this.memory.lastResearch;
      const emailSettings = this.memory.emailSettings;
      
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
      
      // Extract specific research insights for personalization
      let researchInsights = 'Company research data available';
      let keyBusinessFacts = [];
      
      if (researchData?.data?.organic && researchData.data.organic.length > 0) {
        // Extract key business insights from research
        keyBusinessFacts = researchData.data.organic.slice(0, 3).map(r => r.snippet);
        researchInsights = keyBusinessFacts.join(' ');
        
        // Look for specific business indicators to personalize
        const fullResearchText = researchInsights.toLowerCase();
        const businessContext = {
          isFintech: fullResearchText.includes('fintech') || fullResearchText.includes('financial'),
          hasZelle: fullResearchText.includes('zelle'),
          preventsFraud: fullResearchText.includes('fraud'),
          isGrowing: fullResearchText.includes('growing') || fullResearchText.includes('expansion'),
          hasEmployees: fullResearchText.includes('employee') || fullResearchText.includes('workforce'),
          usesADP: fullResearchText.includes('adp'),
          hasCompliance: fullResearchText.includes('compliance') || fullResearchText.includes('regulation')
        };
      }
        
      // Use custom email prompt from settings or fallback
      let emailPrompt;
      if (emailSettings.customPrompt) {
        // Replace template variables in custom prompt
        emailPrompt = emailSettings.customPrompt
          .replace(/\{\{AGENT_NAME\}\}/g, emailSettings.companyBranding?.agentName || 'AI Assistant')
          .replace(/\{\{COMPANY_NAME\}\}/g, emailSettings.companyBranding?.companyName || 'Our Company')
          .replace(/\{\{AGENT_TITLE\}\}/g, emailSettings.companyBranding?.agentTitle || 'AI Assistant')
          .replace(/\{\{PRIMARY_SERVICE\}\}/g, emailSettings.companyBranding?.primaryService || 'business solutions')
          .replace(/\{\{CORE_OFFERING\}\}/g, emailSettings.companyBranding?.coreOffering || 'our solutions')
          .replace(/\{\{KEY_ADVANTAGES\}\}/g, emailSettings.companyBranding?.keyAdvantages || 'competitive advantages')
          .replace(/\{\{EXPERTISE_AREA\}\}/g, emailSettings.companyBranding?.expertiseArea || 'industry expertise')
          .replace(/\{\{TARGET_COMPANY\}\}/g, companyName)
          .replace(/\{\{CONTACT_NAME\}\}/g, contactName)
          .replace(/\{\{CONTACT_TITLE\}\}/g, contactTitle)
          .replace(/\{\{INDUSTRY\}\}/g, industry)
          .replace(/\{\{COMPANY_DESCRIPTION\}\}/g, researchInsights)
          .replace(/\{\{EMPLOYEE_COUNT\}\}/g, employeeCount);
      } else {
        // Enhanced personalized email prompt with specific research insights
        const specificInsights = this.extractSpecificInsights(researchData);
        
        // Create a compelling insights summary with the most impressive details
        let insightsSummary = '';
        if (specificInsights.length > 0) {
          const topInsights = specificInsights.slice(0, 4);
          insightsSummary = topInsights.map((insight, i) => {
            const priority = ['recent_funding', 'growth', 'product_launch', 'partnership', 'acquisition', 'recognition'].includes(insight.type) ? 'HIGH PRIORITY' : 'Notable';
            return `• ${insight.insight} (${priority})`;
          }).join('\n');
        } else {
          insightsSummary = keyBusinessFacts.slice(0, 3).map(fact => `• ${fact}`).join('\n');
        }
        
        // Get the most impressive insight and format as congratulations/recognition
        let leadingInsight = null;
        if (specificInsights.length > 0) {
          const topInsight = specificInsights[0];
          
          // Format as congratulations based on insight type
          switch(topInsight.type) {
            case 'recent_funding':
            case 'valuation':
              leadingInsight = `Congratulations on ${topInsight.insight.toLowerCase()}!`;
              break;
            case 'product_launch':
            case 'innovation':
              leadingInsight = `I noticed you ${topInsight.insight.toLowerCase()}.`;
              break;
            case 'growth':
            case 'expansion':
              leadingInsight = `Impressive work on ${topInsight.insight.toLowerCase()}!`;
              break;
            case 'partnership':
            case 'acquisition':
              leadingInsight = `I saw that you ${topInsight.insight.toLowerCase()}.`;
              break;
            case 'recognition':
            case 'ranking':
              leadingInsight = `Congratulations on being ${topInsight.insight.toLowerCase()}!`;
              break;
            default:
              leadingInsight = `I noticed ${topInsight.insight.toLowerCase()}.`;
          }
        }
          
        // Build intelligence context from research
        let intelligenceContext = '';
        if (researchData && specificInsights.length > 0) {
          intelligenceContext = `\nSPECIFIC COMPANY RESEARCH FINDINGS:
${specificInsights.map(insight => `- ${insight.insight} (${insight.type})`).join('\n')}`;
        }
        
        // Use the leadContactAgent's PROVEN email generation system
        emailPrompt = `You are ${emailSettings.companyBranding?.agentName || 'AI Assistant'}, the AI assistant for ${emailSettings.companyBranding?.companyName || 'Our Company'}. Generate a HIGHLY INTELLIGENT, research-based marketing email for the following prospect:

Company: ${companyName}
Contact: ${leadData.first_name} ${leadData.last_name}
Title: ${contactTitle}
Industry: ${industry}
Company Description: ${researchInsights}
Employee Count: ${employeeCount} employees${intelligenceContext}

YOUR TASK - BE A SMART SALESPERSON:
Generate a professional email that demonstrates you've done your homework:

1. Subject line that references specific company context (growth, initiatives, etc.)
2. Opening with SINGLE greeting only (Hello ${leadData.first_name}, - NOT "Hello ${leadData.first_name} ${leadData.last_name},")
3. Connect their specific situation to ${emailSettings.companyBranding?.companyName || 'our'} solutions with LOGICAL REASONING
4. Explain WHY our solution specifically fits their company's needs
5. Professional call-to-action
6. Simple signature: "Best regards,\\n${emailSettings.companyBranding?.agentName || 'AI Assistant'}\\n${emailSettings.companyBranding?.companyName || 'Our Company'} ${emailSettings.companyBranding?.agentTitle || 'Representative'}"

CRITICAL RULES:
- Use ONLY "Hello ${leadData.first_name}," (first name only)
- NO generic phrases like "prolific standing in the business industry"
- DO NOT use "becomes paramount" or corporate jargon
- Reference specific research insights when available
- Focus on business value connected to their specific situation
- Keep it concise (under 200 words), professional, and data-driven

SOLUTION DETAILS:
- Primary Service: ${emailSettings.companyBranding?.primaryService || 'Business solutions and services'}
- Key Benefits: ${emailSettings.companyBranding?.keyAdvantages || 'Improved efficiency, streamlined operations, better results'}

Show you understand their business and connect it logically to communication challenges.

Format as:
SUBJECT: [subject line]
BODY: [email body with proper greeting and signature]`;
      }

      console.log('💎 [PREMIUM MODEL] Using GPT-4 for high-quality email generation');
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: emailPrompt }],
        temperature: 0.7,
        max_tokens: 600
      });

      const emailContent = response.choices[0].message.content;
      
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
      
      console.log('✅ [EMAIL BUILDER] Personalized email created');
      
      return {
        success: true,
        email: body,
        subject: subject
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
      
      // Pick ONE industry per search (rotate through available industries)
      let selectedIndustry = null;
      if (userSettings.companyIndustries && userSettings.companyIndustries.length > 0) {
        const currentIndex = this.memory.currentIndustryIndex % userSettings.companyIndustries.length;
        selectedIndustry = userSettings.companyIndustries[currentIndex];
        
        // Increment for next search
        this.memory.currentIndustryIndex++;
        
        console.log(`🎯 [INDUSTRY ROTATION] Selected industry ${currentIndex + 1}/${userSettings.companyIndustries.length}: "${selectedIndustry}"`);
      }
      
      // Use pagination and vary search parameters intelligently
      const searchPage = Math.floor(Math.random() * 5) + 1; // Pages 1-5 for more variety
      
      // Use the position the agent reasoned about, or fall back to user settings
      let targetPosition;
      if (parameters.position) {
        targetPosition = parameters.position;
        console.log(`🎯 [AGENT DECISION] Using agent-reasoned position: "${targetPosition}"`);
      } else {
        // Fallback to user settings if agent didn't specify
        if (!userSettings.targetPositions || userSettings.targetPositions.length === 0) {
          throw new Error('No target positions configured in user settings');
        }
        targetPosition = userSettings.targetPositions[Math.floor(Math.random() * userSettings.targetPositions.length)];
        console.log(`🔍 [FALLBACK] Using random position from settings: "${targetPosition}"`);
      }
      
      // Calculate how many leads we still need
      const leadsNeeded = this.memory.currentCycle.targetLeads - this.memory.currentCycle.leadsProcessed;
      const remainingInQueue = this.memory.currentCycle.leadQueue.length;
      const leadsToRequest = Math.max(1, leadsNeeded - remainingInQueue);
      
      console.log(`📊 [APOLLO] Leads status: Processed: ${this.memory.currentCycle.leadsProcessed}/${this.memory.currentCycle.targetLeads}, Queue: ${remainingInQueue}, Requesting: ${leadsToRequest}`);
      
      const searchPayload = {
        q_keywords: targetPosition,
        page: searchPage,
        per_page: leadsToRequest
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

      // Use agent-reasoned industries or fall back to rotating through user settings
      if (parameters.industries && parameters.industries.length > 0) {
        searchPayload.q_organization_keyword_tags = parameters.industries;
        console.log(`🎯 [AGENT DECISION] Using agent-reasoned industries: ${parameters.industries.join(', ')}`);
      } else if (selectedIndustry) {
        searchPayload.q_organization_keyword_tags = [selectedIndustry];
        console.log(`🔍 [FALLBACK] Using rotated industry from settings: "${selectedIndustry}"`);
      }

      console.log('🔍 [APOLLO] Search payload:', JSON.stringify(searchPayload, null, 2));

      const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
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
      console.log(`🔍 [APOLLO] Found ${rawLeads.length} raw leads, checking for duplicates...`);

      // Check for duplicates immediately after Apollo search
      if (rawLeads.length > 0) {
        // Emit SSE progress for deduplication check start
        this.emit('progress', {
          id: this.generateUniqueId(),
          timestamp: new Date().toISOString(),
          operation: 'Deduplication Check',
          details: `🔍 Checking ${rawLeads.length} leads for duplicates...`,
          status: 'processing',
          data: { 
            phase: 'deduplication_start',
            totalLeads: rawLeads.length
          }
        });
        
        const deduplicationResult = await this.awsManager.checkForDuplicateContacts(this.userId, rawLeads);
        
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
      }

      console.log(`� [APOLLO] Found ${rawLeads.length} leads from search`);

      // Return all leads from Apollo (deduplication will happen after email unlock)
      const results = {
        found: rawLeads.length,
        leads: rawLeads,
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
        return;
      }

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
          operation: 'Contact Tracking',
          details: `Adding ${leadInfo.name} (${leadInfo.email}) to contacted database...`,
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
            operation: 'Contact Tracking',
            details: `✅ Contact saved - ${leadInfo.name} at ${leadInfo.company} added to database`,
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

      // Reset current goal
      if (this.memory) {
        this.memory.currentGoal = null;
      }

      console.log('⏹️ [REASONING AGENT] Agent stopped, isRunning now:', this.isRunning);

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
        cyclesCompleted: this.cycleCount,
        isActive: false
      };

      console.log('⏹️ [REASONING AGENT] Stop result:', result);
      return result;
    } catch (error) {
      console.error('❌ [REASONING AGENT] Error stopping agent:', error);
      // Force stop even on error
      this.isRunning = false;
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
   * Reset the agent (clear state and memory)
   */
  async resetAgent() {
    try {
      console.log('🔄 [REASONING AGENT] Resetting agent...');
      
      // Stop if running
      if (this.isRunning) {
        await this.stop();
      }

      // Reset memory and state
      this.memory = {
        searchHistory: [],
        successfulStrategies: [],
        failedStrategies: [],
        industryInsights: {},
        currentGoal: null,
        currentIndustryIndex: 0
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
          break;
          
        case 'get_email_settings':
          result = await this.getEmailSettings();
          this.memory.emailSettings = result;
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
    if (!this.isRunning) return null;
    const intervalMs = this.customInterval || (30 * 60 * 1000); // Default 30 minutes
    return intervalMs / 1000; // Return seconds
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

    // Schedule next cycle
    if (this.isRunning) {
      const interval = this.customInterval || (30 * 60 * 1000); // Default 30 minutes
      this.cycleTimer = setTimeout(() => this.runLoop(), interval);
    }
  }

  // Execute one reasoning cycle
  async executeReasoningCycle() {
    this.cycleCount++;
    console.log(`🧠 [REASONING AGENT] Starting reasoning cycle #${this.cycleCount}`);
    
    // Reset cycle tracking for new cycle
    this.memory.currentCycle = {
      leadsProcessed: 0,
      targetLeads: 0,
      currentLead: null,
      processingPhase: 'search'
    };
    console.log(`🔄 [CYCLE] Reset cycle tracking for cycle #${this.cycleCount}`);
    
    // Log cycle start
    this.logOperation('Cycle Started', `Reasoning cycle #${this.cycleCount} initiated`, 'running', {
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
      const maxSteps = 100; // Safety limit
      
      while (stepCount < maxSteps) {
        stepCount++;
        
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
          hasUserSettings: !!this.memory.userSettings,
          hasEmailSettings: !!this.memory.emailSettings,
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
          processingPhase: context.processingPhase,
          hasCurrentLead: !!context.currentLead,
          currentLeadName: context.currentLead?.name,
          currentLeadEmail: context.currentLead?.email,
          leadsProcessed: context.leadsProcessed,
          targetLeads: context.targetLeads,
          queueLength: context.leadQueue?.length || 0
        });

        // Get reasoning decision from OpenAI
        const reasoningResult = await this.reason(context);
        
        if (!reasoningResult.action || reasoningResult.action === 'think' || reasoningResult.action === 'complete') {
          console.log(`✅ [REASONING] Cycle #${this.cycleCount} completed after ${stepCount} steps`);
          this.logOperation('Cycle Completed', `Reasoning cycle #${this.cycleCount} completed successfully with ${stepCount} steps`, 'completed', {
            cycleNumber: this.cycleCount,
            stepsExecuted: stepCount,
            completedAt: new Date().toISOString()
          });
          break;
        }
        
        // Execute the decided action
        console.log(`🎯 [REASONING] Step ${stepCount}: Executing action: ${reasoningResult.action}`);
        this.logOperation('Action Executed', `Step ${stepCount}: ${reasoningResult.action}`, 'running', {
          cycleNumber: this.cycleCount,
          stepNumber: stepCount,
          action: reasoningResult.action,
          parameters: reasoningResult.parameters
        });
        const actionResult = await this.executeFunction(reasoningResult.action, reasoningResult.parameters);
        
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

      return {
        success: true,
        message: `Reasoning cycle #${this.cycleCount} completed with ${stepCount} steps`,
        cycleNumber: this.cycleCount,
        stepsExecuted: stepCount
      };

    } catch (error) {
      console.error('❌ [REASONING AGENT] Cycle error:', error);
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
