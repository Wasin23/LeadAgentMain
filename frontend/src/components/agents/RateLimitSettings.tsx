'use client';

import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

const RateLimitSettings: React.FC = () => {
  const [monthlyBudget, setMonthlyBudget] = useState<number>(100); // Default $100/month
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Average cost per lead (all services combined)
  const avgCostPerLead = 0.03; // ~$0.03 per lead (Apollo search + enrich + OpenAI + ZeroBounce + Mailgun)

  useEffect(() => {
    fetchBudgetAndSpending();
  }, []);

  const fetchBudgetAndSpending = async () => {
    try {
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
      const spendingResponse = await api.get('/api/lead-agent/api-usage/total');
      if (spendingResponse.data.success) {
        const totalCost = 
          (spendingResponse.data.stats?.apollo?.cost || 0) +
          (spendingResponse.data.stats?.openai?.cost || 0) +
          (spendingResponse.data.stats?.mailgun?.cost || 0) +
          (spendingResponse.data.stats?.zerobounce?.cost || 0) +
          (spendingResponse.data.stats?.serper?.cost || 0);
        setTotalSpent(totalCost);
      }
    } catch (error: any) {
      console.error('Error fetching budget/spending:', error);
      setMessage({ type: 'error', text: 'Failed to load budget settings' });
    } finally {
      setLoading(false);
    }
  };

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
  const estimatedLeadsPerMonth = Math.floor(monthlyBudget / avgCostPerLead);
  const estimatedLeadsPerWeek = Math.floor(estimatedLeadsPerMonth / 4.33);
  const estimatedLeadsPerDay = Math.floor(estimatedLeadsPerMonth / 30);
  const remainingBudget = monthlyBudget - totalSpent;
  const budgetUsedPercent = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Budget Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
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
            <p className="text-blue-100 text-sm font-medium mb-1">Total Spent This Month</p>
            <p className="text-4xl font-bold">${totalSpent.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm font-medium mb-1">Monthly Budget</p>
            <p className="text-2xl font-semibold">${monthlyBudget.toFixed(2)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm text-blue-100 mb-1">
            <span>{budgetUsedPercent.toFixed(1)}% used</span>
            <span>${remainingBudget.toFixed(2)} remaining</span>
          </div>
          <div className="w-full bg-blue-400/30 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                budgetUsedPercent > 90 ? 'bg-red-400' : 
                budgetUsedPercent > 75 ? 'bg-yellow-400' : 
                'bg-white'
              }`}
              style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
            ></div>
          </div>
        </div>

        {budgetUsedPercent > 90 && (
          <div className="bg-red-500/20 border border-red-300/30 rounded px-3 py-2 text-sm">
            ⚠️ Warning: You have used {budgetUsedPercent.toFixed(1)}% of your monthly budget
          </div>
        )}
      </div>

      {/* Budget Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Set Monthly Budget
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Monthly Spending Limit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 text-lg">$</span>
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
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Recommended: $50-$500/month depending on lead volume goals
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
        </div>
      </div>

      {/* Lead Estimates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Estimated Lead Capacity
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Based on average cost of ${avgCostPerLead.toFixed(2)} per lead (includes search, enrichment, AI, validation, and email)
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {estimatedLeadsPerDay}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">leads/day</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {estimatedLeadsPerWeek}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">leads/week</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {estimatedLeadsPerMonth}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">leads/month</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            💡 <strong>Tip:</strong> Adjust your monthly budget to match your desired lead volume. 
            Each qualified lead costs approximately ${avgCostPerLead.toFixed(2)} in API fees.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RateLimitSettings;
