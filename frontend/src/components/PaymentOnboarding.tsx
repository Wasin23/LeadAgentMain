'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCardIcon, SparklesIcon, CheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import BillingContent from './BillingContent';
import CreditPurchaseModal from './CreditPurchaseModal';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface PaymentOnboardingProps {
  onComplete: () => void;
}

export default function PaymentOnboarding({ onComplete }: PaymentOnboardingProps) {
  const [selectedOption, setSelectedOption] = useState<'trial' | 'credits' | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);

  const handleTrialSelection = () => {
    setSelectedOption('trial');
    // Skip directly - trial is automatically enabled
    onComplete();
  };

  const handleCreditsSelection = () => {
    setSelectedOption('credits');
    setShowPaymentForm(true);
  };

  const handlePaymentAdded = () => {
    setShowPaymentForm(false);
    setShowCreditPurchase(true);
  };

  const handleCreditsPurchased = () => {
    setShowCreditPurchase(false);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#14304a] to-[#0A1628] flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {!showPaymentForm && !showCreditPurchase && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-6xl w-full"
          >
            <div className="text-center mb-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="inline-flex items-center justify-center w-20 h-20 bg-[#4FD1FF]/20 rounded-full mb-6"
              >
                <SparklesIcon className="w-10 h-10 text-[#4FD1FF]" />
              </motion.div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Choose Your Plan
              </h1>
              <p className="text-xl text-white/70">
                Start with a free trial or purchase credits to get started
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Trial Option */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                onClick={handleTrialSelection}
                className="relative cursor-pointer group"
              >
                <div className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-2xl p-8 hover:border-[#4FD1FF] transition-all h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Free Trial</h2>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-semibold rounded-full">
                      FREE
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="space-y-4 mb-8">
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">$25 in free trial credits</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">Test all features</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">No credit card required</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">Add payment method later</span>
                      </div>
                    </div>

                    <div className="text-sm text-white/60">
                      Perfect for testing the platform before committing
                    </div>
                  </div>

                  <button className="w-full mt-6 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:border-[#4FD1FF]">
                    Start Free Trial
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>

              {/* Purchase Credits Option */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                onClick={handleCreditsSelection}
                className="relative cursor-pointer group"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#4FD1FF] to-blue-500 rounded-2xl opacity-75 group-hover:opacity-100 blur transition-all"></div>
                <div className="relative bg-[#0A1628] border-2 border-[#4FD1FF] rounded-2xl p-8 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Purchase Credits</h2>
                    <span className="px-3 py-1 bg-[#4FD1FF]/20 text-[#4FD1FF] text-sm font-semibold rounded-full">
                      RECOMMENDED
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="space-y-4 mb-8">
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">Start with 10,000+ credits</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">Credits never expire</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">Bonus credits on larger packages</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckIcon className="w-5 h-5 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                        <span className="text-white/80">Volume discounts available</span>
                      </div>
                    </div>

                    <div className="bg-[#4FD1FF]/10 border border-[#4FD1FF]/30 rounded-lg p-4 mb-6">
                      <div className="text-sm text-white/90 mb-2">Starting at:</div>
                      <div className="text-3xl font-bold text-white">$500</div>
                      <div className="text-sm text-white/60">10,000 credits (~15,000 emails)</div>
                    </div>

                    <div className="text-sm text-white/60">
                      Best for immediate high-volume usage
                    </div>
                  </div>

                  <button className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-[#4FD1FF] to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all flex items-center justify-center gap-2">
                    <CreditCardIcon className="w-5 h-5" />
                    Purchase Credits
                  </button>
                </div>
              </motion.div>
            </div>

            <div className="text-center mt-8">
              <p className="text-white/60 text-sm">
                💡 You can always upgrade from the free trial later
              </p>
            </div>
          </motion.div>
        )}

        {showPaymentForm && (
          <motion.div
            key="payment-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl w-full"
          >
            <div className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Add Payment Method</h2>
                <p className="text-white/70">Securely add your card to purchase credits</p>
              </div>

              <Elements stripe={stripePromise}>
                <BillingContent />
              </Elements>

              <div className="mt-6 text-center">
                <button
                  onClick={handlePaymentAdded}
                  className="px-6 py-3 bg-gradient-to-r from-[#4FD1FF] to-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all"
                >
                  Continue to Purchase Credits
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {showCreditPurchase && (
          <CreditPurchaseModal
            onClose={() => setShowCreditPurchase(false)}
            onSuccess={handleCreditsPurchased}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
