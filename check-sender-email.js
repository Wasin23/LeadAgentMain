import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const USER_ID = '459e58d2-f249-4586-92c0-4e5590c68bad';
const aws = new AWSManager();

async function main() {
  console.log(`\n🔍 Checking sender email config for user: ${USER_ID}\n`);

  // ── 1. User-level email connections ─────────────────────────────────────
  const settings = await aws.getUserSettings(USER_ID);

  console.log('═══════════════════════════════════════════════════');
  console.log('📬 CONNECTED EMAIL ACCOUNTS (user-level)');
  console.log('═══════════════════════════════════════════════════');

  // Gmail
  if (settings?.gmailAccounts?.length > 0) {
    const activeIdx = settings.activeGmailIndex ?? 0;
    console.log(`\n✉️  Gmail accounts (${settings.gmailAccounts.length}):`);
    settings.gmailAccounts.forEach((acc, i) => {
      const active = i === activeIdx ? ' ← ACTIVE' : '';
      console.log(`   [${i}] ${acc.email}  (isActive: ${acc.isActive ?? 'n/a'})${active}`);
    });
  } else if (settings?.gmailAuth?.email) {
    console.log(`\n✉️  Gmail (legacy single-account): ${settings.gmailAuth.email}`);
  } else {
    console.log('\n✉️  Gmail: NOT connected');
  }

  // Outlook
  if (settings?.outlookAccounts?.length > 0) {
    const activeIdx = settings.activeOutlookIndex ?? 0;
    console.log(`\n📨 Outlook accounts (${settings.outlookAccounts.length}):`);
    settings.outlookAccounts.forEach((acc, i) => {
      const active = i === activeIdx ? ' ← ACTIVE' : '';
      console.log(`   [${i}] ${acc.email}${active}`);
    });
  } else {
    console.log('\n📨 Outlook: NOT connected');
  }

  // ── 2. Per-agent email sender config ────────────────────────────────────
  const user = await aws.getUserById(USER_ID);
  const agents = (user?.activeAgents || []).filter(a => a.agentId !== 'orphan');

  console.log(`\n${'═'.repeat(51)}`);
  console.log(`🤖 AGENTS (${agents.length} found)`);
  console.log('═'.repeat(51));

  for (const agent of agents) {
    console.log(`\n  Agent: "${agent.name || agent.agentName || 'Unnamed'}" (${agent.agentId})`);
    console.log(`  Status: ${agent.status || 'unknown'}`);

    try {
      const agentSettings = await aws.getAgentSettings(USER_ID, agent.agentId);
      const eb = agentSettings?.emailBuilder || {};

      const useGmail   = eb.useGmail   ?? false;
      const useOutlook = eb.useOutlook ?? false;
      const fromEmail  = eb.fromEmail  || null;

      if (fromEmail) {
        console.log(`  📤 Sending from (explicit): ${fromEmail}`);
      } else if (useGmail && useOutlook) {
        console.log(`  📤 Sending via: BOTH Gmail + Outlook (cycling)`);
      } else if (useGmail) {
        const activeIdx = settings?.activeGmailIndex ?? 0;
        const activeGmail = settings?.gmailAccounts?.[activeIdx]?.email
          || settings?.gmailAuth?.email
          || '(no email found)';
        console.log(`  📤 Sending via: Gmail → ${activeGmail}`);
      } else if (useOutlook) {
        const activeIdx = settings?.activeOutlookIndex ?? 0;
        const activeOutlook = settings?.outlookAccounts?.[activeIdx]?.email || '(no email found)';
        console.log(`  📤 Sending via: Outlook → ${activeOutlook}`);
      } else {
        console.log(`  📤 Sending via: NOT CONFIGURED (useGmail=false, useOutlook=false)`);
      }

      if (agentSettings?.emailBuilder) {
        console.log(`  ⚙️  emailBuilder raw:`, JSON.stringify(eb, null, 4).replace(/^/gm, '     '));
      }
    } catch (err) {
      console.log(`  ⚠️  Could not load agent settings: ${err.message}`);
    }
  }

  console.log('\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
