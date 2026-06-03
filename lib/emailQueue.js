import { getAWSEmailQueue } from '../utils/awsEmailQueue.js';
import AWSManager from '../utils/awsManager.js';

/**
 * EmailQueue - Now powered by AWS DynamoDB
 * Maintains backward compatibility with existing API
 */
class EmailQueue {
  constructor(userId = null, agentId = null) {
    this.userId = userId;
    this.agentId = agentId;
    this.awsEmailQueue = getAWSEmailQueue();
    
    // Initialize AWS manager for other operations
    if (userId) {
      this.awsManager = new AWSManager();
    }
  }

  async addToQueue(emailData) {
    try {
      console.log('[EMAIL QUEUE] 📥 addToQueue called with:', {
        userId: this.userId,
        agentId: this.agentId,
        to: emailData.to,
        hasSubject: !!emailData.subject,
        hasBody: !!emailData.body
      });
      
      if (!this.userId || !this.agentId) {
        console.error('[EMAIL QUEUE] ❌ Missing userId or agentId:', { userId: this.userId, agentId: this.agentId });
        throw new Error('userId and agentId are required');
      }

      const newEmail = {
        ...emailData,
        queuedAt: new Date().toISOString()
      };
      
      console.log('[EMAIL QUEUE] 🔄 Calling awsEmailQueue.queueEmail...');
      const result = await this.awsEmailQueue.queueEmail(this.userId, this.agentId, newEmail);
      console.log('[EMAIL QUEUE] ✅ awsEmailQueue.queueEmail returned:', {
        id: result.id,
        emailId: result.emailId,
        to: result.to,
        status: result.status
      });
      
      const subject = result.subject || emailData.subject || 'Unknown Subject';
      console.log(`[EMAIL QUEUE] ✅ Added email to queue: ${subject}`);
      return result;
    } catch (error) {
      console.error('[EMAIL QUEUE] ❌ Error adding to queue:', error);
      console.error('[EMAIL QUEUE] ❌ Error stack:', error.stack);
      throw error;
    }
  }

  async getQueue() {
    try {
      const caller = new Error().stack.split('\n')[2].trim(); // Get calling function
      
      if (!this.userId || !this.agentId) {
        console.warn('[EMAIL QUEUE] ⚠️ getQueue called without userId/agentId - returning empty array');
        return [];
      }

      const emails = await this.awsEmailQueue.getQueuedEmails(this.userId, this.agentId);
      return emails;
    } catch (error) {
      console.error('[EMAIL QUEUE] ❌ Error getting queue:', error);
      console.error('[EMAIL QUEUE] Stack:', error.stack);
      return [];
    }
  }

  async updateEmail(id, updates) {
    try {
      if (!this.userId || !this.agentId) {
        throw new Error('userId and agentId are required');
      }

      const result = await this.awsEmailQueue.updateEmail(this.userId, this.agentId, id, updates);
      console.log(`[EMAIL QUEUE] ✅ Updated email ${id}: ${updates.subject || 'content updated'}`);
      return result;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error updating email:', error);
      throw error;
    }
  }

  async approveEmail(id) {
    try {
      if (!this.userId || !this.agentId) {
        throw new Error('userId and agentId are required');
      }

      const result = await this.awsEmailQueue.approveEmail(this.userId, this.agentId, id);
      console.log(`[EMAIL QUEUE] ✅ Approved email ${id}: ${result.subject}`);
      return result;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error approving email:', error);
      throw error;
    }
  }

  async rejectEmail(id, reason = '') {
    try {
      if (!this.userId || !this.agentId) {
        throw new Error('userId and agentId are required');
      }

      // Get the email details before deleting
      const queue = await this.getQueue();
      const email = queue.find(e => e.id === id);
      
      if (!email) {
        throw new Error('Email not found in queue');
      }
      
      // Extract name and company from different possible locations
      const contactName = email.name || email.lead?.name || email.leadInfo?.name || email.leadData?.name || 'Unknown';
      const contactCompany = email.company || email.lead?.company || email.leadInfo?.company || email.leadData?.company || 'Unknown';
      
      console.log(`[EMAIL QUEUE] 🔍 Rejecting email for: ${contactName} at ${contactCompany}`);
      
      // Delete from AWS
      await this.awsEmailQueue.deleteQueuedEmail(this.userId, this.agentId, id);
      
      console.log(`[EMAIL QUEUE] ✅ Removed rejected email ${id}: ${email.subject}`);

      // Refund credits for the work spent on this lead
      const leadCost = email.leadData?.leadCost || email.leadCost || 0;
      if (leadCost > 0 && this.awsManager) {
        this.awsManager.refundCredits(this.userId, leadCost, {
          leadName: contactName,
          leadCompany: contactCompany,
          reason: 'rejected',
          agentId: this.agentId
        }).catch(err => console.error('[EMAIL QUEUE] Failed to refund credits for rejected email:', err));
      }

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
      
      return { success: true };
    } catch (error) {
      console.error('[EMAIL QUEUE] Error rejecting email:', error);
      throw error;
    }
  }

