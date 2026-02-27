/**
 * HEALTH MONITORING SYSTEM
 * 
 * Monitors agent health metrics:
 * - Cycle timeout detection (>2 hours)
 * - Memory usage monitoring (>80% threshold)
 * 
 * IMPLEMENTATION STATUS: READY BUT COMMENTED OUT
 * 
 * Usage in app.js:
 *   import { startHealthMonitoring } from './utils/healthMonitor.js';
 *   startHealthMonitoring();
 */

/*
class HealthMonitor {
  constructor() {
    this.cycleTimeouts = new Map(); // agentId -> timeout handle
    this.cycleStartTimes = new Map(); // agentId -> start timestamp
    this.memoryCheckInterval = null;
    this.isRunning = false;
    
    // Configuration
    this.CYCLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
    this.MEMORY_THRESHOLD = 0.80; // 80% of max heap
    this.MEMORY_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
  }
  
  // Start monitoring
  start() {
    if (this.isRunning) {
      console.log('⚠️ [HEALTH MONITOR] Already running');
      return;
    }
    
    console.log('🏥 [HEALTH MONITOR] Starting health monitoring');
    this.isRunning = true;
    
    // Start memory monitoring
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.MEMORY_CHECK_INTERVAL_MS);
    
    console.log('✅ [HEALTH MONITOR] Health monitoring active');
  }
  
  // Stop monitoring
  stop() {
    console.log('🛑 [HEALTH MONITOR] Stopping health monitoring');
    this.isRunning = false;
    
    // Clear all cycle timeouts
    this.cycleTimeouts.forEach((handle) => clearTimeout(handle));
    this.cycleTimeouts.clear();
    this.cycleStartTimes.clear();
    
    // Clear memory check interval
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }
  
  // Register a cycle start
  registerCycleStart(agentId, userId) {
    console.log(`🏥 [HEALTH MONITOR] Registering cycle start for agent ${agentId}`);
    
    // Clear existing timeout if any
    if (this.cycleTimeouts.has(agentId)) {
      clearTimeout(this.cycleTimeouts.get(agentId));
    }
    
    // Record start time
    this.cycleStartTimes.set(agentId, Date.now());
    
    // Set timeout for 2 hours
    const timeoutHandle = setTimeout(() => {
      this.handleCycleTimeout(agentId, userId);
    }, this.CYCLE_TIMEOUT_MS);
    
    this.cycleTimeouts.set(agentId, timeoutHandle);
  }
  
  // Register a cycle completion (clear timeout)
  registerCycleComplete(agentId) {
    console.log(`🏥 [HEALTH MONITOR] Cycle completed for agent ${agentId}`);
    
    // Clear timeout
    if (this.cycleTimeouts.has(agentId)) {
      clearTimeout(this.cycleTimeouts.get(agentId));
      this.cycleTimeouts.delete(agentId);
    }
    
    // Clear start time
    this.cycleStartTimes.delete(agentId);
  }
  
  // Handle cycle timeout
  async handleCycleTimeout(agentId, userId) {
    const startTime = this.cycleStartTimes.get(agentId);
    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000 / 60) : 'unknown';
    
    console.error(`🚨 [HEALTH MONITOR] Cycle timeout detected for agent ${agentId} (running for ${duration} minutes)`);
    
    try {
      // Log issue to AWS
      const AWSManager = (await import('./awsManager.js')).default;
      const awsManager = new AWSManager();
      
      await awsManager.addIssue(
        userId,
        'error',
        'Agent Cycle Timeout',
        `Agent ${agentId} has been running for over 2 hours without completing. This may indicate a stuck state or infinite loop.`,
        {
          agentId,
          duration: `${duration} minutes`,
          startTime: startTime ? new Date(startTime).toISOString() : 'unknown',
          timestamp: new Date().toISOString(),
          action: 'Agent may need to be restarted'
        }
      );
      
      // TODO: Optionally auto-restart the agent here
      // const { getUserAgent } = await import('../agent/reasoningLeadAgent.js');
      // const agent = getUserAgent(userId, agentId);
      // await agent.stop();
      // await agent.start();
      
      console.log('📧 [HEALTH MONITOR] Cycle timeout issue logged to database');
    } catch (error) {
      console.error('❌ [HEALTH MONITOR] Failed to log cycle timeout:', error);
    }
  }
  
  // Check memory usage
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const usagePercent = heapUsed / heapTotal;
    
    console.log(`🧠 [HEALTH MONITOR] Memory: ${Math.round(usagePercent * 100)}% (${Math.round(heapUsed / 1024 / 1024)}MB / ${Math.round(heapTotal / 1024 / 1024)}MB)`);
    
    if (usagePercent > this.MEMORY_THRESHOLD) {
      console.warn(`⚠️ [HEALTH MONITOR] High memory usage detected: ${Math.round(usagePercent * 100)}%`);
      
      // Clear caches to free memory
      if (global.gc) {
        console.log('🧹 [HEALTH MONITOR] Running garbage collection...');
        global.gc();
        
        // Check memory again after GC
        const afterGC = process.memoryUsage();
        const freedMB = Math.round((heapUsed - afterGC.heapUsed) / 1024 / 1024);
        console.log(`✅ [HEALTH MONITOR] Freed ${freedMB}MB of memory`);
      }
      
      try {
        // Log memory warning to AWS
        const AWSManager = (await import('./awsManager.js')).default;
        const awsManager = new AWSManager();
        
        await awsManager.addIssue(
          'system',
          'warning',
          'High Memory Usage',
          `Memory usage exceeded ${Math.round(this.MEMORY_THRESHOLD * 100)}% threshold. Current: ${Math.round(usagePercent * 100)}%`,
          {
            heapUsed: Math.round(heapUsed / 1024 / 1024),
            heapTotal: Math.round(heapTotal / 1024 / 1024),
            usagePercent: Math.round(usagePercent * 100),
            timestamp: new Date().toISOString()
          }
        );
      } catch (error) {
        console.error('❌ [HEALTH MONITOR] Failed to log memory warning:', error);
      }
    }
  }
  
  // Get current health status
  getStatus() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    
    return {
      memory: {
        used: Math.round(heapUsed / 1024 / 1024),
        total: Math.round(heapTotal / 1024 / 1024),
        percent: Math.round((heapUsed / heapTotal) * 100),
        threshold: Math.round(this.MEMORY_THRESHOLD * 100)
      },
      cycles: {
        active: this.cycleStartTimes.size,
        agents: Array.from(this.cycleStartTimes.keys())
      },
      isRunning: this.isRunning
    };
  }
}

// Singleton instance
let instance = null;

export function getHealthMonitor() {
  if (!instance) {
    instance = new HealthMonitor();
  }
  return instance;
}

export function startHealthMonitoring() {
  const monitor = getHealthMonitor();
  monitor.start();
}

export function stopHealthMonitoring() {
  const monitor = getHealthMonitor();
  monitor.stop();
}

export default HealthMonitor;
*/

// TEMPORARY PLACEHOLDER - Remove when uncommenting above
console.log('⚠️ Health Monitor system ready but commented out');
export function getHealthMonitor() {
  return {
    registerCycleStart: () => {},
    registerCycleComplete: () => {},
    getStatus: () => ({ isRunning: false })
  };
}
export function startHealthMonitoring() {}
export function stopHealthMonitoring() {}
