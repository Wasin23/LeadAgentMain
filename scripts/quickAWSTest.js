import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Debugging AWS Configuration:');
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set ✓' : 'Not set ✗');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set ✓' : 'Not set ✗');

async function quickTest() {
  try {
    console.log('\n🔧 Creating DynamoDB client...');
    
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    console.log('✅ Client created, testing connection...');
    
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    
    console.log('✅ AWS Connection successful!');
    console.log('📋 Existing tables:', response.TableNames || []);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.name);
  }
}

quickTest();