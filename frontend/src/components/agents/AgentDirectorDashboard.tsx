'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlusIcon, ChatBubbleLeftRightIcon, ChartBarIcon, BellIcon, BoltIcon, Cog6ToothIcon, TrashIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import AgentPersonalitySelector, { PersonalityType } from './AgentPersonalitySelector';
import api from '../../lib/api';
import ReactMarkdown from 'react-markdown';

// Live counter component - fetches count on mount
const LiveCounter = ({ agentId, type, onClick }: { agentId: string; type: 'queued' | 'sent'; onClick: (e: React.MouseEvent) => void }) => {
  const [count, setCount] = useState<number>(0);
  
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const endpoint = type === 'queued' 
          ? `/api/email-queue/queue?agentId=${agentId}`
          : `/api/email-queue/sent?agentId=${agentId}`;
        const response = await api.get(endpoint);
        setCount(Array.isArray(response.data) ? response.data.length : 0);
      } catch {
        setCount(0);
      }
    };
    fetchCount();
  }, [agentId, type]);
  
  return (
    <div 
      className="text-center cursor-pointer hover:bg-neutral-50 rounded p-1 transition-colors"
      onClick={onClick}
    >
      <div className="text-base font-semibold text-neutral-900">{count}</div>
      <div className="text-xs text-neutral-600">{type === 'queued' ? 'Queued' : 'Sent'}</div>
    </div>
  );
};

// Live total counter - sums counts from all agents
const LiveTotalCounter = ({ agents, type }: { agents: Agent[]; type: 'queued' | 'sent' | 'replied' }) => {
  const [count, setCount] = useState<number>(0);
  
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        let total = 0;
        await Promise.all(
          agents.map(async (agent) => {
            try {
              let endpoint = '';
              if (type === 'queued') endpoint = `/api/email-queue/queue?agentId=${agent.id}`;
              else if (type === 'sent') endpoint = `/api/email-queue/sent?agentId=${agent.id}`;
              else if (type === 'replied') endpoint = `/api/email-queue/replied?agentId=${agent.id}`;
              
              const response = await api.get(endpoint);
              total += Array.isArray(response.data) ? response.data.length : 0;
            } catch {
              // Skip failed requests
            }
          })
        );
        setCount(total);
      } catch {
        setCount(0);
      }
    };
    
    if (agents.length > 0) {
      fetchTotalCount();
    }
  }, [agents, type]);
  
  return <>{count}</>;
};

// Basic counter for monitoring panel - fetches from all agents (deprecated, use LiveTotalCounter)
const BasicCounter = ({ type }: { type: 'queued' | 'sent' | 'replied' }) => {
  const [count, setCount] = useState<number>(0);
  
  useEffect(() => {
    const fetchCount = async () => {
      try {
        let endpoint = '';
        if (type === 'queued') endpoint = '/api/email-queue/queue?agentId=all';
        else if (type === 'sent') endpoint = '/api/email-queue/sent?agentId=all';
        else if (type === 'replied') endpoint = '/api/email-queue/replied?agentId=all';
        
        const response = await api.get(endpoint);
        setCount(Array.isArray(response.data) ? response.data.length : 0);
      } catch {
        setCount(0);
      }
    };
    fetchCount();
  }, [type]);
  
  return <>{count}</>;
};

