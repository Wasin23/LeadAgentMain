// Lead-specific research tool for the Lead Contact Agent
// Enhanced with advanced multi-source lead verification and scoring

import 'dotenv/config';
import { internetSearch } from './internetSearch.js';
import { companyIntelligence } from './companyIntelligence.js';
import { getUserSettings } from '../lib/userManager.js';

// EXPERIMENTAL: Universal lead scoring weights - works for ANY industry/domain
const SCORING_WEIGHTS = {
  EMAIL_VERIFIED: 35,        // Email deliverability verified 
  BUSINESS_RELEVANCE: 25,    // Company matches user's target criteria (NOT just tech!)
  COMPANY_HEALTH: 20,        // Growth, stability, hiring indicators
  ROLE_AUTHORITY: 15,        // Decision-making position for user's solution
  TIMING_SIGNALS: 5          // Recent activity or trigger events
};

// Decision-maker titles for authority scoring
const DECISION_MAKER_TITLES = [
  'cto', 'ceo', 'vp', 'director', 'head of', 'chief', 'founder', 'president',
  'lead', 'principal', 'senior', 'manager', 'architect'
];

// Generate industry-specific technology keywords
function getIndustryTechnologies(leadContactSettings) {
  const userIndustry = leadContactSettings.businessProfile?.industry?.toLowerCase() || 'business';
  
  const industryTech = {
    'e-commerce': ['shopify', 'magento', 'woocommerce', 'payment processing', 'inventory management', 'customer analytics'],
    'healthcare': ['ehr', 'emr', 'hipaa', 'telemedicine', 'patient management', 'medical devices'],
    'manufacturing': ['erp', 'scada', 'plc', 'iot sensors', 'quality management', 'supply chain'],
    'retail': ['pos systems', 'inventory management', 'crm', 'analytics', 'mobile commerce'],
    'hospitality': ['pms', 'booking systems', 'guest management', 'revenue management', 'mobile apps'],
    'construction': ['project management', 'bim', 'safety systems', 'scheduling', 'cost management'],
    'education': ['lms', 'student information systems', 'online learning', 'assessment tools'],
    'technology': ['cloud computing', 'microservices', 'devops', 'agile', 'api development'],
    'ai': ['tensorflow', 'pytorch', 'machine learning', 'data science', 'neural networks'],
    'finance': ['fintech', 'blockchain', 'risk management', 'compliance software', 'trading systems'],
    'legal': ['case management', 'document management', 'legal research', 'compliance tracking'],
    'consulting': ['project management', 'analytics', 'reporting tools', 'client management'],
    'default': ['business software', 'productivity tools', 'analytics', 'automation', 'cloud services']
  };

  return industryTech[userIndustry] || industryTech['default'];
}

// Helper function to get current and previous year for search queries
function getCurrentSearchYears() {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  return { currentYear, previousYear, yearString: `${previousYear} ${currentYear}` };
}

// Generate industry-specific search terms based on user's business
function getIndustrySearchTerms(leadContactSettings) {
  const userIndustry = leadContactSettings.businessProfile?.industry?.toLowerCase() || 'business';
  
  // Map industries to relevant search terms
  const industryTerms = {
    'e-commerce': ['online sales', 'ecommerce platform', 'digital marketing', 'customer acquisition'],
    'healthcare': ['patient care', 'medical technology', 'health outcomes', 'clinical operations'],
    'manufacturing': ['production efficiency', 'supply chain', 'automation', 'quality control'],
    'retail': ['customer experience', 'inventory management', 'point of sale', 'merchandising'],
    'hospitality': ['guest experience', 'property management', 'booking systems', 'customer service'],
    'construction': ['project management', 'building automation', 'safety compliance', 'construction technology'],
    'education': ['student outcomes', 'learning management', 'educational technology', 'curriculum development'],
    'technology': ['software development', 'infrastructure', 'digital transformation', 'innovation'],
    'tech': ['software development', 'infrastructure', 'digital transformation', 'innovation'],
    'software': ['application development', 'software solutions', 'technology stack', 'digital platforms'],
    'ai': ['artificial intelligence', 'machine learning', 'data science', 'automation'],
    'artificial intelligence': ['AI implementation', 'machine learning', 'data science', 'intelligent systems'],
    'machine learning': ['ML models', 'data science', 'predictive analytics', 'AI algorithms'],
    'finance': ['financial services', 'risk management', 'compliance', 'fintech solutions'],
    'financial': ['financial planning', 'investment management', 'banking technology', 'payment systems'],
    'banking': ['digital banking', 'financial technology', 'customer services', 'regulatory compliance'],
    'legal': ['legal technology', 'case management', 'compliance', 'document management'],
    'law': ['legal services', 'litigation support', 'regulatory compliance', 'legal research'],
    'consulting': ['business strategy', 'operational efficiency', 'process improvement', 'advisory services'],
    'default': ['business growth', 'operational efficiency', 'digital solutions', 'productivity']
  };

  return industryTerms[userIndustry] || industryTerms['default'];
}

// Generate industry-specific detection patterns and sales angles
function getIndustryInsightPatterns(leadContactSettings) {
  const userIndustry = leadContactSettings.businessProfile?.industry?.toLowerCase() || 'business';
  const coreOffering = leadContactSettings.companyBranding?.coreOffering || 'Professional business solutions';
  
  const patterns = {
    'e-commerce': {
      keywords: ['ecommerce', 'online sales', 'digital marketing', 'customer acquisition'],
      expansionType: 'Digital Commerce Expansion',
      expansionMessage: 'expanding digital commerce capabilities',
      expansionAngle: `Perfect timing for ${coreOffering} to support growth`,
      hiringRoles: ['marketing', 'ecommerce', 'digital'],
      hiringMessage: 'actively hiring digital commerce talent',
      hiringAngle: `New commerce teams need ${coreOffering}`
    },
    'healthcare': {
      keywords: ['patient care', 'medical technology', 'health outcomes', 'clinical'],
      expansionType: 'Healthcare Technology Expansion',
      expansionMessage: 'expanding healthcare technology initiatives',
      expansionAngle: `Perfect timing for ${coreOffering} to improve patient outcomes`,
      hiringRoles: ['medical', 'clinical', 'health'],
      hiringMessage: 'actively hiring healthcare technology talent',
      hiringAngle: `New healthcare teams need ${coreOffering}`
    },
    'finance': {
      keywords: ['financial services', 'fintech', 'banking', 'investment'],
      expansionType: 'Financial Technology Expansion',
      expansionMessage: 'expanding financial technology capabilities',
      expansionAngle: `Perfect timing for ${coreOffering} to enhance financial services`,
      hiringRoles: ['financial', 'fintech', 'banking'],
      hiringMessage: 'actively hiring financial technology talent',
      hiringAngle: `New financial teams need ${coreOffering}`
    },
    'technology': {
      keywords: ['software development', 'infrastructure', 'digital transformation'],
      expansionType: 'Technology Infrastructure Expansion',
      expansionMessage: 'expanding technology infrastructure',
      expansionAngle: `Perfect timing for ${coreOffering} to scale technology`,
      hiringRoles: ['engineer', 'developer', 'technology'],
      hiringMessage: 'actively hiring technology talent',
      hiringAngle: `New technology teams need ${coreOffering}`
    },
    'ai': {
      keywords: ['artificial intelligence', 'machine learning', 'ai', 'ml'],
      expansionType: 'AI/ML Technology Expansion',
      expansionMessage: 'expanding AI/ML initiatives',
      expansionAngle: `Perfect timing for ${coreOffering} to support AI growth`,
      hiringRoles: ['ai', 'ml', 'data scientist'],
      hiringMessage: 'actively hiring AI/ML talent',
      hiringAngle: `New AI teams need ${coreOffering}`
    },
    'default': {
      keywords: ['business growth', 'expansion', 'development', 'innovation'],
      expansionType: 'Business Expansion',
      expansionMessage: 'expanding business operations',
      expansionAngle: `Perfect timing for ${coreOffering} to support growth`,
      hiringRoles: ['manager', 'specialist', 'analyst'],
      hiringMessage: 'actively hiring business talent',
      hiringAngle: `New business teams need ${coreOffering}`
    }
  };

  return patterns[userIndustry] || patterns['default'];
}

