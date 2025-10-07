import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

console.log('🔍 Checking AWS Configuration:');
console.log('Region:', process.env.AWS_REGION);
console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID?.substring(0, 10) + '...');
console.log('');

async function checkTables() {
  try {
    console.log('📋 Listing all tables in region:', process.env.AWS_REGION);
    const listResponse = await client.send(new ListTablesCommand({}));
    
    console.log('Found tables:', listResponse.TableNames);
    console.log('Table count:', listResponse.TableNames?.length || 0);
    
    if (listResponse.TableNames?.length > 0) {
      console.log('\n📊 Table Details:');
      for (const tableName of listResponse.TableNames) {
        try {
          const describeResponse = await client.send(new DescribeTableCommand({ TableName: tableName }));
          console.log(`✅ ${tableName}`);
          console.log(`   Status: ${describeResponse.Table.TableStatus}`);
          console.log(`   Items: ${describeResponse.Table.ItemCount || 0}`);
          console.log(`   Created: ${describeResponse.Table.CreationDateTime}`);
        } catch (err) {
          console.log(`❌ Error describing ${tableName}:`, err.message);
        }
      }
    } else {
      console.log('❌ No tables found in this region');
      console.log('');
      console.log('Possible issues:');
      console.log('1. Wrong AWS region - check if tables are in a different region');
      console.log('2. Tables were deleted');
      console.log('3. Permissions issue');
      console.log('4. Tables never created successfully');
    }
  } catch (error) {
    console.error('❌ Error listing tables:', error.message);
    console.error('Error code:', error.name);
    console.error('Error details:', error);
  }
}

checkTables();