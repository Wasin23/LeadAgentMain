import AWSManager from './utils/awsManager.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const awsManager = new AWSManager();
const email = 'markefidelman@gmail.com';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(ddbClient);

async function checkOutstandingBalance() {
  try {
    console.log(`\n🔍 Looking up user: ${email}\n`);
    
    const user = await awsManager.getUserByEmail(email);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 USER INFO:');
    console.log('─────────────────────────────────────');
    console.log(`User ID: ${user.userId}`);
    console.log(`Email: ${user.email}`);
    console.log(`Stripe Customer: ${user.stripeCustomerId || 'None'}`);
    
    // Get API usage summary from DynamoDB
    console.log('\n💰 OUTSTANDING CHARGES:');
    console.log('─────────────────────────────────────');
    
    const summaryResponse = await dynamodb.send(new QueryCommand({
      TableName: process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': user.userId
      }
    }));
    
    if (!summaryResponse.Items || summaryResponse.Items.length === 0) {
      console.log('No usage records found');
    } else {
      let totalOutstanding = 0;
      let totalPaid = 0;
      
      summaryResponse.Items.forEach(item => {
        const isPaid = item.paid === true;
        const totalCost = item.totalCost || 0;
        
        if (isPaid) {
          totalPaid += totalCost;
        } else {
          totalOutstanding += totalCost;
        }
        
        console.log(`\n📅 ${item.month} (${item.period || 'N/A'})`);
        console.log(`   Status: ${isPaid ? '✅ PAID' : '❌ UNPAID'}`);
        console.log(`   Total Cost: $${totalCost.toFixed(2)}`);
        
        if (item.services) {
          console.log(`   Services:`);
          Object.entries(item.services).forEach(([service, data]) => {
            console.log(`      ${service}: ${data.count || 0} calls, $${(data.cost || 0).toFixed(2)}`);
          });
        }
      });
      
      console.log('\n═════════════════════════════════════');
      console.log(`💵 TOTAL OUTSTANDING: $${totalOutstanding.toFixed(2)}`);
      console.log(`✅ TOTAL PAID: $${totalPaid.toFixed(2)}`);
      console.log(`📊 LIFETIME USAGE: $${(totalOutstanding + totalPaid).toFixed(2)}`);
      console.log(`═════════════════════════════════════`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkOutstandingBalance();
