'use client';

import { useState } from 'react';
import { 
  CalendarIcon,
  CheckCircleIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import api from '../lib/api';

interface CalendarSetupProps {
  onComplete: () => void;
}

export default function CalendarSetup({ onComplete }: CalendarSetupProps) {
  const [calendlyLink, setCalendlyLink] = useState('');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const handleGoogleCalendarConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      // Request OAuth URL from backend
      const response = await api.get('/api/calendar/google-oauth-url');
      
      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        response.data.authUrl,
        'Google Calendar OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth completion
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setIsConnectingGoogle(false);
          // Check if connection was successful
          checkGoogleConnection();
        }
      }, 500);

    } catch (error: any) {
      console.error('Error connecting Google Calendar:', error);
      setNotification({
        message: error.response?.data?.error || 'Failed to connect Google Calendar',
        type: 'error'
      });
      setIsConnectingGoogle(false);
    }
  };

  const checkGoogleConnection = async () => {
    try {
      const response = await api.get('/api/calendar/status');
      if (response.data.googleConnected) {
        setGoogleConnected(true);
        setNotification({
          message: 'Google Calendar connected successfully!',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error checking calendar status:', error);
    }
  };

  const handleSaveCalendly = async () => {
    if (!calendlyLink.trim()) {
      setNotification({
        message: 'Please enter your Calendly link',
        type: 'error'
      });
      return;
    }

    try {
      await api.post('/api/calendar/calendly-link', { calendlyLink });
      setNotification({
        message: 'Calendly link saved!',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error saving Calendly link:', error);
      setNotification({
        message: error.response?.data?.error || 'Failed to save Calendly link',
        type: 'error'
      });
    }
  };

  const handleContinue = () => {
    if (!googleConnected && !calendlyLink.trim()) {
      setNotification({
        message: 'Please connect at least one calendar option to continue',
        type: 'error'
      });
      return;
    }
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white animate-slide-in`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <CalendarIcon className="w-12 h-12 text-purple-600" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Connect Your Calendar
          </h1>
          <p className="text-xl text-white/90">
            Let your AI schedule meetings automatically
          </p>
        </div>

        {/* Calendar Options */}
        <div className="space-y-6">
          {/* Google Calendar OAuth */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 border-2 border-white/50 hover:scale-[1.02] transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google Calendar
                    {googleConnected && (
                      <CheckCircleIcon className="w-6 h-6 text-green-500" />
                    )}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    AI creates events directly in your calendar when meetings are confirmed
                  </p>
                  <button
                    onClick={handleGoogleCalendarConnect}
                    disabled={isConnectingGoogle || googleConnected}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      googleConnected
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                    } ${isConnectingGoogle ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {isConnectingGoogle ? 'Connecting...' : googleConnected ? 'Connected' : 'Connect Google Calendar'}
                  </button>
                </div>
              </div>
            </div>

          {/* Calendly Link */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 border-2 border-white/50 hover:scale-[1.02] transition-all duration-300">
              <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
                <LinkIcon className="w-6 h-6 text-purple-600" />
                Calendly Link (Optional)
              </h3>
              <p className="text-gray-600 mb-4">
                AI sends this link to leads who prefer to self-schedule
              </p>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={calendlyLink}
                  onChange={(e) => setCalendlyLink(e.target.value)}
                  placeholder="https://calendly.com/yourname/30min"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                />
                <button
                  onClick={handleSaveCalendly}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 hover:shadow-lg transition-all"
                >
                  Save
                </button>
              </div>
            <p className="text-sm text-gray-500 mt-2">
              Get your link from <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">calendly.com</a>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-8 py-3 text-white/80 hover:text-white font-medium transition-all hover:scale-105"
          >
            Skip for now
          </button>
          <button
            onClick={handleContinue}
            disabled={!googleConnected && !calendlyLink.trim()}
            className={`px-12 py-4 rounded-2xl font-bold text-lg transition-all ${
              googleConnected || calendlyLink.trim()
                ? 'bg-white text-purple-600 hover:shadow-2xl hover:scale-110 shadow-xl'
                : 'bg-white/30 text-white/50 cursor-not-allowed'
            }`}
          >
            Continue to Create Agent →
          </button>
        </div>
      </div>
    </div>
  );
}
