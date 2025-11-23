'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, GiftIcon, XCircleIcon } from '@heroicons/react/24/solid';
import api from '@/lib/api';

interface TrialCredits {
  creditsUsed: string;
  creditsLimit: number;
  creditsRemaining: string;
  percentageUsed: string;
  paymentMethodAdded: boolean;
  limitReached: boolean;
  warningThreshold: boolean;
}

export default function TrialCreditBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<TrialCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCredits();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchCredits = async () => {
    try {
      const response = await api.get('/api/billing/trial-credits');
      if (response.data.success) {
        setCredits(response.data.credits);
      }
    } catch (error) {
      console.error('Failed to fetch trial credits:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading || !credits || credits.paymentMethodAdded || dismissed) {
    return null;
  }

  // Always show banner to inform users they're on trial mode

  const getBackgroundColor = () => {
    if (credits.limitReached) return 'bg-red-600';
    if (credits.warningThreshold) return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  const getMessage = () => {
    if (credits.limitReached) {
      return `Trial limit reached! You've used all $${credits.creditsLimit} of your free trial credits. Add a payment method to continue.`;
    }
    if (credits.warningThreshold) {
      return `Trial Warning: You've used $${credits.creditsUsed} of your $${credits.creditsLimit} free trial credits (${credits.percentageUsed}%). Add a payment method to avoid service interruption.`;
    }
    return `Free Trial Active: You have $${credits.creditsRemaining} remaining of your $${credits.creditsLimit} trial credits. Add a payment method for unlimited access.`;
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className={`${getBackgroundColor()} text-white px-4 py-3 relative`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {credits.limitReached ? (
            <XCircleIcon className="w-6 h-6 flex-shrink-0" />
          ) : credits.warningThreshold ? (
            <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0" />
          ) : (
            <GiftIcon className="w-6 h-6 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">
            {getMessage()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {!credits.limitReached && (
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white text-sm px-3 py-1 rounded"
            >
              Dismiss
            </button>
          )}
          <button
            onClick={() => {
              router.push('/dashboard');
              // Use setTimeout to ensure navigation completes before triggering settings
              setTimeout(() => {
                const settingsButton = document.querySelector('[data-settings-trigger]') as HTMLButtonElement;
                if (settingsButton) {
                  settingsButton.click();
                  // Poll for budget tab to appear (wait for React to render)
                  let attempts = 0;
                  const checkForBudgetTab = setInterval(() => {
                    attempts++;
                    const budgetTab = document.querySelector('[data-tab="budget"]') as HTMLButtonElement;
                    if (budgetTab) {
                      clearInterval(checkForBudgetTab);
                      budgetTab.click();
                      setDismissed(true);
                      console.log('Budget tab clicked successfully');
                    } else if (attempts > 20) {
                      // Give up after 2 seconds (20 * 100ms)
                      clearInterval(checkForBudgetTab);
                      console.log('Budget tab not found after 2 seconds');
                    }
                  }, 100);
                }
              }, 300);
            }}
            className="bg-white text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Add Payment Method
          </button>
        </div>
      </div>
    </div>
  );
}
