import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import fs from 'fs/promises';
import path from 'path';

export class ZillizReplyTracker {
    constructor() {
        this.client = null;
        this.collectionName = 'email_tracking_events';  // Use same collection as tracking
        this.initialized = false;
    }

    async initialize() {
        try {
            this.client = new MilvusClient({
                address: process.env.ZILLIZ_ENDPOINT,
                token: process.env.ZILLIZ_TOKEN
            });

            // Use existing email_tracking_events collection - no need to create
            this.initialized = true;
            console.log('💬 [ZILLIZ REPLY] Reply tracking initialized (using email_tracking_events collection)');
        } catch (error) {
            console.error('❌ [ZILLIZ REPLY] Initialization failed:', error);
            throw error;
        }
    }

    async createReplyCollection() {
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
                name: 'reply_id',
                data_type: DataType.VarChar,
                max_length: 200
            },
            {
                name: 'from_email',
                data_type: DataType.VarChar,
                max_length: 255
            },
            {
                name: 'subject',
                data_type: DataType.VarChar,
                max_length: 500
            },
            {
                name: 'reply_content',
                data_type: DataType.VarChar,
                max_length: 10000
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
                name: 'reply_type',
                data_type: DataType.VarChar,
                max_length: 50
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
            fields: schema
        });

        await this.client.createIndex({
            collection_name: this.collectionName,
            field_name: 'dummy_vector',
            index_type: 'IVF_FLAT',
            metric_type: 'L2',
            params: { nlist: 1024 }
        });

        console.log('📊 [ZILLIZ REPLY] Reply collection created successfully');
    }

    async logReply(replyData) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Analyze reply sentiment and type
            const analysis = await this.analyzeReply(replyData.content);

            // Extract user_id and agent_id from tracking_id
            const extractIdsFromTrackingId = (trackingId) => {
                if (!trackingId) return { userId: 'unknown', agentId: 'unknown' };
                // Format: tracking-{userId}_{agentId}_{timestamp}_{hash}
                const match = trackingId.match(/tracking-([a-f0-9-]+)_([^_]+)_/);
                return match ? { userId: match[1], agentId: match[2] } : { userId: 'unknown', agentId: 'unknown' };
            };

            const { userId, agentId } = extractIdsFromTrackingId(replyData.trackingId);

            // Insert into email_tracking_events with event_type='email_reply'
            const data = [{
                tracking_id: replyData.trackingId,
                user_id: userId,
                agent_id: agentId,
                event_type: 'email_reply',
                timestamp: new Date().toISOString(),
                user_agent: 'Reply via Email',
                ip_address: 'N/A',
                email_address: replyData.from,
                recipient: replyData.from,
                processed: false,
                dummy_vector: [0.0, 0.0]
            }];

            await this.client.insert({
                collection_name: this.collectionName,
                data: data
            });

            console.log(`💬 [ZILLIZ REPLY] Reply logged for tracking ${replyData.trackingId} (user: ${userId}, agent: ${agentId}): ${analysis.sentiment} ${analysis.type}`);
            
            // Also save to local file for backup
            await this.saveLocalReply(replyData, analysis);

            return { success: true, analysis };
        } catch (error) {
            console.error('❌ [ZILLIZ REPLY] Error logging reply:', error);
            return { success: false, error: error.message };
        }
    }

    async analyzeReply(content) {
        // Simple sentiment and type analysis
        const lowerContent = content.toLowerCase();
        
        // Sentiment analysis (basic)
        let sentiment = 'neutral';
        const positiveWords = ['yes', 'interested', 'thank', 'great', 'good', 'love', 'excellent', 'amazing', 'perfect'];
        const negativeWords = ['no', 'not interested', 'stop', 'unsubscribe', 'spam', 'remove', 'dont', 'bad', 'terrible'];
        
        const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
        
        if (positiveCount > negativeCount && positiveCount > 0) {
            sentiment = 'positive';
        } else if (negativeCount > positiveCount && negativeCount > 0) {
            sentiment = 'negative';
        }

        // Reply type analysis
        let type = 'general';
        if (lowerContent.includes('unsubscribe') || lowerContent.includes('stop') || lowerContent.includes('remove')) {
            type = 'unsubscribe';
        } else if (lowerContent.includes('interested') || lowerContent.includes('yes') || lowerContent.includes('tell me more')) {
            type = 'interested';
        } else if (lowerContent.includes('not interested') || lowerContent.includes('no thanks')) {
            type = 'not_interested';
        } else if (lowerContent.includes('meeting') || lowerContent.includes('call') || lowerContent.includes('schedule')) {
            type = 'meeting_request';
        } else if (lowerContent.includes('question') || lowerContent.includes('?')) {
            type = 'question';
        }

        return { sentiment, type };
    }

    async saveLocalReply(replyData, analysis) {
        try {
            const logPath = path.join(process.cwd(), 'email_replies.json');
            let replies = [];
            
            try {
                const existingData = await fs.readFile(logPath, 'utf8');
                replies = JSON.parse(existingData);
            } catch (error) {
                // File doesn't exist, start with empty array
            }
            
            const replyEntry = {
                ...replyData,
                timestamp: new Date().toISOString(),
                analysis: analysis
            };
            
            replies.push(replyEntry);
            await fs.writeFile(logPath, JSON.stringify(replies, null, 2));
            
            console.log(`💬 [LOCAL REPLY] Saved reply locally: ${replyData.id}`);
        } catch (error) {
            console.error('❌ [LOCAL REPLY] Error saving local reply:', error);
        }
    }

    async getReplyStats(trackingId = null) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Get all replies or for specific tracking ID
            const results = await this.client.search({
                collection_name: this.collectionName,
                vectors: [[0.0, 0.0]],
                search_params: { nprobe: 1 },
                output_fields: ['tracking_id', 'sentiment', 'reply_type', 'timestamp'],
                limit: 1000
            });

            let filteredResults = results.results;
            if (trackingId) {
                filteredResults = results.results.filter(r => r.tracking_id === trackingId);
            }

            const stats = {
                totalReplies: filteredResults.length,
                positive: filteredResults.filter(r => r.sentiment === 'positive').length,
                negative: filteredResults.filter(r => r.sentiment === 'negative').length,
                neutral: filteredResults.filter(r => r.sentiment === 'neutral').length,
                interested: filteredResults.filter(r => r.reply_type === 'interested').length,
                unsubscribes: filteredResults.filter(r => r.reply_type === 'unsubscribe').length,
                meetingRequests: filteredResults.filter(r => r.reply_type === 'meeting_request').length
            };

            return stats;
        } catch (error) {
            console.error('❌ [ZILLIZ REPLY] Error getting reply stats:', error);
            return null;
        }
    }
}

export const replyTracker = new ZillizReplyTracker();
