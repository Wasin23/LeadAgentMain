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
  BoltIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import AgentSettingsModal from './AgentSettingsModal';
import RateLimitSettings from './RateLimitSettings';
import LeadSearchPanel from './LeadSearchPanel';
import AIReportPanel from './AIReportPanel';

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

  // API cost constants (must match backend)
  const apiCosts = {
    apollo: 0.017, // $0.017 per credit
    openai: 0.0034, // $0.0034 per 1K tokens
    mailgun: 0.00136, // $0.00136 per email
    zerobounce: 0.0085, // $0.0085 per validation
    serper: 0.0085 // $0.0085 per search
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
      // Refresh statuses every 10 seconds
      const interval = setInterval(() => {
        fetchAgentStatuses();
        fetchTotalApiUsage();
        fetchApiUsageTimeSeries();
        fetchCostTimeSeries();
        fetchRateLimits();
      }, 10000);
      return () => clearInterval(interval);
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

    // Group by day
    const dailyData: { [key: string]: { date: string; sent: number; replied: number } } = {};
    
    allEmails.forEach(email => {
      const date = new Date(email.date);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = { date: dayKey, sent: 0, replied: 0 };
      }
      
      dailyData[dayKey].sent += 1;
      if (email.replied) {
        dailyData[dayKey].replied += 1;
      }
    });

    // Convert to array and format dates
    const timeSeriesArray = Object.values(dailyData).map(day => ({
      ...day,
      dateFormatted: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

    // Group by day
    const dailyData: { [key: string]: { date: string; replies: number } } = {};
    
    repliedEmails.forEach(email => {
      const date = new Date(email.date);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = { date: dayKey, replies: 0 };
      }
      
      dailyData[dayKey].replies += 1;
    });

    // Convert to array and format dates
    const replyArray = Object.values(dailyData).map(day => ({
      ...day,
      dateFormatted: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

    setReplyActivityData(replyArray);
  };

  const generateCyclesData = async (agentsData: any[], filterAgentId?: string) => {
    try {
      // Fetch real cycle logs from backend
      const agentParam = filterAgentId ? `?agentId=${filterAgentId}` : '';
      console.log('📊 Fetching cycle logs with params:', agentParam);
      const response = await api.get(`/api/lead-agent/cycle-logs${agentParam}`);
      console.log('📊 Cycle logs response:', response.data);
      
      if (response.data.success && response.data.cycleLogs && response.data.cycleLogs.length > 0) {
        const cycleLogs = response.data.cycleLogs;
        console.log('📊 Processing', cycleLogs.length, 'cycle logs');
        
        if (filterAgentId) {
          // Single agent view - simple line
          const dailyData: { [key: string]: { date: string; cycles: number } } = {};
          
          cycleLogs.forEach((log: any) => {
            const date = new Date(log.completedAt);
            const dayKey = date.toISOString().split('T')[0];
            
            if (!dailyData[dayKey]) {
              dailyData[dayKey] = { date: dayKey, cycles: 0 };
            }
            
            dailyData[dayKey].cycles += 1;
          });
          
          // Convert to array and format dates
          const cyclesArray = Object.values(dailyData).map(day => ({
            ...day,
            dateFormatted: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }));
          
          // Sort by date
          cyclesArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          console.log('📊 Generated cycles data:', cyclesArray);
          setCyclesData(cyclesArray);
        } else {
          // All agents view - multiple lines per agent
          const dailyDataByAgent: { [key: string]: { [key: string]: number } } = {};
          const allDates = new Set<string>();
          
          cycleLogs.forEach((log: any) => {
            const date = new Date(log.completedAt);
            const dayKey = date.toISOString().split('T')[0];
            const agentName = agentsData.find(a => a.id === log.agentId)?.name || log.agentId;
            
            allDates.add(dayKey);
            
            if (!dailyDataByAgent[dayKey]) {
              dailyDataByAgent[dayKey] = {};
            }
            
            if (!dailyDataByAgent[dayKey][agentName]) {
              dailyDataByAgent[dayKey][agentName] = 0;
            }
            
            dailyDataByAgent[dayKey][agentName] += 1;
          });
          
          // Convert to array with all agent columns
          const cyclesArray = Array.from(allDates).map(dayKey => {
            const dataPoint: any = {
              date: dayKey,
              dateFormatted: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            };
            
            // Add each agent's count
            Object.keys(dailyDataByAgent[dayKey] || {}).forEach(agentName => {
              dataPoint[agentName] = dailyDataByAgent[dayKey][agentName];
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

  // Regenerate time series data when agent selection changes
  useEffect(() => {
    if (agents.length > 0) {
      const filterAgentId = selectedAgentTab === 'all' ? undefined : selectedAgentTab;
      generateTimeSeriesData(agents, filterAgentId);
      generateReplyActivityData(agents, filterAgentId);
      generateCyclesData(agents, filterAgentId);
    }
  }, [selectedAgentTab, agents]);
  
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
                {issues.filter(i => i.severity === 'error').length} errors · {issues.filter(i => i.severity === 'warning').length} warnings
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
            {issues.slice(0, 5).map((issue) => (
              <div key={issue.id} className="p-4">
                <div className="flex items-start gap-3">
                  {issue.severity === 'error' && <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  {issue.severity === 'warning' && <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                  {issue.severity === 'info' && <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
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
            ))}
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

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Activity Over Time Line Chart */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              {selectedAgent ? `${selectedAgent.name} - Activity Timeline` : 'Email Activity Over Time'}
            </h3>
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
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              {selectedAgent ? `${selectedAgent.name} - Reply Activity` : 'Reply Activity Over Time'}
            </h3>
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
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              {selectedAgent ? `${selectedAgent.name} - Cycles Completed` : 'Cycles Completed Over Time'}
            </h3>
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
          issues.filter(i => !i.resolved).map((issue) => (
            <div key={issue.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
              <div className="flex items-start gap-3">
                {issue.severity === 'error' && <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                {issue.severity === 'warning' && <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                {issue.severity === 'info' && <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
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
          ))
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
                                const budgetLimits = getBudgetBasedLimits();
                                const maxAffordable = budgetLimits?.apollo;
                                const progressPercent = maxAffordable ? Math.min((usage / maxAffordable) * 100, 100) : 0;
                                
                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Credits Used</span>
                                      <span className="font-medium text-neutral-900">
                                        {usage.toLocaleString()}{maxAffordable ? ` / ${maxAffordable.toLocaleString()}` : ''} credits
                                      </span>
                                    </div>
                                    {maxAffordable && (
                                      <div className="w-full bg-neutral-200 rounded-full h-1">
                                        <div className="bg-blue-500 h-1 rounded-full" style={{ 
                                          width: `${progressPercent}%` 
                                        }}></div>
                                      </div>
                                    )}
                                    <div className="text-xs text-neutral-500 mt-1">
                                      {apiUsage[agent.id]?.apollo?.calls || 0} API calls
                                      {maxAffordable && ` · ${progressPercent.toFixed(1)}% of budget`}
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
                                const usage = apiUsage[agent.id]?.openai?.usage || 0;
                                const budgetLimits = getBudgetBasedLimits();
                                const maxAffordable = budgetLimits?.openai;
                                const progressPercent = maxAffordable ? Math.min((usage / maxAffordable) * 100, 100) : 0;
                                
                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Tokens Used</span>
                                      <span className="font-medium text-neutral-900">
                                        {usage.toLocaleString()}{maxAffordable ? ` / ${maxAffordable.toLocaleString()}` : ''} tokens
                                      </span>
                                    </div>
                                    {maxAffordable && (
                                      <div className="w-full bg-neutral-200 rounded-full h-1">
                                        <div className="bg-emerald-500 h-1 rounded-full" style={{ 
                                          width: `${progressPercent}%` 
                                        }}></div>
                                      </div>
                                    )}
                                    <div className="text-xs text-neutral-500 mt-1">
                                      {apiUsage[agent.id]?.openai?.calls || 0} API calls · GPT-3.5
                                      {maxAffordable && ` · ${progressPercent.toFixed(1)}% of budget`}
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
                                const usage = apiUsage[agent.id]?.mailgun?.usage || 0;
                                const budgetLimits = getBudgetBasedLimits();
                                const maxAffordable = budgetLimits?.mailgun;
                                const progressPercent = maxAffordable ? Math.min((usage / maxAffordable) * 100, 100) : 0;
                                
                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Emails Sent</span>
                                      <span className="font-medium text-neutral-900">
                                        {usage.toLocaleString()}{maxAffordable ? ` / ${maxAffordable.toLocaleString()}` : ''}
                                      </span>
                                    </div>
                                    {maxAffordable && (
                                      <div className="w-full bg-neutral-200 rounded-full h-1">
                                        <div className="bg-orange-500 h-1 rounded-full" style={{ 
                                          width: `${progressPercent}%` 
                                        }}></div>
                                      </div>
                                    )}
                                    <div className="text-xs text-neutral-500 mt-1">
                                      {apiUsage[agent.id]?.mailgun?.calls || 0} API calls
                                      {maxAffordable && ` · ${progressPercent.toFixed(1)}% of budget`}
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
                                const usage = apiUsage[agent.id]?.zerobounce?.usage || 0;
                                const budgetLimits = getBudgetBasedLimits();
                                const maxAffordable = budgetLimits?.zerobounce;
                                const progressPercent = maxAffordable ? Math.min((usage / maxAffordable) * 100, 100) : 0;
                                
                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Validations</span>
                                      <span className="font-medium text-neutral-900">
                                        {usage.toLocaleString()}{maxAffordable ? ` / ${maxAffordable.toLocaleString()}` : ''} credits
                                      </span>
                                    </div>
                                    {maxAffordable && (
                                      <div className="w-full bg-neutral-200 rounded-full h-1">
                                        <div className="bg-purple-500 h-1 rounded-full" style={{ 
                                          width: `${progressPercent}%` 
                                        }}></div>
                                      </div>
                                    )}
                                    <div className="text-xs text-neutral-500 mt-1">
                                      {apiUsage[agent.id]?.zerobounce?.calls || 0} API calls
                                      {maxAffordable && ` · ${progressPercent.toFixed(1)}% of budget`}
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
                                const usage = apiUsage[agent.id]?.serper?.usage || 0;
                                const budgetLimits = getBudgetBasedLimits();
                                const maxAffordable = budgetLimits?.serper;
                                const progressPercent = maxAffordable ? Math.min((usage / maxAffordable) * 100, 100) : 0;
                                
                                return (
                                  <>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="text-neutral-600">Searches</span>
                                      <span className="font-medium text-neutral-900">
                                        {usage.toLocaleString()}{maxAffordable ? ` / ${maxAffordable.toLocaleString()}` : ''} queries
                                      </span>
                                    </div>
                                    {maxAffordable && (
                                      <div className="w-full bg-neutral-200 rounded-full h-1">
                                        <div className="bg-orange-500 h-1 rounded-full" style={{ 
                                          width: `${progressPercent}%` 
                                        }}></div>
                                      </div>
                                    )}
                                    <div className="text-xs text-neutral-500 mt-1">
                                      {apiUsage[agent.id]?.serper?.calls || 0} API calls
                                      {maxAffordable && ` · ${progressPercent.toFixed(1)}% of budget`}
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
      {/* Budget Management Section - At Top */}
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
                      borderRadius: '8px'
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
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `$${Number(value).toFixed(2)}`}
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

  const renderLogs = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Activity Logs</h2>
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
        <p className="text-neutral-600">Activity logs will appear here.</p>
      </div>
    </div>
  );

  switch (view) {
    case 'overview':
      return renderOverview();
    case 'search':
      return <LeadSearchPanel agents={agents} />;
    case 'report':
      return <AIReportPanel />;
    case 'analytics':
      return renderAnalytics();
    case 'issues':
      return renderIssues();
    case 'agents':
      return renderAgents();
    case 'integrations':
      return renderIntegrations();
    case 'logs':
      return renderLogs();
    default:
      return renderOverview();
  }
}