// EXPERIMENTAL: Universal business relevance indicators (NOT just tech!)
function getBusinessRelevanceIndicators(leadContactSettings) {
  const userKeywords = leadContactSettings?.companyKeywords || [];
  const userIndustries = leadContactSettings?.companyIndustries || [];
  const userService = leadContactSettings?.companyBranding?.primaryService || '';
  
  // Build comprehensive business indicators based on user's actual offering
  let relevanceIndicators = [...userKeywords];
  
  // Add industry-specific business indicators (NOT just tech!)
  userIndustries.forEach(industry => {
    switch(industry.toLowerCase()) {
      case 'e-commerce':
        relevanceIndicators.push('online retail', 'customer service', 'order management', 'inventory', 'fulfillment');
        break;
      case 'healthcare':
        relevanceIndicators.push('patient care', 'medical records', 'appointments', 'staff coordination', 'compliance');
        break;
      case 'manufacturing':
        relevanceIndicators.push('production', 'quality control', 'workforce management', 'safety protocols', 'shift scheduling');
        break;
      case 'retail':
        relevanceIndicators.push('customer experience', 'staff training', 'inventory management', 'point of sale', 'employee scheduling');
        break;
      case 'hospitality':
        relevanceIndicators.push('guest services', 'staff coordination', 'reservations', 'housekeeping', 'front desk');
        break;
      case 'construction':
        relevanceIndicators.push('project management', 'crew coordination', 'safety compliance', 'equipment tracking', 'site communication');
        break;
      case 'education':
        relevanceIndicators.push('student services', 'faculty coordination', 'administration', 'campus communication', 'enrollment');
        break;
      case 'technology':
      case 'tech':
      case 'software':
        relevanceIndicators.push('development teams', 'remote work', 'agile workflows', 'sprint planning', 'code deployment', 'tech support', 'engineering coordination');
        break;
      case 'ai':
      case 'artificial intelligence':
      case 'machine learning':
      case 'ml':
        relevanceIndicators.push('data science', 'model training', 'research teams', 'algorithm development', 'data pipelines', 'ml ops', 'ai research', 'deep learning', 'neural networks');
        break;
      case 'finance':
      case 'financial':
      case 'banking':
        relevanceIndicators.push('compliance', 'audit', 'risk management', 'client communication', 'regulatory reporting', 'branch operations');
        break;
      case 'legal':
      case 'law':
        relevanceIndicators.push('case management', 'client communication', 'document review', 'court scheduling', 'billable hours', 'paralegal coordination');
        break;
      case 'consulting':
        relevanceIndicators.push('client projects', 'team collaboration', 'deliverables', 'client communication', 'resource allocation', 'project timelines');
        break;
      default:
        // Universal business needs
        relevanceIndicators.push('employee communication', 'team coordination', 'operational efficiency', 'workforce management');
    }
  });
  
  // Add service-specific indicators from user's primary service
  if (userService.toLowerCase().includes('hr') || userService.toLowerCase().includes('employee')) {
    relevanceIndicators.push('human resources', 'employee engagement', 'workforce', 'staff communication', 'payroll', 'benefits');
  }
  
  // Always include universal business indicators
  relevanceIndicators.push('communication', 'efficiency', 'productivity', 'management', 'operations', 'workflow', 'integration');
  
  return [...new Set(relevanceIndicators)]; // Remove duplicates
}

// EXPERIMENTAL: Dynamic growth indicators (generic business signals)
const GROWTH_INDICATORS = [
  'series a', 'series b', 'funding', 'investment', 'hiring', 'expansion',
  'scale', 'growth', 'ipo', 'acquisition', 'partnership', 'revenue', 'employee growth'
];

// EXPERIMENTAL: Dynamic decision-maker detection based on user's target positions
function getDecisionMakerTitles(leadContactSettings) {
  const userPositions = leadContactSettings?.targetPositions || [];
  
  // Start with user's target positions
  let decisionMakers = [...userPositions];
  
  // Add common decision-maker patterns
  decisionMakers.push('ceo', 'cto', 'vp', 'director', 'head of', 'chief', 'founder', 'president',
    'lead', 'principal', 'senior', 'manager', 'architect');
  
  return [...new Set(decisionMakers.map(title => title.toLowerCase()))];
}

