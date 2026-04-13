#!/usr/bin/env node
/**
 * Check what personality object is stored in DynamoDB for a given user/agent.
 *
 * Usage:
 *   node scripts_me/check-personality.js <userId> [agentId]
 */

import dotenv from 'dotenv';
dotenv.config();
import AWSManager from '../utils/awsManager.js';

const [userId, agentId] = process.argv.slice(2);

if (!userId) {
  console.error('Usage: node scripts_me/check-personality.js <userId> [agentId]');
  process.exit(1);
}

const aws = new AWSManager();
const settings = await aws.getLeadAgentSettings(userId, agentId || null);

console.log('\nRaw agentSettings.personality:');
console.log(JSON.stringify(settings?.personality, null, 2));
console.log('\npersonality.type:', settings?.personality?.type);
