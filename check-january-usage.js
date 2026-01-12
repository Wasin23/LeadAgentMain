import dotenv from 'dotenv';
import AWSManager from './utils/awsManager.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

async function checkJanuaryUsage() {
  console.log('\n🔍 Checking January 2026 usage for colton.aalogin@gmail.com...\n');
  
  try {
    const awsManager = new AWSManager();
    const userId = '5781c511-2307-4fcf-a763-33e8ec64a638';
    
    // Get ALL detailed usage
    const detailedCommand = new QueryCommand({
      TableName: awsManager.tables.apiUsage,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const { Items: detailedRecords } = await awsManager.dynamodb.send(detailedCommand);
    
    console.log(`📊 Total records: ${detailedRecords?.length || 0}\n`);
    
    // Filter for January 2026
    const januaryRecords = detailedRecords?.filter(record => {
      const date = new Date(record.timestamp);
      return date.getFullYear() === 2026 && date.getMonth() === 0; // January is month 0
    }) || [];
    
    console.log(`📅 January 2026 records: ${januaryRecords.length}\n`);
    
    if (januaryRecords.length > 0) {
      // Calculate by service
      const serviceStats = {};
      let totalCost = 0;
      
      januaryRecords.forEach(record => {
        if (!serviceStats[record.service]) {
          serviceStats[record.service] = { count: 0, cost: 0 };
        }
        serviceStats[record.service].count++;
        serviceStats[record.service].cost += record.cost || 0;
        totalCost += record.cost || 0;
      });
      
      console.log('💰 January 2026 breakdown:');
      Object.entries(serviceStats).forEach(([service, stats]) => {
        console.log(`  ${service}: $${stats.cost.toFixed(2)} (${stats.count} calls)`);
      });
      console.log(`\n  TOTAL: $${totalCost.toFixed(2)}`);
      
      // Show most recent records
      const sorted = januaryRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      console.log(`\n📆 Most recent call: ${sorted[0].timestamp}`);
      console.log(`   Service: ${sorted[0].service}, Cost: $${sorted[0].cost}`);
    } else {
      console.log('❌ NO JANUARY 2026 RECORDS FOUND');
      console.log('\n📆 Most recent record overall:');
      if (detailedRecords && detailedRecords.length > 0) {
        const sorted = detailedRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        console.log(`   ${sorted[0].timestamp} - ${sorted[0].service} - $${sorted[0].cost}`);
      }
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkJanuaryUsage()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
