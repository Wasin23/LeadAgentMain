import dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// Scan for all emails and group by status
const response = await dynamodb.send(new ScanCommand({
  TableName: 'meridian-email-queue',
  Limit: 50 // Get more results
}));

const items = response.Items || [];

// Group by status
const grouped = items.reduce((acc, item) => {
  const status = item.status || 'UNKNOWN';
  if (!acc[status]) acc[status] = [];
  acc[status].push(item);
  return acc;
}, {});

console.log('=== EMAIL QUEUE SUMMARY ===\n');
Object.keys(grouped).forEach(status => {
  console.log(`${status}: ${grouped[status].length} emails`);
});

console.log('\n=== SENT EMAILS ===\n');
const sentEmails = grouped['SENT'] || [];
if (sentEmails.length === 0) {
  console.log('No sent emails found in the database.');
} else {
  sentEmails.forEach((item, index) => {
    console.log(`Sent Email ${index + 1}:`);
    console.log(`  PK: ${item.PK}`);
    console.log(`  SK: ${item.SK}`);
    console.log(`  To: ${item.to}`);
    console.log(`  CC: ${item.cc || '(none)'}`);
    console.log(`  Subject: ${item.subject?.substring(0, 60)}...`);
    console.log(`  Company (lead.company): ${item.lead?.company}`);
    console.log(`  Company (leadInfo.company): ${item.leadInfo?.company}`);
    console.log(`  Sent At: ${item.sentAt || item.approvedAt || 'N/A'}`);
    console.log(`  Sender Name: ${item.senderName || '(not stored - fetched from settings)'}`);
    console.log('');
  });
}

console.log('\n=== APPROVED EMAILS (Ready to Send) ===\n');
const approvedEmails = grouped['APPROVED'] || [];
if (approvedEmails.length === 0) {
  console.log('No approved emails found.');
} else {
  console.log(`Found ${approvedEmails.length} approved emails waiting to be sent.`);
  approvedEmails.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.to} - ${item.subject?.substring(0, 40)}...`);
  });
}

console.log('\n=== QUEUED EMAILS (Pending Approval) ===\n');
const queuedEmails = grouped['QUEUED'] || grouped['pending'] || [];
if (queuedEmails.length === 0) {
  console.log('No queued emails found.');
} else {
  console.log(`Found ${queuedEmails.length} emails pending approval.`);
  queuedEmails.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.to} - ${item.subject?.substring(0, 40)}... (Company: ${item.lead?.company || 'Unknown'})`);
  });
}
