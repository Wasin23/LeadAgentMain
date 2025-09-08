// Memory monitoring and performance tracking utility
import { EventEmitter } from 'events';

class MemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      memoryThreshold: options.memoryThreshold || 2048 * 1024 * 1024, // 2GB (increased from 1GB)
      heapThreshold: options.heapThreshold || 1536 * 1024 * 1024, // 1.5GB (increased from 512MB)
      gcThreshold: options.gcThreshold || 0.90, // 90% of heap (increased from 85%)
      historyLength: options.historyLength || 100, // Keep last 100 readings
      alertThreshold: options.alertThreshold || 0.95 // Alert at 95% of threshold (increased from 90%)
    };

    this.isMonitoring = false;
    this.intervalId = null;
    this.memoryHistory = [];
    this.performanceMetrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      responseTimeHistory: []
    };
  }

  // Start memory monitoring
  start() {
    if (this.isMonitoring) {
      console.warn('[MEMORY] Monitor already running');
      return;
    }

    console.log('[MEMORY] Starting memory monitor...');
    this.isMonitoring = true;
    
    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.config.checkInterval);

    // Initial check
    this.checkMemory();

    this.emit('started');
  }

  // Stop memory monitoring
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('[MEMORY] Stopping memory monitor...');
    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('stopped');
  }

  // Check current memory usage
  checkMemory() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const reading = {
      timestamp: new Date().toISOString(),
      rss: memUsage.rss, // Resident Set Size
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      cpuUser: cpuUsage.user,
      cpuSystem: cpuUsage.system,
      uptime: process.uptime()
    };

    // Add calculated metrics
    reading.heapPercent = (reading.heapUsed / reading.heapTotal) * 100;
    reading.memoryMB = reading.rss / 1024 / 1024;
    reading.heapMB = reading.heapUsed / 1024 / 1024;

    // Add to history
    this.memoryHistory.push(reading);
    
    // Trim history to configured length
    if (this.memoryHistory.length > this.config.historyLength) {
      this.memoryHistory.shift();
    }

    // Check thresholds and emit warnings
    this.checkThresholds(reading);

    this.emit('reading', reading);

    return reading;
  }

  // Check if memory usage exceeds thresholds
  checkThresholds(reading) {
    const alerts = [];

    // RSS Memory threshold
    if (reading.rss > this.config.memoryThreshold * this.config.alertThreshold) {
      alerts.push({
        type: 'memory',
        level: reading.rss > this.config.memoryThreshold ? 'critical' : 'warning',
        message: `RSS memory usage: ${reading.memoryMB.toFixed(1)}MB (threshold: ${(this.config.memoryThreshold / 1024 / 1024).toFixed(1)}MB)`,
        value: reading.rss,
        threshold: this.config.memoryThreshold
      });
    }

    // Heap threshold
    if (reading.heapUsed > this.config.heapThreshold * this.config.alertThreshold) {
      alerts.push({
        type: 'heap',
        level: reading.heapUsed > this.config.heapThreshold ? 'critical' : 'warning',
        message: `Heap usage: ${reading.heapMB.toFixed(1)}MB (threshold: ${(this.config.heapThreshold / 1024 / 1024).toFixed(1)}MB)`,
        value: reading.heapUsed,
        threshold: this.config.heapThreshold
      });
    }

    // Heap percentage threshold
    if (reading.heapPercent > this.config.gcThreshold * 100 * this.config.alertThreshold) {
      alerts.push({
        type: 'heap_percent',
        level: reading.heapPercent > this.config.gcThreshold * 100 ? 'critical' : 'warning',
        message: `Heap usage percentage: ${reading.heapPercent.toFixed(1)}% (threshold: ${(this.config.gcThreshold * 100).toFixed(1)}%)`,
        value: reading.heapPercent,
        threshold: this.config.gcThreshold * 100
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      console.warn(`[MEMORY] ${alert.level.toUpperCase()}: ${alert.message}`);
      this.emit('alert', alert);
    });

    // Force garbage collection if available and thresholds exceeded
    if (alerts.some(a => a.level === 'critical') && global.gc) {
      console.log('[MEMORY] Running garbage collection...');
      global.gc();
      // Run cleanup after GC
      this.cleanupMemory();
    }
  }

  // Memory cleanup utility
  cleanupMemory() {
    try {
      // Trim memory history more aggressively
      if (this.memoryHistory.length > 50) {
        this.memoryHistory = this.memoryHistory.slice(-50);
      }
      
      // Clear old performance metrics
      if (this.performanceMetrics.responseTimeHistory.length > 100) {
        this.performanceMetrics.responseTimeHistory = this.performanceMetrics.responseTimeHistory.slice(-100);
      }
      
      console.log('[MEMORY] Memory cleanup completed');
    } catch (error) {
      console.error('[MEMORY] Cleanup error:', error);
    }
  }

  // Get memory statistics
  getStats() {
    if (this.memoryHistory.length === 0) {
      return null;
    }

    const latest = this.memoryHistory[this.memoryHistory.length - 1];
    const oldest = this.memoryHistory[0];

    // Calculate trends
    const memoryTrend = this.calculateTrend('memoryMB');
    const heapTrend = this.calculateTrend('heapMB');

    return {
      current: {
        memoryMB: latest.memoryMB,
        heapMB: latest.heapMB,
        heapPercent: latest.heapPercent,
        uptime: latest.uptime
      },
      trends: {
        memory: memoryTrend,
        heap: heapTrend
      },
      thresholds: {
        memoryMB: this.config.memoryThreshold / 1024 / 1024,
        heapMB: this.config.heapThreshold / 1024 / 1024,
        heapPercent: this.config.gcThreshold * 100
      },
      history: {
        length: this.memoryHistory.length,
        timespan: latest.timestamp !== oldest.timestamp ? 
          (new Date(latest.timestamp) - new Date(oldest.timestamp)) / 1000 / 60 : 0 // minutes
      },
      performance: this.performanceMetrics
    };
  }

  // Calculate trend for a metric
  calculateTrend(metric) {
    if (this.memoryHistory.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const recent = this.memoryHistory.slice(-10); // Last 10 readings
    const values = recent.map(r => r[metric]);
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    let direction = 'stable';
    if (change > 5) direction = 'increasing';
    else if (change < -5) direction = 'decreasing';

    return { direction, change: change.toFixed(2) };
  }

  // Record request metrics
  recordRequest(responseTime, isError = false) {
    this.performanceMetrics.requests++;
    
    if (isError) {
      this.performanceMetrics.errors++;
    }

    // Update average response time
    this.performanceMetrics.responseTimeHistory.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.performanceMetrics.responseTimeHistory.length > 1000) {
      this.performanceMetrics.responseTimeHistory.shift();
    }

    // Recalculate average
    const sum = this.performanceMetrics.responseTimeHistory.reduce((a, b) => a + b, 0);
    this.performanceMetrics.avgResponseTime = sum / this.performanceMetrics.responseTimeHistory.length;
  }

  // Get performance summary
  getPerformanceSummary() {
    const uptime = (Date.now() - this.performanceMetrics.startTime) / 1000; // seconds
    const errorRate = this.performanceMetrics.requests > 0 ? 
      (this.performanceMetrics.errors / this.performanceMetrics.requests) * 100 : 0;

    return {
      uptime: uptime,
      requests: this.performanceMetrics.requests,
      errors: this.performanceMetrics.errors,
      errorRate: errorRate.toFixed(2),
      avgResponseTime: this.performanceMetrics.avgResponseTime.toFixed(2),
      requestsPerSecond: this.performanceMetrics.requests / uptime
    };
  }

  // Force memory cleanup
  async forceCleanup() {
    console.log('[MEMORY] Forcing cleanup...');
    
    // Trim memory history
    if (this.memoryHistory.length > this.config.historyLength / 2) {
      this.memoryHistory = this.memoryHistory.slice(-this.config.historyLength / 2);
    }

    // Trim response time history
    if (this.performanceMetrics.responseTimeHistory.length > 500) {
      this.performanceMetrics.responseTimeHistory = 
        this.performanceMetrics.responseTimeHistory.slice(-500);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('[MEMORY] Garbage collection completed');
    }

    this.emit('cleanup');
  }

  // Export memory data for debugging
  exportData() {
    return {
      config: this.config,
      history: this.memoryHistory,
      performance: this.performanceMetrics,
      stats: this.getStats(),
      summary: this.getPerformanceSummary()
    };
  }
}

// Create singleton instance
export const memoryMonitor = new MemoryMonitor();

// Express middleware for performance tracking
export function performanceMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;
      
      memoryMonitor.recordRequest(responseTime, isError);
      
      return originalEnd.apply(this, args);
    };

    next();
  };
}

export default MemoryMonitor;
