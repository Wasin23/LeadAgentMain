import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkPaymentRecords() {
  const awsManager = new AWSManager();
  
  // Your dad's userId
  const userId = '5344c009-768d-4d7f-a399-4704507bf852';
  
  console.log('\n📋 Checking payment records for markefidelman@gmail.com...\n');
  
  const query = new QueryCommand({
    TableName: awsManager.tables.paymentHistory,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });
  
  const { Items: payments } = await awsManager.dynamodb.send(query);
  
  console.log(`Found ${payments?.length || 0} payment records:\n`);
  
  payments?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.status.toUpperCase()} - $${p.amount.toFixed(2)}`);
    console.log(`   Date: ${new Date(p.timestamp).toLocaleString()}`);
    console.log(`   Billing Period: ${p.billingPeriod}`);
    console.log(`   Description: ${p.description}`);
    if (p.errorMessage) console.log(`   Error: ${p.errorMessage}`);
    console.log('');
  });
  
  // Check API usage summary
  console.log('\n📊 Checking API usage summary...\n');
  
  const summaryQuery = new QueryCommand({
    TableName: awsManager.tables.apiUsageSummary,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });
  
  const { Items: summaries } = await awsManager.dynamodb.send(summaryQuery);
  
  summaries?.forEach(s => {
    let total = 0;
    ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
      if (s[service]) total += s[service].cost || 0;
    });
    console.log(`Month: ${s.month} - $${total.toFixed(2)}`);
  });
  
  console.log('\n✅ Done!\n');
  process.exit(0);
}

checkPaymentRecords().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
