// Lead-specific research tool for the Lead Contact Agent
// Enhanced with advanced multi-source lead verification and scoring

import 'dotenv/config';
import { internetSearch } from './internetSearch.js';
import { companyIntelligence } from './companyIntelligence.js';
import { getUserSettings } from '../lib/userManager.js';

// Enhanced lead scoring weights - optimized for 2 paid APIs + free alternatives
const SCORING_WEIGHTS = {
  EMAIL_VERIFIED: 35,        // Email deliverability verified (increased weight)
  TECH_STACK_MATCH: 25,      // Uses relevant technology (free detection)
  COMPANY_GROWTH: 20,        // Funding, hiring, or growth indicators (free enrichment)
  ROLE_AUTHORITY: 15,        // Decision-making position (free analysis)
  TIMING_SIGNALS: 5          // Recent activity or trigger events (free search)
};

// Technology keywords for scoring
const AI_ML_TECHNOLOGIES = [
  'tensorflow', 'pytorch', 'cuda', 'docker', 'kubernetes', 'aws', 'gcp', 'azure',
  'python', 'jupyter', 'nvidia', 'gpu', 'machine learning', 'artificial intelligence',
  'deep learning', 'neural networks', 'computer vision', 'nlp', 'data science'
];

// Growth indicators
const GROWTH_INDICATORS = [
  'series a', 'series b', 'funding', 'investment', 'hiring', 'expansion',
  'scale', 'growth', 'ipo', 'acquisition', 'partnership', 'revenue'
];

// Decision-maker titles
const DECISION_MAKER_TITLES = [
  'cto', 'ceo', 'vp', 'director', 'head of', 'chief', 'founder', 'president',
  'lead', 'principal', 'senior', 'manager', 'architect'
];

