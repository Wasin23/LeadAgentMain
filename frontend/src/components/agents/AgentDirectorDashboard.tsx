'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import AgentPersonalitySelector, { PersonalityType } from './AgentPersonalitySelector';
import api from '../../lib/api';

interface Agent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  emailsQueued: number;
  emailsSent: number;
  meetingsScheduled: number;
  lastRun?: string;
  personality?: {
    type: string;
    name: string;
    description: string;
    avatar: string;
    emailPrompt: string;
    emailStyle: string;
    traits: string[];
    color: string;
  };
}

interface AgentDirectorDashboardProps {
  onSelectAgent: (agentId: string) => void;
}

export default function AgentDirectorDashboard({ onSelectAgent }: AgentDirectorDashboardProps) {
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/auth/agents');
      
      if (response.data.success && response.data.agents) {
        const awsAgents = await Promise.all(
          response.data.agents.map(async (agent: any) => {
            const emailStats = await fetchEmailStats(agent.agentId);
            return {
              id: agent.agentId,
              name: agent.name,
              status: agent.status === 'active' ? 'running' : 'stopped',
              emailsQueued: emailStats.emailsQueued,
              emailsSent: emailStats.emailsSent,
              meetingsScheduled: emailStats.meetingsScheduled,
              lastRun: agent.lastRun,
              personality: agent.personality
            };
          })
        );
        setAgents(awsAgents);
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailStats = async (agentId: string) => {
    try {
      const queueResponse = await api.get(`/api/email-queue/queue?agentId=${agentId}`);
      let emailsQueued = 0;
      if (queueResponse.data && Array.isArray(queueResponse.data)) {
        emailsQueued = queueResponse.data.length;
      } else if (queueResponse.data?.data?.pending && Array.isArray(queueResponse.data.data.pending)) {
        emailsQueued = queueResponse.data.data.pending.length;
      }

      const sentResponse = await api.get(`/api/email-queue/approved?agentId=${agentId}`);
      let emailsSent = 0;
      if (sentResponse.data && Array.isArray(sentResponse.data)) {
        emailsSent = sentResponse.data.length;
      }

      let meetingsScheduled = 0;
      try {
        const eventsResponse = await api.get(`/api/analytics/scheduled-events?agentId=${agentId}`);
        if (eventsResponse.data && Array.isArray(eventsResponse.data)) {
          meetingsScheduled = eventsResponse.data.length;
        }
      } catch {
        meetingsScheduled = 0;
      }

      return { emailsQueued, emailsSent, meetingsScheduled };
    } catch (error) {
      console.error(`Failed to fetch email stats for agent ${agentId}:`, error);
      return { emailsQueued: 0, emailsSent: 0, meetingsScheduled: 0 };
    }
  };

  const createAgent = async (personality: PersonalityType, customName: string) => {
    try {
      const response = await api.post('/api/auth/create-agent', {
        name: customName,
        type: 'reasoning-lead-agent',
        personality: {
          type: personality.id,
          name: personality.name,
          description: personality.description,
          avatar: personality.avatar,
          emailPrompt: personality.prompt,
          emailStyle: personality.emailStyle,
          traits: personality.traits,
          color: personality.color
        }
      });
      
      if (response.data.success) {
        console.log('✅ Agent created successfully:', response.data.agent);
        setShowPersonalitySelector(false);
        fetchAgents(); // Refresh the agents list
      } else {
        throw new Error(response.data.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert('Failed to create agent. Please try again.');
    }
  };

  const getPersonalityColors = (color?: string) => {
    switch (color) {
      case 'red': return 'border-red-200 bg-white hover:bg-neutral-50';
      case 'blue': return 'border-blue-200 bg-white hover:bg-neutral-50';
      case 'purple': return 'border-purple-200 bg-white hover:bg-neutral-50';
      case 'green': return 'border-green-200 bg-white hover:bg-neutral-50';
      case 'indigo': return 'border-indigo-200 bg-white hover:bg-neutral-50';
      case 'pink': return 'border-pink-200 bg-white hover:bg-neutral-50';
      case 'orange': return 'border-orange-200 bg-white hover:bg-neutral-50';
      case 'teal': return 'border-teal-200 bg-white hover:bg-neutral-50';
      default: return 'border-neutral-200 bg-white hover:bg-neutral-50';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 relative">
        <div className="absolute inset-0 opacity-[0.06]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#000" strokeWidth="1"/>
                <circle cx="0.5" cy="0.5" r="2.5" fill="#000"/>
                <circle cx="40.5" cy="0.5" r="2.5" fill="#000"/>
                <circle cx="0.5" cy="40.5" r="2.5" fill="#000"/>
                <circle cx="40.5" cy="40.5" r="2.5" fill="#000"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative z-10 flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 relative">
      {/* Grid Background Pattern */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#000" strokeWidth="1"/>
              <circle cx="0.5" cy="0.5" r="2.5" fill="#000"/>
              <circle cx="40.5" cy="0.5" r="2.5" fill="#000"/>
              <circle cx="0.5" cy="40.5" r="2.5" fill="#000"/>
              <circle cx="40.5" cy="40.5" r="2.5" fill="#000"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10">
        {/* Left-aligned Header with White Background */}
        <div className="bg-white border-b border-neutral-200 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">Agent Director</h1>
              <p className="text-neutral-600 text-sm mt-1">Central command for all your AI agents</p>
            </div>
            
            <button
              onClick={() => setShowPersonalitySelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              Add Agent
            </button>
          </div>
        </div>

        {/* Content Area - Agent Grid */}
        <div className="p-6">
          {agents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-neutral-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No agents yet</h3>
              <p className="text-neutral-500 text-sm mb-6">
                Get started by creating your first AI agent
              </p>
              <button
                onClick={() => setShowPersonalitySelector(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium rounded"
              >
                <PlusIcon className="w-4 h-4" />
                Create Your First Agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => onSelectAgent(agent.id)}
                  className={`border rounded-lg p-3 transition-all cursor-pointer ${getPersonalityColors(agent.personality?.color)}`}
                >
                  {/* Agent Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {agent.personality?.avatar ? (
                        <img 
                          src={agent.personality.avatar} 
                          alt={agent.personality.name || agent.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="text-xl">🤖</div>
                      )}
                      <div>
                        <h3 className="font-semibold text-sm text-neutral-900">{agent.name}</h3>
                        <p className="text-xs text-neutral-500">
                          {agent.personality?.name || 'Standard Agent'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                      agent.status === 'running' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-neutral-200 text-neutral-600'
                    }`}>
                      {agent.status === 'running' ? 'Active' : 'Stopped'}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-base font-semibold text-neutral-900">{agent.emailsQueued}</div>
                      <div className="text-xs text-neutral-600">Queued</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-semibold text-neutral-900">{agent.emailsSent}</div>
                      <div className="text-xs text-neutral-600">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-semibold text-neutral-900">{agent.meetingsScheduled}</div>
                      <div className="text-xs text-neutral-600">Meetings</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Personality Selector Modal */}
      <AgentPersonalitySelector
        isOpen={showPersonalitySelector}
        onClose={() => setShowPersonalitySelector(false)}
        onSelectPersonality={createAgent}
      />
    </div>
  );
}