'use client';

import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

export default function PaymentStatusBanner() {
  const [paymentStatus, setPaymentStatus] = useState<{
    status: 'active' | 'payment_failed' | 'suspended';
    gracePeriodEnd?: string;
    lastFailedCharge?: {
      date: string;
      amount: number;
    };
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  useEffect(() => {
    if (paymentStatus?.gracePeriodEnd) {
      const calculateDays = () => {
        const graceEnd = new Date(paymentStatus.gracePeriodEnd!);
        const now = new Date();
        const diff = graceEnd.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        setDaysRemaining(Math.max(0, days));
      };

      calculateDays();
      const interval = setInterval(calculateDays, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [paymentStatus]);

  const checkPaymentStatus = async () => {
    try {
      const { data } = await api.get('/api/billing/payment-status');
      if (data.status !== 'active') {
        setPaymentStatus(data);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  };

  if (!paymentStatus || dismissed || paymentStatus.status === 'active') {
    return null;
  }

  const isSuspended = paymentStatus.status === 'suspended';
  const amount = paymentStatus.lastFailedCharge?.amount || 0;

  return (
    <div className={`relative ${
      isSuspended 
        ? 'bg-red-600' 
        : 'bg-yellow-500'
    } text-white shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {isSuspended ? '🚫 Account Suspended' : '⚠️ Payment Failed'}
              </p>
              <p className="text-sm mt-0.5">
                {isSuspended ? (
                  <>Your account is suspended. Update your payment method to restore access.</>
                ) : (
                  <>
                    Your payment of ${amount.toFixed(2)} failed. 
                    <span className="font-semibold ml-1">
                      {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                    </span> before suspension.
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <a
              href="/settings?tab=billing"
              className="px-4 py-1.5 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Update Payment Method
            </a>
            {!isSuspended && (
              <button
                onClick={() => setDismissed(true)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Dismiss"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
