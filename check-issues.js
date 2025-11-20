#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const userId = process.argv[2] || '5781c511-2307-4fcf-a763-33e8ec64a638';

async function checkIssues() {
  const aws = new AWSManager();
  const issues = await aws.getIssues(userId, 20);
  
  console.log(`\n📋 Issues/Activity for ${userId}`);
  console.log(`Found ${issues.length} issue(s)\n`);
  
  issues.forEach(i => {
    console.log(`- [${i.severity.toUpperCase()}] ${i.type}: ${i.title}`);
    console.log(`  Date: ${new Date(i.timestamp).toLocaleString()}`);
    if (i.data?.amount) console.log(`  Amount: $${i.data.amount}`);
    if (i.data?.error) console.log(`  Error: ${i.data.error.substring(0, 80)}...`);
    console.log('');
  });
  
  process.exit(0);
}

checkIssues();
