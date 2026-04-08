import AWSManager from './awsManager.js';

const awsManager = new AWSManager();
const FROM_EMAIL = process.env.NOTIFICATION_EMAIL || 'noreply@yourdomain.com';

export async function sendPaymentFailedEmail(userId, userEmail, amount, errorMessage) {
  const subject = '⚠️ Payment Failed - Action Required';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Failed</h2>
      <p>Hello,</p>
      <p>We were unable to process your monthly payment of <strong>$${amount.toFixed(2)}</strong> for your Meridian API usage.</p>
      
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Error:</strong> ${errorMessage}</p>
      </div>
      
      <p>You have <strong>7 days</strong> to update your payment method before your account is suspended.</p>
      
      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Update Payment Method
        </a>
      </p>
      
      <p>If you have any questions, please contact our support team.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  
  const textBody = `
Payment Failed

We were unable to process your monthly payment of $${amount.toFixed(2)} for your Meridian API usage.

Error: ${errorMessage}

You have 7 days to update your payment method before your account is suspended.

Update your payment method: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing

If you have any questions, please contact our support team.
  `;
  
  try {
    await awsManager.sendEmail({
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      htmlBody,
      textBody
    });
    console.log(`✅ [EMAIL] Payment failed notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send payment failed email:`, error);
  }
}

export async function sendPaymentSuccessEmail(userId, userEmail, amount) {
  const subject = '✅ Payment Successful';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Payment Successful</h2>
      <p>Hello,</p>
      <p>Your monthly payment of <strong>$${amount.toFixed(2)}</strong> for Meridian API usage has been successfully processed.</p>
      
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Amount Charged:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <p>Thank you for using Meridian!</p>
      
      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Billing Details
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  
  const textBody = `
Payment Successful

Your monthly payment of $${amount.toFixed(2)} for Meridian API usage has been successfully processed.

Amount Charged: $${amount.toFixed(2)}
Date: ${new Date().toLocaleDateString()}

Thank you for using Meridian!

View billing details: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing
  `;
  
  try {
    await awsManager.sendEmail({
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      htmlBody,
      textBody
    });
    console.log(`✅ [EMAIL] Payment success notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send payment success email:`, error);
  }
}

export async function sendGracePeriodWarningEmail(userId, userEmail, daysRemaining, amount) {
  const subject = `⚠️ Account Suspension Warning - ${daysRemaining} Days Remaining`;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Urgent: Account Suspension Warning</h2>
      <p>Hello,</p>
      <p>Your Meridian account will be suspended in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong> due to an unpaid balance.</p>
      
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Unpaid Amount:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0 0 0;"><strong>Suspension Date:</strong> ${new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
      </div>
      
      <p><strong>Update your payment method now to avoid service interruption.</strong></p>
      
      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing" 
           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Update Payment Method Now
        </a>
      </p>
      
      <p>If you have any questions, please contact our support team immediately.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  
  const textBody = `
Urgent: Account Suspension Warning

Your Meridian account will be suspended in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} due to an unpaid balance.

Unpaid Amount: $${amount.toFixed(2)}
Suspension Date: ${new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString()}

Update your payment method now to avoid service interruption.

Update payment method: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing

If you have any questions, please contact our support team immediately.
  `;
  
  try {
    await awsManager.sendEmail({
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      htmlBody,
      textBody
    });
    console.log(`✅ [EMAIL] Grace period warning sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send grace period warning:`, error);
  }
}

export async function sendAccountSuspendedEmail(userId, userEmail, amount) {
  const subject = '🚫 Account Suspended - Immediate Action Required';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Account Suspended</h2>
      <p>Hello,</p>
      <p>Your Meridian account has been suspended due to an unpaid balance of <strong>$${amount.toFixed(2)}</strong>.</p>
      
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Status:</strong> Account Suspended</p>
        <p style="margin: 5px 0 0 0;"><strong>Unpaid Amount:</strong> $${amount.toFixed(2)}</p>
      </div>
      
      <p><strong>All API services have been disabled.</strong> Update your payment method to restore access immediately.</p>
      
      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing" 
           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Restore Account Access
        </a>
      </p>
      
      <p>Once payment is received, your account will be reactivated immediately.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  
  const textBody = `
Account Suspended

Your Meridian account has been suspended due to an unpaid balance of $${amount.toFixed(2)}.

Status: Account Suspended
Unpaid Amount: $${amount.toFixed(2)}

All API services have been disabled. Update your payment method to restore access immediately.

Restore account: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing

Once payment is received, your account will be reactivated immediately.
  `;
  
  try {
    await awsManager.sendEmail({
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      htmlBody,
      textBody
    });
    console.log(`✅ [EMAIL] Account suspended notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send account suspended email:`, error);
  }
}

