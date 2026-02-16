import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function addTrialCredits() {
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
    console.log(`   Email: ${user.email}`);
    console.log(`   Plan: ${user.plan}`);
    console.log(`   Current Trial Credits Used: ${user.trialCreditsUsed || 0}`);
    console.log(`   Current Trial Credits Limit: ${user.trialCreditsLimit || 500}`);

    // Reset trialCreditsUsed to 0 to give them a fresh 500 credits
    const updateParams = {
      TableName: awsManager.tables.users,
      Key: { userId: user.userId },
      UpdateExpression: 'SET trialCreditsUsed = :zero',
      ExpressionAttributeValues: {
        ':zero': 0
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await awsManager.dynamodb.send(new UpdateCommand(updateParams));
    
    console.log(`\n✅ Successfully reset trial credits!`);
    console.log(`   New Trial Credits Used: ${updateResult.Attributes.trialCreditsUsed}`);
    console.log(`   New Trial Credits Remaining: ${updateResult.Attributes.trialCreditsLimit}`);
    console.log(`   (They now have a fresh 500 trial credits to use)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addTrialCredits();
