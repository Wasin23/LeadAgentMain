'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, SparklesIcon, CheckIcon, PlusIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface CreditPurchaseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'onboarding' | 'topup'; // onboarding shows full plans, topup shows credit additions
  currentPlan?: string; // current user plan to highlight
}

interface PricingTier {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonus?: number;
  popular?: boolean;
  emails: number;
  features: string[];
}

interface TopupOption {
  id: string;
  name: string;
  price: number;
  credits: number;
  popular?: boolean;
}

export default function CreditPurchaseModal({ 
  onClose, 
  onSuccess, 
  mode = 'onboarding',
  currentPlan 
}: CreditPurchaseModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>(mode === 'onboarding' ? 'growth' : 'small');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPlanInfo, setUserPlanInfo] = useState<any>(null);

  const pricingTiers: PricingTier[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: 500,
      credits: 10000,
      emails: 15000,
      features: [
        '10,000 credits',
        '~15,000 emails',
        'Basic AI features',
        'Email support'
      ],
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 1000,
      credits: 20000,
      emails: 30000,
      popular: true,
      features: [
        '20,000 credits',
        '~30,000 emails',
        'Advanced AI features',
        'Priority support',
        'Custom integrations'
      ],
    },
    {
      id: 'scale',
      name: 'Scale',
      price: 2500,
      credits: 70000,
      bonus: 20000,
      emails: 105000,
      features: [
        '70,000 credits',
        '+20,000 bonus credits',
        '~105,000 emails',
        'All AI features',
        'Dedicated support',
        'Custom workflows'
      ],
    },
  ];

  const topupOptions: TopupOption[] = [
    {
      id: 'mini',
      name: 'Mini Top-up',
      price: 10,
      credits: 200,
    },
    {
      id: 'small',
      name: 'Small Top-up',
      price: 50,
      credits: 1000,
    },
    {
      id: 'medium',
      name: 'Medium Top-up',
      price: 100,
      credits: 2000,
      popular: true,
    },
    {
      id: 'bulk',
      name: 'Bulk Top-up',
      price: 250,
      credits: 5000,
    },
  ];

  // Fetch user plan info on mount
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await api.get('/api/plans/status');
        if (response.data.success) {
          setUserPlanInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching user plan:', error);
      }
    };

    fetchUserPlan();
  }, []);

  const handlePurchase = async () => {
    const isOnboarding = mode === 'onboarding';
    const options = isOnboarding ? pricingTiers : topupOptions;
    const selectedOption = options.find(t => t.id === selectedTier);
    if (!selectedOption) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = isOnboarding ? '/api/billing/purchase-credits' : '/api/billing/add-credits';
      const response = await api.post(endpoint, {
        tierId: selectedOption.id,
        amount: selectedOption.price,
        credits: selectedOption.credits,
        mode: mode
      });

      if (response.data.success) {
        onSuccess();
      } else {
        throw new Error(response.data.error || 'Purchase failed');
      }
    } catch (err: any) {
      console.error('Credit purchase error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to purchase credits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0A1628] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0A1628]/95 backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 text-[#4FD1FF]" />
              {mode === 'onboarding' ? 'Choose Your Plan' : 'Buy More Credits'}
            </h2>
            <p className="text-white/70 mt-1">
              {mode === 'onboarding' 
                ? '1 credit = $0.05 in API costs' 
                : 'Add more credits to your existing plan'
              }
            </p>
            {mode === 'topup' && userPlanInfo?.plan && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                <CheckIcon className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300 font-medium">
                  Current Plan: {userPlanInfo.plan.name}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        {/* Pricing Tiers */}
        <div className="p-8">
          {/* Show Main Plans */}
          {mode === 'onboarding' && (
            <>
              <h3 className="text-xl font-semibold text-white mb-4">Starter Plans</h3>
              <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-3">
                {pricingTiers.map((tier, index) => {
                  const isCurrentPlan = currentPlan === tier.id;
                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all ${
                        selectedTier === tier.id
                          ? 'border-[#4FD1FF] bg-[#4FD1FF]/10 shadow-lg shadow-[#4FD1FF]/20'
                          : isCurrentPlan
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      {tier.popular && !isCurrentPlan && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="px-4 py-1 bg-gradient-to-r from-[#4FD1FF] to-blue-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                            MOST POPULAR
                          </span>
                        </div>
                      )}
                      {isCurrentPlan && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1 whitespace-nowrap">
                            <CheckIcon className="w-3 h-3" />
                            Current Plan
                          </span>
                        </div>
                      )}
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                        <div className="mb-4">
                          <span className="text-4xl font-bold text-[#4FD1FF]">${tier.price}</span>
                          <span className="text-white/70 ml-2">one-time</span>
                        </div>
                        <div className="mb-6">
                          <div className="text-3xl font-bold text-white">{tier.credits.toLocaleString()}</div>
                          <div className="text-white/70 text-sm">credits</div>
                        </div>
                        <ul className="space-y-3 text-left">
                          {tier.features.map((feature: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-white/80">
                              <CheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Quick Top-Ups</h3>
            </>
          )}
          
          {/* Show Top-Up Options or just topup options for topup mode */}
          <div className={`grid gap-6 mb-8 ${
            mode === 'onboarding' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}>
            {topupOptions.map((tier, index) => {
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all ${
                    selectedTier === tier.id
                      ? 'border-[#4FD1FF] bg-[#4FD1FF]/10 shadow-lg shadow-[#4FD1FF]/20'
                      : 'border-white/20 bg-white/5 hover:border-white/40'
                  }`}
                >
                  {/* Popular Badge */}
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-4 py-1 bg-gradient-to-r from-[#4FD1FF] to-blue-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                        POPULAR
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                      {mode === 'topup' && <PlusIcon className="w-5 h-5 text-[#4FD1FF]" />}
                      {tier.name}
                    </h3>
                    
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-white">${tier.price}</span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-center gap-2 text-white/90">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF]" />
                        <span className="font-semibold">{tier.credits.toLocaleString()} credits</span>
                      </div>
                      
                      {mode === 'onboarding' && 'bonus' in tier && (tier as PricingTier).bonus && (
                        <div className="flex items-center justify-center gap-2 text-green-400">
                          <SparklesIcon className="w-5 h-5" />
                          <span className="font-semibold">+{(tier as PricingTier).bonus!.toLocaleString()} bonus credits</span>
                        </div>
                      )}

                      {mode === 'onboarding' && 'emails' in tier && (tier as PricingTier).emails && (
                        <div className="flex items-center justify-center gap-2 text-white/70">
                          <CheckIcon className="w-4 h-4 text-white/50" />
                          <span className="text-sm">~{(tier as PricingTier).emails.toLocaleString()} emails</span>
                        </div>
                      )}

                      <div className="text-white/60 text-xs">
                        ${(tier.price / tier.credits).toFixed(3)} per credit
                      </div>
                    </div>

                    {selectedTier === tier.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-4 right-4"
                      >
                        <div className="w-8 h-8 bg-[#4FD1FF] rounded-full flex items-center justify-center">
                          <CheckIcon className="w-5 h-5 text-white" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-[#4FD1FF]" />
              {mode === 'onboarding' ? 'How Credits Work' : 'About Additional Credits'}
            </h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• <strong>1 credit = $0.05</strong> in tracked API costs (transparent pricing)</li>
              <li>• <strong>~0.67 credits per email</strong> on average (includes AI research, enrichment, validation, sending)</li>
              <li>• Credits never expire and roll over month-to-month</li>
              {mode === 'topup' && (
                <li>• <strong>Top-ups are added instantly</strong> to your current balance</li>
              )}
              <li>• Track exact usage in real-time on your dashboard</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
            </div>
          )}

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-[#4FD1FF] to-blue-500 text-white font-bold text-lg rounded-xl hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </span>
            ) : (
              (() => {
                const options = mode === 'onboarding' ? pricingTiers : topupOptions;
                const selectedOption = options.find(t => t.id === selectedTier);
                return mode === 'onboarding' 
                  ? `Choose ${selectedOption?.name} - ${selectedOption?.credits.toLocaleString()} Credits for $${selectedOption?.price}`
                  : `Add ${selectedOption?.credits.toLocaleString()} Credits for $${selectedOption?.price}`;
              })()
            )}
          </button>

          <p className="text-center text-white/60 text-xs mt-4">
            🔒 Secure payment processed by Stripe. Credits added instantly to your account.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
