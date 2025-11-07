import dotenv from 'dotenv';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

dotenv.config();

async function checkEvents() {
  const milvusClient = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT,
    token: process.env.ZILLIZ_TOKEN,
    timeout: 30000
  });

  try {
    const result = await milvusClient.query({
      collection_name: 'email_tracking_events',
      filter: 'tracking_id != ""',
      output_fields: ['*'],
      limit: 10
    });

    console.log(`Found ${result.data?.length || 0} tracking events:`);
    if (result.data && result.data.length > 0) {
      result.data.forEach((event, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log(`  Tracking ID: ${event.tracking_id}`);
        console.log(`  User ID: ${event.user_id}`);
        console.log(`  Agent ID: ${event.agent_id}`);
        console.log(`  Event Type: ${event.event_type}`);
        console.log(`  Timestamp: ${event.timestamp}`);
      });
    } else {
      console.log('No tracking events found.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkEvents();
