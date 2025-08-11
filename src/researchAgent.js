import { chatWithAgent } from './langchainAgent.js';
import { internetSearch } from '../tools/internetSearch.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Bulletproof Research Agent
 * - Stateful (survives crashes)
 * - Structured output (clean JSON)
 * - Multi-source parallel research
 * - Real-time progress updates
 */
export class ResearchAgent {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.stateFile = path.join(process.cwd(), 'research_sessions', `${sessionId}.json`);
    this.state = {
      status: 'idle',
      query: '',
      tasks: [],
      results: [],
      progress: 0,
      startTime: null,
      endTime: null,
      errors: []
    };
    this.progressCallback = null;
  }

  /**
   * Set callback for real-time progress updates
   */
  onProgress(callback) {
    this.progressCallback = callback;
  }

  /**
   * Update progress and save state
   */
  async updateProgress(status, progress, data = {}) {
    this.state.status = status;
    this.state.progress = progress;
    Object.assign(this.state, data);
    
    // Save state to disk (crash recovery)
    await this.saveState();
    
    // Send real-time update
    if (this.progressCallback) {
      this.progressCallback({
        sessionId: this.sessionId,
        status,
        progress,
        ...data
      });
    }
  }

  /**
   * Save current state to disk
   */
  async saveState() {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
      await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.error('Failed to save research state:', err);
    }
  }

  /**
   * Load state from disk (for resuming)
   */
  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      this.state = JSON.parse(data);
      return true;
    } catch (err) {
      return false; // No previous state
    }
  }

  /**
   * Generate structured research tasks from user query
   */
  async generateTasks(query) {
    await this.updateProgress('generating_tasks', 10, { query });

    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const taskPrompt = `You are a research task generator. The current date is ${currentDate} and the current year is ${currentYear}. Break down this research query into 3-5 specific, actionable search tasks using advanced search operators.

Query: "${query}"

Return a JSON array of tasks in this exact format:
[
  {
    "task": "specific search query with operators",
    "type": "company_search|contact_search|industry_research|competitor_analysis",
    "priority": 1-5,
    "expected_results": "what this should find"
  }
]

USE THESE SEARCH OPTIMIZATION TECHNIQUES:
- Site-specific searches: "site:linkedin.com CEO fintech startup"
- Exact phrases: "VP Sales" "Series A" "machine learning"
- Exclude noise: -jobs -careers -hiring 
- Recent results: "${currentYear}" OR "${currentYear - 1}" (use current year ${currentYear})
- Industry directories: site:crunchbase.com OR site:pitchbook.com
- Contact hunting: "email" OR "contact" OR "@company.com"

Example optimized tasks (notice the current year ${currentYear}):
- "site:crunchbase.com \"fintech startup\" \"Series A\" ${currentYear} -jobs"
- "\"VP Sales\" OR \"Chief Revenue Officer\" site:linkedin.com fintech -jobs ${currentYear}"
- "\"machine learning startup\" \"funding\" ${currentYear} site:techcrunch.com OR site:venturebeat.com"
- "\"CEO\" \"contact\" \"email\" site:company.com OR site:about.us ${currentYear}"

Focus on finding:
1. Company names and details (use funding/directory sites with current year ${currentYear})
2. Contact information (use LinkedIn, company sites with recent data)  
3. Decision makers (use exact job titles with current year context)
4. Industry context (use news sites, recent dates from ${currentYear} or ${currentYear - 1})

IMPORTANT: Always include the current year ${currentYear} in searches for recent, relevant results. Avoid outdated information from before ${currentYear - 2}.

Return only the JSON array, no other text.`;

    try {
      const response = await chatWithAgent(taskPrompt, []);
      const tasks = JSON.parse(response);
      
      this.state.tasks = tasks.map((task, index) => ({
        id: index,
        ...task,
        status: 'pending',
        results: [],
        error: null
      }));

      await this.updateProgress('tasks_generated', 20, { tasks: this.state.tasks });
      return this.state.tasks;
    } catch (err) {
      throw new Error(`Failed to generate tasks: ${err.message}`);
    }
  }

  /**
   * Execute a single research task with retry logic
   */
  async executeTask(task, retryCount = 0) {
    const maxRetries = 2;
    console.log(`[Research] Executing task (attempt ${retryCount + 1}): ${task.task}`);
    
    try {
      // Use internet search tool with timeout
      const searchPromise = internetSearch(task.task);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 30000)
      );
      
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);
      
      // Check for valid search results - SERPER returns data in 'organic' array
      const results = searchResults?.organic || searchResults?.results || [];
      if (!results || results.length === 0) {
        throw new Error('No search results returned');
      }

      // Process and structure the results
      const processedResults = await this.processSearchResults(results, task);
      
      task.results = processedResults;
      task.status = 'completed';
      
      console.log(`[Research] Task completed: ${task.task} (${processedResults.length} results)`);
      return processedResults;
      
    } catch (err) {
      console.error(`[Research] Task failed (attempt ${retryCount + 1}): ${task.task}`, err);
      
      // Retry logic
      if (retryCount < maxRetries && !err.message.includes('timeout')) {
        console.log(`[Research] Retrying task: ${task.task}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Exponential backoff
        return this.executeTask(task, retryCount + 1);
      }
      
      // Final failure
      task.status = 'failed';
      task.error = err.message;
      this.state.errors.push({ task: task.task, error: err.message, timestamp: new Date().toISOString() });
      return [];
    }
  }

  /**
   * Process raw search results into structured data
   */
  async processSearchResults(rawResults, task) {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toISOString().split('T')[0];

    const processingPrompt = `Extract structured business information from these search results with MAXIMUM ACCURACY. Today's date is ${currentDate} and current year is ${currentYear}.

Task: ${task.task}
Type: ${task.type}

Search Results:
${rawResults.slice(0, 8).map(r => `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}\n---`).join('\n')}

EXTRACTION RULES:
1. Extract REAL company names (not generic terms like "Top", "25", "List")
2. Only include companies mentioned BY NAME in the content
3. Set high confidence (0.8+) only for companies with clear details
4. Set medium confidence (0.5-0.7) for companies mentioned but limited info
5. Set low confidence (0.3-0.4) for uncertain or directory-style listings
6. Prioritize recent information from ${currentYear} or ${currentYear - 1}
7. Mark older information (before ${currentYear - 2}) with lower confidence

Extract and return a JSON array of companies/contacts found. Use this exact format:
[
  {
    "company_name": "Actual Company Name (not generic words)",
    "website": "https://website.com",
    "industry": "Specific industry/sector",
    "size": "employee count or funding stage",
    "description": "specific company description with value prop",
    "contacts": [
      {
        "name": "Full Person Name",
        "title": "Exact Job Title", 
        "email": "verified@email.com",
        "linkedin": "linkedin.com/in/person",
        "confidence": 0.8
      }
    ],
    "funding": "Series A $5M" or "Bootstrap" or "Unknown",
    "location": "City, Country", 
    "last_updated": "${currentYear}" (if recent data) or "Unknown",
    "source_urls": ["url1", "url2"],
    "confidence": 0.9
  }
]

QUALITY CHECKS:
- Skip generic company names like "Top", "Best", "Leading", numbers
- Only include companies with actual business descriptions
- Verify contact info exists in source before including
- Use exact quotes from sources for descriptions
- Include funding info if mentioned (Series A/B/C, bootstrap, etc.)
- Prioritize information from ${currentYear} and ${currentYear - 1}
- Reduce confidence for outdated information (before ${currentYear - 2})

Return only the JSON array, no other text.`;

    try {
      const response = await chatWithAgent(processingPrompt, []);
      const structuredData = JSON.parse(response);
      return Array.isArray(structuredData) ? structuredData : [];
    } catch (err) {
      console.error('[Research] Failed to process results:', err);
      // Fallback: return basic structure from raw results
      return rawResults.slice(0, 5).map(r => ({
        company_name: r.title.split(' ')[0] || 'Unknown',
        website: r.link,
        description: r.snippet,
        contacts: [],
        source_urls: [r.link],
        confidence: 0.3
      }));
    }
  }

  /**
   * Execute all tasks in parallel with progress tracking
   */
  async executeTasks() {
    const tasks = this.state.tasks;
    const batchSize = 2; // Execute 2 tasks at a time to avoid rate limits
    const allResults = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const progressPercent = 20 + ((i / tasks.length) * 60);
      
      await this.updateProgress('executing_tasks', progressPercent, {
        currentTask: batch.map(t => t.task).join(', '),
        taskProgress: `${Math.min(i + batchSize, tasks.length)}/${tasks.length}`
      });

      // Execute batch in parallel
      const batchPromises = batch.map(async (task) => {
        try {
          const results = await this.executeTask(task);
          return results;
        } catch (err) {
          console.error(`[Research] Batch task failed: ${task.task}`, err);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(results => allResults.push(...results));
      
      // Save progress after each batch
      await this.saveState();
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allResults;
  }

  /**
   * Deduplicate and merge results with intelligent consolidation
   */
  async consolidateResults(allResults) {
    await this.updateProgress('consolidating', 85);

    // Group by company name (case insensitive, fuzzy matching)
    const companyGroups = new Map();
    
    allResults.forEach(result => {
      if (!result.company_name || result.company_name.length < 2) return;
      
      const normalizedName = result.company_name.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
      
      // Skip generic/invalid company names
      const invalidNames = ['top', 'best', 'leading', 'company', 'startup', 'list', 'guide'];
      if (invalidNames.includes(normalizedName) || /^\d+$/.test(normalizedName)) {
        return;
      }
      
      // Find existing group or create new one
      let groupKey = null;
      for (const [key, group] of companyGroups) {
        if (this.areCompaniesSimilar(normalizedName, key)) {
          groupKey = key;
          break;
        }
      }
      
      if (!groupKey) {
        groupKey = normalizedName;
        companyGroups.set(groupKey, []);
      }
      
      companyGroups.get(groupKey).push(result);
    });

    // Merge duplicate companies intelligently
    const consolidatedResults = [];
    for (const [, group] of companyGroups) {
      if (group.length === 1) {
        consolidatedResults.push(group[0]);
      } else {
        // Merge multiple entries for same company
        const merged = this.mergeCompanyEntries(group);
        if (merged) consolidatedResults.push(merged);
      }
    }

    // Sort by confidence score and filter out low-confidence results
    const filtered = consolidatedResults
      .filter(result => (result.confidence || 0) >= 0.3)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return filtered.slice(0, 100); // Cap at 100 results
  }

  /**
   * Check if two company names likely refer to the same company
   */
  areCompaniesSimilar(name1, name2) {
    // Simple similarity check - could be enhanced with fuzzy matching
    const similarity = this.calculateSimilarity(name1, name2);
    return similarity > 0.8;
  }

  /**
   * Calculate string similarity (simple approach)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  /**
   * Calculate edit distance between strings
   */
  editDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Merge multiple entries for the same company
   */
  mergeCompanyEntries(entries) {
    if (!entries || entries.length === 0) return null;
    
    // Start with the highest confidence entry
    const sorted = entries.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const base = { ...sorted[0] };
    
    // Merge additional data from other entries
    const allContacts = [];
    const allSources = new Set(base.source_urls || []);
    
    entries.forEach(entry => {
      // Merge contacts
      if (entry.contacts) {
        allContacts.push(...entry.contacts);
      }
      
      // Merge source URLs
      if (entry.source_urls) {
        entry.source_urls.forEach(url => allSources.add(url));
      }
      
      // Use better data if available
      if (!base.website && entry.website) base.website = entry.website;
      if (!base.industry && entry.industry) base.industry = entry.industry;
      if (!base.size && entry.size) base.size = entry.size;
      if (!base.funding && entry.funding) base.funding = entry.funding;
      if (!base.location && entry.location) base.location = entry.location;
      if ((!base.description || base.description.length < 50) && 
          entry.description && entry.description.length > 50) {
        base.description = entry.description;
      }
    });
    
    // Deduplicate contacts
    const uniqueContacts = [];
    const seenEmails = new Set();
    allContacts.forEach(contact => {
      if (contact.email && !seenEmails.has(contact.email)) {
        seenEmails.add(contact.email);
        uniqueContacts.push(contact);
      } else if (!contact.email && contact.name) {
        uniqueContacts.push(contact);
      }
    });
    
    base.contacts = uniqueContacts.slice(0, 5); // Limit to 5 contacts
    base.source_urls = Array.from(allSources).slice(0, 3); // Limit to 3 sources
    
    // Boost confidence if we have multiple sources
    if (entries.length > 1) {
      base.confidence = Math.min((base.confidence || 0) + 0.1, 1.0);
    }
    
    return base;
  }

  /**
   * Main research execution method
   */
  async research(query) {
    try {
      this.state.startTime = new Date().toISOString();
      await this.updateProgress('starting', 0, { query });

      // Step 1: Generate tasks (20%)
      await this.generateTasks(query);

      // Step 2: Execute tasks (20% - 80%)
      const allResults = await this.executeTasks();

      // Step 3: Consolidate results (80% - 90%)
      const finalResults = await this.consolidateResults(allResults);

      // Step 4: Final processing (90% - 100%)
      await this.updateProgress('finalizing', 90);
      
      this.state.results = finalResults;
      this.state.endTime = new Date().toISOString();
      
      await this.updateProgress('completed', 100, {
        totalResults: finalResults.length,
        completedTasks: this.state.tasks.filter(t => t.status === 'completed').length,
        failedTasks: this.state.tasks.filter(t => t.status === 'failed').length
      });

      return {
        success: true,
        results: finalResults,
        summary: {
          totalResults: finalResults.length,
          totalTasks: this.state.tasks.length,
          completedTasks: this.state.tasks.filter(t => t.status === 'completed').length,
          failedTasks: this.state.tasks.filter(t => t.status === 'failed').length,
          duration: new Date(this.state.endTime) - new Date(this.state.startTime),
          errors: this.state.errors
        }
      };

    } catch (err) {
      await this.updateProgress('failed', 0, { error: err.message });
      this.state.errors.push({ error: err.message, timestamp: new Date().toISOString() });
      await this.saveState();
      
      return {
        success: false,
        error: err.message,
        partialResults: this.state.results || [],
        errors: this.state.errors
      };
    }
  }

  /**
   * Resume a previous research session
   */
  async resume() {
    const loaded = await this.loadState();
    if (!loaded) {
      throw new Error('No previous session found');
    }

    if (this.state.status === 'completed' || this.state.status === 'failed') {
      return {
        success: true,
        results: this.state.results,
        resumed: true
      };
    }

    // Resume from where we left off
    console.log(`[Research] Resuming session ${this.sessionId} from ${this.state.status}`);
    
    // Continue with incomplete tasks
    const incompleteTasks = this.state.tasks.filter(t => t.status === 'pending');
    if (incompleteTasks.length > 0) {
      return await this.research(this.state.query);
    }

    return {
      success: true,
      results: this.state.results,
      resumed: true
    };
  }
}

/**
 * Factory function to create or resume research sessions
 */
export async function createResearchSession(sessionId, query = null) {
  const agent = new ResearchAgent(sessionId);
  
  if (query) {
    return { agent, isNew: true };
  } else {
    // Try to resume existing session
    const loaded = await agent.loadState();
    return { agent, isNew: !loaded };
  }
}
