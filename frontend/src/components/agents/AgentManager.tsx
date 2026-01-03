'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon, 
  CogIcon, 
  PlayIcon, 
  StopIcon, 
  ClockIcon,
  UsersIcon,
  ChartBarIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import api from '../../lib/api';
import AgentPersonalitySelector, { PersonalityType } from './AgentPersonalitySelector';

interface Agent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  emailsQueued: number;
  emailsSent: number;
  meetingsScheduled: number;
  lastRun?: string;
  nextCycleTime?: string;
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
  settings?: {
    companyCriteria?: {
      companyIndustries?: string[];
      companySizeMin?: number;
      companySizeMax?: number;
    };
    contactCriteria?: {
      targetPositions?: string[];
    };
    geographicSettings?: {
      leadLimit?: number;
    };
  };
}

// Countdown Badge Component
const CountdownBadge = ({ nextCycleTime }: { nextCycleTime: string }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showStarting, setShowStarting] = useState(false);
  const [hasShownStarting, setHasShownStarting] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(nextCycleTime).getTime();
      const difference = target - now;
      return Math.max(0, Math.floor(difference / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      
      // When countdown reaches 0, show "Starting..." then switch to "Running" after 1.5s
      if (newTimeLeft === 0 && !hasShownStarting) {
        setShowStarting(true);
        setHasShownStarting(true);
        setTimeout(() => {
          setShowStarting(false);
        }, 1500);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nextCycleTime, hasShownStarting]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getBadgeColor = () => {
    if (timeLeft === 0) return 'bg-green-100 text-green-700';
    if (timeLeft <= 30) return 'bg-orange-100 text-orange-700 animate-pulse';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 transition-all duration-300 ${getBadgeColor()} animate-in fade-in slide-in-from-top-2 duration-500`}>
      <span className="inline-flex items-center gap-1.5">
        {timeLeft > 0 && !showStarting && (
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {timeLeft === 0 && !showStarting && (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        )}
        {timeLeft > 0 && !showStarting && <span className="text-[10px] opacity-75 font-semibold">Next cycle in:</span>}
        <span className="font-bold">{showStarting ? 'Starting...' : timeLeft === 0 ? 'Running' : formatTime(timeLeft)}</span>
      </span>
    </div>
  );
};

interface AgentManagerProps {
  onSelectAgent: (agentId: string) => void;
}

// Helper function to get color classes based on personality color
const getPersonalityColors = (color?: string) => {
  switch (color) {
    case 'red':
      return {
        card: 'border-red-200 bg-red-50/30 hover:bg-red-50/50',
        avatar: 'border-red-300',
        accent: 'bg-red-500',
        text: 'text-red-700',
        button: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
      };
    case 'blue':
      return {
        card: 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/50',
        avatar: 'border-blue-300',
        accent: 'bg-blue-500',
        text: 'text-blue-700',
        button: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
      };
    case 'purple':
      return {
        card: 'border-purple-200 bg-purple-50/30 hover:bg-purple-50/50',
        avatar: 'border-purple-300',
        accent: 'bg-purple-500',
        text: 'text-purple-700',
        button: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
      };
    case 'green':
      return {
        card: 'border-green-200 bg-green-50/30 hover:bg-green-50/50',
        avatar: 'border-green-300',
        accent: 'bg-green-500',
        text: 'text-green-700',
        button: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
      };
    case 'indigo':
      return {
        card: 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50',
        avatar: 'border-indigo-300',
        accent: 'bg-indigo-500',
        text: 'text-indigo-700',
        button: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
      };
    case 'pink':
      return {
        card: 'border-pink-200 bg-pink-50/30 hover:bg-pink-50/50',
        avatar: 'border-pink-300',
        accent: 'bg-pink-500',
        text: 'text-pink-700',
        button: 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100'
      };
    case 'orange':
      return {
        card: 'border-orange-200 bg-orange-50/30 hover:bg-orange-50/50',
        avatar: 'border-orange-300',
        accent: 'bg-orange-500',
        text: 'text-orange-700',
        button: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
      };
    case 'teal':
      return {
        card: 'border-teal-200 bg-teal-50/30 hover:bg-teal-50/50',
        avatar: 'border-teal-300',
        accent: 'bg-teal-500',
        text: 'text-teal-700',
        button: 'bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100'
      };
    default:
      return {
        card: 'border-neutral-200 bg-neutral-50/30 hover:bg-neutral-50/50',
        avatar: 'border-neutral-300',
        accent: 'bg-neutral-500',
        text: 'text-neutral-700',
        button: 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
      };
  }
};

export default function AgentManager({ onSelectAgent }: AgentManagerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [currentSearches, setCurrentSearches] = useState<Record<string, {
    industry: string;
    position: string;
    source: string;
    progress: string;
    cycleOffset: number;
  }>>({});

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchAgents();
    
    // Fetch initial current search states
    const fetchCurrentSearches = async () => {
      try {
        const response = await api.get('/api/lead-agent/current-search');
        if (response.data?.success && response.data.searches) {
          console.log('[INITIAL] Current searches:', response.data.searches);
          setCurrentSearches(response.data.searches);
        }
      } catch (error) {
        console.error('Failed to fetch current searches:', error);
      }
    };
    fetchCurrentSearches();
    
    // Set up SSE connection for real-time search updates
    const eventSource = new EventSource('/api/lead-agent/progress-stream', {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received message:', data);
        
        // Handle search-update events
        if (data.type === 'search-update' && data.agentId && data.currentSearch) {
          console.log('[SSE] Search update:', data);
          setCurrentSearches(prev => ({
            ...prev,
            [data.agentId]: data.currentSearch
          }));
        }
        
        // Handle progress events that contain search updates
        if (data.type === 'progress' && data.data?.type === 'search-update') {
          const { agentId, currentSearch } = data.data;
          if (agentId && currentSearch) {
            console.log('[SSE] Progress search update:', data.data);
            setCurrentSearches(prev => ({
              ...prev,
              [agentId]: currentSearch
            }));
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      console.log('[SSE] Closing connection');
      eventSource.close();
    };
  }, []);

  const fetchEmailStats = async (agentId: string) => {
    try {
      // Fetch queue count
      const queueResponse = await api.get(`/api/email-queue/queue?agentId=${agentId}`);
      let emailsQueued = 0;
      if (queueResponse.data && Array.isArray(queueResponse.data)) {
        emailsQueued = queueResponse.data.length;
      } else if (queueResponse.data?.data?.pending && Array.isArray(queueResponse.data.data.pending)) {
        emailsQueued = queueResponse.data.data.pending.length;
      }

      // Fetch sent emails count
      const sentResponse = await api.get(`/api/email-queue/approved?agentId=${agentId}`);
      let emailsSent = 0;
      if (sentResponse.data && Array.isArray(sentResponse.data)) {
        emailsSent = sentResponse.data.length;
      }

      // Fetch scheduled events/meetings count
      let meetingsScheduled = 0;
      try {
        const eventsResponse = await api.get(`/api/analytics/scheduled-events?agentId=${agentId}`);
        if (eventsResponse.data && Array.isArray(eventsResponse.data)) {
          meetingsScheduled = eventsResponse.data.length;
        }
      } catch (eventsError) {
        // If scheduled events endpoint not available, just use 0
        meetingsScheduled = 0;
      }

      return { emailsQueued, emailsSent, meetingsScheduled };
    } catch (error) {
      console.error(`Failed to fetch email stats for agent ${agentId}:`, error);
      return { emailsQueued: 0, emailsSent: 0, meetingsScheduled: 0 };
    }
  };

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      
      // Fetch user's agents from AWS via backend API
      const response = await api.get('/api/auth/agents');
      
      console.log('[AgentManager] Agents response:', response.data);
      
      if (response.data.success && response.data.agents) {
        // Convert AWS agents to frontend Agent format and fetch email stats + settings
        const awsAgents = await Promise.all(
          response.data.agents.map(async (agent: any) => {
            console.log(`[AgentManager] Processing agent ${agent.name}:`, {
              agentId: agent.agentId,
              nextCycleTime: agent.nextCycleTime,
              hasNextCycleTime: !!agent.nextCycleTime
            });
            
            const emailStats = await fetchEmailStats(agent.agentId);
            
            // Fetch actual agent running status
            let isRunning = false;
            try {
              const statusResponse = await api.get(`/api/lead-agent/status?agentId=${agent.agentId}`);
              isRunning = statusResponse.data.isActive || false;
              console.log(`🔄 [AGENT STATUS] ${agent.name} (${agent.agentId}): isActive=${isRunning}`);
            } catch (error) {
              console.error(`Error fetching status for agent ${agent.agentId}:`, error);
            }
            
            // Fetch agent settings to get targeting info
            let agentSettings = null;
            try {
              const settingsResponse = await api.get(`/api/lead-agent/settings?agentId=${agent.agentId}`);
              // Extract settings from response - it might be nested
              agentSettings = settingsResponse.data?.settings || settingsResponse.data;
              console.log(`[AgentManager] Settings for ${agent.agentId}:`, agentSettings);
            } catch (err) {
              console.error(`Failed to fetch settings for ${agent.agentId}:`, err);
            }
            
            return {
              id: agent.agentId,
              name: agent.name,
              status: isRunning ? 'running' : 'stopped',
              emailsQueued: emailStats.emailsQueued,
              emailsSent: emailStats.emailsSent,
              meetingsScheduled: emailStats.meetingsScheduled,
              lastRun: agent.lastRun,
              personality: agent.personality,
              settings: agentSettings,
              nextCycleTime: agent.nextCycleTime
            };
          })
        );
        
        console.log('[AgentManager] Processed agents:', awsAgents.map(a => ({
          name: a.name,
          status: a.status,
          nextCycleTime: a.nextCycleTime,
          hasNextCycleTime: !!a.nextCycleTime
        })));
        
        console.log('[AgentManager] Full first agent:', awsAgents[0]);
        
        setAgents(awsAgents);
      } else {
        // No agents found
        setAgents([]);
      }
    } catch (error) {
      console.error('Failed to fetch agents from AWS:', error);
      // Fallback to empty array - no hardcoded agents
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createAgent = async (personality: PersonalityType, customName: string, preset?: any) => {
    try {
      console.log('[AgentManager] Creating agent with:', {
        name: customName,
        personality: personality.name,
        hasPreset: !!preset,
        preset: preset ? {
          id: preset._id || preset.id,
          name: preset.name,
          targetIndustries: preset.targetIndustries,
          targetPositions: preset.targetPositions,
          companySize: preset.companySize,
          leadLimitPerDay: preset.leadLimitPerDay
        } : null
      });

      const agentData: any = {
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
      };

      // If preset is provided, include preset data
      if (preset) {
        agentData.preset = {
          presetId: preset._id || preset.id,
          name: preset.name,
          targetIndustries: preset.targetIndustries,
          targetPositions: preset.targetPositions,
          companySizeMin: preset.companySizeMin,
          companySizeMax: preset.companySizeMax,
          leadLimit: preset.leadLimit,
          emailLength: preset.emailLength,
          callToAction: preset.callToAction,
          personalizationLevel: preset.personalizationLevel,
          ccEmails: preset.ccEmails,
          bccEmails: preset.bccEmails,
          followupIntervalDays: preset.followupIntervalDays,
          enableAutoResponse: preset.enableAutoResponse,
          specialInstructions: preset.specialInstructions // Include special instructions from preset
        };
        console.log('[AgentManager] Preset data being sent:', agentData.preset);
      } else {
        console.log('[AgentManager] ⚠️ No preset provided');
      }

      // Call backend API to create agent in AWS
      const response = await api.post('/api/auth/create-agent', agentData);
      
      if (response.data.success) {
        const agentData = response.data.agent;
        
        // Create agent object for frontend
        const newAgent: Agent = {
          id: agentData.agentId,
          name: customName,
          status: 'stopped',
          emailsQueued: 0,
          emailsSent: 0,
          meetingsScheduled: 0,
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
        };
        
        // Update local state
        setAgents(prev => [...prev, newAgent]);
        setShowPersonalitySelector(false);
        
        console.log('✅ Agent created successfully:', agentData);
      } else {
        throw new Error(response.data.error || 'Failed to create agent');
      }
    } catch (error: any) {
      console.error('Failed to create agent:', error);
      
      // Check for duplicate name error
      if (error.response?.data?.error === 'Duplicate agent name') {
        alert(error.response.data.message || 'An agent with this name already exists. Please choose a different name.');
      } else {
        alert('Failed to create agent. Please try again.');
      }
    }
  };

  const toggleAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      // Toggle agent through API (works for all agents now, not just 'lead-agent-main')
      let response;
      if (agent.status === 'running') {
        console.log(`🛑 Stopping agent ${agentId}...`);
        response = await api.post('/api/lead-agent/stop', { agentId });
      } else {
        console.log(`▶️ Starting agent ${agentId}...`);
        response = await api.post('/api/lead-agent/start', { agentId });
      }
      
      // Wait a moment then fetch updated status
      setTimeout(async () => {
        try {
          const statusResponse = await api.get(`/api/lead-agent/status?agentId=${agentId}`);
          const isActive = statusResponse.data?.isActive || false;
          
          setAgents(prev => prev.map(a => 
            a.id === agentId 
              ? { ...a, status: isActive ? 'running' : 'stopped' }
              : a
          ));
        } catch (statusError) {
          console.error('Failed to fetch updated status:', statusError);
          // Fallback to optimistic update
          setAgents(prev => prev.map(a => 
            a.id === agentId 
              ? { ...a, status: a.status === 'running' ? 'stopped' : 'running' }
              : a
          ));
        }
      }, 500);
    } catch (error) {
      console.error('Failed to toggle agent:', error);
      // Show error to user
      alert('Failed to toggle agent. Please try again.');
    }
  };

  const showDeleteConfirmation = (agent: Agent) => {
    if (agent.id === 'lead-agent-main') return; // Can't delete main agent
    setAgentToDelete(agent);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;
    
    const requiredText = `DELETE ${agentToDelete.name}`;
    if (deleteConfirmText !== requiredText) return;
    
    try {
      // Call backend API to clean up agent logs and data
      try {
        await api.delete(`/api/agents/${agentToDelete.id}`);
        console.log(`✅ Cleaned up backend data for agent ${agentToDelete.id}`);
      } catch (apiError) {
        console.warn('⚠️ Failed to clean up backend data:', apiError);
        // Continue with frontend deletion even if backend cleanup fails
      }

      // Remove from localStorage
      const existingAgents = JSON.parse(localStorage.getItem('meridian-agents') || '[]');
      const updatedAgents = existingAgents.filter((a: Agent) => a.id !== agentToDelete.id);
      localStorage.setItem('meridian-agents', JSON.stringify(updatedAgents));
      
      // Update local state
      setAgents(prev => prev.filter(a => a.id !== agentToDelete.id));
      
      // Close modal
      setShowDeleteModal(false);
      setAgentToDelete(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setAgentToDelete(null);
    setDeleteConfirmText('');
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-50 border-green-200';
      case 'stopped': return 'text-neutral-600 bg-neutral-50 border-neutral-200';
      case 'paused': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Lead Agent Manager</h1>
            <p className="text-neutral-600 mt-1">Manage and monitor your lead generation agents</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPersonalitySelector(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
          >
            <PlusIcon className="h-4 w-4" />
            Add Agent
          </motion.button>
        </div>
      </div>

      {/* Agent List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {agents.map((agent, index) => {
            const colors = getPersonalityColors(agent.personality?.color);
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={`border rounded-lg transition-all cursor-pointer bg-white hover:shadow-md ${colors.card.includes('border-') ? colors.card.split(' ')[0] : 'border-neutral-200'}`}
                onClick={() => onSelectAgent(agent.id)}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-neutral-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {agent.personality?.avatar ? (
                        <img 
                          src={agent.personality.avatar} 
                          alt={agent.personality.name || agent.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-neutral-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-xl">
                          🤖
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-neutral-900 truncate">{agent.name}</h3>
                        <p className="text-xs text-neutral-500 truncate">
                          {agent.personality?.name || 'Standard Agent'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status Badge or Countdown Timer */}
                    {agent.status === 'running' && agent.nextCycleTime ? (
                      <CountdownBadge nextCycleTime={agent.nextCycleTime} />
                    ) : (
                      <div className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 transition-all duration-300 animate-in fade-in slide-in-from-top-2 duration-500 ${
                        agent.status === 'running' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        <span className="inline-flex items-center gap-1.5">
                          {agent.status === 'running' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                          )}
                          {agent.status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-neutral-50 rounded">
                      <div className="text-base font-semibold text-neutral-900">{agent.emailsQueued}</div>
                      <div className="text-xs text-neutral-600">Queued</div>
                    </div>
                    <div className="text-center p-2 bg-neutral-50 rounded">
                      <div className="text-base font-semibold text-neutral-900">{agent.emailsSent}</div>
                      <div className="text-xs text-neutral-600">Sent</div>
                    </div>
                    <div className="text-center p-2 bg-neutral-50 rounded">
                      <div className="text-base font-semibold text-neutral-900">{agent.meetingsScheduled}</div>
                      <div className="text-xs text-neutral-600">Meetings</div>
                    </div>
                  </div>

                  {/* Current Search (Real-time via SSE) - Below Meetings */}
                  {currentSearches[agent.id] && agent.status === 'running' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 p-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="relative">
                          <span className="flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Searching Now</span>
                        <span className="ml-auto text-[9px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          {currentSearches[agent.id].source === 'ai' ? '🤖 AI' : '📋 Base'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                        <div>
                          <div className="text-[9px] font-medium text-emerald-600 mb-0.5 uppercase">Industry</div>
                          <div className="text-xs font-semibold text-emerald-900 truncate">
                            {currentSearches[agent.id].industry}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-medium text-emerald-600 mb-0.5 uppercase">Position</div>
                          <div className="text-xs font-semibold text-emerald-900 truncate">
                            {currentSearches[agent.id].position}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 bg-emerald-100 rounded-full h-1 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${(parseInt(currentSearches[agent.id].progress.split('/')[0]) / 20) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-700">
                          {currentSearches[agent.id].progress}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Agent Targeting Info */}
                <div className="p-4 space-y-3">
                  {/* Target Industries */}
                  <div>
                    <div className="text-xs font-medium text-neutral-600 mb-1.5 uppercase tracking-wide">Target Industries</div>
                    <div className="flex flex-wrap gap-1">
                      {agent.settings?.companyCriteria?.companyIndustries && agent.settings.companyCriteria.companyIndustries.length > 0 ? (
                        agent.settings.companyCriteria.companyIndustries.slice(0, 3).map((industry, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {industry}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-400 italic">Not configured</span>
                      )}
                      {agent.settings?.companyCriteria?.companyIndustries && agent.settings.companyCriteria.companyIndustries.length > 3 && (
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded-full">
                          +{agent.settings.companyCriteria.companyIndustries.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Target Positions */}
                  <div>
                    <div className="text-xs font-medium text-neutral-600 mb-1.5 uppercase tracking-wide">Target Positions</div>
                    <div className="flex flex-wrap gap-1">
                      {agent.settings?.contactCriteria?.targetPositions && agent.settings.contactCriteria.targetPositions.length > 0 ? (
                        agent.settings.contactCriteria.targetPositions.slice(0, 3).map((position, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                            {position}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-400 italic">Not configured</span>
                      )}
                      {agent.settings?.contactCriteria?.targetPositions && agent.settings.contactCriteria.targetPositions.length > 3 && (
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded-full">
                          +{agent.settings.contactCriteria.targetPositions.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Company Size & Lead Limit */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs font-medium text-neutral-600 mb-1 uppercase tracking-wide">Company Size</div>
                      <div className="text-sm text-neutral-900 font-medium">
                        {agent.settings?.companyCriteria?.companySizeMin && agent.settings?.companyCriteria?.companySizeMax
                          ? `${agent.settings.companyCriteria.companySizeMin}-${agent.settings.companyCriteria.companySizeMax}`
                          : <span className="text-neutral-400 italic text-xs">Not set</span>
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-neutral-600 mb-1 uppercase tracking-wide">Lead Limit</div>
                      <div className="text-sm text-neutral-900 font-medium">
                        {agent.settings?.geographicSettings?.leadLimit
                          ? `${agent.settings.geographicSettings.leadLimit} per cycle`
                          : <span className="text-neutral-400 italic text-xs">Not set</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-3 border-t border-neutral-200 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAgent(agent.id);
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                      agent.status === 'running' 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                        : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    {agent.status === 'running' ? (
                      <div className="flex items-center justify-center gap-1">
                        <StopIcon className="h-4 w-4" />
                        Stop
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <PlayIcon className="h-4 w-4" />
                        Start
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAgent(agent.id);
                    }}
                    className="flex-1 px-3 py-2 text-sm font-medium rounded transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <CogIcon className="h-4 w-4" />
                      Manage
                    </div>
                  </button>
                  {agent.id !== 'lead-agent-main' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showDeleteConfirmation(agent);
                      }}
                      className="px-3 py-2 text-sm font-medium rounded transition-colors bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Agent Personality Selector */}
      <AgentPersonalitySelector 
        isOpen={showPersonalitySelector}
        onClose={() => setShowPersonalitySelector(false)}
        onSelectPersonality={createAgent}
      />

      {/* Delete Agent Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && agentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                    <TrashIcon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-900">Delete Agent</h3>
                    <p className="text-sm text-neutral-500">This action cannot be undone</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-neutral-700">
                    You are about to permanently delete the agent <strong>"{agentToDelete.name}"</strong>. 
                    This will remove all associated data and cannot be undone.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Type <span className="font-bold text-red-600">DELETE {agentToDelete.name}</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder={`DELETE ${agentToDelete.name}`}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-neutral-200 mt-6">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors border border-neutral-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteAgent}
                    disabled={deleteConfirmText !== `DELETE ${agentToDelete.name}`}
                    className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: deleteConfirmText === `DELETE ${agentToDelete.name}` ? '#dc2626 !important' : '#a3a3a3 !important',
                      color: '#ffffff !important',
                      fontWeight: '600 !important'
                    }}
                  >
                    Delete Agent
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}