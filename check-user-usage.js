#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

async function checkUserUsage() {
  const aws = new AWSManager();
  const users = await aws.getAllUsers();
  
  console.log('📊 Checking API usage for users with payment methods...\n');
  
  for (const u of users) {
    if (u.stripeCustomerId) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const query = new QueryCommand({
        TableName: aws.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId AND #timestamp >= :start',
        ExpressionAttributeNames: { '#timestamp': 'timestamp' },
        ExpressionAttributeValues: {
          ':userId': u.userId,
          ':start': start.toISOString()
        }
      });
      
      const result = await aws.dynamodb.send(query);
      let cost = 0;
      (result.Items || []).forEach(r => cost += r.cost || 0);
      
      if (cost > 0) {
        console.log(`✅ ${u.email}: $${cost.toFixed(2)} (${result.Items.length} API calls)`);
      } else {
        console.log(`⚪ ${u.email}: $0.00 (no usage)`);
      }
    }
  }
  
  process.exit(0);
}

checkUserUsage();
