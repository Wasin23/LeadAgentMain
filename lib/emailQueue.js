import fs from 'fs/promises';
import path from 'path';

class EmailQueue {
  constructor(userId = null) {
    // Use user-specific files if userId provided, otherwise fall back to global (for backward compatibility)
    const queueFileName = userId ? `email_queue_${userId}.json` : 'email_queue.json';
    const approvedFileName = userId ? `email_approved_${userId}.json` : 'email_approved.json';
    
    this.queueFile = path.join(process.cwd(), queueFileName);
    this.approvedFile = path.join(process.cwd(), approvedFileName);
    this.userId = userId; // Store userId for logging
    
    if (userId) {
      console.log(`[EMAIL QUEUE] 🔧 Initialized with user-specific files for user: ${userId}`);
      console.log(`[EMAIL QUEUE] 📂 Queue file path: ${this.queueFile}`);
      console.log(`[EMAIL QUEUE] 📂 Approved file path: ${this.approvedFile}`);
    } else {
      console.log(`[EMAIL QUEUE] ⚠️ Initialized with global files (legacy mode)`);
      console.log(`[EMAIL QUEUE] 📂 Queue file path: ${this.queueFile}`);
    }
  }

  async addToQueue(emailData) {
    try {
      const queue = await this.getQueue();
      const newEmail = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        status: 'pending',
        ...emailData
      };
      
      queue.push(newEmail);
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
      
      // Get subject from different possible locations for logging
      const subject = newEmail.subject || newEmail.emailData?.subject || newEmail.finalSubject || 'Unknown Subject';
      console.log(`[EMAIL QUEUE] Added email to queue: ${subject}`);
      return newEmail;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error adding to queue:', error);
      throw error;
    }
  }

  async getQueue() {
    try {
      const data = await fs.readFile(this.queueFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async updateEmail(id, updates) {
    try {
      const queue = await this.getQueue();
      const emailIndex = queue.findIndex(email => email.id === id);
      
      if (emailIndex === -1) {
        throw new Error('Email not found in queue');
      }
      
      queue[emailIndex] = { ...queue[emailIndex], ...updates };
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
      
      console.log(`[EMAIL QUEUE] Updated email ${id}: ${updates.subject || 'content updated'}`);
      return queue[emailIndex];
    } catch (error) {
      console.error('[EMAIL QUEUE] Error updating email:', error);
      throw error;
    }
  }

  async approveEmail(id) {
    try {
      const queue = await this.getQueue();
      const emailIndex = queue.findIndex(email => email.id === id);
      
      if (emailIndex === -1) {
        throw new Error('Email not found in queue');
      }
      
      const email = queue[emailIndex];
      email.status = 'approved';
      email.approvedAt = new Date().toISOString();
      
      // Move to approved list
      const approved = await this.getApproved();
      approved.push(email);
      await fs.writeFile(this.approvedFile, JSON.stringify(approved, null, 2));
      
      // Remove from queue
      queue.splice(emailIndex, 1);
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
      
      console.log(`[EMAIL QUEUE] Approved email ${id}: ${email.subject}`);
      return email;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error approving email:', error);
      throw error;
    }
  }

  async rejectEmail(id, reason = '') {
    try {
      const queue = await this.getQueue();
      const emailIndex = queue.findIndex(email => email.id === id);
      
      if (emailIndex === -1) {
        throw new Error('Email not found in queue');
      }
      
      const email = queue[emailIndex];
      
      // Remove the email from the queue instead of just marking as rejected
      queue.splice(emailIndex, 1);
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
      
      console.log(`[EMAIL QUEUE] Removed rejected email ${id}: ${email.subject}`);
      return email;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error rejecting email:', error);
      throw error;
    }
  }

  async getApproved() {
    try {
      const data = await fs.readFile(this.approvedFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getStats() {
    try {
      const queue = await this.getQueue();
      const approved = await this.getApproved();
      
      const pending = queue.filter(e => e.status === 'pending').length;
      const approvedCount = approved.length;
      
      return {
        pending,
        rejected: 0, // Always 0 since rejected emails are immediately removed
        approved: approvedCount,
        total: pending + approvedCount
      };
    } catch (error) {
      console.error('[EMAIL QUEUE] Error getting stats:', error);
      return { pending: 0, rejected: 0, approved: 0, total: 0 };
    }
  }

  async clearRejected() {
    // Since rejected emails are immediately removed, this method is no longer needed
    // But we'll keep it for backwards compatibility
    console.log('[EMAIL QUEUE] No rejected emails to clear - they are removed immediately upon rejection');
    return { clearedCount: 0 };
  }
}

// Export the class for creating user-specific instances
export { EmailQueue };

// Export a default instance for backward compatibility
export const emailQueue = new EmailQueue();
