import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import cron from 'node-cron';
import { getUserById } from '../lib/userManager.js';

const awsManager = new AWSManager();
const awsQueue = new AWSEmailQueue();

/**
 * Record metrics snapshot for all users and their agents
 * Runs every hour
 */
async function recordAllMetrics() {
  try {
    console.log('\n📊 [METRICS CRON] Starting hourly metrics snapshot...');
    const timestamp = new Date().toISOString();
    
    // Get all users
    const users = await awsManager.getAllUsers();
    // Reduced logging - removed user count
    
    let totalRecorded = 0;
    
    for (const user of users) {
      try {
        // Get all agents from user record
        const userRecord = await getUserById(user.userId);
        const agents = userRecord?.activeAgents || [];
        
        // Record metrics for each agent
        for (const agent of agents) {
          try {
            const [queuedEmails, sentEmails] = await Promise.all([
              awsQueue.getQueuedEmailsForAgent(user.userId, agent.agentId),
              awsQueue.getSentEmailsForAgent(user.userId, agent.agentId)
            ]);
            
            const repliedEmails = sentEmails.filter(e => e.replied || e.status === 'REPLIED');
            
            await awsManager.recordAgentMetrics({
              userId: user.userId,
              agentId: agent.agentId,
              timestamp,
              metrics: {
                queued: queuedEmails.length,
                sent: sentEmails.length,
                replied: repliedEmails.length
              }
            });
            
            totalRecorded++;
          } catch (error) {
            console.error(`❌ [METRICS CRON] Error recording metrics for agent ${agent.agentId}:`, error.message);
          }
        }
        
        // Also record orphaned emails for this user
        try {
          const [orphanQueued, orphanSent] = await Promise.all([
            awsQueue.getQueuedEmailsForAgent(user.userId, 'orphan'),
            awsQueue.getSentEmailsForAgent(user.userId, 'orphan')
          ]);
          
          if (orphanQueued.length > 0 || orphanSent.length > 0) {
            const orphanReplied = orphanSent.filter(e => e.replied || e.status === 'REPLIED');
            
            await awsManager.recordAgentMetrics({
              userId: user.userId,
              agentId: 'orphan',
              timestamp,
              metrics: {
                queued: orphanQueued.length,
                sent: orphanSent.length,
                replied: orphanReplied.length
              }
            });
            
            totalRecorded++;
            // Recorded orphan metrics - silent
          }
        } catch (error) {
          console.error(`❌ [METRICS CRON] Error recording orphan metrics:`, error.message);
        }
      } catch (error) {
        console.error(`❌ [METRICS CRON] Error processing user ${user.userId}:`, error.message);
      }
    }
    
    // Metrics cron completed - silent
  } catch (error) {
    console.error('❌ [METRICS CRON] Fatal error:', error);
  }
}

/**
 * Nightly counter reconciliation — resets all user counter items from real GSI data.
 * Corrects any drift caused by missed counter updates (e.g. server crash mid-operation).
 * Runs at 3:00 AM EST every day.
 */
async function reconcileAllCounters() {
  try {
    console.log('\n🔄 [COUNTER RECONCILE] Starting nightly counter reconciliation...');
    const users = await awsManager.getAllUsers();
    
    let success = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.userId) continue;
      try {
        await awsQueue.reconcileCounters(user.userId);
        success++;
      } catch (error) {
        console.error(`❌ [COUNTER RECONCILE] Failed for user ${user.userId}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ [COUNTER RECONCILE] Done. Success: ${success}, Failed: ${failed}`);
  } catch (error) {
    console.error('❌ [COUNTER RECONCILE] Fatal error:', error);
  }
}

/**
 * Start the metrics recording cron job
 * Runs every 10 minutes for testing, then can be changed to hourly
 */
export function startMetricsCron() {
  console.log('📊 [METRICS CRON] Initializing metrics recording...');
  
  // Run every 10 minutes (change to '0 * * * *' for hourly in production)
  cron.schedule('*/10 * * * *', recordAllMetrics);
  
  // Nightly counter reconciliation at 3:00 AM EST
  cron.schedule('0 3 * * *', reconcileAllCounters, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  // Also run immediately on startup
  console.log('📊 [METRICS CRON] Running initial snapshot now...');
  recordAllMetrics();
  
  console.log('✅ [METRICS CRON] Scheduled to run every 10 minutes');
  console.log('✅ [COUNTER RECONCILE] Scheduled nightly at 3:00 AM EST');
}
