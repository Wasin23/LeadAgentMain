import AWSManager from '../utils/awsManager.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testAWSConnection() {
  console.log('🔧 Testing AWS connection and services...');
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  
  try {
    const awsManager = new AWSManager();
    
    // Test AWS connectivity
    console.log('\n1️⃣ Testing AWS connectivity...');
    const healthCheck = await awsManager.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      console.log('✅ AWS connection successful!');
      console.log('📊 Health check:', healthCheck);
    } else {
      console.log('❌ AWS connection failed:', healthCheck.error);
      return false;
    }
    
    // Test DynamoDB operations (create a test user)
    console.log('\n2️⃣ Testing DynamoDB operations...');
    const testUserId = 'test-user-' + Date.now();
    const testSettings = {
      companyBranding: {
        agentName: 'Test Agent',
        companyName: 'Test Company'
      },
      contactCriteria: {
        targetPositions: ['CEO', 'CTO'],
        seniorityLevel: 'senior'
      },
      version: '2.0'
    };
    
    // Save test settings
    console.log('💾 Saving test settings...');
    await awsManager.saveLeadAgentSettings(testUserId, testSettings);
    
    // Retrieve test settings  
    console.log('📖 Retrieving test settings...');
    const retrievedSettings = await awsManager.getLeadAgentSettings(testUserId);
    
    if (retrievedSettings && retrievedSettings.companyBranding.agentName === 'Test Agent') {
      console.log('✅ DynamoDB operations successful!');
      console.log('📋 Retrieved settings:', {
        agentName: retrievedSettings.companyBranding.agentName,
        companyName: retrievedSettings.companyBranding.companyName,
        targetPositions: retrievedSettings.contactCriteria.targetPositions
      });
    } else {
      console.log('❌ DynamoDB test failed - settings not retrieved correctly');
      return false;
    }
    
    console.log('\n✅ All AWS tests passed! ExaMark is ready to use AWS services.');
    return true;
    
  } catch (error) {
    console.error('❌ AWS test failed:', error);
    
    if (error.name === 'CredentialsProviderError') {
      console.log('\n🔑 AWS Credentials Issue:');
      console.log('   Please configure AWS credentials using one of these methods:');
      console.log('   1. Set environment variables:');
      console.log('      AWS_ACCESS_KEY_ID=your_key_here');
      console.log('      AWS_SECRET_ACCESS_KEY=your_secret_here');
      console.log('   2. Create ~/.aws/credentials file');
      console.log('   3. Use AWS IAM roles (for EC2/Lambda)');
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('\n🗄️  DynamoDB Table Missing:');
      console.log('   Run: node scripts/createDynamoDBTables.js');
      console.log('   Or check that tables exist in AWS Console');
    } else {
      console.log('\n🔍 Debug info:');
      console.log('   Error type:', error.name);
      console.log('   Error message:', error.message);
    }
    
    return false;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testAWSConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default testAWSConnection;