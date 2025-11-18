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
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  CalendarIcon
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
  nextCycleIn?: string; // ISO timestamp of next cycle
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

// Helper function to get color classes based on personality color
const getPersonalityColors = (color?: string) => {
  switch (color) {
    case 'red':
      return {
        primary: 'text-red-700',
        accent: 'bg-red-500',
        button: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
        background: 'bg-red-50/30',
        border: 'border-red-200',
        text: 'text-red-600',
        bgLight: 'bg-red-50',
        bgHover: 'bg-red-50',
        borderHover: 'border-red-300'
      };
    case 'blue':
      return {
        primary: 'text-blue-700',
        accent: 'bg-blue-500',
        button: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
        background: 'bg-blue-50/30',
        border: 'border-blue-200',
        text: 'text-blue-600',
        bgLight: 'bg-blue-50',
        bgHover: 'bg-blue-50',
        borderHover: 'border-blue-300'
      };
    case 'purple':
      return {
        primary: 'text-purple-700',
        accent: 'bg-purple-500',
        button: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100',
        background: 'bg-purple-50/30',
        border: 'border-purple-200',
        text: 'text-purple-600',
        bgLight: 'bg-purple-50',
        bgHover: 'bg-purple-50',
        borderHover: 'border-purple-300'
      };
    case 'green':
      return {
        primary: 'text-green-700',
        accent: 'bg-green-500',
        button: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
        background: 'bg-green-50/30',
        border: 'border-green-200',
        text: 'text-green-600',
        bgLight: 'bg-green-50',
        bgHover: 'bg-green-50',
        borderHover: 'border-green-300'
      };
    case 'indigo':
      return {
        primary: 'text-indigo-700',
        accent: 'bg-indigo-500',
        button: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
        background: 'bg-indigo-50/30',
        border: 'border-indigo-200',
        text: 'text-indigo-600',
        bgLight: 'bg-indigo-50',
        bgHover: 'bg-indigo-50',
        borderHover: 'border-indigo-300'
      };
    case 'pink':
      return {
        primary: 'text-pink-700',
        accent: 'bg-pink-500',
        button: 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100',
        background: 'bg-pink-50/30',
        border: 'border-pink-200',
        text: 'text-pink-600',
        bgLight: 'bg-pink-50',
        bgHover: 'bg-pink-50',
        borderHover: 'border-pink-300'
      };
    case 'orange':
      return {
        primary: 'text-orange-700',
        accent: 'bg-orange-500',
        button: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100',
        background: 'bg-orange-50/30',
        border: 'border-orange-200',
        text: 'text-orange-600',
        bgLight: 'bg-orange-50',
        bgHover: 'bg-orange-50',
        borderHover: 'border-orange-300'
      };
    case 'teal':
      return {
        primary: 'text-teal-700',
        accent: 'bg-teal-500',
        button: 'bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100',
        background: 'bg-teal-50/30',
        border: 'border-teal-200',
        text: 'text-teal-600',
        bgLight: 'bg-teal-50',
        bgHover: 'bg-teal-50',
        borderHover: 'border-teal-300'
      };
    default:
      return {
        primary: 'text-neutral-700',
        accent: 'bg-neutral-500',
        button: 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100',
        background: 'bg-neutral-50/30',
        border: 'border-neutral-200',
        text: 'text-neutral-600',
        bgLight: 'bg-neutral-50',
        bgHover: 'bg-neutral-50',
        borderHover: 'border-neutral-300'
      };
  }
};

