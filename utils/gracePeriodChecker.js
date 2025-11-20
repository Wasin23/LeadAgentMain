import AWSManager from '../utils/awsManager.js';
import { sendAccountSuspendedEmail, sendGracePeriodWarningEmail } from '../utils/billingEmails.js';

const awsManager = new AWSManager();

// Activity logging helper
async function logBillingActivity(userId, action, details, status = 'warning') {
  try {
    const timestamp = new Date().toISOString();
    
    console.log(`💰 [BILLING LOG] ${timestamp} - User: ${userId} - Action: ${action} - Status: ${status}`);
    console.log(`   Details:`, details);
    
    // Create issue/alert for warnings and suspensions
    if (status === 'warning' || status === 'suspended') {
      await awsManager.createIssue(userId, {
        type: 'billing',
        severity: status === 'suspended' ? 'critical' : 'high',
        title: status === 'suspended' ? 'Account Suspended' : 'Payment Grace Period Ending',
        message: details.message || `${action} - ${status}`,
        data: details,
        timestamp
      });
    }
  } catch (error) {
    console.error('❌ [BILLING LOG] Error logging activity:', error);
  }
}

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
          
          // Log suspension and create alert
          await logBillingActivity(userId, 'Account Suspended', {
            amount: lastFailedCharge.amount,
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            message: `Account suspended due to unpaid balance of $${lastFailedCharge.amount.toFixed(2)}`
          }, 'suspended');
          
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
          
          // Log warning and create alert
          await logBillingActivity(userId, 'Grace Period Ending', {
            daysRemaining,
            amount: lastFailedCharge.amount,
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            message: `Payment grace period ending in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Amount due: $${lastFailedCharge.amount.toFixed(2)}`
          }, 'warning');
          
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
