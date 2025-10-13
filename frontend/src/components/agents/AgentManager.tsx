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

interface AgentManagerProps {
  onSelectAgent: (agentId: string) => void;
}

export default function AgentManager({ onSelectAgent }: AgentManagerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchAgents();
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
      
      if (response.data.success && response.data.agents) {
        // Convert AWS agents to frontend Agent format and fetch email stats
        const awsAgents = await Promise.all(
          response.data.agents.map(async (agent: any) => {
            const emailStats = await fetchEmailStats(agent.agentId);
            return {
              id: agent.agentId,
              name: agent.name,
              status: agent.status === 'active' ? 'stopped' : 'stopped', // All start as stopped
              emailsQueued: emailStats.emailsQueued,
              emailsSent: emailStats.emailsSent,
              meetingsScheduled: emailStats.meetingsScheduled,
              lastRun: agent.lastRun
            };
          })
        );
        
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

  const createAgent = async (personality: PersonalityType, customName: string) => {
    try {
      // Call backend API to create agent in AWS
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
        const agentData = response.data.agent;
        
        // Create agent object for frontend
        const newAgent: Agent = {
          id: agentData.agentId,
          name: customName,
          status: 'stopped',
          emailsQueued: 0,
          emailsSent: 0,
          meetingsScheduled: 0,
        };
        
        // Update local state
        setAgents(prev => [...prev, newAgent]);
        setShowPersonalitySelector(false);
        
        console.log('✅ Agent created successfully:', agentData);
      } else {
        throw new Error(response.data.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert('Failed to create agent. Please try again.');
    }
  };

  const toggleAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      // Only toggle the main agent through API
      if (agentId === 'lead-agent-main') {
        let response;
        if (agent.status === 'running') {
          console.log('🛑 Stopping agent...');
          response = await api.post('/api/lead-agent/stop', { agentId });
        } else {
          console.log('▶️ Starting agent...');
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
      } else {
        // For non-main agents, just toggle locally
        setAgents(prev => prev.map(a => 
          a.id === agentId 
            ? { ...a, status: a.status === 'running' ? 'stopped' : 'running' }
            : a
        ));
      }
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
      <div className="bg-white border border-neutral-200">
        <div className="border-b border-neutral-200 p-4">
          <h3 className="text-lg font-medium text-neutral-900">Active Agents</h3>
        </div>
        
        <div className="divide-y divide-neutral-200">
          <AnimatePresence>
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 hover:bg-neutral-50 cursor-pointer"
                onClick={() => onSelectAgent(agent.id)}
              >
                {/* Agent Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-neutral-100 border border-neutral-300 rounded-full flex items-center justify-center text-lg overflow-hidden" style={{ borderWidth: '1px' }}>
                      {(agent.personality?.avatar && (agent.personality.avatar.startsWith('http') || agent.personality.avatar.startsWith('/avatars/'))) ? (
                        <img 
                          src={agent.personality.avatar} 
                          alt={agent.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">{agent.personality?.avatar || '👤'}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-neutral-900">{agent.name}</h3>
                      <div className={`inline-flex items-center px-2 py-1 text-xs font-medium border ${getStatusColor(agent.status)}`}>
                        <div className={`h-2 w-2 rounded-full mr-1 ${
                          agent.status === 'running' ? 'bg-green-500' : 
                          agent.status === 'paused' ? 'bg-yellow-500' : 'bg-neutral-500'
                        }`}></div>
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </div>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAgent(agent.id);
                    }}
                    className={`p-2 ${
                      agent.status === 'running' 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                        : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    {agent.status === 'running' ? (
                      <StopIcon className="h-4 w-4" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                  </motion.button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="text-sm font-medium text-neutral-700">{agent.emailsQueued}</div>
                    <div className="text-xs text-neutral-600">Queued</div>
                  </div>
                  <div className="text-center p-2 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="text-sm font-medium text-neutral-700">{agent.emailsSent}</div>
                    <div className="text-xs text-neutral-600">Sent</div>
                  </div>
                  <div className="text-center p-2 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="text-sm font-medium text-neutral-700">{agent.meetingsScheduled}</div>
                    <div className="text-xs text-neutral-600">Meetings</div>
                  </div>
                </div>

                {/* Last Run */}
                {agent.lastRun && (
                  <div className="flex items-center text-sm text-neutral-500 mb-4">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    Last run: {new Date(agent.lastRun).toLocaleDateString()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAgent(agent.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 transition-colors border border-neutral-200"
                  >
                    <CogIcon className="h-4 w-4" />
                    Manage
                  </button>
                  {agent.id !== 'lead-agent-main' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showDeleteConfirmation(agent);
                      }}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Show analytics for this agent
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    <ChartBarIcon className="h-4 w-4" />
                    Analytics
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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