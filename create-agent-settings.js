// Create agent_settings collection in Zilliz
import 'dotenv/config';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const client = new MilvusClient({
  address: process.env.ZILLIZ_ENDPOINT?.trim(),
  token: process.env.ZILLIZ_TOKEN?.trim(),
});

async function createAgentSettingsCollection() {
  try {
    console.log('Creating agent_settings collection...');
    
    const schema = [
      {
        name: 'id',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true
      },
      {
        name: 'setting_key',
        data_type: DataType.VarChar,
        max_length: 100
      },
      {
        name: 'setting_value',
        data_type: DataType.VarChar,
        max_length: 5000
      },
      {
        name: 'setting_type',
        data_type: DataType.VarChar,
        max_length: 50
      },
      {
        name: 'updated_at',
        data_type: DataType.VarChar,
        max_length: 50
      },
      {
        name: 'user_id',
        data_type: DataType.VarChar,
        max_length: 100
      },
      {
        name: 'dummy_vector',
        data_type: DataType.FloatVector,
        dim: 2
      }
    ];

    await client.createCollection({
      collection_name: 'agent_settings',
      fields: schema,
      description: 'Agent response settings and configurations'
    });

    console.log('Collection created successfully');

    // Wait for collection to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create index
    await client.createIndex({
      collection_name: 'agent_settings',
      field_name: 'dummy_vector',
      index_type: 'FLAT',
      metric_type: 'L2'
    });

    console.log('Index created successfully');
    console.log('✅ agent_settings collection is ready for use');
    
  } catch (error) {
    console.error('Error creating collection:', error);
  }
}

createAgentSettingsCollection();
