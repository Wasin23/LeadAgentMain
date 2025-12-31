'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Bot, Plus, ExternalLink, Power, Target, Mail, Clock, AlertCircle, Send } from 'lucide-react';
import api from '@/lib/api';

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

  useEffect(() => {
    console.log('[InfoDashboard] useEffect triggered, calling fetchData');
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

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
              const queueResponse = await api.get(`/api/email-queue?agentId=${normalizedAgent.agentId}`);
              if (queueResponse.data.success) {
                const emails = queueResponse.data.emails || [];
                return {
                  ...normalizedAgent,
                  emailStats: {
                    built: emails.length,
                    queued: emails.filter((e: any) => e.status === 'pending').length,
                    sent: emails.filter((e: any) => e.status === 'sent').length
                  }
                };
              }
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

  if (isLoading) {
    return (
      <div className="fixed right-0 top-0 h-screen w-[20%] bg-[#0F1E35]/95 backdrop-blur-xl border-l border-white/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FD1FF]"></div>
      </div>
    );
  }

  return (
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
            onClick={() => router.push('/agents')}
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
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#8FA6C1]" />
                          <span className="text-[#8FA6C1]">{agent.emailStats.built}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400">{agent.emailStats.queued}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Send className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">{agent.emailStats.sent}</span>
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
            onClick={() => router.push('/agents')}
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
  );
}
