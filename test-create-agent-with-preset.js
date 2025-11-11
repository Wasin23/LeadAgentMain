// Test agent creation with preset to see backend logs
import dotenv from 'dotenv';
import awsManager from './utils/awsManager.js';

dotenv.config();

async function testAgentCreation() {
  const awsManagerInstance = new awsManager();
  const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
  
  try {
    console.log('📋 Fetching user agents...');
    const user = await awsManagerInstance.getUserById(userId);
    
    if (!user || !user.activeAgents || user.activeAgents.length === 0) {
      console.log('❌ No agents found');
      return;
    }
    
    // Get the most recently created agent
    const agents = user.activeAgents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const latestAgent = agents[0];
    console.log('\n🤖 Latest Agent:', {
      id: latestAgent.agentId,
      name: latestAgent.name,
      createdAt: latestAgent.createdAt
    });
    
    // Fetch settings for this agent
    console.log('\n📥 Fetching settings...');
    const settings = await awsManagerInstance.getLeadAgentSettings(userId, latestAgent.agentId);
    
    console.log('\n✅ Agent Settings:');
    console.log('  Applied Preset ID:', settings.appliedPresetId || 'NOT SET');
    console.log('  Applied Preset Name:', settings.appliedPresetName || 'NOT SET');
    console.log('\n🏢 Company Criteria:');
    console.log('  Industries:', settings.companyCriteria?.companyIndustries || 'NOT SET');
    console.log('  Size Min:', settings.companyCriteria?.companySizeMin || 'NOT SET');
    console.log('  Size Max:', settings.companyCriteria?.companySizeMax || 'NOT SET');
    console.log('\n👥 Contact Criteria:');
    console.log('  Positions:', settings.contactCriteria?.targetPositions || 'NOT SET');
    console.log('\n🌍 Geographic Settings:');
    console.log('  Lead Limit:', settings.geographicSettings?.leadLimit || 'NOT SET');
    console.log('\n🎨 Company Branding:');
    console.log('  Company Name:', settings.companyBranding?.companyName);
    console.log('  Core Offering:', settings.companyBranding?.coreOffering);
    console.log('  Key Advantages:', settings.companyBranding?.keyAdvantages);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAgentCreation();
