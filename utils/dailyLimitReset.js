/**
 * DAILY LIMIT RESET CRON
 * 
 * Runs every hour to check if it's midnight in user's timezone.
 * Resets daily usage counters and resumes paused agents.
 * 
 * IMPLEMENTATION STATUS: READY BUT COMMENTED OUT
 * 
 * Usage in app.js:
 *   import { startDailyLimitReset } from './utils/dailyLimitReset.js';
 *   startDailyLimitReset();
 */

/*
import AWSManager from './awsManager.js';

class DailyLimitReset {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
    this.awsManager = new AWSManager();
    
    // Check every hour
    this.CHECK_INTERVAL_MS = 60 * 60 * 1000;
  }
  
  // Start the reset cron
  start() {
    if (this.isRunning) {
      console.log('⚠️ [DAILY RESET] Already running');
      return;
    }
    
    console.log('🕐 [DAILY RESET] Starting daily limit reset cron (checks every hour)');
    this.isRunning = true;
    
    // Check immediately on start
    this.checkAndReset();
    
    // Then check every hour
    this.checkInterval = setInterval(() => {
      this.checkAndReset();
    }, this.CHECK_INTERVAL_MS);
  }
  
  // Stop the reset cron
  stop() {
    console.log('🛑 [DAILY RESET] Stopping daily limit reset cron');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  // Check if it's midnight in any user's timezone and reset limits
  async checkAndReset() {
    try {
      console.log('🕐 [DAILY RESET] Checking for midnight resets...');
      
      // Get all users with daily limits enabled
      const users = await this.awsManager.getUsersWithDailyLimits();
      
      if (!users || users.length === 0) {
        console.log('📊 [DAILY RESET] No users with daily limits configured');
        return;
      }
      
      console.log(`📊 [DAILY RESET] Checking ${users.length} users`);
      
      for (const user of users) {
        await this.checkUserReset(user);
      }
      
      console.log('✅ [DAILY RESET] Check complete');
    } catch (error) {
      console.error('❌ [DAILY RESET] Error during reset check:', error);
    }
  }
  
  // Check and reset for a specific user
  async checkUserReset(user) {
    try {
      const { userId, timezone, dailyLimits } = user;
      
      // Get current time in user's timezone
      const userTime = new Date().toLocaleString('en-US', { 
        timeZone: timezone || 'America/New_York',
        hour12: false 
      });
      
      const userDate = new Date(userTime);
      const userHour = userDate.getHours();
      
      // Check if it's midnight hour (00:00-00:59)
      if (userHour !== 0) {
        return; // Not midnight yet
      }
      
      console.log(`🌙 [DAILY RESET] Midnight detected for user ${userId} (${timezone})`);
      
      // Check if we already reset today
      const lastReset = await this.awsManager.getLastDailyReset(userId);
      const lastResetDate = lastReset ? new Date(lastReset).toDateString() : null;
      const currentDate = userDate.toDateString();
      
      if (lastResetDate === currentDate) {
        console.log(`⏭️ [DAILY RESET] Already reset today for ${userId}`);
        return;
      }
      
      // Perform reset
      console.log(`🔄 [DAILY RESET] Resetting daily limits for ${userId}`);
      
      // Reset usage counters
      await this.awsManager.resetDailyUsage(userId);
      
      // Resume paused agents
      const resumedAgents = await this.resumePausedAgents(userId);
      
      // Record reset timestamp
      await this.awsManager.recordDailyReset(userId);
      
      // Send notification
      await this.sendResetNotification(userId, resumedAgents);
      
      console.log(`✅ [DAILY RESET] Reset complete for ${userId}. Resumed ${resumedAgents} agent(s)`);
      
    } catch (error) {
      console.error(`❌ [DAILY RESET] Error resetting user ${user.userId}:`, error);
    }
  }
  
  // Resume agents that were paused due to daily limits
  async resumePausedAgents(userId) {
    try {
      // Get all agents for user
      const { getUserActiveAgents } = await import('../agent/reasoningLeadAgent.js');
      const agents = getUserActiveAgents(userId);
      
      let resumed = 0;
      
      for (const agentInfo of agents) {
        // Check if agent was paused due to daily limit
        const agentSettings = await this.awsManager.getLeadAgentSettings(userId, agentInfo.agentId);
        
        if (agentSettings?.pauseReason === 'daily_limit') {
          console.log(`▶️ [DAILY RESET] Resuming agent ${agentInfo.agentId}`);
          
          // Clear pause reason
          await this.awsManager.updateLeadAgentSettings(userId, agentInfo.agentId, {
            pauseReason: null,
            isPaused: false
          });
          
          // Restart agent if it was running before
          if (agentSettings.wasRunning) {
            const { getUserAgent } = await import('../agent/reasoningLeadAgent.js');
            const agent = getUserAgent(userId, agentInfo.agentId);
            await agent.start();
          }
          
          resumed++;
        }
      }
      
      return resumed;
    } catch (error) {
      console.error(`❌ [DAILY RESET] Error resuming agents for ${userId}:`, error);
      return 0;
    }
  }
  
  // Send notification about reset
  async sendResetNotification(userId, resumedCount) {
    try {
      await this.awsManager.addIssue(
        userId,
        'info',
        'Daily Limits Reset',
        `Your daily usage limits have been reset. ${resumedCount > 0 ? `${resumedCount} agent(s) resumed.` : 'All systems operational.'}`,
        {
          resetTime: new Date().toISOString(),
          agentsResumed: resumedCount,
          type: 'daily_reset'
        }
      );
    } catch (error) {
      console.error('❌ [DAILY RESET] Failed to send notification:', error);
    }
  }
}

// Singleton instance
let instance = null;

export function getDailyLimitReset() {
  if (!instance) {
    instance = new DailyLimitReset();
  }
  return instance;
}

export function startDailyLimitReset() {
  const reset = getDailyLimitReset();
  reset.start();
}

export function stopDailyLimitReset() {
  const reset = getDailyLimitReset();
  reset.stop();
}

export default DailyLimitReset;
*/

// TEMPORARY PLACEHOLDER - Remove when uncommenting above
console.log('⚠️ Daily Limit Reset system ready but commented out');
export function startDailyLimitReset() {
  console.log('📊 Daily limit reset cron would start here');
}
export function stopDailyLimitReset() {
  console.log('📊 Daily limit reset cron would stop here');
}
