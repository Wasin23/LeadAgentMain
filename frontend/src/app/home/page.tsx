'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';

interface EmailStats {
  queued: number;
  sent: number;
  replied: number;
  total: number;
}

interface FollowUp {
  id: string;
  followUpDate: string;
  to?: string;
  subject?: string;
  lead?: {
    name?: string;
    email?: string;
    company?: string;
  };
  agentId?: string;
}

interface CRMStatus {
  connected: boolean;
  integration: string | null;
  connectedAt: string | null;
  autoSync: boolean;
}

interface Agent {
  agentId: string;
  name: string;
  createdAt?: string;
  personality?: {
    type?: string;
    avatar?: string;
  };
  settings?: {
    emailBuilder?: {
      useGmail?: boolean;
    };
    targeting?: {
      leadLimit?: number;
    };
    geographicSettings?: {
      leadLimit?: number;
    };
  };
  status?: string;
  currentActivity?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [stats, setStats] = useState<EmailStats>({
    queued: 0,
    sent: 0,
    replied: 0,
    total: 0
  });
  const [totalOpened, setTotalOpened] = useState(0);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<FollowUp[]>([]);
  const [crmStatus, setCrmStatus] = useState<CRMStatus>({
    connected: false,
    integration: null,
    connectedAt: null,
    autoSync: true
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentActivity, setAgentActivity] = useState<{date: string, count: number}[]>([]);
  const [statsChanges, setStatsChanges] = useState({
    queued: 0,
    sent: 0,
    replied: 0,
    opened: 0
  });
  const [agentStats, setAgentStats] = useState<{[key: string]: {queued: number, sent: number}}>({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch email queue stats across ALL agents (pass no agentId - defaults to null)
        const queueResponse = await api.get('/api/email-queue/stats');
        if (queueResponse.data) {
          setStats({
            queued: queueResponse.data.queued || 0,
            sent: queueResponse.data.sent || 0,
            replied: queueResponse.data.replied || 0,
            total: queueResponse.data.total || 0
          });
        }

        // Fetch ALL sent emails and count opens
        const sentEmailsResponse = await api.get('/api/email-queue/sent?agentId=all');
        if (sentEmailsResponse.data && Array.isArray(sentEmailsResponse.data)) {
          // Count emails that have been opened (checking multiple possible fields)
          const openedCount = sentEmailsResponse.data.filter((email: any) => 
            email.opened === true || 
            email.analytics?.opened === true
          ).length;
          setTotalOpened(openedCount);

          // Get emails with scheduled follow-ups and sort by date
          const emailsWithFollowUps = sentEmailsResponse.data
            .filter((email: any) => email.followUpScheduled && email.followUpDate)
            .sort((a: any, b: any) => 
              new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime()
            )
            .slice(0, 10); // Get top 10 soonest
          
          setUpcomingFollowUps(emailsWithFollowUps);
        }

        // Fetch CRM connection status
        const crmResponse = await api.get('/api/crm/status');
        if (crmResponse.data) {
          setCrmStatus(crmResponse.data);
        }

        // Fetch agents
        const agentsResponse = await api.get('/api/auth/agents');
        if (agentsResponse.data?.agents) {
          setAgents(agentsResponse.data.agents);
          
          // Fetch individual agent stats
          const statsMap: {[key: string]: {queued: number, sent: number}} = {};
          for (const agent of agentsResponse.data.agents) {
            if (agent.agentId === 'orphan') continue;
            
            try {
              // Fetch queued emails for this agent
              const queueResponse = await api.get('/api/email-queue/queue', {
                params: { agentId: agent.agentId }
              });
              const queuedEmails = Array.isArray(queueResponse.data) ? queueResponse.data : (queueResponse.data?.emails || []);
              
              // Fetch sent emails for this agent (last 7 days)
              const sentResponse = await api.get('/api/email-queue/sent', {
                params: { agentId: agent.agentId }
              });
              const agentSentEmails = Array.isArray(sentResponse.data) ? sentResponse.data : (sentResponse.data?.emails || []);
              const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const recentSent = agentSentEmails.filter((email: any) => {
                const emailDate = new Date(email.sentAt || email.timestamp);
                return emailDate >= last7Days;
              });
              
              statsMap[agent.agentId] = {
                queued: queuedEmails.length,
                sent: recentSent.length
              };
            } catch (error) {
              console.error(`Error fetching stats for agent ${agent.agentId}:`, error);
              statsMap[agent.agentId] = { queued: 0, sent: 0 };
            }
          }
          setAgentStats(statsMap);
          
          // Generate activity data based on sent emails for last 7 days
          const activity = [];
          const sentEmails = sentEmailsResponse.data || [];
          
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Count emails sent on this day
            const emailsOnDay = sentEmails.filter((email: any) => {
              const emailDate = new Date(email.sentAt || email.timestamp).toISOString().split('T')[0];
              return emailDate === dateStr;
            }).length;
            
            activity.push({
              date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              count: emailsOnDay
            });
          }
          setAgentActivity(activity);

          // Calculate percentage changes for last 7 days vs previous 7 days
          const now = new Date();
          const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

          // Fetch replied emails for change calculation
          const repliedResponse = await api.get('/api/email-queue/replied?agentId=all');
          const repliedEmails = Array.isArray(repliedResponse.data) ? repliedResponse.data : (repliedResponse.data?.emails || []);

          // Calculate stats for current and previous periods
          const calculateChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
          };

          // Current period (last 7 days)
          const currentSent = sentEmails.filter((email: any) => {
            const emailDate = new Date(email.sentAt || email.timestamp);
            return emailDate >= last7Days;
          }).length;

          const currentReplied = repliedEmails.filter((email: any) => {
            const emailDate = new Date(email.repliedAt || email.timestamp);
            return emailDate >= last7Days;
          }).length;

          const currentOpened = sentEmails.filter((email: any) => {
            const emailDate = new Date(email.sentAt || email.timestamp);
            return emailDate >= last7Days && (email.opened === true || email.analytics?.opened === true);
          }).length;

          // Previous period (7-14 days ago)
          const previousSent = sentEmails.filter((email: any) => {
            const emailDate = new Date(email.sentAt || email.timestamp);
            return emailDate >= previous7Days && emailDate < last7Days;
          }).length;

          const previousReplied = repliedEmails.filter((email: any) => {
            const emailDate = new Date(email.repliedAt || email.timestamp);
            return emailDate >= previous7Days && emailDate < last7Days;
          }).length;

          const previousOpened = sentEmails.filter((email: any) => {
            const emailDate = new Date(email.sentAt || email.timestamp);
            return emailDate >= previous7Days && emailDate < last7Days && (email.opened === true || email.analytics?.opened === true);
          }).length;

          setStatsChanges({
            queued: 0, // Queue doesn't have historical data
            sent: calculateChange(currentSent, previousSent),
            replied: calculateChange(currentReplied, previousReplied),
            opened: calculateChange(currentOpened, previousOpened)
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4FD1FF]"></div>
        </div>
      </AppLayout>
    );
  }

  // Extract first name from username or email
  const getFirstName = () => {
    if (!user) return 'there';
    
    // Try to get from username first
    if (user.username) {
      // If username contains a dot, take everything before the first dot
      if (user.username.includes('.')) {
        return user.username.split('.')[0];
      }
      // If username contains spaces, take first word
      const nameParts = user.username.split(' ');
      return nameParts[0];
    }
    
    // Fallback to email prefix if username not available
    if (user.email) {
      const emailPrefix = user.email.split('@')[0];
      // If email prefix contains a dot, take everything before the first dot
      if (emailPrefix.includes('.')) {
        return emailPrefix.split('.')[0];
      }
      return emailPrefix;
    }
    
    return 'there';
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {getFirstName()}
          </h1>
          <div className="flex items-center gap-3">
            {/* CRM Connection Badge */}
            <button
              onClick={() => router.push('/profile')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                crmStatus.connected
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-[#4FD1FF]/10 border border-[#4FD1FF]/30 text-[#4FD1FF] hover:bg-[#4FD1FF]/20'
              }`}
            >
              {crmStatus.connected ? (
                crmStatus.integration === 'hubspot' ? (
                  <svg className="w-4 h-4" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M267.4 211.6c-25.1 23.7-40.8 57.3-40.8 94.6 0 29.3 9.7 56.3 26 78L203.1 434c-4.4-1.6-9.1-2.5-14-2.5-10.8 0-20.9 4.2-28.5 11.8-7.6 7.6-11.8 17.8-11.8 28.6s4.2 20.9 11.8 28.5c7.6 7.6 17.8 11.6 28.5 11.6 10.8 0 20.9-3.9 28.6-11.6 7.6-7.6 11.8-17.8 11.8-28.5 0-4.2-.6-8.2-1.9-12.1l50-50.2c22 16.9 49.4 26.9 79.3 26.9 71.9 0 130-58.3 130-130.2 0-65.2-47.7-119.2-110.2-128.7V116c17.5-7.4 28.2-23.8 28.2-42.9 0-26.1-20.9-47.9-47-47.9S311.2 47 311.2 73.1c0 19.1 10.7 35.5 28.2 42.9v61.2c-15.2 2.1-29.6 6.7-42.7 13.6-27.6-20.9-117.5-85.7-168.9-124.8 1.2-4.4 2-9 2-13.8C129.8 23.4 106.3 0 77.4 0 48.6 0 25.2 23.4 25.2 52.2c0 28.9 23.4 52.3 52.2 52.3 9.8 0 18.9-2.9 26.8-7.6l163.2 114.7zm89.5 163.6c-38.1 0-69-30.9-69-69s30.9-69 69-69 69 30.9 69 69-30.9 69-69 69z"/>
                  </svg>
                ) : crmStatus.integration === 'salesforce' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.852 3.676 2.152.9-.472 1.923-.73 2.989-.73 3.639 0 6.59 2.951 6.59 6.59s-2.951 6.59-6.59 6.59c-.403 0-.803-.035-1.19-.104a4.878 4.878 0 01-4.134 2.284c-1.736 0-3.267-.903-4.133-2.265a4.19 4.19 0 01-2.405.762C3.455 19.388.5 16.433.5 12.998c0-2.846 1.912-5.242 4.524-5.99a4.195 4.195 0 014.982-1.593z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              <span>{crmStatus.connected ? crmStatus.integration?.toUpperCase() : 'Connect CRM'}</span>
            </button>
            
            <button
              onClick={() => {
                setNavigating(true);
                router.push('/operations');
              }}
              disabled={navigating}
              className="px-4 py-2 bg-[#4FD1FF] hover:bg-[#4FD1FF]/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {navigating ? 'Loading...' : 'Get Started'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Emails Queued */}
          <div 
            onClick={() => {
              setNavigating(true);
              router.push('/operations?tab=queued');
            }}
            className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-all cursor-pointer hover:scale-105 group disabled:opacity-50"
            style={{ opacity: navigating ? 0.5 : 1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Queued</h3>
                <p className="text-[#4FD1FF]/60 text-[10px] group-hover:text-[#4FD1FF] transition-colors">Click to view</p>
              </div>
              <div className="w-10 h-10 bg-[#4FD1FF]/10 rounded-lg flex items-center justify-center group-hover:bg-[#4FD1FF]/20 transition-colors">
                <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-white">{stats.queued.toLocaleString()}</p>
            </div>
          </div>

          {/* Emails Sent */}
          <div 
            onClick={() => {
              setNavigating(true);
              router.push('/operations?tab=sent');
            }}
            className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-all cursor-pointer hover:scale-105 group"
            style={{ opacity: navigating ? 0.5 : 1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Sent</h3>
                <p className="text-green-500/60 text-[10px] group-hover:text-green-500 transition-colors">Click to view</p>
              </div>
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-white">{stats.sent.toLocaleString()}</p>
              {statsChanges.sent !== 0 && (
                <p className={`text-xs font-medium mb-1 ${statsChanges.sent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {statsChanges.sent >= 0 ? '↑' : '↓'} {Math.abs(statsChanges.sent)}%
                </p>
              )}
            </div>
          </div>

          {/* Emails Viewed */}
          <div 
            onClick={() => {
              setNavigating(true);
              router.push('/analytics');
            }}
            className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-all cursor-pointer hover:scale-105 group"
            style={{ opacity: navigating ? 0.5 : 1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Viewed</h3>
                <p className="text-purple-500/60 text-[10px] group-hover:text-purple-500 transition-colors">Click to view</p>
              </div>
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-white">{totalOpened.toLocaleString()}</p>
              {statsChanges.opened !== 0 && (
                <p className={`text-xs font-medium mb-1 ${statsChanges.opened >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {statsChanges.opened >= 0 ? '↑' : '↓'} {Math.abs(statsChanges.opened)}%
                </p>
              )}
            </div>
          </div>

          {/* Emails Responded To */}
          <div 
            onClick={() => {
              setNavigating(true);
              router.push('/operations?tab=replied');
            }}
            className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-all cursor-pointer hover:scale-105 group"
            style={{ opacity: navigating ? 0.5 : 1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Responded</h3>
                <p className="text-yellow-500/60 text-[10px] group-hover:text-yellow-500 transition-colors">Click to view</p>
              </div>
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-white">{stats.replied.toLocaleString()}</p>
              {statsChanges.replied !== 0 && (
                <p className={`text-xs font-medium mb-1 ${statsChanges.replied >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {statsChanges.replied >= 0 ? '↑' : '↓'} {Math.abs(statsChanges.replied)}%
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Current Agent Activity */}
        <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Current Agent Activity</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-[#8FA6C1]">{agents.filter(a => a.agentId !== 'orphan').length} Active Agents</span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {agents.filter(a => a.agentId !== 'orphan').slice(0, 3).map((agent) => {
              const stats = agentStats[agent.agentId] || { queued: 0, sent: 0 };
              const total = stats.queued + stats.sent;
              const isRunning = agent.status === 'running';
              const isWorking = stats.queued > 0 || isRunning;
              
              // Get lead limit from settings
              const leadLimit = agent.settings?.targeting?.leadLimit || agent.settings?.geographicSettings?.leadLimit || 10;
              
              // Calculate progress based on queued emails vs lead limit (only when running)
              const cycleProgressPercent = isRunning && leadLimit > 0 
                ? Math.min(Math.round((stats.queued / leadLimit) * 100), 100)
                : 0;
              
              const typeMap: Record<string, string> = {
                'hunter': 'Hunter',
                'analyst': 'Analyst',
                'consultant': 'Consultant',
                'networker': 'Networker',
                'relationship-builder': 'Relationship-Builder'
              };
              const avatarFile = typeMap[agent.personality?.type || 'hunter'] || 'Hunter';
              
              return (
                <div key={agent.agentId} className="bg-[#0A1525]/40 border border-[#4FD1FF]/10 rounded p-3 hover:border-[#4FD1FF]/30 transition-all cursor-pointer" onClick={() => router.push(`/agents?agent=${agent.agentId}`)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
                        isWorking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                      }`} />
                      {(agent.personality?.avatar || agent.personality?.type) ? (
                        <img
                          src={`/avatars/${avatarFile}.png`}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full border-2 border-[#4FD1FF]/60 object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4FD1FF] to-[#2A8FB9] flex items-center justify-center text-white font-bold text-sm border-2 border-[#4FD1FF]/60 flex-shrink-0">
                          {agent.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{agent.name}</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[10px] ${
                            isWorking ? 'text-yellow-400' : 'text-[#8FA6C1]'
                          }`}>{isWorking ? (agent.currentActivity || 'Processing queue') : 'Idle'}</p>
                          {agent.settings?.emailBuilder?.useGmail === true ? (
                            <span className="relative group/gmail inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/10 text-white text-[8px] border border-white/20">
                              <svg className="w-3 h-3" viewBox="0 0 256 193" fill="none">
                                <path d="M58.182 192.05V93.768L27.507 65.158L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4"/>
                                <path d="M197.818 192.05h40.727c9.659 0 17.455-7.854 17.455-17.455V49.504l-31.274 17.278-27.506 28.61Z" fill="#34A853"/>
                                <path d="M197.818 49.504V93.768l58.182-44.264V34.91c0-21.585-24.641-33.89-41.89-20.945Z" fill="#FBBC04"/>
                                <path d="M58.182 93.768V49.504L128 105.23l69.818-55.726v44.264L128 149.494Z" fill="#EA4335"/>
                                <path d="M0 34.91v14.594l58.182 44.264V49.504L40.727 37.072C23.478 24.019-.001 36.324 0 34.91Z" fill="#C5221F"/>
                              </svg>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/gmail:opacity-100 transition-opacity pointer-events-none z-50">
                                Gmail enabled
                              </span>
                            </span>
                          ) : (
                            <span className="relative group/domain inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[8px] border border-purple-500/40">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                              </svg>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/domain:opacity-100 transition-opacity pointer-events-none z-50">
                                Meridian enabled
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#8FA6C1]">In queue</span>
                      <span className="text-[#4FD1FF] font-medium">{stats.queued}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#8FA6C1]">Sent (7d)</span>
                      <span className="text-green-400 font-medium">{stats.sent}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#8FA6C1]">Total</span>
                      <span className="text-white font-medium">{total}</span>
                    </div>
                  </div>
                  {isRunning && (
                    <div className="mt-2 pt-2 border-t border-[#4FD1FF]/10">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 bg-[#0A1525]/60 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-[#4FD1FF] to-green-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${cycleProgressPercent}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] text-[#8FA6C1]">{stats.queued}/{leadLimit}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {agents.filter(a => a.agentId !== 'orphan').length === 0 && (
              <div className="col-span-3 text-center py-6">
                <p className="text-[#8FA6C1] text-sm">No active research sessions</p>
              </div>
            )}
          </div>
        </div>

        {/* Follow-ups and Cycles Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Follow-ups */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg overflow-hidden flex flex-col h-[calc(100vh-28rem)]">
            <div className="p-4 border-b border-[#4FD1FF]/20 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Upcoming Follow-ups</h2>
            </div>
            
            {upcomingFollowUps.length === 0 ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-[#4FD1FF]/20 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[#8FA6C1] text-sm">No follow-ups scheduled</p>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto bg-[#0A1525]/40 rounded p-2 flex-1">
                {upcomingFollowUps.map((followUp) => {
                  const followUpDate = new Date(followUp.followUpDate);
                  const now = new Date();
                  const daysUntil = Math.ceil((followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysUntil < 0;
                  const isToday = daysUntil === 0;
                  
                  return (
                    <div 
                      key={followUp.id} 
                      className="bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all overflow-hidden"
                    >
                      <div
                        className="p-2.5 cursor-pointer hover:bg-white/5"
                        onClick={() => router.push('/outreach')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                isOverdue ? 'bg-red-500/80 text-white' : 
                                isToday ? 'bg-yellow-500/80 text-white' : 
                                'bg-[#4FD1FF]/80 text-white'
                              }`}>
                                {isOverdue ? 'OVERDUE' : isToday ? 'TODAY' : `${daysUntil}d`}
                              </span>
                              <div className="text-white text-[11px] font-medium truncate flex-1">
                                {followUp.subject || 'No Subject'}
                              </div>
                            </div>
                            <div className="text-[#8FA6C1] text-[11px] truncate mb-1">
                              To: {followUp.lead?.name || followUp.to || 'Unknown'}
                              {followUp.lead?.company && ` • ${followUp.lead.company}`}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#8FA6C1]/70">
                              <span>
                                Follow-up: {followUpDate.toLocaleDateString()} {followUpDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cycles Completed Graph */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-4">
            <h2 className="text-xl font-bold text-white mb-4">Total Cycles Across All Agents</h2>
            <div className="relative flex gap-2 h-80">
              <div className="flex flex-col justify-between text-[#8FA6C1] text-[10px] pr-1 w-8 flex-shrink-0">
                {(() => {
                  const maxCount = Math.max(...agentActivity.map(d => d.count), 1);
                  const steps = 5;
                  const yLabels = [];
                  for (let i = 0; i < steps; i++) {
                    const val = Math.round(maxCount * (steps - 1 - i) * 0.25);
                    yLabels.push(<div key={i} className="text-right">{val}</div>);
                  }
                  return yLabels;
                })()}
              </div>
              <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#4FD1FF', stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#EC4899', stopOpacity: 1 }} />
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#4FD1FF', stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: '#4FD1FF', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                
                {/* Area under the line */}
                {agentActivity.length > 0 && (() => {
                  const maxCount = Math.max(...agentActivity.map(d => d.count), 1);
                  const points = agentActivity.map((day, i) => {
                    const xPos = i * 400;
                    const xDiv = agentActivity.length - 1;
                    const x = xPos / xDiv;
                    const yCalc = day.count * 120;
                    const y = 200 - (yCalc / maxCount);
                    return { x, y, count: day.count };
                  });
                  
                  const lineParts: string[] = [];
                  const areaParts: string[] = ['M 0,200'];
                  
                  points.forEach((p, i) => {
                    if (i === 0) {
                      lineParts.push('M ' + p.x + ',' + p.y);
                      areaParts.push('L ' + p.x + ',' + p.y);
                    } else {
                      const prev = points[i - 1];
                      const controlX = (prev.x + p.x) * 0.5;
                      const controlY = (prev.y + p.y) * 0.5;
                      lineParts.push('Q ' + controlX + ',' + controlY + ' ' + p.x + ',' + p.y);
                      areaParts.push('Q ' + controlX + ',' + controlY + ' ' + p.x + ',' + p.y);
                    }
                  });
                  
                  const linePath = lineParts.join(' ');
                  areaParts.push('L 400,200 Z');
                  const areaPath = areaParts.join(' ');
                  
                  return (
                    <>
                      <path d={areaPath} fill="url(#areaGradient)" />
                      <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="2" fill="#4FD1FF" className="cursor-pointer" />
                          <title>{p.count} cycles</title>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
            <div className="flex justify-between mt-2">
              {agentActivity.map((day, index) => {
                const dayNum = day.date.split(' ')[1];
                return (
                  <span key={index} className="text-[#8FA6C1] text-[9px]">{dayNum}</span>
                );
              })}
            </div>
            <p className="text-[#8FA6C1] text-xs text-center mt-2">Last 7 days</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