// Advanced email verification using ZeroBounce
async function verifyEmailDeliverability(email, userId = null) {
  try {
    const apiKey = await getApiKey('zerobounce', userId);
    if (!apiKey) {
      console.log('⚠️ ZeroBounce API key not configured, skipping email verification');
      return { valid: null, score: 0 };
    }

    const response = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`);
    const data = await response.json();
    
    if (data.status === 'valid') {
      console.log(`✅ Email verified: ${email} - ${data.status}`);
      return { valid: true, score: SCORING_WEIGHTS.EMAIL_VERIFIED, deliverabilityScore: data.sub_result };
    } else {
      console.log(`❌ Email invalid: ${email} - ${data.status}`);
      return { valid: false, score: 0, reason: data.status };
    }
  } catch (error) {
    console.error('ZeroBounce verification error:', error.message);
    return { valid: null, score: 0 };
  }
}

// Enhanced email discovery using Hunter.io
async function findEmailWithHunter(firstName, lastName, domain, userId = null) {
  try {
    const apiKey = await getApiKey('hunter', userId);
    if (!apiKey) {
      console.log('⚠️ Hunter.io API key not configured, skipping email discovery');
      return null;
    }

    const response = await fetch(
      `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.data && data.data.email && data.data.confidence > 70) {
      console.log(`🎯 Hunter.io found email: ${data.data.email} (confidence: ${data.data.confidence}%)`);
      return { 
        email: data.data.email, 
        confidence: data.data.confidence,
        source: 'hunter'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Hunter.io email finder error:', error.message);
    return null;
  }
}

// Technology stack detection using BuiltWith
// Free technology stack detection using web scraping
async function detectTechnologyStack(domain, userId = null) {
  try {
    console.log(`🔍 Detecting technology stack for ${domain} using free methods...`);
    
    const techStack = [];
    let techScore = 0;
    
    // Method 1: Check common technology patterns in HTTP headers and HTML
    try {
      const response = await fetch(`https://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const html = await response.text();
      const headers = response.headers;
      
      // Check for common frameworks in HTML
      const techPatterns = {
        'React': [/react/i, /_react/i, /data-reactroot/i],
        'Vue.js': [/vue\.js/i, /vue@/i, /__vue__/i],
        'Angular': [/ng-/i, /angular/i, /_angular/i],
        'Next.js': [/next\.js/i, /__next/i, /_next/i],
        'Nuxt.js': [/nuxt/i, /__nuxt/i],
        'Django': [/django/i, /csrftoken/i],
        'Rails': [/rails/i, /ruby/i],
        'WordPress': [/wp-content/i, /wp-includes/i, /wordpress/i],
        'Shopify': [/shopify/i, /cdn\.shopify/i],
        'Node.js': [/express/i, /koa/i],
        'Docker': [/docker/i],
        'Kubernetes': [/k8s/i, /kubernetes/i],
        'AWS': [/amazonaws/i, /aws/i],
        'Python': [/python/i, /django/i, /flask/i],
        'TensorFlow': [/tensorflow/i, /tf\./i],
        'PyTorch': [/pytorch/i, /torch/i]
      };
      
      // Check HTTP headers for server info
      const serverHeader = headers.get('server') || '';
      const poweredBy = headers.get('x-powered-by') || '';
      const generator = headers.get('generator') || '';
      
      // Analyze HTML content and headers
      for (const [tech, patterns] of Object.entries(techPatterns)) {
        const found = patterns.some(pattern => 
          pattern.test(html) || 
          pattern.test(serverHeader) || 
          pattern.test(poweredBy) || 
          pattern.test(generator)
        );
        
        if (found) {
          techStack.push(tech.toLowerCase());
          
          // More generous scoring: Any relevant technology gets points
          if (AI_ML_TECHNOLOGIES.some(aiTech => tech.toLowerCase().includes(aiTech))) {
            techScore = SCORING_WEIGHTS.TECH_STACK_MATCH; // Full points for AI/ML tech
          } else if (['docker', 'kubernetes', 'aws', 'node.js', 'react', 'angular', 'vue.js'].some(modernTech => tech.toLowerCase().includes(modernTech))) {
            techScore = Math.max(techScore, Math.floor(SCORING_WEIGHTS.TECH_STACK_MATCH * 0.6)); // 60% for modern tech
          } else {
            techScore = Math.max(techScore, Math.floor(SCORING_WEIGHTS.TECH_STACK_MATCH * 0.3)); // 30% for any tech
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Could not fetch website directly: ${error.message}`);
    }
    
    console.log(`� Technology stack detected: ${techStack.join(', ')} (Score: ${techScore})`);
    
    return {
      technologies: techStack,
      score: techScore,
      allTech: techStack
    };
    
  } catch (error) {
    console.error('Technology detection error:', error);
    return {
      technologies: [],
      score: 0,
      allTech: []
    };
  }
}

// Free company enrichment using web scraping and search
async function enrichCompanyData(domain, userId = null) {
  try {
    console.log(`💼 Enriching company data for ${domain} using free methods...`);
    
    let growthScore = 0;
    const companyData = { enriched: false };
    
    // Method 1: Scrape company website for basic info
    try {
      const response = await fetch(`https://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const html = await response.text();
      
      // Extract company info from meta tags and content
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const descriptionMatch = html.match(/<meta name="description" content="(.*?)"/i);
      
      if (titleMatch) companyData.name = titleMatch[1];
      if (descriptionMatch) companyData.description = descriptionMatch[1];
      
      // Look for growth indicators in the content
      const content = html.toLowerCase();
      GROWTH_INDICATORS.forEach(indicator => {
        if (content.includes(indicator)) {
          growthScore += 2;
        }
      });
      
    } catch (error) {
      console.log(`⚠️ Could not scrape company website: ${error.message}`);
    }
    
    // Method 2: Use web search for company funding/growth information
    try {
      const searchQuery = `"${domain}" funding OR investment OR "series a" OR "series b" OR hiring OR growth`;
      const searchResults = await internetSearch(searchQuery, { maxResults: 3 });
      
      if (searchResults?.results) {
        for (const result of searchResults.results) {
          const content = (result.content || '').toLowerCase();
          
          // Look for funding/growth signals
          GROWTH_INDICATORS.forEach(indicator => {
            if (content.includes(indicator)) {
              growthScore += 3;
            }
          });
          
          // Check for specific signals
          if (content.includes('million') && (content.includes('funding') || content.includes('raised'))) {
            growthScore += 8;
          }
          if (content.includes('hiring') || content.includes('jobs')) {
            growthScore += 4;
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Company growth search failed: ${error.message}`);
    }
    
    // Cap the score
    growthScore = Math.min(growthScore, SCORING_WEIGHTS.COMPANY_GROWTH);
    
    console.log(`💼 Company enrichment complete for ${domain} (Score: ${growthScore})`);
    
    return {
      enriched: true,
      score: growthScore,
      data: companyData
    };
    
  } catch (error) {
    console.error('Company enrichment error:', error);
    return {
      enriched: false,
      score: 0,
      data: {}
    };
  }
}

// Helper function to get API key from environment variables
async function getApiKey(keyName, userId = null) {
  try {
    // Use environment variable
    const envKey = process.env[`${keyName.toUpperCase()}_API_KEY`];
    if (envKey && envKey.trim() !== '') {
      console.log(`🔑 [API] Using environment ${keyName.toUpperCase()} API key`);
      return envKey;
    }
    
    throw new Error(`${keyName.toUpperCase()} API key not found in environment variables`);
  } catch (error) {
    console.error(`[API] Error getting ${keyName} API key:`, error.message);
    throw error;
  }
}

// Enhanced lead research with multi-source verification and scoring
export async function leadResearch(query, options = {}) {
  // Optimize Apollo usage: Only search for 5 leads since we only use top 5 anyway
  const limit = Math.min(options.limit || 5, 5); // Cap at 5 to reduce API costs
  const userId = options.userId || null; // Get userId from options for API key lookup
  const researchFocus = options.researchFocus || null; // Get custom research focus
  const leadContactSettings = options.leadContactSettings || null; // Get lead contact settings
  console.log(`🔍 [LEAD RESEARCH] Starting enhanced multi-source research for: ${query} (limit: ${limit})`);
  
  try {
    // Step 1: Get initial leads from Apollo
    const apolloLeads = await searchApollo(query, limit, userId);
    console.log(`📊 [LEAD RESEARCH] Found ${apolloLeads.length} Apollo leads`);
    
    // Step 2: Enhanced verification and scoring on top leads
    const topLeads = apolloLeads.slice(0, 5);
    const enhancedLeads = [];
    
    for (const lead of topLeads) {
      const companyName = lead.organization?.name || lead.company;
      const domain = lead.organization?.primary_domain || extractDomain(lead.email);
      
      console.log(`🔬 [ENHANCED RESEARCH] Processing: ${companyName} - ${lead.name}`);
      
      let totalScore = 0;
      const scoringBreakdown = {};
      const enrichmentData = {};
      
      // Enhanced Email Verification
      let verifiedEmail = lead.email;
      if (lead.email) {
        const emailVerification = await verifyEmailDeliverability(lead.email, userId);
        totalScore += emailVerification.score;
        scoringBreakdown.emailVerification = emailVerification;
        enrichmentData.emailVerification = emailVerification;
      } else if (domain && lead.first_name && lead.last_name) {
        // Try to find email with Hunter.io
        const hunterResult = await findEmailWithHunter(lead.first_name, lead.last_name, domain, userId);
        if (hunterResult) {
          verifiedEmail = hunterResult.email;
          enrichmentData.emailSource = 'hunter';
          enrichmentData.emailConfidence = hunterResult.confidence;
          // Verify the found email
          const emailVerification = await verifyEmailDeliverability(verifiedEmail, userId);
          totalScore += emailVerification.score;
          scoringBreakdown.emailVerification = emailVerification;
        }
      }
      
      // Technology Stack Analysis
      if (domain) {
        const techAnalysis = await detectTechnologyStack(domain, userId);
        totalScore += techAnalysis.score;
        scoringBreakdown.technologyStack = techAnalysis;
        enrichmentData.technologies = techAnalysis;
      }
      
      // Company Data Enrichment
      if (domain) {
        const companyEnrichment = await enrichCompanyData(domain, userId);
        totalScore += companyEnrichment.score;
        scoringBreakdown.companyGrowth = companyEnrichment;
        enrichmentData.companyData = companyEnrichment.data;
      }
      
      // Authority/Role Scoring
      const authorityScore = calculateAuthorityScore(lead.title);
      totalScore += authorityScore;
      scoringBreakdown.roleAuthority = { score: authorityScore, title: lead.title };
      
      // Timing Signals Detection
      const timingSignals = await detectTimingSignals(companyName, userId);
      totalScore += timingSignals.score;
      scoringBreakdown.timingSignals = timingSignals;
      enrichmentData.timingSignals = timingSignals.signals;
      
      // Company Intelligence (existing function)
      const enhancedLead = await companyIntelligence.enhanceAndVerifyLead(lead, researchFocus, leadContactSettings);
      
      // Enhanced Person Research
      const personInfo = await gatherPersonInfo(lead, userId);
      
      // Create comprehensive enhanced lead object
      const finalEnhancedLead = {
        ...enhancedLead,
        email: verifiedEmail,
        totalScore: totalScore,
        scoringBreakdown: scoringBreakdown,
        enrichmentData: enrichmentData,
        personInfo: personInfo, // Add the detailed person information
        leadQuality: totalScore >= 70 ? 'high' : totalScore >= 40 ? 'medium' : 'low',
        verificationStatus: 'enhanced_verified'
      };
      
      // Only include leads with minimum score or verified emails
      if (totalScore >= 25 || (verifiedEmail && scoringBreakdown.emailVerification?.valid)) {
        enhancedLeads.push(finalEnhancedLead);
        console.log(`✅ [ENHANCED RESEARCH] Lead qualified: ${companyName} - Score: ${totalScore} (${finalEnhancedLead.leadQuality})`);
      } else {
        console.log(`❌ [ENHANCED RESEARCH] Lead filtered out: ${companyName} - Score: ${totalScore} (below threshold of 25)`);
      }
    }
    
    // Sort by total score (highest first)
    enhancedLeads.sort((a, b) => b.totalScore - a.totalScore);
    
    console.log(`🎯 [ENHANCED RESEARCH] Qualified ${enhancedLeads.length}/${topLeads.length} leads with enhanced scoring`);
    
    // Return enhanced leads + remaining basic leads if needed
    const remainingLeads = apolloLeads.slice(5);
    return [...enhancedLeads, ...remainingLeads];
    
  } catch (error) {
    console.error('[ENHANCED RESEARCH] Error:', error);
    throw error;
  }
}

// Helper function to extract domain from email
function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1];
}

