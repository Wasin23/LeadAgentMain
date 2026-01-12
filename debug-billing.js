import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function debugBillingForUser() {
  console.log('\n🐛 DEBUG BILLING for colton.aalogin@gmail.com\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    // Get user payments
    const paymentsCommand = new ScanCommand({
      TableName: awsManager.tables.paymentHistory,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: payments } = await awsManager.dynamodb.send(paymentsCommand);
    
    console.log('💳 PAYMENTS:');
    payments?.forEach(payment => {
      const date = new Date(payment.billingPeriod);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      console.log(`  ${payment.billingPeriod} → ${monthKey}: $${payment.amount} (${payment.status})`);
    });
    
    // Get paid months set
    const paidMonths = new Set(
      payments
        ?.filter(p => p.status === 'success' && p.billingPeriod)
        .map(p => {
          const date = new Date(p.billingPeriod);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }) || []
    );
    
    console.log('\n✅ PAID MONTHS SET:', Array.from(paidMonths));
    
    // Get user summaries
    const summaryCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsageSummary,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: summaries } = await awsManager.dynamodb.send(summaryCommand);
    
    console.log('\n📊 USAGE SUMMARIES:');
    let outstanding = 0;
    
    summaries?.forEach(summary => {
      const isPaid = paidMonths.has(summary.month);
      let monthCost = 0;
      
      ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
        if (summary[service]) {
          monthCost += summary[service].cost || 0;
        }
      });
      
      console.log(`  ${summary.month}: $${monthCost.toFixed(2)} ${isPaid ? '(PAID - SKIP)' : '(UNPAID - ADD TO OUTSTANDING)'}`);
      
      if (!isPaid) {
        outstanding += monthCost;
      }
    });
    
    console.log(`\n💰 FINAL OUTSTANDING: $${outstanding.toFixed(2)}`);
    
    if (outstanding === 0) {
      console.log('\n❌ PROBLEM: Outstanding is $0.00 but should be $5.40');
      console.log('   This means either:');
      console.log('   1. All months are being marked as PAID');
      console.log('   2. Usage summaries are not being found');
      console.log('   3. Payment matching logic is broken');
    } else {
      console.log('\n✅ Outstanding calculation working correctly!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

debugBillingForUser()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });