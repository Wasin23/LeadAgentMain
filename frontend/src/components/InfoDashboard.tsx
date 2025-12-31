'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Bot, Plus, ExternalLink, Power, Target, Mail, Clock, AlertCircle, Send, X } from 'lucide-react';
import api from '@/lib/api';
import { PERSONALITY_TYPES } from './agents/AgentPersonalitySelector';

interface Agent {
  agentId: string;
  agentName: string;
  status: string;
  targeting: {
    location: string;
    industry: string;
    keywords: string[];
  };
  emailStats?: {
    built: number;
    queued: number;
    sent: number;
  };
}

interface Notification {
  issueId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function InfoDashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agentActivities, setAgentActivities] = useState<{[key: string]: any}>({});
  const [isMounted, setIsMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [showPresetSelection, setShowPresetSelection] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchPresets = async () => {
    setLoadingPresets(true);
    try {
      const response = await api.get('/api/settings/presets');
      const presetsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.presets || response.data?.data || []);
      setPresets(presetsData);
    } catch (error) {
      console.error('Error fetching presets:', error);
      setPresets([]);
    } finally {
      setLoadingPresets(false);
    }
  };

  useEffect(() => {
    if (!isMounted) return;
    console.log('[InfoDashboard] useEffect triggered, calling fetchData');
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [isMounted]);

  const fetchData = async () => {
    console.log('[InfoDashboard] fetchData called');
    try {
      // Fetch agents
      const agentsResponse = await api.get('/api/auth/agents');
      console.log('[InfoDashboard] Agents response:', agentsResponse.data);
      if (agentsResponse.data.success) {
        const agentsList = agentsResponse.data.agents || [];
        console.log('[InfoDashboard] Agents list:', agentsList);
        
        // Fetch email stats for each agent
        const agentsWithStats = await Promise.all(
          agentsList.map(async (agent: any) => {
            // Normalize agent data structure
            const normalizedAgent = {
              ...agent,
              agentName: agent.agentName || agent.name,
              agentId: agent.agentId
            };
            
            try {
              // Fetch queued and sent emails separately
              const [queuedRes, sentRes] = await Promise.all([
                api.get(`/api/email-queue/queue?agentId=${normalizedAgent.agentId}`),
                api.get(`/api/email-queue/sent?agentId=${normalizedAgent.agentId}`)
              ]);
              
              console.log(`[InfoDashboard] Queue API response for ${normalizedAgent.agentName}:`, queuedRes.data);
              console.log(`[InfoDashboard] Sent API response for ${normalizedAgent.agentName}:`, sentRes.data);
              
              // The API returns arrays directly, not wrapped in an emails property
              const queuedEmails = Array.isArray(queuedRes.data) ? queuedRes.data : (queuedRes.data.emails || []);
              const sentEmails = Array.isArray(sentRes.data) ? sentRes.data : (sentRes.data.emails || []);
              const totalBuilt = queuedEmails.length + sentEmails.length;
              
              console.log(`[InfoDashboard] Stats for ${normalizedAgent.agentName}: Built=${totalBuilt}, Queued=${queuedEmails.length}, Sent=${sentEmails.length}`);
              
              return {
                ...normalizedAgent,
                emailStats: {
                  built: totalBuilt,
                  queued: queuedEmails.length,
                  sent: sentEmails.length
                }
              };
            } catch (error) {
              console.error(`Error fetching stats for ${normalizedAgent.agentId}:`, error);
            }
            return normalizedAgent;
          })
        );
        
        console.log('[InfoDashboard] Agents with stats:', agentsWithStats);
        setAgents(agentsWithStats);
      }

      // Fetch notifications - filter to only show important ones
      const notificationsResponse = await api.get('/api/notifications');
      if (notificationsResponse.data.success) {
        const allNotifications = notificationsResponse.data.notifications || [];
        // Only show: cycle completions, responses, views, billing, meetings
        const importantNotifications = allNotifications.filter((n: Notification) => 
          n.type === 'cycle_complete' || 
          n.type === 'reply' || 
          n.type === 'view' || 
          n.type === 'billing' || 
          n.type === 'meeting' ||
          n.type === 'payment' ||
          n.severity === 'critical' || 
          n.severity === 'high'
        );
        setNotifications(importantNotifications.slice(0, 5));
      }

      // Note: Agent activities are tracked in the main dashboard page via SSE
      // We don't need a separate API call here
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runningAgents = agents.filter(a => a.status === 'running');
  const maxAgents = 10;

  if (!isMounted || isLoading) {
    return (
      <div className="fixed right-0 top-0 h-screen w-[20%] bg-[#0F1E35]/95 backdrop-blur-xl border-l border-white/10 flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FD1FF]"></div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed right-0 top-0 h-screen w-[20%] bg-[#0F1E35]/95 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden pt-20">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-bold text-xl">Command Center</h2>
        <p className="text-[#8FA6C1] text-sm mt-1">Monitor & Control</p>
      </div>

      {/* Scrollable Content - Agents and Notifications */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Agent Overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#4FD1FF]" />
              Agents
            </h3>
            <span className="text-[#4FD1FF] font-bold text-sm">
              {agents.length}/{maxAgents}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#1B2F52] rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(agents.length / maxAgents) * 100}%` }}
            />
          </div>

          {/* Create Agent Button */}
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all flex items-center justify-center gap-2 mb-4"
          >
            <Plus className="w-4 h-4" />
            Create New Agent
          </button>

          {/* Agent List */}
          <div className="space-y-2">
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-[#4FD1FF]/30 mx-auto mb-3" />
                <p className="text-[#8FA6C1] text-sm">No agents created yet</p>
              </div>
            ) : (
              agents.map(agent => {
                const activity = agentActivities[agent.agentId];
                const isRunning = agent.status === 'running';

                return (
                  <div
                    key={agent.agentId}
                    className="bg-[#1B2F52]/50 backdrop-blur-sm border border-white/5 rounded-lg p-3 hover:border-[#4FD1FF]/30 transition-all cursor-pointer"
                    onClick={() => router.push(`/agents?agent=${agent.agentId}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                        }`} />
                        <span className="text-white font-medium text-sm truncate">{agent.agentName}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#4FD1FF] flex-shrink-0 ml-2" />
                    </div>

                    {/* Targeting Info */}
                    {agent.targeting && (
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Target className="w-3 h-3 text-[#8FA6C1]" />
                          <span className="text-[#8FA6C1] truncate">
                            {agent.targeting.location} • {agent.targeting.industry}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Email Stats */}
                    {agent.emailStats && (
                      <div className="flex items-center gap-3 text-xs mb-2">
                        <div className="flex items-center gap-1 group relative">
                          <Mail className="w-3 h-3 text-[#8FA6C1]" />
                          <span className="text-[#8FA6C1]">{agent.emailStats.built}</span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1B2F52] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Emails Built
                          </div>
                        </div>
                        <div className="flex items-center gap-1 group relative">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400">{agent.emailStats.queued}</span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1B2F52] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Queued
                          </div>
                        </div>
                        <div className="flex items-center gap-1 group relative">
                          <Send className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">{agent.emailStats.sent}</span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1B2F52] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Sent
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Current Activity */}
                    {isRunning && activity?.status && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4FD1FF] animate-pulse" />
                        <span className="text-[#4FD1FF] truncate">{activity.status}</span>
                      </div>
                    )}

                    {!isRunning && (
                      <div className="text-xs text-[#8FA6C1]">Idle</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-[#4FD1FF]" />
              Notifications
            </h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="bg-[#4FD1FF] text-[#0F1E35] text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="text-center py-6">
                <Info className="w-10 h-10 text-[#4FD1FF]/30 mx-auto mb-2" />
                <p className="text-[#8FA6C1] text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.issueId}
                  className={`bg-[#1B2F52]/50 backdrop-blur-sm border rounded-lg p-3 cursor-pointer hover:border-[#4FD1FF]/30 transition-all ${
                    notification.read ? 'border-white/5' : 'border-[#4FD1FF]/20'
                  }`}
                  onClick={() => router.push('/notifications')}
                >
                  <div className="flex items-start gap-2">
                    {notification.severity === 'critical' && (
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    {notification.severity === 'high' && (
                      <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    )}
                    {(notification.severity === 'medium' || notification.severity === 'low') && (
                      <Info className="w-4 h-4 text-[#4FD1FF] flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium mb-0.5 truncate">{notification.title}</p>
                      <p className="text-[#8FA6C1] text-xs line-clamp-2">{notification.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <button
              onClick={() => router.push('/notifications')}
              className="w-full mt-3 px-4 py-2 bg-[#1B2F52] text-[#4FD1FF] rounded-lg font-medium text-xs hover:bg-[#2A4472] transition-all"
            >
              View All Notifications
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions - Fixed at Bottom */}
      <div className="px-6 py-4 border-t border-white/10 bg-[#0F1E35]/95 flex-shrink-0">
        <h3 className="text-white font-semibold text-sm mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button
            onClick={() => router.push('/agents-overview')}
            className="w-full px-4 py-2.5 bg-[#1B2F52] text-white rounded-lg text-sm hover:bg-[#2A4472] transition-all flex items-center gap-2 justify-center"
          >
            <Bot className="w-4 h-4" />
            Manage Agents
          </button>
          <button
            onClick={() => router.push('/outreach')}
            className="w-full px-4 py-2.5 bg-[#1B2F52] text-white rounded-lg text-sm hover:bg-[#2A4472] transition-all flex items-center gap-2 justify-center"
          >
            <Mail className="w-4 h-4" />
            View Outreach
          </button>
        </div>
      </div>
    </div>
    
    {/* Personality Selection Modal */}
    {showOnboarding && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[#0A1628] rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {!selectedPersonality ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Choose Your Agent's Personality</h2>
              <p className="text-gray-400 mb-6">Select the personality type that best matches your outreach style</p>
              
              <div className="grid grid-cols-5 gap-4">
                {PERSONALITY_TYPES.map((personality) => (
                  <button
                    key={personality.id}
                    onClick={() => setSelectedPersonality(personality.id)}
                    className="relative p-6 rounded-2xl text-center transition-all bg-[#1B2F52]/90 backdrop-blur-md border shadow-lg hover:shadow-xl border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-105"
                  >
                    {/* Avatar */}
                    <div className="relative mx-auto mb-4">
                      <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-${personality.color}-500 to-${personality.color}-600 p-1 mx-auto`}>
                        <img
                          src={personality.avatar}
                          alt={personality.name}
                          className="w-full h-full rounded-full object-cover bg-white"
                        />
                      </div>
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-bold mb-2 text-white">
                      {personality.name}
                    </h3>

                    {/* Description */}
                    <p className="text-xs mb-3 leading-relaxed text-[#A3B4CC]">
                      {personality.description}
                    </p>

                    {/* Traits */}
                    <div className="space-y-1">
                      {personality.traits.slice(0, 2).map((trait, idx) => (
                        <div
                          key={idx}
                          className="text-[10px] px-2 py-1 rounded-full font-medium text-white"
                          style={{
                            background: `linear-gradient(to right, rgb(${personality.color === 'red' ? '239, 68, 68' : personality.color === 'blue' ? '59, 130, 246' : personality.color === 'purple' ? '168, 85, 247' : personality.color === 'green' ? '34, 197, 94' : '99, 102, 241'}, ${personality.color === 'red' ? '220, 38, 38' : personality.color === 'blue' ? '37, 99, 235' : personality.color === 'purple' ? '147, 51, 234' : personality.color === 'green' ? '22, 163, 74' : '79, 70, 229'})`
                          }}
                        >
                          {trait}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowOnboarding(false)}
                className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
            </>
          ) : showPresetSelection ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Choose a Preset (Optional)</h2>
              <p className="text-gray-400 mb-6">Apply targeting settings to your agent</p>
              
              {loadingPresets ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#3B82F6] border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-400">Loading presets...</p>
                </div>
              ) : !Array.isArray(presets) || presets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No presets available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto mb-6">
                  {presets.map((preset) => (
                    <button
                      key={preset._id || preset.id}
                      onClick={() => setSelectedPreset(preset)}
                      className={`relative text-left p-4 rounded-lg border-2 transition-all ${
                        selectedPreset?._id === preset._id || selectedPreset?.id === preset.id
                          ? 'border-[#4FD1FF] bg-[#1B2F52] ring-2 ring-[#4FD1FF]/30'
                          : 'border-[#1B2F52] bg-[#0F1F3A] hover:border-[#3B82F6]'
                      }`}
                    >
                      {(selectedPreset?._id === preset._id || selectedPreset?.id === preset.id) && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-[#4FD1FF] rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-[#0F1E35]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <h3 className="text-white font-semibold mb-1 pr-8">{preset.name}</h3>
                      <div className="text-xs text-gray-400 space-y-1">
                        {preset.targetIndustries && preset.targetIndustries.length > 0 && (
                          <div>Industries: {preset.targetIndustries.slice(0, 2).join(', ')}{preset.targetIndustries.length > 2 ? '...' : ''}</div>
                        )}
                        {preset.targetPositions && preset.targetPositions.length > 0 && (
                          <div>Positions: {preset.targetPositions.slice(0, 2).join(', ')}{preset.targetPositions.length > 2 ? '...' : ''}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPresetSelection(false);
                    setSelectedPreset(null);
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                  disabled={isCreatingAgent}
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    if (!agentName.trim()) return;
                    
                    setIsCreatingAgent(true);
                    
                    const personality = PERSONALITY_TYPES.find(p => p.id === selectedPersonality);
                    const tempAgentId = `temp-${Date.now()}`;
                    
                    // Optimistic update - add agent immediately to UI
                    const optimisticAgent: Agent = {
                      agentId: tempAgentId,
                      agentName: agentName,
                      status: 'stopped',
                      targeting: {
                        location: selectedPreset?.targetLocations?.[0] || 'Configuring...',
                        industry: selectedPreset?.targetIndustries?.[0] || 'Setting up...',
                        keywords: []
                      },
                      emailStats: {
                        built: 0,
                        queued: 0,
                        sent: 0
                      }
                    };
                    
                    setAgents(prev => [...prev, optimisticAgent]);
                    
                    // Close modal immediately for better UX
                    setShowOnboarding(false);
                    setSelectedPersonality(null);
                    setAgentName('');
                    setShowPresetSelection(false);
                    setSelectedPreset(null);
                    
                    try {
                      const agentData: any = {
                        name: agentName,
                        type: 'lead-agent',
                        personality: {
                          type: personality?.id,
                          name: personality?.name,
                          description: personality?.description,
                          avatar: personality?.avatar,
                          emailPrompt: personality?.prompt,
                          emailStyle: 'professional',
                          traits: personality?.traits,
                          color: personality?.color
                        }
                      };
                      
                      if (selectedPreset) {
                        agentData.preset = {
                          presetId: selectedPreset._id || selectedPreset.id,
                          name: selectedPreset.name,
                          targetIndustries: selectedPreset.targetIndustries,
                          targetPositions: selectedPreset.targetPositions,
                          companySizeMin: selectedPreset.companySizeMin,
                          companySizeMax: selectedPreset.companySizeMax,
                          leadLimit: selectedPreset.leadLimit,
                          emailLength: selectedPreset.emailLength,
                          callToAction: selectedPreset.callToAction,
                          personalizationLevel: selectedPreset.personalizationLevel,
                          ccEmails: selectedPreset.ccEmails,
                          bccEmails: selectedPreset.bccEmails,
                          followupIntervalDays: selectedPreset.followupIntervalDays,
                          enableAutoResponse: selectedPreset.enableAutoResponse
                        };
                      }
                      
                      const response = await api.post('/api/auth/create-agent', agentData);
                      
                      // Replace temp agent with real data
                      if (response.data.success) {
                        fetchData();
                      }
                    } catch (error) {
                      console.error('Error creating agent:', error);
                      // Remove optimistic agent on error
                      setAgents(prev => prev.filter(a => a.agentId !== tempAgentId));
                    } finally {
                      setIsCreatingAgent(false);
                    }
                  }}
                  disabled={isCreatingAgent}
                  className="flex-1 px-6 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isCreatingAgent && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {isCreatingAgent ? 'Creating...' : selectedPreset ? 'Create with Preset' : 'Skip & Create'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Name Your Agent</h2>
              <p className="text-gray-400 mb-6">Choose a name for your {PERSONALITY_TYPES.find(p => p.id === selectedPersonality)?.name}</p>
              
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Enter agent name..."
                className="w-full px-4 py-3 bg-[#0F1F3A] border border-[#1B2F52] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3B82F6]"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && agentName.trim()) {
                    setShowPresetSelection(true);
                    fetchPresets();
                  }
                }}
              />
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedPersonality(null);
                    setAgentName('');
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (!agentName.trim()) return;
                    setShowPresetSelection(true);
                    fetchPresets();
                  }}
                  disabled={!agentName.trim()}
                  className="flex-1 px-6 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </>
  );
}
