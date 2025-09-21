import 'dotenv/config';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

/**
 * Quick check script to see current agent settings state
 */

async function checkAgentSettings() {
  try {
    const client = new MilvusClient({
      address: process.env.ZILLIZ_ENDPOINT,
      token: process.env.ZILLIZ_TOKEN
    });

    const collectionName = 'agent_settings';

    console.log('🔍 [CHECK] Checking current agent settings state...');

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

    console.log(`📊 [CHECK] Found ${searchResult.results.length} total entries`);

    // Group by setting_key
    const settingGroups = {};
    for (const result of searchResult.results) {
      const key = result.setting_key;
      if (!settingGroups[key]) {
        settingGroups[key] = [];
      }
      settingGroups[key].push(result);
    }

    console.log('\n📋 [CHECK] Settings breakdown:');
    for (const [settingKey, entries] of Object.entries(settingGroups)) {
      console.log(`   ${settingKey}: ${entries.length} entries`);
      
      if (entries.length > 1) {
        console.log(`     ⚠️  DUPLICATES FOUND!`);
        entries.forEach((entry, i) => {
          console.log(`       ${i + 1}. ${entry.updated_at} (ID: ${entry.id})`);
        });
      } else {
        console.log(`     ✅  Single entry: ${entries[0].updated_at}`);
      }
    }

    // Count by user_id
    const userCounts = {};
    for (const result of searchResult.results) {
      const userId = result.user_id || 'undefined';
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    }

    console.log('\n👤 [CHECK] Entries by user:');
    for (const [userId, count] of Object.entries(userCounts)) {
      console.log(`   ${userId}: ${count} entries`);
    }

    // Show recent entries
    const recentEntries = searchResult.results
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 10);

    console.log('\n⏰ [CHECK] Most recent 10 entries:');
    recentEntries.forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.setting_key} - ${entry.updated_at} (${entry.user_id})`);
    });

    // Summary
    console.log('\n📊 [CHECK] Summary:');
    console.log(`   Total entries: ${searchResult.results.length}`);
    console.log(`   Unique settings: ${Object.keys(settingGroups).length}`);
    console.log(`   Settings with duplicates: ${Object.values(settingGroups).filter(g => g.length > 1).length}`);
    console.log(`   Total duplicate entries: ${searchResult.results.length - Object.keys(settingGroups).length}`);

  } catch (error) {
    console.error('❌ [CHECK] Error checking settings:', error);
  }
}

// Run the check
checkAgentSettings().catch(console.error);