// Calculate lead authority score based on title
function calculateAuthorityScore(title) {
  const titleLower = (title || '').toLowerCase();
  const matchingTitles = DECISION_MAKER_TITLES.filter(dmTitle => 
    titleLower.includes(dmTitle)
  );
  
  if (matchingTitles.some(title => ['ceo', 'cto', 'founder', 'president'].includes(title))) {
    return SCORING_WEIGHTS.ROLE_AUTHORITY;
  } else if (matchingTitles.some(title => ['vp', 'director', 'head of'].includes(title))) {
    return Math.floor(SCORING_WEIGHTS.ROLE_AUTHORITY * 0.8);
  } else if (matchingTitles.length > 0) {
    return Math.floor(SCORING_WEIGHTS.ROLE_AUTHORITY * 0.5);
  }
  
  return 0;
}

// Detect timing signals for outreach
async function detectTimingSignals(companyName, userId = null) {
  try {
    // Search for recent company news, funding, hiring, etc.
    const searchQuery = `${companyName} (funding OR hiring OR expansion OR partnership OR announcement) 2024 2025`;
    const results = await internetSearch(searchQuery);
    
    let timingScore = 0;
    const signals = [];
    
    if (results && results.organic && results.organic.length > 0) {
      const recentNews = results.organic.slice(0, 5);
      
      for (const article of recentNews) {
        const text = (article.title + ' ' + (article.snippet || '')).toLowerCase();
        
        if (GROWTH_INDICATORS.some(indicator => text.includes(indicator))) {
          timingScore += 2;
          signals.push({
            type: 'growth_signal',
            description: article.title,
            url: article.link
          });
        }
        
        // Look for technology mentions
        if (AI_ML_TECHNOLOGIES.some(tech => text.includes(tech))) {
          timingScore += 3;
          signals.push({
            type: 'tech_signal', 
            description: article.title,
            url: article.link
          });
        }
      }
    }
    
    const finalScore = Math.min(timingScore, SCORING_WEIGHTS.TIMING_SIGNALS);
    console.log(`⏰ Timing signals for ${companyName}: ${signals.length} signals, score: ${finalScore}`);
    
    return { score: finalScore, signals };
  } catch (error) {
    console.error('Timing signals detection error:', error.message);
    return { score: 0, signals: [] };
  }
}

