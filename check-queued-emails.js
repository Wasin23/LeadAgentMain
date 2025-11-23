#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { getAWSEmailQueue } from './utils/awsEmailQueue.js';
import AWSManager from './utils/awsManager.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

async function checkQueuedEmails() {
  const aws = new AWSManager();
  
  // Find user
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
  
  // Get user's agents
  const agents = await aws.getUserAgents(user.userId);
  console.log(`Found ${agents.length} agents\n`);
  
  const awsEmailQueue = getAWSEmailQueue();
  
  // Check queued emails for each agent
  for (const agent of agents) {
    console.log(`\n📧 Agent: ${agent.name} (${agent.agentId})`);
    
    const queued = await awsEmailQueue.getQueuedEmails(user.userId, agent.agentId);
    console.log(`   Queued: ${queued.length} emails`);
    
    if (queued.length > 0) {
      // Show the most recent queued email
      const recent = queued[queued.length - 1];
      console.log(`\n   Most recent email:`);
      console.log(`   - To: ${recent.to}`);
      console.log(`   - Company: ${recent.lead?.company || recent.leadInfo?.company || 'N/A'}`);
      console.log(`   - Subject: ${recent.subject}`);
      console.log(`   - Has confidenceReport: ${!!recent.confidenceReport}`);
      console.log(`   - Confidence Level: ${recent.confidenceLevel || 'N/A'}`);
      
      if (recent.confidenceReport) {
        console.log(`   - Confidence Report:`);
        console.log(`     ${recent.confidenceReport.substring(0, 200)}${recent.confidenceReport.length > 200 ? '...' : ''}`);
      } else {
        console.log(`   ⚠️  NO CONFIDENCE REPORT FOUND!`);
      }
    }
  }
  
  process.exit(0);
}

checkQueuedEmails();
