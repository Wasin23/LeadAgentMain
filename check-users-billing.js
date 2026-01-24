import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

// Import after env is loaded
const AWSManager = (await import('./utils/awsManager.js')).default;
const awsManager = new AWSManager();

console.log('👥 [CHECK USERS] Checking users with payment methods...');

try {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  
  // Get all users with payment methods
  const scanCommand = new ScanCommand({
    TableName: awsManager.tables.users,
    FilterExpression: 'attribute_exists(stripeCustomerId) AND attribute_exists(paymentMethodAdded) AND paymentMethodAdded = :true',
    ExpressionAttributeValues: {
      ':true': true
    }
  });
  
  const { Items: users } = await awsManager.dynamodb.send(scanCommand);
  
  console.log(`\n📊 Found ${users?.length || 0} users with payment methods:\n`);
  
  for (const user of users || []) {
    console.log(`✅ ${user.email || 'No email'}`);
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Stripe Customer: ${user.stripeCustomerId}`);
    console.log(`   Payment Method Added: ${user.paymentMethodAdded}`);
    console.log('');
  }
  
  // Now check apiUsageSummary for these users
  console.log('\n📊 Checking API usage summaries...\n');
  
  const summaryCommand = new ScanCommand({
    TableName: awsManager.tables.apiUsageSummary
  });
  
  const { Items: summaries } = await awsManager.dynamodb.send(summaryCommand);
  
  console.log(`Found ${summaries?.length || 0} usage summaries:\n`);
  
  for (const summary of summaries || []) {
    let totalCost = 0;
    ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
      if (summary[service]) {
        totalCost += summary[service].cost || 0;
      }
    });
    
    const userWithPayment = users?.find(u => u.userId === summary.userId);
    
    console.log(`${userWithPayment ? '✅' : '❌'} User ${summary.userId.substring(0, 8)}...`);
    console.log(`   Month: ${summary.month}`);
    console.log(`   Cost: $${totalCost.toFixed(2)}`);
    console.log(`   Has Payment Method: ${!!userWithPayment}`);
    if (userWithPayment) {
      console.log(`   Email: ${userWithPayment.email}`);
    }
    console.log('');
  }
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error);
  process.exit(1);
}
