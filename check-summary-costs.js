#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

async function checkSummaryCosts() {
  const aws = new AWSManager();
  
  // Find user by email
  const scanResult = await aws.dynamodb.send(new ScanCommand({
    TableName: aws.tables.users
  }));
  
  const user = scanResult.Items.find(u => u.email === 'colton.aalogin@gmail.com');
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`\n👤 User: ${user.email}`);
  console.log(`   User ID: ${user.userId}\n`);
  
  // Get costs from summary table
  console.log('📊 Checking summary table (fast lookup)...\n');
  const summaryResult = await aws.getUserApiUsageSummary(user.userId);
  
  if (summaryResult.success && summaryResult.stats) {
    let total = 0;
    Object.entries(summaryResult.stats).forEach(([service, data]) => {
      if (data.cost > 0) {
        console.log(`${service}:`);
        console.log(`  Calls: ${data.calls}`);
        console.log(`  Usage: ${data.usage}`);
        console.log(`  Cost: $${data.cost.toFixed(4)}`);
        total += data.cost;
      }
    });
    console.log(`\n💰 SUMMARY TABLE TOTAL: $${total.toFixed(4)}`);
  } else {
    console.log('❌ Failed to get summary data');
  }
  
  process.exit(0);
}

checkSummaryCosts();
