import 'dotenv/config';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const tableName = process.env.AWS_DYNAMODB_CRM_CONTACTS_TABLE || 'meridian-crm-contacts';

console.log(`🔍 Checking for table: ${tableName}`);

try {
  await client.send(new DescribeTableCommand({ TableName: tableName }));
  console.log(`✅ Table '${tableName}' already exists — nothing to do.`);
} catch (err) {
  if (err.name === 'ResourceNotFoundException') {
    console.log(`📦 Creating table '${tableName}'...`);
    await client.send(new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId',    KeyType: 'HASH'  },
        { AttributeName: 'contactId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId',    AttributeType: 'S' },
        { AttributeName: 'contactId', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Project', Value: 'Meridian' },
        { Key: 'Purpose', Value: 'CRMContacts' },
      ],
    }));
    console.log(`✅ Table '${tableName}' created successfully.`);
  } else {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}
