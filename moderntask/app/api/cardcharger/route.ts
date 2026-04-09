import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json();
    const cents = parseInt(amount);
    if (!cents || cents < 50) {
      return NextResponse.json({ error: 'Amount must be at least $0.50' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      description: 'Card charger test',
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error('[cardcharger] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