// Advanced email verification using ZeroBounce
async function verifyEmailDeliverability(email, userId = null) {
  try {
    const apiKey = await getApiKey('zerobounce', userId);
    if (!apiKey) {
      console.log('⚠️ ZeroBounce API key not configured, skipping email verification');
      return { valid: null, score: 0 };
    }

    const response = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`);
    const data = await response.json();
    
    if (data.status === 'valid') {
      console.log(`✅ Email verified: ${email} - ${data.status}`);
      return { valid: true, score: SCORING_WEIGHTS.EMAIL_VERIFIED, deliverabilityScore: data.sub_result };
    } else if (data.status === 'catch-all') {
      console.log(`⚠️ Email catch-all (accepting anyway): ${email} - ${data.status}`);
      return { valid: true, score: SCORING_WEIGHTS.EMAIL_VERIFIED * 0.7, deliverabilityScore: data.sub_result }; // Slightly lower score but still valid
    } else {
      console.log(`❌ Email invalid: ${email} - ${data.status}`);
      return { valid: false, score: 0, reason: data.status };
    }
  } catch (error) {
    console.error('ZeroBounce verification error:', error.message);
    return { valid: null, score: 0 };
  }
}

// Enhanced email discovery using Hunter.io
async function findEmailWithHunter(firstName, lastName, domain, userId = null) {
  try {
    const apiKey = await getApiKey('hunter', userId);
    if (!apiKey) {
      console.log('⚠️ Hunter.io API key not configured, skipping email discovery');
      return null;
    }

    const response = await fetch(
      `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.data && data.data.email && data.data.confidence > 70) {
      console.log(`🎯 Hunter.io found email: ${data.data.email} (confidence: ${data.data.confidence}%)`);
      return { 
        email: data.data.email, 
        confidence: data.data.confidence,
        source: 'hunter'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Hunter.io email finder error:', error.message);
    return null;
  }
}

// Technology stack detection using BuiltWith
// EXPERIMENTAL: Universal business relevance detection (NOT just tech stack!)
async function detectBusinessRelevance(domain, userId = null, options = {}) {
  try {
    console.log(`🔍 Analyzing business relevance for ${domain} using universal methods...`);
    
    const businessIndicators = [];
    let relevanceScore = 0;
    
    // Method 1: Check common technology patterns in HTTP headers and HTML
    try {
      const response = await fetch(`https://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const html = await response.text();
      const headers = response.headers;
      
      // EXPERIMENTAL: Universal business patterns (NOT just tech frameworks!)
      const businessPatterns = {
        'E-commerce': [/shop/i, /cart/i, /product/i, /checkout/i, /order/i, /inventory/i],
        'Healthcare': [/patient/i, /medical/i, /health/i, /clinic/i, /hospital/i, /appointment/i],
        'Manufacturing': [/production/i, /quality/i, /safety/i, /equipment/i, /facility/i],
        'Retail': [/store/i, /customer/i, /service/i, /location/i, /hours/i],
        'Hospitality': [/guest/i, /room/i, /reservation/i, /hotel/i, /restaurant/i],
        'Construction': [/project/i, /contractor/i, /building/i, /construction/i, /site/i],
        'Education': [/student/i, /faculty/i, /course/i, /campus/i, /enrollment/i],
        'HR & Workforce': [/employee/i, /staff/i, /workforce/i, /hr/i, /payroll/i, /benefits/i],
        'Communication': [/message/i, /notification/i, /alert/i, /communication/i, /chat/i],
        'Integration': [/api/i, /integration/i, /connect/i, /sync/i, /workflow/i],
        'Management': [/dashboard/i, /admin/i, /management/i, /control/i, /oversight/i]
      };
      
      // Check HTTP headers for server info
      const serverHeader = headers.get('server') || '';
      const poweredBy = headers.get('x-powered-by') || '';
      const generator = headers.get('generator') || '';
      
      // EXPERIMENTAL: Analyze business relevance (NOT just tech!)
      for (const [businessType, patterns] of Object.entries(businessPatterns)) {
        const found = patterns.some(pattern => 
          pattern.test(html) || 
          pattern.test(serverHeader) || 
          pattern.test(poweredBy) || 
          pattern.test(generator)
        );
        
        if (found) {
          businessIndicators.push(businessType.toLowerCase());
          
          // EXPERIMENTAL: Dynamic scoring based on user's actual business needs
          const relevanceIndicators = getBusinessRelevanceIndicators(options.leadContactSettings || {});
          const userIndustries = options.leadContactSettings?.companyIndustries || [];
          
          // Full points if matches user's industry
          if (userIndustries.some(industry => businessType.toLowerCase().includes(industry.toLowerCase()))) {
            relevanceScore = SCORING_WEIGHTS.BUSINESS_RELEVANCE;
          }
          // High points if matches user's service indicators  
          else if (relevanceIndicators.some(indicator => 
            businessType.toLowerCase().includes(indicator.toLowerCase()) || 
            html.toLowerCase().includes(indicator.toLowerCase())
          )) {
            relevanceScore = Math.max(relevanceScore, Math.floor(SCORING_WEIGHTS.BUSINESS_RELEVANCE * 0.8));
          }
          // Medium points for any business activity
          else {
            relevanceScore = Math.max(relevanceScore, Math.floor(SCORING_WEIGHTS.BUSINESS_RELEVANCE * 0.4));
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Could not fetch website directly: ${error.message}`);
    }
    
    console.log(`🎯 Business relevance detected: ${businessIndicators.join(', ')} (Score: ${relevanceScore})`);
    
    return {
      businessTypes: businessIndicators,
      score: relevanceScore,
      allIndicators: businessIndicators
    };
    
  } catch (error) {
    console.error('Business relevance detection error:', error);
    return {
      businessTypes: [],
      score: 0,
      allIndicators: []
    };
  }
}

// Free company enrichment using web scraping and search
async function enrichCompanyData(domain, userId = null) {
  try {
    console.log(`💼 Enriching company data for ${domain} using free methods...`);
    
    let growthScore = 0;
    const companyData = { enriched: false };
    
    // Method 1: Scrape company website for basic info
    try {
      const response = await fetch(`https://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const html = await response.text();
      
      // Extract company info from meta tags and content
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const descriptionMatch = html.match(/<meta name="description" content="(.*?)"/i);
      
      if (titleMatch) companyData.name = titleMatch[1];
      if (descriptionMatch) companyData.description = descriptionMatch[1];
      
      // Look for growth indicators in the content
      const content = html.toLowerCase();
      GROWTH_INDICATORS.forEach(indicator => {
        if (content.includes(indicator)) {
          growthScore += 2;
        }
      });
      
    } catch (error) {
      console.log(`⚠️ Could not scrape company website: ${error.message}`);
    }
    
    // Method 2: Use web search for company funding/growth information
    try {
      const searchQuery = `"${domain}" funding OR investment OR "series a" OR "series b" OR hiring OR growth`;
      const searchResults = await internetSearch(searchQuery, { maxResults: 3 });
      
      if (searchResults?.results) {
        for (const result of searchResults.results) {
          const content = (result.content || '').toLowerCase();
          
          // Look for funding/growth signals
          GROWTH_INDICATORS.forEach(indicator => {
            if (content.includes(indicator)) {
              growthScore += 3;
            }
          });
          
          // Check for specific signals
          if (content.includes('million') && (content.includes('funding') || content.includes('raised'))) {
            growthScore += 8;
          }
          if (content.includes('hiring') || content.includes('jobs')) {
            growthScore += 4;
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Company growth search failed: ${error.message}`);
    }
    
    // Cap the score
    growthScore = Math.min(growthScore, SCORING_WEIGHTS.COMPANY_HEALTH);
    
    console.log(`💼 Company enrichment complete for ${domain} (Score: ${growthScore})`);
    
    return {
      enriched: true,
      score: growthScore,
      data: companyData
    };
    
  } catch (error) {
    console.error('Company enrichment error:', error);
    return {
      enriched: false,
      score: 0,
      data: {}
    };
  }
}

// Helper function to get API key from environment variables
async function getApiKey(keyName, userId = null) {
  try {
    // Use environment variable
    const envKey = process.env[`${keyName.toUpperCase()}_API_KEY`];
    if (envKey && envKey.trim() !== '') {
      console.log(`🔑 [API] Using environment ${keyName.toUpperCase()} API key`);
      return envKey;
    }
    
    throw new Error(`${keyName.toUpperCase()} API key not found in environment variables`);
  } catch (error) {
    console.error(`[API] Error getting ${keyName} API key:`, error.message);
    throw error;
  }
}

// Enhanced lead research with multi-source verification and scoring
export async function leadResearch(query, options = {}) {
  // Optimize Apollo usage: Only search for 5 leads since we only use top 5 anyway
  const limit = Math.min(options.limit || 5, 5); // Cap at 5 to reduce API costs
  const userId = options.userId || null; // Get userId from options for API key lookup
  const researchFocus = options.researchFocus || null; // Get custom research focus
  const leadContactSettings = options.leadContactSettings || null; // Get lead contact settings
  const remainingNeeded = options.remainingNeeded || 5; // How many qualified leads are still needed
  console.log(`🔍 [LEAD RESEARCH] Starting enhanced multi-source research for: ${query} (limit: ${limit}, remainingNeeded: ${remainingNeeded})`);
  
  try {
    // Step 1: Get initial leads from Apollo
    const apolloLeads = await searchApollo(query, limit, userId, leadContactSettings);
    console.log(`📊 [LEAD RESEARCH] Found ${apolloLeads.length} Apollo leads`);
    
    // Step 2: Enhanced verification and scoring on top leads
    const topLeads = apolloLeads.slice(0, 5);
    const enhancedLeads = [];
    
    for (const lead of topLeads) {
      const companyName = lead.organization?.name || lead.company;
      const domain = lead.organization?.primary_domain || extractDomain(lead.email);
      
      console.log(`🔬 [ENHANCED RESEARCH] Processing: ${companyName} - ${lead.name}`);
      
      let totalScore = 0;
      const scoringBreakdown = {};
      const enrichmentData = {};
      
      // Enhanced Email Verification
      let verifiedEmail = lead.email;
      if (lead.email) {
        const emailVerification = await verifyEmailDeliverability(lead.email, userId);
        totalScore += emailVerification.score;
        scoringBreakdown.emailVerification = emailVerification;
        enrichmentData.emailVerification = emailVerification;
      } else if (domain && lead.first_name && lead.last_name) {
        // Try to find email with Hunter.io
        const hunterResult = await findEmailWithHunter(lead.first_name, lead.last_name, domain, userId);
        if (hunterResult) {
          verifiedEmail = hunterResult.email;
          enrichmentData.emailSource = 'hunter';
          enrichmentData.emailConfidence = hunterResult.confidence;
          // Verify the found email
          const emailVerification = await verifyEmailDeliverability(verifiedEmail, userId);
          totalScore += emailVerification.score;
          scoringBreakdown.emailVerification = emailVerification;
        }
      }
      
      // EXPERIMENTAL: Universal Business Relevance Analysis (replaces tech-only analysis)
      if (domain) {
        const businessAnalysis = await detectBusinessRelevance(domain, userId, options);
        totalScore += businessAnalysis.score;
        scoringBreakdown.businessRelevance = businessAnalysis;
        enrichmentData.businessRelevance = businessAnalysis;
      }
      
      // Company Data Enrichment
      if (domain) {
        const companyEnrichment = await enrichCompanyData(domain, userId);
        totalScore += companyEnrichment.score;
        scoringBreakdown.companyGrowth = companyEnrichment;
        enrichmentData.companyData = companyEnrichment.data;
      }
      
      // Authority/Role Scoring
      const authorityScore = calculateAuthorityScore(lead.title);
      totalScore += authorityScore;
      scoringBreakdown.roleAuthority = { score: authorityScore, title: lead.title };
      
      // Timing Signals Detection
      const timingSignals = await detectTimingSignals(companyName, leadContactSettings, userId);
      totalScore += timingSignals.score;
      scoringBreakdown.timingSignals = timingSignals;
      enrichmentData.timingSignals = timingSignals.signals;
      
      // Company Intelligence (existing function)
      const enhancedLead = await companyIntelligence.enhanceAndVerifyLead(lead, researchFocus, leadContactSettings);
      
      // Enhanced Person Research
      const personInfo = await gatherPersonInfo(lead, userId);
      
      // Create comprehensive enhanced lead object
      const finalEnhancedLead = {
        ...enhancedLead,
        email: verifiedEmail,
        totalScore: totalScore,
        scoringBreakdown: scoringBreakdown,
        enrichmentData: enrichmentData,
        personInfo: personInfo, // Add the detailed person information
        leadQuality: totalScore >= (leadContactSettings.qualityThresholds?.high || 70) ? 'high' : 
                    totalScore >= (leadContactSettings.qualityThresholds?.medium || 40) ? 'medium' : 'low',
        verificationStatus: 'enhanced_verified'
      };
      
      // Only include leads with minimum score or verified emails
      if (totalScore >= 25 || (verifiedEmail && scoringBreakdown.emailVerification?.valid)) {
        enhancedLeads.push(finalEnhancedLead);
        console.log(`✅ [ENHANCED RESEARCH] Lead qualified: ${companyName} - Score: ${totalScore} (${finalEnhancedLead.leadQuality})`);
        
        // 🎯 EARLY STOP: Check if we have enough qualified leads
        if (enhancedLeads.length >= remainingNeeded) {
          console.log(`🎯 [RESEARCH TARGET REACHED] Found ${enhancedLeads.length}/${remainingNeeded} qualified leads - stopping research immediately!`);
          break; // Exit the processing loop to save API calls and processing time
        }
      } else {
        console.log(`❌ [ENHANCED RESEARCH] Lead filtered out: ${companyName} - Score: ${totalScore} (below threshold of 25)`);
      }
    }
    
    // Sort by total score (highest first)
    enhancedLeads.sort((a, b) => b.totalScore - a.totalScore);
    
    console.log(`🎯 [ENHANCED RESEARCH] Qualified ${enhancedLeads.length}/${topLeads.length} leads with enhanced scoring`);
    
    // Return enhanced leads + remaining basic leads if needed
    const remainingLeads = apolloLeads.slice(5);
    return [...enhancedLeads, ...remainingLeads];
    
  } catch (error) {
    console.error('[ENHANCED RESEARCH] Error:', error);
    throw error;
  }
}

// Helper function to extract domain from email
function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1];
}

