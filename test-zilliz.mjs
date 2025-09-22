// Test script to check Zilliz database directly
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import dotenv from 'dotenv';

// Load environment variables from netlify-deploy/.env
dotenv.config({ path: './netlify-deploy/.env' });

const client = new MilvusClient({
  address: process.env.ZILLIZ_ENDPOINT?.trim(),
  token: process.env.ZILLIZ_TOKEN?.trim(),
});

console.log('🔍 Testing Zilliz connection...');
console.log('Endpoint configured:', !!process.env.ZILLIZ_ENDPOINT);
console.log('Token length:', (process.env.ZILLIZ_TOKEN||'').trim().length);

try {
  // Test connection
  const collections = await client.listCollections();
  console.log('✅ Collections found:', collections.data);

  // Helper function to escape strings for Zilliz queries
  function esc(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

  // Test specific user settings for user 76e84c79
  const userId = '76e84c79';
  
  console.log('\n🔍 Testing calendar_id lookup for user:', userId);
  const calendarQuery = `field_name == "${esc(`calendar_id_user_${userId}`)}"`; 
  console.log('Query:', calendarQuery);
  
  const calendarResult = await client.query({
    collection_name: 'agent_settings',
    expr: calendarQuery,
    output_fields: ['field_name', 'field_value', 'field_type'],
    limit: 10,
    consistency_level: 'Strong'
  });
  
  console.log('Calendar ID result:', JSON.stringify(calendarResult, null, 2));
  
  // Also check all settings for this user
  console.log('\n🔍 All settings for user:', userId);
  const allUserQuery = `field_name like "calendar_id_user_${userId}" or field_name like "timezone_user_${userId}" or field_name like "company_info_user_${userId}" or field_name like "response_tone_user_${userId}"`;
  console.log('Query:', allUserQuery);
  
  const allResults = await client.query({
    collection_name: 'agent_settings',
    expr: allUserQuery,
    output_fields: ['field_name', 'field_value', 'field_type'],
    limit: 50,
    consistency_level: 'Strong'
  });
  
  console.log('All user settings:', JSON.stringify(allResults, null, 2));

} catch (error) {
  console.error('❌ Error:', error);
}
