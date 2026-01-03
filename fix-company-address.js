/**
 * One-time script to fix "your company address" placeholder in emails
 * Usage: node fix-company-address.js
 */

import dotenv from 'dotenv';
import { getAWSEmailQueue } from './utils/awsEmailQueue.js';

dotenv.config();

const TARGET_USER_ID = '5344c009-768d-4d7f-a399-4704507bf852';
const OLD_TEXT = 'your company address';
const NEW_TEXT = '777 Brickell Ave, Miami, FL 33101';

async function fixCompanyAddress() {
  console.log('🔧 Starting company address fix...');
  console.log(`User ID: ${TARGET_USER_ID}`);
  console.log(`Replacing: "${OLD_TEXT}" → "${NEW_TEXT}"`);
  console.log('');

  const awsQueue = getAWSEmailQueue();
  
  try {
    // Get all queued emails for the user
    console.log('📧 Fetching all queued emails...');
    const queuedEmails = await awsQueue.getAllQueuedEmailsForUser(TARGET_USER_ID);
    console.log(`Found ${queuedEmails.length} queued emails`);
    console.log('');
    
    let fixedCount = 0;
    let checkedCount = 0;
    
    for (const email of queuedEmails) {
      checkedCount++;
      
      // Check if email body contains the old text (case-insensitive)
      const needsFix = email.body && email.body.toLowerCase().includes(OLD_TEXT.toLowerCase());
      
      if (needsFix) {
        console.log(`\n🔍 Found email needing fix:`);
        console.log(`  ID: ${email.id}`);
        console.log(`  Agent: ${email.agentId}`);
        console.log(`  Status: ${email.status}`);
        console.log(`  To: ${email.to}`);
        console.log(`  Subject: ${email.subject}`);
        
        // Replace the text
        const updatedBody = email.body.replace(new RegExp(OLD_TEXT, 'gi'), NEW_TEXT);
        
        try {
          // Update the email in DynamoDB
          await awsQueue.updateEmail(TARGET_USER_ID, email.agentId, email.id, {
            body: updatedBody
          });
          
          fixedCount++;
          console.log(`  ✅ Fixed!`);
          
          // Add delay to avoid throughput issues
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`  ❌ Failed to update:`, error.message);
          // Add longer delay on error before retrying next email
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Progress indicator
      if (checkedCount % 10 === 0) {
        console.log(`\nProgress: ${checkedCount}/${queuedEmails.length} emails checked, ${fixedCount} fixed`);
      }
    }
    
    console.log('\n');
    console.log('='.repeat(60));
    console.log('✅ Company address fix complete!');
    console.log(`Total emails checked: ${checkedCount}`);
    console.log(`Emails fixed: ${fixedCount}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error running fix:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixCompanyAddress()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
