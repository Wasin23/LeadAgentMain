'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Notification, { NotificationType } from '@/components/Notification';

export default function NotificationPreviewPage() {
  const [activeNotification, setActiveNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  const notificationExamples = [
    {
      label: 'Email Sent Success',
      type: 'success' as NotificationType,
      message: 'Email sent successfully to john@company.com'
    },
    {
      label: 'Email Approved',
      type: 'success' as NotificationType,
      message: 'Email approved and sent successfully!'
    },
    {
      label: 'Settings Saved',
      type: 'success' as NotificationType,
      message: 'Settings saved successfully'
    },
    {
      label: 'Agent Started',
      type: 'success' as NotificationType,
      message: 'Agent started and running'
    },
    {
      label: 'Email Failed',
      type: 'error' as NotificationType,
      message: 'Failed to send email: Invalid recipient address'
    },
    {
      label: 'Network Error',
      type: 'error' as NotificationType,
      message: 'Network error: Could not connect to server'
    },
    {
      label: 'Validation Error',
      type: 'error' as NotificationType,
      message: 'Please fill in all required fields'
    },
    {
      label: 'Authentication Error',
      type: 'error' as NotificationType,
      message: 'Session expired. Please log in again.'
    },
    {
      label: 'Gmail Quota Warning',
      type: 'warning' as NotificationType,
      message: 'Approaching Gmail daily send limit (90% used)'
    },
    {
      label: 'Payment Due',
      type: 'warning' as NotificationType,
      message: 'Payment method will expire in 7 days'
    },
    {
      label: 'Rate Limit Warning',
      type: 'warning' as NotificationType,
      message: 'API rate limit approaching - slowing down requests'
    },
    {
      label: 'Low Credits',
      type: 'warning' as NotificationType,
      message: 'Only 50 credits remaining. Consider upgrading.'
    },
    {
      label: 'Email Queued',
      type: 'info' as NotificationType,
      message: 'Email added to queue and will be sent shortly'
    },
    {
      label: 'Processing',
      type: 'info' as NotificationType,
      message: 'Processing your request...'
    },
    {
      label: 'Agent Idle',
      type: 'info' as NotificationType,
      message: 'Agent is idle - click Start to begin outreach'
    },
    {
      label: 'Calendar Sync',
      type: 'info' as NotificationType,
      message: 'Syncing calendar events in the background'
    }
  ];

  const showNotification = (message: string, type: NotificationType) => {
    setActiveNotification({ message, type });
    setTimeout(() => setActiveNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-white mb-2">Notification Banner Preview</h1>
          <p className="text-white/70 mb-8">Click any button below to preview the notification banner</p>

          <div className="space-y-8">
            {/* Success Notifications */}
            <div>
              <h2 className="text-2xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                Success Notifications
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {notificationExamples.filter(n => n.type === 'success').map((notification, index) => (
                  <button
                    key={index}
                    onClick={() => showNotification(notification.message, notification.type)}
                    className="bg-green-500/10 hover:bg-green-500/20 border border-green-400/30 hover:border-green-400/50 rounded-lg p-4 text-left transition-all active:scale-95"
                  >
                    <div className="text-green-300 font-semibold mb-1">{notification.label}</div>
                    <div className="text-green-200/70 text-sm">{notification.message}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Notifications */}
            <div>
              <h2 className="text-2xl font-semibold text-red-400 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                Error Notifications
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {notificationExamples.filter(n => n.type === 'error').map((notification, index) => (
                  <button
                    key={index}
                    onClick={() => showNotification(notification.message, notification.type)}
                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 hover:border-red-400/50 rounded-lg p-4 text-left transition-all active:scale-95"
                  >
                    <div className="text-red-300 font-semibold mb-1">{notification.label}</div>
                    <div className="text-red-200/70 text-sm">{notification.message}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Warning Notifications */}
            <div>
              <h2 className="text-2xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                Warning Notifications
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {notificationExamples.filter(n => n.type === 'warning').map((notification, index) => (
                  <button
                    key={index}
                    onClick={() => showNotification(notification.message, notification.type)}
                    className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-400/30 hover:border-yellow-400/50 rounded-lg p-4 text-left transition-all active:scale-95"
                  >
                    <div className="text-yellow-300 font-semibold mb-1">{notification.label}</div>
                    <div className="text-yellow-200/70 text-sm">{notification.message}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Notifications */}
            <div>
              <h2 className="text-2xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                Info Notifications
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {notificationExamples.filter(n => n.type === 'info').map((notification, index) => (
                  <button
                    key={index}
                    onClick={() => showNotification(notification.message, notification.type)}
                    className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 hover:border-blue-400/50 rounded-lg p-4 text-left transition-all active:scale-95"
                  >
                    <div className="text-blue-300 font-semibold mb-1">{notification.label}</div>
                    <div className="text-blue-200/70 text-sm">{notification.message}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Back to Dashboard */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#4FD1FF] hover:bg-[#6BE3FF] text-[#0F1E35] rounded-lg font-semibold transition-all active:scale-95"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Active Notification */}
      <AnimatePresence>
        {activeNotification && (
          <Notification
            message={activeNotification.message}
            type={activeNotification.type}
            onClose={() => setActiveNotification(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
