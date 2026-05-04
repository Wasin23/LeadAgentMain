/**
 * One-time script to create the meridian-teams DynamoDB table.
 * Usage: node create-teams-table.js
 */

import 'dotenv/config';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const TABLE_NAME = process.env.AWS_DYNAMODB_TEAMS_TABLE || 'meridian-teams';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({
  region: REGION,
  credentials: fromNodeProviderChain(),
});

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return false;
    throw e;
  }
}

async function run() {
  console.log(`Creating DynamoDB table: ${TABLE_NAME} in ${REGION}`);

  if (await tableExists()) {
    console.log(`Table "${TABLE_NAME}" already exists. Nothing to do.`);
    return;
  }

  await client.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'teamId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'teamId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [
      { Key: 'Project', Value: 'Meridian' },
      { Key: 'Purpose', Value: 'Teams' },
    ],
  }));

  // Wait for table to become ACTIVE
  console.log('Waiting for table to become ACTIVE...');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    const status = desc.Table?.TableStatus;
    console.log(`  status: ${status}`);
    if (status === 'ACTIVE') {
      console.log(`Table "${TABLE_NAME}" is ready.`);
      return;
    }
  }

  console.warn('Table created but did not become ACTIVE within 60s. Check the AWS console.');
}

run().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
