import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

// Now import after env is loaded
const { scanUsersAndCharge } = await import('./routes/billing.js');

console.log('💰 [MANUAL BILLING] Starting manual billing charge...');
console.log('💰 [MANUAL BILLING] Current date:', new Date().toISOString());

try {
  const results = await scanUsersAndCharge();
  
  console.log('\n✅ [MANUAL BILLING] Billing cycle complete!');
  console.log('📊 [MANUAL BILLING] Results:', JSON.stringify(results, null, 2));
  console.log(`\n✅ Total users: ${results.total}`);
  console.log(`✅ Successful charges: ${results.successful}`);
  console.log(`❌ Failed charges: ${results.failed}`);
  
  if (results.errors && results.errors.length > 0) {
    console.log('\n❌ [MANUAL BILLING] Errors:');
    results.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ [MANUAL BILLING] Fatal error:', error);
  console.error('❌ [MANUAL BILLING] Stack:', error.stack);
  process.exit(1);
}
