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
 * Start the metrics recording cron job
 * Runs every 10 minutes for testing, then can be changed to hourly
 */
export function startMetricsCron() {
  console.log('📊 [METRICS CRON] Initializing metrics recording...');
  
  // Run every 10 minutes (change to '0 * * * *' for hourly in production)
  cron.schedule('*/10 * * * *', recordAllMetrics);
  
  // Also run immediately on startup
  console.log('📊 [METRICS CRON] Running initial snapshot now...');
  recordAllMetrics();
  
  console.log('✅ [METRICS CRON] Scheduled to run every 10 minutes');
}
