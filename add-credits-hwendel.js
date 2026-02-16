// Script to add 1000 credits to hwendel@actiontrac.net
import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function addCredits() {
  const awsManager = new AWSManager();
  const targetEmail = 'hwendel@actiontrac.net';
  const creditsToAdd = 1000;

  try {
    console.log(`🔍 Searching for user: ${targetEmail}`);
    
    // Scan for user by email
    const scanParams = {
      TableName: awsManager.tables.users,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': targetEmail
      }
    };

    const scanResult = await awsManager.dynamodb.send(new ScanCommand(scanParams));
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = scanResult.Items[0];
    console.log(`✅ Found user: ${user.email}`);
    console.log(`📊 Current credits: ${user.credits || 0}`);

    // Calculate new credit amount
    const currentCredits = user.credits || 0;
    const newCredits = currentCredits + creditsToAdd;

    // Update user credits
    const updateParams = {
      TableName: awsManager.tables.users,
      Key: { userId: user.userId },
      UpdateExpression: 'SET credits = :newCredits',
      ExpressionAttributeValues: {
        ':newCredits': newCredits
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await awsManager.dynamodb.send(new UpdateCommand(updateParams));
    
    console.log(`✅ Successfully added ${creditsToAdd} credits`);
    console.log(`📊 New balance: ${updateResult.Attributes.credits}`);
    console.log(`💰 Change: ${currentCredits} → ${newCredits}`);

  } catch (error) {
    console.error('❌ Error adding credits:', error);
  }
}

// Run the script
addCredits();
