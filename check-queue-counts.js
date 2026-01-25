import dotenv from 'dotenv';
dotenv.config();

import { getAWSEmailQueue } from './utils/awsEmailQueue.js';

const userId = '5344c009-768d-4d7f-a399-4704507bf852';
const agentId = '625350';

const awsQueue = getAWSEmailQueue();

console.log('\n=== CHECKING QUEUE COUNTS ===\n');

// Get total count
const totalCount = await awsQueue.getQueuedEmailCount(userId);
console.log(`Total queued emails (all agents): ${totalCount}`);

// Get specific agent count
const agentPK = `${userId}#${agentId}`;
console.log(`\nChecking agent ${agentId} with PK: ${agentPK}`);

const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
const agentCountResponse = await awsQueue.dynamodb.send(new QueryCommand({
  TableName: awsQueue.tableName,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
  ExpressionAttributeValues: {
    ':pk': agentPK,
    ':status': 'QUEUED#'
  },
  Select: 'COUNT'
}));
console.log(`Agent ${agentId} count: ${agentCountResponse.Count}`);

// Get orphan count
const orphanPK = `${userId}#orphan`;
const orphanCountResponse = await awsQueue.dynamodb.send(new QueryCommand({
  TableName: awsQueue.tableName,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :status)',
  ExpressionAttributeValues: {
    ':pk': orphanPK,
    ':status': 'QUEUED#'
  },
  Select: 'COUNT'
}));
console.log(`Orphan count: ${orphanCountResponse.Count}`);

console.log(`\nAgent + Orphan = ${agentCountResponse.Count} + ${orphanCountResponse.Count} = ${agentCountResponse.Count + orphanCountResponse.Count}`);
console.log(`Total count from GSI: ${totalCount}`);
console.log(`Difference: ${(agentCountResponse.Count + orphanCountResponse.Count) - totalCount}`);
