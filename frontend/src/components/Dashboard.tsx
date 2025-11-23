'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from '@/components/UserMenu';
import AgentManager from '@/components/agents/AgentManager';
import AgentDashboard from '@/components/agents/AgentDashboard';
import AgentDirectorDashboard from '@/components/agents/AgentDirectorDashboard';
import SettingsContent from '@/components/SettingsContent';
import CompanyProfileOnboarding from '@/components/CompanyProfileOnboarding';
import AgentOnboarding from '@/components/agents/AgentOnboarding';
import CompanyProfileCard from '@/components/CompanyProfileCard';
import CompanyProfileInstagram from '@/components/CompanyProfileInstagram';
import SettingsPresetManager from '@/components/SettingsPresetManager';
import Chat from '@/components/Chat';
import api from '@/lib/api';

const navigationItems = [
  { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
  { id: 'agents', name: 'Lead Agents', icon: UserGroupIcon },
  { id: 'director', name: 'Agent Director', icon: CommandLineIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
];

export default function Dashboard() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [hasCompanyProfile, setHasCompanyProfile] = useState<boolean | null>(null);
  const [showAgentOnboarding, setShowAgentOnboarding] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [criticalIssueCount, setCriticalIssueCount] = useState(0);
  const { user } = useAuth();

  // Fetch critical issue count
  useEffect(() => {
    const fetchCriticalCount = async () => {
      try {
        const response = await api.get('/api/notifications/count');
        if (response.data?.success) {
          const count = (response.data.bySeverity?.critical || 0) + (response.data.bySeverity?.high || 0);
          setCriticalIssueCount(count);
        }
      } catch (error) {
        console.error('Error fetching critical issues:', error);
      }
    };

    if (hasCompanyProfile) {
      fetchCriticalCount();
      // Poll every 10 seconds for updates
      const interval = setInterval(fetchCriticalCount, 10000);
      return () => clearInterval(interval);
    }
  }, [hasCompanyProfile]);

  // Check if user has completed company profile
  useEffect(() => {
    const checkCompanyProfile = async () => {
      try {
        const response = await api.get('/api/company-profile/check');
        setHasCompanyProfile(response.data.hasProfile);
      } catch (error) {
        console.error('Error checking company profile:', error);
        setHasCompanyProfile(false);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkCompanyProfile();
  }, []);

  // Load dashboard metrics when viewing dashboard
  useEffect(() => {
    if (activeView === 'dashboard' && hasCompanyProfile) {
      loadDashboardMetrics();
    }
  }, [activeView, hasCompanyProfile]);

  const loadDashboardMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const response = await api.get('/api/monitoring/overview');
      setDashboardMetrics(response.data);
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Reset to main overview when switching tabs
  useEffect(() => {
    setSelectedAgent(null);
  }, [activeView]);

  // Scroll to top when component mounts or view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView, selectedAgent]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Show full-page onboarding if no company profile */}
      {isCheckingProfile ? (
        <div className="flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-900">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400"></div>
        </div>
      ) : !hasCompanyProfile ? (
        <div className="min-h-screen">
          <CompanyProfileOnboarding onComplete={() => {
            setHasCompanyProfile(true);
            setShowAgentOnboarding(true);
          }} />
        </div>
      ) : showAgentOnboarding ? (
        <AgentOnboarding 
          onComplete={() => {
            setShowAgentOnboarding(false);
            setActiveView('agents');
          }}
          onSkip={() => {
            setShowAgentOnboarding(false);
            setActiveView('agents');
          }}
        />
      ) : (
        <>
          {/* Header - Only show after onboarding complete */}
          <header className="border-b border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md sticky top-0 z-50">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <svg width="32" height="32" viewBox="0 0 48 48">
                    <defs>
                      <linearGradient id="globeGradientHeader" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 1 }} />
                        <stop offset="50%" style={{ stopColor: 'rgb(168, 85, 247)', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: 'rgb(236, 72, 153)', stopOpacity: 1 }} />
                      </linearGradient>
                    </defs>
                    
                    {/* Globe circle */}
                    <circle cx="24" cy="24" r="20" fill="white" className="dark:fill-neutral-800"/>
                    
                    {/* Vertical meridian lines */}
                    <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradientHeader)" strokeWidth="1"/>
                    <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradientHeader)" strokeWidth="1"/>
                    <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradientHeader)" strokeWidth="1"/>
                    
                    {/* Horizontal latitude lines */}
                    <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradientHeader)" strokeWidth="1"/>
                    <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradientHeader)" strokeWidth="1"/>
                    <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradientHeader)" strokeWidth="1"/>
                  </svg>
                  <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    Meridian
                  </h1>
                </div>
                <nav className="hidden md:flex items-center gap-6">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const showBadge = item.id === 'director' && criticalIssueCount > 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-lg relative ${
                          activeView === item.id
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.name}
                        {showBadge && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {criticalIssueCount > 9 ? '9+' : criticalIssueCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <UserMenu onSettingsClick={() => setActiveView('settings')} />
            </div>
          </header>

      {/* Main Content - Only accessible after onboarding */}
      <main className="flex-1">
        {activeView === 'dashboard' && (
          <div className="p-8 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 min-h-screen">
            <div className="space-y-8">
                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Company Profile (Takes up half) */}
                  <div>
                    <CompanyProfileInstagram onEdit={() => setActiveView('settings')} />
                  </div>

                  {/* Right Column - Metrics, Quick Actions, Activity, Presets */}
                  <div className="space-y-6">
                    {/* Metrics Cards */}
                    {loadingMetrics ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
                      </div>
                    ) : dashboardMetrics ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Active Agents */}
                        <button
                          onClick={() => setActiveView('agents')}
                          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-neutral-200 hover:border-blue-300 text-left group"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <UserGroupIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <span className="text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              View Details →
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600 mb-1">Active Agents</p>
                          <p className="text-3xl font-bold text-neutral-900">
                            {dashboardMetrics.agents?.active || 0}
                          </p>
                        </button>

                        {/* Emails Sent */}
                        <button
                          onClick={() => setActiveView('director')}
                          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-neutral-200 hover:border-purple-300 text-left group"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-50 rounded-lg">
                              <EnvelopeIcon className="w-6 h-6 text-purple-600" />
                            </div>
                            <span className="text-xs font-medium text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              View Queue →
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600 mb-1">Emails Sent</p>
                          <p className="text-3xl font-bold text-neutral-900">
                            {dashboardMetrics.emails?.sent || 0}
                          </p>
                        </button>
                      </div>
                    ) : null}
                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                      <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                        Quick Actions
                      </h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => setActiveView('agents')}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all text-left"
                        >
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <UserPlusIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-900">Create Agent</p>
                            <p className="text-xs text-neutral-600">Start new lead generation</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setActiveView('director')}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all text-left"
                        >
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <ChartBarIcon className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-900">Analytics</p>
                            <p className="text-xs text-neutral-600">View performance metrics</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setActiveView('settings')}
                          data-settings-trigger
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-green-50 hover:border-green-200 border border-transparent transition-all text-left"
                        >
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Cog6ToothIcon className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-900">Settings</p>
                            <p className="text-xs text-neutral-600">Configure integrations</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Settings Presets */}
                    <SettingsPresetManager 
                      onManageClick={() => setActiveView('director')}
                    />
                  </div>
                </div>
              </div>
            </div>
        )}

        {activeView === 'agents' && (
          <div className="p-0">
            {selectedAgent ? (
              <AgentDashboard 
                agentId={selectedAgent} 
                onBack={() => setSelectedAgent(null)}
              />
            ) : (
              <AgentManager onSelectAgent={setSelectedAgent} />
            )}
          </div>
        )}

        {activeView === 'director' && (
          <div className="p-0">
            {selectedAgent ? (
              <AgentDashboard 
                agentId={selectedAgent} 
                onBack={() => setSelectedAgent(null)}
              />
            ) : (
              <AgentDirectorDashboard onSelectAgent={setSelectedAgent} />
            )}
          </div>
        )}

        {activeView === 'settings' && (
          <div className="p-6">
            <div>
              <SettingsContent />
            </div>
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
        <div className="flex items-center justify-around py-2">
          {navigationItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex flex-col items-center gap-1 p-2 text-xs ${
                  activeView === item.id
                    ? 'text-blue-600'
                    : 'text-neutral-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </button>
            );
          })}
        </div>
      </nav>
      </>
      )}
    </div>
  );
}