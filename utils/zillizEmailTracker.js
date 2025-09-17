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
                data_type: DataType.Int64
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
            }
        ];

        await this.client.createCollection({
            collection_name: this.collectionName,
            fields: schema,
            description: 'Email tracking events collection'
        });

        console.log('📊 [ZILLIZ] Email tracking collection created');
    }

    async storeTrackingEvent(trackingId, eventType, userAgent, ipAddress, emailAddress) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const data = [{
                tracking_id: trackingId,
                event_type: eventType,
                timestamp: Date.now(),
                user_agent: userAgent || 'Unknown',
                ip_address: ipAddress || 'Unknown',
                email_address: emailAddress || 'Unknown'
            }];

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

            // Delete all data from collection
            await this.client.deleteEntities({
                collection_name: this.collectionName,
                expr: 'id != ""' // This matches all records since all records have an id
            });

            console.log('✅ [ZILLIZ] All tracking events cleared successfully');
            return true;

        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to clear tracking events:', error);
            return false;
        }
    }
}

// Export is already handled at the class declaration