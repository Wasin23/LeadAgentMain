'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('1.00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setResult(null);

    try {
      const cents = Math.round(parseFloat(amount) * 100);
      const res = await fetch('/api/cardcharger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents }),
      });
      const { clientSecret, error: serverError } = await res.json();
      if (serverError) throw new Error(serverError);

      const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! },
      });

      if (error) {
        setResult({ type: 'error', msg: error.message ?? 'Payment failed' });
      } else if (paymentIntent?.status === 'succeeded') {
        setResult({
          type: 'success',
          msg: `Payment succeeded! ID: ${paymentIntent.id} · $${(paymentIntent.amount / 100).toFixed(2)} USD`,
        });
        elements.getElement(CardElement)?.clear();
      }
    } catch (err: any) {
      setResult({ type: 'error', msg: err.message });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label}>Amount (USD)</label>
        <input
          type="number"
          min="0.50"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={styles.input}
        />
      </div>
      <div style={styles.field}>
        <label style={styles.label}>Card Details</label>
        <div style={styles.cardBox}>
          <CardElement options={{ style: { base: { fontSize: '16px', color: '#1a1a2e' } } }} />
        </div>
      </div>
      <button type="submit" disabled={!stripe || loading} style={styles.btn}>
        {loading ? 'Processing...' : 'Charge Card'}
      </button>
      {result && (
        <div style={result.type === 'success' ? styles.success : styles.error}>
          {result.msg}
        </div>
      )}
    </form>
  );
}

export default function CardChargerPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.heading}>💳 Card Charger</h2>
        <p style={styles.sub}>Stripe integration test · <strong>LIVE MODE</strong></p>
        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: '36px 40px', maxWidth: 460, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' },
  heading: { margin: '0 0 6px', fontSize: 22, color: '#1a1a2e' },
  sub: { margin: '0 0 28px', color: '#666', fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#444' },
  input: { padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 16, outline: 'none' },
  cardBox: { padding: '12px', border: '1.5px solid #ddd', borderRadius: 8 },
  btn: { padding: '14px', background: '#635bff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  success: { padding: 14, borderRadius: 8, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', fontSize: 14 },
  error: { padding: 14, borderRadius: 8, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontSize: 14 },
};
