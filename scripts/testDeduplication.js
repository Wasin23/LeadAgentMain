import AWSManager from '../utils/awsManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function testDeduplication() {
  console.log('🧪 Testing deduplication system...');
  
  const awsManager = new AWSManager();
  const testUserId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';
  
  try {
    // Test data - simulate Apollo search results
    const testLeads = [
      {
        name: 'John Smith',
        email: 'john.smith@testcompany.com',
        company: 'Test Company Inc',
        title: 'CEO',
        organization: { name: 'Test Company Inc' }
      },
      {
        name: 'Jane Doe',
        email: 'jane.doe@example.com', 
        company: 'Example Corp',
        title: 'HR Manager',
        organization: { name: 'Example Corp' }
      },
      {
        name: 'Bob Johnson',
        email: 'bob@anothercompany.com',
        company: 'Another Company',
        title: 'CTO'
      }
    ];
    
    console.log('📊 Step 1: Checking initial leads (should all be new)...');
    let result = await awsManager.checkForDuplicateContacts(testUserId, testLeads);
    console.log('Result:', JSON.stringify(result.summary, null, 2));
    
    console.log('\n📝 Step 2: Simulating email creation for first lead...');
    const contactResult = await awsManager.addContactedLead(testUserId, {
      name: testLeads[0].name,
      email: testLeads[0].email,
      company: testLeads[0].company,
      title: testLeads[0].title
    });
    console.log('Contact added:', contactResult.success ? '✅' : '❌', contactResult.reason || 'Success');
    
    console.log('\n🔍 Step 3: Checking same leads again (first should be duplicate)...');
    result = await awsManager.checkForDuplicateContacts(testUserId, testLeads);
    console.log('Result:', JSON.stringify(result.summary, null, 2));
    console.log('Duplicates found:', result.duplicateLeads.map(lead => `${lead.name} (${lead.email})`));
    
    console.log('\n📚 Step 4: Getting contacted leads history...');
    const history = await awsManager.getContactedLeadsHistory(testUserId, 10);
    console.log('Contacted leads count:', history.count);
    if (history.contacts.length > 0) {
      console.log('Most recent contact:', history.contacts[0]);
    }
    
    console.log('\n✅ Deduplication test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDeduplication().catch(console.error);