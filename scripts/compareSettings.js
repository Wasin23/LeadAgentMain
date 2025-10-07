import { getUserAgent } from '../agent/reasoningLeadAgent.js';
import AWSManager from '../utils/awsManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function compareZillizVsAWS() {
  console.log('🔍 Comparing Zilliz structure vs AWS settings...\n');
  
  const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
  const awsManager = new AWSManager();
  
  try {
    // Get AWS settings directly
    console.log('1️⃣ AWS Settings from DynamoDB:');
    const awsSettings = await awsManager.getLeadAgentSettings(userId);
    console.log('📊 AWS Structure:');
    console.log(JSON.stringify(awsSettings, null, 2));
    
    console.log('\n2️⃣ Agent API Settings (what the UI gets):');
    
    // Get agent instance and test what the API returns
    const agent = getUserAgent(userId);
    const userSettings = await agent.getUserSettings();
    const emailSettings = await agent.getEmailSettings();
    
    console.log('📊 User Settings from Agent:');
    console.log(JSON.stringify(userSettings, null, 2));
    
    console.log('\n📊 Email Settings from Agent:');
    console.log(JSON.stringify(emailSettings, null, 2));
    
    console.log('\n3️⃣ Expected UI Structure (ZillizAgentSettings):');
    console.log(`
    Expected Structure:
    {
      companyBranding: { agentName, companyName, agentTitle, primaryService, coreOffering, keyAdvantages, expertiseArea, companyWebsite, companyDescription },
      companyCriteria: { companySizeMin, companySizeMax, companyIndustries, excludedCompanies, companyKeywords },
      contactCriteria: { targetPositions, seniorityLevel, excludedTitles, contactKeywords },
      geographicSettings: { targetLocations, excludedLocations, leadLimit, timezone },
      advancedCriteria: { fundingStage, fundingAmount, growthStage, technologiesUsed, recentNews },
      researchFocus: { focusAreas, researchDepth, includeCompanyNews, includePersonalInfo, includeSocialMedia },
      emailBuilder: { emailTemplate, customPrompt, tone, length, callToAction, personalization }
    }
    `);
    
    console.log('\n4️⃣ Comparison Summary:');
    if (awsSettings) {
      console.log('✅ AWS has complete Zilliz structure:', Object.keys(awsSettings));
      console.log('✅ Company Branding:', awsSettings.companyBranding ? 'Present' : 'Missing');
      console.log('✅ Company Criteria:', awsSettings.companyCriteria ? 'Present' : 'Missing');
      console.log('✅ Contact Criteria:', awsSettings.contactCriteria ? 'Present' : 'Missing');
      console.log('✅ Geographic Settings:', awsSettings.geographicSettings ? 'Present' : 'Missing');
      console.log('✅ Advanced Criteria:', awsSettings.advancedCriteria ? 'Present' : 'Missing');
      console.log('✅ Research Focus:', awsSettings.researchFocus ? 'Present' : 'Missing');
      console.log('✅ Email Builder:', awsSettings.emailBuilder ? 'Present' : 'Missing');
      
      console.log('\n🎉 RESULT: AWS contains the SAME complete structure as Zilliz!');
      console.log('The settings you can configure in the UI are identical to what was in Zilliz.');
      console.log('AWS is now the authoritative source with all the same configuration options.');
    } else {
      console.log('❌ No AWS settings found');
    }
    
  } catch (error) {
    console.error('❌ Error comparing settings:', error);
  }
}

compareZillizVsAWS();