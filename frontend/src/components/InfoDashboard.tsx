'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Bot, Plus, ExternalLink, Power, Target, Mail, Clock, AlertCircle, Send, X, Pencil as PencilIcon, User } from 'lucide-react';
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
  settings?: {
    emailBuilder?: {
      useGmail?: boolean;
    };
    targeting?: {
      leadLimit?: number;
    };
    geographicSettings?: {
      leadLimit?: number;
    };
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

interface InfoDashboardProps {
  agents?: Agent[];
  agentActivities?: {[key: string]: any};
  showGlobe?: boolean;
  setShowGlobe?: (show: boolean) => void;
}

export default function InfoDashboard({ agents: propsAgents, agentActivities: propsAgentActivities, showGlobe, setShowGlobe }: InfoDashboardProps = {}) {
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
  const [editingLeadLimit, setEditingLeadLimit] = useState<{ agentId: string; currentLimit: number } | null>(null);
  const [newLeadLimit, setNewLeadLimit] = useState<number | string>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Connect to SSE for agent activities
  useEffect(() => {
    if (!isMounted) return;
    
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const authToken = localStorage.getItem('authToken');
    const eventSource = new EventSource(`${backendUrl}/api/monitoring/stream?token=${encodeURIComponent(authToken || '')}`);
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        const activityData = data.type === 'agent_activity' ? data : 
                            (data.type === 'activity_added' && data.data?.type === 'agent_activity') ? data.data : 
                            null;
        
        if (activityData && activityData.agentId) {
          setAgentActivities(prev => ({
            ...prev,
            [activityData.agentId]: {
              status: activityData.cardMessage || activityData.details,
              timestamp: Date.now(),
              isActive: true
            }
          }));
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    return () => eventSource.close();
  }, [isMounted]);

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
    
    // If agents are passed as props, enrich them with email stats
    if (propsAgents && propsAgentActivities) {
      console.log('[InfoDashboard] Using props agents:', propsAgents);
      setAgentActivities(propsAgentActivities);
      
      // Enrich props agents with email stats
      enrichAgentsWithStats(propsAgents);
      return;
    }
    
    console.log('[InfoDashboard] useEffect triggered, calling fetchData');
    fetchData();
    const interval = setInterval(fetchData, 15000); // Increased to 15 seconds to reduce AWS throughput
    return () => clearInterval(interval);
  }, [isMounted, propsAgents, propsAgentActivities]);

  const enrichAgentsWithStats = async (agentsList: Agent[]) => {
    try {
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
              api.get(`/api/email-queue/queue?agentId=${normalizedAgent.agentId}`).catch(err => {
                console.error(`Failed to fetch queue for ${normalizedAgent.agentId}:`, err);
                return { data: [] };
              }),
              api.get(`/api/email-queue/sent?agentId=${normalizedAgent.agentId}`).catch(err => {
                console.error(`Failed to fetch sent for ${normalizedAgent.agentId}:`, err);
                return { data: [] };
              })
            ]);
            
            const queuedEmails = Array.isArray(queuedRes.data) ? queuedRes.data : (queuedRes.data.emails || []);
            const sentEmails = Array.isArray(sentRes.data) ? sentRes.data : (sentRes.data.emails || []);
            const totalBuilt = queuedEmails.length + sentEmails.length;
            
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
            // Always return emailStats even on error to prevent disappearing
            return {
              ...normalizedAgent,
              emailStats: {
                built: 0,
                queued: 0,
                sent: 0
              }
            };
          }
        })
      );
      
      setAgents(agentsWithStats);
      setIsLoading(false);
    } catch (error) {
      console.error('Error enriching agents with stats:', error);
      setAgents(agentsList);
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    console.log('[InfoDashboard] fetchData called');
    try {
      // Fetch agents
      const agentsResponse = await api.get('/api/auth/agents');
      console.log('[InfoDashboard] Agents response:', agentsResponse.data);
      if (agentsResponse.data.success) {
        const agentsList = agentsResponse.data.agents || [];
        console.log('[InfoDashboard] Agents list:', agentsList);
        
        await enrichAgentsWithStats(agentsList);
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
      <div className="sm:fixed relative sm:left-auto sm:right-0 sm:top-0 h-auto sm:h-screen w-full lg:w-[20%] bg-[#0F1E35]/95 backdrop-blur-xl lg:border-l border-white/10 flex items-center justify-center p-8 sm:p-0 sm:pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FD1FF]"></div>
      </div>
    );
  }

  return (
    <>
      <div className="sm:fixed relative sm:left-auto sm:right-0 sm:top-0 h-auto sm:h-screen w-full lg:w-[20.75%] bg-[#0F1E35]/95 backdrop-blur-xl lg:border-l border-white/20 flex flex-col overflow-y-auto sm:pt-4 z-40">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-bold text-xl">Active Agents</h2>

        {/* Active Agents Display */}
        <div className="mt-4 rounded-xl">
          {agents.filter(a => a.agentId !== 'orphan' && (agentActivities[a.agentId]?.isActive || a.status === 'running')).length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {agents
                .filter(a => a.agentId !== 'orphan' && (agentActivities[a.agentId]?.isActive || a.status === 'running'))
                .slice(0, 5)
                .map((agent) => (
                  <div key={agent.agentId} className="relative">
                    {((agent as any).avatar || (agent as any).personality?.avatar) ? (
                      <img
                        src={(agent as any).avatar || (agent as any).personality?.avatar}
                        alt={agent.agentName}
                        className="w-12 h-12 rounded-full border-2 border-[#4FD1FF]/60 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4FD1FF] to-[#2A8FB9] flex items-center justify-center text-white font-bold text-sm border-2 border-[#4FD1FF]/60">
                        {agent.agentName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0F1E35] animate-pulse" />
                  </div>
                ))}
              {agents.filter(a => a.agentId !== 'orphan' && (agentActivities[a.agentId]?.isActive || a.status === 'running')).length > 5 && (
                <div className="w-12 h-12 rounded-full bg-[#1B2F52] flex items-center justify-center border-2 border-[#4FD1FF]/40">
                  <span className="text-[#4FD1FF] text-xs font-bold">
                    +{agents.filter(a => a.agentId !== 'orphan' && (agentActivities[a.agentId]?.isActive || a.status === 'running')).length - 5}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[#8FA6C1] text-sm">None</div>
          )}
        </div>
      </div>

      {/* Scrollable Content - Agents and Notifications */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 max-h-[calc(100vh-200px)] sm:max-h-none">
        {/* Agent Overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#4FD1FF]" />
              Agents
            </h3>
            <span className="text-[#4FD1FF] font-bold text-sm">
              {agents.filter(a => a.agentId !== 'orphan').length}/{maxAgents}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#1B2F52] rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(agents.filter(a => a.agentId !== 'orphan').length / maxAgents) * 100}%` }}
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
            {agents.filter(a => !(a.status === 'orphaned' && a.agentId !== 'orphan')).length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-[#4FD1FF]/30 mx-auto mb-3" />
                <p className="text-[#8FA6C1] text-sm">No agents created yet</p>
              </div>
            ) : (
              agents.filter(a => !(a.status === 'orphaned' && a.agentId !== 'orphan')).map(agent => {
                const activity = agentActivities[agent.agentId];
                const isRunning = agent.status === 'running';
                const isOrphaned = agent.status === 'orphaned';

                return (
                  <div
                    key={agent.agentId}
                    className={`backdrop-blur-sm border rounded-lg p-3 hover:border-[#4FD1FF]/30 transition-all cursor-pointer ${
                      isOrphaned 
                        ? 'bg-yellow-500/10 border-yellow-500/40' 
                        : 'bg-[#1B2F52]/50 border-white/5'
                    }`}
                    onClick={() => {
                      if (isOrphaned) {
                        // Navigate to dashboard to view orphaned emails
                        router.push('/dashboard?view=orphaned-emails');
                      } else {
                        router.push(`/agents?agent=${agent.agentId}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isOrphaned ? 'bg-yellow-400 animate-pulse' : 
                          isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                        }`} />
                        <span className={`font-medium text-sm truncate ${
                          isOrphaned ? 'text-yellow-400' : 'text-white'
                        }`}>{agent.agentName}</span>
                        {!isOrphaned && agent.settings?.emailBuilder?.useGmail === true ? (
                          <span className="relative group/gmail inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-white text-[9px] border border-white/20 flex-shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 256 193" fill="none">
                              <path d="M58.182 192.05V93.768L27.507 65.158L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4"/>
                              <path d="M197.818 192.05h40.727c9.659 0 17.455-7.854 17.455-17.455V49.504l-31.274 17.278-27.506 28.61Z" fill="#34A853"/>
                              <path d="M197.818 49.504V93.768l58.182-44.264V34.91c0-21.585-24.641-33.89-41.89-20.945Z" fill="#FBBC04"/>
                              <path d="M58.182 93.768V49.504L128 105.23l69.818-55.726v44.264L128 149.494Z" fill="#EA4335"/>
                              <path d="M0 34.91v14.594l58.182 44.264V49.504L40.727 37.072C23.478 24.019-.001 36.324 0 34.91Z" fill="#C5221F"/>
                            </svg>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/gmail:opacity-100 transition-opacity pointer-events-none z-50">
                              Gmail sending enabled
                            </span>
                          </span>
                        ) : !isOrphaned ? (
                          <span className="relative group/domain inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] border border-purple-500/40 flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/domain:opacity-100 transition-opacity pointer-events-none z-50">
                              Meridian domain sending enabled
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Lead Limit per Cycle */}
                        {!isOrphaned && (agent.settings?.targeting?.leadLimit || agent.settings?.geographicSettings?.leadLimit) && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentLimit = agent.settings?.targeting?.leadLimit || agent.settings?.geographicSettings?.leadLimit || 10;
                                setEditingLeadLimit({ agentId: agent.agentId, currentLimit });
                                setNewLeadLimit(currentLimit);
                              }}
                              className="flex items-center gap-1 text-[10px] text-[#4FD1FF] hover:text-[#6BE3FF] transition-colors group"
                            >
                              <User className="w-3 h-3" />
                              <span>{agent.settings?.targeting?.leadLimit || agent.settings?.geographicSettings?.leadLimit}/cycle</span>
                              <PencilIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            
                            {/* Inline Edit Modal */}
                            {editingLeadLimit?.agentId === agent.agentId && (
                              <div className="absolute top-full right-0 mt-1 bg-[#1B2F52] rounded-lg shadow-xl border border-[#4FD1FF]/30 p-3 z-50 w-48">
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={newLeadLimit}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setNewLeadLimit('');
                                    } else {
                                      const num = parseInt(val);
                                      setNewLeadLimit(isNaN(num) ? '' : num);
                                    }
                                  }}
                                  className="w-full px-2 py-1 bg-[#0F1F3A] border border-[#1B2F52] rounded text-white text-xs focus:outline-none focus:border-[#4FD1FF] mb-2"
                                  autoFocus
                                  placeholder="1-100"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingLeadLimit(null);
                                    }}
                                    className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-all"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      
                                      // Validate input
                                      const limitValue = typeof newLeadLimit === 'string' ? parseInt(newLeadLimit) : newLeadLimit;
                                      if (isNaN(limitValue) || limitValue < 1 || limitValue > 100) {
                                        alert('Please enter a valid lead limit between 1 and 100');
                                        return;
                                      }

                                      // Get current settings
                                      const currentAgent = agents.find(a => a.agentId === editingLeadLimit.agentId);
                                      if (!currentAgent) {
                                        alert('Agent not found');
                                        return;
                                      }

                                      const updatedSettings = {
                                        ...currentAgent.settings,
                                        geographicSettings: {
                                          ...currentAgent.settings?.geographicSettings,
                                          leadLimit: limitValue
                                        }
                                      };

                                      // Optimistic update - update UI immediately
                                      setAgents(prev => prev.map(a => 
                                        a.agentId === editingLeadLimit.agentId
                                          ? {
                                              ...a,
                                              settings: updatedSettings
                                            }
                                          : a
                                      ));
                                      
                                      setEditingLeadLimit(null);

                                      // API call in background
                                      api.post('/api/lead-agent/settings', {
                                        agentId: editingLeadLimit.agentId,
                                        ...updatedSettings
                                      }).catch((error: any) => {
                                        console.error('Error updating lead limit:', error);
                                        // Revert on error
                                        setAgents(prev => prev.map(a => 
                                          a.agentId === editingLeadLimit.agentId
                                            ? currentAgent
                                            : a
                                        ));
                                        alert('Failed to update lead limit: ' + (error.response?.data?.message || error.message));
                                      });
                                    }}
                                    disabled={!newLeadLimit || (typeof newLeadLimit === 'number' && (newLeadLimit < 1 || newLeadLimit > 100))}
                                    className="flex-1 px-2 py-1 bg-[#4FD1FF] hover:bg-[#6BE3FF] disabled:bg-gray-600 disabled:cursor-not-allowed text-[#0F1E35] font-semibold rounded text-xs transition-all"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {!isOrphaned && (
                          <ExternalLink className="w-3.5 h-3.5 text-[#4FD1FF] flex-shrink-0" />
                        )}
                        {isOrphaned && (
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Targeting Info */}
                    {!isOrphaned && agent.targeting && (
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
                    <div className="flex items-center gap-3 text-xs mb-2">
                      <div className="flex items-center gap-1 group relative">
                        <Mail className="w-3 h-3 text-[#8FA6C1]" />
                        <span className="text-[#8FA6C1]">{agent.emailStats?.built || 0}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1B2F52] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          Emails Built
                        </div>
                      </div>
                      <div className="flex items-center gap-1 group relative">
                        <Clock className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400">{agent.emailStats?.queued || 0}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1B2F52] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          Queued
                        </div>
                      </div>
                      <div className="flex items-center gap-1 group relative">
                        <Send className="w-3 h-3 text-green-400" />
                        <span className="text-green-400">{agent.emailStats?.sent || 0}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1B2F52] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          Sent
                        </div>
                      </div>
                    </div>

                    {/* Cycle Countdown */}
                    {!isOrphaned && agent.status === 'running' && activity?.nextCycleTime && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#4FD1FF] mb-2">
                        <Clock className="w-3 h-3" />
                        <span>Next cycle: {activity.nextCycleTime}</span>
                      </div>
                    )}

                    {/* Current Activity */}
                    {!isOrphaned && (
                      <div className="flex items-center gap-1.5 text-xs">
                        {activity?.status ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-green-400 font-medium">Active</span>
                            <span className="text-[#8FA6C1] mx-1">·</span>
                            <span className="text-[#4FD1FF] truncate">{activity.status}</span>
                          </>
                        ) : (
                          <div className="text-[#8FA6C1]">Idle</div>
                        )}
                      </div>
                    )}
                    
                    {isOrphaned && (
                      <div className="text-xs text-yellow-400/80 italic">From deleted agents</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
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
            onClick={() => {
              router.push('/profile');
              // Trigger visual feedback
              const btn = document.activeElement as HTMLButtonElement;
              if (btn) btn.blur();
            }}
            className="w-full px-4 py-2.5 bg-[#1B2F52] text-white rounded-lg text-sm hover:bg-[#2A4472] transition-all flex items-center gap-2 justify-center active:scale-95"
          >
            <User className="w-4 h-4" />
            Edit Profile
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto mb-6 p-2">
                  {presets.map((preset) => (
                    <button
                      key={preset._id || preset.id}
                      onClick={() => setSelectedPreset(preset)}
                      className={`relative text-left p-3 rounded-lg border-2 transition-all ${
                        selectedPreset && ((selectedPreset._id && selectedPreset._id === preset._id) || (selectedPreset.id && selectedPreset.id === preset.id))
                          ? 'border-[#4FD1FF] bg-[#1B2F52] ring-2 ring-[#4FD1FF]/30'
                          : 'border-[#1B2F52] bg-[#0F1F3A] hover:border-[#3B82F6]'
                      }`}
                    >
                      {selectedPreset && ((selectedPreset._id && selectedPreset._id === preset._id) || (selectedPreset.id && selectedPreset.id === preset.id)) && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-[#4FD1FF] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#0F1E35]" fill="currentColor" viewBox="0 0 20 20">
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
                        type: 'reasoning-lead-agent',
                        specialInstructions: selectedPreset?.specialInstructions || '',
                        // Don't send useGmail - let backend use user's default setting from preferences
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
                          enableAutoResponse: selectedPreset.enableAutoResponse,
                          useCustomSignature: selectedPreset.useCustomSignature,
                          signatureName: selectedPreset.signatureName,
                          signatureTitle: selectedPreset.signatureTitle
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
