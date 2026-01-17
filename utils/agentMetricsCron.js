import AWSManager from './awsManager.js';
import AWSEmailQueue from './awsEmailQueue.js';
import cron from 'node-cron';

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
    console.log(`📊 [METRICS CRON] Found ${users.length} users to process`);
    
    let totalRecorded = 0;
    
    for (const user of users) {
      try {
        // Get all agents for this user
        const agents = await awsManager.getAgents(user.userId);
        
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
      } catch (error) {
        console.error(`❌ [METRICS CRON] Error processing user ${user.userId}:`, error.message);
      }
    }
    
    console.log(`✅ [METRICS CRON] Completed! Recorded metrics for ${totalRecorded} agents`);
  } catch (error) {
    console.error('❌ [METRICS CRON] Fatal error:', error);
  }
}

/**
 * Start the metrics recording cron job
 * Runs every hour at minute 0
 */
export function startMetricsCron() {
  console.log('📊 [METRICS CRON] Initializing hourly metrics recording...');
  
  // Run every hour at minute 0
  cron.schedule('0 * * * *', recordAllMetrics);
  
  // Also run immediately on startup
  recordAllMetrics();
  
  console.log('✅ [METRICS CRON] Scheduled to run every hour');
}
