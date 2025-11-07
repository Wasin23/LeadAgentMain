import dotenv from 'dotenv';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

// Load environment variables
dotenv.config();

async function clearIssues() {
  console.log('🔄 Connecting to AWS DynamoDB...');
  
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
  
  const dynamodb = DynamoDBDocumentClient.from(client);
  const tableName = process.env.AWS_DYNAMODB_ISSUES_ALERTS_TABLE || 'meridian-issues-alerts';

  try {
    console.log('✅ Connected to AWS DynamoDB');
    console.log(`🔍 Scanning ${tableName} table for issues...`);

    // Scan to get all issues
    const scanResult = await dynamodb.send(new ScanCommand({
      TableName: tableName
    }));

    const issues = scanResult.Items || [];
    
    if (issues.length === 0) {
      console.log('📭 No issues found in the database');
      return;
    }

    console.log(`🗑️  Found ${issues.length} issues to delete`);

    // Batch delete (max 25 items per batch)
    const batches = [];
    for (let i = 0; i < issues.length; i += 25) {
      batches.push(issues.slice(i, i + 25));
    }

    let deletedCount = 0;
    for (const batch of batches) {
      const deleteRequests = batch.map(issue => ({
        DeleteRequest: {
          Key: {
            PK: issue.PK,
            SK: issue.SK
          }
        }
      }));

      await dynamodb.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: deleteRequests
        }
      }));

      deletedCount += batch.length;
      console.log(`   ✅ Deleted batch: ${deletedCount}/${issues.length}`);
    }

    console.log(`🎉 Successfully cleared ${deletedCount} issues from database!`);

  } catch (error) {
    console.error('❌ Error clearing issues:', error.message);
    console.error('Full error:', error);
  }
}

clearIssues();