// Countdown badge component for agent cards
const CountdownBadge = ({ nextCycleTime }: { nextCycleTime: string }) => {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [showStarting, setShowStarting] = useState(false);
  const [hasShownStarting, setHasShownStarting] = useState(false);
  
  useEffect(() => {
    const calculateSeconds = () => {
      const now = new Date().getTime();
      const target = new Date(nextCycleTime).getTime();
      const remaining = Math.floor((target - now) / 1000);
      return remaining > 0 ? remaining : 0;
    };
    
    setSeconds(calculateSeconds());
    
    const interval = setInterval(() => {
      const newSeconds = calculateSeconds();
      setSeconds(newSeconds);
      
      // When countdown reaches 0, show "Starting..." then switch to "Running" after 1.5s
      if (newSeconds === 0 && !hasShownStarting) {
        setShowStarting(true);
        setHasShownStarting(true);
        setTimeout(() => {
          setShowStarting(false);
        }, 1500);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [nextCycleTime, hasShownStarting]);
  
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return minutes > 0 ? `${minutes}m ${remainingSecs}s` : `${remainingSecs}s`;
  };
  
  if (seconds === null) {
    return null;
  }
  
  if (seconds === 0 && showStarting) {
    return (
      <div className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 transition-all duration-300 animate-in fade-in slide-in-from-top-2 duration-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Starting...
        </span>
      </div>
    );
  }
  
  if (seconds === 0 && !showStarting) {
    return (
      <div className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 transition-all duration-300 animate-in fade-in slide-in-from-top-2 duration-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          Running
        </span>
      </div>
    );
  }
  
  return (
    <div className={`px-2 py-0.5 rounded text-xs font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-2 duration-500 ${
      seconds <= 30 
        ? 'bg-orange-100 text-orange-700 animate-pulse' 
        : 'bg-blue-100 text-blue-700'
    }`}>
      <span className="inline-flex items-center gap-1.5">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-[10px] opacity-75 font-semibold">Next cycle in:</span>
        <span className="font-bold">{formatTime(seconds)}</span>
      </span>
    </div>
  );
};

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

interface AgentDirectorDashboardProps {
  onSelectAgent: (agentId: string) => void;
}

import MonitoringSidebar, { MonitoringView } from './MonitoringSidebar';
import MonitoringContent from './MonitoringContent';
import AdminChatbot from '../AdminChatbot';

// Presets Management Component
interface SettingsPreset {
  id: string;
  name: string;
  targetIndustries: string[];
  targetPositions: string[];
  companySizeMin: number;
  companySizeMax: number;
  leadLimit: number;
  isDefault?: boolean;
  // Email response settings
  emailLength?: 'short' | 'medium' | 'long';
  callToAction?: 'schedule-meeting' | 'request-demo' | 'learn-more' | 'custom';
  personalizationLevel?: 'low' | 'medium' | 'high';
  ccEmails?: string;
  bccEmails?: string;
  followupIntervalDays?: number;
  enableAutoResponse?: boolean;
  useCustomSignature?: boolean;
  signatureName?: string;
  signatureTitle?: string;
  specialInstructions?: string;
}

function PresetsManagement({ 
  externalIsCreating, 
  externalSetIsCreating, 
  externalEditingPreset, 
  externalSetEditingPreset,
  externalFormData,
  externalSetFormData 
}: { 
  externalIsCreating?: boolean;
  externalSetIsCreating?: (val: boolean) => void;
  externalEditingPreset?: SettingsPreset | null;
  externalSetEditingPreset?: (val: SettingsPreset | null) => void;
  externalFormData?: Partial<SettingsPreset>;
  externalSetFormData?: (val: Partial<SettingsPreset>) => void;
}) {
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [localIsCreating, localSetIsCreating] = useState(false);
  const [localEditingPreset, localSetEditingPreset] = useState<SettingsPreset | null>(null);
  const [deleteConfirmPreset, setDeleteConfirmPreset] = useState<string | null>(null);
  const [localFormData, localSetFormData] = useState<Partial<SettingsPreset>>({
    name: '',
    targetIndustries: [],
    targetPositions: [],
    companySizeMin: 50,
    companySizeMax: 500,
    leadLimit: 10,
    emailLength: 'medium',
    callToAction: 'schedule-meeting',
    personalizationLevel: 'high',
    ccEmails: '',
    bccEmails: '',
    followupIntervalDays: 7,
    enableAutoResponse: false,
    useCustomSignature: false,
    signatureName: '',
    signatureTitle: '',
    specialInstructions: ''
  });
  
  // Use external state if provided, otherwise use local state
  const isCreating = externalIsCreating !== undefined ? externalIsCreating : localIsCreating;
  const setIsCreating = externalSetIsCreating || localSetIsCreating;
  const editingPreset = externalEditingPreset !== undefined ? externalEditingPreset : localEditingPreset;
  const setEditingPreset = externalSetEditingPreset || localSetEditingPreset;
  const formData = externalFormData || localFormData;
  const setFormData = externalSetFormData || localSetFormData;
  const [industryInput, setIndustryInput] = useState('');
  const [positionInput, setPositionInput] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);

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

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await api.get('/api/settings/presets');
      setPresets(response.data.presets || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!formData.name?.trim()) {
      setNotification({ message: 'Please enter a preset name', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    console.log('📤 [Frontend] Saving preset with formData:', JSON.stringify(formData, null, 2));

    try {
      if (editingPreset) {
        // Update existing preset
        setNotification({ message: 'Preset updated successfully!', type: 'success' });
        const response = await api.put(`/api/settings/presets/${editingPreset.id}`, formData);
        setPresets(presets.map(p => p.id === editingPreset.id ? response.data.preset : p));
        setEditingPreset(null);
      } else {
        // Create new preset
        setNotification({ message: 'Preset created successfully!', type: 'success' });
        const response = await api.post('/api/settings/presets', formData);
        setPresets([...presets, response.data.preset]);
      }
      
      setTimeout(() => setNotification(null), 3000);
      
      setIsCreating(false);
      setFormData({
        name: '',
        targetIndustries: [],
        targetPositions: [],
        companySizeMin: 50,
        companySizeMax: 500,
        leadLimit: 10,
        emailLength: 'medium',
        callToAction: 'schedule-meeting',
        personalizationLevel: 'high',
        ccEmails: '',
        bccEmails: '',
        followupIntervalDays: 7,
        enableAutoResponse: false,
        useCustomSignature: false,
        signatureName: '',
        signatureTitle: ''
      });
      setIndustryInput('');
      setPositionInput('');
    } catch (error) {
      console.error('Error saving preset:', error);
      setNotification({ message: 'Failed to save preset', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeletePreset = async (id: string) => {
    setDeleteConfirmPreset(id);
  };

  const confirmDeletePreset = async () => {
    if (!deleteConfirmPreset) return;

    try {
      await api.delete(`/api/settings/presets/${deleteConfirmPreset}`);
      setPresets(presets.filter(p => p.id !== deleteConfirmPreset));
      setDeleteConfirmPreset(null);
      setNotification({ message: 'Preset deleted successfully!', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Error deleting preset:', error);
      setNotification({ message: 'Failed to delete preset', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      setDeleteConfirmPreset(null);
    }
  };

  const handleEditPreset = (preset: SettingsPreset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      targetIndustries: [...preset.targetIndustries],
      targetPositions: [...preset.targetPositions],
      companySizeMin: preset.companySizeMin,
      companySizeMax: preset.companySizeMax,
      leadLimit: preset.leadLimit,
      emailLength: preset.emailLength || 'medium',
      callToAction: preset.callToAction || 'schedule-meeting',
      personalizationLevel: preset.personalizationLevel || 'high',
      ccEmails: preset.ccEmails || '',
      bccEmails: preset.bccEmails || '',
      followupIntervalDays: preset.followupIntervalDays || 7,
      enableAutoResponse: preset.enableAutoResponse || false,
      useCustomSignature: preset.useCustomSignature || false,
      signatureName: preset.signatureName || '',
      signatureTitle: preset.signatureTitle || '',
      specialInstructions: preset.specialInstructions || ''
    });
    setIsCreating(true);
  };

  const addIndustry = (industry: string) => {
    if (industry.trim() && !formData.targetIndustries?.includes(industry.trim())) {
      setFormData({ ...formData, targetIndustries: [...(formData.targetIndustries || []), industry.trim()] });
      setIndustryInput('');
      setShowIndustryDropdown(false);
    }
  };

  const removeIndustry = (industry: string) => {
    setFormData({
      ...formData,
      targetIndustries: formData.targetIndustries?.filter(i => i !== industry) || []
    });
  };

  const addPosition = (position: string) => {
    if (position.trim() && !formData.targetPositions?.includes(position.trim())) {
      setFormData({ ...formData, targetPositions: [...(formData.targetPositions || []), position.trim()] });
      setPositionInput('');
      setShowPositionDropdown(false);
    }
  };

  const removePosition = (position: string) => {
    setFormData({
      ...formData,
      targetPositions: formData.targetPositions?.filter(p => p !== position) || []
    });
  };

  const filteredIndustries = commonIndustries.filter(i =>
    i.toLowerCase().includes(industryInput.toLowerCase())
  );

  const filteredPositions = commonPositions.filter(p =>
    p.toLowerCase().includes(positionInput.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Settings Presets</h2>
        <p className="text-neutral-600 text-sm mt-1">
          Manage preset configurations for your agents
        </p>
      </div>

      {/* Presets Grid */}
      {presets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-12 text-center">
          <div className="text-neutral-400 mb-4">
            <Cog6ToothIcon className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-neutral-900 mb-2">No presets yet</h3>
          <p className="text-neutral-600 text-sm mb-6">
            Create your first preset to quickly configure agents with predefined settings
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    {preset.name}
                    {preset.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </h3>
                  {preset.specialInstructions && (
                    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.15)', borderWidth: '1px' }}>
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgb(37, 99, 235)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgb(29, 78, 216)' }}>
                          {preset.specialInstructions.length > 150 
                            ? `${preset.specialInstructions.substring(0, 150)}...` 
                            : preset.specialInstructions}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditPreset(preset)}
                    className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Industries */}
                <div>
                  <label className="text-xs font-medium text-neutral-600 uppercase mb-2 block">
                    Target Industries ({preset.targetIndustries.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {preset.targetIndustries.slice(0, 5).map((industry, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                      >
                        {industry}
                      </span>
                    ))}
                    {preset.targetIndustries.length > 5 && (
                      <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-sm font-medium">
                        +{preset.targetIndustries.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Positions */}
                <div>
                  <label className="text-xs font-medium text-neutral-600 uppercase mb-2 block">
                    Target Positions ({preset.targetPositions.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {preset.targetPositions.slice(0, 5).map((position, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                      >
                        {position}
                      </span>
                    ))}
                    {preset.targetPositions.length > 5 && (
                      <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-sm font-medium">
                        +{preset.targetPositions.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Company Size & Lead Limit */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-200">
                  <div>
                    <label className="text-xs font-medium text-neutral-600 uppercase block mb-1">
                      Company Size
                    </label>
                    <p className="text-sm font-semibold text-neutral-900">
                      {preset.companySizeMin} - {preset.companySizeMax} employees
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600 uppercase block mb-1">
                      Lead Limit
                    </label>
                    <p className="text-sm font-semibold text-neutral-900">
                      {preset.leadLimit} leads
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isCreating && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-16">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-8 py-5 z-10">
              <h3 className="text-xl font-semibold text-neutral-900">
                {editingPreset ? 'Edit Preset' : 'Create New Preset'}
              </h3>
            </div>

            <div className="pl-8 pr-12 py-8 space-y-8 mb-6">
              {/* Preset Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Preset Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., SaaS Executives"
                />
              </div>

              {/* Special Instructions */}
              <div className="rounded-lg p-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)', borderWidth: '2px' }}>
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'rgb(37, 99, 235)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <div className="flex-1">
                    <label className="block text-sm font-bold mb-1" style={{ color: 'rgb(30, 64, 175)' }}>
                      General Instructions
                    </label>
                    <p className="text-xs mb-3" style={{ color: 'rgb(29, 78, 216)' }}>
                      Write concise instructions on who to target and in what industry. Be specific about pain points and desired outcomes.
                    </p>
                  </div>
                </div>
                <textarea
                  value={formData.specialInstructions || ''}
                  onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                  placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs. Keep tone professional but friendly."
                  className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[100px]"
                  maxLength={1000}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: 'rgb(29, 78, 216)' }}>
                    💡 These instructions guide the entire campaign behavior
                  </span>
                  <span className="text-xs" style={{ color: 'rgb(107, 114, 128)' }}>
                    {(formData.specialInstructions || '').length}/1000
                  </span>
                </div>
              </div>

              {/* Target Industries */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Target Industries
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={industryInput}
                    onChange={(e) => setIndustryInput(e.target.value)}
                    onFocus={() => setShowIndustryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && industryInput.trim()) {
                        e.preventDefault();
                        addIndustry(industryInput);
                      }
                    }}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Type to search or add custom..."
                  />
                  {showIndustryDropdown && filteredIndustries.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredIndustries.map((industry, idx) => (
                        <button
                          key={idx}
                          onClick={() => addIndustry(industry)}
                          className="w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors text-sm"
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.targetIndustries?.map((industry, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                    >
                      {industry}
                      <button
                        onClick={() => removeIndustry(industry)}
                        className="hover:bg-purple-200 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Target Positions */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Target Positions
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={positionInput}
                    onChange={(e) => setPositionInput(e.target.value)}
                    onFocus={() => setShowPositionDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPositionDropdown(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && positionInput.trim()) {
                        e.preventDefault();
                        addPosition(positionInput);
                      }
                    }}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Type to search or add custom..."
                  />
                  {showPositionDropdown && filteredPositions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredPositions.map((position, idx) => (
                        <button
                          key={idx}
                          onClick={() => addPosition(position)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors text-sm"
                        >
                          {position}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.targetPositions?.map((position, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {position}
                      <button
                        onClick={() => removePosition(position)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Company Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Min Employees
                  </label>
                  <input
                    type="number"
                    value={formData.companySizeMin || ''}
                    onChange={(e) => setFormData({ ...formData, companySizeMin: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Max Employees
                  </label>
                  <input
                    type="number"
                    value={formData.companySizeMax || ''}
                    onChange={(e) => setFormData({ ...formData, companySizeMax: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 500"
                  />
                </div>
              </div>

              {/* Lead Limit */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Lead Limit
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.leadLimit}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, leadLimit: parseInt(value) || 0 });
                  }}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Email Response Settings */}
              <div className="border-t border-neutral-200 pt-6 mt-6">
                <h4 className="text-lg font-medium text-neutral-900 mb-4">Email Response Settings</h4>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Email Length
                    </label>
                    <select
                      value={formData.emailLength || 'medium'}
                      onChange={(e) => setFormData({ ...formData, emailLength: e.target.value as 'short' | 'medium' | 'long' })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Call to Action
                    </label>
                    <select
                      value={formData.callToAction || 'schedule-meeting'}
                      onChange={(e) => setFormData({ ...formData, callToAction: e.target.value as any })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="schedule-meeting">Schedule Meeting</option>
                      <option value="request-demo">Request Demo</option>
                      <option value="learn-more">Learn More</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Personalization Level
                    </label>
                    <select
                      value={formData.personalizationLevel || 'high'}
                      onChange={(e) => setFormData({ ...formData, personalizationLevel: e.target.value as 'low' | 'medium' | 'high' })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      CC Email Addresses
                    </label>
                    <input
                      type="text"
                      value={formData.ccEmails || ''}
                      onChange={(e) => setFormData({ ...formData, ccEmails: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Comma-separated email addresses</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      BCC Email Addresses
                    </label>
                    <input
                      type="text"
                      value={formData.bccEmails || ''}
                      onChange={(e) => setFormData({ ...formData, bccEmails: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Hidden from recipients</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Follow-up Interval (Days)
                  </label>
                  <input
                    type="number"
                    value={formData.followupIntervalDays || 7}
                    onChange={(e) => setFormData({ ...formData, followupIntervalDays: parseInt(e.target.value) || 7 })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Days to wait before sending follow-up email</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-neutral-700">
                      Enable AI Auto-Response to Emails
                    </label>
                    <p className="text-xs text-neutral-500 mt-1">
                      When enabled, AI will automatically respond to incoming emails from leads
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, enableAutoResponse: !formData.enableAutoResponse })}
                    className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                    style={{
                      backgroundColor: formData.enableAutoResponse ? '#4ade80' : '#52525b'
                    }}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                        formData.enableAutoResponse ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Email Signature Customization */}
                <div className="pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">
                        Use Custom Email Signature
                      </label>
                      <p className="text-xs text-neutral-500 mt-1">
                        {formData.useCustomSignature 
                          ? 'Emails will be signed with your custom name and title' 
                          : 'Emails will be signed as the AI agent'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, useCustomSignature: !formData.useCustomSignature })}
                      className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                      style={{
                        backgroundColor: formData.useCustomSignature ? '#4ade80' : '#52525b'
                      }}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                          formData.useCustomSignature ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {formData.useCustomSignature && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={formData.signatureName || ''}
                          onChange={(e) => setFormData({ ...formData, signatureName: e.target.value })}
                          placeholder="e.g., John Smith"
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-neutral-500 mt-1">The name that will appear in email signatures</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Your Title
                        </label>
                        <input
                          type="text"
                          value={formData.signatureTitle || ''}
                          onChange={(e) => setFormData({ ...formData, signatureTitle: e.target.value })}
                          placeholder="e.g., CEO, Sales Director"
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Your title or role in the company</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-8 py-5 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                {notification && notification.type === 'success' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span className="text-sm">{notification.message}</span>
                  </div>
                )}
                {notification && notification.type === 'error' && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    <span className="text-sm">{notification.message}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingPreset(null);
                    setFormData({
                      name: '',
                      targetIndustries: [],
                      targetPositions: [],
                      companySizeMin: 50,
                      companySizeMax: 500,
                    leadLimit: 10
                  });
                }}
                className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                style={{ backgroundColor: '#7c3aed', color: 'white' }}
                className="px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                {editingPreset ? 'Update Preset' : 'Create Preset'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPreset && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <TrashIcon className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">Delete Preset</h3>
            </div>
            
            <p className="text-neutral-600 mb-6">
              Are you sure you want to delete this preset? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmPreset(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePreset}
                style={{ backgroundColor: '#dc2626' }}
                className="px-4 py-2 text-sm font-medium text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Outreach Tracking Component
function OutreachTracking({ agents }: { agents: Agent[] }) {
  const [viewTracking, setViewTracking] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });

  useEffect(() => {
    fetchOutreachData();
  }, [agents]);

  const fetchOutreachData = async () => {
    setLoading(true);
    try {
      // For now, use simple fallback data until backend tracking is fully operational
      const response = await api.get('/api/outreach/stats?timeRange=7d').catch(() => null);
      if (response?.data?.success) {
        setStats({
          viewed: response.data.stats.totalOpened || 0,
          replied: response.data.stats.totalReplies || 0,
          meetings: response.data.stats.totalMeetingsBooked || 0,
          conversionRate: response.data.stats.replyRate || 0
        });
      } else {
        // Fallback to empty state
        setStats({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });
      }

      const convResponse = await api.get('/api/outreach/conversations?timeRange=7d').catch(() => null);
      if (convResponse?.data?.success) {
        setConversations(convResponse.data.conversations || []);
      }

      const timelineResponse = await api.get('/api/outreach/timeline?timeRange=7d').catch(() => null);
      if (timelineResponse?.data?.success) {
        const views = (timelineResponse.data.events || []).filter((e: any) => e.eventType === 'open');
        setViewTracking(views);
      }
    } catch (error) {
      console.error('Failed to fetch outreach data:', error);
      // Set empty fallback data
      setStats({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });
      setConversations([]);
      setViewTracking([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-600 mb-1">Emails Viewed</div>
          <div className="text-3xl font-bold text-neutral-900">{stats.viewed}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-600 mb-1">Conversations</div>
          <div className="text-3xl font-bold text-blue-600">{stats.replied}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-600 mb-1">Meetings Booked</div>
          <div className="text-3xl font-bold text-green-600">{stats.meetings}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-600 mb-1">Conversion Rate</div>
          <div className="text-3xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* View Tracking */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-neutral-900">View Tracking</h3>
            <p className="text-sm text-neutral-600">Emails that have been opened</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {viewTracking.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">No views yet</div>
            ) : (
              <div className="space-y-2">
                {viewTracking.map((view, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-neutral-900 truncate">{view.recipientEmail}</div>
                      {view.agentName && <div className="text-xs text-neutral-500">{view.agentName}</div>}
                    </div>
                    <div className="text-xs text-neutral-500">{formatTime(view.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversations */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-neutral-900">Reply Log</h3>
            <p className="text-sm text-neutral-600">Active conversations with leads</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">No conversations yet</div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setSelectedConversation(conv)}
                    className="p-3 bg-neutral-50 rounded hover:bg-neutral-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-medium text-sm text-neutral-900">{conv.leadName}</div>
                      <div className="text-xs text-neutral-500">{formatTime(conv.lastActivity)}</div>
                    </div>
                    <div className="text-xs text-neutral-600 truncate">{conv.leadEmail}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-neutral-500">Agent: {conv.agentName}</span>
                      <span className="text-xs text-neutral-400">• {conv.messageCount} messages</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedConversation(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">{selectedConversation.leadName}</h2>
                  <p className="text-sm text-neutral-600">{selectedConversation.leadEmail}</p>
                </div>
                <button onClick={() => setSelectedConversation(null)} className="text-neutral-400 hover:text-neutral-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedConversation.messages.map((msg: any, idx: number) => (
                <div key={idx} className={`${msg.type === 'outbound' || msg.type === 'ai_response' ? 'ml-8' : 'mr-8'}`}>
                  <div className={`rounded-lg p-4 ${
                    msg.type === 'outbound' ? 'bg-blue-50 border border-blue-200' :
                    msg.type === 'reply' ? 'bg-neutral-100 border border-neutral-200' :
                    'bg-orange-50 border border-orange-200'
                  }`}>
                    <div className="text-xs font-medium text-neutral-600 mb-2">
                      {msg.type === 'outbound' ? 'Sent' : msg.type === 'reply' ? selectedConversation.leadName : 'AI Response'}
                      {' • '}{formatTime(msg.timestamp)}
                    </div>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentDirectorDashboard({ onSelectAgent }: AgentDirectorDashboardProps) {
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'presets'>('agents');
  
  // Monitoring state
  const [monitoringView, setMonitoringView] = useState<MonitoringView>('dashboard');
  const [monitoringMetrics, setMonitoringMetrics] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [monitoringConnected, setMonitoringConnected] = useState(false);
  
  // Preset creation state (shared with PresetsManagement)
  const [presetIsCreating, setPresetIsCreating] = useState(false);
  const [presetEditingPreset, setPresetEditingPreset] = useState<SettingsPreset | null>(null);
  const [presetFormData, setPresetFormData] = useState<Partial<SettingsPreset>>({
    name: '',
    targetIndustries: [],
    targetPositions: [],
    companySizeMin: 50,
    companySizeMax: 500,
    leadLimit: 10,
    emailLength: 'medium',
    callToAction: 'schedule-meeting',
    personalizationLevel: 'high',
    ccEmails: '',
    bccEmails: '',
    followupIntervalDays: 7,
    enableAutoResponse: false
  });
  
  // Queue modal state
  const [selectedQueue, setSelectedQueue] = useState<{agentId: string | 'all', type: 'queued' | 'sent' | 'replied', agentName: string} | null>(null);
  const [queueEmails, setQueueEmails] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<any | null>(null);
  
  // Instructions modal state
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [selectedAgentForInstructions, setSelectedAgentForInstructions] = useState<any | null>(null);
  const [instructionsText, setInstructionsText] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  
  // Prevent concurrent fetches
  const isFetchingRef = useRef(false);

  // Disable body scroll when modals are open
  useEffect(() => {
    if (selectedQueue || selectedEmailDetail || showInstructionsModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedQueue, selectedEmailDetail, showInstructionsModal]);

  useEffect(() => {
    fetchAgents();
    
    // Initial metrics fetch
    refreshMonitoringMetrics();
    
    // Poll metrics every 10 seconds as fallback
    const pollInterval = setInterval(() => {
      refreshMonitoringMetrics();
    }, 10000);
    
    // Connect to monitoring SSE stream
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const authToken = localStorage.getItem('authToken');
    const eventSource = new EventSource(`${backendUrl}/api/monitoring/stream?token=${encodeURIComponent(authToken || '')}`);
    
    eventSource.onopen = () => {
      console.log('📊 [MONITORING] Connected to monitoring stream');
      console.log('📊 [MONITORING] Current agents state:', agents.length, 'agents');
      setMonitoringConnected(true);
    };
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMonitoringEvent(data);
        
        // Handle agent activity updates for Director dashboard cards
        // Check both top-level and nested data for agent_activity type
        const activityData = data.type === 'agent_activity' ? data : 
                            (data.type === 'activity_added' && data.data?.type === 'agent_activity') ? data.data : 
                            null;
        
        if (activityData && activityData.agentId) {
          // Use concise cardMessage if available, fallback to details
          const displayMessage = activityData.cardMessage || activityData.details;
          console.log('📊 [AGENT ACTIVITY]', activityData.agentId, displayMessage);
          setAgents(prevAgents => 
            prevAgents.map(agent => 
              agent.id === activityData.agentId
                ? { ...agent, currentActivity: displayMessage }
                : agent
            )
          );
        }
      } catch (error) {
        console.error('📊 [MONITORING] Failed to parse event:', error);
      }
    });
    
    eventSource.onerror = () => {
      console.warn('📊 [MONITORING] Connection offline (backend not running)');
      setMonitoringConnected(false);
    };
    
    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  // Load instructions when modal opens
  useEffect(() => {
    const loadInstructions = async () => {
      if (showInstructionsModal && selectedAgentForInstructions) {
        try {
          // Fetch fresh agent settings to get current instructions
          const response = await api.get(`/api/lead-agent/settings?agentId=${selectedAgentForInstructions.id}`);
          if (response.data && response.data.settings) {
            const instructions = response.data.settings.specialInstructions || 
                                response.data.settings.userSettings?.specialInstructions || 
                                '';
            setInstructionsText(instructions);
            console.log('📝 Loaded instructions from settings:', instructions);
          } else {
            setInstructionsText(selectedAgentForInstructions.specialInstructions || '');
          }
        } catch (error) {
          console.error('Failed to load instructions:', error);
          setInstructionsText(selectedAgentForInstructions.specialInstructions || '');
        }
      }
    };
    loadInstructions();
  }, [showInstructionsModal, selectedAgentForInstructions]);
  
  const handleMonitoringEvent = useCallback((message: any) => {
    const { type, data } = message;
    
    console.log('📊 [MONITORING EVENT]', type, data);
    
    switch (type) {
      case 'initial_metrics':
        console.log('📊 [MONITORING] Setting initial metrics:', data);
        setMonitoringMetrics(data);
        break;
      case 'metric_update':
        setMonitoringMetrics((prev: any) => {
          if (!prev) return prev;
          const { category, key, value } = data;
          return {
            ...prev,
            [category]: {
              ...prev[category],
              [key]: value,
            },
          };
        });
        break;
      case 'issue_detected':
        setIssues((prev) => [data, ...prev].slice(0, 50));
        break;
    }
  }, []);

  // Fetch issues on mount and poll every 10 seconds
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const response = await api.get('/api/issues');
        if (response.data.success && Array.isArray(response.data.issues)) {
          // Map backend structure to frontend structure
          const mappedIssues = response.data.issues.map((issue: any) => ({
            id: issue.issueId,
            severity: issue.type, // error, warning, info
            message: `${issue.title}: ${issue.message}`,
            timestamp: issue.timestamp,
            agentId: issue.metadata?.agentId || 'system',
            details: issue.metadata,
            resolved: issue.read
          }));
          setIssues(mappedIssues);
          console.log('📋 [ISSUES] Fetched issues:', mappedIssues.length);
        }
      } catch (error) {
        console.error('❌ [ISSUES] Error fetching issues:', error);
      }
    };
    
    fetchIssues();
    
    // Poll for issues every 10 seconds
    const issuesInterval = setInterval(fetchIssues, 10000);
    
    return () => clearInterval(issuesInterval);
  }, []);

  const handleResolveIssue = (issueId: string) => {
    // Update the issue to mark it as resolved
    setIssues(prevIssues => 
      prevIssues.map(issue => 
        issue.id === issueId ? { ...issue, resolved: true } : issue
      )
    );
  };

  const refreshMonitoringMetrics = async () => {
    try {
      const response = await api.get('/api/monitoring/metrics');
      console.log('📊 [MONITORING] API response:', response.data);
      if (response.data && response.data.metrics) {
        setMonitoringMetrics(response.data.metrics);
      }
    } catch (error) {
      console.error('Error refreshing monitoring metrics:', error);
    }
  };

  const fetchQueueEmails = async (agentId: string | 'all', type: 'queued' | 'sent' | 'replied') => {
    setLoadingQueue(true);
    try {
      let allEmails: any[] = [];
      
      if (agentId === 'all') {
        // Fetch from all agents
        const agentPromises = agents.map(async (agent) => {
          try {
            let endpoint = '';
            if (type === 'queued') endpoint = '/api/email-queue/queue';
            else if (type === 'sent') endpoint = '/api/email-queue/sent';
            else if (type === 'replied') endpoint = '/api/email-queue/replied';
            
            const response = await api.get(`${endpoint}?agentId=${agent.id}`);
            const emails = response.data || [];
            
            // Add agent info to each email
            return emails.map((email: any) => ({
              ...email,
              _agentInfo: {
                id: agent.id,
                name: agent.personality?.name || agent.name,
                customName: agent.name,
                avatar: agent.personality?.avatar,
                color: agent.personality?.color
              }
            }));
          } catch (error) {
            console.error(`Error fetching emails for agent ${agent.id}:`, error);
            return [];
          }
        });
        
        const results = await Promise.all(agentPromises);
        allEmails = results.flat();
      } else {
        // Single agent
        let endpoint = '';
        if (type === 'queued') endpoint = '/api/email-queue/queue';
        else if (type === 'sent') endpoint = '/api/email-queue/sent';
        else if (type === 'replied') endpoint = '/api/email-queue/replied';
        
        const response = await api.get(`${endpoint}?agentId=${agentId}`);
        allEmails = response.data || [];
        
        // Add agent info for single agent view
        const agent = agents.find(a => a.id === agentId);
        allEmails = allEmails.map((email: any) => ({
          ...email,
          _agentInfo: agent ? {
            id: agent.id,
            name: agent.personality?.name || agent.name,
            customName: agent.name,
            avatar: agent.personality?.avatar,
            color: agent.personality?.color
          } : {
            id: agentId,
            name: 'Deleted Agent',
            customName: 'Deleted Agent',
            avatar: null,
            color: 'neutral'
          }
        }));
      }
      
      setQueueEmails(allEmails);
    } catch (error) {
      console.error('Error fetching queue emails:', error);
      setQueueEmails([]);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleQueueClick = (agentId: string | 'all', agentName: string, type: 'queued' | 'sent' | 'replied') => {
    setSelectedQueue({ agentId, type, agentName });
    fetchQueueEmails(agentId, type);
  };

  const handleApproveEmail = async (emailId: string, emailAgentId?: string) => {
    if (!selectedQueue) return;
    
    try {
      // Use the email's agent ID if viewing all agents, otherwise use selected queue agent
      const targetAgentId = emailAgentId || (selectedQueue.agentId !== 'all' ? selectedQueue.agentId : '');
      
      await api.post(`/api/email-queue/${emailId}/approve`, {
        agentId: targetAgentId
      });
      
      // Refresh the queue
      fetchQueueEmails(selectedQueue.agentId, selectedQueue.type);
      refreshMonitoringMetrics(); // Refresh monitoring metrics
    } catch (error) {
      console.error('Error approving email:', error);
    }
  };

  const handleRejectEmail = async (emailId: string, emailAgentId?: string) => {
    if (!selectedQueue) return;
    
    try {
      // Use the email's agent ID if viewing all agents, otherwise use selected queue agent
      const targetAgentId = emailAgentId || (selectedQueue.agentId !== 'all' ? selectedQueue.agentId : '');
      
      await api.delete(`/api/email-queue/${emailId}`, {
        data: { agentId: targetAgentId }
      });
      
      // Refresh the queue
      fetchQueueEmails(selectedQueue.agentId, selectedQueue.type);
      refreshMonitoringMetrics(); // Refresh monitoring metrics
    } catch (error) {
      console.error('Error rejecting email:', error);
    }
  };

  const handleClearAllSentEmails = async () => {
    if (!selectedQueue || selectedQueue.type !== 'sent') return;
    
    if (!confirm('Are you sure you want to clear all sent emails? This action cannot be undone.')) {
      return;
    }
    
    try {
      const targetAgentId = selectedQueue.agentId !== 'all' ? selectedQueue.agentId : null;
      
      console.log('Clearing sent emails for agentId:', targetAgentId);
      const response = await api.delete('/api/email-queue/sent/clear', {
        params: { agentId: targetAgentId }
      });
      console.log('Clear response:', response.data);
      
      // Refresh the queue
      fetchQueueEmails(selectedQueue.agentId, selectedQueue.type);
      fetchAgents(); // Refresh agent stats
      refreshMonitoringMetrics(); // Refresh monitoring metrics
    } catch (error: any) {
      console.error('Error clearing sent emails:', error);
      console.error('Error response:', error.response?.data);
      alert(`Failed to clear sent emails: ${error.response?.data?.details || error.message}`);
    }
  };

  const toggleAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      // Toggle agent through API
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

  const fetchAgents = async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('⏭️ [AGENTS] Skipping fetch - already in progress');
      return;
    }
    
    try {
      console.log('🔄 [AGENTS] Starting agent fetch...');
      isFetchingRef.current = true;
      setIsLoading(true);
      const response = await api.get('/api/auth/agents');
      
      if (response.data.success && response.data.agents) {
        console.log(`🔄 [AGENTS] Found ${response.data.agents.length} agents`);
        const awsAgents = await Promise.all(
          response.data.agents.map(async (agent: any) => {
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
            
            // Preserve currentActivity from existing state
            const existingAgent = agents.find(a => a.id === agent.agentId);
            
            const mappedAgent = {
              id: agent.agentId,
              name: agent.name,
              status: isRunning ? 'running' : 'stopped',
              emailsQueued: emailStats.emailsQueued,
              emailsSent: emailStats.emailsSent,
              meetingsScheduled: emailStats.meetingsScheduled,
              lastRun: agent.lastRun,
              personality: agent.personality,
              nextCycleTime: agent.nextCycleTime,
              specialInstructions: agent.specialInstructions || '',
              currentActivity: existingAgent?.currentActivity || (isRunning ? 'Thinking' : undefined), // Show "Thinking" for running agents until SSE updates
              settings: agent.settings || {} // Include settings from backend
            };
            
            console.log(`🔍 [AGENT SETTINGS] ${agent.name} settings:`, {
              hasSettings: !!agent.settings,
              settings: agent.settings,
              companyCriteria: agent.settings?.companyCriteria,
              contactCriteria: agent.settings?.contactCriteria,
              geographicSettings: agent.settings?.geographicSettings
            });
            
            return mappedAgent;
          })
        );
        console.log('✅ [AGENTS] Agent fetch complete:', awsAgents);
        setAgents(awsAgents);
      } else {
        console.warn('⚠️ [AGENTS] No agents in response');
        setAgents([]);
      }
    } catch (error) {
      console.error('❌ [AGENTS] Failed to fetch agents:', error);
      setAgents([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const fetchEmailStats = async (agentId: string) => {
    try {
      console.log(`📊 [STATS] Fetching stats for agent ${agentId}`);
      // Use the EXACT same endpoints that populate the modals
      // This ensures counters always match what's displayed
      
      // Queued emails - same call as modal
      const queuedEmails = await fetchQueueEmailsForCount(agentId, 'queued');
      const emailsQueued = queuedEmails.length;
      console.log(`📊 [STATS] Agent ${agentId} - Queued: ${emailsQueued}`);

      // Sent emails - same call as modal  
      const sentEmails = await fetchQueueEmailsForCount(agentId, 'sent');
      const emailsSent = sentEmails.length;
      console.log(`📊 [STATS] Agent ${agentId} - Sent: ${emailsSent}`);

      // Meetings
      let meetingsScheduled = 0;
      try {
        const eventsResponse = await api.get(`/api/analytics/scheduled-events?agentId=${agentId}`);
        if (eventsResponse.data && Array.isArray(eventsResponse.data)) {
          meetingsScheduled = eventsResponse.data.length;
        }
      } catch {
        meetingsScheduled = 0;
      }

      const finalStats = { emailsQueued, emailsSent, meetingsScheduled };
      console.log(`📊 [STATS] Agent ${agentId} - Final:`, finalStats);
      return finalStats;
    } catch (error) {
      console.error(`❌ [STATS] Failed to fetch email stats for agent ${agentId}:`, error);
      return { emailsQueued: 0, emailsSent: 0, meetingsScheduled: 0 };
    }
  };

  // Helper function to fetch emails for counting - uses same logic as modal
  const fetchQueueEmailsForCount = async (agentId: string | 'all', type: 'queued' | 'sent' | 'replied') => {
    try {
      let endpoint = '';
      
      if (agentId === 'all') {
        if (type === 'queued') endpoint = '/api/email-queue/queue?agentId=all';
        else if (type === 'sent') endpoint = '/api/email-queue/sent?agentId=all';
        else if (type === 'replied') endpoint = '/api/email-queue/replied?agentId=all';
      } else {
        if (type === 'queued') endpoint = '/api/email-queue/queue';
        else if (type === 'sent') endpoint = '/api/email-queue/sent';
        else if (type === 'replied') endpoint = '/api/email-queue/replied';
        
        endpoint += `?agentId=${agentId}`;
      }

      const response = await api.get(endpoint);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error(`Failed to fetch ${type} emails for counting:`, error);
      return [];
    }
  };

  const createAgent = async (personality: PersonalityType, customName: string, preset?: any) => {
    try {
      console.log('[AgentDirector] Creating agent with:', {
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
          useCustomSignature: preset.useCustomSignature,
          signatureName: preset.signatureName,
          signatureTitle: preset.signatureTitle,
          specialInstructions: preset.specialInstructions // Include special instructions from preset
        };
        console.log('[AgentDirector] Preset data being sent:', agentData.preset);
      } else {
        console.log('[AgentDirector] ⚠️ No preset provided');
      }
      
      const response = await api.post('/api/auth/create-agent', agentData);
      
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
    <div className={`min-h-screen relative flex ${monitoringView === 'overview' ? 'bg-neutral-50' : 'bg-white'}`}>
      {/* Grid Background Pattern - Only show on overview */}
      {monitoringView === 'overview' && (
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
      )}

      {/* Monitoring Sidebar */}
      <div className="relative z-20">
        <MonitoringSidebar 
          activeView={monitoringView}
          onViewChange={setMonitoringView}
          issueCount={issues.filter(i => !i.resolved).length}
          connected={monitoringConnected}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-0 flex-1 ml-16">
        {/* Left-aligned Header with White Background - Only show on overview */}
        {monitoringView === 'overview' && (
          <div className="bg-white border-b border-neutral-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-neutral-900">Agent Director</h1>
                <p className="text-neutral-600 text-sm mt-1">Central command for all your AI agents</p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Monitoring Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded text-sm">
                  <div className={`w-2 h-2 rounded-full ${monitoringConnected ? 'bg-green-500' : 'bg-neutral-300'}`}></div>
                  <span className="text-neutral-600 text-xs">
                    {monitoringConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
                
                <button
                  onClick={() => activeTab === 'agents' ? setShowPersonalitySelector(true) : setPresetIsCreating(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 font-medium"
                >
                  <PlusIcon className="w-4 h-4" />
                  {activeTab === 'agents' ? 'Add Agent' : 'Add Preset'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Monitoring Dashboard - Only show on overview */}
        {monitoringMetrics && monitoringView === 'overview' && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-neutral-200 px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Emails */}
              <div className="bg-white/80 backdrop-blur rounded-lg p-4 border border-white/50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-neutral-600">EMAILS</span>
                  <ChartBarIcon className="w-4 h-4 text-blue-600" />
                </div>
                
                {/* Three equal-sized clickable cards */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Queued */}
                  <div 
                    className="bg-white hover:bg-neutral-50 border border-neutral-200 rounded p-2 cursor-pointer transition-all hover:shadow-sm"
                    onClick={() => handleQueueClick('all', 'All Agents', 'queued')}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-neutral-900">
                        <LiveTotalCounter agents={agents} type="queued" />
                      </div>
                      <div className="text-[10px] text-neutral-600 uppercase">
                        Queued
                      </div>
                    </div>
                  </div>
                  
                  {/* Sent */}
                  <div 
                    className="bg-white hover:bg-neutral-50 border border-neutral-200 rounded p-2 cursor-pointer transition-all hover:shadow-sm"
                    onClick={() => handleQueueClick('all', 'All Agents', 'sent')}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-neutral-900">
                        <LiveTotalCounter agents={agents} type="sent" />
                      </div>
                      <div className="text-[10px] text-neutral-600 uppercase">
                        Sent
                      </div>
                    </div>
                  </div>
                  
                  {/* Replied */}
                  <div 
                    className="bg-white hover:bg-neutral-50 border border-neutral-200 rounded p-2 cursor-pointer transition-all hover:shadow-sm"
                    onClick={() => handleQueueClick('all', 'All Agents', 'replied')}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-neutral-900">
                        <LiveTotalCounter agents={agents} type="replied" />
                      </div>
                      <div className="text-[10px] text-neutral-600 uppercase">
                        Replied
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emails Viewed */}
              <div className="bg-white/80 backdrop-blur rounded-lg p-4 border border-white/50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">EMAILS VIEWED</span>
                  <BoltIcon className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-900">
                    {monitoringMetrics.emails?.viewed || 0}
                  </span>
                  <span className="text-xs text-neutral-500">opened</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {monitoringMetrics.emails?.sent > 0 ? ((monitoringMetrics.emails?.viewed || 0) / monitoringMetrics.emails.sent * 100).toFixed(1) : 0}% open rate
                </div>
              </div>

              {/* Meetings */}
              <div className="bg-white/80 backdrop-blur rounded-lg p-4 border border-white/50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">MEETINGS</span>
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-900">
                    {monitoringMetrics.meetings?.booked || 0}
                  </span>
                  <span className="text-xs text-neutral-500">booked</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {monitoringMetrics.emails?.replied || 0} responses
                </div>
              </div>

              {/* Alerts */}
              <div 
                onClick={() => setMonitoringView('logs')}
                className="bg-white/80 backdrop-blur rounded-lg p-4 border border-white/50 shadow-sm cursor-pointer hover:bg-white hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">ALERTS</span>
                  <BellIcon className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-900">
                    {issues.filter(i => !i.resolved).length}
                  </span>
                  <span className="text-xs text-neutral-500">active</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {issues.filter(i => i.severity === 'error').length} errors · {issues.filter(i => i.severity === 'warning').length} warnings
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6">
          {/* Tab System - Only show on overview */}
          {monitoringView === 'overview' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setActiveTab('agents')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                    activeTab === 'agents'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  🤖 Agents
                </button>
                <button
                  onClick={() => setActiveTab('presets')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                    activeTab === 'presets'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  ⚙️ Presets
                </button>
              </div>
            </div>
          )}

          {/* Show Monitoring Content for non-overview views */}
          {monitoringView !== 'overview' ? (
            <MonitoringContent 
              view={monitoringView}
              metrics={monitoringMetrics}
              issues={issues}
              connected={monitoringConnected}
              onResolveIssue={handleResolveIssue}
              onViewChange={setMonitoringView}
              agents={agents}
            />
          ) : activeTab === 'presets' ? (
            /* Presets View */
            <PresetsManagement 
              externalIsCreating={presetIsCreating}
              externalSetIsCreating={setPresetIsCreating}
              externalEditingPreset={presetEditingPreset}
              externalSetEditingPreset={setPresetEditingPreset}
              externalFormData={presetFormData}
              externalSetFormData={setPresetFormData}
            />
          ) : (
            /* Agent Grid for overview */
            <>
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
                  className={`border rounded-xl overflow-hidden transition-all ${getPersonalityColors(agent.personality?.color)}`}
                >
                  {/* Agent Header */}
                  <div 
                    onClick={() => onSelectAgent(agent.id)}
                    className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {agent.personality?.avatar ? (
                          <img 
                            src={agent.personality.avatar} 
                            alt={agent.personality.name || agent.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="text-2xl flex-shrink-0">🤖</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base text-neutral-900 truncate">{agent.name}</h3>
                          <p className="text-sm text-neutral-600">
                            {agent.personality?.name || 'Standard Agent'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Status Badge or Countdown Timer */}
                      <div className="flex-shrink-0">
                        {agent.status === 'running' && agent.nextCycleTime ? (
                          <CountdownBadge nextCycleTime={agent.nextCycleTime} />
                        ) : (
                          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
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
                              {agent.status === 'running' ? 'Active' : 'Stopped'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activity Message - Real-time progress streaming */}
                    {agent.currentActivity && agent.status === 'running' && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50/50 rounded-lg">
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-xs text-blue-700 font-medium break-words" title={agent.currentActivity}>
                          {agent.currentActivity}
                        </p>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQueueClick(agent.id, agent.personality?.name || agent.name, 'queued');
                        }}
                        className="text-center p-2 bg-white/50 rounded-lg cursor-pointer hover:bg-white hover:shadow-sm transition-all"
                      >
                        <div className="text-lg font-bold text-neutral-900">{agent.emailsQueued}</div>
                        <div className="text-[10px] text-neutral-600 uppercase">Queued</div>
                      </div>
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQueueClick(agent.id, agent.personality?.name || agent.name, 'sent');
                        }}
                        className="text-center p-2 bg-white/50 rounded-lg cursor-pointer hover:bg-white hover:shadow-sm transition-all"
                      >
                        <div className="text-lg font-bold text-neutral-900">{agent.emailsSent}</div>
                        <div className="text-[10px] text-neutral-600 uppercase">Sent</div>
                      </div>
                      <div className="text-center p-2 bg-white/50 rounded-lg">
                        <div className="text-lg font-bold text-neutral-900">{agent.meetingsScheduled}</div>
                        <div className="text-[10px] text-neutral-600 uppercase">Meetings</div>
                      </div>
                    </div>

                    {/* Agent Targeting Info */}
                    <div className="space-y-2 border-t border-neutral-200/50 pt-3">
                      {/* Target Industries */}
                      <div>
                        <div className="text-[10px] font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Target Industries</div>
                        <div className="flex flex-wrap gap-1">
                          {agent.settings?.companyCriteria?.companyIndustries && agent.settings.companyCriteria.companyIndustries.length > 0 ? (
                            <>
                              {agent.settings.companyCriteria.companyIndustries.slice(0, 3).map((industry, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded font-medium">
                                  {industry}
                                </span>
                              ))}
                              {agent.settings.companyCriteria.companyIndustries.length > 3 && (
                                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded font-medium">
                                  +{agent.settings.companyCriteria.companyIndustries.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Not configured</span>
                          )}
                        </div>
                      </div>

                      {/* Target Positions */}
                      <div>
                        <div className="text-[10px] font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Target Positions</div>
                        <div className="flex flex-wrap gap-1">
                          {agent.settings?.contactCriteria?.targetPositions && agent.settings.contactCriteria.targetPositions.length > 0 ? (
                            <>
                              {agent.settings.contactCriteria.targetPositions.slice(0, 3).map((position, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded font-medium">
                                  {position}
                                </span>
                              ))}
                              {agent.settings.contactCriteria.targetPositions.length > 3 && (
                                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded font-medium">
                                  +{agent.settings.contactCriteria.targetPositions.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Not configured</span>
                          )}
                        </div>
                      </div>

                      {/* Company Size & Lead Limit */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Company Size</div>
                          <div className="text-xs text-neutral-900 font-medium">
                            {agent.settings?.companyCriteria?.companySizeMin && agent.settings?.companyCriteria?.companySizeMax
                              ? `${agent.settings.companyCriteria.companySizeMin}-${agent.settings.companyCriteria.companySizeMax}`
                              : <span className="text-neutral-400 italic text-[10px]">Not set</span>
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Lead Limit</div>
                          <div className="text-xs text-neutral-900 font-medium">
                            {agent.settings?.geographicSettings?.leadLimit
                              ? `${agent.settings.geographicSettings.leadLimit}/cycle`
                              : <span className="text-neutral-400 italic text-[10px]">Not set</span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="border-t border-neutral-200/50 bg-white/30 p-2 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAgent(agent.id);
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                        agent.status === 'running'
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {agent.status === 'running' ? '⏸ Stop' : '▶ Start'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAgent(agent.id);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium text-sm transition-all"
                    >
                      ⚙️ Manage
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAgentForInstructions(agent);
                        setShowInstructionsModal(true);
                      }}
                      className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-medium text-sm transition-all"
                    >
                      💬
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showDeleteConfirmation(agent);
                      }}
                      disabled={agent.id === 'lead-agent-main'}
                      className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🗑️
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Agent Personality Selector Modal */}
      <AgentPersonalitySelector
        isOpen={showPersonalitySelector}
        onClose={() => setShowPersonalitySelector(false)}
        onSelectPersonality={createAgent}
      />

      {/* Queue Email Modal - Larger size */}
      {selectedQueue && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-7xl w-full h-[98vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-neutral-50 to-neutral-100">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  {selectedQueue.type === 'queued' ? '📋 Queued Emails' : selectedQueue.type === 'sent' ? '✉️ Sent Emails' : '💬 Replied Emails'}
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  {selectedQueue.agentName} {selectedQueue.agentId === 'all' && `(${queueEmails.length} total)`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedQueue.type === 'sent' && (
                  <button
                    onClick={handleClearAllSentEmails}
                    disabled={queueEmails.length === 0}
                    className="px-4 py-2 bg-white text-neutral-900 text-sm font-medium rounded-lg hover:bg-neutral-100 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setSelectedQueue(null)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors p-2 hover:bg-neutral-200 rounded-full"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingQueue ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
                </div>
              ) : queueEmails.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-600">No emails found</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {queueEmails.map((email) => (
                    <div
                      key={email.id}
                      className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEmailDetail(email)}
                    >
                      {/* Agent Info */}
                      {email._agentInfo && (
                        <div className="flex items-center gap-2 mb-2">
                          {email._agentInfo.avatar ? (
                            <img 
                              src={email._agentInfo.avatar} 
                              alt={email._agentInfo.customName}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              email._agentInfo.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                              email._agentInfo.color === 'green' ? 'bg-green-100 text-green-600' :
                              email._agentInfo.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                              'bg-neutral-100 text-neutral-600'
                            }`}>
                              {email._agentInfo.customName?.charAt(0) || 'A'}
                            </div>
                          )}
                          <span className="text-xs font-medium text-neutral-700 truncate">
                            {email._agentInfo.customName || 'Unknown Agent'}
                          </span>
                        </div>
                      )}
                      
                      {/* Subject */}
                      <div className="text-sm font-medium text-neutral-900 line-clamp-2 mb-3">
                        {email.subject}
                      </div>

                      {/* Action Buttons */}
                      {selectedQueue.type === 'queued' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveEmail(email.id, email._agentInfo?.id);
                            }}
                            className="flex-1 px-2 py-1.5 border border-neutral-300 text-neutral-900 rounded hover:bg-neutral-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectEmail(email.id, email._agentInfo?.id);
                            }}
                            className="flex-1 px-2 py-1.5 border border-neutral-300 text-neutral-900 rounded hover:bg-neutral-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmailDetail && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Email Details</h2>
                {(selectedEmailDetail.lead?.company || selectedEmailDetail.company) && (
                  <p className="text-sm text-neutral-600 mt-1">{selectedEmailDetail.lead?.company || selectedEmailDetail.company}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedEmailDetail(null)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* AI Confidence Report Box */}
                {(selectedEmailDetail.confidenceReport || selectedEmailDetail.emailData?.confidenceReport) && (
                  <div className="mb-4">
                    <div className={`p-4 rounded-lg border-2 ${
                      (selectedEmailDetail.confidenceLevel || selectedEmailDetail.emailData?.confidenceLevel) === 'high' 
                        ? 'bg-green-50 border-green-300' 
                        : (selectedEmailDetail.confidenceLevel || selectedEmailDetail.emailData?.confidenceLevel) === 'low'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-yellow-50 border-yellow-300'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                          (selectedEmailDetail.confidenceLevel || selectedEmailDetail.emailData?.confidenceLevel) === 'high' 
                            ? 'bg-green-500' 
                            : (selectedEmailDetail.confidenceLevel || selectedEmailDetail.emailData?.confidenceLevel) === 'low'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-semibold text-neutral-800">AI Confidence Report</h4>
                            <span className="text-xs text-neutral-500 italic">Note: This report does not send with the email</span>
                          </div>
                          <div className="text-sm text-neutral-700 leading-relaxed prose prose-sm max-w-none">
                            <ReactMarkdown
                              components={{
                                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                                em: ({node, ...props}) => <em className="italic" {...props} />,
                              }}
                            >
                              {selectedEmailDetail.confidenceReport || selectedEmailDetail.emailData?.confidenceReport}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-neutral-600 uppercase">To</label>
                  <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.to}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-neutral-600 uppercase">Subject</label>
                  <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.subject}</p>
                </div>

                {(selectedEmailDetail.cc || selectedEmailDetail.emailData?.cc) && (
                  <div>
                    <label className="text-xs font-medium text-neutral-600 uppercase">CC Email Addresses</label>
                    <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.cc || selectedEmailDetail.emailData?.cc}</p>
                  </div>
                )}

                {(selectedEmailDetail.bcc || selectedEmailDetail.emailData?.bcc) && (
                  <div>
                    <label className="text-xs font-medium text-neutral-600 uppercase">BCC Email Addresses</label>
                    <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.bcc || selectedEmailDetail.emailData?.bcc}</p>
                  </div>
                )}

                {selectedEmailDetail.lead && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedEmailDetail.lead.name && (
                      <div>
                        <label className="text-xs font-medium text-neutral-600 uppercase">Lead Name</label>
                        <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.lead.name}</p>
                      </div>
                    )}
                    {(selectedEmailDetail.lead?.company || selectedEmailDetail.company) && (
                      <div>
                        <label className="text-xs font-medium text-neutral-600 uppercase">Company</label>
                        <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.lead?.company || selectedEmailDetail.company || 'Unknown Company'}</p>
                      </div>
                    )}
                    {selectedEmailDetail.lead.title && (
                      <div>
                        <label className="text-xs font-medium text-neutral-600 uppercase">Title</label>
                        <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.lead.title}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="text-xs font-medium text-neutral-600 uppercase">Email Body</label>
                  <div className="mt-2 p-4 bg-neutral-50 rounded text-sm text-neutral-900 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                    {selectedEmailDetail.body || selectedEmailDetail.text || 'No content'}
                  </div>
                </div>

                {(selectedEmailDetail.sentAt || selectedEmailDetail.queuedAt) && (
                  <div>
                    <label className="text-xs font-medium text-neutral-600 uppercase">
                      {selectedEmailDetail.sentAt ? 'Sent At' : 'Queued At'}
                    </label>
                    <p className="text-sm text-neutral-900 mt-1">
                      {new Date(selectedEmailDetail.sentAt || selectedEmailDetail.queuedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with actions */}
            {selectedQueue?.type === 'queued' && (
              <div className="p-6 border-t bg-neutral-50 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    const agentId = selectedEmailDetail._agentInfo?.id || selectedEmailDetail.agentId;
                    const emailId = selectedEmailDetail.id;
                    setSelectedEmailDetail(null);
                    setSelectedQueue(null);
                    onSelectAgent(agentId);
                    // Store email ID to be opened by AgentDashboard
                    sessionStorage.setItem('openEmailId', emailId);
                  }}
                  className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium"
                >
                  Take me to email
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      handleRejectEmail(selectedEmailDetail.id, selectedEmailDetail._agentInfo?.id);
                      setSelectedEmailDetail(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      handleApproveEmail(selectedEmailDetail.id, selectedEmailDetail._agentInfo?.id);
                      setSelectedEmailDetail(null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Approve & Send
                  </button>
                </div>
              </div>
            )}
            {selectedQueue?.type === 'sent' && (
              <div className="p-6 border-t bg-neutral-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    const agentId = selectedEmailDetail._agentInfo?.id || selectedEmailDetail.agentId;
                    const emailId = selectedEmailDetail.id;
                    setSelectedEmailDetail(null);
                    setSelectedQueue(null);
                    onSelectAgent(agentId);
                    // Store email ID to be opened by AgentDashboard
                    sessionStorage.setItem('openEmailId', emailId);
                  }}
                  className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium"
                >
                  Take me to email
                </button>
              </div>
            )}
          </div>
        </div>
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

      {/* Delete Agent Modal */}
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

      {/* Admin Chatbot - Always visible on this tab */}
      <AdminChatbot />
    </div>
  );
}