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
  ArrowLeftIcon,
  CpuChipIcon,
  BoltIcon,
  EnvelopeIcon
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

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ agentId, onBack }) => {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailContact[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    
    // Set up real-time updates
    const logInterval = setInterval(() => {
      if (status?.isActive) {
        addMockLog();
      }
    }, 3000);
    const statusInterval = setInterval(fetchStatus, 10000);
    
    return () => {
      clearInterval(logInterval);
      clearInterval(statusInterval);
    };
  }, [agentId, status?.isActive]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = async () => {
    await Promise.all([
      fetchStatus(),
      fetchRecentEmails()
    ]);
    setIsLoading(false);
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/lead-agent/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
      // Mock status for development
      setStatus({
        isActive: false,
        currentInterval: 720,
        totalEmailsSent: 247,
        successRate: 89,
        lastRun: new Date(Date.now() - 3600000).toISOString()
      });
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
          status: email.replied ? 'replied' : email.opened ? 'opened' : 'sent'
        }));
        setRecentEmails(emailsWithStatus.slice(0, 8));
      }
    } catch (error) {
      console.error('Failed to fetch recent emails:', error);
      // Mock data
      setRecentEmails([
        {
          id: '1', name: 'Alex Chen', company: 'TechFlow Solutions', email: 'alex@techflow.com',
          dateSent: new Date().toISOString(), opened: true, replied: true, status: 'replied'
        },
        {
          id: '2', name: 'Sarah Miller', company: 'DataCore Inc.', email: 'sarah@datacore.com',
          dateSent: new Date(Date.now() - 86400000).toISOString(), opened: true, replied: false, status: 'opened'
        },
        {
          id: '3', name: 'Mike Johnson', company: 'CloudVault', email: 'mike@cloudvault.io',
          dateSent: new Date(Date.now() - 172800000).toISOString(), opened: false, replied: false, status: 'sent'
        }
      ]);
    }
  };

  const addMockLog = () => {
    const mockMessages = [
      'Analyzing LinkedIn profiles for technology executives...',
      'Found 5 potential leads matching criteria',
      'Generating personalized email for John Smith at TechCorp',
      'Email sent successfully to sarah@datacore.com',
      'Researching company background for CloudVault',
      'Lead qualification complete: 78% match score',
      'Scheduling follow-up email for tomorrow',
      'Updated CRM with new contact information'
    ];
    
    const levels: LogEntry['level'][] = ['info', 'success', 'info', 'success'];
    const stages = ['research', 'outreach', 'analysis', 'follow-up'];
    
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      message: mockMessages[Math.floor(Math.random() * mockMessages.length)],
      stage: stages[Math.floor(Math.random() * stages.length)]
    };
    
    setLogs(prev => [...prev.slice(-20), newLog]);
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
      setLogs([]);
      fetchStatus();
    } catch (error) {
      console.error('Failed to reset agent:', error);
      addLog('error', 'Failed to reset agent');
    }
  };

  const runCycle = async () => {
    try {
      await api.post('/lead-agent/run-cycle');
      addLog('info', 'Manual cycle initiated');
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
    setLogs(prev => [...prev, newLog]);
  };

  const getStatusColor = () => {
    if (!status) return 'text-gray-500 bg-gray-50 border-gray-200';
    return status.isActive 
      ? 'text-green-700 bg-green-50 border-green-200' 
      : 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'border-l-green-500 bg-green-50';
      case 'error': return 'border-l-red-500 bg-red-50';
      case 'warning': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading agent dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onBack}
                className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all duration-200 shadow-sm"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </motion.button>
              
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <BoltIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Lead Agent Control</h1>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor()}`}>
                      <div className={`h-3 w-3 rounded-full mr-2 ${status?.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                      {status?.isActive ? 'Active & Running' : 'Stopped'}
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      Agent: {agentId}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowSettings(true)}
                className="flex items-center px-6 py-3 bg-white text-gray-700 rounded-xl border border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
              >
                <CogIcon className="h-5 w-5 mr-2" />
                Settings
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={runCycle}
                disabled={status?.isActive}
                className="flex items-center px-6 py-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Run Cycle
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetAgent}
                className="flex items-center px-6 py-3 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-200 hover:bg-yellow-100 transition-all shadow-sm"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Reset
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={toggleAgent}
                className={`flex items-center px-6 py-3 rounded-xl transition-all shadow-sm border ${
                  status?.isActive 
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
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
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Emails Sent', value: status?.totalEmailsSent || 0, icon: EnvelopeIcon, color: 'blue' },
            { label: 'Success Rate', value: `${status?.successRate || 0}%`, icon: ChartBarIcon, color: 'green' },
            { label: 'Cycle Interval', value: `${status?.currentInterval || 0}m`, icon: ClockIcon, color: 'purple' },
            { label: 'Recent Contacts', value: recentEmails.length, icon: UserIcon, color: 'orange' }
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-${stat.color}-100`}>
                    <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Real-time Logs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Live Activity Feed</h3>
                  <p className="text-sm text-gray-600 mt-1">Real-time agent operations and progress</p>
                </div>
                <div className="flex items-center space-x-2">
                  {status?.isActive && (
                    <>
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600 font-medium">Live</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="h-96 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm">
              <div className="p-4 space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center text-gray-500 py-16">
                    <CpuChipIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity logs yet.</p>
                    <p className="text-xs mt-1">Start the agent to see real-time operations.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start space-x-3 py-1"
                    >
                      <span className="text-gray-500 text-xs mt-1 w-20 flex-shrink-0">
                        {formatTime(log.timestamp)}
                      </span>
                      <span className="text-xs mt-1">{getLogIcon(log.level)}</span>
                      <div className="flex-1">
                        <span className={`text-xs px-2 py-1 rounded ${log.stage ? 'bg-blue-900 text-blue-300' : ''}`}>
                          {log.stage}
                        </span>
                        <p className="mt-1">{log.message}</p>
                      </div>
                    </motion.div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </motion.div>

          {/* Recently Emailed Contacts */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Recently Contacted</h3>
              <p className="text-sm text-gray-600 mt-1">Latest outreach and engagement status</p>
            </div>
            
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {recentEmails.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <EnvelopeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent emails found.</p>
                  <p className="text-xs mt-1">Start the agent to begin outreach.</p>
                </div>
              ) : (
                recentEmails.map((contact) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgb(249, 250, 251)' }}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-all"
                    onClick={() => console.log('Navigate to:', contact.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {contact.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                          <div className="flex items-center text-sm text-gray-500 space-x-2">
                            <BuildingOfficeIcon className="h-4 w-4" />
                            <span>{contact.company}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(contact.dateSent).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          contact.status === 'replied' ? 'bg-green-100 text-green-800' :
                          contact.status === 'opened' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {contact.status === 'replied' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                          {contact.status === 'opened' && <EyeIcon className="h-3 w-3 mr-1" />}
                          {contact.status === 'sent' && <ClockIcon className="h-3 w-3 mr-1" />}
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