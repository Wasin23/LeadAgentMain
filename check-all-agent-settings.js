import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const awsManager = new AWSManager();
const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';

async function checkAllAgentSettings() {
  try {
    console.log('🔍 Checking all agent settings for user:', userId);
    console.log('='.repeat(80));
    
    // Get user to see all active agents
    const user = await awsManager.getUserById(userId);
    const agents = user.activeAgents || [];
    
    console.log(`\n📊 Found ${agents.length} active agents\n`);
    
    for (const agent of agents) {
      console.log(`\n🤖 Agent: ${agent.name} (ID: ${agent.agentId})`);
      console.log('-'.repeat(80));
      
      // Get agent settings
      const settings = await awsManager.getLeadAgentSettings(userId, agent.agentId);
      
      if (!settings) {
        console.log('⚠️  No settings found in database');
        continue;
      }
      
      console.log('\n✅ Agent Settings Found:');
      console.log('  Applied Preset ID:', settings.appliedPresetId || 'NOT SET');
      console.log('  Applied Preset Name:', settings.appliedPresetName || 'NOT SET');
      
      console.log('\n🏢 Company Criteria:');
      console.log('  Industries:', settings.companyCriteria?.companyIndustries || []);
      console.log('  Size Min:', settings.companyCriteria?.companySizeMin || 'NOT SET');
      console.log('  Size Max:', settings.companyCriteria?.companySizeMax || 'NOT SET');
      console.log('  Keywords:', settings.companyCriteria?.companyKeywords || []);
      
      console.log('\n👥 Contact Criteria:');
      console.log('  Target Positions:', settings.contactCriteria?.targetPositions || []);
      
      console.log('\n🌍 Geographic Settings:');
      console.log('  Lead Limit:', settings.geographicSettings?.leadLimit || 'NOT SET');
      
      console.log('\n🎨 Company Branding:');
      console.log('  Company Name:', settings.companyBranding?.companyName || 'NOT SET');
      console.log('  Core Offering:', settings.companyBranding?.coreOffering || 'NOT SET');
      
      console.log('\n' + '='.repeat(80));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllAgentSettings();