// Calculate lead authority score based on title
function calculateAuthorityScore(title) {
  const titleLower = (title || '').toLowerCase();
  const matchingTitles = DECISION_MAKER_TITLES.filter(dmTitle => 
    titleLower.includes(dmTitle)
  );
  
  if (matchingTitles.some(title => ['ceo', 'cto', 'founder', 'president'].includes(title))) {
    return SCORING_WEIGHTS.ROLE_AUTHORITY;
  } else if (matchingTitles.some(title => ['vp', 'director', 'head of'].includes(title))) {
    return Math.floor(SCORING_WEIGHTS.ROLE_AUTHORITY * 0.8);
  } else if (matchingTitles.length > 0) {
    return Math.floor(SCORING_WEIGHTS.ROLE_AUTHORITY * 0.5);
  }
  
  return 0;
}

// Detect timing signals for outreach
async function detectTimingSignals(companyName, leadContactSettings, userId = null) {
  try {
    // Search for recent company news, funding, hiring, etc.
    const { yearString } = getCurrentSearchYears();
    const searchQuery = `${companyName} (funding OR hiring OR expansion OR partnership OR announcement) ${yearString}`;
    const results = await internetSearch(searchQuery);
    
    let timingScore = 0;
    const signals = [];
    
    if (results && results.organic && results.organic.length > 0) {
      const recentNews = results.organic.slice(0, 5);
      
      for (const article of recentNews) {
        const text = (article.title + ' ' + (article.snippet || '')).toLowerCase();
        
        if (GROWTH_INDICATORS.some(indicator => text.includes(indicator))) {
          timingScore += 2;
          signals.push({
            type: 'growth_signal',
            description: article.title,
            url: article.link
          });
        }
        
        // Look for industry-specific technology mentions
        const industryTech = getIndustryTechnologies(leadContactSettings);
        if (industryTech.some(tech => text.includes(tech))) {
          timingScore += 3;
          signals.push({
            type: 'tech_signal', 
            description: article.title,
            url: article.link
          });
        }
      }
    }
    
    const finalScore = Math.min(timingScore, SCORING_WEIGHTS.TIMING_SIGNALS);
    console.log(`⏰ Timing signals for ${companyName}: ${signals.length} signals, score: ${finalScore}`);
    
    return { score: finalScore, signals };
  } catch (error) {
    console.error('Timing signals detection error:', error.message);
    return { score: 0, signals: [] };
  }
}

