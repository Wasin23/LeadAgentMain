import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetch and extract clean text content from a webpage
 * @param {string} url - URL to fetch
 * @returns {Promise<object>} - Extracted content
 */
export async function fetchWebpage(url) {
  try {
    console.log(`📄 [WEBPAGE] Fetching: ${url}`);
    
    // Fetch with timeout and proper headers
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MeridianBot/1.0; +https://meridian.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      maxRedirects: 5
    });

    if (!response.data) {
      throw new Error('No content received');
    }

    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();
    $('.nav, .navigation, .menu, .sidebar, .footer, .header, .cookie, .ad, .advertisement').remove();
    
    // Extract main content areas (prioritize article/main content)
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.main-content',
      '.article-content',
      '.post-content',
      '#content',
      'body'
    ];
    
    let content = '';
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    if (!content) {
      content = $('body').text();
    }
    
    // Clean up the text
    content = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();
    
    // Extract title
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  'No title';
    
    // Extract meta description
    const description = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        content.substring(0, 200);
    
    // Limit content length (first 5000 chars for performance)
    const truncatedContent = content.substring(0, 5000);
    
    console.log(`✅ [WEBPAGE] Extracted ${truncatedContent.length} chars from ${url}`);
    
    return {
      success: true,
      url: url,
      title: title,
      description: description,
      content: truncatedContent,
      wordCount: truncatedContent.split(/\s+/).length
    };
    
  } catch (error) {
    console.error(`❌ [WEBPAGE] Failed to fetch ${url}:`, error.message);
    return {
      success: false,
      url: url,
      error: error.message
    };
  }
}

/**
 * Fetch multiple webpages in parallel
 * @param {string[]} urls - Array of URLs to fetch
 * @param {number} maxConcurrent - Maximum concurrent requests
 * @returns {Promise<object[]>} - Array of fetched content
 */
export async function fetchMultipleWebpages(urls, maxConcurrent = 3) {
  console.log(`📄 [WEBPAGE] Fetching ${urls.length} webpages (max ${maxConcurrent} concurrent)...`);
  
  const results = [];
  
  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(url => fetchWebpage(url))
    );
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + maxConcurrent < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const successful = results.filter(r => r.success);
  console.log(`✅ [WEBPAGE] Successfully fetched ${successful.length}/${urls.length} webpages`);
  
  return results;
}
