import 'dotenv/config';
import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function listUsers() {
  try {
    console.log('📋 [LIST USERS] Fetching all registered users...\n');
    
    const users = await awsManager.getAllUsers();
    
    if (!users || users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    console.log(`✅ Found ${users.length} registered user(s):\n`);
    console.log('='.repeat(100));
    
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   User ID: ${user.userId}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Plan: ${user.plan || 'free-trial'}`);
      console.log(`   Credit Balance: ${user.creditBalance || 0} credits`);
      console.log(`   Trial Credits Used: ${user.trialCreditsUsed || 0}/${user.trialCreditsLimit || 500}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}`);
      console.log(`   Payment Method Added: ${user.paymentMethodAdded ? 'Yes' : 'No'}`);
      if (user.stripeCustomerId) {
        console.log(`   Stripe Customer ID: ${user.stripeCustomerId}`);
      }
      console.log('-'.repeat(100));
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Users: ${users.length}`);
    console.log(`   With Payment Methods: ${users.filter(u => u.paymentMethodAdded).length}`);
    console.log(`   Total Credit Balance: ${users.reduce((sum, u) => sum + (u.creditBalance || 0), 0)} credits`);
    
    const planCounts = users.reduce((acc, u) => {
      const plan = u.plan || 'free-trial';
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n   Users by Plan:`);
    Object.entries(planCounts).forEach(([plan, count]) => {
      console.log(`     ${plan}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
    console.error(error.stack);
  }
}

listUsers();
