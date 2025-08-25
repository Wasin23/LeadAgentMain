// Lead-specific research tool for the Lead Contact Agent
// Returns Apollo leads as an array, bypassing the general deepResearch structure

import 'dotenv/config';

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

// Main lead research function
async function leadResearch(baseQuery, options = {}) {
  console.log(`🚀 [LeadResearch] Starting lead research for: "${baseQuery}"`);
  
  const { limit = 20 } = options;
  const allLeads = [];
  
  // Create multiple search variants to find diverse leads
  const searchVariants = [
    baseQuery,
    `"companies" "CTO" OR "VP Engineering" OR "Head of AI"`,
    `${baseQuery} contact email LinkedIn decision maker`,
    `"companies" funding artificial intelligence automation`,
    `${baseQuery} technology stack engineering team size`
  ];
  
  console.log(`🔍 [LeadResearch] Searching ${searchVariants.length} variants...`);
  
  for (const [index, variant] of searchVariants.entries()) {
    console.log(`🔍 [LeadResearch] Variant ${index + 1}/${searchVariants.length}: "${variant}"`);
    
    try {
      const apolloResults = await searchApollo(variant, 10);
      
      if (apolloResults && apolloResults.length > 0) {
        console.log(`✅ [LeadResearch] Found ${apolloResults.length} leads for variant ${index + 1}`);
        allLeads.push(...apolloResults);
      } else {
        console.log(`❌ [LeadResearch] No leads found for variant ${index + 1}`);
      }
      
      // Add delay between searches
      if (index < searchVariants.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ [LeadResearch] Error with variant ${index + 1}:`, error.message);
    }
  }
  
  // Remove duplicates based on email
  const uniqueLeads = [];
  const seenEmails = new Set();
  
  for (const lead of allLeads) {
    if (lead.email && !seenEmails.has(lead.email)) {
      seenEmails.add(lead.email);
      uniqueLeads.push(lead);
    }
  }
  
  console.log(`📊 [LeadResearch] Found ${allLeads.length} total, ${uniqueLeads.length} unique leads`);
  
  // Limit results
  const finalLeads = uniqueLeads.slice(0, limit);
  
  console.log(`🎯 [LeadResearch] Returning ${finalLeads.length} enriched leads`);
  
  if (finalLeads.length > 0) {
    console.log(`📧 [LeadResearch] Sample lead:`, {
      name: finalLeads[0].name,
      email: finalLeads[0].email,
      company: finalLeads[0].organization?.name,
      title: finalLeads[0].title
    });
  }
  
  return finalLeads;
}

export { leadResearch };
