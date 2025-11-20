/**
 * Billing System Test Script
 * 
 * Usage:
 *   node test-billing.js <command> [options]
 * 
 * Commands:
 *   setup-test-user          - Create a test user with Stripe customer
 *   add-usage <userId>       - Add fake API usage for current month
 *   trigger-billing          - Run monthly billing job
 *   check-grace              - Run grace period checker
 *   simulate-failure <userId> - Set user to payment_failed state
 *   simulate-suspend <userId> - Set user to suspended state
 *   reset-user <userId>      - Reset user to active state
 *   overview                 - Show all users' payment status
 */

import dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';
import AWSManager from './utils/awsManager.js';
import axios from 'axios';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const awsManager = new AWSManager();
const API_BASE = 'http://localhost:8080';

// Test user credentials
const TEST_USER = {
  userId: 'test-user-billing',
  username: 'billing-test-user',
  email: 'billing-test@example.com',
  password: 'TestPassword123!'
};

// Get command line arguments
const [,, command, ...args] = process.argv;

async function setupTestUser() {
  console.log('🔧 Setting up test user...');
  
  try {
    // 1. Register user
    console.log('1. Registering user...');
    const registerRes = await axios.post(`${API_BASE}/api/auth/register`, {
      username: TEST_USER.username,
      email: TEST_USER.email,
      password: TEST_USER.password
    }).catch(err => {
      if (err.response?.data?.error?.includes('already exists')) {
        console.log('   ℹ️  User already exists, logging in instead...');
        return null;
      }
      throw err;
    });
    
    // 2. Login to get token
    console.log('2. Logging in...');
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    
    const token = loginRes.data.token;
    console.log('   ✅ Token:', token.substring(0, 20) + '...');
    
    // 3. Create Stripe customer
    console.log('3. Creating Stripe customer...');
    const customer = await stripe.customers.create({
      email: TEST_USER.email,
      metadata: { userId: TEST_USER.userId }
    });
    console.log('   ✅ Stripe Customer ID:', customer.id);
    
    // 4. Create test payment method
    console.log('4. Creating test payment method...');
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: 'tok_visa' // Test card that always succeeds
      }
    });
    
    // Attach to customer
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customer.id
    });
    console.log('   ✅ Payment Method ID:', paymentMethod.id);
    
    // 5. Update user settings with Stripe data
    console.log('5. Updating user settings...');
    await awsManager.saveUserSettings(TEST_USER.userId, {
      userId: TEST_USER.userId,
      email: TEST_USER.email,
      stripeCustomerId: customer.id,
      defaultPaymentMethodId: paymentMethod.id,
      paymentStatus: 'active'
    });
    
    console.log('\n✅ Test user setup complete!');
    console.log(`📧 Email: ${TEST_USER.email}`);
    console.log(`🔑 Password: ${TEST_USER.password}`);
    console.log(`👤 User ID: ${TEST_USER.userId}`);
    console.log(`💳 Stripe Customer: ${customer.id}`);
    console.log(`💳 Payment Method: ${paymentMethod.id}`);
    console.log(`🎫 Token: ${token}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function addUsage(userId) {
  const userIdToUse = userId || TEST_USER.userId;
  console.log(`💵 Adding API usage for user: ${userIdToUse}`);
  
  try {
    // Add 10 usage records for current month
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    
    for (let i = 0; i < 10; i++) {
      const record = {
        userId: userIdToUse,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        endpoint: '/api/lead-agent/run',
        cost: Math.random() * 2 + 0.5, // $0.50 - $2.50
        tokens: Math.floor(Math.random() * 5000 + 1000),
        model: 'gpt-4'
      };
      
      const command = new PutCommand({
        TableName: awsManager.tables.apiUsage,
        Item: record
      });
      
      await awsManager.dynamodb.send(command);
      console.log(`   ✅ Added record ${i + 1}: $${record.cost.toFixed(2)}`);
    }
    
    console.log('\n✅ API usage added successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function triggerBilling() {
  console.log('💳 Triggering monthly billing job...');
  
  try {
    // Login first to get token
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    
    const token = loginRes.data.token;
    
    const response = await axios.post(
      `${API_BASE}/api/admin/trigger-billing`,
      {},
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    console.log('\n✅ Billing job complete!');
    console.log('Results:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function checkGracePeriods() {
  console.log('🕐 Checking grace periods...');
  
  try {
    // Login first to get token
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    
    const token = loginRes.data.token;
    
    const response = await axios.post(
      `${API_BASE}/api/admin/trigger-grace-check`,
      {},
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    console.log('✅ Grace period check complete!');
    console.log('Results:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function simulateFailure(userId) {
  const userIdToUse = userId || TEST_USER.userId;
  console.log(`⚠️  Simulating payment failure for: ${userIdToUse}`);
  
  try {
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    
    const settings = await awsManager.getUserSettings(userIdToUse);
    
    await awsManager.saveUserSettings(userIdToUse, {
      ...settings,
      paymentStatus: 'payment_failed',
      gracePeriodEnd: gracePeriodEnd.toISOString(),
      lastFailedCharge: {
        date: new Date().toISOString(),
        amount: 15.75,
        error: 'card_declined'
      }
    });
    
    console.log('✅ User set to payment_failed state');
    console.log(`   Grace period ends: ${gracePeriodEnd.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function simulateSuspend(userId) {
  const userIdToUse = userId || TEST_USER.userId;
  console.log(`🚫 Simulating account suspension for: ${userIdToUse}`);
  
  try {
    const settings = await awsManager.getUserSettings(userIdToUse);
    
    await awsManager.saveUserSettings(userIdToUse, {
      ...settings,
      paymentStatus: 'suspended',
      gracePeriodEnd: null,
      lastFailedCharge: {
        date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 15.75,
        error: 'card_declined'
      }
    });
    
    console.log('✅ User set to suspended state');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function resetUser(userId) {
  const userIdToUse = userId || TEST_USER.userId;
  console.log(`🔄 Resetting user to active state: ${userIdToUse}`);
  
  try {
    const settings = await awsManager.getUserSettings(userIdToUse);
    
    await awsManager.saveUserSettings(userIdToUse, {
      ...settings,
      paymentStatus: 'active',
      gracePeriodEnd: null,
      lastFailedCharge: null,
      gracePeriodWarningSent: false
    });
    
    console.log('✅ User reset to active state');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getOverview() {
  console.log('📊 Payment Overview\n');
  
  try {
    // Login first to get token
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    
    const token = loginRes.data.token;
    
    const response = await axios.get(
      `${API_BASE}/api/admin/payment-overview`,
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    const data = response.data;
    
    console.log(`Total Users: ${data.total}`);
    console.log(`✅ Active: ${data.active}`);
    console.log(`⚠️  Payment Failed: ${data.payment_failed}`);
    console.log(`🚫 Suspended: ${data.suspended}`);
    console.log('\nUsers:');
    
    data.users.forEach(user => {
      const statusIcon = {
        active: '✅',
        payment_failed: '⚠️ ',
        suspended: '🚫',
        unknown: '❓'
      }[user.status] || '❓';
      
      console.log(`\n${statusIcon} ${user.email}`);
      console.log(`   Status: ${user.status}`);
      if (user.gracePeriodEnd) {
        const daysLeft = Math.ceil((new Date(user.gracePeriodEnd) - new Date()) / (24 * 60 * 60 * 1000));
        console.log(`   Grace Period: ${daysLeft} days remaining`);
      }
      if (user.failedAmount) {
        console.log(`   Failed Amount: $${user.failedAmount.toFixed(2)}`);
      }
      if (user.lastCharge) {
        console.log(`   Last Charge: ${new Date(user.lastCharge).toLocaleDateString()}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Command router
async function main() {
  console.log('🧪 Billing System Test Utility\n');
  
  switch (command) {
    case 'setup-test-user':
      await setupTestUser();
      break;
    
    case 'add-usage':
      await addUsage(args[0]);
      break;
    
    case 'trigger-billing':
      await triggerBilling();
      break;
    
    case 'check-grace':
      await checkGracePeriods();
      break;
    
    case 'simulate-failure':
      await simulateFailure(args[0]);
      break;
    
    case 'simulate-suspend':
      await simulateSuspend(args[0]);
      break;
    
    case 'reset-user':
      await resetUser(args[0]);
      break;
    
    case 'overview':
      await getOverview();
      break;
    
    default:
      console.log('❌ Unknown command:', command);
      console.log('\nAvailable commands:');
      console.log('  setup-test-user          - Create a test user with Stripe customer');
      console.log('  add-usage <userId>       - Add fake API usage for current month');
      console.log('  trigger-billing          - Run monthly billing job');
      console.log('  check-grace              - Run grace period checker');
      console.log('  simulate-failure <userId> - Set user to payment_failed state');
      console.log('  simulate-suspend <userId> - Set user to suspended state');
      console.log('  reset-user <userId>      - Reset user to active state');
      console.log('  overview                 - Show all users\' payment status');
      console.log('\nExample:');
      console.log('  node test-billing.js setup-test-user');
      console.log('  node test-billing.js add-usage');
      console.log('  node test-billing.js trigger-billing');
  }
}

main().catch(console.error);
