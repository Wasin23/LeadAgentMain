import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

async function clearDatabase() {
  const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'us-east-1' 
  });
  const docClient = DynamoDBDocumentClient.from(client);
  
  try {
    // First scan to get all items
    const scanCommand = new ScanCommand({ 
      TableName: 'meridian-contacted-leads' 
    });
    
    const result = await client.send(scanCommand);
    console.log(`🗑️ Found ${result.Items.length} contacts to delete`);
    
    if (result.Items.length === 0) {
      console.log('📭 Database is already empty');
      return;
    }
    
    // Delete each item
    for (const item of result.Items) {
      const deleteCommand = new DeleteCommand({
        TableName: 'meridian-contacted-leads',
        Key: {
          contactKey: item.contactKey?.S
        }
      });
      
      await docClient.send(deleteCommand);
      console.log(`   ✅ Deleted: ${item.name?.S} (${item.contactKey?.S})`);
    }
    
    console.log(`🎉 Successfully cleared ${result.Items.length} contacts from database!`);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
  }
}

clearDatabase();