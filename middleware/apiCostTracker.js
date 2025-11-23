// API cost tracking middleware for trial credit management
import AWSManager from '../utils/awsManager.js';

const awsManager = new AWSManager();

// Cost per API call (in dollars)
const API_COSTS = {
  'openai-gpt4': 0.03,           // GPT-4 per request (average)
  'openai-gpt35': 0.002,         // GPT-3.5 per request (average)
  'openai-embedding': 0.0001,    // Embedding per request
  'serper-search': 0.001,        // Serper per search
  'apollo-enrichment': 0.01,     // Apollo per enrichment
  'hunter-email': 0.01,          // Hunter per email verification
  'zerobounce-verify': 0.01,     // ZeroBounce per verification
  'mailgun-send': 0.0008,        // Mailgun per email sent
  'openai-completion': 0.002     // Default OpenAI completion cost
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

    const currentCreditsUsed = user.trialCreditsUsed || 0;
    const creditsLimit = user.trialCreditsLimit || 25;
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
          `You've used $${newCreditsUsed.toFixed(2)} of your $${creditsLimit} trial credits (${percentageUsed.toFixed(1)}%). Add a payment method to avoid service interruption.`,
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
          `You've used $${newCreditsUsed.toFixed(2)} of your $${creditsLimit} trial credits (${percentageUsed.toFixed(1)}%). Service will be suspended when credits are depleted.`,
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
          `You've used all $${creditsLimit} of your trial credits. Add a payment method immediately to restore service.`,
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
        message: 'Payment method on file - unlimited API usage'
      };
    }

    const currentCreditsUsed = user.trialCreditsUsed || 0;
    const creditsLimit = user.trialCreditsLimit || 25;
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
        message: 'Trial credit limit reached. Please add a payment method to continue.'
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
    console.log('🔵 [TRIAL] Getting status for user:', userId);
    const user = await awsManager.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    console.log('🔵 [TRIAL] User data:', {
      paymentMethodAdded: user.paymentMethodAdded,
      stripeCustomerId: user.stripeCustomerId,
      trialCreditsUsed: user.trialCreditsUsed,
      trialCreditsLimit: user.trialCreditsLimit
    });

    const creditsUsed = user.trialCreditsUsed || 0;
    const creditsLimit = user.trialCreditsLimit || 25;
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

    console.log('🔵 [TRIAL] Returning status:', status);
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
  requireTrialCredits,
  API_COSTS
};
