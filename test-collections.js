import 'dotenv/config';
import { MilvusClient } from "@zilliz/milvus2-sdk-node";

async function testCollections() {
  const client = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT?.trim(),
    token: process.env.ZILLIZ_TOKEN?.trim(),
  });

  console.log('🔍 Testing Zilliz collections...');

  try {
    // Check if collections exist and get their info
    const userCollectionInfo = await client.describeCollection({ collection_name: 'user_settings' });
    console.log('✅ user_settings collection exists');
    
    const leadCollectionInfo = await client.describeCollection({ collection_name: 'lead_agent_settings' });
    console.log('✅ lead_agent_settings collection exists');

    // Load collections
    await client.loadCollection({ collection_name: 'user_settings' });
    await client.loadCollection({ collection_name: 'lead_agent_settings' });
    console.log('✅ Collections loaded');

    // Test simple insert
    console.log('\n🧪 Testing simple insert...');
    
    const testData = [
      {
        user_id: 'test123',
        settings_data: { test: 'data' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vector: [0.1, 0.2]
      }
    ];

    const insertResult = await client.insert({
      collection_name: 'user_settings',
      data: testData,
    });

    console.log('Insert result:', insertResult);

    // Flush to ensure data is persisted
    await client.flushSync({ collection_names: ['user_settings'] });
    console.log('✅ Data flushed');

    // Wait a moment for consistency
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to query
    console.log('\n🔍 Testing query...');
    const queryResult = await client.query({
      collection_name: 'user_settings',
      expr: `user_id == "test123"`,
      output_fields: ['user_id', 'settings_data'],
      limit: 10,
      consistency_level: 'Strong'
    });

    console.log('Query result:', queryResult);

    // Get collection stats
    const stats = await client.getCollectionStatistics({ collection_name: 'user_settings' });
    console.log('Collection stats:', stats);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCollections();