import Stripe from 'stripe';
import { TOPUP_TIERS } from '../routes/plans.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const AUTO_TOPUP_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Fires a real Stripe charge + credit grant when a user's balance has crossed
 * their configured auto top-up threshold. Called fire-and-forget from the
 * credit-deduction path in awsManager.logApiUsage — must never throw back
 * into that flow, so every failure path here just logs and returns.
 */
export async function maybeAutoTopup(awsManager, userId, remainingCredits) {
  try {
    const userSettings = await awsManager.getUserSettings(userId);
    const autoTopup = userSettings?.autoTopup;
    if (!autoTopup?.enabled) return;
    if (remainingCredits > autoTopup.threshold) return;

    const tier = TOPUP_TIERS[autoTopup.tierId] || TOPUP_TIERS.small;

    // Atomically claim the right to charge so concurrent deductions (many can
    // land within the same second) don't fire duplicate Stripe charges.
    const claimed = await awsManager.claimAutoTopupLock(userId, AUTO_TOPUP_COOLDOWN_MS);
    if (!claimed) return;

    const user = await awsManager.getUserById(userId);
    let paymentMethodId = userSettings?.defaultPaymentMethodId;
    if (!paymentMethodId && user?.stripeCustomerId) {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      paymentMethodId = customer?.invoice_settings?.default_payment_method || null;
      if (!paymentMethodId) {
        const pms = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card', limit: 1 });
        paymentMethodId = pms.data[0]?.id || null;
      }
    }
    if (!user?.stripeCustomerId || !paymentMethodId) {
      console.warn(`[AUTO-TOPUP] Skipped for ${userId}: no payment method on file`);
      return;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: tier.priceCents,
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: `Meridian ${tier.credits} credit auto top-up (${autoTopup.tierId})`,
      metadata: { userId, tierId: autoTopup.tierId, creditAmount: String(tier.credits), auto: 'true' },
    });

    if (paymentIntent.status !== 'succeeded') {
      console.warn(`[AUTO-TOPUP] Payment not completed for ${userId}: ${paymentIntent.status}`);
      return;
    }

    await awsManager.purchaseCredits(userId, tier.credits);
    console.log(`[AUTO-TOPUP] Charged $${(tier.priceCents / 100).toFixed(2)} and granted ${tier.credits} credits to user ${userId}`);

    await awsManager.addIssue(
      userId,
      'billing',
      'Auto Top-up Charged',
      `Your credit balance dropped below ${autoTopup.threshold}, so we automatically charged your card on file $${(tier.priceCents / 100).toFixed(2)} for ${tier.credits} credits.`,
      { severity: 'info', auto: true }
    ).catch(() => {});
  } catch (error) {
    console.error(`[AUTO-TOPUP] Failed for user ${userId}:`, error.message);
  }
}
