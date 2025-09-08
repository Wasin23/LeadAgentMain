// System management routes for production monitoring and maintenance
import express from 'express';
import { backupManager } from '../utils/backup.js';
import { memoryMonitor } from '../utils/memoryMonitor.js';

const router = express.Router();

// Add middleware to check if user has admin privileges (simplified for now)
const requireAdmin = (req, res, next) => {
  // In production, implement proper admin authentication
  // For now, just check for a simple header
  const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_KEY || 
                  process.env.NODE_ENV !== 'production';
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// System health and status
router.get('/status', (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || 'development',
    monitoring: {
      memoryMonitor: memoryMonitor.isMonitoring,
      backupSystem: 'available'
    }
  };
  
  res.json(status);
});

// Memory monitoring endpoints
router.get('/memory/stats', requireAdmin, (req, res) => {
  const stats = memoryMonitor.getStats();
  const performance = memoryMonitor.getPerformanceSummary();
  
  res.json({
    memory: stats,
    performance,
    timestamp: new Date().toISOString()
  });
});

router.post('/memory/start', requireAdmin, (req, res) => {
  try {
    memoryMonitor.start();
    res.json({ 
      success: true, 
      message: 'Memory monitoring started',
      isMonitoring: memoryMonitor.isMonitoring 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/memory/stop', requireAdmin, (req, res) => {
  try {
    memoryMonitor.stop();
    res.json({ 
      success: true, 
      message: 'Memory monitoring stopped',
      isMonitoring: memoryMonitor.isMonitoring 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/memory/cleanup', requireAdmin, async (req, res) => {
  try {
    await memoryMonitor.forceCleanup();
    res.json({ 
      success: true, 
      message: 'Memory cleanup completed' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/memory/export', requireAdmin, (req, res) => {
  try {
    const data = memoryMonitor.exportData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Backup management endpoints
router.post('/backup/create', requireAdmin, async (req, res) => {
  try {
    console.log('[SYSTEM] Creating backup...');
    const result = await backupManager.createFullBackup();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Backup created successfully',
        backup: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('[SYSTEM] Backup creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/backup/list', requireAdmin, async (req, res) => {
  try {
    const backups = await backupManager.listBackups();
    const stats = await backupManager.getBackupStats();
    
    res.json({
      backups,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/backup/restore/:backupName', requireAdmin, async (req, res) => {
  try {
    const { backupName } = req.params;
    console.log(`[SYSTEM] Restoring backup: ${backupName}`);
    
    const result = await backupManager.restoreFromBackup(backupName);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Backup restored successfully',
        restore: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('[SYSTEM] Backup restore failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/backup/cleanup', requireAdmin, async (req, res) => {
  try {
    console.log('[SYSTEM] Cleaning up old backups...');
    const result = await backupManager.cleanupOldBackups();
    
    res.json({
      success: true,
      message: 'Backup cleanup completed',
      cleanup: result
    });
  } catch (error) {
    console.error('[SYSTEM] Backup cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/backup/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await backupManager.getBackupStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// System maintenance endpoints
router.post('/maintenance/gc', requireAdmin, (req, res) => {
  try {
    if (global.gc) {
      global.gc();
      const memoryAfter = process.memoryUsage();
      
      res.json({
        success: true,
        message: 'Garbage collection completed',
        memory: memoryAfter
      });
    } else {
      res.json({
        success: false,
        message: 'Garbage collection not available (start with --expose-gc flag)'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/maintenance/info', requireAdmin, (req, res) => {
  const info = {
    versions: process.versions,
    arch: process.arch,
    platform: process.platform,
    cwd: process.cwd(),
    execPath: process.execPath,
    argv: process.argv,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.API_PORT,
      // Don't expose sensitive environment variables
    },
    features: {
      gcAvailable: typeof global.gc === 'function',
      inspectorAvailable: typeof process.binding === 'function'
    }
  };
  
  res.json(info);
});

// Logs endpoint (if needed for debugging)
router.get('/logs/recent', requireAdmin, async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const logsDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logsDir, 'combined.log');
    
    // Read last 100 lines of log file
    const logContent = await fs.readFile(logFile, 'utf8').catch(() => 'No logs available');
    const lines = logContent.split('\n').slice(-100);
    
    res.json({
      logs: lines.filter(line => line.trim()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
