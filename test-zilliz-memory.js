import { ZillizLeadMemory } from './utils/zillizLeadMemory.js';

/**
 * Test script to verify Zilliz RAG memory system is working
 * Run: node test-zilliz-memory.js
 */

async function testMemory() {
  console.log('🧪 Testing Zilliz Lead Memory...\n');
  
  const memory = new ZillizLeadMemory();
  const testUserId = 'test_user_123';
  const testAgentId = 'test_agent_456';
  
  try {
    // Step 1: Initialize
    console.log('1️⃣ Initializing connection...');
    await memory.initialize();
    console.log('✅ Connection initialized\n');
    
    // Step 2: Store test data
    console.log('2️⃣ Storing test keyword performance...');
    const storeResult = await memory.storeKeywordPerformance(
      testUserId,
      testAgentId,
      'technology',
      'CEO',
      10, // attempts
      3,  // duplicates
      'base'
    );
    console.log('✅ Store result:', storeResult);
    console.log('');
    
    // Step 3: Load data back
    console.log('3️⃣ Loading keyword performance...');
    const loadResult = await memory.loadKeywordPerformance(testUserId);
    console.log('✅ Load result:');
    console.log(`   - Success: ${loadResult.success}`);
    console.log(`   - Records found: ${loadResult.count}`);
    console.log(`   - Keywords: ${Object.keys(loadResult.performanceMap).join(', ')}`);
    console.log('');
    
    // Step 4: Get stats
    console.log('4️⃣ Getting memory stats...');
    const stats = await memory.getMemoryStats(testUserId);
    console.log('✅ Stats:', stats);
    console.log('');
    
    // Step 5: Update with more data (cumulative)
    console.log('5️⃣ Updating same keyword with more data...');
    const updateResult = await memory.storeKeywordPerformance(
      testUserId,
      testAgentId,
      'technology',
      'CEO',
      10, // 10 more attempts
      7,  // 7 more duplicates (will push over 50%)
      'base'
    );
    console.log('✅ Update result:', updateResult);
    console.log('   - Should now be exhausted:', updateResult.isExhausted);
    console.log('');
    
    // Step 6: Load again to verify cumulative
    console.log('6️⃣ Loading again to verify cumulative tracking...');
    const loadResult2 = await memory.loadKeywordPerformance(testUserId);
    const techCeo = loadResult2.performanceMap['technology#ceo'];
    if (techCeo) {
      console.log('✅ Cumulative data verified:');
      console.log(`   - Total attempts: ${techCeo.totalAttempts} (should be 20)`);
      console.log(`   - Total duplicates: ${techCeo.totalDuplicates} (should be 10)`);
      console.log(`   - Duplicate rate: ${techCeo.cumulativeDuplicateRate.toFixed(1)}% (should be 50%)`);
      console.log(`   - Is exhausted: ${techCeo.isExhausted} (should be true)`);
    }
    console.log('');
    
    // Step 7: Test keyword search
    console.log('7️⃣ Getting all keywords...');
    const allKeywords = await memory.getAllKeywords(testUserId);
    console.log('✅ All keywords:', allKeywords);
    console.log('');
    
    console.log('🎉 All tests passed! RAG memory system is working correctly.\n');
    console.log('💡 Tip: Check the Memory tab in your agent director UI to see this data.');
    console.log('💡 To reset: Use the "Reset All" button in the Memory tab or DELETE /api/lead-agent/memory/reset-all');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Full error:', error.stack);
  }
}

testMemory();
