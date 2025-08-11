import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { internetSearch } from './internetSearch.js';

// Initialize OpenAI for text-only operations (no tools)
const chatModel = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Text-only chat function to prevent infinite loops
async function chatWithTextOnly(prompt) {
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

// Generate search query variants
function generateQueryVariants(originalQuery, mode = 'fresh') {
  const variants = [originalQuery];
  
  if (mode === 'academic') {
    variants.push(
      `${originalQuery} research`,
      `${originalQuery} study`,
      `${originalQuery} analysis`,
      `${originalQuery} theory`
    );
  } else if (mode === 'product') {
    variants.push(
      `${originalQuery} product`,
      `${originalQuery} solution`,
      `${originalQuery} tool`,
      `${originalQuery} review`
    );
  } else {
    variants.push(
      `${originalQuery} 2024`,
      `${originalQuery} latest`,
      `${originalQuery} news`,
      `${originalQuery} update`
    );
  }
  
  return variants.slice(0, 3); // Limit variants
}

// Remove duplicates based on URL similarity
function removeDuplicates(results) {
  const seen = new Set();
  return results.filter(result => {
    const key = result.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Main deep research function
export async function deepResearch(query, options = {}) {
  const { mode = 'fresh', limit = 20, progressCallback } = options;
  
  console.log(`🔬 [DeepResearch] Starting research for: "${query}" (mode: ${mode})`);
  
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
      
      // Parallel searches across ALL sources simultaneously
      const [webRaw, wikiResults, arxivResults, githubResults] = await Promise.all([
        internetSearch(variant),
        searchWikipedia(variant, 5),
        searchArxiv(variant, 4),
        searchGithub(variant, 4)
      ]);

      // Map Serper 'organic' results to unified format
      let webResults = [];
      if (webRaw && Array.isArray(webRaw.organic)) {
        webResults = webRaw.organic.slice(0, 6).map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          source: 'Web'
        }));
      }

      allResults.push(...webResults, ...wikiResults, ...arxivResults, ...githubResults);
    }
    
    sendProgress('processing', 75, 'Processing and deduplicating results...');
    
    // Remove duplicates and limit results
    const uniqueResults = removeDuplicates(allResults);
    const limitedResults = uniqueResults.slice(0, limit);
    
    console.log(`📊 [DeepResearch] Found ${allResults.length} total, ${uniqueResults.length} unique, showing ${limitedResults.length}`);
    
    sendProgress('summarizing', 85, 'Creating comprehensive summary...');
    
    // Create comprehensive summary using text-only chat
    const resultsText = limitedResults.map((result, index) => 
      `${index + 1}. **${result.title}** (${result.source})\n   ${result.snippet}\n   URL: ${result.url}`
    ).join('\n\n');
    
    const summaryPrompt = `Based on the following research results about "${query}", provide a comprehensive and well-structured summary that synthesizes the key information. Focus on the most important insights and present them in a clear, organized manner.

Research Results:
${resultsText}

Please provide a thorough summary that:
1. Identifies the main themes and key points
2. Highlights the most significant findings
3. Notes any patterns or consensus across sources
4. Mentions diverse perspectives if present
5. Organizes information logically

Summary:`;

    const summary = await chatWithTextOnly(summaryPrompt);
    
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
