import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const userEmail = 'coltonfidelman@g.ucla.edu';

async function deleteUser() {
  const awsManager = new AWSManager();
  
  try {
    console.log(`Finding user with email: ${userEmail}...`);
    
    // Find user by email
    const users = await awsManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
      TableName: awsManager.tables.users,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': userEmail
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
    } catch (e) {
      console.log('⚠️ No user settings found (or already deleted)');
    }
    
    // Clear all AWS database tables
    console.log('Clearing contacted leads...');
    await awsManager.clearContactedLeads(userId);
    
    console.log('Clearing issues...');
    await awsManager.clearAllIssues(userId);
    
    console.log('Clearing cycle logs...');
    await awsManager.clearAllCycleLogs(userId);
    
    console.log('Clearing email tracking...');
    const trackingEvents = await awsManager.getEmailTrackingByUser(userId);
    for (const event of trackingEvents) {
      await awsManager.deleteEmailTrackingEvent(event);
    }
    
    console.log(`✅ User ${userId} completely deleted from all tables`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    process.exit(1);
  }
}

deleteUser();
