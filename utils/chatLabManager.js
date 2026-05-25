import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { randomUUID } from 'crypto';

// ── Table names ───────────────────────────────────────────────────────────────
//
// meridian-chat-sessions
//   PK: USER#<userId>
//   SK: SESSION#<createdAt_iso>#<sessionId>      ← sortable by time
//   GSI (AgentIndex): agentId (HASH) + createdAt (RANGE)
//
// meridian-chat-prompts
//   PK: USER#<userId>#AGENT#<agentId>
//   SK: VERSION#<zero-padded-version>            ← latest = highest SK
//
// meridian-chat-tokens
//   PK: token (UUID)                             ← looked up directly by token
//   Fields: userId, agentId, leadId, emailId,
//           leadName, leadCompany, leadTitle, leadEmail,
//           createdAt, expiresAt (30 days), firstClickAt, clickCount

class ChatLabManager {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';

    const ddbClient = new DynamoDBClient({
      region: this.region,
      credentials: fromNodeProviderChain(),
    });

    this.dynamodb = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.rawClient = ddbClient;

    this.sessionTable = process.env.AWS_DYNAMODB_CHAT_SESSIONS_TABLE || 'meridian-chat-sessions';
    this.promptTable  = process.env.AWS_DYNAMODB_CHAT_PROMPTS_TABLE  || 'meridian-chat-prompts';
    this.tokenTable   = 'meridian-chat-tokens';

