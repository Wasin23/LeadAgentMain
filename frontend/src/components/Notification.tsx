'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

export default function Notification({ message, type, onClose }: NotificationProps) {
  const styles = {
    success: {
      bg: 'bg-green-500/20',
      border: 'border-green-400/40',
      text: 'text-green-200',
      icon: CheckCircleIcon,
      iconColor: 'text-green-400',
      dotColor: 'bg-green-400'
    },
    error: {
      bg: 'bg-red-500/20',
      border: 'border-red-400/40',
      text: 'text-red-200',
      icon: XCircleIcon,
      iconColor: 'text-red-400',
      dotColor: 'bg-red-400'
    },
    warning: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-400/40',
      text: 'text-yellow-200',
      icon: ExclamationTriangleIcon,
      iconColor: 'text-yellow-400',
      dotColor: 'bg-yellow-400'
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-400/40',
      text: 'text-blue-200',
      icon: InformationCircleIcon,
      iconColor: 'text-blue-400',
      dotColor: 'bg-blue-400'
    }
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 max-w-md backdrop-blur-md ${style.bg} ${style.border} ${style.text}`}
    >
      <Icon className={`w-5 h-5 ${style.iconColor} flex-shrink-0`} />
      <span className="text-sm font-medium flex-1">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-white/60 hover:text-white transition-colors flex-shrink-0"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// Hook for using notifications
export function useNotification() {
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const NotificationComponent = () => (
    <AnimatePresence>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </AnimatePresence>
  );

  return { showNotification, NotificationComponent };
}
