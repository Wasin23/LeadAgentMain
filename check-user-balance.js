import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const awsManager = new AWSManager();
const email = 'markefidelman@gmail.com';

async function checkUserBalance() {
  try {
    console.log(`\n🔍 Looking up user: ${email}\n`);
    
    const user = await awsManager.getUserByEmail(email);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 USER INFO:');
    console.log('─────────────────────────────────────');
    console.log(`User ID: ${user.userId}`);
    console.log(`Email: ${user.email}`);
    console.log(`Username: ${user.username}`);
    console.log(`Created: ${user.createdAt || 'N/A'}`);
    
    console.log('\n💳 BILLING INFO:');
    console.log('─────────────────────────────────────');
    console.log(`Payment Method Added: ${user.paymentMethodAdded ? 'YES ✓' : 'NO ✗'}`);
    console.log(`Stripe Customer ID: ${user.stripeCustomerId || 'None'}`);
    
    console.log('\n💰 TRIAL CREDITS:');
    console.log('─────────────────────────────────────');
    const creditsUsed = user.trialCreditsUsed || 0;
    const creditsLimit = user.trialCreditsLimit || 25;
    const creditsRemaining = Math.max(0, creditsLimit - creditsUsed);
    const percentageUsed = (creditsUsed / creditsLimit) * 100;
    
    console.log(`Used: $${creditsUsed.toFixed(2)}`);
    console.log(`Limit: $${creditsLimit.toFixed(2)}`);
    console.log(`Remaining: $${creditsRemaining.toFixed(2)}`);
    console.log(`Percentage Used: ${percentageUsed.toFixed(1)}%`);
    
    if (percentageUsed >= 100) {
      console.log(`\n🚫 STATUS: TRIAL CREDITS EXHAUSTED`);
    } else if (percentageUsed >= 90) {
      console.log(`\n🚨 STATUS: CRITICAL - Almost out of credits!`);
    } else if (percentageUsed >= 80) {
      console.log(`\n⚠️  STATUS: WARNING - Running low on credits`);
    } else {
      console.log(`\n✅ STATUS: Good - Plenty of credits remaining`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkUserBalance();
