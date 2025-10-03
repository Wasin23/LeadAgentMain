'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon, 
  CogIcon, 
  PlayIcon, 
  StopIcon,
  ChartBarIcon,
  UsersIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  createdAt: string;
  lastRun?: string;
  totalEmails: number;
  successRate: number;
}

interface AgentManagerProps {
  onSelectAgent: (agentId: string) => void;
}

export const AgentManager: React.FC<AgentManagerProps> = ({ onSelectAgent }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newAgentName, setNewAgentName] = useState('');

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      // For now, we'll create a mock agent list since the backend has one main agent
      // Later this can be expanded to support multiple agents
      const response = await api.get('/lead-agent/status');
      const mainAgent: Agent = {
        id: 'main',
        name: 'Main Lead Agent',
        status: response.data.isActive ? 'running' : 'stopped',
        createdAt: '2025-01-01',
        lastRun: response.data.lastRun,
        totalEmails: response.data.totalEmailsSent || 0,
        successRate: response.data.successRate || 85
      };
      setAgents([mainAgent]);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      // Fallback mock data
      setAgents([{
        id: 'main',
        name: 'Main Lead Agent',
        status: 'stopped',
        createdAt: '2025-01-01',
        totalEmails: 0,
        successRate: 0
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const createAgent = async () => {
    if (!newAgentName.trim()) return;
    
    const newAgent: Agent = {
      id: Date.now().toString(),
      name: newAgentName.trim(),
      status: 'stopped',
      createdAt: new Date().toISOString(),
      totalEmails: 0,
      successRate: 0
    };
    
    setAgents(prev => [...prev, newAgent]);
    setNewAgentName('');
    setShowCreateModal(false);
  };

  const toggleAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      if (agent.status === 'running') {
        await api.post('/lead-agent/stop');
      } else {
        await api.post('/lead-agent/start');
      }
      
      setAgents(prev => prev.map(a => 
        a.id === agentId 
          ? { ...a, status: a.status === 'running' ? 'stopped' : 'running' }
          : a
      ));
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running': return 'text-green-500 bg-green-500/10';
      case 'stopped': return 'text-gray-500 bg-gray-500/10';
      case 'paused': return 'text-yellow-500 bg-yellow-500/10';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Agent Manager</h1>
          <p className="text-gray-600 mt-1">Manage and monitor your lead generation agents</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Agent
        </motion.button>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {agents.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectAgent(agent.id)}
            >
              <div className="p-6">
                {/* Agent Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <UsersIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-3">
                      <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                        <div className={`h-2 w-2 rounded-full mr-1 ${agent.status === 'running' ? 'bg-green-500' : agent.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-500'}`}></div>
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </div>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAgent(agent.id);
                    }}
                    className={`p-2 rounded-full ${
                      agent.status === 'running' 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {agent.status === 'running' ? (
                      <StopIcon className="h-5 w-5" />
                    ) : (
                      <PlayIcon className="h-5 w-5" />
                    )}
                  </motion.button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{agent.totalEmails}</div>
                    <div className="text-sm text-gray-500">Total Emails</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{agent.successRate}%</div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                  </div>
                </div>

                {/* Last Run */}
                {agent.lastRun && (
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    Last run: {new Date(agent.lastRun).toLocaleDateString()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAgent(agent.id);
                    }}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <CogIcon className="h-4 w-4 mr-1" />
                    Manage
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Show analytics for this agent
                    }}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <ChartBarIcon className="h-4 w-4 mr-1" />
                    Analytics
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Create Agent Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Create New Agent</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Enter agent name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createAgent}
                  disabled={!newAgentName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Agent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};