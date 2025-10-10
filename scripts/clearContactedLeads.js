import AWSManager from '../utils/awsManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearContactedLeads() {
  console.log('🧹 Clearing contacted leads database for testing...');
  
  const awsManager = new AWSManager();
  const testUserId = '76e84c79-9b13-4c55-be86-d0bd9baa9411'; // Your test user ID
  
  try {
    // First, show current contacts
    console.log('📊 Step 1: Getting current contacted leads...');
    const history = await awsManager.getContactedLeadsHistory(testUserId, 50);
    console.log(`Found ${history.count} existing contacts`);
    
    if (history.contacts.length > 0) {
      console.log('Current contacts:');
      history.contacts.forEach(contact => {
        console.log(`  • ${contact.name} (${contact.email}) at ${contact.company} - contacted: ${contact.contactedAt}`);
      });
    }
    
    // Clear the database
    console.log('\n🗑️ Step 2: Clearing contacted leads database...');
    const clearResult = await awsManager.clearContactedLeads(testUserId);
    
    if (clearResult.success) {
      console.log(`✅ Successfully cleared database:`);
      console.log(`   • Deleted: ${clearResult.deletedCount} contacts`);
      console.log(`   • Total found: ${clearResult.totalFound}`);
      console.log(`   • Message: ${clearResult.message}`);
    } else {
      console.error(`❌ Failed to clear database: ${clearResult.error}`);
    }
    
    // Verify it's empty
    console.log('\n🔍 Step 3: Verifying database is empty...');
    const afterHistory = await awsManager.getContactedLeadsHistory(testUserId, 10);
    console.log(`Remaining contacts: ${afterHistory.count}`);
    
    if (afterHistory.count === 0) {
      console.log('✅ Database successfully cleared!');
    } else {
      console.log('⚠️ Some contacts still remain:');
      afterHistory.contacts.forEach(contact => {
        console.log(`  • ${contact.name} (${contact.email}) at ${contact.company}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the clear function
clearContactedLeads().catch(console.error);