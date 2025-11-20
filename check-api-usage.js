#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

async function checkApiUsage() {
  const aws = new AWSManager();
  
  console.log('📊 Scanning API usage table...\n');
  
  const scan = new ScanCommand({
    TableName: aws.tables.apiUsage
  });
  
  const result = await aws.dynamodb.send(scan);
  const items = result.Items || [];
  
  console.log(`Found ${items.length} API usage records\n`);
  
  // Group by user
  const byUser = {};
  items.forEach(item => {
    if (!byUser[item.userId]) {
      byUser[item.userId] = { count: 0, total: 0, records: [] };
    }
    byUser[item.userId].count++;
    byUser[item.userId].total += item.cost || 0;
    byUser[item.userId].records.push(item);
  });
  
  // Show per user
  for (const [userId, data] of Object.entries(byUser)) {
    const user = await aws.getUserById(userId);
    console.log(`User: ${user?.email || userId}`);
    console.log(`  Total Cost: $${data.total.toFixed(2)}`);
    console.log(`  API Calls: ${data.count}`);
    console.log(`  Has Stripe: ${user?.stripeCustomerId ? '✅' : '❌'}`);
    console.log('');
  }
  
  const grandTotal = Object.values(byUser).reduce((sum, u) => sum + u.total, 0);
  console.log(`\n💰 Grand Total: $${grandTotal.toFixed(2)}`);
  
  process.exit(0);
}

checkApiUsage();
