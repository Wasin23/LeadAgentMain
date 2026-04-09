import express from 'express';
import Stripe from 'stripe';

const router = express.Router();

// POST /api/cardcharger/create-payment-intent
router.post('/create-payment-intent', async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const amount = parseInt(req.body.amount);
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Amount must be at least $0.50' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      description: 'Card charger test',
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[CARD CHARGER] Error creating payment intent:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
