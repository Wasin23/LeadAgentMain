'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  const [agents, setAgents] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<string | number | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'issues' | 'cycles' | 'important' | 'agents'>('all');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  const [replyTimeRange, setReplyTimeRange] = useState<'hour' | 'day' | 'week'>('day');  const [agentTimeRange, setAgentTimeRange] = useState<'hour' | 'day' | 'week'>('week');
  const [cyclesTimeRange, setCyclesTimeRange] = useState<'hour' | 'day' | 'week'>('week');  const [sentEmails, setSentEmails] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, timeRange, replyTimeRange, agentTimeRange, cyclesTimeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch agents with their stats (same as MonitoringContent)
      const agentsRes = await api.get('/api/auth/agents');
      if (agentsRes.data.success && agentsRes.data.agents) {
        const agentsWithStats = await Promise.all(
          agentsRes.data.agents.map(async (agent: any) => {
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
              sentEmails
            };
          })
        );
        setAgents(agentsWithStats);
        generateTimeSeriesData(agentsWithStats);
        
        // Collect all sent emails
        const allSentEmails: any[] = [];
        agentsWithStats.forEach(agent => {
          if (agent.sentEmails) {
            agent.sentEmails.forEach((email: any) => {
              allSentEmails.push({
                ...email,
                agentName: agent.name
              });
            });
          }
        });
        allSentEmails.sort((a, b) => new Date(b.sentAt || b.timestamp).getTime() - new Date(a.sentAt || a.timestamp).getTime());
        setSentEmails(allSentEmails.slice(0, 20));
      }

      // Fetch activities (same as MonitoringContent)
      const activityRes = await api.get('/api/monitoring/activity');
      if (activityRes.data?.success && activityRes.data.activities) {
        setActivities(activityRes.data.activities);
      }

      // Fetch issues
      const issuesRes = await api.get('/api/issues');
      if (issuesRes.data?.success && issuesRes.data.issues) {
        setIssues(issuesRes.data.issues);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSeriesData = (agentsData: any[]) => {
    const points = timeRange === 'hour' ? 24 : timeRange === 'day' ? 7 : 30;
    const now = new Date();
    const data = [];

    for (let i = points - 1; i >= 0; i--) {
      const date = new Date(now);
      let label = '';
      let startDate, endDate;

      if (timeRange === 'hour') {
        date.setHours(date.getHours() - i);
        startDate = new Date(date);
        startDate.setMinutes(0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
        label = `${startDate.getHours()}:00`;
      } else if (timeRange === 'day') {
        date.setDate(date.getDate() - i);
        startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        date.setDate(date.getDate() - i);
        startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      let sent = 0;
      let replied = 0;

      agentsData.forEach(agent => {
        if (agent.sentEmails) {
          agent.sentEmails.forEach((email: any) => {
            const emailDate = new Date(email.sentAt || email.timestamp);
            if (emailDate >= startDate && emailDate < endDate) {
              sent++;
              if (email.replied || email.status === 'REPLIED') {
                replied++;
              }
            }
          });
        }
      });

      data.push({ date: label, sent, replied });
    }

    setTimeSeriesData(data);
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Calculate totals
  const totalQueued = agents.reduce((sum, a) => sum + (a.queued || 0), 0);
  const totalSent = agents.reduce((sum, a) => sum + (a.sent || 0), 0);
  const totalReplied = agents.reduce((sum, a) => sum + (a.replied || 0), 0);
  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0';

  const maxValue = Math.max(...timeSeriesData.map(d => d.sent), 1);

  // Filter activities
  const filteredActivities = activities.filter(act => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'issues') {
      return act.activityType === 'issue' || act.category === 'issue';
    }
    if (activityFilter === 'cycles') {
      const titleLower = act.title?.toLowerCase() || '';
      const msgLower = act.message?.toLowerCase() || '';
      return titleLower.includes('cycle') || msgLower.includes('cycle') || act.category === 'cycle';
    }
    if (activityFilter === 'important') {
      const titleLower = act.title?.toLowerCase() || '';
      const msgLower = act.message?.toLowerCase() || '';
      return titleLower.includes('cycle') || act.activityType === 'issue' || 
             titleLower.includes('agent') || msgLower.includes('budget') || act.category === 'issue';
    }
    if (activityFilter === 'agents') {
      const agentKeywords = ['agent', 'bot', 'assistant'];
      const titleLower = act.title?.toLowerCase() || '';
      return agentKeywords.some(kw => titleLower.includes(kw));
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all border border-white/20 flex items-center gap-2 hover:scale-105 active:scale-95"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back
          </button>
          
          <div>
            <h1 className="text-3xl font-bold text-white text-right">Analytics Dashboard</h1>
            <p className="text-white/70 text-sm text-right mt-1">Real-time campaign performance</p>
          </div>
        </div>

        {/* Stats Grid with Mini Graphs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Queued Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02]">
            <p className="text-white/70 text-sm font-medium mb-2">Queued Emails</p>
            <p className="text-white text-4xl font-bold mb-4">{totalQueued}</p>
            <div className="h-16 flex items-end gap-1">
              {agents.slice(0, 10).map((agent, i) => {
                const maxQueued = Math.max(...agents.map(a => a.queued || 0), 1);
                const height = ((agent.queued || 0) / maxQueued) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-orange-400 to-orange-300 rounded-t hover:opacity-80 transition-opacity"
                    style={{ height: `${height}%` }}
                    title={`${agent.name}: ${agent.queued}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Sent Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02]">
            <p className="text-white/70 text-sm font-medium mb-2">Emails Sent</p>
            <p className="text-white text-4xl font-bold mb-4">{totalSent}</p>
            <div className="h-16 flex items-end gap-1">
              {agents.slice(0, 10).map((agent, i) => {
                const maxSent = Math.max(...agents.map(a => a.sent || 0), 1);
                const height = ((agent.sent || 0) / maxSent) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-purple-400 to-pink-400 rounded-t hover:opacity-80 transition-opacity"
                    style={{ height: `${height}%` }}
                    title={`${agent.name}: ${agent.sent}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Replied Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02]">
            <p className="text-white/70 text-sm font-medium mb-2">Replies Received</p>
            <p className="text-white text-4xl font-bold mb-4">{totalReplied}</p>
            <div className="h-16 flex items-end gap-1">
              {agents.slice(0, 10).map((agent, i) => {
                const maxReplied = Math.max(...agents.map(a => a.replied || 0), 1);
                const height = ((agent.replied || 0) / maxReplied) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-green-400 to-green-300 rounded-t hover:opacity-80 transition-opacity"
                    style={{ height: `${height}%` }}
                    title={`${agent.name}: ${agent.replied}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Reply Rate Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02]">
            <p className="text-white/70 text-sm font-medium mb-2">Reply Rate</p>
            <p className="text-white text-4xl font-bold mb-4">{replyRate}%</p>
            <div className="h-16 flex items-end gap-1">
              {agents.slice(0, 10).map((agent, i) => {
                const rate = agent.sent > 0 ? (agent.replied / agent.sent) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-400 to-blue-300 rounded-t hover:opacity-80 transition-opacity"
                    style={{ height: `${rate}%` }}
                    title={`${agent.name}: ${rate.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Email Activity Over Time */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">Email Activity Over Time</h2>
              <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
                {(['hour', 'day', 'week'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timeRange === range
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-40 flex items-end justify-between gap-2">
            {timeSeriesData.map((point, i) => {
              const maxVal = Math.max(...timeSeriesData.map(d => d.sent), 1);
              const sentHeight = (point.sent / maxVal) * 100;
              const repliedHeight = (point.replied / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="relative flex-1 w-full flex flex-col justify-end items-center gap-1">
                    {/* Sent bar */}
                    <div
                      className="w-full bg-gradient-to-t from-purple-400 to-pink-400 rounded-t-xl transition-all duration-300 cursor-pointer shadow-lg relative"
                      style={{ height: `${sentHeight}%` }}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {hoveredBar === i && (
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-purple-600 px-3 py-2 rounded-xl text-xs font-bold shadow-xl whitespace-nowrap z-10">
                          <div>Sent: {point.sent}</div>
                          <div>Replied: {point.replied}</div>
                        </div>
                      )}
                    </div>
                    {/* Replied bar */}
                    {point.replied > 0 && (
                      <div
                        className="w-full bg-gradient-to-t from-green-400 to-green-300 rounded-t-lg transition-all duration-300 cursor-pointer"
                        style={{ height: `${repliedHeight}%` }}
                      />
                    )}
                  </div>
                  <div className="text-white/70 text-[10px] font-medium text-center">{point.date}</div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-purple-400 to-pink-400"></div>
              <span className="text-white/70 text-xs">Sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-green-300"></div>
              <span className="text-white/70 text-xs">Replied</span>
            </div>
          </div>
        </div>

        {/* Agent Performance Comparison */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">Agent Performance Comparison</h2>
              <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
                {(['hour', 'day', 'week'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setAgentTimeRange(range)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      agentTimeRange === range
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-40 flex items-end justify-between gap-2">
            {agents.map((agent, i) => {
              // Filter emails based on time range
              const now = new Date();
              let startTime: Date;
              if (agentTimeRange === 'hour') {
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              } else if (agentTimeRange === 'day') {
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              } else {
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              }
              
              const filteredSent = (agent.sentEmails || []).filter((e: any) => new Date(e.timestamp) >= startTime).length;
              const filteredReplied = (agent.sentEmails || []).filter((e: any) => e.replied && new Date(e.timestamp) >= startTime).length;
              
              const maxSent = Math.max(...agents.map(a => {
                const sent = (a.sentEmails || []).filter((e: any) => new Date(e.timestamp) >= startTime).length;
                return sent;
              }), 1);
              const sentHeight = (filteredSent / maxSent) * 100;
              const repliedHeight = (filteredReplied / maxSent) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="relative flex-1 w-full flex justify-center items-end gap-2">
                    <div className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-purple-400 to-pink-400 rounded-t-xl transition-all duration-300 hover:opacity-80 cursor-pointer shadow-lg relative"
                        style={{ height: `${sentHeight}%`, minHeight: '4px' }}
                        onMouseEnter={() => setHoveredBar(`agent-sent-${i}`)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {hoveredBar === `agent-sent-${i}` && (
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {filteredSent} sent
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-green-400 to-green-300 rounded-t-xl transition-all duration-300 hover:opacity-80 cursor-pointer shadow-lg relative"
                        style={{ height: `${repliedHeight}%`, minHeight: '4px' }}
                        onMouseEnter={() => setHoveredBar(`agent-replied-${i}`)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {hoveredBar === `agent-replied-${i}` && (
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {filteredReplied} replied
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-white/70 text-[10px] font-medium text-center truncate w-full">{agent.name}</div>
                </div>
              );
            })}
            </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-purple-400 to-pink-400"></div>
              <span className="text-white/70 text-xs">Sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-green-300"></div>
              <span className="text-white/70 text-xs">Replied</span>
            </div>
          </div>
        </div>

        {/* Reply Activity Over Time */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">Reply Activity Over Time</h2>
            <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
              {(['hour', 'day', 'week'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setReplyTimeRange(range)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                    replyTimeRange === range
                      ? 'bg-white text-purple-600 shadow-lg'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {timeSeriesData.some(d => d.replied > 0) ? (
            <div className="h-40 flex items-end justify-between gap-2">
              {timeSeriesData.map((point, i) => {
                const maxReplies = Math.max(...timeSeriesData.map(d => d.replied), 1);
                const height = (point.replied / maxReplies) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                    <div className="relative flex-1 w-full flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-green-400 to-green-300 rounded-t-xl transition-all duration-300 group-hover:opacity-80 cursor-pointer shadow-lg"
                        style={{ height: `${height}%`, minHeight: point.replied > 0 ? '4px' : '0' }}
                        title={`${point.replied} replies`}
                      />
                    </div>
                    <div className="text-white/70 text-[10px] font-medium text-center">{point.date}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-white/60">
              <div className="text-center">
                <p className="text-xs mb-1">No reply data yet</p>
                <p className="text-[10px]">Replies will appear here as they come in</p>
              </div>
            </div>
          )}
        </div>

        {/* Cycles Completed Over Time */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">Cycles Completed Over Time</h2>
              <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
                {(['hour', 'day', 'week'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setCyclesTimeRange(range)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      cyclesTimeRange === range
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {activities.filter(a => a.title?.toLowerCase().includes('cycle') || a.category === 'cycle').length > 0 ? (
              <div className="h-40 relative">
              {(() => {
                const cyclesData = timeSeriesData.map((point) => {
                  const cycleActivities = activities.filter(a => {
                    const isCycle = a.title?.toLowerCase().includes('cycle') || a.category === 'cycle';
                    if (!isCycle) return false;
                    const actDate = new Date(a.timestamp);
                    return actDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === point.date;
                  });
                  return { date: point.date, count: cycleActivities.length };
                });
                
                const maxCycles = Math.max(...cyclesData.map(d => d.count), 1);
                const width = 100;
                const height = 100;
                const points = cyclesData.map((d, i) => {
                  const x = (i / (cyclesData.length - 1)) * width;
                  const y = height - (d.count / maxCycles) * height;
                  return { x, y, count: d.count, date: d.date };
                });
                
                const pathD = points.map((p, i) => 
                  `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                ).join(' ');
                
                return (
                  <div className="w-full h-full relative">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="cycleLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
                          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                        </linearGradient>
                        <linearGradient id="cycleAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 0.3 }} />
                          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0.05 }} />
                        </linearGradient>
                      </defs>
                      <path
                        d={`${pathD} L 100 100 L 0 100 Z`}
                        fill="url(#cycleAreaGradient)"
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="url(#cycleLineGradient)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
                      {cyclesData.map((d, i) => (
                        <div key={i} className="flex flex-col items-center relative">
                          {hoveredBar === `cycle-${i}` && (
                            <div className="absolute -top-6 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                              {d.count} cycles
                            </div>
                          )}
                          <div className="text-white/70 text-[10px] font-medium text-center">{d.date}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-white/60">
                <div className="text-center">
                  <p className="text-xs mb-1">No cycles completed yet</p>
                  <p className="text-[10px]">Cycle data will appear here as agents complete their cycles</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sent Emails */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Sent Emails</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sentEmails.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <p>No emails sent yet</p>
                </div>
              ) : (
                sentEmails.map((email, i) => (
                  <div
                    key={i}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">{email.recipientEmail || email.to}</div>
                        <div className="text-white/70 text-xs truncate">{email.subject}</div>
                      </div>
                      {email.replied && (
                        <div className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-300">
                          Replied
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{email.agentName}</span>
                      <span>•</span>
                      <span>{new Date(email.sentAt || email.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Agent Performance Summary */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Agent Performance</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {agents.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <p>No agents configured</p>
                </div>
              ) : (
                agents.map((agent, i) => (
                  <div
                    key={i}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white font-semibold">{agent.name}</div>
                      <div className="text-white/70 text-sm">
                        {agent.sent > 0 ? ((agent.replied / agent.sent) * 100).toFixed(1) : '0'}% reply rate
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-orange-300 text-2xl font-bold">{agent.queued}</div>
                        <div className="text-white/50 text-xs">Queued</div>
                      </div>
                      <div>
                        <div className="text-purple-300 text-2xl font-bold">{agent.sent}</div>
                        <div className="text-white/50 text-xs">Sent</div>
                      </div>
                      <div>
                        <div className="text-green-300 text-2xl font-bold">{agent.replied}</div>
                        <div className="text-white/50 text-xs">Replied</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivityFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-xl transition-all ${
                    activityFilter === 'all' 
                      ? 'bg-white text-purple-600 shadow-lg font-semibold' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActivityFilter('issues')}
                  className={`px-3 py-1.5 text-sm rounded-xl transition-all ${
                    activityFilter === 'issues' 
                      ? 'bg-white text-purple-600 shadow-lg font-semibold' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Issues ({activities.filter(a => a.activityType === 'issue' || a.category === 'issue').length})
                </button>
                <button
                  onClick={() => setActivityFilter('cycles')}
                  className={`px-3 py-1.5 text-sm rounded-xl transition-all ${
                    activityFilter === 'cycles' 
                      ? 'bg-white text-purple-600 shadow-lg font-semibold' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Cycles
                </button>
                <button
                  onClick={() => setActivityFilter('important')}
                  className={`px-3 py-1.5 text-sm rounded-xl transition-all ${
                    activityFilter === 'important' 
                      ? 'bg-white text-purple-600 shadow-lg font-semibold' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Important
                </button>
                <button
                  onClick={() => setActivityFilter('agents')}
                  className={`px-3 py-1.5 text-sm rounded-xl transition-all ${
                    activityFilter === 'agents' 
                      ? 'bg-white text-purple-600 shadow-lg font-semibold' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Agents
                </button>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <p>No {activityFilter !== 'all' ? activityFilter : ''} activity</p>
                </div>
              ) : (
                filteredActivities.slice(0, 20).map((activity, i) => {
                  const isError = activity.activityType === 'issue' || activity.category === 'issue';
                  const isCycle = activity.title?.toLowerCase().includes('cycle') || activity.category === 'cycle';
                  
                  return (
                    <div
                      key={i}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          isError ? 'bg-red-400' : isCycle ? 'bg-green-400' : 'bg-blue-400'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium">{activity.title || activity.message}</div>
                          {activity.details && (
                            <div className="text-white/70 text-sm mt-1">{activity.details}</div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                            <span>{new Date(activity.timestamp).toLocaleString()}</span>
                            {activity.category && (
                              <>
                                <span>•</span>
                                <span className="uppercase font-semibold">{activity.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
