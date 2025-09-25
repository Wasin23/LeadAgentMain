import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { internetSearch, internetSearchWithKey } from './internetSearch.js';

// Text-only chat function to prevent infinite loops
async function chatWithTextOnly(prompt, chatModel) {
  if (!chatModel) {
    console.warn('[TEXT CHAT] No OpenAI API key available for text processing');
    return 'Text processing unavailable - no OpenAI API key configured';
  }
  try {
    const response = await chatModel.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error('Error in text-only chat:', error);
    throw error;
  }
}

// Enhanced Wikipedia search with content extraction
async function searchWikipedia(query, limit = 5) {
  try {
    console.log(`🔍 [Wikipedia] Searching for: ${query}`);
    
    // Simplify query for Wikipedia by removing common research words and focusing on key terms
    let simplifiedQuery = query
      .toLowerCase()
      .replace(/^(research|what is|find|search|about|regarding|concerning)\s+/gi, '')
      .replace(/\b(the|best|largest|top|main|primary|key|most|recent|latest|new|old)\b/gi, '')
      .replace(/\b(in the|during|from|since|until|between)\s+\d{4}s?\b/gi, '') // Remove date ranges
      .replace(/\b\d{4}\b/gi, '') // Remove years
      .replace(/\s+/g, ' ')
      .trim();
    
    // For very long queries, try to extract the main subject
    if (simplifiedQuery.length > 50) {
      const words = simplifiedQuery.split(' ');
      // Take the first few meaningful words
      simplifiedQuery = words.slice(0, 4).join(' ');
    }
    
    console.log(`🔍 [Wikipedia] Simplified query: "${simplifiedQuery}"`);
    
    // Search for articles
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(simplifiedQuery)}&limit=${limit}&namespace=0&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData[1] || searchData[1].length === 0) {
      console.log(`⚠️ [Wikipedia] No results found for simplified query: ${simplifiedQuery}`);
      
      // Try even more simplified query with just the first 2-3 words
      if (simplifiedQuery.split(' ').length > 2) {
        const fallbackQuery = simplifiedQuery.split(' ').slice(0, 2).join(' ');
        console.log(`🔍 [Wikipedia] Trying fallback query: "${fallbackQuery}"`);
        
        const fallbackUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(fallbackQuery)}&limit=${limit}&namespace=0&format=json&origin=*`;
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        
        if (!fallbackData[1] || fallbackData[1].length === 0) {
          console.log(`⚠️ [Wikipedia] No results found for fallback query: ${fallbackQuery}`);
          return [];
        }
        
        // Use fallback results
        var titles = fallbackData[1];
        var descriptions = fallbackData[2];
        var urls = fallbackData[3];
      } else {
        return [];
      }
    } else {
      var titles = searchData[1];
      var descriptions = searchData[2];
      var urls = searchData[3];
    }
    
    const results = [];
    
    // Get content for each article
    for (let i = 0; i < Math.min(titles.length, limit); i++) {
      try {
        const title = titles[i];
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(title)}&prop=extracts&exintro&explaintext&exsectionformat=plain&origin=*`;
        const extractResponse = await fetch(extractUrl);
        const extractData = await extractResponse.json();
        
        const pages = extractData.query.pages;
        const pageId = Object.keys(pages)[0];
        const extract = pages[pageId].extract || descriptions[i] || '';
        
        results.push({
          title,
          url: urls[i],
          snippet: extract.substring(0, 500) + (extract.length > 500 ? '...' : ''),
          source: 'Wikipedia'
        });
      } catch (error) {
        console.error(`Error fetching Wikipedia content for ${titles[i]}:`, error);
        // Fallback to basic info
        results.push({
          title: titles[i],
          url: urls[i],
          snippet: descriptions[i] || 'Wikipedia article',
          source: 'Wikipedia'
        });
      }
    }
    
    console.log(`✅ [Wikipedia] Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return [];
  }
}

// Enhanced arXiv search
async function searchArxiv(query, limit = 4) {
  try {
    console.log(`🔍 [arXiv] Searching for: ${query}`);
    
    const searchUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;
    const response = await fetch(searchUrl);
    const xmlText = await response.text();
    
    // Parse XML manually (simple approach)
    const entries = xmlText.split('<entry>').slice(1);
    const results = [];
    
    for (const entry of entries.slice(0, limit)) {
      try {
        const titleMatch = entry.match(/<title>(.*?)<\/title>/s);
        const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/s);
        const linkMatch = entry.match(/<id>(.*?)<\/id>/);
        
        if (titleMatch && linkMatch) {
          results.push({
            title: titleMatch[1].trim().replace(/\n\s+/g, ' '),
            url: linkMatch[1].trim(),
            snippet: summaryMatch ? summaryMatch[1].trim().replace(/\n\s+/g, ' ').substring(0, 400) + '...' : '',
            source: 'arXiv'
          });
        }
      } catch (error) {
        console.error('Error parsing arXiv entry:', error);
      }
    }
    
    console.log(`✅ [arXiv] Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('arXiv search error:', error);
    return [];
  }
}

