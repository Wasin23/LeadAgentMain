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
  ChartBarIcon,
  FunnelIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import AgentPersonalitySelector from '@/components/agents/AgentPersonalitySelector';
import AgentOnboarding from '@/components/agents/AgentOnboarding';

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
  const [showOnboarding, setShowOnboarding] = useState(false);
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
    targetIndustries: [] as string[],
    targetPositions: [] as string[],
    companySizeMin: 50,
    companySizeMax: 500,
    leadLimit: 10,
    specialInstructions: '',
    emailLength: 'medium' as 'short' | 'medium' | 'long',
    callToAction: 'schedule-meeting',
    personalizationLevel: 'high' as 'low' | 'medium' | 'high',
    ccEmails: '',
    bccEmails: '',
    followupIntervalDays: 7,
    enableAutoResponse: true,
    useCustomSignature: false
  });
  const [industryInput, setIndustryInput] = useState('');
  const [positionInput, setPositionInput] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);

  // Common industries and positions for suggestions
  const commonIndustries = [
    'Technology', 'Healthcare', 'Finance', 'E-commerce', 'SaaS',
    'Manufacturing', 'Retail', 'Education', 'Real Estate', 'Marketing',
    'Consulting', 'Media', 'Telecommunications', 'Energy', 'Insurance'
  ];

  const commonPositions = [
    'CEO', 'CTO', 'CFO', 'CMO', 'COO',
    'VP of Sales', 'VP of Marketing', 'VP of Engineering',
    'Director of Sales', 'Director of Marketing', 'Director of Engineering',
    'Sales Manager', 'Product Manager', 'Engineering Manager',
    'Founder', 'Co-Founder', 'Partner', 'Owner'
  ];
  
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const token = localStorage.getItem('authToken');
    const eventSource = new EventSource(`${apiUrl}/api/monitoring/stream?token=${token}`);

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

  // Refetch agents when page becomes visible (when user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Agents page became visible, refetching agents...');
        fetchAgents();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const addIndustry = (industry: string) => {
    if (industry.trim() && !presetForm.targetIndustries.includes(industry)) {
      setPresetForm({
        ...presetForm,
        targetIndustries: [...presetForm.targetIndustries, industry.trim()]
      });
      setIndustryInput('');
      setShowIndustryDropdown(false);
    }
  };

  const removeIndustry = (industry: string) => {
    setPresetForm({
      ...presetForm,
      targetIndustries: presetForm.targetIndustries.filter(i => i !== industry)
    });
  };

  const addPosition = (position: string) => {
    if (position.trim() && !presetForm.targetPositions.includes(position)) {
      setPresetForm({
        ...presetForm,
        targetPositions: [...presetForm.targetPositions, position.trim()]
      });
      setPositionInput('');
      setShowPositionDropdown(false);
    }
  };

  const removePosition = (position: string) => {
    setPresetForm({
      ...presetForm,
      targetPositions: presetForm.targetPositions.filter(p => p !== position)
    });
  };

  const handleIndustryKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && industryInput.trim()) {
      e.preventDefault();
      addIndustry(industryInput);
    }
  };

  const handlePositionKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && positionInput.trim()) {
      e.preventDefault();
      addPosition(positionInput);
    }
  };

  const filteredIndustries = industryInput
    ? commonIndustries.filter(ind => 
        ind.toLowerCase().includes(industryInput.toLowerCase()) &&
        !presetForm.targetIndustries.includes(ind)
      )
    : commonIndustries.filter(ind => !presetForm.targetIndustries.includes(ind));

  const filteredPositions = positionInput
    ? commonPositions.filter(pos => 
        pos.toLowerCase().includes(positionInput.toLowerCase()) &&
        !presetForm.targetPositions.includes(pos)
      )
    : commonPositions.filter(pos => !presetForm.targetPositions.includes(pos));

  const handleCreatePreset = async () => {
    try {
      const presetData = {
        name: presetForm.name,
        targetIndustries: presetForm.targetIndustries,
        targetPositions: presetForm.targetPositions,
        companySizeMin: presetForm.companySizeMin,
        companySizeMax: presetForm.companySizeMax,
        leadLimit: presetForm.leadLimit,
        specialInstructions: presetForm.specialInstructions || '',
        emailLength: presetForm.emailLength,
        callToAction: presetForm.callToAction,
        personalizationLevel: presetForm.personalizationLevel,
        ccEmails: presetForm.ccEmails,
        bccEmails: presetForm.bccEmails,
        followupIntervalDays: presetForm.followupIntervalDays,
        enableAutoResponse: presetForm.enableAutoResponse,
        useCustomSignature: presetForm.useCustomSignature
      };

      const response = await api.post('/api/settings/presets', presetData);
      if (response.data?.preset) {
        setPresets([...presets, response.data.preset]);
        setShowPresetModal(false);
        // Reset form
        setPresetForm({
          name: '',
          targetIndustries: [],
          targetPositions: [],
          companySizeMin: 50,
          companySizeMax: 500,
          leadLimit: 10,
          specialInstructions: '',
          emailLength: 'medium',
          callToAction: 'schedule-meeting',
          personalizationLevel: 'high',
          ccEmails: '',
          bccEmails: '',
          followupIntervalDays: 7,
          enableAutoResponse: true,
          useCustomSignature: false
        });
        setIndustryInput('');
        setPositionInput('');
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
      <AppLayout>
        <div className="h-full relative">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto mb-3">
                <div className="absolute inset-0 border-3 border-[#4FD1FF]/20 rounded-full"></div>
                <div className="absolute inset-0 border-3 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-sm text-[#A3B4CC]">Loading agents...</div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full relative overflow-hidden">
        {/* Content */}
        <div className="relative z-10 p-4">
          {/* Header with Back Button and Title */}
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg bg-[#1B2F52]/90 backdrop-blur-sm hover:bg-[#2A4472] transition-all border border-[#4FD1FF]/30"
            >
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Agent Management</h1>
              <p className="text-[#A3B4CC] text-sm mt-1">Manage your agents and presets</p>
            </div>
          </div>

        {/* Tabs */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'agents'
                  ? 'bg-[#2A4472] text-white border-2 border-[#4FD1FF]/60 shadow-lg shadow-[#4FD1FF]/20'
                  : 'bg-[#1B2F52]/70 text-[#A3B4CC] border-2 border-[#4FD1FF]/20 hover:bg-[#1B2F52] hover:text-white hover:border-[#4FD1FF]/40'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'presets'
                  ? 'bg-[#2A4472] text-white border-2 border-[#4FD1FF]/60 shadow-lg shadow-[#4FD1FF]/20'
                  : 'bg-[#1B2F52]/70 text-[#A3B4CC] border-2 border-[#4FD1FF]/20 hover:bg-[#1B2F52] hover:text-white hover:border-[#4FD1FF]/40'
              }`}
            >
              Presets
            </button>
          </div>
          
          {activeTab === 'agents' && (
            <button
              onClick={() => setShowPersonalitySelector(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1B2F52]/90 backdrop-blur-sm hover:bg-[#2A4472] transition-all rounded-lg border border-[#4FD1FF]/30 text-white font-medium text-sm sm:text-base shadow-lg shadow-[#4FD1FF]/10"
            >
              <PlusIcon className="w-5 h-5" />
              New Agent
            </button>
          )}
          
          {activeTab === 'presets' && (
            <button
              onClick={() => setShowPresetModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/20 backdrop-blur-sm hover:bg-cyan-500/30 transition-all rounded-lg border border-cyan-500/40 text-cyan-300 font-medium text-sm sm:text-base"
            >
              <PlusIcon className="w-5 h-5" />
              New Preset
            </button>
          )}
        </div>

        {/* Agents Section */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
                whileTap={{ scale: 0.98 }}
                className="bg-[#1B2F52]/60 backdrop-blur-md rounded-2xl border border-[#4FD1FF]/20 overflow-hidden hover:border-[#4FD1FF]/50 hover:shadow-lg hover:shadow-[#4FD1FF]/10 active:shadow-[#4FD1FF]/30 transition-all cursor-pointer"
                onClick={() => {
                  router.push(`/agents?agent=${agent.id}&returnTo=/agents-overview`);
                }}
              >
                {/* Header with personality avatar and name */}
                <div className="p-4 border-b border-[#4FD1FF]/10">
                  <div className="flex items-center gap-3 mb-3">
                    {agent.personality?.avatar ? (
                      <img 
                        src={agent.personality.avatar} 
                        alt={agent.personality.name || agent.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-[#2A4472]">
                        🤖
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {agent.name}
                      </h3>
                      <p className="text-xs text-[#A3B4CC] truncate">
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
                        <FunnelIcon className="h-3.5 w-3.5 text-cyan-300" />
                        <span className="text-xs font-medium text-cyan-300">
                          Active Preset: {agent.preset.name || 'Custom Preset'}
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

                  {/* Email Settings Summary */}
                  {(preset.emailLength || preset.callToAction || preset.personalizationLevel) && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <span className="text-xs text-white/40 uppercase tracking-wide">Email Settings</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {preset.emailLength && (
                          <span className="px-2 py-0.5 bg-cyan-500/20 rounded text-xs text-cyan-300">
                            {preset.emailLength}
                          </span>
                        )}
                        {preset.personalizationLevel && (
                          <span className="px-2 py-0.5 bg-purple-500/20 rounded text-xs text-purple-300">
                            {preset.personalizationLevel}
                          </span>
                        )}
                        {preset.enableAutoResponse && (
                          <span className="px-2 py-0.5 bg-green-500/20 rounded text-xs text-green-300">
                            auto-reply
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Special Instructions Indicator */}
                  {preset.specialInstructions && (
                    <div className="mt-2 text-xs text-white/50 line-clamp-2">
                      "{preset.specialInstructions}"
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
        onSelectPersonality={() => {
          setShowPersonalitySelector(false);
          fetchAgents(); // Reload agents after creation
        }}
      />

      {/* Agent Onboarding Modal (for full onboarding flow if needed) */}
      {showOnboarding && (
        <AgentOnboarding
          onSkip={() => setShowOnboarding(false)}
          onComplete={() => {
            setShowOnboarding(false);
            fetchAgents(); // Reload agents after creation
          }}
        />
      )}

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInstructionsModal && selectedAgentForInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            style={{ backgroundColor: 'rgba(15, 30, 53, 0.8)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-[#1B2F52]/95 backdrop-blur-md border border-[#4FD1FF]/30 rounded-lg shadow-xl shadow-[#4FD1FF]/10 max-w-2xl w-full max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#4FD1FF]/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">General Instructions</h2>
                    <p className="text-sm text-[#A3B4CC] mt-1">
                      Tell {selectedAgentForInstructions.personality?.name || selectedAgentForInstructions.name} how to approach this campaign
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowInstructionsModal(false);
                      setSelectedAgentForInstructions(null);
                      setInstructionsText('');
                    }}
                    className="text-[#A3B4CC] hover:text-white transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Campaign Instructions
                    </label>
                    <textarea
                      value={instructionsText}
                      onChange={(e) => setInstructionsText(e.target.value)}
                      placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs. Keep tone professional but friendly."
                      className="w-full h-48 px-4 py-3 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF] resize-none"
                      maxLength={1000}
                    />
                    <div className="mt-2 text-xs text-[#8FA6C1] text-right">
                      {instructionsText.length}/1000 characters
                    </div>
                  </div>

                  <div className="rounded-lg p-4 bg-[#4FD1FF]/10 border border-[#4FD1FF]/30">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#4FD1FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-[#4FD1FF]">How this works</h4>
                        <p className="text-xs text-[#A3B4CC]">
                          The AI will analyze your instructions and convert them into actionable goals. 
                          It will adjust its search strategy, research focus, and email messaging to match your campaign objectives.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4FD1FF]/20 bg-[#12213B]/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowInstructionsModal(false);
                    setSelectedAgentForInstructions(null);
                    setInstructionsText('');
                  }}
                  className="px-4 py-2 text-[#A3B4CC] hover:text-white hover:bg-[#2A4472] rounded-lg transition-colors font-medium"
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
                  className="px-4 py-2 text-[#0F1E35] bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] rounded-lg hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1B2F52]/95 backdrop-blur-md border border-[#4FD1FF]/30 rounded-2xl shadow-2xl shadow-[#4FD1FF]/10 w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center">
                    <TrashIcon className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Delete Agent</h3>
                    <p className="text-sm text-[#A3B4CC]">This action cannot be undone</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-[#A3B4CC] mb-3">
                    Are you sure you want to delete <strong className="text-white">{agentToDelete.name}</strong>? 
                    All agent data, including email history and targeting settings, will be permanently removed.
                  </p>
                  <p className="text-sm text-[#8FA6C1] mb-2">
                    Type <strong>delete</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="delete"
                    className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-[#2A4472] hover:bg-[#223A63] text-[#A3B4CC] hover:text-white rounded-lg font-medium transition-colors"
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
            style={{ backgroundColor: 'rgba(15, 30, 53, 0.8)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-[#1B2F52]/95 backdrop-blur-md border border-[#4FD1FF]/30 rounded-2xl shadow-2xl shadow-[#4FD1FF]/10 max-w-4xl w-full max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#4FD1FF]/20 bg-[#12213B]/50 backdrop-blur-sm rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Agent Settings</h2>
                    <p className="text-sm text-[#A3B4CC] mt-1">
                      Manage settings for {selectedAgentForSettings.name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      setSelectedAgentForSettings(null);
                    }}
                    className="text-[#A3B4CC] hover:text-white transition-colors"
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
                      onClick={() => setShowSettingsModal(false)}
                      className="p-4 bg-[#2A4472]/70 hover:bg-[#2A4472] backdrop-blur-sm border border-[#4FD1FF]/30 rounded-xl transition-all duration-150 active:scale-95 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#4FD1FF] to-[#55C7F7] rounded-lg shadow-lg shadow-[#4FD1FF]/20">
                          <ChartBarIcon className="w-5 h-5 text-[#0F1E35]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">View Dashboard</h3>
                          <p className="text-xs text-[#A3B4CC]">See detailed metrics & activity</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowSettingsModal(false);
                        handleInstructionsClick(selectedAgentForSettings);
                      }}
                      className="p-4 bg-[#2A4472]/70 hover:bg-[#2A4472] backdrop-blur-sm border border-[#4FD1FF]/30 rounded-xl transition-all duration-150 active:scale-95 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#4FD1FF] to-[#6BE3FF] rounded-lg shadow-lg shadow-[#4FD1FF]/20">
                          <ChatBubbleLeftRightIcon className="w-5 h-5 text-[#0F1E35]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">General Instructions</h3>
                          <p className="text-xs text-[#A3B4CC]">Campaign-specific guidance</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Current Settings Display */}
                  <div className="bg-[#12213B]/70 backdrop-blur-sm border border-[#4FD1FF]/20 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Current Configuration</h3>
                    
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
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium"
                >
                  Done
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPresetModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1B2F52]/95 backdrop-blur-lg rounded-xl shadow-2xl w-full max-w-4xl z-10 overflow-hidden max-h-[90vh] flex flex-col border border-[#4FD1FF]/30"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-semibold text-white">Create New Preset</h3>
                  <p className="text-[#A3B4CC] text-sm mt-1">Configure your ideal customer profile template</p>
                </div>
                <button 
                  onClick={() => setShowPresetModal(false)} 
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Preset Name */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Preset Name *
                  </label>
                  <input
                    type="text"
                    value={presetForm.name}
                    onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                    placeholder="e.g., Tech Startups, Enterprise Sales"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white placeholder:text-white/40"
                  />
                </div>

                {/* General Instructions */}
                <div className="bg-[#4FD1FF]/10 rounded-lg p-4 border border-[#4FD1FF]/30">
                  <label className="block text-sm font-semibold text-white mb-2">
                    General Instructions
                  </label>
                  <p className="text-xs text-[#A3B4CC] mb-3">
                    Give your agent specific campaign instructions. The AI will dynamically determine what actions to take based on these instructions.
                  </p>
                  <textarea
                    value={presetForm.specialInstructions}
                    onChange={(e) => setPresetForm({ ...presetForm, specialInstructions: e.target.value })}
                    placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams..."
                    rows={4}
                    maxLength={1000}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] resize-none text-white placeholder:text-white/40"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#A3B4CC]">💡 These instructions guide the entire campaign behavior</span>
                    <span className="text-xs text-[#A3B4CC]">{presetForm.specialInstructions.length}/1000</span>
                  </div>
                </div>

                {/* Company Size */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Company Size (Employees)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={presetForm.companySizeMin}
                      onChange={(e) => setPresetForm({ ...presetForm, companySizeMin: parseInt(e.target.value) || 0 })}
                      className="w-32 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white placeholder:text-white/40"
                      placeholder="Min"
                    />
                    <span className="text-white/70 font-medium">to</span>
                    <input
                      type="number"
                      value={presetForm.companySizeMax}
                      onChange={(e) => setPresetForm({ ...presetForm, companySizeMax: parseInt(e.target.value) || 0 })}
                      className="w-32 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white placeholder:text-white/40"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Target Industries */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Target Industries
                  </label>
                  
                  {/* Selected Industries - Purple Bubbles */}
                  {presetForm.targetIndustries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {presetForm.targetIndustries.map((industry) => (
                        <span
                          key={industry}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white rounded-full text-sm font-medium"
                        >
                          {industry}
                          <button
                            onClick={() => removeIndustry(industry)}
                            className="hover:bg-white/20 rounded-full p-0.5"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={industryInput}
                      onChange={(e) => setIndustryInput(e.target.value)}
                      onFocus={() => setShowIndustryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
                      onKeyPress={handleIndustryKeyPress}
                      placeholder="Search industries... (e.g., Technology, Healthcare, Finance...)"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white placeholder:text-white/40"
                    />
                    
                    {/* Suggestions Dropdown */}
                    {showIndustryDropdown && filteredIndustries.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[#1B2F52] border border-white/20 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredIndustries.map((industry) => (
                          <button
                            key={industry}
                            onClick={() => addIndustry(industry)}
                            className="w-full text-left px-4 py-2 hover:bg-purple-500/30 transition-colors text-sm text-white"
                          >
                            {industry}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Add Buttons */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {commonIndustries.map(industry => (
                      <button
                        key={industry}
                        onClick={() => addIndustry(industry)}
                        disabled={presetForm.targetIndustries.includes(industry)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          presetForm.targetIndustries.includes(industry)
                            ? 'bg-purple-500/30 text-purple-300 cursor-default'
                            : 'bg-white/10 hover:bg-purple-500/30 text-white/70 hover:text-white border border-white/20'
                        }`}
                      >
                        {presetForm.targetIndustries.includes(industry) ? '✓ ' : '+ '}{industry}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Positions */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Target Positions
                  </label>
                  
                  {/* Selected Positions - Blue Bubbles */}
                  {presetForm.targetPositions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {presetForm.targetPositions.map((position) => (
                        <span
                          key={position}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-full text-sm font-medium"
                        >
                          {position}
                          <button
                            onClick={() => removePosition(position)}
                            className="hover:bg-white/20 rounded-full p-0.5"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={positionInput}
                      onChange={(e) => setPositionInput(e.target.value)}
                      onFocus={() => setShowPositionDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPositionDropdown(false), 200)}
                      onKeyPress={handlePositionKeyPress}
                      placeholder="Search positions... (e.g., CEO, VP of Sales, Director...)"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/40"
                    />
                    
                    {/* Suggestions Dropdown */}
                    {showPositionDropdown && filteredPositions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[#1B2F52] border border-white/20 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredPositions.map((position) => (
                          <button
                            key={position}
                            onClick={() => addPosition(position)}
                            className="w-full text-left px-4 py-2 hover:bg-blue-500/30 transition-colors text-sm text-white"
                          >
                            {position}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Add Buttons */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {commonPositions.map(position => (
                      <button
                        key={position}
                        onClick={() => addPosition(position)}
                        disabled={presetForm.targetPositions.includes(position)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          presetForm.targetPositions.includes(position)
                            ? 'bg-blue-500/30 text-blue-300 cursor-default'
                            : 'bg-white/10 hover:bg-blue-500/30 text-white/70 hover:text-white border border-white/20'
                        }`}
                      >
                        {presetForm.targetPositions.includes(position) ? '✓ ' : '+ '}{position}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leads Per Cycle */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Leads Per Cycle</label>
                  <p className="text-xs text-[#A3B4CC] mb-3">
                    A cycle runs on your set schedule. Your agent will find and research this many new leads each time.
                  </p>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={presetForm.leadLimit}
                      onChange={(e) => setPresetForm({ ...presetForm, leadLimit: parseInt(e.target.value) || 1 })}
                      className="w-32 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-center font-semibold text-white"
                    />
                    <span className="text-white/70">leads per cycle</span>
                  </div>
                  <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Estimated Cost:</span>
                      <span className="text-green-400 font-bold text-lg">
                        ${(presetForm.leadLimit * 0.18).toFixed(2)} per cycle
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-1">
                      ~$0.18 per lead • {presetForm.leadLimit} leads = ${(presetForm.leadLimit * 0.18).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Email Response Settings */}
                <div className="border-t border-white/10 pt-6">
                  <h4 className="text-lg font-semibold text-white mb-2">Email Response Settings</h4>
                  <p className="text-sm text-[#A3B4CC] mb-4">
                    Configure how your agent communicates with leads
                  </p>

                  {/* Email Length, Call to Action, Personalization Level */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Email Length</label>
                      <select
                        value={presetForm.emailLength}
                        onChange={(e) => setPresetForm({ ...presetForm, emailLength: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white"
                      >
                        <option value="short" className="bg-[#1B2F52] text-white">Short (concise)</option>
                        <option value="medium" className="bg-[#1B2F52] text-white">Medium (balanced)</option>
                        <option value="long" className="bg-[#1B2F52] text-white">Long (detailed)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Call to Action</label>
                      <select
                        value={presetForm.callToAction}
                        onChange={(e) => setPresetForm({ ...presetForm, callToAction: e.target.value })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white"
                      >
                        <option value="schedule-meeting" className="bg-[#1B2F52] text-white">Schedule Meeting</option>
                        <option value="request-demo" className="bg-[#1B2F52] text-white">Request Demo</option>
                        <option value="learn-more" className="bg-[#1B2F52] text-white">Learn More</option>
                        <option value="custom" className="bg-[#1B2F52] text-white">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Personalization Level</label>
                      <select
                        value={presetForm.personalizationLevel}
                        onChange={(e) => setPresetForm({ ...presetForm, personalizationLevel: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white"
                      >
                        <option value="low" className="bg-[#1B2F52] text-white">Low (generic)</option>
                        <option value="medium" className="bg-[#1B2F52] text-white">Medium (personalized)</option>
                        <option value="high" className="bg-[#1B2F52] text-white">High (hyper-personalized)</option>
                      </select>
                    </div>
                  </div>

                  {/* CC and BCC Emails */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">CC Email Addresses</label>
                      <input
                        type="text"
                        value={presetForm.ccEmails}
                        onChange={(e) => setPresetForm({ ...presetForm, ccEmails: e.target.value })}
                        placeholder="email1@example.com, email2@example.com"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white placeholder:text-white/40"
                      />
                      <p className="text-xs text-[#A3B4CC] mt-1">Comma-separated email addresses</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">BCC Email Addresses</label>
                      <input
                        type="text"
                        value={presetForm.bccEmails}
                        onChange={(e) => setPresetForm({ ...presetForm, bccEmails: e.target.value })}
                        placeholder="email1@example.com, email2@example.com"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white placeholder:text-white/40"
                      />
                      <p className="text-xs text-[#A3B4CC] mt-1">Hidden from recipients</p>
                    </div>
                  </div>

                  {/* Follow-up Interval */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2">Follow-up Interval (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={presetForm.followupIntervalDays}
                      onChange={(e) => setPresetForm({ ...presetForm, followupIntervalDays: parseInt(e.target.value) || 7 })}
                      className="w-full md:w-48 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] text-white"
                    />
                    <p className="text-xs text-[#A3B4CC] mt-1">Days to wait before sending follow-up email</p>
                  </div>

                  {/* Enable Auto-Response Toggle */}
                  <div className="flex items-center justify-between mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <label className="text-sm font-medium text-white">Enable AI Auto-Response to Emails</label>
                      <p className="text-xs text-[#A3B4CC] mt-1">
                        When enabled, AI will automatically respond to incoming emails from leads
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPresetForm({ ...presetForm, enableAutoResponse: !presetForm.enableAutoResponse })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                        presetForm.enableAutoResponse ? 'bg-green-500' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          presetForm.enableAutoResponse ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Use Custom Signature Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <label className="text-sm font-medium text-white">Use Custom Email Signature</label>
                      <p className="text-xs text-[#A3B4CC] mt-1">
                        Emails will be signed as the AI agent
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPresetForm({ ...presetForm, useCustomSignature: !presetForm.useCustomSignature })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                        presetForm.useCustomSignature ? 'bg-green-500' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          presetForm.useCustomSignature ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#0F1E35]/50 flex-shrink-0">
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="px-5 py-2.5 text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePreset}
                  disabled={!presetForm.name}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#4FD1FF] hover:bg-[#4FD1FF]/90 text-[#0F1E35] rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#4FD1FF]/20"
                >
                  <CheckIcon className="w-4 h-4" />
                  Create Preset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </AppLayout>
  );
}
