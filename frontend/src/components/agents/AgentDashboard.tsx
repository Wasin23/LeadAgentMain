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
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { AgentSettingsModal } from './AgentSettingsModal';

interface AgentDashboardProps {
  agentId: string;
  onBack: () => void;
}

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

interface AgentSettings {
  interval: number;
  maxEmails: number;
  targetIndustries: string[];
  emailTemplate: string;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ agentId, onBack }) => {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailContact[]>([]);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    
    // Set up real-time log streaming (simulate for now)
    const logInterval = setInterval(fetchLogs, 2000);
    const statusInterval = setInterval(fetchStatus, 5000);
    
    return () => {
      clearInterval(logInterval);
      clearInterval(statusInterval);
    };
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = async () => {
    await Promise.all([
      fetchStatus(),
      fetchLogs(),
      fetchRecentEmails(),
      fetchSettings()
    ]);
    setIsLoading(false);
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/lead-agent/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
    }
  };

  const fetchLogs = async () => {
    // Since there's no specific log endpoint, we'll simulate real-time logs
    // In a real implementation, this would connect to a WebSocket or SSE endpoint
    if (status?.isActive) {
      const mockLogs: LogEntry[] = [
        {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Searching for new leads...',
          stage: 'research'
        },
        {
          id: (Date.now() - 1000).toString(),
          timestamp: new Date(Date.now() - 1000).toISOString(),
          level: 'success',
          message: 'Found 3 potential leads in technology sector',
          stage: 'research'
        }
      ];
      
      setLogs(prev => [...prev.slice(-50), ...mockLogs].slice(-100)); // Keep last 100 logs
    }
  };

  const fetchRecentEmails = async () => {
    try {
      const response = await api.get('/email/logs');
      if (response.data && response.data.emails) {
        const emailsWithStatus = response.data.emails.map((email: any) => ({
          id: email.trackingId || email.id,
          name: email.recipientName || 'Unknown',
          company: email.company || 'Unknown Company',
          email: email.to,
          dateSent: email.sentAt || email.timestamp,
          opened: email.opened || false,
          replied: email.replied || false,
          status: email.opened ? 'opened' : 'sent'
        }));
        setRecentEmails(emailsWithStatus.slice(0, 10));
      }
    } catch (error) {
      console.error('Failed to fetch recent emails:', error);
      // Mock data for development
      setRecentEmails([
        {
          id: '1',
          name: 'John Smith',
          company: 'TechCorp Inc.',
          email: 'john@techcorp.com',
          dateSent: new Date().toISOString(),
          opened: true,
          replied: false,
          status: 'opened'
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          company: 'InnovateLabs',
          email: 'sarah@innovatelabs.com',
          dateSent: new Date(Date.now() - 86400000).toISOString(),
          opened: false,
          replied: false,
          status: 'sent'
        }
      ]);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get('/lead-agent/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch agent settings:', error);
      // Mock settings
      setSettings({
        interval: 720,
        maxEmails: 50,
        targetIndustries: ['Technology', 'Healthcare'],
        emailTemplate: 'Default template'
      });
    }
  };

  const toggleAgent = async () => {
    try {
      if (status?.isActive) {
        await api.post('/lead-agent/stop');
        addLog('info', 'Agent stopped by user');
      } else {
        await api.post('/lead-agent/start');
        addLog('success', 'Agent started successfully');
      }
      fetchStatus();
    } catch (error) {
      console.error('Failed to toggle agent:', error);
      addLog('error', 'Failed to toggle agent status');
    }
  };

  const resetAgent = async () => {
    try {
      await api.post('/lead-agent/reset');
      addLog('info', 'Agent reset successfully');
      fetchStatus();
    } catch (error) {
      console.error('Failed to reset agent:', error);
      addLog('error', 'Failed to reset agent');
    }
  };

  const runCycle = async () => {
    try {
      await api.post('/lead-agent/run-cycle');
      addLog('info', 'Manual cycle started');
    } catch (error) {
      console.error('Failed to run cycle:', error);
      addLog('error', 'Failed to start manual cycle');
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
    setLogs(prev => [...prev, newLog].slice(-100));
  };

  const getStatusColor = () => {
    if (!status) return 'text-gray-500 bg-gray-500/10';
    return status.isActive ? 'text-green-500 bg-green-500/10' : 'text-gray-500 bg-gray-500/10';
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getEmailStatusIcon = (email: EmailContact) => {
    if (email.replied) return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
    if (email.opened) return <EyeIcon className="h-4 w-4 text-blue-500" />;
    return <ClockIcon className="h-4 w-4 text-gray-400" />;
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
        <div className="flex items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="mr-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lead Agent Dashboard</h1>
            <div className="flex items-center mt-1">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
                <div className={`h-2 w-2 rounded-full mr-2 ${status?.isActive ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                {status?.isActive ? 'Running' : 'Stopped'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettings(true)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <CogIcon className="h-5 w-5 mr-2" />
            Settings
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={runCycle}
            disabled={status?.isActive}
            className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Run Cycle
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetAgent}
            className="flex items-center px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Reset
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleAgent}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              status?.isActive 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {status?.isActive ? (
              <>
                <StopIcon className="h-5 w-5 mr-2" />
                Stop Agent
              </>
            ) : (
              <>
                <PlayIcon className="h-5 w-5 mr-2" />
                Start Agent
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{status?.totalEmailsSent || 0}</div>
              <div className="text-sm text-gray-500">Total Emails</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{status?.successRate || 0}%</div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{settings?.interval || 0}m</div>
              <div className="text-sm text-gray-500">Interval</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{recentEmails.length}</div>
              <div className="text-sm text-gray-500">Recent Contacts</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Real-time Logs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Agent Logs</h3>
            <p className="text-sm text-gray-500 mt-1">Real-time activity and progress</p>
          </div>
          
          <div className="h-96 overflow-y-auto p-4 bg-gray-50">
            <div className="space-y-2 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No logs yet. Start the agent to see activity.
                </div>
              ) : (
                logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-2 rounded ${getLogColor(log.level)} bg-white border-l-4 ${
                      log.level === 'success' ? 'border-green-500' :
                      log.level === 'error' ? 'border-red-500' :
                      log.level === 'warning' ? 'border-yellow-500' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">
                          {new Date(log.timestamp).toLocaleTimeString()}
                          {log.stage && <span className="ml-2 bg-gray-200 px-2 py-1 rounded">{log.stage}</span>}
                        </div>
                        <div>{log.message}</div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </motion.div>

        {/* Recently Emailed */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recently Emailed</h3>
            <p className="text-sm text-gray-500 mt-1">Latest contacts and their status</p>
          </div>
          
          <div className="divide-y divide-gray-100">
            {recentEmails.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No recent emails found. Start the agent to begin outreach.
              </div>
            ) : (
              recentEmails.map((email) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ backgroundColor: 'rgb(249, 250, 251)' }}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    // TODO: Navigate to detailed email conversation view
                    console.log('Navigate to email details:', email.id);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center">
                          <div className="font-medium text-gray-900">{email.name}</div>
                          <div className="ml-2 flex items-center text-sm text-gray-500">
                            <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                            {email.company}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">{email.email}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(email.dateSent).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getEmailStatusIcon(email)}
                      <div className="text-xs text-gray-400">
                        {email.replied ? 'Replied' : email.opened ? 'Opened' : 'Sent'}
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
  );
};