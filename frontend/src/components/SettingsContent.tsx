'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UserCircleIcon, 
  CurrencyDollarIcon, 
  CalendarIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import RateLimitSettings from './agents/RateLimitSettings';
import CompanyProfileModal from './CompanyProfileModal';

type TabType = 'profile' | 'budget' | 'calendar' | 'privacy' | 'email' | 'emailResponse' | 'emailPreferences';

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

interface OutlookAccount {
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
  outlookAccounts?: OutlookAccount[];
  activeOutlookIndex?: number;
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
  googleConnected?: boolean;
  calendlyLink?: string;
}

interface Preferences {
  theme: string;
  emailSignature: string;
  defaultLeadLimit: number;
  autoSaveInterval: number;
  defaultRebumpEnabled?: boolean;
  defaultUseGmail?: boolean;
  defaultUseOutlook?: boolean;
}

export default function SettingsContent({ initialTab = 'profile', calendarSection }: { initialTab?: TabType; calendarSection?: 'google' | 'calendly' | 'both' }) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
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
    activeGmailIndex: 0,
    outlookAccounts: [],
    activeOutlookIndex: 0
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
    autoSaveInterval: 300000,
    defaultUseGmail: false
  });

  useEffect(() => {
    fetchSettings();

    // Check for calendar connection success/error from OAuth redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('calendar-connected') === 'true') {
      setMessage({ type: 'success', text: 'Google Calendar connected successfully!' });
      // Refresh calendar status
      api.get('/api/calendar/status').then(response => {
        if (response.data.googleConnected) {
          setCalendarSettings(prev => ({ ...prev, googleConnected: true }));
        }
      }).catch(err => console.error('Failed to refresh calendar status:', err));
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    } else if (urlParams.get('calendar-error')) {
      setMessage({ type: 'error', text: `Calendar connection failed: ${urlParams.get('calendar-error')}` });
      window.history.replaceState({}, '', '/settings');
    }
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

        // Check Outlook connection status
        try {
          const outlookStatusResponse = await api.get('/api/auth/outlook/status');
          if (outlookStatusResponse.data.accounts && outlookStatusResponse.data.accounts.length > 0) {
            setEmailSettings(prev => ({
              ...prev,
              outlookAccounts: outlookStatusResponse.data.accounts,
              activeOutlookIndex: outlookStatusResponse.data.activeIndex || 0
            }));
          }
        } catch (error) {
          console.log('Outlook status not available');
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

          // Check for Outlook auth callback
          const outlookAuth = urlParams.get('outlookAuth');
          const outlookEmail = urlParams.get('email');
          
          if (outlookAuth === 'success' && outlookEmail) {
            setMessage({ type: 'success', text: `Outlook connected! ${decodeURIComponent(outlookEmail)}` });
            setActiveTab('email');
            // Refresh Outlook status
            const outlookRefreshResponse = await api.get('/api/auth/outlook/status');
            if (outlookRefreshResponse.data.accounts) {
              setEmailSettings(prev => ({
                ...prev,
                outlookAccounts: outlookRefreshResponse.data.accounts,
                activeOutlookIndex: outlookRefreshResponse.data.activeIndex || 0
              }));
            }
            window.history.replaceState({}, '', window.location.pathname);
          } else if (outlookAuth === 'error') {
            const reason = urlParams.get('reason');
            setMessage({ type: 'error', text: `Outlook connection failed: ${reason || 'Unknown error'}` });
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

      // Fetch calendar status (OAuth and Calendly)
      try {
        const calendarStatusResponse = await api.get('/api/calendar/status');
        if (calendarStatusResponse.data) {
          setCalendarSettings(prev => ({
            ...prev,
            googleConnected: calendarStatusResponse.data.googleConnected || false,
            calendlyLink: calendarStatusResponse.data.calendlyLink || ''
          }));
        }
      } catch (error) {
        console.log('Calendar status not available');
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
    { id: 'calendar' as TabType, label: 'Calendar Integration', icon: CalendarIcon },
    { id: 'privacy' as TabType, label: 'Privacy Policy', icon: ShieldCheckIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-lg font-medium text-white">Loading...</div>
        </div>
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

      {/* Content Area - No tabs */}
      <div className="space-y-6">
            {/* Profile Section */}
            {activeTab === 'profile' && (
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">Username</label>
                    <input
                      type="text"
                      value={userProfile.username}
                      disabled
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white cursor-not-allowed"
                    />
                    <p className="text-xs text-white/60 mt-1">Username cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">Email</label>
                    <input
                      type="email"
                      value={userProfile.email}
                      disabled
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white cursor-not-allowed"
                    />
                    <p className="text-xs text-white/60 mt-1">Email cannot be changed</p>
                  </div>
                  {userProfile.createdAt && (
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Account Created</label>
                      <input
                        type="text"
                        value={new Date(userProfile.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        disabled
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white cursor-not-allowed"
                      />
                    </div>
                  )}
                  
                  {/* Danger Zone */}
                  <div className="mt-8 pt-6 border-t border-white/20">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
                    <p className="text-sm text-white/80 mb-4">
                      Reset your account data and restart the onboarding process. This will clear your company profile and force you to go through setup again.
                    </p>
                    
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to reset your account data? This will clear ALL data including agents, emails, analytics, and company profile. You will be redirected to onboarding. This action cannot be undone.')) {
                          try {
                            console.log('[SETTINGS] Attempting to reset account...');
                            const response = await api.delete('/api/company-profile');
                            console.log('[SETTINGS] Reset successful:', response.data);
                            alert('Account reset successful! Redirecting to onboarding...');
                            // Redirect to setup page which will show full onboarding flow
                            window.location.href = '/setup';
                          } catch (error: any) {
                            console.error('[SETTINGS] Failed to reset account data:', error);
                            console.error('[SETTINGS] Error details:', {
                              message: error.message,
                              response: error.response?.data,
                              status: error.response?.status,
                              url: error.config?.url
                            });
                            alert(`Failed to reset account data: ${error.response?.data?.error || error.message}. Please contact support.`);
                          }
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium border border-red-700"
                    >
                      Reset Account Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Budget & Limits Section */}
            {activeTab === 'budget' && (
              <div>
                <RateLimitSettings />
              </div>
            )}

            {/* Email Configuration Section */}
            {activeTab === 'email' && (
              <div className="space-y-6">
                {/* Gmail OAuth Connection - STEP 1 */}
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Step 1: Connect Your Gmail</h3>
                        <p className="text-sm text-white/80 mt-1">Add multiple accounts for email cycling</p>
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
                                  ? 'bg-[#1B2F52] border-[#4FD1FF] shadow-lg shadow-[#4FD1FF]/20' 
                                  : 'bg-white/5 border-white/20'
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
                                      onError={(e) => {
                                        // Hide broken image and show fallback
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg shadow-sm ${account.profilePicture ? 'hidden' : ''}`}>
                                    {account.email.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                
                                {/* Account Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-white truncate">
                                      {account.email}
                                    </p>
                                    {account.isActive && (
                                      <span className="px-2 py-0.5 bg-[#4FD1FF] text-[#0A1628] text-xs font-medium rounded-full">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-white/80">
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
                          className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-dashed border-white/20 rounded-lg hover:border-[#4FD1FF] hover:bg-[#1B2F52] transition text-white/90 font-medium text-sm"
                        >
                          + Add Another Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-[#1B2F52] border border-[#4FD1FF]/30 rounded-lg">
                          <p className="text-sm text-white/90">
                            This will allow the agent to send emails from the email of your choosing instead of the default service email address.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const width = 600;
                            const height = 700;
                            const left = window.screen.width / 2 - width / 2;
                            const top = window.screen.height / 2 - height / 2;
                            const popup = window.open(
                              `${api.defaults.baseURL}/api/auth/gmail/authorize?userId=${user?.userId}`,
                              'Gmail Authorization',
                              `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
                            );
                            
                            // Listen for postMessage from popup
                            let messageReceived = false;
                            const handleMessage = async (event: MessageEvent) => {
                              if (event.data?.type === 'GMAIL_CONNECTED') {
                                messageReceived = true;
                                console.log('✅ Received Gmail connected message:', event.data);
                                
                                // Immediately show success message
                                setMessage({ type: 'success', text: `Gmail connected! ${event.data.email}` });
                                
                                // Wait a bit for backend to save, then refresh with retries
                                let retries = 0;
                                const maxRetries = 5;
                                const refreshStatus = async () => {
                                  try {
                                    const response = await api.get('/api/auth/gmail/status');
                                    if (response.data.accounts && response.data.accounts.length > 0) {
                                      console.log('✅ Gmail accounts loaded:', response.data.accounts);
                                      setEmailSettings(prev => ({
                                        ...prev,
                                        gmailAccounts: response.data.accounts,
                                        activeGmailIndex: response.data.activeIndex || 0
                                      }));
                                    } else if (retries < maxRetries) {
                                      // No accounts yet, retry after delay
                                      retries++;
                                      console.log(`⏳ No accounts found, retry ${retries}/${maxRetries}...`);
                                      setTimeout(refreshStatus, 1000);
                                    }
                                  } catch (error) {
                                    if (retries < maxRetries) {
                                      retries++;
                                      setTimeout(refreshStatus, 1000);
                                    }
                                  }
                                };
                                
                                // Start with a small delay
                                setTimeout(refreshStatus, 500);
                              }
                            };
                            window.addEventListener('message', handleMessage);
                            
                            // Listen for OAuth completion
                            const checkPopup = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(checkPopup);
                                window.removeEventListener('message', handleMessage);
                                console.log('Gmail popup closed');
                                
                                // If we already got the postMessage, don't show error
                                if (messageReceived) {
                                  console.log('✅ Already received connection confirmation via postMessage');
                                  return;
                                }
                                
                                // Check localStorage for success flag (backup method)
                                setTimeout(async () => {
                                  try {
                                    const gmailConnectedData = localStorage.getItem('gmailConnected');
                                    if (gmailConnectedData) {
                                      const { email } = JSON.parse(gmailConnectedData);
                                      localStorage.removeItem('gmailConnected');
                                      setMessage({ type: 'success', text: `Gmail connected! ${email}` });
                                      
                                      // Retry fetching accounts with delays
                                      let retries = 0;
                                      const maxRetries = 5;
                                      const refreshStatus = async () => {
                                        try {
                                          const response = await api.get('/api/auth/gmail/status');
                                          if (response.data.accounts && response.data.accounts.length > 0) {
                                            setEmailSettings(prev => ({
                                              ...prev,
                                              gmailAccounts: response.data.accounts,
                                              activeGmailIndex: response.data.activeIndex || 0
                                            }));
                                          } else if (retries < maxRetries) {
                                            retries++;
                                            setTimeout(refreshStatus, 1000);
                                          }
                                        } catch (error) {
                                          if (retries < maxRetries) {
                                            retries++;
                                            setTimeout(refreshStatus, 1000);
                                          }
                                        }
                                      };
                                      setTimeout(refreshStatus, 500);
                                    } else {
                                      // No success indicators - popup was likely closed by user
                                      console.log('ℹ️ Popup closed without success indicators');
                                    }
                                  } catch (error) {
                                    console.error('Error checking Gmail connection:', error);
                                  }
                                }, 1000);
                              }
                            }, 1000);
                          }}
                          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-lg hover:border-blue-500 hover:shadow-md transition text-white font-medium"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Connect Gmail Account
                        </button>
                        <p className="text-xs text-white/70 text-center">
                          Secure OAuth 2.0 • Only sends emails and reads reply status
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Outlook OAuth Connection - STEP 2 */}
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Step 2: Connect Your Outlook (Optional)</h3>
                        <p className="text-sm text-white/80 mt-1">Add Outlook accounts for additional email cycling</p>
                      </div>
                      {emailSettings.outlookAccounts && emailSettings.outlookAccounts.length > 0 && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          <CheckBadgeIcon className="w-4 h-4" />
                          {emailSettings.outlookAccounts.length} Account{emailSettings.outlookAccounts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {emailSettings.outlookAccounts && emailSettings.outlookAccounts.length > 0 ? (
                      <div className="space-y-4">
                        {/* Connected Accounts List */}
                        <div className="space-y-3">
                          {emailSettings.outlookAccounts.map((account, index) => (
                            <div 
                              key={account.email}
                              className={`p-4 border rounded-lg transition ${
                                account.isActive 
                                  ? 'bg-[#1B2F52] border-[#4FD1FF] shadow-lg shadow-[#4FD1FF]/20' 
                                  : 'bg-white/5 border-white/20'
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
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-semibold text-lg shadow-sm ${account.profilePicture ? 'hidden' : ''}`}>
                                    {account.email.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                
                                {/* Account Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-white truncate">
                                      {account.email}
                                    </p>
                                    {account.isActive && (
                                      <span className="px-2 py-0.5 bg-[#4FD1FF] text-[#0A1628] text-xs font-medium rounded-full">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-white/80">
                                    Connected {new Date(account.connectedAt).toLocaleDateString()}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                  {!account.isActive && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const response = await api.post('/api/auth/outlook/set-active', { accountIndex: index });
                                          if (response.data.success) {
                                            setEmailSettings(prev => ({
                                              ...prev,
                                              activeOutlookIndex: index,
                                              outlookAccounts: prev.outlookAccounts?.map((acc, i) => ({
                                                ...acc,
                                                isActive: i === index
                                              })) || []
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
                                          await api.post('/api/auth/outlook/disconnect', { email: account.email });
                                          const newAccounts = (emailSettings.outlookAccounts || []).filter(a => a.email !== account.email);
                                          setEmailSettings(prev => ({
                                            ...prev,
                                            outlookAccounts: newAccounts,
                                            activeOutlookIndex: account.isActive && newAccounts.length > 0 ? 0 : prev.activeOutlookIndex
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
                          onClick={async () => {
                            try {
                              const response = await api.get('/api/auth/outlook/oauth-url');
                              if (response.data.authUrl) {
                                window.location.href = response.data.authUrl;
                              }
                            } catch (error) {
                              setMessage({ type: 'error', text: 'Failed to get Outlook auth URL' });
                            }
                          }}
                          className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-dashed border-white/20 rounded-lg hover:border-[#4FD1FF] hover:bg-[#1B2F52] transition text-white/90 font-medium text-sm"
                        >
                          + Add Another Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-[#1B2F52] border border-[#4FD1FF]/30 rounded-lg">
                          <p className="text-sm text-white/90">
                            Add Outlook accounts for additional email cycling and deliverability options.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const response = await api.get('/api/auth/outlook/oauth-url');
                              if (response.data.authUrl) {
                                const width = 600;
                                const height = 700;
                                const left = window.screen.width / 2 - width / 2;
                                const top = window.screen.height / 2 - height / 2;
                                const popup = window.open(
                                  response.data.authUrl,
                                  'Outlook Authorization',
                                  `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
                                );
                                
                                // Monitor for completion
                                let messageReceived = false;
                                const handleMessage = async (event: MessageEvent) => {
                                  if (event.data?.type === 'OUTLOOK_CONNECTED') {
                                    messageReceived = true;
                                    setMessage({ type: 'success', text: `Outlook connected! ${event.data.email}` });
                                    
                                    setTimeout(async () => {
                                      try {
                                        const statusResponse = await api.get('/api/auth/outlook/status');
                                        if (statusResponse.data.accounts?.length > 0) {
                                          setEmailSettings(prev => ({
                                            ...prev,
                                            outlookAccounts: statusResponse.data.accounts,
                                            activeOutlookIndex: statusResponse.data.activeIndex || 0
                                          }));
                                        }
                                      } catch (error) {
                                        console.error('Failed to refresh Outlook status:', error);
                                      }
                                    }, 500);
                                  }
                                };
                                window.addEventListener('message', handleMessage);

                                const checkPopup = setInterval(() => {
                                  if (popup?.closed) {
                                    clearInterval(checkPopup);
                                    window.removeEventListener('message', handleMessage);
                                    if (!messageReceived) {
                                      console.log('Outlook popup closed');
                                    }
                                  }
                                }, 1000);
                              }
                            } catch (error) {
                              setMessage({ type: 'error', text: 'Failed to connect Outlook' });
                            }
                          }}
                          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-lg hover:border-blue-600 hover:shadow-md transition text-white font-medium"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 48 48">
                            <path fill="#0078D4" d="M2 12a2 2 0 012-2h40a2 2 0 012 2v24a2 2 0 01-2 2H4a2 2 0 01-2-2V12z"/>
                            <path fill="#FFF" d="M24 17c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                          </svg>
                          Connect Outlook Account
                        </button>
                        <p className="text-xs text-white/70 text-center">
                          Secure OAuth 2.0 • Send emails from your Outlook account
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Default Gmail Sending Toggle */}
                  {emailSettings.gmailAccounts.length > 0 && (
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-2">Default Gmail Sending</h3>
                          <p className="text-sm text-white/80">
                            When enabled, new agents will automatically use Gmail for sending instead of Mailgun. 
                            You can override this setting per agent in their individual settings.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !preferences.defaultUseGmail;
                            setPreferences(prev => ({ 
                              ...prev, 
                              defaultUseGmail: newValue,
                              defaultUseOutlook: newValue ? false : prev.defaultUseOutlook // Turn off Outlook if enabling Gmail
                            }));
                            try {
                              await api.post('/api/auth/settings/preferences', {
                                preferences: { 
                                  defaultUseGmail: newValue,
                                  defaultUseOutlook: newValue ? false : preferences.defaultUseOutlook
                                }
                              });
                              setMessage({ 
                                type: 'success', 
                                text: `Default Gmail sending ${newValue ? 'enabled' : 'disabled'} for new agents` 
                              });
                            } catch (error) {
                              console.error('Failed to save preference:', error);
                              setPreferences(prev => ({ ...prev, defaultUseGmail: !newValue }));
                              setMessage({ type: 'error', text: 'Failed to save preference' });
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            preferences.defaultUseGmail ? 'bg-blue-600' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preferences.defaultUseGmail ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Default Outlook Sending Toggle */}
                  {emailSettings.outlookAccounts && emailSettings.outlookAccounts.length > 0 && (
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-2">Default Outlook Sending</h3>
                          <p className="text-sm text-white/80">
                            When enabled, new agents will automatically use Outlook for sending instead of Mailgun. 
                            You can override this setting per agent in their individual settings.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !preferences.defaultUseOutlook;
                            setPreferences(prev => ({ 
                              ...prev, 
                              defaultUseOutlook: newValue,
                              defaultUseGmail: newValue ? false : prev.defaultUseGmail // Turn off Gmail if enabling Outlook
                            }));
                            try {
                              await api.post('/api/auth/settings/preferences', {
                                preferences: { 
                                  defaultUseOutlook: newValue,
                                  defaultUseGmail: newValue ? false : preferences.defaultUseGmail
                                }
                              });
                              setMessage({ 
                                type: 'success', 
                                text: `Default Outlook sending ${newValue ? 'enabled' : 'disabled'} for new agents` 
                              });
                            } catch (error) {
                              console.error('Failed to save preference:', error);
                              setPreferences(prev => ({ ...prev, defaultUseOutlook: !newValue }));
                              setMessage({ type: 'error', text: 'Failed to save preference' });
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            preferences.defaultUseOutlook ? 'bg-blue-600' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preferences.defaultUseOutlook ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
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
            )}

            {/* Email Response Settings Section */}
            {activeTab === 'emailResponse' && (
              <div className="space-y-6">
                {/* Company Information */}
                <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-4">Company Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">Company Name</label>
                        <input
                          type="text"
                          value={emailResponseSettings.company_name}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, company_name: e.target.value })}
                          placeholder="Your Company"
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">Product Name</label>
                        <input
                          type="text"
                          value={emailResponseSettings.product_name}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, product_name: e.target.value })}
                          placeholder="Your Product"
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">AI Assistant Name</label>
                        <input
                          type="text"
                          value={emailResponseSettings.ai_assistant_name}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, ai_assistant_name: e.target.value })}
                          placeholder="Assistant Name"
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">Timezone</label>
                        <select
                          value={emailResponseSettings.timezone}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, timezone: e.target.value })}
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-4">Response Style</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">Response Tone</label>
                        <select
                          value={emailResponseSettings.response_tone}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, response_tone: e.target.value })}
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="professional_friendly">Professional & Friendly</option>
                          <option value="formal">Formal</option>
                          <option value="casual">Casual</option>
                          <option value="consultative">Consultative</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">Meeting Pushiness</label>
                        <select
                          value={emailResponseSettings.meeting_pushiness}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, meeting_pushiness: e.target.value })}
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="low">Low - Mention if relevant</option>
                          <option value="balanced">Balanced - Suggest when appropriate</option>
                          <option value="high">High - Actively propose meetings</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">Technical Depth</label>
                        <select
                          value={emailResponseSettings.technical_depth}
                          onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, technical_depth: e.target.value })}
                          className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="basic">Basic - Simple explanations</option>
                          <option value="medium">Medium - Balanced detail</option>
                          <option value="advanced">Advanced - Technical depth</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Value Propositions */}
                  <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">Value Propositions</h3>
                    <p className="text-xs text-white/80 mb-3">Enter key benefits, one per line</p>
                    <textarea
                      value={emailResponseSettings.value_propositions.join('\n')}
                      onChange={(e) => setEmailResponseSettings({
                        ...emailResponseSettings,
                        value_propositions: e.target.value.split('\n').filter(v => v.trim())
                      })}
                      placeholder="Increase efficiency by 50%&#10;Reduce costs significantly&#10;Easy integration"
                      rows={5}
                      className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>

                  {/* Calendar ID */}
                  <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-4">Calendar Integration</h3>
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Calendar ID</label>
                      <input
                        type="text"
                        value={emailResponseSettings.calendar_id}
                        onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, calendar_id: e.target.value })}
                        placeholder="primary or your-email@gmail.com"
                        className="w-full px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-white/70 mt-1">
                        Calendar ID for scheduling meetings (configure sharing in Calendar Integration tab)
                      </p>
                    </div>
                  </div>

                  {/* AI Disclaimer */}
                  <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-4">Transparency</h3>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="show_ai_disclaimer"
                        checked={emailResponseSettings.show_ai_disclaimer}
                        onChange={(e) => setEmailResponseSettings({ ...emailResponseSettings, show_ai_disclaimer: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-white/20 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="show_ai_disclaimer" className="text-sm text-white/90">
                        Show AI disclaimer in email responses
                      </label>
                    </div>
                    <p className="text-xs text-white/70 mt-2 ml-7">
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
            )}

            {/* Email Preferences Section */}
            {activeTab === 'emailPreferences' && (
              <div className="space-y-6">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Email Settings</h3>
                  
                  <div className="space-y-6">
                    {/* AI Auto Response Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                      <div>
                        <h4 className="text-sm font-semibold text-white">AI Auto Response</h4>
                        <p className="text-xs text-white/70 mt-1">Enable AI-powered automatic email responses</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailSettings.aiAutoResponseEnabled}
                          onChange={(e) => setEmailSettings({ ...emailSettings, aiAutoResponseEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Default Email Source */}
                    <div className="p-4 bg-white/5 border border-white/20 rounded-lg">
                      <h4 className="text-sm font-semibold text-white mb-4">Default Email Source</h4>
                      <p className="text-xs text-white/70 mb-4">Choose which email to use for sending by default</p>
                      
                      <div className="space-y-3">
                        <label className="flex items-center p-3 bg-white/5 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name="emailSource"
                            value="mailgun"
                            checked={emailSettings.customDomain === 'mg.meridian'}
                            onChange={() => setEmailSettings({ ...emailSettings, customDomain: 'mg.meridian' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-white">Meridian Email (mg.meridian)</p>
                            <p className="text-xs text-white/70">Use our managed email service</p>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-3 bg-white/5 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name="emailSource"
                            value="gmail"
                            checked={emailSettings.customDomain !== 'mg.meridian'}
                            onChange={() => setEmailSettings({ ...emailSettings, customDomain: '' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-white">Connected Gmail</p>
                            <p className="text-xs text-white/70">
                              {emailSettings.gmailAccounts.length > 0 
                                ? `Send from: ${emailSettings.gmailAccounts[emailSettings.activeGmailIndex]?.email || 'Not connected'}`
                                : 'No Gmail accounts connected'}
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Default Rebump Setting */}
                    <div className="p-4 bg-white/5 border border-white/20 rounded-lg">
                      <h4 className="text-sm font-semibold text-white mb-4">Default Rebump Behavior</h4>
                      <p className="text-xs text-white/70 mb-4">Automatically send follow-up emails to non-responders</p>
                      
                      <div className="space-y-3">
                        <label className="flex items-center p-3 bg-white/5 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name="rebumpBehavior"
                            value="enabled"
                            checked={preferences.defaultRebumpEnabled !== false}
                            onChange={() => setPreferences({ ...preferences, defaultRebumpEnabled: true })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-white">Rebump Enabled</p>
                            <p className="text-xs text-white/70">Send follow-up emails after no response</p>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-3 bg-white/5 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name="rebumpBehavior"
                            value="disabled"
                            checked={preferences.defaultRebumpEnabled === false}
                            onChange={() => setPreferences({ ...preferences, defaultRebumpEnabled: false })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-white">Rebump Disabled</p>
                            <p className="text-xs text-white/70">No automatic follow-up emails</p>
                          </div>
                        </label>
                      </div>
                      <p className="text-xs text-white/60 mt-3 italic">
                        Note: This is the default setting for new agents. You can override this per-agent in individual agent settings.
                      </p>
                    </div>

                    {/* Save Button */}
                    <div className="pt-4">
                      <button
                        onClick={async () => {
                          await handleSaveEmailSettings();
                          await handleSavePreferences();
                        }}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save Email Preferences'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Calendar Integration Tab */}
            {activeTab === 'calendar' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Calendar Integration</h2>
                <p className="text-sm text-white/80 mb-6">Manage your calendar connections for automated meeting scheduling</p>
                
                <div className="space-y-6">
                  {/* Google Calendar OAuth Status */}
                  {(!calendarSection || calendarSection === 'both' || calendarSection === 'google') && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-3">
                          <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Google Calendar
                        </h3>
                        <p className="text-sm text-white/80 mb-4">
                          AI creates events directly in your calendar when meetings are confirmed
                        </p>
                        {calendarSettings.googleConnected ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Connected
                            </span>
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to disconnect Google Calendar?')) {
                                  try {
                                    await api.post('/api/calendar/disconnect-google');
                                    setCalendarSettings({ ...calendarSettings, googleConnected: false });
                                    setMessage({ type: 'success', text: 'Google Calendar disconnected' });
                                  } catch (error: any) {
                                    console.error('Disconnect error:', error);
                                    setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to disconnect' });
                                  }
                                }
                              }}
                              className="text-sm text-red-600 hover:text-red-700 hover:underline"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Not Connected
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await api.get('/api/calendar/google-oauth-url');
                                  const width = 600;
                                  const height = 700;
                                  const left = window.screenX + (window.outerWidth - width) / 2;
                                  const top = window.screenY + (window.outerHeight - height) / 2;
                                  const popup = window.open(
                                    response.data.authUrl,
                                    'Google Calendar OAuth',
                                    `width=${width},height=${height},left=${left},top=${top}`
                                  );
                                  const checkPopup = setInterval(() => {
                                    if (popup?.closed) {
                                      clearInterval(checkPopup);
                                      // Recheck status
                                      api.get('/api/calendar/status').then(statusRes => {
                                        if (statusRes.data.googleConnected) {
                                          setCalendarSettings({ ...calendarSettings, googleConnected: true });
                                          setMessage({ type: 'success', text: 'Google Calendar connected!' });
                                        }
                                      });
                                    }
                                  }, 500);
                                } catch (error: any) {
                                  setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to connect' });
                                }
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                            >
                              Connect Now
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Calendly Link */}
                  {(!calendarSection || calendarSection === 'both' || calendarSection === 'calendly') && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-3">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Calendly Link
                    </h3>
                    <p className="text-sm text-white/80 mb-4">
                      AI sends this link to leads who prefer to self-schedule
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={calendarSettings.calendlyLink || ''}
                        onChange={(e) => setCalendarSettings({ ...calendarSettings, calendlyLink: e.target.value })}
                        placeholder="https://calendly.com/yourname/30min"
                        className="flex-1 px-4 py-2 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await api.post('/api/calendar/calendly-link', { 
                              calendlyLink: calendarSettings.calendlyLink 
                            });
                            setMessage({ type: 'success', text: 'Calendly link saved!' });
                          } catch (error) {
                            setMessage({ type: 'error', text: 'Failed to save Calendly link' });
                          }
                        }}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                    <p className="text-xs text-white/70 mt-2">
                      Get your link from <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">calendly.com</a>
                    </p>
                  </div>
                  )}
                </div>
              </div>
            )}

            {/* Privacy Policy Tab */}
            {activeTab === 'privacy' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Privacy Policy</h2>
                <p className="text-sm text-white/80 mb-6">Our commitment to protecting your data</p>
                
                <div className="prose prose-sm max-w-none space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Last Updated:</strong> November 19, 2025
                    </p>
                  </div>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h3>
                    <p className="text-sm text-white/90 mb-2">We collect information you provide directly:</p>
                    <ul className="list-disc list-inside text-sm text-white/90 space-y-1 ml-4">
                      <li>Account information (username, email, password)</li>
                      <li>Company profile details (name, industry, services, target market)</li>
                      <li>Lead research data (company names, contact information)</li>
                      <li>Email content and communication preferences</li>
                      <li>Usage data and analytics</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">2. How We Use Your Information</h3>
                    <ul className="list-disc list-inside text-sm text-white/90 space-y-1 ml-4">
                      <li>Provide AI-powered lead research and qualification</li>
                      <li>Generate personalized outreach emails</li>
                      <li>Track email engagement and campaign performance</li>
                      <li>Improve our services and user experience</li>
                      <li>Send important account notifications</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">3. Third-Party Services</h3>
                    <p className="text-sm text-white/90 mb-2">We use the following third-party services:</p>
                    <div className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-2">
                      <div>
                        <strong className="text-sm text-white">OpenAI:</strong>
                        <span className="text-sm text-white/90"> AI analysis and email generation</span>
                      </div>
                      <div>
                        <strong className="text-sm text-white">Apollo.io:</strong>
                        <span className="text-sm text-white/90"> Lead data enrichment</span>
                      </div>
                      <div>
                        <strong className="text-sm text-white">Mailgun:</strong>
                        <span className="text-sm text-white/90"> Email delivery service</span>
                      </div>
                      <div>
                        <strong className="text-sm text-white">Serper:</strong>
                        <span className="text-sm text-white/90"> Web search capabilities</span>
                      </div>
                      <div>
                        <strong className="text-sm text-white">AWS:</strong>
                        <span className="text-sm text-white/90"> Cloud infrastructure and data storage</span>
                      </div>
                      <div>
                        <strong className="text-sm text-white">Zilliz:</strong>
                        <span className="text-sm text-white/90"> Vector database for AI operations</span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">4. Data Storage & Security</h3>
                    <p className="text-sm text-white/90">Your data is stored securely using AWS DynamoDB and Zilliz vector databases with encryption at rest and in transit. We implement industry-standard security measures to protect your information.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">5. Your Rights</h3>
                    <ul className="list-disc list-inside text-sm text-white/90 space-y-1 ml-4">
                      <li><strong>Access:</strong> Request a copy of your data</li>
                      <li><strong>Correction:</strong> Update inaccurate information</li>
                      <li><strong>Deletion:</strong> Request account and data deletion</li>
                      <li><strong>Export:</strong> Download your data in portable format</li>
                      <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">6. CAN-SPAM Compliance</h3>
                    <p className="text-sm text-white/90">All emails sent through Meridian include unsubscribe links, accurate sender information, and comply with CAN-SPAM Act requirements. Recipients can opt-out at any time.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">7. Data Retention</h3>
                    <p className="text-sm text-white/90">We retain your data as long as your account is active. Upon account deletion, we remove all personal data within 30 days, except where required by law.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">8. Contact Us</h3>
                    <p className="text-sm text-white/90">For privacy concerns or data requests, contact us through the support section or email our privacy team.</p>
                  </section>

                  <div className="bg-white/5 border border-white/20 rounded-lg p-4 mt-6">
                    <p className="text-xs text-white/80">
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
