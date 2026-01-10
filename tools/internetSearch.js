// tools/internetSearch.js
// Tool for searching the internet using Serper.dev API
// NOTE: File-based caching disabled - research data now tracked in AI reports with source attribution

import axios from 'axios';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_API_URL = 'https://google.serper.dev/search';

/**
 * Search the internet using Serper.dev
 * @param {string} query - The search query
 * @returns {Promise<object>} - The search results from Serper.dev
 */
export async function internetSearch(query) {
  console.log(`[SERPER] Using environment variable API key (${SERPER_API_KEY ? SERPER_API_KEY.substring(0, 10) + '...' : 'NOT SET'}) for query: ${query}`);
  return internetSearchWithKey(query, SERPER_API_KEY);
}

/**
 * Search the internet using Serper.dev with custom API key
 * @param {string} query - The search query
 * @param {string} apiKey - The Serper API key to use
 * @returns {Promise<object>} - The search results from Serper.dev
 */
export async function internetSearchWithKey(query, apiKey) {
  if (!apiKey) {
    console.error('[SERPER] API KEY missing!');
    throw new Error('SERPER_API_KEY is not provided');
  }
  if (!query) throw new Error('Query is required');

  console.log(`[SERPER] Using provided API key (${apiKey.substring(0, 10)}...) for query: ${query}`);

  try {
    console.log('[SERPER] Searching:', query);
    const response = await axios.post(
      SERPER_API_URL,
      { 
        q: query,
        num: 10,  // Request more results
        gl: 'us', // Geographic location
        hl: 'en'  // Language
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 25000 // 25 second timeout
      }
    );
    
    console.log('[SERPER] Response received, analyzing results...');
    
    // Log detailed API response analysis
    const data = response.data;
    console.log('[SERPER] API Response Analysis:');
    console.log(`  🔢 Results Count: ${data.organic?.length || 0} organic results`);
    console.log(`  📊 Search Info: ${data.searchInformation?.totalResults || 0} total results found`);
    console.log(`  ⏱️  Search Time: ${data.searchInformation?.searchTime || 'unknown'} seconds`);
    
    if (data.knowledgeGraph) {
      console.log(`  🧠 Knowledge Graph: "${data.knowledgeGraph.title}" found`);
    }
    
    if (data.answerBox) {
      console.log(`  💡 Answer Box: Found direct answer`);
    }
    
    if (data.organic && data.organic.length > 0) {
      console.log(`  🎯 Top 3 Results:`);
      data.organic.slice(0, 3).forEach((result, i) => {
        console.log(`    ${i+1}. ${result.title} (${result.link})`);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('[internetSearch] Failed:', error.response?.data || error.message);
    throw error;
  }
}