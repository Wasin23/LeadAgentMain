import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

// Import after env is loaded
const AWSManager = (await import('./utils/awsManager.js')).default;
const awsManager = new AWSManager();

console.log('📊 [AGGREGATE] Starting API usage aggregation...');
console.log('📊 [AGGREGATE] Current date:', new Date().toISOString());

try {
  const { ScanCommand, PutCommand } = await import('@aws-sdk/lib-dynamodb');
  
  // Scan all API usage records
  console.log('🔍 [AGGREGATE] Scanning apiUsage table...');
  const scanCommand = new ScanCommand({
    TableName: awsManager.tables.apiUsage
  });
  
  const { Items: usageRecords } = await awsManager.dynamodb.send(scanCommand);
  console.log(`📊 [AGGREGATE] Found ${usageRecords?.length || 0} usage records`);
  
  // Group by userId and month
  const summaryMap = new Map();
  
  for (const record of usageRecords || []) {
    const userId = record.userId;
    const timestamp = record.timestamp;
    
    if (!userId || !timestamp) {
      console.log('⚠️ [AGGREGATE] Skipping record with missing userId or timestamp');
      continue;
    }
    
    // Extract month (YYYY-MM format)
    const date = new Date(timestamp);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const key = `${userId}:${month}`;
    
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        userId,
        month,
        apollo: { calls: 0, cost: 0, credits: 0 },
        openai: { calls: 0, cost: 0, tokens: 0 },
        serper: { calls: 0, cost: 0 },
        zerobounce: { calls: 0, cost: 0 },
        mailgun: { calls: 0, cost: 0 },
        gmail: { calls: 0, cost: 0 }
      });
    }
    
    const summary = summaryMap.get(key);
    
    // Aggregate by service
    if (record.service && summary[record.service]) {
      summary[record.service].calls += 1;
      summary[record.service].cost += record.cost || 0;
      
      // Service-specific metrics
      if (record.service === 'apollo' && record.credits) {
        summary[record.service].credits += record.credits;
      }
      if (record.service === 'openai' && record.tokens) {
        summary[record.service].tokens += record.tokens;
      }
    }
  }
  
  console.log(`📊 [AGGREGATE] Created ${summaryMap.size} monthly summaries`);
  
  // Write summaries to apiUsageSummary table
  let written = 0;
  let errors = 0;
  
  for (const [key, summary] of summaryMap) {
    try {
      const putCommand = new PutCommand({
        TableName: awsManager.tables.apiUsageSummary,
        Item: summary
      });
      
      await awsManager.dynamodb.send(putCommand);
      written++;
      
      // Log total cost for this summary
      const totalCost = Object.values(summary)
        .filter(v => typeof v === 'object' && v.cost)
        .reduce((sum, v) => sum + v.cost, 0);
      
      console.log(`✅ [AGGREGATE] ${summary.userId} - ${summary.month}: $${totalCost.toFixed(2)}`);
    } catch (error) {
      console.error(`❌ [AGGREGATE] Error writing summary for ${key}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n✅ [AGGREGATE] Aggregation complete!');
  console.log(`✅ Written: ${written} summaries`);
  console.log(`❌ Errors: ${errors}`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ [AGGREGATE] Fatal error:', error);
  console.error('❌ [AGGREGATE] Stack:', error.stack);
  process.exit(1);
}