export default function AgentDashboard({ agentId, onBack }: AgentDashboardProps) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailContact[]>([]);
  const [emailQueue, setEmailQueue] = useState<any[]>([]);
  const [emailQueueSearch, setEmailQueueSearch] = useState('');
  const [emailQueueSort, setEmailQueueSort] = useState<'newest' | 'oldest'>('newest');
  const [showSettings, setShowSettings] = useState(false);
  const [showEmailQueue, setShowEmailQueue] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [agentPersonality, setAgentPersonality] = useState<any>(null);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [newInterval, setNewInterval] = useState<number>(30);
  const [editingEmail, setEditingEmail] = useState<any>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedRecipient, setEditedRecipient] = useState('');
  const [editedCc, setEditedCc] = useState('');
  const [editedBcc, setEditedBcc] = useState('');
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmailRecipient, setNewEmailRecipient] = useState('');
  const [newEmailSubject, setNewEmailSubject] = useState('');
  const [newEmailContent, setNewEmailContent] = useState('');
  const [newEmailCc, setNewEmailCc] = useState('');
  const [newEmailBcc, setNewEmailBcc] = useState('');
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const [showRecentContacts, setShowRecentContacts] = useState(false);
  const [selectedRecentEmail, setSelectedRecentEmail] = useState<any>(null);
  const [recentEmailsSearch, setRecentEmailsSearch] = useState('');
  const [recentEmailsFilter, setRecentEmailsFilter] = useState<'all' | 'sent' | 'opened' | 'replied'>('all');
  const [showScheduledEvents, setShowScheduledEvents] = useState(false);
  const [selectedScheduledEvent, setSelectedScheduledEvent] = useState<any>(null);
  const [scheduledEvents, setScheduledEvents] = useState<any[]>([]);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [showStarting, setShowStarting] = useState(false);
  const [hasShownStarting, setHasShownStarting] = useState(false);
  const [lastCycleTime, setLastCycleTime] = useState<Date | null>(null);
  const [cycleTriggered, setCycleTriggered] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<EventSource | null>(null);
  const logCounterRef = useRef<number>(0);

  // Filter and sort email queue
  const filteredAndSortedEmailQueue = React.useMemo(() => {
    let filtered = emailQueue;
    
    // Search filter
    if (emailQueueSearch.trim()) {
      filtered = filtered.filter(email => {
        const company = email.leadInfo?.company || email.leadData?.company || '';
        const recipient = email.leadData?.email || email.to || '';
        const subject = email.emailData?.subject || email.subject || email.finalSubject || '';
        
        return company.toLowerCase().includes(emailQueueSearch.toLowerCase()) ||
               recipient.toLowerCase().includes(emailQueueSearch.toLowerCase()) ||
               subject.toLowerCase().includes(emailQueueSearch.toLowerCase());
      });
    }
    
    // Sort by date
    return filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp || a.createdAt || 0).getTime();
      const dateB = new Date(b.timestamp || b.createdAt || 0).getTime();
      
      return emailQueueSort === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [emailQueue, emailQueueSearch, emailQueueSort]);

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
    console.log('🔍 [DEBUG] Current agentId:', agentId);
    console.log('✅ [DEBUG] Setting up progress stream for agent:', agentId);
    setupProgressStream();
    
    const statusInterval = setInterval(fetchStatus, 10000);
    
    return () => {
      clearInterval(statusInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [agentId]);

  const fetchAgentName = async () => {
    try {
      if (agentId === 'main' || agentId === 'lead-agent-main') {
        setAgentName('Reasoning Lead Agent');
        return;
      }
      
      // Fetch agent data from backend API (same as AgentManager)
      const response = await api.get('/api/auth/agents');
      if (response.data.success && response.data.agents) {
        const agent = response.data.agents.find((a: any) => a.agentId === agentId);
        if (agent) {
          setAgentName(agent.name);
          setAgentPersonality(agent.personality);
          return;
        }
      }
      
      // Fallback to localStorage for older agents
      const localAgents = JSON.parse(localStorage.getItem('meridian-agents') || '[]');
      const localAgent = localAgents.find((a: any) => a.id === agentId);
      if (localAgent && localAgent.name) {
        setAgentName(localAgent.name);
        setAgentPersonality(localAgent.personality);
      }
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Initialize interval when modal opens
  useEffect(() => {
    if (showIntervalModal && status?.currentInterval) {
      console.log('🔧 [INTERVAL DEBUG] Setting modal interval to:', status.currentInterval);
      setNewInterval(status.currentInterval);
    }
  }, [showIntervalModal, status?.currentInterval]);



  // Countdown timer effect - uses backend's nextCycleIn to persist across page refreshes
  useEffect(() => {
    // Only show countdown if agent is active and backend provides nextCycleIn (ISO timestamp)
    if (!status?.isActive || !status?.nextCycleIn) {
      setCountdownTime(null);
      return;
    }

    // Backend provides ISO timestamp of next cycle
    const nextCycleTime = new Date(status.nextCycleIn);
    const now = new Date();
    const timeUntilNext = Math.max(0, nextCycleTime.getTime() - now.getTime());
    
    console.log('⏰ [COUNTDOWN START] Next cycle in:', Math.floor(timeUntilNext / 1000), 'seconds (from backend)');

    // Display countdown with setInterval (for visual updates)
    const displayInterval = setInterval(() => {
      const currentTime = new Date();
      const remaining = Math.max(0, nextCycleTime.getTime() - currentTime.getTime());
      const seconds = Math.floor(remaining / 1000);
      setCountdownTime(seconds);
      
      // When countdown reaches 0, show "Starting..." then switch to "Running" after 1.5s
      if (seconds === 0 && !hasShownStarting) {
        setShowStarting(true);
        setHasShownStarting(true);
        setTimeout(() => {
          setShowStarting(false);
        }, 1500);
      }
    }, 1000);

    // Initialize countdown
    setCountdownTime(Math.floor(timeUntilNext / 1000));

    return () => {
      clearInterval(displayInterval);
    };
  }, [status?.isActive, status?.nextCycleIn, hasShownStarting]);

  // Format countdown time
  const formatCountdown = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return null;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const setupProgressStream = () => {
    try {
      // Connect to the progress stream endpoint directly with auth token
      console.log('🔗 [SSE] Establishing EventSource connection to progress-stream...');
      const authToken = localStorage.getItem('authToken');
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const eventSource = new EventSource(`${backendUrl}/api/lead-agent/progress-stream?token=${encodeURIComponent(authToken || '')}&agentId=${encodeURIComponent(agentId)}`);
      wsRef.current = eventSource;
      
      eventSource.onopen = () => {
        console.log('✅ [SSE] EventSource connection opened successfully');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const progressData = JSON.parse(event.data);
          console.log('Progress stream received:', progressData);
          
          // 🔍 SERPER RESEARCH LOGGING - Detect and log detailed research findings
          if (progressData.data && progressData.data.message && progressData.data.message.includes('Research Results:')) {
            console.group('🔍 SERPER RESEARCH FINDINGS');
            console.log('📊 Research Event:', progressData.data);
            
            if (progressData.data.details) {
              const details = progressData.data.details;
              console.log('🏢 Company:', details.company);
              console.log('🔎 Search Query:', details.query);
              console.log('📈 Results Found:', details.resultsCount);
              console.log('🧠 Knowledge Graph Available:', details.hasKnowledgeGraph ? '✅ YES' : '❌ NO');
              console.log('💡 Answer Box Available:', details.hasAnswerBox ? '✅ YES' : '❌ NO');
              
              if (details.hasKnowledgeGraph) {
                console.log('🎯 Rich company data found via Knowledge Graph!');
              }
              if (details.hasAnswerBox) {
                console.log('🎯 Direct answer found for company research!');
              }
            }
            console.groupEnd();
          }

          // 🧠 AI RESEARCH ANALYSIS LOGGING - Show AI insights about research findings
          if (progressData.data && (
            (progressData.data.message && progressData.data.message.includes('Research Analysis:')) ||
            (progressData.data.details && progressData.data.details.contentType === 'ai_research_analysis')
          )) {
            console.group('🧠 AI STRATEGIC ANALYSIS');
            console.log('🏢 Company:', progressData.data.details?.company);
            
            if (progressData.data.details?.aiInsights) {
              const insights = progressData.data.details.aiInsights;
              console.log('🎯 Business Type:', insights.businessType);
              console.log('💡 Key Insights:', insights.keyInsights);
              console.log('💰 Lead Value:', insights.leadValue);
              console.log('📞 Approach Strategy:', insights.approach);
              console.log('📄 Full Analysis:');
              console.log(insights.fullAnalysis);
            }
            
            console.log('📊 Sources Analyzed:', progressData.data.details?.sourcesAnalyzed);
            console.groupEnd();
          }

          // 📖 RESEARCH CONTENT LOGGING - Show actual extracted content (fallback)
          if (progressData.data && progressData.data.message && progressData.data.message.includes('Research Content Extracted')) {
            console.group('📖 EXTRACTED RESEARCH CONTENT');
            console.log('🏢 Company:', progressData.data.details?.company);
            
            if (progressData.data.details?.findings) {
              progressData.data.details.findings.forEach((finding: any, index: number) => {
                console.group(`${index + 1}. ${finding.type}`);
                console.log('📝 Title:', finding.title);
                console.log('📄 Content:', finding.content);
                console.log('🔗 Source:', finding.source);
                if (finding.attributes) {
                  console.log('📊 Attributes:', finding.attributes);
                }
                console.groupEnd();
              });
            }
            console.groupEnd();
          }
          
          // Additional logging for any research-related events
          if (progressData.data && (
            progressData.data.operation === 'Agent Reasoning' || 
            progressData.data.operation === 'Action Executed' ||
            (typeof progressData.data.details === 'string' && progressData.data.details.includes('serper_research')) ||
            (typeof progressData.data.details === 'string' && progressData.data.details.includes('Research'))
          )) {
            console.log('🧠 [RESEARCH EVENT]', {
              operation: progressData.data.operation,
              details: progressData.data.details,
              status: progressData.data.status,
              timestamp: progressData.data.timestamp
            });
          }
          
          if (progressData.type === 'progress' && progressData.data) {
            // Check if this is an email queue update
            if (progressData.data.type === 'email_queue') {
              // Email added to queue - refresh queue display
              console.log('📧 [SSE] Email queue updated:', progressData.data.message);
              fetchEmailQueue(); // Refresh the email queue display
              
              // Also add to Activity Logs
              const queueLog = {
                id: `email-queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                operation: 'Email Queued',
                details: progressData.data.message,
                status: 'success',
                data: progressData.data.data || {}
              };
              setAgentLogs(prev => [queueLog, ...prev.slice(0, 49)]);
            } else {
              // Regular agent log event - add directly to Activity Logs
              setAgentLogs(prev => [progressData.data, ...prev.slice(0, 49)]);
              
              // 🎯 Detect cycle completion from SSE agent log messages (including stopped cycles)
              if (progressData.data && !cycleTriggered &&
                  (progressData.data.operation === 'Cycle Completed' || 
                   progressData.data.operation === 'Cycle Stopped' ||
                   progressData.data.operation === '✅ Process Complete' ||
                   (progressData.data.message && (progressData.data.message.includes('Cycle Completed') || progressData.data.message.includes('Cycle Stopped') || progressData.data.message.includes('Process Complete'))) ||
                   (progressData.data.details && typeof progressData.data.details === 'string' && (progressData.data.details.includes('Cycle Completed') || progressData.data.details.includes('Cycle Stopped') || progressData.data.details.includes('Successfully completed lead outreach'))))) {
                
                console.log('🏁 [CYCLE END] Detected cycle completion/stop via SSE');
                console.log('🏁 [DEBUG] Full SSE data:', progressData.data);
                
                // Fetch fresh status to check if agent is still running (don't rely on potentially stale status state)
                const checkAgentStatus = async () => {
                  try {
                    const response = await api.get(`/api/lead-agent/status?agentId=${agentId}`);
                    const freshStatus = response.data;
                    
                    console.log('🔍 [DEBUG] Fresh status check:', { 
                      isActive: freshStatus?.isActive, 
                      currentInterval: freshStatus?.currentInterval,
                      freshStatus
                    });
                    
                    // Only start countdown if agent is actively running (not for manual cycles)
                    if (freshStatus?.isActive && freshStatus?.currentInterval) {
                      console.log('🕒 Starting countdown timer at:', new Date());
                      setCycleTriggered(true); // Prevent duplicate triggers
                      setLastCycleTime(new Date());
                      setCountdownTime(null);
                    } else {
                      console.log('📝 [MANUAL CYCLE] Cycle completed but agent not running - no countdown');
                      console.log('📝 [MANUAL CYCLE] Debug: isActive =', freshStatus?.isActive, 'currentInterval =', freshStatus?.currentInterval);
                    }
                  } catch (error) {
                    console.error('❌ Failed to fetch fresh status for countdown check:', error);
                  }
                };
                
                // Check status asynchronously
                checkAgentStatus();
              }
              
              // 🔍 Additional specific logging for Serper research steps
              if (progressData.data.operation === 'Action Executed' && 
                  progressData.data.details && 
                  typeof progressData.data.details === 'string' && 
                  progressData.data.details.includes('serper_research')) {
                console.log('🔬 [SERPER ACTION] Research step detected:', {
                  step: progressData.data.details,
                  status: progressData.data.status,
                  timestamp: progressData.data.timestamp,
                  agentData: progressData.data.data || {}
                });
              }
            }
          } else if (progressData.type === 'test') {
            // Test message
            console.log('SSE Test:', progressData.message);
            const testLog = {
              id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              operation: 'Connection Test',
              details: progressData.message,
              status: 'info',
              data: {}
            };
            setAgentLogs(prev => [testLog, ...prev.slice(0, 49)]);
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Progress stream error:', error);
        console.error('EventSource readyState:', eventSource.readyState);
        console.error('EventSource URL:', eventSource.url);
        
        // Check if it's a connection error (readyState 2 = CLOSED)
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('❌ [SSE] Connection closed by server - likely authentication failure');
        }
        
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
        fetchRecentEmails(),
        fetchEmailQueue(),
        fetchAgentLogs(),
        fetchScheduledEvents()
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
      const response = await api.get(`/api/lead-agent/status?agentId=${agentId}`);
      const newStatus = response.data;
      

      
      // 🛑 Clear countdown when agent stops
      if (status?.isActive && !newStatus.isActive) {
        console.log('🛑 [AGENT STOPPED] Clearing countdown timer');
        setLastCycleTime(null);
        setCountdownTime(null);
        setCycleTriggered(false); // Reset flag when agent stops
      }
      
      setStatus(newStatus);
      console.log('🔧 [STATUS DEBUG] Loaded agent status with interval:', newStatus.currentInterval);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
      throw error;
    }
  };

  const fetchRecentEmails = async () => {
    try {
      // First try to get approved emails from agent-specific email queue
      const approvedResponse = await api.get(`/api/email-queue/approved?agentId=${agentId}`);
      const approvedEmails = approvedResponse.data || [];
      
      // Also fetch from analytics endpoint for additional data (like tracking stats)
      let analyticsEmails = [];
      try {
        const analyticsResponse = await api.get(`/api/analytics/emails?agentId=${agentId}`);
        analyticsEmails = analyticsResponse.data?.data || analyticsResponse.data || [];
        console.log('📊 [ANALYTICS] Fetched analytics data:', analyticsEmails.length, 'emails');
        if (analyticsEmails.length > 0) {
          console.log('📊 [ANALYTICS] Sample analytics email:', analyticsEmails[0]);
        }
      } catch (analyticsError) {
        console.log('Analytics endpoint not available, using approved emails only');
      }

      // Merge tracking data from analytics with approved emails based on multiple matching criteria
      const emailsWithTracking = approvedEmails.map((approvedEmail: any) => {
        // Try multiple matching strategies
        const trackingData = analyticsEmails.find((analyticsEmail: any) => 
          // Match by email address
          (analyticsEmail.to || analyticsEmail.email) === approvedEmail.to ||
          // Match by tracking ID patterns
          (analyticsEmail.trackingId && approvedEmail.id && analyticsEmail.trackingId.includes(approvedEmail.id.split('_')[1])) ||
          // Match by recipient name or company
          (analyticsEmail.recipientName === approvedEmail.leadInfo?.name) ||
          (analyticsEmail.company === approvedEmail.leadInfo?.company)
        );
        
        console.log('🔍 [TRACKING MERGE] Approved email:', approvedEmail.to, 'Found tracking:', !!trackingData);
        if (trackingData) {
          console.log('📊 [TRACKING DATA] Analytics:', trackingData.analytics, 'Status:', trackingData.analyticsStatus);
        }
        
        return {
          ...approvedEmail,
          // Merge tracking information from analytics with extensive fallbacks
          analytics: trackingData?.analytics || {},
          analyticsStatus: trackingData?.analyticsStatus || {},
          tracking: trackingData?.tracking || {},
          zillizData: trackingData?.zillizData || {},
          // Enhanced tracking status detection
          opened: Boolean(
            trackingData?.opened || 
            trackingData?.analytics?.opened || 
            trackingData?.analyticsStatus?.opened ||
            trackingData?.zillizData?.opened ||
            (trackingData?.zillizData?.events && trackingData.zillizData.events.some((event: any) => event.event_type === 'email_open'))
          ),
          replied: Boolean(
            trackingData?.replied || 
            trackingData?.analytics?.replied || 
            trackingData?.analyticsStatus?.replied ||
            trackingData?.zillizData?.replied ||
            (trackingData?.zillizData?.events && trackingData.zillizData.events.some((event: any) => event.event_type === 'email_reply'))
          ),
          trackingId: trackingData?.trackingId || approvedEmail.id
        };
      });
      
      // Add any analytics emails that don't have corresponding approved emails (fallback)
      const orphanAnalyticsEmails = analyticsEmails.filter((analyticsEmail: any) => 
        !approvedEmails.some((approvedEmail: any) => approvedEmail.to === (analyticsEmail.to || analyticsEmail.email))
      );
      
      const combinedEmails = [...emailsWithTracking, ...orphanAnalyticsEmails];
      
      if (combinedEmails.length > 0) {
        const emailsWithStatus = combinedEmails.map((email: any) => ({
          id: email.trackingId || email.id || Date.now().toString(),
          name: email.leadInfo?.name || email.personInfo?.fullName || email.recipientName || email.recipient || email.to?.split('@')[0] || 'Unknown Contact',
          company: email.lead?.company || email.leadInfo?.company || email.personInfo?.company || email.company || 'Unknown Company',
          email: email.to || email.email,
          dateSent: email.approvedAt || email.sentAt || email.timestamp || new Date().toISOString(),
          // Add the missing fields for email content display
          subject: email.subject || email.emailSubject || 'Email subject not available',
          content: email.body || email.content || email.personalizedEmail || 'Email content not available',
          body: email.body || email.content || email.personalizedEmail || 'Email content not available',
          // Enhanced tracking status - check all possible tracking sources including Zilliz
          opened: Boolean(
            email.analytics?.opened || 
            email.analyticsStatus?.opened || 
            email.tracking?.opened || 
            email.opened ||
            email.zillizData?.opened ||
            (email.zillizData?.events && email.zillizData.events.some((event: any) => event.event_type === 'email_open'))
          ),
          replied: Boolean(
            email.analytics?.replied || 
            email.analyticsStatus?.replied || 
            email.tracking?.replied || 
            email.replied ||
            email.zillizData?.replied ||
            (email.zillizData?.events && email.zillizData.events.some((event: any) => event.event_type === 'email_reply'))
          ),
          status: (
            (email.analytics?.replied || email.analyticsStatus?.replied || email.tracking?.replied || email.replied || email.zillizData?.replied || (email.zillizData?.events && email.zillizData.events.some((event: any) => event.event_type === 'email_reply'))) ? 'replied' : 
            (email.analytics?.opened || email.analyticsStatus?.opened || email.tracking?.opened || email.opened || email.zillizData?.opened || (email.zillizData?.events && email.zillizData.events.some((event: any) => event.event_type === 'email_open'))) ? 'opened' : 
            'sent'
          ) as 'sent' | 'opened' | 'replied' | 'bounced',
          // Include full email object for detailed view
          ...email
        }));
        
        // Remove duplicates based on email address and sort by date
        const uniqueEmails = emailsWithStatus.filter((email, index, self) => 
          index === self.findIndex(e => e.email === email.email)
        ).sort((a, b) => new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime());
        
        setRecentEmails(uniqueEmails.slice(0, 10));
      } else {
        setRecentEmails([]);
      }
    } catch (error) {
      console.error('Failed to fetch recent emails:', error);
      setRecentEmails([]);
    }
  };

  const fetchEmailQueue = async () => {
    try {
      // Include agentId in query to get agent-specific email queue
      const response = await api.get(`/api/email-queue/queue?agentId=${agentId}`);
      console.log('📧 [EMAIL QUEUE] Raw API response:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        console.log('📧 [EMAIL QUEUE] First email structure:', response.data[0]);
        console.log('📧 [EMAIL QUEUE] Company locations in first email:');
        console.log('  - email.company:', response.data[0]?.company);
        console.log('  - email.lead?.company:', response.data[0]?.lead?.company);
        console.log('  - email.leadInfo?.company:', response.data[0]?.leadInfo?.company);
        console.log('  - email.leadData?.company:', response.data[0]?.leadData?.company);
        setEmailQueue(response.data);
      } else if (response.data && response.data.data && Array.isArray(response.data.data.pending)) {
        // Handle the formatted response structure
        console.log('📧 [EMAIL QUEUE] First email structure (nested):', response.data.data.pending[0]);
        setEmailQueue(response.data.data.pending);
      } else {
        setEmailQueue([]);
      }
    } catch (error) {
      console.error('Failed to fetch email queue:', error);
      setEmailQueue([]);
    }
  };

  const fetchScheduledEvents = async () => {
    try {
      const response = await api.get(`/api/analytics/scheduled-events?agentId=${agentId}`);
      if (response.data && Array.isArray(response.data)) {
        setScheduledEvents(response.data);
      } else {
        setScheduledEvents([]);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled events:', error);
      setScheduledEvents([]);
    }
  };

  const fetchAgentLogs = async () => {
    try {
      console.log('🔍 [FRONTEND] Fetching agent logs from /api/lead-agent/activity-logs...');
      const response = await api.get(`/api/lead-agent/activity-logs?agentId=${agentId}`);
      console.log('🔍 [FRONTEND] Agent logs response:', response);
      console.log('🔍 [FRONTEND] Agent logs data:', response.data);
      console.log('🔍 [FRONTEND] Is array?', Array.isArray(response.data));
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`🔍 [FRONTEND] Setting ${response.data.length} agent logs`);
        setAgentLogs(response.data);
      } else {
        console.log('🔍 [FRONTEND] No valid agent logs data, setting empty array');
        setAgentLogs([]);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Failed to fetch agent logs:', error);
      setAgentLogs([]);
    }
  };

  const approveEmail = async (emailId: string) => {
    try {
      console.log('📤 Approving and sending email ID:', emailId);
      
      const response = await api.post(`/api/email-queue/${emailId}/approve`, { agentId });
      console.log('✅ Approve response:', response.data);
      
      // Show success message
      showNotification('Email approved and sent successfully!', 'success');
      
      // Refresh the queue, recent emails, and close modal
      await fetchEmailQueue();
      
      // Wait a moment for the backend to process the approval, then refresh recently contacted
      setTimeout(async () => {
        await fetchRecentEmails();
        await fetchStatus(); // Refresh status to update counters
      }, 1000);
      setSelectedEmail(null);
      setEditingEmail(null);
      
      console.log('✅ Email approved and sent successfully');
    } catch (error: any) {
      console.error('❌ Failed to approve email:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      showNotification(`Failed to approve email: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const rejectEmail = async (emailId: string, reason: string = '') => {
    try {
      console.log('🗑️ Rejecting email ID:', emailId, 'with reason:', reason);
      
      const response = await api.post(`/api/email-queue/${emailId}/reject`, { reason, agentId });
      console.log('✅ Reject response:', response.data);
      
      // Show confirmation message
      showNotification('Email rejected and removed from queue!', 'success');
      
      // Refresh the queue and close modals
      await fetchEmailQueue();
      setSelectedEmail(null);
      setEditingEmail(null);
      
      console.log('✅ Email rejected successfully');
    } catch (error: any) {
      console.error('❌ Failed to reject email:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      showNotification(`Failed to reject email: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const updateEmail = async (emailId: string, updates: any) => {
    try {
      console.log('🔄 Updating email with ID:', emailId);
      console.log('📝 Updates:', updates);
      
      const response = await api.put(`/api/email-queue/${emailId}?agentId=${agentId}`, updates);
      console.log('✅ Update response:', response.data);
      
      // Update the editing email object with the new data so changes are visible immediately in the modal
      const updatedEditingEmail = {
        ...editingEmail,
        ...updates,
        // Update nested structures as well
        emailData: {
          ...editingEmail?.emailData,
          subject: updates.subject || updates.finalSubject,
          body: updates.body || updates.personalizedEmail || updates.finalBody
        },
        leadData: {
          ...editingEmail?.leadData,
          email: updates.to || updates.finalRecipient
        }
      };
      
      setEditingEmail(updatedEditingEmail);
      
      // Update the email in the queue state immediately for instant UI update
      setEmailQueue(prevQueue => 
        prevQueue.map(email => {
          if (email.id === emailId) {
            return {
              ...email,
              ...updates,
              // Update nested structures that the table displays
              emailData: {
                ...email.emailData,
                subject: updates.subject || updates.finalSubject,
                body: updates.body || updates.personalizedEmail || updates.finalBody
              },
              leadData: {
                ...email.leadData,
                email: updates.to || updates.finalRecipient
              }
            };
          }
          return email;
        })
      );
      
      // Refresh from backend to ensure consistency
      setTimeout(async () => {
        await fetchEmailQueue();
      }, 500);
      
      console.log('✅ Email updated successfully');
      showNotification('Email updated successfully!', 'success');
      
    } catch (error: any) {
      console.error('❌ Failed to update email:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      showNotification(`Failed to update email: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const startEditingEmail = (email: any) => {
    console.log('📝 Starting to edit email:', email);
    setEditingEmail(email);
    setEditedSubject(email.emailData?.subject || email.subject || email.finalSubject || '');
    setEditedContent(email.emailData?.body || email.personalizedEmail || email.body || email.finalBody || '');
    setEditedRecipient(email.leadData?.email || email.to || email.finalRecipient || '');
    setEditedCc(email.cc || email.emailData?.cc || '');
    setEditedBcc(email.bcc || email.emailData?.bcc || '');
  };

  const saveEmailEdits = async () => {
    if (!editingEmail) {
      console.log('❌ No email being edited');
      return;
    }
    
    try {
      console.log('💾 Saving email edits...');
      console.log('📧 Editing email:', editingEmail);
      console.log('📝 New subject:', editedSubject);
      console.log('📝 New content length:', editedContent.length);
      console.log('📝 New recipient:', editedRecipient);
      console.log('📝 New CC:', editedCc);
      console.log('📝 New BCC:', editedBcc);
      
      const updates = {
        subject: editedSubject,
        personalizedEmail: editedContent,
        body: editedContent,
        to: editedRecipient,
        cc: editedCc,
        bcc: editedBcc,
        finalRecipient: editedRecipient,
        finalSubject: editedSubject,
        finalBody: editedContent
      };
      
      await updateEmail(editingEmail.id, updates);
      
      // Update the form fields to show the saved values (for instant visual feedback)
      setEditedSubject(updates.subject || updates.finalSubject || editedSubject);
      setEditedContent(updates.body || updates.personalizedEmail || updates.finalBody || editedContent);
      setEditedRecipient(updates.to || updates.finalRecipient || editedRecipient);
      
      // CRITICAL: Update selectedEmail if it's the same email being edited
      if (selectedEmail && selectedEmail.id === editingEmail.id) {
        const updatedSelectedEmail = {
          ...selectedEmail,
          ...updates,
          emailData: {
            ...selectedEmail.emailData,
            subject: updates.subject || updates.finalSubject,
            body: updates.body || updates.personalizedEmail || updates.finalBody
          },
          leadData: {
            ...selectedEmail.leadData,
            email: updates.to || updates.finalRecipient
          }
        };
        setSelectedEmail(updatedSelectedEmail);
      }
      
      // Don't auto-close so user can see the changes took effect
      // User can manually click "Close Editor" when satisfied
      
    } catch (error) {
      console.error('❌ Failed to save email edits:', error);
    }
  };

  const addCustomEmail = async () => {
    try {
      console.log('➕ Adding custom email to queue...');
      
      const customEmail = {
        to: newEmailRecipient,
        subject: newEmailSubject,
        body: newEmailContent,
        cc: newEmailCc,
        bcc: newEmailBcc,
        leadContext: 'Custom email created by user',
        source: 'custom',
        agentId: agentId // Include agentId for agent-specific queue
      };
      
      const response = await api.post('/api/email-queue/custom', customEmail);
      console.log('✅ Custom email added:', response.data);
      
      // Reset form
      setNewEmailRecipient('');
      setNewEmailSubject('');
      setNewEmailContent('');
      setNewEmailCc('');
      setNewEmailBcc('');
      setShowAddEmail(false);
      
      // Refresh queue
      await fetchEmailQueue();
      
      showNotification('Custom email added to queue successfully!', 'success');
    } catch (error: any) {
      console.error('❌ Failed to add custom email:', error);
      showNotification(`Failed to add email: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000); // Auto-hide after 3 seconds
  };

  // Filter and search recent emails
  const filteredRecentEmails = recentEmails.filter(email => {
    // Apply status filter
    if (recentEmailsFilter !== 'all' && email.status !== recentEmailsFilter) {
      return false;
    }
    
    // Apply search filter
    if (recentEmailsSearch.trim()) {
      const search = recentEmailsSearch.toLowerCase();
      return (
        email.name.toLowerCase().includes(search) ||
        email.email.toLowerCase().includes(search) ||
        email.company.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  const clearRecentEmails = async () => {
    try {
      // Clear all email data for this specific agent
      console.log('🗑️ [CLEAR] Clearing all emails (sent, approved, tracking) for agent:', agentId);
      
      // Clear sent emails (includes tracking events via Zilliz)
      await api.delete('/api/email-queue/sent/clear', {
        params: { agentId }
      });
      
      // Clear analytics/tracking data
      await api.delete(`/api/analytics/emails?agentId=${agentId}`);
      
      // Clear approved emails from the agent-specific email queue
      await api.delete(`/api/email-queue/approved?agentId=${agentId}`);
      
      // Refresh the lists
      await fetchRecentEmails(); // Refresh the list
      await fetchStatus(); // Refresh the status to update total emails counter
      
      showNotification('All emails and tracking data cleared successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to clear recent emails:', error);
      console.error('Error details:', error.response?.data || error.message);
      showNotification('Failed to clear recent emails', 'error');
    }
  };

  const addLog = (level: LogEntry['level'], message: string, stage?: string) => {
    logCounterRef.current += 1;
    const newLog: LogEntry = {
      id: `${Date.now()}-${logCounterRef.current}`,
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
        const response = await api.post('/api/lead-agent/stop', { agentId });
        addLog('info', 'Stop command sent to agent');
        
        if (response.data?.success) {
          addLog('success', 'Agent stopped successfully');
        } else {
          addLog('warning', 'Stop command sent, verifying status...');
        }
      } else {
        console.log('▶️ Starting agent from dashboard...');
        const response = await api.post('/api/lead-agent/start', { agentId });
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
      const response = await api.post('/api/lead-agent/reset', { agentId });
      addLog('info', 'Agent reset successfully');
      
      if (response.data.issuesCleared) {
        addLog('info', `Cleared ${response.data.issuesCleared} issues and alerts`);
      }
      
      setLogs([]);
      setAgentLogs([]); // Clear Activity Logs
      await fetchStatus();
    } catch (error) {
      console.error('Failed to reset agent:', error);
      addLog('error', 'Failed to reset agent');
      setError('Failed to reset agent. Please try again.');
    }
  };

  const runCycle = async () => {
    try {
      await api.post('/api/lead-agent/run-cycle', { agentId });
      addLog('info', 'Manual cycle initiated');
    } catch (error) {
      console.error('Failed to run cycle:', error);
      addLog('error', 'Failed to start manual cycle');
      setError('Failed to run cycle. Please try again.');
    }
  };

  const handleIntervalChange = async () => {
    try {
      setIsLoading(true);
      // First update the interval setting
      await api.post('/api/lead-agent/set-interval', { minutes: newInterval, agentId });
      
      // If agent is currently running, restart it with new interval
      if (status?.isActive) {
        await api.post('/api/lead-agent/stop', { agentId });
        addLog('info', `Stopping agent to apply new cycle interval: ${newInterval}m`);
        
        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await api.post('/api/lead-agent/start', { agentId });
        addLog('info', `Agent restarted with ${newInterval}-minute cycle interval`);
      } else {
        addLog('info', `Cycle interval updated to ${newInterval} minutes. Start the agent to apply changes.`);
      }
      
      setShowIntervalModal(false);
      // Refresh status to show new interval
      await fetchStatus();
    } catch (error) {
      console.error('Failed to update cycle interval:', error);
      addLog('error', 'Failed to update cycle interval');
      setError('Failed to update cycle interval. Please try again.');
    } finally {
      setIsLoading(false);
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

  const colors = getPersonalityColors(agentPersonality?.color);

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 max-w-md ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-neutral-400 hover:text-neutral-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
              <h1 className={`text-2xl font-semibold flex-1 min-w-0 truncate ${colors.primary}`}>{getAgentDisplayName()}</h1>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className={`inline-flex items-center gap-2 text-sm whitespace-nowrap ${getStatusColor()}`}>
                  <div className={`h-2 w-2 rounded-full ${status?.isActive ? 'bg-green-500' : 'bg-neutral-400'}`}></div>
                  {status?.isActive ? 'Running' : 'Stopped'}
                </div>
                {status?.lastRun && (
                  <span className="text-sm text-neutral-500 whitespace-nowrap">
                    Last run: {new Date(status.lastRun).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
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
            className={`flex items-center gap-2 px-4 py-2 text-neutral-600 hover:text-neutral-900 transition-colors ${colors.bgLight} border ${colors.border}`}
          >
            <CogIcon className="h-4 w-4" />
            Settings
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetAgent}
            className={`flex items-center gap-2 px-4 py-2 text-neutral-600 transition-colors border ${colors.border} ${colors.bgLight}`}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-3">
        {/* Clickable Emails Queued */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white border p-6 cursor-pointer transition-all duration-200 ${colors.border} hover:${colors.bgHover} hover:${colors.borderHover}`}
          onClick={() => setShowEmailQueue(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 flex items-center gap-2">
                Emails Queued
                <span className={`text-xs px-2 py-1 rounded ${colors.text} ${colors.bgLight}`}>click to view</span>
              </p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{emailQueue.length}</p>
            </div>
            <EnvelopeIcon className={`h-8 w-8 ${colors.text}`} />
          </div>
        </motion.div>

        {/* Clickable Scheduled Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white border p-6 cursor-pointer transition-all duration-200 ${colors.border} hover:${colors.bgHover} hover:${colors.borderHover}`}
          onClick={() => setShowScheduledEvents(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 flex items-center gap-2">
                Scheduled Events
                <span className={`text-xs px-2 py-1 rounded ${colors.text} ${colors.bgLight}`}>click to view</span>
              </p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{scheduledEvents.length}</p>
            </div>
            <CalendarIcon className={`h-8 w-8 ${colors.text}`} />
          </div>
        </motion.div>

        {/* Clickable Recent Contacts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`bg-white border p-6 cursor-pointer transition-all duration-200 ${colors.border} hover:${colors.bgHover} hover:${colors.borderHover}`}
          onClick={() => setShowRecentContacts(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 flex items-center gap-2">
                Recent Contacts
                <span className={`text-xs px-2 py-1 rounded ${colors.text} ${colors.bgLight}`}>click to view</span>
              </p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{recentEmails.length}</p>
            </div>
            <UserIcon className={`h-8 w-8 ${colors.text}`} />
          </div>
        </motion.div>
        
        {/* Clickable Cycle Interval */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`bg-white border p-6 cursor-pointer transition-all duration-200 ${colors.border} hover:${colors.bgHover} hover:${colors.borderHover}`}
          onClick={() => setShowIntervalModal(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 flex items-center gap-2">
                Cycle Interval
                <span className={`text-xs px-2 py-1 rounded ${colors.text} ${colors.bgLight}`}>click to change</span>
              </p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{status?.currentInterval || 30}m</p>
            </div>
            <ClockIcon className={`h-8 w-8 ${colors.text}`} />
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Logs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`bg-white border ${colors.border}`}
        >
          <div className={`p-6 border-b ${colors.border}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${colors.primary}`}>Activity Logs</h3>
                <p className="text-sm text-neutral-600 mt-1">Real-time agent operations</p>
              </div>
              
              {/* Countdown Timer */}
              {countdownTime !== null && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`flex items-center gap-3 px-4 py-2.5 border rounded-lg ${
                    countdownTime === 0
                      ? 'bg-green-50 border-green-200'
                      : countdownTime <= 30 
                        ? 'bg-orange-50 border-orange-200' 
                        : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="relative">
                    {countdownTime > 0 ? (
                      <svg className={`h-5 w-5 animate-spin ${
                        countdownTime <= 30 ? 'text-orange-600' : 'text-blue-600'
                      }`} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500"></span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs font-bold ${
                      countdownTime === 0
                        ? 'text-green-700'
                        : countdownTime <= 30 
                          ? 'text-orange-700' 
                          : 'text-blue-700'
                    }`}>Next cycle in:</div>
                    <div className={`font-mono font-bold text-base ${
                      countdownTime === 0
                        ? 'text-green-600'
                        : countdownTime <= 30 
                          ? 'text-orange-600' 
                          : 'text-blue-600'
                    } ${countdownTime <= 10 && countdownTime > 0 ? 'animate-pulse' : ''}`}>
                      {countdownTime === 0 && showStarting && 'Starting...'}
                      {countdownTime === 0 && !showStarting && 'Running'}
                      {countdownTime > 0 && formatCountdown(countdownTime)}
                    </div>
                  </div>
                </motion.div>
              )}
              
              {status?.isActive && countdownTime === null && lastCycleTime === null && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <span className="relative flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500"></span>
                  </span>
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-green-700">Agent Running</div>
                    <div className="text-green-600">Waiting for first cycle...</div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
          
          <div className="h-96 overflow-y-auto p-4 bg-neutral-50 font-mono text-sm">
            {agentLogs.length === 0 ? (
              <div className="text-center text-neutral-500 py-16">
                <p>No agent activity logs yet.</p>
                <p className="text-xs mt-1">Start the agent to see detailed operations.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {agentLogs.map((log, index) => (
                  <motion.div
                    key={log.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs leading-relaxed p-2 border-b border-neutral-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${
                            log.status === 'completed' ? 'text-green-600' :
                            log.status === 'error' ? 'text-red-600' :
                            log.status === 'active' ? 'text-blue-600' :
                            log.status === 'running' ? 'text-purple-600' :
                            log.status === 'info' ? 'text-orange-600' :
                            'text-neutral-700'
                          }`}>
                            {log.operation}
                          </span>
                          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                            log.status === 'completed' ? 'bg-green-50 text-green-600' :
                            log.status === 'error' ? 'bg-red-50 text-red-600' :
                            log.status === 'active' ? 'bg-blue-50 text-blue-600' :
                            log.status === 'running' ? 'bg-purple-50 text-purple-600' :
                            log.status === 'info' ? 'bg-orange-50 text-orange-600' :
                            'bg-neutral-50 text-neutral-600'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                        <div className="text-neutral-600 text-xs">
                          {(() => {
                            // Special formatting for AI research analysis
                            if (log.details && typeof log.details === 'object' && log.details.contentType === 'ai_research_analysis') {
                              const insights = log.details.aiInsights;
                              return (
                                <div className="space-y-1">
                                  <div><strong>Business:</strong> {insights?.businessType || 'Analysis completed'}</div>
                                  <div><strong>Key Insights:</strong> {insights?.keyInsights || 'Strategic insights generated'}</div>
                                  <div><strong>Lead Value:</strong> {insights?.leadValue || 'High-value prospect identified'}</div>
                                  <div><strong>Approach:</strong> {insights?.approach || 'Outreach strategy developed'}</div>
                                </div>
                              );
                            }
                            // Regular display logic
                            return typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
                          })()}
                        </div>
                      </div>
                      <span className="text-neutral-400 text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
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
          className={`bg-white border ${colors.border}`}
        >
          <div className={`p-6 border-b ${colors.border}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${colors.primary}`}>Recently Contacted</h3>
                <p className="text-sm text-neutral-600 mt-1">Latest outreach attempts</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchRecentEmails()}
                  className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                  title="Reload recent emails"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    Showing {filteredRecentEmails.length} of {recentEmails.length}
                  </span>
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {status?.totalEmailsSent || 0} Total Sent
                  </span>
                </div>
              </div>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="mt-4 space-y-3">
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={recentEmailsSearch}
                  onChange={(e) => setRecentEmailsSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2">
                {(['all', 'sent', 'opened', 'replied'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setRecentEmailsFilter(filter)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border ${
                      recentEmailsFilter === filter
                        ? `${colors.bgLight} ${colors.text} ${colors.border}`
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border-neutral-200'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
            {recentEmails.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <EnvelopeIcon className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                <p>No recent emails found.</p>
                <p className="text-xs mt-1">Start the agent to begin outreach.</p>
              </div>
            ) : filteredRecentEmails.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                <p>No contacts match your search or filter.</p>
                <p className="text-xs mt-1">Try adjusting your search terms or filters.</p>
              </div>
            ) : (
              filteredRecentEmails.map((contact) => (
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

      {/* Cycle Interval Modal */}
      {showIntervalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-neutral-900">Change Cycle Interval</h3>
              <button
                onClick={() => setShowIntervalModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <p className="text-sm text-neutral-600 mb-4">
              Select how often the agent should run a new cycle. The agent will restart with the new interval.
            </p>
            
            <div className="space-y-2 mb-6">
              {[1, 5, 10, 15, 30, 45, 60, 90, 120].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setNewInterval(minutes)}
                  className={`w-full text-left px-4 py-2 rounded border transition-colors ${
                    newInterval === minutes
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{minutes} {minutes === 1 ? 'minute' : 'minutes'}</span>
                    {newInterval === minutes && (
                      <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowIntervalModal(false)}
                className="flex-1 px-4 py-2 text-neutral-700 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors modal-button-visible modal-button-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleIntervalChange}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors modal-button-visible modal-button-primary"
              >
                Apply & Restart
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Email Queue Modal */}
      {showEmailQueue && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[98vh] overflow-hidden mx-4 flex flex-col"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Email Queue</h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    {emailQueue.length} emails queued for sending
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddEmail(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 transition-colors text-black text-sm font-medium"
                    style={{ color: 'black !important' }}
                  >
                    <div className="w-4 h-4 relative">
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-600 transform -translate-y-1/2"></div>
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600 transform -translate-x-1/2"></div>
                    </div>
                    <span style={{ color: 'black !important' }}>Add Email</span>
                  </button>
                  <button
                    onClick={() => setShowEmailQueue(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Filter Controls */}
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search by company, email, or subject..."
                      value={emailQueueSearch}
                      onChange={(e) => setEmailQueueSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-neutral-600">Sort:</label>
                  <select
                    value={emailQueueSort}
                    onChange={(e) => setEmailQueueSort(e.target.value as 'newest' | 'oldest')}
                    className="text-sm border border-neutral-300 rounded-md py-2 pl-3 pr-6 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{
                      backgroundPosition: 'calc(100% - 4px) center',
                      backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.25em 1.25em',
                      appearance: 'none'
                    }}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
                <div className="text-sm text-neutral-500">
                  {filteredAndSortedEmailQueue.length} of {emailQueue.length} emails
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto scroll-smooth">
              {filteredAndSortedEmailQueue.length === 0 ? (
                <div className="pt-58 text-center text-neutral-500">
                  <EnvelopeIcon className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                  {emailQueue.length === 0 ? (
                    <>
                      <p>No emails in queue.</p>
                      <p className="text-xs mt-1">The agent will add emails here when processing leads.</p>
                    </>
                  ) : (
                    <>
                      <p>No emails match your search.</p>
                      <p className="text-xs mt-1">Try adjusting your search terms or filters.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {filteredAndSortedEmailQueue.map((email, index) => (
                    <div
                      key={email.id || index}
                      className="bg-neutral-100 border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        {/* Left side - Email info */}
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-neutral-300 rounded-full flex items-center justify-center text-neutral-700 font-medium text-sm">
                              {(email.leadData?.name || email.recipientName || email.leadData?.email || email.to || email.finalRecipient || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-neutral-900 text-sm">
                                  {email.lead?.company || email.leadInfo?.company || email.leadData?.company || email.company || 'Unknown Company'}
                                </span>
                                {(email.leadData?.title || email.leadInfo?.title || email.lead?.title) && (
                                  <span className="text-xs text-neutral-500 font-medium">
                                    • {email.leadData?.title || email.leadInfo?.title || email.lead?.title}
                                  </span>
                                )}
                                <span className="text-xs text-neutral-500">
                                  • {email.leadData?.email || email.to || email.finalRecipient || 'Unknown Email'}
                                </span>
                                <span className="text-xs text-neutral-500">
                                  • Queued {email.createdAt ? new Date(email.createdAt).toLocaleDateString() : 'today'}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-600 truncate mt-1">
                                {email.emailData?.subject || email.subject || email.finalSubject || 'No Subject'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Right side - Action buttons */}
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingEmail(email);
                            }}
                            className="p-2 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit email"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              approveEmail(email.id);
                            }}
                            className="p-2 text-neutral-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Approve & send"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectEmail(email.id, 'Rejected by user');
                            }}
                            className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Reject email"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmail && !editingEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[98vh] overflow-hidden mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Email Preview</h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    To: {selectedEmail.leadData?.email || selectedEmail.to || selectedEmail.finalRecipient || 'Unknown'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="h-[70vh] overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Recipient Email</label>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                    {selectedEmail.leadData?.email || selectedEmail.to || selectedEmail.finalRecipient || 'No recipient'}
                  </div>
                </div>
                
                {(selectedEmail.cc || selectedEmail.emailData?.cc) && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">CC Email Addresses</label>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                      {selectedEmail.cc || selectedEmail.emailData?.cc}
                    </div>
                  </div>
                )}
                
                {(selectedEmail.bcc || selectedEmail.emailData?.bcc) && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">BCC Email Addresses</label>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                      {selectedEmail.bcc || selectedEmail.emailData?.bcc}
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Subject</label>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                    {selectedEmail.emailData?.subject || selectedEmail.subject || selectedEmail.finalSubject || 'No Subject'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Email Content</label>
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-md min-h-[300px] whitespace-pre-wrap">
                    {selectedEmail.emailData?.body || selectedEmail.personalizedEmail || selectedEmail.body || selectedEmail.finalBody || 'No content available'}
                  </div>
                </div>
                
                {(selectedEmail.leadData?.company || selectedEmail.company) && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Company</label>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                      {selectedEmail.leadData?.company || selectedEmail.company}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-4 justify-end">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => startEditingEmail(selectedEmail)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors shadow-sm text-black font-medium"
                  style={{ color: 'black !important' }}
                >
                  <PencilIcon className="h-4 w-4" style={{ color: 'black !important' }} />
                  Edit
                </button>
                <button
                  onClick={() => rejectEmail(selectedEmail.id, 'Rejected by user')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors shadow-sm text-black font-medium"
                  style={{ color: 'black !important' }}
                >
                  <XMarkIcon className="h-4 w-4" style={{ color: 'black !important' }} />
                  Reject
                </button>
                <button
                  onClick={() => approveEmail(selectedEmail.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 transition-colors shadow-sm text-black font-medium"
                  style={{ color: 'black !important' }}
                >
                  <CheckIcon className="h-4 w-4" style={{ color: 'black !important' }} />
                  Approve & Send
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Email Editing Modal */}
      {editingEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[98vh] overflow-hidden mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Edit Email</h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    To: {editingEmail.leadData?.email || editingEmail.to || editingEmail.finalRecipient || 'Unknown'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingEmail(null)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="h-[70vh] overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Recipient Email</label>
                  <input
                    type="email"
                    value={editedRecipient}
                    onChange={(e) => setEditedRecipient(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="recipient@email.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    CC Email Addresses
                    <span className="text-xs text-neutral-500 ml-2">(optional, comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={editedCc}
                    onChange={(e) => setEditedCc(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="cc1@email.com, cc2@email.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    BCC Email Addresses
                    <span className="text-xs text-neutral-500 ml-2">(optional, comma-separated, hidden from recipients)</span>
                  </label>
                  <input
                    type="text"
                    value={editedBcc}
                    onChange={(e) => setEditedBcc(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="bcc1@email.com, bcc2@email.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Email subject..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Email Content</label>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={15}
                    className="w-full p-4 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Email content..."
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-4 justify-end">
                <button
                  onClick={() => setEditingEmail(null)}
                  className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
                >
                  Close Editor
                </button>
                <button
                  onClick={saveEmailEdits}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors shadow-sm text-black font-medium"
                  style={{ color: 'black !important' }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Custom Email Modal */}
      {showAddEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[95vh] overflow-hidden mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Add Custom Email</h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    Add a custom email to the queue for testing or manual outreach
                  </p>
                </div>
                <button
                  onClick={() => setShowAddEmail(false)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="h-[60vh] overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    value={newEmailRecipient}
                    onChange={(e) => setNewEmailRecipient(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="recipient@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    CC Email Addresses
                    <span className="text-xs text-neutral-500 ml-2">(optional, comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={newEmailCc}
                    onChange={(e) => setNewEmailCc(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="cc1@example.com, cc2@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    BCC Email Addresses
                    <span className="text-xs text-neutral-500 ml-2">(optional, comma-separated, hidden from recipients)</span>
                  </label>
                  <input
                    type="text"
                    value={newEmailBcc}
                    onChange={(e) => setNewEmailBcc(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="bcc1@example.com, bcc2@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={newEmailSubject}
                    onChange={(e) => setNewEmailSubject(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Email subject..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email Content *
                  </label>
                  <textarea
                    value={newEmailContent}
                    onChange={(e) => setNewEmailContent(e.target.value)}
                    rows={12}
                    className="w-full p-4 border border-neutral-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Email content here..."
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-4 justify-end">
                <button
                  onClick={() => setShowAddEmail(false)}
                  className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomEmail}
                  disabled={!newEmailRecipient || !newEmailSubject || !newEmailContent}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 transition-colors shadow-sm text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: 'black !important' }}
                >
                  <div className="w-4 h-4 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-600 transform -translate-y-1/2"></div>
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600 transform -translate-x-1/2"></div>
                  </div>
                  <span style={{ color: 'black !important' }}>Add to Queue</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Recent Contacts Modal */}
      {showRecentContacts && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[98vh] overflow-hidden mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Recent Email Activity</h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    {recentEmails.length} emails sent • Track opens, clicks, and replies
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearRecentEmails}
                    className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors text-black text-sm font-medium"
                    style={{ color: 'black !important' }}
                  >
                    <span style={{ color: 'black !important' }}>Clear All</span>
                  </button>
                  <button
                    onClick={() => setShowRecentContacts(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="h-[75vh] overflow-y-auto">
              {recentEmails.length === 0 ? (
                <div className="p-12 text-center text-neutral-500">
                  <EnvelopeIcon className="h-16 w-16 mx-auto mb-4 text-neutral-300" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No Recent Activity</h3>
                  <p>No emails have been sent yet.</p>
                  <p className="text-xs mt-1">Start the agent to begin outreach.</p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {recentEmails.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 hover:bg-neutral-100 cursor-pointer transition-colors"
                      onClick={() => setSelectedRecentEmail(contact)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-neutral-300 rounded-full flex items-center justify-center text-neutral-700 font-medium">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-neutral-900">{contact.name}</h4>
                              <span className="text-sm text-neutral-500">•</span>
                              <span className="text-sm text-neutral-600">{contact.email}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1 text-sm text-neutral-500">
                                <BuildingOfficeIcon className="h-3 w-3" />
                                {contact.company}
                              </div>
                              <span className="text-sm text-neutral-400">•</span>
                              <span className="text-xs text-neutral-400">
                                Sent {new Date(contact.dateSent).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 text-sm rounded-full font-medium ${
                            contact.status === 'replied' ? 'bg-green-100 text-green-700 border border-green-300' :
                            contact.status === 'opened' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                            'bg-neutral-100 text-neutral-700 border border-neutral-300'
                          }`}>
                            {contact.status === 'replied' && <CheckCircleIcon className="h-4 w-4" />}
                            {contact.status === 'opened' && <EyeIcon className="h-4 w-4" />}
                            {contact.status === 'sent' && <ClockIcon className="h-4 w-4" />}
                            {contact.status === 'replied' ? 'Replied' : 
                             contact.status === 'opened' ? 'Opened' : 'Sent'}
                          </div>
                          <div className="text-sm text-neutral-400">
                            →
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Recent Email Detail Modal */}
      {selectedRecentEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[98vh] overflow-hidden mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Email Details</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-neutral-600">
                      To: {selectedRecentEmail.name} ({selectedRecentEmail.email})
                    </span>
                    <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${
                      selectedRecentEmail.status === 'replied' ? 'bg-green-100 text-green-700' :
                      selectedRecentEmail.status === 'opened' ? 'bg-blue-100 text-blue-700' :
                      'bg-neutral-100 text-neutral-700'
                    }`}>
                      {selectedRecentEmail.status === 'replied' && <CheckCircleIcon className="h-3 w-3" />}
                      {selectedRecentEmail.status === 'opened' && <EyeIcon className="h-3 w-3" />}
                      {selectedRecentEmail.status === 'sent' && <ClockIcon className="h-3 w-3" />}
                      {selectedRecentEmail.status.charAt(0).toUpperCase() + selectedRecentEmail.status.slice(1)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecentEmail(null)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="h-[70vh] overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Email Tracking Info */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-neutral-900 mb-3">Tracking Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-neutral-500">Sent</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {new Date(selectedRecentEmail.dateSent).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Status</p>
                      <p className={`text-sm font-medium ${
                        selectedRecentEmail.status === 'replied' ? 'text-green-600' :
                        selectedRecentEmail.status === 'opened' ? 'text-blue-600' :
                        'text-neutral-600'
                      }`}>
                        {selectedRecentEmail.status.charAt(0).toUpperCase() + selectedRecentEmail.status.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Opened</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {selectedRecentEmail.opened ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Replied</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {selectedRecentEmail.replied ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Company Info */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Company</label>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                    {selectedRecentEmail.company}
                  </div>
                </div>

                {/* Email Subject - we might not have this in the current data structure */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Subject</label>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                    {selectedRecentEmail.subject || 'Email subject not available'}
                  </div>
                </div>

                {/* Email Content - we might not have this in the current data structure */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Email Content</label>
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-md min-h-[200px] whitespace-pre-wrap">
                    {selectedRecentEmail.content || selectedRecentEmail.body || 'Email content not available'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-4 justify-end">
                <button
                  onClick={() => setSelectedRecentEmail(null)}
                  className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Scheduled Events Modal */}
      {showScheduledEvents && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[95vh] overflow-hidden mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Scheduled Events</h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    {scheduledEvents.length} events scheduled • Meetings and calls
                  </p>
                </div>
                <button
                  onClick={() => setShowScheduledEvents(false)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {scheduledEvents.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-neutral-500">No scheduled events yet.</p>
                  <p className="text-xs text-neutral-400 mt-1">Events will appear here when meetings are scheduled.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledEvents.map((event, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                      onClick={() => setSelectedScheduledEvent(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-neutral-900">
                            {event.title || `Meeting with ${event.contactName || event.company || 'Unknown'}`}
                          </h3>
                          <div className="flex items-center gap-4 mt-2 text-xs text-neutral-600">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {new Date(event.scheduledTime).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {new Date(event.scheduledTime).toLocaleTimeString()}
                            </div>
                            {event.company && (
                              <div className="flex items-center gap-1">
                                <BuildingOfficeIcon className="h-3 w-3" />
                                {event.company}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            event.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-neutral-100 text-neutral-800'
                          }`}>
                            {event.status || 'scheduled'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Scheduled Event Details Modal */}
      {selectedScheduledEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-neutral-900">Event Details</h2>
                <button
                  onClick={() => setSelectedScheduledEvent(null)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Event Information */}
              <div>
                <h3 className="text-lg font-medium text-neutral-900 mb-4">
                  {selectedScheduledEvent.title || `Meeting with ${selectedScheduledEvent.contactName || selectedScheduledEvent.company || 'Unknown'}`}
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Date & Time</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {new Date(selectedScheduledEvent.scheduledTime).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      selectedScheduledEvent.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      selectedScheduledEvent.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-neutral-100 text-neutral-800'
                    }`}>
                      {selectedScheduledEvent.status || 'scheduled'}
                    </span>
                  </div>
                  {selectedScheduledEvent.company && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Company</p>
                      <p className="text-sm font-medium text-neutral-900">{selectedScheduledEvent.company}</p>
                    </div>
                  )}
                  {selectedScheduledEvent.contactName && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Contact</p>
                      <p className="text-sm font-medium text-neutral-900">{selectedScheduledEvent.contactName}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar Link */}
              {selectedScheduledEvent.calendarLink && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Calendar Link</h4>
                  <div className="flex items-center gap-3">
                    <a
                      href={selectedScheduledEvent.calendarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      Open in Calendar
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedScheduledEvent.calendarLink)}
                      className="px-3 py-2 border border-blue-300 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              )}

              {/* Meeting Details */}
              {selectedScheduledEvent.description && (
                <div>
                  <h4 className="text-sm font-medium text-neutral-900 mb-2">Description</h4>
                  <p className="text-sm text-neutral-600">{selectedScheduledEvent.description}</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-4 justify-end">
                <button
                  onClick={() => setSelectedScheduledEvent(null)}
                  className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      </div>
    </div>
  );
}