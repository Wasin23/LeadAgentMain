'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import BillingContent from './BillingContent';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentMethodModal({ isOpen, onClose, onSuccess }: PaymentMethodModalProps) {
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-[#0A1628] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#0A1628]/95 backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <CreditCardIcon className="w-8 h-8 text-[#4FD1FF]" />
                  Add Payment Method
                </h2>
                <p className="text-white/70 mt-1">
                  Add a card to unlock unlimited API usage
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-8 h-8" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <Elements stripe={stripePromise}>
                <BillingContent onPaymentAddedAction={handleSuccess} />
              </Elements>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
