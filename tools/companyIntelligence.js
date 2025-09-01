// Enhanced Company Intelligence & Verification System
// Deep research and verification for hyper-personalized outreach

import 'dotenv/config';
import { internetSearch } from './internetSearch.js';
import { ChatOpenAI } from "@langchain/openai";

class CompanyIntelligence {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.1, // Lower temperature for more factual analysis
      modelName: "gpt-4o",
    });
  }

  /**
   * Deep company verification and intelligence gathering
   * @param {Object} apolloLead - Lead data from Apollo
   * @returns {Object} Enhanced lead with intelligence and verification
   */
  async enhanceAndVerifyLead(apolloLead) {
    console.log(`🔍 [COMPANY INTEL] Starting deep analysis for: ${apolloLead.company || apolloLead.organization?.name}`);
    
    try {
      // Step 1: Company verification
      const verification = await this.verifyCompany(apolloLead);
      
      if (!verification.isVerified) {
        console.log(`❌ [COMPANY INTEL] Company verification failed: ${verification.reason}`);
        return {
          ...apolloLead,
          verification: verification,
          intelligence: null,
          personalization: null
        };
      }

      // Step 2: Deep intelligence gathering
      const intelligence = await this.gatherCompanyIntelligence(apolloLead);
      
      // Step 3: Generate personalization data
      const personalization = await this.generatePersonalizationData(apolloLead, intelligence);
      
      return {
        ...apolloLead,
        verification: verification,
        intelligence: intelligence,
        personalization: personalization,
        enhancedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[COMPANY INTEL] Error enhancing lead:`, error);
      return {
        ...apolloLead,
        verification: { isVerified: false, reason: 'Enhancement failed', error: error.message },
        intelligence: null,
        personalization: null
      };
    }
  }

  /**
   * Verify that the Apollo company matches real web presence
   */
  async verifyCompany(apolloLead) {
    const company = apolloLead.company || apolloLead.organization?.name;
    
    // Try multiple domain sources with priority order
    let domain = apolloLead.organization?.website_url || 
                 apolloLead.organization?.primary_domain || 
                 apolloLead.company_domain;
    
    // If no direct domain, try to extract from LinkedIn URL as fallback
    if (!domain && apolloLead.organization?.linkedin_url) {
      // Extract company identifier from LinkedIn URL
      const linkedinMatch = apolloLead.organization.linkedin_url.match(/linkedin\.com\/company\/([^\/]+)/);
      if (linkedinMatch) {
        domain = `linkedin.com/company/${linkedinMatch[1]}`;
      }
    }
    
    console.log(`🔎 [VERIFICATION] Verifying ${company} with domain ${domain || 'no domain found'}`);
    
    try {
      // Search for company with multiple verification queries
      const verificationQueries = [
        domain ? `"${company}" site:${domain}` : `"${company}" company verification`,
        `${company} official website`,
        `${company} company about linkedin`,
        `${company} contact information address`
      ];
      
      const verificationResults = [];
      
      for (const query of verificationQueries) {
        try {
          const results = await internetSearch(query);
          if (results.organic && results.organic.length > 0) {
            verificationResults.push(...results.organic.slice(0, 3));
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(`⚠️ [VERIFICATION] Search failed for: ${query}`);
        }
      }
      
      // Analyze verification results with AI
      const verificationAnalysis = await this.analyzeVerificationResults(company, domain, verificationResults);
      
      return verificationAnalysis;
      
    } catch (error) {
      console.error(`[VERIFICATION] Error verifying company:`, error);
      return {
        isVerified: false,
        reason: 'Verification process failed',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * AI-powered verification analysis
   */
  async analyzeVerificationResults(company, domain, searchResults) {
    const domainInfo = domain ? (domain.includes('linkedin.com') ? 
      `LinkedIn Profile: "${domain}"` : 
      `Expected Domain: "${domain}"`) : 
      'No specific domain available';
      
    const prompt = `You are a company verification expert. Analyze these search results to determine if this is a legitimate, real company.

Company Name: "${company}"
${domainInfo}

Search Results:
${searchResults.map((result, i) => `${i+1}. Title: ${result.title}\n   URL: ${result.link}\n   Snippet: ${result.snippet}`).join('\n\n')}

VERIFICATION CRITERIA:
- Look for consistent company information across multiple sources
- Check for legitimate business presence (website, LinkedIn, news mentions)
- Verify the company actually exists and operates in the claimed industry
- If no domain is provided, focus on overall legitimacy from search results
- LinkedIn-only presence is acceptable for smaller companies

Analyze and respond with JSON:
{
  "isVerified": boolean,
  "confidence": number (0-100),
  "reason": "explanation",
  "companyType": "startup/enterprise/nonprofit/etc",
  "legitimacyFlags": {
    "hasOfficialWebsite": boolean,
    "hasLinkedInPresence": boolean,
    "hasNewsOrPRMentions": boolean,
    "domainMatches": boolean (or null if no domain to check),
    "hasContactInfo": boolean
  },
  "riskFactors": ["list of any red flags"],
  "verifiedInfo": {
    "actualCompanyName": "string",
    "industry": "string", 
    "location": "string",
    "companySize": "string"
  }
}`;

    try {
      const response = await this.llm.invoke(prompt);
      let content = response.content;
      
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      }
      
      // Clean up any remaining backticks or extra characters
      content = content.trim().replace(/^`+|`+$/g, '');
      
      const analysis = JSON.parse(content);
      
      console.log(`✅ [VERIFICATION] Analysis complete - Verified: ${analysis.isVerified}, Confidence: ${analysis.confidence}%`);
      
      return analysis;
    } catch (error) {
      console.error(`[VERIFICATION] AI analysis failed:`, error);
      console.error(`[VERIFICATION] Raw AI response:`, response?.content);
      return {
        isVerified: false,
        confidence: 0,
        reason: 'AI analysis failed',
        error: error.message
      };
    }
  }

  /**
   * Gather comprehensive company intelligence
   */
  async gatherCompanyIntelligence(apolloLead) {
    const company = apolloLead.company || apolloLead.organization?.name;
    
    console.log(`🧠 [INTELLIGENCE] Gathering deep intelligence for: ${company}`);
    
    // Define highly targeted research queries (4 total searches)
    const researchCategories = {
      techCapabilities: [
        `${company} artificial intelligence AI machine learning technology infrastructure`
      ],
      businessIntel: [
        `${company} funding investment revenue growth news 2024 2025`
      ],
      leadership: [
        `${company} CEO CTO founder leadership team vision strategy`
      ],
      market: [
        `${company} competitors challenges market position recent developments`
      ]
    };
    
    const intelligence = {
      gatheringDate: new Date().toISOString(),
      categories: {}
    };
    
    // Gather intelligence for each category
    for (const [category, queries] of Object.entries(researchCategories)) {
      console.log(`📊 [INTELLIGENCE] Researching category: ${category}`);
      intelligence.categories[category] = [];
      
      for (const query of queries) {
        try {
          const results = await internetSearch(query);
          if (results.organic && results.organic.length > 0) {
            const insights = this.extractKeyInsights(results.organic, company, category);
            intelligence.categories[category].push(...insights);
          }
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.log(`⚠️ [INTELLIGENCE] Search failed for: ${query}`);
        }
      }
    }
    
    // AI analysis of gathered intelligence
    const analysisPrompt = `Analyze this company intelligence data and provide strategic insights for sales outreach:

Company: ${company}
Intelligence Data: ${JSON.stringify(intelligence.categories, null, 2)}

Provide a JSON response with:
{
  "summary": "brief company overview",
  "aiReadiness": "assessment of AI/ML adoption",
  "growthSignals": ["list of growth indicators"],
  "painPoints": ["potential infrastructure challenges"],
  "opportunityScore": number (1-100),
  "personalizedAngles": ["specific outreach angles"],
  "keyPersonalities": ["leadership insights"],
  "recentDevelopments": ["latest news/changes"],
  "competitivePosition": "market position analysis"
}`;

    try {
      const analysisResponse = await this.llm.invoke(analysisPrompt);
      let content = analysisResponse.content;
      
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      }
      
      // Clean up any remaining backticks or extra characters
      content = content.trim().replace(/^`+|`+$/g, '');
      
      const analysis = JSON.parse(content);
      
      intelligence.analysis = analysis;
      console.log(`🎯 [INTELLIGENCE] Analysis complete - Opportunity Score: ${analysis.opportunityScore}/100`);
      
      return intelligence;
    } catch (error) {
      console.error(`[INTELLIGENCE] Analysis failed:`, error);
      console.error(`[INTELLIGENCE] Raw AI response:`, analysisResponse?.content);
      intelligence.analysis = null;
      return intelligence;
    }
  }

  /**
   * Extract key insights from search results
   */
  extractKeyInsights(searchResults, company, category) {
    return searchResults.slice(0, 3).map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      category: category,
      relevance: this.calculateRelevance(result, company),
      extractedAt: new Date().toISOString()
    }));
  }

  /**
   * Calculate relevance score for search result
   */
  calculateRelevance(result, company) {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    const companyName = company.toLowerCase();
    
    let score = 0;
    
    // Company name mentions
    if (text.includes(companyName)) score += 30;
    
    // Technology keywords
    const techKeywords = ['ai', 'artificial intelligence', 'machine learning', 'gpu', 'infrastructure', 'cloud', 'data'];
    score += techKeywords.filter(keyword => text.includes(keyword)).length * 5;
    
    // Business keywords
    const businessKeywords = ['funding', 'growth', 'expansion', 'partnership', 'revenue'];
    score += businessKeywords.filter(keyword => text.includes(keyword)).length * 3;
    
    return Math.min(score, 100);
  }

  /**
   * Generate hyper-personalized outreach data
   */
  async generatePersonalizationData(apolloLead, intelligence) {
    const company = apolloLead.company || apolloLead.organization?.name;
    const person = apolloLead.name || `${apolloLead.first_name} ${apolloLead.last_name}`;
    
    console.log(`✨ [PERSONALIZATION] Generating data for ${person} at ${company}`);
    
    const personalizationPrompt = `Create hyper-personalized outreach data for this sales prospect:

Contact: ${person}
Title: ${apolloLead.title}
Company: ${company}
Company Intelligence: ${JSON.stringify(intelligence.analysis, null, 2)}

Generate a JSON response with personalization data:
{
  "emailSubjects": ["3 highly personalized subject lines"],
  "openingLines": ["3 specific, researched opening lines"],
  "valuePropositions": ["3 tailored value props based on their situation"],
  "specificMentions": {
    "recentNews": "specific recent development to mention",
    "companyInitiatives": "specific AI/tech initiative",
    "personalConnection": "title-specific connection point"
  },
  "callToAction": ["2 soft CTA options"],
  "conversationStarters": ["2 thoughtful questions"],
  "credibilityBuilders": ["relevant case studies or examples"],
  "tone": "recommended tone (formal/casual/technical)",
  "personalityNotes": "insights about recipient based on role"
}

Make everything specific to their company's situation, not generic.`;

    try {
      const response = await this.llm.invoke(personalizationPrompt);
      let content = response.content;
      
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      }
      
      // Clean up any remaining backticks or extra characters
      content = content.trim().replace(/^`+|`+$/g, '');
      
      const personalizationData = JSON.parse(content);
      
      console.log(`✅ [PERSONALIZATION] Generated ${personalizationData.emailSubjects?.length} subject lines and detailed personalization`);
      
      return personalizationData;
    } catch (error) {
      console.error(`[PERSONALIZATION] Generation failed:`, error);
      console.error(`[PERSONALIZATION] Raw AI response:`, response?.content);
      return null;
    }
  }
}

export const companyIntelligence = new CompanyIntelligence();
