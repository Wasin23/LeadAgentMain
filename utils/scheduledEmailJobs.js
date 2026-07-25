import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

class ScheduledEmailJobs {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';

    this.ddbClient = new DynamoDBClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });

    this.dynamodb = DynamoDBDocumentClient.from(this.ddbClient, {
      marshallOptions: { removeUndefinedValues: true }
    });

    this.tableName = process.env.AWS_DYNAMODB_SCHEDULED_EMAILS_TABLE || 'meridian-scheduled-email-jobs';
    this.dueDateIndex = 'DueDateIndex';
    this.ensureTablePromise = null;
  }

  _getEmailPK(userId, agentId, emailId) {
    return `EMAIL#${userId}#${agentId}#${emailId}`;
  }

  _getScheduledDay(scheduledAt) {
    return new Date(scheduledAt).toISOString().slice(0, 10);
  }

  _getDueDatePK(scheduledAt) {
    return `DAY#${this._getScheduledDay(scheduledAt)}`;
  }

  _getDueDateSK(scheduledAt, userId, agentId, emailId) {
    return `${scheduledAt}#${userId}#${agentId}#${emailId}`;
  }

  async _retryWithBackoff(operation, maxRetries = 3) {
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        const isThrottleError = error.name === 'ProvisionedThroughputExceededException' ||
          error.name === 'ThrottlingException' ||
          error.__type === 'com.amazonaws.dynamodb.v20120810#ProvisionedThroughputExceededException';

        if (!isThrottleError || retries === maxRetries) {
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries += 1;
      }
    }
  }

  async ensureTableExists() {
    if (this.ensureTablePromise) {
      return this.ensureTablePromise;
    }

    this.ensureTablePromise = (async () => {
      try {
        await this.ddbClient.send(new DescribeTableCommand({ TableName: this.tableName }));
        return;
      } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      try {
        await this.ddbClient.send(new CreateTableCommand({
          TableName: this.tableName,
          AttributeDefinitions: [
            { AttributeName: 'PK', AttributeType: 'S' },
            { AttributeName: 'SK', AttributeType: 'S' },
            { AttributeName: 'GSIPK', AttributeType: 'S' },
            { AttributeName: 'GSISK', AttributeType: 'S' }
          ],
          KeySchema: [
            { AttributeName: 'PK', KeyType: 'HASH' },
            { AttributeName: 'SK', KeyType: 'RANGE' }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          GlobalSecondaryIndexes: [
            {
              IndexName: this.dueDateIndex,
              KeySchema: [
                { AttributeName: 'GSIPK', KeyType: 'HASH' },
                { AttributeName: 'GSISK', KeyType: 'RANGE' }
              ],
              Projection: { ProjectionType: 'ALL' }
            }
          ]
        }));
      } catch (error) {
        if (error.name !== 'ResourceInUseException') {
          throw error;
        }
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          const response = await this.ddbClient.send(new DescribeTableCommand({ TableName: this.tableName }));
          if (response.Table?.TableStatus === 'ACTIVE') {
            return;
          }
        } catch (error) {
          if (error.name !== 'ResourceNotFoundException') {
            throw error;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new Error(`Scheduled email jobs table ${this.tableName} did not become ACTIVE in time`);
    })();

    try {
      await this.ensureTablePromise;
    } catch (error) {
      this.ensureTablePromise = null;
      throw error;
    }
  }

  // `type` distinguishes a main queued email ('main', the default — unchanged behavior)
  // from a follow-up ('followup'). Follow-ups aren't QUEUED items, so `payload` carries
  // everything utils/emailScheduler.js needs to actually send one at fire time (to,
  // subject, body, replyOptions, originalEmailId, stepNumber) — built once by
  // utils/rebumpChecker.js when it decides the follow-up is eligible, not regenerated here.
  async upsertScheduledEmail({ userId, agentId, emailId, scheduledAt, scheduleType = 'manual', type = 'main', payload = {} }) {
    if (!scheduledAt) {
      return;
    }

    await this.ensureTableExists();

    const now = new Date().toISOString();
    const ttl = Math.floor((new Date(scheduledAt).getTime() + (30 * 24 * 60 * 60 * 1000)) / 1000);

    await this._retryWithBackoff(async () => {
      await this.dynamodb.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this._getEmailPK(userId, agentId, emailId),
          SK: 'JOB',
          GSIPK: this._getDueDatePK(scheduledAt),
          GSISK: this._getDueDateSK(scheduledAt, userId, agentId, emailId),
          id: emailId,
          userId,
          agentId,
          emailId,
          scheduledAt,
          scheduleType,
          type,
          ...payload,
          scheduledDay: this._getScheduledDay(scheduledAt),
          updatedAt: now,
          createdAt: now,
          ttl,
        }
      }));
    });
  }

  async deleteScheduledEmail(userId, agentId, emailId) {
    await this.ensureTableExists();

    await this._retryWithBackoff(async () => {
      await this.dynamodb.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: this._getEmailPK(userId, agentId, emailId),
          SK: 'JOB'
        }
      }));
    });
  }

  async getDueScheduledEmails(nowIso = new Date().toISOString(), lookbackDays = 7) {
    await this.ensureTableExists();

    const now = new Date(nowIso);
    const dayBuckets = [];
    for (let offset = 0; offset <= lookbackDays; offset += 1) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - offset);
      dayBuckets.push(day.toISOString().slice(0, 10));
    }

    const items = [];
    for (let index = 0; index < dayBuckets.length; index += 1) {
      const day = dayBuckets[index];
      let lastEvaluatedKey = null;

      do {
        const queryInput = {
          TableName: this.tableName,
          IndexName: this.dueDateIndex,
          KeyConditionExpression: index === 0 ? 'GSIPK = :gsipk AND GSISK <= :upperBound' : 'GSIPK = :gsipk',
          ExpressionAttributeValues: index === 0
            ? {
                ':gsipk': `DAY#${day}`,
                ':upperBound': `${nowIso}~`
              }
            : {
                ':gsipk': `DAY#${day}`
              },
          ScanIndexForward: true,
        };

        if (lastEvaluatedKey) {
          queryInput.ExclusiveStartKey = lastEvaluatedKey;
        }

        const response = await this._retryWithBackoff(async () => {
          return this.dynamodb.send(new QueryCommand(queryInput));
        });

        items.push(...(response.Items || []));
        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }

    return items;
  }

  async getScheduledJobsForUser(userId, options = {}) {
    await this.ensureTableExists();

    const items = [];
    let lastEvaluatedKey = null;
    const nowIso = options.nowIso || new Date().toISOString();

    do {
      const scanInput = {
        TableName: this.tableName,
        FilterExpression: 'userId = :userId AND scheduledAt >= :now',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':now': nowIso
        },
      };

      if (lastEvaluatedKey) {
        scanInput.ExclusiveStartKey = lastEvaluatedKey;
      }

      const response = await this._retryWithBackoff(async () => {
        return this.dynamodb.send(new ScanCommand(scanInput));
      });

      items.push(...(response.Items || []));
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    items.sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());

    if (options.limit) {
      return items.slice(0, options.limit);
    }

    return items;
  }
}

let instance = null;

export function getScheduledEmailJobs() {
  if (!instance) {
    instance = new ScheduledEmailJobs();
  }

  return instance;
}

export default ScheduledEmailJobs;