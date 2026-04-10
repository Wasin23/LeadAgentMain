import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import OpenAI from 'openai';
import AWSManager from '../utils/awsManager.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
router.use(authenticateToken);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Check if user has a company profile
 */
router.get('/check', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    const userSettings = await awsManager.getUserSettings(userId);
    const user = await awsManager.getUserById(userId);
    
    // Check if company profile exists
    const hasProfile = !!(userSettings?.companyProfile && userSettings.companyProfile.companyName);
    
    console.log(`[COMPANY PROFILE] Check for user ${userId}: hasProfile=${hasProfile}`);
    
    res.json({
      success: true,
      hasProfile,
      profile: userSettings?.companyProfile || null,
      hasCompletedOnboarding: user?.hasCompletedOnboarding || false
    });
  } catch (error) {
    console.error('Error checking company profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Autofill agent targeting from company profile
 */
router.post('/autofill-targeting', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId);
    const profile = userSettings?.companyProfile;

    if (!profile) {
      return res.status(400).json({ success: false, error: 'No company profile found. Please complete your company profile first.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a B2B sales expert. Based on this company profile, determine the ideal targeting for an AI outreach agent.

Company profile:
- Name: ${profile.companyName || ''}
- Industry: ${profile.industry || ''}
- Description: ${profile.description || ''}
- Services: ${profile.services || ''}
- Core Offering: ${profile.coreOffering || ''}
- Key Advantages: ${profile.keyAdvantages || ''}
- Target Market: ${profile.targetMarket || ''}
- Tagline: ${profile.tagline || ''}

Return a JSON object with EXACTLY these fields:
{
  "generalInstructions": "2-3 sentence campaign instruction focusing on who to target and what pain point to lead with",
  "companySizeMin": <number, min employees of ideal target company>,
  "companySizeMax": <number, max employees of ideal target company>,
  "industries": ["array", "of", "3-6", "target industries"],
  "jobTitles": ["array", "of", "4-8", "specific job titles to target"]
}

Be specific and realistic. Return only valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ success: true, autofill: result });
  } catch (error) {
    console.error('Error autofilling targeting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Analyze uploaded document and extract company profile
 */
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, fileName, isImage } = req.body;

    console.log(`[COMPANY PROFILE] Analyzing document for user ${userId}: ${fileName} (isImage: ${isImage})`);

    // Prepare messages based on file type
    let messages;
    
    if (isImage) {
      // For images, use vision model with base64 image
      messages = [{
        role: 'system',
        content: `You are an expert business analyst. Your job is to analyze COMPANY documents (whitepapers, pitch decks, company descriptions, marketing materials) from images.

IMPORTANT: First, determine if this is a COMPANY document or a PERSONAL document (resume, CV, personal bio).

If it's a PERSONAL document (resume/CV), return:
{
  "isPersonalDocument": true,
  "error": "This appears to be a personal resume or CV. Please upload a company document such as a whitepaper, pitch deck, or company description instead."
}

If it's a COMPANY document, analyze it and return a JSON object with:
- companyName: The company name
- industry: Primary industry/sector
- services: Description of products/services offered
- targetMarket: Who their ideal customers are
- companySize: Estimated company size (1-10, 11-50, 51-200, 201-500, 501+)
- description: Brief company description
- companyAddress: Physical address if mentioned (street, city, state/country)

Also generate recommended agent settings:
- targetIndustries: Array of 3-5 industries they should target for leads
- targetPositions: Array of 5-7 job titles/positions to target
- companySizeMin: Minimum company size to target (number)
- companySizeMax: Maximum company size to target (number)
- leadLimit: Recommended leads per cycle (5-15 based on company size)

Return as JSON: {profile: {...}, recommendedPreset: {...}}`
      }, {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this company document image:'
          },
          {
            type: 'image_url',
            image_url: {
              url: content
            }
          }
        ]
      }];
    } else {
      // For text documents
      messages = [{
        role: 'system',
        content: `You are an expert business analyst. Your job is to analyze COMPANY documents (whitepapers, pitch decks, company descriptions, marketing materials).

IMPORTANT: First, determine if this is a COMPANY document or a PERSONAL document (resume, CV, personal bio).

If it's a PERSONAL document (resume/CV), return:
{
  "isPersonalDocument": true,
  "error": "This appears to be a personal resume or CV. Please upload a company document such as a whitepaper, pitch deck, or company description instead."
}

If it's a COMPANY document, analyze it and return a JSON object with:
- companyName: The company name
- industry: Primary industry/sector
- services: Description of products/services offered
- targetMarket: Who their ideal customers are
- companySize: Estimated company size (1-10, 11-50, 51-200, 201-500, 501+)
- description: Brief company description
- companyAddress: Physical address if mentioned (street, city, state/country)

Also generate recommended agent settings:
- targetIndustries: Array of 3-5 industries they should target for leads
- targetPositions: Array of 5-7 job titles/positions to target
- companySizeMin: Minimum company size to target (number)
- companySizeMax: Maximum company size to target (number)
- leadLimit: Recommended leads per cycle (5-15 based on company size)

Return as JSON: {profile: {...}, recommendedPreset: {...}}`
      }, {
        role: 'user',
        content: `Analyze this document:\n\n${content.substring(0, 10000)}`
      }];
    }

    // Use GPT-4 with vision for images, regular GPT-4 for text
    const completion = await openai.chat.completions.create({
      model: isImage ? 'gpt-4o' : 'gpt-4o',
      messages: messages,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    // Check if it's a personal document
    if (result.isPersonalDocument) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    console.log('[COMPANY PROFILE] Analysis complete:', result.profile);

    res.json({
      success: true,
      profile: result.profile,
      recommendedPreset: result.recommendedPreset
    });
  } catch (error) {
    console.error('Error analyzing document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Scrape website and extract company profile
 */
router.post('/scrape-website', async (req, res) => {
  let browser;
  try {
    const userId = req.user.userId;
    const { url, fromOnboarding } = req.body;
    const awsManager = new AWSManager();

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log(`[COMPANY PROFILE] Scraping website for user ${userId}: ${url}`);

    // Charge 1 credit per scrape, except during onboarding
    if (!fromOnboarding) {
      try {
        await awsManager.logApiUsage({
          userId,
          agentId: 'system',
          service: 'openai',
          operation: 'company_profile_scrape',
          usage: 1,
          cost: 0.05,
          metadata: { url }
        });
      } catch (creditErr) {
        console.error('[COMPANY PROFILE] Failed to log credit charge:', creditErr.message);
      }
    }

    // Use Puppeteer with real Chrome
    let websiteContent = '';
    try {
      // Find Chrome in the Puppeteer cache
      let executablePath = null;
      
      const cacheDir = process.env.PUPPETEER_CACHE_DIR || join(__dirname, '..', '.cache', 'puppeteer');
      const chromePath = join(cacheDir, 'chrome');
      
      if (existsSync(chromePath)) {
        // Find the latest Chrome version directory
        const versions = readdirSync(chromePath);
        if (versions.length > 0) {
          const latestVersion = versions.sort().reverse()[0];
          executablePath = join(chromePath, latestVersion, 'chrome-linux64', 'chrome');
          if (!existsSync(executablePath)) {
            executablePath = join(chromePath, latestVersion, 'chrome-linux', 'chrome');
          }
        }
      }
      
      if (!executablePath || !existsSync(executablePath)) {
        executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || null;
      }
      
      console.log(`[COMPANY PROFILE] Using Chrome at: ${executablePath}`);
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log(`[COMPANY PROFILE] Loading page: ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageData = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
        const title = document.title || '';
        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText).join('\n');
        const links = Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.innerText,
          href: a.href
        })).filter(l => l.text && l.href);
        
        return {
          title,
          metaDescription,
          metaKeywords,
          headings,
          bodyText,
          links: links.slice(0, 50)
        };
      });
      
      const aboutPages = pageData.links.filter(link => 
        /about|company|who-we-are|our-story/i.test(link.text) || 
        /about|company|who-we-are|our-story/i.test(link.href)
      ).slice(0, 2);
      
      let additionalContent = '';
      for (const link of aboutPages) {
        try {
          if (link.href.startsWith('http')) {
            console.log(`[COMPANY PROFILE] Visiting: ${link.href}`);
            await page.goto(link.href, { waitUntil: 'networkidle2', timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const extraText = await page.evaluate(() => document.body.innerText || '');
            additionalContent += `\n\n--- ${link.text} ---\n${extraText.substring(0, 3000)}`;
          }
        } catch (e) {
          console.log(`[COMPANY PROFILE] Could not load ${link.href}: ${e.message}`);
        }
      }
      
      websiteContent = `
Title: ${pageData.title}
Meta Description: ${pageData.metaDescription}
Keywords: ${pageData.metaKeywords}

Main Headings:
${pageData.headings}

Main Page Content:
${pageData.bodyText.substring(0, 12000)}

${additionalContent}
      `.trim();
      
      console.log(`[COMPANY PROFILE] Extracted ${websiteContent.length} characters from website`);
      
      await browser.close();
      browser = null;
      
    } catch (fetchError) {
      console.error('[COMPANY PROFILE] Error fetching website:', fetchError.message);
      if (browser) await browser.close();
      return res.status(400).json({
        success: false,
        error: 'Unable to fetch website content. Please check the URL and try again.'
      });
    }

    // Use OpenAI to analyze the website content
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `You are an expert business analyst. Analyze the provided company website content thoroughly and extract information to create a comprehensive company profile.

CRITICAL INSTRUCTIONS:
1. Read through ALL the provided content carefully including main page and additional pages
2. Fill out EVERY field - use your expertise to generate thoughtful answers for fields not explicitly stated
3. For open-ended questions, craft intelligent responses based on the company's positioning and offerings
4. Make educated estimates for missing data based on industry standards and company indicators

Extract and return a JSON object with ALL 17 fields (NONE should be empty):

- companyName: The company name
- tagline: Company tagline/slogan (if not on site, create a compelling one that captures their value proposition)
- description: Comprehensive 2-3 sentence description covering what they do and their unique approach
- industry: Primary industry/sector
- services: Detailed description of ALL products/services - be thorough and specific
- targetMarket: Specific customer segments they serve (analyze their messaging and offerings to determine this)
- companySize: Size range (1-10, 11-50, 51-200, 201-500, 501+) - estimate based on team page, about page, scale of operations
- website: The company website URL
- email: Contact email (look for contact@, hello@, info@, sales@ etc. If not found, generate likely format: contact@domain.com)
- phone: Phone number (if found - check contact page, footer)
- location: City, Country (if found - check contact/about pages)
- linkedinProfile: LinkedIn URL (if found - look for social links)
- founded: Year only (e.g., "2020") - if found check about/history. If not found, estimate reasonable year. DO NOT include words like "Established" or "Est.", just the year
- employees: Number only (e.g., "25" or "50") - if found check about/team pages. Otherwise estimate. DO NOT include words like "Estimated" or "~", just the number
- coreOffering: Their main product/service in one concise phrase
- keyAdvantages: What makes them different/better - analyze their unique value props, technology, approach (2-3 key differentiators)

IMPORTANT FOR MISSING FIELDS:
- If phone/LinkedIn not found: Leave as empty string "" (these are truly optional)
- For location: If not explicitly stated, try to infer from domain (.uk = UK, .de = Germany, etc.) or say "Remote/Global"
- For founded: If not stated, estimate based on domain registration date, technology used, or say "Established [recent year]"
- For employees: Estimate based on team photos, about page, scale of operations
- For coreOffering: Distill their main service into 3-5 words
- For keyAdvantages: Analyze what makes them unique (technology, approach, pricing, accessibility, etc.)

Also generate recommended agent settings:
- targetIndustries: 3-5 industries they should target for B2B leads
- targetPositions: 5-7 job titles to target
- companySizeMin: Min company size to target
- companySizeMax: Max company size to target  
- leadLimit: Recommended leads per cycle (5-15)

Return as JSON: {profile: {...}, recommendedPreset: {...}}`
      }, {
        role: 'user',
        content: `Analyze this company website from ${url}. Read everything carefully and fill out ALL fields with thoughtful, accurate information:\n\n${websiteContent.substring(0, 20000)}`
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    // Ensure website is set
    if (result.profile) {
      result.profile.website = url;
    }
    
    console.log('[COMPANY PROFILE] Website scraping complete:', result.profile);

    res.json({
      success: true,
      profile: result.profile,
      recommendedPreset: result.recommendedPreset
    });
  } catch (error) {
    console.error('Error scraping website:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Chat interface for building company profile
 */
router.post('/chat', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messages } = req.body;

    console.log(`[COMPANY PROFILE] Chat for user ${userId}, messages: ${messages.length}`);

    // Use GPT-4 to have a conversation
    const systemPrompt = `You are a friendly business consultant helping a user create their company profile for an AI lead generation platform. 

Your job is to:
1. Ask about their company name, industry, services, target market, and company size
2. Be conversational and ask one question at a time
3. When you have enough information, extract it into a structured format

After gathering information, respond with JSON in this format:
{
  "message": "your response to the user",
  "profileComplete": true/false,
  "profile": {
    "companyName": "...",
    "industry": "...",
    "services": "...",
    "targetMarket": "...",
    "companySize": "...",
    "description": "..."
  },
  "recommendedPreset": {
    "targetIndustries": ["..."],
    "targetPositions": ["..."],
    "companySizeMin": 100,
    "companySizeMax": 5000,
    "leadLimit": 10
  }
}

If the profile is not complete yet, just return {"message": "your next question", "profileComplete": false}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    console.log('[COMPANY PROFILE] Chat response:', result.message?.substring(0, 100));

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Save company profile to user settings
 */
router.post('/save', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { profile, recommendedPreset } = req.body;

    console.log(`[COMPANY PROFILE] Saving profile for user ${userId}:`, profile.companyName);

    const awsManager = new AWSManager();
    
    // Get existing user settings
    let userSettings = await awsManager.getUserSettings(userId) || {};
    
    // Add company profile and recommended preset
    userSettings.companyProfile = profile;
    userSettings.recommendedAgentPreset = recommendedPreset;
    
    // Save back to DynamoDB
    await awsManager.saveUserSettings(userId, userSettings);
    
    // Mark that user has completed onboarding (first time)
    await awsManager.updateUser(userId, { hasCompletedOnboarding: true });

    console.log('[COMPANY PROFILE] Profile saved successfully');

    res.json({
      success: true,
      message: 'Company profile saved successfully'
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get company profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    const userSettings = await awsManager.getUserSettings(userId);
    
    res.json({
      success: true,
      profile: userSettings?.companyProfile || null,
      recommendedPreset: userSettings?.recommendedAgentPreset || null
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Mark onboarding as completed
 */
router.put('/complete-onboarding', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    await awsManager.updateUser(userId, { hasCompletedOnboarding: true });
    
    console.log(`[COMPANY PROFILE] Marked onboarding complete for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Onboarding marked as complete'
    });
  } catch (error) {
    console.error('Error marking onboarding complete:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete company profile (reset account data)
 */
router.delete('/', async (req, res) => {
  console.log('[COMPANY PROFILE] DELETE / endpoint hit');
  console.log('[COMPANY PROFILE] User:', req.user?.userId);
  
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    console.log(`[COMPANY PROFILE] Resetting ALL account data for user ${userId}`);
    console.log('[COMPANY PROFILE] Step 1: Getting user record + settings...');
    
    // Get user record first — activeAgents is the authoritative agent list
    const userRecord = await awsManager.getUserById(userId);
    const agentIds = (userRecord?.activeAgents || []).map(a => a.agentId).filter(Boolean);
    console.log(`[COMPANY PROFILE] Found ${agentIds.length} agents to wipe:`, agentIds);

    // Get user settings
    const userSettings = await awsManager.getUserSettings(userId);
    console.log('[COMPANY PROFILE] Step 2: User settings retrieved:', !!userSettings);
    
    if (userSettings) {
      console.log('[COMPANY PROFILE] Step 3: Clearing company profile data...');
      // Clear company profile
      delete userSettings.companyProfile;
      delete userSettings.recommendedAgentPreset;
      delete userSettings.agents;
      delete userSettings.emailQueue;
      delete userSettings.lastSyncTime;
      delete userSettings.analytics;
      delete userSettings.campaigns;
      
      // IMPORTANT: Preserve billing data - do NOT clear:
      // - userSettings.stripeCustomerId
      // - userSettings.subscription
      // - userSettings.billingHistory
      // - userSettings.paymentMethod
      
      console.log('[COMPANY PROFILE] Step 4: Saving updated settings...');
      await awsManager.saveUserSettings(userId, userSettings);
      
      console.log('[COMPANY PROFILE] Step 5: Updating user record...');
      await awsManager.updateUser(userId, { 
        activeAgents: [],
        hasCompletedOnboarding: false,
        auditorState: null,
      });
      
      console.log('[COMPANY PROFILE] Step 6: Clearing all DynamoDB tables...');
      try {
        // --- contacted leads ---
        const contactsResult = await awsManager.clearContactedLeads(userId);
        console.log(`[COMPANY PROFILE] Cleared ${contactsResult.deleted || 0} contacted leads`);
        
        // --- issues / alerts ---
        const issuesResult = await awsManager.clearAllIssues(userId);
        console.log(`[COMPANY PROFILE] Cleared ${issuesResult.deleted || 0} issues`);
        
        // --- cycle logs ---
        const cyclesResult = await awsManager.clearAllCycleLogs(userId);
        console.log(`[COMPANY PROFILE] Cleared ${cyclesResult.deleted || 0} cycle logs`);
        
        // --- CRM contacts ---
        await awsManager.clearCRMContacts(userId);
        console.log('[COMPANY PROFILE] Cleared CRM contacts');

        // --- bandit stats ---
        await awsManager.clearBanditStats(userId);
        console.log('[COMPANY PROFILE] Cleared lead source bandit stats');

        // --- per-agent tables (agent settings, state, search history, cycle logs) ---
        for (const agentId of agentIds) {
          await Promise.allSettled([
            awsManager.deleteAgentSettings(userId, agentId),
            awsManager.deleteAgentState(userId, agentId),
            awsManager.deleteSearchHistory(userId, agentId),
            awsManager.deleteCycleLogs(userId, agentId),
          ]);
        }
        console.log(`[COMPANY PROFILE] Cleared per-agent data for ${agentIds.length} agents`);
        
        // --- email tracking events ---
        const emailTrackingEvents = await awsManager.getEmailTrackingByUser(userId);
        if (emailTrackingEvents && emailTrackingEvents.length > 0) {
          for (const event of emailTrackingEvents) {
            await awsManager.deleteEmailTrackingEvent(event);
          }
          console.log(`[COMPANY PROFILE] Cleared ${emailTrackingEvents.length} email tracking events`);
        }

        // --- Zilliz lead memory (vector DB) ---
        try {
          const { ZillizLeadMemory } = await import('../utils/zillizLeadMemory.js');
          const leadMemory = new ZillizLeadMemory();
          await leadMemory.resetUserMemory(userId);
          console.log('[COMPANY PROFILE] Cleared Zilliz lead memory');
        } catch (zillizError) {
          console.error('[COMPANY PROFILE] Zilliz clear failed (non-fatal):', zillizError.message);
        }
        
      } catch (dbError) {
        console.error('[COMPANY PROFILE] Error clearing database tables:', dbError);
        // Continue — don't fail the whole reset if cleanup has issues
      }
      
      console.log('[COMPANY PROFILE] Step 7: Clearing email queue files...');
      // Clear email queue files (local JSON files)
      console.log(`[COMPANY PROFILE] Clearing email queue files for user ${userId}...`);
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        
        const userLogPath = path.join(process.cwd(), `email_logs_${userId}.json`);
        const userApprovedPath = path.join(process.cwd(), `email_approved_${userId}.json`);
        const userQueuePath = path.join(process.cwd(), `email_queue_${userId}.json`);
        
        const emptyArray = [];
        
        try {
          await fs.writeFile(userLogPath, JSON.stringify(emptyArray, null, 2), 'utf8');
          console.log(`[COMPANY PROFILE] Cleared email logs file`);
        } catch (e) { /* File may not exist */ }
        
        try {
          await fs.writeFile(userApprovedPath, JSON.stringify(emptyArray, null, 2), 'utf8');
          console.log(`[COMPANY PROFILE] Cleared approved emails file`);
        } catch (e) { /* File may not exist */ }
        
        try {
          await fs.writeFile(userQueuePath, JSON.stringify(emptyArray, null, 2), 'utf8');
          console.log(`[COMPANY PROFILE] Cleared email queue file`);
        } catch (e) { /* File may not exist */ }
        
      } catch (fileError) {
        console.error('[COMPANY PROFILE] Error clearing email queue files:', fileError);
        // Continue execution
      }
      
      console.log('[COMPANY PROFILE] Step 8: Clearing desktop tracking data...');
      // Clear desktop tracking data
      try {
        const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
        desktopEmailTracker.clearUserTrackingData(userId);
        console.log(`[COMPANY PROFILE] Desktop tracking data cleared successfully`);
      } catch (desktopError) {
        console.error('[COMPANY PROFILE] Error clearing desktop tracking data:', desktopError.message);
        // Continue execution
      }
      
      console.log(`[COMPANY PROFILE] Step 10: All operations complete!`);
      console.log(`[COMPANY PROFILE] All account data reset successfully for user ${userId}`);
      console.log(`[COMPANY PROFILE] Sending success response...`);
      
      res.json({
        success: true,
        message: 'All account data reset successfully'
      });
      console.log(`[COMPANY PROFILE] Response sent successfully!`);
    } else {
      console.log(`[COMPANY PROFILE] No user settings found - creating empty settings and clearing user record`);
      
      // No settings exist, but still clear the user record
      await awsManager.updateUser(userId, { 
        activeAgents: [],
        hasCompletedOnboarding: false 
      });
      
      console.log(`[COMPANY PROFILE] User record cleared successfully`);
      
      res.json({
        success: true,
        message: 'Account reset successfully (no existing data found)'
      });
    }
  } catch (error) {
    console.error('[COMPANY PROFILE] FATAL ERROR in delete endpoint:', error);
    console.error('[COMPANY PROFILE] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
