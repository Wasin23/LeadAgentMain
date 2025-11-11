'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  UserCircleIcon, 
  CurrencyDollarIcon, 
  EnvelopeIcon,
  CogIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import RateLimitSettings from './agents/RateLimitSettings';
import CompanyProfileModal from './CompanyProfileModal';

type TabType = 'profile' | 'budget' | 'email' | 'emailResponse' | 'calendar' | 'preferences';

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

interface EmailResponseSettings {
  calendar_id: string;
  company_name: string;
  timezone: string;
  response_tone: string;
  ai_assistant_name: string;
  product_name: string;
  value_propositions: string[];
  meeting_pushiness: string;
  technical_depth: string;
  show_ai_disclaimer: boolean;
}

interface CalendarSettings {
  calendarId: string;
  serviceAccountEmail: string;
}

interface Preferences {
  theme: string;
  emailSignature: string;
  defaultLeadLimit: number;
  autoSaveInterval: number;
}

export default function SettingsContent() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [showProfileModal, setShowProfileModal] = useState(false);
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
  const [emailResponseSettings, setEmailResponseSettings] = useState<EmailResponseSettings>({
    calendar_id: 'primary',
    company_name: '',
    timezone: 'America/Los_Angeles',
    response_tone: 'professional_friendly',
    ai_assistant_name: '',
    product_name: '',
    value_propositions: [],
    meeting_pushiness: 'balanced',
    technical_depth: 'medium',
    show_ai_disclaimer: false
  });
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({
    calendarId: 'primary',
    serviceAccountEmail: ''
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

        // Extract calendar settings if available
        if (settings.calendarSettings) {
          setCalendarSettings(settings.calendarSettings);
        }
      }

      // Fetch email response settings
      try {
        const responseSettingsResponse = await api.get('/api/email-response-settings');
        if (responseSettingsResponse.data.success && responseSettingsResponse.data.settings) {
          setEmailResponseSettings(responseSettingsResponse.data.settings);
        }
      } catch (error) {
        console.log('Email response settings not available or error fetching');
      }

      // Fetch service account email from environment (for display only)
      try {
        const envResponse = await api.get('/api/system/calendar-config');
        if (envResponse.data.serviceAccountEmail) {
          setCalendarSettings(prev => ({
            ...prev,
            serviceAccountEmail: envResponse.data.serviceAccountEmail
          }));
        }
      } catch (error) {
        console.log('Service account email not available');
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

  const handleSaveCalendarSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await api.post('/api/auth/settings/calendar', { calendarSettings });
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Calendar settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save calendar settings' });
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

  const handleSaveEmailResponseSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await api.post('/api/email-response-settings', emailResponseSettings);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Email response settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save email response settings' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as TabType, label: 'Profile', icon: UserCircleIcon },
    { id: 'budget' as TabType, label: 'Budget & Limits', icon: CurrencyDollarIcon },
    { id: 'email' as TabType, label: 'Email Configuration', icon: EnvelopeIcon },
    { id: 'emailResponse' as TabType, label: 'Email Response Settings', icon: CogIcon },
    { id: 'calendar' as TabType, label: 'Calendar Integration', icon: CalendarIcon },
    { id: 'preferences' as TabType, label: 'Preferences', icon: CogIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
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
                  <div className="pt-4">
                    <button
                      onClick={() => setShowProfileModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit Company Profile
                    </button>
                  </div>
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

            {/* Email Response Settings Tab */}
            {activeTab === 'emailResponse' && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Email Response Settings</h2>
                <p className="text-sm text-neutral-600 mb-6">Configure how the AI responds to incoming emails</p>
                
                <div className="space-y-6">
                  {/* Company Information */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4">Company Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Company Name</label>
                        <input
                          type="text"
                          value={emailResponseSettings.company_name}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, company_name: e.target.value })}
                          placeholder="Your Company"
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Product Name</label>
                        <input
                          type="text"
                          value={emailResponseSettings.product_name}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, product_name: e.target.value })}
                          placeholder="Your Product"
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">AI Assistant Name</label>
                        <input
                          type="text"
                          value={emailResponseSettings.ai_assistant_name}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, ai_assistant_name: e.target.value })}
                          placeholder="Assistant Name"
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Timezone</label>
                        <select
                          value={emailResponseSettings.timezone}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, timezone: e.target.value })}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Response Style */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4">Response Style</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Response Tone</label>
                        <select
                          value={emailResponseSettings.response_tone}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, response_tone: e.target.value })}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="professional_friendly">Professional & Friendly</option>
                          <option value="formal">Formal</option>
                          <option value="casual">Casual</option>
                          <option value="consultative">Consultative</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Meeting Pushiness</label>
                        <select
                          value={emailResponseSettings.meeting_pushiness}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, meeting_pushiness: e.target.value })}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="low">Low - Mention if relevant</option>
                          <option value="balanced">Balanced - Suggest when appropriate</option>
                          <option value="high">High - Actively propose meetings</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Technical Depth</label>
                        <select
                          value={emailResponseSettings.technical_depth}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, technical_depth: e.target.value })}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="basic">Basic - Simple explanations</option>
                          <option value="medium">Medium - Balanced detail</option>
                          <option value="advanced">Advanced - Technical depth</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Value Propositions */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-2">Value Propositions</h3>
                    <p className="text-xs text-neutral-600 mb-3">Enter key benefits, one per line</p>
                    <textarea
                      value={emailResponseSettings.value_propositions.join('\n')}
                      onChange={(e) => setEmailResponseSettings({
                        ...emailResponseSettings,
                        value_propositions: e.target.value.split('\n').filter(v => v.trim())
                      })}
                      placeholder="Increase efficiency by 50%&#10;Reduce costs significantly&#10;Easy integration"
                      rows={5}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>

                  {/* Calendar ID */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4">Calendar Integration</h3>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Calendar ID</label>
                      <input
                        type="text"
                        value={emailResponseSettings.calendar_id}
                        onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, calendar_id: e.target.value })}
                        placeholder="primary or your-email@gmail.com"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        Calendar ID for scheduling meetings (configure sharing in Calendar Integration tab)
                      </p>
                    </div>
                  </div>

                  {/* AI Disclaimer */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4">Transparency</h3>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="show_ai_disclaimer"
                        checked={emailResponseSettings.show_ai_disclaimer}
                        onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, show_ai_disclaimer: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="show_ai_disclaimer" className="text-sm text-neutral-700">
                        Show AI disclaimer in email responses
                      </label>
                    </div>
                    <p className="text-xs text-neutral-500 mt-2 ml-7">
                      Adds a note indicating the response was AI-generated
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleSaveEmailResponseSettings}
                      disabled={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Email Response Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Calendar Integration Tab */}
            {activeTab === 'calendar' && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Calendar Integration</h2>
                <p className="text-sm text-neutral-600 mb-6">Configure Google Calendar integration for automated meeting scheduling</p>
                
                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">📅 Setup Instructions</h3>
                  <ol className="text-xs text-blue-800 space-y-2 list-decimal list-inside">
                    <li>Enter your Google Calendar ID below (usually your email or "primary")</li>
                    <li>Share your calendar with the service account email shown below</li>
                    <li>Grant "Make changes to events" permission to allow the AI to schedule meetings</li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Google Calendar ID</label>
                    <input
                      type="text"
                      value={calendarSettings.calendarId}
                      onChange={(e) => setCalendarSettings({ ...calendarSettings, calendarId: e.target.value })}
                      placeholder="primary or your-email@gmail.com"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Use "primary" for your main calendar or your calendar's email address
                    </p>
                  </div>

                  {calendarSettings.serviceAccountEmail && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Service Account Email</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={calendarSettings.serviceAccountEmail}
                          disabled
                          className="flex-1 px-4 py-2 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 cursor-not-allowed font-mono text-sm"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(calendarSettings.serviceAccountEmail);
                            setMessage({ type: 'success', text: 'Copied to clipboard!' });
                            setTimeout(() => setMessage(null), 2000);
                          }}
                          className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Share your Google Calendar with this email address
                      </p>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">How to share your calendar:</h4>
                    <ol className="text-xs text-neutral-600 space-y-1 list-decimal list-inside">
                      <li>Go to <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Calendar</a></li>
                      <li>Click on "Settings and sharing" for your calendar</li>
                      <li>Under "Share with specific people", click "Add people"</li>
                      <li>Paste the service account email above</li>
                      <li>Grant "Make changes to events" permission</li>
                      <li>Click "Send"</li>
                    </ol>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleSaveCalendarSettings}
                      disabled={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Calendar Settings'}
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
      {/* Company Profile Modal (shared) */}
      {showProfileModal && (
        <CompanyProfileModal
          open={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onSaved={async () => {
            // Refresh settings after profile save
            try {
              await fetchSettings();
            } catch (e) {
              console.error('Error refreshing settings after profile save', e);
            }
            setShowProfileModal(false);
          }}
        />
      )}
    </div>
  );
}