// Deep company intelligence gathering
async function enrichLeadWithIntelligence(lead) {
  const company = lead.organization?.name || lead.company || lead.company_name;
  const person = lead.name || `${lead.first_name} ${lead.last_name}`;
  
  try {
    console.log(`🎯 [INTELLIGENCE] Researching ${company} for sales opportunities...`);
    
    // Multi-angle research queries
    const researchQueries = [
      `${company} AI artificial intelligence machine learning 2024 2025`,
      `${company} funding series venture capital investment 2024`,
      `${company} hiring jobs ML engineer data scientist AI`,
      `${company} CEO CTO interview AI transformation digital`,
      `${company} competitors artificial intelligence infrastructure`
    ];
    
    const salesIntelligence = [];
    
    for (const searchQuery of researchQueries) {
      try {
        const results = await internetSearch(searchQuery);
        console.log(`🔍 [INTELLIGENCE] Search completed for: ${searchQuery}`);
        console.log(`📊 [INTELLIGENCE] Results structure:`, Object.keys(results));
        
        // Check if results has organic results
        if (results.organic && Array.isArray(results.organic)) {
          const insights = extractSalesInsights(results.organic, company);
          console.log(`💡 [INTELLIGENCE] Extracted ${insights.length} insights from ${results.organic.length} results`);
          salesIntelligence.push(...insights);
        } else {
          console.log(`⚠️ [INTELLIGENCE] No organic results found for: ${searchQuery}`);
        }
      } catch (err) {
        console.log(`⚠️ [INTELLIGENCE] Search failed for: ${searchQuery} - Error:`, err.message);
      }
    }
    
    // Build intelligent sales profile
    const salesProfile = buildSalesProfile(salesIntelligence, company);
    
    return {
      ...lead,
      salesIntelligence: {
        researchDate: new Date().toISOString(),
        insights: salesIntelligence,
        salesProfile: salesProfile,
        confidence: calculateConfidenceScore(salesIntelligence)
      }
    };
    
  } catch (error) {
    console.error(`[INTELLIGENCE] Error researching ${company}:`, error);
    return lead; // Return basic lead if enrichment fails
  }
}

