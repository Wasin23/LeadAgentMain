'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from '@/components/UserMenu';
import AgentManager from '@/components/agents/AgentManager';
import AgentDashboard from '@/components/agents/AgentDashboard';
import AgentDirectorDashboard from '@/components/agents/AgentDirectorDashboard';
import SettingsContent from '@/components/SettingsContent';
import CompanyProfileOnboarding from '@/components/CompanyProfileOnboarding';
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
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const { user } = useAuth();

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

  // Reset to main overview when switching tabs
  useEffect(() => {
    setSelectedAgent(null);
  }, [activeView]);

  // Scroll to top when component mounts or view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView, selectedAgent]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-semibold text-neutral-900">
              Meridian
            </h1>
            <nav className="hidden md:flex items-center gap-6">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                      activeView === item.id
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeView === 'dashboard' && (
          isCheckingProfile ? (
            <div className="flex items-center justify-center h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
            </div>
          ) : !hasCompanyProfile ? (
            <CompanyProfileOnboarding onComplete={() => setHasCompanyProfile(true)} />
          ) : (
            <div className="p-6 space-y-6">
              {/* Blank dashboard - ready for new content after onboarding */}
              <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
                <h2 className="text-2xl font-semibold text-neutral-900 mb-2">
                  Welcome back, {user?.username}!
                </h2>
                <p className="text-neutral-600">
                  Your company profile is all set. Start creating agents to find leads.
                </p>
              </div>
            </div>
          )
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
    </div>
  );
}