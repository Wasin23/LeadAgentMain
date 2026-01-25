import dotenv from 'dotenv';
dotenv.config();

import { getAWSEmailQueue } from './utils/awsEmailQueue.js';

const userId = '5344c009-768d-4d7f-a399-4704507bf852';
const agentId = '625350';

const awsQueue = getAWSEmailQueue();

console.log('\n=== CHECKING QUEUE FOR AGENT 625350 ===\n');

const agentPK = `${userId}#${agentId}`;
console.log(`Agent PK: ${agentPK}`);

const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');

// Get count
const countResponse = await awsQueue.dynamodb.send(new QueryCommand({
  TableName: awsQueue.tableName,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
  ExpressionAttributeValues: {
    ':pk': agentPK,
    ':status': 'QUEUED#'
  },
  Select: 'COUNT'
}));
console.log(`\nCount: ${countResponse.Count}`);

// Get actual emails
const emailsResponse = await awsQueue.dynamodb.send(new QueryCommand({
  TableName: awsQueue.tableName,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
  ExpressionAttributeValues: {
    ':pk': agentPK,
    ':status': 'QUEUED#'
  }
}));

console.log(`\nActual emails returned: ${emailsResponse.Items?.length || 0}`);
console.log(`\nEmails for agent ${agentId}:`);
emailsResponse.Items?.forEach((item, i) => {
  console.log(`${i + 1}. ${item.to} - ${item.subject?.substring(0, 50)} (ID: ${item.id}, timestamp: ${item.timestamp})`);
});

// Check GSI to see if there are emails with different agentIds
console.log(`\n=== CHECKING GSI FOR ALL QUEUED EMAILS ===\n`);
const gsiResponse = await awsQueue.dynamodb.send(new QueryCommand({
  TableName: awsQueue.tableName,
  IndexName: 'UserStatusIndex',
  KeyConditionExpression: 'GSIPK = :gsipk',
  ExpressionAttributeValues: {
    ':gsipk': `${userId}#QUEUED`
  }
}));

console.log(`Total from GSI: ${gsiResponse.Items?.length || 0}`);

// Group by agentId
const byAgent = {};
gsiResponse.Items?.forEach(item => {
  const agentIdFromPK = item.PK.split('#')[1];
  byAgent[agentIdFromPK] = (byAgent[agentIdFromPK] || 0) + 1;
});

console.log(`\nEmails by agent:`);
Object.entries(byAgent).forEach(([aid, count]) => {
  console.log(`  ${aid}: ${count}`);
});
