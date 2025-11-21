import { ZillizLeadMemory } from './utils/zillizLeadMemory.js';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

async function initializeCollections() {
  console.log('🚀 Initializing Zilliz collections...\n');

  try {
    // Initialize Lead Memory collection
    console.log('1️⃣ Creating lead_agent_memory collection...');
    const leadMemory = new ZillizLeadMemory();
    await leadMemory.initialize();
    console.log('✅ lead_agent_memory collection ready\n');

    console.log('🎉 Collection initialized successfully!');
    console.log('\n📊 Collection created:');
    console.log('   • lead_agent_memory - Stores keyword performance & learning with embeddings');
    console.log('\nℹ️  Note: Unsubscribes are stored in AWS DynamoDB (meridian-unsubscribes table)');
    
  } catch (error) {
    console.error('❌ Error initializing collections:', error);
    process.exit(1);
  }
}

initializeCollections();
