import { google } from 'googleapis';
import AWSManager from './awsManager.js';

const awsManager = new AWSManager();

class GmailManager {
  constructor() {
    // Force Gmail-specific redirect URI, don't use shared env variable
    const gmailRedirectUri = process.env.GMAIL_REDIRECT_URI || 
      'https://meridian-kdew.onrender.com/api/auth/gmail/callback';
    
    console.log('[GMAIL] Using redirect URI:', gmailRedirectUri);
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      gmailRedirectUri
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify', // For Pub/Sub watch
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
   * Get user's email from tokens (helper for calendar OAuth)
   */
  async getUserEmailFromTokens(tokens) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token
      });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return profile.data.emailAddress;
    } catch (error) {
      console.error('❌ [GMAIL] Error getting email from tokens:', error);
      return 'unknown@gmail.com';
    }
  }

  /**
   * Send email via Gmail API (with account cycling)
   * @param {Object} options - Email options
   * @param {string} options.inReplyTo - Message-ID of the email being replied to (for threading)
   * @param {string} options.references - References header for threading
   * @param {string} options.threadId - Gmail thread ID for threading
   */
  async sendEmail({ userId, to, subject, htmlBody, textBody, ccEmails = null, bccEmails = null, replyTo = null, agentId = null, enableTracking = true, trackingId = null, inReplyTo = null, references = null, threadId = null }) {
    try {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📧 [GMAIL SEND] Starting Gmail send process');
      console.log('📧 [GMAIL SEND] To:', to);
      console.log('📧 [GMAIL SEND] Subject:', subject);
      console.log('📧 [GMAIL SEND] User ID:', userId);
      console.log('📧 [GMAIL SEND] Agent ID:', agentId);
      console.log('📧 [GMAIL SEND] Tracking ID:', trackingId);
      console.log('📧 [GMAIL SEND] CC:', ccEmails || 'None');
      console.log('📧 [GMAIL SEND] BCC:', bccEmails || 'None');
      console.log('📧 [GMAIL SEND] HTML Body Length:', htmlBody?.length || 0);
      console.log('═══════════════════════════════════════════════════════════════');
      if (inReplyTo || threadId) {
        console.log('🧵 [GMAIL THREADING] Threading enabled - sending as reply');
        console.log('🧵 [GMAIL THREADING] In-Reply-To:', inReplyTo);
        console.log('🧵 [GMAIL THREADING] Thread ID:', threadId);
      }

      // Get user's Gmail credentials from DynamoDB
      console.log('📥 [GMAIL ACCOUNTS] Fetching user settings from DynamoDB...');
      const userSettings = await awsManager.getUserSettings(userId);
      console.log('📥 [GMAIL ACCOUNTS] User settings retrieved');
      console.log('📥 [GMAIL ACCOUNTS] Has gmailAuth:', !!userSettings?.gmailAuth);
      console.log('📥 [GMAIL ACCOUNTS] Has gmailAccounts:', !!userSettings?.gmailAccounts);
      console.log('📥 [GMAIL ACCOUNTS] Has calendarTokens:', !!userSettings?.calendarTokens);
      
      // Support both old gmailAuth format, new gmailAccounts array, and calendarTokens with Gmail scopes
      let gmailAccounts = [];
      let currentAccountIndex = 0;
      
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        // New multi-account format
        console.log('✅ [GMAIL ACCOUNTS] Using gmailAccounts format');
        gmailAccounts = userSettings.gmailAccounts;
        currentAccountIndex = userSettings.activeGmailIndex || 0;
        console.log('📧 [GMAIL ACCOUNTS] Found', gmailAccounts.length, 'accounts, active index:', currentAccountIndex);
        gmailAccounts.forEach((acc, idx) => {
          console.log(`   Account ${idx + 1}: ${acc.email} (Active: ${acc.isActive}, Has Token: ${!!acc.refreshToken})`);
        });
      } else if (userSettings?.gmailAuth?.refreshToken) {
        // Legacy single account format - convert to array
        console.log('✅ [GMAIL ACCOUNTS] Using legacy gmailAuth format');
        gmailAccounts = [{
          email: userSettings.gmailAuth.email,
          refreshToken: userSettings.gmailAuth.refreshToken,
          isActive: true
        }];
        currentAccountIndex = 0;
        console.log('📧 [GMAIL ACCOUNTS] Legacy account:', userSettings.gmailAuth.email);
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        // Calendar OAuth includes Gmail scopes
        console.log('✅ [GMAIL ACCOUNTS] Using calendarTokens with Gmail scopes');
        const emailAddress = await this.getUserEmailFromTokens(userSettings.calendarTokens);
        gmailAccounts = [{
          email: emailAddress,
          refreshToken: userSettings.calendarTokens.refresh_token,
          isActive: true
        }];
        currentAccountIndex = 0;
        console.log('📧 [GMAIL ACCOUNTS] Calendar token email:', emailAddress);
      } else {
        console.error('❌ [GMAIL ACCOUNTS] No Gmail accounts found!');
        console.error('❌ [GMAIL ACCOUNTS] User settings:', {
          hasGmailAuth: !!userSettings?.gmailAuth,
          hasGmailAccounts: !!userSettings?.gmailAccounts,
          hasCalendarTokens: !!userSettings?.calendarTokens,
          calendarScopes: userSettings?.calendarTokens?.scope
        });
        throw new Error('Gmail not connected. Please connect your Gmail account in settings.');
      }

      // Get the current account for this email
      const currentAccount = gmailAccounts[currentAccountIndex];
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`📧 [GMAIL ACCOUNT] Using account ${currentAccountIndex + 1}/${gmailAccounts.length}: ${currentAccount.email}`);
      console.log(`📧 [GMAIL ACCOUNT] Has refresh token: ${!!currentAccount.refreshToken}`);
      console.log(`📧 [GMAIL ACCOUNT] Token length: ${currentAccount.refreshToken?.length || 0}`);
      console.log('═══════════════════════════════════════════════════════════════');

      // Set credentials
      console.log('🔐 [GMAIL AUTH] Setting OAuth2 credentials...');
      this.oauth2Client.setCredentials({
        refresh_token: currentAccount.refreshToken
      });
      console.log('✅ [GMAIL AUTH] Credentials set successfully');

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Get company name from user settings for display name
      let displayName = currentAccount.email.split('@')[0]; // Default to email username
      if (userSettings?.companyProfile?.companyName) {
        displayName = userSettings.companyProfile.companyName;
      }

      // Use provided tracking ID or generate new one
      const finalTrackingId = trackingId || `tracking-${userId}_${agentId || 'unknown'}_${Date.now()}`;
      console.log(`📊 [GMAIL] Using tracking ID: ${finalTrackingId}`);

      // Tracking pixel was already injected by sendEmailMailgun before routing to Gmail
      let finalHtmlBody = htmlBody || textBody;
      console.log(`📊 [GMAIL] Email body received (tracking pixel should already be included)`);
      console.log(`📊 [GMAIL] Body contains tracking pixel?`, finalHtmlBody?.includes(finalTrackingId));

      // Build email message in RFC 2822 format
      const messageParts = [
        `From: ${displayName} <${currentAccount.email}>`,
        `To: ${Array.isArray(to) ? to.join(', ') : to}`,
        `Subject: ${subject}`,
        `Message-ID: <${finalTrackingId}@gmail.com>`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
      ];

      // Add threading headers for follow-up emails (send as reply)
      if (inReplyTo) {
        messageParts.push(`In-Reply-To: ${inReplyTo}`);
        console.log(`📧 [GMAIL] Adding In-Reply-To header: ${inReplyTo}`);
      }
      if (references) {
        messageParts.push(`References: ${references}`);
        console.log(`📧 [GMAIL] Adding References header: ${references}`);
      } else if (inReplyTo) {
        // If no references but we have inReplyTo, use that as references
        messageParts.push(`References: ${inReplyTo}`);
      }

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
        messageParts.push(`X-Meridian-Tracking-Id: ${finalTrackingId}`);
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
      const requestBody = {
        raw: encodedMessage
      };
      
      // Add threadId for threading if provided (to reply in the same thread)
      if (threadId) {
        requestBody.threadId = threadId;
        console.log(`📧 [GMAIL] Sending in thread: ${threadId}`);
      }
      
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody
      });

      console.log('✅ [GMAIL] Email sent successfully. MessageId:', result.data.id);
      console.log('✅ [GMAIL] Thread ID:', result.data.threadId);
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
          trackingId: enableTracking ? finalTrackingId : null,
          to: to,
          subject: subject,
          fromAccount: currentAccount.email,
          accountCycled: gmailAccounts.length > 1
        }
      });

      return {
        success: true,
        messageId: result.data.id,
        threadId: result.data.threadId, // Return threadId for future reply threading
        trackingId: finalTrackingId,
        sentFrom: currentAccount.email,
        provider: 'gmail'
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
      
      // Check for refresh token in multiple locations
      let refreshToken = null;
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        const activeAccount = userSettings.gmailAccounts.find(acc => acc.isActive) || userSettings.gmailAccounts[0];
        refreshToken = activeAccount.refreshToken;
      } else if (userSettings?.gmailAuth?.refreshToken) {
        refreshToken = userSettings.gmailAuth.refreshToken;
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        refreshToken = userSettings.calendarTokens.refresh_token;
      }
      
      if (!refreshToken) {
        return [];
      }

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
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
   * Get full message details by message ID
   */
  async getMessage(userId, messageId) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      
      // Check for refresh token in multiple locations (gmailAccounts, gmailAuth, calendarTokens)
      let refreshToken = null;
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        const activeAccount = userSettings.gmailAccounts.find(acc => acc.isActive) || userSettings.gmailAccounts[0];
        refreshToken = activeAccount.refreshToken;
      } else if (userSettings?.gmailAuth?.refreshToken) {
        refreshToken = userSettings.gmailAuth.refreshToken;
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        refreshToken = userSettings.calendarTokens.refresh_token;
      }
      
      if (!refreshToken) {
        throw new Error('No Gmail refresh token found');
      }

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      const headers = {};
      
      // Parse headers
      if (message.payload?.headers) {
        message.payload.headers.forEach(header => {
          headers[header.name.toLowerCase()] = header.value;
        });
      }

      // Extract body - collect ALL text from all parts
      let allTextParts = [];
      
      // Recursive function to extract ALL body text from parts
      const extractAllBodyParts = (parts, depth = 0) => {
        if (!parts || !Array.isArray(parts)) return;
        
        for (const part of parts) {
          console.log(`${'  '.repeat(depth)}📦 [GMAIL] Part: ${part.mimeType}, has data: ${!!part.body?.data}, has nested parts: ${!!part.parts}`);
          
          // Check if this part has nested parts
          if (part.parts) {
            extractAllBodyParts(part.parts, depth + 1);
          }
          
          // Extract text from this part if it has data
          if (part.body?.data) {
            try {
              const text = Buffer.from(part.body.data, 'base64').toString('utf-8');
              if (text && text.length > 0) {
                console.log(`${'  '.repeat(depth)}✅ [GMAIL] Extracted ${text.length} chars from ${part.mimeType}`);
                allTextParts.push(text);
              }
            } catch (err) {
              console.log(`${'  '.repeat(depth)}⚠️ [GMAIL] Failed to decode part: ${err.message}`);
            }
          }
        }
      };
      
      if (message.payload?.parts) {
        // Multipart message - extract all parts
        console.log(`📬 [GMAIL] Message has ${message.payload.parts.length} top-level parts`);
        extractAllBodyParts(message.payload.parts);
      } else if (message.payload?.body?.data) {
        // Simple message
        const text = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        console.log(`📬 [GMAIL] Simple message: ${text.length} chars`);
        allTextParts.push(text);
      }
      
      // Combine all text parts
      const body = allTextParts.join('\n\n---\n\n');
      console.log(`📝 [GMAIL] Total body length: ${body.length} chars from ${allTextParts.length} parts`);

      return {
        id: message.id,
        threadId: message.threadId,
        from: headers['from'] || '',
        to: headers['to'] || '',
        subject: headers['subject'] || '',
        body: body,
        messageId: headers['message-id'] || '',
        inReplyTo: headers['in-reply-to'] || '',
        references: headers['references'] || '',
        date: headers['date'] || ''
      };
    } catch (error) {
      console.error('❌ [GMAIL] Error getting message:', error);
      throw error;
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

  /**
   * Set up Gmail push notifications via Pub/Sub
   */
  async setupPushNotifications(userId) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      
      // Get refresh token from various sources
      let refreshToken = null;
      
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        // New multi-account format - use active account
        const activeIndex = userSettings.activeGmailIndex || 0;
        const activeAccount = userSettings.gmailAccounts[activeIndex];
        refreshToken = activeAccount?.refreshToken;
      } else if (userSettings?.gmailAuth?.refreshToken) {
        // Legacy single account format
        refreshToken = userSettings.gmailAuth.refreshToken;
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        // Calendar OAuth includes Gmail scopes
        refreshToken = userSettings.calendarTokens.refresh_token;
      }
      
      if (!refreshToken) {
        throw new Error('No Gmail refresh token found');
      }

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Your Google Cloud Pub/Sub topic (format: projects/YOUR_PROJECT_ID/topics/YOUR_TOPIC_NAME)
      const topicName = process.env.GOOGLE_PUBSUB_TOPIC || 'projects/YOUR_PROJECT_ID/topics/gmail-notifications';

      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName,
          labelIds: ['INBOX'], // Only watch inbox
          labelFilterAction: 'include'
        }
      });

      console.log('✅ [GMAIL] Push notifications set up:', response.data);
      
      // Store the watch info to renew it later (expires in ~7 days)
      await awsManager.saveUserSettings(userId, {
        ...userSettings,
        gmailWatch: {
          historyId: response.data.historyId,
          expiration: response.data.expiration,
          setupAt: Date.now()
        }
      });

      return {
        success: true,
        historyId: response.data.historyId,
        expiration: response.data.expiration
      };
    } catch (error) {
      console.error('❌ [GMAIL] Error setting up push notifications:', error);
      throw error;
    }
  }

  /**
   * Stop Gmail push notifications
   */
  async stopPushNotifications(userId) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      
      // Get refresh token from various sources
      let refreshToken = null;
      
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        const activeIndex = userSettings.activeGmailIndex || 0;
        const activeAccount = userSettings.gmailAccounts[activeIndex];
        refreshToken = activeAccount?.refreshToken;
      } else if (userSettings?.gmailAuth?.refreshToken) {
        refreshToken = userSettings.gmailAuth.refreshToken;
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        refreshToken = userSettings.calendarTokens.refresh_token;
      }
      
      if (!refreshToken) {
        throw new Error('No Gmail refresh token found');
      }

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      await gmail.users.stop({
        userId: 'me'
      });

      console.log('✅ [GMAIL] Push notifications stopped');
      return { success: true };
    } catch (error) {
      console.error('❌ [GMAIL] Error stopping push notifications:', error);
      throw error;
    }
  }

  /**
   * Get Gmail user profile (includes current historyId)
   */
  async getUserProfile(userId) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      
      let refreshToken;
      if (userSettings?.gmailAuth?.refreshToken) {
        refreshToken = userSettings.gmailAuth.refreshToken;
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        refreshToken = userSettings.calendarTokens.refresh_token;
      }
      
      if (!refreshToken) {
        throw new Error('No Gmail refresh token found');
      }

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.getProfile({
        userId: 'me'
      });

      return response.data;
    } catch (error) {
      console.error('❌ [GMAIL] Error getting profile:', error);
      throw error;
    }
  }

  /**
   * Get history of changes since a specific historyId
   */
  async getHistory(userId, startHistoryId) {
    try {
      const userSettings = await awsManager.getUserSettings(userId);
      
      // Get refresh token from various sources
      let refreshToken = null;
      
      if (userSettings?.gmailAccounts && userSettings.gmailAccounts.length > 0) {
        const activeIndex = userSettings.activeGmailIndex || 0;
        const activeAccount = userSettings.gmailAccounts[activeIndex];
        refreshToken = activeAccount?.refreshToken;
      } else if (userSettings?.gmailAuth?.refreshToken) {
        refreshToken = userSettings.gmailAuth.refreshToken;
      } else if (userSettings?.calendarTokens?.refresh_token && 
                 userSettings?.calendarTokens?.scope?.includes('gmail')) {
        refreshToken = userSettings.calendarTokens.refresh_token;
      }
      
      if (!refreshToken) {
        throw new Error('No Gmail refresh token found');
      }

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: startHistoryId,
        historyTypes: ['messageAdded'], // Only care about new messages
        labelId: 'INBOX'
      });

      return response.data.history || [];
    } catch (error) {
      console.error('❌ [GMAIL] Error getting history:', error);
      throw error;
    }
  }

  /**
   * Check if a message is a bounce notification
   * Gmail bounce messages come from mailer-daemon@googlemail.com
   */
  isBounceMessage(message) {
    if (!message) return false;

    const fromLower = (message.from || '').toLowerCase();
    const subjectLower = (message.subject || '').toLowerCase();

    // Check if from mailer-daemon
    const isFromDaemon = fromLower.includes('mailer-daemon') || 
                         fromLower.includes('postmaster') ||
                         fromLower.includes('mail delivery');

    // Check subject for bounce indicators
    const hasBounceSubject = subjectLower.includes('delivery') ||
                             subjectLower.includes('undelivered') ||
                             subjectLower.includes('failure') ||
                             subjectLower.includes('returned') ||
                             subjectLower.includes('not delivered');

    return isFromDaemon && hasBounceSubject;
  }

  /**
   * Extract tracking ID from bounce message
   * Looks for tracking ID in the original message headers or body
   * Format: tracking-{userId}_{agentId}_{timestamp}_{shortHash}
   */
  extractTrackingIdFromBounce(message) {
    // Updated regex to match the full tracking ID format with 4 parts
    const trackingPattern = /(tracking-[a-f0-9-]+_[^_@]+_\d+_[a-z0-9]+)/i;
    
    // Check In-Reply-To header
    if (message.inReplyTo && message.inReplyTo.includes('tracking-')) {
      const match = message.inReplyTo.match(trackingPattern);
      if (match) {
        console.log(`🔍 [GMAIL] Found tracking ID in In-Reply-To: ${match[1]}`);
        return match[1];
      }
    }

    // Check References header
    if (message.references && message.references.includes('tracking-')) {
      const match = message.references.match(trackingPattern);
      if (match) {
        console.log(`🔍 [GMAIL] Found tracking ID in References: ${match[1]}`);
        return match[1];
      }
    }

    // Check Message-ID header (our sent emails have tracking ID in Message-ID)
    if (message.messageId && message.messageId.includes('tracking-')) {
      const match = message.messageId.match(trackingPattern);
      if (match) {
        console.log(`🔍 [GMAIL] Found tracking ID in Message-ID: ${match[1]}`);
        return match[1];
      }
    }

    // Check body content
    if (message.body) {
      const match = message.body.match(trackingPattern);
      if (match) {
        console.log(`🔍 [GMAIL] Found tracking ID in body: ${match[1]}`);
        return match[1];
      }
    }

    console.log(`⚠️ [GMAIL] Could not find tracking ID in message`);
    console.log(`   In-Reply-To: ${message.inReplyTo || 'none'}`);
    console.log(`   References: ${message.references || 'none'}`);
    console.log(`   Message-ID: ${message.messageId || 'none'}`);
    console.log(`   Body preview: ${(message.body || '').substring(0, 200)}...`);
    
    return null;
  }

  /**
   * Extract recipient email from bounce message
   */
  extractRecipientFromBounce(message) {
    const body = message.body || '';
    
    // Common patterns in bounce messages
    const patterns = [
      /<([^>]+)>:/,  // <email@example.com>:
      /to ([\w\.-]+@[\w\.-]+)/i,  // "to email@example.com"
      /address ([\w\.-]+@[\w\.-]+)/i,  // "address email@example.com"
      /user ([\w\.-]+@[\w\.-]+)/i  // "user email@example.com"
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'unknown';
  }
}


export default GmailManager;
