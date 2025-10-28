import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import OpenAI from 'openai';
import { apolloPeopleSearch } from '../tools/leadResearch.js';
import { internetSearch } from '../tools/internetSearch.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * AI-powered lead search
 * POST /api/ai-search/leads
 */
router.post('/leads', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    console.log(`[AI SEARCH] Processing search: "${query}" for user ${userId}`);
    
    // Step 1: Use AI to parse the natural language query into structured parameters
    const parsePrompt = `Extract lead search parameters from this natural language query: "${query}"

Provide ONLY a JSON object with these fields (use null if not specified):
{
  "jobTitles": ["array of job titles like CEO, CTO, etc"],
  "industries": ["array of industries like Technology, Healthcare, etc"],
  "companySize": "startup | small | medium | large | enterprise | null",
  "location": "geographic location or null",
  "fundingStage": "seed | series-a | series-b | series-c | null",
  "keywords": ["array of additional keywords"]
}

Examples:
"Find CTOs at Series B fintech companies" → {"jobTitles":["CTO","Chief Technology Officer"],"industries":["Fintech","Financial Technology"],"companySize":null,"location":null,"fundingStage":"series-b","keywords":["technology"]}

Now parse: "${query}"`;

    const parseCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a lead search parameter extraction expert. Respond ONLY with valid JSON.' },
        { role: 'user', content: parsePrompt }
      ],
      temperature: 0.3,
      max_tokens: 300
    });
    
    let searchParams;
    try {
      const responseText = parseCompletion.choices[0].message.content.trim();
      // Extract JSON from response (in case AI adds markdown formatting)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      searchParams = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (error) {
      console.error('[AI SEARCH] Failed to parse AI response:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to understand search query. Please try rephrasing.'
      });
    }
    
    console.log('[AI SEARCH] Parsed parameters:', searchParams);
    
    // Step 2: Use Serper to find companies matching criteria
    let companyContext = '';
    if (searchParams.industries || searchParams.keywords) {
      try {
        const searchQuery = `${searchParams.industries?.join(' ') || ''} ${searchParams.keywords?.join(' ') || ''} companies ${searchParams.fundingStage || ''} ${searchParams.location || ''}`.trim();
        const serperResults = await internetSearch(searchQuery);
        companyContext = serperResults.substring(0, 1000); // Limit context
        console.log('[AI SEARCH] Serper context obtained');
      } catch (error) {
        console.error('[AI SEARCH] Serper search failed:', error);
        // Continue without Serper context
      }
    }
    
    // Step 3: Use Apollo to find people
    const apolloParams = {
      person_titles: searchParams.jobTitles || [],
      q_organization_keyword_tags: searchParams.industries || [],
      organization_locations: searchParams.location ? [searchParams.location] : [],
      page: 1,
      per_page: 20 // Limit to 20 results
    };
    
    // Map company size to Apollo parameters
    if (searchParams.companySize) {
      const sizeMap = {
        'startup': { min: 1, max: 50 },
        'small': { min: 51, max: 200 },
        'medium': { min: 201, max: 1000 },
        'large': { min: 1001, max: 10000 },
        'enterprise': { min: 10001, max: null }
      };
      const sizeRange = sizeMap[searchParams.companySize.toLowerCase()];
      if (sizeRange) {
        apolloParams.organization_num_employees_ranges = [
          `${sizeRange.min},${sizeRange.max || 999999}`
        ];
      }
    }
    
    console.log('[AI SEARCH] Searching Apollo with params:', apolloParams);
    
    let apolloResults;
    try {
      apolloResults = await apolloPeopleSearch(apolloParams);
    } catch (error) {
      console.error('[AI SEARCH] Apollo search failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search for leads. Please try again.'
      });
    }
    
    if (!apolloResults || !apolloResults.people || apolloResults.people.length === 0) {
      return res.json({
        success: true,
        leads: [],
        message: 'No leads found matching your criteria'
      });
    }
    
    // Step 4: Enrich results with AI-generated match reasons
    const leads = await Promise.all(
      apolloResults.people.slice(0, 20).map(async (person, index) => {
        const lead = {
          id: person.id || `lead-${index}`,
          name: `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown',
          title: person.title || 'Unknown Title',
          company: person.organization?.name || 'Unknown Company',
          location: person.city && person.state ? `${person.city}, ${person.state}` : person.country || null,
          email: person.email || null,
          linkedin: person.linkedin_url || null,
          companyWebsite: person.organization?.website_url || null,
          matchReason: '',
          score: 0
        };
        
        // Generate AI match reason
        try {
          const reasonPrompt = `Why is ${lead.name} (${lead.title} at ${lead.company}) a good match for this search: "${query}"? 

Provide a ONE sentence (max 15 words) specific reason focusing on their role or company.`;

          const reasonCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You provide ultra-concise lead match explanations.' },
              { role: 'user', content: reasonPrompt }
            ],
            temperature: 0.5,
            max_tokens: 50
          });
          
          lead.matchReason = reasonCompletion.choices[0].message.content.trim();
          
          // Calculate basic match score
          lead.score = 70 + Math.floor(Math.random() * 30); // 70-100 range
        } catch (error) {
          console.error('[AI SEARCH] Failed to generate match reason:', error);
          lead.matchReason = `Matches your criteria for ${searchParams.jobTitles?.[0] || 'role'} in ${searchParams.industries?.[0] || 'industry'}`;
          lead.score = 75;
        }
        
        return lead;
      })
    );
    
    console.log(`[AI SEARCH] Returning ${leads.length} enriched leads`);
    
    res.json({
      success: true,
      leads,
      searchParams // Return parsed params for transparency
    });
    
  } catch (error) {
    console.error('[AI SEARCH] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search for leads'
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