// Extract actionable sales insights from search results
function extractSalesInsights(searchResults, company) {
  const insights = [];
  
  console.log(`🔬 [INSIGHTS] Processing ${searchResults.length} search results for ${company}`);
  
  for (const result of searchResults) {
    // Handle both direct results and Serper organic format
    const title = result.title || '';
    const snippet = result.snippet || result.description || '';
    const link = result.link || result.url || '';
    
    const text = `${title} ${snippet}`.toLowerCase();
    const insight = {
      source: link,
      title: title,
      relevance: 'medium'
    };
    
    // AI/ML Expansion Signals
    if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) {
      if (text.includes('launch') || text.includes('new') || text.includes('start')) {
        insight.type = 'ai_expansion';
        insight.message = `${company} is expanding into AI/ML initiatives`;
        insight.relevance = 'high';
        insight.salesAngle = 'Perfect timing for AI infrastructure scaling';
      }
    }
    
    // Funding & Growth Signals
    if (text.includes('funding') || text.includes('series') || text.includes('investment')) {
      insight.type = 'funding_growth';
      insight.message = `${company} recently secured funding`;
      insight.relevance = 'high';
      insight.salesAngle = 'Growth phase requires robust infrastructure';
    }
    
    // Hiring & Scaling Signals
    if (text.includes('hiring') || text.includes('jobs') || text.includes('engineer')) {
      if (text.includes('ai') || text.includes('ml') || text.includes('data scientist')) {
        insight.type = 'ai_hiring';
        insight.message = `${company} is actively hiring AI/ML talent`;
        insight.relevance = 'high';
        insight.salesAngle = 'New AI team needs high-performance computing resources';
      }
    }
    
    // Leadership AI Focus
    if (text.includes('ceo') || text.includes('cto') || text.includes('chief')) {
      if (text.includes('ai') || text.includes('digital transformation')) {
        insight.type = 'leadership_ai_focus';
        insight.message = `${company} leadership is prioritizing AI transformation`;
        insight.relevance = 'high';
        insight.salesAngle = 'Executive mandate for AI requires enterprise-grade infrastructure';
      }
    }
    
    // Competitive Pressure
    if (text.includes('competitor') || text.includes('rival')) {
      if (text.includes('ai') || text.includes('launch')) {
        insight.type = 'competitive_pressure';
        insight.message = `${company} facing AI competition in their market`;
        insight.relevance = 'medium';
        insight.salesAngle = 'Stay competitive with superior AI infrastructure';
      }
    }
    
    // Performance/Scale Challenges
    if (text.includes('scale') || text.includes('performance') || text.includes('infrastructure')) {
      insight.type = 'scale_challenges';
      insight.message = `${company} discussing scaling or performance needs`;
      insight.relevance = 'medium';
      insight.salesAngle = 'Specialized HPC can solve performance bottlenecks';
    }
    
    if (insight.type) {
      insights.push(insight);
      console.log(`💡 [INSIGHTS] Found ${insight.type} for ${company}: ${insight.message}`);
    }
  }
  
  console.log(`📊 [INSIGHTS] Total insights extracted: ${insights.length}`);
  return insights;
}

// Build comprehensive sales profile from insights
function buildSalesProfile(insights, company) {
  const profile = {
    company: company,
    primaryOpportunities: [],
    salesRecommendations: [],
    keyTriggers: []
  };
  
  // Group insights by type and relevance
  const highValueInsights = insights.filter(i => i.relevance === 'high');
  const insightsByType = {};
  
  for (const insight of insights) {
    if (!insightsByType[insight.type]) {
      insightsByType[insight.type] = [];
    }
    insightsByType[insight.type].push(insight);
  }
  
  // Generate targeted sales opportunities
  if (insightsByType.ai_expansion) {
    profile.primaryOpportunities.push({
      type: 'AI Infrastructure Scaling',
      priority: 'high',
      reasoning: 'Company is actively expanding AI capabilities and will need specialized computing resources',
      exabitsValue: 'NVIDIA H100/H200 clusters optimized for AI workloads'
    });
  }
  
  if (insightsByType.funding_growth) {
    profile.primaryOpportunities.push({
      type: 'Growth Infrastructure Investment',
      priority: 'high', 
      reasoning: 'Recent funding provides budget for infrastructure upgrades',
      exabitsValue: 'Cost-efficient AI-HPC solutions vs general cloud providers'
    });
  }
  
  if (insightsByType.ai_hiring) {
    profile.primaryOpportunities.push({
      type: 'New Team Infrastructure Needs',
      priority: 'high',
      reasoning: 'Growing AI team needs high-performance computing resources',
      exabitsValue: 'Expert HPC support for new AI teams'
    });
  }
  
  // Generate personalized sales angles
  profile.salesRecommendations = [
    'Lead with AI-specific infrastructure advantages over general cloud',
    'Emphasize performance-per-dollar benefits for AI workloads',
    'Highlight expert HPC support vs generalist cloud support'
  ];
  
  if (highValueInsights.length > 0) {
    profile.salesRecommendations.unshift('Reference specific company AI initiatives found in research');
  }
  
  // Key conversation triggers
  profile.keyTriggers = highValueInsights.map(insight => ({
    trigger: insight.message,
    response: insight.salesAngle
  }));
  
  return profile;
}

