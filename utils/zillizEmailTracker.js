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
            // Reduced logging - only log once per process startup
            if (!global.zillizInitLogged) {
                console.log('📊 [ZILLIZ] Email tracking initialized successfully');
                global.zillizInitLogged = true;
            }
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

    async storeTrackingEvent(trackingId, eventType, userAgent, ipAddress, emailAddress, isImageProxy = false, userId = null, agentId = null) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Skip storing image proxy requests for email_open events to avoid false positives
            if (eventType === 'email_open' && isImageProxy) {
                console.log(`🤖 [ZILLIZ] Skipping image proxy request for: ${trackingId}`);
                return true;
            }

            // Extract user ID and agent ID from tracking ID if not provided
            if (!userId || !agentId) {
                const extractIdsFromTrackingId = (tid) => {
                    if (!tid) return { userId: 'unknown', agentId: 'unknown' };
                    // Format: tracking-{userId}_{agentId}_{timestamp}_{hash}
                    const match = tid.match(/tracking-([a-f0-9-]+)_([^_]+)_/);
                    return match ? { userId: match[1], agentId: match[2] } : { userId: 'unknown', agentId: 'unknown' };
                };
                const extracted = extractIdsFromTrackingId(trackingId);
                userId = userId || extracted.userId;
                agentId = agentId || extracted.agentId;
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
                user_id: userId || 'unknown',
                agent_id: agentId || 'unknown',
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

            // Query all events with explicit field selection to ensure user_agent is included
            const results = await this.client.query({
                collection_name: this.collectionName,
                output_fields: ['tracking_id', 'event_type', 'timestamp', 'user_agent', 'ip_address', 'email_address', 'recipient', 'processed'],
                limit: 1000
            });

            console.log(`📊 [ZILLIZ] Retrieved ${results.data?.length || 0} tracking events`);
            return results.data || [];

        } catch (error) {
            console.error('❌ [ZILLIZ] Failed to get tracking events:', error);
            return [];
        }
    }

    async getTrackingEventsByUserId(userId, agentId = null) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Load collection into memory for querying
            await this.client.loadCollection({
                collection_name: this.collectionName
            });

            // Extract 8-character user code from full userId (tracking IDs use first 8 chars)
            const userCode = userId.substring(0, 8);
            
            let expr;
            let context;
            
            if (!agentId) {
                console.log(`⚠️ [ZILLIZ] Warning: getTrackingEventsByUserId called without agentId for user ${userId}`);
                return [];
            }
            
            // Filter by both user code and agent ID in tracking_id pattern
            expr = `tracking_id like "tracking-${userCode}_${agentId}_%"`;
            context = `user ${userId} (${userCode}), agent ${agentId}`;
            
            // Query events filtered by userCode and optionally agentId pattern in tracking_id
            const results = await this.client.query({
                collection_name: this.collectionName,
                expr: expr,
                output_fields: ['tracking_id', 'event_type', 'timestamp', 'user_agent', 'ip_address', 'email_address', 'recipient', 'processed'],
                limit: 1000
            });

            // Only log if there are events (reduce polling noise)
            if (results.data?.length > 0) {
                console.log(`📊 [ZILLIZ] Retrieved ${results.data.length} tracking events for ${context}`);
            }
            return results.data || [];

        } catch (error) {
            console.error(`❌ [ZILLIZ] Failed to get tracking events for user ${userId}:`, error);
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

    // Clear tracking events for a specific user (based on user ID in tracking ID)
    async clearUserTrackingEvents(userId) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Extract first 8 characters of user ID for matching tracking IDs
            const userCode = userId.substring(0, 8);
            console.log(`🗑️ [ZILLIZ] Clearing tracking events for user: ${userCode}...`);

            // Delete all events where tracking_id starts with "tracking-{userCode}_"
            const deleteResult = await this.client.delete({
                collection_name: this.collectionName,
                filter: `tracking_id like "tracking-${userCode}_%"`
            });

            console.log(`✅ [ZILLIZ] Cleared ${deleteResult.delete_count || 'unknown number of'} tracking events for user ${userCode}`);
            return true;

        } catch (error) {
            console.error(`❌ [ZILLIZ] Failed to clear tracking events for user:`, error);
            return false;
        }
    }

    // Clear all tracking events from Zilliz (admin function - drops entire collection)
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

    // Get scheduled calendar events for a specific user and optionally agent
    async getScheduledEventsByUserId(userId, agentId = null) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Load email tracking events collection into memory for querying
            await this.client.loadCollection({
                collection_name: this.collectionName
            });

            // Extract 8-character user code from full userId (same as tracking events)
            const userCode = userId.substring(0, 8);

            let expr;
            let context;
            
            if (!agentId) {
                console.log(`⚠️ [ZILLIZ] Warning: getScheduledEventsByUserId called without agentId for user ${userId}`);
                return [];
            }
            
            // Filter by both user code and agent ID for calendar events
            expr = `tracking_id like "calendar-${userCode}_${agentId}%" && event_type == "calendar_event_scheduled"`;
            context = `user ${userId} (${userCode}), agent ${agentId}`;

            // Query scheduled events filtered by tracking_id pattern and event_type
            const results = await this.client.query({
                collection_name: this.collectionName,
                expr: expr,
                output_fields: ['id', 'tracking_id', 'event_type', 'timestamp', 'user_agent', 'email_address', 'recipient', 'processed', 'agent_id'],
                limit: 1000
            });

            // Only log if there are events (reduce polling noise)
            if (results.data?.length > 0) {
                console.log(`📅 [ZILLIZ] Retrieved ${results.data.length} scheduled events for ${context}`);
            }
            return results.data || [];

        } catch (error) {
            console.error(`❌ [ZILLIZ] Failed to get scheduled events for user ${userId}:`, error);
            return [];
        }
    }
}

// Export is already handled at the class declaration