import AWSManager from '../utils/awsManager.js';
import { sendAccountSuspendedEmail, sendGracePeriodWarningEmail } from '../utils/billingEmails.js';

const awsManager = new AWSManager();

/**
 * Check for expired grace periods and suspend accounts
 */
export async function checkGracePeriods() {
  console.log('🕐 [GRACE] Checking grace periods...');
  
  try {
    // Scan for users with payment_failed status
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const scanCommand = new ScanCommand({
      TableName: awsManager.tables.userSettings,
      FilterExpression: 'paymentStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'payment_failed'
      }
    });
    
    const { Items: users } = await awsManager.dynamodb.send(scanCommand);
    
    if (!users || users.length === 0) {
      console.log('✅ [GRACE] No users in grace period');
      return;
    }
    
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
    
    let suspended = 0;
    let warned = 0;
    
    for (const user of users) {
      try {
        const userId = user.userId;
        const gracePeriodEnd = user.gracePeriodEnd ? new Date(user.gracePeriodEnd) : null;
        const lastFailedCharge = user.lastFailedCharge;
        
        if (!gracePeriodEnd || !lastFailedCharge) {
          console.log(`⏭️ [GRACE] Skipping ${userId} - incomplete data`);
          continue;
        }
        
        // Check if grace period expired
        if (now >= gracePeriodEnd) {
          console.log(`🚫 [GRACE] Suspending ${userId} - grace period expired`);
          
          // Update to suspended
          await awsManager.saveUserSettings(userId, {
            ...user,
            paymentStatus: 'suspended'
          });
          
          // Send suspension email
          if (user.email) {
            await sendAccountSuspendedEmail(userId, user.email, lastFailedCharge.amount);
          }
          
          suspended++;
        }
        // Check if grace period ending soon (2 days warning)
        else if (gracePeriodEnd <= twoDaysFromNow && !user.gracePeriodWarningSent) {
          const daysRemaining = Math.ceil((gracePeriodEnd - now) / (24 * 60 * 60 * 1000));
          console.log(`⚠️ [GRACE] Warning ${userId} - ${daysRemaining} days remaining`);
          
          // Send warning email
          if (user.email) {
            await sendGracePeriodWarningEmail(userId, user.email, daysRemaining, lastFailedCharge.amount);
          }
          
          // Mark warning as sent
          await awsManager.saveUserSettings(userId, {
            ...user,
            gracePeriodWarningSent: true
          });
          
          warned++;
        }
        
      } catch (userError) {
        console.error(`❌ [GRACE] Error processing user:`, userError);
      }
    }
    
    console.log(`✅ [GRACE] Check complete: ${suspended} suspended, ${warned} warned`);
    
  } catch (error) {
    console.error('❌ [GRACE] Error checking grace periods:', error);
    throw error;
  }
}

/**
 * Run grace period checks on interval (every hour)
 */
export function startGracePeriodChecker() {
  console.log('🚀 [GRACE] Starting grace period checker...');
  
  // Run immediately on startup
  checkGracePeriods().catch(err => {
    console.error('❌ [GRACE] Initial check failed:', err);
  });
  
  // Then run every hour
  setInterval(() => {
    checkGracePeriods().catch(err => {
      console.error('❌ [GRACE] Scheduled check failed:', err);
    });
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('✅ [GRACE] Grace period checker running (hourly)');
}
