import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkUser() {
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
    console.log(`✅ Found user:`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Credits: ${user.credits || 0}`);
    console.log(`   Trial Status: ${user.trialStatus || 'unknown'}`);
    console.log(`   Trial Started: ${user.trialStartDate || 'unknown'}`);
    console.log(`   Plan: ${user.plan || 'unknown'}`);
    console.log(`   Created: ${user.createdAt || 'unknown'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser();
