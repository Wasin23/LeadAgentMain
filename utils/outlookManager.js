import dotenv from 'dotenv';
import axios from 'axios';
import AWSManager from './awsManager.js';

dotenv.config();

const awsManager = new AWSManager();

class OutlookManager {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.redirectUri = process.env.OUTLOOK_REDIRECT_URI || 
      'https://meridian-kdew.onrender.com/api/auth/outlook/callback';
    
    console.log('[OUTLOOK] Using redirect URI:', this.redirectUri);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl() {
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Mail.Send',
      'Mail.Read',
      'User.Read'
    ].join(' ');

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${this.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_mode=query` +
      `&prompt=consent`;

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      console.log('✅ [OUTLOOK] Got tokens:', {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token
      });

      return response.data;
    } catch (error) {
      console.error('❌ [OUTLOOK] Error getting tokens:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      return response.data.access_token;
    } catch (error) {
      console.error('❌ [OUTLOOK] Error refreshing token:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user's email address
   */
  async getUserEmail(accessToken) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      return response.data.mail || response.data.userPrincipalName;
    } catch (error) {
      console.error('❌ [OUTLOOK] Error getting user email:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user's profile picture
   */
  async getProfilePicture(accessToken) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        responseType: 'arraybuffer'
      });
      
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      // Profile picture is optional
      return null;
    }
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendEmail({ userId, to, subject, htmlBody, textBody, ccEmails = null, bccEmails = null, replyTo = null, agentId = null, enableTracking = true, trackingId = null, inReplyTo = null, threadId = null }) {
    try {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📧 [OUTLOOK SEND] Starting Outlook send process');
      console.log('📧 [OUTLOOK SEND] To:', to);
      console.log('📧 [OUTLOOK SEND] Subject:', subject);
      console.log('📧 [OUTLOOK SEND] User ID:', userId);
      console.log('═══════════════════════════════════════════════════════════════');

      // Get user's Outlook credentials from DynamoDB
      const userSettings = await awsManager.getUserSettings(userId);
      
      let outlookAccounts = [];
      let currentAccountIndex = 0;
      
      if (userSettings?.outlookAccounts && userSettings.outlookAccounts.length > 0) {
        outlookAccounts = userSettings.outlookAccounts;
        currentAccountIndex = userSettings.activeOutlookIndex || 0;
        console.log('📧 [OUTLOOK ACCOUNTS] Found', outlookAccounts.length, 'accounts, active index:', currentAccountIndex);
      } else {
        console.error('❌ [OUTLOOK ACCOUNTS] No Outlook accounts found!');
        throw new Error('Outlook not connected. Please connect your Outlook account in settings.');
      }

      const currentAccount = outlookAccounts[currentAccountIndex];
      console.log('📧 [OUTLOOK ACCOUNT] Using account:', currentAccount.email);

      // Refresh access token if needed
      let accessToken = currentAccount.accessToken;
      if (!accessToken || this.isTokenExpired(currentAccount.expiresAt)) {
        console.log('🔄 [OUTLOOK] Refreshing access token...');
        accessToken = await this.refreshAccessToken(currentAccount.refreshToken);
        
        // Update token in settings
        currentAccount.accessToken = accessToken;
        currentAccount.expiresAt = Date.now() + (3600 * 1000); // 1 hour
        await awsManager.saveUserSettings(userId, userSettings);
      }

      // Build email message
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlBody || textBody
        },
        toRecipients: Array.isArray(to) 
          ? to.map(email => ({ emailAddress: { address: email } }))
          : [{ emailAddress: { address: to } }]
      };

      if (ccEmails) {
        message.ccRecipients = ccEmails.split(',').map(email => ({
          emailAddress: { address: email.trim() }
        }));
      }

      if (bccEmails) {
        message.bccRecipients = bccEmails.split(',').map(email => ({
          emailAddress: { address: email.trim() }
        }));
      }

      if (replyTo) {
        message.replyTo = [{ emailAddress: { address: replyTo } }];
      }

      // Add tracking headers
      if (trackingId) {
        message.internetMessageHeaders = [
          { name: 'X-Meridian-Tracking-Id', value: trackingId }
        ];
      }

      // Send email via Microsoft Graph API
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        { message, saveToSentItems: true },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ [OUTLOOK] Email sent successfully');

      // Cycle to next account for load balancing
      if (outlookAccounts.length > 1) {
        userSettings.activeOutlookIndex = (currentAccountIndex + 1) % outlookAccounts.length;
        await awsManager.saveUserSettings(userId, userSettings);
        console.log(`🔄 [OUTLOOK] Cycled to account ${userSettings.activeOutlookIndex + 1}/${outlookAccounts.length}`);
      }

      return {
        success: true,
        messageId: trackingId,
        service: 'outlook',
        fromEmail: currentAccount.email
      };
    } catch (error) {
      console.error('❌ [OUTLOOK] Send error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(expiresAt) {
    return !expiresAt || Date.now() >= expiresAt;
  }
}

export default OutlookManager;
