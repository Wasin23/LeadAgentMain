import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function testCostTracking() {
  console.log('\n🧪 TESTING COST TRACKING for colton.aalogin@gmail.com\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    // Get current summary
    const summaryCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsageSummary,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: summaryRecords } = await awsManager.dynamodb.send(summaryCommand);
    
    console.log('📊 CURRENT SUMMARY TOTALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let grandTotal = 0;
    summaryRecords?.sort((a, b) => a.month.localeCompare(b.month)).forEach(record => {
      let monthTotal = 0;
      const services = ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'];
      
      console.log(`\n${record.month}:`);
      services.forEach(service => {
        if (record[service]) {
          const cost = record[service].cost || 0;
          const calls = record[service].calls || 0;
          if (cost > 0 || calls > 0) {
            console.log(`  ${service}: $${cost.toFixed(2)} (${calls} calls)`);
            monthTotal += cost;
          }
        }
      });
      console.log(`  MONTH TOTAL: $${monthTotal.toFixed(2)}`);
      console.log(`  Last updated: ${record.updatedAt}`);
      grandTotal += monthTotal;
    });
    
    console.log(`\n💰 GRAND TOTAL: $${grandTotal.toFixed(2)}`);
    console.log(`\n⏰ Current time: ${new Date().toISOString()}`);
    console.log('\n🚀 Now run your agent and then run this script again to see if costs increase!');
    console.log('   Expected behavior: January 2026 total should go up by ~$0.50-$2.00 depending on agent activity');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testCostTracking()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });