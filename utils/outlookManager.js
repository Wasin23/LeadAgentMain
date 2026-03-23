import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import AWSManager from './awsManager.js';

dotenv.config();

const awsManager = new AWSManager();

class OutlookManager {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
    this.redirectUri = process.env.OUTLOOK_REDIRECT_URI || 
      'https://meridian-kdew.onrender.com/api/auth/outlook/callback';
    
    console.log('[OUTLOOK] Using redirect URI:', this.redirectUri);
  }

  getApiBaseUrl() {
    return process.env.API_BASE_URL || 'https://meridian-kdew.onrender.com';
  }

  getWebhookUrl() {
    return `${this.getApiBaseUrl()}/api/auth/outlook/webhook`;
  }

  getActiveAccountIndex(userSettings) {
    if (!userSettings?.outlookAccounts?.length) {
      return -1;
    }

    if (
      Number.isInteger(userSettings.activeOutlookIndex) &&
      userSettings.activeOutlookIndex >= 0 &&
      userSettings.activeOutlookIndex < userSettings.outlookAccounts.length
    ) {
      return userSettings.activeOutlookIndex;
    }

    const activeFlagIndex = userSettings.outlookAccounts.findIndex((account) => account?.isActive);
    return activeFlagIndex >= 0 ? activeFlagIndex : 0;
  }

  async refreshAccessTokenPayload(refreshToken) {
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

      return response.data;
    } catch (error) {
      console.error('❌ [OUTLOOK] Error refreshing token:', error.response?.data || error.message);
      throw error;
    }
  }

  async ensureValidAccountToken(userId, userSettings, accountIndex = null) {
    const resolvedSettings = userSettings || await awsManager.getUserSettings(userId);
    const resolvedIndex = accountIndex ?? this.getActiveAccountIndex(resolvedSettings);

    if (!resolvedSettings?.outlookAccounts?.[resolvedIndex]) {
      throw new Error('Outlook account not connected');
    }

    const currentAccount = resolvedSettings.outlookAccounts[resolvedIndex];

    if (!currentAccount.accessToken || this.isTokenExpired(currentAccount.expiresAt)) {
      console.log(`🔄 [OUTLOOK] Refreshing access token for ${currentAccount.email}`);
      const refreshed = await this.refreshAccessTokenPayload(currentAccount.refreshToken);

      currentAccount.accessToken = refreshed.access_token;
      currentAccount.refreshToken = refreshed.refresh_token || currentAccount.refreshToken;
      currentAccount.expiresAt = Date.now() + ((refreshed.expires_in || 3600) * 1000);
      currentAccount.updatedAt = new Date().toISOString();

      await awsManager.saveUserSettings(userId, resolvedSettings);
    }

    return {
      userSettings: resolvedSettings,
      accountIndex: resolvedIndex,
      account: currentAccount,
      accessToken: currentAccount.accessToken
    };
  }

  async setupReplySubscription(userId, accountIndex = null, forceRenew = false) {
    const userSettings = await awsManager.getUserSettings(userId);
    const { account, accessToken, accountIndex: resolvedIndex } = await this.ensureValidAccountToken(userId, userSettings, accountIndex);
    const existingSubscription = account.replySubscription;
    const existingExpiry = existingSubscription?.expirationDateTime ? new Date(existingSubscription.expirationDateTime).getTime() : 0;

    if (!forceRenew && existingSubscription?.subscriptionId && existingExpiry > Date.now() + (12 * 60 * 60 * 1000)) {
      return existingSubscription;
    }

    if (existingSubscription?.subscriptionId) {
      try {
        await axios.delete(`${this.graphBaseUrl}/subscriptions/${existingSubscription.subscriptionId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      } catch (error) {
        console.log(`⚠️ [OUTLOOK] Previous subscription cleanup failed for ${account.email}:`, error.response?.data || error.message);
      }
    }

    const expirationDateTime = new Date(Date.now() + (69 * 60 * 60 * 1000)).toISOString();
    const clientState = existingSubscription?.clientState || crypto.randomUUID();
    const response = await axios.post(
      `${this.graphBaseUrl}/subscriptions`,
      {
        changeType: 'created',
        notificationUrl: this.getWebhookUrl(),
        resource: "me/mailFolders('Inbox')/messages",
        expirationDateTime,
        clientState,
        latestSupportedTlsVersion: 'v1_2'
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const subscription = {
      subscriptionId: response.data.id,
      clientState,
      resource: response.data.resource,
      expirationDateTime: response.data.expirationDateTime,
      notificationUrl: this.getWebhookUrl(),
      createdAt: new Date().toISOString()
    };

    userSettings.outlookAccounts[resolvedIndex].replySubscription = subscription;
    await awsManager.saveUserSettings(userId, userSettings);

    console.log(`✅ [OUTLOOK] Reply subscription active for ${account.email} until ${subscription.expirationDateTime}`);
    return subscription;
  }

  async deleteReplySubscription(userId, accountIndex = null) {
    const userSettings = await awsManager.getUserSettings(userId);
    const resolvedIndex = accountIndex ?? this.getActiveAccountIndex(userSettings);
    const currentAccount = userSettings?.outlookAccounts?.[resolvedIndex];

    if (!currentAccount?.replySubscription?.subscriptionId) {
      return { success: true, removed: false };
    }

    const { accessToken } = await this.ensureValidAccountToken(userId, userSettings, resolvedIndex);

    try {
      await axios.delete(`${this.graphBaseUrl}/subscriptions/${currentAccount.replySubscription.subscriptionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (error) {
      console.log(`⚠️ [OUTLOOK] Subscription delete failed for ${currentAccount.email}:`, error.response?.data || error.message);
    }

    delete userSettings.outlookAccounts[resolvedIndex].replySubscription;
    await awsManager.saveUserSettings(userId, userSettings);

    return { success: true, removed: true };
  }

  async getMessage(userId, messageId, accountIndex = null) {
    const { accessToken } = await this.ensureValidAccountToken(userId, null, accountIndex);
    const response = await axios.get(
      `${this.graphBaseUrl}/me/messages/${encodeURIComponent(messageId)}?$select=conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,internetMessageId,internetMessageHeaders`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.body-content-type="text"'
        }
      }
    );

    return response.data;
  }

  normalizeReplyMessage(message) {
    const headerMap = (message?.internetMessageHeaders || []).reduce((acc, header) => {
      acc[String(header.name || '').toLowerCase()] = header.value;
      return acc;
    }, {});

    const body = typeof message?.body?.content === 'string'
      ? message.body.content
      : (message?.bodyPreview || '');

    return {
      from: message?.from?.emailAddress?.address || '',
      to: Array.isArray(message?.toRecipients)
        ? message.toRecipients.map((recipient) => recipient?.emailAddress?.address).filter(Boolean).join(', ')
        : '',
      subject: message?.subject || '',
      body,
      messageId: this.unwrapMessageId(message?.internetMessageId),
      inReplyTo: this.unwrapMessageId(headerMap['in-reply-to']),
      references: headerMap.references || '',
      threadId: message?.conversationId || '',
      timestamp: message?.receivedDateTime || new Date().toISOString()
    };
  }

  unwrapMessageId(value) {
    if (!value) return '';
    const match = String(value).match(/<([^>]+)>/);
    return match ? match[1] : String(value).trim();
  }

  buildTrackingMessageId(trackingId) {
    return `<${trackingId}@reply.meridianmail.app>`;
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
    const payload = await this.refreshAccessTokenPayload(refreshToken);
    return payload.access_token;
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
        currentAccountIndex = this.getActiveAccountIndex(userSettings);
        console.log('📧 [OUTLOOK ACCOUNTS] Found', outlookAccounts.length, 'accounts, active index:', currentAccountIndex);
      } else {
        console.error('❌ [OUTLOOK ACCOUNTS] No Outlook accounts found!');
        throw new Error('Outlook not connected. Please connect your Outlook account in settings.');
      }

      const currentAccount = outlookAccounts[currentAccountIndex];
      console.log('📧 [OUTLOOK ACCOUNT] Using account:', currentAccount.email);

      const { accessToken } = await this.ensureValidAccountToken(userId, userSettings, currentAccountIndex);

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
          { name: 'X-Meridian-Tracking-Id', value: trackingId },
          { name: 'Message-ID', value: this.buildTrackingMessageId(trackingId) }
        ];
      }

      if (inReplyTo) {
        message.internetMessageHeaders = [
          ...(message.internetMessageHeaders || []),
          { name: 'In-Reply-To', value: inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>` }
        ];
      }

      if (threadId) {
        message.internetMessageHeaders = [
          ...(message.internetMessageHeaders || []),
          { name: 'References', value: threadId.startsWith('<') ? threadId : `<${threadId}>` }
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
        messageId: trackingId ? this.unwrapMessageId(this.buildTrackingMessageId(trackingId)) : trackingId,
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