// Deep company intelligence gathering
async function enrichLeadWithIntelligence(lead) {
  const company = lead.organization?.name || lead.company || lead.company_name;
  const person = lead.name || `${lead.first_name} ${lead.last_name}`;
  
  try {
    console.log(`🎯 [INTELLIGENCE] Researching ${company} for sales opportunities...`);
    
    // Multi-angle research queries
    const { yearString, currentYear } = getCurrentSearchYears();
    const industryTerms = getIndustrySearchTerms(leadContactSettings);
    const researchQueries = [
      `${company} ${industryTerms.join(' ')} ${yearString}`,
      `${company} funding series venture capital investment ${currentYear}`,
      `${company} hiring jobs ${industryTerms[0]} ${industryTerms[1]}`,
      `${company} CEO CTO interview ${industryTerms[2]} transformation`,
      `${company} competitors ${industryTerms.join(' OR ')}`
    ];
    
    const salesIntelligence = [];
    
    for (const searchQuery of researchQueries) {
      try {
        const results = await internetSearch(searchQuery);
        console.log(`🔍 [INTELLIGENCE] Search completed for: ${searchQuery}`);
        console.log(`📊 [INTELLIGENCE] Results structure:`, Object.keys(results));
        
        // Check if results has organic results
        if (results.organic && Array.isArray(results.organic)) {
          const insights = extractSalesInsights(results.organic, company);
          console.log(`💡 [INTELLIGENCE] Extracted ${insights.length} insights from ${results.organic.length} results`);
          salesIntelligence.push(...insights);
        } else {
          console.log(`⚠️ [INTELLIGENCE] No organic results found for: ${searchQuery}`);
        }
      } catch (err) {
        console.log(`⚠️ [INTELLIGENCE] Search failed for: ${searchQuery} - Error:`, err.message);
      }
    }
    
    // Build intelligent sales profile
    const salesProfile = buildSalesProfile(salesIntelligence, company);
    
    return {
      ...lead,
      salesIntelligence: {
        researchDate: new Date().toISOString(),
        insights: salesIntelligence,
        salesProfile: salesProfile,
        confidence: calculateConfidenceScore(salesIntelligence)
      }
    };
    
  } catch (error) {
    console.error(`[INTELLIGENCE] Error researching ${company}:`, error);
    return lead; // Return basic lead if enrichment fails
  }
}

