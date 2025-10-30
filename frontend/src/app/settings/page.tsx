'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  UserCircleIcon, 
  CurrencyDollarIcon, 
  EnvelopeIcon,
  CogIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import RateLimitSettings from '@/components/agents/RateLimitSettings';

type TabType = 'profile' | 'budget' | 'email' | 'preferences';

interface UserProfile {
  username: string;
  email: string;
  createdAt?: string;
}

interface EmailSettings {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  signature: string;
}

interface Preferences {
  theme: string;
  emailSignature: string;
  defaultLeadLimit: number;
  autoSaveInterval: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State for each section
  const [userProfile, setUserProfile] = useState<UserProfile>({ username: '', email: '' });
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    fromName: '',
    fromEmail: '',
    replyTo: '',
    signature: ''
  });
  const [preferences, setPreferences] = useState<Preferences>({
    theme: 'dark',
    emailSignature: '',
    defaultLeadLimit: 10,
    autoSaveInterval: 300000
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile
      const profileResponse = await api.get('/api/auth/profile');
      if (profileResponse.data.user) {
        setUserProfile({
          username: profileResponse.data.user.username,
          email: profileResponse.data.user.email,
          createdAt: profileResponse.data.user.createdAt
        });
      }

      // Fetch user settings (includes preferences and email signature)
      const settingsResponse = await api.get('/api/auth/settings');
      if (settingsResponse.data.success) {
        const settings = settingsResponse.data.settings;
        
        // Set preferences
        if (settings.preferences) {
          setPreferences(settings.preferences);
        }
        
        // Extract email settings if available
        if (settings.emailSettings) {
          setEmailSettings(settings.emailSettings);
        }
      }

    } catch (error: any) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await api.post('/api/auth/settings/email', { emailSettings });
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Email settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save email settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await api.post('/api/auth/settings/preferences', { preferences });
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as TabType, label: 'Profile', icon: UserCircleIcon },
    { id: 'budget' as TabType, label: 'Budget & Limits', icon: CurrencyDollarIcon },
    { id: 'email' as TabType, label: 'Email Configuration', icon: EnvelopeIcon },
    { id: 'preferences' as TabType, label: 'Preferences', icon: CogIcon },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-neutral-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
                <p className="text-sm text-neutral-600 mt-1">Manage your account and preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-neutral-700 hover:bg-neutral-50 border border-transparent'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-6">User Profile</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Username</label>
                      <input
                        type="text"
                        value={userProfile.username}
                        disabled
                        className="w-full px-4 py-2 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 cursor-not-allowed"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Username cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={userProfile.email}
                        disabled
                        className="w-full px-4 py-2 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 cursor-not-allowed"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Email cannot be changed</p>
                    </div>
                    {userProfile.createdAt && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Account Created</label>
                        <input
                          type="text"
                          value={new Date(userProfile.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                          disabled
                          className="w-full px-4 py-2 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 cursor-not-allowed"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Budget & Limits Tab */}
              {activeTab === 'budget' && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-2">Budget & Rate Limits</h2>
                  <p className="text-sm text-neutral-600 mb-6">Set monthly budget limits and track API spending</p>
                  <RateLimitSettings />
                </div>
              )}

              {/* Email Configuration Tab */}
              {activeTab === 'email' && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-2">Email Configuration</h2>
                  <p className="text-sm text-neutral-600 mb-6">Configure default email settings</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">From Name</label>
                      <input
                        type="text"
                        value={emailSettings.fromName}
                        onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                        placeholder="Your Name"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">From Email</label>
                      <input
                        type="email"
                        value={emailSettings.fromEmail}
                        onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                        placeholder="you@company.com"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Reply-To Email</label>
                      <input
                        type="email"
                        value={emailSettings.replyTo}
                        onChange={(e) => setEmailSettings({ ...emailSettings, replyTo: e.target.value })}
                        placeholder="reply@company.com"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Email Signature</label>
                      <textarea
                        value={emailSettings.signature}
                        onChange={(e) => setEmailSettings({ ...emailSettings, signature: e.target.value })}
                        placeholder="Your email signature..."
                        rows={4}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={handleSaveEmailSettings}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save Email Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-2">Preferences</h2>
                  <p className="text-sm text-neutral-600 mb-6">Customize your application preferences</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Theme</label>
                      <select
                        value={preferences.theme}
                        onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Default Lead Limit</label>
                      <input
                        type="number"
                        value={preferences.defaultLeadLimit}
                        onChange={(e) => setPreferences({ ...preferences, defaultLeadLimit: parseInt(e.target.value) || 10 })}
                        min="1"
                        max="500"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Number of leads to fetch by default</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Auto-Save Interval (seconds)</label>
                      <input
                        type="number"
                        value={preferences.autoSaveInterval / 1000}
                        onChange={(e) => setPreferences({ ...preferences, autoSaveInterval: (parseInt(e.target.value) || 300) * 1000 })}
                        min="60"
                        max="3600"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-neutral-500 mt-1">How often to automatically save your work</p>
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={handleSavePreferences}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save Preferences'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
