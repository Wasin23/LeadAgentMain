// Automated backup utility for ExaMark data files
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const BACKUP_CONFIG = {
  // Data files to backup
  dataFiles: [
    'lib/data/users.json',
    'lib/data/user_settings.json',
    'agent/leads_database.json',
    'agent/leadAgent_state.json',
    'email_logs.json',
    'email_approved.json',
    'email_queue.json',
    'email_replies.json'
  ],
  
  // Backup settings
  backupDir: 'backups',
  retentionDays: 30,
  compressionEnabled: true,
  
  // Backup frequency (for cron scheduling)
  schedule: {
    daily: '0 2 * * *',    // 2 AM daily
    weekly: '0 3 * * 0',   // 3 AM every Sunday
    monthly: '0 4 1 * *'   // 4 AM first day of month
  }
};

class BackupManager {
  constructor() {
    this.backupDir = path.join(process.cwd(), BACKUP_CONFIG.backupDir);
    this.ensureBackupDir();
  }

  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`[BACKUP] Backup directory ensured: ${this.backupDir}`);
    } catch (error) {
      console.error('[BACKUP] Failed to create backup directory:', error);
    }
  }

  // Create a full backup of all data files
  async createFullBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `examark-backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      const backupManifest = {
        timestamp: new Date().toISOString(),
        type: 'full',
        files: [],
        version: '1.0.0'
      };

      // Backup each data file
      for (const dataFile of BACKUP_CONFIG.dataFiles) {
        const sourcePath = path.join(process.cwd(), dataFile);
        const backupFilePath = path.join(backupPath, path.basename(dataFile));

        try {
          // Check if source file exists
          await fs.access(sourcePath);
          
          // Copy file to backup location
          await fs.copyFile(sourcePath, backupFilePath);
          
          // Get file stats
          const stats = await fs.stat(sourcePath);
          
          backupManifest.files.push({
            originalPath: dataFile,
            backupPath: path.basename(dataFile),
            size: stats.size,
            modified: stats.mtime.toISOString()
          });

          console.log(`[BACKUP] ✅ Backed up: ${dataFile}`);
        } catch (error) {
          console.warn(`[BACKUP] ⚠️ Skipped missing file: ${dataFile}`);
          backupManifest.files.push({
            originalPath: dataFile,
            backupPath: null,
            error: 'File not found',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Save backup manifest
      const manifestPath = path.join(backupPath, 'backup-manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(backupManifest, null, 2));

      // Compress backup if enabled
      if (BACKUP_CONFIG.compressionEnabled) {
        await this.compressBackup(backupPath, `${backupPath}.tar.gz`);
        // Remove uncompressed backup
        await fs.rm(backupPath, { recursive: true });
        console.log(`[BACKUP] ✅ Compressed backup created: ${backupName}.tar.gz`);
      } else {
        console.log(`[BACKUP] ✅ Backup created: ${backupName}`);
      }

      return {
        success: true,
        backupName: BACKUP_CONFIG.compressionEnabled ? `${backupName}.tar.gz` : backupName,
        filesBackedUp: backupManifest.files.filter(f => !f.error).length,
        totalFiles: BACKUP_CONFIG.dataFiles.length
      };

    } catch (error) {
      console.error('[BACKUP] ❌ Backup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Compress backup directory
  async compressBackup(sourcePath, targetPath) {
    // Note: This is a simplified compression - in production you might want to use tar
    const { createReadStream } = await import('fs');
    const archiver = await import('archiver').catch(() => null);
    
    if (!archiver) {
      console.warn('[BACKUP] archiver not available, skipping compression');
      return;
    }

    return new Promise((resolve, reject) => {
      const output = createWriteStream(targetPath);
      const archive = archiver.default('tar', { gzip: true });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  // Clean up old backups based on retention policy
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const now = new Date();
      const retentionMs = BACKUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime > retentionMs) {
          if (stats.isDirectory()) {
            await fs.rm(filePath, { recursive: true });
          } else {
            await fs.unlink(filePath);
          }
          deletedCount++;
          console.log(`[BACKUP] 🗑️ Deleted old backup: ${file}`);
        }
      }

      console.log(`[BACKUP] Cleanup completed - removed ${deletedCount} old backups`);
      return { deletedCount };

    } catch (error) {
      console.error('[BACKUP] Cleanup failed:', error);
      return { error: error.message };
    }
  }

  // Restore from backup
  async restoreFromBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);

    try {
      // Check if backup exists
      await fs.access(backupPath);

      let manifestPath;
      let isCompressed = false;

      if (backupName.endsWith('.tar.gz')) {
        isCompressed = true;
        // Would need to decompress first - simplified for this example
        console.warn('[BACKUP] Compressed backup restore not implemented in this simplified version');
        return { success: false, error: 'Compressed backup restore not supported' };
      } else {
        manifestPath = path.join(backupPath, 'backup-manifest.json');
      }

      // Read backup manifest
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);

      console.log(`[BACKUP] Restoring backup from ${manifest.timestamp}`);

      // Restore each file
      for (const fileInfo of manifest.files) {
        if (fileInfo.error) continue;

        const backupFilePath = path.join(backupPath, fileInfo.backupPath);
        const targetPath = path.join(process.cwd(), fileInfo.originalPath);

        // Ensure target directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        // Copy file back
        await fs.copyFile(backupFilePath, targetPath);
        console.log(`[BACKUP] ✅ Restored: ${fileInfo.originalPath}`);
      }

      return {
        success: true,
        filesRestored: manifest.files.filter(f => !f.error).length,
        backupTimestamp: manifest.timestamp
      };

    } catch (error) {
      console.error('[BACKUP] Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // List available backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        if (file.startsWith('examark-backup-')) {
          backups.push({
            name: file,
            created: stats.mtime.toISOString(),
            size: stats.size,
            isCompressed: file.endsWith('.tar.gz')
          });
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      return backups;
    } catch (error) {
      console.error('[BACKUP] Failed to list backups:', error);
      return [];
    }
  }

  // Get backup statistics
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

      return {
        totalBackups: backups.length,
        totalSize: totalSize,
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
        newestBackup: backups.length > 0 ? backups[0].created : null,
        retentionDays: BACKUP_CONFIG.retentionDays
      };
    } catch (error) {
      console.error('[BACKUP] Failed to get backup stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const backupManager = new BackupManager();

// Export configuration for external use
export { BACKUP_CONFIG };

export default BackupManager;
