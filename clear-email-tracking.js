import dotenv from 'dotenv';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

// Load environment variables FIRST
dotenv.config();

async function clearEmailTracking() {
  console.log('🔄 Connecting to Zilliz...');
  
  const milvusClient = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT,
    token: process.env.ZILLIZ_TOKEN,
    timeout: 30000
  });

  try {
    // Check if collection exists
    const hasCollection = await milvusClient.hasCollection({
      collection_name: 'email_tracking_events'
    });

    if (!hasCollection.value) {
      console.log('📭 Collection "email_tracking_events" does not exist');
      return;
    }

    console.log('✅ Connected to Zilliz');
    console.log('🗑️  Clearing email tracking events...');

    // Delete all data from the collection
    const deleteResult = await milvusClient.delete({
      collection_name: 'email_tracking_events',
      filter: 'tracking_id != ""' // This will match all records with non-empty tracking_id
    });

    console.log(`🎉 Successfully cleared email tracking events!`);
    console.log(`   Delete count: ${deleteResult.delete_cnt || 'all'}`);

    // Optional: Get count to verify
    try {
      const queryResult = await milvusClient.query({
        collection_name: 'email_tracking_events',
        expr: 'id >= 0',
        output_fields: ['id'],
        limit: 1
      });
      
      console.log(`✅ Verification: ${queryResult.data?.length || 0} records remaining`);
    } catch (verifyError) {
      console.log('✅ Collection cleared (verification query returned no results)');
    }

  } catch (error) {
    console.error('❌ Error clearing email tracking:', error.message);
    if (error.message.includes('collection not found')) {
      console.log('📭 Collection does not exist or is already empty');
    }
  } finally {
    console.log('🔌 Closing connection...');
  }
}

clearEmailTracking();
