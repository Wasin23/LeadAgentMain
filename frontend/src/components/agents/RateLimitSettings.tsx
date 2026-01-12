'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import BillingContent from '../BillingContent';

interface HistoricalData {
  date: string;
  tokens: number;
  cost: number;
  label: string;
}

type TimeFilter = 'hour' | 'day' | 'month';

const RateLimitSettings: React.FC = () => {
  const [monthlyBudget, setMonthlyBudget] = useState<number>(100); // Default $100/month
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [trialCredits, setTrialCredits] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [serviceBreakdown, setServiceBreakdown] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  // Average cost per lead (all services combined)
  const avgCostPerLead = 0.18; // ~$0.18 per lead (Apollo search + email unlock + OpenAI + ZeroBounce + Serper + Mailgun)

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showPaymentModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPaymentModal]);

  useEffect(() => {
    fetchBudgetAndSpending();
  }, []);

  const fetchBudgetAndSpending = async () => {
    try {
      // Fetch trial credits first
      const trialResponse = await api.get('/api/billing/trial-credits');
      if (trialResponse.data.success) {
        setTrialCredits(trialResponse.data.credits);
        
        // If on trial (no payment method), use trial credits as "budget"
        if (!trialResponse.data.credits.paymentMethodAdded) {
          setTotalSpent(parseFloat(trialResponse.data.credits.creditsUsed));
        }
      }

      // Fetch saved budget
      const budgetResponse = await api.get('/api/lead-agent/rate-limits');
      console.log('💰 Budget response:', budgetResponse.data);
      if (budgetResponse.data.success) {
        const savedBudget = budgetResponse.data.rateLimits?.monthlyBudget;
        console.log('💰 Saved budget value:', savedBudget);
        if (savedBudget !== undefined && savedBudget !== null) {
          setMonthlyBudget(savedBudget);
        } else {
          setMonthlyBudget(100); // Default
        }
      }

      // Fetch total spending
      let totalCost = 0;
      const spendingResponse = await api.get('/api/lead-agent/api-usage/total');
      if (spendingResponse.data.success) {
        totalCost = 
          (spendingResponse.data.stats?.apollo?.cost || 0) +
          (spendingResponse.data.stats?.openai?.cost || 0) +
          (spendingResponse.data.stats?.mailgun?.cost || 0) +
          (spendingResponse.data.stats?.zerobounce?.cost || 0) +
          (spendingResponse.data.stats?.serper?.cost || 0);
        
        // Subtract trial credits used as a credit if payment method is added
        const trialCredit = (spendingResponse.data.hasPaymentMethod && spendingResponse.data.trialCreditsUsed) 
          ? spendingResponse.data.trialCreditsUsed 
          : 0;
        
        // For display: show outstanding this month (or trial usage if no payment method)
        setTotalSpent(spendingResponse.data.hasPaymentMethod 
          ? (spendingResponse.data.outstandingThisMonth || 0)
          : (totalCost - trialCredit));
      }

      // Fetch next billing date from payment stats
      const statsResponse = await api.get('/api/billing/payment-stats');
      if (statsResponse.data.stats?.nextBillingDate) {
        setNextBillingDate(statsResponse.data.stats.nextBillingDate);
      }

      // Fetch real historical data from timeseries endpoint
      await fetchHistoricalData(timeFilter);
    } catch (error: any) {
      console.error('Error fetching budget/spending:', error);
      setMessage({ type: 'error', text: 'Failed to load budget settings' });
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

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      console.log('💾 Saving budget:', monthlyBudget);
      const response = await api.post('/api/lead-agent/rate-limits', { 
        rateLimits: { monthlyBudget } 
      });

      console.log('💾 Save response:', response.data);

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Budget saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
        
        // Refresh to confirm it was saved
        await fetchBudgetAndSpending();
      } else {
        throw new Error(response.data.message || 'Failed to save budget');
      }
    } catch (error: any) {
      console.error('Error saving budget:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save budget' });
    } finally {
      setSaving(false);
    }
  };

  // Calculate estimates
  const effectiveBudget = trialCredits && !trialCredits.paymentMethodAdded ? 25 : monthlyBudget;
  const estimatedLeadsPerMonth = Math.floor(effectiveBudget / avgCostPerLead);
  const estimatedLeadsPerWeek = Math.floor(estimatedLeadsPerMonth / 4.33);
  const estimatedLeadsPerDay = Math.floor(estimatedLeadsPerMonth / 30);
  const remainingBudget = effectiveBudget - totalSpent;
  const budgetUsedPercent = effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : 0;

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
          Budget Management
        </h2>
        <p className="text-white/80">
          Set your monthly API spending limit and track your usage
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

      {/* Total Spent Card */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-baseline gap-3 mb-1">
              <p className="text-blue-100 text-sm font-medium">
                {trialCredits && !trialCredits.paymentMethodAdded ? 'Trial Credits Used' : 'Outstanding This Month'}
              </p>
              {nextBillingDate && trialCredits?.paymentMethodAdded && (
                <p className="text-blue-200 text-xs">
                  Next: {new Date(nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
            <p className="text-4xl font-bold">${totalSpent.toFixed(2)}</p>
            {trialCredits?.paymentMethodAdded && trialCredits?.creditsUsed > 0 && (
              <p className="text-green-200 text-xs mt-1">
                🎁 ${parseFloat(trialCredits.creditsUsed).toFixed(2)} trial credit applied
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm font-medium mb-1">
              {trialCredits && !trialCredits.paymentMethodAdded ? 'Trial Budget' : 'Monthly Budget'}
            </p>
            <p className="text-2xl font-semibold">
              ${trialCredits && !trialCredits.paymentMethodAdded ? '25.00' : monthlyBudget.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm text-blue-100 mb-1">
            <span>{budgetUsedPercent.toFixed(1)}% used</span>
            <span>
              ${remainingBudget.toFixed(2)} remaining
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                budgetUsedPercent > 90 ? 'bg-red-400' : 
                budgetUsedPercent > 75 ? 'bg-yellow-400' : 
                'bg-white/10 backdrop-blur-md'
              }`}
              style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
            ></div>
          </div>
        </div>

        {budgetUsedPercent > 90 && (
          <div className="bg-red-500/20 border border-red-300/30 rounded px-3 py-2 text-sm">
            ⚠️ Warning: You have used {budgetUsedPercent.toFixed(1)}% of your {trialCredits && !trialCredits.paymentMethodAdded ? 'trial budget' : 'monthly budget'}
          </div>
        )}
        
        {trialCredits && !trialCredits.paymentMethodAdded && (
          <div className="mt-3 bg-white/10 border border-white/20 rounded px-3 py-2 text-sm">
            🎁 You're on a free trial! Add a payment method below to unlock unlimited usage.
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
            Unlock Unlimited Usage
          </h3>
          <p className="text-sm text-white/80 mb-4">
            Add a payment method to remove trial limits and continue using all features without interruption.
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

      {/* Budget Settings - Only show if payment method added */}
      {trialCredits && trialCredits.paymentMethodAdded && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Set Monthly Budget
          </h3>

          <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Monthly Spending Limit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-white/70 dark:text-gray-400 text-lg">$</span>
              <input
                type="number"
                min="0"
                step="10"
                value={monthlyBudget === 0 ? '' : monthlyBudget}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setMonthlyBudget(0);
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setMonthlyBudget(numValue);
                    }
                  }
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-gray-300 dark:border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-white/70 dark:text-gray-400 mt-1">
              Recommended: $50-$500/month depending on lead volume goals
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-3 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            style={saving ? 
              { backgroundColor: '#60a5fa', color: '#ffffff' } : 
              { backgroundColor: '#2563eb', color: '#ffffff' }
            }
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              'Save Budget'
            )}
          </button>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full px-6 py-3 bg-white/10 border-2 border-blue-600 text-white font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCardIcon className="w-5 h-5" />
            Manage Payment Methods
          </button>
        </div>
      </div>
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

      {/* Lead Estimates */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Maximum Lead Capacity
        </h3>
        <p className="text-sm text-white/80 mb-4">
          Maximum leads you can process without exceeding your budget. Based on average cost of ${avgCostPerLead.toFixed(2)} per lead (includes search, email unlock, enrichment, AI, validation, and email delivery).
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {estimatedLeadsPerDay}
            </p>
            <p className="text-sm text-white/80 font-medium">max leads/day</p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {estimatedLeadsPerWeek}
            </p>
            <p className="text-sm text-white/80 font-medium">max leads/week</p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {estimatedLeadsPerMonth}
            </p>
            <p className="text-sm text-white/80 font-medium">max leads/month</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <p className="text-sm text-white/90">
            💡 <strong>Note:</strong> These are maximum estimates to stay within budget. 
            Actual costs may vary based on lead complexity and email deliverability. Each qualified lead costs approximately ${avgCostPerLead.toFixed(2)} in API fees.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RateLimitSettings;
