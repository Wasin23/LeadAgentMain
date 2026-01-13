'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  MessageCircle, 
  Users, 
  Target,
  DollarSign,
  Activity,
  ExternalLink,
  Plus,
  BarChart3,
  Calendar
} from 'lucide-react';

interface Stats {
  totalEmailsSent: number;
  totalResponses: number;
  responseRate: number;
  activeAgents: number;
  leadsGenerated: number;
  emailsThisMonth: number;
  responsesThisMonth: number;
  costThisMonth: number;
}

interface Agent {
  agentId: string;
  name: string;
  status: string;
  emailsSent: number;
  responses: number;
  responseRate: number;
}

interface RecentResponse {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  responseTime: string;
  agentName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalEmailsSent: 0,
    totalResponses: 0,
    responseRate: 0,
    activeAgents: 0,
    leadsGenerated: 0,
    emailsThisMonth: 0,
    responsesThisMonth: 0,
    costThisMonth: 0
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const [analyticsRes, statusRes, emailActivityRes] = await Promise.all([
        api.get('/api/analytics/stats'),
        api.get('/api/lead-agent/status'),
        api.get('/api/analytics/emails')
      ]);

      // Process stats
      const emailActivity = emailActivityRes.data.data || [];
      const totalSent = emailActivity.length;
      const totalResponses = emailActivity.filter((e: any) => e.analyticsStatus?.replied).length;
      const responseRate = totalSent > 0 ? (totalResponses / totalSent) * 100 : 0;

