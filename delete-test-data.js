import { ZillizLeadMemory } from './utils/zillizLeadMemory.js';
import dotenv from 'dotenv';

dotenv.config();

async function deleteTestData() {
  console.log('🗑️  Deleting test data from Zilliz...\n');

  try {
    const memory = new ZillizLeadMemory();
    await memory.initialize();
    console.log('✅ Connected to Zilliz\n');

    // Delete ALL data for your user
    console.log('🗑️  Deleting all data for user 5781c511-2307-4fcf-a763-33e8ec64a638...');
    const result = await memory.resetUserMemory('5781c511-2307-4fcf-a763-33e8ec64a638');
    console.log('Delete result:', JSON.stringify(result, null, 2));

    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const loadResult = await memory.loadKeywordPerformance('5781c511-2307-4fcf-a763-33e8ec64a638');
    console.log('Should be empty:', JSON.stringify(loadResult, null, 2));

    // Get collection stats
    console.log('\n📊 Collection stats after deletion...');
    const stats = await memory.client.getCollectionStatistics({
      collection_name: 'lead_agent_memory'
    });
    console.log('Stats:', JSON.stringify(stats, null, 2));

    console.log('\n✅ Deletion complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Deletion failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

deleteTestData();
