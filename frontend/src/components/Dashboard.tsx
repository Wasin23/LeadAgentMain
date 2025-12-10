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
import CalendarSetup from '@/components/CalendarSetup';
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
  const [activeView, setActiveView] = useState('director');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [hasCompanyProfile, setHasCompanyProfile] = useState<boolean | null>(null);
  const [hasCalendarSetup, setHasCalendarSetup] = useState<boolean | null>(null);
  const [showAgentOnboarding, setShowAgentOnboarding] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [criticalIssueCount, setCriticalIssueCount] = useState(0);
  const [showStartHere, setShowStartHere] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
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
        setHasSeenOnboarding(response.data.hasCompletedOnboarding || false);
        
        // Show "Start Here" indicator only if profile exists and user just completed onboarding
        if (response.data.hasProfile && !response.data.hasCompletedOnboarding) {
          setShowStartHere(true);
          // Auto-hide after 8 seconds
          setTimeout(() => setShowStartHere(false), 8000);
        }
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
            setHasCalendarSetup(false); // Show calendar setup next
          }} />
        </div>
      ) : hasCalendarSetup === false ? (
        <div className="min-h-screen">
          <CalendarSetup onComplete={() => {
            setHasCalendarSetup(true);
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
              </div>

              <UserMenu onSettingsClick={() => setActiveView('settings')} />
            </div>
          </header>

      {/* Main Content - Only accessible after onboarding */}
      <main className="flex-1">
        <div className="p-0">
          {selectedAgent ? (
            <AgentDashboard 
              agentId={selectedAgent} 
              onBack={() => setSelectedAgent(null)}
            />
          ) : (
            <AgentDirectorDashboard 
              onSelectAgent={setSelectedAgent}
            />
          )}
        </div>
      </main>
      </>
      )}
    </div>
  );
}