// Quick test to check what was logged in Zilliz
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import 'dotenv/config';

const client = new MilvusClient({
  address: process.env.ZILLIZ_ENDPOINT?.trim(),
  token: process.env.ZILLIZ_TOKEN?.trim(),
});

async function checkReplyLogs() {
  try {
    console.log('🔍 Checking recent reply logs in Zilliz...');
    
    await client.loadCollection({ collection_name: 'email_tracking_events' });
    
    // Query for recent events
    const result = await client.query({
      collection_name: 'email_tracking_events',
      expr: 'tracking_id like "tracking-76e84c79%"',
      output_fields: ['tracking_id', 'event_type', 'timestamp', 'user_agent', 'email_address'],
      limit: 10,
      consistency_level: 'Strong'
    });
    
    const events = result.data || result || [];
    console.log(`\n📊 Found ${events.length} events:`);
    
    events.forEach((event, index) => {
      console.log(`\n${index + 1}. Event Type: ${event.event_type}`);
      console.log(`   Tracking ID: ${event.tracking_id}`);
      console.log(`   Timestamp: ${event.timestamp}`);
      console.log(`   Email: ${event.email_address}`);
      console.log(`   Content (first 100 chars): ${event.user_agent?.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
  }
}

checkReplyLogs();
