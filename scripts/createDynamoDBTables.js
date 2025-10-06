import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, DescribeTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class DynamoDBTableCreator {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.dynamodb = new DynamoDBClient({
      region: this.region,
      credentials: fromNodeProviderChain()
    });
    
    this.tablePrefix = 'examark-';
  }

  async createUserSettingsTable() {
    const tableName = process.env.AWS_DYNAMODB_USER_SETTINGS_TABLE || 'examark-user-settings';
    
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Project', Value: 'ExaMark' },
        { Key: 'Environment', Value: 'Production' }
      ]
    };

    return await this.createTable(params);
  }

  async createAgentSettingsTable() {
    const tableName = process.env.AWS_DYNAMODB_AGENT_SETTINGS_TABLE || 'examark-agent-settings';
    
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'settingsType', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'settingsType', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Project', Value: 'ExaMark' },
        { Key: 'Environment', Value: 'Production' }
      ]
    };

    return await this.createTable(params);
  }

  async createLeadDataTable() {
    const tableName = process.env.AWS_DYNAMODB_LEAD_DATA_TABLE || 'examark-lead-data';
    
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'leadId', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'leadId', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'userId-createdAt-index',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Project', Value: 'ExaMark' },
        { Key: 'Environment', Value: 'Production' }
      ]
    };

    return await this.createTable(params);
  }

  async createEmailTrackingTable() {
    const tableName = process.env.AWS_DYNAMODB_EMAIL_TRACKING_TABLE || 'examark-email-tracking';
    
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'emailId', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'emailId', AttributeType: 'S' },
        { AttributeName: 'sentAt', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'userId-sentAt-index',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'sentAt', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'userId-status-index',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'status', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Project', Value: 'ExaMark' },
        { Key: 'Environment', Value: 'Production' }
      ]
    };

    return await this.createTable(params);
  }

  async createAgentStateTable() {
    const tableName = process.env.AWS_DYNAMODB_AGENT_STATE_TABLE || 'examark-agent-state';
    
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'agentId', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'agentId', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Project', Value: 'ExaMark' },
        { Key: 'Environment', Value: 'Production' }
      ]
    };

    return await this.createTable(params);
  }

  async createTable(params) {
    try {
      // Check if table already exists
      try {
        await this.dynamodb.send(new DescribeTableCommand({ TableName: params.TableName }));
        console.log(`✅ Table ${params.TableName} already exists`);
        return { exists: true, tableName: params.TableName };
      } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      console.log(`🔧 Creating table: ${params.TableName}...`);
      const result = await this.dynamodb.send(new CreateTableCommand(params));
      
      console.log(`✅ Table ${params.TableName} created successfully`);
      return { 
        created: true, 
        tableName: params.TableName,
        tableArn: result.TableDescription.TableArn 
      };
    } catch (error) {
      console.error(`❌ Error creating table ${params.TableName}:`, error);
      throw error;
    }
  }

  async createAllTables() {
    console.log('🚀 Starting DynamoDB table creation process...');
    console.log('🌍 Region:', this.region);
    
    const results = {
      userSettings: null,
      agentSettings: null,
      leadData: null,
      emailTracking: null,
      agentState: null
    };

    try {
      // Create all tables
      results.userSettings = await this.createUserSettingsTable();
      results.agentSettings = await this.createAgentSettingsTable();
      results.leadData = await this.createLeadDataTable();
      results.emailTracking = await this.createEmailTrackingTable();
      results.agentState = await this.createAgentStateTable();

      console.log('🎉 All tables created successfully!');
      console.log('📊 Summary:');
      
      Object.entries(results).forEach(([key, result]) => {
        if (result.created) {
          console.log(`   ✅ ${result.tableName} - CREATED`);
        } else if (result.exists) {
          console.log(`   ℹ️  ${result.tableName} - EXISTS`);
        }
      });

      return results;
    } catch (error) {
      console.error('❌ Failed to create tables:', error);
      throw error;
    }
  }

  async listExistingTables() {
    try {
      const result = await this.dynamodb.send(new ListTablesCommand({}));
      console.log('📋 Existing DynamoDB tables:');
      
      if (result.TableNames.length === 0) {
        console.log('   (No tables found)');
      } else {
        result.TableNames.forEach(tableName => {
          const isExaMarkTable = tableName.startsWith(this.tablePrefix);
          console.log(`   ${isExaMarkTable ? '🎯' : '📋'} ${tableName}`);
        });
      }
      
      return result.TableNames;
    } catch (error) {
      console.error('❌ Error listing tables:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const creator = new DynamoDBTableCreator();
  
  try {
    console.log('🔍 Checking existing tables...');
    await creator.listExistingTables();
    
    console.log('\n🛠️  Creating ExaMark DynamoDB tables...');
    const results = await creator.createAllTables();
    
    console.log('\n✅ Setup complete! AWS DynamoDB tables are ready for ExaMark.');
    return results;
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default DynamoDBTableCreator;