import 'dotenv/config';
import { MilvusClient } from "@zilliz/milvus2-sdk-node";

async function dropCollections() {
  const client = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT?.trim(),
    token: process.env.ZILLIZ_TOKEN?.trim(),
  });

  console.log('🗑️ Dropping existing Zilliz collections...');

  try {
    // Drop user_settings collection
    try {
      await client.dropCollection({ collection_name: 'user_settings' });
      console.log('✅ Dropped user_settings collection');
    } catch (error) {
      if (error.message.includes('not exist')) {
        console.log('ℹ️ user_settings collection does not exist');
      } else {
        console.error('❌ Error dropping user_settings:', error.message);
      }
    }

    // Drop lead_agent_settings collection
    try {
      await client.dropCollection({ collection_name: 'lead_agent_settings' });
      console.log('✅ Dropped lead_agent_settings collection');
    } catch (error) {
      if (error.message.includes('not exist')) {
        console.log('ℹ️ lead_agent_settings collection does not exist');
      } else {
        console.error('❌ Error dropping lead_agent_settings:', error.message);
      }
    }

    console.log('🎉 Collection cleanup completed!');

  } catch (error) {
    console.error('❌ Error during collection cleanup:', error);
    throw error;
  }
}

dropCollections();