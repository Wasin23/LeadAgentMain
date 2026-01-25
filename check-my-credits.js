import { config } from 'dotenv';
import AWSManager from './utils/awsManager.js';

config();

const awsManager = new AWSManager();

async function checkCredits() {
  try {
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638'; // Your user ID
    
    console.log('🔍 Checking credits for user:', userId);
    
    const user = await awsManager.getUserById(userId);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('\n💳 CREDIT STATUS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Credit Balance:', user.creditBalance || 0);
    console.log('Trial Credits:', user.trialCredits || 0);
    console.log('Plan:', user.plan || 'none');
    console.log('Total API Cost:', user.totalApiCost || 0);
    console.log('Payment Method Added:', user.paymentMethodAdded || false);
    console.log('\n💰 VALUE:');
    console.log('Total Credits:', (user.creditBalance || 0) + (user.trialCredits || 0));
    console.log('Credit Value: $' + ((user.creditBalance || 0) + (user.trialCredits || 0)) * 0.05);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ Error checking credits:', error.message);
  }
}

checkCredits();