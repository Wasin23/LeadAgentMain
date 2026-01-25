import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const awsManager = new AWSManager();

async function upgradeUsers() {
  try {
    console.log('🔄 [UPGRADE] Starting user upgrade process...');
    
    // Upgrade user 57 (you) to max credits
    console.log('💎 [UPGRADE] Upgrading user 57 to Growth plan (20,000 credits)...');
    await awsManager.updateUser('57', {
      creditBalance: 20000, // Growth tier credits
      plan: 'professional',
      planUpdatedAt: new Date().toISOString(),
      upgradeNote: 'Owner upgrade for testing'
    });
    console.log('✅ [UPGRADE] User 57 upgraded to 20,000 credits');
    
    // Upgrade user 53 (your dad) to max credits  
    console.log('💎 [UPGRADE] Upgrading user 53 to Growth plan (20,000 credits)...');
    await awsManager.updateUser('53', {
      creditBalance: 20000, // Growth tier credits
      plan: 'professional', 
      planUpdatedAt: new Date().toISOString(),
      upgradeNote: 'Family upgrade for testing'
    });
    console.log('✅ [UPGRADE] User 53 upgraded to 20,000 credits');
    
    // Get all users and migrate the rest to free trial
    console.log('📋 [MIGRATION] Getting all users for free trial migration...');
    const users = await awsManager.getAllUsers();
    console.log(`📊 [MIGRATION] Found ${users.length} total users`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const user of users) {
      try {
        // Skip the upgraded users
        if (user.userId === '57' || user.userId === '53') {
          console.log(`⏩ [MIGRATION] Skipping upgraded user ${user.userId}`);
          skipped++;
          continue;
        }
        
        // Skip users who already have purchased credits
        if (user.creditBalance && user.creditBalance > 0) {
          console.log(`⏩ [MIGRATION] User ${user.userId} already has ${user.creditBalance} purchased credits, skipping`);
          skipped++;
          continue;
        }
        
        // Migrate to free trial (500 credits)
        await awsManager.updateUser(user.userId, {
          plan: 'free-trial',
          trialCreditsLimit: 500,
          trialCreditsUsed: user.trialCreditsUsed || 0, // Keep existing usage
          planMigratedAt: new Date().toISOString()
        });
        
        console.log(`✅ [MIGRATION] Migrated user ${user.userId} (${user.email || 'no-email'}) to free-trial (500 credits)`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ [MIGRATION] Failed to migrate user ${user.userId}:`, error.message);
      }
    }
    
    console.log('🎉 [COMPLETE] User upgrade and migration complete!');
    console.log(`  💎 Upgraded to 20,000 credits: User 57, User 53`);
    console.log(`  ✅ Migrated to free trial: ${migrated} users`);
    console.log(`  ⏩ Skipped: ${skipped} users`);
    console.log(`  📋 Ready for testing with upgraded accounts!`);
    
  } catch (error) {
    console.error('❌ [UPGRADE] Upgrade failed:', error);
  }
}

// Run upgrade
upgradeUsers();