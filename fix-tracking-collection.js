import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import 'dotenv/config';

async function fixTrackingCollection() {
    const client = new MilvusClient({
        address: process.env.ZILLIZ_ENDPOINT,
        token: process.env.ZILLIZ_TOKEN
    });

    const collectionName = 'email_tracking_events';

    console.log('🔧 [FIX] Starting collection rebuild...');

    try {
        // Step 1: Check if collection exists
        const collections = await client.listCollections();
        const collectionExists = collections.data?.some(col => col.name === collectionName);

        if (collectionExists) {
            console.log('🗑️  [FIX] Dropping existing collection...');
            await client.dropCollection({
                collection_name: collectionName
            });
            console.log('✅ [FIX] Collection dropped successfully');
            
            // Wait for deletion to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            console.log('ℹ️  [FIX] Collection does not exist, will create new one');
        }

        // Step 2: Create collection with CORRECT schema (including user_id and agent_id)
        console.log('🏗️  [FIX] Creating collection with updated schema...');
        
        const schema = [
            {
                name: 'id',
                data_type: DataType.Int64,
                is_primary_key: true,
                autoID: true
            },
            {
                name: 'tracking_id',
                data_type: DataType.VarChar,
                max_length: 100
            },
            {
                name: 'user_id',
                data_type: DataType.VarChar,
                max_length: 100
            },
            {
                name: 'agent_id',
                data_type: DataType.VarChar,
                max_length: 100
            },
            {
                name: 'event_type',
                data_type: DataType.VarChar,
                max_length: 50
            },
            {
                name: 'timestamp',
                data_type: DataType.VarChar,
                max_length: 50
            },
            {
                name: 'user_agent',
                data_type: DataType.VarChar,
                max_length: 10000
            },
            {
                name: 'ip_address',
                data_type: DataType.VarChar,
                max_length: 50
            },
            {
                name: 'email_address',
                data_type: DataType.VarChar,
                max_length: 200
            },
            {
                name: 'recipient',
                data_type: DataType.VarChar,
                max_length: 200
            },
            {
                name: 'processed',
                data_type: DataType.Bool
            },
            {
                name: 'dummy_vector',
                data_type: DataType.FloatVector,
                dim: 2
            }
        ];

        await client.createCollection({
            collection_name: collectionName,
            fields: schema,
            description: 'Email tracking events collection with user_id and agent_id'
        });

        console.log('✅ [FIX] Collection created successfully');

        // Wait for collection to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Create index on vector field
        console.log('🔍 [FIX] Creating index...');
        try {
            await client.createIndex({
                collection_name: collectionName,
                field_name: 'dummy_vector',
                index_type: 'FLAT',
                metric_type: 'L2'
            });
            console.log('✅ [FIX] Index created successfully');
        } catch (indexError) {
            console.log('⚠️  [FIX] Index creation warning:', indexError.message);
        }

        // Step 4: Verify schema
        console.log('🔍 [FIX] Verifying schema...');
        const collectionInfo = await client.describeCollection({
            collection_name: collectionName
        });
        
        console.log('✅ [FIX] Collection schema verified:');
        console.log(JSON.stringify(collectionInfo.schema, null, 2));
        
        console.log('\n🎉 [FIX] Collection rebuild complete! You can now test email tracking.');

    } catch (error) {
        console.error('❌ [FIX] Error:', error);
        throw error;
    }
}

// Run the fix
fixTrackingCollection()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
