/**
 * Admin tools for managing user accounts in DynamoDB
 * Run with: node admin-user-tools.js
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import 'dotenv/config';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamodb = DynamoDBDocumentClient.from(client);
const USERS_TABLE = 'meridian-users';

/**
 * Load all users from DynamoDB
 */
async function loadUsers() {
  try {
    const command = new ScanCommand({
      TableName: USERS_TABLE
    });
    
    const result = await dynamodb.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('❌ Error loading users from DynamoDB:', error);
    return [];
  }
}

/**
 * Delete a user from DynamoDB
 */
async function deleteUser(userId) {
  try {
    const command = new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    });
    
    await dynamodb.send(command);
    console.log('✅ User deleted from DynamoDB');
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    throw error;
  }
}

/**
 * List all registered users
 */
async function listUsers() {
  console.log('\n📋 Loading registered users...\n');
  
  const users = await loadUsers();
  
  if (users.length === 0) {
    console.log('❌ No users found');
    return;
  }

  console.log(`✅ Found ${users.length} registered users:\n`);
  
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.username} (${user.email})`);
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
    console.log('');
  });
}

/**
 * Remove a user by email
 */
async function removeUserByEmail(email) {
  console.log(`\n🗑️  Removing user: ${email}\n`);
  
  const users = await loadUsers();
  const initialCount = users.length;
  
  // Find the user (case-insensitive)
  const userToRemove = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!userToRemove) {
    console.log(`❌ User with email ${email} not found\n`);
    console.log('Available users:');
    users.forEach(u => console.log(`  - ${u.email} (${u.username})`));
    return;
  }

  console.log(`✓ Found user:`);
  console.log(`  Username: ${userToRemove.username}`);
  console.log(`  Email: ${userToRemove.email}`);
  console.log(`  User ID: ${userToRemove.userId}`);
  console.log(`  Created: ${new Date(userToRemove.createdAt).toLocaleString()}`);
  console.log('');

  // Delete from DynamoDB
  await deleteUser(userToRemove.userId);
  
  console.log(`✅ User ${email} removed successfully!`);
  console.log(`   Total users remaining: ${initialCount - 1}\n`);
}

/**
 * Remove a user by username
 */
async function removeUserByUsername(username) {
  console.log(`\n🗑️  Removing user: ${username}\n`);
  
  const users = await loadUsers();
  const initialCount = users.length;
  
  // Find the user (case-insensitive)
  const userToRemove = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!userToRemove) {
    console.log(`❌ User with username ${username} not found\n`);
    console.log('Available users:');
    users.forEach(u => console.log(`  - ${u.username} (${u.email})`));
    return;
  }

  console.log(`✓ Found user:`);
  console.log(`  Username: ${userToRemove.username}`);
  console.log(`  Email: ${userToRemove.email}`);
  console.log(`  User ID: ${userToRemove.userId}`);
  console.log(`  Created: ${new Date(userToRemove.createdAt).toLocaleString()}`);
  console.log('');

  // Delete from DynamoDB
  await deleteUser(userToRemove.userId);
  
  console.log(`✅ User ${username} removed successfully!`);
  console.log(`   Total users remaining: ${initialCount - 1}\n`);
}

/**
 * Find a user by email or username
 */
async function findUser(query) {
  console.log(`\n🔍 Searching for user: ${query}\n`);
  
  const users = await loadUsers();
  
  const found = users.filter(u => 
    u.email.toLowerCase().includes(query.toLowerCase()) ||
    u.username.toLowerCase().includes(query.toLowerCase())
  );

  if (found.length === 0) {
    console.log('❌ No matching users found');
    return;
  }

  console.log(`✅ Found ${found.length} matching user(s):\n`);
  
  found.forEach((user, index) => {
    console.log(`${index + 1}. ${user.username} (${user.email})`);
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
    console.log('');
  });
}

// Run commands
const command = process.argv[2];
const param = process.argv[3];

(async () => {
  console.log('\n=== User Account Admin Tool ===\n');

  switch (command) {
    case 'list':
      await listUsers();
      break;
      
    case 'find':
      if (!param) {
        console.log('❌ Please provide a search query');
        console.log('Usage: node admin-user-tools.js find <email or username>');
        process.exit(1);
      }
      await findUser(param);
      break;
      
    case 'remove-email':
      if (!param) {
        console.log('❌ Please provide an email address');
        console.log('Usage: node admin-user-tools.js remove-email user@example.com');
        process.exit(1);
      }
      await removeUserByEmail(param);
      break;
      
    case 'remove-username':
      if (!param) {
        console.log('❌ Please provide a username');
        console.log('Usage: node admin-user-tools.js remove-username johndoe');
        process.exit(1);
      }
      await removeUserByUsername(param);
      break;
      
    case 'remove-nathan':
      // Shortcut for your specific request
      await removeUserByEmail('officialnathandel@gmail.com');
      break;
      
    default:
      console.log('Available commands:');
      console.log('  list                          - List all registered users');
      console.log('  find <query>                  - Search for user by email or username');
      console.log('  remove-email <email>          - Remove user by email');
      console.log('  remove-username <username>    - Remove user by username');
      console.log('  remove-nathan                 - Remove officialnathandel@gmail.com');
      console.log('\nExamples:');
      console.log('  node admin-user-tools.js list');
      console.log('  node admin-user-tools.js find nathan');
      console.log('  node admin-user-tools.js remove-email nathan@gmail.com');
      console.log('  node admin-user-tools.js remove-nathan');
      break;
  }

  console.log('\n=== Done ===\n');
  process.exit(0);
})();
