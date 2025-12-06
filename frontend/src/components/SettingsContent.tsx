'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UserCircleIcon, 
  CurrencyDollarIcon, 
  EnvelopeIcon,
  CogIcon,
  CalendarIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import RateLimitSettings from './agents/RateLimitSettings';
import CompanyProfileModal from './CompanyProfileModal';

type TabType = 'profile' | 'budget' | 'email' | 'emailResponse' | 'calendar' | 'privacy';

interface UserProfile {
  username: string;
  email: string;
  createdAt?: string;
}

interface GmailAccount {
  email: string;
  refreshToken: string;
  connectedAt: string;
  profilePicture?: string;
  isActive: boolean;
}

interface EmailSettings {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  signature: string;
  customDomain: string;
  domainVerified: boolean;
  domainHealth: {
    spf: boolean;
    dkim: boolean;
    dmarc: boolean;
    lastChecked: string | null;
  };
  useCompanyLogo: boolean;
  calendarIntegrationEnabled: boolean;
  aiAutoResponseEnabled: boolean;
  gmailAccounts: GmailAccount[];
  activeGmailIndex: number;
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
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
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
    signature: '',
    customDomain: '',
    domainVerified: false,
    domainHealth: {
      spf: false,
      dkim: false,
      dmarc: false,
      lastChecked: null
    },
    useCompanyLogo: false,
    calendarIntegrationEnabled: false,
    aiAutoResponseEnabled: false,
    gmailAccounts: [],
    activeGmailIndex: 0
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

