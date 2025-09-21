import 'dotenv/config';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

/**
 * Cleanup script for Zilliz agent settings
 * Removes duplicates and outdated calendar_link references
 */

async function cleanupZillizSettings() {
  try {
    const client = new MilvusClient({
      address: process.env.ZILLIZ_ENDPOINT,
      token: process.env.ZILLIZ_TOKEN
    });

    const collectionName = 'agent_settings';

    console.log('🧹 [CLEANUP] Starting Zilliz settings cleanup...');

    // Load collection
    await client.loadCollection({ collection_name: collectionName });

    // Get all current settings
    const searchResult = await client.search({
      collection_name: collectionName,
      vector: [0.1, 0.2],
      vector_type: 101,
      limit: 1000,
      output_fields: ['id', 'setting_key', 'setting_value', 'setting_type', 'updated_at', 'user_id']
    });

    console.log(`📊 [CLEANUP] Found ${searchResult.results.length} settings entries`);

    // Group by setting_key to find duplicates
    const settingGroups = {};
    const idsToDelete = [];

    for (const result of searchResult.results) {
      const key = result.setting_key;
      
      if (!settingGroups[key]) {
        settingGroups[key] = [];
      }
      settingGroups[key].push(result);
    }

    // Process each setting group
    for (const [settingKey, entries] of Object.entries(settingGroups)) {
      console.log(`🔍 [CLEANUP] Processing ${settingKey}: ${entries.length} entries`);

      if (entries.length > 1) {
        // Sort by updated_at and keep only the latest
        entries.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        const latest = entries[0];
        const duplicates = entries.slice(1);

        console.log(`   ⚠️  Found ${duplicates.length} duplicates for ${settingKey}`);
        console.log(`   ✅  Keeping latest: ${latest.updated_at}`);

        // Mark duplicates for deletion
        duplicates.forEach(dup => {
          console.log(`   ❌  Marking for deletion: ${dup.updated_at}`);
          idsToDelete.push(dup.id);
        });
      }

      // Check for outdated calendar_link references
      const latestEntry = entries.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
      
      if (settingKey === 'calendar_link') {
        console.log(`   🗑️  Marking standalone calendar_link for deletion (replaced by timezone)`);
        idsToDelete.push(latestEntry.id);
      }

      if (settingKey === 'company_info') {
        try {
          const companyInfo = JSON.parse(latestEntry.setting_value);
          if (companyInfo.calendar_link) {
            console.log(`   🔧  company_info contains outdated calendar_link - needs manual update`);
            console.log(`   📝  Current value:`, JSON.stringify(companyInfo, null, 2));
          }
        } catch (e) {
          console.log(`   ⚠️  Could not parse company_info JSON`);
        }
      }
    }

    // Delete the marked IDs
    if (idsToDelete.length > 0) {
      console.log(`\n🗑️  [CLEANUP] Deleting ${idsToDelete.length} duplicate/outdated entries...`);
      
      const deleteExpr = `id in [${idsToDelete.join(',')}]`;
      console.log(`   Delete expression: ${deleteExpr}`);

      await client.delete({
        collection_name: collectionName,
        filter: deleteExpr
      });

      console.log(`✅ [CLEANUP] Successfully deleted ${idsToDelete.length} entries`);
    } else {
      console.log(`✅ [CLEANUP] No duplicates found - collection is clean!`);
    }

    // Summary of remaining settings
    console.log('\n📋 [CLEANUP] Final settings summary:');
    const finalCount = {};
    for (const [key, entries] of Object.entries(settingGroups)) {
      if (!idsToDelete.includes(entries[0].id)) {
        finalCount[key] = 1;
      }
    }
    
    console.log('   Remaining settings:', Object.keys(finalCount));
    console.log('   Total unique settings:', Object.keys(finalCount).length);

    // Check for missing timezone setting
    if (!finalCount.timezone) {
      console.log('\n⚠️  [CLEANUP] Missing timezone setting!');
      console.log('   💡 This will be auto-created when you save settings from the UI');
    }

    console.log('\n🎉 [CLEANUP] Cleanup completed successfully!');
    console.log('💡 Next steps:');
    console.log('   1. Open email response settings in UI');
    console.log('   2. Set your timezone');
    console.log('   3. Save settings to create clean, up-to-date entries');

  } catch (error) {
    console.error('❌ [CLEANUP] Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupZillizSettings().catch(console.error);
