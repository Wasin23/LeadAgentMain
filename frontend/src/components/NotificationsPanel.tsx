'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X, DollarSign, Bot, Mail, Settings, Gift } from 'lucide-react';
import api from '@/lib/api';

interface Issue {
  issueId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

interface TrialCredits {
  creditsUsed: string;
  creditsLimit: number;
  creditsRemaining: string;
  percentageUsed: string;
  paymentMethodAdded: boolean;
  limitReached: boolean;
  warningThreshold: boolean;
}

export default function NotificationsPanel() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [credits, setCredits] = useState<TrialCredits | null>(null);
  const [trialDismissed, setTrialDismissed] = useState(false);

  const fetchIssues = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch issues
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/issues`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssues(data.issues);
        }
      }

      // Fetch trial credits
      try {
        const creditsResponse = await api.get('/api/billing/trial-credits');
        if (creditsResponse.data.success) {
          const trialData = creditsResponse.data.credits;
          
          const spendingResponse = await api.get('/api/lead-agent/api-usage/total');
          if (spendingResponse.data.success) {
            const actualSpent = 
              (spendingResponse.data.stats?.apollo?.cost || 0) +
              (spendingResponse.data.stats?.openai?.cost || 0) +
              (spendingResponse.data.stats?.mailgun?.cost || 0) +
              (spendingResponse.data.stats?.zerobounce?.cost || 0) +
              (spendingResponse.data.stats?.serper?.cost || 0);
            
            const creditsLimit = trialData.creditsLimit;
            const creditsRemaining = Math.max(0, creditsLimit - actualSpent);
            const percentageUsed = (actualSpent / creditsLimit) * 100;
            
            setCredits({
              ...trialData,
              creditsUsed: actualSpent.toFixed(2),
              creditsRemaining: creditsRemaining.toFixed(2),
              percentageUsed: percentageUsed.toFixed(1),
              limitReached: actualSpent >= creditsLimit,
              warningThreshold: percentageUsed >= 80
            });
          } else {
            setCredits(trialData);
          }
        }
      } catch (error) {
        console.error('Error fetching trial credits:', error);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (issueId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/issues/${issueId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIssues(prev => prev.map(issue =>
          issue.issueId === issueId ? { ...issue, read: true } : issue
        ));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteIssue = async (issueId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/issues/${issueId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIssues(prev => prev.filter(issue => issue.issueId !== issueId));
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIssues(prev => prev.map(issue => ({ ...issue, read: true })));
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleAddPayment = () => {
    router.push('/dashboard');
    setTimeout(() => {
      const settingsButton = document.querySelector('[data-settings-trigger]') as HTMLButtonElement;
      if (settingsButton) {
        settingsButton.click();
        let attempts = 0;
        const checkForBudgetTab = setInterval(() => {
          attempts++;
          const budgetTab = document.querySelector('[data-tab="budget"]') as HTMLButtonElement;
          if (budgetTab) {
            clearInterval(checkForBudgetTab);
            budgetTab.click();
          } else if (attempts > 20) {
            clearInterval(checkForBudgetTab);
          }
        }, 100);
      }
    }, 300);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'billing':
        return <DollarSign className="h-4 w-4" />;
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const filteredIssues = filter === 'unread'
    ? issues.filter(issue => !issue.read)
    : issues;

  const sortedIssues = [...filteredIssues].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40 w-80 lg:w-96 h-[70vh] flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-t-2xl px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-white" />
            <h3 className="text-white font-semibold text-lg">Notifications</h3>
          </div>
          {(filteredIssues.filter(i => !i.read).length > 0 || (credits && !credits.paymentMethodAdded && !trialDismissed)) && (
            <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {filteredIssues.filter(i => !i.read).length + (credits && !credits.paymentMethodAdded && !trialDismissed ? 1 : 0)}
            </span>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white/5 backdrop-blur-md border-x border-white/20 flex-1 overflow-y-auto">
        {/* Trial Credit Notification - Always on top */}
        {credits && !credits.paymentMethodAdded && !trialDismissed && (
          <div className="p-3">
            <div className={`p-4 rounded-xl border transition-all ${
              credits.limitReached 
                ? 'border-red-500/30 bg-red-500/10' 
                : credits.warningThreshold 
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-blue-500/30 bg-blue-500/10'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {credits.limitReached ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : credits.warningThreshold ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <Gift className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-relaxed break-words mb-2">
                    {credits.limitReached 
                      ? `Trial limit reached! Add payment to continue.`
                      : credits.warningThreshold
                      ? `Trial: $${credits.creditsUsed}/$${credits.creditsLimit} used (${credits.percentageUsed}%)`
                      : `Free Trial: $${credits.creditsRemaining} of $${credits.creditsLimit} remaining`
                    }
                  </p>
                  <button
                    onClick={handleAddPayment}
                    className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors border border-white/30"
                  >
                    Add Payment Method
                  </button>
                </div>
                {!credits.limitReached && (
                  <button
                    onClick={() => setTrialDismissed(true)}
                    className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Regular Issues */}
        {sortedIssues.length === 0 && (!credits || credits.paymentMethodAdded || trialDismissed) ? (
          <div className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-white/30" />
            <p className="font-medium text-white/70">No notifications</p>
            <p className="text-sm mt-1 text-white/50">You're all caught up!</p>
          </div>
        ) : sortedIssues.length > 0 ? (
          <div className="p-3 space-y-2">
            {sortedIssues.map((issue) => (
              <div
                key={issue.issueId}
                className={`p-4 rounded-xl border transition-all hover:bg-white/10 ${
                  !issue.read ? 'border-white/30 bg-white/10' : 'border-white/20 bg-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(issue.severity)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium text-sm ${!issue.read ? 'text-white' : 'text-white/80'}`}>
                          {issue.title}
                        </h3>
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white/10 text-white/70 rounded-full">
                          {getTypeIcon(issue.type)}
                          {issue.type}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteIssue(issue.issueId)}
                        className="text-white/40 hover:text-white/70 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <p className="text-sm text-white/70 mb-2">{issue.message}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        {new Date(issue.timestamp).toLocaleString()}
                      </span>
                      {!issue.read && (
                        <button
                          onClick={() => markAsRead(issue.issueId)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                    
                    {issue.data?.amount && (
                      <div className="mt-2 p-2 bg-white/10 rounded text-sm text-white/80">
                        Amount: ${issue.data.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-b-2xl px-5 py-3">
        <p className="text-white/50 text-xs text-center">
          Stay updated with important alerts
        </p>
      </div>
    </div>
  );
}