export async function sendAccountReactivatedEmail(userId, userEmail) {
  const subject = '✅ Account Reactivated';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Account Reactivated</h2>
      <p>Hello,</p>
      <p>Great news! Your Meridian account has been successfully reactivated.</p>
      
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Status:</strong> Active</p>
        <p style="margin: 5px 0 0 0;">All services have been restored</p>
      </div>
      
      <p>You can now continue using all Meridian API services.</p>
      
      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Go to Dashboard
        </a>
      </p>
      
      <p>Thank you for your prompt payment!</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  
  const textBody = `
Account Reactivated

Great news! Your Meridian account has been successfully reactivated.

Status: Active
All services have been restored

You can now continue using all Meridian API services.

Go to dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}

Thank you for your prompt payment!
  `;
  
  try {
    await awsManager.sendEmail({
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      htmlBody,
      textBody
    });
    console.log(`✅ [EMAIL] Account reactivated notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send account reactivated email:`, error);
  }
}

export async function sendPlanCancelledEmail(userId, userEmail, fromPlanName) {
  const subject = 'Your Meridian plan has been cancelled';
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #374151;">Plan Cancelled</h2>
      <p>Hello,</p>
      <p>Your <strong>${fromPlanName}</strong> subscription has been cancelled. Your account has been moved to the Free Trial tier.</p>

      <div style="background-color: #f9fafb; border-left: 4px solid #9ca3af; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>What this means:</strong></p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>You now have 1 agent slot and 5x speed</li>
          <li>No further monthly charges will be processed</li>
          <li>You can re-subscribe at any time from your billing settings</li>
        </ul>
      </div>

      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Manage Billing
        </a>
      </p>

      <p>We're sorry to see you go. If there's anything we can improve, please reach out to our support team.</p>

      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  const textBody = `
Plan Cancelled

Your ${fromPlanName} subscription has been cancelled. Your account has been moved to the Free Trial tier.

What this means:
- You now have 1 agent slot and 5x speed
- No further monthly charges will be processed
- You can re-subscribe at any time from your billing settings

Manage billing: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing
  `;
  try {
    await awsManager.sendEmail({ to: userEmail, from: FROM_EMAIL, subject, htmlBody, textBody });
    console.log(`✅ [EMAIL] Plan cancelled notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send plan cancelled email:`, error);
  }
}

export async function sendPlanChangedEmail(userId, userEmail, fromPlanName, toPlanName) {
  const subject = `Your Meridian plan has been changed to ${toPlanName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #374151;">Plan Updated</h2>
      <p>Hello,</p>
      <p>Your Meridian plan has been updated from <strong>${fromPlanName}</strong> to <strong>${toPlanName}</strong>.</p>

      <div style="background-color: #f9fafb; border-left: 4px solid #9ca3af; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;">Your new plan limits are now active. The change takes effect immediately.</p>
      </div>

      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Billing
        </a>
      </p>

      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  const textBody = `
Plan Updated

Your Meridian plan has been updated from ${fromPlanName} to ${toPlanName}.

Your new plan limits are now active. The change takes effect immediately.

View billing: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?tab=billing
  `;
  try {
    await awsManager.sendEmail({ to: userEmail, from: FROM_EMAIL, subject, htmlBody, textBody });
    console.log(`✅ [EMAIL] Plan changed notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send plan changed email:`, error);
  }
}

export async function sendPlanUpgradedEmail(userId, userEmail, fromPlanName, toPlanName, amountCharged) {
  const subject = `✅ Welcome to ${toPlanName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Plan Upgraded</h2>
      <p>Hello,</p>
      <p>Your plan has been upgraded from <strong>${fromPlanName}</strong> to <strong>${toPlanName}</strong>.</p>

      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Amount Charged:</strong> $${amountCharged.toFixed(2)}</p>
        <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p style="margin: 5px 0 0 0;">Your new credits and agent limits are now active.</p>
      </div>

      <p style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Go to Dashboard
        </a>
      </p>

      <p>Thank you for upgrading!</p>

      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This is an automated message from Meridian. Please do not reply to this email.
      </p>
    </div>
  `;
  const textBody = `
Plan Upgraded — Welcome to ${toPlanName}!

Your plan has been upgraded from ${fromPlanName} to ${toPlanName}.

Amount Charged: $${amountCharged.toFixed(2)}
Date: ${new Date().toLocaleDateString()}

Your new credits and agent limits are now active.

Go to dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
  `;
  try {
    await awsManager.sendEmail({ to: userEmail, from: FROM_EMAIL, subject, htmlBody, textBody });
    console.log(`✅ [EMAIL] Plan upgraded notification sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send plan upgraded email:`, error);
  }
}
