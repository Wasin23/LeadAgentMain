'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      // Validate token and get email
      fetch(`/api/unsubscribe?token=${tokenParam}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.email) {
            setEmail(data.email);
          } else {
            setStatus('error');
            setMessage(data.message || 'Invalid unsubscribe link');
          }
        })
        .catch(() => {
          setStatus('error');
          setMessage('Failed to validate unsubscribe link');
        });
    }
  }, [searchParams]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          email: !token ? email : undefined,
          reason
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message || 'Successfully unsubscribed');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to unsubscribe');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <defs>
                <linearGradient id="globeGradientUnsub" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: 'rgb(168, 85, 247)', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: 'rgb(236, 72, 153)', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <circle cx="24" cy="24" r="20" fill="white" className="dark:fill-neutral-800"/>
              <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradientUnsub)" strokeWidth="1"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradientUnsub)" strokeWidth="1"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradientUnsub)" strokeWidth="1"/>
              <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradientUnsub)" strokeWidth="1"/>
              <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradientUnsub)" strokeWidth="1"/>
              <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradientUnsub)" strokeWidth="1"/>
            </svg>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Meridian</h1>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-8">
          {status === 'success' ? (
            // Success State
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <CheckCircleIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                You're Unsubscribed
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {message}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mb-8">
                You will no longer receive emails from us at <strong>{email}</strong>
              </p>
              <Link 
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Return to Meridian
              </Link>
            </div>
          ) : status === 'error' && !email ? (
            // Error State (invalid link)
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <ExclamationCircleIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Invalid Link
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {message}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mb-8">
                This unsubscribe link may have expired or is invalid. Please use the link from your most recent email.
              </p>
              <Link 
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-neutral-600 text-white rounded-lg font-medium hover:bg-neutral-700 transition-all"
              >
                Go to Home
              </Link>
            </div>
          ) : (
            // Unsubscribe Form
            <>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 text-center">
                Unsubscribe from Emails
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-center">
                We're sorry to see you go. You can unsubscribe from all future emails below.
              </p>

              <form onSubmit={handleUnsubscribe} className="space-y-4">
                {/* Email field (readonly if from token, editable if manual) */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    readOnly={!!token}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      token 
                        ? 'bg-neutral-100 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600' 
                        : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'
                    } text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                    placeholder="your@email.com"
                  />
                </div>

                {/* Optional reason */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Reason (Optional)
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select a reason...</option>
                    <option value="not_interested">Not interested anymore</option>
                    <option value="too_many_emails">Too many emails</option>
                    <option value="not_relevant">Content not relevant</option>
                    <option value="never_signed_up">Never signed up</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Error message */}
                {status === 'error' && message && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={status === 'loading' || !email}
                  className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg font-medium hover:from-red-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Unsubscribing...
                    </span>
                  ) : (
                    'Unsubscribe'
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-center text-neutral-500 dark:text-neutral-500">
                  Changed your mind?{' '}
                  <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Return to Meridian
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Legal Links */}
        <div className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Privacy Policy
          </Link>
          {' '} | {' '}
          <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
