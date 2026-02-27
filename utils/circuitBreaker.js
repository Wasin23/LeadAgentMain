/**
 * CIRCUIT BREAKER SYSTEM
 * 
 * Prevents runaway costs by tracking consecutive API failures and
 * temporarily pausing operations when thresholds are exceeded.
 * 
 * IMPLEMENTATION STATUS: READY BUT COMMENTED OUT
 * 
 * Usage:
 *   const breaker = new CircuitBreaker();
 *   
 *   // Before API call
 *   if (breaker.shouldBlock('apollo')) {
 *     console.log('Circuit open, pausing for', breaker.getCooldownTime('apollo'));
 *     return;
 *   }
 *   
 *   try {
 *     const result = await apolloAPI();
 *     breaker.recordSuccess('apollo');
 *   } catch (error) {
 *     breaker.recordFailure('apollo');
 *   }
 */

/*
class CircuitBreaker {
  constructor() {
    // Track failures per API service
    this.failures = new Map();
    
    // Circuit state: 'closed' (normal), 'open' (blocked), 'half-open' (testing)
    this.state = new Map();
    
    // Timestamps when circuits were opened
    this.openedAt = new Map();
    
    // Configuration per service
    this.config = {
      apollo: {
        threshold: 3,           // Open circuit after 3 consecutive failures
        cooldownMs: 60 * 60 * 1000,  // 1 hour cooldown
        name: 'Apollo Search API'
      },
      serper: {
        threshold: 5,           // Open circuit after 5 consecutive failures
        cooldownMs: 30 * 60 * 1000,  // 30 minutes cooldown
        name: 'Serper Research API'
      },
      openai: {
        threshold: 1,           // Open circuit after 1 failure (critical)
        cooldownMs: 0,          // No auto-resume (requires manual intervention)
        name: 'OpenAI Reasoning'
      },
      email_unlock: {
        threshold: 10,          // Open circuit after 10 consecutive failures
        cooldownMs: 60 * 60 * 1000,  // 1 hour cooldown
        name: 'Email Unlock API'
      }
    };
    
    // Initialize all circuits as closed
    Object.keys(this.config).forEach(service => {
      this.state.set(service, 'closed');
      this.failures.set(service, 0);
    });
  }
  
  // Record a successful API call
  recordSuccess(service) {
    // Reset failure count on success
    this.failures.set(service, 0);
    
    // If circuit was half-open and testing, close it
    if (this.state.get(service) === 'half-open') {
      console.log(`✅ [CIRCUIT BREAKER] ${this.config[service].name} recovered - closing circuit`);
      this.state.set(service, 'closed');
      this.openedAt.delete(service);
    }
  }
  
  // Record a failed API call
  recordFailure(service) {
    const currentFailures = this.failures.get(service) || 0;
    const newFailures = currentFailures + 1;
    this.failures.set(service, newFailures);
    
    const threshold = this.config[service].threshold;
    
    console.log(`⚠️ [CIRCUIT BREAKER] ${this.config[service].name} failure ${newFailures}/${threshold}`);
    
    // Open circuit if threshold exceeded
    if (newFailures >= threshold && this.state.get(service) === 'closed') {
      this.state.set(service, 'open');
      this.openedAt.set(service, Date.now());
      
      console.log(`🚨 [CIRCUIT BREAKER] ${this.config[service].name} CIRCUIT OPENED after ${newFailures} failures`);
      console.log(`⏸️ [CIRCUIT BREAKER] Cooldown: ${this.getCooldownTime(service)}`);
      
      // Log to monitoring/issues system
      this.logCircuitOpened(service, newFailures);
    }
  }
  
  // Check if API calls should be blocked
  shouldBlock(service) {
    const state = this.state.get(service);
    
    if (state === 'closed') {
      return false;
    }
    
    if (state === 'open') {
      const cooldownMs = this.config[service].cooldownMs;
      
      // If no cooldown (like OpenAI), block indefinitely until manual reset
      if (cooldownMs === 0) {
        return true;
      }
      
      const openedAt = this.openedAt.get(service);
      const elapsed = Date.now() - openedAt;
      
      // If cooldown period has passed, try half-open state
      if (elapsed >= cooldownMs) {
        console.log(`🔄 [CIRCUIT BREAKER] ${this.config[service].name} entering half-open state (testing recovery)`);
        this.state.set(service, 'half-open');
        return false; // Allow one test request
      }
      
      return true; // Still in cooldown
    }
    
    // Half-open: allow requests to test if service recovered
    return false;
  }
  
  // Get remaining cooldown time in human-readable format
  getCooldownTime(service) {
    const state = this.state.get(service);
    
    if (state !== 'open') {
      return 'Circuit not open';
    }
    
    const cooldownMs = this.config[service].cooldownMs;
    
    if (cooldownMs === 0) {
      return 'Manual reset required';
    }
    
    const openedAt = this.openedAt.get(service);
    const elapsed = Date.now() - openedAt;
    const remaining = Math.max(0, cooldownMs - elapsed);
    
    const minutes = Math.ceil(remaining / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
  
  // Get circuit status for all services
  getStatus() {
    const status = {};
    
    Object.keys(this.config).forEach(service => {
      status[service] = {
        name: this.config[service].name,
        state: this.state.get(service),
        failures: this.failures.get(service),
        threshold: this.config[service].threshold,
        cooldownRemaining: this.state.get(service) === 'open' ? this.getCooldownTime(service) : null
      };
    });
    
    return status;
  }
  
  // Manually reset a circuit (admin action)
  reset(service) {
    console.log(`🔧 [CIRCUIT BREAKER] Manually resetting ${this.config[service].name}`);
    this.state.set(service, 'closed');
    this.failures.set(service, 0);
    this.openedAt.delete(service);
  }
  
  // Log circuit opened event to monitoring
  async logCircuitOpened(service, failures) {
    try {
      // Import AWS manager to log issue
      const AWSManager = (await import('./awsManager.js')).default;
      const awsManager = new AWSManager();
      
      await awsManager.addIssue(
        'system', // System-level issue
        'error',
        `Circuit Breaker: ${this.config[service].name} Opened`,
        `${failures} consecutive failures detected. Operations paused for ${this.getCooldownTime(service)}.`,
        {
          service,
          failures,
          threshold: this.config[service].threshold,
          cooldown: this.config[service].cooldownMs,
          openedAt: this.openedAt.get(service),
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error('❌ [CIRCUIT BREAKER] Failed to log issue:', error);
    }
  }
}

// Singleton instance
let instance = null;

export function getCircuitBreaker() {
  if (!instance) {
    instance = new CircuitBreaker();
  }
  return instance;
}

export default CircuitBreaker;
*/

// TEMPORARY PLACEHOLDER - Remove when uncommenting above
console.log('⚠️ Circuit Breaker system ready but commented out');
export function getCircuitBreaker() {
  return {
    shouldBlock: () => false,
    recordSuccess: () => {},
    recordFailure: () => {},
    getStatus: () => ({}),
    reset: () => {}
  };
}
