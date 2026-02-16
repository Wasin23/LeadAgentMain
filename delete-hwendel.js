import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const userEmail = 'hwendel@actiontrac.net';

async function deleteUser() {
  const awsManager = new AWSManager();
  
  try {
    console.log(`Finding user with email: ${userEmail}...`);
    
    // Find user by email (case-insensitive search)
    const users = await awsManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
      TableName: awsManager.tables.users,
      FilterExpression: 'email = :email OR email = :emailLower',
      ExpressionAttributeValues: {
        ':email': userEmail,
        ':emailLower': userEmail.toLowerCase()
      }
    }));
    
    if (!users.Items || users.Items.length === 0) {
      console.log('❌ No user found with that email');
      process.exit(1);
    }
    
    const user = users.Items[0];
    const userId = user.userId;
    
    console.log(`Found user: ${user.username} (${userId})`);
    console.log(`Starting deletion of user ${userId}...`);
    
    // Delete user record from Users table
    console.log('Deleting user record from Users table...');
    await awsManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).DeleteCommand({
      TableName: awsManager.tables.users,
      Key: { userId }
    }));
    console.log('✅ User record deleted');
    
    // Delete user settings
    console.log('Deleting user settings...');
    try {
      await awsManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).DeleteCommand({
        TableName: awsManager.tables.userSettings,
        Key: { userId }
      }));
      console.log('✅ User settings deleted');
    } catch (err) {
      console.log('⚠️ No user settings found or error:', err.message);
    }
    
    console.log('\n✅ User deletion complete!');
    console.log(`User ${userEmail} (${userId}) has been completely removed.`);
    
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  }
}

deleteUser();
