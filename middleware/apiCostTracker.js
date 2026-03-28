// API cost tracking middleware for trial credit management
import AWSManager from '../utils/awsManager.js';

const awsManager = new AWSManager();

// Internal API costs for trial credit estimation (deprecated for real usage tracking)
const API_COSTS = {
  'openai-gpt4': 0.03,
  'openai-gpt35': 0.002,
  'openai-embedding': 0.0001,
  'serper-search': 0.001,
  'apollo-enrichment': 0.01,
  'hunter-email': 0.01,
  'zerobounce-verify': 0.01,
  'mailgun-send': 0.0008,
  'openai-completion': 0.002
};

/**
 * Track API usage and deduct from user's trial credits
 * @param {string} userId - User ID
 * @param {string} apiType - Type of API call (e.g., 'openai-gpt4', 'serper-search')
 * @param {number} quantity - Number of API calls (default 1)
 * @returns {Promise<Object>} Updated credit information
 */
export async function trackApiUsage(userId, apiType, quantity = 1) {
  try {
    const cost = (API_COSTS[apiType] || 0.001) * quantity;
    
    // Get current user data
    const user = await awsManager.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentCreditsUsed = user.trialCreditsUsed ?? 0;
    const creditsLimit = user.trialCreditsLimit ?? 250;
    const newCreditsUsed = currentCreditsUsed + cost;
    const percentageUsed = (newCreditsUsed / creditsLimit) * 100;

    // Update user's trial credits
    await awsManager.updateUser(userId, {
      trialCreditsUsed: newCreditsUsed
    });

    // Create activity log alerts at key thresholds
    if (!user.paymentMethodAdded) {
      // 80% warning threshold
      if (currentCreditsUsed < (creditsLimit * 0.8) && newCreditsUsed >= (creditsLimit * 0.8)) {
        await awsManager.addIssue(
          userId,
          'billing',
          '⚠️ Trial Credits Running Low',
          `You've used ${Math.round(newCreditsUsed).toLocaleString()} of ${creditsLimit} trial credits (${percentageUsed.toFixed(1)}%), equal to $${(newCreditsUsed * 0.05).toFixed(2)} in API costs. Add a payment method to upgrade or buy more credits before you run out.`,
          {
            severity: 'warning',
            creditsUsed: newCreditsUsed,
            creditsLimit: creditsLimit,
            percentageUsed: percentageUsed.toFixed(1)
          }
        );
      }
      
      // 90% critical threshold
      if (currentCreditsUsed < (creditsLimit * 0.9) && newCreditsUsed >= (creditsLimit * 0.9)) {
        await awsManager.addIssue(
          userId,
          'billing',
          '🚨 Trial Credits Almost Exhausted',
          `You've used ${Math.round(newCreditsUsed).toLocaleString()} of ${creditsLimit} trial credits (${percentageUsed.toFixed(1)}%), equal to $${(newCreditsUsed * 0.05).toFixed(2)} in API costs. Service will pause when your credits are depleted.`,
          {
            severity: 'critical',
            creditsUsed: newCreditsUsed,
            creditsLimit: creditsLimit,
            percentageUsed: percentageUsed.toFixed(1)
          }
        );
      }
      
      // 100% limit reached
      if (currentCreditsUsed < creditsLimit && newCreditsUsed >= creditsLimit) {
        await awsManager.addIssue(
          userId,
          'billing',
          '🚫 Trial Credits Exhausted',
          `You've used all ${creditsLimit} trial credits. Add a payment method to restore service and purchase more credits.`,
          {
            severity: 'critical',
            creditsUsed: newCreditsUsed,
            creditsLimit: creditsLimit,
            percentageUsed: 100
          }
        );
      }
    }

    return {
      creditsUsed: newCreditsUsed,
      creditsLimit: creditsLimit,
      creditsRemaining: creditsLimit - newCreditsUsed,
      costOfThisCall: cost,
      withinLimit: newCreditsUsed < creditsLimit
    };
  } catch (error) {
    console.error(`[API Cost Tracker] Error tracking usage for ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if user has sufficient trial credits before API call
 * @param {string} userId - User ID
 * @param {string} apiType - Type of API call
 * @param {number} quantity - Number of API calls (default 1)
 * @returns {Promise<Object>} Credit check result
 */
export async function checkTrialCredits(userId, apiType, quantity = 1) {
  try {
    const user = await awsManager.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user has payment method added, they have unlimited credits
    if (user.paymentMethodAdded) {
      return {
        allowed: true,
        unlimited: true,
        message: 'Payment method on file - you can upgrade or buy more credits when needed'
      };
    }

    const currentCreditsUsed = user.trialCreditsUsed ?? 0;
    const creditsLimit = user.trialCreditsLimit ?? 250;
    const estimatedCost = (API_COSTS[apiType] || 0.001) * quantity;
    const wouldExceedLimit = (currentCreditsUsed + estimatedCost) > creditsLimit;

    if (wouldExceedLimit) {
      return {
        allowed: false,
        unlimited: false,
        creditsUsed: currentCreditsUsed,
        creditsLimit: creditsLimit,
        creditsRemaining: creditsLimit - currentCreditsUsed,
        estimatedCost: estimatedCost,
        message: 'Trial credit limit reached. Please add a payment method to buy more credits or upgrade your plan.'
      };
    }

    return {
      allowed: true,
      unlimited: false,
      creditsUsed: currentCreditsUsed,
      creditsLimit: creditsLimit,
      creditsRemaining: creditsLimit - currentCreditsUsed,
      estimatedCost: estimatedCost,
      message: 'Within trial credit limit'
    };
  } catch (error) {
    console.error(`[API Cost Tracker] Error checking credits for ${userId}:`, error);
    throw error;
  }
}

/**
 * Get user's current trial credit status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Credit status
 */
export async function getTrialCreditStatus(userId) {
  try {
    const user = await awsManager.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // MIGRATION: If user doesn't have trial credit fields, add them
    // Also normalize older trial users to the current 250-credit trial.
    if (user.trialEligible !== false && (user.trialCreditsUsed === undefined || user.trialCreditsLimit === undefined || user.paymentMethodAdded === undefined || user.trialCreditsLimit === 25 || user.trialCreditsLimit === 500 || user.trialCreditsLimit === 1000)) {
      console.log('⚠️ [TRIAL] User missing trial fields or has old 25-credit limit, migrating...');
      await awsManager.updateUser(userId, {
        trialCreditsUsed: user.trialCreditsUsed ?? 0,
        trialCreditsLimit: 250,
        paymentMethodAdded: user.paymentMethodAdded || false,
        stripeCustomerId: user.stripeCustomerId || null
      });
      console.log('✅ [TRIAL] User migrated with trial fields');
      // Refetch user
      const updatedUser = await awsManager.getUserById(userId);
      Object.assign(user, updatedUser);
    }

    const creditsUsed = user.trialCreditsUsed ?? 0;
    const creditsLimit = user.trialCreditsLimit ?? 250;
    const creditsRemaining = Math.max(0, creditsLimit - creditsUsed);
    const percentageUsed = (creditsUsed / creditsLimit) * 100;

    const status = {
      creditsUsed: creditsUsed.toFixed(2),
      creditsLimit: creditsLimit,
      creditsRemaining: creditsRemaining.toFixed(2),
      percentageUsed: percentageUsed.toFixed(1),
      paymentMethodAdded: user.paymentMethodAdded || false,
      stripeCustomerId: user.stripeCustomerId || null,
      limitReached: creditsUsed >= creditsLimit,
      warningThreshold: percentageUsed >= 80 // Show warning at 80%
    };

    return status;
  } catch (error) {
    console.error(`[API Cost Tracker] Error getting credit status for ${userId}:`, error);
    throw error;
  }
}

/**
 * Express middleware to check trial credits before processing request
 */
export function requireTrialCredits(apiType, quantity = 1) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const creditCheck = await checkTrialCredits(userId, apiType, quantity);
      
      if (!creditCheck.allowed) {
        return res.status(402).json({
          error: 'Trial credit limit reached',
          message: creditCheck.message,
          creditsUsed: creditCheck.creditsUsed,
          creditsLimit: creditCheck.creditsLimit,
          requiresPayment: true
        });
      }

      // Attach credit info to request for logging
      req.creditInfo = creditCheck;
      next();
    } catch (error) {
      console.error('[API Cost Tracker] Middleware error:', error);
      res.status(500).json({ error: 'Failed to check trial credits' });
    }
  };
}

export default {
  trackApiUsage,
  checkTrialCredits,
  getTrialCreditStatus,
  requireTrialCredits
};
