// Quick script to check what's stored in AWS for agent 605860
import dotenv from 'dotenv';
import fs from 'fs';
import AWSManager from './utils/awsManager.js';

dotenv.config();

const awsManager = new AWSManager();
const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
const agentId = '605860';

console.log('🔍 Checking agent data in AWS...\n');

let output = '';

// Get agent settings
const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
output += '📊 Agent Settings from AWS:\n';
output += JSON.stringify(agentSettings, null, 2) + '\n\n';

output += '🏢 Company Branding specifically:\n';
output += JSON.stringify(agentSettings?.companyBranding, null, 2) + '\n\n';

// Get general user settings
const userSettings = await awsManager.getUserSettings(userId);
output += '👤 General User Settings - Company Profile:\n';
output += JSON.stringify(userSettings?.companyProfile, null, 2) + '\n';

console.log(output);
fs.writeFileSync('agent-data-output.txt', output);
console.log('\n✅ Output written to agent-data-output.txt');

process.exit(0);
