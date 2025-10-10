import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  try {
    console.log('🔍 Checking AWS DynamoDB for contacted leads...');
    
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
    
    // Scan the contacted leads table
    const command = new ScanCommand({
      TableName: 'examark-contacted-leads',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamodb.send(command);
    const contacts = result.Items || [];
    
    console.log(`\n📊 Found ${contacts.length} contacts in database:\n`);
    
    if (contacts.length === 0) {
      console.log('❌ No contacts found! Database is empty.');
    } else {
      contacts.forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.name} at ${contact.company}`);
        console.log(`   Contact ID: ${contact.contactId}`);
        console.log(`   Email: ${contact.email}`);
        console.log(`   Contacted: ${contact.contactedAt}`);
        console.log(`   User ID: ${contact.userId}`);
        console.log('   ---');
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to check database:', error.message);
    
    if (error.name === 'ResourceNotFoundException') {
      console.error('💡 The table "examark-contacted-leads" does not exist!');
    } else if (error.name === 'UnrecognizedClientException') {
      console.error('💡 AWS credentials are invalid!');
    }
  }
}

checkDatabase();