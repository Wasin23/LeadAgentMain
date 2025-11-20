'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeIcon, EyeSlashIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type TabType = 'signin' | 'signup';

export default function SignInPage() {
  const [activeTab, setActiveTab] = useState<TabType>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{ isValid: boolean; message: string; isChecking: boolean }>({
    isValid: false,
    message: '',
    isChecking: false
  });
  
  // Form states
  const [signInForm, setSignInForm] = useState({ username: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [forgotForm, setForgotForm] = useState({ email: '' });
  const [resetForm, setResetForm] = useState({ code: '', newPassword: '', confirmPassword: '' });

  const { login, register, continueAsGuest, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const justLoggedOut = localStorage.getItem('justLoggedOut');
      if (justLoggedOut !== 'true') {
        router.push('/');
        return;
      }
      localStorage.removeItem('justLoggedOut');
    }
  }, [isAuthenticated, router]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();

    try {
      const success = await login(signInForm.username, signInForm.password);
      if (success) {
        setSuccess('Sign in successful! Redirecting...');
        setTimeout(() => router.push('/'), 1500);
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const success = await register(signUpForm.username, signUpForm.email, signUpForm.password);
      if (success) {
        setSuccess('Account created successfully! Redirecting...');
        setTimeout(() => router.push('/'), 1500);
      } else {
        setError('Registration failed. Username or email may already exist.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotForm.email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        if (data.resetToken) {
          // For development - show reset token
          setSuccess(data.message + ' Reset token: ' + data.resetToken);
        }
        // Keep modal open so user can enter reset code
        // Don't clear the form yet - they might need the email for reference
      } else {
        setError(data.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: resetForm.code,
          newPassword: resetForm.newPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Password reset successful! You can now sign in.');
        setActiveTab('signin');
        setResetForm({ code: '', newPassword: '', confirmPassword: '' });
        setForgotForm({ email: '' });
        setShowForgotModal(false);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    continueAsGuest();
    router.push('/');
  };

  const getPasswordStrength = (password: string) => {
    if (password.length < 6) return { strength: 'weak', score: 0 };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 2) return { strength: 'weak', score: 33 };
    if (score <= 3) return { strength: 'medium', score: 66 };
    return { strength: 'strong', score: 100 };
  };

  const validateResetCode = async (code: string) => {
    if (!code || code.length < 6) {
      setCodeValidation({ isValid: false, message: '', isChecking: false });
      return;
    }

    setCodeValidation({ isValid: false, message: 'Checking code...', isChecking: true });

    try {
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: code }),
      });

      const data = await response.json();

      if (response.ok) {
        setCodeValidation({ 
          isValid: true, 
          message: 'Valid reset code ✓', 
          isChecking: false 
        });
      } else {
        setCodeValidation({ 
          isValid: false, 
          message: data.error || 'Invalid reset code', 
          isChecking: false 
        });
      }
    } catch (err) {
      setCodeValidation({ 
        isValid: false, 
        message: 'Error validating code', 
        isChecking: false 
      });
    }
  };

  const tabVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative z-10"
      >
        {/* Header with Logo */}
        <div className="text-center p-10 pb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="inline-block mb-6"
          >
            <svg width="80" height="80" viewBox="0 0 48 48" className="drop-shadow-lg">
              <defs>
                <linearGradient id="globeGradientSignIn" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: 'rgb(168, 85, 247)', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: 'rgb(236, 72, 153)', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <circle cx="24" cy="24" r="20" fill="white"/>
              <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradientSignIn)" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradientSignIn)" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradientSignIn)" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradientSignIn)" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradientSignIn)" strokeWidth="1.5"/>
              <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradientSignIn)" strokeWidth="1.5"/>
            </svg>
          </motion.div>
          <motion.h1 
            className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Meridian
          </motion.h1>
          <p className="text-neutral-600 text-sm font-medium">AI-Powered Lead Research & Automation</p>
        </div>

        {/* Tabs */}
        <div className="flex mx-10 mb-8 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-1.5">
          {(['signin', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                clearMessages();
              }}
              className={`flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all ${
                activeTab === tab
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-10 mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3 shadow-sm"
            >
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-10 mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-2xl text-green-700 text-sm flex items-center gap-3 shadow-sm"
            >
              <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forms */}
        <div className="px-10 pb-10">
          <AnimatePresence mode="wait">
            {activeTab === 'signin' && (
              <motion.form
                key="signin"
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={handleSignIn}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={signInForm.username}
                    onChange={(e) => setSignInForm({ ...signInForm, username: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl bg-white text-sm text-neutral-900 transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={signInForm.password}
                      onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl bg-white text-sm text-neutral-900 transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-center mt-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{
                    background: isLoading ? 'rgb(107, 114, 128)' : 'linear-gradient(to right, rgb(59, 130, 246), rgb(147, 51, 234))'
                  }}
                >
                  {isLoading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </motion.form>
            )}

            {activeTab === 'signup' && (
              <motion.form
                key="signup"
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={handleSignUp}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={signUpForm.username}
                    onChange={(e) => setSignUpForm({ ...signUpForm, username: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl bg-white text-sm text-neutral-900 transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl bg-white text-sm text-neutral-900 transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={signUpForm.password}
                    onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl bg-white text-sm text-neutral-900 transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                  />
                  {signUpForm.password && (
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full rounded-full ${
                            getPasswordStrength(signUpForm.password).strength === 'weak' ? 'bg-red-500' :
                            getPasswordStrength(signUpForm.password).strength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${getPasswordStrength(signUpForm.password).score}%` }}
                        />
                      </div>
                      <p className={`text-xs mt-1 font-medium ${
                        getPasswordStrength(signUpForm.password).strength === 'weak' ? 'text-red-600' :
                        getPasswordStrength(signUpForm.password).strength === 'medium' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {getPasswordStrength(signUpForm.password).strength === 'weak' && 'Weak password'}
                        {getPasswordStrength(signUpForm.password).strength === 'medium' && 'Moderate password'}
                        {getPasswordStrength(signUpForm.password).strength === 'strong' && 'Strong password'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={signUpForm.confirmPassword}
                    onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl bg-white text-sm text-neutral-900 transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                  />
                  {signUpForm.confirmPassword && (
                    <p className={`text-xs mt-1 font-medium ${
                      signUpForm.password === signUpForm.confirmPassword && signUpForm.password.length >= 6
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {signUpForm.password === signUpForm.confirmPassword && signUpForm.password.length >= 6
                        ? 'Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || signUpForm.password !== signUpForm.confirmPassword}
                  className="w-full py-3.5 px-4 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{
                    background: (isLoading || signUpForm.password !== signUpForm.confirmPassword) ? 'rgb(107, 114, 128)' : 'linear-gradient(to right, rgb(168, 85, 247), rgb(219, 39, 119))'
                  }}
                >
                  {isLoading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Guest Mode */}
        <div className="text-center px-10 pb-10 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-600 mb-3 font-medium">Just want to try it out?</p>
          <button
            onClick={handleGuestMode}
            className="bg-gradient-to-r from-neutral-100 to-neutral-200 text-neutral-700 py-3 px-6 rounded-xl text-sm font-semibold transition-all hover:shadow-md hover:scale-[1.02]"
          >
            Continue as Guest
          </button>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-neutral-200 w-full max-w-md p-8"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                Reset Your Password
              </h2>
              <p className="text-neutral-500 text-sm mb-6">
                Enter your email address and we'll send you a reset code.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotForm.email}
                    onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 bg-white text-sm text-neutral-900 transition-colors focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Enter your email address"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-3 px-4 text-sm font-medium text-neutral-600 border border-neutral-200 transition-colors hover:bg-neutral-50"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 text-sm transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: isLoading ? '#a3a3a3 !important' : '#3b82f6 !important',
                      color: '#ffffff !important',
                      fontWeight: '500 !important'
                    }}
                  >
                    {isLoading && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {isLoading ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
              </form>

              {/* Reset Code Form (shows after email is sent) */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 pt-6 border-t border-neutral-200"
                >
                  <h3 className="text-lg font-medium text-neutral-900 mb-4">
                    Enter Reset Code
                  </h3>
                  
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
                        Reset Code
                      </label>
                      <input
                        type="text"
                        required
                        value={resetForm.code}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setResetForm({ ...resetForm, code: newCode });
                          validateResetCode(newCode);
                        }}
                        className={`w-full px-4 py-3 border bg-white text-sm text-neutral-900 transition-colors focus:outline-none focus:ring-4 ${
                          codeValidation.isValid 
                            ? 'border-green-500 focus:border-green-500 focus:ring-green-500/10' 
                            : resetForm.code && !codeValidation.isChecking && codeValidation.message && !codeValidation.isValid
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
                            : 'border-neutral-200 focus:border-blue-500 focus:ring-blue-500/10'
                        }`}
                        placeholder="Enter the code from your email"
                      />
                      {resetForm.code && codeValidation.message && (
                        <div className={`text-xs mt-1 ${
                          codeValidation.isValid ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {codeValidation.isChecking ? (
                            <span className="flex items-center gap-1">
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              {codeValidation.message}
                            </span>
                          ) : (
                            codeValidation.message
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-200 bg-white text-sm text-neutral-900 transition-colors focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                      {resetForm.newPassword && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-neutral-600">Password strength</span>
                            <span className={`capitalize ${
                              getPasswordStrength(resetForm.newPassword).strength === 'weak' ? 'text-red-600' :
                              getPasswordStrength(resetForm.newPassword).strength === 'medium' ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {getPasswordStrength(resetForm.newPassword).strength}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-200 rounded-full h-1">
                            <div 
                              className={`h-1 rounded-full transition-all duration-300 ${
                                getPasswordStrength(resetForm.newPassword).strength === 'weak' ? 'bg-red-500' :
                                getPasswordStrength(resetForm.newPassword).strength === 'medium' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${getPasswordStrength(resetForm.newPassword).score}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={resetForm.confirmPassword}
                        onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-200 bg-white text-sm text-neutral-900 transition-colors focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                      {resetForm.confirmPassword && (
                        <p className={`text-xs mt-1 ${
                          resetForm.newPassword === resetForm.confirmPassword 
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {resetForm.newPassword === resetForm.confirmPassword 
                            ? 'Passwords match' : 'Passwords do not match'}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !codeValidation.isValid || !resetForm.code || !resetForm.newPassword || !resetForm.confirmPassword}
                      className="w-full py-3 px-4 text-sm transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{
                        background: (isLoading || !codeValidation.isValid || !resetForm.code || !resetForm.newPassword || !resetForm.confirmPassword) ? '#a3a3a3 !important' : '#3b82f6 !important',
                        color: '#ffffff !important',
                        fontWeight: '500 !important'
                      }}
                    >
                      {isLoading && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </form>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}