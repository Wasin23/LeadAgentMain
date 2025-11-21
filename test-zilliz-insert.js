import { ZillizLeadMemory } from './utils/zillizLeadMemory.js';
import dotenv from 'dotenv';

dotenv.config();

async function testInsert() {
  console.log('🧪 Testing Zilliz data insertion...\n');

  try {
    const memory = new ZillizLeadMemory();
    await memory.initialize();
    console.log('✅ Connected to Zilliz\n');

    // Test insert
    console.log('📝 Inserting test data...');
    const result = await memory.storeKeywordPerformance(
      'test-user-123',
      'test-agent-456',
      'real estate',
      'CEO',
      10,
      0,
      'base'
    );
    
    console.log('Insert result:', JSON.stringify(result, null, 2));

    // Wait a moment for flush to complete
    console.log('\n⏳ Waiting 2 seconds for data to flush...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to query it back
    console.log('\n🔍 Querying data back...');
    const loadResult = await memory.loadKeywordPerformance('test-user-123');
    console.log('Query result:', JSON.stringify(loadResult, null, 2));

    // Direct query to see what's in collection
    console.log('\n🔍 Direct collection query...');
    const directQuery = await memory.client.query({
      collection_name: 'lead_agent_memory',
      filter: 'user_id != ""',
      output_fields: ['user_id', 'keyword', 'position', 'total_attempts', 'cumulative_duplicate_rate'],
      limit: 10
    });
    console.log('Direct query result:', JSON.stringify(directQuery, null, 2));

    // Get collection stats
    console.log('\n📊 Collection stats...');
    const stats = await memory.client.getCollectionStatistics({
      collection_name: 'lead_agent_memory'
    });
    console.log('Stats:', JSON.stringify(stats, null, 2));

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testInsert();
