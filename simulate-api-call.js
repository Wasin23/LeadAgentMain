import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function simulateApiCall() {
  console.log('\n🧪 SIMULATING API CALL for colton.aalogin@gmail.com\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    // Get current summary BEFORE
    console.log('📊 BEFORE - Getting current summary...');
    const summaryCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsageSummary,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: beforeSummary } = await awsManager.dynamodb.send(summaryCommand);
    const currentMonth = new Date().toISOString().slice(0, 7); // 2026-01
    const beforeRecord = beforeSummary?.find(r => r.month === currentMonth);
    
    console.log(`Current month (${currentMonth}):`);
    if (beforeRecord) {
      const beforeTotal = (beforeRecord.apollo?.cost || 0) + (beforeRecord.openai?.cost || 0) + 
                         (beforeRecord.serper?.cost || 0) + (beforeRecord.zerobounce?.cost || 0) + 
                         (beforeRecord.mailgun?.cost || 0) + (beforeRecord.gmail?.cost || 0);
      console.log(`  Current total: $${beforeTotal.toFixed(4)}`);
      console.log(`  OpenAI: $${(beforeRecord.openai?.cost || 0).toFixed(4)} (${beforeRecord.openai?.calls || 0} calls)`);
      console.log(`  Last updated: ${beforeRecord.updatedAt}`);
    } else {
      console.log(`  No record exists for ${currentMonth}`);
    }
    
    console.log('\n🚀 SIMULATING $5.00 OpenAI API call...');
    
    // Simulate a large OpenAI API call worth $5
    const testUsage = {
      userId: userId,
      agentId: 'test-agent-large',
      service: 'openai',
      operation: 'completion',
      usage: 50000, // 50,000 tokens
      cost: 5.00, // $5.00 for large processing
      metadata: {
        model: 'gpt-4',
        prompt_tokens: 25000,
        completion_tokens: 25000,
        test: true,
        note: 'Large test transaction'
      }
    };
    
    console.log('Test usage data:', JSON.stringify(testUsage, null, 2));
    
    // Log the API usage (this should update both detailed and summary tables)
    const result = await awsManager.logApiUsage(testUsage);
    console.log('API usage result:', result);
    
    // Wait 2 seconds for async summary update
    console.log('\n⏳ Waiting 2 seconds for summary update...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get summary AFTER
    console.log('\n📊 AFTER - Getting updated summary...');
    const { Items: afterSummary } = await awsManager.dynamodb.send(summaryCommand);
    const afterRecord = afterSummary?.find(r => r.month === currentMonth);
    
    if (afterRecord) {
      const afterTotal = (afterRecord.apollo?.cost || 0) + (afterRecord.openai?.cost || 0) + 
                        (afterRecord.serper?.cost || 0) + (afterRecord.zerobounce?.cost || 0) + 
                        (afterRecord.mailgun?.cost || 0) + (afterRecord.gmail?.cost || 0);
      console.log(`  New total: $${afterTotal.toFixed(4)}`);
      console.log(`  OpenAI: $${(afterRecord.openai?.cost || 0).toFixed(4)} (${afterRecord.openai?.calls || 0} calls)`);
      console.log(`  Last updated: ${afterRecord.updatedAt}`);
      
      const costIncrease = afterTotal - (beforeRecord ? 
        (beforeRecord.apollo?.cost || 0) + (beforeRecord.openai?.cost || 0) + 
        (beforeRecord.serper?.cost || 0) + (beforeRecord.zerobounce?.cost || 0) + 
        (beforeRecord.mailgun?.cost || 0) + (beforeRecord.gmail?.cost || 0) : 0);
      
      console.log(`\n💰 RESULT: Cost increased by $${costIncrease.toFixed(4)}`);
      
      if (costIncrease > 0) {
        console.log('✅ SUCCESS: Cost tracking is working!');
      } else {
        console.log('❌ FAILED: Cost did not increase');
      }
    } else {
      console.log('❌ FAILED: No summary record found after API call');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

simulateApiCall()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });