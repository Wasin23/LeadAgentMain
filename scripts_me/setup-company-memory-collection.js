import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const OLD_COLLECTION = 'AffirmationAI';
const NEW_COLLECTION = 'company_memory';

const client = new MilvusClient({
  address: process.env.ZILLIZ_ENDPOINT,
  token: process.env.ZILLIZ_TOKEN,
  timeout: 30000,
});

async function run() {
  console.log('Connecting to Zilliz...');
  console.log(`Endpoint: ${process.env.ZILLIZ_ENDPOINT}`);

  const { data: collections } = await client.listCollections();
  const names = collections.map(c => c.name);
  console.log('Existing collections:', names);

  // Drop old collection if it exists
  if (names.includes(OLD_COLLECTION)) {
    console.log(`\nDropping "${OLD_COLLECTION}"...`);
    await client.dropCollection({ collection_name: OLD_COLLECTION });
    console.log(`✅ Dropped "${OLD_COLLECTION}"`);
  } else {
    console.log(`\n"${OLD_COLLECTION}" not found — skipping drop`);
  }

  // Create company_memory collection if it doesn't exist
  if (names.includes(NEW_COLLECTION)) {
    console.log(`\n"${NEW_COLLECTION}" already exists — skipping creation`);
  } else {
    console.log(`\nCreating "${NEW_COLLECTION}"...`);
    await client.createCollection({
      collection_name: NEW_COLLECTION,
      fields: [
        {
          name: 'id',
          data_type: DataType.VarChar,
          max_length: 128,
          is_primary_key: true,
          auto_id: false,
        },
        {
          name: 'user_id',
          data_type: DataType.VarChar,
          max_length: 128,
        },
        {
          name: 'doc_id',
          data_type: DataType.VarChar,
          max_length: 128,
        },
        {
          name: 'chunk_index',
          data_type: DataType.Int32,
        },
        {
          name: 'type',
          // e.g. "case_study", "pricing", "battle_card", "faq", "process", "general"
          data_type: DataType.VarChar,
          max_length: 64,
        },
        {
          name: 'source',
          // original filename or label
          data_type: DataType.VarChar,
          max_length: 512,
        },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 8192,
        },
        {
          name: 'embedding',
          data_type: DataType.FloatVector,
          dim: 1536, // text-embedding-3-small / ada-002
        },
        {
          name: 'created_at',
          data_type: DataType.VarChar,
          max_length: 32,
        },
      ],
    });

    console.log(`✅ Created "${NEW_COLLECTION}"`);

    // Create vector index
    console.log('Creating vector index...');
    await client.createIndex({
      collection_name: NEW_COLLECTION,
      field_name: 'embedding',
      index_type: 'AUTOINDEX',
      metric_type: 'COSINE',
    });
    console.log('✅ Index created');

    // Load into memory
    await client.loadCollection({ collection_name: NEW_COLLECTION });
    console.log('✅ Collection loaded');
  }

  // Final state
  const { data: final } = await client.listCollections();
  console.log('\nCollections now:', final.map(c => c.name));
}

run().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
