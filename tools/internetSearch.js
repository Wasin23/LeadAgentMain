// tools/internetSearch.js
// Tool for searching the internet using Serper.dev API with caching

import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_API_URL = 'https://google.serper.dev/search';
const CACHE_DIR = path.join(process.cwd(), '.search_cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

console.log('[SERPER] API KEY:', SERPER_API_KEY);

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn('[CACHE] Failed to create cache directory:', err);
  }
}

// Generate cache key for query
function getCacheKey(query) {
  return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
}

// Get cached result if valid
async function getCachedResult(query) {
  try {
    const cacheKey = getCacheKey(query);
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    
    const stats = await fs.stat(cacheFile);
    const age = Date.now() - stats.mtime.getTime();
    
    if (age < CACHE_DURATION) {
      const cached = await fs.readFile(cacheFile, 'utf8');
      const data = JSON.parse(cached);
      console.log('[CACHE] Using cached result for:', query);
      return data;
    } else {
      // Cache expired, delete it
      await fs.unlink(cacheFile);
    }
  } catch (err) {
    // Cache miss or error - continue to API call
  }
  return null;
}

// Save result to cache
async function cacheResult(query, result) {
  try {
    await ensureCacheDir();
    const cacheKey = getCacheKey(query);
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(result, null, 2));
    console.log('[CACHE] Cached result for:', query);
  } catch (err) {
    console.warn('[CACHE] Failed to cache result:', err);
  }
}

/**
 * Search the internet using Serper.dev with caching
 * @param {string} query - The search query
 * @returns {Promise<object>} - The search results from Serper.dev
 */
export async function internetSearch(query) {
  if (!SERPER_API_KEY) {
    console.error('[SERPER] SERPER_API_KEY missing!');
    throw new Error('SERPER_API_KEY is not set in environment variables');
  }
  if (!query) throw new Error('Query is required');

  // Check cache first
  const cached = await getCachedResult(query);
  if (cached) {
    return cached;
  }

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
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 25000 // 25 second timeout
      }
    );
    
    console.log('[SERPER] Response received, caching...');
    
    // Cache the result
    await cacheResult(query, response.data);
    
    return response.data;
  } catch (error) {
    console.error('[internetSearch] Failed:', error.response?.data || error.message);
    throw error;
  }
}