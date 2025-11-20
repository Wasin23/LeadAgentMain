#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';

async function checkBillingLogs() {
  const aws = new AWSManager();
  const logs = await aws.getCycleLogs(userId, 'billing-system', 10);
  
  console.log(`\n💳 Found ${logs.length} billing activity logs:\n`);
  
  logs.forEach(l => {
    console.log(`- ${new Date(l.timestamp).toLocaleString()}: ${l.success ? '✅ SUCCESS' : '❌ FAILED'} - $${l.metadata?.amount || 0}`);
    if (l.metadata?.error) {
      console.log(`  Error: ${l.metadata.error.substring(0, 80)}...`);
    }
  });
  
  process.exit(0);
}

checkBillingLogs();
