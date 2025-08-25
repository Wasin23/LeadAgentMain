import 'dotenv/config';
import { leadEmail } from './tools/leadEmail.js';

// Test the new lead email function
async function testLeadEmail() {
  console.log('Testing new leadEmail function...');
  
  const result = await leadEmail(
    'colton.fidd@gmail.com',
    'TEST: New Lead Email Function Working',
    'This is a direct test of the new leadEmail function with the correct sender address (exa.mark@mg.examarkchat.com). If you receive this, the Lead Contact Agent emails should now work!'
  );
  
  console.log('Test result:', result);
  process.exit(0);
}

testLeadEmail().catch(console.error);
