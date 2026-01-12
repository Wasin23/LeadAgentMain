import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkAllUsage() {
  console.log('\n🔍 ALL USAGE for colton.aalogin@gmail.com\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    const detailedCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsage,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: records } = await awsManager.dynamodb.send(detailedCommand);
    
    console.log(`📊 TOTAL RECORDS: ${records?.length || 0}\n`);
    
    const byMonth = {};
    
    records?.forEach(record => {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { count: 0, cost: 0 };
      }
      
      byMonth[monthKey].count++;
      byMonth[monthKey].cost += record.cost || 0;
    });
    
    console.log('💰 BY MONTH:\n');
    Object.keys(byMonth).sort().forEach(month => {
      console.log(`${month}: $${byMonth[month].cost.toFixed(2)} (${byMonth[month].count} calls)`);
    });
    
    const total = Object.values(byMonth).reduce((sum, m) => sum + m.cost, 0);
    console.log(`\nTOTAL: $${total.toFixed(2)}`);
    
    if (records && records.length > 0) {
      const sorted = records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      console.log(`\n📆 MOST RECENT: ${sorted[0].timestamp}`);
      console.log(`   ${sorted[0].service} - $${sorted[0].cost}`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAllUsage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
