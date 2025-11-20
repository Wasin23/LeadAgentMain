#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const userId = process.argv[2] || '5781c511-2307-4fcf-a763-33e8ec64a638';

async function checkHistory() {
  const aws = new AWSManager();
  const history = await aws.getPaymentHistory(userId, 10);
  
  console.log(`\n💳 Payment History for ${userId}`);
  console.log(`Found ${history.length} payment(s)\n`);
  
  history.forEach(p => {
    console.log(`- ${p.status.toUpperCase()}: $${p.amount}`);
    console.log(`  Date: ${new Date(p.timestamp).toLocaleString()}`);
    console.log(`  Description: ${p.description}`);
    if (p.errorMessage) {
      console.log(`  Error: ${p.errorMessage.substring(0, 100)}...`);
    }
    console.log('');
  });
  
  process.exit(0);
}

checkHistory();
