import { config } from 'dotenv';
import AWSManager from './utils/awsManager.js';

config();

const awsManager = new AWSManager();

async function upgradeMyAccount() {
  try {
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638'; // Your actual user ID
    
    console.log('💎 [UPGRADE] Upgrading your account to 20,000 credits...');
    
    const result = await awsManager.updateUser(userId, {
      creditBalance: 20000,
      plan: 'professional',
      planUpdatedAt: new Date().toISOString(),
      upgradeNote: 'Owner upgrade for testing - corrected user ID'
    });
    
    console.log('✅ [UPGRADE] Successfully upgraded account!');
    console.log('Account details:', result);
    
    // Verify the upgrade
    const user = await awsManager.getUserById(userId);
    console.log('\n🔍 VERIFICATION:');
    console.log('Credit Balance:', user.creditBalance);
    console.log('Plan:', user.plan);
    console.log('Upgrade Note:', user.upgradeNote);
    
  } catch (error) {
    console.error('❌ [UPGRADE] Error:', error.message);
  }
}

upgradeMyAccount();