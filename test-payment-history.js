#!/usr/bin/env node

/**
 * Test Payment History System
 * 
 * Tests payment history logging and retrieval
 * Usage: node test-payment-history.js [userId]
 */

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const testUserId = process.argv[2] || '02e1ad93-18c5-461f-842f-ec6a0f5f6e80';

async function testPaymentHistory() {
  console.log('🧪 Testing Payment History System\n');
  console.log('User ID:', testUserId);
  console.log('-'.repeat(60));

  const awsManager = new AWSManager();

  // Test 1: Log a successful payment
  console.log('\n📝 Test 1: Logging successful payment...');
  try {
    const successResult = await awsManager.logPayment(testUserId, {
      amount: 25.50,
      status: 'success',
      currency: 'USD',
      stripePaymentIntentId: 'pi_test_' + Date.now(),
      billingPeriod: new Date(2025, 10, 1).toISOString(),
      description: 'Monthly API usage - November 2025'
    });
    console.log('✅ Success payment logged:', successResult.paymentId);
  } catch (error) {
    console.error('❌ Failed to log success payment:', error.message);
  }

  // Test 2: Log a failed payment
  console.log('\n📝 Test 2: Logging failed payment...');
  try {
    const failedResult = await awsManager.logPayment(testUserId, {
      amount: 18.75,
      status: 'failed',
      currency: 'USD',
      stripePaymentIntentId: null,
      billingPeriod: new Date(2025, 9, 1).toISOString(),
      description: 'Monthly API usage - October 2025',
      errorMessage: 'Card declined - insufficient funds'
    });
    console.log('✅ Failed payment logged:', failedResult.paymentId);
  } catch (error) {
    console.error('❌ Failed to log failed payment:', error.message);
  }

  // Test 3: Get payment history
  console.log('\n📝 Test 3: Retrieving payment history...');
  try {
    const history = await awsManager.getPaymentHistory(testUserId, 10);
    console.log(`✅ Retrieved ${history.length} payment records:`);
    history.forEach((payment, index) => {
      console.log(`\n   ${index + 1}. ${payment.description}`);
      console.log(`      Amount: $${payment.amount} ${payment.currency}`);
      console.log(`      Status: ${payment.status}`);
      console.log(`      Date: ${new Date(payment.timestamp).toLocaleString()}`);
      if (payment.errorMessage) {
        console.log(`      Error: ${payment.errorMessage}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to get payment history:', error.message);
  }

  // Test 4: Get payment statistics
  console.log('\n📝 Test 4: Calculating payment statistics...');
  try {
    const stats = await awsManager.getPaymentStats(testUserId);
    if (stats) {
      console.log('✅ Payment Statistics:');
      console.log(`   Total Paid: $${stats.totalPaid.toFixed(2)}`);
      console.log(`   Total Failed: $${stats.totalFailed.toFixed(2)}`);
      console.log(`   Successful Payments: ${stats.successCount}`);
      console.log(`   Failed Payments: ${stats.failedCount}`);
      
      if (stats.lastSuccessfulPayment) {
        console.log(`\n   Last Successful Payment:`);
        console.log(`   - Amount: $${stats.lastSuccessfulPayment.amount}`);
        console.log(`   - Date: ${new Date(stats.lastSuccessfulPayment.timestamp).toLocaleString()}`);
      }
      
      if (stats.lastFailedPayment) {
        console.log(`\n   Last Failed Payment:`);
        console.log(`   - Amount: $${stats.lastFailedPayment.amount}`);
        console.log(`   - Date: ${new Date(stats.lastFailedPayment.timestamp).toLocaleString()}`);
        console.log(`   - Reason: ${stats.lastFailedPayment.errorMessage}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to get payment stats:', error.message);
  }

  // Test 5: Test next payment due calculation
  console.log('\n📝 Test 5: Testing next payment due date...');
  const now = new Date();
  const nextPaymentDue = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0);
  const daysUntil = Math.ceil((nextPaymentDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log('✅ Next Payment Calculation:');
  console.log(`   Next payment due: ${nextPaymentDue.toLocaleString()}`);
  console.log(`   Days until next payment: ${daysUntil}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests complete!');
}

// Run tests
testPaymentHistory().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
