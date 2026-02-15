'use client';

import { useState, useEffect } from 'react';
import { CreditCardIcon, PlusIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import PaymentHistory from './PaymentHistory';

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
  const [cardholderName, setCardholderName] = useState('');
  const [cardReady, setCardReady] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Get fresh setup intent when component mounts
  useEffect(() => {
    const fetchSetupIntent = async () => {
      try {
        const { data } = await api.post('/api/billing/setup-intent');
        setClientSecret(data.clientSecret);
        console.log('✅ [BILLING] Fresh setup intent created');
      } catch (err) {
        console.error('❌ [BILLING] Error creating setup intent:', err);
        setError('Failed to initialize payment form. Please try again.');
      }
    };
    
    fetchSetupIntent();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setError(null);

    try {

      // Confirm card setup
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: cardholderName,
          },
        },
      });

      if (stripeError) {
        const errorMsg = stripeError.message || 'Failed to add card';
        if (errorMsg.toLowerCase().includes('too many')) {
          setError('Too many attempts. Please close this form and try again in a moment, or refresh the page.');
        } else {
          setError(errorMsg);
        }
      } else if (setupIntent?.payment_method) {
        // Add payment method (sets paymentMethodAdded=true in users table)
        await api.post('/api/billing/add-payment-method', {
          paymentMethodId: setupIntent.payment_method
        });
        onSuccess();
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to add card';
      if (errorMsg.toLowerCase().includes('different account')) {
        setError('This card was previously used. Please close this form, reopen it, and enter your card details again to create a fresh payment method.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Secure Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-white/80 bg-white/5 rounded-lg py-2 px-4 border border-white/10">
        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span className="font-medium">Secure payment powered by <strong className="text-white">Stripe</strong></span>
      </div>

      {/* Cardholder Name */}
      <div>
        <label className="block text-sm font-medium text-white/90 mb-2.5">
          Cardholder Name
        </label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="John Doe"
          required
          className="w-full px-4 py-3.5 bg-white rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base border-0 shadow-sm"
        />
      </div>

      {/* Card Details */}
      <div>
        <label className="block text-sm font-medium text-white/90 mb-2.5 flex items-center justify-between">
          <span>Card Information</span>
          <div className="flex items-center gap-1.5">
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNTJGRiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSI1IiBmaWxsPSIjRUIwMDFCIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMTAiIHI9IjUiIGZpbGw9IiNGRjVGMDAiLz4KPC9zdmc+" alt="Mastercard" className="h-5 w-auto" />
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzFBMUY3MSIvPgo8dGV4dCB4PSI1IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+VklTQTwvdGV4dD4KPC9zdmc+" alt="Visa" className="h-5 w-auto" />
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNzlDMSIvPgo8dGV4dCB4PSI0IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjciIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+QU1FWDwvdGV4dD4KPC9zdmc+" alt="Amex" className="h-5 w-auto" />
          </div>
        </label>
        <div className="p-4 rounded-lg bg-white shadow-sm border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all" style={{ minHeight: '50px' }}>
          <CardElement
            onReady={() => {
              console.log('✅ Stripe CardElement ready');
              setCardReady(true);
            }}
            onChange={(e) => {
              console.log('🔄 Card element changed:', e.complete, e.error);
              if (e.error) {
                setError(e.error.message);
              } else {
                setError(null);
              }
            }}
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1f2937',
                  lineHeight: '24px',
                  '::placeholder': {
                    color: '#9ca3af',
                  },
                },
                invalid: {
                  color: '#dc2626',
                  iconColor: '#dc2626',
                },
              },
            }}
          />
        </div>
        <p className="text-xs text-white/60 mt-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>Card number, expiration date, and CVC all appear in this field</span>
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!stripe || !elements || loading || !cardholderName.trim() || !cardReady || !clientSecret}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Processing...
            </span>
          ) : !clientSecret ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Loading...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Add Card Securely
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-4 bg-white/10 text-white/90 rounded-lg hover:bg-white/20 font-semibold text-base transition-all disabled:opacity-50 border border-white/20"
        >
          Cancel
        </button>
      </div>

      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <div className="text-xs text-white/80 space-y-1.5 leading-relaxed">
            <p className="font-medium text-white">Your payment is secure</p>
            <p>• We use industry-standard encryption</p>
            <p>• Stripe handles all card data securely</p>
            <p>• We never store your full card number</p>
            <p>• PCI DSS Level 1 certified</p>
          </div>
        </div>
      </div>
    </form>
  );
}

