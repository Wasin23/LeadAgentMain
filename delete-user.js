import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const userId = '97e1072f-cbc1-4909-a0b5-3de3976422d8';

async function deleteUser() {
  const awsManager = new AWSManager();
  
  try {
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
