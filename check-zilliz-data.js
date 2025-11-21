import { ZillizLeadMemory } from './utils/zillizLeadMemory.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkCollection() {
  console.log('🔍 Checking Zilliz collection data...\n');

  try {
    const memory = new ZillizLeadMemory();
    await memory.initialize();
    console.log('✅ Connected to Zilliz\n');

    // Get collection stats
    console.log('📊 Collection statistics...');
    const stats = await memory.client.getCollectionStatistics({
      collection_name: 'lead_agent_memory'
    });
    console.log('Row count:', stats.data.row_count);
    console.log('Full stats:', JSON.stringify(stats, null, 2));

    // Try to query all data
    console.log('\n🔍 Querying all data in collection...');
    const allData = await memory.client.query({
      collection_name: 'lead_agent_memory',
      filter: 'user_id != ""',
      output_fields: ['user_id', 'keyword', 'position', 'total_attempts', 'total_duplicates', 'cumulative_duplicate_rate', 'last_updated'],
      limit: 100
    });
    console.log('Query status:', allData.status);
    console.log('Data count:', allData.data?.length || 0);
    console.log('Data:', JSON.stringify(allData.data, null, 2));

    // Check for specific user
    console.log('\n🔍 Checking for user 5781c511-2307-4fcf-a763-33e8ec64a638...');
    const userData = await memory.loadKeywordPerformance('5781c511-2307-4fcf-a763-33e8ec64a638');
    console.log('User data result:', JSON.stringify(userData, null, 2));

    // Try describe collection
    console.log('\n📋 Collection schema...');
    const schema = await memory.client.describeCollection({
      collection_name: 'lead_agent_memory'
    });
    console.log('Schema:', JSON.stringify(schema, null, 2));

    console.log('\n✅ Check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

checkCollection();
