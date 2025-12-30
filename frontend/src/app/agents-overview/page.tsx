'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  PlusIcon, 
  PlayIcon, 
  StopIcon, 
  TrashIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import AgentPersonalitySelector, { PersonalityType } from '@/components/agents/AgentPersonalitySelector';

interface Agent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  emailsQueued: number;
  emailsSent: number;
  meetingsScheduled: number;
  lastRun?: string;
  nextCycleTime?: string;
  currentActivity?: string;
  specialInstructions?: string;
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
  preset?: {
    presetId: string;
    name: string;
    targetIndustries?: string[];
    targetPositions?: string[];
    companySizeMin?: number;
    companySizeMax?: number;
    leadLimit?: number;
    emailLength?: string;
    callToAction?: string;
    personalizationLevel?: string;
    ccEmails?: string[];
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
    if (timeLeft === 0) return 'bg-green-500/20 text-green-300 border-green-500/40';
    if (timeLeft <= 30) return 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  };

  return (
    <div className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 transition-all duration-300 border ${getBadgeColor()}`}>
      <span className="inline-flex items-center gap-1.5">
        {timeLeft > 0 && !showStarting && (
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {timeLeft === 0 && !showStarting && (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
        )}
        {timeLeft > 0 && !showStarting && <span className="text-[10px] opacity-75 font-semibold">Next cycle:</span>}
        <span className="font-bold">{showStarting ? 'Starting...' : timeLeft === 0 ? 'Running' : formatTime(timeLeft)}</span>
      </span>
    </div>
  );
};

export default function AgentsOverview() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Instructions modal state
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [selectedAgentForInstructions, setSelectedAgentForInstructions] = useState<Agent | null>(null);
  const [instructionsText, setInstructionsText] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  
  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedAgentForSettings, setSelectedAgentForSettings] = useState<Agent | null>(null);
  
  // Presets modal state
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [presetForm, setPresetForm] = useState({
    name: '',
    targetIndustries: '',
    targetPositions: '',
    companySizeMin: '',
    companySizeMax: '',
    leadLimit: '',
    emailLength: 'medium',
    callToAction: 'book_meeting',
    personalizationLevel: 'high',
    ccEmails: ''
  });
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'agents' | 'presets'>('agents');
  
  const [currentSearches, setCurrentSearches] = useState<Record<string, {
    industry: string;
    position: string;
    source: string;
    progress: string;
    cycleOffset: number;
  }>>({});

  useEffect(() => {
    fetchAgents();
    
    // Set up SSE connection for real-time agent activity updates
    const eventSource = new EventSource('/api/monitoring/stream', {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle agent_activity events
        if (data.type === 'agent_activity' && data.agentId) {
          setAgents(prev => prev.map(agent => 
            agent.id === data.agentId
              ? { ...agent, currentActivity: data.cardMessage || data.message }
              : agent
          ));
        }
        
        // Handle search-update events
        if (data.type === 'search-update' && data.agentId && data.currentSearch) {
          setCurrentSearches(prev => ({
            ...prev,
            [data.agentId]: data.currentSearch
          }));
        }
        
        if (data.type === 'progress' && data.data?.type === 'search-update') {
          const { agentId, currentSearch } = data.data;
          if (agentId && currentSearch) {
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
      eventSource.close();
    };
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await api.get('/api/auth/agents');
      if (response.data?.success && response.data.agents) {
        // Preserve currentActivity from existing state when refreshing
        setAgents(prev => {
          const existingActivities = prev.reduce((acc, a) => {
            if (a.currentActivity) acc[a.id] = a.currentActivity;
            return acc;
          }, {} as Record<string, string>);
          
          return response.data.agents.map((agent: any) => ({
            id: agent.agentId,
            name: agent.name,
            status: agent.status || 'stopped',
            emailsQueued: 0,
            emailsSent: 0,
            meetingsScheduled: 0,
            lastRun: agent.lastRun,
            nextCycleTime: agent.nextCycleTime,
            personality: agent.personality,
            specialInstructions: agent.specialInstructions || '',
            settings: agent.settings,
            currentActivity: agent.currentActivity || existingActivities[agent.agentId] || undefined
          }));
        });
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAgent = async (agent: Agent) => {
    try {
      if (agent.status === 'running') {
        await api.post(`/api/lead-agent/stop`, { agentId: agent.id });
        setAgents(prev => prev.map(a => 
          a.id === agent.id ? { ...a, status: 'stopped', currentActivity: undefined } : a
        ));
      } else {
        await api.post(`/api/lead-agent/start`, { agentId: agent.id });
        setAgents(prev => prev.map(a => 
          a.id === agent.id ? { ...a, status: 'running' } : a
        ));
      }
    } catch (error) {
      console.error('Failed to toggle agent:', error);
      alert('Failed to update agent status. Please try again.');
    }
  };

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!agentToDelete || deleteConfirmText.toLowerCase() !== 'delete') return;

    try {
      await api.delete(`/api/lead-agent/${agentToDelete.id}`);
      setAgents(agents.filter(a => a.id !== agentToDelete.id));
      setShowDeleteModal(false);
      setAgentToDelete(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error('Failed to delete agent:', error);
      alert('Failed to delete agent. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setAgentToDelete(null);
    setDeleteConfirmText('');
  };

  const handleInstructionsClick = (agent: Agent) => {
    setSelectedAgentForInstructions(agent);
    setInstructionsText(agent.specialInstructions || '');
    setShowInstructionsModal(true);
  };

  const handleSettingsClick = (agent: Agent) => {
    setSelectedAgentForSettings(agent);
    setShowSettingsModal(true);
  };

  const handleCreatePreset = async () => {
    try {
      // Parse comma-separated strings into arrays
      const presetData = {
        name: presetForm.name,
        targetIndustries: presetForm.targetIndustries.split(',').map(s => s.trim()).filter(Boolean),
        targetPositions: presetForm.targetPositions.split(',').map(s => s.trim()).filter(Boolean),
        companySizeMin: presetForm.companySizeMin ? parseInt(presetForm.companySizeMin) : undefined,
        companySizeMax: presetForm.companySizeMax ? parseInt(presetForm.companySizeMax) : undefined,
        leadLimit: presetForm.leadLimit ? parseInt(presetForm.leadLimit) : undefined,
        emailLength: presetForm.emailLength,
        callToAction: presetForm.callToAction,
        personalizationLevel: presetForm.personalizationLevel,
        ccEmails: presetForm.ccEmails.split(',').map(s => s.trim()).filter(Boolean)
      };

      const response = await api.post('/api/settings/presets', presetData);
      if (response.data?.preset) {
        setPresets([...presets, response.data.preset]);
        setShowPresetModal(false);
        // Reset form
        setPresetForm({
          name: '',
          targetIndustries: '',
          targetPositions: '',
          companySizeMin: '',
          companySizeMax: '',
          leadLimit: '',
          emailLength: 'medium',
          callToAction: 'book_meeting',
          personalizationLevel: 'high',
          ccEmails: ''
        });
      }
    } catch (error) {
      console.error('Failed to create preset:', error);
      alert('Failed to create preset. Please try again.');
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await api.get('/api/settings/presets');
      setPresets(response.data?.presets || []);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;
    
    try {
      await api.delete(`/api/settings/presets/${presetId}`);
      setPresets(presets.filter(p => p.id !== presetId));
    } catch (error) {
      console.error('Failed to delete preset:', error);
      alert('Failed to delete preset. Please try again.');
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-400">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700" />
      
      {/* Content */}
      <div className="relative z-10 p-8">
        {/* Header with Back Button and Title */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20"
          >
            <ArrowLeftIcon className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Agent Management</h1>
            <p className="text-white/70 text-sm mt-1">Manage your agents and presets</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'agents'
                  ? 'bg-white/20 text-white border-2 border-white/40'
                  : 'bg-white/10 text-white/70 border-2 border-white/10 hover:bg-white/15 hover:text-white'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'presets'
                  ? 'bg-white/20 text-white border-2 border-white/40'
                  : 'bg-white/10 text-white/70 border-2 border-white/10 hover:bg-white/15 hover:text-white'
              }`}
            >
              Presets
            </button>
          </div>
          
          {activeTab === 'agents' && (
            <button
              onClick={() => setShowPersonalitySelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all rounded-lg border border-white/20 text-white font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              New Agent
            </button>
          )}
          
          {activeTab === 'presets' && (
            <button
              onClick={() => setShowPresetModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 backdrop-blur-sm hover:bg-cyan-500/30 transition-all rounded-lg border border-cyan-500/40 text-cyan-300 font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              New Preset
            </button>
          )}
        </div>

        {/* Agents Section */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {agents.map((agent) => {
            const targetIndustries = agent.settings?.companyCriteria?.companyIndustries || [];
            const targetPositions = agent.settings?.contactCriteria?.targetPositions || [];
            const companySizeMin = agent.settings?.companyCriteria?.companySizeMin;
            const companySizeMax = agent.settings?.companyCriteria?.companySizeMax;
            const leadLimit = agent.settings?.geographicSettings?.leadLimit;

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden hover:border-white/40 transition-all cursor-pointer"
                onClick={() => router.push(`/agents?agent=${agent.id}&returnTo=/agents-overview`)}
              >
                {/* Header with personality avatar and name */}
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    {agent.personality?.avatar ? (
                      <img 
                        src={agent.personality.avatar} 
                        alt={agent.personality.name || agent.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white/10">
                        🤖
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {agent.name}
                      </h3>
                      <p className="text-xs text-white/60 truncate">
                        {agent.personality?.name || 'AI Agent'}
                      </p>
                    </div>
                  </div>

                  {/* Status & Countdown Badge */}
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                      agent.status === 'running' 
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40' 
                        : 'bg-neutral-500/20 text-neutral-300 border border-neutral-500/40'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-neutral-400'}`} />
                      {agent.status === 'running' ? 'Running' : 'Stopped'}
                    </div>
                    {agent.status === 'running' && agent.nextCycleTime && (
                      <CountdownBadge nextCycleTime={agent.nextCycleTime} />
                    )}
                  </div>

                  {/* Current Activity */}
                  {agent.status === 'running' && agent.currentActivity && (
                    <div className="mt-3 text-xs text-white/70 bg-white/5 rounded-lg p-2 border border-white/10">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                        <span className="flex-1 leading-relaxed">{agent.currentActivity}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Targeting Info */}
                <div className="p-4 space-y-3">
                  {/* Active Preset Badge */}
                  {agent.preset && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 rounded-lg border border-cyan-500/40">
                        <span className="text-xs font-medium text-cyan-300">
                          🎯 Active Preset: {agent.preset.name || 'Custom Preset'}
                        </span>
                      </div>
                    </div>
                  )}

                  {targetIndustries.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-white/60 mb-1">Industries</div>
                      <div className="flex flex-wrap gap-1">
                        {targetIndustries.slice(0, 3).map((industry, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80 border border-white/20"
                          >
                            {industry}
                          </span>
                        ))}
                        {targetIndustries.length > 3 && (
                          <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60 border border-white/20">
                            +{targetIndustries.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {targetPositions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-white/60 mb-1">Positions</div>
                      <div className="flex flex-wrap gap-1">
                        {targetPositions.slice(0, 3).map((position, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80 border border-white/20"
                          >
                            {position}
                          </span>
                        ))}
                        {targetPositions.length > 3 && (
                          <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60 border border-white/20">
                            +{targetPositions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    {(companySizeMin || companySizeMax) && (
                      <div>
                        <div className="text-xs font-medium text-white/60 mb-1">Company Size</div>
                        <div className="text-sm text-white/90">
                          {companySizeMin && companySizeMax 
                            ? `${companySizeMin}-${companySizeMax}`
                            : companySizeMin 
                            ? `${companySizeMin}+`
                            : companySizeMax 
                            ? `<${companySizeMax}`
                            : 'Any'}
                        </div>
                      </div>
                    )}
                    {leadLimit && (
                      <div>
                        <div className="text-xs font-medium text-white/60 mb-1">Lead Limit</div>
                        <div className="text-sm text-white/90">{leadLimit}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAgent(agent);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all duration-150 flex items-center justify-center gap-2 active:scale-95 ${
                      agent.status === 'running'
                        ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 active:bg-red-500/40 border border-red-500/40'
                        : 'bg-green-500/40 text-green-200 hover:bg-green-500/50 active:bg-green-500/60 border-2 border-green-400/60'
                    }`}
                  >
                    {agent.status === 'running' ? (
                      <>
                        <StopIcon className="w-4 h-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4" />
                        Start
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstructionsClick(agent);
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg transition-all duration-150 border border-white/20 active:scale-95"
                    title="General Instructions"
                  >
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSettingsClick(agent);
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg transition-all duration-150 border border-white/20 active:scale-95"
                    title="Manage Agent"
                  >
                    <Cog6ToothIcon className="w-4 h-4 text-white" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(agent);
                    }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 rounded-lg transition-all duration-150 border border-red-500/40 active:scale-95"
                    title="Delete Agent"
                  >
                    <TrashIcon className="w-4 h-4 text-red-300" />
                  </button>
                </div>
              </motion.div>
            );
          })}
          </div>
        )}

        {/* Presets Section */}
        {activeTab === 'presets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {presets.map((preset) => (
              <motion.div
                key={preset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg mb-1">{preset.name}</h3>
                    <p className="text-xs text-white/50">
                      {agents.filter(a => a.preset?.presetId === preset.id).length} agent(s) using this preset
                    </p>
                  </div>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 transition-all"
                  >
                    <TrashIcon className="w-4 h-4 text-red-300" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  {preset.targetIndustries && preset.targetIndustries.length > 0 && (
                    <div>
                      <span className="text-white/50">Industries:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {preset.targetIndustries.slice(0, 3).map((industry: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80">
                            {industry}
                          </span>
                        ))}
                        {preset.targetIndustries.length > 3 && (
                          <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                            +{preset.targetIndustries.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {preset.targetPositions && preset.targetPositions.length > 0 && (
                    <div>
                      <span className="text-white/50">Positions:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {preset.targetPositions.slice(0, 3).map((position: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80">
                            {position}
                          </span>
                        ))}
                        {preset.targetPositions.length > 3 && (
                          <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                            +{preset.targetPositions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(preset.companySizeMin || preset.companySizeMax) && (
                    <div className="text-white/70">
                      <span className="text-white/50">Company Size: </span>
                      {preset.companySizeMin && preset.companySizeMax 
                        ? `${preset.companySizeMin} - ${preset.companySizeMax} employees`
                        : preset.companySizeMin 
                        ? `${preset.companySizeMin}+ employees`
                        : `Up to ${preset.companySizeMax} employees`}
                    </div>
                  )}

                  {preset.leadLimit && (
                    <div className="text-white/70">
                      <span className="text-white/50">Lead Limit: </span>
                      {preset.leadLimit} per cycle
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {presets.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                No presets created yet. Click "New Preset" to get started!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent Personality Selector Modal */}
      <AgentPersonalitySelector
        isOpen={showPersonalitySelector}
        onClose={() => setShowPersonalitySelector(false)}
        onSelectPersonality={async (personality, customName) => {
          try {
            const response = await api.post('/api/lead-agent', {
              personality: personality.id,
              name: customName || `${personality.name} Agent`
            });
            
            if (response.data?.agent) {
              setAgents([...agents, response.data.agent]);
            }
            setShowPersonalitySelector(false);
          } catch (error) {
            console.error('Failed to create agent:', error);
            alert('Failed to create agent. Please try again.');
          }
        }}
      />

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInstructionsModal && selectedAgentForInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            style={{ backgroundColor: 'rgba(23, 23, 23, 0.65)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">General Instructions</h2>
                    <p className="text-sm text-neutral-600 mt-1">
                      Tell {selectedAgentForInstructions.personality?.name || selectedAgentForInstructions.name} how to approach this campaign
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowInstructionsModal(false);
                      setSelectedAgentForInstructions(null);
                      setInstructionsText('');
                    }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Campaign Instructions
                    </label>
                    <textarea
                      value={instructionsText}
                      onChange={(e) => setInstructionsText(e.target.value)}
                      placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs. Keep tone professional but friendly."
                      className="w-full h-48 px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      maxLength={1000}
                    />
                    <div className="mt-2 text-xs text-neutral-500 text-right">
                      {instructionsText.length}/1000 characters
                    </div>
                  </div>

                  <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: '1px' }}>
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'rgb(37, 99, 235)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium mb-1" style={{ color: 'rgb(30, 64, 175)' }}>How this works</h4>
                        <p className="text-xs" style={{ color: 'rgb(29, 78, 216)' }}>
                          The AI will analyze your instructions and convert them into actionable goals. 
                          It will adjust its search strategy, research focus, and email messaging to match your campaign objectives.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t bg-neutral-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowInstructionsModal(false);
                    setSelectedAgentForInstructions(null);
                    setInstructionsText('');
                  }}
                  className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSavingInstructions(true);
                    try {
                      await api.put(`/api/lead-agent/instructions`, {
                        agentId: selectedAgentForInstructions.id,
                        instructions: instructionsText
                      });
                      
                      // Update local agent state
                      setAgents(prev => prev.map(a => 
                        a.id === selectedAgentForInstructions.id 
                          ? { ...a, specialInstructions: instructionsText }
                          : a
                      ));
                      
                      setShowInstructionsModal(false);
                      setSelectedAgentForInstructions(null);
                      setInstructionsText('');
                    } catch (error) {
                      console.error('Failed to save instructions:', error);
                      alert('Failed to save instructions. Please try again.');
                    } finally {
                      setSavingInstructions(false);
                    }
                  }}
                  disabled={savingInstructions}
                  style={{ backgroundColor: savingInstructions ? '#93c5fd' : '#2563eb' }}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingInstructions ? 'Saving...' : 'Save Instructions'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && agentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
                    <h3 className="text-lg font-semibold text-neutral-900">Delete Agent</h3>
                    <p className="text-sm text-neutral-600">This action cannot be undone</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-neutral-700 mb-3">
                    Are you sure you want to delete <strong>{agentToDelete.name}</strong>? 
                    All agent data, including email history and targeting settings, will be permanently removed.
                  </p>
                  <p className="text-sm text-neutral-600 mb-2">
                    Type <strong>delete</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="delete"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Agent
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && selectedAgentForSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(23, 23, 23, 0.65)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/50 bg-white/50 backdrop-blur-sm rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">Agent Settings</h2>
                    <p className="text-sm text-neutral-600 mt-1">
                      Manage settings for {selectedAgentForSettings.name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      setSelectedAgentForSettings(null);
                    }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => router.push(`/agents?agent=${selectedAgentForSettings.id}&returnTo=/agents-overview`)}
                      className="p-4 bg-white/70 hover:bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 transition-all duration-150 active:scale-95 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                          <ChartBarIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900">View Dashboard</h3>
                          <p className="text-xs text-neutral-600">See detailed metrics & activity</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowSettingsModal(false);
                        handleInstructionsClick(selectedAgentForSettings);
                      }}
                      className="p-4 bg-white/70 hover:bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 transition-all duration-150 active:scale-95 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                          <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900">General Instructions</h3>
                          <p className="text-xs text-neutral-600">Campaign-specific guidance</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Current Settings Display */}
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Current Configuration</h3>
                    
                    <div className="space-y-4">
                      {/* Industries */}
                      {selectedAgentForSettings.settings?.companyCriteria?.companyIndustries && 
                       selectedAgentForSettings.settings.companyCriteria.companyIndustries.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-600 uppercase mb-2 block">
                            Target Industries
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {selectedAgentForSettings.settings.companyCriteria.companyIndustries.map((industry, idx) => (
                              <span 
                                key={idx}
                                className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-sm font-medium"
                              >
                                {industry}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Positions */}
                      {selectedAgentForSettings.settings?.contactCriteria?.targetPositions && 
                       selectedAgentForSettings.settings.contactCriteria.targetPositions.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-600 uppercase mb-2 block">
                            Target Positions
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {selectedAgentForSettings.settings.contactCriteria.targetPositions.map((position, idx) => (
                              <span 
                                key={idx}
                                className="px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full text-sm font-medium"
                              >
                                {position}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-neutral-900">
                            {selectedAgentForSettings.settings?.companyCriteria?.companySizeMin || 0} - {selectedAgentForSettings.settings?.companyCriteria?.companySizeMax || 0}
                          </div>
                          <div className="text-xs text-neutral-600 font-medium mt-1">Company Size</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-neutral-900">
                            {selectedAgentForSettings.settings?.geographicSettings?.leadLimit || 0}
                          </div>
                          <div className="text-xs text-neutral-600 font-medium mt-1">Lead Limit</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-neutral-900">
                            {selectedAgentForSettings.status === 'running' ? '✓' : '—'}
                          </div>
                          <div className="text-xs text-neutral-600 font-medium mt-1">Active</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="rounded-xl p-4 bg-blue-500/10 border border-blue-500/30">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Need Advanced Settings?</h4>
                        <p className="text-xs text-blue-800 leading-relaxed">
                          Visit the agent's full dashboard to configure advanced targeting, email response settings, 
                          presets, and more detailed campaign parameters.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/50 bg-white/50 backdrop-blur-sm rounded-b-2xl flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedAgentForSettings(null);
                  }}
                  className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => router.push(`/agents?agent=${selectedAgentForSettings.id}&returnTo=/agents-overview`)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium"
                >
                  Open Full Dashboard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preset Creation Modal */}
      <AnimatePresence>
        {showPresetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            style={{ backgroundColor: 'rgba(23, 23, 23, 0.65)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Create Agent Preset</h2>
                  <p className="text-sm text-neutral-600 mt-1">Define a reusable configuration for your agents</p>
                </div>
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* Preset Name */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Preset Name *
                    </label>
                    <input
                      type="text"
                      value={presetForm.name}
                      onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                      placeholder="e.g., Tech Startups Outreach"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  {/* Target Industries */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Target Industries
                    </label>
                    <input
                      type="text"
                      value={presetForm.targetIndustries}
                      onChange={(e) => setPresetForm({ ...presetForm, targetIndustries: e.target.value })}
                      placeholder="e.g., Technology, SaaS, AI (comma-separated)"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  {/* Target Positions */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Target Positions
                    </label>
                    <input
                      type="text"
                      value={presetForm.targetPositions}
                      onChange={(e) => setPresetForm({ ...presetForm, targetPositions: e.target.value })}
                      placeholder="e.g., CEO, CTO, VP of Sales (comma-separated)"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  {/* Company Size Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Min Company Size
                      </label>
                      <input
                        type="number"
                        value={presetForm.companySizeMin}
                        onChange={(e) => setPresetForm({ ...presetForm, companySizeMin: e.target.value })}
                        placeholder="e.g., 10"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Max Company Size
                      </label>
                      <input
                        type="number"
                        value={presetForm.companySizeMax}
                        onChange={(e) => setPresetForm({ ...presetForm, companySizeMax: e.target.value })}
                        placeholder="e.g., 500"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Lead Limit */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Lead Limit (per cycle)
                    </label>
                    <input
                      type="number"
                      value={presetForm.leadLimit}
                      onChange={(e) => setPresetForm({ ...presetForm, leadLimit: e.target.value })}
                      placeholder="e.g., 50"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  {/* Email Length */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Email Length
                    </label>
                    <select
                      value={presetForm.emailLength}
                      onChange={(e) => setPresetForm({ ...presetForm, emailLength: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    >
                      <option value="short">Short (2-3 sentences)</option>
                      <option value="medium">Medium (4-5 sentences)</option>
                      <option value="long">Long (6+ sentences)</option>
                    </select>
                  </div>

                  {/* Call to Action */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Call to Action
                    </label>
                    <select
                      value={presetForm.callToAction}
                      onChange={(e) => setPresetForm({ ...presetForm, callToAction: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    >
                      <option value="book_meeting">Book a Meeting</option>
                      <option value="reply">Reply to Email</option>
                      <option value="schedule_call">Schedule a Call</option>
                      <option value="demo">Request a Demo</option>
                      <option value="visit_website">Visit Website</option>
                    </select>
                  </div>

                  {/* Personalization Level */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Personalization Level
                    </label>
                    <select
                      value={presetForm.personalizationLevel}
                      onChange={(e) => setPresetForm({ ...presetForm, personalizationLevel: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    >
                      <option value="low">Low (Generic)</option>
                      <option value="medium">Medium (Some personalization)</option>
                      <option value="high">High (Highly personalized)</option>
                    </select>
                  </div>

                  {/* CC Emails */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      CC Emails (Optional)
                    </label>
                    <input
                      type="text"
                      value={presetForm.ccEmails}
                      onChange={(e) => setPresetForm({ ...presetForm, ccEmails: e.target.value })}
                      placeholder="e.g., team@company.com, sales@company.com (comma-separated)"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t bg-neutral-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePreset}
                  disabled={!presetForm.name}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:opacity-90 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Preset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
