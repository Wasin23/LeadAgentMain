import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand, SendRawEmailCommand, VerifyDomainIdentityCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

class AWSManager {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    // Configure DynamoDB
    const ddbClient = new DynamoDBClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });
    
    this.dynamodb = DynamoDBDocumentClient.from(ddbClient);
    
    // Configure SES
    this.ses = new SESClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });
    
    // Table names
    this.tables = {
      teams: process.env.AWS_DYNAMODB_TEAMS_TABLE || 'meridian-teams',
      users: process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users',
      userSettings: process.env.AWS_DYNAMODB_USER_SETTINGS_TABLE || 'meridian-user-settings',
      agentSettings: process.env.AWS_DYNAMODB_AGENT_SETTINGS_TABLE || 'meridian-agent-settings',
      leadData: process.env.AWS_DYNAMODB_LEAD_DATA_TABLE || 'meridian-lead-data',
      emailTracking: process.env.AWS_DYNAMODB_EMAIL_TRACKING_TABLE || 'meridian-email-tracking-v2',
      agentState: process.env.AWS_DYNAMODB_AGENT_STATE_TABLE || 'meridian-agent-state',
      contactedLeads: process.env.AWS_DYNAMODB_CONTACTED_LEADS_TABLE || 'meridian-contacted-leads',
      cycleLogs: process.env.AWS_DYNAMODB_CYCLE_LOGS_TABLE || 'meridian-cycle-logs',
      apiUsage: process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage',
      apiUsageSummary: process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary',
      issuesAlerts: process.env.AWS_DYNAMODB_ISSUES_ALERTS_TABLE || 'meridian-issues-alerts',
      unsubscribes: process.env.AWS_DYNAMODB_UNSUBSCRIBES_TABLE || 'meridian-unsubscribes',
      searchHistory: process.env.AWS_DYNAMODB_SEARCH_HISTORY_TABLE || 'meridian-search-history',
      paymentHistory: process.env.AWS_DYNAMODB_PAYMENT_HISTORY_TABLE || 'meridian-payment-history',
      agentMetrics: process.env.AWS_DYNAMODB_AGENT_METRICS_TABLE || 'meridian-agent-metrics',
      crmContacts: process.env.AWS_DYNAMODB_CRM_CONTACTS_TABLE || 'meridian-crm-contacts',
      // Thompson Sampling bandit stats for lead source selection
      // PK: userId, SK: keyword#sourceId
      leadSourceBandit: process.env.AWS_DYNAMODB_LEAD_SOURCE_BANDIT_TABLE || 'meridian-lead-source-bandit'
    };
    
    // API Cost rates (with 1.5x multiplier for platform margin) — updated
    this.apiCosts = {
      apollo: 0.034722 * 1.2, // real contract: $7500/yr for 216,000 credits = $0.034722/credit, 1.2x platform margin
      openai: (0.005 / 1000) * 1.5,     // GPT-4o with platform margin
      openaiMini: (0.0002 / 1000) * 1.5, // GPT-4o-mini with platform margin
      anthropic: (0.005 / 1000) * 1.5, // fallback blended rate
      anthropicInput: (3 / 1000000) * 1.5, // Claude Sonnet input tokens with platform margin
      anthropicOutput: (15 / 1000000) * 1.5, // Claude Sonnet output tokens with platform margin
      haikuInput: (1 / 1000000) * 1.5, // Claude Haiku 4.5 input tokens with platform margin
      haikuOutput: (5 / 1000000) * 1.5, // Claude Haiku 4.5 output tokens with platform margin
      mailgun: 0.0008 * 1.5, // per email with platform margin
      zerobounce: 0.005 * 1.5, // per validation with platform margin
      serper: 0.001 * 1.5 // per search query with platform margin
    };

    // Plan system with credit limits and purchase options
    this.plans = {
      'free-trial': {
        name: 'Free Trial',
        initialCredits: 250,
        maxCredits: 250,
        canPurchaseMore: false,
        maxAgents: 1,
        maxConcurrency: 3,
        maxStarredLeads: 3,
        // Formula (ceil(totalMonthlyEmails / 30 / 50)) gives 0 here — trial volume is too
        // low to justify a dedicated inbox. Floored to 1 anyway so a trial user can still
        // connect one personal Gmail/Outlook instead of only the shared Mailgun fallback.
        maxSendingAddresses: 1,
        description: 'Try Meridian with 250 free credits'
      },
      // current plan names — leadAllowance/emailAllowance are marketing-facing counts
      // (1 fully-researched lead = 1 initial email + 3 follow-ups = 4 sends).
      // Backed by initialCredits, which already covers the allowance with headroom
      // left over for chat, extra research, and other credit-metered features.
      //
      // maxSendingAddresses = ceil(emailAllowance / 30 / 50) — 50 is the flat per-mailbox
      // daily deliverability cap (utils/dailySendCaps.js's PER_ACCOUNT_DAILY_CAP), so this
      // is "how many mailboxes would it take to actually clear a full day's allowance at
      // that flat per-mailbox rate," rounded up.
      'solo': {
        name: 'Solo',
        initialCredits: 750,
        maxCredits: 10000,
        canPurchaseMore: true,
        creditPackages: [1000, 2000, 5000],
        maxAgents: 2,
        maxConcurrency: 4,
        maxStarredLeads: 20,
        leadAllowance: 750,
        emailAllowance: 3000, // 750 leads x (1 main + 3 follow-ups)
        maxSendingAddresses: 2, // ceil(3000 / 30 / 50)
        description: '750 fully researched & tracked leads, 3,000 emails'
      },
      'team': {
        name: 'Team',
        initialCredits: 2100,
        maxCredits: 30000,
        canPurchaseMore: true,
        creditPackages: [1000, 5000, 10000],
        maxAgents: 6,
        maxConcurrency: 8,
        maxStarredLeads: 50,
        leadAllowance: 2000,
        emailAllowance: 8000, // 2000 leads x (1 main + 3 follow-ups)
        maxSendingAddresses: 6, // ceil(8000 / 30 / 50)
        description: '2,000 fully researched & tracked leads, 8,000 emails'
      },
      'agency': {
        name: 'Agency',
        initialCredits: 4200,
        maxCredits: 80000,
        canPurchaseMore: true,
        creditPackages: [5000, 10000, 20000],
        maxAgents: 15,
        maxConcurrency: 12,
        maxStarredLeads: 100,
        leadAllowance: 4000,
        emailAllowance: 16000, // 4000 leads x (1 main + 3 follow-ups)
        maxSendingAddresses: 11, // ceil(16000 / 30 / 50)
        description: '4,000 fully researched & tracked leads, 16,000 emails'
      },
      // legacy plan names — kept so existing users are unaffected
      'basic': {
        name: 'Basic Plan',
        initialCredits: 1200,
        maxCredits: 10000,
        canPurchaseMore: true,
        creditPackages: [1000, 2000, 5000],
        maxAgents: 3,
        maxConcurrency: 5,
        maxStarredLeads: 20,
        maxSendingAddresses: 1, // ceil(1200 / 30 / 50) — no emailAllowance split, uses initialCredits
        description: 'Get started with outreach on a budget'
      },
      'starter': {
        name: 'Starter Plan',
        initialCredits: 13000,
        maxCredits: 30000,
        canPurchaseMore: true,
        creditPackages: [1000, 5000, 10000],
        maxAgents: 5,
        maxConcurrency: 10,
        maxStarredLeads: 50,
        maxSendingAddresses: 9, // ceil(13000 / 30 / 50)
        description: 'Perfect for small teams and solo entrepreneurs'
      },
      'professional': {
        name: 'Professional Plan',
        initialCredits: 30000,
        maxCredits: 80000,
        canPurchaseMore: true,
        creditPackages: [5000, 10000, 20000],
        maxAgents: 10,
        maxConcurrency: 20,
        maxStarredLeads: 100,
        maxSendingAddresses: 20, // ceil(30000 / 30 / 50)
        description: 'Ideal for growing businesses and agencies'
      },
      'enterprise': {
        name: 'Enterprise Plan',
        initialCredits: 70000,
        maxCredits: 200000,
        canPurchaseMore: true,
        creditPackages: [10000, 25000, 50000],
        maxAgents: 30,
        maxConcurrency: 30,
        maxStarredLeads: 100,
        maxSendingAddresses: 47, // ceil(70000 / 30 / 50)
        description: 'Unlimited scale for large organizations'
      },
      'developer': {
        name: 'Developer',
        initialCredits: 999999,
        maxCredits: 999999,
        canPurchaseMore: true,
        creditPackages: [],
        maxAgents: 999,
        maxConcurrency: 999,
        maxStarredLeads: 999,
        maxSendingAddresses: 999,
        description: 'Internal developer account — all limits lifted'
      },
      // Admin-assigned only — not offered at signup or in the billing upgrade picker (same
      // pattern as 'developer'). Full Team-tier access so testers actually exercise real
      // volume, at no charge. Created via scripts_me/create-beta-user.js.
      'beta': {
        name: 'Beta Tester',
        initialCredits: 2100,
        maxCredits: 30000,
        canPurchaseMore: false,
        creditPackages: [],
        maxAgents: 6,
        maxConcurrency: 8,
        maxStarredLeads: 50,
        leadAllowance: 2000,
        emailAllowance: 8000,
        maxSendingAddresses: 6,
        description: 'Beta tester account — Team-tier access, free for the duration of the beta program'
      }
    };
    
    // Removed initialization logs to reduce console noise
  }

  getPlanConfig(planId = 'free-trial') {
    return this.plans[planId] || this.plans['free-trial'];
  }

  getPlanLimits(planId = 'free-trial') {
    const planConfig = this.getPlanConfig(planId);
    return {
      maxAgents: planConfig.maxAgents || 1,
      maxConcurrency: planConfig.maxConcurrency || 1,
      maxSendingAddresses: planConfig.maxSendingAddresses || 1,
    };
  }

  isTrialBlockedUser(user) {
    return user?.plan === 'free-trial' && user?.trialEligible === false;
  }

  // Whether the user can connect one more distinct Gmail/Outlook address — checked at OAuth
  // callback time (routes/gmailAuth.js, routes/outlookAuth.js). Re-authorizing an already-
  // connected address never counts against this; only genuinely new additions do.
  async canConnectNewSendingAddress(userId) {
    const [user, userSettings] = await Promise.all([
      this.getUserById(userId),
      this.getUserSettings(userId),
    ]);
    const { maxSendingAddresses } = this.getPlanLimits(user?.plan || 'free-trial');
    const current = (userSettings?.gmailAccounts?.length || 0) + (userSettings?.outlookAccounts?.length || 0);
    return { allowed: current < maxSendingAddresses, limit: maxSendingAddresses, current };
  }

  // =====================
  // USER SETTINGS METHODS
  // =====================
  
  async getUserSettings(userId) {
    try {
      // Reduced verbosity - only log errors
      
      const command = new GetCommand({
        TableName: this.tables.userSettings,
        Key: { userId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        // No user settings - silent
        return null;
      }
      
      // Settings retrieved successfully (log removed for cleaner output)
      return result.Item;
    } catch (error) {
      console.error('[AWS] Error getting user settings:', error);
      throw error;
    }
  }
  
  async saveUserSettings(userId, settings) {
    try {
      console.log('[AWS] Saving user settings for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.userSettings,
        Item: {
          userId,
          ...settings,
          updatedAt: new Date().toISOString(),
          version: settings.version || '1.0'
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] User settings saved successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error saving user settings:', error);
      throw error;
    }
  }

  // ── Qualification score history (for percentile-rank gating) ───────────────
  // qualifyLead() computes a real calibrated P(conversion) per lead, but that raw
  // probability is not what should gate spend or display in the UI — cold-outreach
  // base rates mean the median lead is genuinely a low percentage, and clamping/
  // rescaling that number to "look like" the old 0-100 spread would corrupt the
  // probability itself. Instead: gate on percentile rank against a trailing
  // window of this account's own recent scores. Capped rolling list, piggybacks
  // on userSettings rather than a dedicated table — 300 floats is negligible
  // payload; a dedicated store would be more efficient at high write volume but
  // this is a reasonable v1.

  async getQualificationScoreHistory(userId) {
    try {
      const settings = await this.getUserSettings(userId);
      return Array.isArray(settings?.qualificationScoreHistory) ? settings.qualificationScoreHistory : [];
    } catch (error) {
      console.error('[AWS] Error getting qualification score history:', error);
      return [];
    }
  }

  async appendQualificationScore(userId, rawProbability) {
    try {
      const settings = await this.getUserSettings(userId) || {};
      const history = Array.isArray(settings.qualificationScoreHistory) ? settings.qualificationScoreHistory : [];
      history.push(rawProbability);
      if (history.length > 300) history.splice(0, history.length - 300);
      await this.saveUserSettings(userId, { ...settings, qualificationScoreHistory: history });
    } catch (error) {
      console.error('[AWS] Error appending qualification score:', error);
    }
  }

  // ── Qualification rubrics (per keyword+position combo) ─────────────────────
  // Originally stored in a dedicated Zilliz collection, but Zilliz plans here are
  // capped at 5 collections total and that limit was already hit by other
  // features (lead_agent_memory, industry facts, etc.) — collection creation
  // failed outright in production. DynamoDB via userSettings has no such limit
  // and is already the store for everything else on the account, so rubrics live
  // there instead: keyed by search_combo (keyword#position, lowercased) inside a
  // qualificationRubrics map, same JSON-blob-on-userSettings pattern as the score
  // history above.

  _rubricComboKey(keyword, position) {
    return `${(keyword || '').toLowerCase().trim()}#${(position || '').toLowerCase().trim()}`;
  }

  async getQualificationRubric(userId, keyword, position) {
    try {
      const settings = await this.getUserSettings(userId);
      const combo = this._rubricComboKey(keyword, position);
      const rubric = settings?.qualificationRubrics?.[combo];
      return rubric || null;
    } catch (error) {
      console.error('[AWS] Error getting qualification rubric:', error);
      return null;
    }
  }

  async saveQualificationRubric(userId, agentId, keyword, position, rubric, sourceInstructionsHash) {
    // Writes via UpdateCommand targeting the single map key, NOT the old
    // get-whole-settings → mutate → put-whole-settings pattern. That pattern is a
    // read-modify-write race: userSettings gets written constantly from unrelated
    // paths (IP tracking, cycle state, score history, etc. — visible firing every
    // few seconds in production logs), so a save here could read stale settings
    // and get silently overwritten by the next unrelated write landing in between
    // the read and the put. UpdateExpression on a single nested path is atomic —
    // it can't be clobbered by a concurrent write to a different part of the item.
    const combo = this._rubricComboKey(keyword, position);
    try {
      const existing = await this.getQualificationRubric(userId, keyword, position);
      const nextVersion = (existing?.version || 0) + 1;
      const record = {
        keyword: (keyword || '').toLowerCase(),
        position,
        searchCombo: combo,
        agentId,
        criteria: rubric.criteria || [],
        icpSummary: rubric.icpSummary || '',
        version: nextVersion,
        generatedAt: Date.now(),
        sourceInstructionsHash: sourceInstructionsHash || ''
      };
      try {
        await this.dynamodb.send(new UpdateCommand({
          TableName: this.tables.userSettings,
          Key: { userId },
          UpdateExpression: 'SET qualificationRubrics.#combo = :record',
          ExpressionAttributeNames: { '#combo': combo },
          ExpressionAttributeValues: { ':record': record }
        }));
      } catch (updateError) {
        // qualificationRubrics map doesn't exist yet on this account — DynamoDB
        // can't traverse into a non-existent nested path, so initialize the whole
        // map in one shot. Safe to overwrite (not merge) since it didn't exist.
        if (updateError.name === 'ValidationException') {
          await this.dynamodb.send(new UpdateCommand({
            TableName: this.tables.userSettings,
            Key: { userId },
            UpdateExpression: 'SET qualificationRubrics = :map',
            ExpressionAttributeValues: { ':map': { [combo]: record } }
          }));
        } else {
          throw updateError;
        }
      }
      return { success: true, version: nextVersion };
    } catch (error) {
      console.error('[AWS] Error saving qualification rubric:', error);
      return { success: false, error: error.message };
    }
  }

  async listQualificationRubrics(userId) {
    try {
      const settings = await this.getUserSettings(userId);
      const rubrics = settings?.qualificationRubrics || {};
      return { success: true, rubrics: Object.values(rubrics) };
    } catch (error) {
      console.error('[AWS] Error listing qualification rubrics:', error);
      return { success: false, error: error.message, rubrics: [] };
    }
  }

  async deleteQualificationRubric(userId, keyword, position) {
    // Atomic REMOVE on the single map key — same race-avoidance reasoning as
    // saveQualificationRubric above. This was the likely cause of "delete doesn't
    // actually work": the old get-mutate-put could read settings, have an
    // unrelated concurrent write land, then put back a payload that still
    // contained the "deleted" rubric, undoing the delete without any error.
    const combo = this._rubricComboKey(keyword, position);
    try {
      await this.dynamodb.send(new UpdateCommand({
        TableName: this.tables.userSettings,
        Key: { userId },
        UpdateExpression: 'REMOVE qualificationRubrics.#combo',
        ExpressionAttributeNames: { '#combo': combo }
      }));
      return { success: true };
    } catch (error) {
      // Map or item doesn't exist — nothing to delete, treat as success.
      if (error.name === 'ValidationException') {
        return { success: true };
      }
      console.error('[AWS] Error deleting qualification rubric:', error);
      return { success: false, error: error.message };
    }
  }

  // ── Starred Leads & Timeline ──────────────────────────────────────────────

  async getStarredLeads(userId) {
    const settings = await this.getUserSettings(userId);
    return settings?.starredLeads || [];
  }

  async starLead(userId, leadInfo) {
    try {
      const settings = await this.getUserSettings(userId) || {};
      const starred = settings.starredLeads || [];
      if (starred.find(l => l.leadId === leadInfo.leadId)) return;
      starred.unshift({ ...leadInfo, starredAt: new Date().toISOString() });
      await this.saveUserSettings(userId, { ...settings, starredLeads: starred });
    } catch (err) {
      console.error('[STARRED LEADS] Error starring lead:', err.message);
    }
  }

  async unstarLead(userId, leadId) {
    try {
      const settings = await this.getUserSettings(userId) || {};
      const starred = (settings.starredLeads || []).filter(l => l.leadId !== leadId);
      await this.saveUserSettings(userId, { ...settings, starredLeads: starred });
    } catch (err) {
      console.error('[STARRED LEADS] Error unstarring lead:', err.message);
    }
  }

  /**
   * Hide a lead from the Leads page. Display-only: the underlying queued/sent email
   * records are untouched. Rolling list capped at 1000 ids.
   */
  async hideLead(userId, leadId) {
    try {
      const settings = await this.getUserSettings(userId) || {};
      const hidden = (settings.hiddenLeadIds || []).filter(id => id !== leadId);
      hidden.unshift(leadId);
      await this.saveUserSettings(userId, { ...settings, hiddenLeadIds: hidden.slice(0, 1000) });
    } catch (err) {
      console.error('[HIDDEN LEADS] Error hiding lead:', err.message);
    }
  }

  async getHiddenLeadIds(userId) {
    try {
      const settings = await this.getUserSettings(userId);
      return settings?.hiddenLeadIds || [];
    } catch {
      return [];
    }
  }

  /**
   * Store a timeline entry for a starred lead.
   * Uses the emailTracking table with PK USER#{userId}#TIMELINE#{leadId}
   */
  async logLeadTimelineEntry(userId, leadId, entry) {
    try {
      const timestamp = new Date().toISOString();
      const entryId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.emailTracking,
        Item: {
          PK: `USER#${userId}#TIMELINE#${leadId}`,
          SK: `ENTRY#${timestamp}#${entryId}`,
          userId,
          leadId,
          entryId,
          timestamp,
          ...entry,
        },
      }));
    } catch (err) {
      console.error('[LEAD TIMELINE] Error logging entry:', err.message);
    }
  }

  async getLeadTimeline(userId, leadId, limit = 50) {
    try {
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.emailTracking,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#TIMELINE#${leadId}`,
          ':prefix': 'ENTRY#',
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }));
      return result.Items || [];
    } catch (err) {
      console.error('[LEAD TIMELINE] Error fetching timeline:', err.message);
      return [];
    }
  }

  /**
   * Record a user's own IP address for distinguishing owner opens from lead opens.
   * Keeps a rolling deduplicated list (max 50) in userSettings.knownOwnerIps.
   */
  async recordOwnerIp(userId, ip) {
    try {
      if (!ip || ip === '::1' || ip === '127.0.0.1') return; // skip localhost
      const settings = await this.getUserSettings(userId);
      const existing = settings?.knownOwnerIps || [];
      // Deduplicate: update seenAt if IP already known, else prepend
      const withoutThis = existing.filter(e => e.ip !== ip);
      const updated = [{ ip, seenAt: new Date().toISOString() }, ...withoutThis].slice(0, 50);
      await this.saveUserSettings(userId, { ...settings, knownOwnerIps: updated });
    } catch (err) {
      // Non-fatal — never block a request for this
      console.error('[OWNER IP] Error recording owner IP:', err.message);
    }
  }

  // ==================
  // USER MANAGEMENT METHODS
  // ==================
  
  async getUserById(userId) {
    try {
      // Reduced verbosity - only log errors
      
      const command = new GetCommand({
        TableName: this.tables.users,
        Key: { userId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        // No user found - silent
        return null;
      }
      
      // Ensure user has a plan and proper credit limits
      const user = result.Item;
      if (!user.plan) {
        user.plan = 'free-trial';
      }
      
      const planConfig = this.plans[user.plan];
      if (planConfig) {
        const currentTrialLimit = Number(user.trialCreditsLimit ?? 0);
        if (this.isTrialBlockedUser(user)) {
          user.trialCreditsLimit = 0;
          user.maxCredits = 0;
        } else {
          user.trialCreditsLimit = Math.max(currentTrialLimit, planConfig.initialCredits);
          user.maxCredits = planConfig.maxCredits;
        }
        user.canPurchaseMore = planConfig.canPurchaseMore;
        user.maxAgents = planConfig.maxAgents || 1;
        user.maxConcurrency = planConfig.maxConcurrency || 1;
      }
      
      return user;
    } catch (error) {
      console.error('[AWS] Error getting user by ID:', error);
      throw error;
    }
  }
  
  async getUserByUsername(username) {
    try {
      console.log('[AWS] Getting user by username:', username);
      
      const command = new ScanCommand({
        TableName: this.tables.users,
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': username
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        console.log('[AWS] No user found with username:', username);
        return null;
      }
      
      console.log('[AWS] User retrieved by username successfully');
      return result.Items[0];
    } catch (error) {
      console.error('[AWS] Error getting user by username:', error);
      throw error;
    }
  }
  
  async getUserByEmail(email) {
    try {
      console.log('[AWS] Getting user by email:', email);
      
      // Make email search case-insensitive by searching both formats
      const command = new ScanCommand({
        TableName: this.tables.users,
        FilterExpression: 'email = :email OR email = :emailUpper OR email = :emailLower',
        ExpressionAttributeValues: {
          ':email': email,
          ':emailUpper': email.toUpperCase(),
          ':emailLower': email.toLowerCase()
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        console.log('[AWS] No user found with email:', email);
        return null;
      }
      
      console.log('[AWS] User retrieved by email successfully');
      return result.Items[0];
    } catch (error) {
      console.error('[AWS] Error getting user by email:', error);
      throw error;
    }
  }

  async findTrialFingerprintMatch(signupIpHash = null, signupDeviceHash = null) {
    try {
      const clauses = [];
      const expressionAttributeValues = {
        ':true': true,
        ':zero': 0
      };

      if (signupIpHash) {
        clauses.push('signupIpHash = :signupIpHash');
        expressionAttributeValues[':signupIpHash'] = signupIpHash;
      }

      if (signupDeviceHash) {
        clauses.push('signupDeviceHash = :signupDeviceHash');
        expressionAttributeValues[':signupDeviceHash'] = signupDeviceHash;
      }

      if (clauses.length === 0) {
        return null;
      }

      const command = new ScanCommand({
        TableName: this.tables.users,
        FilterExpression: '((trialGranted = :true) OR trialCreditsLimit > :zero) AND (' + clauses.join(' OR ') + ')',
        ExpressionAttributeValues: expressionAttributeValues
      });

      const result = await this.dynamodb.send(command);
      return result.Items?.[0] || null;
    } catch (error) {
      console.error('[AWS] Error finding trial fingerprint match:', error);
      throw error;
    }
  }
  
  async getAllUsers() {
    try {
      console.log('[AWS] Getting all users from database');
      const params = {
        TableName: this.tables.users
      };
      
      const result = await this.dynamodb.send(new ScanCommand(params));
      // Retrieved users - silent
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error getting all users:', error);
      throw error;
    }
  }

  async getAllUsersWithGmail() {
    try {
      console.log('[AWS] Getting all users with Gmail configured');
      
      // Scan user settings table for users with Gmail auth
      const params = {
        TableName: this.tables.userSettings,
        FilterExpression: 'attribute_exists(gmailAuth.refreshToken)'
      };
      
      const result = await this.dynamodb.send(new ScanCommand(params));
      const users = result.Items || [];
      
      console.log(`[AWS] Found ${users.length} user(s) with Gmail configured`);
      return users;
    } catch (error) {
      console.error('[AWS] Error getting users with Gmail:', error);
      throw error;
    }
  }

  // =====================
  // GMAIL WATCH METHODS
  // =====================

  async getGmailLastHistoryId(userId) {
    try {
      const settings = await this.getUserSettings(userId);
      return settings?.gmailWatch?.historyId || null;
    } catch (error) {
      console.error('[AWS] Error getting Gmail history ID:', error);
      return null;
    }
  }

  async saveGmailLastHistoryId(userId, historyId) {
    try {
      const settings = await this.getUserSettings(userId) || {};
      await this.saveUserSettings(userId, {
        ...settings,
        gmailWatch: {
          ...settings.gmailWatch,
          historyId: historyId,
          lastUpdated: new Date().toISOString()
        }
      });
      return true;
    } catch (error) {
      console.error('[AWS] Error saving Gmail history ID:', error);
      throw error;
    }
  }

  async getConversationReplyCount(userId, agentId, trackingId) {
    try {
      const tracking = await this.getEmailTracking(userId, agentId, trackingId);
      return tracking?.replyCount || 0;
    } catch (error) {
      console.error('[AWS] Error getting reply count:', error);
      return 0;
    }
  }

  async incrementConversationReplyCount(userId, agentId, trackingId) {
    try {
      const command = new UpdateCommand({
        TableName: this.tables.emailTracking,
        Key: {
          trackingId: `${userId}#${agentId}#${trackingId}`,
          timestamp: 'METADATA'
        },
        UpdateExpression: 'ADD replyCount :inc',
        ExpressionAttributeValues: {
          ':inc': 1
        }
      });
      await this.dynamodb.send(command);
      return true;
    } catch (error) {
      console.error('[AWS] Error incrementing reply count:', error);
      return false;
    }
  }

  async markAsUnsubscribed(userId, agentId, email) {
    try {
      const command = new PutCommand({
        TableName: this.tables.unsubscribes,
        Item: {
          email: email.toLowerCase(),
          userId: userId,
          agentId: agentId,
          unsubscribedAt: new Date().toISOString(),
          reason: 'user_request'
        }
      });
      await this.dynamodb.send(command);
      console.log(`[AWS] Marked ${email} as unsubscribed`);
      return true;
    } catch (error) {
      console.error('[AWS] Error marking as unsubscribed:', error);
      throw error;
    }
  }
  
  async createUser(userData) {
    try {
      console.log('[AWS] Creating new user:', userData.username);
      
      const command = new PutCommand({
        TableName: this.tables.users,
        Item: {
          userId: userData.userId,
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          createdAt: new Date().toISOString(),
          lastLogin: null,
          lastPasswordReset: null,
          activeAgents: [], // Initialize empty agents array
          ...userData
        },
        ConditionExpression: 'attribute_not_exists(userId)' // Prevent overwrites
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] User created successfully');
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User already exists');
      }
      console.error('[AWS] Error creating user:', error);
      throw error;
    }
  }
  
  async updateUser(userId, updates) {
    try {
      // Build update expression and attribute values
      const updateExpressions = [];
      const expressionAttributeValues = {};
      const expressionAttributeNames = {};
      
      // Always update the updatedAt field
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      
      // Add the provided updates
      Object.entries(updates).forEach(([key, value], index) => {
        const valueKey = `:val${index}`;
        const nameKey = `#${key}`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeValues[valueKey] = value;
        expressionAttributeNames[nameKey] = key;
      });
      
      const params = {
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await this.dynamodb.send(new UpdateCommand(params));
      
      return result.Attributes;
    } catch (error) {
      console.error('[AWS] Error updating user:', error);
      throw error;
    }
  }
  
  async addAgentToUser(userId, agentData) {
    try {
      console.log('[AWS] Adding agent to user:', userId, agentData.agentId);

      const user = await this.getUserById(userId);
      const activeAgents = user?.activeAgents || [];
      const { maxAgents } = this.getPlanLimits(user?.plan || 'free-trial');

      if (activeAgents.length >= maxAgents) {
        throw new Error(`Agent limit reached. Your current plan allows up to ${maxAgents} agent${maxAgents !== 1 ? 's' : ''}.`);
      }
      
      const command = new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: 'SET activeAgents = list_append(if_not_exists(activeAgents, :empty_list), :new_agent), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':new_agent': [agentData],
          ':empty_list': [],
          ':updatedAt': new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Agent added to user successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error adding agent to user:', error);
      throw error;
    }
  }
  
  async getUserByResetToken(resetToken) {
    try {
      console.log('[AWS] Getting user by reset token:', resetToken);
      let lastEvaluatedKey = undefined;
      do {
        const command = new ScanCommand({
          TableName: this.tables.users,
          FilterExpression: '#rt = :resetToken',
          ExpressionAttributeNames: { '#rt': 'resetToken' },
          ExpressionAttributeValues: { ':resetToken': resetToken },
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        });
        const result = await this.dynamodb.send(command);
        if (result.Items && result.Items.length > 0) {
          console.log('[AWS] User retrieved by reset token successfully');
          return result.Items[0];
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
      console.log('[AWS] No user found with reset token');
      return null;
    } catch (error) {
      console.error('[AWS] Error getting user by reset token:', error);
      throw error;
    }
  }
  
  async removeAgentFromUser(userId, agentId) {
    try {
      console.log('[AWS] Removing agent from user:', userId, agentId);
      
      // First get the user to find the agent index
      const user = await this.getUserById(userId);
      if (!user || !user.activeAgents) {
        throw new Error('User not found or has no agents');
      }
      
      const agentIndex = user.activeAgents.findIndex(agent => agent.agentId === agentId);
      if (agentIndex === -1) {
        throw new Error('Agent not found in user\'s active agents');
      }
      
      const command = new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: `REMOVE activeAgents[${agentIndex}] SET updatedAt = :updatedAt`,
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Agent removed from user successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error removing agent from user:', error);
      throw error;
    }
  }
  
  // =======================
  // AGENT MANAGEMENT METHODS  
  // =======================
  
  generateAgentId() {
    // Generate 6-digit agent ID (100000-999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  async createDefaultAgent(userId, agentName = 'Lead Agent') {
    try {
      console.log('[AWS] Creating default agent for user:', userId);
      
      const agentId = this.generateAgentId();
      
      // Ensure unique agent ID by checking existing agents
      const user = await this.getUserById(userId);
      if (user && user.activeAgents) {
        const existingIds = user.activeAgents.map(agent => agent.agentId);
        let attempts = 0;
        let newAgentId = agentId;
        
        while (existingIds.includes(newAgentId) && attempts < 10) {
          newAgentId = this.generateAgentId();
          attempts++;
        }
        
        if (attempts >= 10) {
          throw new Error('Failed to generate unique agent ID after 10 attempts');
        }
      }
      
      const agentData = {
        agentId: agentId,
        name: agentName,
        type: 'reasoning-lead-agent',
        status: 'idle',
        createdAt: new Date().toISOString(),
        lastRun: null,
        settings: {
          enabled: true,
          intervalMinutes: 30,
          maxLeadsPerCycle: 5
        }
      };
      
      await this.addAgentToUser(userId, agentData);
      
      console.log(`[AWS] Default agent created: ${agentId} for user ${userId}`);
      return agentData;
      
    } catch (error) {
      console.error('[AWS] Error creating default agent:', error);
      throw error;
    }
  }
  
  async createAgent(userId, agentName, agentType = 'reasoning-lead-agent') {
    try {
      console.log('[AWS] Creating new agent for user:', userId);
      
      const agentId = this.generateAgentId();
      
      // Ensure unique agent ID
      const user = await this.getUserById(userId);
      if (user && user.activeAgents) {
        const existingIds = user.activeAgents.map(agent => agent.agentId);
        let attempts = 0;
        let newAgentId = agentId;
        
        while (existingIds.includes(newAgentId) && attempts < 10) {
          newAgentId = this.generateAgentId();
          attempts++;
        }
        
        if (attempts >= 10) {
          throw new Error('Failed to generate unique agent ID after 10 attempts');
        }
      }
      
      const agentData = {
        agentId: agentId,
        name: agentName,
        type: agentType,
        status: 'idle',
        createdAt: new Date().toISOString(),
        lastRun: null,
        settings: {
          enabled: true,
          intervalMinutes: 30,
          maxLeadsPerCycle: 5
        }
      };
      
      await this.addAgentToUser(userId, agentData);
      
      console.log(`[AWS] Agent created: ${agentId} (${agentName}) for user ${userId}`);
      return agentData;
      
    } catch (error) {
      console.error('[AWS] Error creating agent:', error);
      throw error;
    }
  }
  
  async getUserAgents(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user || !user.activeAgents) {
        return [];
      }
      return user.activeAgents;
    } catch (error) {
      console.error('[AWS] Error getting user agents:', error);
      throw error;
    }
  }
  
  async updateAgentStatus(userId, agentId, status) {
    try {
      console.log('[AWS] Updating agent status:', userId, agentId, status);
      
      const user = await this.getUserById(userId);
      if (!user || !user.activeAgents) {
        throw new Error('User not found or has no agents');
      }
      
      const agentIndex = user.activeAgents.findIndex(agent => agent.agentId === agentId);
      if (agentIndex === -1) {
        throw new Error('Agent not found');
      }
      
      // Update the agent status
      user.activeAgents[agentIndex].status = status;
      user.activeAgents[agentIndex].updatedAt = new Date().toISOString();
      
      // Save back to AWS
      await this.updateUser(userId, {
        activeAgents: user.activeAgents
      });
      
      console.log('[AWS] Agent status updated successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error updating agent status:', error);
      throw error;
    }
  }

  // =======================
  // AGENT SETTINGS METHODS
  // =======================
  
  async getLeadAgentSettings(userId, agentId = 'lead-agent') {
    try {
      // Reduced verbosity - only log errors
      
      // Ensure agentId is string for consistency with save
      const agentIdToUse = String(agentId);
      
      const command = new GetCommand({
        TableName: this.tables.agentSettings,
        Key: { 
          userId,
          agentId: agentIdToUse
        }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        // Only log when no settings found (reduced verbosity)
        console.log('[AWS] No lead agent settings found for userId:', userId, 'agentId:', agentId);
        return null;
      }
      
      // Settings retrieved successfully (log removed for cleaner output)
      return result.Item.settings;
    } catch (error) {
      console.error('[AWS] Error getting lead agent settings:', error);
      throw error;
    }
  }
  
  async saveLeadAgentSettings(userId, agentId, settings) {
    try {
      console.log('[AWS] Saving lead agent settings for userId:', userId, 'agentId:', agentId);
      console.log('[AWS] EmailBuilder being saved:', JSON.stringify(settings.emailBuilder, null, 2));
      
      // Ensure agentId is included in the settings and convert to string for consistency
      const agentIdToUse = String(agentId || settings.agentId || 'lead-agent');
      const user = await this.getUserById(userId).catch(() => null);
      const { maxConcurrency } = this.getPlanLimits(user?.plan || 'free-trial');
      const normalizedConcurrency = Number.isFinite(Number(settings.concurrencyLevel))
        ? Math.min(maxConcurrency, Math.max(1, Math.floor(Number(settings.concurrencyLevel))))
        : undefined;
      const normalizedSettings = normalizedConcurrency === undefined
        ? settings
        : { ...settings, concurrencyLevel: normalizedConcurrency };
      
      const command = new PutCommand({
        TableName: this.tables.agentSettings,
        Item: {
          userId,
          agentId: agentIdToUse,
          settingsType: 'lead-agent',
          settings: {
            ...normalizedSettings,
            updatedAt: new Date().toISOString(),
            version: normalizedSettings.version || '2.0'
          }
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Lead agent settings saved successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error saving lead agent settings:', error);
      throw error;
    }
  }
  
  async deleteAgentSettings(userId, agentId) {
    try {
      console.log('[AWS] Deleting agent settings for userId:', userId, 'agentId:', agentId);
      
      const command = new DeleteCommand({
        TableName: this.tables.agentSettings,
        Key: { 
          userId,
          agentId: String(agentId)
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Agent settings deleted successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error deleting agent settings:', error);
      throw error;
    }
  }

  // Aliases for simpler method names
  async getAgentSettings(userId, agentId) {
    return this.getLeadAgentSettings(userId, agentId);
  }

  async saveAgentSettings(settings) {
    return this.saveLeadAgentSettings(settings.userId, settings.agentId, settings);
  }

  // ==================
  // LEAD DATA METHODS
  // ==================
  
  async saveLeadData(userId, leadData) {
    try {
      console.log('[AWS] Saving lead data for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.leadData,
        Item: {
          userId,
          leadId: leadData.id || `lead_${Date.now()}`,
          ...leadData,
          createdAt: new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Lead data saved successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error saving lead data:', error);
      throw error;
    }
  }
  
  async getLeadHistory(userId, limit = 50) {
    try {
      console.log('[AWS] Getting lead history for userId:', userId);
      
      const command = new QueryCommand({
        TableName: this.tables.leadData,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });
      
      const result = await this.dynamodb.send(command);
      
      console.log(`[AWS] Retrieved ${result.Items?.length || 0} lead records`);
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error getting lead history:', error);
      throw error;
    }
  }

  // ======================
  // EMAIL TRACKING METHODS
  // ======================
  
  async trackEmailSent(userId, emailData) {
    try {
      console.log('[AWS] Tracking email sent for userId:', userId);
      
      const command = new PutCommand({
        TableName: this.tables.emailTracking,
        Item: {
          userId,
          emailId: emailData.emailId || `email_${Date.now()}`,
          ...emailData,
          status: 'sent',
          sentAt: new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Email tracking saved successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error tracking email:', error);
      throw error;
    }
  }
  
  async updateEmailStatus(userId, emailId, status, metadata = {}) {
    try {
      console.log('[AWS] Updating email status for emailId:', emailId, 'status:', status);
      
      const command = new UpdateCommand({
        TableName: this.tables.emailTracking,
        Key: { userId, emailId },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #metadata = :metadata',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
          '#metadata': 'metadata'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString(),
          ':metadata': metadata
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Email status updated successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error updating email status:', error);
      throw error;
    }
  }

  // ====================
  // AGENT STATE METHODS
  // ====================
  
  async saveAgentState(userId, agentId, state) {
    try {
      console.log('[AWS] Saving agent state for userId:', userId, 'agentId:', agentId);
      
      const command = new PutCommand({
        TableName: this.tables.agentState,
        Item: {
          userId,
          agentId,
          ...state,
          updatedAt: new Date().toISOString()
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Agent state saved successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error saving agent state:', error);
      throw error;
    }
  }
  
  async getAgentState(userId, agentId) {
    try {
      console.log('[AWS] Getting agent state for userId:', userId, 'agentId:', agentId);
      
      const command = new GetCommand({
        TableName: this.tables.agentState,
        Key: { userId, agentId }
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log('[AWS] No agent state found');
        return null;
      }
      
      console.log('[AWS] Agent state retrieved successfully');
      return result.Item;
    } catch (error) {
      console.error('[AWS] Error getting agent state:', error);
      throw error;
    }
  }

  async getAllAgentStates(userId) {
    try {
      console.log('[AWS] Getting all agent states for userId:', userId);
      
      // Use Scan with filter instead of Query since table structure may not support querying by userId alone
      const result = await this.dynamodb.send(new ScanCommand({
        TableName: this.tables.agentState,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }));
      
      console.log(`[AWS] Retrieved ${result.Items?.length || 0} agent states`);
      return { success: true, states: result.Items || [] };
    } catch (error) {
      console.error('[AWS] Error getting all agent states:', error);
      return { success: false, error: error.message, states: [] };
    }
  }

  // ====================
  // CYCLE LOGS METHODS
  // ====================
  
  async saveCycleLog(userId, agentId, cycleData) {
    try {
      const timestamp = cycleData.timestamp || new Date().toISOString();
      const cycleId = `${timestamp}#cycle${cycleData.cycleNumber}`;
      
      console.log('[AWS] Saving cycle log for userId:', userId, 'agentId:', agentId, 'cycle:', cycleData.cycleNumber);
      
      const command = new PutCommand({
        TableName: this.tables.cycleLogs,
        Item: {
          userId,
          cycleId, // Sort key: timestamp#cycleNumber for time-series queries
          agentId,
          cycleNumber: cycleData.cycleNumber,
          completedAt: timestamp,
          leadsProcessed: cycleData.leadsProcessed || 0,
          emailsSent: cycleData.emailsSent || 0,
          stepsExecuted: cycleData.stepsExecuted || 0,
          success: cycleData.success !== false,
          ...cycleData
        }
      });
      
      await this.dynamodb.send(command);
      console.log('[AWS] Cycle log saved successfully');
      return true;
    } catch (error) {
      console.error('[AWS] Error saving cycle log:', error);
      throw error;
    }
  }
  
  async getCycleLogs(userId, agentId = null, limit = 100) {
    try {
      console.log('[AWS] Getting cycle logs for userId:', userId, agentId ? `agentId: ${agentId}` : '(all agents)');
      
      const params = {
        TableName: this.tables.cycleLogs,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Sort descending (newest first)
        Limit: limit
      };
      
      // Filter by agent if specified
      if (agentId) {
        params.FilterExpression = 'agentId = :agentId';
        params.ExpressionAttributeValues[':agentId'] = agentId;
      }
      
      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);
      
      console.log(`[AWS] Retrieved ${result.Items?.length || 0} cycle logs`);
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error getting cycle logs:', error);
      throw error;
    }
  }

  // =================
  // EMAIL SES METHODS
  // =================
  
  async sendEmail({ to, from, subject, htmlBody, textBody, userId = null }) {
    try {
      console.log('[AWS SES] Sending email to:', to);
      
      // If userId provided, try to fetch their custom domain settings
      let fromAddress = from;
      if (userId) {
        try {
          const userSettings = await this.getUserSettings(userId);
          if (userSettings?.emailSettings?.customDomain && 
              userSettings?.emailSettings?.domainVerified && 
              userSettings?.emailSettings?.fromEmail) {
            // Use custom domain if verified
            fromAddress = userSettings.emailSettings.fromEmail;
            console.log(`[AWS SES] Using custom domain email: ${fromAddress}`);
          }
        } catch (err) {
          console.log('[AWS SES] Could not fetch custom domain, using default:', err.message);
        }
      }
      
      const command = new SendEmailCommand({
        Source: fromAddress,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
              Charset: 'UTF-8'
            }
          }
        }
      });
      
      const result = await this.ses.send(command);
      
      console.log('[AWS SES] Email sent successfully. MessageId:', result.MessageId);
      return {
        success: true,
        messageId: result.MessageId
      };
    } catch (error) {
      console.error('[AWS SES] Error sending email:', error);
      throw error;
    }
  }

  // Verify domain with AWS SES
  async verifyDomainWithSES(domain) {
    try {
      console.log(`[AWS SES] Verifying domain: ${domain}`);
      
      const command = new VerifyDomainIdentityCommand({
        Domain: domain
      });
      
      const result = await this.ses.send(command);
      
      console.log('[AWS SES] Domain verification initiated. Verification token:', result.VerificationToken);
      
      return {
        success: true,
        verificationToken: result.VerificationToken,
        instructions: {
          recordType: 'TXT',
          recordName: `_amazonses.${domain}`,
          recordValue: result.VerificationToken,
          message: 'Add this TXT record to your DNS to complete verification'
        }
      };
    } catch (error) {
      console.error('[AWS SES] Error verifying domain:', error);
      throw error;
    }
  }

  // Check domain verification status
  async checkDomainVerificationStatus(domain) {
    try {
      console.log(`[AWS SES] Checking verification status for: ${domain}`);
      
      const command = new GetIdentityVerificationAttributesCommand({
        Identities: [domain]
      });
      
      const result = await this.ses.send(command);
      const attributes = result.VerificationAttributes[domain];
      
      if (!attributes) {
        return {
          verified: false,
          status: 'NotStarted',
          message: 'Domain verification has not been initiated'
        };
      }
      
      return {
        verified: attributes.VerificationStatus === 'Success',
        status: attributes.VerificationStatus,
        verificationToken: attributes.VerificationToken,
        message: attributes.VerificationStatus === 'Success' 
          ? 'Domain is verified and ready to send emails'
          : attributes.VerificationStatus === 'Pending'
          ? 'Verification pending - check your DNS records'
          : 'Verification failed - please check your DNS records'
      };
    } catch (error) {
      console.error('[AWS SES] Error checking domain status:', error);
      throw error;
    }
  }

  // =================
  // UTILITY METHODS
  // =================
  
  async healthCheck() {
    try {
      console.log('[AWS] Running health check...');
      
      // Test DynamoDB connection
      const testCommand = new QueryCommand({
        TableName: this.tables.userSettings,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': 'health-check-test'
        },
        Limit: 1
      });
      
      await this.dynamodb.send(testCommand);
      
      console.log('[AWS] Health check passed');
      return {
        status: 'healthy',
        region: this.region,
        tables: this.tables,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AWS] Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ===================================
  // CONTACTED LEADS DEDUPLICATION METHODS
  // ===================================

  /**
   * Add a contacted lead to the deduplication database
   * @param {string} userId - User ID who contacted the lead
   * @param {object} leadInfo - Lead information
   * @param {string} leadInfo.name - Lead's full name
   * @param {string} leadInfo.email - Lead's email address
   * @param {string} leadInfo.company - Lead's company name
   * @param {string} leadInfo.title - Lead's job title (optional)
   */
  async addContactedLead(userId, leadInfo, searchCombo = null) {
    try {
      console.log('[AWS] Adding contacted lead:', leadInfo.name, 'at', leadInfo.company);

      // Scoped to the keyword+position combo that found this lead — mirrors the key
      // built in checkForDuplicateContacts so the same lead can still be found again
      // under a different search combo/campaign. Falls back to the unscoped key when
      // no combo is given (e.g. CRM-sourced contacts, which aren't keyword-driven).
      const comboSuffix = searchCombo?.keyword && searchCombo?.position
        ? `_${searchCombo.keyword.toLowerCase().replace(/\s+/g, '_')}_${searchCombo.position.toLowerCase().replace(/\s+/g, '_')}`
        : '';
      const contactId = `${userId}_${leadInfo.name.toLowerCase().replace(/\s+/g, '_')}_${leadInfo.company.toLowerCase().replace(/\s+/g, '_')}${comboSuffix}`;

      const contactData = {
        contactKey: contactId, // Use contactKey as the primary key (includes userId)
        userId: userId,
        name: leadInfo.name,
        email: leadInfo.email.toLowerCase(),
        company: leadInfo.company,
        title: leadInfo.title || 'Unknown',
        searchKeyword: searchCombo?.keyword || null,
        searchPosition: searchCombo?.position || null,
        contactedAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // Expire after 1 year
      };

      const command = new PutCommand({
        TableName: this.tables.contactedLeads,
        Item: contactData,
        ConditionExpression: 'attribute_not_exists(contactKey)' // Prevent overwriting existing contacts
      });

      await this.dynamodb.send(command);
      
      console.log('[AWS] Successfully added contacted lead:', contactId);
      return { success: true, contactId };

    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log('[AWS] Lead already exists in contacted database:', leadInfo.email);
        return { success: false, reason: 'already_contacted', contactId: null };
      }
      
      console.error('[AWS] Failed to add contacted lead:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a contacted lead from the deduplication database
   * @param {string} userId - User ID who contacted the lead
   * @param {string} contactId - Contact ID to remove
   */
  async removeContactedLead(userId, contactId) {
    try {
      console.log('[AWS] Removing contacted lead:', contactId);

      const command = new DeleteCommand({
        TableName: this.tables.contactedLeads,
        Key: {
          contactKey: contactId  // Use contactKey as the primary key (single key, not composite)
        }
      });

      await this.dynamodb.send(command);
      
      console.log('[AWS] Successfully removed contacted lead:', contactId);
      return { success: true };

    } catch (error) {
      console.error('[AWS] Failed to remove contacted lead:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if leads have already been contacted OR unsubscribed
   * @param {string} userId - User ID to check contacts for
   * @param {array} leads - Array of lead objects to check
   * @param {object} [searchCombo] - { keyword, position } the search was run under.
   *   The "already contacted" check is scoped to this combo (see addContactedLead) —
   *   a person contacted via one keyword/position pairing can still surface for a
   *   different campaign/search searching different terms, just not be re-matched
   *   under the exact combo that already found them. Unsubscribe checks below are
   *   NOT scoped — those stay permanent and account-wide regardless of search terms.
   * @returns {object} - Object with newLeads, duplicateLeads, and unsubscribedLeads arrays
   */
  async checkForDuplicateContacts(userId, leads, searchCombo = null) {
    try {
      console.log('[AWS] Checking', leads.length, 'leads for duplicates and unsubscribes...');

      const newLeads = [];
      const duplicateLeads = [];
      const unsubscribedLeads = [];

      // Check each lead individually
      for (const lead of leads) {
        // Apollo returns organization.name, normalize to company field
        const companyName = lead.company || lead.organization?.name;
        const leadEmail = lead.email || lead.email_address;
        
        if (!lead.name || !companyName) {
          console.log('[AWS] Skipping lead with missing data:', lead.name || 'MISSING', '| Company:', companyName || 'MISSING');
          continue;
        }

        // STEP 1: Check if email is unsubscribed (blocks across ALL agents for this user)
        if (leadEmail) {
          const normalizedEmail = leadEmail.toLowerCase().trim();
          
          try {
            const unsubResult = await this.dynamodb.send(new QueryCommand({
              TableName: this.tables.unsubscribes,
              KeyConditionExpression: 'PK = :pk',
              ExpressionAttributeValues: {
                ':pk': `UNSUBSCRIBE#${normalizedEmail}`
              },
              Limit: 1
            }));
            
            if (unsubResult.Items && unsubResult.Items.length > 0) {
              console.log('[UNSUBSCRIBED]:', lead.name, '(', leadEmail, ') - BLOCKED');
              unsubscribedLeads.push({
                ...lead,
                unsubscribedAt: unsubResult.Items[0].unsubscribedAt,
                reason: unsubResult.Items[0].reason || 'unsubscribed'
              });
              continue; // Skip to next lead
            }
          } catch (unsubError) {
            console.error('[AWS] Error checking unsubscribe:', leadEmail, unsubError.message);
            // Continue to duplicate check if unsubscribe check fails
          }
        }

        // STEP 2: Check if already contacted under this same search combo (keyword+position).
        // Scoped per combo so a contacted lead can still surface under a different
        // campaign/search, just not get re-matched by the exact terms that already found
        // them. Falls back to the unscoped key when no combo is given (e.g. manual adds).
        const comboSuffix = searchCombo?.keyword && searchCombo?.position
          ? `_${searchCombo.keyword.toLowerCase().replace(/\s+/g, '_')}_${searchCombo.position.toLowerCase().replace(/\s+/g, '_')}`
          : '';
        const contactId = `${userId}_${lead.name.toLowerCase().replace(/\s+/g, '_')}_${companyName.toLowerCase().replace(/\s+/g, '_')}${comboSuffix}`;

        const command = new GetCommand({
          TableName: this.tables.contactedLeads,
          Key: { 
            contactKey: contactId  // Use contactKey as the primary key (includes userId)
          }
        });

        try {
          const result = await this.dynamodb.send(command);
          
          if (result.Item) {
            console.log('[AWS] Duplicate found:', lead.name, 'at', companyName, '(contacted:', result.Item.contactedAt, ')');
            duplicateLeads.push({
              ...lead,
              contactedAt: result.Item.contactedAt,
              reason: 'previously_contacted'
            });
          } else {
            console.log('[AWS] New lead:', lead.name, 'at', companyName);
            newLeads.push(lead);
          }
        } catch (getError) {
          console.error('[AWS] Error checking lead:', contactId, getError.message);
          // If there's an error checking, assume it's a new lead to be safe
          newLeads.push(lead);
        }
      }

      console.log(`[AWS] Deduplication results: ${newLeads.length} new leads, ${duplicateLeads.length} duplicates, ${unsubscribedLeads.length} unsubscribed`);
      
      return {
        success: true,
        newLeads,
        duplicateLeads,
        unsubscribedLeads,
        summary: {
          totalChecked: leads.length,
          newCount: newLeads.length,
          duplicateCount: duplicateLeads.length,
          unsubscribedCount: unsubscribedLeads.length
        }
      };

    } catch (error) {
      console.error('[AWS] Failed to check for duplicate contacts:', error);
      return {
        success: false,
        error: error.message,
        newLeads: leads, // Return all leads as "new" if check fails
        duplicateLeads: [],
        unsubscribedLeads: []
      };
    }
  }

  /**
   * Get contacted leads history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of records to return (optional)
   */
  async getContactedLeadsHistory(userId, limit = 100) {
    try {
      console.log('[AWS] Getting contacted leads history for user:', userId);

      const command = new QueryCommand({
        TableName: this.tables.contactedLeads,
        IndexName: 'UserIdIndex', // Assumes GSI on userId
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });

      const result = await this.dynamodb.send(command);
      
      console.log('[AWS] Retrieved', result.Items?.length || 0, 'contacted leads');
      return {
        success: true,
        contacts: result.Items || [],
        count: result.Items?.length || 0
      };

    } catch (error) {
      console.error('[AWS] Failed to get contacted leads history:', error);
      return {
        success: false,
        error: error.message,
        contacts: []
      };
    }
  }

  /**
   * Clear all contacted leads for a specific user (for testing purposes)
   * @param {string} userId - User ID whose contacts to clear
   */
  async clearContactedLeads(userId) {
    try {
      console.log('[AWS] Clearing all contacted leads for user:', userId);

      // First, get all contacts for this user
      const getCommand = new ScanCommand({
        TableName: this.tables.contactedLeads,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });

      const result = await this.dynamodb.send(getCommand);
      const contacts = result.Items || [];

      if (contacts.length === 0) {
        console.log('[AWS] No contacts found to clear for user:', userId);
        return {
          success: true,
          deletedCount: 0,
          message: 'No contacts found to clear'
        };
      }

      // Delete each contact individually
      let deletedCount = 0;
      const deletePromises = contacts.map(async (contact) => {
        try {
          const deleteCommand = new DeleteCommand({
            TableName: this.tables.contactedLeads,
            Key: {
              contactKey: contact.contactKey  // Use contactKey as the primary key
            }
          });

          await this.dynamodb.send(deleteCommand);
          deletedCount++;
          console.log(`[AWS] Deleted contact: ${contact.name} (${contact.email}) at ${contact.company}`);
        } catch (deleteError) {
          console.error('[AWS] Failed to delete contact:', contact.contactId, deleteError.message);
        }
      });

      await Promise.all(deletePromises);

      console.log(`[AWS] Successfully cleared ${deletedCount} contacted leads for user: ${userId}`);
      return {
        success: true,
        deletedCount: deletedCount,
        totalFound: contacts.length,
        message: `Cleared ${deletedCount} out of ${contacts.length} contacts`
      };

    } catch (error) {
      console.error('[AWS] Failed to clear contacted leads:', error);
      return {
        success: false,
        error: error.message,
        deletedCount: 0
      };
    }
  }

  // =====================
  // API USAGE TRACKING METHODS
  // =====================

  /**
   * Log API usage (Apollo, OpenAI, Mailgun, etc.)
   */
  async logApiUsage({ userId, agentId, service, operation, usage, cost = null, metadata = {} }) {
    try {
      const timestamp = new Date().toISOString();
      
      // Calculate cost if not provided
      if (cost === null) {
        // Use model-specific rate for OpenAI (gpt-4o-mini is ~12x cheaper than gpt-4o)
        if (service === 'openai' && metadata?.model?.includes('mini')) {
          cost = usage * this.apiCosts.openaiMini;
        } else if (service === 'anthropic') {
          const promptTokens = metadata?.prompt_tokens || 0;
          const completionTokens = metadata?.completion_tokens || 0;
          const isHaiku = (metadata?.model || '').includes('haiku');

          if (promptTokens || completionTokens) {
            cost = isHaiku
              ? (promptTokens * this.apiCosts.haikuInput) + (completionTokens * this.apiCosts.haikuOutput)
              : (promptTokens * this.apiCosts.anthropicInput) + (completionTokens * this.apiCosts.anthropicOutput);
          } else {
            cost = usage * this.apiCosts.anthropic;
          }
        } else if (this.apiCosts[service]) {
          cost = usage * this.apiCosts[service];
        }
      }
      
      // Filter out undefined values from metadata to avoid DynamoDB errors
      const cleanMetadata = Object.fromEntries(
        Object.entries(metadata).filter(([_, value]) => value !== undefined)
      );
      
      const item = {
        userId,
        timestamp,
        agentId,
        service, // 'apollo', 'openai', 'anthropic', 'mailgun', 'zerobounce'
        operation, // e.g., 'search', 'completion', 'send_email', 'email_validation'
        usage, // credits/tokens/emails used
        cost: cost || 0, // Cost in dollars
        metadata: cleanMetadata, // Additional data (model name, search query, etc.) - cleaned of undefined
        createdAt: timestamp
      };
      
      const command = new PutCommand({
        TableName: this.tables.apiUsage,
        Item: item
      });

      const writeResult = await this.dynamodb.send(command);
      
      // DEDUCT CREDITS based on real API costs (1 credit = $0.05)
      try {
        const user = await this.getUserById(userId);
        if (user && cost > 0) {
          const creditsToDeduct = cost / 0.10; // 1 credit = $0.10
          
          // Use creditBalance if available (new system), otherwise use trialCredits (legacy)
          if (user.creditBalance !== undefined) {
            // New credit balance system
            const currentBalance = user.creditBalance || 0;
            const newBalance = Math.max(0, currentBalance - creditsToDeduct);
            
            await this.updateUser(userId, {
              creditBalance: newBalance
            });
            
            console.log(`[CREDITS] Deducted ${creditsToDeduct.toFixed(3)} credits for $${cost.toFixed(4)} ${service} usage`);
            console.log(`[CREDITS] User balance: ${newBalance.toFixed(2)} credits (${user.plan || 'no-plan'} plan)`);
            
            // Warn when getting low
            if (newBalance <= 100 && currentBalance > 100) {
              console.log(`[CREDITS] Warning: User ${userId} has only ${newBalance.toFixed(2)} credits remaining`);
            }

            // Fire-and-forget: charge the saved card if auto top-up is enabled and armed
            import('./autoTopupService.js')
              .then(({ maybeAutoTopup }) => maybeAutoTopup(this, userId, newBalance))
              .catch(err => console.error('[AUTO-TOPUP] Failed to load service:', err.message));
          } else {
            // Legacy trial credits system
            const currentCreditsUsed = user.trialCreditsUsed ?? 0;
            const newCreditsUsed = currentCreditsUsed + creditsToDeduct;
            const creditsLimit = user.trialCreditsLimit ?? this.plans[user.plan || 'free-trial'].initialCredits;

            await this.updateUser(userId, {
              trialCreditsUsed: newCreditsUsed
            });
            
            console.log(`[CREDITS] Deducted ${creditsToDeduct.toFixed(3)} credits for $${cost.toFixed(4)} ${service} usage`);
            console.log(`[CREDITS] User now at ${newCreditsUsed.toFixed(2)} / ${creditsLimit} credits (${user.plan || 'free-trial'} plan)`);
            
            const percentageUsed = (newCreditsUsed / creditsLimit) * 100;
          
            // 90% critical threshold
            if (currentCreditsUsed < (creditsLimit * 0.9) && newCreditsUsed >= (creditsLimit * 0.9)) {
              await this.addIssue(
                userId,
                'billing',
                'Trial Credits Almost Exhausted',
                `You've used $${newCreditsUsed.toFixed(2)} of your $${creditsLimit} trial credits (${percentageUsed.toFixed(1)}%). Service will be suspended when credits are depleted.`,
                {
                  severity: 'critical',
                  creditsUsed: newCreditsUsed,
                  creditsLimit: creditsLimit,
                  percentageUsed: percentageUsed.toFixed(1)
                }
              );
            }
            
            // 100% limit reached
            if (currentCreditsUsed < creditsLimit && newCreditsUsed >= creditsLimit) {
              await this.addIssue(
                userId,
                'billing',
                'Trial Credits Exhausted',
                `You've used all $${creditsLimit} of your trial credits. Add a payment method immediately to restore service.`,
                {
                  severity: 'critical',
                  creditsUsed: newCreditsUsed,
                  creditsLimit: creditsLimit,
                  percentageUsed: 100
                }
              );
            }

            // Fire-and-forget: charge the saved card if auto top-up is enabled and armed
            import('./autoTopupService.js')
              .then(({ maybeAutoTopup }) => maybeAutoTopup(this, userId, creditsLimit - newCreditsUsed))
              .catch(err => console.error('[AUTO-TOPUP] Failed to load service:', err.message));
          }
        }
      } catch (creditError) {
        console.error('[CREDITS] Failed to deduct trial credits:', creditError);
      }
      
      // Update summary table asynchronously (don't wait)
      this.updateApiUsageSummary(userId, service, usage, cost || 0).catch(err => {
        console.error('[AWS] Failed to update summary:', err.message);
      });
      
      return { success: true };
    } catch (error) {
      console.error('[AWS] Failed to log API usage:', error);
      console.error('[AWS] Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }
  }

  /**
   * Refund credits to a user for a disqualified or rejected lead
   * costInDollars: the raw dollar amount to convert back to credits
   */
  async refundCredits(userId, costInDollars, { leadName, leadCompany, reason = 'disqualified', agentId } = {}) {
    try {
      if (!costInDollars || costInDollars <= 0) return { success: false, reason: 'no_cost' };

      const creditsToRefund = (costInDollars / 0.05) * 0.9; // 90% partial refund
      const user = await this.getUserById(userId);
      if (!user) return { success: false, reason: 'user_not_found' };

      if (user.creditBalance !== undefined) {
        await this.updateUser(userId, { creditBalance: (user.creditBalance || 0) + creditsToRefund });
      } else {
        const newUsed = Math.max(0, (user.trialCreditsUsed || 0) - creditsToRefund);
        await this.updateUser(userId, { trialCreditsUsed: newUsed });
      }

      console.log(`[REFUND] +${creditsToRefund.toFixed(2)} credits → ${leadName || 'lead'} at ${leadCompany || 'company'} (${reason})`);

      const label = reason === 'rejected' ? 'rejected from queue' : 'disqualified';
      const title = `+${creditsToRefund.toFixed(1)} credits refunded`;
      const message = leadName && leadCompany
        ? `${leadName} at ${leadCompany} was ${label} — research and qualification costs returned.`
        : `Lead ${label} — costs returned.`;

      await this.addIssue(userId, 'agent', title, message, {
        severity: 'low',
        agentId,
        creditsRefunded: parseFloat(creditsToRefund.toFixed(2)),
        costRefunded: parseFloat(costInDollars.toFixed(4)),
        leadName,
        leadCompany,
        reason
      });

      return { success: true, creditsRefunded: creditsToRefund };
    } catch (err) {
      console.error('[REFUND] Failed to refund credits:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update API usage summary table (aggregated totals per user)
   */
  async updateApiUsageSummary(userId, service, usage, cost) {
    try {
      // Get current month in YYYY-MM format
      const month = new Date().toISOString().slice(0, 7);
      
      // First, try to get existing record
      const getCommand = new GetCommand({
        TableName: this.tables.apiUsageSummary,
        Key: { userId, month }
      });
      
      const existing = await this.dynamodb.send(getCommand);
      
      // Build the service stats
      const serviceStats = existing.Item?.[service] || { usage: 0, calls: 0, cost: 0 };
      serviceStats.usage += usage;
      serviceStats.calls += 1;
      serviceStats.cost += cost;
      
      // Update with new values
      const putCommand = new PutCommand({
        TableName: this.tables.apiUsageSummary,
        Item: {
          ...existing.Item,
          userId,
          month,
          [service]: serviceStats,
          updatedAt: new Date().toISOString()
        }
      });

      await this.dynamodb.send(putCommand);
    } catch (error) {
      console.error(`[SUMMARY] Failed to update summary:`, error.message);
      throw error;
    }
  }

  /**
   * Get API usage from summary table (fast, no aggregation needed)
   */
  async getUserApiUsageSummary(userId) {
    try {
      // Query all months for this user and aggregate
      const command = new QueryCommand({
        TableName: this.tables.apiUsageSummary,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });

      const result = await this.dynamodb.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        // No summary yet, return empty stats
        return {
          success: true,
          stats: {
            apollo: { usage: 0, calls: 0, cost: 0 },
            openai: { usage: 0, calls: 0, cost: 0 },
            anthropic: { usage: 0, calls: 0, cost: 0 },
            mailgun: { usage: 0, calls: 0, cost: 0 },
            zerobounce: { usage: 0, calls: 0, cost: 0 },
            serper: { usage: 0, calls: 0, cost: 0 }
          }
        };
      }

      // Aggregate across all months
      const stats = {
        apollo: { usage: 0, calls: 0, cost: 0 },
        openai: { usage: 0, calls: 0, cost: 0 },
        anthropic: { usage: 0, calls: 0, cost: 0 },
        mailgun: { usage: 0, calls: 0, cost: 0 },
        zerobounce: { usage: 0, calls: 0, cost: 0 },
        serper: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        ['apollo', 'openai', 'anthropic', 'mailgun', 'zerobounce', 'serper'].forEach(service => {
          if (item[service]) {
            stats[service].usage += item[service].usage || 0;
            stats[service].calls += item[service].calls || 0;
            stats[service].cost += item[service].cost || 0;
          }
        });
      });

      return { success: true, stats };
    } catch (error) {
      // console.error('[SUMMARY] Failed to get user summary:', error.message);
      return {
        success: false,
        error: error.message,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          anthropic: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get API usage stats for a specific agent (with retry logic for throttling)
   */
  async getAgentApiUsage(agentId, startDate = null, endDate = null, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      // Use Query with GSI for fast lookups by agentId
      const params = {
        TableName: this.tables.apiUsage,
        IndexName: 'agentId-timestamp-index',
        KeyConditionExpression: 'agentId = :agentId',
        ExpressionAttributeValues: {
          ':agentId': agentId
        }
      };

      // Add date range if provided
      if (startDate && endDate) {
        params.KeyConditionExpression += ' AND #ts BETWEEN :start AND :end';
        params.ExpressionAttributeNames = { '#ts': 'timestamp' };
        params.ExpressionAttributeValues[':start'] = startDate;
        params.ExpressionAttributeValues[':end'] = endDate;
      }

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      // Aggregate by service
      const stats = {
        apollo: { usage: 0, calls: 0, cost: 0 },
        openai: { usage: 0, calls: 0, cost: 0 },
        anthropic: { usage: 0, calls: 0, cost: 0 },
        mailgun: { usage: 0, calls: 0, cost: 0 },
        zerobounce: { usage: 0, calls: 0, cost: 0 },
        serper: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        if (stats[item.service]) {
          stats[item.service].usage += item.usage || 0;
          stats[item.service].calls += 1;
          stats[item.service].cost += item.cost || 0;
        }
      });

      return { success: true, stats, total: result.Items.length };
    } catch (error) {
      // Check if it's a throttling error
      if (error.name === 'ProvisionedThroughputExceededException' && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`[AWS] Throttled on getAgentApiUsage, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAgentApiUsage(agentId, startDate, endDate, retryCount + 1);
      }
      
      // Log error but don't crash - return empty stats
      console.error('[AWS] Failed to get agent API usage:', error.message);
      return { 
        success: false, 
        error: error.message,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          anthropic: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get total API usage across all agents for a user (with retry logic for throttling)
   */
  async getUserApiUsage(userId, startDate = null, endDate = null, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ConsistentRead: true // Force strongly consistent reads to see latest data immediately
      };

      // Add date range if provided
      if (startDate && endDate) {
        params.KeyConditionExpression += ' AND #ts BETWEEN :start AND :end';
        params.ExpressionAttributeNames = { '#ts': 'timestamp' };
        params.ExpressionAttributeValues[':start'] = startDate;
        params.ExpressionAttributeValues[':end'] = endDate;
      }

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      // Aggregate by service
      const stats = {
        apollo: { usage: 0, calls: 0, cost: 0 },
        openai: { usage: 0, calls: 0, cost: 0 },
        mailgun: { usage: 0, calls: 0, cost: 0 },
        zerobounce: { usage: 0, calls: 0, cost: 0 },
        serper: { usage: 0, calls: 0, cost: 0 }
      };

      result.Items.forEach(item => {
        if (stats[item.service]) {
          // Handle usage which can be a number or object (e.g., { tokens: 123 } or { credits: 5 })
          let usageValue = 0;
          if (typeof item.usage === 'object' && item.usage !== null) {
            // Extract the numeric value from the object (tokens, credits, searches, etc.)
            usageValue = Object.values(item.usage)[0] || 0;
          } else {
            usageValue = item.usage || 0;
          }
          
          stats[item.service].usage += usageValue;
          stats[item.service].calls += 1;
          stats[item.service].cost += item.cost || 0;
        }
      });

      return { success: true, stats, total: result.Items.length };
    } catch (error) {
      // Check if it's a throttling error
      if (error.name === 'ProvisionedThroughputExceededException' && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`[AWS] Throttled on getUserApiUsage, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getUserApiUsage(userId, startDate, endDate, retryCount + 1);
      }
      
      // Log error but don't crash - return empty stats
      console.error('[AWS] Failed to get user API usage:', error.message);
      return { 
        success: false, 
        error: error.message,
        stats: {
          apollo: { usage: 0, calls: 0, cost: 0 },
          openai: { usage: 0, calls: 0, cost: 0 },
          mailgun: { usage: 0, calls: 0, cost: 0 },
          zerobounce: { usage: 0, calls: 0, cost: 0 },
          serper: { usage: 0, calls: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get API usage over time for graphing (last 7 days by default)
   */
  async getApiUsageTimeSeries(userId, days = 7, interval = 'day') {
    try {
      // For month interval, use summary table (much faster)
      if (interval === 'month') {
        const summaryCommand = new QueryCommand({
          TableName: this.tables.apiUsageSummary,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          }
        });
        
        const { Items: summaryRecords } = await this.dynamodb.send(summaryCommand);
        
        // Convert summary records to time series format
        const series = summaryRecords?.map(record => {
          const [year, month] = record.month.split('-');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const displayDate = `${monthNames[parseInt(month) - 1]} ${year}`;
          
          return {
            date: displayDate,
            sortKey: record.month,
            apolloCalls: record.apollo?.calls || 0,
            openaiCalls: record.openai?.calls || 0,
            anthropicCalls: record.anthropic?.calls || 0,
            mailgunCalls: record.mailgun?.calls || 0,
            zerbounceCalls: record.zerobounce?.calls || 0,
            serperCalls: record.serper?.calls || 0,
            gmailCalls: record.gmail?.calls || 0,
            totalCalls: (record.apollo?.calls || 0) + (record.openai?.calls || 0) + (record.anthropic?.calls || 0) +
                        (record.mailgun?.calls || 0) + (record.zerobounce?.calls || 0) + 
                        (record.serper?.calls || 0) + (record.gmail?.calls || 0),
            apollo: { cost: record.apollo?.cost || 0 },
            openai: { cost: record.openai?.cost || 0 },
            anthropic: { cost: record.anthropic?.cost || 0 },
            mailgun: { cost: record.mailgun?.cost || 0 },
            zerobounce: { cost: record.zerobounce?.cost || 0 },
            serper: { cost: record.serper?.cost || 0 },
            gmail: { cost: record.gmail?.cost || 0 },
            total: {
              cost: (record.apollo?.cost || 0) + (record.openai?.cost || 0) + (record.anthropic?.cost || 0) +
                    (record.mailgun?.cost || 0) + (record.zerobounce?.cost || 0) + 
                    (record.serper?.cost || 0) + (record.gmail?.cost || 0)
            }
          };
        }).sort((a, b) => a.sortKey.localeCompare(b.sortKey)) || [];
        
        return { success: true, series, days, interval };
      }
      
      // For other intervals, use detailed table
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId AND #ts >= :start',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':start': startDate.toISOString()
        }
      };

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      // Group by interval and service
      const timeSeriesData = {};
      
      result.Items.forEach(item => {
        const timestamp = new Date(item.timestamp);
        let key;
        let displayDate;
        
        // Generate key based on interval
        switch(interval) {
          case 'minute':
            // Round to nearest minute
            timestamp.setSeconds(0, 0);
            key = timestamp.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
            const mins = timestamp.getMinutes();
            const hourMin = timestamp.getHours();
            const ampmMin = hourMin >= 12 ? 'PM' : 'AM';
            const hour12Min = hourMin % 12 || 12;
            displayDate = `${hour12Min}:${mins.toString().padStart(2, '0')} ${ampmMin}`;
            break;
          case 'hour':
            // Round to nearest hour
            timestamp.setMinutes(0, 0, 0);
            key = timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
            const hr = timestamp.getHours();
            const ampm = hr >= 12 ? 'PM' : 'AM';
            const hour12 = hr % 12 || 12;
            displayDate = `${hour12} ${ampm}`;
            break;
          case 'day':
          default:
            // Group by day
            key = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
            const monthsDay = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${monthsDay[timestamp.getMonth()]} ${timestamp.getDate()}`;
            break;
        }
        
        if (!timeSeriesData[key]) {
          timeSeriesData[key] = {
            date: displayDate,
            sortKey: key,
            // Flattened structure for API calls chart
            apolloCalls: 0,
            openaiCalls: 0,
            anthropicCalls: 0,
            mailgunCalls: 0,
            zerbounceCalls: 0,
            serperCalls: 0,
            totalCalls: 0,
            // Nested structure for cost chart (you liked this format)
            apollo: { cost: 0 },
            openai: { cost: 0 },
            anthropic: { cost: 0 },
            mailgun: { cost: 0 },
            zerobounce: { cost: 0 },
            serper: { cost: 0 },
            total: { cost: 0 }
          };
        }

        // Map service names to property names
        const serviceMap = {
          'apollo': 'apollo',
          'openai': 'openai',
          'anthropic': 'anthropic',
          'mailgun': 'mailgun',
          'zerobounce': 'zerobounce',
          'serper': 'serper'
        };

        const serviceName = serviceMap[item.service];
        if (serviceName) {
          // Update flat calls properties - count each log entry as 1 API call
          timeSeriesData[key][`${serviceName}Calls`] += 1;
          timeSeriesData[key].totalCalls += 1;
          
          // Update nested cost objects
          if (timeSeriesData[key][item.service]) {
            timeSeriesData[key][item.service].cost += item.cost || 0;
            timeSeriesData[key].total.cost += item.cost || 0;
          }
        }
      });

      // Fill in missing time periods with zeros
      const now = new Date();
      const startTime = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      const filledData = {};
      
      // Generate all time periods in range
      let currentTime = new Date(startTime);
      while (currentTime <= now) {
        let key;
        let displayDate;
        
        switch(interval) {
          case 'minute':
            currentTime.setSeconds(0, 0);
            key = currentTime.toISOString().slice(0, 16);
            const mins = currentTime.getMinutes();
            const hourMin = currentTime.getHours();
            const ampmMin = hourMin >= 12 ? 'PM' : 'AM';
            const hour12Min = hourMin % 12 || 12;
            displayDate = `${hour12Min}:${mins.toString().padStart(2, '0')} ${ampmMin}`;
            currentTime.setMinutes(currentTime.getMinutes() + 1);
            break;
          case 'hour':
            currentTime.setMinutes(0, 0, 0);
            key = currentTime.toISOString().slice(0, 13);
            const hr = currentTime.getHours();
            const ampm = hr >= 12 ? 'PM' : 'AM';
            const hour12 = hr % 12 || 12;
            displayDate = `${hour12} ${ampm}`;
            currentTime.setHours(currentTime.getHours() + 1);
            break;
          case 'day':
          default:
            key = currentTime.toISOString().split('T')[0];
            const monthsDay = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${monthsDay[currentTime.getMonth()]} ${currentTime.getDate()}`;
            currentTime.setDate(currentTime.getDate() + 1);
            break;
        }
        
        // Use existing data or create empty entry
        filledData[key] = timeSeriesData[key] || {
          date: displayDate,
          sortKey: key,
          apolloCalls: 0,
          openaiCalls: 0,
          anthropicCalls: 0,
          mailgunCalls: 0,
          zerbounceCalls: 0,
          serperCalls: 0,
          totalCalls: 0,
          apollo: { cost: 0 },
          openai: { cost: 0 },
          anthropic: { cost: 0 },
          mailgun: { cost: 0 },
          zerobounce: { cost: 0 },
          serper: { cost: 0 },
          total: { cost: 0 }
        };
      }

      // Convert to array and sort by sortKey (chronological order)
      const series = Object.values(filledData).sort((a, b) => 
        a.sortKey.localeCompare(b.sortKey)
      );

      return { success: true, series, days, interval };
    } catch (error) {
      console.error('[AWS] Failed to get API usage time series:', error);
      
      // Check if it's a throughput exceeded error
      if (error.name === 'ProvisionedThroughputExceededException' || 
          error.__type?.includes('ProvisionedThroughputExceededException')) {
        console.log('[AWS] Throughput exceeded - returning empty data set (this is cached to prevent further queries)');
        // Return empty data instead of error - this will be cached
        return { 
          success: true, 
          series: [], 
          days, 
          interval,
          throttled: true,
          message: 'API usage data temporarily unavailable due to high load. Data will refresh in a few minutes.'
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has exceeded API rate limits
   */
  async checkApiRateLimit(userId, service, requestedUsage = 1) {
    try {
      // Get user's configured rate limits
      const userSettings = await this.getUserSettings(userId);
      const rateLimits = userSettings?.apiRateLimits?.[service];

      if (!rateLimits) {
        // No limits configured, allow request
        return { 
          allowed: true, 
          reason: 'No rate limits configured',
          remaining: null 
        };
      }

      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Query usage for different time periods
      const [hourlyUsage, dailyUsage, monthlyUsage] = await Promise.all([
        rateLimits.hourly ? this.getApiUsageForPeriod(userId, service, hourStart) : { usage: 0 },
        rateLimits.daily ? this.getApiUsageForPeriod(userId, service, dayStart) : { usage: 0 },
        rateLimits.monthly ? this.getApiUsageForPeriod(userId, service, monthStart) : { usage: 0 }
      ]);

      // Check each limit
      if (rateLimits.hourly && hourlyUsage.usage + requestedUsage > rateLimits.hourly) {
        return {
          allowed: false,
          reason: 'hourly',
          limit: rateLimits.hourly,
          current: hourlyUsage.usage,
          resetTime: new Date(hourStart.getTime() + 3600000) // +1 hour
        };
      }

      if (rateLimits.daily && dailyUsage.usage + requestedUsage > rateLimits.daily) {
        return {
          allowed: false,
          reason: 'daily',
          limit: rateLimits.daily,
          current: dailyUsage.usage,
          resetTime: new Date(dayStart.getTime() + 86400000) // +1 day
        };
      }

      if (rateLimits.monthly && monthlyUsage.usage + requestedUsage > rateLimits.monthly) {
        return {
          allowed: false,
          reason: 'monthly',
          limit: rateLimits.monthly,
          current: monthlyUsage.usage,
          resetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1) // Next month
        };
      }

      return {
        allowed: true,
        remaining: {
          hourly: rateLimits.hourly ? rateLimits.hourly - hourlyUsage.usage : null,
          daily: rateLimits.daily ? rateLimits.daily - dailyUsage.usage : null,
          monthly: rateLimits.monthly ? rateLimits.monthly - monthlyUsage.usage : null
        }
      };
    } catch (error) {
      console.error('[AWS] Error checking rate limit:', error);
      // On error, allow the request (fail open)
      return { allowed: true, reason: 'Error checking limits', error: error.message };
    }
  }

  /**
   * Get API usage for a specific time period
   */
  async getApiUsageForPeriod(userId, service, startDate) {
    try {
      const params = {
        TableName: this.tables.apiUsage,
        KeyConditionExpression: 'userId = :userId AND #ts >= :start',
        FilterExpression: 'service = :service',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':start': startDate.toISOString(),
          ':service': service
        }
      };

      const command = new QueryCommand(params);
      const result = await this.dynamodb.send(command);

      const totalUsage = result.Items.reduce((sum, item) => sum + (item.usage || 0), 0);

      return { usage: totalUsage, calls: result.Items.length };
    } catch (error) {
      console.error('[AWS] Error getting usage for period:', error);
      return { usage: 0, calls: 0 };
    }
  }

  // =====================
  // Issues & Alerts Methods
  // =====================

  /**
   * Add an issue or alert
   * @param {string} userId - User ID
   * @param {string} type - Type: 'error', 'warning', 'info'
   * @param {string} title - Issue title
   * @param {string} message - Issue message
   * @param {object} metadata - Additional metadata
   */
  async addIssue(userId, type, title, message, metadata = {}) {
    try {
      const timestamp = new Date().toISOString();
      const issueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract severity from metadata if provided, default to 'medium'
      const { severity = 'medium', ...otherMetadata } = metadata;
      
      const issue = {
        PK: `USER#${userId}`,
        SK: `ISSUE#${timestamp}#${issueId}`,
        issueId,
        userId,
        type, // billing, agent, email, system
        severity, // critical, high, medium, low (top-level for easy filtering)
        title,
        message,
        metadata: otherMetadata, // Store remaining metadata
        timestamp,
        read: false,
        createdAt: timestamp
      };

      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.issuesAlerts,
        Item: issue
      }));

      console.log(`[AWS] Added ${type} issue (${severity}): ${title}`);

      // Broadcast to SSE for real-time updates
      try {
        const { broadcastActivity } = await import('../routes/monitoring.js');
        broadcastActivity({
          type: 'issue',
          severity: severity,
          message: title,
          details: message,
          agentId: otherMetadata.agentId,
          agentName: otherMetadata.agentName,
          userId: userId,
          timestamp: Date.now()
        });
      } catch (broadcastError) {
        console.error('[AWS] Failed to broadcast issue to SSE:', broadcastError.message);
      }

      // Clean up old issues if over 100
      await this.cleanupOldIssues(userId);

      return { success: true, issueId };
    } catch (error) {
      console.error('[AWS] Error adding issue:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all issues/alerts for a user
   */
  async getIssues(userId, limit = 100) {
    try {
      const command = new QueryCommand({
        TableName: this.tables.issuesAlerts,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'ISSUE#'
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });

      const result = await this.dynamodb.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error getting issues:', error);
      return [];
    }
  }

  /**
   * Mark issue as read
   */
  async markIssueAsRead(userId, issueId) {
    try {
      // Find the issue first to get the full SK
      const issues = await this.getIssues(userId);
      const issue = issues.find(i => i.issueId === issueId);
      
      if (!issue) {
        throw new Error('Issue not found');
      }

      await this.dynamodb.send(new UpdateCommand({
        TableName: this.tables.issuesAlerts,
        Key: {
          PK: issue.PK,
          SK: issue.SK
        },
        UpdateExpression: 'SET #read = :read',
        ExpressionAttributeNames: {
          '#read': 'read'
        },
        ExpressionAttributeValues: {
          ':read': true
        }
      }));

      console.log(`[AWS] Marked issue as read: ${issueId}`);
      return { success: true };
    } catch (error) {
      console.error('[AWS] Error marking issue as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all issues for a user
   */
  async clearAllIssues(userId) {
    try {
      // Get all issues for this user
      const issues = await this.getIssues(userId, 500); // Get more items for deletion
      
      if (issues.length === 0) {
        console.log(`[AWS] No issues to clear for user ${userId}`);
        return { success: true, deleted: 0 };
      }

      // Delete all issues in batches
      const batchSize = 25; // DynamoDB batch write limit
      let deletedCount = 0;

      for (let i = 0; i < issues.length; i += batchSize) {
        const batch = issues.slice(i, i + batchSize);
        const deleteRequests = batch.map(issue => ({
          DeleteRequest: {
            Key: {
              PK: issue.PK,
              SK: issue.SK
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tables.issuesAlerts]: deleteRequests
          }
        }));

        deletedCount += deleteRequests.length;
      }

      console.log(`[AWS] Cleared ${deletedCount} issues for user ${userId}`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('[AWS] Error clearing all issues:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all cycle logs for a user
   */
  async clearAllCycleLogs(userId) {
    try {
      // Get all cycle logs for this user
      const cycleLogs = await this.getCycleLogs(userId, null, 500); // Get more items for deletion
      
      if (cycleLogs.length === 0) {
        console.log(`[AWS] No cycle logs to clear for user ${userId}`);
        return { success: true, deleted: 0 };
      }

      // Delete all cycle logs in batches
      const batchSize = 25; // DynamoDB batch write limit
      let deletedCount = 0;

      for (let i = 0; i < cycleLogs.length; i += batchSize) {
        const batch = cycleLogs.slice(i, i + batchSize);
        const deleteRequests = batch.map(cycle => ({
          DeleteRequest: {
            Key: {
              userId: cycle.userId,
              cycleId: cycle.cycleId // Use cycleId as the sort key, not timestamp
            }
          }
        }));

        await this.dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [this.tables.cycleLogs]: deleteRequests
          }
        }));

        deletedCount += deleteRequests.length;
      }

      console.log(`[AWS] Cleared ${deletedCount} cycle logs for user ${userId}`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('[AWS] Error clearing all cycle logs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete old issues if count exceeds 100
   */
  async cleanupOldIssues(userId) {
    try {
      const issues = await this.getIssues(userId, 150); // Get more than limit to check

      if (issues.length > 100) {
        // Delete oldest issues (they're sorted newest first)
        const toDelete = issues.slice(100);
        
        for (const issue of toDelete) {
          await this.dynamodb.send(new DeleteCommand({
            TableName: this.tables.issuesAlerts,
            Key: {
              PK: issue.PK,
              SK: issue.SK
            }
          }));
        }

        console.log(`[AWS] Cleaned up ${toDelete.length} old issues`);
      }
    } catch (error) {
      console.error('[AWS] Error cleaning up old issues:', error);
    }
  }

  /**
   * Delete a specific issue
   */
  async deleteIssue(userId, issueId) {
    try {
      const issues = await this.getIssues(userId);
      const issue = issues.find(i => i.issueId === issueId);
      
      if (!issue) {
        throw new Error('Issue not found');
      }

      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tables.issuesAlerts,
        Key: {
          PK: issue.PK,
          SK: issue.SK
        }
      }));

      console.log(`[AWS] Deleted issue: ${issueId}`);
      return { success: true };
    } catch (error) {
      console.error('[AWS] Error deleting issue:', error);
      return { success: false, error: error.message };
    }
  }

  // ======================
  // PAYMENT HISTORY METHODS
  // ======================

  /**
   * Log a payment transaction
   */
  async logPayment(userId, paymentData) {
    try {
      const timestamp = new Date().toISOString();
      const paymentId = `PAYMENT#${timestamp}#${Math.random().toString(36).substr(2, 9)}`;

      const command = new PutCommand({
        TableName: this.tables.paymentHistory,
        Item: {
          userId,
          paymentId,
          timestamp,
          amount: paymentData.amount,
          status: paymentData.status, // 'success', 'failed', 'refunded'
          currency: paymentData.currency || 'USD',
          stripePaymentIntentId: paymentData.stripePaymentIntentId,
          billingPeriod: paymentData.billingPeriod,
          description: paymentData.description || `Monthly billing for ${paymentData.billingPeriod}`,
          errorMessage: paymentData.errorMessage || null,
          metadata: paymentData.metadata || {}
        }
      });

      await this.dynamodb.send(command);
      console.log(`[AWS] Logged payment: ${paymentData.status} - $${paymentData.amount}`);
      return { success: true, paymentId };
    } catch (error) {
      console.error('[AWS] Error logging payment:', error);
      throw error;
    }
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId, limit = 20) {
    try {
      const command = new QueryCommand({
        TableName: this.tables.paymentHistory,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      });

      const result = await this.dynamodb.send(command);
      console.log(`[AWS] Retrieved ${result.Items?.length || 0} payment records`);
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error getting payment history:', error);
      return [];
    }
  }

  /**
   * Get payment statistics for a user
   */
  async getPaymentStats(userId) {
    try {
      const user = await this.getUserById(userId);
      const payments = await this.getPaymentHistory(userId, 100);
      
      const stats = {
        billingMode: 'prepaid',
        totalPaid: 0,
        totalFailed: 0,
        outstanding: 0,
        successCount: 0,
        failedCount: 0,
        lastSuccessfulPayment: null,
        lastFailedPayment: null
      };

      // Track unique billing periods to avoid counting duplicates
      const successfulPeriods = new Set();
      const failedPeriods = new Map(); // Map to store amount per period

      payments.forEach(payment => {
        if (payment.status === 'success') {
          // Only count each successful billing period once
          if (!successfulPeriods.has(payment.billingPeriod)) {
            stats.totalPaid += payment.amount;
            stats.successCount++;
            successfulPeriods.add(payment.billingPeriod);
          }
          if (!stats.lastSuccessfulPayment || payment.timestamp > stats.lastSuccessfulPayment.timestamp) {
            stats.lastSuccessfulPayment = payment;
          }
        } else if (payment.status === 'failed') {
          // Only count each failed billing period once (use the first/latest attempt amount)
          if (!failedPeriods.has(payment.billingPeriod)) {
            failedPeriods.set(payment.billingPeriod, payment.amount);
            stats.failedCount++;
          }
          if (!stats.lastFailedPayment || payment.timestamp > stats.lastFailedPayment.timestamp) {
            stats.lastFailedPayment = payment;
          }
        }
      });

      // Sum up unique failed amounts
      stats.totalFailed = Array.from(failedPeriods.values()).reduce((sum, amount) => sum + amount, 0);

      const usesPrepaidCredits = !!user?.plan || user?.creditBalance !== undefined;

      if (!usesPrepaidCredits) {
        // Legacy fallback for old postpaid users.
        try {
          const summaryCommand = new QueryCommand({
            TableName: this.tables.apiUsageSummary,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':userId': userId
            }
          });
          
          const { Items: summaryRecords } = await this.dynamodb.send(summaryCommand);
          
          let outstanding = 0;
          summaryRecords?.forEach(summary => {
            let monthUsage = 0;
            ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
              if (summary[service]) {
                monthUsage += summary[service].cost || 0;
              }
            });
            
            let monthPayments = 0;
            payments
              .filter(p => p.status === 'success' && p.billingPeriod)
              .forEach(payment => {
                const paymentMonth = new Date(payment.billingPeriod).toISOString().slice(0, 7);
                if (paymentMonth === summary.month) {
                  monthPayments += payment.amount || 0;
                }
              });
            
            const monthOutstanding = Math.max(0, monthUsage - monthPayments);
            outstanding += monthOutstanding;
          });
          
          stats.outstanding = outstanding;

          const now = new Date();
          const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          stats.nextBillingDate = nextBillingDate.toISOString();
          stats.billingMode = 'postpaid';
        } catch (summaryError) {
          console.error('[AWS] Error calculating outstanding balance:', summaryError);
          stats.outstanding = 0;
        }
      }

      console.log(`[AWS] Payment stats: ${stats.successCount} successful, ${stats.failedCount} failed (unique periods), $${stats.outstanding.toFixed(2)} outstanding`);
      return stats;
    } catch (error) {
      console.error('[AWS] Error getting payment stats:', error);
      return null;
    }
  }

  // ======================
  // UNSUBSCRIBE MANAGEMENT
  // ======================

  /**
   * Add email to unsubscribe list
   */
  async addUnsubscribe(email, reason = 'User request', metadata = {}, userId = null) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const timestamp = new Date().toISOString();

      const item = {
        PK: `UNSUBSCRIBE#${normalizedEmail}`,
        SK: timestamp,
        email: normalizedEmail,
        reason,
        unsubscribedAt: timestamp,
        metadata: metadata || {},
        type: 'unsubscribe',
        ...(userId && { userId })
      };

      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.unsubscribes,
        Item: item
      }));

      console.log(`[AWS] Email unsubscribed: ${normalizedEmail}`);
      return { success: true, email: normalizedEmail };
    } catch (error) {
      console.error('[AWS] Error adding unsubscribe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if email is unsubscribed
   */
  async isUnsubscribed(email) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.unsubscribes,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `UNSUBSCRIBE#${normalizedEmail}`
        },
        Limit: 1
      }));

      return result.Items && result.Items.length > 0;
    } catch (error) {
      // Gracefully handle missing table or other errors
      if (error.name === 'ResourceNotFoundException') {
        console.log('ℹ️ [AWS] Unsubscribe table does not exist yet - allowing email (create table: meridian-unsubscribes)');
        return false;
      }
      console.error('[AWS] Error checking unsubscribe status:', error.message);
      return false; // Default to not unsubscribed on error
    }
  }

  /**
   * Get all unsubscribed emails for a user's campaigns
   */
  async getUnsubscribes(limit = 100, userId = null) {
    try {
      const params = { TableName: this.tables.unsubscribes, Limit: limit };
      if (userId) {
        params.FilterExpression = 'userId = :uid';
        params.ExpressionAttributeValues = { ':uid': userId };
      }
      const result = await this.dynamodb.send(new ScanCommand(params));
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error fetching unsubscribes:', error);
      return [];
    }
  }

  /**
   * Remove email from unsubscribe list (re-subscribe)
   */
  async removeUnsubscribe(email) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Find the item first
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.unsubscribes,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `UNSUBSCRIBE#${normalizedEmail}`
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return { success: false, error: 'Email not in unsubscribe list' };
      }

      // Delete all entries for this email
      for (const item of result.Items) {
        await this.dynamodb.send(new DeleteCommand({
          TableName: this.tables.unsubscribes,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      console.log(`[AWS] Email re-subscribed: ${normalizedEmail}`);
      return { success: true, email: normalizedEmail };
    } catch (error) {
      console.error('[AWS] Error removing unsubscribe:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SEARCH HISTORY TRACKING ====================
  
  async recordSearchHistory(userId, agentId, industry, position, leadsFound) {
    try {
      const timestamp = Date.now();
      const searchKey = `${industry.toLowerCase()}#${position.toLowerCase()}`;
      
      await this.dynamodb.send(new PutCommand({
        TableName: this.tables.searchHistory,
        Item: {
          PK: `USER#${userId}#AGENT#${agentId}`,
          SK: `SEARCH#${timestamp}`,
          searchKey: searchKey,
          industry: industry.toLowerCase(),
          position: position,
          leadsFound: leadsFound,
          timestamp: timestamp,
          searchDate: new Date(timestamp).toISOString(),
          TTL: Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60) // 90 day TTL
        }
      }));
      
      console.log(`[SEARCH HISTORY] Recorded: ${industry} + ${position} (${leadsFound} leads)`);
      return { success: true };
    } catch (error) {
      console.error('[AWS] Error recording search history:', error);
      return { success: false, error: error.message };
    }
  }

  async checkSearchHistory(userId, agentId, industry, position, daysBack = 30) {
    try {
      const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
      const searchKey = `${industry.toLowerCase()}#${position.toLowerCase()}`;
      
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.searchHistory,
        KeyConditionExpression: 'PK = :pk AND SK >= :cutoff',
        FilterExpression: 'searchKey = :searchKey',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#AGENT#${agentId}`,
          ':cutoff': `SEARCH#${cutoffTime}`,
          ':searchKey': searchKey
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1
      }));

      if (result.Items && result.Items.length > 0) {
        const lastSearch = result.Items[0];
        const daysAgo = Math.floor((Date.now() - lastSearch.timestamp) / (24 * 60 * 60 * 1000));
        console.log(`[DUPLICATE] Already searched ${industry} + ${position} ${daysAgo} days ago (${lastSearch.leadsFound} leads)`);
        return {
          isDuplicate: true,
          lastSearched: lastSearch.timestamp,
          daysAgo: daysAgo,
          leadsFound: lastSearch.leadsFound
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('[AWS] Error checking search history:', error);
      return { isDuplicate: false }; // Don't block searches on error
    }
  }

  async getSearchHistory(userId, agentId, limit = 50) {
    try {
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.searchHistory,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#AGENT#${agentId}`
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      }));

      return {
        success: true,
        searches: result.Items || []
      };
    } catch (error) {
      console.error('[AWS] Error getting search history:', error);
      return { success: false, error: error.message, searches: [] };
    }
  }

  async deleteSearchHistory(userId, agentId) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      
      // Query all search history entries
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.searchHistory,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        console.log(`[AWS] No search history found for agent ${agentId}`);
        return { success: true, deletedCount: 0 };
      }

      // Delete all entries
      for (const item of result.Items) {
        await this.dynamodb.send(new DeleteCommand({
          TableName: this.tables.searchHistory,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      console.log(`[AWS] Deleted ${result.Items.length} search history entries for agent ${agentId}`);
      return { success: true, deletedCount: result.Items.length };
    } catch (error) {
      console.error('[AWS] Error deleting search history:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteAgentState(userId, agentId) {
    try {
      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tables.agentState,
        Key: {
          userId: userId,
          agentId: agentId
        }
      }));

      console.log(`[AWS] Deleted agent state for ${agentId}`);
      return { success: true };
    } catch (error) {
      console.error('[AWS] Error deleting agent state:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteCycleLogs(userId, agentId) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      
      // Query all cycle logs
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.cycleLogs,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        console.log(`[AWS] No cycle logs found for agent ${agentId}`);
        return { success: true, deletedCount: 0 };
      }

      // Delete all entries
      for (const item of result.Items) {
        await this.dynamodb.send(new DeleteCommand({
          TableName: this.tables.cycleLogs,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      console.log(`[AWS] Deleted ${result.Items.length} cycle logs for agent ${agentId}`);
      return { success: true, deletedCount: result.Items.length };
    } catch (error) {
      console.error('[AWS] Error deleting cycle logs:', error);
      return { success: false, error: error.message };
    }
  }

  // =======================
  // EMAIL TRACKING METHODS
  // =======================
  
  async logEmailTracking(userId, agentId, trackingId, eventData) {
    try {
      const timestamp = new Date().toISOString();
      const eventId = `${trackingId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`[EMAIL-TRACKING] Logging event:`, {
        eventType: eventData.eventType,
        userId,
        agentId,
        trackingId,
        recipientEmail: eventData.recipientEmail,
        timestamp
      });
      
      const command = new PutCommand({
        TableName: this.tables.emailTracking,
        Item: {
          PK: `USER#${userId}#AGENT#${agentId}`,  // Efficient querying by user/agent
          SK: `EVENT#${timestamp}#${eventId}`,     // Chronological ordering
          userId,
          agentId,
          trackingId,
          eventId,
          timestamp,
          ...eventData
        }
      });
      
      await this.dynamodb.send(command);
      console.log(`[EMAIL-TRACKING] Event logged successfully: ${eventData.eventType}`, { eventId });
      return { success: true, eventId };
    } catch (error) {
      console.error('[EMAIL-TRACKING] Error logging email tracking:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getEmailTrackingByTracking(trackingId) {
    try {
      // Use GSI for efficient querying by trackingId
      const command = new QueryCommand({
        TableName: this.tables.emailTracking,
        IndexName: 'TrackingIdIndex',
        KeyConditionExpression: 'trackingId = :trackingId',
        ExpressionAttributeValues: {
          ':trackingId': trackingId
        }
      });
      
      const result = await this.dynamodb.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('[AWS] Error getting email tracking:', error);
      return [];
    }
  }
  
  async getEmailTrackingByUser(userId, agentId = null, limit = 1000) {
    try {
      
      if (!agentId) {
        // Scanning all tracking events - silent
        // Scan for all events for this user across all agents
        const scanCommand = new ScanCommand({
          TableName: this.tables.emailTracking,
          FilterExpression: 'begins_with(PK, :userPrefix)',
          ExpressionAttributeValues: {
            ':userPrefix': `USER#${userId}#`
          },
          Limit: limit
        });
        const result = await this.dynamodb.send(scanCommand);
        // Scan found events - silent
        return result.Items || [];
      }
      
      const pk = `USER#${userId}#AGENT#${agentId}`;
      let allEvents = [];
      let lastEvaluatedKey = null;
      let pageCount = 0;
      
      // Use Query instead of Scan - much more efficient!
      do {
        pageCount++;
        const commandParams = {
          TableName: this.tables.emailTracking,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': pk
          },
          Limit: limit
        };
        
        if (lastEvaluatedKey) {
          commandParams.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const command = new QueryCommand(commandParams);
        const result = await this.dynamodb.send(command);
        const events = result.Items || [];
        allEvents = allEvents.concat(events);
        lastEvaluatedKey = result.LastEvaluatedKey;
        
        
        if (allEvents.length >= limit) {
          allEvents = allEvents.slice(0, limit);
          break;
        }
      } while (lastEvaluatedKey);
      
      
      // if (allEvents.length > 0) {
      // }
      
      return allEvents;
    } catch (error) {
      // console.error('[EMAIL-TRACKING] Error getting user email tracking:', error);
      return [];
    }
  }

  async deleteEmailTrackingEvent(event) {
    try {
      console.log(`[EMAIL-TRACKING] Attempting to delete event:`, {
        userId: event.userId,
        agentId: event.agentId,
        trackingId: event.trackingId,
        eventId: event.eventId,
        timestamp: event.timestamp
      });
      
      // V2 table uses compound key: PK (USER#...#AGENT#...) + SK (EVENT#timestamp#eventId)
      const pk = `USER#${event.userId}#AGENT#${event.agentId}`;
      const sk = `EVENT#${event.timestamp}#${event.eventId}`;
      
      const deleteCommand = new DeleteCommand({
        TableName: this.tables.emailTracking,
        Key: { 
          PK: pk,
          SK: sk
        }
      });
      
      await this.dynamodb.send(deleteCommand);
      console.log(`[EMAIL-TRACKING] Successfully deleted event with PK: ${pk}, SK: ${sk}`);
      return { success: true };
    } catch (error) {
      console.error('[EMAIL-TRACKING] Error deleting tracking event:', error);
      throw error;
    }
  }

  // ====================
  // TABLE CREATION
  // ====================
  
  async createAgentMetricsTable() {
    try {
      console.log('[AWS] Creating agent metrics table...');
      
      const command = new CreateTableCommand({
        TableName: this.tables.agentMetrics,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },  // Partition key: USER#{userId}#AGENT#{agentId}
          { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key: METRICS#{timestamp}
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true
        },
        Tags: [
          { Key: 'Project', Value: 'Meridian' },
          { Key: 'Purpose', Value: 'AgentMetrics' }
        ]
      });
      
      const ddbClient = new DynamoDBClient({
        region: this.region,
        credentials: fromNodeProviderChain()
      });
      
      await ddbClient.send(command);
      
      console.log('[AWS] Agent metrics table created successfully');
      return { success: true, tableName: this.tables.agentMetrics };
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log('ℹ️ [AWS] Agent metrics table already exists');
        return { success: true, tableName: this.tables.agentMetrics, alreadyExists: true };
      }
      console.error('[AWS] Error creating agent metrics table:', error);
      return { success: false, error: error.message };
    }
  }

  async createSearchHistoryTable() {
    try {
      console.log('[AWS] Creating search history table...');
      
      const command = new CreateTableCommand({
        TableName: this.tables.searchHistory,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },  // Partition key: USER#{userId}#AGENT#{agentId}
          { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key: SEARCH#{timestamp}
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
        Tags: [
          { Key: 'Project', Value: 'Meridian' },
          { Key: 'Purpose', Value: 'SearchHistory' }
        ]
      });
      
      const ddbClient = new DynamoDBClient({
        region: this.region,
        credentials: fromNodeProviderChain()
      });
      
      await ddbClient.send(command);
      
      console.log('[AWS] Search history table created successfully');
      return { success: true, tableName: this.tables.searchHistory };
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log('ℹ️ [AWS] Search history table already exists');
        return { success: true, tableName: this.tables.searchHistory, alreadyExists: true };
      }
      console.error('[AWS] Error creating search history table:', error);
      return { success: false, error: error.message };
    }
  }

  // Set AI control state for a specific conversation
  async setConversationAIControl(userId, agentId, trackingId, enabled) {
    try {
      console.log(`[AI-CONTROL] Setting AI control:`, {
        userId,
        agentId,
        trackingId,
        enabled
      });
      
      // Store in email tracking table as a special event
      const pk = `USER#${userId}#AGENT#${agentId}`;
      const sk = `AI_CONTROL#${trackingId}`;
      
      const command = new PutCommand({
        TableName: this.tables.emailTracking,
        Item: {
          PK: pk,
          SK: sk,
          userId,
          agentId,
          trackingId,
          eventType: 'ai_control',
          aiEnabled: enabled,
          timestamp: new Date().toISOString()
        }
      });

      await this.dynamodb.send(command);
      console.log(`[AI-CONTROL] AI control set for trackingId ${trackingId}: ${enabled ? 'ENABLED' : 'PAUSED'}`);
      return { success: true };
    } catch (error) {
      console.error('[AI-CONTROL] Error setting AI control:', error);
      throw error;
    }
  }

  // Get AI control state for a specific conversation
  async getConversationAIControl(userId, agentId, trackingId) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      const sk = `AI_CONTROL#${trackingId}`;
      
      console.log(`[AI-CONTROL] Getting AI state for:`, {
        userId,
        agentId,
        trackingId,
        PK: pk,
        SK: sk
      });
      
      const command = new GetCommand({
        TableName: this.tables.emailTracking,
        Key: {
          PK: pk,
          SK: sk
        }
      });

      const result = await this.dynamodb.send(command);
      console.log(`[AI-CONTROL] DynamoDB result:`, {
        hasItem: !!result.Item,
        aiEnabled: result.Item?.aiEnabled
      });
      
      if (result.Item) {
        return result.Item.aiEnabled !== false;
      }
      return true; // Default to enabled if not found
    } catch (error) {
      console.error(`[AI-CONTROL] Error getting AI control state:`, error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Record agent metrics snapshot
   * PK: USER#userId#AGENT#agentId
   * SK: METRICS#timestamp
   */
  async recordAgentMetrics({ userId, agentId, timestamp, metrics }) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      const sk = `METRICS#${timestamp}`;
      
      const command = new PutCommand({
        TableName: this.tables.agentMetrics,
        Item: {
          PK: pk,
          SK: sk,
          userId,
          agentId,
          timestamp,
          queued: metrics.queued || 0,
          sent: metrics.sent || 0,
          replied: metrics.replied || 0,
          ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
        }
      });

      await this.dynamodb.send(command);
      // Recorded metrics - silent
    } catch (error) {
      console.error('Error recording agent metrics:', error);
      throw error;
    }
  }

  /**
   * Get agent metrics history
   * Returns time-series data for queued/sent/replied counts
   */
  async getAgentMetricsHistory(userId, agentId, startTime) {
    try {
      const pk = `USER#${userId}#AGENT#${agentId}`;
      const skStart = `METRICS#${startTime}`;
      
      const command = new QueryCommand({
        TableName: this.tables.agentMetrics,
        KeyConditionExpression: 'PK = :pk AND SK >= :sk',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': skStart
        },
        ScanIndexForward: true // Oldest first
      });

      const result = await this.dynamodb.send(command);
      
      return (result.Items || []).map(item => ({
        timestamp: item.timestamp,
        queued: item.queued || 0,
        sent: item.sent || 0,
        replied: item.replied || 0
      }));
    } catch (error) {
      console.error('Error fetching agent metrics history:', error);
      return [];
    }
  }

  // =====================
  // PLAN MANAGEMENT METHODS
  // =====================

  /**
   * Update user's plan
   */
  async updateUserPlan(userId, planType) {
    try {
      const planConfig = this.getPlanConfig(planType);
      if (!planConfig) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user with new plan
      await this.updateUser(userId, {
        plan: planType,
        trialCreditsLimit: planConfig.initialCredits,
        maxCredits: planConfig.maxCredits,
        maxAgents: planConfig.maxAgents,
        maxConcurrency: planConfig.maxConcurrency,
        planUpdatedAt: new Date().toISOString()
      });

      console.log(`[PLANS] Updated user ${userId} to ${planConfig.name} plan`);
      
      return {
        success: true,
        plan: planConfig,
        message: `Successfully upgraded to ${planConfig.name}`
      };
    } catch (error) {
      console.error('[PLANS] Error updating user plan:', error);
      throw error;
    }
  }

  /**
   * Upgrade any user to the developer plan with full credits
   */
  async upgradeUserToDeveloper(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      const plan = this.plans['developer'];
      await this.updateUser(userId, {
        plan: 'developer',
        creditBalance: plan.initialCredits,
        trialCreditsLimit: plan.initialCredits,
        trialCreditsUsed: 0,
        maxCredits: plan.maxCredits,
        maxAgents: plan.maxAgents,
        maxConcurrency: plan.maxConcurrency,
        trialEligible: true,
        planUpdatedAt: new Date().toISOString()
      });

      console.log(`[DEVELOPER] Upgraded ${user.email || userId} to Developer plan (999,999 credits)`);
      return { success: true, userId, email: user.email, plan: 'developer', credits: plan.initialCredits };
    } catch (err) {
      console.error('[DEVELOPER] Upgrade failed:', err);
      throw err;
    }
  }

  async upgradeUserToBeta(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      const plan = this.plans['beta'];
      await this.updateUser(userId, {
        plan: 'beta',
        creditBalance: plan.initialCredits,
        trialCreditsLimit: plan.initialCredits,
        trialCreditsUsed: 0,
        maxCredits: plan.maxCredits,
        maxAgents: plan.maxAgents,
        maxConcurrency: plan.maxConcurrency,
        trialEligible: true,
        planUpdatedAt: new Date().toISOString()
      });

      console.log(`[BETA] Upgraded ${user.email || userId} to Beta plan (${plan.initialCredits} credits)`);
      return { success: true, userId, email: user.email, plan: 'beta', credits: plan.initialCredits };
    } catch (err) {
      console.error('[BETA] Upgrade failed:', err);
      throw err;
    }
  }

  /**
   * Atomically claim the right to fire an auto top-up charge for this user.
   * Prevents concurrent API-usage calls (which can land in the same second)
   * from triggering duplicate Stripe charges while a balance sits below the
   * user's threshold. Returns false if another call already holds the claim.
   */
  async claimAutoTopupLock(userId, cooldownMs) {
    try {
      const now = Date.now();
      const cutoff = now - cooldownMs;
      await this.dynamodb.send(new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: 'SET autoTopupLock = :now',
        ConditionExpression: 'attribute_not_exists(autoTopupLock) OR autoTopupLock < :cutoff',
        ExpressionAttributeValues: { ':now': now, ':cutoff': cutoff },
      }));
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') return false;
      console.error('[AWS] Error claiming auto top-up lock:', error);
      return false;
    }
  }

  /**
   * Purchase additional credits for user
   */
  async purchaseCredits(userId, creditAmount) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const planConfig = this.getPlanConfig(user.plan || 'free-trial');
      
      // Check if user can purchase more credits
      if (!planConfig.canPurchaseMore) {
        throw new Error(`${planConfig.name} does not allow credit purchases. Please upgrade your plan.`);
      }

      const currentLimit = this.isTrialBlockedUser(user)
        ? 0
        : Math.max(Number(user.trialCreditsLimit ?? 0), planConfig.initialCredits);
      const newLimit = currentLimit + creditAmount;

      // Check against max credits for plan
      if (newLimit > planConfig.maxCredits) {
        throw new Error(`Cannot exceed ${planConfig.maxCredits} credits for ${planConfig.name}. You can purchase up to ${planConfig.maxCredits - currentLimit} more credits.`);
      }

      // Update user's credit limit
      await this.updateUser(userId, {
        trialCreditsLimit: newLimit,
        lastCreditPurchase: {
          amount: creditAmount,
          cost: creditAmount * 0.05,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`[CREDITS] User ${userId} purchased ${creditAmount} credits ($${(creditAmount * 0.05).toFixed(2)})`);
      console.log(`[CREDITS] New credit limit: ${newLimit} (${planConfig.name} plan)`);

      return {
        success: true,
        creditsPurchased: creditAmount,
        cost: creditAmount * 0.05,
        newLimit: newLimit,
        remainingPurchaseCapacity: planConfig.maxCredits - newLimit
      };
    } catch (error) {
      console.error('[CREDITS] Error purchasing credits:', error);
      throw error;
    }
  }

  /**
   * Get available plans for user
   */
  getAvailablePlans() {
    return Object.entries(this.plans).map(([key, config]) => ({
      id: key,
      ...config,
      pricePerCredit: 0.05
    }));
  }

  /**
   * Get user's plan info with credit status
   */
  async getUserPlanStatus(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const planId = user.plan || 'free-trial';
      const planConfig = this.plans[planId] || {
        ...(this.plans['enterprise'] || {}),
        name: planId.charAt(0).toUpperCase() + planId.slice(1),
        initialCredits: user.creditBalance ?? user.trialCreditsLimit ?? 999999,
        maxCredits: 999999,
        maxAgents: user.maxAgents ?? 999,
        maxConcurrency: user.maxConcurrency ?? 999,
        canPurchaseMore: true,
        creditPackages: []
      };

      // New credit balance system takes priority
      if (user.creditBalance !== undefined) {
        const remainingCredits = Math.max(0, user.creditBalance);
        return {
          plan: {
            id: planId,
            remainingCredits,
            ...planConfig
          },
          credits: {
            used: null,
            limit: null,
            remaining: remainingCredits,
            percentageUsed: null
          },
          canPurchaseMore: planConfig.canPurchaseMore,
          purchaseOptions: planConfig.canPurchaseMore ? planConfig.creditPackages : [],
          maxAdditionalCredits: planConfig.canPurchaseMore ? planConfig.maxCredits : 0,
          pendingCancel: user.pendingCancel || false,
          pendingCancelAt: user.pendingCancelAt || null,
          pendingDowngrade: user.pendingDowngrade || null,
          pendingDowngradeAt: user.pendingDowngradeAt || null,
        };
      }

      // Legacy trial credits system
      const creditsUsed = user.trialCreditsUsed ?? 0;
      // Only block if trialEligible is false AND no explicit limit has been set above the plan default.
      // If an admin or purchase explicitly raised trialCreditsLimit, honour it regardless of eligibility.
      const explicitLimit = Number(user.trialCreditsLimit ?? 0);
      const creditsLimit = (this.isTrialBlockedUser(user) && explicitLimit <= 0)
        ? 0
        : Math.max(explicitLimit, planConfig.initialCredits);
      const remainingCredits = creditsLimit - creditsUsed;

      return {
        plan: {
          id: planId,
          remainingCredits: remainingCredits,
          ...planConfig
        },
        credits: {
          used: creditsUsed,
          limit: creditsLimit,
          remaining: remainingCredits,
          percentageUsed: (creditsUsed / creditsLimit) * 100
        },
        canPurchaseMore: planConfig.canPurchaseMore,
        purchaseOptions: planConfig.canPurchaseMore ? planConfig.creditPackages : [],
        maxAdditionalCredits: planConfig.canPurchaseMore ? planConfig.maxCredits - creditsLimit : 0
      };
    } catch (error) {
      console.error('[PLANS] Error getting user plan status:', error);
      throw error;
    }
  }
  // ============================================================
  // CRM CONTACTS TABLE
  // ============================================================

  async saveCRMContacts(userId, contacts = []) {
    if (!contacts.length) return { success: true };
    const now = new Date().toISOString();
    // Use UpdateCommand with if_not_exists(status) so re-importing never resets 'queued' → 'fresh'
    const chunks = [];
    for (let i = 0; i < contacts.length; i += 25) chunks.push(contacts.slice(i, i + 25));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(c => this.dynamodb.send(new UpdateCommand({
        TableName: this.tables.crmContacts,
        Key: { userId, contactId: c.crmId || c.email },
        UpdateExpression: [
          'SET email = :email',
          'firstName = :fn',
          'lastName = :ln',
          'title = :ti',
          'phone = :ph',
          'company = :co',
          '#src = :src',
          '#status = if_not_exists(#status, :queued)',
          'savedAt = :now',
        ].join(', '),
        ExpressionAttributeNames: { '#src': 'source', '#status': 'status' },
        ExpressionAttributeValues: {
          ':email':  c.email     || '',
          ':fn':     c.firstName || '',
          ':ln':     c.lastName  || '',
          ':ti':     c.title     || '',
          ':ph':     c.phone     || '',
          ':co':     c.company   || '',
          ':src':    c.source    || 'crm',
          ':queued': 'fresh',
          ':now':    now,
        },
      }))))
    }
    return { success: true };
  }

  async getCRMContacts(userId) {
    const res = await this.dynamodb.send(new QueryCommand({
      TableName: this.tables.crmContacts,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false,
    }));
    return res.Items || [];
  }

  async updateCRMContactStatus(userId, contactId, status) {
    const now = new Date().toISOString();
    const isAssigning = status === 'queued';
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.crmContacts,
      Key: { userId, contactId },
      UpdateExpression: isAssigning
        ? 'SET #s = :s, updatedAt = :t, assignedAt = if_not_exists(assignedAt, :t)'
        : 'SET #s = :s, updatedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':t': now },
    }));
    return { success: true };
  }

  async deleteCRMContact(userId, contactId) {
    await this.dynamodb.send(new DeleteCommand({
      TableName: this.tables.crmContacts,
      Key: { userId, contactId },
    }));
    return { success: true };
  }

  async clearCRMContacts(userId) {
    const contacts = await this.getCRMContacts(userId);
    if (!contacts.length) return { success: true };
    const chunks = [];
    for (let i = 0; i < contacts.length; i += 25) chunks.push(contacts.slice(i, i + 25));
    for (const chunk of chunks) {
      await this.dynamodb.send(new BatchWriteCommand({
        RequestItems: {
          [this.tables.crmContacts]: chunk.map(c => ({
            DeleteRequest: { Key: { userId, contactId: c.contactId } }
          }))
        }
      }));
    }
    return { success: true };
  }

  // Auditor state stored as a field on the user record
  async saveAuditorState(userId, patch = {}) {
    const user = await this.getUserById(userId);
    const existing = user?.auditorState || {};
    await this.updateUser(userId, {
      auditorState: { ...existing, ...patch, updatedAt: new Date().toISOString() }
    });
    return { success: true };
  }

  async getAuditorState(userId) {
    const user = await this.getUserById(userId);
    return user?.auditorState || null;
  }

  async clearAuditorState(userId) {
    await this.updateUser(userId, { auditorState: null });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEAD SOURCE BANDIT — Thompson Sampling persistence
  //
  // Table: meridian-lead-source-bandit
  //   PK: userId (string)
  //   SK: keyword#sourceId (string)  e.g. "saas#apollo"
  //   alpha: number  — success count (non-duplicate, valid leads)
  //   beta:  number  — failure count (duplicates, invalid emails)
  //
  // These two methods are the only DB surface the LeadSourceBandit class needs.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load all bandit stat rows for a user.
   * Returns an array of { userId, sk, keyword, sourceId, alpha, beta }.
   * Returns [] (not throws) if the table is empty or does not exist yet.
   */
  async getBanditStats(userId) {
    try {
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tables.leadSourceBandit,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }));
      return result.Items || [];
    } catch (error) {
      // Table may not exist yet on first run — treat as empty
      console.warn('[AWS] getBanditStats failed (table may not exist yet):', error.message);
      return [];
    }
  }

  /**
   * Upsert an array of bandit stat rows.
   * Each item must have: { userId, sk, keyword, sourceId, alpha, beta }.
   * Uses BatchWrite in chunks of 25 (DynamoDB limit).
   */
  async clearBanditStats(userId) {
    const rows = await this.getBanditStats(userId);
    if (!rows.length) return { deleted: 0 };
    const chunks = [];
    for (let i = 0; i < rows.length; i += 25) chunks.push(rows.slice(i, i + 25));
    for (const chunk of chunks) {
      await this.dynamodb.send(new BatchWriteCommand({
        RequestItems: {
          [this.tables.leadSourceBandit]: chunk.map(r => ({
            DeleteRequest: { Key: { userId: r.userId, sk: r.sk } }
          }))
        }
      }));
    }
    return { deleted: rows.length };
  }

  async putBanditStats(rows) {
    if (!rows || rows.length === 0) return;

    // DynamoDB BatchWrite limit is 25 items per call
    const chunks = [];
    for (let i = 0; i < rows.length; i += 25) {
      chunks.push(rows.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      const requestItems = chunk.map(row => ({
        PutRequest: {
          Item: {
            userId: row.userId,
            sk: row.sk,           // "keyword#sourceId"
            keyword: row.keyword,
            sourceId: row.sourceId,
            alpha: row.alpha,
            beta: row.beta,
            updatedAt: new Date().toISOString()
          }
        }
      }));

      await this.dynamodb.send(new BatchWriteCommand({
        RequestItems: {
          [this.tables.leadSourceBandit]: requestItems
        }
      }));
    }
  }

  // ==================
  // TEAMS METHODS
  // ==================

  async createTeam(ownerId, ownerEmail, ownerUsername, teamName) {
    const { v4: uuidv4 } = await import('uuid');
    const teamId = uuidv4();
    const inviteToken = uuidv4();
    const now = new Date().toISOString();

    const team = {
      teamId,
      name: teamName || `${ownerUsername}'s Team`,
      ownerId,
      inviteToken,
      members: [{ userId: ownerId, email: ownerEmail, username: ownerUsername, role: 'owner', joinedAt: now }],
      createdAt: now,
    };

    await this.dynamodb.send(new PutCommand({ TableName: this.tables.teams, Item: team }));

    // Mark owner's user record with teamId and role
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.users,
      Key: { userId: ownerId },
      UpdateExpression: 'SET teamId = :tid, teamRole = :role',
      ExpressionAttributeValues: { ':tid': teamId, ':role': 'owner' },
    }));

    return team;
  }

  async getTeam(teamId) {
    const result = await this.dynamodb.send(new GetCommand({ TableName: this.tables.teams, Key: { teamId } }));
    return result.Item || null;
  }

  async getTeamByInviteToken(inviteToken) {
    const result = await this.dynamodb.send(new ScanCommand({
      TableName: this.tables.teams,
      FilterExpression: 'inviteToken = :t',
      ExpressionAttributeValues: { ':t': inviteToken },
    }));
    return result.Items?.[0] || null;
  }

  async getTeamByUserId(userId) {
    const user = await this.getUserById(userId);
    if (!user?.teamId) return null;
    return this.getTeam(user.teamId);
  }

  async addTeamMember(teamId, memberUser, role = 'member') {
    const now = new Date().toISOString();
    const newMember = {
      userId: memberUser.userId,
      email: memberUser.email,
      username: memberUser.username,
      role,
      joinedAt: now,
    };

    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');

    const members = [...(team.members || []), newMember];

    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.teams,
      Key: { teamId },
      UpdateExpression: 'SET members = :m',
      ExpressionAttributeValues: { ':m': members },
    }));

    // Update member's user record to proxy to the team owner
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.users,
      Key: { userId: memberUser.userId },
      UpdateExpression: 'SET teamId = :tid, teamRole = :role, proxyUserId = :proxy',
      ExpressionAttributeValues: { ':tid': teamId, ':role': role, ':proxy': team.ownerId },
    }));

    return { ...team, members };
  }

  async removeTeamMember(teamId, memberId) {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');

    const members = (team.members || []).filter(m => m.userId !== memberId);

    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.teams,
      Key: { teamId },
      UpdateExpression: 'SET members = :m',
      ExpressionAttributeValues: { ':m': members },
    }));

    // Clear team fields from removed member's user record
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.users,
      Key: { userId: memberId },
      UpdateExpression: 'REMOVE teamId, teamRole, proxyUserId',
    }));
  }

  async updateTeamMemberRole(teamId, memberId, role) {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');

    const members = (team.members || []).map(m => m.userId === memberId ? { ...m, role } : m);

    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.teams,
      Key: { teamId },
      UpdateExpression: 'SET members = :m',
      ExpressionAttributeValues: { ':m': members },
    }));

    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.users,
      Key: { userId: memberId },
      UpdateExpression: 'SET teamRole = :role',
      ExpressionAttributeValues: { ':role': role },
    }));
  }

  async refreshTeamInviteToken(teamId) {
    const { v4: uuidv4 } = await import('uuid');
    const inviteToken = uuidv4();
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tables.teams,
      Key: { teamId },
      UpdateExpression: 'SET inviteToken = :t',
      ExpressionAttributeValues: { ':t': inviteToken },
    }));
    return inviteToken;
  }

  async disbandTeam(teamId) {
    const team = await this.getTeam(teamId);
    if (!team) return;

    // Clear team fields from all members
    await Promise.all((team.members || []).map(m =>
      this.dynamodb.send(new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId: m.userId },
        UpdateExpression: 'REMOVE teamId, teamRole, proxyUserId',
      }))
    ));

    await this.dynamodb.send(new DeleteCommand({ TableName: this.tables.teams, Key: { teamId } }));
  }
}

export default AWSManager;
