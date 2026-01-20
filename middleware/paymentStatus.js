import AWSManager from '../utils/awsManager.js';

const awsManager = new AWSManager();

export async function checkPaymentStatus(req, res, next) {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get user settings
    const userSettings = await awsManager.getUserSettings(userId);
    
    if (!userSettings) {
      // New user, allow through
      return next();
    }
    
    // If billing is enabled with valid payment method, allow through
    if (userSettings.billingEnabled && userSettings.stripeCustomerId) {
      return next();
    }
    
    const paymentStatus = userSettings.paymentStatus || 'active';
    
    // If payment failed, check grace period
    if (paymentStatus === 'payment_failed') {
      const gracePeriodEnd = userSettings.gracePeriodEnd;
      
      if (!gracePeriodEnd) {
        // No grace period set, suspend immediately
        return res.status(402).json({
          error: 'Payment required',
          requiresPayment: true,
          message: 'Your last payment failed. Please update your payment method to continue using the service.'
        });
      }
      
      const graceEndDate = new Date(gracePeriodEnd);
      const now = new Date();
      
      if (now > graceEndDate) {
        // Grace period expired - suspend account
        await awsManager.saveUserSettings(userId, {
          ...userSettings,
          paymentStatus: 'suspended'
        });
        
        return res.status(402).json({
          error: 'Account suspended',
          requiresPayment: true,
          message: 'Your account has been suspended due to payment failure. Please update your payment method to restore access.',
          suspended: true
        });
      } else {
        // Still in grace period - allow through with warning
        const daysRemaining = Math.ceil((graceEndDate - now) / (1000 * 60 * 60 * 24));
        res.locals.paymentWarning = {
          message: `Payment failed. Service will be suspended in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
          daysRemaining,
          gracePeriodEnd: gracePeriodEnd
        };
        return next();
      }
    }
    
    // If suspended, block
    if (paymentStatus === 'suspended') {
      return res.status(402).json({
        error: 'Account suspended',
        requiresPayment: true,
        message: 'Your account is suspended. Please update your payment method and contact support.',
        suspended: true
      });
    }
    
    // Active or unknown status - allow through
    next();
    
  } catch (error) {
    console.error('❌ [PAYMENT] Error checking payment status:', error);
    // Don't block on errors, but log them
    next();
  }
}
