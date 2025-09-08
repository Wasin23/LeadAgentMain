// Zilliz/Milvus integration specifically for AI Training Lab
// Handles training data embeddings, performance analytics, and model optimization

import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getUserSettings } from '../lib/userManager.js';

class ZillizTraining {
  constructor() {
    this.client = null;
    this.embeddings = null;
    this.collectionName = 'ai_training_data';
    this.isConnected = false;
  }

  // Initialize Zilliz connection for training
  async initialize(userId = null) {
    try {
      console.log('🔌 Initializing Zilliz for AI Training Lab...');
      
      // Get connection details from user settings or environment
      const settings = userId ? await getUserSettings(userId) : null;
      const zillizConfig = settings?.vectorStore?.zilliz || {
        endpoint: process.env.ZILLIZ_ENDPOINT,
        token: process.env.ZILLIZ_TOKEN
      };

      if (!zillizConfig.endpoint || !zillizConfig.token) {
        throw new Error('Zilliz endpoint and token are required. Configure in Settings → Vector Database.');
      }

      // Initialize Milvus client
      this.client = new MilvusClient({
        address: zillizConfig.endpoint,
        token: zillizConfig.token
      });

      // Initialize OpenAI embeddings for training data
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: settings?.apiKeys?.openai || process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small' // Cost-effective model for training
      });

      // Test connection
      const health = await this.client.checkHealth();
      if (!health.isHealthy) {
        throw new Error('Zilliz health check failed');
      }

      this.isConnected = true;
      console.log('✅ Zilliz connected successfully for AI Training');

      // Ensure training collection exists
      await this.ensureTrainingCollection();
      
