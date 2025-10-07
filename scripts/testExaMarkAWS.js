import AWSManager from '../utils/awsManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function testExaMarkAWS() {
  console.log('🚀 Testing ExaMark AWS Integration...\n');
  
  try {
    // Initialize AWS Manager
    const awsManager = new AWSManager();
    
    // Test 1: Create test user settings
    console.log('1️⃣ Testing lead agent settings...');
    const testUserId = '76e84c79-9b13-4c55-be86-d0bd9baa9411'; // Your actual user ID
    
    const testSettings = {
      companyBranding: {
        agentName: 'ActionBot',
        companyName: 'ActionTrac',
        agentTitle: 'AI Assistant'
      },
      contactCriteria: {
        targetPositions: ['CEO', 'CTO', 'HR Manager'],
        seniorityLevel: 'senior'
      },
      geographicSettings: {
        targetLocations: ['United States'],
        leadLimit: 50
      },
      version: '2.0'
    };
    
    console.log('💾 Saving test settings...');
    await awsManager.saveLeadAgentSettings(testUserId, testSettings);
    console.log('✅ Settings saved!');
    
    console.log('📖 Retrieving settings...');
    const retrieved = await awsManager.getLeadAgentSettings(testUserId);
    console.log('✅ Settings retrieved!');
    console.log('📋 Agent Name:', retrieved?.companyBranding?.agentName);
    console.log('📋 Target Positions:', retrieved?.contactCriteria?.targetPositions);
    
    if (retrieved?.companyBranding?.agentName === 'ActionBot') {
      console.log('🎉 AWS DynamoDB integration working perfectly!');
    } else {
      console.log('❌ Settings not retrieved correctly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testExaMarkAWS();