// Extract actionable sales insights from search results
function extractSalesInsights(searchResults, company) {
  const insights = [];
  
  console.log(`🔬 [INSIGHTS] Processing ${searchResults.length} search results for ${company}`);
  
  for (const result of searchResults) {
    // Handle both direct results and Serper organic format
    const title = result.title || '';
    const snippet = result.snippet || result.description || '';
    const link = result.link || result.url || '';
    
    const text = `${title} ${snippet}`.toLowerCase();
    const insight = {
      source: link,
      title: title,
      relevance: 'medium'
    };
    
    // Industry-specific expansion signals
    const industryPatterns = getIndustryInsightPatterns(leadContactSettings);
    const hasIndustryKeyword = industryPatterns.keywords.some(keyword => text.includes(keyword));
    
    if (hasIndustryKeyword) {
      if (text.includes('launch') || text.includes('new') || text.includes('start')) {
        insight.type = 'industry_expansion';
        insight.message = `${company} is ${industryPatterns.expansionMessage}`;
        insight.relevance = 'high';
        insight.salesAngle = industryPatterns.expansionAngle;
      }
    }
    
    // Funding & Growth Signals
    if (text.includes('funding') || text.includes('series') || text.includes('investment')) {
      insight.type = 'funding_growth';
      insight.message = `${company} recently secured funding`;
      insight.relevance = 'high';
      insight.salesAngle = 'Growth phase requires robust infrastructure';
    }
    
    // Hiring & Scaling Signals
    if (text.includes('hiring') || text.includes('jobs') || text.includes('engineer')) {
      const hasIndustryHiring = industryPatterns.hiringRoles.some(role => text.includes(role));
      if (hasIndustryHiring) {
        insight.type = 'industry_hiring';
        insight.message = `${company} is ${industryPatterns.hiringMessage}`;
        insight.relevance = 'high';
        insight.salesAngle = industryPatterns.hiringAngle;
      }
    }
    
    // Leadership Focus
    if (text.includes('ceo') || text.includes('cto') || text.includes('chief')) {
      const hasIndustryFocus = industryPatterns.keywords.some(keyword => text.includes(keyword)) || 
                              text.includes('digital transformation') || text.includes('growth') || text.includes('expansion');
      if (hasIndustryFocus) {
        insight.type = 'leadership_focus';
        insight.message = `${company} leadership is prioritizing business transformation and growth`;
        insight.relevance = 'high';
        insight.salesAngle = `Executive mandate for growth requires ${industryPatterns.expansionAngle.split('for ')[1] || 'professional solutions'}`;
      }
    }
    
    // Competitive Pressure
    if (text.includes('competitor') || text.includes('rival')) {
      if (text.includes('ai') || text.includes('launch')) {
        insight.type = 'competitive_pressure';
        insight.message = `${company} facing AI competition in their market`;
        insight.relevance = 'medium';
        insight.salesAngle = 'Stay competitive with superior AI infrastructure';
      }
    }
    
    // Performance/Scale Challenges
    if (text.includes('scale') || text.includes('performance') || text.includes('infrastructure')) {
      insight.type = 'scale_challenges';
      insight.message = `${company} discussing scaling or performance needs`;
      insight.relevance = 'medium';
      const coreOffering = leadContactSettings.companyBranding?.coreOffering || 'Specialized business solutions';
      insight.salesAngle = `${coreOffering} can solve performance and scaling challenges`;
    }
    
    if (insight.type) {
      insights.push(insight);
      console.log(`💡 [INSIGHTS] Found ${insight.type} for ${company}: ${insight.message}`);
    }
  }
  
  console.log(`📊 [INSIGHTS] Total insights extracted: ${insights.length}`);
  return insights;
}

// Build comprehensive sales profile from insights
function buildSalesProfile(insights, company) {
  const profile = {
    company: company,
    primaryOpportunities: [],
    salesRecommendations: [],
    keyTriggers: []
  };
  
  // Group insights by type and relevance
  const highValueInsights = insights.filter(i => i.relevance === 'high');
  const insightsByType = {};
  
  for (const insight of insights) {
    if (!insightsByType[insight.type]) {
      insightsByType[insight.type] = [];
    }
    insightsByType[insight.type].push(insight);
  }
  
  // Generate targeted sales opportunities
  if (insightsByType.ai_expansion) {
    profile.primaryOpportunities.push({
      type: 'Technology Infrastructure Scaling',
      priority: 'high',
      reasoning: 'Company is actively expanding technology capabilities and will need specialized solutions',
      exabitsValue: leadContactSettings.companyBranding?.coreOffering || 'Tailored business solutions to drive growth and efficiency'
    });
  }
  
  if (insightsByType.funding_growth) {
    profile.primaryOpportunities.push({
      type: 'Growth Investment Opportunity',
      priority: 'high', 
      reasoning: 'Recent funding provides budget for business expansion and improvements',
      exabitsValue: leadContactSettings.companyBranding?.coreOffering || 'Cost-effective business solutions for growing companies'
    });
  }
  
  if (insightsByType.industry_hiring) {
    const industryPatterns = getIndustryInsightPatterns(leadContactSettings);
    profile.primaryOpportunities.push({
      type: 'Team Expansion Support',
      priority: 'high',
      reasoning: `Growing teams need ${industryPatterns.expansionType.toLowerCase()} support`,
      exabitsValue: leadContactSettings.companyBranding?.coreOffering || 'Professional support for expanding teams'
    });
  }
  
  // Generate personalized sales angles
  const coreOffering = leadContactSettings.companyBranding?.coreOffering || 'professional business solutions';
  const keyAdvantages = leadContactSettings.companyBranding?.keyAdvantages || 'tailored solutions, competitive pricing, expert support';
  const primaryService = leadContactSettings.companyBranding?.primaryService || 'Professional Business Solutions';
  
  profile.salesRecommendations = [
    `Lead with ${primaryService.toLowerCase()} advantages over generic alternatives`,
    `Emphasize ${keyAdvantages.split(',')[0].trim()} benefits`,
    `Highlight ${keyAdvantages.split(',')[2]?.trim() || 'expert support'} vs competitors`
  ];
  
  if (highValueInsights.length > 0) {
    const industryPatterns = getIndustryInsightPatterns(leadContactSettings);
    profile.salesRecommendations.unshift(`Reference specific company ${industryPatterns.expansionMessage} found in research`);
  }
  
  // Key conversation triggers
  profile.keyTriggers = highValueInsights.map(insight => ({
    trigger: insight.message,
    response: insight.salesAngle
  }));
  
  return profile;
}

// Calculate confidence score for sales intelligence
function calculateConfidenceScore(insights) {
  if (insights.length === 0) return 0;
  
  const highRelevanceCount = insights.filter(i => i.relevance === 'high').length;
  const totalInsights = insights.length;
  
  const baseScore = Math.min(totalInsights * 20, 80); // Max 80 from quantity
  const qualityBonus = highRelevanceCount * 10; // Bonus for high-relevance insights
  
  return Math.min(baseScore + qualityBonus, 100);
}