  // Auto-check domain health when Gmail accounts are connected
  useEffect(() => {
    const checkDomainHealth = async () => {
      if (emailSettings.gmailAccounts.length === 0) return;
      
      const domain = emailSettings.gmailAccounts[emailSettings.activeGmailIndex]?.email.split('@')[1];
      if (!domain) return;

      // Check if last check was more than 6 hours ago
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const lastChecked = emailSettings.domainHealth.lastChecked ? new Date(emailSettings.domainHealth.lastChecked) : null;
      
      if (!lastChecked || lastChecked < sixHoursAgo) {
        console.log('[SETTINGS] Auto-checking domain health for:', domain);
        try {
          const response = await api.post('/api/check-domain-health', { domain });
          setEmailSettings(prev => ({
            ...prev,
            domainHealth: {
              spf: response.data.spf,
              dkim: response.data.dkim,
              dmarc: response.data.dmarc,
              lastChecked: new Date().toISOString()
            }
          }));
        } catch (error) {
          console.error('[SETTINGS] Failed to auto-check domain health:', error);
        }
      }
    };

    checkDomainHealth();

    // Set up interval to check every 6 hours
    const interval = setInterval(checkDomainHealth, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [emailSettings.gmailAccounts.length, emailSettings.activeGmailIndex]);

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

        // Check Gmail connection status
        try {
          const gmailStatusResponse = await api.get('/api/auth/gmail/status');
          if (gmailStatusResponse.data.accounts && gmailStatusResponse.data.accounts.length > 0) {
            setEmailSettings(prev => ({
              ...prev,
              gmailAccounts: gmailStatusResponse.data.accounts,
              activeGmailIndex: gmailStatusResponse.data.activeIndex || 0
            }));
          }
        } catch (error) {
          console.log('Gmail status not available');
        }

        // Check URL params for Gmail auth callback
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const gmailAuth = urlParams.get('gmailAuth');
          const email = urlParams.get('email');
          
          if (gmailAuth === 'success' && email) {
            setMessage({ type: 'success', text: `Gmail connected! ${decodeURIComponent(email)}` });
            // Auto-switch to email tab
            setActiveTab('email');
            // Refresh Gmail status
            const gmailRefreshResponse = await api.get('/api/auth/gmail/status');
            if (gmailRefreshResponse.data.accounts) {
              setEmailSettings(prev => ({
                ...prev,
                gmailAccounts: gmailRefreshResponse.data.accounts,
                activeGmailIndex: gmailRefreshResponse.data.activeIndex || 0
              }));
            }
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
          } else if (gmailAuth === 'error') {
            const reason = urlParams.get('reason');
            setMessage({ type: 'error', text: `Gmail connection failed: ${reason || 'Unknown error'}` });
            window.history.replaceState({}, '', window.location.pathname);
          }
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

  const handleCheckDomainHealth = async () => {
    if (!emailSettings.customDomain) {
      alert('Please enter a custom domain first');
      return;
    }
    
    try {
      setSaving(true);
      const response = await api.post('/api/email/check-domain-health', {
        domain: emailSettings.customDomain
      });
      
      if (response.data.success) {
        setEmailSettings({
          ...emailSettings,
          domainHealth: {
            spf: response.data.health.spf || false,
            dkim: response.data.health.dkim || false,
            dmarc: response.data.health.dmarc || false,
            lastChecked: new Date().toISOString()
          },
          domainVerified: response.data.health.spf && response.data.health.dkim
        });
        setMessage({ type: 'success', text: 'Domain health checked successfully!' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to check domain health' });
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
    { id: 'privacy' as TabType, label: 'Privacy Policy', icon: ShieldCheckIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Message Banner - Fixed at top with high z-index */}
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] p-4 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Top Tabs Navigation */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm mb-6">
        <div className="border-b border-neutral-200">
          <nav className="flex flex-wrap px-2">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <div key={tab.id} className="flex items-center">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    data-tab={tab.id}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'text-blue-600 border-blue-600'
                        : 'text-neutral-600 border-transparent hover:text-neutral-900 hover:border-neutral-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                  {index < tabs.length - 1 && (
                    <div className="h-8 w-px bg-neutral-200"></div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
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
                  
                  {/* Danger Zone */}
                  <div className="mt-8 pt-6 border-t border-neutral-200">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
                    <p className="text-sm text-neutral-600 mb-4">
                      Reset your account data and restart the onboarding process. This will clear your company profile and force you to go through setup again.
                    </p>
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to reset your account data? This will clear your company profile and restart onboarding. This action cannot be undone.')) {
                          try {
                            await api.delete('/api/company-profile');
                            alert('Account data reset successfully. Redirecting to onboarding...');
                            window.location.reload();
                          } catch (error) {
                            console.error('Failed to reset account data:', error);
                            alert('Failed to reset account data. Please try again.');
                          }
                        }
                      }}
                      className="px-4 py-2 !bg-red-600 text-white rounded-lg hover:!bg-red-700 transition-colors font-medium border border-red-700"
                    >
                      Reset Account Data
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
                <p className="text-sm text-neutral-600 mb-6">Configure email sending, domain settings, and integrations</p>
                
                <div className="space-y-6">
                  {/* Gmail OAuth Connection - STEP 1 */}
                  <div className="bg-white border border-neutral-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">Step 1: Connect Your Gmail</h3>
                        <p className="text-sm text-neutral-600 mt-1">Add multiple accounts for email cycling</p>
                      </div>
                      {emailSettings.gmailAccounts.length > 0 && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          <CheckBadgeIcon className="w-4 h-4" />
                          {emailSettings.gmailAccounts.length} Account{emailSettings.gmailAccounts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {emailSettings.gmailAccounts.length > 0 ? (
                      <div className="space-y-4">
                        {/* Connected Accounts List */}
                        <div className="space-y-3">
                          {emailSettings.gmailAccounts.map((account, index) => (
                            <div 
                              key={account.email}
                              className={`p-4 border rounded-lg transition ${
                                account.isActive 
                                  ? 'bg-green-50 border-green-300 shadow-sm' 
                                  : 'bg-neutral-50 border-neutral-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Profile Picture */}
                                <div className="flex-shrink-0">
                                  {account.profilePicture ? (
                                    <img 
                                      src={account.profilePicture} 
                                      alt={account.email}
                                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                                      {account.email.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Account Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-neutral-900 truncate">
                                      {account.email}
                                    </p>
                                    {account.isActive && (
                                      <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded-full">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-neutral-600">
                                    Connected {new Date(account.connectedAt).toLocaleDateString()}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                  {!account.isActive && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const response = await api.post('/api/auth/gmail/set-active', { accountIndex: index });
                                          if (response.data.success) {
                                            setEmailSettings(prev => ({
                                              ...prev,
                                              activeGmailIndex: index,
                                              gmailAccounts: prev.gmailAccounts.map((acc, i) => ({
                                                ...acc,
                                                isActive: i === index
                                              }))
                                            }));
                                            setMessage({ type: 'success', text: `Switched to ${account.email}` });
                                          }
                                        } catch (error: any) {
                                          setMessage({ type: 'error', text: 'Failed to switch account' });
                                        }
                                      }}
                                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                    >
                                      Set Active
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Disconnect ${account.email}?`)) {
                                        try {
                                          await api.post('/api/auth/gmail/disconnect', { email: account.email });
                                          const newAccounts = emailSettings.gmailAccounts.filter(a => a.email !== account.email);
                                          setEmailSettings(prev => ({
                                            ...prev,
                                            gmailAccounts: newAccounts,
                                            activeGmailIndex: account.isActive && newAccounts.length > 0 ? 0 : prev.activeGmailIndex
                                          }));
                                          if (newAccounts.length > 0 && account.isActive) {
                                            newAccounts[0].isActive = true;
                                          }
                                          setMessage({ type: 'success', text: 'Account disconnected' });
                                        } catch (error: any) {
                                          setMessage({ type: 'error', text: 'Failed to disconnect account' });
                                        }
                                      }
                                    }}
                                    className="px-3 py-1.5 text-xs bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition font-medium"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Another Account Button */}
                        <button
                          onClick={() => {
                            window.location.href = `${api.defaults.baseURL}/api/auth/gmail/authorize?userId=${user?.userId}`;
                          }}
                          className="w-full px-4 py-2.5 bg-white border-2 border-dashed border-neutral-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-neutral-700 font-medium text-sm"
                        >
                          + Add Another Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-900 font-medium mb-2">✨ Benefits:</p>
                          <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                            <li>Send from your actual email (sales@yourcompany.com)</li>
                            <li>One-click setup - no DNS configuration</li>
                            <li>Best deliverability using your Gmail reputation</li>
                            <li>Emails appear in your Sent folder</li>
                          </ul>
                        </div>
                        <button
                          onClick={() => {
                            window.location.href = `${api.defaults.baseURL}/api/auth/gmail/authorize?userId=${user?.userId}`;
                          }}
                          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-white border-2 border-neutral-300 rounded-lg hover:border-blue-500 hover:shadow-md transition text-neutral-900 font-medium"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Connect Gmail Account
                        </button>
                        <p className="text-xs text-neutral-500 text-center">
                          Secure OAuth 2.0 • Only sends emails and reads reply status
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Domain Health - STEP 2 (Auto-show when Gmail connected) */}
                  {emailSettings.gmailAccounts.length > 0 && (
                    <div className="bg-white border border-neutral-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-neutral-900">Step 2: Domain Health</h3>
                          <p className="text-sm text-neutral-600 mt-1">Automatically checked every 6 hours</p>
                        </div>
                        <button
                          onClick={async () => {
                            const domain = emailSettings.gmailAccounts[emailSettings.activeGmailIndex]?.email.split('@')[1];
                            if (!domain) return;
                            setSaving(true);
                            try {
                              const response = await api.post('/api/check-domain-health', { domain });
                              setEmailSettings(prev => ({
                                ...prev,
                                domainHealth: {
                                  spf: response.data.spf,
                                  dkim: response.data.dkim,
                                  dmarc: response.data.dmarc,
                                  lastChecked: new Date().toISOString()
                                }
                              }));
                              setMessage({ type: 'success', text: 'Domain health refreshed' });
                            } catch (error: any) {
                              setMessage({ type: 'error', text: 'Failed to check domain health' });
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition font-medium disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Show current sending domain */}
                        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-neutral-700">Active Sending Domain</span>
                            <span className="text-sm font-semibold text-neutral-900">
                              {emailSettings.gmailAccounts[emailSettings.activeGmailIndex]?.email.split('@')[1] || 'N/A'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500">
                            Emails cycle through all {emailSettings.gmailAccounts.length} connected account{emailSettings.gmailAccounts.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Domain Health Results */}
                        {emailSettings.gmailAccounts.length > 0 && (
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-green-900">Email Authentication</h4>
                              <span className="text-xs text-green-600 font-medium">
                                ✓ Authenticated by Gmail
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between py-2 border-b border-green-200">
                                <div>
                                  <span className="text-sm font-medium text-green-900">SPF Authentication</span>
                                  <p className="text-xs text-green-700">Handled by Google</p>
                                </div>
                                <span className="text-sm font-semibold text-green-600">
                                  ✓ Active
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-green-200">
                                <div>
                                  <span className="text-sm font-medium text-green-900">DKIM Signing</span>
                                  <p className="text-xs text-green-700">Handled by Google</p>
                                </div>
                                <span className="text-sm font-semibold text-green-600">
                                  ✓ Active
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2">
                                <div>
                                  <span className="text-sm font-medium text-green-900">DMARC Policy</span>
                                  <p className="text-xs text-green-700">Handled by Google</p>
                                </div>
                                <span className="text-sm font-semibold text-green-600">
                                  ✓ Active
                                </span>
                              </div>
                            </div>
                            
                            {/* Overall status */}
                            <div className="mt-4 p-3 rounded-lg bg-green-100 border border-green-300">
                              <p className="text-sm font-medium text-green-900">
                                ✓ Your emails are fully authenticated by Gmail's infrastructure
                              </p>
                              <p className="text-xs text-green-800 mt-1">
                                Google automatically handles SPF, DKIM, and DMARC authentication for all emails sent through Gmail OAuth.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Basic Email Settings - REMOVED (Gmail handles this) */}

                  {/* Custom Domain Configuration - REMOVED (not needed with Gmail OAuth) */}

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveEmailSettings}
                      disabled={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Email Configuration'}
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

            {/* Privacy Policy Tab */}
            {activeTab === 'privacy' && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Privacy Policy</h2>
                <p className="text-sm text-neutral-600 mb-6">Our commitment to protecting your data</p>
                
                <div className="prose prose-sm max-w-none space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Last Updated:</strong> November 19, 2025
                    </p>
                  </div>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">1. Information We Collect</h3>
                    <p className="text-sm text-neutral-700 mb-2">We collect information you provide directly:</p>
                    <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1 ml-4">
                      <li>Account information (username, email, password)</li>
                      <li>Company profile details (name, industry, services, target market)</li>
                      <li>Lead research data (company names, contact information)</li>
                      <li>Email content and communication preferences</li>
                      <li>Usage data and analytics</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">2. How We Use Your Information</h3>
                    <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1 ml-4">
                      <li>Provide AI-powered lead research and qualification</li>
                      <li>Generate personalized outreach emails</li>
                      <li>Track email engagement and campaign performance</li>
                      <li>Improve our services and user experience</li>
                      <li>Send important account notifications</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">3. Third-Party Services</h3>
                    <p className="text-sm text-neutral-700 mb-2">We use the following third-party services:</p>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2">
                      <div>
                        <strong className="text-sm text-neutral-900">OpenAI:</strong>
                        <span className="text-sm text-neutral-700"> AI analysis and email generation</span>
                      </div>
                      <div>
                        <strong className="text-sm text-neutral-900">Apollo.io:</strong>
                        <span className="text-sm text-neutral-700"> Lead data enrichment</span>
                      </div>
                      <div>
                        <strong className="text-sm text-neutral-900">Mailgun:</strong>
                        <span className="text-sm text-neutral-700"> Email delivery service</span>
                      </div>
                      <div>
                        <strong className="text-sm text-neutral-900">Serper:</strong>
                        <span className="text-sm text-neutral-700"> Web search capabilities</span>
                      </div>
                      <div>
                        <strong className="text-sm text-neutral-900">AWS:</strong>
                        <span className="text-sm text-neutral-700"> Cloud infrastructure and data storage</span>
                      </div>
                      <div>
                        <strong className="text-sm text-neutral-900">Zilliz:</strong>
                        <span className="text-sm text-neutral-700"> Vector database for AI operations</span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">4. Data Storage & Security</h3>
                    <p className="text-sm text-neutral-700">Your data is stored securely using AWS DynamoDB and Zilliz vector databases with encryption at rest and in transit. We implement industry-standard security measures to protect your information.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">5. Your Rights</h3>
                    <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1 ml-4">
                      <li><strong>Access:</strong> Request a copy of your data</li>
                      <li><strong>Correction:</strong> Update inaccurate information</li>
                      <li><strong>Deletion:</strong> Request account and data deletion</li>
                      <li><strong>Export:</strong> Download your data in portable format</li>
                      <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">6. CAN-SPAM Compliance</h3>
                    <p className="text-sm text-neutral-700">All emails sent through Meridian include unsubscribe links, accurate sender information, and comply with CAN-SPAM Act requirements. Recipients can opt-out at any time.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">7. Data Retention</h3>
                    <p className="text-sm text-neutral-700">We retain your data as long as your account is active. Upon account deletion, we remove all personal data within 30 days, except where required by law.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">8. Contact Us</h3>
                    <p className="text-sm text-neutral-700">For privacy concerns or data requests, contact us through the support section or email our privacy team.</p>
                  </section>

                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mt-6">
                    <p className="text-xs text-neutral-600">
                      For the complete Privacy Policy, visit{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        /privacy
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}
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
