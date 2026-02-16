// Delete orphaned search history record with undefined userId
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(client);
const tableName = 'meridian-search-history';

console.log('🗑️ Deleting orphaned search history record...');

try {
  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: {
      PK: 'USER#undefined#AGENT#117289',
      SK: 'SEARCH#1771096843834'
    }
  }));
  
  console.log('✅ Deleted orphaned record: USER#undefined#AGENT#117289');
  console.log('🎯 Agent can now search Apollo API without blocks');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
