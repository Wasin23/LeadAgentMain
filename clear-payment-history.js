import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

async function clearPaymentHistory() {
  console.log('🔄 Connecting to AWS DynamoDB...');
  const awsManager = new AWSManager();
  console.log('✅ Connected to AWS DynamoDB');

  const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
  
  console.log(`🔍 Fetching payment history for user: ${userId}...`);
  const payments = await awsManager.getPaymentHistory(userId, 1000);
  
  if (!payments || payments.length === 0) {
    console.log('📭 No payment history found');
    return;
  }

  console.log(`🗑️  Found ${payments.length} payment records to delete`);
  
  // Delete each payment
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
  
  const client = new DynamoDBClient({ region: process.env.AWS_REGION });
  const docClient = DynamoDBDocumentClient.from(client);
  
  let deleted = 0;
  for (const payment of payments) {
    await docClient.send(new DeleteCommand({
      TableName: 'meridian-payment-history',
      Key: {
        userId: userId,
        paymentId: payment.paymentId
      }
    }));
    deleted++;
    if (deleted % 10 === 0) {
      console.log(`   ✅ Deleted: ${deleted}/${payments.length}`);
    }
  }
  
  console.log(`🎉 Successfully cleared ${deleted} payment records!`);
}

clearPaymentHistory().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