// Calculate confidence score for sales intelligence
function calculateConfidenceScore(insights) {
  if (insights.length === 0) return 0;
  
  const highRelevanceCount = insights.filter(i => i.relevance === 'high').length;
  const totalInsights = insights.length;
  
  const baseScore = Math.min(totalInsights * 20, 80); // Max 80 from quantity
  const qualityBonus = highRelevanceCount * 10; // Bonus for high-relevance insights
  
  return Math.min(baseScore + qualityBonus, 100);
}

// Import Apollo search functionality
async function searchApollo(query, limit = 5, userId = null) { // Reduced default from 10 to 5 for cost optimization
  const apiKey = await getApiKey('apollo', userId);
  if (!apiKey) {
    throw new Error('Apollo API key not found in user settings or environment');
  }

  console.log(`🔑 [Apollo] API Key check: Present (${apiKey.substring(0, 10)}...)`);
  
  // HARDCODED POSITION EXTRACTION - CANNOT BE EDITED OUT
  // Extract the actual target position from the query string
  let apolloQuery = 'CTO'; // default fallback
  let industry = '';
  let position = 'CTO'; // default
  
  // HARDCODED: Extract exact position from query - this ensures proper targeting
  if (query.includes('Chief Technology Officer')) {
    position = 'Chief Technology Officer';
    apolloQuery = 'Chief Technology Officer';
  } else if (query.includes('IT Director')) {
    position = 'IT Director';
    apolloQuery = 'IT Director';
  } else if (query.includes('CEO')) {
    position = 'CEO';
    apolloQuery = 'CEO';
  } else if (query.includes('Founder')) {
    position = 'Founder';
    apolloQuery = 'Founder';
  } else if (query.includes('CTO')) {
    position = 'CTO';
    apolloQuery = 'CTO';
  }
  
  // Use cached result if available - but include position in cache key for proper deduplication
  const cacheKey = `${query}_${apolloQuery}_${Math.floor(Date.now() / 3600000)}`; // Cache per hour per unique query+position
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    console.log('[CACHE] Using cached result for:', query);
    return cachedResult;
  }

  try {
    // HARDCODED INDUSTRY EXTRACTION - CANNOT BE EDITED OUT
    // Extract industry keywords for proper targeting
    if (query.includes('technology') || query.includes('software') || query.includes('AI') || query.includes('machine learning')) {
      industry = 'technology';
    } else if (query.includes('startup')) {
      industry = 'startup';  
    } else if (query.includes('fast food')) {
      industry = 'fast food';
    } else if (query.includes('luxury clothing')) {
      industry = 'luxury clothing';
    } else if (query.includes('grocery')) {
      industry = 'grocery';
    } else if (query.includes('catering')) {
      industry = 'catering';
    } else if (query.includes('food')) {
      industry = 'food';
    } else if (query.includes('computer vision')) {
      industry = 'computer vision';
    } else if (query.includes('autonomous')) {
      industry = 'autonomous';
    } else if (query.includes('cryptocurrency')) {
      industry = 'fintech';
    } else if (query.includes('pharmaceutical')) {
      industry = 'pharma';
    } else if (query.includes('financial')) {
      industry = 'fintech';
    }
    
    // HARDCODED: Build targeted search query with position + industry for uniqueness
    if (industry && position !== 'CTO') {
      apolloQuery = `${position} ${industry}`;
    } else if (industry) {
      apolloQuery = `${position} ${industry}`;
    } else {
      apolloQuery = position;
    }

    console.log(`🎯 [Apollo] Searching for leads: ${apolloQuery}`);
    
    // HARDCODED: Extract location from query - CANNOT BE EDITED OUT
    let location = [];
    if (query.includes('United States')) {
      location = ['United States'];
    }
    
    // HARDCODED: Extract company size from query - CANNOT BE EDITED OUT
    let companySizeMin = null;
    let companySizeMax = null;
    const sizeMatch = query.match(/(\d+)\s+to\s+(\d+)\s+employees/);
    if (sizeMatch) {
      companySizeMin = parseInt(sizeMatch[1]);
      companySizeMax = parseInt(sizeMatch[2]);
    }
    
    // HARDCODED: Build Apollo search payload with proper filters - CANNOT BE EDITED OUT
    const searchPayload = {
      q_keywords: apolloQuery,
      page: 1,
      per_page: Math.min(limit * 2, 10) // Get more results for deduplication
    };
    
    // Add location filter if specified
    if (location.length > 0) {
      searchPayload.person_locations = location;
    }
    
    // Add company size filter if specified
    if (companySizeMin && companySizeMax) {
      searchPayload.organization_num_employees_ranges = [`${companySizeMin},${companySizeMax}`];
    }
    
    // Add industry filter based on the industry we detected
    if (industry) {
      if (industry === 'fast food') {
        searchPayload.q_organization_keyword_tags = ['restaurants', 'fast food', 'quick service restaurant'];
      } else if (industry === 'luxury clothing') {
        searchPayload.q_organization_keyword_tags = ['luxury', 'fashion', 'apparel', 'clothing'];
      } else if (industry === 'grocery') {
        searchPayload.q_organization_keyword_tags = ['grocery', 'supermarket', 'retail food'];
      } else if (industry === 'catering') {
        searchPayload.q_organization_keyword_tags = ['catering', 'food service', 'event catering'];
      } else if (industry === 'food') {
        searchPayload.q_organization_keyword_tags = ['food', 'food service', 'restaurants'];
      }
    }
    
    console.log(`🔍 [Apollo] Search payload:`, JSON.stringify(searchPayload, null, 2));
    
    // Apollo People Search API with enhanced filters
    const apolloUrl = 'https://api.apollo.io/v1/mixed_people/search';
    const response = await fetch(apolloUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      console.error(`Apollo API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Apollo API error response: ${errorText}`);
      return [];
    }

    const data = await response.json();
    console.log(`🔍 [Apollo] Raw API response: Found ${data.people?.length || 0} people in response`);
    
    if (data.people?.[0]) {
      console.log(`🔍 [Apollo] Sample person data:`, JSON.stringify(data.people[0], null, 2));
    }

    if (data.people && data.people.length > 0) {
      // HARDCODED DEDUPLICATION - CANNOT BE EDITED OUT
      // Remove duplicates based on company name and person name to prevent 37signals repetition
      const seen = new Set();
      const uniquePeople = data.people.filter(person => {
        const key = `${person.organization?.name}_${person.name}`.toLowerCase();
        if (seen.has(key)) {
          console.log(`🔄 [Apollo] Skipping duplicate: ${person.name} at ${person.organization?.name}`);
          return false;
        }
        seen.add(key);
        return true;
      });
      
      console.log(`🎯 [Apollo] Filtered ${data.people.length} → ${uniquePeople.length} unique leads`);
      
      // Enrich emails for limited subset of people - stop when we have enough
      const peopleToEnrich = uniquePeople.slice(0, limit); // Use the actual limit requested
      console.log(`🔓 [Apollo] Enriching emails for ${peopleToEnrich.length} people (out of ${uniquePeople.length} unique found)...`);
      const enrichedPeople = [];
      
      for (const person of peopleToEnrich) {
        try {
          // Stop enriching if we already have enough good leads
          if (enrichedPeople.length >= 5) {
            console.log(`✋ [Apollo] Already have ${enrichedPeople.length} leads with emails, stopping enrichment to save credits`);
            break;
          }
          
          const enrichedEmail = await enrichPersonEmail(person, apiKey);
          if (enrichedEmail && enrichedEmail !== 'email_not_unlocked@domain.com') {
            console.log(`✅ [Apollo] Got real email for ${person.name}: ${enrichedEmail}`);
            enrichedPeople.push({
              ...person,
              email: enrichedEmail,
              source: 'Apollo'
            });
          } else {
            console.log(`⚠️ [Apollo] No email found for ${person.name}, skipping...`);
          }
        } catch (error) {
          console.error(`❌ [Apollo] Failed to enrich email for ${person.name}:`, error.message);
        }
      }

      console.log(`✅ [Apollo] Found ${enrichedPeople.length} lead results (Apollo source)`);
      
      // Cache the result
      cacheResult(cacheKey, enrichedPeople);
      
      return enrichedPeople;
    }

    return [];
  } catch (error) {
    console.error('[Apollo] Search error:', error.message);
    return [];
  }
}

