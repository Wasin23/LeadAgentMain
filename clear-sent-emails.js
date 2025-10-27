import dotenv from 'dotenv';
dotenv.config();

import { getAWSEmailQueue } from './utils/awsEmailQueue.js';

const awsQueue = getAWSEmailQueue();

// Your user ID
const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
const agentId = '904647'; // The old agent with the orphaned email

console.log(`🗑️ Clearing sent emails for agent ${agentId}...`);

const result = await awsQueue.clearSentEmails(userId, agentId);

console.log(`✅ Cleared ${result.clearedCount} sent emails`);

process.exit(0);
