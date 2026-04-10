import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'us-east-1' 
  });
  
  const command = new ScanCommand({ 
    TableName: 'meridian-contacted-leads' 
  });
  
  try {
    const result = await client.send(command);
    console.log(`📊 Contacted leads in database: ${result.Items.length}`);
    
    if (result.Items.length === 0) {
      console.log('📭 Database is empty');
    } else {
      result.Items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item.contactKey?.S} - ${item.name?.S} (${item.email?.S})`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

checkDatabase();