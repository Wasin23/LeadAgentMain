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
  leadData?: {
    email?: string;
    name?: string;
    company?: string;
  };
  emailData?: {
    subject?: string;
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
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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
        <h1 className="text-3xl font-bold text-white mb-6">
          Welcome back, {getFirstName()}
        </h1>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Emails Queued */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Queued</h3>
              <div className="w-10 h-10 bg-[#4FD1FF]/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats.queued.toLocaleString()}</p>
          </div>

          {/* Emails Sent */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Sent</h3>
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats.sent.toLocaleString()}</p>
          </div>

          {/* Emails Viewed */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Viewed</h3>
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{totalOpened.toLocaleString()}</p>
          </div>

          {/* Emails Responded To */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6 hover:border-[#4FD1FF]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#8FA6C1] text-sm font-medium">Emails Responded</h3>
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats.replied.toLocaleString()}</p>
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
              <div className="p-8 text-center flex-1 flex items-center justify-center">
                <p className="text-[#8FA6C1]">No follow-ups scheduled</p>
              </div>
            ) : (
              <div className="overflow-hidden flex-1 min-h-0">
                <div className="divide-y divide-[#4FD1FF]/10 overflow-y-auto h-full">
                  {upcomingFollowUps.map((followUp) => {
                    const followUpDate = new Date(followUp.followUpDate);
                    const now = new Date();
                    const daysUntil = Math.ceil((followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysUntil < 0;
                    const isToday = daysUntil === 0;
                    
                    return (
                      <div 
                        key={followUp.id} 
                        className="p-4 hover:bg-[#4FD1FF]/5 transition-colors cursor-pointer"
                        onClick={() => router.push('/outreach')}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate text-sm">
                              {followUp.leadData?.name || followUp.leadData?.email || 'Unknown'}
                            </p>
                            {followUp.leadData?.company && (
                              <span className="text-[#8FA6C1] text-xs truncate block">{followUp.leadData.company}</span>
                            )}
                            <p className="text-[#8FA6C1] text-xs line-clamp-1 mt-1">
                              {followUp.emailData?.subject || 'No subject'}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-[#4FD1FF]/10">
                            <p className={`text-xs font-medium ${
                              isOverdue ? 'text-red-400' : isToday ? 'text-yellow-400' : 'text-[#4FD1FF]'
                            }`}>
                              {isOverdue ? 'Overdue' : isToday ? 'Today' : `${daysUntil}d`}
                            </p>
                            <p className="text-[#8FA6C1] text-xs">
                              {followUpDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cycles Completed Graph */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-4 flex flex-col h-[calc(100vh-28rem)]">
            <h2 className="text-xl font-bold text-white mb-4">Cycles Completed</h2>
            <div className="flex-1 relative">
              <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
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
                    const x = (i * 300) / (agentActivity.length - 1);
                    const y = 120 - ((day.count * 100) / maxCount);
                    return { x, y, count: day.count };
                  });
                  
                  const lineCommands = points.map((p, i) => {
                    const command = i === 0 ? 'M' : 'L';
                    return command + ' ' + p.x + ',' + p.y;
                  });
                  const linePath = lineCommands.join(' ');
                  
                  const areaCommands = ['M 0,120'];
                  points.forEach(p => {
                    areaCommands.push('L ' + p.x + ',' + p.y);
                  });
                  areaCommands.push('L 300,120 Z');
                  const areaPath = areaCommands.join(' ');
                  
                  return (
                    <>
                      <path d={areaPath} fill="url(#areaGradient)" />
                      <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="3" fill="#4FD1FF" className="cursor-pointer" />
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

        {/* CRM and Agents Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CRM Connection Box */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-4">
            <h2 className="text-xl font-bold text-white mb-4">CRM Connection</h2>
            {crmStatus.connected ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{crmStatus.integration || 'Unknown CRM'}</p>
                    <p className="text-[#8FA6C1] text-xs">Connected</p>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/profile')}
                  className="w-full px-3 py-1.5 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded-lg text-xs font-medium transition-colors border border-[#4FD1FF]/30"
                >
                  Manage
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[#4FD1FF]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#8FA6C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Not Connected</p>
                    <p className="text-[#8FA6C1] text-xs">Connect your CRM</p>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/profile')}
                  className="w-full px-3 py-1.5 bg-[#4FD1FF] hover:bg-[#4FD1FF]/80 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Connect CRM
                </button>
              </>
            )}
          </div>

          {/* Total Agents Box */}
          <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-white">Your Agents</h2>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#4FD1FF]/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium text-lg">{agents.length}</p>
                  <p className="text-[#8FA6C1] text-xs">Total Agents</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/agents-overview')}
                className="px-3 py-1.5 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded text-sm font-medium transition-colors"
              >
                View All
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
