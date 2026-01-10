import cron from 'node-cron';
import { scanUsersAndCharge } from '../routes/billing.js';

/**
 * Monthly billing cron job
 * Runs on the 1st of every month at 2:00 AM
 */
export function startBillingCron() {
  console.log('🕐 [BILLING CRON] Initializing monthly billing job...');
  
  // Run at 2:00 AM on the 1st day of every month
  // Cron format: minute hour day-of-month month day-of-week
  // "0 2 1 * *" = At 2:00 AM on day 1 of every month
  const cronJob = cron.schedule('0 2 1 * *', async () => {
    console.log('💰 [BILLING CRON] Starting monthly billing cycle...');
    console.log('💰 [BILLING CRON] Current date:', new Date().toISOString());
    
    try {
      const results = await scanUsersAndCharge();
      
      console.log('✅ [BILLING CRON] Monthly billing complete:', results);
      console.log(`✅ [BILLING CRON] Successful: ${results.successful}, Failed: ${results.failed}`);
      
    } catch (error) {
      console.error('❌ [BILLING CRON] Monthly billing failed:', error);
      console.error('❌ [BILLING CRON] Error stack:', error.stack);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York" // Adjust to your timezone
  });
  
  console.log('✅ [BILLING CRON] Monthly billing job scheduled for 1st of each month at 2:00 AM EST');
  
  return cronJob;
}
