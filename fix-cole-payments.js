import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function fixColePayments() {
  const awsManager = new AWSManager();
  
  const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
  
  console.log('\n🔧 Fixing payment records...\n');
  
  const query = new QueryCommand({
    TableName: awsManager.tables.paymentHistory,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });
  
  const { Items: payments } = await awsManager.dynamodb.send(query);
  
  // Delete the duplicate successful payments for Nov/Dec and the failed one
  const toDelete = payments?.filter(p => 
    (p.amount > 29 && p.amount < 30) || p.status === 'failed'
  );
  
  console.log(`Deleting ${toDelete?.length || 0} payment records:\n`);
  
  for (const payment of toDelete || []) {
    console.log(`  - ${payment.status.toUpperCase()} $${payment.amount.toFixed(2)} - ${payment.description}`);
    
    const deleteCmd = new DeleteCommand({
      TableName: awsManager.tables.paymentHistory,
      Key: {
        userId: payment.userId,
        paymentId: payment.paymentId
      }
    });
    
    await awsManager.dynamodb.send(deleteCmd);
  }
  
  console.log('\n✅ Cleaned up! Total Spent should now show $9.25\n');
  process.exit(0);
}

fixColePayments().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
