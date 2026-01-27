'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CreditCardIcon, SparklesIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import BillingContent from '../BillingContent';
import CreditPurchaseModal from '../CreditPurchaseModal';

interface HistoricalData {
  date: string;
  tokens: number;
  cost: number;
  label: string;
}

type TimeFilter = 'hour' | 'day' | 'month';

const RateLimitSettings: React.FC = () => {
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditsSpent, setCreditsSpent] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditPurchaseModal, setShowCreditPurchaseModal] = useState(false);
  const [trialCredits, setTrialCredits] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [serviceBreakdown, setServiceBreakdown] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  // Credit cost per email (~0.67 credits = ~$0.033 in actual API costs with 1.2x multiplier)
  const avgCreditsPerEmail = 0.67;

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showPaymentModal || showCreditPurchaseModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPaymentModal, showCreditPurchaseModal]);

  useEffect(() => {
    fetchBudgetAndSpending();
  }, []);

  const fetchBudgetAndSpending = async () => {
    try {
      // Fetch trial credits first
      const trialResponse = await api.get('/api/billing/trial-credits');
      if (trialResponse.data.success) {
        setTrialCredits(trialResponse.data.credits);
        // Use trial credits remaining as the credit balance if available
        const remainingCredits = parseFloat(trialResponse.data.credits.creditsRemaining) || 0;
        setCreditBalance(remainingCredits);
      }

      // Fetch user plan information
      try {
        const planResponse = await api.get('/api/plans/status');
        if (planResponse.data.success) {
          setUserPlan(planResponse.data);
          // If user has a plan with credits, add those to the balance
          if (planResponse.data.plan?.remainingCredits) {
            setCreditBalance(prev => prev + planResponse.data.plan.remainingCredits);
          }
        }
      } catch (error) {
        console.log('Plan info not available:', error);
      }

      // Only fetch credit balance if not using trial credits
      // (paid balance is separate from trial)
      const balanceResponse = await api.get('/api/billing/credit-balance');
      if (balanceResponse.data.success && balanceResponse.data.balance) {
        setCreditBalance(prev => prev + (balanceResponse.data.balance || 0));
      }

      // Fetch total spending and convert to credits (1 credit = $0.05)
      let totalCost = 0;
      const spendingResponse = await api.get('/api/lead-agent/api-usage/total');
      if (spendingResponse.data.success) {
        totalCost = 
          (spendingResponse.data.stats?.apollo?.cost || 0) +
          (spendingResponse.data.stats?.openai?.cost || 0) +
          (spendingResponse.data.stats?.mailgun?.cost || 0) +
          (spendingResponse.data.stats?.zerobounce?.cost || 0) +
          (spendingResponse.data.stats?.serper?.cost || 0);
        
        // Convert cost to credits (1 credit = $0.05)
        const creditsUsed = totalCost / 0.05;
        setCreditsSpent(creditsUsed);
      }

      // Fetch real historical data from timeseries endpoint
      await fetchHistoricalData(timeFilter);
    } catch (error: any) {
      console.error('Error fetching credit balance/spending:', error);
      setMessage({ type: 'error', text: 'Failed to load credit balance' });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async (filter: TimeFilter) => {
    try {
      let days = 30;
      let interval = 'day';
      
      if (filter === 'hour') {
        days = 1;
        interval = 'hour';
      } else if (filter === 'day') {
        days = 30;
        interval = 'day';
      } else if (filter === 'month') {
        days = 365;
        interval = 'month';
      }

      const response = await api.get('/api/lead-agent/api-usage/timeseries', {
        params: { days, interval }
      });

      if (response.data.success && response.data.series) {
        const formattedData: HistoricalData[] = response.data.series.map((item: any) => {
          // For day view, show just the day number
          let displayLabel = item.date;
          if (filter === 'day' && item.sortKey) {
            const date = new Date(item.sortKey);
            displayLabel = date.getDate().toString();
          }
          
          return {
            date: item.sortKey,
            label: displayLabel,
            tokens: item.totalCalls || 0,
            cost: item.total?.cost || 0
          };
        });

        setHistoricalData(formattedData);
      } else {
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      setHistoricalData([]);
    }
  };

  // Fetch data when time filter changes
  useEffect(() => {
    if (!loading) {
      fetchHistoricalData(timeFilter);
    }
  }, [timeFilter]);

  // Calculate estimates
  const estimatedEmailsAvailable = Math.floor(creditBalance / avgCreditsPerEmail);
  const estimatedEmailsPerDay = Math.floor(estimatedEmailsAvailable / 30);
  const estimatedEmailsPerWeek = Math.floor(estimatedEmailsAvailable / 4.33);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Credit Management
        </h2>
        <p className="text-white/80">
          Track your credit balance and purchase more credits as needed
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Credit Balance Card */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            {/* Current Plan Display */}
            {userPlan?.plan && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-700/50 border border-blue-300/30 rounded-lg">
                  <CheckIcon className="w-4 h-4 text-blue-300" />
                  <span className="text-sm text-blue-300 font-medium">
                    {userPlan.plan.name}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-baseline gap-3 mb-1">
              <p className="text-blue-100 text-sm font-medium">
                Credit Balance
              </p>
              <p className="text-blue-200 text-xs">
                1 credit = $0.05 in API costs
              </p>
            </div>
            <div className="flex items-baseline gap-3">
              <p className="text-5xl font-bold">{Math.ceil(creditBalance).toLocaleString()}</p>
              <p className="text-blue-200 text-xl">credits</p>
            </div>
            <p className="text-blue-100 text-sm mt-2">
              ≈ {estimatedEmailsAvailable.toLocaleString()} emails available
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={() => setShowCreditPurchaseModal(true)}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg font-semibold transition-all flex items-center gap-2 border border-white/30 hover:border-white/50 hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Buy More Credits
            </button>
          </div>
        </div>

        {/* Credits Spent This Month */}
        <div className="border-t border-white/20 pt-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Credits Spent This Month</p>
              <p className="text-2xl font-bold">{creditsSpent.toFixed(0)} credits</p>
              <p className="text-blue-200 text-xs mt-1">
                ${(creditsSpent * 0.05).toFixed(2)} in API costs
              </p>
            </div>
            {creditBalance < 100 && (
              <div className="bg-yellow-500/20 border border-yellow-300/30 rounded px-3 py-2 text-sm">
                ⚠️ Low balance
              </div>
            )}
          </div>
        </div>
        
        {trialCredits && !trialCredits.paymentMethodAdded && (
          <div className="mt-4 bg-white/10 border border-white/20 rounded px-3 py-2 text-sm">
            🎁 You're on a free trial! Add a payment method below to purchase credits.
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      {historicalData.length > 0 && (
        <div className="space-y-6">
          {/* Cost Breakdown Dropdown */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
            <button
              onClick={() => setShowCostBreakdown(!showCostBreakdown)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="text-lg font-semibold text-white">Cost Breakdown by Service</h3>
              <svg
                className={`w-5 h-5 text-white transition-transform ${showCostBreakdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showCostBreakdown && (
              <div className="mt-6 space-y-4">
                {/* Apollo API */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">A</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h4 className="text-white font-semibold">Apollo API</h4>
                          <p className="text-white/60 text-sm">Lead enrichment & search</p>
                        </div>
                        <span className="text-green-400 text-xs font-medium">● Active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Credits Used</p>
                          <p className="text-white font-semibold">1,454</p>
                        </div>
                        <div>
                          <p className="text-white/60">API Calls</p>
                          <p className="text-white font-semibold">891</p>
                        </div>
                        <div>
                          <p className="text-white/60">Cost</p>
                          <p className="text-white font-semibold">$37.80</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* OpenAI API */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">AI</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h4 className="text-white font-semibold">OpenAI API</h4>
                          <p className="text-white/60 text-sm">GPT-3.5 reasoning</p>
                        </div>
                        <span className="text-green-400 text-xs font-medium">● Active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Tokens Used</p>
                          <p className="text-white font-semibold">2,184,974</p>
                        </div>
                        <div>
                          <p className="text-white/60">API Calls</p>
                          <p className="text-white font-semibold">2,776</p>
                        </div>
                        <div>
                          <p className="text-white/60">Cost</p>
                          <p className="text-white font-semibold">$7.43</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mailgun */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">M</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h4 className="text-white font-semibold">Mailgun</h4>
                          <p className="text-white/60 text-sm">Email delivery</p>
                        </div>
                        <span className="text-green-400 text-xs font-medium">● Active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Emails Sent</p>
                          <p className="text-white font-semibold">55</p>
                        </div>
                        <div>
                          <p className="text-white/60">Delivered</p>
                          <p className="text-white font-semibold">55</p>
                        </div>
                        <div>
                          <p className="text-white/60">Cost</p>
                          <p className="text-white font-semibold">$0.07</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ZeroBounce */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">Z</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h4 className="text-white font-semibold">ZeroBounce</h4>
                          <p className="text-white/60 text-sm">Email validation</p>
                        </div>
                        <span className="text-green-400 text-xs font-medium">● Active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Validations</p>
                          <p className="text-white font-semibold">119</p>
                        </div>
                        <div>
                          <p className="text-white/60">API Calls</p>
                          <p className="text-white font-semibold">119</p>
                        </div>
                        <div>
                          <p className="text-white/60">Cost</p>
                          <p className="text-white font-semibold">$1.01</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Serper */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">S</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h4 className="text-white font-semibold">Serper</h4>
                          <p className="text-white/60 text-sm">Web search</p>
                        </div>
                        <span className="text-green-400 text-xs font-medium">● Active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Searches</p>
                          <p className="text-white font-semibold">409</p>
                        </div>
                        <div>
                          <p className="text-white/60">API Calls</p>
                          <p className="text-white font-semibold">409</p>
                        </div>
                        <div>
                          <p className="text-white/60">Cost</p>
                          <p className="text-white font-semibold">$0.41</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Payment Method Button - Show for trial users */}
      {trialCredits && !trialCredits.paymentMethodAdded && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Add Payment Method to Purchase Credits
          </h3>
          <p className="text-sm text-white/80 mb-4">
            Add a payment method to purchase credits and continue using all features without interruption.
          </p>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <CreditCardIcon className="w-5 h-5" />
            Add Payment Method
          </button>
        </div>
      )}

      {/* Manage Payment Methods - Only show if payment method added */}
      {trialCredits && trialCredits.paymentMethodAdded && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Payment Methods
          </h3>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full px-6 py-3 bg-white/10 border-2 border-blue-600 text-white font-medium rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCardIcon className="w-5 h-5" />
            Manage Payment Methods
          </button>
        </div>
      )}

      {/* Credit Purchase Modal */}
      {showCreditPurchaseModal && typeof window !== 'undefined' && ReactDOM.createPortal(
        <CreditPurchaseModal
          mode="topup"
          currentPlan={userPlan?.plan?.id}
          onClose={() => setShowCreditPurchaseModal(false)}
          onSuccess={() => {
            setShowCreditPurchaseModal(false);
            setMessage({ type: 'success', text: 'Credits purchased successfully!' });
            setTimeout(() => setMessage(null), 3000);
            fetchBudgetAndSpending(); // Refresh credit balance
          }}
        />,
        document.body
      )}

      {/* Payment Methods Modal */}
      {showPaymentModal && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 overflow-hidden" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPaymentModal(false);
            }
          }}
        >
          <div className="bg-white/10 backdrop-blur-md rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/10 backdrop-blur-md border-b border-white/20 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Payment Methods</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-8">
              <BillingContent />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Email Estimates */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Email Capacity Estimates
        </h3>
        <p className="text-sm text-white/80 mb-4">
          Estimated emails you can send with your current credit balance. Based on average of {avgCreditsPerEmail} credits per email (includes search, enrichment, AI, validation, and delivery).
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {estimatedEmailsPerDay}
            </p>
            <p className="text-sm text-white/80 font-medium">emails/day</p>
            <p className="text-xs text-white/60 mt-1">for 30 days</p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {estimatedEmailsPerWeek}
            </p>
            <p className="text-sm text-white/80 font-medium">emails/week</p>
            <p className="text-xs text-white/60 mt-1">for 4.33 weeks</p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {estimatedEmailsAvailable}
            </p>
            <p className="text-sm text-white/80 font-medium">total available</p>
            <p className="text-xs text-white/60 mt-1">current balance</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <p className="text-sm text-white/90">
            💡 <strong>Note:</strong> These are estimates based on average consumption. 
            Actual costs may vary based on research depth and email deliverability. Credits never expire and roll over indefinitely.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RateLimitSettings;
