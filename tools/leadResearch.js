// Lead-specific research tool for the Lead Contact Agent
// Enhanced with deep company research for intelligent sales targeting

import 'dotenv/config';
import { internetSearch } from './internetSearch.js';

// Enhanced lead research with company intelligence
export async function leadResearch(query, options = {}) {
  const limit = options.limit || 10;
  console.log(`🔍 [LEAD RESEARCH] Starting enhanced research for: ${query}`);
  
  try {
    // Step 1: Get initial leads from Apollo
    const apolloLeads = await searchApollo(query, limit);
    console.log(`📊 [LEAD RESEARCH] Found ${apolloLeads.length} Apollo leads`);
    
    // Step 2: Enhanced research on top 5 leads
    const topLeads = apolloLeads.slice(0, 5);
    const enhancedLeads = [];
    
    for (const lead of topLeads) {
      console.log(`🔬 [LEAD RESEARCH] Deep research on: ${lead.organization?.name || lead.company}`);
      const enrichedLead = await enrichLeadWithIntelligence(lead);
      enhancedLeads.push(enrichedLead);
    }
    
    // Step 3: Return mix of enhanced + remaining basic leads
    const remainingLeads = apolloLeads.slice(5);
    return [...enhancedLeads, ...remainingLeads];
    
  } catch (error) {
    console.error('[LEAD RESEARCH] Error:', error);
    throw error;
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
async function searchApollo(query, limit = 10) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error('Apollo API key not found');
  }

  console.log(`🔑 [Apollo] API Key check: Present (${apiKey.substring(0, 10)}...)`);
  
  // Use cached result if available
  const cacheKey = query;
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    console.log('[CACHE] Using cached result for:', query);
    return cachedResult;
  }

  try {
    // Use simpler Apollo query - extract key terms from complex query
    let apolloQuery = 'CTO';
    if (query.includes('computer vision')) apolloQuery = 'CTO computer vision';
    else if (query.includes('autonomous')) apolloQuery = 'CTO autonomous';
    else if (query.includes('cryptocurrency')) apolloQuery = 'CTO fintech';
    else if (query.includes('pharmaceutical')) apolloQuery = 'CTO pharma';
    else if (query.includes('financial')) apolloQuery = 'CTO fintech';

    console.log(`🎯 [Apollo] Searching for leads: ${apolloQuery}`);
    
    // Apollo People Search API with minimal parameters (same as deepResearch.js)
    const apolloUrl = 'https://api.apollo.io/v1/mixed_people/search';
    const response = await fetch(apolloUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({
        q_keywords: apolloQuery,
        page: 1,
        per_page: limit
      })
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
      // Enrich emails for all people
      console.log(`🔓 [Apollo] Enriching emails for ${data.people.length} people...`);
      const enrichedPeople = [];
      
      for (const person of data.people.slice(0, 5)) { // Limit to 5 to avoid rate limits
        try {
          const enrichedEmail = await enrichPersonEmail(person, apiKey);
          if (enrichedEmail && enrichedEmail !== 'email_not_unlocked@domain.com') {
            console.log(`✅ [Apollo] Got real email for ${person.name}: ${enrichedEmail}`);
            enrichedPeople.push({
              ...person,
              email: enrichedEmail,
              source: 'Apollo'
            });
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

// Export functions for use by other modules
export { enrichLeadWithIntelligence, extractSalesInsights, buildSalesProfile, calculateConfidenceScore };
