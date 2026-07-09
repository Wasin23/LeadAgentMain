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
        this.rubricCollectionName = 'lead_qualification_rubrics';
        this.initialized = false;
        this.rubricInitialized = false;
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

    /**
     * Separate lazy-init path for the qualification-rubric collection — most agents
     * never need it (only combos without a cached rubric trigger this), so it isn't
     * created/loaded on every agent startup like the main memory collection.
     */
    async initializeRubrics() {
        if (this.rubricInitialized) return;
        try {
            if (!this.client) {
                this.client = new MilvusClient({
                    address: process.env.ZILLIZ_ENDPOINT,
                    token: process.env.ZILLIZ_TOKEN
                });
            }

            const collections = await this.client.listCollections();
            const collectionExists = collections.data.some(col => col.name === this.rubricCollectionName);

            if (!collectionExists) {
                await this.createRubricCollection();
            } else {
                console.log('ℹ️  [ZILLIZ RUBRIC] Collection already exists, skipping creation');
            }

            this.rubricInitialized = true;
            console.log('🧠 [ZILLIZ RUBRIC] Qualification rubric memory initialized');
        } catch (error) {
            console.error('❌ [ZILLIZ RUBRIC] Initialization failed:', error);
            throw error;
        }
    }

    async createRubricCollection() {
        console.log('📊 [ZILLIZ RUBRIC] Creating lead_qualification_rubrics collection...');

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
                description: 'User ID'
            },
            {
                name: 'agent_id',
                data_type: DataType.VarChar,
                max_length: 100,
                description: 'Agent ID that generated this rubric'
            },
            {
                name: 'keyword',
                data_type: DataType.VarChar,
                max_length: 100
            },
            {
                name: 'position',
                data_type: DataType.VarChar,
                max_length: 100
            },
            {
                name: 'search_combo',
                data_type: DataType.VarChar,
                max_length: 200,
                description: 'keyword#position — same key convention as lead_agent_memory'
            },
            {
                name: 'rubric_json',
                data_type: DataType.VarChar,
                max_length: 30000,
                description: 'JSON-encoded { criteria: [{criterion, weight, justification}], ... }'
            },
            {
                name: 'rubric_version',
                data_type: DataType.Int64,
                description: 'Incremented every time this combo\'s rubric is regenerated'
            },
            {
                name: 'generated_at',
                data_type: DataType.Int64
            },
            {
                name: 'source_instructions_hash',
                data_type: DataType.VarChar,
                max_length: 100,
                description: 'Hash of campaign specialInstructions used to build this rubric — regenerate when this changes'
            },
            {
                name: 'embedding',
                data_type: DataType.FloatVector,
                dim: 1536,
                description: 'Embedding of the ICP/product description this rubric was built for — enables future cross-campaign rubric reuse'
            }
        ];

        await this.client.createCollection({
            collection_name: this.rubricCollectionName,
            schema: schema,
            index_params: {
                field_name: 'embedding',
                metric_type: 'COSINE',
                index_type: 'AUTOINDEX'
            }
        });

        console.log('✅ [ZILLIZ RUBRIC] Collection created successfully');
    }

    /**
     * Fetch the stored qualification rubric for a user+combo, if one exists.
     * Returns null (not an error) when no rubric has been built yet — callers use
     * that as the trigger to run rubric generation before any lead search.
     */
    async getRubric(userId, keyword, position) {
        try {
            await this.initializeRubrics();

            try {
                await this.client.loadCollection({ collection_name: this.rubricCollectionName });
            } catch (loadError) {
                if (!loadError.message?.includes('already loaded')) {
                    console.log('⚠️  [ZILLIZ RUBRIC] Load warning:', loadError.message);
                }
            }

            const searchCombo = `${keyword.toLowerCase()}#${position.toLowerCase()}`;
            const results = await this.client.query({
                collection_name: this.rubricCollectionName,
                filter: `user_id == "${userId}" && search_combo == "${searchCombo}"`,
                output_fields: ['rubric_json', 'rubric_version', 'generated_at', 'source_instructions_hash'],
                limit: 1
            });

            if (!results.data || results.data.length === 0) {
                console.log(`🔍 [ZILLIZ RUBRIC] No rubric found for combo="${searchCombo}"`);
                return null;
            }

            const record = results.data[0];
            const parsed = JSON.parse(record.rubric_json);
            console.log(`🔍 [ZILLIZ RUBRIC] Loaded rubric for combo="${searchCombo}" — v${record.rubric_version}, ${parsed.criteria?.length || 0} criteria`);
            return {
                ...parsed,
                version: record.rubric_version,
                generatedAt: record.generated_at,
                sourceInstructionsHash: record.source_instructions_hash
            };
        } catch (error) {
            console.error('❌ [ZILLIZ RUBRIC] getRubric failed:', error);
            return null;
        }
    }

    /**
     * Store (or replace) the qualification rubric for a user+combo. Always deletes
     * any prior record for this exact combo first — a combo has exactly one active
     * rubric at a time, versioned via rubric_version for outcome-attribution later.
     */
    async storeRubric(userId, agentId, keyword, position, rubric, sourceInstructionsHash, icpDescription = '') {
        try {
            await this.initializeRubrics();

            const searchCombo = `${keyword.toLowerCase()}#${position.toLowerCase()}`;

            const existing = await this.client.query({
                collection_name: this.rubricCollectionName,
                filter: `user_id == "${userId}" && search_combo == "${searchCombo}"`,
                output_fields: ['id', 'rubric_version'],
                limit: 1
            });

            const nextVersion = (existing.data && existing.data.length > 0)
                ? (parseInt(existing.data[0].rubric_version) || 0) + 1
                : 1;

            if (existing.data && existing.data.length > 0) {
                console.log(`🗑️ [ZILLIZ RUBRIC] Replacing existing rubric for combo="${searchCombo}" (v${existing.data[0].rubric_version} → v${nextVersion})`);
                await this.client.delete({
                    collection_name: this.rubricCollectionName,
                    filter: `id == ${existing.data[0].id}`
                });
            }

            const embedding = await this.generateEmbedding(keyword, position, { icpDescription });

            await this.client.insert({
                collection_name: this.rubricCollectionName,
                data: [{
                    user_id: userId,
                    agent_id: agentId,
                    keyword: keyword.toLowerCase(),
                    position: position,
                    search_combo: searchCombo,
                    rubric_json: JSON.stringify(rubric),
                    rubric_version: nextVersion,
                    generated_at: Date.now(),
                    source_instructions_hash: sourceInstructionsHash || '',
                    embedding: embedding
                }]
            });

            await this.client.flush({ collection_names: [this.rubricCollectionName] });

            console.log(`✅ [ZILLIZ RUBRIC] Stored rubric v${nextVersion} for combo="${searchCombo}": ${rubric.criteria?.length || 0} criteria`);
            return { success: true, version: nextVersion };
        } catch (error) {
            console.error('❌ [ZILLIZ RUBRIC] storeRubric failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all rubrics for a user (for the settings UI — one row per combo).
     */
    async listRubrics(userId) {
        try {
            await this.initializeRubrics();

            try {
                await this.client.loadCollection({ collection_name: this.rubricCollectionName });
            } catch (loadError) {
                if (!loadError.message?.includes('already loaded')) {
                    console.log('⚠️  [ZILLIZ RUBRIC] Load warning:', loadError.message);
                }
            }

            const results = await this.client.query({
                collection_name: this.rubricCollectionName,
                filter: `user_id == "${userId}"`,
                output_fields: ['keyword', 'position', 'search_combo', 'rubric_json', 'rubric_version', 'generated_at'],
                limit: 1000
            });

            return {
                success: true,
                rubrics: (results.data || []).map(r => ({
                    keyword: r.keyword,
                    position: r.position,
                    searchCombo: r.search_combo,
                    version: r.rubric_version,
                    generatedAt: r.generated_at,
                    ...JSON.parse(r.rubric_json)
                }))
            };
        } catch (error) {
            console.error('❌ [ZILLIZ RUBRIC] listRubrics failed:', error);
            return { success: false, error: error.message, rubrics: [] };
        }
    }

    /**
     * Delete the stored rubric for a combo — used by the settings "reset to
     * auto-generated" action, which forces regeneration on the next search.
     */
    async deleteRubric(userId, keyword, position) {
        try {
            await this.initializeRubrics();
            const searchCombo = `${keyword.toLowerCase()}#${position.toLowerCase()}`;
            const result = await this.client.delete({
                collection_name: this.rubricCollectionName,
                filter: `user_id == "${userId}" && search_combo == "${searchCombo}"`
            });
            console.log(`🗑️ [ZILLIZ RUBRIC] Deleted rubric for combo="${searchCombo}"`);
            return { success: true, deletedCount: result.delete_cnt || 0 };
        } catch (error) {
            console.error('❌ [ZILLIZ RUBRIC] deleteRubric failed:', error);
            return { success: false, error: error.message };
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
            
            console.log(`📝 [STORE] Called with: userId=${userId}, agentId=${agentId}, keyword=${keyword}, position=${position}, attempts=${attempts}, duplicates=${duplicates}, source=${source}`);

            // Ensure collection is loaded
            try {
                console.log('🔄 [STORE] Loading collection...');
                await this.client.loadCollection({ collection_name: this.collectionName });
                console.log('✅ [STORE] Collection loaded');
            } catch (loadError) {
                // Collection might already be loaded, ignore error
                if (!loadError.message?.includes('already loaded')) {
                    console.log('⚠️  [MEMORY] Load warning:', loadError.message);
                }
            }

            const searchCombo = `${keyword.toLowerCase()}#${position.toLowerCase()}`;
            const cumulativeRate = attempts > 0 ? (duplicates / attempts) * 100 : 0;
            const isExhausted = cumulativeRate > 50 && attempts >= 5;

            console.log(`🔍 [STORE] searchCombo=${searchCombo}, cumulativeRate=${cumulativeRate.toFixed(1)}%, isExhausted=${isExhausted}`);

            // Check if record exists for this user + combo
            console.log(`🔍 [STORE] Checking for existing record: userId="${userId}" && searchCombo="${searchCombo}"`);
            const existingQuery = await this.client.query({
                collection_name: this.collectionName,
                filter: `user_id == "${userId}" && search_combo == "${searchCombo}"`,
                output_fields: ['id', 'total_attempts', 'total_duplicates'],
                limit: 1
            });
            
            console.log(`📊 [STORE] Existing query result: found ${existingQuery.data?.length || 0} records`);
            if (existingQuery.data && existingQuery.data.length > 0) {
                console.log(`📊 [STORE] Existing record data:`, JSON.stringify(existingQuery.data[0]));
            }

            if (existingQuery.data && existingQuery.data.length > 0) {
                // Update existing record (cumulative across all agents for this user)
                console.log('🔄 [STORE] Updating existing record...');
                const existing = existingQuery.data[0];
                const newTotalAttempts = parseInt(existing.total_attempts) + attempts;
                const newTotalDuplicates = parseInt(existing.total_duplicates) + duplicates;
                const newCumulativeRate = (newTotalDuplicates / newTotalAttempts) * 100;
                const newIsExhausted = newCumulativeRate > 50 && newTotalAttempts >= 5;

                console.log(`📊 [STORE] Cumulative: attempts ${existing.total_attempts}+${attempts}=${newTotalAttempts}, duplicates ${existing.total_duplicates}+${duplicates}=${newTotalDuplicates}, rate ${newCumulativeRate.toFixed(1)}%`);

                // Delete old record
                console.log(`🗑️ [STORE] Deleting old record id=${existing.id}...`);
                const deleteResult = await this.client.delete({
                    collection_name: this.collectionName,
                    filter: `id == ${existing.id}`
                });
                console.log(`✅ [STORE] Delete result:`, JSON.stringify(deleteResult));

                // Generate embedding with updated context
                console.log('🧬 [STORE] Generating embedding...');
                const embedding = await this.generateEmbedding(keyword, position, {
                    duplicateRate: newCumulativeRate,
                    attempts: newTotalAttempts,
                    exhausted: newIsExhausted
                });
                console.log(`✅ [STORE] Embedding generated, length=${embedding.length}`);

                // Insert updated record
                console.log('📝 [STORE] Inserting updated record...');
                const insertResult = await this.client.insert({
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
                console.log(`✅ [STORE] Insert result:`, JSON.stringify(insertResult));

                // Flush to ensure data is persisted immediately
                console.log('🔄 [FLUSH] Flushing data to Zilliz...');
                const flushResult = await this.client.flush({ collection_names: [this.collectionName] });
                console.log('✅ [FLUSH] Flush result:', JSON.stringify(flushResult));

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
                console.log('📝 [STORE] Creating new record (no existing found)...');
                console.log('🧬 [STORE] Generating embedding...');
                const embedding = await this.generateEmbedding(keyword, position, {
                    duplicateRate: cumulativeRate,
                    attempts: attempts,
                    exhausted: isExhausted
                });
                console.log(`✅ [STORE] Embedding generated, length=${embedding.length}`);

                console.log('📝 [STORE] Inserting new record...');
                const insertResult = await this.client.insert({
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
                console.log(`✅ [STORE] Insert result:`, JSON.stringify(insertResult));

                // Flush to ensure data is persisted immediately
                console.log('🔄 [FLUSH] Flushing data to Zilliz...');
                const flushResult = await this.client.flush({ collection_names: [this.collectionName] });
                console.log('✅ [FLUSH] Flush result:', JSON.stringify(flushResult));

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
            console.error('❌ [MEMORY STORE] Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
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
                    // KEY: use search_combo (keyword#position) not keyword alone.
                    // A keyword can have multiple positions (e.g. "SaaS / Founder" AND
                    // "SaaS / CEO"). Keying by keyword would make each combo overwrite
                    // the previous one, silently dropping all but the last record.
                    // The agent startup aggregates by keyword separately.
                    performanceMap[item.search_combo] = {
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
                ? results.data.reduce((sum, r) => sum + (parseFloat(r.cumulative_duplicate_rate) || 0), 0) / total 
                : 0;
            const totalAttempts = results.data?.reduce((sum, r) => sum + (parseInt(r.total_attempts) || 0), 0) || 0;

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
