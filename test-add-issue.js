import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';

const awsManager = new AWSManager();

console.log('🧪 Adding test issue...');

// Add a test issue
await awsManager.addIssue(
  userId,
  'error',
  'Test Error Issue',
  'This is a test error to verify the issues and alerts system is working correctly.',
  {
    testData: true,
    timestamp: new Date().toISOString(),
    component: 'test-script'
  }
);

console.log('✅ Added error issue');

// Add a warning
await awsManager.addIssue(
  userId,
  'warning',
  'Test Warning Issue',
  'This is a test warning to verify the issues and alerts system displays different types.',
  {
    testData: true,
    timestamp: new Date().toISOString(),
    component: 'test-script'
  }
);

console.log('✅ Added warning issue');

// Add an info
await awsManager.addIssue(
  userId,
  'info',
  'Test Info Issue',
  'This is a test info message to verify the issues and alerts system.',
  {
    testData: true,
    timestamp: new Date().toISOString(),
    component: 'test-script'
  }
);

console.log('✅ Added info issue');

// Get all issues
const issues = await awsManager.getIssues(userId);
console.log(`\n📊 Total issues in database: ${issues.length}`);
console.log('\nRecent issues:');
issues.slice(0, 5).forEach(issue => {
  console.log(`  - [${issue.type.toUpperCase()}] ${issue.title}: ${issue.message}`);
});

console.log('\n✅ Test issues added! Check your dashboard.');
