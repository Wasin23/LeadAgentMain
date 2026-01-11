import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkColePayments() {
  const awsManager = new AWSManager();
  
  const userId = '5781c511-2307-4fcf-a763-33e8ec64a638'; // colton.aalogin@gmail.com
  
  console.log('\n📋 Payment records for colton.aalogin@gmail.com:\n');
  
  const query = new QueryCommand({
    TableName: awsManager.tables.paymentHistory,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });
  
  const { Items: payments } = await awsManager.dynamodb.send(query);
  
  console.log(`Found ${payments?.length || 0} records:\n`);
  
  let successTotal = 0;
  let failedTotal = 0;
  
  payments?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.status.toUpperCase()} - $${p.amount.toFixed(2)}`);
    console.log(`   Description: ${p.description}`);
    console.log(`   Date: ${new Date(p.timestamp).toLocaleString()}`);
    console.log('');
    
    if (p.status === 'success') {
      successTotal += p.amount;
    } else {
      failedTotal += p.amount;
    }
  });
  
  console.log(`\n💰 Success Total: $${successTotal.toFixed(2)}`);
  console.log(`❌ Failed Total: $${failedTotal.toFixed(2)}`);
  console.log(`📊 Grand Total (if both counted): $${(successTotal + failedTotal).toFixed(2)}\n`);
  
  process.exit(0);
}

checkColePayments().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