    this._sessionTableReady = null;
    this._promptTableReady  = null;
    this._tokenTableReady   = null;
  }

  // ── Table bootstrap ─────────────────────────────────────────────────────────

  async _ensureTable(tableName, createParams) {
    try {
      await this.rawClient.send(new DescribeTableCommand({ TableName: tableName }));
      return;
    } catch (err) {
      if (err.name !== 'ResourceNotFoundException') throw err;
    }

    try {
      await this.rawClient.send(new CreateTableCommand(createParams));
    } catch (err) {
      if (err.name !== 'ResourceInUseException') throw err;
    }

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res = await this.rawClient.send(new DescribeTableCommand({ TableName: tableName }));
        if (res.Table?.TableStatus === 'ACTIVE') return;
      } catch { /* keep waiting */ }
    }
    throw new Error(`Table ${tableName} did not become ACTIVE in time`);
  }

  ensureSessionTable() {
    if (!this._sessionTableReady) {
      this._sessionTableReady = this._ensureTable(this.sessionTable, {
        TableName: this.sessionTable,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK',        AttributeType: 'S' },
          { AttributeName: 'SK',        AttributeType: 'S' },
          { AttributeName: 'agentId',   AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'AgentIndex',
            KeySchema: [
              { AttributeName: 'agentId',   KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }).catch(err => { this._sessionTableReady = null; throw err; });
    }
    return this._sessionTableReady;
  }

  ensureTokenTable() {
    if (!this._tokenTableReady) {
      this._tokenTableReady = this._ensureTable(this.tokenTable, {
        TableName: this.tokenTable,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'token', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'token', KeyType: 'HASH' },
        ],
      }).catch(err => { this._tokenTableReady = null; throw err; });
    }
    return this._tokenTableReady;
  }

  ensurePromptTable() {
    if (!this._promptTableReady) {
      this._promptTableReady = this._ensureTable(this.promptTable, {
        TableName: this.promptTable,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
      }).catch(err => { this._promptTableReady = null; throw err; });
    }
    return this._promptTableReady;
  }

  // ── Key helpers ─────────────────────────────────────────────────────────────

  _sessionPK(userId)                  { return `USER#${userId}`; }
  _sessionSK(createdAt, sessionId)    { return `SESSION#${createdAt}#${sessionId}`; }
  _promptPK(userId, agentId)          { return `USER#${userId}#AGENT#${agentId}`; }
  _promptSK(version)                  { return `VERSION#${String(version).padStart(6, '0')}`; }

  // ── Session methods ─────────────────────────────────────────────────────────

  /**
   * Create a new chat session. Returns the sessionId.
   * Call this when a lead clicks their chat link and a session is initialized.
   */
  async createSession(userId, { agentId, leadId, emailId, leadName, leadCompany, leadTitle, token, researchSnapshot = null }) {
    await this.ensureSessionTable();
    const sessionId = randomUUID();
    const createdAt = new Date().toISOString();
    const item = {
      PK:               this._sessionPK(userId),
      SK:               this._sessionSK(createdAt, sessionId),
      sessionId,
      userId,
      agentId:          agentId      || null,
      leadId:           leadId       || null,
      emailId:          emailId      || null,
      token:            token        || null,
      leadName:         leadName     || 'Unknown',
      leadCompany:      leadCompany  || '',
      leadTitle:        leadTitle    || '',
      researchSnapshot: researchSnapshot || null,
      status:           'active',
      intentScore:      0,
      messageCount:     0,
      messages:         [],
      topics:           [],
      signals:          [],
      createdAt,
      updatedAt:        createdAt,
      lastActive:       createdAt,
    };
    await this.dynamodb.send(new PutCommand({ TableName: this.sessionTable, Item: item }));
    return { sessionId, createdAt };
  }

  /**
   * Append a message to an existing session and update intent score.
   */
  async addMessage(userId, sessionId, createdAt, { role, content, intentScore, topics = [], signals = [] }) {
    await this.ensureSessionTable();
    const now = new Date().toISOString();
    const message = { role, content, intentScore: intentScore || 0, topics, signals, timestamp: now };

    await this.dynamodb.send(new UpdateCommand({
      TableName: this.sessionTable,
      Key: {
        PK: this._sessionPK(userId),
        SK: this._sessionSK(createdAt, sessionId),
      },
      UpdateExpression: `
        SET messages     = list_append(if_not_exists(messages, :empty), :msg),
            messageCount = if_not_exists(messageCount, :zero) + :one,
            intentScore  = :intent,
            lastActive   = :now,
            updatedAt    = :now,
            topics       = :topics,
            signals      = :signals
      `,
      ExpressionAttributeValues: {
        ':msg':    [message],
        ':empty':  [],
        ':zero':   0,
        ':one':    1,
        ':intent': intentScore || 0,
        ':now':    now,
        ':topics': topics,
        ':signals': signals,
      },
    }));
  }

  /**
   * Update the researchSnapshot on a session (user-edited context).
   */
  async updateSessionSnapshot(userId, sessionId, createdAt, researchSnapshot) {
    await this.ensureSessionTable();
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.sessionTable,
      Key: {
        PK: this._sessionPK(userId),
        SK: this._sessionSK(createdAt, sessionId),
      },
      UpdateExpression: 'SET researchSnapshot = :snap, updatedAt = :now',
      ExpressionAttributeValues: {
        ':snap': researchSnapshot,
        ':now':  new Date().toISOString(),
      },
    }));
  }

  /**
   * Mark a session as ended.
   */
  async endSession(userId, sessionId, createdAt) {
    await this.ensureSessionTable();
    await this.dynamodb.send(new UpdateCommand({
      TableName: this.sessionTable,
      Key: {
        PK: this._sessionPK(userId),
        SK: this._sessionSK(createdAt, sessionId),
      },
      UpdateExpression: 'SET #status = :s, updatedAt = :now',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':s': 'ended', ':now': new Date().toISOString() },
    }));
  }

  /**
   * Get a single session.
   */
  async getSession(userId, sessionId, createdAt) {
    await this.ensureSessionTable();
    const res = await this.dynamodb.send(new GetCommand({
      TableName: this.sessionTable,
      Key: {
        PK: this._sessionPK(userId),
        SK: this._sessionSK(createdAt, sessionId),
      },
    }));
    return res.Item || null;
  }

  /**
   * List all sessions for a user, newest first. Optional agentId filter.
   */
  async listSessions(userId, { agentId, limit = 50 } = {}) {
    await this.ensureSessionTable();

    if (agentId) {
      const res = await this.dynamodb.send(new QueryCommand({
        TableName: this.sessionTable,
        IndexName: 'AgentIndex',
        KeyConditionExpression: 'agentId = :a',
        ExpressionAttributeValues: { ':a': agentId },
        ScanIndexForward: false,
        Limit: limit,
      }));
      return res.Items || [];
    }

    const res = await this.dynamodb.send(new QueryCommand({
      TableName: this.sessionTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     this._sessionPK(userId),
        ':prefix': 'SESSION#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return res.Items || [];
  }

  /**
   * Count total sessions for a user (for the dashboard counter).
   * Uses a lightweight query that only fetches keys.
   */
  async getSessionCount(userId) {
    await this.ensureSessionTable();
    const res = await this.dynamodb.send(new QueryCommand({
      TableName: this.sessionTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     this._sessionPK(userId),
        ':prefix': 'SESSION#',
      },
      Select: 'COUNT',
    }));
    return res.Count || 0;
  }

  // ── System Prompt methods ───────────────────────────────────────────────────

  /**
   * Save a new version of the system prompt for an agent.
   * Automatically increments version number.
   * Returns the new version number.
   */
  async saveSystemPrompt(userId, agentId, promptText) {
    await this.ensurePromptTable();

    // Get current highest version
    const existing = await this.listPromptVersions(userId, agentId, 1);
    const nextVersion = existing.length > 0 ? (existing[0].version + 1) : 1;
    const now = new Date().toISOString();

    await this.dynamodb.send(new PutCommand({
      TableName: this.promptTable,
      Item: {
        PK:         this._promptPK(userId, agentId),
        SK:         this._promptSK(nextVersion),
        userId,
        agentId,
        version:    nextVersion,
        promptText,
        createdAt:  now,
        updatedAt:  now,
      },
    }));

    return nextVersion;
  }

  /**
   * Get the current (latest) system prompt for an agent.
   */
  async getSystemPrompt(userId, agentId) {
    await this.ensurePromptTable();
    const versions = await this.listPromptVersions(userId, agentId, 1);
    return versions[0] || null;
  }

  /**
   * List prompt versions for an agent, newest first.
   */
  async listPromptVersions(userId, agentId, limit = 20) {
    await this.ensurePromptTable();
    const res = await this.dynamodb.send(new QueryCommand({
      TableName: this.promptTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     this._promptPK(userId, agentId),
        ':prefix': 'VERSION#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return res.Items || [];
  }

  /**
   * Get a specific version of a system prompt.
   */
  async getSystemPromptVersion(userId, agentId, version) {
    await this.ensurePromptTable();
    const res = await this.dynamodb.send(new GetCommand({
      TableName: this.promptTable,
      Key: {
        PK: this._promptPK(userId, agentId),
        SK: this._promptSK(version),
      },
    }));
    return res.Item || null;
  }

  /**
   * Delete a specific prompt version.
   */
  async deletePromptVersion(userId, agentId, version) {
    await this.ensurePromptTable();
    await this.dynamodb.send(new DeleteCommand({
      TableName: this.promptTable,
      Key: {
        PK: this._promptPK(userId, agentId),
        SK: this._promptSK(version),
      },
    }));
  }

  // ── Chat Token methods ──────────────────────────────────────────────────────

  /**
   * Create a one-time chat link token for a lead.
   * Returns { token, url } — url is the full link to embed in the email.
   */
  async createChatToken(userId, { agentId, leadId, emailId, leadName, leadCompany, leadTitle, leadEmail, researchSnapshot = null }) {
    await this.ensureTokenTable();
    const token     = randomUUID();
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    await this.dynamodb.send(new PutCommand({
      TableName: this.tokenTable,
      Item: {
        token,
        userId,
        agentId:          agentId          || null,
        leadId:           leadId           || null,
        emailId:          emailId          || null,
        leadName:         leadName         || 'Guest',
        leadCompany:      leadCompany      || '',
        leadTitle:        leadTitle        || '',
        leadEmail:        leadEmail        || '',
        researchSnapshot: researchSnapshot || null,
        createdAt:        now.toISOString(),
        expiresAt,
        firstClickAt:     null,
        clickCount:       0,
      },
    }));
    const baseUrl = process.env.FRONTEND_URL || 'https://meridianprospects.com';
    return { token, url: `${baseUrl}/meet/${token}` };
  }

  /**
   * Resolve a token — validate it's not expired, record the click, return the data.
   * Returns null if token doesn't exist or is expired.
   */
  async resolveToken(token) {
    await this.ensureTokenTable();
    const res = await this.dynamodb.send(new GetCommand({
      TableName: this.tokenTable,
      Key: { token },
    }));
    const item = res.Item;
    if (!item) return null;
    if (new Date(item.expiresAt) < new Date()) return null;

    const now = new Date().toISOString();
    const isFirstClick = !item.firstClickAt;

    await this.dynamodb.send(new UpdateCommand({
      TableName: this.tokenTable,
      Key: { token },
      UpdateExpression: 'SET clickCount = if_not_exists(clickCount, :zero) + :one, firstClickAt = if_not_exists(firstClickAt, :now)',
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now },
    }));

    return { ...item, isFirstClick };
  }

  /**
   * Get token metadata without recording a click (for admin views).
   */
  async getToken(token) {
    await this.ensureTokenTable();
    const res = await this.dynamodb.send(new GetCommand({
      TableName: this.tokenTable,
      Key: { token },
    }));
    return res.Item || null;
  }
}

export const chatLabManager = new ChatLabManager();
