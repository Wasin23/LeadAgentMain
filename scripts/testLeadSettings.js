import AWSManager from '../utils/awsManager.js';

const awsManager = new AWSManager();
const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';

console.log('🔍 Testing lead agent settings from AWS DynamoDB...');
console.log('User ID:', userId);
console.log('');

async function testSettings() {
  try {
    const settings = await awsManager.getLeadAgentSettings(userId);
    
    if (settings) {
      console.log('✅ Settings found!');
      console.log('');
      console.log('📊 Company Branding:');
      console.log('  Company:', settings.companyBranding?.companyName);
      console.log('  Agent:', settings.companyBranding?.agentName);
      console.log('  Service:', settings.companyBranding?.primaryService);
      console.log('  Core Offering:', settings.companyBranding?.coreOffering);
      console.log('');
      console.log('🏢 Company Criteria:');
      console.log('  Size:', `${settings.companyCriteria?.companySizeMin}-${settings.companyCriteria?.companySizeMax}`);
      console.log('  Industries:', settings.companyCriteria?.companyIndustries?.length || 0);
      console.log('  Industries list:', settings.companyCriteria?.companyIndustries);
      console.log('');
      console.log('👤 Contact Criteria:');
      console.log('  Positions:', settings.contactCriteria?.targetPositions?.length || 0);
      console.log('  Positions list:', settings.contactCriteria?.targetPositions);
      console.log('  Seniority Level:', settings.contactCriteria?.seniorityLevel);
      console.log('');
      console.log('🌍 Geographic Settings:');
      console.log('  Locations:', settings.geographicSettings?.targetLocations);
      console.log('  Lead Limit:', settings.geographicSettings?.leadLimit);
      console.log('  Timezone:', settings.geographicSettings?.timezone);
      console.log('');
      console.log('🔍 Research Focus:');
      console.log('  Research Depth:', settings.researchFocus?.researchDepth);
      console.log('  Focus Areas:', settings.researchFocus?.focusAreas?.length || 0);
      console.log('  Include Company News:', settings.researchFocus?.includeCompanyNews);
      console.log('');
      console.log('📧 Email Builder:');
      console.log('  Template:', settings.emailBuilder?.emailTemplate);
      console.log('  Tone:', settings.emailBuilder?.tone);
      console.log('  Length:', settings.emailBuilder?.length);
      console.log('  Personalization:', settings.emailBuilder?.personalization);
      console.log('  Call to Action:', settings.emailBuilder?.callToAction);
      console.log('  Has Custom Prompt:', !!settings.emailBuilder?.customPrompt);
      console.log('');
      console.log('🔧 Advanced Criteria:');
      console.log('  Funding Stage:', settings.advancedCriteria?.fundingStage);
      console.log('  Growth Stage:', settings.advancedCriteria?.growthStage);
      console.log('  Recent News:', settings.advancedCriteria?.recentNews);
      console.log('');
      console.log('📅 Metadata:');
      console.log('  Version:', settings.version);
      console.log('  Updated At:', settings.updatedAt);
      
    } else {
      console.log('❌ No settings found for this user');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSettings();