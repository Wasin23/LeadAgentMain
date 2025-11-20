'use client';

import { useState, useEffect } from 'react';
import { CreditCardIcon, PlusIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get setup intent from backend
      const { data } = await api.post('/api/billing/setup-intent');
      const { clientSecret } = data;

      // Confirm card setup
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });

      if (stripeError) {
        setError(stripeError.message || 'Failed to add card');
      } else if (setupIntent?.payment_method) {
        // Set as default
        await api.post('/api/billing/set-default-payment', {
          paymentMethodId: setupIntent.payment_method
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#171717',
                '::placeholder': {
                  color: '#737373',
                },
              },
            },
          }}
        />
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Adding...' : 'Add Card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function BillingContent() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const { data } = await api.get('/api/billing/payment-methods');
      setPaymentMethods(data.paymentMethods || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async (id: string) => {
    if (!confirm('Are you sure you want to remove this card?')) return;

    try {
      await api.delete(`/api/billing/payment-methods/${id}`);
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove card');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.post('/api/billing/set-default-payment', { paymentMethodId: id });
      setPaymentMethods(paymentMethods.map(pm => ({
        ...pm,
        isDefault: pm.id === id
      })));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set default card');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Payment Methods</h2>
          <p className="text-sm text-neutral-600 mt-1">Manage your credit cards for API usage billing</p>
        </div>
        {!showAddCard && (
          <button
            onClick={() => setShowAddCard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Card
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💳 Token-Based Billing</h3>
        <p className="text-xs text-blue-800">
          You'll only be charged for actual API usage (Apollo credits, OpenAI tokens, etc.). 
          Your card is securely stored with Stripe and will be charged monthly based on consumption.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add Card Form */}
      {showAddCard && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Add Payment Method</h3>
          <Elements stripe={stripePromise}>
            <AddCardForm
              onSuccess={() => {
                setShowAddCard(false);
                loadPaymentMethods();
              }}
              onCancel={() => setShowAddCard(false)}
            />
          </Elements>
        </div>
      )}

      {/* Payment Methods List */}
      <div className="space-y-3">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 border border-neutral-200 rounded-lg">
            <CreditCardIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p className="text-neutral-600 font-medium">No payment methods added yet</p>
            <p className="text-sm text-neutral-500 mt-1">Add a card to start using API services</p>
          </div>
        ) : (
          paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`bg-white border rounded-lg p-4 flex items-center justify-between ${
                pm.isDefault ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  pm.isDefault ? 'bg-blue-600' : 'bg-neutral-100'
                }`}>
                  <CreditCardIcon className={`w-6 h-6 ${pm.isDefault ? 'text-white' : 'text-neutral-600'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-neutral-900 capitalize">
                      {pm.brand} •••• {pm.last4}
                    </p>
                    {pm.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600">
                    Expires {pm.expMonth}/{pm.expYear}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!pm.isDefault && (
                  <button
                    onClick={() => handleSetDefault(pm.id)}
                    className="px-3 py-1.5 text-sm border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 font-medium transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleRemoveCard(pm.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove card"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Test Mode Notice */}
      {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('_test_') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs text-yellow-800">
            <strong>Test Mode:</strong> Use test card 4242 4242 4242 4242 with any future expiry date and any CVC.
          </p>
        </div>
      )}
    </div>
  );
}
