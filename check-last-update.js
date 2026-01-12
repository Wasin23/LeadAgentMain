import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkLastUpdate() {
  console.log('\n🔍 CHECKING LAST UPDATE TIMES\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    const command = new QueryCommand({
      TableName: awsManager.tables.apiUsageSummary,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: records } = await awsManager.dynamodb.send(command);
    
    records.sort((a, b) => a.month.localeCompare(b.month));
    
    console.log('📅 SUMMARY TABLE UPDATE TIMES:\n');
    
    records.forEach(record => {
      console.log(`${record.month}:`);
      console.log(`  Last updated: ${record.updatedAt}`);
      console.log(`  Cost: $${(['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].reduce((sum, s) => sum + (record[s]?.cost || 0), 0)).toFixed(2)}`);
      console.log('');
    });
    
    const now = new Date();
    const mostRecent = records.reduce((latest, r) => {
      const d = new Date(r.updatedAt);
      return d > latest ? d : latest;
    }, new Date(0));
    
    const minutesAgo = Math.floor((now - mostRecent) / 1000 / 60);
    
    console.log(`⏰ Most recent update: ${mostRecent.toISOString()}`);
    console.log(`   (${minutesAgo} minutes ago)`);
    console.log(`\n⏰ Current time: ${now.toISOString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkLastUpdate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
