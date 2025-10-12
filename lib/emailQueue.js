import fs from 'fs/promises';
import path from 'path';
import AWSManager from '../utils/awsManager.js';

class EmailQueue {
  constructor(userId = null, agentId = null) {
    // Generate agent-specific filenames for complete isolation
    let queueFileName, approvedFileName;
    
    if (userId && agentId) {
      // Agent-specific files: email_queue_{userId}_{agentId}.json
      queueFileName = `email_queue_${userId}_${agentId}.json`;
      approvedFileName = `email_approved_${userId}_${agentId}.json`;
    } else if (userId) {
      // User-specific files (legacy): email_queue_{userId}.json
      queueFileName = `email_queue_${userId}.json`;
      approvedFileName = `email_approved_${userId}.json`;
    } else {
      // Global files (legacy): email_queue.json
      queueFileName = 'email_queue.json';
      approvedFileName = 'email_approved.json';
    }
    
    this.queueFile = path.join(process.cwd(), queueFileName);
    this.approvedFile = path.join(process.cwd(), approvedFileName);
    this.userId = userId; // Store userId for logging
    this.agentId = agentId; // Store agentId for logging
    
    // Initialize AWS manager for contact database operations
    if (userId) {
      this.awsManager = new AWSManager();
    }
    
    if (userId && agentId) {
      console.log(`[EMAIL QUEUE] 🔧 Initialized with agent-specific files for user: ${userId}, agent: ${agentId}`);
      console.log(`[EMAIL QUEUE] 📂 Queue file path: ${this.queueFile}`);
      console.log(`[EMAIL QUEUE] 📂 Approved file path: ${this.approvedFile}`);
    } else if (userId) {
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
      
      // Extract name and company from different possible locations
      const contactName = email.name || email.leadInfo?.name || email.leadData?.name || 'Unknown';
      const contactCompany = email.company || email.leadInfo?.company || email.leadData?.company || 'Unknown';
      
      console.log(`[EMAIL QUEUE] 🔍 Rejecting email for: ${contactName} at ${contactCompany}`);
      console.log(`[EMAIL QUEUE] 🔍 Email structure:`, {
        directName: email.name,
        leadInfoName: email.leadInfo?.name,
        leadDataName: email.leadData?.name,
        directCompany: email.company,
        leadInfoCompany: email.leadInfo?.company,
        leadDataCompany: email.leadData?.company
      });
      console.log(`[EMAIL QUEUE] 🔍 AWS Manager available: ${!!this.awsManager}`);
      console.log(`[EMAIL QUEUE] 🔍 User ID available: ${!!this.userId}`);
      
      // Remove the email from the queue
      queue.splice(emailIndex, 1);
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
      
      console.log(`[EMAIL QUEUE] Removed rejected email ${id}: ${email.subject}`);
      
      // Also remove the contact from AWS database so they can be contacted again
      if (this.userId && this.awsManager && contactName && contactName !== 'Unknown' && contactCompany && contactCompany !== 'Unknown') {
        try {
          // Create the same contactId format used when saving contacts
          const contactId = `${contactName.toLowerCase().replace(/\s+/g, '_')}_${contactCompany.toLowerCase().replace(/\s+/g, '_')}`;
          
          console.log(`[EMAIL QUEUE] 🗑️ Attempting to remove contact from AWS with ID: ${contactId}`);
          
          const removeResult = await this.awsManager.removeContactedLead(this.userId, contactId);
          
          console.log(`[EMAIL QUEUE] 📊 AWS removal result:`, removeResult);
          
          if (removeResult.success) {
            console.log(`[EMAIL QUEUE] ✅ Removed ${contactName} at ${contactCompany} from contacted database - can be contacted again`);
          } else {
            console.log(`[EMAIL QUEUE] ⚠️ Could not remove ${contactName} from contacted database:`, removeResult.error);
          }
        } catch (awsError) {
          console.error(`[EMAIL QUEUE] Error removing contact from AWS:`, awsError);
        }
      } else {
        console.log(`[EMAIL QUEUE] ⚠️ Skipping AWS removal - Missing requirements:`, {
          hasUserId: !!this.userId,
          hasAwsManager: !!this.awsManager,
          contactName: contactName,
          contactCompany: contactCompany,
          nameIsValid: contactName && contactName !== 'Unknown',
          companyIsValid: contactCompany && contactCompany !== 'Unknown'
        });
      }
      
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
