import fs from 'fs/promises';
import path from 'path';

class EmailQueue {
  constructor() {
    this.queueFile = path.join(process.cwd(), 'email_queue.json');
    this.approvedFile = path.join(process.cwd(), 'email_approved.json');
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
      
      console.log(`[EMAIL QUEUE] Added email to queue: ${newEmail.subject}`);
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
      email.status = 'rejected';
      email.rejectedAt = new Date().toISOString();
      email.rejectionReason = reason;
      
      queue[emailIndex] = email;
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
      
      console.log(`[EMAIL QUEUE] Rejected email ${id}: ${email.subject}`);
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
      const rejected = queue.filter(e => e.status === 'rejected').length;
      const approvedCount = approved.length;
      
      return {
        pending,
        rejected,
        approved: approvedCount,
        total: pending + rejected + approvedCount
      };
    } catch (error) {
      console.error('[EMAIL QUEUE] Error getting stats:', error);
      return { pending: 0, rejected: 0, approved: 0, total: 0 };
    }
  }

  async clearRejected() {
    try {
      const queue = await this.getQueue();
      const rejectedEmails = queue.filter(e => e.status === 'rejected');
      const clearedCount = rejectedEmails.length;
      
      // Keep only pending emails
      const pendingEmails = queue.filter(e => e.status === 'pending');
      
      await fs.writeFile(this.queueFile, JSON.stringify(pendingEmails, null, 2));
      
      console.log(`[EMAIL QUEUE] Cleared ${clearedCount} rejected emails`);
      return { clearedCount };
    } catch (error) {
      console.error('[EMAIL QUEUE] Error clearing rejected emails:', error);
      throw error;
    }
  }
}

export const emailQueue = new EmailQueue();
