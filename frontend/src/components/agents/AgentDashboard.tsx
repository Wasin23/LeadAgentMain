'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayIcon, 
  StopIcon, 
  ArrowPathIcon,
  CogIcon,
  ChartBarIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  EyeIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import AgentSettingsModal from './AgentSettingsModal';

interface AgentDashboardProps {
  agentId: string;
  onBack: () => void;
}

// @ts-ignore - Next.js function prop serialization warning
// These are client components, function props are valid

interface AgentStatus {
  isActive: boolean;
  lastRun?: string;
  currentInterval: number;
  totalEmailsSent: number;
  successRate: number;
  currentProgress?: {
    stage: string;
    progress: number;
    message: string;
  };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  stage?: string;
}

interface EmailContact {
  id: string;
  name: string;
  company: string;
  email: string;
  dateSent: string;
  opened: boolean;
  replied: boolean;
  status: 'sent' | 'opened' | 'replied' | 'bounced';
}

export default function AgentDashboard({ agentId, onBack }: AgentDashboardProps) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailContact[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<EventSource | null>(null);

  // Get the actual agent name
  const getAgentDisplayName = () => {
    if (agentName) return agentName; // Use the actual name if available
    if (agentId === 'main' || agentId === 'lead-agent-main') return 'Reasoning Lead Agent';
    // Fallback: Convert camelCase or kebab-case to Title Case
    return agentId
      .replace(/^agent-/, '') // Remove agent- prefix
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
      .trim();
  };

  useEffect(() => {
    fetchData();
    fetchAgentName();
    
    // Set up real-time progress streaming
    if (agentId === 'main') {
      setupProgressStream();
    }
    
    const statusInterval = setInterval(fetchStatus, 10000);
    
    return () => {
      clearInterval(statusInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [agentId]);

  const fetchAgentName = () => {
    try {
      if (agentId === 'main' || agentId === 'lead-agent-main') {
        setAgentName('Reasoning Lead Agent');
        return;
      }
      
      // For custom agents, get the name from localStorage
      const localAgents = JSON.parse(localStorage.getItem('examark-agents') || '[]');
      const agent = localAgents.find((a: any) => a.id === agentId);
      if (agent && agent.name) {
        setAgentName(agent.name);
      }
    } catch (error) {
      console.error('Failed to fetch agent name:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const setupProgressStream = () => {
    try {
      // Connect to the progress stream endpoint
      const eventSource = new EventSource('/api/lead-agent/progress-stream');
      wsRef.current = eventSource;
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(data.level || 'info', data.message, data.stage);
        } catch (e) {
          console.error('Failed to parse progress stream data:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Progress stream error:', error);
        eventSource.close();
      };
    } catch (error) {
      console.error('Failed to setup progress stream:', error);
    }
  };

  const fetchData = async () => {
    try {
      setError(null);
      await Promise.all([
        fetchStatus(),
        fetchRecentEmails()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError('Failed to load agent data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/api/lead-agent/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
      throw error;
    }
  };

  const fetchRecentEmails = async () => {
    try {
      const response = await api.get('/api/logs');
      if (response.data && Array.isArray(response.data)) {
        const emailsWithStatus = response.data.map((email: any) => ({
          id: email.trackingId || email.id || Date.now().toString(),
          name: email.recipientName || email.recipient || 'Unknown Contact',
          company: email.company || 'Unknown Company',
          email: email.to || email.email,
          dateSent: email.sentAt || email.timestamp || new Date().toISOString(),
          opened: Boolean(email.opened),
          replied: Boolean(email.replied),
          status: (email.replied ? 'replied' : email.opened ? 'opened' : 'sent') as 'sent' | 'opened' | 'replied' | 'bounced'
        }));
        setRecentEmails(emailsWithStatus.slice(0, 10));
      } else {
        setRecentEmails([]);
      }
    } catch (error) {
      console.error('Failed to fetch recent emails:', error);
      setRecentEmails([]);
    }
  };

  const addLog = (level: LogEntry['level'], message: string, stage?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level,
      message,
      stage
    };
    setLogs(prev => [...prev.slice(-50), newLog]); // Keep last 50 logs
  };

  const toggleAgent = async () => {
    try {
      setError(null); // Clear any previous errors
      
      if (status?.isActive) {
        console.log('🛑 Stopping agent from dashboard...');
        const response = await api.post('/api/lead-agent/stop');
        addLog('info', 'Stop command sent to agent');
        
        if (response.data?.success) {
          addLog('success', 'Agent stopped successfully');
        } else {
          addLog('warning', 'Stop command sent, verifying status...');
        }
      } else {
        console.log('▶️ Starting agent from dashboard...');
        const response = await api.post('/api/lead-agent/start');
        addLog('info', 'Start command sent to agent');
        
        if (response.data?.success) {
          addLog('success', 'Agent started successfully');
        } else {
          addLog('warning', 'Start command sent, verifying status...');
        }
      }
      
      // Always fetch fresh status after toggle
      setTimeout(() => {
        fetchStatus();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to toggle agent:', error);
      addLog('error', `Failed to toggle agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setError('Failed to toggle agent. Please try again.');
    }
  };

  const resetAgent = async () => {
    try {
      await api.post('/api/lead-agent/reset');
      addLog('info', 'Agent reset successfully');
      setLogs([]);
      await fetchStatus();
    } catch (error) {
      console.error('Failed to reset agent:', error);
      addLog('error', 'Failed to reset agent');
      setError('Failed to reset agent. Please try again.');
    }
  };

  const runCycle = async () => {
    try {
      await api.post('/api/lead-agent/run-cycle');
      addLog('info', 'Manual cycle initiated');
    } catch (error) {
      console.error('Failed to run cycle:', error);
      addLog('error', 'Failed to start manual cycle');
      setError('Failed to run cycle. Please try again.');
    }
  };

  const getStatusColor = () => {
    if (!status) return 'text-neutral-500';
    return status.isActive ? 'text-green-600' : 'text-neutral-600';
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-neutral-600';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </motion.button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-semibold text-neutral-900 flex-1 min-w-0 truncate">{getAgentDisplayName()}</h1>
              <div className={`inline-flex items-center gap-2 text-sm whitespace-nowrap flex-shrink-0 ${getStatusColor()}`}>
                <div className={`h-2 w-2 rounded-full ${status?.isActive ? 'bg-green-500' : 'bg-neutral-400'}`}></div>
                {status?.isActive ? 'Running' : 'Stopped'}
              </div>
            </div>
            {status?.lastRun && (
              <div className="flex justify-end mt-1">
                <span className="text-sm text-neutral-500 whitespace-nowrap">
                  Last run: {new Date(status.lastRun).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 text-sm border border-red-200">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {error}
            </div>
          )}
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <CogIcon className="h-4 w-4" />
            Settings
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={runCycle}
            disabled={status?.isActive}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-neutral-200"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Run Cycle
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetAgent}
            className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:bg-neutral-50 transition-colors border border-neutral-200"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Reset
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleAgent}
            className={`flex items-center gap-2 px-4 py-2 transition-colors ${
              status?.isActive 
                ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            {status?.isActive ? (
              <>
                <StopIcon className="h-4 w-4" />
                Stop Agent
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4" />
                Start Agent
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Emails Sent', 
            value: status?.totalEmailsSent || 0, 
            icon: EnvelopeIcon 
          },
          { 
            label: 'Success Rate', 
            value: `${status?.successRate || 0}%`, 
            icon: ChartBarIcon 
          },
          { 
            label: 'Cycle Interval', 
            value: `${status?.currentInterval || 0}m`, 
            icon: ClockIcon 
          },
          { 
            label: 'Recent Contacts', 
            value: recentEmails.length, 
            icon: UserIcon 
          }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border border-neutral-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">{stat.label}</p>
                  <p className="text-2xl font-semibold text-neutral-900 mt-1">{stat.value}</p>
                </div>
                <Icon className="h-8 w-8 text-neutral-400" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Logs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white border border-neutral-200"
        >
          <div className="p-6 border-b border-neutral-200">
            <h3 className="text-lg font-medium text-neutral-900">Activity Logs</h3>
            <p className="text-sm text-neutral-600 mt-1">Real-time agent operations</p>
          </div>
          
          <div className="h-96 overflow-y-auto p-4 bg-neutral-50 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-center text-neutral-500 py-16">
                <p>No activity logs yet.</p>
                <p className="text-xs mt-1">Start the agent to see operations.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 text-xs"
                  >
                    <span className="text-neutral-400 w-20 flex-shrink-0">
                      {formatTime(log.timestamp)}
                    </span>
                    {log.stage && (
                      <span className="bg-neutral-100 text-neutral-600 px-2 py-1 text-xs border border-neutral-200">
                        {log.stage}
                      </span>
                    )}
                    <span className={getLogColor(log.level)}>{log.message}</span>
                  </motion.div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Recently Contacted */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white border border-neutral-200"
        >
          <div className="p-6 border-b border-neutral-200">
            <h3 className="text-lg font-medium text-neutral-900">Recently Contacted</h3>
            <p className="text-sm text-neutral-600 mt-1">Latest outreach attempts</p>
          </div>
          
          <div className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
            {recentEmails.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <EnvelopeIcon className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                <p>No recent emails found.</p>
                <p className="text-xs mt-1">Start the agent to begin outreach.</p>
              </div>
            ) : (
              recentEmails.map((contact) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                  onClick={() => console.log('Navigate to contact:', contact.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-600 font-medium">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900">{contact.name}</h4>
                        <div className="flex items-center gap-1 text-sm text-neutral-500">
                          <BuildingOfficeIcon className="h-3 w-3" />
                          {contact.company}
                        </div>
                        <p className="text-xs text-neutral-400">
                          {new Date(contact.dateSent).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs border ${
                        contact.status === 'replied' ? 'bg-green-50 text-green-600 border-green-200' :
                        contact.status === 'opened' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        'bg-neutral-50 text-neutral-600 border-neutral-200'
                      }`}>
                        {contact.status === 'replied' && <CheckCircleIcon className="h-3 w-3" />}
                        {contact.status === 'opened' && <EyeIcon className="h-3 w-3" />}
                        {contact.status === 'sent' && <ClockIcon className="h-3 w-3" />}
                        {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Settings Modal */}
      <AgentSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        agentId={agentId}
      />
      </div>
    </div>
  );
}