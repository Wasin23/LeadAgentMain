'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, SparklesIcon, CheckIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface CreditPurchaseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface PricingTier {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonus?: number;
  popular?: boolean;
  emails: number;
}

export default function CreditPurchaseModal({ onClose, onSuccess }: CreditPurchaseModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>('growth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricingTiers: PricingTier[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: 500,
      credits: 10000,
      emails: 15000,
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 1000,
      credits: 20000,
      emails: 30000,
      popular: true,
    },
    {
      id: 'scale',
      name: 'Scale',
      price: 2500,
      credits: 70000,
      bonus: 20000,
      emails: 105000,
    },
  ];

  const handlePurchase = async () => {
    const tier = pricingTiers.find(t => t.id === selectedTier);
    if (!tier) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/billing/purchase-credits', {
        tierId: tier.id,
        amount: tier.price,
        credits: tier.credits,
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
              Buy Credits
            </h2>
            <p className="text-white/70 mt-1">1 credit = $0.05 in API costs</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {pricingTiers.map((tier, index) => (
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-gradient-to-r from-[#4FD1FF] to-blue-500 text-white text-xs font-bold rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Bonus Badge */}
                {tier.bonus && (
                  <div className="absolute -top-3 right-4">
                    <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" />
                      +{tier.bonus.toLocaleString()} BONUS
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                  
                  <div className="mb-4">
                    <span className="text-5xl font-bold text-white">${tier.price}</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-center gap-2 text-white/90">
                      <CheckIcon className="w-5 h-5 text-[#4FD1FF]" />
                      <span className="font-semibold">{tier.credits.toLocaleString()} credits</span>
                    </div>
                    
                    {tier.bonus && (
                      <div className="flex items-center justify-center gap-2 text-green-400">
                        <SparklesIcon className="w-5 h-5" />
                        <span className="font-semibold">+{tier.bonus.toLocaleString()} bonus credits</span>
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-2 text-white/70">
                      <CheckIcon className="w-4 h-4 text-white/50" />
                      <span className="text-sm">~{tier.emails.toLocaleString()} emails</span>
                    </div>

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
            ))}
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-[#4FD1FF]" />
              How Credits Work
            </h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• <strong>1 credit = $0.05</strong> in tracked API costs (transparent pricing)</li>
              <li>• <strong>~0.67 credits per email</strong> on average (includes AI research, enrichment, validation, sending)</li>
              <li>• Credits never expire and roll over month-to-month</li>
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
              `Purchase ${pricingTiers.find(t => t.id === selectedTier)?.credits.toLocaleString()} Credits for $${pricingTiers.find(t => t.id === selectedTier)?.price}`
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
