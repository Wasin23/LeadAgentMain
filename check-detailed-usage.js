import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(ddbClient);
const userId = '5344c009-768d-4d7f-a399-4704507bf852'; // markefidelman@gmail.com

async function checkDetailedUsage() {
  try {
    console.log('\n🔍 Checking detailed usage records...\n');
    
    // Get detailed usage from meridian-api-usage
    const usageResponse = await dynamodb.send(new QueryCommand({
      TableName: process.env.AWS_DYNAMODB_API_USAGE_TABLE || 'meridian-api-usage',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));
    
    console.log(`📊 Found ${usageResponse.Items?.length || 0} detailed usage records\n`);
    
    if (usageResponse.Items && usageResponse.Items.length > 0) {
      const byMonth = {};
      let totalCost = 0;
      
      usageResponse.Items.forEach(item => {
        const date = new Date(item.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { cost: 0, count: 0, services: {} };
        }
        
        byMonth[monthKey].cost += item.cost || 0;
        byMonth[monthKey].count += 1;
        totalCost += item.cost || 0;
        
        const service = item.service || 'unknown';
        if (!byMonth[monthKey].services[service]) {
          byMonth[monthKey].services[service] = { cost: 0, count: 0 };
        }
        byMonth[monthKey].services[service].cost += item.cost || 0;
        byMonth[monthKey].services[service].count += 1;
      });
      
      console.log('💰 DETAILED USAGE BY MONTH:');
      console.log('─────────────────────────────────────');
      
      Object.entries(byMonth).sort().forEach(([month, data]) => {
        console.log(`\n📅 ${month}`);
        console.log(`   Total: $${data.cost.toFixed(2)} (${data.count} calls)`);
        console.log(`   Services:`);
        Object.entries(data.services).forEach(([service, sData]) => {
          console.log(`      ${service}: ${sData.count} calls, $${sData.cost.toFixed(2)}`);
        });
      });
      
      console.log('\n═════════════════════════════════════');
      console.log(`💵 TOTAL FROM DETAILED RECORDS: $${totalCost.toFixed(2)}`);
      console.log(`═════════════════════════════════════\n`);
    }
    
    // Now check summary table
    console.log('📊 SUMMARY TABLE:');
    console.log('─────────────────────────────────────');
    const summaryResponse = await dynamodb.send(new QueryCommand({
      TableName: process.env.AWS_DYNAMODB_API_USAGE_SUMMARY_TABLE || 'meridian-api-usage-summary',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));
    
    if (!summaryResponse.Items || summaryResponse.Items.length === 0) {
      console.log('⚠️  No summary records found\n');
    } else {
      summaryResponse.Items.forEach(item => {
        console.log(`\n📅 ${item.month}`);
        console.log(`   Total: $${(item.totalCost || 0).toFixed(2)}`);
        console.log(`   Paid: ${item.paid ? 'YES' : 'NO'}`);
      });
      console.log();
    }
    
    console.log('🔥 ISSUE: Summary table is not being updated from detailed records!\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDetailedUsage();