function BillingContentInner({ onPaymentAddedAction }: { onPaymentAddedAction?: () => void }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialCredits, setTrialCredits] = useState<any>(null);

  useEffect(() => {
    loadPaymentMethods();
    loadTrialCredits();
  }, []);

  const loadTrialCredits = async () => {
    try {
      const { data } = await api.get('/api/billing/trial-credits');
      if (data.success) {
        setTrialCredits(data.credits);
      }
    } catch (err: any) {
      console.error('Failed to load trial credits:', err);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      console.log('🔵 [BILLING] Fetching payment methods...');
      console.log('🔵 [BILLING] API Base URL:', api.defaults.baseURL);
      console.log('🔵 [BILLING] Full URL:', `${api.defaults.baseURL}/api/billing/payment-methods`);
      const { data } = await api.get('/api/billing/payment-methods');
      console.log('✅ [BILLING] Payment methods received:', data);
      setPaymentMethods(data.paymentMethods || []);
      setError(null);
    } catch (err: any) {
      console.error('❌ [BILLING] Error loading payment methods:', err);
      console.error('❌ [BILLING] Error response:', err.response);
      console.error('❌ [BILLING] Error status:', err.response?.status);
      console.error('❌ [BILLING] Error data:', err.response?.data);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trial Credits Banner */}
      {trialCredits && !trialCredits.paymentMethodAdded && (
        <div className={`rounded-lg p-4 ${
          trialCredits.limitReached 
            ? 'bg-red-50 border-2 border-red-300' 
            : trialCredits.warningThreshold
            ? 'bg-yellow-50 border-2 border-yellow-300'
            : 'bg-blue-50 border-2 border-blue-300'
        }`}>
          <div className="flex items-start gap-3">
            <div className="text-2xl">
              {trialCredits.limitReached ? '🚫' : trialCredits.warningThreshold ? '⚠️' : '🎁'}
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-semibold mb-1 ${
                trialCredits.limitReached 
                  ? 'text-red-900' 
                  : trialCredits.warningThreshold
                  ? 'text-yellow-900'
                  : 'text-blue-900'
              }`}>
                {trialCredits.limitReached 
                  ? 'Trial Credits Exhausted' 
                  : trialCredits.warningThreshold
                  ? 'Trial Credits Running Low'
                  : 'Free Trial Active'}
              </h3>
              <p className={`text-xs ${
                trialCredits.limitReached 
                  ? 'text-red-800' 
                  : trialCredits.warningThreshold
                  ? 'text-yellow-800'
                  : 'text-blue-800'
              }`}>
                {trialCredits.limitReached 
                  ? `You've used all $${trialCredits.creditsLimit} of your trial credits. Add a payment method below to continue using the platform.`
                  : `You've used $${trialCredits.creditsUsed} of your $${trialCredits.creditsLimit} trial credits (${trialCredits.percentageUsed}%). Add a payment method to unlock unlimited API usage.`
                }
              </p>
              <div className="mt-2 bg-white/50 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    trialCredits.limitReached 
                      ? 'bg-red-600' 
                      : trialCredits.warningThreshold
                      ? 'bg-yellow-600'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(parseFloat(trialCredits.percentageUsed), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Payment Methods</h2>
          <p className="text-sm text-white/80 mt-1">Manage your credit cards for API usage billing</p>
        </div>
        {!showAddCard && (
          <button
            onClick={() => setShowAddCard(true)}
            style={{ 
              backgroundColor: '#2563eb', 
              color: '#ffffff', 
              border: 'none'
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
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
        <div className="bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <CreditCardIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-white">Add Payment Method</h3>
          </div>
          <AddCardForm
            onSuccess={() => {
              setShowAddCard(false);
              loadPaymentMethods();
              loadTrialCredits();
              // Call onPaymentAddedAction callback if provided
              if (onPaymentAddedAction) {
                onPaymentAddedAction();
              } else {
                // Reload page to refresh user data and remove trial banner
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              }
            }}
            onCancel={() => setShowAddCard(false)}
          />
        </div>
      )}

      {/* Payment Methods List */}
      <div className="space-y-3">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-white/20 rounded-lg">
            <CreditCardIcon className="w-12 h-12 text-white/60 mx-auto mb-3" />
            <p className="text-white/80 font-medium">No payment methods added yet</p>
            <p className="text-sm text-white/70 mt-1">Add a card to start using API services</p>
          </div>
        ) : (
          paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`bg-white/10 backdrop-blur-md border rounded-lg p-4 flex items-center justify-between ${
                pm.isDefault ? 'border-blue-500 bg-blue-50' : 'border-white/20'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  pm.isDefault ? 'bg-blue-600' : 'bg-white/5'
                }`}>
                  <CreditCardIcon className={`w-6 h-6 ${pm.isDefault ? 'text-white' : 'text-white/80'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white capitalize">
                      {pm.brand} •••• {pm.last4}
                    </p>
                    {pm.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/80">
                    Expires {pm.expMonth}/{pm.expYear}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!pm.isDefault && (
                  <button
                    onClick={() => handleSetDefault(pm.id)}
                    className="px-3 py-1.5 text-sm border border-white/20 text-white/90 rounded-lg hover:bg-white/5 font-medium transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleRemoveCard(pm.id)}
                  className="p-2 text-red-600 bg-red-50/50 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove card"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function BillingContent({ onPaymentAddedAction }: { onPaymentAddedAction?: () => void }) {
  return (
    <Elements stripe={stripePromise}>
      <BillingContentInner onPaymentAddedAction={onPaymentAddedAction} />
    </Elements>
  );
}
