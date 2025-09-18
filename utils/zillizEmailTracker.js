import winston from 'winston';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

export class ZillizEmailTracker {
    constructor() {
        this.client = null;
        this.collectionName = 'email_tracking_events';
        this.initialized = false;
    }

    async initialize() {
        try {
            this.client = new MilvusClient({
                address: process.env.ZILLIZ_ENDPOINT,
                token: process.env.ZILLIZ_TOKEN
            });

            // Check if collection exists
            const collections = await this.client.listCollections();
            const collectionExists = collections.data.some(col => col.name === this.collectionName);

            if (!collectionExists) {
                await this.createCollection();
            }

            this.initialized = true;
            console.log('📊 [ZILLIZ] Email tracking initialized successfully');
        } catch (error) {
            console.error('❌ [ZILLIZ] Initialization failed:', error);
            throw error;
        }
    }

    async createCollection() {
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
                max_length: 500
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

        await this.client.createCollection({
            collection_name: this.collectionName,
            fields: schema,
            description: 'Email tracking events collection'
        });

        console.log('📊 [ZILLIZ] Email tracking collection created');

        // Wait a moment for collection to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create index on vector field for searching
        try {
            await this.client.createIndex({
                collection_name: this.collectionName,
                field_name: 'dummy_vector',
                index_type: 'FLAT',
                metric_type: 'L2'
            });
            console.log('📊 [ZILLIZ] Index created successfully');
        } catch (indexError) {
            console.log('⚠️ [ZILLIZ] Index creation failed (may already exist):', indexError.message);
        }
    }

    async storeTrackingEvent(trackingId, eventType, userAgent, ipAddress, emailAddress) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Debug: Check collection schema first
            try {
                const collectionInfo = await this.client.describeCollection({
                    collection_name: this.collectionName
                });
                console.log(`🔍 [ZILLIZ DEBUG] Collection schema:`, JSON.stringify(collectionInfo.data, null, 2));
            } catch (e) {
                console.log(`🔍 [ZILLIZ DEBUG] Could not get schema:`, e.message);
            }

            const data = [{
                tracking_id: trackingId,
                event_type: eventType,
                timestamp: new Date().toISOString(),
                user_agent: userAgent || 'Unknown',
                ip_address: ipAddress || 'Unknown',
                email_address: emailAddress || 'Unknown',
                recipient: emailAddress || 'unknown@recipient.com',
                processed: false,
                dummy_vector: [0.0, 0.0]
            }];

            console.log(`🔍 [ZILLIZ DEBUG] Attempting to insert:`, JSON.stringify(data[0], null, 2));

            await this.client.insert({
                collection_name: this.collectionName,
                data: data
            });

            console.log(`📧 [ZILLIZ] Stored tracking event: ${trackingId} - ${eventType}`);
            return true;
        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to store tracking event:', error);
            return false;
        }
    }

    async getTrackingEvents() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Load collection into memory for querying
            await this.client.loadCollection({
                collection_name: this.collectionName
            });

            // Query all events without field filtering (more reliable)
            const results = await this.client.query({
                collection_name: this.collectionName,
                limit: 1000
            });

            console.log(`📊 [ZILLIZ] Retrieved ${results.data?.length || 0} tracking events`);
            return results.data || [];

        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to get tracking events:', error);
            return [];
        }
    }

    async getEventsByTrackingId(trackingId) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const results = await this.client.query({
                collection_name: this.collectionName,
                expr: `tracking_id == "${trackingId}"`,
                output_fields: ['tracking_id', 'event_type', 'timestamp', 'user_agent', 'ip_address', 'email_address'],
                limit: 100
            });

            return results.data || [];
        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to get events by tracking ID:', error);
            return [];
        }
    }

    // Clear all tracking events from Zilliz
    async clearAllTrackingEvents() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log('🗑️ [ZILLIZ] Clearing all tracking events...');

            // The most reliable way to clear all data is to recreate the collection
            await this.recreateCollection();

            console.log('✅ [ZILLIZ] All tracking events cleared successfully');
            return true;

        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to clear tracking events:', error);
            return false;
        }
    }

    // Recreate collection with updated schema
    async recreateCollection() {
        try {
            console.log('🔄 [ZILLIZ] Recreating collection with updated schema...');
            
            // Drop the existing collection
            await this.client.dropCollection({
                collection_name: this.collectionName
            });
            
            console.log('🗑️ [ZILLIZ] Dropped existing collection');
            
            // Create new collection with updated schema
            await this.createCollection();
            
            console.log('✅ [ZILLIZ] Collection recreated successfully');
            return true;

        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to recreate collection:', error);
            return false;
        }
    }

    async createRepliesCollection() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const repliesCollectionName = 'email_replies_v2';
            
            // Check if collection exists first
            try {
                await this.client.describeCollection({ collection_name: repliesCollectionName });
                console.log('📊 [ZILLIZ] Replies collection already exists');
                return true;
            } catch (e) {
                console.log('📊 [ZILLIZ] Creating new replies collection...');
            }

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
                    name: 'from_email',
                    data_type: DataType.VarChar,
                    max_length: 200
                },
                {
                    name: 'subject',
                    data_type: DataType.VarChar,
                    max_length: 500
                },
                {
                    name: 'content',
                    data_type: DataType.VarChar,
                    max_length: 5000
                },
                {
                    name: 'timestamp',
                    data_type: DataType.VarChar,
                    max_length: 50
                },
                {
                    name: 'sentiment',
                    data_type: DataType.VarChar,
                    max_length: 50
                },
                {
                    name: 'intent',
                    data_type: DataType.VarChar,
                    max_length: 100
                },
                {
                    name: 'ai_response',
                    data_type: DataType.VarChar,
                    max_length: 5000
                },
                {
                    name: 'ai_response_sent',
                    data_type: DataType.Bool
                },
                {
                    name: 'ai_response_timestamp',
                    data_type: DataType.VarChar,
                    max_length: 50
                },
                {
                    name: 'ai_response_message_id',
                    data_type: DataType.VarChar,
                    max_length: 200
                },
                {
                    name: 'dummy_vector',
                    data_type: DataType.FloatVector,
                    dim: 2
                }
            ];

            await this.client.createCollection({
                collection_name: repliesCollectionName,
                fields: schema,
                description: 'Email replies with AI responses'
            });

            console.log('📊 [ZILLIZ] Replies collection created successfully');
            return true;

        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to create replies collection:', error);
            return false;
        }
    }
}

// Export is already handled at the class declaration