  async getApproved() {
    try {
      if (!this.userId || !this.agentId) {
        console.warn('[EMAIL QUEUE] getApproved called without userId/agentId');
        return [];
      }

      // In AWS, approved emails are APPROVED status, sent emails are SENT status
      // For backward compatibility, return both
      const [approved, sent, replied] = await Promise.all([
        this.awsEmailQueue.getQueuedEmails(this.userId, this.agentId).catch(() => []),
        this.awsEmailQueue.getSentEmails(this.userId, this.agentId).catch(() => []),
        this.awsEmailQueue.getRepliedEmails(this.userId, this.agentId).catch(() => [])
      ]);

      // Return sent and replied as "approved" for backward compatibility
      return [...sent, ...replied];
    } catch (error) {
      console.error('[EMAIL QUEUE] Error getting approved emails:', error);
      return [];
    }
  }

  async getSent() {
    try {
      if (!this.userId || !this.agentId) {
        console.warn('[EMAIL QUEUE] getSent called without userId/agentId');
        return [];
      }

      const emails = await this.awsEmailQueue.getSentEmails(this.userId, this.agentId);
      return emails;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error getting sent emails:', error);
      return [];
    }
  }

  async getReplied() {
    try {
      if (!this.userId || !this.agentId) {
        console.warn('[EMAIL QUEUE] getReplied called without userId/agentId');
        return [];
      }

      const emails = await this.awsEmailQueue.getRepliedEmails(this.userId, this.agentId);
      return emails;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error getting replied emails:', error);
      return [];
    }
  }

  async getStats() {
    try {
      if (!this.userId || !this.agentId) {
        console.warn('[EMAIL QUEUE] getStats called without userId/agentId');
        return { pending: 0, rejected: 0, approved: 0, sent: 0, queued: 0, replied: 0, total: 0 };
      }

      const stats = await this.awsEmailQueue.getStats(this.userId, this.agentId);
      
      // Add approved count (0 in new system since we go straight from QUEUED to SENT)
      return {
        ...stats,
        approved: 0 // Backward compatibility
      };
    } catch (error) {
      console.error('[EMAIL QUEUE] Error getting stats:', error);
      return { pending: 0, rejected: 0, approved: 0, sent: 0, queued: 0, replied: 0, total: 0 };
    }
  }

  async clearRejected() {
    // Since rejected emails are immediately removed, this method is no longer needed
    // But we'll keep it for backwards compatibility
    console.log('[EMAIL QUEUE] No rejected emails to clear - they are removed immediately upon rejection');
    return { clearedCount: 0 };
  }

  async clearApproved() {
    try {
      if (!this.userId || !this.agentId) {
        throw new Error('userId and agentId are required');
      }

      const result = await this.awsEmailQueue.clearSentEmails(this.userId, this.agentId);
      console.log(`[EMAIL QUEUE] ✅ Cleared ${result.clearedCount} sent emails`);
      return result;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error clearing approved emails:', error);
      return { clearedCount: 0 };
    }
  }

  // Method to mark email as sent (called after Mailgun sends)
  async markEmailAsSent(emailId, mailgunData = {}) {
    try {
      if (!this.userId || !this.agentId) {
        throw new Error('userId and agentId are required');
      }

      const result = await this.awsEmailQueue.markEmailAsSent(
        this.userId, 
        this.agentId, 
        emailId, 
        mailgunData
      );
      
      console.log(`[EMAIL QUEUE] ✅ Marked email ${emailId} as sent`);
      return result;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error marking email as sent:', error);
      throw error;
    }
  }

  // Method to mark email as replied
  async markEmailAsReplied(emailId, replyData = {}) {
    try {
      if (!this.userId || !this.agentId) {
        throw new Error('userId and agentId are required');
      }

      const result = await this.awsEmailQueue.markEmailAsReplied(
        this.userId,
        this.agentId,
        emailId,
        replyData
      );
      
      console.log(`[EMAIL QUEUE] ✅ Marked email ${emailId} as replied`);
      return result;
    } catch (error) {
      console.error('[EMAIL QUEUE] Error marking email as replied:', error);
      throw error;
    }
  }
}

// Export the class for creating user-specific instances
export { EmailQueue };

// Export a default instance for backward compatibility (with warnings)
export const emailQueue = new EmailQueue();
