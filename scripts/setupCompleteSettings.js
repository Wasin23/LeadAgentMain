import AWSManager from '../utils/awsManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupCompleteSettings() {
  console.log('🔧 Setting up complete AWS settings for ExaMark...');
  
  const awsManager = new AWSManager();
  const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411'; // Your user ID
  
  const completeSettings = {
    companyBranding: {
      agentName: "ActionBot",
      companyName: "ActionTrac", 
      agentTitle: "AI Assistant",
      primaryService: "Employee Text Messaging & HR Communication Platform integrated with ADP Workforce Now",
      coreOffering: "Text messaging platform that is integrated to the leading HRIS firms like ADP and Paylocity to automate shift reminders, policy updates, emergency alerts, and HR communications",
      keyAdvantages: "Seamless integration to leading HRIS companies like ADP and Paylocity, instant employee reach via SMS, automated HR workflows, real-time emergency notifications, higher engagement than email",
      expertiseArea: "HR Technology & Workforce Management, Employee Communication & Engagement, Compliance & Regulatory Requirements, Mobile Workforce Solutions, Emergency Response & Business Continuity",
      companyWebsite: "",
      companyDescription: ""
    },
    companyCriteria: {
      companySizeMin: 200,
      companySizeMax: 3000,
      companyIndustries: [
        "e-commerce",
        "fashion", 
        "healthcare",
        "medical",
        "financial services",
        "insurance"
      ],
      excludedCompanies: [],
      companyKeywords: []
    },
    contactCriteria: {
      targetPositions: [
        "HR Manager",
        "Human Resources Manager",
        "HR Director", 
        "Sales Director",
        "CEO",
        "Chief Executive Officer",
        "Founder"
      ],
      seniorityLevel: "senior",
      excludedTitles: [],
      contactKeywords: []
    },
    geographicSettings: {
      targetLocations: [
        "United States"
      ],
      excludedLocations: [],
      leadLimit: 50,
      timezone: "UTC"
    },
    advancedCriteria: {
      fundingStage: "established",
      fundingAmount: "",
      growthStage: "any",
      technologiesUsed: [],
      recentNews: false
    },
    researchFocus: {
      focusAreas: [
        "- Employee communication challenges and workforce management inefficiencies\n- HR technology adoption and need for automated messaging solutions\n- ADP Workforce Now integration opportunities and existing users\n- Companies struggling with timely employee notifications and alerts\n- Shift scheduling communication problems and manual processes\n- Employee engagement issues and internal communication gaps\n- Policy distribution challenges and emergency notification needs\n- Growing workforce requiring scalable HR communication tools\n- Multi-location businesses needing centralized employee messaging\n- Industries with high employee turnover requiring better onboarding communication"
      ],
      researchDepth: "standard", 
      includeCompanyNews: false,
      includePersonalInfo: false,
      includeSocialMedia: false
    },
    emailBuilder: {
      emailTemplate: "professional",
      customPrompt: "You are {{AGENT_NAME}}, the AI assistant for {{COMPANY_NAME}}. Generate a HIGHLY INTELLIGENT, research-based marketing email for the following prospect:\n\nCompany: {{TARGET_COMPANY}}\nContact: {{CONTACT_NAME}}\nTitle: {{CONTACT_TITLE}}\nIndustry: {{INDUSTRY}}\nCompany Description: {{COMPANY_DESCRIPTION}}\nEmployee Count: {{EMPLOYEE_COUNT}}\n\nABOUT {{COMPANY_NAME}}:\n- Specializes in {{PRIMARY_SERVICE}}\n- Core offering: {{CORE_OFFERING}}\n- Key advantages: {{KEY_ADVANTAGES}}\n- Industry expertise: {{EXPERTISE_AREA}}\n\nYOUR TASK - BE A SMART SALESPERSON:\nGenerate a professional email that demonstrates you've done your homework:\n\n1. Subject line that references specific company context (growth, funding, initiatives, etc.)\n2. Opening with SINGLE greeting only (Hi [Name], or Hello [Name], - NOT BOTH)\n3. Connect their specific situation to {{COMPANY_NAME}} solutions with LOGICAL REASONING\n4. Explain WHY your solution specifically fits their company's needs\n5. Professional call-to-action\n6. Simple signature: \"Best regards,\\n{{AGENT_NAME}}\\n{{COMPANY_NAME}} {{AGENT_TITLE}}\"\n\nCRITICAL RULES:\n- Use ONLY ONE greeting (not \"Hello Name, Hi Name,\")\n- NO \"P.S.\" sections about founders\n- DO NOT repeat the subject line in the email body\n- DO NOT use placeholder text like \"your full name\" or \"your position\"\n- Sign simply as \"{{AGENT_NAME}}\" - no placeholder names\n- EXPLAIN the logical connection between their business and your solutions\n- Reference specific research insights when available\n- Focus on business value, not just features\n- DO NOT mention company founding date, location, or founders unless directly relevant\n- Keep focus on solutions and business outcomes\n\nKeep it concise (under 200 words), professional, and data-driven. Show you understand their business.\n\nIMPORTANT FORMATTING:\n- The BODY should NOT contain the subject line\n- Start the BODY directly with the greeting\n- End with the signature shown above\n\nFormat as:\nSUBJECT: [subject line]\nBODY: [email body starting with greeting, ending with signature]",
      tone: "professional",
      length: "medium", 
      callToAction: "meeting",
      personalization: "high"
    },
    updatedAt: new Date().toISOString(),
    version: "2.0"
  };
  
  try {
    console.log('💾 Saving complete settings to AWS...');
    await awsManager.saveLeadAgentSettings(userId, completeSettings);
    console.log('✅ Complete settings saved successfully!');
    
    console.log('📖 Verifying settings...');
    const retrieved = await awsManager.getLeadAgentSettings(userId);
    
    console.log('✅ Verification complete!');
    console.log('🏢 Company:', retrieved?.companyBranding?.companyName);
    console.log('🤖 Agent:', retrieved?.companyBranding?.agentName);
    console.log('🎯 Target Positions:', retrieved?.contactCriteria?.targetPositions?.length);
    console.log('🏭 Industries:', retrieved?.companyCriteria?.companyIndustries?.length);
    console.log('📧 Email Template:', retrieved?.emailBuilder?.emailTemplate);
    console.log('🎨 Email Tone:', retrieved?.emailBuilder?.tone);
    
    console.log('\n🎉 Complete settings are now in AWS! The UI should work properly now.');
    
  } catch (error) {
    console.error('❌ Error setting up complete settings:', error);
  }
}

setupCompleteSettings();