import { google } from 'googleapis';
import AWSManager from './awsManager.js';

const awsManager = new AWSManager();

class GmailManager {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'https://meridian-kdew.onrender.com/api/auth/gmail/callback'
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log('✅ [GMAIL] Got tokens:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token
      });
      return tokens;
    } catch (error) {
      console.error('❌ [GMAIL] Error getting tokens:', error);
      throw error;
    }
  }

  /**
   * Get user's Gmail address
   */
  async getUserEmail(tokens) {
    try {
      this.oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return profile.data.emailAddress;
    } catch (error) {
      console.error('❌ [GMAIL] Error getting user email:', error);
      throw error;
    }
  }

  /**
   * Get user's profile picture
   */
  async getProfilePicture(tokens) {
    try {
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      return userInfo.data.picture || null;
    } catch (error) {
      console.error('❌ [GMAIL] Error getting profile picture:', error);
      return null;
    }
  }

  /**
   * Send email via Gmail API (with account cycling)
   */
  async sendEmail({ userId, to, subject, htmlBody, textBody, ccEmails = null, bccEmails = null, replyTo = null, agentId = null, enableTracking = true }) {
    try {
      console.log('📧 [GMAIL] Sending email via Gmail API to:', to);

      // Get user's Gmail credentials from DynamoDB
      const userSettings = await awsManager.getUserSettings(userId);
      
      // Support both old gmailAuth format and new gmailAccounts array
      let gmailAccounts = [];
      let currentAccountIndex = 0;
      
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        // New multi-account format
        gmailAccounts = userSettings.gmailAccounts;
        currentAccountIndex = userSettings.activeGmailIndex || 0;
      } else if (userSettings?.gmailAuth?.refreshToken) {
        // Legacy single account format - convert to array
        gmailAccounts = [{
          email: userSettings.gmailAuth.email,
          refreshToken: userSettings.gmailAuth.refreshToken,
          isActive: true
        }];
        currentAccountIndex = 0;
      } else {
        throw new Error('Gmail not connected. Please connect your Gmail account in settings.');
      }

      // Get the current account for this email
      const currentAccount = gmailAccounts[currentAccountIndex];
      console.log(`📧 [GMAIL] Using account ${currentAccountIndex + 1}/${gmailAccounts.length}: ${currentAccount.email}`);

      // Set credentials
      this.oauth2Client.setCredentials({
        refresh_token: currentAccount.refreshToken
      });

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Get company name from user settings for display name
      let displayName = currentAccount.email.split('@')[0]; // Default to email username
      if (userSettings?.companyProfile?.companyName) {
        displayName = userSettings.companyProfile.companyName;
      }

      // Generate tracking ID for open/reply tracking
      const trackingId = `tracking-${userId}_${agentId || 'unknown'}_${Date.now()}`;
      console.log(`📊 [GMAIL] Generated tracking ID: ${trackingId}`);

      // Add tracking pixel to email body if enabled
      let finalHtmlBody = htmlBody || textBody;
      if (enableTracking) {
        const trackingDomain = process.env.API_BASE_URL || 'https://meridian-kdew.onrender.com';
        const trackingPixelUrl = `${trackingDomain}/api/tracking/pixel/${trackingId}.png`;
        const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" border="0" alt="" style="display:block;">`;
        finalHtmlBody = finalHtmlBody + trackingPixel;
        console.log(`📊 [GMAIL] Added tracking pixel: ${trackingPixelUrl}`);
      }

      // Build email message in RFC 2822 format
      const messageParts = [
        `From: ${displayName} <${currentAccount.email}>`,
        `To: ${Array.isArray(to) ? to.join(', ') : to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
      ];

      if (ccEmails) {
        messageParts.push(`Cc: ${ccEmails}`);
      }

      if (bccEmails) {
        messageParts.push(`Bcc: ${bccEmails}`);
      }

      if (replyTo) {
        messageParts.push(`Reply-To: ${replyTo}`);
      }

      // Add custom header for tracking (for reply detection)
      if (enableTracking) {
        messageParts.push(`X-Meridian-Tracking-Id: ${trackingId}`);
      }

      // Add blank line and body
      messageParts.push('');
      messageParts.push(finalHtmlBody);

      const message = messageParts.join('\r\n');

      // Encode in base64url format
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log('✅ [GMAIL] Email sent successfully. MessageId:', result.data.id);
      console.log('✅ [GMAIL] Email will appear in user\'s Gmail Sent folder');

      // Cycle to next account for future emails (if multiple accounts)
      if (gmailAccounts.length > 1) {
        const nextIndex = (currentAccountIndex + 1) % gmailAccounts.length;
        console.log(`🔄 [GMAIL] Cycling to account ${nextIndex + 1}/${gmailAccounts.length} for next email`);
        
        // Update active account
        gmailAccounts.forEach((acc, i) => {
          acc.isActive = (i === nextIndex);
        });
        
        await awsManager.saveUserSettings(userId, {
          ...userSettings,
          gmailAccounts,
          activeGmailIndex: nextIndex
        });
      }

      // Log Gmail API usage
      await awsManager.logApiUsage({
        userId: userId,
        service: 'gmail',
        operation: 'send',
        usage: 1,
        cost: 0, // Gmail API is free
        metadata: {
          messageId: result.data.id,
          trackingId: enableTracking ? trackingId : null,
          to: to,
          subject: subject,
          fromAccount: currentAccount.email,
          accountCycled: gmailAccounts.length > 1
        }
      });

      return {
        success: true,
        messageId: result.data.id,
        trackingId: trackingId, // Include tracking ID for downstream use
        provider: 'gmail',
        fromAccount: currentAccount.email // Track which account sent the email
      };
    } catch (error) {
      console.error('❌ [GMAIL] Error sending email:', error);
      
      // If refresh token expired, user needs to reconnect
      if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
        throw new Error('Gmail connection expired. Please reconnect your Gmail account in settings.');
      }
      
      throw error;
    }
  }

  /**
   * Test Gmail connection
   */
  async testConnection(userId) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      
      // Support both new and old formats
      let activeAccount = null;
      
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        // New format - get active account
        const activeIndex = userSettings.activeGmailIndex || 0;
        activeAccount = userSettings.gmailAccounts[activeIndex];
      } else if (userSettings?.gmailAuth?.refreshToken) {
        // Old format - convert
        activeAccount = {
          email: userSettings.gmailAuth.email,
          refreshToken: userSettings.gmailAuth.refreshToken
        };
      }
      
      if (!activeAccount || !activeAccount.refreshToken) {
        return { success: false, error: 'Gmail not connected' };
      }

      console.log(`🧪 [GMAIL] Testing connection for: ${activeAccount.email}`);

      this.oauth2Client.setCredentials({
        refresh_token: activeAccount.refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      console.log(`✅ [GMAIL] Connection test successful: ${profile.data.emailAddress}`);

      return {
        success: true,
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal
      };
    } catch (error) {
      console.error('❌ [GMAIL] Test connection failed:', error);
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }
  }

  /**
   * Check for new replies (optional feature)
   */
  async checkForReplies(userId, afterTimestamp = null) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      if (!userSettings?.gmailAuth?.refreshToken) {
        return [];
      }

      this.oauth2Client.setCredentials({
        refresh_token: userSettings.gmailAuth.refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Build query for unread messages in inbox
      let query = 'is:unread in:inbox';
      if (afterTimestamp) {
        query += ` after:${Math.floor(afterTimestamp / 1000)}`;
      }

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });

      const messages = response.data.messages || [];
      console.log(`📬 [GMAIL] Found ${messages.length} unread messages`);

      return messages;
    } catch (error) {
      console.error('❌ [GMAIL] Error checking replies:', error);
      return [];
    }
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeToken(refreshToken) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      await this.oauth2Client.revokeCredentials();
      console.log('✅ [GMAIL] Token revoked successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [GMAIL] Error revoking token:', error);
      throw error;
    }
  }
}

export default GmailManager;
