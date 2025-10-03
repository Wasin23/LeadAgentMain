'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  UserGroupIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import Chat from '@/components/Chat';
import StatsGrid from '@/components/StatsGrid';
import UserMenu from '@/components/UserMenu';
import AgentManager from '@/components/agents/AgentManager';
import AgentDashboard from '@/components/agents/AgentDashboard';

const navigationItems = [
  { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
  { id: 'agents', name: 'Lead Agents', icon: UserGroupIcon },
  { id: 'research', name: 'Lead Research', icon: MagnifyingGlassIcon },
  { id: 'emails', name: 'Email Campaigns', icon: EnvelopeIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
];

export default function Dashboard() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { user } = useAuth();

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
            <motion.h1 
              className="text-xl font-semibold text-neutral-900"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              ExaMark
            </motion.h1>
            
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
          <div className="p-6 space-y-6">
            {/* Welcome Section */}
            <motion.div 
              className="bg-white border border-neutral-200 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">
                Welcome back, {user?.username}!
              </h2>
              <p className="text-neutral-600">
                Your AI-powered lead research and automation platform is ready to help you grow your business.
              </p>
            </motion.div>

            {/* Chat Interface */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Chat />
              </div>
              <div className="space-y-6">
                <StatsGrid />
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

        {activeView === 'research' && (
          <div className="p-6">
            <motion.div 
              className="bg-white border border-neutral-200 p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <MagnifyingGlassIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">Lead Research</h3>
              <p className="text-neutral-600">Advanced lead research tools coming soon...</p>
            </motion.div>
          </div>
        )}



        {activeView === 'emails' && (
          <div className="p-6">
            <motion.div 
              className="bg-white border border-neutral-200 p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EnvelopeIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">Email Campaigns</h3>
              <p className="text-neutral-600">Email automation tools coming soon...</p>
            </motion.div>
          </div>
        )}

        {activeView === 'settings' && (
          <div className="p-6">
            <motion.div 
              className="bg-white border border-neutral-200 p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Cog6ToothIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">Settings</h3>
              <p className="text-neutral-600">Configuration options coming soon...</p>
            </motion.div>
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