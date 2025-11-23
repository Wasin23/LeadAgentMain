import 'dotenv/config';
import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import { requireTrialCredits, trackApiUsage } from '../middleware/apiCostTracker.js';
import OpenAI from 'openai';
import axios from 'axios';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('[AI SEARCH] Route initialized, OpenAI API key:', process.env.OPENAI_API_KEY ? 'present' : 'missing');

/**
 * AI-powered lead search
 * POST /api/ai-search/leads
 */
router.post('/leads', requireTrialCredits('openai-gpt4', 1), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query, company, person } = req.body;
    
    if (!query && !company && !person) {
      return res.status(400).json({
        success: false,
        error: 'Search query or specific filters are required'
      });
    }
    
    console.log(`[AI SEARCH] Processing search for user ${userId}`);
    console.log(`[AI SEARCH] Query: "${query || 'none'}"`);
    console.log(`[AI SEARCH] Company filter: "${company || 'none'}"`);
    console.log(`[AI SEARCH] Person filter: "${person || 'none'}"`);
    
    const AWSManager = (await import('../utils/awsManager.js')).default;
    const awsManager = new AWSManager();
    
    // Step 1: AI parses the query to extract search intent (if query provided)
    let searchParams = { titles: [], keywords: [] };
    
    if (query) {
      const parseCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Extract job titles and keywords from: "${query}"\nReturn JSON: {"titles": ["array"], "keywords": ["array"]}`
        }],
        temperature: 0.3,
        max_tokens: 150
      });
      
      // Track API usage for trial credits
      await trackApiUsage(userId, 'openai-gpt35', 1);
      
      await awsManager.logApiUsage({
        userId,
        agentId: 'ai-search',
        service: 'openai',
        operation: 'chat.completion',
        usage: { tokens: parseCompletion.usage.total_tokens },
        cost: parseCompletion.usage.total_tokens * 0.0034 / 1000
      });
      
      try {
        const text = parseCompletion.choices[0].message.content.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        searchParams = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch (e) {
        console.error('[AI SEARCH] Parse error:', e);
      }
      
      console.log('[AI SEARCH] Parsed params:', searchParams);
    }
    
    // Step 2: Build Apollo payload with filters
    const apolloPayload = {
      page: 1,
      per_page: 12
    };
    
    // Add company filter if specified
    if (company) {
      apolloPayload.organization_names = [company];
      console.log('[AI SEARCH] Adding company filter:', company);
    }
    
    // Add person name filter if specified
    if (person) {
      apolloPayload.person_name = person;
      console.log('[AI SEARCH] Adding person filter:', person);
    }
    
    // Add general query if provided
    if (query) {
      apolloPayload.q_keywords = query;
    }
    
    console.log('[AI SEARCH] Apollo payload:', apolloPayload);
    
    const apolloResponse = await axios.post('https://api.apollo.io/v1/mixed_people/search', apolloPayload, {
      headers: { 
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.APOLLO_API_KEY
      }
    });
    
    await awsManager.logApiUsage({
      userId,
      agentId: 'ai-search',
      service: 'apollo',
      operation: 'people_search',
      usage: { credits: 1 },
      cost: 0.017
    });
    
    const people = apolloResponse.data?.people || [];
    console.log(`[AI SEARCH] Found ${people.length} people from Apollo`);
    
    if (people.length === 0) {
      return res.json({ success: true, leads: [], message: 'No leads found' });
    }
    
    // Step 3: Research each lead and generate descriptions
    const leads = await Promise.all(
      people.slice(0, 12).map(async (person) => {
        const name = person.name || 'Unknown';
        const title = person.title || 'N/A';
        const company = person.organization?.name || 'Unknown Company';
        let email = person.email || null;
        
        // Unlock email if not present
        if (!email && person.id) {
          try {
            const unlockResponse = await axios.post('https://api.apollo.io/v1/people/match', {
              id: person.id
            }, {
              headers: {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'X-Api-Key': process.env.APOLLO_API_KEY
              }
            });
            
            email = unlockResponse.data?.person?.email || null;
            
            if (email) {
              await awsManager.logApiUsage({
                userId,
                agentId: 'ai-search',
                service: 'apollo',
                operation: 'email_unlock',
                usage: { credits: 1 },
                cost: 0.017
              });
              console.log(`[AI SEARCH] Unlocked email for ${name}`);
            }
          } catch (unlockError) {
            console.error(`[AI SEARCH] Email unlock failed for ${name}:`, unlockError.message);
          }
        }
        
        // Serper research
        let researchData = '';
        try {
          const serperResponse = await axios.post('https://google.serper.dev/search', {
            q: `${name} ${title} ${company}`,
            num: 3
          }, {
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json'
            }
          });
          
          await awsManager.logApiUsage({
            userId,
            agentId: 'ai-search',
            service: 'serper',
            operation: 'search',
            usage: { searches: 1 },
            cost: 0.001
          });
          
          const results = serperResponse.data?.organic || [];
          researchData = results.map(r => `${r.title}: ${r.snippet}`).join('\n');
        } catch (serperError) {
          console.error('[AI SEARCH] Serper error:', serperError.message);
        }
        
        // AI generates description
        const descPrompt = `Write a 2-3 sentence professional summary about ${name}, ${title} at ${company}.\n\nContext: ${researchData || 'No additional context available'}`;
        
        const descCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: descPrompt }],
          temperature: 0.7,
          max_tokens: 150
        });
        
        await awsManager.logApiUsage({
          userId,
          agentId: 'ai-search',
          service: 'openai',
          operation: 'chat.completion',
          usage: { tokens: descCompletion.usage.total_tokens },
          cost: descCompletion.usage.total_tokens * 0.0034 / 1000
        });
        
        const description = descCompletion.choices[0].message.content.trim();
        
        return {
          id: person.id || `lead-${Date.now()}-${Math.random()}`,
          name,
          title,
          company,
          location: person.city || person.state || person.country || 'Unknown',
          email: email || null,
          linkedin: person.linkedin_url || null,
          companyWebsite: person.organization?.website_url || null,
          description,
          matchReason: `Found via: ${searchParams.titles?.join(', ') || query}`,
          score: 85
        };
      })
    );
    
    console.log(`[AI SEARCH] Generated ${leads.length} enriched leads`);
    
    res.json({
      success: true,
      leads,
      count: leads.length
    });
    
  } catch (error) {
    console.error('[AI SEARCH] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed'
    });
  }
});

/**
 * Assign lead to agent and generate email
 * POST /api/ai-search/assign-lead
 */
router.post('/assign-lead', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { lead, agentId } = req.body;
    
    if (!lead || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'Lead and agentId are required'
      });
    }
    
    console.log(`[AI SEARCH] Assigning lead ${lead.name} to agent ${agentId}`);
    
    // Import the reasoning agent
    const { getUserAgent } = await import('../routes/leadAgent.js');
    const agent = getUserAgent(userId, agentId);
    
    // Prepare lead data for the agent
    const leadData = {
      name: lead.name,
      first_name: lead.name.split(' ')[0],
      last_name: lead.name.split(' ').slice(1).join(' '),
      title: lead.title,
      email: lead.email,
      company: lead.company,
      organization: {
        name: lead.company,
        website_url: lead.companyWebsite
      },
      city: lead.location?.split(',')[0],
      state: lead.location?.split(',')[1]?.trim(),
      linkedin_url: lead.linkedin
    };
    
    // Trigger email generation for this lead
    // The agent will research the lead and generate a personalized email
    await agent.addToEmailQueue(leadData);
    
    console.log(`[AI SEARCH] Lead assigned and email queued for ${lead.name}`);
    
    res.json({
      success: true,
      message: `Email generated and added to agent's queue`
    });
    
  } catch (error) {
    console.error('[AI SEARCH] Error assigning lead:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign lead'
    });
  }
});

export default router;
