import 'dotenv/config';
import { deepResearch } from '../tools/deepResearch.js';
import { leadResearch } from '../tools/leadResearch.js';
import { leadEmail } from '../tools/leadEmail.js';
import { emailQueue } from '../lib/emailQueue.js';
import { getUserSettings } from '../lib/userManager.js';
import { ChatOpenAI } from "@langchain/openai";
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

// 🧪 TESTING CONFIGURATION
// TO SWITCH TO PRODUCTION MODE:
// 1. Change TESTING_MODE to false
// 2. Restart the server
// 3. All emails will go to actual prospects instead of developer
const TESTING_MODE = false; // Set to false for production
const DEVELOPER_EMAIL = 'colton.fidd@gmail.com';
const DEFAULT_TESTING_CYCLE_INTERVAL = 2 * 60 * 1000; // 2 minutes for testing
const DEFAULT_PRODUCTION_CYCLE_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours for production

class LeadContactAgent extends EventEmitter {
  constructor() {
    super(); // Call EventEmitter constructor
    this.isRunning = false;
    this.currentCycle = 0;
    this.currentStatus = 'idle'; // Track detailed status
    this.stateFile = path.join(process.cwd(), 'agent', 'leadAgent_state.json');
    this.leadsFile = path.join(process.cwd(), 'agent', 'leads_database.json');
    this.intervalId = null;
    this.cycleInProgress = false; // Prevent concurrent cycles
    
    // Progress tracking
    this.cycleProgress = {
      currentStep: 0,
      totalSteps: 0,
      stepDescription: '',
      percentage: 0
    };
    
    // Use default cycle interval based on configuration (can be overridden)
    this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
    this.customCycleInterval = null; // For user-defined intervals
    
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: "gpt-4o",
    });
    
    // BACKUP: Original hardcoded values (kept as fallbacks)
    this.fallbackTargetIndustries = [
      'artificial intelligence',
      'machine learning',
      'fintech',
      'healthcare tech',
      'autonomous vehicles',
      'robotics',
      'cryptocurrency',
      'computer vision',
      'natural language processing',
      'data analytics',
      'cloud computing',
      'gaming',
      'scientific research',
      'biotechnology',
      'pharmaceutical research'
    ];
    
    this.fallbackCompanyTypes = [
      'AI startups',
      'tech companies',
      'research institutions',
      'universities',
      'pharmaceutical companies',
      'financial services',
      'autonomous vehicle companies',
      'gaming companies',
      'data science companies',
      'machine learning companies'
    ];
    
    // Dynamic settings (loaded from user preferences)
    this.leadContactSettings = null;
    
    console.log(`[LEAD AGENT] Initialized Lead Contact Agent (PRODUCTION MODE)`);
    console.log(`[LEAD AGENT] Cycle interval: ${this.cycleInterval / (1000 * 60)} minutes`);
  }

  // Load Lead Contact Settings from user preferences
  async loadLeadContactSettings(userId = 'default') {
    try {
      console.log(`[LEAD AGENT] Loading Lead Contact Settings for user: ${userId}`);
      
      // Try to get the actual current user ID (this would come from session in a real app)
      // For now, we'll check if there's a specific user or use default
      let targetUserId = userId;
      
      // If no specific userId provided, try to find the most recent user
      if (userId === 'default') {
        try {
          // Always try to find an actual user ID from the settings file first
          const fs = await import('fs/promises');
          const path = await import('path');
          const settingsPath = path.join(process.cwd(), 'lib', 'data', 'user_settings.json');
          const settingsData = await fs.readFile(settingsPath, 'utf8');
          const allSettings = JSON.parse(settingsData);
          
          // Use the first user ID we find (should be the actual user)
          const userIds = Object.keys(allSettings);
          if (userIds.length > 0) {
            targetUserId = userIds[0];
            console.log(`[LEAD AGENT] ✅ Found actual user ID: ${targetUserId}`);
          } else {
            console.log(`[LEAD AGENT] ⚠️ No users found in settings file`);
          }
        } catch (error) {
          console.log(`[LEAD AGENT] ❌ Could not read settings file, using default:`, error.message);
        }
      }
      
      const userSettings = await getUserSettings(targetUserId);
      this.leadContactSettings = userSettings.leadContactSettings || null;
      
      if (this.leadContactSettings) {
        console.log(`[LEAD AGENT] ✅ Loaded custom Lead Contact Settings:`);
        console.log(`[LEAD AGENT] - Company size: ${this.leadContactSettings.companySizeMin || 'any'}-${this.leadContactSettings.companySizeMax || 'any'} employees`);
        console.log(`[LEAD AGENT] - Industries: ${this.leadContactSettings.companyIndustries?.length || 0} configured`);
        console.log(`[LEAD AGENT] - Target positions: ${this.leadContactSettings.targetPositions?.length || 0} configured`);
        console.log(`[LEAD AGENT] - Locations: ${this.leadContactSettings.targetLocations?.length || 0} configured`);
        console.log(`[LEAD AGENT] - Lead limit: ${this.leadContactSettings.leadLimit || 10}`);
      } else {
        console.log(`[LEAD AGENT] ⚠️ No custom Lead Contact Settings found, will use fallback values`);
      }
      
      return this.leadContactSettings;
    } catch (error) {
      console.error(`[LEAD AGENT] ❌ Error loading Lead Contact Settings:`, error.message);
      console.log(`[LEAD AGENT] 🔄 Falling back to hardcoded values`);
      this.leadContactSettings = null;
      return null;
    }
  }

  // Get target industries (from settings or fallback)
  getTargetIndustries() {
    if (this.leadContactSettings?.companyIndustries?.length > 0) {
      // Check if user wants general/broad search
      const industries = this.leadContactSettings.companyIndustries;
      const generalTerms = ['all', 'any', 'general', 'everything', 'various', 'mixed', 'diverse', 'broad'];
      
      // If user specified general terms, use hardcoded variety
      const hasGeneralTerm = industries.some(industry => 
        generalTerms.some(term => 
          industry.toLowerCase().includes(term.toLowerCase())
        )
      );
      
      if (hasGeneralTerm) {
        console.log(`[LEAD AGENT] 🌐 Detected general search intent, using diverse industry mix`);
        return this.fallbackTargetIndustries; // Use full hardcoded variety
      }
      
      return industries;
    }
    console.log(`[LEAD AGENT] Using fallback target industries (${this.fallbackTargetIndustries.length} items)`);
    return this.fallbackTargetIndustries;
  }

  // Get target positions (from settings or fallback)
  getTargetPositions() {
    if (this.leadContactSettings?.targetPositions?.length > 0) {
      // Check if user wants general/broad search for positions
      const positions = this.leadContactSettings.targetPositions;
      const generalTerms = ['all', 'any', 'general', 'everything', 'various', 'mixed', 'diverse', 'broad', 'all roles', 'any position'];
      
      // If user specified general terms, use hardcoded variety
      const hasGeneralTerm = positions.some(position => 
        generalTerms.some(term => 
          position.toLowerCase().includes(term.toLowerCase())
        )
      );
      
      if (hasGeneralTerm) {
        console.log(`[LEAD AGENT] 🌐 Detected general position search intent, using diverse role mix`);
        return this.fallbackCompanyTypes; // Use company types as diverse roles
      }
      
      return positions;
    }
    console.log(`[LEAD AGENT] Using fallback company types (${this.fallbackCompanyTypes.length} items)`);
    return this.fallbackCompanyTypes; // Use company types as fallback for positions
  }

  // Get target locations (from settings or fallback)
  getTargetLocations() {
    if (this.leadContactSettings?.targetLocations?.length > 0) {
      // Check if user wants general/broad search for locations
      const locations = this.leadContactSettings.targetLocations;
      const generalTerms = ['all', 'any', 'global', 'worldwide', 'everywhere', 'various', 'mixed', 'diverse', 'broad'];
      
      // If user specified general terms, use hardcoded variety
      const hasGeneralTerm = locations.some(location => 
        generalTerms.some(term => 
          location.toLowerCase().includes(term.toLowerCase())
        )
      );
      
      if (hasGeneralTerm) {
        console.log(`[LEAD AGENT] 🌐 Detected global search intent, using diverse location mix`);
        return this.getHardcodedLocations(); // Use hardcoded global locations
      }
      
      return locations;
    }
    return this.getHardcodedLocations();
  }

  // Hardcoded diverse locations for general searches
  getHardcodedLocations() {
    return [
      'United States',
      'Canada', 
      'United Kingdom',
      'Germany',
      'Australia',
      'San Francisco Bay Area',
      'New York',
      'London',
      'Toronto',
      'Berlin',
      'Singapore',
      'Tel Aviv'
    ];
  }

  // Determine if we should use random selection (for general/diverse searches)
  shouldUseRandomSelection() {
    if (!this.leadContactSettings) return true; // Default to random if no settings
    
    const generalTerms = ['all', 'any', 'general', 'various', 'diverse', 'mixed', 'broad', 'everything'];
    
    // Check industries
    const industries = this.leadContactSettings.companyIndustries || [];
    const hasGeneralIndustries = industries.some(industry => 
      generalTerms.some(term => industry.toLowerCase().includes(term.toLowerCase()))
    );
    
    // Check positions
    const positions = this.leadContactSettings.targetPositions || [];
    const hasGeneralPositions = positions.some(position => 
      generalTerms.some(term => position.toLowerCase().includes(term.toLowerCase()))
    );
    
    // Check locations
    const locations = this.leadContactSettings.targetLocations || [];
    const globalTerms = ['all', 'any', 'global', 'worldwide', 'everywhere', 'various', 'diverse', 'mixed', 'broad'];
    const hasGeneralLocations = locations.some(location => 
      globalTerms.some(term => location.toLowerCase().includes(term.toLowerCase()))
    );
    
    // Use random selection if any field indicates general/diverse intent
    const shouldRandomize = hasGeneralIndustries || hasGeneralPositions || hasGeneralLocations;
    
    if (shouldRandomize) {
      console.log(`[LEAD AGENT] 🌐 Detected general search terms - will use randomization for diversity`);
    } else {
      console.log(`[LEAD AGENT] 🎯 Detected specific search terms - will use sequential targeting`);
    }
    
    return shouldRandomize;
  }

  // Build dynamic search query based on settings
  buildSearchQuery(industry, targetPosition) {
    const targetLocations = this.getTargetLocations();
    
    let query = `companies in ${industry}`;
    
    // Add company size filter
    if (this.leadContactSettings?.companySizeMin || this.leadContactSettings?.companySizeMax) {
      const minSize = this.leadContactSettings.companySizeMin || 1;
      const maxSize = this.leadContactSettings.companySizeMax || 10000;
      query += ` with ${minSize} to ${maxSize} employees`;
    }
    
    // Add technology keywords (check for general terms)
    if (this.leadContactSettings?.companyKeywords?.length > 0) {
      const keywords = this.leadContactSettings.companyKeywords;
      const generalTerms = ['all', 'any', 'various', 'diverse', 'mixed'];
      const hasGeneralKeywords = keywords.some(keyword => 
        generalTerms.some(term => keyword.toLowerCase().includes(term.toLowerCase()))
      );
      
      if (hasGeneralKeywords) {
        // Use diverse hardcoded tech stack for general searches
        const diverseTech = ['AI', 'CRM', 'sales automation', 'marketing tools', 'data analytics', 'cloud computing'];
        const randomTech = diverseTech.slice(0, 3).join(', ');
        query += ` using technologies like ${randomTech}`;
        console.log(`[LEAD AGENT] 🌐 Using diverse tech keywords: ${randomTech}`);
      } else {
        const specificKeywords = keywords.slice(0, 3).join(', ');
        query += ` using technologies like ${specificKeywords}`;
      }
    }
    
    // Add target position context
    query += ` that would need ExaMark's AI sales automation tools, looking for contacts in ${targetPosition} roles`;
    
    // Add location filter (use random location if general terms detected)
    if (targetLocations.length > 0) {
      // If we detected general location terms, pick random locations for variety
      const generalTerms = ['all', 'any', 'global', 'worldwide', 'everywhere'];
      const userLocations = this.leadContactSettings?.targetLocations || [];
      const hasGeneralLocation = userLocations.some(location => 
        generalTerms.some(term => location.toLowerCase().includes(term.toLowerCase()))
      );
      
      if (hasGeneralLocation || targetLocations.length > 8) { // If using hardcoded locations
        // Pick random location for variety
        const randomLocation = targetLocations[Math.floor(Math.random() * targetLocations.length)];
        query += ` located in ${randomLocation}`;
        console.log(`[LEAD AGENT] 🌐 Using random location for variety: ${randomLocation}`);
      } else {
        // Use first specified location
        query += ` located in ${targetLocations[0]}`;
      }
    }
    
    // Add intent signals (check for general terms)
    if (this.leadContactSettings?.contactIntent?.length > 0) {
      const intents = this.leadContactSettings.contactIntent;
      const generalTerms = ['all', 'any', 'various', 'diverse', 'mixed'];
      const hasGeneralIntent = intents.some(intent => 
        generalTerms.some(term => intent.toLowerCase().includes(term.toLowerCase()))
      );
      
      if (hasGeneralIntent) {
        // Use diverse intent signals for general searches
        const diverseIntents = ['hiring', 'expansion', 'digital transformation', 'automation', 'growth', 'funding'];
        const randomIntents = diverseIntents.slice(0, 2).join(' or ');
        query += ` showing signs of ${randomIntents}`;
        console.log(`[LEAD AGENT] 🌐 Using diverse intent signals: ${randomIntents}`);
      } else {
        const specificIntents = intents.slice(0, 2).join(' or ');
        query += ` showing signs of ${specificIntents}`;
      }
    }
    
    // Fallback to original query if no settings
    if (!this.leadContactSettings) {
      query = `companies in ${industry} that would need high-performance GPU computing for AI and machine learning workloads, specifically ${targetPosition}`;
    }
    
    console.log(`[LEAD AGENT] Built search query: ${query}`);
    return query;
  }

  // Set custom cycle interval in minutes
  async setCycleInterval(minutes) {
    if (typeof minutes !== 'number' || minutes <= 0) {
      throw new Error('Cycle interval must be a positive number of minutes');
    }
    
    this.customCycleInterval = minutes * 60 * 1000; // Convert to milliseconds
    this.cycleInterval = this.customCycleInterval;
    
    console.log(`[LEAD AGENT] Custom cycle interval set to ${minutes} minutes`);
    
    // Save state immediately to persist custom interval
    await this.saveState();
    
    // If agent is running, restart with new interval
    if (this.isRunning && this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = setTimeout(async () => {
        if (this.isRunning) {
          await this.runCycle();
        }
      }, this.cycleInterval);
      
      console.log(`[LEAD AGENT] Updated running agent with new ${minutes}-minute interval`);
    }
    
    return {
      success: true,
      message: `Cycle interval set to ${minutes} minutes`,
      intervalMinutes: minutes,
      nextCycleIn: this.isRunning ? `${minutes} minutes from last cycle completion` : 'Agent not running'
    };
  }

  // Reset to default cycle interval
  async resetCycleInterval() {
    this.customCycleInterval = null;
    this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
    
    const defaultMinutes = this.cycleInterval / (1000 * 60);
    console.log(`[LEAD AGENT] Reset to default cycle interval: ${defaultMinutes} minutes`);
    
    // Save state immediately to persist reset
    await this.saveState();
    
    // If agent is running, restart with default interval
    if (this.isRunning && this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = setTimeout(async () => {
        if (this.isRunning) {
          await this.runCycle();
        }
      }, this.cycleInterval);
      
      console.log(`[LEAD AGENT] Updated running agent with default ${defaultMinutes}-minute interval`);
    }
    
    return {
      success: true,
      message: `Reset to default cycle interval: ${defaultMinutes} minutes`,
      intervalMinutes: defaultMinutes,
      nextCycleIn: this.isRunning ? `${defaultMinutes} minutes from last cycle completion` : 'Agent not running'
    };
  }

  async start(customMinutes = null) {
    if (this.isRunning) {
      console.log('[LEAD AGENT] Agent is already running');
      return { success: false, message: 'Agent is already running' };
    }

    try {
      // Set custom interval if provided
      if (customMinutes !== null) {
        this.setCycleInterval(customMinutes);
      }
      
      // Just load the cycle count and status, don't call loadState() as it resets intervals
      let wasPausedForLeads = false;
      try {
        const data = await fs.readFile(this.stateFile, 'utf8');
        const state = JSON.parse(data);
        this.currentCycle = state.currentCycle || 0;
        this.currentStatus = state.currentStatus || 'idle';
        wasPausedForLeads = (state.currentStatus === 'paused_no_leads');
      } catch (error) {
        // No state file, start fresh
        this.currentCycle = 0;
        this.currentStatus = 'idle';
      }
      
      this.isRunning = true;
      this.currentStatus = 'starting';
      
      if (wasPausedForLeads) {
        console.log('[LEAD AGENT] 🔄 Resuming agent after lead exhaustion - will attempt new research...');
      } else {
        console.log('[LEAD AGENT] 🚀 Starting Lead Contact Agent...');
      }
      
      // Save state immediately to reflect running status
      await this.saveState();
      
      // Run first cycle immediately - subsequent cycles will be scheduled automatically
      await this.runCycle();
      
      // Update status after first cycle
      this.currentStatus = 'waiting_next_cycle';
      await this.saveState();
      
      const intervalMinutes = this.cycleInterval / (1000 * 60);
      
      return { 
        success: true, 
        message: `Lead Contact Agent started. Cycle ${this.currentCycle} completed. Next cycle in ${intervalMinutes} minutes.`,
        currentCycle: this.currentCycle,
        nextCycleIn: `${intervalMinutes} minutes`,
        intervalMinutes: intervalMinutes,
        customInterval: this.customCycleInterval !== null,
        testingMode: false
      };
      
    } catch (error) {
      console.error('[LEAD AGENT] Error starting agent:', error);
      this.isRunning = false;
      this.currentStatus = 'error';
      await this.saveState();
      return { success: false, message: `Error starting agent: ${error.message}` };
    }
  }

  async stop() {
    console.log('[LEAD AGENT] 🛑 Stopping Lead Contact Agent...');
    
    // Set stopping flag first to prevent new cycles from starting
    this.isRunning = false;
    this.currentStatus = 'stopping';
    
    // Clear any scheduled intervals
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      console.log('[LEAD AGENT] ✅ Cleared cycle timer');
    }
    
    // If a cycle is in progress, wait for it to complete or force stop after timeout
    if (this.cycleInProgress) {
      console.log('[LEAD AGENT] ⏳ Cycle in progress, waiting for completion...');
      
      // Wait up to 30 seconds for cycle to complete naturally
      let waitTime = 0;
      const maxWaitTime = 30000; // 30 seconds
      const checkInterval = 1000; // 1 second
      
      while (this.cycleInProgress && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
      }
      
      // If cycle is still in progress after timeout, force stop
      if (this.cycleInProgress) {
        console.log('[LEAD AGENT] ⚠️ Force stopping cycle after timeout');
        this.cycleInProgress = false;
      } else {
        console.log('[LEAD AGENT] ✅ Cycle completed naturally');
      }
    }
    
    this.currentStatus = 'stopped';
    await this.saveState();
    
    console.log('[LEAD AGENT] ✅ Lead Contact Agent stopped successfully');
    return { 
      success: true, 
      message: 'Lead Contact Agent stopped successfully',
      cyclesCompleted: this.currentCycle
    };
  }

  async getStatus() {
    // Don't call loadState() here as it resets intervals - just read the file
    let state;
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      state = JSON.parse(data);
    } catch (error) {
      state = {
        currentCycle: 0,
        isRunning: false,
        currentStatus: 'idle',
        lastCycleTime: null,
        customCycleInterval: null
      };
    }
    
    const leadsData = await this.loadLeadsDatabase();
    
    const totalLeads = leadsData.allLeads?.length || 0;
    const emailedLeads = leadsData.emailedCompanies?.length || 0;
    const remainingLeads = totalLeads - emailedLeads;
    const intervalMinutes = this.cycleInterval / (1000 * 60);
    
    return {
      isRunning: this.isRunning,
      currentCycle: this.currentCycle,
      currentStatus: this.currentStatus,
      totalLeadsFound: totalLeads,
      emailQueueNote: "Go to Email Queue tab to approve pending emails",
      remainingLeads: remainingLeads,
      lastCycleTime: state.lastCycleTime,
      nextCycleTime: state.lastCycleTime ? new Date(state.lastCycleTime + this.cycleInterval).toISOString() : null,
      intervalMinutes: intervalMinutes,
      customInterval: this.customCycleInterval !== null,
      isPausedForLeads: this.currentStatus === 'paused_no_leads',
      statusMessage: this.currentStatus === 'paused_no_leads' ? 
        'Agent paused - no available leads found. Start again to resume research.' : 
        null,
      // Progress tracking
      progress: {
        ...this.cycleProgress,
        isActive: this.isRunning && (this.currentStatus === 'running_cycle' || 
                                   this.currentStatus === 'researching_leads' || 
                                   this.currentStatus === 'selecting_leads' || 
                                   this.currentStatus === 'generating_emails')
      }
    };
  }

  updateProgress(currentStep, totalSteps, stepDescription) {
    // Calculate the base step percentage
    const basePercentage = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
    
    // Always update step tracking and description
    this.cycleProgress.currentStep = currentStep;
    this.cycleProgress.totalSteps = totalSteps;
    this.cycleProgress.stepDescription = stepDescription;
    
    // Only update percentage if it's higher than current (preserve fluid progress)
    if (basePercentage >= this.cycleProgress.percentage) {
      this.cycleProgress.percentage = basePercentage;
    }
    
    console.log(`[LEAD AGENT] 📊 Progress: ${this.cycleProgress.percentage}% - ${stepDescription}`);
    
    // Emit progress event for real-time updates
    this.emit('progress', {
      ...this.cycleProgress,
      isActive: this.isRunning && (this.currentStatus === 'running_cycle' || 
                                 this.currentStatus === 'researching_leads' || 
                                 this.currentStatus === 'selecting_leads' || 
                                 this.currentStatus === 'generating_emails')
    });
  }

  updateFluidProgress(description, subProgress = 0) {
    // Update description
    this.cycleProgress.stepDescription = description;
    
    if (subProgress > 0) {
      // Calculate blended progress more smoothly
      const baseProgress = this.cycleProgress.totalSteps > 0 ? 
        (this.cycleProgress.currentStep / this.cycleProgress.totalSteps) : 0;
      const stepSize = this.cycleProgress.totalSteps > 0 ? (1 / this.cycleProgress.totalSteps) : 1;
      const fluidProgress = baseProgress + (stepSize * (subProgress / 100));
      const newPercentage = Math.round(fluidProgress * 100);
      
      // Ensure progress only moves forward and caps at 100%
      this.cycleProgress.percentage = Math.min(Math.max(this.cycleProgress.percentage, newPercentage), 100);
    }
    
    console.log(`[LEAD AGENT] 📊 Progress: ${this.cycleProgress.percentage}% - ${description}`);
    
    // Emit progress event for real-time updates
    this.emit('progress', {
      ...this.cycleProgress,
      isActive: this.isRunning && (this.currentStatus === 'running_cycle' || 
                                 this.currentStatus === 'researching_leads' || 
                                 this.currentStatus === 'selecting_leads' || 
                                 this.currentStatus === 'generating_emails')
    });
  }

  async runCycle() {
    // Prevent concurrent cycles
    if (this.cycleInProgress) {
      console.log(`[LEAD AGENT] ⏸️ Cycle already in progress, skipping...`);
      return;
    }
    
    this.cycleInProgress = true;
    console.log(`[LEAD AGENT] 🚀 Starting cycle ${this.currentCycle + 1}`);
    
    try {
      // Initialize progress tracking
      this.updateProgress(0, 6, 'Initializing cycle...');
      
      // Update status to running
      this.currentStatus = 'running_cycle';
      await this.saveState();
      
      // Step 1: Load existing leads database
      this.updateProgress(1, 6, 'Loading leads database...');
      console.log(`[LEAD AGENT] 📊 Loading leads database...`);
      let leadsData = await this.loadLeadsDatabase();
      
      // Check if stop was requested
      if (!this.isRunning) {
        console.log('[LEAD AGENT] 🛑 Stop requested during leads loading');
        return { success: true, stopped: true };
      }
      
      // Step 2: If we need more leads, research new ones
      const availableLeads = this.getAvailableLeads(leadsData);
      
      if (availableLeads.length < 5) {
        this.updateProgress(2, 6, 'Researching new leads...');
        console.log('[LEAD AGENT] 🔍 Need more leads, starting research...');
        this.currentStatus = 'researching_leads';
        await this.saveState();
        
        const newLeads = await this.researchNewLeads();
        leadsData = await this.addNewLeads(newLeads);
        console.log(`[LEAD AGENT] ✅ Research complete, found ${newLeads.length} new leads`);
        
        // Check if we still have no leads after research
        const updatedAvailableLeads = this.getAvailableLeads(leadsData);
        if (updatedAvailableLeads.length === 0) {
          this.updateProgress(6, 6, 'No leads found - pausing...');
          console.log('[LEAD AGENT] 🚫 No leads available after research - pausing agent');
          await this.pauseForLeadExhaustion();
          return {
            success: true,
            cycle: this.currentCycle,
            paused: true,
            reason: 'No available leads found after research',
            message: 'Agent paused - no leads available. Start agent again to resume research.'
          };
        }
      } else {
        this.updateProgress(2, 6, 'Sufficient leads available, skipping research...');
      }
      
      // Step 3: Select top 5 leads for this cycle
      this.updateProgress(3, 6, 'Selecting top leads for outreach...');
      console.log(`[LEAD AGENT] 🎯 Selecting top leads for outreach...`);
      this.currentStatus = 'selecting_leads';
      await this.saveState();
      
      // Check if stop was requested
      if (!this.isRunning) {
        console.log('[LEAD AGENT] 🛑 Stop requested during lead selection');
        return { success: true, stopped: true };
      }
      
      this.updateFluidProgress('Analyzing lead scores and rankings...', 92);
      const selectedLeads = this.selectTopLeads(leadsData, 5);
      this.updateFluidProgress('Top leads selected for outreach', 95);
      
      console.log(`[LEAD AGENT] Selected ${selectedLeads.length} leads for cycle ${this.currentCycle + 1}:`);
      selectedLeads.forEach((lead, index) => {
        console.log(`[LEAD AGENT] ${index + 1}. ${lead.company} - ${lead.name} (${lead.title}) - Score: ${lead.score}`);
      });
      
      // Step 4: Email the selected leads
      this.updateProgress(4, 6, 'Generating and queueing emails...');
      console.log(`[LEAD AGENT] 📧 Generating and queueing emails...`);
      this.currentStatus = 'generating_emails';
      await this.saveState();
      
      // Check if stop was requested before emailing
      if (!this.isRunning) {
        console.log('[LEAD AGENT] 🛑 Stop requested before email generation');
        return { success: true, stopped: true };
      }
      
      const emailResults = await this.emailSelectedLeads(selectedLeads);
      
      // Step 5: Update database with emailed companies
      this.updateProgress(5, 6, 'Updating database...');
      this.updateFluidProgress('Marking leads as emailed in database...', 97);
      await this.markLeadsAsEmailed(selectedLeads);
      this.updateFluidProgress('Database updated successfully', 99);
      
      // Check if stop was requested
      if (!this.isRunning) {
        console.log('[LEAD AGENT] 🛑 Stop requested during database update');
        return { success: true, stopped: true };
      }
      
      // Step 6: Update cycle counter and state
      this.updateProgress(6, 6, 'Finalizing cycle...');
      this.updateFluidProgress('Saving cycle state and preparing for next cycle...', 100);
      this.currentCycle++;
      this.currentStatus = 'waiting_next_cycle';
      await this.saveState();
      
      // Brief pause to show 100% completion before reset
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reset progress
      this.updateProgress(0, 0, 'Cycle completed');
      
      console.log(`[LEAD AGENT] 🎯 Cycle ${this.currentCycle} completed successfully!`);
      console.log(`[LEAD AGENT] 📧 Emails queued for approval: ${emailResults.queued}`);
      console.log(`[LEAD AGENT] ❌ Processing failed: ${emailResults.failed}`);
      console.log(`[LEAD AGENT] 📅 Next cycle in ${this.cycleInterval / (1000 * 60)} minutes`);
      
      return {
        success: true,
        cycle: this.currentCycle,
        emailsQueued: emailResults.queued,
        emailsFailed: emailResults.failed,
        selectedCompanies: selectedLeads.map(lead => lead.company)
      };
      
    } catch (error) {
      console.error(`[LEAD AGENT] ❌ Error in cycle ${this.currentCycle + 1}:`, error);
      this.currentStatus = 'error';
      this.updateProgress(0, 0, 'Error occurred');
      await this.saveState();
      return {
        success: false,
        error: error.message
      };
    } finally {
      // Always clear the cycle-in-progress flag and schedule next cycle
      this.cycleInProgress = false;
      
      // Schedule next cycle only if agent is still running
      if (this.isRunning) {
        console.log(`[LEAD AGENT] ⏰ Scheduling next cycle in ${this.cycleInterval / (1000 * 60)} minutes...`);
        this.intervalId = setTimeout(async () => {
          if (this.isRunning) {
            await this.runCycle();
          }
        }, this.cycleInterval);
      }
    }
  }

  async researchNewLeads() {
    console.log('[LEAD AGENT] Researching new leads...');
    
    // Load user settings before starting research
    this.updateFluidProgress('⚙️ Loading Lead Contact Settings...', 2);
    await this.loadLeadContactSettings();
    
    // Work within the existing progress framework - research is step 2 out of 6
    // We'll use sub-progress within this step rather than overriding the main progress
    
    const allLeads = [];
    const targetIndustries = this.getTargetIndustries();
    const targetPositions = this.getTargetPositions();
    
    // Use settings or fallback values
    const leadLimit = this.leadContactSettings?.leadLimit || 20;
    const totalSearches = Math.min(3, targetIndustries.length); // Limit to 3 searches max
    
    this.updateFluidProgress('🚀 Initializing research pipeline...', 5);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.updateFluidProgress(`📋 Loaded ${targetIndustries.length} industries, ${targetPositions.length} positions`, 10);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Research multiple industries/positions based on settings
    for (let i = 0; i < totalSearches; i++) {
      // Check if we should use random selection (for general/diverse searches)
      const shouldRandomize = this.shouldUseRandomSelection();
      
      let industry, targetPosition;
      
      if (shouldRandomize) {
        // Use random selection for variety in general searches
        industry = targetIndustries[Math.floor(Math.random() * targetIndustries.length)];
        targetPosition = targetPositions[Math.floor(Math.random() * targetPositions.length)];
        console.log(`[LEAD AGENT] 🎲 Using random selection for diverse search`);
      } else {
        // Use sequential selection for specific searches
        industry = targetIndustries[i % targetIndustries.length];
        targetPosition = targetPositions[i % targetPositions.length];
        console.log(`[LEAD AGENT] 🎯 Using sequential selection for targeted search`);
      }
      
      const baseProgress = 10 + (i * 25); // Distribute 75% across searches (25% each)
      
      this.updateFluidProgress(`🎯 Research focus: ${industry} - ${targetPosition}`, baseProgress);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      this.updateFluidProgress(`🔍 [${i+1}/${totalSearches}] Connecting to Apollo API...`, baseProgress + 5);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log(`[LEAD AGENT] Researching: ${industry} - ${targetPosition}`);
      
      // Use dynamic query builder instead of hardcoded query
      const query = this.buildSearchQuery(industry, targetPosition);
      
      this.updateFluidProgress(`📡 Executing search query for ${industry}...`, baseProgress + 10);
      
      try {
        const researchResult = await leadResearch(query, { 
          limit: leadLimit,
          researchFocus: this.leadContactSettings?.researchFocus?.split('\n').map(line => line.replace(/^-\s*/, '').trim()).filter(line => line.length > 0),
          leadContactSettings: this.leadContactSettings
        }, null); // userId = null, will fall back to environment variables
        
        this.updateFluidProgress(`📊 Processing Apollo API response...`, baseProgress + 15);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`[LEAD AGENT] Raw research result:`, researchResult?.length || 0, 'items');
        
        if (researchResult && researchResult.length > 0) {
          this.updateFluidProgress(`✅ Found ${researchResult.length} potential leads in ${industry}`, baseProgress + 20);
          console.log(`[LEAD AGENT] Found ${researchResult.length} leads for ${industry}`);
          allLeads.push(...researchResult);
          
          this.updateFluidProgress(`💾 Adding ${researchResult.length} leads to research pool...`, baseProgress + 22);
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          this.updateFluidProgress(`⚠️ No leads found in ${industry} market`, baseProgress + 20);
          console.log(`[LEAD AGENT] No leads found for ${industry} --> ${query}`);
        }
        
        this.updateFluidProgress(`⏱️ Cooling down API calls (rate limiting)...`, baseProgress + 25);
        // Add delay between searches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        this.updateFluidProgress(`❌ Error searching ${industry}: ${error.message}`, baseProgress + 25);
        console.error(`[LEAD AGENT] Error researching ${industry}:`, error);
      }
    }
    
    // Process and extract lead information from research results
    this.updateFluidProgress(`🔄 Starting lead processing pipeline...`, 85);
    this.updateFluidProgress(`🔍 Analyzing ${allLeads.length} research results for duplicates...`, 87);
    console.log(`[LEAD AGENT] Processing ${allLeads.length} research results into leads...`);
    const processedLeads = await this.processLeadsFromResearch(allLeads);
    
    // Rank and score the leads
    this.updateFluidProgress(`📊 Initializing lead scoring algorithm...`, 90);
    this.updateFluidProgress(`🎯 Calculating lead quality scores...`, 92);
    const rankedLeads = await this.rankLeads(processedLeads);
    
    this.updateFluidProgress(`🔍 Finalizing lead verification...`, 95);
    this.updateFluidProgress(`✅ Research pipeline complete - ${rankedLeads.length} qualified leads ready`, 98);
    console.log(`[LEAD AGENT] Research complete. Found ${rankedLeads.length} total leads`);
    console.log(`[LEAD AGENT] Sample lead data:`, rankedLeads[0] ? JSON.stringify(rankedLeads[0], null, 2) : 'No leads found');
    return rankedLeads;
  }

  async processLeadsFromResearch(researchResults) {
    const processedLeads = [];
    const seenEmails = new Set(); // Track unique emails to avoid duplicates
    const seenCompanies = new Set(); // Track unique companies to avoid duplicates
    
    console.log(`[LEAD AGENT] Processing ${researchResults.length} research results (removing duplicates)...`);
    
    for (let i = 0; i < researchResults.length; i++) {
      const result = researchResults[i];
      
      // Update progress for each research result being processed
      const progressPercent = Math.round((i / researchResults.length) * 10) + 87; // Between 87-97%
      this.updateFluidProgress(`🔍 Processing research result ${i + 1}/${researchResults.length}...`, progressPercent);
      
      try {
        // Extract company and contact info from the search result
        const lead = this.extractLeadInfo(result);
        if (lead && lead.company && lead.name && lead.email) {
          
          // Create unique identifiers for deduplication
          const emailKey = lead.email.toLowerCase();
          const companyKey = `${lead.company}-${lead.name}`.toLowerCase();
          
          // Skip if we've already seen this email or person-company combination
          if (seenEmails.has(emailKey)) {
            console.log(`[LEAD AGENT] 🔄 Skipping duplicate email: ${lead.email} (${lead.name} at ${lead.company})`);
            continue;
          }
          
          if (seenCompanies.has(companyKey)) {
            console.log(`[LEAD AGENT] 🔄 Skipping duplicate person-company: ${lead.name} at ${lead.company}`);
            continue;
          }
          
          // Add to tracking sets
          seenEmails.add(emailKey);
          seenCompanies.add(companyKey);
          
          processedLeads.push(lead);
          
          // Update progress for each unique lead found
          this.updateFluidProgress(`✅ Found lead #${processedLeads.length}: ${lead.name} at ${lead.company}`, progressPercent);
          console.log(`[LEAD AGENT] ✅ Added unique lead: ${lead.name} at ${lead.company} (${lead.email})`);
          
          // Small delay to show progress update
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.log(`[LEAD AGENT] Failed to process lead: ${error.message}`);
      }
    }
    
    this.updateFluidProgress(`🎯 Deduplication complete: ${processedLeads.length} unique leads found`, 97);
    console.log(`[LEAD AGENT] Deduplication complete: ${researchResults.length} → ${processedLeads.length} unique leads`);
    return processedLeads;
  }

  extractLeadInfo(result) {
    // Check if this is a structured Apollo result (new leadResearch.js format)
    if (result && result.name && result.organization) {
      console.log(`[LEAD AGENT] Processing structured Apollo lead: ${result.name} at ${result.organization.name}`);
      
      // Check if this lead has been enhanced with intelligence data
      const hasIntelligence = result.intelligence && result.intelligence.analysis;
      const hasPersonalization = result.personalization;
      
      if (hasIntelligence && hasPersonalization) {
        console.log(`[LEAD AGENT] ✨ Found enhanced lead with intelligence data: ${result.organization.name}`);
      }
      
      return {
        name: result.name || 'Unknown Contact',
        first_name: result.first_name || result.name?.split(' ')[0] || 'Unknown',
        last_name: result.last_name || result.name?.split(' ').slice(1).join(' ') || 'Unknown',
        title: result.title || 'Unknown Title',
        company: result.organization.name || 'Unknown Company',
        email: result.email || 'email_needed@example.com',
        source: 'Apollo',
        url: result.linkedin_url || '',
        snippet: `${result.title} at ${result.organization.name}`,
        score: 10,
        industry: result.organization.industry || 'Technology',
        // Preserve enhanced intelligence and personalization data
        intelligence: result.intelligence || null,
        personalization: result.personalization || null,
        verification: result.verification || null
      };
    }
    
    // Legacy text-based parsing for other sources
    const title = result.title || '';
    const snippet = result.snippet || '';
    const url = result.url || '';
    
    // Check if this is an Apollo result (has more structured data)
    if (result.source === 'Apollo') {
      console.log(`[LEAD AGENT] Processing Apollo lead:`, title);
      
      // Apollo results are already structured - extract the info
      const apolloMatch = snippet.match(/🎯\s+(.+?)\s+at\s+(.+?)\s+\((.+?)\)/);
      if (apolloMatch) {
        const jobTitle = apolloMatch[1];
        const company = apolloMatch[2];
        const industry = apolloMatch[3];
        
        // Extract name from title (format: "FirstName LastName - JobTitle")
        const nameMatch = title.match(/^(.+?)\s+-\s+(.+)/);
        const name = nameMatch ? nameMatch[1] : 'Unknown Contact';
        
        // Extract email from snippet
        const emailMatch = snippet.match(/📧\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const email = emailMatch ? emailMatch[1] : null;
        
        return {
          name: name,
          title: jobTitle,
          company: company,
          email: email || 'email_needed@example.com',
          source: 'Apollo',
          url: url,
          snippet: snippet.substring(0, 200),
          score: 0,
          industry: industry,
          // Preserve enhanced intelligence and personalization data if available
          intelligence: result.intelligence || null,
          personalization: result.personalization || null,
          verification: result.verification || null
        };
      }
    }
    
    // Extract name from title (commonly "Name - Title at Company" format)
    let name = 'Unknown Contact';
    let jobTitle = 'Unknown Title';
    let company = 'Unknown Company';
    let email = '';
    
    // Pattern 1: "John Doe - CTO at TechCorp"
    const pattern1 = title.match(/(.+?)\s*[-–]\s*(.+?)\s*at\s*(.+)/i);
    if (pattern1) {
      name = pattern1[1].trim();
      jobTitle = pattern1[2].trim();
      company = pattern1[3].trim();
    }
    
    // Pattern 2: "CTO | TechCorp" or "John Doe | CTO | TechCorp"
    const pattern2 = title.match(/(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)/i);
    if (pattern2) {
      name = pattern2[1].trim();
      jobTitle = pattern2[2].trim();
      company = pattern2[3].trim();
    }
    
    // Pattern 3: Extract from snippet if title parsing failed
    if (name === 'Unknown Contact') {
      const snippetPattern = snippet.match(/(CTO|CEO|VP|Director|Head|Chief).*?at\s+([A-Za-z0-9\s&.,]+)/i);
      if (snippetPattern) {
        jobTitle = snippetPattern[1];
        company = snippetPattern[2].trim();
        name = `${jobTitle} Contact`;
      }
    }
    
    // Extract email if present in snippet
    const emailMatch = snippet.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      email = emailMatch[1];
    }
    
    // Clean up company name
    company = company.replace(/\s*[-|].*$/, '').trim(); // Remove everything after - or |
    company = company.replace(/\s*\.\.\.$/, '').trim(); // Remove trailing ...
    
    return {
      name: name,
      title: jobTitle,
      company: company,
      email: email || 'email_needed@example.com', // Placeholder for testing
      source: result.source || 'WebSearch',
      url: url,
      snippet: snippet.substring(0, 200), // Truncate for storage
      score: 0, // Will be calculated later
      // Preserve enhanced intelligence and personalization data if available
      intelligence: result.intelligence || null,
      personalization: result.personalization || null,
      verification: result.verification || null
    };
  }

  async rankLeads(leads) {
    console.log('[LEAD AGENT] Ranking leads...');
    
    // Score leads based on multiple factors with progress tracking
    const scoredLeads = [];
    
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      let score = 0;
      
      // Prioritize leads with intelligence data
      if (lead.intelligence && lead.intelligence.analysis) {
        console.log(`[LEAD AGENT] 🧠 Found intelligence data for ${lead.company} - boosting score`);
        score += 50; // Major boost for enhanced leads
        
        // Add opportunity score from intelligence
        if (lead.intelligence.analysis.opportunityScore) {
          score += Math.round(lead.intelligence.analysis.opportunityScore / 2); // Scale 100 -> 50
        }
      }
      
      // Verification status boost
      if (lead.verification && lead.verification.isVerified) {
        score += 20;
        console.log(`[LEAD AGENT] ✅ Verified company ${lead.company} - boosting score`);
      }
      
      // Company size scoring (prefer mid-size to large companies)
      if (lead.employee_count) {
        if (lead.employee_count >= 50 && lead.employee_count <= 1000) score += 20;
        else if (lead.employee_count > 1000) score += 15;
        else if (lead.employee_count >= 20) score += 10;
      }
      
      // Industry relevance scoring - use custom research focus if available
      let industryKeywords = ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'gpu', 'computing', 'data science', 'research', 'tech'];
      
      // Override with user's custom research focus if available
      if (this.leadContactSettings?.researchFocus?.length > 0) {
        // Convert research focus string to array (split by newlines and clean up)
        const researchFocusArray = this.leadContactSettings.researchFocus
          .split('\n')
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(line => line.length > 0);
        
        industryKeywords = researchFocusArray.map(topic => topic.toLowerCase());
        console.log(`[LEAD AGENT] 🎯 Using custom research focus: ${researchFocusArray.join(', ')}`);
      }
      
      const description = (lead.company_description || '').toLowerCase();
      industryKeywords.forEach(keyword => {
        if (description.includes(keyword)) score += 5;
      });
      
      // Title relevance scoring
      const titleKeywords = ['cto', 'ceo', 'vp', 'director', 'head', 'chief', 'founder', 'lead', 'senior'];
      const title = (lead.title || '').toLowerCase();
      titleKeywords.forEach(keyword => {
        if (title.includes(keyword)) score += 3;
      });
      
      // Email availability
      if (lead.email) score += 10;
      
      // Recent funding or growth indicators
      if (description.includes('funding') || description.includes('series') || description.includes('raised')) score += 5;
      
      const scoredLead = {
        ...lead,
        score: score
      };
      
      scoredLeads.push(scoredLead);
      
      // Emit progress update for each lead scored
      const progressPercent = Math.round(((i + 1) / leads.length) * 100);
      const companyName = lead.company || lead.organization?.name || 'Unknown Company';
      this.emit('progress', {
        stage: 'ranking',
        percent: progressPercent,
        message: `📊 Scored lead ${i + 1}/${leads.length}: ${companyName} (Score: ${score})`
      });
      
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Sort by score descending
    const sortedLeads = scoredLeads.sort((a, b) => b.score - a.score);
    
    // Final progress update
    this.emit('progress', {
      stage: 'ranking',
      percent: 100,
      message: `✅ Ranked ${leads.length} leads by opportunity score`
    });
    
    return sortedLeads;
  }

  async generatePersonalizedEmail(lead) {
    console.log(`[LEAD AGENT] Generating hyper-personalized email for ${lead.company || lead.organization?.name}`);
    
    // Check if we have enhanced intelligence data
    const hasIntelligence = lead.intelligence && lead.intelligence.analysis;
    const hasPersonalization = lead.personalization;
    
    if (hasIntelligence && hasPersonalization) {
      console.log(`[LEAD AGENT] 🧠 Using AI intelligence & personalization for ${lead.company}`);
      return this.generateIntelligentEmail(lead);
    } else {
      console.log(`[LEAD AGENT] ⚠️ No intelligence data available, using fallback for ${lead.company}`);
      return this.generateFallbackEmail(lead);
    }
  }

  async generateIntelligentEmail(lead) {
    const company = lead.company || lead.organization?.name;
    const person = lead.name || `${lead.first_name} ${lead.last_name}`;
    const intelligence = lead.intelligence?.analysis;
    const personalization = lead.personalization;
    
    console.log(`[LEAD AGENT] 🎯 Generating AI-powered email for ${person} at ${company}`);
    console.log(`[LEAD AGENT] 📊 Opportunity Score: ${intelligence?.opportunityScore || 'Unknown'}/100`);
    
    // Build enhanced intelligence context from the deep research
    let intelligenceContext = '';
    let salesRecommendations = '';
    
    if (intelligence) {
      // Add company analysis insights
      intelligenceContext = `\nDEEP COMPANY INTELLIGENCE:
- Opportunity Score: ${intelligence.opportunityScore}/100
- AI Readiness: ${intelligence.aiReadiness || 'Unknown'}
- Growth Signals: ${intelligence.growthSignals?.length || 0} indicators found`;
      
      if (intelligence.growthSignals?.length > 0) {
        intelligenceContext += `\n- Recent Growth: ${intelligence.growthSignals.slice(0, 2).join(', ')}`;
      }
    }
    
    if (personalization) {
      // Add personalization insights
      salesRecommendations = `\nPERSONALIZATION DATA:
- Specific Mentions: ${personalization.specificMentions?.recentNews || 'None'}
- Company Initiatives: ${personalization.specificMentions?.companyInitiatives || 'None'}
- Suggested Value Props: ${personalization.valuePropositions?.[0] || 'Standard AI-HPC value'}`;
    }
    
    // Use the custom email builder prompt if available, otherwise use default
    let emailPrompt = '';
    
    // Try to get custom email builder prompt from user settings
    try {
      if (this.leadContactSettings?.emailBuilderPrompt) {
        // Use custom prompt with template variable replacement and context injection
        let customPrompt = this.leadContactSettings.emailBuilderPrompt;
        
        // Replace template variables with user-configured branding or ExaMark defaults
        const branding = this.leadContactSettings?.companyBranding || {};
        const templateVariables = {
          'AGENT_NAME': branding.agentName || 'ExaMark',
          'COMPANY_NAME': branding.companyName || 'Exabits',
          'AGENT_TITLE': branding.agentTitle || 'AI Assistant',
          'PRIMARY_SERVICE': branding.primaryService || 'AI-powered High-Performance Computing (HPC) Solutions',
          'CORE_OFFERING': branding.coreOffering || 'Custom AI infrastructure with NVIDIA H100/H200 GPU clusters',
          'KEY_ADVANTAGES': branding.keyAdvantages || 'AI-HPC specialization, better performance-per-dollar vs general cloud, expert support',
          'EXPERTISE_AREA': branding.expertiseArea || 'Deep understanding of AI/ML compute requirements',
          'TARGET_COMPANY': company,
          'CONTACT_NAME': `${lead.first_name} ${lead.last_name}`,
          'CONTACT_TITLE': lead.title || 'Professional',
          'INDUSTRY': lead.industry || 'Technology',
          'COMPANY_DESCRIPTION': lead.company_description || 'Technology company',
          'EMPLOYEE_COUNT': lead.employee_count || 'Unknown'
        };
        
        // Replace all template variables
        for (const [key, value] of Object.entries(templateVariables)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          customPrompt = customPrompt.replace(regex, value);
        }
        
        emailPrompt = `${customPrompt}${intelligenceContext}${salesRecommendations}

Generate a professional sales email using the guidance above. Format as:
SUBJECT: [subject line]
BODY: [email body with proper greeting and signature]`;
      } else {
        throw new Error('No custom prompt found, using default');
      }
    } catch (error) {
      console.log('[LEAD AGENT] Using default email prompt template');
      // Fallback to the original ExaMark-specific prompt
      emailPrompt = `You are ExaMark, the AI assistant for Exabits. Generate a HIGHLY INTELLIGENT, research-based marketing email for the following prospect:

Company: ${company}
Contact: ${lead.first_name} ${lead.last_name}
Title: ${lead.title}
Industry: ${lead.industry || 'Technology'}
Company Description: ${lead.company_description || 'Technology company'}
Employee Count: ${lead.employee_count || 'Unknown'}${intelligenceContext}${salesRecommendations}

ABOUT EXABITS (Focus on business value, not company history):
- Specializes in AI-powered High-Performance Computing (HPC) Solutions
- Core offering: Custom AI infrastructure with NVIDIA H100/H200 GPU clusters
- Key advantages: AI-HPC specialization, better performance-per-dollar vs general cloud, expert support
- Industry expertise: Deep understanding of AI/ML compute requirements

YOUR TASK - BE A SMART SALESPERSON:
Generate a professional email that demonstrates you've done your homework:

1. Subject line that references specific company context (growth, AI initiatives, etc.)
2. Opening with SINGLE greeting only (Hi [Name], or Hello [Name], - NOT BOTH)
3. Connect their specific situation to Exabits solutions with LOGICAL REASONING
4. Explain WHY our solution specifically fits their company's needs
5. Professional call-to-action
6. Simple signature: "Best regards,\\nExaMark\\nExabits AI Assistant"

CRITICAL RULES:
- Use ONLY ONE greeting (not "Hello Name, Hi Name,")
- NO "P.S." sections about founders
- DO NOT repeat the subject line in the email body
- DO NOT use placeholder text like "your full name" or "your position"
- Sign simply as "ExaMark" - no placeholder names
- EXPLAIN the logical connection between their business and our GPU clusters
- Reference specific research insights when available
- Focus on business value, not just features
- DO NOT mention Exabits founding date, location, or founders unless directly relevant to the prospect's needs
- Keep focus on technical solutions and business outcomes

Keep it concise (under 200 words), professional, and data-driven. Show you understand their business.

IMPORTANT FORMATTING:
- The BODY should NOT contain the subject line
- Start the BODY directly with the greeting
- End with the simple signature shown above

Format as:
SUBJECT: [subject line]
BODY: [email body starting with greeting, ending with signature]

EXAMPLE:
SUBJECT: AI Infrastructure for TechCorp's Expansion
BODY: Hi John,

I noticed TechCorp recently raised Series B funding...

Best regards,
ExaMark
Exabits AI Assistant`;
    }

    try {
      const response = await this.llm.invoke(emailPrompt);
      const emailContent = response.content;
      
      // Parse subject and body
      const subjectMatch = emailContent.match(/SUBJECT:\s*(.+)/);
      const bodyMatch = emailContent.match(/BODY:\s*([\s\S]+)/);
      
      let cleanSubject = subjectMatch ? subjectMatch[1].trim() : `AI Infrastructure Solutions for ${company}`;
      let cleanBody = bodyMatch ? bodyMatch[1].trim() : emailContent;
      
      // Clean subject line of markdown formatting
      cleanSubject = cleanSubject.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove bold asterisks
      cleanSubject = cleanSubject.replace(/\*([^*]+)\*/g, '$1'); // Remove italic asterisks
      cleanSubject = cleanSubject.replace(/^\*\*?\s*|\s*\*\*?$/g, ''); // Remove leading/trailing asterisks
      cleanSubject = cleanSubject.trim();
      
      // Clean up common AI issues in body
      cleanBody = this.cleanEmailContent(cleanBody, cleanSubject);
      
      // Replace any remaining template variables in the final email content
      const branding = this.leadContactSettings?.companyBranding || {};
      const templateVariables = {
        'AGENT_NAME': branding.agentName || 'ExaMark',
        'COMPANY_NAME': branding.companyName || 'Exabits',
        'AGENT_TITLE': branding.agentTitle || 'AI Assistant',
        'PRIMARY_SERVICE': branding.primaryService || 'AI-powered High-Performance Computing (HPC) Solutions',
        'CORE_OFFERING': branding.coreOffering || 'Custom AI infrastructure with NVIDIA H100/H200 GPU clusters',
        'KEY_ADVANTAGES': branding.keyAdvantages || 'AI-HPC specialization, better performance-per-dollar vs general cloud, expert support',
        'EXPERTISE_AREA': branding.expertiseArea || 'Deep understanding of AI/ML compute requirements',
        'TARGET_COMPANY': company,
        'CONTACT_NAME': `${lead.first_name} ${lead.last_name}`,
        'CONTACT_TITLE': lead.title || 'Professional',
        'INDUSTRY': lead.industry || 'Technology',
        'COMPANY_DESCRIPTION': lead.company_description || 'Technology company',
        'EMPLOYEE_COUNT': lead.employee_count || 'Unknown'
      };
      
      // Replace template variables in both subject and body
      for (const [key, value] of Object.entries(templateVariables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        cleanSubject = cleanSubject.replace(regex, value);
        cleanBody = cleanBody.replace(regex, value);
      }
      
      console.log(`[LEAD AGENT] ✅ Generated AI-powered email using enhanced intelligence`);
      
      return {
        subject: cleanSubject,
        body: cleanBody
      };
      
    } catch (error) {
      console.error('[LEAD AGENT] Error generating intelligent email:', error);
      
      // Get branding for fallback template
      const branding = this.leadContactSettings?.companyBranding || {};
      const agentName = branding.agentName || 'ExaMark';
      const companyName = branding.companyName || 'Exabits';
      const agentTitle = branding.agentTitle || 'AI Assistant';
      const primaryService = branding.primaryService || 'AI-powered high-performance computing solutions';
      
      // Fallback to simple template with template variables replaced
      return {
        subject: `AI Infrastructure Solutions for ${company}`,
        body: `Hello ${lead.first_name},\n\nI'm ${agentName} from ${companyName}, and I noticed ${company} is working in ${lead.industry || 'technology'}.\n\n${companyName} specializes in ${primaryService} with NVIDIA H100/H200 GPU clusters. We help companies like yours achieve better performance-per-dollar compared to general cloud providers.\n\nI'd love to discuss how our specialized AI infrastructure could benefit ${company}'s computing needs.\n\nBest regards,\n${agentName}\n${companyName} ${agentTitle}`
      };
    }
  }

  async generateFallbackEmail(lead) {
    console.log(`[LEAD AGENT] Generating fallback email for ${lead.company}`);
    
    // Build enhanced context from basic sales intelligence (old system)
    let intelligenceContext = '';
    let salesRecommendations = '';
    
    if (lead.salesIntelligence) {
      const si = lead.salesIntelligence;
      console.log(`[LEAD AGENT] Using basic sales intelligence (confidence: ${si.confidence}%) for ${lead.company}`);
      
      // Add specific company insights
      if (si.insights && si.insights.length > 0) {
        const highValueInsights = si.insights.filter(i => i.relevance === 'high');
        if (highValueInsights.length > 0) {
          intelligenceContext = `\nRESEARCH INSIGHTS (Use these specific facts about ${lead.company}):
${highValueInsights.map(insight => `- ${insight.message} (Sales angle: ${insight.salesAngle})`).join('\n')}`;
        }
      }
      
      // Add sales opportunities
      if (si.salesProfile && si.salesProfile.primaryOpportunities.length > 0) {
        salesRecommendations = `\nTARGETED SALES OPPORTUNITIES:
${si.salesProfile.primaryOpportunities.map(opp => 
  `- ${opp.type}: ${opp.reasoning} → Highlight: ${opp.exabitsValue}`
).join('\n')}`;
      }
    }
    
    const prompt = `You are ExaMark, the AI assistant for Exabits. Generate a HIGHLY INTELLIGENT, research-based marketing email for the following prospect:

Company: ${lead.company}
Contact: ${lead.first_name} ${lead.last_name}
Title: ${lead.title}
Industry: ${lead.industry || 'Technology'}
Company Description: ${lead.company_description || 'Technology company'}
Employee Count: ${lead.employee_count || 'Unknown'}${intelligenceContext}${salesRecommendations}

ABOUT EXABITS (Focus on business value, not company history):
- Specializes in AI-powered High-Performance Computing (HPC) Solutions
- Core offering: Custom AI infrastructure with NVIDIA H100/H200 GPU clusters
- Key advantages: AI-HPC specialization, better performance-per-dollar vs general cloud, expert support
- Industry expertise: Deep understanding of AI/ML compute requirements

YOUR TASK - BE A SMART SALESPERSON:
Generate a concise (≤180 words), professional email that shows deep research and clear reasoning (that you've done your homework):

1. Subject line: Reference specific company context (growth, funding, AI initiatives, etc.)
2. Greeting: ONE ONLY (Hi [Name], or Hello [Name],)
3. First line: Reference a company milestone, pain point, or industry trend (NOT generic fluff)
4. Explain the logical connection between their business and Exabits GPU clusters
5. Emphasize business outcomes (time-to-market, scalability, efficiency, compliance)
6. Close with a time-bound, professional CTA (e.g., “Would you be open to a 20-minute call next week?”)

CRITICAL RULES:
- Use ONLY ONE greeting (not "Hello Name, Hi Name,")
- NO "P.S." sections about founders
- EXPLAIN the logical connection between their business and our GPU clusters
- Reference specific research insights when available
- Focus on business value, not just features
- DO NOT mention Exabits founding date, location, or founders unless directly relevant to the prospect's needs
- Keep focus on technical solutions and business outcomes

Keep it concise (under 200 words), professional, and data-driven. Show you understand their business.

Format as:
SUBJECT: [subject line]
BODY: [email body]`;

    try {
      const response = await this.llm.invoke(prompt);
      const emailContent = response.content;
      
      // Parse subject and body
      const subjectMatch = emailContent.match(/SUBJECT:\s*(.+)/);
      const bodyMatch = emailContent.match(/BODY:\s*([\s\S]+)/);
      
      let cleanSubject = subjectMatch ? subjectMatch[1].trim() : `AI Infrastructure Solutions for ${lead.company}`;
      let cleanBody = bodyMatch ? bodyMatch[1].trim() : emailContent;
      
      // Clean up common AI issues
      cleanBody = this.cleanEmailContent(cleanBody, cleanSubject);
      
      // Replace any remaining template variables in the fallback email content
      const branding = this.leadContactSettings?.companyBranding || {};
      const templateVariables = {
        'AGENT_NAME': branding.agentName || 'ExaMark',
        'COMPANY_NAME': branding.companyName || 'Exabits',
        'AGENT_TITLE': branding.agentTitle || 'AI Assistant',
        'PRIMARY_SERVICE': branding.primaryService || 'AI-powered High-Performance Computing (HPC) Solutions',
        'CORE_OFFERING': branding.coreOffering || 'Custom AI infrastructure with NVIDIA H100/H200 GPU clusters',
        'KEY_ADVANTAGES': branding.keyAdvantages || 'AI-HPC specialization, better performance-per-dollar vs general cloud, expert support',
        'EXPERTISE_AREA': branding.expertiseArea || 'Deep understanding of AI/ML compute requirements',
        'TARGET_COMPANY': lead.company,
        'CONTACT_NAME': `${lead.first_name} ${lead.last_name}`,
        'CONTACT_TITLE': lead.title || 'Professional',
        'INDUSTRY': lead.industry || 'Technology',
        'COMPANY_DESCRIPTION': lead.company_description || 'Technology company',
        'EMPLOYEE_COUNT': lead.employee_count || 'Unknown'
      };
      
      // Replace template variables in both subject and body
      for (const [key, value] of Object.entries(templateVariables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        cleanSubject = cleanSubject.replace(regex, value);
        cleanBody = cleanBody.replace(regex, value);
      }
      
      return {
        subject: cleanSubject,
        body: cleanBody
      };
      
    } catch (error) {
      console.error('[LEAD AGENT] Error generating email:', error);
      
      // Get branding for fallback template
      const branding = this.leadContactSettings?.companyBranding || {};
      const agentName = branding.agentName || 'ExaMark';
      const companyName = branding.companyName || 'Exabits';
      const agentTitle = branding.agentTitle || 'AI Assistant';
      const primaryService = branding.primaryService || 'AI-powered high-performance computing solutions';
      
      // Fallback email template with template variables replaced
      return {
        subject: `AI Infrastructure Solutions for ${lead.company}`,
        body: `Hello ${lead.first_name},\n\nI hope this message finds you well. I'm ${agentName} from ${companyName}, and I noticed ${lead.company} is working in ${lead.industry || 'technology'}.\n\n${companyName} specializes in ${primaryService} with NVIDIA H100/H200 GPU clusters. We help companies like yours achieve better performance-per-dollar compared to general cloud providers.\n\nI'd love to discuss how our specialized AI infrastructure could benefit ${lead.company}'s computing needs.\n\nBest regards,\n${agentName}\n${companyName} ${agentTitle}`
      };
    }
  }

  // Clean up common AI email generation issues
  cleanEmailContent(body, subject) {
    if (!body || typeof body !== 'string') return body;
    
    let cleanedBody = body;
    
    // Remove subject line if it appears at the start of the body (with or without asterisks)
    const subjectPattern = new RegExp(`^\\*\\*?\\s*${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*?\\s*`, 'i');
    cleanedBody = cleanedBody.replace(subjectPattern, '').trim();
    
    // Remove plain subject repetition
    const plainSubjectPattern = new RegExp(`^${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
    cleanedBody = cleanedBody.replace(plainSubjectPattern, '').trim();
    
    // Remove SUBJECT: lines that sometimes appear (with or without asterisks)
    cleanedBody = cleanedBody.replace(/^\*\*?SUBJECT:\s*.+\*\*?$/gm, '').trim();
    cleanedBody = cleanedBody.replace(/^SUBJECT:\s*.+$/gm, '').trim();
    
    // Remove markdown formatting (bold asterisks)
    cleanedBody = cleanedBody.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleanedBody = cleanedBody.replace(/\*([^*]+)\*/g, '$1');
    
    // Remove standalone asterisks or markdown artifacts at line beginnings
    cleanedBody = cleanedBody.replace(/^\*\*?\s*/gm, '');
    cleanedBody = cleanedBody.replace(/\s*\*\*?$/gm, '');
    
    // Remove asterisk prefixes from subject lines that leaked through
    cleanedBody = cleanedBody.replace(/^\*\*\s*([A-Z][^*\n]+)$/gm, '$1');
    
    // Remove common placeholder text
    cleanedBody = cleanedBody.replace(/\[your full name\]/gi, 'ExaMark');
    cleanedBody = cleanedBody.replace(/\[your position\]/gi, 'Exabits AI Assistant');
    cleanedBody = cleanedBody.replace(/\[your name\]/gi, 'ExaMark');
    cleanedBody = cleanedBody.replace(/\[position\]/gi, 'Exabits AI Assistant');
    cleanedBody = cleanedBody.replace(/\[Your Name\]/gi, 'ExaMark');
    cleanedBody = cleanedBody.replace(/\[Your Position\]/gi, 'Exabits AI Assistant');
    
    // Remove variations of placeholder signatures
    cleanedBody = cleanedBody.replace(/Best regards,\s*\[your name\]/gi, 'Best regards,\nExaMark');
    cleanedBody = cleanedBody.replace(/Best regards,\s*\[Your Name\]/gi, 'Best regards,\nExaMark');
    
    // Remove any leading/trailing quotes or formatting artifacts
    cleanedBody = cleanedBody.replace(/^['"`\s]+|['"`\s]+$/g, '');
    
    // Clean up extra whitespace and line breaks
    cleanedBody = cleanedBody.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive line breaks
    cleanedBody = cleanedBody.trim();
    
    return cleanedBody;
  }

  async emailSelectedLeads(leads) {
    console.log(`[LEAD AGENT] Emailing ${leads.length} selected leads...`);
    
    let successCount = 0;
    let failedCount = 0;
    
    // Initialize granular email progress (5-8 steps per email)
    let emailStep = 0;
    const totalEmailSteps = leads.length * 6; // 6 micro-steps per email
    
    const emailProgressStep = (message, increment = 1) => {
      emailStep += increment;
      const progress = Math.min((emailStep / totalEmailSteps) * 100, 100);
      this.updateFluidProgress(message, progress);
      this.emit('progress', {
        step: `Email Step ${emailStep}/${totalEmailSteps}`,
        message: message,
        progress: progress
      });
    };
    
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      
      emailProgressStep(`📧 [${i + 1}/${leads.length}] Initializing email for ${lead.company}...`);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!lead.email) {
        console.log(`[LEAD AGENT] Skipping ${lead.company} - no email address`);
        emailProgressStep(`⚠️ Skipped ${lead.company} - no email address`);
        failedCount++;
        continue;
      }
      
      try {
        emailProgressStep(`🔍 Analyzing ${lead.company} intelligence data...`);
        await new Promise(resolve => setTimeout(resolve, 150));
        
        emailProgressStep(`🤖 AI generating personalized content for ${lead.company}...`);
        const emailContent = await this.generatePersonalizedEmail(lead);
        
        emailProgressStep(`✏️ Processing and cleaning email content...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        emailProgressStep(`📝 Preparing email queue entry for ${lead.company}...`);
        
        // Set default recipient to developer email for safety (can be edited in queue)
        let finalSubject = emailContent.subject;
        let finalBody = emailContent.body;
        let finalRecipient = DEVELOPER_EMAIL; // Default to safe recipient, can be edited
        
        // Add email to queue for approval instead of sending directly
        const hasIntelligence = lead.intelligence && lead.intelligence.analysis;
        const opportunityScore = hasIntelligence ? lead.intelligence.analysis.opportunityScore : 'N/A';
        const isVerified = lead.verification?.isVerified || false;
        
        const queueData = {
          leadId: lead.id || `${lead.company}_${lead.name}`.replace(/\s+/g, '_'),
          leadCompany: lead.company,
          leadName: lead.name,
          leadEmail: lead.email,
          leadTitle: lead.title,
          originalSubject: emailContent.subject,
          originalBody: emailContent.body,
          finalSubject: finalSubject,
          finalBody: finalBody,
          finalRecipient: finalRecipient,
          testingMode: false, // No longer using testing mode
          // Enhanced lead details with intelligence
          leadDetails: {
            company: lead.company,
            contact: `${lead.first_name} ${lead.last_name}`,
            title: lead.title,
            industry: lead.industry || 'Unknown',
            employeeCount: lead.employee_count || 'Unknown',
            email: lead.email,
            score: lead.score || 'N/A',
            // Intelligence data
            hasIntelligence: hasIntelligence,
            opportunityScore: opportunityScore,
            isVerified: isVerified,
            verificationConfidence: lead.verification?.confidence || 'N/A',
            aiReadiness: hasIntelligence ? lead.intelligence.analysis.aiReadiness : 'Unknown',
            growthSignals: hasIntelligence ? lead.intelligence.analysis.growthSignals?.length || 0 : 0,
            personalizationQuality: lead.personalization ? 'High' : 'Basic'
          },
          // Include intelligence summary for review
          intelligenceSummary: hasIntelligence ? {
            summary: lead.intelligence.analysis.summary,
            opportunityScore: opportunityScore,
            personalizedAngles: lead.intelligence.analysis.personalizedAngles,
            recentDevelopments: lead.intelligence.analysis.recentDevelopments
          } : null
        };
        
        emailProgressStep(`📤 Adding to email approval queue...`);
        await emailQueue.addToQueue(queueData);
        
        console.log(`[LEAD AGENT] 📧 Added to email queue: ${lead.company} (${lead.email})`);
        emailProgressStep(`✅ Email queued for ${lead.company} - ready for review`);
        successCount++;
        
        // Add delay between processing to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`[LEAD AGENT] ❌ Failed to process ${lead.company}:`, error);
        emailProgressStep(`❌ Failed to generate email for ${lead.company}: ${error.message}`);
        failedCount++;
      }
    }
    
    emailProgressStep(`🎯 Email generation pipeline complete!`);
    emailProgressStep(`📊 Final results: ${successCount} queued, ${failedCount} failed`);
    return { queued: successCount, failed: failedCount };
  }

  getAvailableLeads(leadsData) {
    const allLeads = leadsData.allLeads || [];
    const emailedCompanies = new Set(leadsData.emailedCompanies || []);
    
    return allLeads.filter(lead => !emailedCompanies.has(lead.company));
  }

  selectTopLeads(leadsData, count) {
    const availableLeads = this.getAvailableLeads(leadsData);
    
    // Sort leads by intelligence quality and opportunity score
    const sortedLeads = availableLeads.sort((a, b) => {
      // Prioritize leads with intelligence data
      const aHasIntelligence = a.intelligence && a.intelligence.analysis && a.intelligence.analysis.opportunityScore;
      const bHasIntelligence = b.intelligence && b.intelligence.analysis && b.intelligence.analysis.opportunityScore;
      
      if (aHasIntelligence && !bHasIntelligence) return -1;
      if (!aHasIntelligence && bHasIntelligence) return 1;
      
      // If both have intelligence, sort by opportunity score
      if (aHasIntelligence && bHasIntelligence) {
        return b.intelligence.analysis.opportunityScore - a.intelligence.analysis.opportunityScore;
      }
      
      // Fallback to basic scoring (salesIntelligence system)
      const aScore = a.score || (a.salesIntelligence?.confidence || 0);
      const bScore = b.score || (b.salesIntelligence?.confidence || 0);
      
      return bScore - aScore;
    });
    
    console.log(`[LEAD AGENT] 🎯 Lead selection summary:`);
    sortedLeads.slice(0, count).forEach((lead, index) => {
      const hasIntelligence = lead.intelligence && lead.intelligence.analysis;
      const score = hasIntelligence ? 
        lead.intelligence.analysis.opportunityScore : 
        (lead.score || lead.salesIntelligence?.confidence || 'N/A');
      const verified = lead.verification?.isVerified ? '✅' : '❓';
      console.log(`[LEAD AGENT] ${index + 1}. ${lead.company} ${verified} - Score: ${score} ${hasIntelligence ? '(AI Enhanced)' : '(Basic)'}`);
    });
    
    return sortedLeads.slice(0, count);
  }

  async markLeadsAsEmailed(leads) {
    const leadsData = await this.loadLeadsDatabase();
    
    if (!leadsData.emailedCompanies) {
      leadsData.emailedCompanies = [];
    }
    
    leads.forEach(lead => {
      if (!leadsData.emailedCompanies.includes(lead.company)) {
        leadsData.emailedCompanies.push(lead.company);
      }
    });
    
    await this.saveLeadsDatabase(leadsData);
  }

  async addNewLeads(newLeads) {
    const leadsData = await this.loadLeadsDatabase();
    
    if (!leadsData.allLeads) {
      leadsData.allLeads = [];
    }
    
    // Add new leads, avoiding duplicates
    const existingCompanies = new Set(leadsData.allLeads.map(lead => lead.company));
    
    newLeads.forEach(lead => {
      if (!existingCompanies.has(lead.company)) {
        leadsData.allLeads.push(lead);
        existingCompanies.add(lead.company);
      }
    });
    
    await this.saveLeadsDatabase(leadsData);
    return leadsData;
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(data);
      
      this.currentCycle = state.currentCycle || 0;
      this.isRunning = state.isRunning || false;
      this.currentStatus = state.currentStatus || 'idle';
      
      // Restore custom cycle interval if it was set
      if (state.customCycleInterval !== undefined && state.customCycleInterval !== null) {
        this.customCycleInterval = state.customCycleInterval;
        this.cycleInterval = state.customCycleInterval;
        console.log(`[LEAD AGENT] Restored custom interval: ${state.customCycleInterval / (1000 * 60)} minutes`);
      } else {
        this.customCycleInterval = null;
        this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
        console.log(`[LEAD AGENT] Using default interval: ${this.cycleInterval / (1000 * 60)} minutes`);
      }
      
      return state;
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      console.log('[LEAD AGENT] No state file found, starting fresh');
      this.customCycleInterval = null;
      this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
      this.currentStatus = 'idle';
      return {
        currentCycle: 0,
        isRunning: false,
        currentStatus: 'idle',
        lastCycleTime: null,
        customCycleInterval: null
      };
    }
  }

  async saveState() {
    const state = {
      currentCycle: this.currentCycle,
      isRunning: this.isRunning,
      currentStatus: this.currentStatus,
      lastCycleTime: Date.now(),
      customCycleInterval: this.customCycleInterval
    };
    
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('[LEAD AGENT] Error saving state:', error);
    }
  }

  async loadLeadsDatabase() {
    try {
      const data = await fs.readFile(this.leadsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist, start fresh
      return {
        allLeads: [],
        emailedCompanies: []
      };
    }
  }

  async saveLeadsDatabase(data) {
    try {
      await fs.mkdir(path.dirname(this.leadsFile), { recursive: true });
      await fs.writeFile(this.leadsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[LEAD AGENT] Error saving leads database:', error);
    }
  }

  async resetAgent() {
    console.log('[LEAD AGENT] Starting agent reset...');
    
    // Stop if running
    if (this.isRunning) {
      console.log('[LEAD AGENT] Stopping running agent...');
      await this.stop();
    }
    
    // Reset state variables
    this.currentCycle = 0;
    this.customCycleInterval = null;
    this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
    
    // Clear state file
    try {
      await fs.unlink(this.stateFile);
      console.log('[LEAD AGENT] ✅ Cleared state file');
    } catch (error) {
      console.log('[LEAD AGENT] ⚠️ State file not found (already cleared)');
    }
    
    // Clear leads database
    try {
      await fs.unlink(this.leadsFile);
      console.log('[LEAD AGENT] ✅ Cleared leads database file');
    } catch (error) {
      console.log('[LEAD AGENT] ⚠️ Leads database file not found (already cleared)');
    }
    
    // Also write empty objects to ensure clean state
    try {
      await fs.writeFile(this.stateFile, '{}');
      await fs.writeFile(this.leadsFile, '{}');
      console.log('[LEAD AGENT] ✅ Created clean empty files');
    } catch (error) {
      console.error('[LEAD AGENT] ❌ Error creating clean files:', error);
    }
    
    console.log('[LEAD AGENT] Agent reset complete - cleared state and leads database');
    return { success: true, message: 'Agent reset successfully - cleared state and leads database' };
  }

  async pauseForLeadExhaustion() {
    console.log('[LEAD AGENT] ⏸️ Pausing agent due to lead exhaustion...');
    
    // Stop the agent
    this.isRunning = false;
    this.currentStatus = 'paused_no_leads';
    
    // Clear timer if running
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      console.log('[LEAD AGENT] ✅ Cleared cycle timer');
    }
    
    // Save paused state
    await this.saveState();
    
    // Add notification to recent activity (assuming there's an activity log function)
    try {
      // This would integrate with the activity logging system if available
      console.log('[LEAD AGENT] 📢 NOTIFICATION: Agent paused - no available leads found after research');
      console.log('[LEAD AGENT] 📢 NOTIFICATION: Please start the agent again to resume lead research');
    } catch (error) {
      console.log('[LEAD AGENT] ⚠️ Could not add activity notification:', error.message);
    }
    
    console.log('[LEAD AGENT] ⏸️ Agent paused successfully - restart to resume');
  }
}

// Export singleton instance
export const leadContactAgent = new LeadContactAgent();
