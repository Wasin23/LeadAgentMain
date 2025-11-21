import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import OpenAI from 'openai';

/**
 * ZillizLeadMemory - RAG system for long-term agent memory
 * Stores keyword performance, duplicate rates, and lead patterns
 * Enables agents to learn and optimize across restarts
 */
export class ZillizLeadMemory {
    constructor() {
        this.client = null;
        this.collectionName = 'lead_agent_memory';
        this.initialized = false;
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
            } else {
                console.log('ℹ️  [ZILLIZ MEMORY] Collection already exists, skipping creation');
            }

            this.initialized = true;
            console.log('🧠 [ZILLIZ MEMORY] Lead agent memory initialized');
        } catch (error) {
            console.error('❌ [ZILLIZ MEMORY] Initialization failed:', error);
            throw error;
        }
    }

    async createCollection() {
        console.log('📊 [ZILLIZ MEMORY] Creating lead_agent_memory collection...');
        
        const schema = [
            {
                name: 'id',
                data_type: DataType.Int64,
                is_primary_key: true,
                autoID: true
            },
            {
                name: 'user_id',
                data_type: DataType.VarChar,
                max_length: 100,
                description: 'User ID - all agents for this user share memory'
            },
            {
                name: 'agent_id',
                data_type: DataType.VarChar,
                max_length: 100,
                description: 'Agent ID that recorded this data'
            },
            {
                name: 'keyword',
                data_type: DataType.VarChar,
                max_length: 100,
                description: 'Industry keyword (e.g., "technology", "healthcare")'
            },
            {
                name: 'position',
                data_type: DataType.VarChar,
                max_length: 100,
                description: 'Position title (e.g., "CEO", "CTO")'
            },
            {
                name: 'search_combo',
                data_type: DataType.VarChar,
                max_length: 200,
                description: 'Combined keyword+position for exact matching'
            },
            {
                name: 'total_attempts',
                data_type: DataType.Int64,
                description: 'Total leads searched with this keyword'
            },
            {
                name: 'total_duplicates',
                data_type: DataType.Int64,
                description: 'Total duplicates found with this keyword'
            },
            {
                name: 'cumulative_duplicate_rate',
                data_type: DataType.Float,
                description: 'Percentage of duplicates (0-100)'
            },
            {
                name: 'last_updated',
                data_type: DataType.Int64,
                description: 'Timestamp of last update'
            },
            {
                name: 'is_exhausted',
                data_type: DataType.Bool,
                description: 'True if duplicate rate > 50%'
            },
            {
                name: 'keyword_source',
                data_type: DataType.VarChar,
                max_length: 50,
                description: 'Source: base, ai, campaign'
            },
            {
                name: 'embedding',
                data_type: DataType.FloatVector,
                dim: 1536, // OpenAI text-embedding-3-small dimension
                description: 'Semantic embedding of keyword+position+context'
            }
        ];

        await this.client.createCollection({
            collection_name: this.collectionName,
            schema: schema,
            index_params: {
                field_name: 'embedding',
                metric_type: 'COSINE',
                index_type: 'AUTOINDEX'
            }
        });

        console.log('✅ [ZILLIZ MEMORY] Collection created successfully');
    }

    /**
     * Generate embedding for keyword+position combination
     */
    async generateEmbedding(keyword, position, context = {}) {
        try {
            const text = `Keyword: ${keyword}, Position: ${position}, Context: ${JSON.stringify(context)}`;
            
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text
            });

            return response.data[0].embedding;
        } catch (error) {
            console.error('❌ [EMBEDDING] Failed to generate:', error);
            // Return zero vector as fallback
            return new Array(1536).fill(0);
        }
    }

    /**
     * Store or update keyword performance data
     */
    async storeKeywordPerformance(userId, agentId, keyword, position, attempts, duplicates, source = 'base') {
        try {
            if (!this.initialized) await this.initialize();

            // Ensure collection is loaded
            try {
                await this.client.loadCollection({ collection_name: this.collectionName });
            } catch (loadError) {
                // Collection might already be loaded, ignore error
                if (!loadError.message?.includes('already loaded')) {
                    console.log('⚠️  [MEMORY] Load warning:', loadError.message);
                }
            }

            const searchCombo = `${keyword.toLowerCase()}#${position.toLowerCase()}`;
            const cumulativeRate = attempts > 0 ? (duplicates / attempts) * 100 : 0;
            const isExhausted = cumulativeRate > 50 && attempts >= 5;

            // Check if record exists for this user + combo
            const existingQuery = await this.client.query({
                collection_name: this.collectionName,
                filter: `user_id == "${userId}" && search_combo == "${searchCombo}"`,
                output_fields: ['id', 'total_attempts', 'total_duplicates'],
                limit: 1
            });

            if (existingQuery.data && existingQuery.data.length > 0) {
                // Update existing record (cumulative across all agents for this user)
                const existing = existingQuery.data[0];
                const newTotalAttempts = existing.total_attempts + attempts;
                const newTotalDuplicates = existing.total_duplicates + duplicates;
                const newCumulativeRate = (newTotalDuplicates / newTotalAttempts) * 100;
                const newIsExhausted = newCumulativeRate > 50 && newTotalAttempts >= 5;

                // Delete old record
                await this.client.delete({
                    collection_name: this.collectionName,
                    filter: `id == ${existing.id}`
                });

                // Generate embedding with updated context
                const embedding = await this.generateEmbedding(keyword, position, {
                    duplicateRate: newCumulativeRate,
                    attempts: newTotalAttempts,
                    exhausted: newIsExhausted
                });

                // Insert updated record
                await this.client.insert({
                    collection_name: this.collectionName,
                    data: [{
                        user_id: userId,
                        agent_id: agentId,
                        keyword: keyword.toLowerCase(),
                        position: position,
                        search_combo: searchCombo,
                        total_attempts: newTotalAttempts,
                        total_duplicates: newTotalDuplicates,
                        cumulative_duplicate_rate: newCumulativeRate,
                        last_updated: Date.now(),
                        is_exhausted: newIsExhausted,
                        keyword_source: source,
                        embedding: embedding
                    }]
                });

                // Flush to ensure data is persisted immediately
                await this.client.flush({ collection_names: [this.collectionName] });

                console.log(`🔄 [MEMORY UPDATE] ${keyword}+${position}: ${newTotalAttempts} attempts, ${newCumulativeRate.toFixed(1)}% duplicates (${newIsExhausted ? 'EXHAUSTED' : 'OK'})`);
                
                return {
                    success: true,
                    totalAttempts: newTotalAttempts,
                    totalDuplicates: newTotalDuplicates,
                    cumulativeRate: newCumulativeRate,
                    isExhausted: newIsExhausted
                };
            } else {
                // Create new record
                const embedding = await this.generateEmbedding(keyword, position, {
                    duplicateRate: cumulativeRate,
                    attempts: attempts,
                    exhausted: isExhausted
                });

                await this.client.insert({
                    collection_name: this.collectionName,
                    data: [{
                        user_id: userId,
                        agent_id: agentId,
                        keyword: keyword.toLowerCase(),
                        position: position,
                        search_combo: searchCombo,
                        total_attempts: attempts,
                        total_duplicates: duplicates,
                        cumulative_duplicate_rate: cumulativeRate,
                        last_updated: Date.now(),
                        is_exhausted: isExhausted,
                        keyword_source: source,
                        embedding: embedding
                    }]
                });

                // Flush to ensure data is persisted immediately
                await this.client.flush({ collection_names: [this.collectionName] });

                console.log(`💾 [MEMORY NEW] ${keyword}+${position}: ${attempts} attempts, ${cumulativeRate.toFixed(1)}% duplicates`);
                
                return {
                    success: true,
                    totalAttempts: attempts,
                    totalDuplicates: duplicates,
                    cumulativeRate: cumulativeRate,
                    isExhausted: isExhausted
                };
            }
        } catch (error) {
            console.error('❌ [MEMORY STORE] Failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load keyword performance for a user (across all their agents)
     * Returns map of keyword -> performance stats
     */
    async loadKeywordPerformance(userId) {
        try {
            if (!this.initialized) await this.initialize();

            // Ensure collection is loaded
            try {
                await this.client.loadCollection({ collection_name: this.collectionName });
            } catch (loadError) {
                if (!loadError.message?.includes('already loaded')) {
                    console.log('⚠️  [MEMORY] Load warning:', loadError.message);
                }
            }

            const results = await this.client.query({
                collection_name: this.collectionName,
                filter: `user_id == "${userId}"`,
                output_fields: ['keyword', 'position', 'search_combo', 'total_attempts', 'total_duplicates', 'cumulative_duplicate_rate', 'is_exhausted', 'keyword_source', 'last_updated'],
                limit: 1000 // Load up to 1000 keywords
            });

            const performanceMap = {};
            
            if (results.data && results.data.length > 0) {
                results.data.forEach(item => {
                    performanceMap[item.keyword] = {
                        keyword: item.keyword,
                        position: item.position,
                        searchCombo: item.search_combo,
                        totalAttempts: item.total_attempts,
                        totalDuplicates: item.total_duplicates,
                        cumulativeDuplicateRate: item.cumulative_duplicate_rate,
                        isExhausted: item.is_exhausted,
                        keywordSource: item.keyword_source,
                        lastUpdated: item.last_updated
                    };
                });

                console.log(`🧠 [MEMORY LOAD] Loaded ${results.data.length} keyword performance records for user ${userId}`);
            } else {
                console.log(`🧠 [MEMORY LOAD] No existing memory for user ${userId}, starting fresh`);
            }

            return {
                success: true,
                performanceMap: performanceMap,
                count: results.data?.length || 0
            };
        } catch (error) {
            console.error('❌ [MEMORY LOAD] Failed:', error);
            return { success: false, error: error.message, performanceMap: {} };
        }
    }

    /**
     * Query for similar keywords using semantic search
     * Useful for finding related exhausted keywords
     */
    async querySimilarKeywords(userId, keyword, position, topK = 10) {
        try {
            if (!this.initialized) await this.initialize();

            // Ensure collection is loaded
            try {
                await this.client.loadCollection({ collection_name: this.collectionName });
            } catch (loadError) {
                if (!loadError.message?.includes('already loaded')) {
                    console.log('⚠️  [MEMORY] Load warning:', loadError.message);
                }
            }

            const embedding = await this.generateEmbedding(keyword, position);

            const results = await this.client.search({
                collection_name: this.collectionName,
                vector: embedding,
                filter: `user_id == "${userId}"`,
                output_fields: ['keyword', 'position', 'cumulative_duplicate_rate', 'is_exhausted'],
                limit: topK
            });

            console.log(`🔍 [MEMORY SEARCH] Found ${results.results?.length || 0} similar keywords`);
            
            return {
                success: true,
                similar: results.results || []
            };
        } catch (error) {
            console.error('❌ [MEMORY SEARCH] Failed:', error);
            return { success: false, error: error.message, similar: [] };
        }
    }

    /**
     * Reset all keyword stats for a user (fresh start)
     */
    async resetUserMemory(userId) {
        try {
            if (!this.initialized) await this.initialize();

            const deleteResult = await this.client.delete({
                collection_name: this.collectionName,
                filter: `user_id == "${userId}"`
            });

            console.log(`🗑️ [MEMORY RESET] Cleared ${deleteResult.delete_cnt || 0} records for user ${userId}`);
            
            return {
                success: true,
                deletedCount: deleteResult.delete_cnt || 0
            };
        } catch (error) {
            console.error('❌ [MEMORY RESET] Failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get memory statistics for a user
     */
    async getMemoryStats(userId) {
        try {
            if (!this.initialized) await this.initialize();

            const results = await this.client.query({
                collection_name: this.collectionName,
                filter: `user_id == "${userId}"`,
                output_fields: ['is_exhausted', 'cumulative_duplicate_rate', 'total_attempts'],
                limit: 10000
            });

            const total = results.data?.length || 0;
            const exhausted = results.data?.filter(r => r.is_exhausted).length || 0;
            const avgDuplicateRate = total > 0 
                ? results.data.reduce((sum, r) => sum + r.cumulative_duplicate_rate, 0) / total 
                : 0;
            const totalAttempts = results.data?.reduce((sum, r) => sum + r.total_attempts, 0) || 0;

            return {
                success: true,
                stats: {
                    totalKeywords: total,
                    exhaustedKeywords: exhausted,
                    avgDuplicateRate: avgDuplicateRate,
                    totalSearchAttempts: totalAttempts
                }
            };
        } catch (error) {
            console.error('❌ [MEMORY STATS] Failed:', error);
            return { success: false, error: error.message };
        }
    }
}

export default ZillizLeadMemory;
