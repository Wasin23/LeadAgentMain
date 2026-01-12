import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkSummary() {
  console.log('\n🔍 CHECKING SUMMARY TABLE for colton.aalogin@gmail.com\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    const command = new QueryCommand({
      TableName: awsManager.tables.apiUsageSummary,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: records } = await awsManager.dynamodb.send(command);
    
    console.log(`📊 TOTAL SUMMARY RECORDS: ${records?.length || 0}\n`);
    
    if (!records || records.length === 0) {
      console.log('❌ NO RECORDS IN SUMMARY TABLE');
      return;
    }
    
    // Sort by month
    records.sort((a, b) => a.month.localeCompare(b.month));
    
    console.log('💰 ALL MONTHS:\n');
    
    let grandTotal = 0;
    
    records.forEach(record => {
      console.log(`\n${record.month}:`);
      
      let monthTotal = 0;
      const services = ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'];
      
      services.forEach(service => {
        if (record[service]) {
          const cost = record[service].cost || 0;
          const calls = record[service].calls || 0;
          console.log(`  ${service}: $${cost.toFixed(2)} (${calls} calls)`);
          monthTotal += cost;
        }
      });
      
      console.log(`  MONTH TOTAL: $${monthTotal.toFixed(2)}`);
      grandTotal += monthTotal;
    });
    
    console.log(`\n\n💰 GRAND TOTAL: $${grandTotal.toFixed(2)}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkSummary()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
