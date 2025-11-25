'use client';

import { useState, useEffect } from 'react';
import { MonitoringView } from './MonitoringSidebar';
import { 
  ChartBarIcon, 
  BellIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  BoltIcon,
  EnvelopeIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import AgentSettingsModal from './AgentSettingsModal';
import RateLimitSettings from './RateLimitSettings';
import KeywordMemoryPanel from './KeywordMemoryPanel';
import NotificationBadge from '../NotificationBadge';

interface MonitoringContentProps {
  view: MonitoringView;
  metrics: any;
  issues: any[];
  connected: boolean;
  onResolveIssue?: (issueId: string) => void;
}

export default function MonitoringContent({ view, metrics, issues, connected, onResolveIssue }: MonitoringContentProps) {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentTab, setSelectedAgentTab] = useState<string>('all');
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [replyActivityData, setReplyActivityData] = useState<any[]>([]);
  const [cyclesData, setCyclesData] = useState<any[]>([]);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<{[key: string]: any}>({});
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [newInterval, setNewInterval] = useState<number>(30);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const [apiUsage, setApiUsage] = useState<{[key: string]: any}>({});
  const [totalApiUsage, setTotalApiUsage] = useState<any>(null);
  const [apiUsageTimeSeries, setApiUsageTimeSeries] = useState<any[]>([]);
  const [rateLimits, setRateLimits] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'minute' | 'hour' | 'day' | 'month'>('day');
  const [costTimeRange, setCostTimeRange] = useState<'minute' | 'hour' | 'day' | 'month'>('day');
  const [costTimeSeries, setCostTimeSeries] = useState<any[]>([]);
  const [customDays, setCustomDays] = useState<number>(7);
  const [costCustomDays, setCostCustomDays] = useState<number>(7);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'cycles' | 'important' | 'agents' | 'issues'>('all');
  const [dismissingActivity, setDismissingActivity] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState<boolean>(false);
  
  // Outreach state
  const [outreachViewTracking, setOutreachViewTracking] = useState<any[]>([]);
  const [outreachConversations, setOutreachConversations] = useState<any[]>([]);
  const [outreachSelectedConversation, setOutreachSelectedConversation] = useState<any | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(true);
  const [outreachStats, setOutreachStats] = useState({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });
  
  // Analytics graphs time filtering
  const [emailActivityTimeRange, setEmailActivityTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  const [replyActivityTimeRange, setReplyActivityTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  const [cyclesTimeRange, setCyclesTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  
  // Sent emails stream
  const [sentEmailsStream, setSentEmailsStream] = useState<any[]>([]);

  // API cost constants (must match backend)
  const apiCosts = {
    apollo: 0.017, // $0.017 per credit
    openai: 0.0034, // $0.0034 per 1K tokens
    mailgun: 0.00136, // $0.00136 per email
    zerobounce: 0.0085, // $0.0085 per validation
    serper: 0.001 // $0.001 per search ($50 for 50k credits)
  };

  // Calculate budget-based limits for each API
  const getBudgetBasedLimits = () => {
    if (!rateLimits?.monthlyBudget) return null;
    
    const monthlyBudget = rateLimits.monthlyBudget;
    
    return {
      apollo: Math.floor(monthlyBudget / apiCosts.apollo),
      openai: Math.floor((monthlyBudget / apiCosts.openai) * 1000), // Convert to individual tokens (budget gives us thousands, multiply by 1000)
      mailgun: Math.floor(monthlyBudget / apiCosts.mailgun),
      zerobounce: Math.floor(monthlyBudget / apiCosts.zerobounce),
      serper: Math.floor(monthlyBudget / apiCosts.serper)
    };
  };

  useEffect(() => {
    fetchRealData();
  }, []);

  // Fetch activities when Activity Logs view is shown
  useEffect(() => {
    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const res = await api.get('/api/monitoring/activity');
        if (res.data?.success) setActivities(res.data.activities || []);
      } catch (e) {
        console.error('Error fetching activities', e);
      } finally {
        setLoadingActivities(false);
      }
    };

    if (view === 'logs') {
      fetchActivities();
      
      // Setup SSE connection for real-time activity updates
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const eventSource = new EventSource(`/api/monitoring/stream?token=${token}`);
      
      eventSource.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle new activity added
          if (data.type === 'activity_added' && data.data) {
            setActivities(prev => [data.data, ...prev]);
            
            // Show toast notification
            console.log('📌 New activity:', data.data.title);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      });
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
      };
      
      // Cleanup on unmount or view change
      return () => {
        eventSource.close();
      };
    }
  }, [view]);
  
  // Fetch outreach data when view changes to outreach
  useEffect(() => {
    const fetchOutreachData = async () => {
      setOutreachLoading(true);
      try {
        const response = await api.get('/api/outreach/stats?timeRange=7d').catch(() => null);
        if (response?.data?.success) {
          setOutreachStats({
            viewed: response.data.stats.totalOpened || 0,
            replied: response.data.stats.totalReplies || 0,
            meetings: response.data.stats.totalMeetingsBooked || 0,
            conversionRate: response.data.stats.replyRate || 0
          });
        } else {
          setOutreachStats({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });
        }

        const convResponse = await api.get('/api/outreach/conversations?timeRange=7d').catch(() => null);
        if (convResponse?.data?.success) {
          setOutreachConversations(convResponse.data.conversations || []);
        }

        const timelineResponse = await api.get('/api/outreach/timeline?timeRange=7d').catch(() => null);
        if (timelineResponse?.data?.success) {
          const views = (timelineResponse.data.events || []).filter((e: any) => e.eventType === 'open');
          setOutreachViewTracking(views);
        }
      } catch (error) {
        console.error('Failed to fetch outreach data:', error);
        setOutreachStats({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });
        setOutreachConversations([]);
        setOutreachViewTracking([]);
      } finally {
        setOutreachLoading(false);
      }
    };

    if (view === 'outreach') {
      fetchOutreachData();
    }
  }, [view]);
  
  // Setup SSE connection for analytics view to receive sent emails
  useEffect(() => {
    if (view === 'analytics') {
      // First, fetch historical sent emails
      const fetchHistoricalSentEmails = async () => {
        try {
          console.log('📧 [Analytics] Fetching historical sent emails...');
          const response = await api.get('/api/email-queue/sent?agentId=all');
          const emails = response.data || [];
          console.log(`📧 [Analytics] Loaded ${emails.length} historical sent emails`);
          
          // Map the emails to match the expected format
          const formattedEmails = emails.map((email: any) => {
            // Extract company from multiple possible locations
            const company = email.lead?.company || 
                          email.leadInfo?.company || 
                          email.leadData?.company ||
                          email.personInfo?.company || 
                          email.company ||
                          email.metadata?.company ||
                          'Unknown Company';
            
            // Check if email was opened from tracking data
            const opened = Boolean(
              email.opened ||
              email.analytics?.opened ||
              email.tracking?.opened ||
              email.zillizData?.opened ||
              (email.zillizData?.events && email.zillizData.events.some((e: any) => e.event_type === 'email_open'))
            );
            
            return {
              timestamp: email.sentAt || email.createdAt,
              dateSent: email.sentAt || email.createdAt,
              to: email.to,
              name: email.lead?.name || email.leadInfo?.name || email.personInfo?.fullName || email.to?.split('@')[0],
              company,
              subject: email.subject,
              agentId: email.agentId,
              opened,
              ...email
            };
          });
          
          setSentEmailsStream(formattedEmails.slice(0, 50)); // Keep last 50 emails
        } catch (error) {
          console.error('📧 [Analytics] Error fetching historical sent emails:', error);
        }
      };
      
      fetchHistoricalSentEmails();
      
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const eventSource = new EventSource(`/api/monitoring/stream?token=${token}`);
      
      eventSource.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle sent email updates
          if (data.type === 'email_sent' && data.data) {
            console.log('📧 [Analytics] New email sent:', data.data);
            setSentEmailsStream(prev => [data.data, ...prev].slice(0, 50)); // Keep last 50 emails
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      });
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
      };
      
      // Cleanup on unmount or view change
      return () => {
        eventSource.close();
      };
    }
  }, [view]);

  // Fetch agent statuses (cycle info, etc.)
  useEffect(() => {
    const fetchAgentStatuses = async () => {
      const statuses: {[key: string]: any} = {};
      const usage: {[key: string]: any} = {};
      
      for (const agent of agents) {
        try {
          const response = await api.get(`/api/lead-agent/status?agentId=${agent.id}`);
          if (response.data.success) {
            statuses[agent.id] = response.data;
          }
          
          // Fetch API usage
          const usageResponse = await api.get(`/api/lead-agent/api-usage?agentId=${agent.id}`);
          if (usageResponse.data.success) {
            usage[agent.id] = usageResponse.data.stats;
          }
        } catch (error) {
          console.error(`Error fetching status for agent ${agent.id}:`, error);
        }
      }
      setAgentStatuses(statuses);
      setApiUsage(usage);
    };

    const fetchTotalApiUsage = async () => {
      try {
        const response = await api.get('/api/lead-agent/api-usage/total');
        if (response.data.success) {
          setTotalApiUsage(response.data.stats);
        }
      } catch (error) {
        console.error('Error fetching total API usage:', error);
      }
    };

    const fetchApiUsageTimeSeries = async () => {
      try {
        // Map time range to days parameter
        const daysMap = {
          'minute': 1, // Last 24 hours (by minute not fully supported yet, will show hourly)
          'hour': 1,   // Last 24 hours
          'day': customDays,    // User-specified days
          'month': customDays  // User-specified days for monthly view
        };
        const days = daysMap[timeRange];
        
        const response = await api.get(`/api/lead-agent/api-usage/timeseries?days=${days}&interval=${timeRange}`);
        if (response.data.success && response.data.series) {
          console.log('[API Usage TimeSeries] Received data:', response.data.series);
          setApiUsageTimeSeries(response.data.series);
        }
      } catch (error) {
        console.error('Error fetching API usage time series:', error);
      }
    };

    const fetchCostTimeSeries = async () => {
      try {
        const daysMap = {
          'minute': 1,
          'hour': 1,
          'day': costCustomDays,
          'month': costCustomDays
        };
        const days = daysMap[costTimeRange];
        
        const response = await api.get(`/api/lead-agent/api-usage/timeseries?days=${days}&interval=${costTimeRange}`);
        if (response.data.success && response.data.series) {
          setCostTimeSeries(response.data.series);
        }
      } catch (error) {
        console.error('Error fetching cost time series:', error);
      }
    };

    const fetchRateLimits = async () => {
      try {
        const response = await api.get('/api/lead-agent/rate-limits');
        if (response.data.success) {
          setRateLimits(response.data.rateLimits);
        }
      } catch (error) {
        console.error('Error fetching rate limits:', error);
      }
    };

    if (agents.length > 0) {
      fetchAgentStatuses();
      fetchTotalApiUsage();
      fetchApiUsageTimeSeries();
      fetchCostTimeSeries();
      fetchRateLimits();
      
      // Refresh statuses every 30 seconds
      const statusInterval = setInterval(() => {
        fetchAgentStatuses();
        fetchTotalApiUsage();
        fetchRateLimits();
      }, 30000); // 30 seconds for agent statuses
      
      // Refresh time series data every 2 minutes (matches backend cache TTL)
      const timeSeriesInterval = setInterval(() => {
        fetchApiUsageTimeSeries();
        fetchCostTimeSeries();
      }, 120000); // 2 minutes for time series data
      
      return () => {
        clearInterval(statusInterval);
        clearInterval(timeSeriesInterval);
      };
    }
  }, [agents, timeRange, costTimeRange, customDays, costCustomDays]); // Re-fetch when either timeRange or custom days changes

  const fetchRealData = async () => {
    try {
      setLoading(true);
      // Fetch actual agents and their stats
      const response = await api.get('/api/auth/agents');
      if (response.data.success && response.data.agents) {
        const agentsWithStats = await Promise.all(
          response.data.agents.map(async (agent: any) => {
            const queueResponse = await api.get(`/api/email-queue/queue?agentId=${agent.agentId}`);
            const sentResponse = await api.get(`/api/email-queue/approved?agentId=${agent.agentId}`);
            
            const queued = Array.isArray(queueResponse.data) ? queueResponse.data.length : 0;
            const sentEmails = Array.isArray(sentResponse.data) ? sentResponse.data : [];
            const sent = sentEmails.length;
            const replied = sentEmails.filter((e: any) => e.replied || e.status === 'REPLIED').length;
            
            return {
              id: agent.agentId,
              name: agent.name,
              queued,
              sent,
              replied,
              status: agent.status,
              personality: agent.personality, // Include personality data
              sentEmails // Keep for timeline data
            };
          })
        );
        setAgents(agentsWithStats);
        
        // Generate time series data from sent emails
        generateTimeSeriesData(agentsWithStats);
      }
    } catch (error) {
      console.error('Error fetching real data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    try {
      const response = await api.put(`/api/issues/${issueId}/read`);
      if (response.data.success) {
        // Call the parent callback to update the issues state
        if (onResolveIssue) {
          onResolveIssue(issueId);
        }
      }
    } catch (error) {
      console.error('Error resolving issue:', error);
    }
  };

  // Helper function to get time key based on range
  const getTimeKey = (date: Date, range: 'hour' | 'day' | 'week'): string => {
    if (range === 'hour') {
      return `${date.toISOString().split('T')[0]} ${date.getHours()}:00`; // YYYY-MM-DD HH:00
    } else if (range === 'day') {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } else { // week
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      return weekStart.toISOString().split('T')[0]; // YYYY-MM-DD of week start
    }
  };

  // Helper function to format time key for display
  const formatTimeKey = (key: string, range: 'hour' | 'day' | 'week'): string => {
    if (range === 'hour') {
      const [dateStr, hourStr] = key.split(' ');
      const date = new Date(dateStr);
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hourStr}`;
    } else if (range === 'day') {
      return new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else { // week
      const weekStart = new Date(key);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  };

  const generateTimeSeriesData = (agentsData: any[], filterAgentId?: string) => {
    // Collect all sent emails with timestamps
    const allEmails: any[] = [];
    agentsData.forEach(agent => {
      // Skip if filtering by specific agent and this isn't it
      if (filterAgentId && agent.id !== filterAgentId) {
        return;
      }

      if (agent.sentEmails && Array.isArray(agent.sentEmails)) {
        agent.sentEmails.forEach((email: any) => {
          allEmails.push({
            date: email.sentAt || email.approvedAt || email.timestamp,
            agentId: agent.id,
            agentName: agent.name,
            replied: email.replied || email.status === 'REPLIED'
          });
        });
      }
    });

    // Sort by date
    allEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by selected time range
    const groupedData: { [key: string]: { date: string; sent: number; replied: number } } = {};
    
    allEmails.forEach(email => {
      const date = new Date(email.date);
      const timeKey = getTimeKey(date, emailActivityTimeRange);
      
      if (!groupedData[timeKey]) {
        groupedData[timeKey] = { date: timeKey, sent: 0, replied: 0 };
      }
      
      groupedData[timeKey].sent += 1;
      if (email.replied) {
        groupedData[timeKey].replied += 1;
      }
    });

    // Convert to array and format dates
    const timeSeriesArray = Object.values(groupedData).map(item => ({
      ...item,
      dateFormatted: formatTimeKey(item.date, emailActivityTimeRange)
    }));

    setTimeSeriesData(timeSeriesArray);
  };

  const generateReplyActivityData = (agentsData: any[], filterAgentId?: string) => {
    // Collect all replied emails with timestamps
    const repliedEmails: any[] = [];
    agentsData.forEach(agent => {
      if (filterAgentId && agent.id !== filterAgentId) {
        return;
      }

      if (agent.sentEmails && Array.isArray(agent.sentEmails)) {
        agent.sentEmails.forEach((email: any) => {
          if (email.replied || email.status === 'REPLIED') {
            repliedEmails.push({
              date: email.repliedAt || email.sentAt, // Use repliedAt if available, fallback to sentAt
              agentId: agent.id,
              agentName: agent.name
            });
          }
        });
      }
    });

    // Sort by date
    repliedEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by selected time range
    const groupedData: { [key: string]: { date: string; replies: number } } = {};
    
    repliedEmails.forEach(email => {
      const date = new Date(email.date);
      const timeKey = getTimeKey(date, replyActivityTimeRange);
      
      if (!groupedData[timeKey]) {
        groupedData[timeKey] = { date: timeKey, replies: 0 };
      }
      
      groupedData[timeKey].replies += 1;
    });

    // Convert to array and format dates
    const replyArray = Object.values(groupedData).map(item => ({
      ...item,
      dateFormatted: formatTimeKey(item.date, replyActivityTimeRange)
    }));

    setReplyActivityData(replyArray);
  };

  const generateCyclesData = async (agentsData: any[], filterAgentId?: string) => {
    try {
      // Fetch real cycle logs from backend
      const agentParam = filterAgentId ? `?agentId=${filterAgentId}` : '';
      console.log('📊 [CYCLES] Fetching cycle logs with params:', agentParam);
      const response = await api.get(`/api/lead-agent/cycle-logs${agentParam}`);
      console.log('📊 [CYCLES] Raw response:', response);
      console.log('📊 [CYCLES] Response data:', response.data);
      console.log('📊 [CYCLES] Cycle logs array:', response.data.cycleLogs);
      
      if (response.data.success && response.data.cycleLogs && response.data.cycleLogs.length > 0) {
        const cycleLogs = response.data.cycleLogs;
        console.log('📊 [CYCLES] Processing', cycleLogs.length, 'cycle logs');
        console.log('📊 [CYCLES] First log sample:', cycleLogs[0]);
        
        if (filterAgentId) {
          // Single agent view - simple line
          const groupedData: { [key: string]: { date: string; cycles: number } } = {};
          
          cycleLogs.forEach((log: any) => {
            const date = new Date(log.completedAt);
            const timeKey = getTimeKey(date, cyclesTimeRange);
            
            if (!groupedData[timeKey]) {
              groupedData[timeKey] = { date: timeKey, cycles: 0 };
            }
            
            groupedData[timeKey].cycles += 1;
          });
          
          // Convert to array and format dates
          const cyclesArray = Object.values(groupedData).map(item => ({
            ...item,
            dateFormatted: formatTimeKey(item.date, cyclesTimeRange)
          }));
          
          // Sort by date
          cyclesArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          console.log('📊 Generated cycles data:', cyclesArray);
          setCyclesData(cyclesArray);
        } else {
          // All agents view - multiple lines per agent
          const groupedDataByAgent: { [key: string]: { [key: string]: number } } = {};
          const allTimeKeys = new Set<string>();
          
          cycleLogs.forEach((log: any) => {
            const date = new Date(log.completedAt);
            const timeKey = getTimeKey(date, cyclesTimeRange);
            const agentName = agentsData.find(a => a.id === log.agentId)?.name || log.agentId;
            
            allTimeKeys.add(timeKey);
            
            if (!groupedDataByAgent[timeKey]) {
              groupedDataByAgent[timeKey] = {};
            }
            
            if (!groupedDataByAgent[timeKey][agentName]) {
              groupedDataByAgent[timeKey][agentName] = 0;
            }
            
            groupedDataByAgent[timeKey][agentName] += 1;
          });
          
          // Convert to array with all agent columns
          const cyclesArray = Array.from(allTimeKeys).map(timeKey => {
            const dataPoint: any = {
              date: timeKey,
              dateFormatted: formatTimeKey(timeKey, cyclesTimeRange)
            };
            
            // Add each agent's count
            Object.keys(groupedDataByAgent[timeKey] || {}).forEach(agentName => {
              dataPoint[agentName] = groupedDataByAgent[timeKey][agentName];
            });
            
            return dataPoint;
          });
          
          // Sort by date
          cyclesArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          console.log('📊 Generated multi-agent cycles data:', cyclesArray);
          setCyclesData(cyclesArray);
        }
      } else {
        console.log('📊 No cycle logs found, setting empty array');
        setCyclesData([]);
      }
    } catch (error) {
      console.error('❌ Error fetching cycle logs:', error);
      setCyclesData([]);
    }
  };

  // Regenerate time series data when agent selection or time ranges change
  useEffect(() => {
    if (agents.length > 0) {
      const filterAgentId = selectedAgentTab === 'all' ? undefined : selectedAgentTab;
      generateTimeSeriesData(agents, filterAgentId);
      generateReplyActivityData(agents, filterAgentId);
      generateCyclesData(agents, filterAgentId);
    }
  }, [selectedAgentTab, agents, emailActivityTimeRange, replyActivityTimeRange, cyclesTimeRange]);
  
  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">System Overview</h2>
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Emails Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">EMAILS</span>
                <ChartBarIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {metrics.emails?.sent || 0}
                </span>
                <span className="text-xs text-neutral-500">sent</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {metrics.emails?.queued || 0} queued · {metrics.emails?.replied || 0} replied
              </div>
            </div>

            {/* Emails Viewed Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">EMAILS VIEWED</span>
                <ChartBarIcon className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {metrics.emails?.viewed || 0}
                </span>
                <span className="text-xs text-neutral-500">opened</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {metrics.emails?.sent > 0 ? ((metrics.emails?.viewed || 0) / metrics.emails.sent * 100).toFixed(1) : 0}% open rate
              </div>
            </div>

            {/* Meetings Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">MEETINGS</span>
                <ChartBarIcon className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {metrics.meetings?.booked || 0}
                </span>
                <span className="text-xs text-neutral-500">booked</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {metrics.emails?.replied || 0} responses
              </div>
            </div>

            {/* Issues Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
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
              <div className="mt-2 text-xs text-neutral-600">
                {issues.filter(i => i.severity === 'critical' || i.severity === 'high').length} errors · {issues.filter(i => i.severity === 'medium').length} warnings
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Issues */}
      {issues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">Recent Issues</h3>
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm divide-y divide-neutral-100">
            {issues.slice(0, 5).map((issue) => {
              const isCritical = issue.severity === 'critical' || issue.severity === 'high';
              const isWarning = issue.severity === 'medium';
              return (
              <div key={issue.id} className="p-4">
                <div className="flex items-start gap-3">
                  {isCritical && <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  {isWarning && <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                  {!isCritical && !isWarning && <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{issue.message}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(issue.timestamp).toLocaleString()} · Agent: {issue.agentId}
                    </p>
                  </div>
                  {issue.resolved && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => {
    // Calculate REAL aggregate metrics from AWS data
    const totalQueued = agents.reduce((sum, agent) => sum + agent.queued, 0);
    const totalSent = agents.reduce((sum, agent) => sum + agent.sent, 0);
    const totalReplied = agents.reduce((sum, agent) => sum + agent.replied, 0);
    const successRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0';
    
    // Get selected agent data
    const selectedAgent = selectedAgentTab !== 'all' 
      ? agents.find(a => a.id === selectedAgentTab)
      : null;

    // Data for current view (all agents or specific agent)
    const currentData = selectedAgent ? {
      queued: selectedAgent.queued,
      sent: selectedAgent.sent,
      replied: selectedAgent.replied,
      successRate: selectedAgent.sent > 0 ? ((selectedAgent.replied / selectedAgent.sent) * 100).toFixed(1) : '0.0'
    } : {
      queued: totalQueued,
      sent: totalSent,
      replied: totalReplied,
      successRate
    };

    // Funnel data for chart
    const funnelData = [
      { stage: 'Queued', count: currentData.queued, fill: '#94a3b8' },
      { stage: 'Sent', count: currentData.sent, fill: '#3b82f6' },
      { stage: 'Replied', count: currentData.replied, fill: '#8b5cf6' }
    ];

    // Agent comparison data (only show when "all" is selected)
    const agentComparisonData = agents.map(agent => ({
      name: agent.name.length > 15 ? agent.name.substring(0, 12) + '...' : agent.name,
      Sent: agent.sent,
      Replied: agent.replied,
      Queued: agent.queued
    }));
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Analytics Dashboard</h2>
          <div className="text-sm text-neutral-600">
            {connected ? '🟢 Live Data' : '🔴 Offline'} {loading && '⏳ Loading...'}
          </div>
        </div>

        {/* Mini Tab System */}
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-2 sticky top-0 z-20">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedAgentTab('all')}
              style={selectedAgentTab === 'all' ? { backgroundColor: '#2563eb', color: '#ffffff' } : {}}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                selectedAgentTab === 'all'
                  ? ''
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              All Agents
            </button>
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentTab(agent.id)}
                style={selectedAgentTab === agent.id ? { backgroundColor: '#2563eb', color: '#ffffff' } : {}}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                  selectedAgentTab === agent.id
                    ? ''
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-4 gap-4 relative z-0">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
            <div className="text-xs text-neutral-600 mb-1">
              {selectedAgent ? `${selectedAgent.name} - SENT` : 'TOTAL SENT'}
            </div>
            <div className="text-3xl font-bold text-blue-600">{currentData.sent}</div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
            <div className="text-xs text-neutral-600 mb-1">QUEUED</div>
            <div className="text-3xl font-bold text-neutral-600">{currentData.queued}</div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
            <div className="text-xs text-neutral-600 mb-1">REPLIES</div>
            <div className="text-3xl font-bold text-purple-600">{currentData.replied}</div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
            <div className="text-xs text-neutral-600 mb-1">SUCCESS RATE</div>
            <div className="text-3xl font-bold text-green-600">{currentData.successRate}%</div>
          </div>
        </div>

        {/* Real-Time Sent Emails Stream */}
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-900">📧 Recent Sent Emails</h3>
            <span className="text-sm text-neutral-500">{sentEmailsStream.length} emails</span>
          </div>
          {sentEmailsStream.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sentEmailsStream.map((email, index) => {
                // Find the agent that sent this email
                const sendingAgent = agents.find(a => a.id === email.agentId);
                const agentColor = sendingAgent?.personality?.color || 'blue';
                const agentAvatar = sendingAgent?.personality?.avatar;
                const agentName = sendingAgent?.name || 'Unknown Agent';
                
                // Determine status badge
                const isOpened = email.opened || email.analytics?.opened;
                const statusBadge = isOpened 
                  ? { text: 'Viewed', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: EyeIcon }
                  : { text: 'Sent', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircleIcon };
                
                return (
                  <div
                    key={`${email.timestamp}-${index}`}
                    className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 hover:bg-neutral-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      {/* Left side - Email info */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-8 w-8 bg-neutral-300 rounded-full flex items-center justify-center text-neutral-700 font-medium text-sm">
                          {(email.name || email.to || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-neutral-900 text-sm truncate">
                              {email.company}
                            </span>
                            <span className="text-xs text-neutral-500">•</span>
                            <span className="text-xs text-neutral-500 truncate">
                              {email.to}
                            </span>
                            <span className="text-xs text-neutral-500">•</span>
                            <span className="text-xs text-neutral-400">
                              {new Date(email.timestamp || email.dateSent).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 truncate mt-1">
                            {email.subject || 'No Subject'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Right side - Status and Agent */}
                      <div className="flex items-center gap-2 ml-4">
                        <div className={`inline-flex items-center gap-2 px-2 py-1 text-xs rounded-full font-medium ${statusBadge.color} border`}>
                          <statusBadge.icon className="h-3 w-3" />
                          {statusBadge.text}
                        </div>
                        {sendingAgent && (
                          <div className="flex items-center gap-2">
                            {agentAvatar ? (
                              <img 
                                src={agentAvatar} 
                                alt={agentName}
                                className="h-8 w-8 rounded-full object-cover"
                                title={`Sent by ${agentName}`}
                              />
                            ) : (
                              <div 
                                className="h-8 w-8 rounded-full flex items-center justify-center text-white font-medium text-xs"
                                style={{ 
                                  backgroundColor: agentColor === 'red' ? '#ef4444' : 
                                                 agentColor === 'blue' ? '#3b82f6' :
                                                 agentColor === 'purple' ? '#a855f7' :
                                                 agentColor === 'green' ? '#10b981' :
                                                 agentColor === 'orange' ? '#f97316' : '#3b82f6'
                                }}
                                title={`Sent by ${agentName}`}
                              >
                                {agentName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-medium text-neutral-700 hidden lg:inline">
                              {agentName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">
              <EnvelopeIcon className="h-16 w-16 mx-auto mb-4 text-neutral-300" />
              <p>No emails sent yet</p>
              <p className="text-xs mt-1">Sent emails will appear here in real-time</p>
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Activity Over Time Line Chart */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                {selectedAgent ? `${selectedAgent.name} - Activity Timeline` : 'Email Activity Over Time'}
              </h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setEmailActivityTimeRange('hour')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={emailActivityTimeRange === 'hour' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Hour
                </button>
                <button
                  onClick={() => setEmailActivityTimeRange('day')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={emailActivityTimeRange === 'day' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Day
                </button>
                <button
                  onClick={() => setEmailActivityTimeRange('week')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={emailActivityTimeRange === 'week' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Week
                </button>
                {emailActivityTimeRange === 'week' && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-300">
                    <button
                      onClick={() => {
                        const newDate = selectedWeekStart ? new Date(selectedWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000) : new Date();
                        setSelectedWeekStart(newDate);
                      }}
                      className="px-2 py-1 text-xs bg-neutral-200 hover:bg-neutral-300 rounded"
                    >
                      ←
                    </button>
                    <span className="text-xs text-neutral-600 whitespace-nowrap">
                      {selectedWeekStart ? selectedWeekStart.toLocaleDateString() : 'This week'}
                    </span>
                    <button
                      onClick={() => {
                        const newDate = selectedWeekStart ? new Date(selectedWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();
                        if (newDate <= new Date()) setSelectedWeekStart(newDate);
                      }}
                      className="px-2 py-1 text-xs bg-neutral-200 hover:bg-neutral-300 rounded"
                    >
                      →
                    </button>
                    <button
                      onClick={() => setSelectedWeekStart(null)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                    >
                      Current
                    </button>
                  </div>
                )}
              </div>
            </div>
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sent" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Emails Sent" 
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="replied" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Replies Received" 
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-neutral-400">
                <div className="text-center">
                  <ChartBarIcon className="w-16 h-16 mx-auto mb-2" />
                  <p>No activity data yet</p>
                  <p className="text-sm mt-1">Start sending emails to see your timeline</p>
                </div>
              </div>
            )}
          </div>

          {/* Agent Comparison Chart (only show when "all" is selected) */}
          {selectedAgentTab === 'all' ? (
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Agent Performance Comparison</h3>
              {agents.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agentComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Sent" fill="#3b82f6" />
                    <Bar dataKey="Replied" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-neutral-400">
                  <div className="text-center">
                    <ChartBarIcon className="w-16 h-16 mx-auto mb-2" />
                    <p>No agent data yet</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Individual Agent Detail Card */
            selectedAgent && (
              <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">{selectedAgent.name} Details</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                    <span className="text-sm font-medium text-neutral-700">Agent ID</span>
                    <span className="text-xs text-neutral-600 break-all">{selectedAgent.id}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <span className="text-sm font-medium text-neutral-700">Status</span>
                    <span className={`text-sm font-semibold ${
                      selectedAgent.status === 'active' ? 'text-green-600' : 'text-neutral-600'
                    }`}>
                      {selectedAgent.status === 'active' ? '🟢 Active' : '⚫ Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                    <span className="text-sm font-medium text-neutral-700">Total Emails Sent</span>
                    <span className="text-sm font-bold text-purple-600">{selectedAgent.sent}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                    <span className="text-sm font-medium text-neutral-700">Reply Rate</span>
                    <span className="text-sm font-bold text-orange-600">
                      {selectedAgent.sent > 0 ? ((selectedAgent.replied / selectedAgent.sent) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <div className="mt-6 pt-4 border-t">
                    <div className="text-sm font-medium text-neutral-700 mb-3">Performance Breakdown</div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs text-neutral-600 mb-1">
                          <span>Queued</span>
                          <span>{selectedAgent.queued}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2">
                          <div 
                            className="bg-neutral-500 h-2 rounded-full"
                            style={{ width: `${selectedAgent.sent > 0 ? (selectedAgent.queued / selectedAgent.sent * 100) : 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-neutral-600 mb-1">
                          <span>Sent</span>
                          <span>{selectedAgent.sent}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-neutral-600 mb-1">
                          <span>Replied</span>
                          <span>{selectedAgent.replied}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${selectedAgent.sent > 0 ? (selectedAgent.replied / selectedAgent.sent * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Reply Activity Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                {selectedAgent ? `${selectedAgent.name} - Reply Activity` : 'Reply Activity Over Time'}
              </h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setReplyActivityTimeRange('hour')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={replyActivityTimeRange === 'hour' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Hour
                </button>
                <button
                  onClick={() => setReplyActivityTimeRange('day')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={replyActivityTimeRange === 'day' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Day
                </button>
                <button
                  onClick={() => setReplyActivityTimeRange('week')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={replyActivityTimeRange === 'week' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Week
                </button>
              </div>
            </div>
            {replyActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={replyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="replies" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Replies Received" 
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-neutral-400">
                <div className="text-center">
                  <ChartBarIcon className="w-16 h-16 mx-auto mb-2" />
                  <p>No reply data yet</p>
                  <p className="text-sm mt-1">Replies will appear here as they come in</p>
                </div>
              </div>
            )}
          </div>

          {/* Cycles Completed Chart */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                {selectedAgent ? `${selectedAgent.name} - Cycles Completed` : 'Cycles Completed Over Time'}
              </h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setCyclesTimeRange('hour')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={cyclesTimeRange === 'hour' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Hour
                </button>
                <button
                  onClick={() => setCyclesTimeRange('day')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={cyclesTimeRange === 'day' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Day
                </button>
                <button
                  onClick={() => setCyclesTimeRange('week')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={cyclesTimeRange === 'week' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Week
                </button>
              </div>
            </div>
            {cyclesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cyclesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedAgentTab === 'all' ? (
                    // Multiple lines - one per agent
                    agents.map((agent, index) => {
                      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
                      const color = colors[index % colors.length];
                      return (
                        <Line 
                          key={agent.id}
                          type="monotone" 
                          dataKey={agent.name}
                          stroke={color}
                          strokeWidth={2}
                          name={agent.name}
                          dot={{ fill: color, r: 4 }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      );
                    })
                  ) : (
                    // Single line for specific agent
                    <Line 
                      type="monotone" 
                      dataKey="cycles" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Cycles Completed" 
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-neutral-400">
                <div className="text-center">
                  <ChartBarIcon className="w-16 h-16 mx-auto mb-2" />
                  <p>No cycle data yet</p>
                  <p className="text-sm mt-1">Cycle completions will be tracked here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderIssues = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Issues & Alerts</h2>
        <div className="text-sm text-neutral-600">
          {issues.filter(i => !i.resolved).length} active
        </div>
      </div>
      
      <div className="space-y-2">
        {issues.filter(i => !i.resolved).length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-neutral-600">No issues detected</p>
            <p className="text-sm text-neutral-500 mt-1">All systems operating normally</p>
          </div>
        ) : (
          issues.filter(i => !i.resolved).map((issue) => {
            // Map severity to display styling
            const isCritical = issue.severity === 'critical' || issue.severity === 'high';
            const isWarning = issue.severity === 'medium';
            
            return (
            <div key={issue.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
              <div className="flex items-start gap-3">
                {isCritical && <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                {isWarning && <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                {!isCritical && !isWarning && <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{issue.message}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {new Date(issue.timestamp).toLocaleString()} · Agent: {issue.agentId}
                  </p>
                  {issue.details && (
                    <pre className="text-xs text-neutral-600 mt-2 bg-neutral-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(issue.details, null, 2)}
                    </pre>
                  )}
                </div>
                {issue.resolved ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <button 
                    onClick={() => handleResolveIssue(issue.id)}
                    className="text-xs px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );

  const renderAgents = () => {
    // Get unique agents from the fetched data
    const uniqueAgents = agents.filter((agent, index, self) => 
      index === self.findIndex((a) => a.id === agent.id)
    );

    const getCycleStatus = (agentId: string) => {
      const status = agentStatuses[agentId];
      if (!status) return { 
        text: 'Loading...', 
        color: 'text-neutral-500',
        icon: null 
      };
      
      if (!status.isActive) {
        return { 
          text: 'Stopped', 
          color: 'text-neutral-600',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          )
        };
      }
      
      if (status.nextRunTime) {
        const now = new Date();
        const nextRun = new Date(status.nextRunTime);
        const diff = nextRun.getTime() - now.getTime();
        
        if (diff > 0) {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          return { 
            text: `Next cycle in ${minutes}m ${seconds}s`, 
            color: 'text-blue-600',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
              </svg>
            )
          };
        }
      }
      
      return { 
        text: 'Running', 
        color: 'text-green-600',
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.84A1 1 0 0 1 7 2h6a1 1 0 0 1 .7.3l4 4A1 1 0 0 1 18 7v6a1 1 0 0 1-.3.7l-4 4a1 1 0 0 1-.7.3H7a1 1 0 0 1-.7-.3l-4-4A1 1 0 0 1 2 13V7a1 1 0 0 1 .3-.7l4-4z" />
          </svg>
        )
      };
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Agent Management</h2>
          <div className="text-sm text-neutral-600">
            {uniqueAgents.length} {uniqueAgents.length === 1 ? 'Agent' : 'Agents'}
          </div>
        </div>

        {uniqueAgents.length > 0 ? (
          <div className="space-y-2">
            {uniqueAgents.map((agent) => {
              const isExpanded = selectedAgentDetail === agent.id;
              const cycleStatus = getCycleStatus(agent.id);
              const agentStatus = agentStatuses[agent.id];
              
              // Try to get avatar from multiple sources
              const personalityAvatar = agent.personality?.avatar || 
                                       agentStatus?.personality?.avatar;
              
              // Get initials for fallback
              const initials = agent.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              
              console.log('Agent data:', agent);
              console.log('Agent avatar for', agent.name, ':', personalityAvatar);
              
              return (
                <div key={agent.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                  {/* Horizontal Bar - Always Visible */}
                  <button
                    onClick={() => setSelectedAgentDetail(isExpanded ? null : agent.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Agent Icon - Use personality avatar or initials */}
                      {personalityAvatar ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-200">
                          <img 
                            src={personalityAvatar} 
                            alt={agent.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Failed to load avatar:', personalityAvatar);
                              // Hide the image and show initials instead
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.parentElement) {
                                e.currentTarget.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm">${initials}</div>`;
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 border border-neutral-200">
                          <span className="text-white font-bold text-sm">{initials}</span>
                        </div>
                      )}
                      
                      {/* Agent Name & ID */}
                      <div className="text-left">
                        <h3 className="font-semibold text-neutral-900">{agent.name}</h3>
                        <p className="text-xs text-neutral-500 font-mono">{agent.id}</p>
                      </div>
                    </div>

                    {/* Cycle Status */}
                    <div className={`flex items-center gap-2 text-sm font-medium ${cycleStatus.color} mr-4`}>
                      {cycleStatus.icon}
                      <span>{cycleStatus.text}</span>
                    </div>

                    {/* Expand Arrow */}
                    <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-neutral-200 bg-neutral-50/50">
                      {/* API Credentials & Usage */}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold text-neutral-900 mb-3">API Credentials & Usage</h4>
                        <div className="space-y-2">
                          {/* Apollo API */}
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-blue-100 rounded flex items-center justify-center">
                                  <span className="text-blue-600 text-xs font-bold">A</span>
                                </div>
                                <span className="text-sm font-medium text-neutral-900">Apollo API</span>
                              </div>
                              <span className="text-xs text-green-600 font-medium">● Connected</span>
                            </div>
                            <div className="ml-9 mt-2">
                              {(() => {
                                const usage = apiUsage[agent.id]?.apollo?.usage || 0;
                                const calls = apiUsage[agent.id]?.apollo?.calls || 0;
                                const moneySpent = (usage || 0) * (apiCosts.apollo || 0);

                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Credits Used</span>
                                      <span className="font-medium text-neutral-900">{usage.toLocaleString()} credits</span>
                                    </div>

                                    <div className="flex justify-between items-center text-xs mb-2">
                                      <span className="text-neutral-600">Money Spent</span>
                                      <span className="font-medium text-neutral-900">${moneySpent.toFixed(2)}</span>
                                    </div>

                                    <div className="text-xs text-neutral-500 mt-1">
                                      {calls} API calls
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* OpenAI API */}
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-emerald-100 rounded flex items-center justify-center">
                                  <span className="text-emerald-600 text-xs font-bold">AI</span>
                                </div>
                                <span className="text-sm font-medium text-neutral-900">OpenAI API</span>
                              </div>
                              <span className="text-xs text-green-600 font-medium">● Connected</span>
                            </div>
                            <div className="ml-9 mt-2">
                              {(() => {
                                const usage = apiUsage[agent.id]?.openai?.usage || 0; // tokens
                                const calls = apiUsage[agent.id]?.openai?.calls || 0;
                                // apiCosts.openai is $ per 1K tokens
                                const moneySpent = ((usage || 0) / 1000) * (apiCosts.openai || 0);

                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Tokens Used</span>
                                      <span className="font-medium text-neutral-900">{usage.toLocaleString()} tokens</span>
                                    </div>

                                    <div className="flex justify-between items-center text-xs mb-2">
                                      <span className="text-neutral-600">Money Spent</span>
                                      <span className="font-medium text-neutral-900">${moneySpent.toFixed(2)}</span>
                                    </div>

                                    <div className="text-xs text-neutral-500 mt-1">
                                      {calls} API calls · GPT-3.5
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Mailgun API */}
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-orange-100 rounded flex items-center justify-center">
                                  <span className="text-orange-600 text-xs font-bold">M</span>
                                </div>
                                <span className="text-sm font-medium text-neutral-900">Mailgun</span>
                              </div>
                              <span className="text-xs text-green-600 font-medium">● Connected</span>
                            </div>
                            <div className="ml-9 mt-2">
                              {(() => {
                                const usage = apiUsage[agent.id]?.mailgun?.usage || 0; // emails sent
                                const calls = apiUsage[agent.id]?.mailgun?.calls || 0;
                                const moneySpent = (usage || 0) * (apiCosts.mailgun || 0);

                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Emails Sent</span>
                                      <span className="font-medium text-neutral-900">{usage.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-xs mb-2">
                                      <span className="text-neutral-600">Money Spent</span>
                                      <span className="font-medium text-neutral-900">${moneySpent.toFixed(2)}</span>
                                    </div>

                                    <div className="text-xs text-neutral-500 mt-1">
                                      {calls} API calls
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* ZeroBounce API */}
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-purple-100 rounded flex items-center justify-center">
                                  <span className="text-purple-600 text-xs font-bold">Z</span>
                                </div>
                                <span className="text-sm font-medium text-neutral-900">ZeroBounce</span>
                              </div>
                              <span className="text-xs text-green-600 font-medium">● Connected</span>
                            </div>
                            <div className="ml-9 mt-2">
                              {(() => {
                                const usage = apiUsage[agent.id]?.zerobounce?.usage || 0; // validations
                                const calls = apiUsage[agent.id]?.zerobounce?.calls || 0;
                                const moneySpent = (usage || 0) * (apiCosts.zerobounce || 0);

                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Validations</span>
                                      <span className="font-medium text-neutral-900">{usage.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-xs mb-2">
                                      <span className="text-neutral-600">Money Spent</span>
                                      <span className="font-medium text-neutral-900">${moneySpent.toFixed(2)}</span>
                                    </div>

                                    <div className="text-xs text-neutral-500 mt-1">
                                      {calls} API calls
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Serper API */}
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-orange-100 rounded flex items-center justify-center">
                                  <span className="text-orange-600 text-xs font-bold">S</span>
                                </div>
                                <span className="text-sm font-medium text-neutral-900">Serper</span>
                              </div>
                              <span className="text-xs text-green-600 font-medium">● Connected</span>
                            </div>
                            <div className="ml-9 mt-2">
                              {(() => {
                                const usage = apiUsage[agent.id]?.serper?.usage || 0; // searches
                                const calls = apiUsage[agent.id]?.serper?.calls || 0;
                                const moneySpent = (usage || 0) * (apiCosts.serper || 0);

                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Searches</span>
                                      <span className="font-medium text-neutral-900">{usage.toLocaleString()} queries</span>
                                    </div>

                                    <div className="flex justify-between items-center text-xs mb-2">
                                      <span className="text-neutral-600">Money Spent</span>
                                      <span className="font-medium text-neutral-900">${moneySpent.toFixed(2)}</span>
                                    </div>

                                    <div className="text-xs text-neutral-500 mt-1">
                                      {calls} API calls
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-4 pb-4 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgent(agent);
                            setNewInterval(agentStatuses[agent.id]?.currentInterval || 30);
                            setShowIntervalModal(true);
                          }}
                          className="flex-1 px-3 py-2 bg-white border border-neutral-300 text-black text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                          Cycle Settings
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettingsAgentId(agent.id);
                            setShowSettings(true);
                          }}
                          className="flex-1 px-3 py-2 bg-white border border-neutral-300 text-black text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                          Email Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8 text-center">
            <BoltIcon className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600 font-medium">No active agents detected</p>
            <p className="text-sm text-neutral-500 mt-1">Start an agent to see it here</p>
          </div>
        )}

        {/* Cycle Interval Modal */}
        {showIntervalModal && selectedAgent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-neutral-900">Change Cycle Interval</h3>
                <button
                  onClick={() => setShowIntervalModal(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowIntervalModal(false)}
                  className="flex-1 px-4 py-2 text-neutral-700 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors relative z-10"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      console.log('Setting interval to:', newInterval, 'for agent:', selectedAgent.id);
                      
                      // Update the interval setting
                      const setIntervalResponse = await api.post('/api/lead-agent/set-interval', {
                        minutes: newInterval, 
                        agentId: selectedAgent.id 
                      });
                      console.log('Set interval response:', setIntervalResponse.data);
                      
                      // If agent is running, restart it
                      const agentStatus = agentStatuses[selectedAgent.id];
                      if (agentStatus?.isActive) {
                        console.log('Agent is active, stopping...');
                        await api.post('/api/lead-agent/stop', { agentId: selectedAgent.id });
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        console.log('Restarting agent...');
                        await api.post('/api/lead-agent/start', { agentId: selectedAgent.id });
                        console.log('Agent restarted');
                      }
                      
                      setShowIntervalModal(false);
                      
                      // Refresh agent status
                      const statusResponse = await api.get(`/api/lead-agent/status?agentId=${selectedAgent.id}`);
                      console.log('Updated status:', statusResponse.data);
                      setAgentStatuses(prev => ({
                        ...prev,
                        [selectedAgent.id]: statusResponse.data
                      }));
                    } catch (error) {
                      console.error('Failed to update cycle interval:', error);
                      alert('Failed to update cycle interval. Check console for details.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors relative z-10"
                  style={{ backgroundColor: '#2563eb', color: 'white' }}
                >
                  Apply & Restart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agent Settings Modal */}
        {settingsAgentId && (
          <AgentSettingsModal
            isOpen={showSettings}
            onClose={() => {
              setShowSettings(false);
              setSettingsAgentId(null);
            }}
            agentId={settingsAgentId}
            compact={true}
          />
        )}
      </div>
    );
  };

  const renderIntegrations = () => (
    <div className="space-y-6">
      {/* Budget Management Section */}
      <RateLimitSettings />

      <h2 className="text-xl font-semibold text-neutral-900">API Usage Details</h2>
      
      {totalApiUsage ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
          {/* Apollo API */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-bold">A</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Apollo API</h3>
                  <p className="text-xs text-neutral-500">Lead enrichment & search</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                ● Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Credits Used</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {totalApiUsage.apollo?.usage || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>{totalApiUsage.apollo?.calls || 0} API calls</span>
                <span className="text-lg font-semibold text-blue-600">{totalApiUsage.apollo?.cost ? `$${totalApiUsage.apollo.cost.toFixed(2)}` : '$0.00'}</span>
              </div>
            </div>
          </div>

          {/* OpenAI API */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600 text-sm font-bold">AI</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">OpenAI API</h3>
                  <p className="text-xs text-neutral-500">GPT-3.5 reasoning</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                ● Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Tokens Used</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {(totalApiUsage.openai?.usage || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>{totalApiUsage.openai?.calls || 0} API calls</span>
                <span className="text-lg font-semibold text-emerald-600">{totalApiUsage.openai?.cost ? `$${totalApiUsage.openai.cost.toFixed(2)}` : '$0.00'}</span>
              </div>
            </div>
          </div>

          {/* Mailgun API */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 text-sm font-bold">M</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Mailgun</h3>
                  <p className="text-xs text-neutral-500">Email delivery</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                ● Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Emails Sent</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {totalApiUsage.mailgun?.usage || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>{totalApiUsage.mailgun?.calls || 0} emails delivered</span>
                <span className="text-lg font-semibold text-orange-600">{totalApiUsage.mailgun?.cost ? `$${totalApiUsage.mailgun.cost.toFixed(2)}` : '$0.00'}</span>
              </div>
            </div>
          </div>

          {/* ZeroBounce API */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-bold">Z</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">ZeroBounce</h3>
                  <p className="text-xs text-neutral-500">Email validation</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                ● Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Validations</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {totalApiUsage.zerobounce?.usage || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>{totalApiUsage.zerobounce?.calls || 0} API calls</span>
                <span className="text-lg font-semibold text-purple-600">{totalApiUsage.zerobounce?.cost ? `$${totalApiUsage.zerobounce.cost.toFixed(2)}` : '$0.00'}</span>
              </div>
            </div>
          </div>

          {/* Serper API */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 text-sm font-bold">S</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Serper</h3>
                  <p className="text-xs text-neutral-500">Web search</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                ● Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Searches</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {totalApiUsage.serper?.usage || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>{totalApiUsage.serper?.calls || 0} API calls</span>
                <span className="text-lg font-semibold text-orange-600">{totalApiUsage.serper?.cost ? `$${totalApiUsage.serper.cost.toFixed(2)}` : '$0.00'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* API Usage and Cost Graphs Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API Usage Over Time Graph */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">API Calls Over Time</h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setTimeRange('hour')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={timeRange === 'hour' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Hour
                </button>
                <button
                  onClick={() => setTimeRange('day')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={timeRange === 'day' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Day
                </button>
                <button
                  onClick={() => setTimeRange('month')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={timeRange === 'month' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Month
                </button>
                {(timeRange === 'day' || timeRange === 'month') && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-300">
                    <label className="text-xs text-neutral-600">Past</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDays}
                      onChange={(e) => setCustomDays(parseInt(e.target.value) || 7)}
                      className="w-16 px-2 py-1 text-xs border border-neutral-300 rounded"
                    />
                    <span className="text-xs text-neutral-600">days</span>
                  </div>
                )}
              </div>
            </div>
            {apiUsageTimeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={apiUsageTimeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '10px'
                    }}
                    content={(props: any) => {
                      if (!props.active || !props.payload) return null;
                      
                      return (
                        <div style={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '10px'
                        }}>
                          <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            {props.label}
                          </p>
                          {props.payload.map((entry: any, index: number) => (
                            <p key={index} style={{ color: entry.color, margin: '3px 0' }}>
                              {entry.name}: {entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar dataKey="apolloCalls" name="Apollo" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="openaiCalls" name="OpenAI" fill="#10b981" stackId="a" />
                  <Bar dataKey="mailgunCalls" name="Mailgun" fill="#f97316" stackId="a" />
                  <Bar dataKey="zerbounceCalls" name="ZeroBounce" fill="#a855f7" stackId="a" />
                  <Bar dataKey="serperCalls" name="Serper" fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-400">
                No usage data available yet. Data will appear once agents start making API calls.
              </div>
            )}
          </div>

          {/* Cost Over Time Graph */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Cost Over Time</h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setCostTimeRange('hour')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={costTimeRange === 'hour' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Hour
                </button>
                <button
                  onClick={() => setCostTimeRange('day')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={costTimeRange === 'day' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Day
                </button>
                <button
                  onClick={() => setCostTimeRange('month')}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors"
                  style={costTimeRange === 'month' 
                    ? { backgroundColor: '#2563eb', color: '#ffffff' } 
                    : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  Month
                </button>
                {(costTimeRange === 'day' || costTimeRange === 'month') && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-300">
                    <label className="text-xs text-neutral-600">Past</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={costCustomDays}
                      onChange={(e) => setCostCustomDays(parseInt(e.target.value) || 7)}
                      className="w-16 px-2 py-1 text-xs border border-neutral-300 rounded"
                    />
                    <span className="text-xs text-neutral-600">days</span>
                  </div>
                )}
              </div>
            </div>
            {costTimeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costTimeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '10px'
                    }}
                    content={(props: any) => {
                      if (!props.active || !props.payload) return null;
                      
                      return (
                        <div style={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '10px'
                        }}>
                          <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            {props.label}
                          </p>
                          {props.payload.map((entry: any, index: number) => (
                            <p key={index} style={{ color: entry.color, margin: '3px 0' }}>
                              {entry.name}: ${Number(entry.value || 0).toFixed(4)}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar dataKey="apollo.cost" name="Apollo" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="openai.cost" name="OpenAI" fill="#10b981" stackId="a" />
                  <Bar dataKey="mailgun.cost" name="Mailgun" fill="#f97316" stackId="a" />
                  <Bar dataKey="zerobounce.cost" name="ZeroBounce" fill="#a855f7" stackId="a" />
                  <Bar dataKey="serper.cost" name="Serper" fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-400">
                No cost data available yet. Data will appear once agents start making API calls.
              </div>
            )}
          </div>
        </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8 text-center">
          <p className="text-neutral-500">Loading API usage data...</p>
        </div>
      )}
    </div>
  );

  // Mark activity as read/dismissed
  const handleDismissActivity = async (activityId: string, isActualIssue: boolean = false) => {
    if (!activityId) return;
    
    setDismissingActivity(activityId);
    try {
      // Only call the API if it's an actual issue from the issues table
      // Regular activities are just removed from local state
      if (isActualIssue) {
        await api.post(`/api/monitoring/activity/${activityId}/mark-read`);
      }
      
      // Remove from local state
      setActivities(prev => prev.filter(act => {
        // For activities from issues table, they have an 'id' field
        // For cycle logs, we might need to construct an ID from timestamp + agentId
        const itemId = act.id || `${act.metadata?.agentId}-${act.timestamp}`;
        return itemId !== activityId;
      }));
    } catch (error) {
      console.error('Failed to dismiss activity:', error);
    } finally {
      setDismissingActivity(null);
    }
  };

  // Clear all activities
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all activity logs? This cannot be undone.')) {
      return;
    }

    setClearingAll(true);
    try {
      const response = await api.delete('/api/monitoring/activity/clear-all');
      
      if (response.data?.success) {
        setActivities([]);
        console.log('✅ All activity logs cleared');
      } else {
        console.error('Failed to clear activities:', response.data?.error);
        alert('Failed to clear activity logs. Please try again.');
      }
    } catch (error) {
      console.error('Failed to clear all activities:', error);
      alert('Failed to clear activity logs. Please try again.');
    } finally {
      setClearingAll(false);
    }
  };

  const renderLogs = () => {
    // Helper to get agent name from agent ID
    const getAgentName = (agentId: string) => {
      const agent = agents.find(a => a.id === agentId);
      return agent ? agent.name : agentId;
    };

    // Use ONLY activities feed - it already includes issues from backend
    // Do NOT combine with raw issues to avoid duplicates
    const combinedActivities = activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter combined activities based on selected filter
    const filteredActivities = combinedActivities.filter(act => {
      if (activityFilter === 'all') return true;
      if (activityFilter === 'issues') return act.category === 'issue';
      if (activityFilter === 'cycles') return act.category === 'cycle' || act.title?.toLowerCase().includes('cycle');
      if (activityFilter === 'important') {
        // Important events include cycle completions, issues, and specific keywords
        const titleLower = act.title?.toLowerCase() || '';
        const msgLower = act.message?.toLowerCase() || '';
        
        // Check for cycle completion
        if (titleLower.includes('cycle completed') || 
            titleLower.includes('cycle complete') ||
            msgLower.includes('cycle completed') ||
            msgLower.includes('cycle complete') ||
            act.category === 'cycle') return true;
        
        // Check for issues
        if (act.activityType === 'issue') return true;
        
        // Check for other important keywords
        const importantKeywords = ['agent created', 'agent deleted', 'budget limit', 'rate limit', 'quota exceeded'];
        return importantKeywords.some(kw => titleLower.includes(kw) || msgLower.includes(kw));
      }
      if (activityFilter === 'agents') {
        const agentKeywords = ['agent created', 'agent deleted'];
        const titleLower = act.title?.toLowerCase() || '';
        return agentKeywords.some(kw => titleLower.includes(kw));
      }
      return true;
    });

    return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Activity Logs</h2>
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivityFilter('all')}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                activityFilter === 'all' 
                  ? '!bg-blue-600 !text-white !border-blue-600' 
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >All</button>
            <button
              onClick={() => setActivityFilter('issues')}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                activityFilter === 'issues' 
                  ? '!bg-red-600 !text-white !border-red-600' 
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >Issues ({issues.filter(i => !i.resolved).length})</button>
            <button
              onClick={() => setActivityFilter('cycles')}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                activityFilter === 'cycles' 
                  ? '!bg-blue-600 !text-white !border-blue-600' 
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >Cycles</button>
            <button
              onClick={() => setActivityFilter('important')}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                activityFilter === 'important' 
                  ? '!bg-blue-600 !text-white !border-blue-600' 
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >Important</button>
            <button
              onClick={() => setActivityFilter('agents')}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                activityFilter === 'agents' 
                  ? '!bg-blue-600 !text-white !border-blue-600' 
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >Agents</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setLoadingActivities(true);
                try {
                  const res = await api.get('/api/monitoring/activity');
                  if (res.data?.success) setActivities(res.data.activities || []);
                } catch (e) {
                  console.error('Error fetching activities', e);
                } finally {
                  setLoadingActivities(false);
                }
              }}
              className="text-sm text-blue-600 hover:underline"
            >Refresh</button>
            <button
              onClick={handleClearAll}
              disabled={clearingAll || activities.length === 0}
              className="text-sm text-black hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingAll ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
        </div>

        {loadingActivities ? (
          <p className="text-neutral-600">Loading activity...</p>
        ) : filteredActivities.length === 0 ? (
          <p className="text-neutral-600">No activity matching filter.</p>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((act, i) => {
              const activityId = act.id || `${act.metadata?.agentId || 'unknown'}-${act.timestamp}`;
              const isDismissing = dismissingActivity === activityId;
              const agentId = act.metadata?.agentId;
              const agentName = agentId ? getAgentName(agentId) : null;
              const isIssue = act.category === 'issue' || act.activityType === 'issue';
              const severity = act.type || act.severity || 'info'; // Backend sends 'type' field for display styling
              
              // Check if this is a cycle completion (important, not an issue)
              const titleLower = act.title?.toLowerCase() || '';
              const msgLower = act.message?.toLowerCase() || '';
              const isCycleCompletion = titleLower.includes('cycle completed') || 
                                       titleLower.includes('cycle complete') ||
                                       msgLower.includes('cycle completed') ||
                                       msgLower.includes('cycle complete') ||
                                       act.category === 'cycle';
              
              // Determine styling based on activity type
              let borderColor, hoverBorder, textColor, msgColor, iconElement;
              
              if (isCycleCompletion) {
                // Green styling for cycle completions
                borderColor = 'border-green-400 bg-green-50';
                hoverBorder = 'hover:border-green-600';
                textColor = 'text-green-900';
                msgColor = 'text-green-700';
                iconElement = <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />;
              } else if (isIssue) {
                // Red/Orange/Blue styling for issues
                borderColor = severity === 'error' ? 'border-red-400 bg-red-50' : 
                             severity === 'warning' ? 'border-orange-400 bg-orange-50' : 
                             'border-blue-400 bg-blue-50';
                hoverBorder = severity === 'error' ? 'hover:border-red-600' : 
                             severity === 'warning' ? 'hover:border-orange-600' : 
                             'hover:border-blue-600';
                textColor = severity === 'error' ? 'text-red-900' : 
                           severity === 'warning' ? 'text-orange-900' : 
                           'text-blue-900';
                msgColor = severity === 'error' ? 'text-red-700' : 
                          severity === 'warning' ? 'text-orange-700' : 
                          'text-blue-700';
                iconElement = severity === 'error' ? <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" /> :
                             severity === 'warning' ? <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0" /> :
                             <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />;
              } else {
                // Default styling for normal activities
                borderColor = 'border-neutral-300 bg-white';
                hoverBorder = 'hover:border-black';
                textColor = 'text-neutral-900';
                msgColor = 'text-neutral-600';
                iconElement = null;
              }
              
              return (
                <div key={i} className={`p-3 border rounded-lg transition-colors ${borderColor} ${hoverBorder}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {iconElement}
                        <div className={`text-sm font-medium ${textColor}`}>{act.title}</div>
                        {agentName && (
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                            {agentName}
                          </span>
                        )}
                      </div>
                      {act.message && (
                        <div className={`text-xs mt-1 ${msgColor} ${isIssue && act.message.startsWith('{') ? 'bg-white bg-opacity-70 p-2 rounded font-mono overflow-x-auto' : ''}`}>
                          {act.message}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-xs text-neutral-500 text-right">
                        <div>{new Date(act.timestamp).toLocaleString()}</div>
                        <div className="mt-1 text-[10px] uppercase font-medium text-neutral-400">{act.category}</div>
                      </div>
                      {isIssue && onResolveIssue ? (
                        <button
                          onClick={() => onResolveIssue(act.metadata?.issueId || act.id)}
                          className="text-xs px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors whitespace-nowrap"
                        >
                          Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDismissActivity(activityId, isIssue)}
                          disabled={isDismissing}
                          className="text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                          title="Dismiss activity"
                        >
                          {isDismissing ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {act.metadata && Object.keys(act.metadata).filter(k => !['timestamp', 'agentId'].includes(k)).length > 0 && (
                    <div className="mt-2 text-xs text-neutral-600 flex flex-wrap gap-2">
                      {Object.entries(act.metadata)
                        .filter(([k]) => !['timestamp', 'agentId'].includes(k))
                        .map(([k, v]) => (
                          <span key={k} className="inline-block px-2 py-0.5 bg-neutral-50 rounded">
                            <span className="font-medium">{k}:</span> {String(v)}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
  };

  // Outreach Panel Component
  const renderOutreach = () => {
    const formatTime = (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(diff / 3600000);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    };

    if (outreachLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Compressed Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-600 mb-0.5">Emails Viewed</div>
            <div className="text-2xl font-bold text-neutral-900">{outreachStats.viewed}</div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-600 mb-0.5">Conversations</div>
            <div className="text-2xl font-bold text-blue-600">{outreachStats.replied}</div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-600 mb-0.5">Meetings Booked</div>
            <div className="text-2xl font-bold text-green-600">{outreachStats.meetings}</div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-600 mb-0.5">Conversion Rate</div>
            <div className="text-2xl font-bold text-purple-600">{outreachStats.conversionRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* All Conversations */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-neutral-900">All Ongoing Conversations</h3>
            <p className="text-sm text-neutral-600">Active threads across all agents</p>
          </div>
          <div className="p-3">
            {outreachConversations.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <EnvelopeIcon className="h-12 w-12 mx-auto mb-3 text-neutral-300" />
                <p>No conversations yet</p>
                <p className="text-xs text-neutral-400 mt-1">Conversations will appear here when leads reply</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {outreachConversations.map((conv, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setOutreachSelectedConversation(conv)}
                    className="p-3 bg-neutral-50 rounded hover:bg-neutral-100 cursor-pointer transition-colors border border-neutral-200"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-neutral-900 truncate">{conv.leadName}</div>
                        <div className="text-xs text-neutral-600 truncate">{conv.leadEmail}</div>
                      </div>
                      <div className="text-xs text-neutral-500 ml-2">{formatTime(conv.lastActivity)}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-neutral-500">Agent: {conv.agentName}</span>
                      <span className="text-xs text-neutral-400">• {conv.messageCount} msg</span>
                      {conv.status === 'meeting_booked' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Meeting</span>
                      )}
                      {conv.status === 'ai_responded' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">AI</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversation Modal */}
        {outreachSelectedConversation && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setOutreachSelectedConversation(null)}>
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">{outreachSelectedConversation.leadName}</h2>
                    <p className="text-sm text-neutral-600">{outreachSelectedConversation.leadEmail}</p>
                    <p className="text-xs text-neutral-500 mt-1">Agent: {outreachSelectedConversation.agentName}</p>
                  </div>
                  <button onClick={() => setOutreachSelectedConversation(null)} className="text-neutral-400 hover:text-neutral-600">
                    ×
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {outreachSelectedConversation.messages?.map((msg: any, idx: number) => (
                  <div key={idx} className={`${msg.type === 'outbound' || msg.type === 'ai_response' ? 'ml-8' : 'mr-8'}`}>
                    <div className={`rounded-lg p-4 ${
                      msg.type === 'outbound' ? 'bg-blue-50 border border-blue-200' :
                      msg.type === 'reply' ? 'bg-neutral-100 border border-neutral-200' :
                      'bg-orange-50 border border-orange-200'
                    }`}>
                      <div className="text-xs font-medium text-neutral-600 mb-2">
                        {msg.type === 'outbound' ? 'Sent' : msg.type === 'reply' ? outreachSelectedConversation.leadName : 'AI Response'}
                        {' • '}{formatTime(msg.timestamp)}
                      </div>
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                )) || <p className="text-center text-neutral-500">No messages</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  switch (view) {
    case 'overview':
      return renderOverview();
    case 'analytics':
      return renderAnalytics();
    case 'agents':
      return renderAgents();
    case 'outreach':
      return renderOutreach();
    case 'memory':
      return <KeywordMemoryPanel />;
    case 'integrations':
      return renderIntegrations();
    case 'logs':
      return renderLogs();
    default:
      return renderOverview();
  }
}