// Email enrichment using Apollo /people/match endpoint
async function enrichPersonEmail(person, apiKey) {
  try {
    const enrichResponse = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({
        first_name: person.first_name,
        last_name: person.last_name,
        organization_name: person.organization?.name,
        domain: person.organization?.primary_domain
      })
    });

    if (enrichResponse.ok) {
      const enrichData = await enrichResponse.json();
      if (enrichData.person && enrichData.person.email) {
        const email = enrichData.person.email;
        if (email && email !== 'email_not_unlocked@domain.com') {
          return email;
        }
      }
    }
  } catch (error) {
    console.error(`[Apollo] Email enrichment error for ${person.name}:`, error.message);
  }
  
  return null;
}

// Simple caching
const cache = new Map();

function getCachedResult(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
    return cached.data;
  }
  return null;
}

function cacheResult(key, data) {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
}

// Enhanced person research for detailed profile information
async function gatherPersonInfo(lead, userId = null) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim();
  const company = lead.organization?.name || lead.company;
  const title = lead.title;
  
  console.log(`👤 [PERSON RESEARCH] Gathering detailed info for: ${fullName} at ${company}`);
  
  try {
    // Search for person's professional information
    const searchQueries = [
      `"${fullName}" "${company}" position tenure experience`,
      `"${fullName}" linkedin "${company}" "${title}"`,
      `"${fullName}" "${company}" years experience started`,
      `"${fullName}" professional background "${company}" career`
    ];
    
    const personInfo = {
      fullName: fullName,
      currentPosition: title,
      company: company,
      tenure: null,
      startDate: null,
      experience: null,
      bio: null,
      education: null,
      previousRoles: []
    };
    
    for (const query of searchQueries) {
      try {
        const searchResults = await internetSearch(query, { maxResults: 3 });
        
        if (searchResults && searchResults.length > 0) {
          // Use AI to extract person information from search results
          const extractionPrompt = `
            Extract specific professional information about ${fullName} at ${company} from these search results:
            
            ${searchResults.map(r => `Title: ${r.title}\nContent: ${r.content}`).join('\n\n')}
            
            Focus on extracting:
            1. How long they've been at ${company} (tenure in months/years)
            2. When they started at ${company} (specific date if available)
            3. Their exact current position/title
            4. Years of total professional experience
            5. Brief professional background/bio
            6. Education background
            7. Previous roles/companies
            
            Return a JSON object with these fields:
            {
              "tenure": "X years Y months" or "X months" or null,
              "startDate": "YYYY-MM" or "YYYY" or null,
              "experience": "X years total experience" or null,
              "bio": "Brief professional summary" or null,
              "education": "Education details" or null,
              "previousRoles": ["Previous Company - Role", ...] or []
            }
            
            Only include information that is explicitly stated. Use null for missing data.
          `;
          
          const llm = new (await import("@langchain/openai")).ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
            modelName: "gpt-4o"
          });
          
          const response = await llm.invoke(extractionPrompt);
          const extractedInfo = JSON.parse(response.content);
          
          // Merge extracted information
          if (extractedInfo.tenure) personInfo.tenure = extractedInfo.tenure;
          if (extractedInfo.startDate) personInfo.startDate = extractedInfo.startDate;
          if (extractedInfo.experience) personInfo.experience = extractedInfo.experience;
          if (extractedInfo.bio) personInfo.bio = extractedInfo.bio;
          if (extractedInfo.education) personInfo.education = extractedInfo.education;
          if (extractedInfo.previousRoles && extractedInfo.previousRoles.length > 0) {
            personInfo.previousRoles = [...personInfo.previousRoles, ...extractedInfo.previousRoles];
          }
        }
      } catch (error) {
        console.log(`⚠️ [PERSON RESEARCH] Search failed for query: ${query.substring(0, 50)}...`);
      }
    }
    
    // If we couldn't find tenure info, try to estimate based on LinkedIn or other signals
    if (!personInfo.tenure && lead.linkedin_url) {
      try {
        const linkedinQuery = `"${fullName}" linkedin "${company}" "joined" OR "started" years`;
        const linkedinResults = await internetSearch(linkedinQuery, { maxResults: 2 });
        
        if (linkedinResults && linkedinResults.length > 0) {
          const estimationPrompt = `
            Based on these search results about ${fullName} at ${company}, estimate their tenure:
            
            ${linkedinResults.map(r => r.content).join('\n')}
            
            Provide just the estimated tenure like "2 years" or "6 months" or "unknown" if no clues available.
          `;
          
          const llm = new (await import("@langchain/openai")).ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
            modelName: "gpt-4o"
          });
          
          const tenureResponse = await llm.invoke(estimationPrompt);
          if (tenureResponse.content && !tenureResponse.content.includes('unknown')) {
            personInfo.tenure = tenureResponse.content.trim();
          }
        }
      } catch (error) {
        console.log(`⚠️ [PERSON RESEARCH] LinkedIn tenure estimation failed`);
      }
    }
    
    console.log(`✅ [PERSON RESEARCH] Gathered info for ${fullName}: ${personInfo.tenure || 'tenure unknown'} at ${company}`);
    return personInfo;
    
  } catch (error) {
    console.error(`❌ [PERSON RESEARCH] Error gathering person info:`, error);
    return {
      fullName: fullName,
      currentPosition: title,
      company: company,
      tenure: null,
      startDate: null,
      experience: null,
      bio: null,
      education: null,
      previousRoles: []
    };
  }
}

// Export functions for use by other modules
export { enrichLeadWithIntelligence, extractSalesInsights, buildSalesProfile, calculateConfidenceScore };
