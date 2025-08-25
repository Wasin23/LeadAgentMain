import 'dotenv/config';
import { deepResearch } from '../tools/deepResearch.js';
import { leadResearch } from '../tools/leadResearch.js';
import { leadEmail } from '../tools/leadEmail.js';
import { emailQueue } from '../lib/emailQueue.js';
import { ChatOpenAI } from "@langchain/openai";
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

class LeadContactAgent {
  constructor() {
    this.isRunning = false;
    this.currentCycle = 0;
    this.stateFile = path.join(process.cwd(), 'agent', 'leadAgent_state.json');
    this.leadsFile = path.join(process.cwd(), 'agent', 'leads_database.json');
    this.intervalId = null;
    
    // Use default cycle interval based on configuration (can be overridden)
    this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
    this.customCycleInterval = null; // For user-defined intervals
    
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: "gpt-4o",
    });
    
    this.targetIndustries = [
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
    
    this.companyTypes = [
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
    
    console.log(`[LEAD AGENT] Initialized Lead Contact Agent (PRODUCTION MODE)`);
    console.log(`[LEAD AGENT] Cycle interval: ${this.cycleInterval / (1000 * 60)} minutes`);
  }

  // Set custom cycle interval in minutes
  setCycleInterval(minutes) {
    if (typeof minutes !== 'number' || minutes <= 0) {
      throw new Error('Cycle interval must be a positive number of minutes');
    }
    
    this.customCycleInterval = minutes * 60 * 1000; // Convert to milliseconds
    this.cycleInterval = this.customCycleInterval;
    
    console.log(`[LEAD AGENT] Custom cycle interval set to ${minutes} minutes`);
    
    // If agent is running, restart with new interval
    if (this.isRunning && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(async () => {
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
  resetCycleInterval() {
    this.customCycleInterval = null;
    this.cycleInterval = TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL;
    
    const defaultMinutes = this.cycleInterval / (1000 * 60);
    console.log(`[LEAD AGENT] Reset to default cycle interval: ${defaultMinutes} minutes`);
    
    // If agent is running, restart with default interval
    if (this.isRunning && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(async () => {
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
      
      // Load previous state if exists
      await this.loadState();
      
      this.isRunning = true;
      console.log('[LEAD AGENT] Starting Lead Contact Agent...');
      
      // Run first cycle immediately
      await this.runCycle();
      
      // Set up interval for subsequent cycles
      this.intervalId = setInterval(async () => {
        if (this.isRunning) {
          await this.runCycle();
        }
      }, this.cycleInterval);
      
      await this.saveState();
      
      const intervalMinutes = this.cycleInterval / (1000 * 60);
      
      return { 
        success: true, 
        message: `Lead Contact Agent started. Cycle ${this.currentCycle + 1} completed. Next cycle in ${intervalMinutes} minutes.`,
        currentCycle: this.currentCycle,
        nextCycleIn: `${intervalMinutes} minutes`,
        intervalMinutes: intervalMinutes,
        customInterval: this.customCycleInterval !== null,
        testingMode: false
      };
      
    } catch (error) {
      console.error('[LEAD AGENT] Error starting agent:', error);
      this.isRunning = false;
      return { success: false, message: `Error starting agent: ${error.message}` };
    }
  }

  async stop() {
    if (!this.isRunning) {
      return { success: false, message: 'Agent is not currently running' };
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    await this.saveState();
    
    console.log('[LEAD AGENT] Lead Contact Agent stopped');
    return { 
      success: true, 
      message: 'Lead Contact Agent stopped successfully',
      cyclesCompleted: this.currentCycle
    };
  }

  async getStatus() {
    const state = await this.loadState();
    const leadsData = await this.loadLeadsDatabase();
    
    const totalLeads = leadsData.allLeads?.length || 0;
    const emailedLeads = leadsData.emailedCompanies?.length || 0;
    const remainingLeads = totalLeads - emailedLeads;
    const intervalMinutes = this.cycleInterval / (1000 * 60);
    
    return {
      isRunning: this.isRunning,
      currentCycle: this.currentCycle,
      totalLeadsFound: totalLeads,
      companiesEmailed: emailedLeads,
      remainingLeads: remainingLeads,
      lastCycleTime: state.lastCycleTime,
      nextCycleTime: state.lastCycleTime ? new Date(state.lastCycleTime + this.cycleInterval).toISOString() : null,
      intervalMinutes: intervalMinutes,
      customInterval: this.customCycleInterval !== null
    };
  }

  async runCycle() {
    console.log(`[LEAD AGENT] Starting cycle ${this.currentCycle + 1}`);
    
    try {
      // Step 1: Load existing leads database
      let leadsData = await this.loadLeadsDatabase();
      
      // Step 2: If we need more leads, research new ones
      const availableLeads = this.getAvailableLeads(leadsData);
      
      if (availableLeads.length < 5) {
        console.log('[LEAD AGENT] Need more leads, starting research...');
        const newLeads = await this.researchNewLeads();
        leadsData = await this.addNewLeads(newLeads);
      }
      
      // Step 3: Select top 5 leads for this cycle
      const selectedLeads = this.selectTopLeads(leadsData, 5);
      
      console.log(`[LEAD AGENT] Selected ${selectedLeads.length} leads for cycle ${this.currentCycle + 1}:`);
      selectedLeads.forEach((lead, index) => {
        console.log(`[LEAD AGENT] ${index + 1}. ${lead.company} - ${lead.name} (${lead.title}) - Score: ${lead.score}`);
      });
      selectedLeads.forEach(lead => {
        console.log(`[LEAD AGENT] - ${lead.company} (${lead.first_name} ${lead.last_name}, ${lead.title})`);
      });
      
      // Step 4: Email the selected leads
      const emailResults = await this.emailSelectedLeads(selectedLeads);
      
      // Step 5: Update database with emailed companies
      await this.markLeadsAsEmailed(selectedLeads);
      
      // Step 6: Update cycle counter and state
      this.currentCycle++;
      await this.saveState();
      
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
      return {
        success: false,
        error: error.message
      };
    }
  }

  async researchNewLeads() {
    console.log('[LEAD AGENT] Researching new leads...');
    
    const allLeads = [];
    
    // Research multiple industries/company types
    for (let i = 0; i < 3; i++) {
      const industry = this.targetIndustries[Math.floor(Math.random() * this.targetIndustries.length)];
      const companyType = this.companyTypes[Math.floor(Math.random() * this.companyTypes.length)];
      
      console.log(`[LEAD AGENT] Researching: ${industry} - ${companyType}`);
      
      const query = `companies in ${industry} that would need high-performance GPU computing for AI and machine learning workloads, specifically ${companyType}`;
      
      try {
        const researchResult = await leadResearch(query, { 
          limit: 20 
        });
        
        console.log(`[LEAD AGENT] Raw research result:`, researchResult?.length || 0, 'items');
        
        if (researchResult && researchResult.length > 0) {
          console.log(`[LEAD AGENT] Found ${researchResult.length} leads for ${industry}`);
          allLeads.push(...researchResult);
        } else {
          console.log(`[LEAD AGENT] No leads found for ${industry} --> ${query}`);
        }
        
        // Add delay between searches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[LEAD AGENT] Error researching ${industry}:`, error);
      }
    }
    
    // Process and extract lead information from research results
    console.log(`[LEAD AGENT] Processing ${allLeads.length} research results into leads...`);
    const processedLeads = await this.processLeadsFromResearch(allLeads);
    
    // Rank and score the leads
    const rankedLeads = await this.rankLeads(processedLeads);
    
    console.log(`[LEAD AGENT] Research complete. Found ${rankedLeads.length} total leads`);
    console.log(`[LEAD AGENT] Sample lead data:`, rankedLeads[0] ? JSON.stringify(rankedLeads[0], null, 2) : 'No leads found');
    return rankedLeads;
  }

  async processLeadsFromResearch(researchResults) {
    const processedLeads = [];
    
    for (const result of researchResults) {
      try {
        // Extract company and contact info from the search result
        const lead = this.extractLeadInfo(result);
        if (lead && lead.company && lead.name) {
          processedLeads.push(lead);
        }
      } catch (error) {
        console.log(`[LEAD AGENT] Failed to process lead: ${error.message}`);
      }
    }
    
    return processedLeads;
  }

  extractLeadInfo(result) {
    // Check if this is a structured Apollo result (new leadResearch.js format)
    if (result && result.name && result.organization) {
      console.log(`[LEAD AGENT] Processing structured Apollo lead: ${result.name} at ${result.organization.name}`);
      
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
        industry: result.organization.industry || 'Technology'
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
          industry: industry
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
      score: 0 // Will be calculated later
    };
  }

  async rankLeads(leads) {
    console.log('[LEAD AGENT] Ranking leads...');
    
    // Score leads based on multiple factors
    const scoredLeads = leads.map(lead => {
      let score = 0;
      
      // Company size scoring (prefer mid-size to large companies)
      if (lead.employee_count) {
        if (lead.employee_count >= 50 && lead.employee_count <= 1000) score += 20;
        else if (lead.employee_count > 1000) score += 15;
        else if (lead.employee_count >= 20) score += 10;
      }
      
      // Industry relevance scoring
      const industryKeywords = ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'gpu', 'computing', 'data science', 'research', 'tech'];
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
      
      return {
        ...lead,
        score: score
      };
    });
    
    // Sort by score descending
    return scoredLeads.sort((a, b) => b.score - a.score);
  }

  async generatePersonalizedEmail(lead) {
    console.log(`[LEAD AGENT] Generating personalized email for ${lead.company}`);
    
    const prompt = `You are ExaMark, the AI assistant for Exabits. Generate a highly personalized marketing email for the following prospect:

Company: ${lead.company}
Contact: ${lead.first_name} ${lead.last_name}
Title: ${lead.title}
Industry: ${lead.industry || 'Technology'}
Company Description: ${lead.company_description || 'Technology company'}
Employee Count: ${lead.employee_count || 'Unknown'}

ABOUT EXABITS (Use this exact information):
- Founded 2021, San Mateo, California
- Specializes in AI-powered High-Performance Computing (HPC) Solutions
- Founders: Hoansoo Lee (CEO) & Zachary Bright (CTO from Princeton)
- Core offering: Custom AI infrastructure with NVIDIA H100/H200 GPU clusters
- Key advantages: AI-HPC specialization, better performance-per-dollar vs general cloud, expert support

YOUR TASK:
Generate a professional, personalized email with:
1. Subject line that mentions their company/industry specifically
2. Personalized opening that shows you researched them
3. THREE specific reasons why Exabits would benefit their company based on their profile
4. Clear call-to-action
5. Professional signature from ExaMark

Keep it concise (under 200 words), professional, and avoid generic marketing language. Focus on their specific AI/ML computing needs.

Format as:
SUBJECT: [subject line]
BODY: [email body]`;

    try {
      const response = await this.llm.invoke(prompt);
      const emailContent = response.content;
      
      // Parse subject and body
      const subjectMatch = emailContent.match(/SUBJECT:\s*(.+)/);
      const bodyMatch = emailContent.match(/BODY:\s*([\s\S]+)/);
      
      return {
        subject: subjectMatch ? subjectMatch[1].trim() : `AI Infrastructure Solutions for ${lead.company}`,
        body: bodyMatch ? bodyMatch[1].trim() : emailContent
      };
      
    } catch (error) {
      console.error('[LEAD AGENT] Error generating email:', error);
      
      // Fallback email template
      return {
        subject: `AI Infrastructure Solutions for ${lead.company}`,
        body: `Hello ${lead.first_name},\n\nI hope this message finds you well. I'm ExaMark from Exabits, and I noticed ${lead.company} is working in ${lead.industry || 'technology'}.\n\nExabits specializes in AI-powered high-performance computing solutions with NVIDIA H100/H200 GPU clusters. We help companies like yours achieve better performance-per-dollar compared to general cloud providers.\n\nI'd love to discuss how our specialized AI infrastructure could benefit ${lead.company}'s computing needs.\n\nBest regards,\nExaMark\nExabits AI Assistant`
      };
    }
  }

  async emailSelectedLeads(leads) {
    console.log(`[LEAD AGENT] Emailing ${leads.length} selected leads...`);
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const lead of leads) {
      if (!lead.email) {
        console.log(`[LEAD AGENT] Skipping ${lead.company} - no email address`);
        failedCount++;
        continue;
      }
      
      try {
        const emailContent = await this.generatePersonalizedEmail(lead);
        
        // Set default recipient to developer email for safety (can be edited in queue)
        let finalSubject = emailContent.subject;
        let finalBody = emailContent.body;
        let finalRecipient = DEVELOPER_EMAIL; // Default to safe recipient, can be edited
        
        // Add email to queue for approval instead of sending directly
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
          leadDetails: {
            company: lead.company,
            contact: `${lead.first_name} ${lead.last_name}`,
            title: lead.title,
            industry: lead.industry || 'Unknown',
            employeeCount: lead.employee_count || 'Unknown',
            email: lead.email,
            score: lead.score || 'N/A'
          }
        };
        
        await emailQueue.addToQueue(queueData);
        
        console.log(`[LEAD AGENT] 📧 Added to email queue: ${lead.company} (${lead.email})`);
        successCount++;
        
        // Add delay between processing to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[LEAD AGENT] ❌ Failed to process ${lead.company}:`, error);
        failedCount++;
      }
    }
    
    return { queued: successCount, failed: failedCount };
  }

  getAvailableLeads(leadsData) {
    const allLeads = leadsData.allLeads || [];
    const emailedCompanies = new Set(leadsData.emailedCompanies || []);
    
    return allLeads.filter(lead => !emailedCompanies.has(lead.company));
  }

  selectTopLeads(leadsData, count) {
    const availableLeads = this.getAvailableLeads(leadsData);
    return availableLeads.slice(0, count);
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
      
      // Restore custom cycle interval if it was set
      if (state.customCycleInterval !== undefined) {
        this.customCycleInterval = state.customCycleInterval;
        this.cycleInterval = state.customCycleInterval || (TESTING_MODE ? DEFAULT_TESTING_CYCLE_INTERVAL : DEFAULT_PRODUCTION_CYCLE_INTERVAL);
      }
      
      return state;
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      return {
        currentCycle: 0,
        isRunning: false,
        lastCycleTime: null,
        customCycleInterval: null
      };
    }
  }

  async saveState() {
    const state = {
      currentCycle: this.currentCycle,
      isRunning: this.isRunning,
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
}

// Export singleton instance
export const leadContactAgent = new LeadContactAgent();
