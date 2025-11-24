// Clear all Stripe customer IDs from users table
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain()
});

const dynamodb = DynamoDBDocumentClient.from(ddbClient);
const usersTable = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';

async function clearStripeCustomerIds() {
  try {
    console.log('🔍 Scanning users table for Stripe customer IDs...');
    
    const { Items: users } = await dynamodb.send(new ScanCommand({
      TableName: usersTable
    }));
    
    console.log(`📊 Found ${users?.length || 0} users`);
    
    let updated = 0;
    for (const user of users || []) {
      if (user.stripeCustomerId) {
        console.log(`🔄 Clearing stripeCustomerId for user ${user.userId}: ${user.stripeCustomerId}`);
        await dynamodb.send(new UpdateCommand({
          TableName: usersTable,
          Key: { userId: user.userId },
          UpdateExpression: 'REMOVE stripeCustomerId',
          ReturnValues: 'ALL_NEW'
        }));
        updated++;
      }
    }
    
    console.log(`✅ Cleared ${updated} Stripe customer IDs from users table`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearStripeCustomerIds();
