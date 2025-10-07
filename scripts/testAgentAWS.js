import { getUserAgent } from '../agent/reasoningLeadAgent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAgentAWSIntegration() {
  console.log('🔍 Testing if ReasoningLeadAgent uses AWS...');
  
  try {
    // Get user agent instance (this should initialize AWS Manager)
    const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
    console.log('🤖 Getting user agent instance...');
    
    const agent = getUserAgent(userId);
    console.log('✅ Agent instance created');
    
    // Test getting settings (should show AWS logs)
    console.log('\n📋 Testing getUserSettings() - should show AWS logs:');
    const settings = await agent.getUserSettings();
    
    if (settings && !settings.error) {
      console.log('✅ Settings retrieved successfully!');
      console.log('🏢 Company:', settings.companyName);
      console.log('🤖 Agent:', settings.agentName);
      console.log('🎯 Target Positions:', settings.targetPositions?.length || 0);
      
      // Check if this looks like AWS data vs Zilliz
      if (settings.companyName === 'ActionTrac') {
        console.log('🎉 SUCCESS: Agent is using AWS data!');
      } else {
        console.log('⚠️  WARNING: Agent might be using old Zilliz data');
      }
    } else {
      console.log('❌ Failed to get settings:', settings?.error);
    }
    
    console.log('\n📧 Testing getEmailSettings() - should show AWS logs:');
    const emailSettings = await agent.getEmailSettings();
    
    if (emailSettings && !emailSettings.error) {
      console.log('✅ Email settings retrieved successfully!');
      console.log('📧 Template:', emailSettings.template);
      console.log('🎨 Tone:', emailSettings.tone);
    } else {
      console.log('❌ Failed to get email settings:', emailSettings?.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.message?.includes('zilliz') || error.message?.includes('Zilliz')) {
      console.log('🔍 ERROR indicates Zilliz usage - AWS migration incomplete!');
    } else {
      console.log('🔍 Error type:', error.name);
    }
  }
}

testAgentAWSIntegration();