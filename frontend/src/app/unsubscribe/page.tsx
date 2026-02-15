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
    <div className="min-h-screen bg-[#0F1E35] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F1E35] via-[#1a2942] to-[#0F1E35] opacity-50"></div>
      
      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#4FD1FF]/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      <div className="max-w-md w-full relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
            </svg>
            <h1 className="text-2xl font-bold text-white">Meridian</h1>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
          {status === 'success' ? (
            // Success State
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4 backdrop-blur-sm border border-green-500/30">
                <CheckCircleIcon className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                You're Unsubscribed
              </h2>
              <p className="text-white/70 mb-6">
                {message}
              </p>
              <p className="text-sm text-white/60 mb-8">
                You will no longer receive emails from us at <strong className="text-white">{email}</strong>
              </p>
              <Link 
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-bold hover:shadow-lg hover:shadow-[#4FD1FF]/30 hover:scale-105 transition-all"
              >
                Return to Meridian
              </Link>
            </div>
          ) : status === 'error' && !email ? (
            // Error State (invalid link)
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4 backdrop-blur-sm border border-red-500/30">
                <ExclamationCircleIcon className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Invalid Link
              </h2>
              <p className="text-white/70 mb-6">
                {message}
              </p>
              <p className="text-sm text-white/60 mb-8">
                This unsubscribe link may have expired or is invalid. Please use the link from your most recent email.
              </p>
              <Link 
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
              >
                Go to Home
              </Link>
            </div>
          ) : (
            // Unsubscribe Form
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 text-center">
                Unsubscribe from Emails
              </h2>
              <p className="text-white/70 mb-6 text-center">
                We're sorry to see you go. You can unsubscribe from all future emails below.
              </p>

              <form onSubmit={handleUnsubscribe} className="space-y-4">
                {/* Email field (readonly if from token, editable if manual) */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    readOnly={!!token}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      token 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white/10 border-white/20'
                    } text-white placeholder-white/40 focus:ring-2 focus:ring-[#4FD1FF] focus:border-transparent transition-all backdrop-blur-sm`}
                    placeholder="your@email.com"
                  />
                </div>

                {/* Optional reason */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Reason (Optional)
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white focus:ring-2 focus:ring-[#4FD1FF] focus:border-transparent transition-all backdrop-blur-sm"
                  >
                    <option value="" className="bg-[#1a2942] text-white">Select a reason...</option>
                    <option value="not_interested" className="bg-[#1a2942] text-white">Not interested anymore</option>
                    <option value="too_many_emails" className="bg-[#1a2942] text-white">Too many emails</option>
                    <option value="not_relevant" className="bg-[#1a2942] text-white">Content not relevant</option>
                    <option value="never_signed_up" className="bg-[#1a2942] text-white">Never signed up</option>
                    <option value="other" className="bg-[#1a2942] text-white">Other</option>
                  </select>
                </div>

                {/* Error message */}
                {status === 'error' && message && (
                  <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur-sm">
                    <p className="text-sm text-red-300">{message}</p>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={status === 'loading' || !email}
                  className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
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
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-center text-white/60">
                  Changed your mind?{' '}
                  <Link href="/" className="text-[#4FD1FF] hover:text-[#6BE3FF] transition-colors">
                    Return to Meridian
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Legal Links */}
        <div className="mt-6 text-center text-sm text-white/60">
          <Link href="/privacy" className="hover:text-white/90 transition-colors">
            Privacy Policy
          </Link>
          {' '} | {' '}
          <Link href="/terms" className="hover:text-white/90 transition-colors">
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
