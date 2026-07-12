import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { UpdateCommand, ScanCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import AWSManager from '../utils/awsManager.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const userEmail = process.argv[2] || 'coltonfidelman@g.ucla.edu';

async function deleteUser() {
  const awsManager = new AWSManager();
  const TEAMS_TABLE = process.env.AWS_DYNAMODB_TEAMS_TABLE || 'meridian-teams';

  try {
    console.log(`Finding user with email: ${userEmail}...`);

    // Find user by email (case-insensitive search)
    const users = await awsManager.dynamodb.send(new ScanCommand({
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

    // ── Team cleanup ───────────────────────────────────────────────────────────
    if (user.teamId) {
      const teamRes = await awsManager.dynamodb.send(new GetCommand({
        TableName: TEAMS_TABLE,
        Key: { teamId: user.teamId },
      }));
      const team = teamRes.Item;
      if (team) {
        if (team.ownerId === userId) {
          // Owner deleted — disband the whole team and clear all members' JWT fields
          console.log(`Disbanding team ${team.teamId} (user was owner)…`);
          for (const m of (team.members || [])) {
            try {
              await awsManager.dynamodb.send(new UpdateCommand({
                TableName: awsManager.tables.users,
                Key: { userId: m.userId },
                UpdateExpression: 'REMOVE teamId, teamRole, proxyUserId',
              }));
              console.log(`  🧹 Cleared team fields from member ${m.userId}`);
            } catch {}
          }
          await awsManager.dynamodb.send(new DeleteCommand({
            TableName: TEAMS_TABLE,
            Key: { teamId: team.teamId },
          }));
          console.log('✅ Team record deleted');
        } else {
          // Member deleted — splice them out of the members array
          console.log(`Removing user from team ${team.teamId} (user was member)…`);
          const updatedMembers = (team.members || []).filter(m => m.userId !== userId);
          await awsManager.dynamodb.send(new UpdateCommand({
            TableName: TEAMS_TABLE,
            Key: { teamId: team.teamId },
            UpdateExpression: 'SET members = :m',
            ExpressionAttributeValues: { ':m': updatedMembers },
          }));
          console.log('✅ Removed from team members list');
        }
      } else {
        console.log(`⚠️  teamId ${user.teamId} points to non-existent team — skipping`);
      }
    } else {
      // Also scan teams table for any orphaned references to this userId
      const orphanScan = await awsManager.dynamodb.send(new ScanCommand({ TableName: TEAMS_TABLE }));
      for (const team of (orphanScan.Items || [])) {
        if (team.ownerId === userId) {
          console.log(`⚠️  Found orphaned team ${team.teamId} owned by this user — deleting…`);
          for (const m of (team.members || [])) {
            try {
              await awsManager.dynamodb.send(new UpdateCommand({
                TableName: awsManager.tables.users,
                Key: { userId: m.userId },
                UpdateExpression: 'REMOVE teamId, teamRole, proxyUserId',
              }));
            } catch {}
          }
          await awsManager.dynamodb.send(new DeleteCommand({ TableName: TEAMS_TABLE, Key: { teamId: team.teamId } }));
          console.log(`✅ Orphaned team ${team.teamId} deleted`);
        } else if ((team.members || []).some(m => m.userId === userId)) {
          console.log(`⚠️  Found orphaned membership in team ${team.teamId} — removing…`);
          const updatedMembers = (team.members || []).filter(m => m.userId !== userId);
          await awsManager.dynamodb.send(new UpdateCommand({
            TableName: TEAMS_TABLE,
            Key: { teamId: team.teamId },
            UpdateExpression: 'SET members = :m',
            ExpressionAttributeValues: { ':m': updatedMembers },
          }));
          console.log(`✅ Removed from orphaned team`);
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Delete user record from Users table
    console.log('Deleting user record from Users table...');
    await awsManager.dynamodb.send(new DeleteCommand({
      TableName: awsManager.tables.users,
      Key: { userId }
    }));
    console.log('✅ User record deleted');

    // Scrub IP/device hashes from any OTHER users that share the same values.
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
      await awsManager.dynamodb.send(new DeleteCommand({
        TableName: awsManager.tables.userSettings,
        Key: { userId }
      }));
      console.log('✅ User settings deleted');
    } catch {
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
