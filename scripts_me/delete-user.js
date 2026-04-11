import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import AWSManager from '../utils/awsManager.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const userEmail = 'colton.fidd@gmail.com'; // Match exact case from registration

async function deleteUser() {
  const awsManager = new AWSManager();
  
  try {
    console.log(`Finding user with email: ${userEmail}...`);
    
    // Find user by email (case-insensitive search)
    const users = await awsManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
      TableName: awsManager.tables.users,
      FilterExpression: 'email = :email OR email = :emailLower OR email = :emailUpper',
      ExpressionAttributeValues: {
        ':email': userEmail,
        ':emailLower': userEmail.toLowerCase(),
        ':emailUpper': userEmail.toUpperCase()
      }
    }));
    
    if (!users.Items || users.Items.length === 0) {
      console.log('❌ No user found with that email');
      process.exit(1);
    }
    
    const user = users.Items[0];
    const userId = user.userId;
    const hadSignupIpHash = Boolean(user.signupIpHash);
    const hadSignupDeviceHash = Boolean(user.signupDeviceHash);
    
    console.log(`Found user: ${user.username} (${userId})`);
    if (hadSignupIpHash || hadSignupDeviceHash) {
      console.log(`Deleting stored signup fingerprint data: IP hash=${hadSignupIpHash ? 'yes' : 'no'}, device hash=${hadSignupDeviceHash ? 'yes' : 'no'}`);
    }
    console.log(`Starting deletion of user ${userId}...`);
    
    // Delete user record from Users table
    console.log('Deleting user record from Users table...');
    await awsManager.dynamodb.send(new (await import('@aws-sdk/lib-dynamodb')).DeleteCommand({
      TableName: awsManager.tables.users,
      Key: { userId }
    }));
    console.log('✅ User record deleted');

    // Scrub IP/device hashes from any OTHER users that share the same values.
    // This prevents the fingerprint check from blocking a fresh signup from the
    // same IP/device (e.g. developer re-registering after deleting a test account).
    const hashesToScrub = [
      user.signupIpHash ? { field: 'signupIpHash', value: user.signupIpHash } : null,
      user.signupDeviceHash ? { field: 'signupDeviceHash', value: user.signupDeviceHash } : null,
    ].filter(Boolean);

    for (const { field, value } of hashesToScrub) {
      const scanResult = await awsManager.dynamodb.send(new ScanCommand({
        TableName: awsManager.tables.users,
        FilterExpression: `#f = :v`,
        ExpressionAttributeNames: { '#f': field },
        ExpressionAttributeValues: { ':v': value },
      }));

      const others = (scanResult.Items || []).filter(u => u.userId !== userId);
      if (others.length === 0) {
        console.log(`ℹ️  No other users share ${field} — nothing extra to scrub`);
        continue;
      }

      for (const other of others) {
        await awsManager.dynamodb.send(new UpdateCommand({
          TableName: awsManager.tables.users,
          Key: { userId: other.userId },
          UpdateExpression: 'REMOVE signupIpHash, signupDeviceHash',
        }));
        console.log(`🧹 Scrubbed signupIpHash + signupDeviceHash from user ${other.userId} (${other.email || 'no email'})`);
      }
    }
    
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
