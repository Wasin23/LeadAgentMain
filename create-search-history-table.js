import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

async function createTable() {
  console.log('🚀 Creating search history table...');
  
  const awsManager = new AWSManager();
  const result = await awsManager.createSearchHistoryTable();
  
  if (result.success) {
    if (result.alreadyExists) {
      console.log(`✅ Table ${result.tableName} already exists - no action needed`);
    } else {
      console.log(`✅ Table ${result.tableName} created successfully`);
      console.log('⏳ Note: Table may take a few moments to become active');
    }
  } else {
    console.error(`❌ Failed to create table: ${result.error}`);
    process.exit(1);
  }
}

createTable();