// Enhanced GitHub search
async function searchGithub(query, limit = 4) {
  try {
    console.log(`🔍 [GitHub] Searching for: ${query}`);
    
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ExaMark-Research-Tool'
      }
    });
    
    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const results = data.items?.map(item => ({
      title: item.full_name,
      url: item.html_url,
      snippet: `${item.description || 'No description'} (Stars: ${item.stargazers_count}, Language: ${item.language || 'N/A'})`,
      source: 'GitHub'
    })) || [];
    
    console.log(`✅ [GitHub] Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('GitHub search error:', error);
    return [];
  }
}

// Apollo API search for leads and contacts
async function searchApollo(query, limit = 10) {
  try {
    console.log(`🎯 [Apollo] Searching for leads: ${query}`);
    
    // Apollo API configuration - use environment variable only
    const apolloApiKey = process.env.APOLLO_API_KEY;
    
    if (!apolloApiKey || apolloApiKey === 'your_apollo_api_key_here') {
      console.log(`[APOLLO] No valid API key available in environment variables`);
      return [];
    }
    
    console.log(`[APOLLO] Using API key from environment variable (${apolloApiKey.substring(0, 10)}...)`);
    const apolloKeySource = 'environment variable';
    
    console.log(`[APOLLO] API Key source: ${apolloKeySource}`);

    // Try simpler Apollo query first
    let apolloQuery = 'CTO';
    
    // Apollo People Search API with minimal parameters
    const apolloUrl = 'https://api.apollo.io/v1/mixed_people/search';
    const response = await fetch(apolloUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apolloApiKey
      },
      body: JSON.stringify({
        q_keywords: apolloQuery,
        page: 1,
        per_page: 10
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
    console.log(`🔍 [Apollo] Sample person data:`, data.people?.[0] ? JSON.stringify(data.people[0], null, 2) : 'No people found');
    
    let results = [];
    
    if (data.people && data.people.length > 0) {
      // Apollo results available - now get real emails for each person
      console.log(`🔓 [Apollo] Enriching emails for ${data.people.length} people...`);
      
      const enrichedPeople = await Promise.all(
        data.people.slice(0, 5).map(async (person) => { // Limit to 5 to avoid rate limits
          try {
            // Use people/match endpoint to get real email
            const enrichResponse = await fetch('https://api.apollo.io/v1/people/match', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apolloApiKey
              },
              body: JSON.stringify({
                first_name: person.first_name,
                last_name: person.last_name,
                organization_name: person.organization?.name,
                reveal_personal_emails: true
              })
            });

            if (enrichResponse.ok) {
              const enrichData = await enrichResponse.json();
              const enrichedPerson = enrichData.person;
              if (enrichedPerson && enrichedPerson.email && !enrichedPerson.email.includes('email_not_unlocked')) {
                console.log(`✅ [Apollo] Got real email for ${person.first_name} ${person.last_name}: ${enrichedPerson.email}`);
                return { ...person, email: enrichedPerson.email };
              }
            }
          } catch (error) {
            console.log(`⚠️ [Apollo] Email enrichment failed for ${person.first_name} ${person.last_name}`);
          }
          return person; // Return original if enrichment fails
        })
      );

      results = enrichedPeople.map(person => {
        const company = person.organization || {};
        const companySize = company.estimated_num_employees || 'Unknown size';
        const funding = company.funding_stage_cd || 'Unknown funding';
        const hasRealEmail = person.email && !person.email.includes('email_not_unlocked');
        
        return {
          title: `${person.first_name} ${person.last_name} - ${person.title || 'Unknown Title'}`,
          url: person.linkedin_url || '#',
          snippet: `🎯 ${person.title || 'Unknown Title'} at ${company.name || 'Unknown Company'} (${company.industry || 'Unknown Industry'}). ${hasRealEmail ? `📧 ${person.email}` : '📧 Email enrichment available'}. 👥 ${companySize} employees. 💰 ${funding} stage. 📍 ${person.city || 'Unknown'}, ${person.state || person.country || ''}. 🚀 High-priority lead for AI automation services.`,
          source: 'Apollo',
          email: hasRealEmail ? person.email : `${person.first_name.toLowerCase()}.${person.last_name.toLowerCase()}@${company.primary_domain || 'company.com'}`,
          apollo_data: {
            linkedin_url: person.linkedin_url,
            company_domain: company.primary_domain,
            company_phone: company.phone,
            employee_count: company.estimated_num_employees,
            founded_year: company.founded_year,
            industry: company.industry,
            location: person.formatted_address,
            has_real_email: hasRealEmail
          }
        };
      });
    } else {
      // Fallback: Extract leads from web search results
      console.log(`🔄 [Apollo] No Apollo results, using web search fallback for lead extraction`);
      
      // Perform web search with lead-focused query
      const webQuery = `"CTO" OR "VP Engineering" OR "Head of AI" OR "Director of Technology" email contact`;
      console.log(`🔍 [WebFallback] Searching: ${webQuery}`);
      
      const webSearchResult = await performInternetSearch(webQuery);
      const webResults = webSearchResult?.organic || [];
      
      // Extract potential leads from web results
      results = webResults.slice(0, 10).map((result, index) => {
        return {
          title: result.title || `Lead ${index + 1}`,
          url: result.link || '#',
          snippet: `🌐 ${result.snippet || 'Web-sourced lead for AI automation services. Requires manual verification of contact details.'} 🚀 Potential prospect for GPU computing solutions.`,
          source: 'WebFallback'
        };
      });
    }
    
    console.log(`✅ [Apollo] Found ${results.length} lead results (${results[0]?.source || 'Unknown'} source)`);
    return results;
  } catch (error) {
    console.error('Apollo search error:', error);
    return [];
  }
}

// Generate search query variants with AI-powered optimization
function generateQueryVariants(originalQuery, mode = 'fresh') {
  const variants = [originalQuery];
  
  if (mode === 'lead') {
    // Strategic lead search variants optimized for finding decision makers
    variants.push(
      `"${extractCompanyType(originalQuery)}" "CTO" OR "VP Engineering" OR "Head of AI"`,
      `${originalQuery} contact email LinkedIn decision maker`,
      `"${extractCompanyType(originalQuery)}" funding artificial intelligence automation`,
      `${originalQuery} technology stack engineering team size`
    );
  } else {
    // Fresh mode with temporal and context-aware variants
    const currentYear = new Date().getFullYear();
    variants.push(
      `${originalQuery} ${currentYear} latest research breakthrough`,
      `"${originalQuery}" state of the art recent developments`,
      `${originalQuery} comprehensive analysis trends ${currentYear}`,
      `${originalQuery} implementation guide best practices tutorial`,
      `${originalQuery} market analysis industry report ${currentYear}`
    );
  }
  
  return variants.slice(0, 5); // Increased to 5 for better coverage
}

// Extract company type or industry from query for better targeting
function extractCompanyType(query) {
  const industries = ['fintech', 'healthcare', 'saas', 'startup', 'enterprise', 'manufacturing', 'retail', 'logistics', 'real estate'];
  const found = industries.find(industry => query.toLowerCase().includes(industry));
  return found || 'companies';
}

// Remove duplicates based on URL similarity
function removeDuplicates(results) {
  const seen = new Set();
  return results.filter(result => {
    const key = result.url.toLowerCase();
    const domain = key.split('/')[2] || key;
    const normalizedKey = domain + '::' + result.title.toLowerCase().substring(0, 50);
    
    if (seen.has(normalizedKey)) {
      return false;
    }
    seen.add(normalizedKey);
    return true;
  });
}

// Score and rank results for relevance and quality
function scoreAndRankResults(results, query, mode) {
  const queryWords = query.toLowerCase().split(/\s+/);
  
  return results.map(result => {
    let score = 0;
    const title = result.title.toLowerCase();
    const snippet = result.snippet.toLowerCase();
    const content = `${title} ${snippet}`;
    
    // Basic relevance scoring
    queryWords.forEach(word => {
      if (word.length > 2) {
        if (title.includes(word)) score += 3;
        if (snippet.includes(word)) score += 1;
      }
    });
    
    // Source authority scoring
    const sourceScores = {
      'Apollo': mode === 'lead' ? 10 : 2,
      'Web': 5,
      'Wikipedia': mode === 'lead' ? 2 : 8,
      'arXiv': mode === 'lead' ? 1 : 9,
      'GitHub': mode === 'lead' ? 3 : 7
    };
    score += sourceScores[result.source] || 1;
    
    // Quality indicators for lead mode
    if (mode === 'lead') {
      if (content.includes('cto') || content.includes('ceo') || content.includes('vp')) score += 5;
      if (content.includes('email') || content.includes('contact')) score += 3;
      if (content.includes('@') && content.includes('.com')) score += 4;
      if (content.includes('linkedin')) score += 2;
      if (content.includes('funding') || content.includes('series')) score += 3;
    }
    
    // Quality indicators for research mode
    if (mode === 'fresh') {
      if (content.includes('2024') || content.includes('2025')) score += 2;
      if (content.includes('research') || content.includes('study')) score += 2;
      if (content.includes('analysis') || content.includes('report')) score += 2;
    }
    
    // Penalty for thin content
    if (snippet.length < 50) score -= 2;
    
    return { ...result, relevanceScore: score };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Main deep research function
export async function deepResearch(query, options = {}) {
  const { mode = 'fresh', limit = 25, progressCallback } = options;
  
  console.log(`🔬 [DeepResearch] Starting research for: "${query}" (mode: ${mode})`);
  
  // Create OpenAI instance with environment variable API key
  const openAIApiKey = process.env.OPENAI_API_KEY;
  
  if (!openAIApiKey) {
    console.warn('[DEEP RESEARCH] No OpenAI API key available in environment variables - text processing will be disabled');
  } else {
    console.log(`[DEEP RESEARCH] Using OpenAI API key from environment variable (${openAIApiKey.substring(0, 10)}...)`);
    console.log(`[DEEP RESEARCH] OpenAI API Key source: environment variable`);
  }
  
  const chatModel = openAIApiKey ? new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.3,
    openAIApiKey: openAIApiKey,
  }) : null;
  
  // Helper function to use correct search method based on available API keys
  const performInternetSearch = async (searchQuery) => {
    // Use Serper API key from environment variable only
    const serperKey = process.env.SERPER_API_KEY;
    
    if (serperKey) {
      console.log(`[DEEP RESEARCH] Using Serper API key from environment variable for query: ${searchQuery}`);
      return await internetSearchWithKey(searchQuery, serperKey);
    } else {
      console.log(`[DEEP RESEARCH] No Serper API key available, using fallback method for query: ${searchQuery}`);
      return await internetSearch(searchQuery);
    }
  };
  
  const sendProgress = (stage, progress, message, meta = {}) => {
    if (progressCallback) {
      progressCallback({ stage, progress, message, ...meta });
    }
  };
  
  try {
    sendProgress('starting', 5, 'Generating query variants...');
    
    // Generate query variants
    const queryVariants = generateQueryVariants(query, mode);
    console.log(`📝 [DeepResearch] Query variants: ${queryVariants.join(', ')}`);
    
    sendProgress('variants', 15, `Generated ${queryVariants.length} search variants`);
    
    const allResults = [];
    const totalVariants = queryVariants.length;
    
    // Search across all sources with variants
    for (let i = 0; i < queryVariants.length; i++) {
      const variant = queryVariants[i];
      const variantProgress = 15 + (i / totalVariants) * 60; // 15-75% for searching
      
      console.log(`🔍 [DeepResearch] Searching variant: "${variant}"`);
      sendProgress('searching', variantProgress, `Searching: "${variant}"`, {
        currentVariant: i + 1,
        totalVariants
      });
      
      // Parallel searches - optimized for better results
      let searchPromises;
      console.log(`🔧 [DeepResearch] Mode check: "${mode}" === "lead"? ${mode === 'lead'}`);
      
      if (mode === 'lead') {
        console.log(`🎯 [LeadMode] Using ONLY Web + Apollo search (no Wikipedia/GitHub)`);
        // Lead mode: High-quality web results + comprehensive Apollo search
        searchPromises = [
          performInternetSearch(variant),
          searchApollo(variant, 15) // Increased for better lead coverage
        ];
      } else {
        console.log(`🔍 [FreshMode] Using comprehensive research sources`);
        // Fresh mode: Comprehensive research across all sources
        searchPromises = [
          performInternetSearch(variant),
          searchWikipedia(variant, 6), // Slightly increased
          searchArxiv(variant, 5),     // Slightly increased  
          searchGithub(variant, 5)     // Slightly increased
        ];
      }
      
      const searchResults = await Promise.all(searchPromises);
      
      // Map Serper 'organic' results to unified format with increased limits
      let webResults = [];
      if (searchResults[0] && Array.isArray(searchResults[0].organic)) {
        const webLimit = mode === 'lead' ? 10 : 8; // More results for lead searches
        webResults = searchResults[0].organic.slice(0, webLimit).map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          source: 'Web'
        }));
      }

      // Combine all results based on mode
      if (mode === 'lead') {
        // For lead mode: Web + Apollo only
        const apolloResults = searchResults[1] || [];
        allResults.push(...webResults, ...apolloResults);
      } else {
        // For fresh mode: Web + Wikipedia + arXiv + GitHub  
        const [, wikiResults, arxivResults, githubResults] = searchResults;
        allResults.push(...webResults, ...wikiResults, ...arxivResults, ...githubResults);
      }
    }
    
    sendProgress('processing', 75, 'Processing, scoring and ranking results...');
    
    // Remove duplicates, score, and rank results for quality
    const uniqueResults = removeDuplicates(allResults);
    const rankedResults = scoreAndRankResults(uniqueResults, query, mode);
    const limitedResults = rankedResults.slice(0, limit);
    
    console.log(`📊 [DeepResearch] Found ${allResults.length} total, ${uniqueResults.length} unique, showing top ${limitedResults.length} ranked results`);
    
    sendProgress('summarizing', 85, 'Creating comprehensive summary...');
    
    // Create comprehensive summary using text-only chat
    const resultsText = limitedResults.map((result, index) => 
      `${index + 1}. **${result.title}** (${result.source})\n   ${result.snippet}\n   URL: ${result.url}`
    ).join('\n\n');
    
    let summaryPrompt;
    
    if (mode === 'lead') {
      summaryPrompt = `You are conducting lead research for Exabits, a company that specializes in:
- Custom AI automation solutions for businesses
- LLM integration and implementation services
- Intelligent workflow automation
- AI-powered business process optimization
- Machine learning model development and deployment
- AI consulting and strategy services

Based on the following research results about "${query}", identify and analyze potential leads who would benefit from Exabits' AI automation services. Focus on companies and contacts that would be ideal prospects for AI implementation projects.

Research Results:
${resultsText}

Please provide a comprehensive lead analysis in **markdown format** that:
1. Identifies companies that could benefit from AI automation
2. Highlights key decision makers and their contact information
3. Explains why each lead would be a good fit for Exabits' services
4. Suggests potential AI use cases for each prospect
5. Prioritizes leads based on their AI readiness and budget potential
6. Notes any current technology stack or competitors mentioned

Use proper markdown formatting with:
- **Bold text** for company names and key points
- ## Headers for main sections (e.g., "## High Priority Leads")
- ### Subheaders for each company
- Bullet points for use cases and details

Lead Analysis:`;
    } else {
      summaryPrompt = `Based on the following research results about "${query}", provide a comprehensive and well-structured summary that synthesizes the key information. Focus on the most important insights and present them in a clear, organized manner.

Research Results:
${resultsText}

Please provide a thorough summary in **markdown format** that:
1. Identifies the main themes and key points
2. Highlights the most significant findings
3. Notes any patterns or consensus across sources
4. Mentions diverse perspectives if present
5. Organizes information logically

Use proper markdown formatting with:
- **Bold text** for important points
- ## Headers for main sections
- ### Subheaders for subsections
- Bullet points where appropriate

Summary:`;
    }

    const summary = await chatWithTextOnly(summaryPrompt, chatModel);
    
    sendProgress('completed', 100, 'Research completed successfully!');
    
    const response = {
      success: true,
      query,
      mode,
      summary,
      sources: limitedResults.map(result => ({
        title: result.title,
        url: result.url,
        source: result.source,
        snippet: result.snippet.substring(0, 200) + (result.snippet.length > 200 ? '...' : '')
      })),
      metadata: {
        totalResults: allResults.length,
        uniqueResults: uniqueResults.length,
        queryVariants: queryVariants.length,
        sourceBreakdown: {
          web: limitedResults.filter(r => r.source === 'Web').length,
          wikipedia: limitedResults.filter(r => r.source === 'Wikipedia').length,
          arxiv: limitedResults.filter(r => r.source === 'arXiv').length,
          github: limitedResults.filter(r => r.source === 'GitHub').length
        },
        sourcesUsed: ['Web (Serper)', 'Wikipedia', 'arXiv', 'GitHub']
      }
    };
    
    console.log(`✅ [DeepResearch] Research completed successfully`);
    return response;
    
  } catch (error) {
    console.error('Deep research error:', error);
    throw new Error(`Deep research failed: ${error.message}`);
  }
}
