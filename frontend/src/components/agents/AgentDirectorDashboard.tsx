'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, ChatBubbleLeftRightIcon, ChartBarIcon, BellIcon, BoltIcon } from '@heroicons/react/24/outline';
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

import MonitoringSidebar, { MonitoringView } from './MonitoringSidebar';
import MonitoringContent from './MonitoringContent';

export default function AgentDirectorDashboard({ onSelectAgent }: AgentDirectorDashboardProps) {
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);
  
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

  useEffect(() => {
    fetchAgents();
    
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
    };
  }, []);
  
  const handleMonitoringEvent = useCallback((message: any) => {
    const { type, data } = message;
    
    switch (type) {
      case 'initial_metrics':
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

  const refreshMonitoringMetrics = async () => {
    try {
      const response = await api.get('/api/monitoring/metrics');
      if (response.data) {
        setMonitoringMetrics(response.data);
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
        if (agent) {
          allEmails = allEmails.map((email: any) => ({
            ...email,
            _agentInfo: {
              id: agent.id,
              name: agent.personality?.name || agent.name,
              customName: agent.name,
              avatar: agent.personality?.avatar,
              color: agent.personality?.color
            }
          }));
        }
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
      <div className="relative z-10">
        <MonitoringSidebar 
          activeView={monitoringView}
          onViewChange={setMonitoringView}
          issueCount={issues.filter(i => !i.resolved).length}
          connected={monitoringConnected}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1">
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
                        {monitoringMetrics.emails?.queued || 0}
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
                        {monitoringMetrics.emails?.sent || 0}
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
                        {monitoringMetrics.emails?.replied || 0}
                      </div>
                      <div className="text-[10px] text-neutral-600 uppercase">
                        Replied
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leads */}
              <div className="bg-white/80 backdrop-blur rounded-lg p-4 border border-white/50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">LEADS</span>
                  <BoltIcon className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-900">
                    {monitoringMetrics.leads?.found || 0}
                  </span>
                  <span className="text-xs text-neutral-500">found</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {monitoringMetrics.leads?.contacted || 0} contacted
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
          {/* Show Monitoring Content for non-overview views */}
          {monitoringView !== 'overview' ? (
            <MonitoringContent 
              view={monitoringView}
              metrics={monitoringMetrics}
              issues={issues}
              connected={monitoringConnected}
            />
          ) : (
            /* Agent Grid for overview */
            agents.length === 0 ? (
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
                    <div 
                      className="text-center cursor-pointer hover:bg-neutral-50 rounded p-1 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQueueClick(agent.id, agent.personality?.name || agent.name, 'queued');
                      }}
                    >
                      <div className="text-base font-semibold text-neutral-900">{agent.emailsQueued}</div>
                      <div className="text-xs text-neutral-600">Queued</div>
                    </div>
                    <div 
                      className="text-center cursor-pointer hover:bg-neutral-50 rounded p-1 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQueueClick(agent.id, agent.personality?.name || agent.name, 'sent');
                      }}
                    >
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
          )
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
              <button
                onClick={() => setSelectedQueue(null)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-2 hover:bg-neutral-200 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                {selectedEmailDetail._agentInfo && (
                  <p className="text-sm text-neutral-600 mt-1">{selectedEmailDetail._agentInfo.name}</p>
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

                {selectedEmailDetail.lead && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedEmailDetail.lead.name && (
                      <div>
                        <label className="text-xs font-medium text-neutral-600 uppercase">Lead Name</label>
                        <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.lead.name}</p>
                      </div>
                    )}
                    {selectedEmailDetail.lead.company && (
                      <div>
                        <label className="text-xs font-medium text-neutral-600 uppercase">Company</label>
                        <p className="text-sm text-neutral-900 mt-1">{selectedEmailDetail.lead.company}</p>
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
    </div>
  );
}