// Import Apollo search functionality
async function searchApollo(query, limit = 5, userId = null, leadContactSettings = null) { // Reduced default from 10 to 5 for cost optimization
  const apiKey = await getApiKey('apollo', userId);
  if (!apiKey) {
    throw new Error('Apollo API key not found in user settings or environment');
  }

  console.log(`🔑 [Apollo] API Key check: Present (${apiKey.substring(0, 10)}...)`);
  
  // EXPERIMENTAL: Extract target positions from YOUR settings structure (not nested contactCriteria)
  const targetPositions = leadContactSettings?.targetPositions || [];
  
  let apolloQuery = targetPositions[0] || 'CEO'; // Use first target position from user settings
  let industry = '';
  let position = targetPositions[0] || 'CEO'; // fallback to generic position
  
  console.log(`[EXPERIMENTAL] 🔧 Fixed settings extraction - found ${targetPositions.length} positions:`, targetPositions);
  
  // Use target positions from user settings instead of hardcoded tech positions
  for (const targetPos of targetPositions) {
    if (query.includes(targetPos)) {
      position = targetPos;
      apolloQuery = targetPos;
      break;
    }
  }
  
  console.log(`[LEAD RESEARCH] Using target positions from settings:`, targetPositions);
  console.log(`[LEAD RESEARCH] Selected position for search:`, position);
  
  // Use cached result if available - but include position in cache key for proper deduplication
  const cacheKey = `${query}_${apolloQuery}_${Math.floor(Date.now() / 3600000)}`; // Cache per hour per unique query+position
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    console.log('[CACHE] Using cached result for:', query);
    return cachedResult;
  }

  try {
    // EXPERIMENTAL: Extract industry from YOUR settings structure (not nested companyCriteria)  
    const targetIndustries = leadContactSettings?.companyIndustries || [];
    
    console.log(`[EXPERIMENTAL] 🔧 Fixed industry extraction - found ${targetIndustries.length} industries:`, targetIndustries);
    
    // Use first target industry from user settings, or try to match from query
    industry = '';
    for (const targetIndustry of targetIndustries) {
      if (query.toLowerCase().includes(targetIndustry.toLowerCase())) {
        industry = targetIndustry;
        break;
      }
    }
    
    // If no industry match found, use the first target industry
    if (!industry && targetIndustries.length > 0) {
      industry = targetIndustries[0];
    }
    
    console.log(`[LEAD RESEARCH] Using target industries from settings:`, targetIndustries);
    console.log(`[LEAD RESEARCH] Selected industry for search:`, industry);
    
    // EXPERIMENTAL: Build flexible search query for better results
    if (industry && position !== 'CTO') {
      // Try position first, then add industry as secondary filter
      apolloQuery = position;
      console.log(`[EXPERIMENTAL] 🎯 Using position-focused search: "${position}" with industry filter`);
    } else if (industry) {
      apolloQuery = position;
      console.log(`[EXPERIMENTAL] 🎯 Using position-only search: "${position}"`);
    } else {
      apolloQuery = position;
    }

    console.log(`🎯 [Apollo] Searching for leads: ${apolloQuery}`);
    
    // EXPERIMENTAL: Extract location and company size from YOUR settings structure
    const targetLocations = leadContactSettings?.targetLocations || [];
    let location = targetLocations;
    
    // Extract company size from YOUR settings structure (not nested)
    let companySizeMin = leadContactSettings?.companySizeMin || null;
    let companySizeMax = leadContactSettings?.companySizeMax || null;
    
    console.log(`[EXPERIMENTAL] 🔧 Fixed location extraction:`, targetLocations);
    console.log(`[EXPERIMENTAL] 🔧 Fixed company size extraction: ${companySizeMin}-${companySizeMax}`);
    
    console.log(`[LEAD RESEARCH] Using target locations from settings:`, location);
    console.log(`[LEAD RESEARCH] Using company size range from settings:`, `${companySizeMin}-${companySizeMax}`);
    
    // HARDCODED: Build Apollo search payload with proper filters - CANNOT BE EDITED OUT
    const searchPayload = {
      q_keywords: apolloQuery,
      page: 1,
      per_page: Math.min(limit * 2, 10) // Get more results for deduplication
    };
    
    // Add location filter if specified
    if (location.length > 0) {
      searchPayload.person_locations = location;
    }
    
    // EXPERIMENTAL: Make company size filter broader for testing
    if (companySizeMin && companySizeMax) {
      // Broaden the range for better results
      const broadMin = Math.max(100, Math.floor(companySizeMin * 0.5)); // 50% lower
      const broadMax = Math.min(10000, Math.floor(companySizeMax * 2)); // 2x higher
      searchPayload.organization_num_employees_ranges = [`${broadMin},${broadMax}`];
      console.log(`[EXPERIMENTAL] 🎯 Broadened company size: ${companySizeMin}-${companySizeMax} → ${broadMin}-${broadMax}`);
    }
    
    // Add industry filter based on the industry we detected
    if (industry) {
      if (industry === 'fast food') {
        searchPayload.q_organization_keyword_tags = ['restaurants', 'fast food', 'quick service restaurant'];
      } else if (industry === 'luxury clothing') {
        searchPayload.q_organization_keyword_tags = ['luxury', 'fashion', 'apparel', 'clothing'];
      } else if (industry === 'grocery') {
        searchPayload.q_organization_keyword_tags = ['grocery', 'supermarket', 'retail food'];
      } else if (industry === 'catering') {
        searchPayload.q_organization_keyword_tags = ['catering', 'food service', 'event catering'];
      } else if (industry === 'food') {
        searchPayload.q_organization_keyword_tags = ['food', 'food service', 'restaurants'];
      }
    }
    
    console.log(`🔍 [Apollo] Search payload:`, JSON.stringify(searchPayload, null, 2));
    
    // Apollo People Search API with enhanced filters
    const apolloUrl = 'https://api.apollo.io/v1/mixed_people/search';
    const response = await fetch(apolloUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      console.error(`Apollo API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Apollo API error response: ${errorText}`);
      return [];
    }

    const data = await response.json();
    console.log(`🔍 [Apollo] Raw API response: Found ${data.people?.length || 0} people in response`);
    
    if (data.people?.[0]) {
      console.log(`🔍 [Apollo] Sample person data:`, JSON.stringify(data.people[0], null, 2));
    }

    if (data.people && data.people.length > 0) {
      // HARDCODED DEDUPLICATION - CANNOT BE EDITED OUT
      // Remove duplicates based on company name and person name to prevent 37signals repetition
      const seen = new Set();
      const uniquePeople = data.people.filter(person => {
        const key = `${person.organization?.name}_${person.name}`.toLowerCase();
        if (seen.has(key)) {
          console.log(`🔄 [Apollo] Skipping duplicate: ${person.name} at ${person.organization?.name}`);
          return false;
        }
        seen.add(key);
        return true;
      });
      
      console.log(`🎯 [Apollo] Filtered ${data.people.length} → ${uniquePeople.length} unique leads`);
      
      // Enrich emails for limited subset of people - stop when we have enough
      const peopleToEnrich = uniquePeople.slice(0, limit); // Use the actual limit requested
      console.log(`🔓 [Apollo] Enriching emails for ${peopleToEnrich.length} people (out of ${uniquePeople.length} unique found)...`);
      const enrichedPeople = [];
      
      for (const person of peopleToEnrich) {
        try {
          // Stop enriching if we already have enough good leads
          if (enrichedPeople.length >= 5) {
            console.log(`✋ [Apollo] Already have ${enrichedPeople.length} leads with emails, stopping enrichment to save credits`);
            break;
          }
          
          const enrichedEmail = await enrichPersonEmail(person, apiKey);
          if (enrichedEmail && enrichedEmail !== 'email_not_unlocked@domain.com') {
            console.log(`✅ [Apollo] Got real email for ${person.name}: ${enrichedEmail}`);
            enrichedPeople.push({
              ...person,
              email: enrichedEmail,
              source: 'Apollo'
            });
          } else {
            console.log(`⚠️ [Apollo] No email found for ${person.name}, skipping...`);
          }
        } catch (error) {
          console.error(`❌ [Apollo] Failed to enrich email for ${person.name}:`, error.message);
        }
      }

      console.log(`✅ [Apollo] Found ${enrichedPeople.length} lead results (Apollo source)`);
      
      // Cache the result
      cacheResult(cacheKey, enrichedPeople);
      
      return enrichedPeople;
    }

    return [];
  } catch (error) {
    console.error('[Apollo] Search error:', error.message);
    return [];
  }
}

