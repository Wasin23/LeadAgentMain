import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkMyUsage() {
  console.log('\n🔍 Checking usage for colton.aalogin@gmail.com...\n');
  
  try {
    const awsManager = new AWSManager();
    
    // Get user ID
    const usersCommand = new ScanCommand({
      TableName: awsManager.tables.users,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': 'colton.aalogin@gmail.com'
      }
    });
    
    const { Items: users } = await awsManager.dynamodb.send(usersCommand);
    
    if (!users || users.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const userId = users[0].userId;
    console.log(`✅ Found user ID: ${userId}\n`);
    
    // Get detailed usage
    const detailedCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsage,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: detailedRecords } = await awsManager.dynamodb.send(detailedCommand);
    
    console.log(`📊 Total detailed records: ${detailedRecords?.length || 0}\n`);
    
    // Calculate by month
    const monthlyTotals = {};
    
    detailedRecords?.forEach(record => {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = {
          count: 0,
          cost: 0,
          services: {}
        };
      }
      
      monthlyTotals[monthKey].count++;
      monthlyTotals[monthKey].cost += record.cost || 0;
      
      if (!monthlyTotals[monthKey].services[record.service]) {
        monthlyTotals[monthKey].services[record.service] = { count: 0, cost: 0 };
      }
      monthlyTotals[monthKey].services[record.service].count++;
      monthlyTotals[monthKey].services[record.service].cost += record.cost || 0;
    });
    
    // Check summary table
    const summaryCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsageSummary,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: summaryRecords } = await awsManager.dynamodb.send(summaryCommand);
    
    console.log('📈 DETAILED USAGE (from meridian-api-usage):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    Object.keys(monthlyTotals).sort().forEach(month => {
      const data = monthlyTotals[month];
      console.log(`\n${month}: $${data.cost.toFixed(2)} (${data.count} calls)`);
      Object.entries(data.services).forEach(([service, stats]) => {
        console.log(`  - ${service}: $${stats.cost.toFixed(2)} (${stats.count} calls)`);
      });
    });
    
    const totalCost = Object.values(monthlyTotals).reduce((sum, m) => sum + m.cost, 0);
    const totalCalls = Object.values(monthlyTotals).reduce((sum, m) => sum + m.count, 0);
    console.log(`\n📊 TOTAL: $${totalCost.toFixed(2)} (${totalCalls} calls)`);
    
    console.log('\n\n📋 SUMMARY TABLE (meridian-api-usage-summary):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!summaryRecords || summaryRecords.length === 0) {
      console.log('❌ NO SUMMARY RECORDS FOUND (This is why outstanding shows $0!)');
    } else {
      console.log('⚠️  Summary records exist but structure is:', JSON.stringify(summaryRecords[0], null, 2));
    }
    
    // Get payment history (use Scan since no index)
    const paymentsCommand = new ScanCommand({
      TableName: awsManager.tables.paymentHistory,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: payments } = await awsManager.dynamodb.send(paymentsCommand);
    
    console.log('\n\n💳 PAYMENT HISTORY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!payments || payments.length === 0) {
      console.log('❌ NO PAYMENTS FOUND');
    } else {
      let totalPaid = 0;
      payments.sort((a, b) => new Date(a.billingPeriod) - new Date(b.billingPeriod)).forEach(payment => {
        console.log(`${payment.billingPeriod}: $${payment.amount.toFixed(2)} (${payment.status})`);
        if (payment.status === 'success') {
          totalPaid += payment.amount;
        }
      });
      console.log(`\n💰 TOTAL PAID: $${totalPaid.toFixed(2)}`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkMyUsage()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
