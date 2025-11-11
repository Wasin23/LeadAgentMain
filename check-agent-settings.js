import 'dotenv/config';
import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function checkAgentSettings() {
  try {
    const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
    
    console.log(`\n🔍 Checking user: ${userId}\n`);
    
    // First get the user to find their agents
    const userData = await awsManager.getUserById(userId);
    
    if (!userData) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', userData.username || userData.email);
    
    const agents = userData.activeAgents || [];
    console.log(`📊 Total Agents: ${agents.length}\n`);
    
    if (agents.length === 0) {
      console.log('No agents found');
      return;
    }
    
    // Check each agent's settings
    for (const agent of agents) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🤖 Agent: ${agent.name} (ID: ${agent.agentId})`);
      console.log(`${'='.repeat(60)}`);
      
      // Get agent settings
      const settings = await awsManager.getLeadAgentSettings(userId, agent.agentId);
      
      if (!settings) {
        console.log('❌ No settings found for this agent');
        continue;
      }
      
      console.log('\n📋 Applied Preset:', settings.appliedPresetName || 'None');
      console.log('   Preset ID:', settings.appliedPresetId || 'None');
      
      console.log('\n🏢 Company Criteria:');
      console.log('   Industries:', settings.companyCriteria?.companyIndustries || 'Not set');
      console.log('   Size Min:', settings.companyCriteria?.companySizeMin || 'Not set');
      console.log('   Size Max:', settings.companyCriteria?.companySizeMax || 'Not set');
      
      console.log('\n👥 Contact Criteria:');
      console.log('   Positions:', settings.contactCriteria?.targetPositions || 'Not set');
      
      console.log('\n🌍 Geographic Settings:');
      console.log('   Lead Limit:', settings.geographicSettings?.leadLimit || 'Not set');
      
      console.log('\n🎨 Company Branding:');
      console.log('   Agent Name:', settings.companyBranding?.agentName || 'Not set');
      console.log('   Company Name:', settings.companyBranding?.companyName || 'Not set');
      console.log('   Core Offering:', settings.companyBranding?.coreOffering || 'Not set');
    }
    
  } catch (error) {
    console.error('❌ Error checking agent settings:', error);
  }
}

checkAgentSettings();