// Email enrichment using Apollo /people/match endpoint
async function enrichPersonEmail(person, apiKey) {
  try {
    const enrichResponse = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({
        first_name: person.first_name,
        last_name: person.last_name,
        organization_name: person.organization?.name,
        domain: person.organization?.primary_domain
      })
    });

    if (enrichResponse.ok) {
      const enrichData = await enrichResponse.json();
      if (enrichData.person && enrichData.person.email) {
        const email = enrichData.person.email;
        if (email && email !== 'email_not_unlocked@domain.com') {
          return email;
        }
      }
    }
  } catch (error) {
    console.error(`[Apollo] Email enrichment error for ${person.name}:`, error.message);
  }
  
  return null;
}

// Simple caching
const cache = new Map();

function getCachedResult(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
    return cached.data;
  }
  return null;
}

function cacheResult(key, data) {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
}

// Enhanced person research for detailed profile information
async function gatherPersonInfo(lead, userId = null) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim();
  const company = lead.organization?.name || lead.company;
  const title = lead.title;
  
  console.log(`👤 [PERSON RESEARCH] Gathering detailed info for: ${fullName} at ${company}`);
  
  try {
    // Search for person's professional information
    const searchQueries = [
      `"${fullName}" "${company}" position tenure experience`,
      `"${fullName}" linkedin "${company}" "${title}"`,
      `"${fullName}" "${company}" years experience started`,
      `"${fullName}" professional background "${company}" career`
    ];
    
    const personInfo = {
      fullName: fullName,
      currentPosition: title,
      company: company,
      tenure: null,
      startDate: null,
      experience: null,
      bio: null,
      education: null,
      previousRoles: []
    };
    
    for (const query of searchQueries) {
      try {
        const searchResults = await internetSearch(query, { maxResults: 3 });
        
        if (searchResults && searchResults.length > 0) {
          // Use AI to extract person information from search results
          const extractionPrompt = `
            Extract specific professional information about ${fullName} at ${company} from these search results:
            
            ${searchResults.map(r => `Title: ${r.title}\nContent: ${r.content}`).join('\n\n')}
            
            Focus on extracting:
            1. How long they've been at ${company} (tenure in months/years)
            2. When they started at ${company} (specific date if available)
            3. Their exact current position/title
            4. Years of total professional experience
            5. Brief professional background/bio
            6. Education background
            7. Previous roles/companies
            
            Return a JSON object with these fields:
            {
              "tenure": "X years Y months" or "X months" or null,
              "startDate": "YYYY-MM" or "YYYY" or null,
              "experience": "X years total experience" or null,
              "bio": "Brief professional summary" or null,
              "education": "Education details" or null,
              "previousRoles": ["Previous Company - Role", ...] or []
            }
            
            Only include information that is explicitly stated. Use null for missing data.
          `;
          
          const llm = new (await import("@langchain/openai")).ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
            modelName: "gpt-4o"
          });
          
          const response = await llm.invoke(extractionPrompt);
          const extractedInfo = JSON.parse(response.content);
          
          // Merge extracted information
          if (extractedInfo.tenure) personInfo.tenure = extractedInfo.tenure;
          if (extractedInfo.startDate) personInfo.startDate = extractedInfo.startDate;
          if (extractedInfo.experience) personInfo.experience = extractedInfo.experience;
          if (extractedInfo.bio) personInfo.bio = extractedInfo.bio;
          if (extractedInfo.education) personInfo.education = extractedInfo.education;
          if (extractedInfo.previousRoles && extractedInfo.previousRoles.length > 0) {
            personInfo.previousRoles = [...personInfo.previousRoles, ...extractedInfo.previousRoles];
          }
        }
      } catch (error) {
        console.log(`⚠️ [PERSON RESEARCH] Search failed for query: ${query.substring(0, 50)}...`);
      }
    }
    
    // If we couldn't find tenure info, try to estimate based on LinkedIn or other signals
    if (!personInfo.tenure && lead.linkedin_url) {
      try {
        const linkedinQuery = `"${fullName}" linkedin "${company}" "joined" OR "started" years`;
        const linkedinResults = await internetSearch(linkedinQuery, { maxResults: 2 });
        
        if (linkedinResults && linkedinResults.length > 0) {
          const estimationPrompt = `
            Based on these search results about ${fullName} at ${company}, estimate their tenure:
            
            ${linkedinResults.map(r => r.content).join('\n')}
            
            Provide just the estimated tenure like "2 years" or "6 months" or "unknown" if no clues available.
          `;
          
          const llm = new (await import("@langchain/openai")).ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
            modelName: "gpt-4o"
          });
          
          const tenureResponse = await llm.invoke(estimationPrompt);
          if (tenureResponse.content && !tenureResponse.content.includes('unknown')) {
            personInfo.tenure = tenureResponse.content.trim();
          }
        }
      } catch (error) {
        console.log(`⚠️ [PERSON RESEARCH] LinkedIn tenure estimation failed`);
      }
    }
    
    console.log(`✅ [PERSON RESEARCH] Gathered info for ${fullName}: ${personInfo.tenure || 'tenure unknown'} at ${company}`);
    return personInfo;
    
  } catch (error) {
    console.error(`❌ [PERSON RESEARCH] Error gathering person info:`, error);
    return {
      fullName: fullName,
      currentPosition: title,
      company: company,
      tenure: null,
      startDate: null,
      experience: null,
      bio: null,
      education: null,
      previousRoles: []
    };
  }
}

// Export functions for use by other modules
export { enrichLeadWithIntelligence, extractSalesInsights, buildSalesProfile, calculateConfidenceScore };
