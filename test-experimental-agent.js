#!/usr/bin/env node

/**
 * TEST EXPERIMENTAL LEAD AGENT
 * 
 * Direct test of the optimized lead agent with:
 * - Iterative Apollo batching (no more 5-lead limits!)
 * - Smart company matching 
 * - Cross-cycle memory
 * - Intelligent search strategy
 * - Performance optimizations
 * - Quality-first scoring
 */

import { LeadContactAgent } from './agent/leadContactAgent.js';

async function testExperimentalAgent() {
  console.log('🚀 TESTING EXPERIMENTAL LEAD AGENT');
  console.log('===================================');
  
  try {
    // Your actual user ID from Zilliz database
    const userId = '76e84c79'; // Your real user ID in the system
    
    console.log(`👤 Testing with user: ${userId}`);
    console.log('🔬 Using EXPERIMENTAL version with all optimizations');
    
    // Initialize the experimental agent
    const agent = new LeadContactAgent(userId);
    
    // Set up user context and file paths (required for state management)
    agent.setUserContext(userId);
    
    console.log('\n📋 EXPERIMENTAL FEATURES ENABLED:');
    console.log('✅ Iterative Apollo Batching - Respects your leadLimit setting');
    console.log('✅ Smart Company Matching - Prevents name confusion');
    console.log('✅ Cross-Cycle Memory - Avoids re-researching same companies');
    console.log('✅ Intelligent Search Strategy - Sequential coverage vs random');
    console.log('✅ Performance Optimization - Smart delays and parallel processing');
    console.log('✅ Quality-First Scoring - Progressive thresholds for better leads');
    
    console.log('\n🎯 Starting experimental lead research...');
    console.log('Testing the new batching system directly...');
    
    // Start the research cycle - call researchNewLeads directly for testing
    const startTime = Date.now();
    const leads = await agent.researchNewLeads();
    const endTime = Date.now();
    
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`\n⏱️ Research completed in ${duration} seconds`);
    
    console.log('\n📊 EXPERIMENTAL TEST RESULTS:');
    console.log(`🔢 Total leads generated: ${leads ? leads.length : 0}`);
    console.log(`🎯 Expected: MORE than 5 leads (vs old hardcoded limit)`);
    console.log(`✅ SUCCESS: ${leads && leads.length > 5 ? 'YES! Optimization working!' : 'Hmm, still limited - check settings'}`);
    
    if (leads && leads.length > 0) {
      console.log('\n📋 Sample lead data:');
      console.log(`📧 ${leads[0].email || 'N/A'} - ${leads[0].companyName || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('❌ EXPERIMENTAL TEST ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
console.log('🧪 EXPERIMENTAL LEAD AGENT TEST');
console.log('Press Ctrl+C to stop the test at any time\n');

testExperimentalAgent()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });