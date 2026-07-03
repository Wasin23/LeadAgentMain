import puppeteer from 'puppeteer';

let _browser = null;
let _browserBornAt = 0;
const BROWSER_TTL_MS = 6 * 60 * 60 * 1000; // recycle every 6 hours to prevent Chromium memory creep

async function getBrowser() {
  const aged = Date.now() - _browserBornAt > BROWSER_TTL_MS;
  if (_browser && _browser.connected && !aged) return _browser;
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
  }
  _browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  _browserBornAt = Date.now();
  _browser.on('disconnected', () => { _browser = null; _browserBornAt = 0; });
  return _browser;
}

// Pages that hard-require a login before showing any content
// Note: linkedin.com/company/ and post URLs are often public — only block profile pages
const LOGIN_WALLED = /linkedin\.com\/in\/[^/]+\/?$|twitter\.com\/[^/]+\/?$|x\.com\/[^/]+\/?$|facebook\.com\/(?!pg\/|pages\/)|instagram\.com\/[^/]+\/?$/;

/**
 * Search DuckDuckGo HTML (no API key). Returns { title, link, snippet }[] ordered by position.
 */
async function duckduckgoSearch(query, maxResults = 12) {
  const browser = await getBrowser();
  const page = await browser.newPage();
    try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    return await page.evaluate((max) => {
      return Array.from(document.querySelectorAll('.result')).slice(0, max).map(el => {
        const titleEl = el.querySelector('.result__title a, a.result__a');
        const snippetEl = el.querySelector('.result__snippet');
        let link = titleEl?.href || '';
        try {
          const u = new URL(link);
          const uddg = u.searchParams.get('uddg');
          if (uddg) link = decodeURIComponent(uddg);
        } catch {}
        return {
          title: titleEl?.innerText?.trim() || '',
          link,
          snippet: snippetEl?.innerText?.trim() || '',
        };
      }).filter(r => r.link && r.title);
    }, maxResults);
  } finally {
    await page.close();
  }
}

/**
 * Scrape a single URL. Returns { text, dates, mostRecentDate } or null on failure.
 * Blocks images/fonts/CSS to keep it fast.
 */
async function scrapePage(url, timeoutMs = 8000) {
  const browser = await getBrowser();
  const page = await browser.newPage();
    try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    return await page.evaluate(() => {
      for (const el of document.querySelectorAll('nav, footer, script, style, [role="navigation"], .cookie, .banner')) {
        el.remove();
      }
      const main = document.querySelector('article, main, [role="main"], .post-content, .article-body, .entry-content');
      const text = (main || document.body)?.innerText?.replace(/\s+/g, ' ')?.trim()?.slice(0, 5000) || '';

      // Pull all date-like strings from the page
      const datePatterns = [
        // ISO / common formats: 2025-06-12, June 12 2025, 12 June 2025
        /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+(202\d)\b/gi,
        /\b(202\d)[\/\-](0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])\b/g,
        /\b\d{1,2}\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(202\d)\b/gi,
      ];

      const found = [];
      for (const pat of datePatterns) {
        let m;
        while ((m = pat.exec(text)) !== null) found.push(m[0]);
      }

      // Also check <time> elements and meta tags
      for (const el of document.querySelectorAll('time[datetime], meta[property="article:published_time"], meta[name="date"]')) {
        const val = el.getAttribute('datetime') || el.getAttribute('content') || '';
        if (val) found.push(val);
      }

      return { text: text.slice(0, 4000), rawDates: found };
    });
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Parse raw date strings into actual Date objects. Returns the most recent one.
 */
function parseMostRecentDate(rawDates) {
  let latest = null;
  for (const raw of rawDates) {
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
        if (!latest || d > latest) latest = d;
      }
    } catch {}
  }
  return latest;
}

/**
 * Lazy search-and-scrape: iterate DuckDuckGo results one by one, crawl each,
 * stop when we have `targetRecent` pages newer than `newerThan`, or after `maxTries` attempts.
 *
 * Returns array of { title, link, snippet, text, mostRecentDate, isRecent }
 */
export async function findRecentPages(query, newerThan, { targetRecent = 3, maxTries = 10 } = {}) {
  let searchResults;
  try {
    searchResults = await duckduckgoSearch(query, maxTries + 2);
  } catch (e) {
    console.error(`[PUPPETEER] Search failed for "${query}":`, e.message);
    return [];
  }

  const output = [];
  let tried = 0;

  for (const result of searchResults) {
    if (tried >= maxTries) break;
    if (output.filter(r => r.isRecent).length >= targetRecent) break;
    if (LOGIN_WALLED.test(result.link)) continue; // skip login-walled pages only

    tried++;
    const scraped = await scrapePage(result.link).catch(() => null);
    if (!scraped || scraped.text.length < 80) continue;

    const mostRecentDate = parseMostRecentDate(scraped.rawDates);
    const isRecent = mostRecentDate !== null && mostRecentDate > newerThan;

    console.log(`[PUPPETEER] ${result.link} → date: ${mostRecentDate?.toISOString() ?? 'none'} | recent: ${isRecent}`);

    output.push({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      text: scraped.text,
      mostRecentDate,
      isRecent,
    });
  }

  return output;
}
