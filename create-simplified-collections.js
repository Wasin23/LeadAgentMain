import 'dotenv/config';
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";

async function createSimplifiedCollections() {
  const client = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT?.trim(),
    token: process.env.ZILLIZ_TOKEN?.trim(),
  });

  console.log('🏗️ Creating simplified Zilliz collections...');

  try {
    // Create simplified user_settings collection
    console.log('📝 Creating user_settings collection with simplified schema...');
    
    const userSettingsSchema = {
      collection_name: 'user_settings',
      fields: [
        {
          name: 'id',
          description: 'Primary key field',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'user_id',
          description: 'User identifier (first 8 chars of full user ID)',
          data_type: DataType.VarChar,
          max_length: 50,
        },
        {
          name: 'settings_data',
          description: 'Complete user settings stored as JSON',
          data_type: DataType.JSON,
        },
        {
          name: 'created_at',
          description: 'Timestamp when settings were created',
          data_type: DataType.VarChar,
          max_length: 50,
        },
        {
          name: 'updated_at',
          description: 'Timestamp when settings were last updated',
          data_type: DataType.VarChar,
          max_length: 50,
        },
        {
          name: 'vector',
          description: 'Dummy vector field required by Zilliz',
          data_type: DataType.FloatVector,
          dim: 2,
        },
      ],
    };

    await client.createCollection(userSettingsSchema);
    console.log('✅ Created user_settings collection');

    // Create index on user_id for fast lookups
    await client.createIndex({
      collection_name: 'user_settings',
      field_name: 'user_id',
      index_name: 'user_id_index',
      index_type: 'INVERTED',
    });
    console.log('🔍 Created index on user_id field for user_settings');

    // Create vector index (required for Zilliz)
    await client.createIndex({
      collection_name: 'user_settings',
      field_name: 'vector',
      index_name: 'vector_index',
      index_type: 'HNSW',
      metric_type: 'L2',
      params: { M: 16, efConstruction: 256 }
    });
    console.log('🔍 Created vector index for user_settings');

    // Create simplified lead_agent_settings collection
    console.log('📝 Creating lead_agent_settings collection with simplified schema...');
    
    const leadAgentSettingsSchema = {
      collection_name: 'lead_agent_settings',
      fields: [
        {
          name: 'id',
          description: 'Primary key field',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'user_id',
          description: 'User identifier (first 8 chars of full user ID)',
          data_type: DataType.VarChar,
          max_length: 50,
        },
        {
          name: 'lead_settings_data',
          description: 'Complete lead agent settings stored as JSON',
          data_type: DataType.JSON,
        },
        {
          name: 'created_at',
          description: 'Timestamp when settings were created',
          data_type: DataType.VarChar,
          max_length: 50,
        },
        {
          name: 'updated_at',
          description: 'Timestamp when settings were last updated',
          data_type: DataType.VarChar,
          max_length: 50,
        },
        {
          name: 'vector',
          description: 'Dummy vector field required by Zilliz',
          data_type: DataType.FloatVector,
          dim: 2,
        },
      ],
    };

    await client.createCollection(leadAgentSettingsSchema);
    console.log('✅ Created lead_agent_settings collection');

    // Create index on user_id for fast lookups
    await client.createIndex({
      collection_name: 'lead_agent_settings',
      field_name: 'user_id',
      index_name: 'user_id_index',
      index_type: 'INVERTED',
    });
    console.log('🔍 Created index on user_id field for lead_agent_settings');

    // Create vector index (required for Zilliz)
    await client.createIndex({
      collection_name: 'lead_agent_settings',
      field_name: 'vector',
      index_name: 'vector_index',
      index_type: 'HNSW',
      metric_type: 'L2',
      params: { M: 16, efConstruction: 256 }
    });
    console.log('🔍 Created vector index for lead_agent_settings');

    console.log('\n🎉 Simplified collections created successfully!');
    
    // Display schema information
    console.log('\n📋 Collection Schemas:');
    
    console.log('\n📊 user_settings:');
    console.log('  - user_id (VarChar): User identifier for lookups');
    console.log('  - settings_data (JSON): All user preferences, AI personality, etc.');
    console.log('  - created_at/updated_at (VarChar): Timestamps');
    
    console.log('\n🤖 lead_agent_settings:');
    console.log('  - user_id (VarChar): User identifier for lookups');
    console.log('  - lead_settings_data (JSON): All lead agent configuration');
    console.log('  - created_at/updated_at (VarChar): Timestamps');

  } catch (error) {
    console.error('❌ Error creating collections:', error);
    throw error;
  }
}

createSimplifiedCollections();