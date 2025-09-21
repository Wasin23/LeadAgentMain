const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
require('dotenv').config();

async function addCalendarIdSetting() {
  if (!process.env.ZILLIZ_ENDPOINT || !process.env.ZILLIZ_TOKEN) {
    console.error('❌ Missing Zilliz credentials in environment variables');
    process.exit(1);
  }

  const client = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT,
    token: process.env.ZILLIZ_TOKEN
  });

  try {
    console.log('🔌 Connecting to Zilliz...');

    // Load the agent_settings collection
    await client.loadCollection({
      collection_name: 'agent_settings'
    });

    console.log('📚 Collection loaded successfully');

    // Insert the calendar_id setting for the default user
    const calendarIdSetting = {
      user_id: 'default',
      setting_key: 'calendar_id',
      setting_value: 'colton.fidd@gmail.com',
      setting_type: 'string',
      updated_at: new Date().toISOString(),
      dummy_vector: [0.1, 0.2] // Same dimension as other settings
    };

    console.log('📝 Adding calendar_id setting:', calendarIdSetting);

    const insertResult = await client.insert({
      collection_name: 'agent_settings',
      data: [calendarIdSetting]
    });

    console.log('✅ Insert result:', insertResult);

    // Flush the data
    await client.flush({
      collection_names: ['agent_settings']
    });

    console.log('💾 Data flushed successfully');

    // Verify the setting was added by searching for it
    const searchResult = await client.search({
      collection_name: 'agent_settings',
      vectors: [[0.1, 0.2]],
      search_params: {
        anns_field: 'dummy_vector',
        topk: 100,
        metric_type: 'L2',
        params: JSON.stringify({ nprobe: 10 })
      },
      output_fields: ['user_id', 'setting_key', 'setting_value', 'setting_type']
    });

    console.log('🔍 Current settings in database:');
    searchResult.results.forEach(result => {
      console.log(`  ${result.user_id} | ${result.setting_key} = ${result.setting_value}`);
    });

    console.log('✅ Calendar ID setting added successfully!');
    console.log('📧 Users can now configure their Google Calendar ID in the settings modal');

  } catch (error) {
    console.error('❌ Error adding calendar ID setting:', error);
  } finally {
    // Close the connection
    await client.closeConnection();
    console.log('🔌 Connection closed');
  }
}

addCalendarIdSetting();