      return { success: true, message: 'Zilliz training initialized' };

    } catch (error) {
      console.error('❌ Zilliz training initialization failed:', error.message);
      this.isConnected = false;
      return { success: false, error: error.message };
    }
  }

  // Create training data collection if it doesn't exist
  async ensureTrainingCollection() {
    try {
      const collections = await this.client.listCollections();
      const exists = collections.collection_names?.includes(this.collectionName);

      if (!exists) {
        console.log('📦 Creating AI training collection...');
        
        await this.client.createCollection({
          collection_name: this.collectionName,
          description: 'AI Training Lab - Performance data and embeddings',
          fields: [
            {
              name: 'id',
              description: 'Training record ID',
              data_type: DataType.VarChar,
              max_length: 100,
              is_primary_key: true
            },
            {
              name: 'embedding',
              description: 'Text embedding vector',
              data_type: DataType.FloatVector,
              dim: 1536 // text-embedding-3-small dimension
            },
            {
              name: 'training_type',
              description: 'Type of training data',
              data_type: DataType.VarChar,
              max_length: 50
            },
            {
              name: 'performance_score',
              description: 'Performance rating score',
              data_type: DataType.Double
            },
            {
              name: 'timestamp',
              description: 'Training timestamp',
              data_type: DataType.Int64
            },
            {
              name: 'user_id',
              description: 'User who created training data',
              data_type: DataType.VarChar,
              max_length: 50
            },
            {
              name: 'metadata',
              description: 'Additional training metadata',
              data_type: DataType.VarChar,
              max_length: 2000
            }
          ]
        });

        // Create index for similarity search
        await this.client.createIndex({
          collection_name: this.collectionName,
          field_name: 'embedding',
          index_type: 'HNSW',
          index_name: 'embedding_index',
          params: { M: 16, efConstruction: 200 }
        });

        console.log('✅ AI training collection created successfully');
      }

      // Load collection for operations
      await this.client.loadCollection({
        collection_name: this.collectionName
      });

    } catch (error) {
      console.error('❌ Error setting up training collection:', error.message);
      throw error;
    }
  }

  // Store training interaction with embedding
  async storeTrainingData(data) {
    try {
      if (!this.isConnected) {
        throw new Error('Zilliz not connected. Initialize first.');
      }

      const { 
        text, 
        trainingType, 
        performanceScore, 
        userId, 
        metadata = {} 
      } = data;

      // Generate embedding for the training text
      const embedding = await this.embeddings.embedQuery(text);
      
      const trainingRecord = {
        id: `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        embedding: embedding,
        training_type: trainingType,
        performance_score: performanceScore,
        timestamp: Date.now(),
        user_id: userId || 'anonymous',
        metadata: JSON.stringify({
          ...metadata,
          text: text.substring(0, 500), // Store truncated text for reference
          original_length: text.length
        })
      };

      await this.client.insert({
        collection_name: this.collectionName,
        data: [trainingRecord]
      });

      console.log(`📚 Training data stored: ${trainingType} (score: ${performanceScore})`);
      return { success: true, id: trainingRecord.id };

    } catch (error) {
      console.error('❌ Error storing training data:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Search for similar training examples
  async findSimilarTraining(query, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Zilliz not connected. Initialize first.');
      }

      const {
        limit = 5,
        trainingType = null,
        minScore = 0.7,
        userId = null
      } = options;

      // Generate embedding for search query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Build search filter
      let filter = '';
      const conditions = [];
      
      if (trainingType) {
        conditions.push(`training_type == "${trainingType}"`);
      }
      if (userId) {
        conditions.push(`user_id == "${userId}"`);
      }
      
      if (conditions.length > 0) {
        filter = conditions.join(' && ');
      }

      const searchParams = {
        collection_name: this.collectionName,
        vector: queryEmbedding,
        filter: filter,
        limit: limit,
        output_fields: ['id', 'training_type', 'performance_score', 'timestamp', 'metadata'],
        params: { nprobe: 10 }
      };

      const results = await this.client.search(searchParams);
      
      const similarTraining = results.results
        .filter(result => result.score >= minScore)
        .map(result => ({
          id: result.id,
          similarity: result.score,
          trainingType: result.training_type,
          performanceScore: result.performance_score,
          timestamp: result.timestamp,
          metadata: JSON.parse(result.metadata || '{}')
        }));

      console.log(`🔍 Found ${similarTraining.length} similar training examples`);
      return { success: true, results: similarTraining };

    } catch (error) {
      console.error('❌ Error searching training data:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get training analytics and performance metrics
  async getTrainingAnalytics(userId = null) {
    try {
      if (!this.isConnected) {
        throw new Error('Zilliz not connected. Initialize first.');
      }

      // Build filter for user-specific data
      const filter = userId ? `user_id == "${userId}"` : '';

      const queryParams = {
        collection_name: this.collectionName,
        filter: filter,
        output_fields: ['training_type', 'performance_score', 'timestamp'],
        limit: 1000 // Get more data for analytics
      };

      const results = await this.client.query(queryParams);
      
      const analytics = {
        totalTrainingRecords: results.data.length,
        averagePerformance: 0,
        trainingByType: {},
        performanceTrend: [],
        topPerformingTypes: []
      };

      if (results.data.length > 0) {
        // Calculate average performance
        const totalScore = results.data.reduce((sum, record) => sum + record.performance_score, 0);
        analytics.averagePerformance = totalScore / results.data.length;

        // Group by training type
        results.data.forEach(record => {
          const type = record.training_type;
          if (!analytics.trainingByType[type]) {
            analytics.trainingByType[type] = { count: 0, totalScore: 0 };
          }
          analytics.trainingByType[type].count++;
          analytics.trainingByType[type].totalScore += record.performance_score;
        });

        // Calculate average scores by type
        Object.keys(analytics.trainingByType).forEach(type => {
          const typeData = analytics.trainingByType[type];
          typeData.averageScore = typeData.totalScore / typeData.count;
        });

        // Get top performing types
        analytics.topPerformingTypes = Object.entries(analytics.trainingByType)
          .map(([type, data]) => ({ type, averageScore: data.averageScore, count: data.count }))
          .sort((a, b) => b.averageScore - a.averageScore)
          .slice(0, 5);

        // Performance trend (last 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentData = results.data
          .filter(record => record.timestamp > thirtyDaysAgo)
          .sort((a, b) => a.timestamp - b.timestamp);

        analytics.performanceTrend = recentData.map(record => ({
          date: new Date(record.timestamp).toISOString().split('T')[0],
          score: record.performance_score
        }));
      }

      console.log(`📊 Training analytics: ${analytics.totalTrainingRecords} records, avg score: ${analytics.averagePerformance.toFixed(2)}`);
      return { success: true, analytics };

    } catch (error) {
      console.error('❌ Error getting training analytics:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      collectionName: this.collectionName,
      hasEmbeddings: !!this.embeddings
    };
  }

  // Disconnect from Zilliz
  async disconnect() {
    try {
      if (this.client) {
        // Note: Milvus client doesn't have explicit disconnect method
        this.client = null;
      }
      this.isConnected = false;
      console.log('🔌 Disconnected from Zilliz');
    } catch (error) {
      console.error('❌ Error disconnecting from Zilliz:', error.message);
    }
  }
}

// Export singleton instance
export const zillizTraining = new ZillizTraining();
export default zillizTraining;
