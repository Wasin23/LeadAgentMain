import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

async function dropLeadAgentSettings() {
  console.log('🗑️  Dropping old settings collections...\n');

  try {
    const client = new MilvusClient({
      address: process.env.ZILLIZ_ENDPOINT,
      token: process.env.ZILLIZ_TOKEN
    });

    const collectionsToDelete = ['lead_agent_settings', 'user_settings', 'agent_settings', 'lead_agent_memory'];
    let droppedCount = 0;

    for (const collectionName of collectionsToDelete) {
      // Check if collection exists
      const collections = await client.listCollections();
      const exists = collections.data.some(col => col.name === collectionName);

      if (exists) {
        await client.dropCollection({ collection_name: collectionName });
        console.log(`✅ ${collectionName} dropped`);
        droppedCount++;
      } else {
        console.log(`ℹ️  ${collectionName} does not exist`);
      }
    }

    console.log(`\n🎉 Dropped ${droppedCount} collections`);

    // Show remaining collections
    const remaining = await client.listCollections();
    console.log('\n📊 Remaining collections:', remaining.data.length);
    remaining.data.forEach(col => console.log('   •', col.name));
    
  } catch (error) {
    console.error('❌ Error dropping collection:', error);
    process.exit(1);
  }
}

dropLeadAgentSettings();
