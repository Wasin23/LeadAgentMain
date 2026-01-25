import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function migrateUsersToPlans() {
  try {
    console.log('🔄 [MIGRATION] Starting user plan migration...');
    
    const users = await awsManager.getAllUsers();
    console.log(`📊 [MIGRATION] Found ${users.length} users to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const user of users) {
      try {
        // Skip users who already have a plan
        if (user.plan) {
          console.log(`⏩ [MIGRATION] User ${user.email || user.userId} already has plan: ${user.plan}`);
          skipped++;
          continue;
        }
        
        // Migrate user to free trial plan with 500 credits
        await awsManager.updateUser(user.userId, {
          plan: 'free-trial',
          trialCreditsLimit: 500, // 500 credits = $25
          maxCredits: 500,
          planMigratedAt: new Date().toISOString()
        });
        
        console.log(`✅ [MIGRATION] Migrated ${user.email || user.userId} to free-trial plan (500 credits)`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ [MIGRATION] Failed to migrate user ${user.userId}:`, error.message);
      }
    }
    
    console.log('🎉 [MIGRATION] Plan migration complete!');
    console.log(`  ✅ Migrated: ${migrated} users`);
    console.log(`  ⏩ Skipped: ${skipped} users`);
    console.log(`  📋 All users now have access to 500 credits ($25 value)`);
    
  } catch (error) {
    console.error('❌ [MIGRATION] Migration failed:', error);
  }
}

// Run migration
migrateUsersToPlans();