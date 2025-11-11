'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlusIcon, ChatBubbleLeftRightIcon, ChartBarIcon, BellIcon, BoltIcon, Cog6ToothIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import AgentPersonalitySelector, { PersonalityType } from './AgentPersonalitySelector';
import api from '../../lib/api';

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

// Basic counter for monitoring panel - fetches from all agents
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
}

function PresetsManagement() {
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SettingsPreset | null>(null);
  const [formData, setFormData] = useState<Partial<SettingsPreset>>({
    name: '',
    targetIndustries: [],
    targetPositions: [],
    companySizeMin: 50,
    companySizeMax: 500,
    leadLimit: 10
  });
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
      alert('Please enter a preset name');
      return;
    }

    try {
      if (editingPreset) {
        // Update existing preset
        const response = await api.put(`/api/settings/presets/${editingPreset.id}`, formData);
        setPresets(presets.map(p => p.id === editingPreset.id ? response.data.preset : p));
        setEditingPreset(null);
      } else {
        // Create new preset
        const response = await api.post('/api/settings/presets', formData);
        setPresets([...presets, response.data.preset]);
      }
      
      setIsCreating(false);
      setFormData({
        name: '',
        targetIndustries: [],
        targetPositions: [],
        companySizeMin: 50,
        companySizeMax: 500,
        leadLimit: 10
      });
      setIndustryInput('');
      setPositionInput('');
    } catch (error) {
      console.error('Error saving preset:', error);
      alert('Failed to save preset');
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;

    try {
      await api.delete(`/api/settings/presets/${id}`);
      setPresets(presets.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting preset:', error);
      alert('Failed to delete preset');
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
      leadLimit: preset.leadLimit
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
    <div className="max-w-7xl mr-auto ml-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Settings Presets</h2>
          <p className="text-neutral-600 text-sm mt-1">
            Manage preset configurations for your agents
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreating(true);
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
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Create Preset
        </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-neutral-900">
                {editingPreset ? 'Edit Preset' : 'Create New Preset'}
              </h3>
            </div>

            <div className="p-6 space-y-6">
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
                    value={formData.companySizeMin}
                    onChange={(e) => setFormData({ ...formData, companySizeMin: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Max Employees
                  </label>
                  <input
                    type="number"
                    value={formData.companySizeMax}
                    onChange={(e) => setFormData({ ...formData, companySizeMax: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Lead Limit */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Lead Limit
                </label>
                <input
                  type="number"
                  value={formData.leadLimit}
                  onChange={(e) => setFormData({ ...formData, leadLimit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3">
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
      )}
    </div>
  );
}

export default function AgentDirectorDashboard({ onSelectAgent }: AgentDirectorDashboardProps) {
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'agents' | 'presets'>('agents');
  
  // Monitoring state
  const [monitoringView, setMonitoringView] = useState<MonitoringView>('overview');
  const [monitoringMetrics, setMonitoringMetrics] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [monitoringConnected, setMonitoringConnected] = useState(false);
  
  // Queue modal state
  const [selectedQueue, setSelectedQueue] = useState<{agentId: string | 'all', type: 'queued' | 'sent' | 'replied', agentName: string} | null>(null);
  const [queueEmails, setQueueEmails] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<any | null>(null);
  
  // Prevent concurrent fetches
  const isFetchingRef = useRef(false);

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
      setMonitoringConnected(true);
    };
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMonitoringEvent(data);
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
      fetchAgents(); // Refresh agent stats
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
      fetchAgents(); // Refresh agent stats
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
            
            return {
              id: agent.agentId,
              name: agent.name,
              status: isRunning ? 'running' : 'stopped',
              emailsQueued: emailStats.emailsQueued,
              emailsSent: emailStats.emailsSent,
              meetingsScheduled: emailStats.meetingsScheduled,
              lastRun: agent.lastRun,
              personality: agent.personality
            };
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
          leadLimit: preset.leadLimit
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
    <div className="min-h-screen bg-neutral-50 relative flex">
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
        {/* Left-aligned Header with White Background */}
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
                onClick={() => setShowPersonalitySelector(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                Add Agent
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-neutral-200 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'agents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'presets'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
              }`}
            >
              Presets
            </button>
          </div>
        </div>

        {/* Real-time Monitoring Dashboard - Only show on overview and agents tab */}
        {monitoringMetrics && monitoringView === 'overview' && activeTab === 'agents' && (
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
                        <BasicCounter type="queued" />
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
                        <BasicCounter type="sent" />
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
                        <BasicCounter type="replied" />
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

              {/* Issues */}
              <div className="bg-white/80 backdrop-blur rounded-lg p-4 border border-white/50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">ISSUES</span>
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
          {activeTab === 'agents' ? (
            <>
              {/* Show Monitoring Content for non-overview views */}
              {monitoringView !== 'overview' ? (
                <MonitoringContent 
                  view={monitoringView}
                  metrics={monitoringMetrics}
                  issues={issues}
                  connected={monitoringConnected}
                  onResolveIssue={handleResolveIssue}
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
                    <LiveCounter agentId={agent.id} type="queued" onClick={(e) => {
                      e.stopPropagation();
                      handleQueueClick(agent.id, agent.personality?.name || agent.name, 'queued');
                    }} />
                    <LiveCounter agentId={agent.id} type="sent" onClick={(e) => {
                      e.stopPropagation();
                      handleQueueClick(agent.id, agent.personality?.name || agent.name, 'sent');
                    }} />
                    <div className="text-center">
                      <div className="text-base font-semibold text-neutral-900">{agent.meetingsScheduled}</div>
                      <div className="text-xs text-neutral-600">Meetings</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
            </>
              )}
            </>
          ) : (
            /* Presets Tab Content */
            <PresetsManagement />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
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
                  <div className="mt-2 p-4 bg-neutral-50 rounded text-sm text-neutral-900 whitespace-pre-wrap">
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
              <div className="p-6 border-t bg-neutral-50 flex items-center justify-end gap-3">
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
            )}
          </div>
        </div>
      )}

      {/* Admin Chatbot - Always visible on this tab */}
      <AdminChatbot />
    </div>
  );
}