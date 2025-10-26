import dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const response = await dynamodb.send(new ScanCommand({
  TableName: 'meridian-email-queue',
  Limit: 10
}));

const items = response.Items || [];

console.log(`Found ${items.length} emails in DynamoDB\n`);

items.forEach((item, index) => {
  console.log(`Email ${index + 1}:`);
  console.log(`  PK: ${item.PK}`);
  console.log(`  SK: ${item.SK}`);
  console.log(`  Status: ${item.status}`);
  console.log(`  To: ${item.to}`);
  console.log(`  CC: ${item.cc || '(none)'}`);
  console.log(`  Subject: ${item.subject?.substring(0, 60)}...`);
  console.log(`  Company (lead.company): ${item.lead?.company}`);
  console.log(`  Company (leadInfo.company): ${item.leadInfo?.company}`);
  console.log('');
});
