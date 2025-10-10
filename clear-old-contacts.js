import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function clearOldContacts() {
  try {
    console.log('🗑️ Clearing old contacts from database...');
    
    // Initialize DynamoDB client
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const dynamodb = DynamoDBDocumentClient.from(client);
    
    // Your user ID
    const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
    
    // Get all contacts for this user
    const scanCommand = new ScanCommand({
      TableName: 'examark-contacted-leads',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamodb.send(scanCommand);
    const contacts = result.Items || [];
    
    console.log(`Found ${contacts.length} contacts to delete:`);
    
    // Delete each contact
    for (const contact of contacts) {
      const deleteCommand = new DeleteCommand({
        TableName: 'examark-contacted-leads',
        Key: {
          contactId: contact.contactId,
          userId: contact.userId
        }
      });

      await dynamodb.send(deleteCommand);
      console.log(`   ✅ Deleted: ${contact.name} (${contact.contactId})`);
    }
    
    console.log(`\n🎉 Successfully deleted ${contacts.length} old contacts!`);
    console.log('💡 Now test the agent with fresh contacts using name_company format');
    
  } catch (error) {
    console.error('❌ Failed to clear contacts:', error.message);
  }
}

clearOldContacts();