      // Get this month's data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const emailsThisMonth = emailActivity.filter((e: any) => 
        new Date(e.sentAt || e.timestamp) >= startOfMonth
      ).length;
      const responsesThisMonth = emailActivity.filter((e: any) => 
        e.analyticsStatus?.replied && new Date(e.analyticsStatus.repliedAt) >= startOfMonth
      ).length;

      // Get agent info from status
      const statusData = statusRes.data || {};
      const isAgentRunning = statusData.status === 'running';
      
      setStats({
        totalEmailsSent: totalSent,
        totalResponses: totalResponses,
        responseRate: Math.round(responseRate * 10) / 10,
        activeAgents: isAgentRunning ? 1 : 0,
        leadsGenerated: emailActivity.filter((e: any) => e.analyticsStatus?.opened).length,
        emailsThisMonth,
        responsesThisMonth,
        costThisMonth: analyticsRes.data.totalCost || 0
      });

      // Process agent performance - simplified for single agent system
      const agentEmails = emailActivity;
      const agentResponses = agentEmails.filter((e: any) => e.analyticsStatus?.replied);
      const agentPerformance = [{
        agentId: 'main-agent',
        name: statusData.settings?.agentName || 'Lead Agent',
        status: statusData.status || 'idle',
        emailsSent: agentEmails.length,
        responses: agentResponses.length,
        responseRate: agentEmails.length > 0 ? (agentResponses.length / agentEmails.length) * 100 : 0
      }];
      setAgents(agentPerformance);

      // Process recent responses
      const responses = emailActivity
        .filter((e: any) => e.analyticsStatus?.replied)
        .sort((a: any, b: any) => 
          new Date(b.analyticsStatus.repliedAt).getTime() - new Date(a.analyticsStatus.repliedAt).getTime()
        )
        .slice(0, 5)
        .map((e: any) => ({
          id: e.emailId || e.id,
          recipientEmail: e.recipientEmail || e.to,
          recipientName: e.recipientName || e.recipientEmail?.split('@')[0] || 'Unknown',
          subject: e.subject || 'No subject',
          responseTime: e.analyticsStatus.repliedAt,
          agentName: statusData.settings?.agentName || 'Lead Agent'
        }));
      setRecentResponses(responses);

      // Generate chart data (last 30 days)
      const chartDays = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const emailsSent = emailActivity.filter((e: any) => {
          const sentDate = new Date(e.sentAt || e.timestamp);
          return sentDate >= date && sentDate < nextDay;
        }).length;
        
        const responses = emailActivity.filter((e: any) => {
          const repliedDate = e.analyticsStatus?.repliedAt ? new Date(e.analyticsStatus.repliedAt) : null;
          return repliedDate && repliedDate >= date && repliedDate < nextDay;
        }).length;
        
        chartDays.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          emails: emailsSent,
          responses: responses
        });
      }
      setChartData(chartDays);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4FD1FF]"></div>
        </div>
      </AppLayout>
    );
  }

  const maxChartValue = Math.max(...chartData.map(d => Math.max(d.emails, d.responses)), 1);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-[#8FA6C1]">Here's what's happening with your outreach</p>
          </div>
          <button
            onClick={() => router.push('/agents-overview')}
            className="px-4 py-2 bg-[#4FD1FF] text-[#0F1E35] rounded-lg font-semibold hover:bg-[#6BE3FF] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Emails Sent */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-5 hover:border-[#4FD1FF]/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Mail className="w-8 h-8 text-[#4FD1FF]" />
              <span className="text-xs text-[#8FA6C1] bg-[#4FD1FF]/10 px-2 py-1 rounded">
                {stats.emailsThisMonth} this month
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalEmailsSent}</div>
            <div className="text-sm text-[#8FA6C1]">Total Emails Sent</div>
          </div>

          {/* Response Rate */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-5 hover:border-[#4FD1FF]/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <MessageCircle className="w-8 h-8 text-green-400" />
              <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                stats.responseRate >= 10 ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'
              }`}>
                {stats.responseRate >= 10 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stats.responseRate}%
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalResponses}</div>
            <div className="text-sm text-[#8FA6C1]">Total Responses</div>
          </div>

          {/* Active Agents */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-5 hover:border-[#4FD1FF]/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-[#8FA6C1] bg-purple-400/10 px-2 py-1 rounded">
                {agents.length} total
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.activeAgents}</div>
            <div className="text-sm text-[#8FA6C1]">Active Agents</div>
          </div>

          {/* Leads Generated */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-5 hover:border-[#4FD1FF]/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Target className="w-8 h-8 text-orange-400" />
              <span className="text-xs text-[#8FA6C1] bg-orange-400/10 px-2 py-1 rounded">
                ${stats.costThisMonth.toFixed(2)} spent
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.leadsGenerated}</div>
            <div className="text-sm text-[#8FA6C1]">Leads Generated</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Chart - 2 columns */}
          <div className="lg:col-span-2 bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Recent Activity</h3>
                <p className="text-sm text-[#8FA6C1]">Last 30 days</p>
              </div>
              <button
                onClick={() => router.push('/analytics')}
                className="text-[#4FD1FF] hover:text-[#6BE3FF] text-sm font-medium flex items-center gap-1"
              >
                View Dashboard <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Simple Bar Chart */}
            <div className="h-64 flex items-end gap-1">
              {chartData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#0F1E35] border border-[#4FD1FF]/30 rounded-lg p-2 text-xs whitespace-nowrap z-10">
                    <div className="text-white font-medium mb-1">{day.date}</div>
                    <div className="text-[#4FD1FF]">Emails: {day.emails}</div>
                    <div className="text-green-400">Responses: {day.responses}</div>
                  </div>
                  
                  {/* Emails Bar */}
                  <div 
                    className="w-full bg-[#4FD1FF]/60 rounded-t hover:bg-[#4FD1FF] transition-all cursor-pointer"
                    style={{ height: `${(day.emails / maxChartValue) * 100}%`, minHeight: day.emails > 0 ? '4px' : '0' }}
                  ></div>
                  
                  {/* Responses Bar */}
                  <div 
                    className="w-full bg-green-400/60 rounded-t hover:bg-green-400 transition-all cursor-pointer"
                    style={{ height: `${(day.responses / maxChartValue) * 100}%`, minHeight: day.responses > 0 ? '4px' : '0' }}
                  ></div>
                  
                  {/* Date Label (show every 5th) */}
                  {idx % 5 === 0 && (
                    <div className="text-[10px] text-[#8FA6C1] mt-2 -rotate-45 origin-top-left">
                      {day.date}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#4FD1FF] rounded"></div>
                <span className="text-[#8FA6C1]">Emails Sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded"></div>
                <span className="text-[#8FA6C1]">Responses</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/agents-overview')}
                className="w-full p-4 bg-[#0F1E35]/60 hover:bg-[#0F1E35] border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 rounded-lg transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#4FD1FF]/20 rounded-lg flex items-center justify-center group-hover:bg-[#4FD1FF]/30 transition-all">
                    <Plus className="w-5 h-5 text-[#4FD1FF]" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Create Agent</div>
                    <div className="text-xs text-[#8FA6C1]">Start new campaign</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/analytics')}
                className="w-full p-4 bg-[#0F1E35]/60 hover:bg-[#0F1E35] border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 rounded-lg transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-400/20 rounded-lg flex items-center justify-center group-hover:bg-purple-400/30 transition-all">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">View Dashboard</div>
                    <div className="text-xs text-[#8FA6C1]">Detailed analytics</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/outreach')}
                className="w-full p-4 bg-[#0F1E35]/60 hover:bg-[#0F1E35] border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 rounded-lg transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-400/20 rounded-lg flex items-center justify-center group-hover:bg-green-400/30 transition-all">
                    <MessageCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Check Inbox</div>
                    <div className="text-xs text-[#8FA6C1]">View responses</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/settings')}
                className="w-full p-4 bg-[#0F1E35]/60 hover:bg-[#0F1E35] border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 rounded-lg transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-400/20 rounded-lg flex items-center justify-center group-hover:bg-orange-400/30 transition-all">
                    <Activity className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Settings</div>
                    <div className="text-xs text-[#8FA6C1]">Configure system</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Performance Table */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Agent Performance</h3>
              <button
                onClick={() => router.push('/agents-overview')}
                className="text-[#4FD1FF] hover:text-[#6BE3FF] text-sm font-medium flex items-center gap-1"
              >
                View All <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {agents.slice(0, 5).map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between p-3 bg-[#0F1E35]/40 hover:bg-[#0F1E35]/60 rounded-lg border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/20 transition-all cursor-pointer"
                  onClick={() => router.push('/agents-overview')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <div>
                      <div className="text-white font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-[#8FA6C1]">{agent.emailsSent} emails sent</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{agent.responses}</div>
                    <div className="text-xs text-[#8FA6C1]">{agent.responseRate.toFixed(1)}% rate</div>
                  </div>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="text-center py-8 text-[#8FA6C1]">
                  No agents created yet
                </div>
              )}
            </div>
          </div>

          {/* Recent Responses */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Recent Responses</h3>
              <button
                onClick={() => router.push('/outreach')}
                className="text-[#4FD1FF] hover:text-[#6BE3FF] text-sm font-medium flex items-center gap-1"
              >
                View All <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {recentResponses.map((response) => (
                <div
                  key={response.id}
                  className="p-3 bg-[#0F1E35]/40 hover:bg-[#0F1E35]/60 rounded-lg border border-green-400/10 hover:border-green-400/20 transition-all cursor-pointer"
                  onClick={() => router.push('/outreach')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">{response.recipientName}</div>
                      <div className="text-xs text-[#8FA6C1]">{response.recipientEmail}</div>
                    </div>
                    <MessageCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  </div>
                  <div className="text-xs text-[#8FA6C1] truncate mb-1">{response.subject}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#4FD1FF]">{response.agentName}</span>
                    <span className="text-[#8FA6C1]">{new Date(response.responseTime).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {recentResponses.length === 0 && (
                <div className="text-center py-8 text-[#8FA6C1]">
                  No responses yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
