import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const ddbClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = 'meridian-email-tracking';

async function checkTableSchema() {
  try {
    console.log(`📊 Checking table schema for: ${tableName}\n`);
    
    const command = new DescribeTableCommand({ TableName: tableName });
    const result = await ddbClient.send(command);
    
    console.log('🔑 Key Schema:');
    console.log(JSON.stringify(result.Table.KeySchema, null, 2));
    
    console.log('\n📋 Attribute Definitions:');
    console.log(JSON.stringify(result.Table.AttributeDefinitions, null, 2));
    
    console.log('\n✅ Table Status:', result.Table.TableStatus);
    console.log('📈 Item Count:', result.Table.ItemCount);
    
    // Get a sample item to see actual structure
    console.log('\n📄 Fetching sample item...');
    const scanCommand = new ScanCommand({
      TableName: tableName,
      Limit: 1
    });
    const scanResult = await docClient.send(scanCommand);
    
    if (scanResult.Items && scanResult.Items.length > 0) {
      console.log('\n🔍 Sample item keys:');
      console.log(Object.keys(scanResult.Items[0]));
      console.log('\n🔍 Sample item:');
      console.log(JSON.stringify(scanResult.Items[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Make sure AWS credentials are configured in .env:');
    console.error('   - AWS_ACCESS_KEY_ID');
    console.error('   - AWS_SECRET_ACCESS_KEY');
    console.error('   - AWS_REGION');
  }
}

checkTableSchema();
