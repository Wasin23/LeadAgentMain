import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function upgradeUserPlan() {
  const awsManager = new AWSManager();
  const username = 'halwendel5672';

  try {
    console.log(`🔍 Searching for user: ${username}`);
    
    // Scan for user by username
    const scanResult = await awsManager.dynamodb.send(new ScanCommand({
      TableName: awsManager.tables.users,
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': username
      }
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = scanResult.Items[0];
    console.log(`✅ Found user: ${user.username}`);
    console.log(`   Current Plan: ${user.plan}`);
    console.log(`   Current Credits: ${user.credits || 0}`);

    // Upgrade to starter and set credits to 1000 (starter default 10000 - 9000)
    const newCredits = 10000 - 9000; // = 1000
    
    const updateParams = {
      TableName: awsManager.tables.users,
      Key: { userId: user.userId },
      UpdateExpression: 'SET #plan = :plan, credits = :credits',
      ExpressionAttributeNames: {
        '#plan': 'plan'
      },
      ExpressionAttributeValues: {
        ':plan': 'starter',
        ':credits': newCredits
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await awsManager.dynamodb.send(new UpdateCommand(updateParams));
    
    console.log(`\n✅ Successfully upgraded user!`);
    console.log(`   New Plan: ${updateResult.Attributes.plan}`);
    console.log(`   New Credits: ${updateResult.Attributes.credits}`);
    console.log(`   (Starter: 10,000 credits - 9,000 charged = 1,000 remaining)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

upgradeUserPlan();
