'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';

export default function OutreachPage() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState<'sent' | 'followups' | 'templates'>('sent');
  const [emailActivity, setEmailActivity] = useState<any[]>([]);
  const [followUpEmails, setFollowUpEmails] = useState<any[]>([]);
  const [followUpTemplates, setFollowUpTemplates] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [agentSettings, setAgentSettings] = useState<any>({});
  const [showSaved, setShowSaved] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'opened' | 'sent' | 'bounced'>('all');
  const [outreachSearch, setOutreachSearch] = useState('');
  const [outreachPage, setOutreachPage] = useState(0);
  const [selectedEmailForView, setSelectedEmailForView] = useState<any | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [showMassEditModal, setShowMassEditModal] = useState(false);
  const [massEditDate, setMassEditDate] = useState('');
  const OUTREACH_PAGE_SIZE = 20;
  
  const [stats, setStats] = useState({
    emailsSent: 0,
    followUpsSent: 0
  });

  // Fetch email activity from analytics API
  const fetchEmailActivity = async () => {
    try {
      const response = await api.get('/api/analytics/emails');
      if (response.data.success) {
        const emails = response.data.data || [];
        const sortedEmails = emails.sort((a: any, b: any) => 
          new Date(b.sentAt || b.timestamp).getTime() - new Date(a.sentAt || a.timestamp).getTime()
        );
        
        // Separate regular emails from follow-ups
        const regularEmails = sortedEmails.filter((e: any) => !e.isRebump);
        const followUps = sortedEmails.filter((e: any) => e.isRebump);
        
        setEmailActivity(regularEmails.slice(0, 100));
        setFollowUpEmails(followUps.slice(0, 100));
        setStats({ 
          emailsSent: regularEmails.length,
          followUpsSent: followUps.length
        });
      }
    } catch (err) {
      console.error('Error fetching email activity:', err);
    }
  };

  // Fetch follow-up templates from all agents
  const fetchFollowUpTemplates = async () => {
    try {
      const response = await api.get('/api/auth/agents');
      if (response.data) {
        const agentsList = response.data.agents || [];
        setAgents(agentsList);
        
        // Set first agent as selected by default
        if (agentsList.length > 0 && !selectedAgent) {
          setSelectedAgent(agentsList[0]);
        }
        
        const allTemplates: any[] = [];
        
        for (const agent of agentsList) {
          if (agent.settings?.followUpTemplates?.templates) {
            const templates = agent.settings.followUpTemplates.templates;
            templates.forEach((template: any) => {
              allTemplates.push({
                ...template,
                agentName: agent.name,
                agentId: agent.agentId,
                agentAvatar: agent.avatar,
                agentPersonality: agent.personality,
                agentSettings: agent.settings,
                generatedAt: agent.settings.followUpTemplates.generatedAt
              });
            });
          }
        }
        
        setFollowUpTemplates(allTemplates);
      }
    } catch (err) {
      console.error('Error fetching follow-up templates:', err);
    }
  };

  // Update agent settings
  const updateAgentSettings = async (agentId: string, settings: any) => {
    try {
      await api.put(`/api/auth/agents/${agentId}/settings`, settings);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
      await fetchFollowUpTemplates(); // Refresh data
    } catch (err) {
      console.error('Error updating agent settings:', err);
    }
  };

  // Schedule mass follow-up
  const scheduleMassFollowUp = async (template: any) => {
    try {
      if (!selectedAgent) return;
      
      const intervalDays = selectedAgent.settings?.emailBuilder?.rebumpIntervalDays || 7;
      const maxRebumps = selectedAgent.settings?.emailBuilder?.maxRebumps || 1;
      
      // Get eligible emails for this agent
      const eligibleEmails = emailActivity.filter(email => 
        email.agentId === selectedAgent.agentId &&
        email.status === 'SENT' &&
        !email.isRebump &&
        (email.rebumpCount || 0) < maxRebumps &&
        email.sentAt
      );

      if (eligibleEmails.length === 0) {
        alert('No eligible emails for follow-up');
        return;
      }

      // Queue follow-ups for all eligible emails
      await api.post('/api/email-queue/schedule-mass-followup', {
        agentId: selectedAgent.agentId,
        template: template,
        eligibleEmails: eligibleEmails.map(e => e.emailId)
      });

      alert(`Scheduled ${eligibleEmails.length} follow-up emails!`);
      setShowScheduleModal(false);
      setSelectedTemplate(null);
      await fetchEmailActivity();
      await fetchFollowUpTemplates();
    } catch (err) {
      console.error('Error scheduling mass follow-up:', err);
      alert('Failed to schedule follow-ups');
    }
  };

  useEffect(() => {
    fetchEmailActivity();
    fetchFollowUpTemplates();
    const interval = setInterval(() => {
      fetchEmailActivity();
      fetchFollowUpTemplates();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-48px)]">
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-white">Outreach</h1>
          </div>

          {/* Tab System */}
          <div className="flex items-center gap-2 mb-4 border-b border-[#4FD1FF]/20 pb-2">
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'sent'
                  ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
                  : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
              }`}
            >
              Sent Emails ({stats.emailsSent})
            </button>
            <button
              onClick={() => setActiveTab('followups')}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'followups'
                  ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
                  : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
              }`}
            >
              Follow-ups ({stats.followUpsSent})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
                  : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
              }`}
            >
              Templates ({followUpTemplates.length})
            </button>
          </div>

          {/* Stats Cards - Emails Sent & Responses */}
          {activeTab !== 'templates' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Emails Sent */}
            <div className="p-4 rounded-lg border-2 border-[#4FD1FF]/40 bg-[#1B2F52]/50">
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 flex-shrink-0 rounded-full bg-[#243D63]">
                  <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50%" cy="50%" r="24" fill="none" stroke="rgba(79, 209, 255, 0.2)" strokeWidth="3" />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="24"
                      fill="none"
                      stroke={
                        (() => {
                          let level = 0;
                          let count = stats.emailsSent;
                          let milestone = 25;
                          while (count >= milestone) {
                            count -= milestone;
                            level++;
                            milestone = 25 + (level * 10);
                          }
                          const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
                          return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
                        })()
                      }
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={
                        (() => {
                          let level = 0;
                          let count = stats.emailsSent;
                          let milestone = 25;
                          while (count >= milestone) {
                            count -= milestone;
                            level++;
                            milestone = 25 + (level * 10);
                          }
                          const currentMilestone = 25 + (level * 10);
                          const progress = count / currentMilestone;
                          return 2 * Math.PI * 24 * (1 - progress);
                        })()
                      }
                      style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-lg font-bold">{stats.emailsSent}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-white text-sm font-semibold mb-0.5">Emails Sent</div>
                  <div className="text-[#8FA6C1] text-xs">
                    Milestone: {(() => {
                      let level = 0;
                      let count = stats.emailsSent;
                      let milestone = 25;
                      while (count >= milestone) {
                        count -= milestone;
                        level++;
                        milestone = 25 + (level * 10);
                      }
                      const currentMilestone = 25 + (level * 10);
                      return `${count}/${currentMilestone}`;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Responses */}
            <div className="p-4 rounded-lg border-2 border-[#4FD1FF]/40 bg-[#1B2F52]/50">
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50%" cy="50%" r="24" fill="none" stroke="rgba(79, 209, 255, 0.2)" strokeWidth="3" />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="24"
                      fill="none"
                      stroke={
                        (() => {
                          let level = 0;
                          let count = emailActivity.filter(e => e.analyticsStatus?.replied).length;
                          let milestone = 5;
                          while (count >= milestone) {
                            count -= milestone;
                            level++;
                            milestone = 5 + (level * 5);
                          }
                          const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
                          return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
                        })()
                      }
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={
                        (() => {
                          let level = 0;
                          let count = emailActivity.filter(e => e.analyticsStatus?.replied).length;
                          let milestone = 5;
                          while (count >= milestone) {
                            count -= milestone;
                            level++;
                            milestone = 5 + (level * 5);
                          }
                          const currentMilestone = 5 + (level * 5);
                          const progress = count / currentMilestone;
                          return 2 * Math.PI * 24 * (1 - progress);
                        })()
                      }
                      style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-lg font-bold">{emailActivity.filter(e => e.analyticsStatus?.replied).length}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-white text-sm font-semibold mb-0.5">Responses</div>
                  <div className="text-[#8FA6C1] text-xs">
                    Milestone: {(() => {
                      let level = 0;
                      let count = emailActivity.filter(e => e.analyticsStatus?.replied).length;
                      let milestone = 5;
                      while (count >= milestone) {
                        count -= milestone;
                        level++;
                        milestone = 5 + (level * 5);
                      }
                      const currentMilestone = 5 + (level * 5);
                      return `${count}/${currentMilestone}`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
          
          {/* Outreach Feed */}
          <div className="rounded-lg p-3 w-full flex-1 flex flex-col min-h-0">
            {activeTab !== 'templates' && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Stats - Opens, Responses, Bounced */}
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-[10px] text-[#8FA6C1] uppercase tracking-wide">Opens</div>
                    <div className="text-sm font-bold text-white">{emailActivity.filter(e => e.analyticsStatus?.opened).length}</div>
                    <div className="text-[10px] text-[#4FD1FF]">
                      {stats.emailsSent > 0 ? `${Math.round((emailActivity.filter(e => e.analyticsStatus?.opened).length / stats.emailsSent) * 100)}%` : '0%'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-[#8FA6C1] uppercase tracking-wide">Replies</div>
                    <div className="text-sm font-bold text-white">{emailActivity.filter(e => e.analyticsStatus?.replied).length}</div>
                    <div className="text-[10px] text-[#4FD1FF]">
                      {stats.emailsSent > 0 ? `${Math.round((emailActivity.filter(e => e.analyticsStatus?.replied).length / stats.emailsSent) * 100)}%` : '0%'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-[#8FA6C1] uppercase tracking-wide">Bounced</div>
                    <div className="text-sm font-bold text-white">{emailActivity.filter(e => e.status === 'bounced').length}</div>
                    <div className="text-[10px] text-red-400">
                      {stats.emailsSent > 0 ? `${Math.round((emailActivity.filter(e => e.status === 'bounced').length / stats.emailsSent) * 100)}%` : '0%'}
                    </div>
                  </div>
                </div>
                
                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 ml-4 border-l border-white/10 pl-4">
                <button 
                  onClick={() => setActivityFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded transition-all border font-medium ${
                    activityFilter === 'all' 
                      ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                      : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                  }`}
                >
                  All
                </button>
                <button 
                  onClick={() => setActivityFilter('sent')}
                  className={`text-xs px-2.5 py-1 rounded transition-all border font-medium ${
                    activityFilter === 'sent' 
                      ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                      : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                  }`}
                >
                  Sent
                </button>
                <button 
                  onClick={() => setActivityFilter('opened')}
                  className={`text-xs px-2.5 py-1 rounded transition-all border font-medium ${
                    activityFilter === 'opened' 
                      ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                      : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                  }`}
                >
                  Opened
                </button>
                <button 
                  onClick={() => setActivityFilter('bounced')}
                  className={`text-xs px-2.5 py-1 rounded transition-all border font-medium ${
                    activityFilter === 'bounced' 
                      ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                      : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                  }`}
                >
                  Bounced
                </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!selectionMode ? (
                  // Not in selection mode - show Select button
                  <>
                    <button
                      onClick={() => setSelectionMode(true)}
                      className="px-3 py-1 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded text-[11px] font-medium transition-colors border border-[#4FD1FF]/30"
                    >
                      Select
                    </button>
                    <span className="text-[11px] text-[#8FA6C1]">
                      {activeTab === 'sent' && `${emailActivity.length} emails`}
                      {activeTab === 'followups' && `${followUpEmails.length} follow-ups`}
                    </span>
                  </>
                ) : (
                  // In selection mode - show selected count and actions
                  <>
                    <button
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedEmails(new Set());
                      }}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[#8FA6C1] rounded text-[11px] font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    {selectedEmails.size > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-[#4FD1FF]/10 rounded border border-[#4FD1FF]/30">
                        <span className="text-[#4FD1FF] text-[11px] font-medium">{selectedEmails.size} selected</span>
                        <button
                          onClick={() => {
                            setMassEditDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
                            setShowMassEditModal(true);
                          }}
                          className="px-2 py-0.5 bg-[#4FD1FF]/20 hover:bg-[#4FD1FF]/30 text-[#4FD1FF] rounded text-[10px] font-medium transition-colors"
                        >
                          Reschedule All
                        </button>
                        <button
                          onClick={() => setSelectedEmails(new Set())}
                          className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] rounded transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            )}
            
            {/* Search Input */}
            {activeTab !== 'templates' && (
            <div className="mb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={outreachSearch}
                  onChange={(e) => setOutreachSearch(e.target.value)}
                  className="w-full px-2 py-1.5 pl-8 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-xs placeholder-[#8FA6C1] focus:outline-none focus:border-[#4FD1FF]/40 transition-colors"
                />
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8FA6C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            )}
            
            {/* Sent Emails & Follow-ups List */}
            {activeTab !== 'templates' && (
            <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto bg-[#0A1525]/40 rounded p-2">
              {(activeTab === 'sent' ? emailActivity : followUpEmails).length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-[#4FD1FF]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-[#8FA6C1] text-lg">No {activeTab === 'sent' ? 'email' : 'follow-up'} activity yet</p>
                  <p className="text-[#8FA6C1]/60 text-sm mt-2">{activeTab === 'sent' ? 'Sent emails' : 'Follow-up emails'} will appear here</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const sourceData = activeTab === 'sent' ? emailActivity : followUpEmails;
                    const filtered = sourceData
                      .filter(email => {
                        if (activityFilter === 'all') return true;
                        if (activityFilter === 'opened') return email.analyticsStatus?.opened;
                        if (activityFilter === 'sent') return !email.analyticsStatus?.opened;
                        if (activityFilter === 'bounced') return email.status === 'bounced';
                        return true;
                      })
                      .filter(email => {
                        if (!outreachSearch) return true;
                        const searchLower = outreachSearch.toLowerCase();
                        const recipient = (email.to || email.recipient || '').toLowerCase();
                        const subject = (email.subject || '').toLowerCase();
                        return recipient.includes(searchLower) || subject.includes(searchLower);
                      });
                    
                    const hasSearch = !!outreachSearch;
                    const paginated = hasSearch ? filtered : filtered.slice(outreachPage * OUTREACH_PAGE_SIZE, (outreachPage + 1) * OUTREACH_PAGE_SIZE);
                    const totalPages = hasSearch ? 1 : Math.ceil(filtered.length / OUTREACH_PAGE_SIZE);
                    
                    return (
                      <>
                        {selectionMode && (
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => {
                                const currentPageIds = new Set(paginated.map(e => e.trackingId || e.id).filter(Boolean));
                                if (paginated.every(e => selectedEmails.has(e.trackingId || e.id))) {
                                  // Deselect all on page
                                  setSelectedEmails(prev => {
                                    const newSet = new Set(prev);
                                    currentPageIds.forEach(id => newSet.delete(id));
                                    return newSet;
                                  });
                                } else {
                                  // Select all on page
                                  setSelectedEmails(prev => new Set([...prev, ...currentPageIds]));
                                }
                              }}
                              className="px-3 py-1 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded text-[10px] font-medium transition-colors border border-[#4FD1FF]/30"
                            >
                              {paginated.every(e => selectedEmails.has(e.trackingId || e.id)) ? 'Deselect Page' : 'Select Page'}
                            </button>
                          </div>
                        )}
                        {paginated.map((email, idx) => {
                          const emailId = email.trackingId || email.id;
                          const hasOpened = email.analyticsStatus?.opened;
                          const hasProxy = email.analyticsStatus?.hasProxy;
                          const hasClicked = email.analyticsStatus?.clicked;
                          const hasReplied = email.analyticsStatus?.replied;
                          const isBounced = email.status === 'bounced';
                          const openCount = email.analyticsStatus?.openCount || 0;
                          const timeAgo = new Date(email.sentAt || email.timestamp).toLocaleString();
                          
                          return (
                            <div 
                              key={emailId || idx} 
                              className="bg-[#0A1525]/60 rounded p-2 border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all cursor-pointer"
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('button')) return;
                                setSelectedEmailForView(email);
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {selectionMode && (
                                    <input
                                      type="checkbox"
                                      checked={selectedEmails.has(emailId)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setSelectedEmails(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(emailId)) {
                                            newSet.delete(emailId);
                                          } else {
                                            newSet.add(emailId);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="w-4 h-4 rounded-full border-2 border-[#4FD1FF]/60 bg-[#0A1525]/60 text-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF] focus:ring-offset-0 cursor-pointer"
                                    />
                                  )}
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    hasReplied ? 'bg-purple-400' : hasClicked ? 'bg-yellow-400' : hasOpened ? 'bg-green-400' : isBounced ? 'bg-red-400' : 'bg-blue-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium truncate" style={{fontSize: '13px'}}>
                                      {email.to || email.recipient || 'Unknown'}
                                    </div>
                                    <div className="text-[#8FA6C1] truncate" style={{fontSize: '11px'}}>
                                      {email.subject || 'No subject'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-[#8FA6C1]/60">{timeAgo}</span>
                                      {email.isRebump && (
                                        <span className="text-[10px] text-[#4FD1FF] px-1.5 py-0.5 bg-[#4FD1FF]/10 rounded border border-[#4FD1FF]/30">
                                          Follow-up #{email.rebumpNumber || 1}
                                        </span>
                                      )}
                                      {!email.isRebump && email.followUpScheduled && email.followUpDate && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingFollowUp(email);
                                            setEditFollowUpDate(new Date(email.followUpDate).toISOString().slice(0, 16));
                                          }}
                                          className="text-[10px] px-2 py-0.5 rounded bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/30 hover:border-[#4FD1FF]/50 transition-colors font-medium"
                                          title="Click to edit follow-up date"
                                        >
                                          Follow-up: {new Date(email.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(email.followUpDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!isBounced && (
                                    <>
                                      {hasProxy ? (
                                        <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 text-green-400 text-[10px] font-medium rounded">
                                          Primary
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 bg-gray-500/20 border border-gray-500/40 text-gray-400 text-[10px] font-medium rounded">
                                          Promotional
                                        </span>
                                      )}
                                    </>
                                  )}
                                  
                                  {hasReplied && (
                                    <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-400 text-[10px] font-medium rounded">
                                      REPLIED
                                    </span>
                                  )}
                                  {hasClicked && !hasReplied && (
                                    <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[10px] font-medium rounded">
                                      CLICKED
                                    </span>
                                  )}
                                  {hasOpened && !hasClicked && !hasReplied && (
                                    <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 text-green-400 text-[10px] font-medium rounded">
                                      OPENED {openCount > 1 ? `${openCount}×` : ''}
                                    </span>
                                  )}
                                  {!hasOpened && !isBounced && (
                                    <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[10px] font-medium rounded">
                                      SENT
                                    </span>
                                  )}
                                  {isBounced && (
                                    <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-medium rounded">
                                      BOUNCED
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {!hasSearch && totalPages > 1 && (
                          <div className="flex items-center justify-between p-4 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg mt-4">
                            <button
                              onClick={() => setOutreachPage(Math.max(0, outreachPage - 1))}
                              disabled={outreachPage === 0}
                              className="flex items-center gap-2 px-4 py-2 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-[#4FD1FF] text-sm font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              Previous
                            </button>
                            
                            <span className="text-[#8FA6C1] text-sm">
                              Page {outreachPage + 1} of {totalPages} ({filtered.length} total)
                            </span>
                            
                            <button
                              onClick={() => setOutreachPage(Math.min(totalPages - 1, outreachPage + 1))}
                              disabled={outreachPage >= totalPages - 1}
                              className="flex items-center gap-2 px-4 py-2 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-[#4FD1FF] text-sm font-medium"
                            >
                              Next
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
            )}

            {/* Templates View */}
            {activeTab === 'templates' && (
              <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Left side: Agent selector + Templates */}
                <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
                  {/* Agent Selector */}
                  {agents.length > 0 && (
                    <div className="flex items-center gap-2 px-2 py-2 bg-[#0A1525]/40 rounded border border-[#4FD1FF]/20 overflow-x-auto">
                      {agents.map((agent) => (
                        <button
                          key={agent.agentId}
                          onClick={() => setSelectedAgent(agent)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
                            selectedAgent?.agentId === agent.agentId
                              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40'
                              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                            {agent.personality?.avatar ? (
                              <img 
                                src={agent.personality.avatar} 
                                alt={agent.name} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4FD1FF] to-[#0F1E35] flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                                </span>
                              </div>
                            )}
                          </div>
                          <span>{agent.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Templates List */}
                  <div className="flex-1 space-y-3 overflow-y-auto bg-[#0A1525]/40 rounded p-4">
                    {selectedAgent ? (
                      <>
                        {followUpTemplates.filter(t => t.agentId === selectedAgent.agentId).length === 0 ? (
                          <div className="text-center py-20">
                            <div className="w-16 h-16 bg-[#4FD1FF]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-[#8FA6C1] text-lg">No templates for {selectedAgent.name}</p>
                            <p className="text-[#8FA6C1]/60 text-sm mt-2">Templates will be generated automatically</p>
                          </div>
                        ) : (
                          followUpTemplates
                            .filter(t => t.agentId === selectedAgent.agentId)
                            .map((template, idx) => (
                              <div
                                key={`${template.agentId}-${idx}`}
                                className="bg-[#0A1525]/60 rounded-lg p-3 border border-[#4FD1FF]/20"
                              >
                                <div className="mb-2">
                                  <h3 className="text-white font-semibold text-sm">{template.name}</h3>
                                </div>

                                <div className="space-y-2">
                                  <div>
                                    <div className="text-[#4FD1FF] text-xs font-medium mb-1">Subject:</div>
                                    <div className="text-white text-xs bg-black/20 rounded p-2 border border-[#4FD1FF]/10">
                                      {template.subject}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-[#4FD1FF] text-xs font-medium mb-1">Body:</div>
                                    <div className="text-white text-xs bg-black/20 rounded p-2 border border-[#4FD1FF]/10 whitespace-pre-wrap line-clamp-3">
                                      {template.body}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </>
                    ) : (
                      <div className="text-center py-20">
                        <p className="text-[#8FA6C1] text-lg">Select an agent to view templates</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings Panel - Right Side */}
                {selectedAgent && (
                    <div className="w-80 flex-shrink-0 bg-[#0A1525]/40 rounded p-4 space-y-4 overflow-y-auto">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-semibold text-lg mb-1">{selectedAgent.name} Settings</h3>
                          <p className="text-[#8FA6C1] text-xs">Configure follow-up behavior</p>
                        </div>
                        {showSaved && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded-lg animate-fade-in">
                            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                              {selectedAgent.personality?.avatar ? (
                                <img 
                                  src={selectedAgent.personality.avatar} 
                                  alt={selectedAgent.name} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4FD1FF] to-[#0F1E35] flex items-center justify-center">
                                  <span className="text-white text-[10px] font-bold">{selectedAgent.name?.charAt(0)?.toUpperCase() || 'A'}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-green-400 text-xs font-medium">Saved</span>
                          </div>
                        )}
                      </div>

                      {/* Next Follow-up Countdown - MOVED TO TOP */}
                      <div className="p-3 bg-[#4FD1FF]/10 border border-[#4FD1FF]/30 rounded-lg">
                        <div className="text-[#4FD1FF] text-xs font-medium mb-1">Next Follow-up</div>
                        <div className="text-white text-sm">
                          {(() => {
                            // Find the next email that needs a follow-up for this agent
                            const now = new Date();
                            const intervalDays = selectedAgent.settings?.emailBuilder?.rebumpIntervalDays || 7;
                            const maxRebumps = selectedAgent.settings?.emailBuilder?.maxRebumps || 1;
                            
                            // Filter sent emails for this agent that need rebumps
                            const eligibleEmails = emailActivity.filter(email => 
                              email.agentId === selectedAgent.agentId &&
                              email.status === 'SENT' &&
                              !email.isRebump &&
                              (email.rebumpCount || 0) < maxRebumps &&
                              email.sentAt
                            );
                            
                            if (eligibleEmails.length === 0) {
                              return 'No follow-ups scheduled';
                            }
                            
                            // Find the oldest email that's ready for a follow-up
                            let nextFollowUp: Date | null = null;
                            
                            for (const email of eligibleEmails) {
                              const sentDate = new Date(email.sentAt);
                              const nextRebumpDate = new Date(sentDate);
                              nextRebumpDate.setDate(sentDate.getDate() + intervalDays);
                              
                              if (!nextFollowUp || nextRebumpDate < nextFollowUp) {
                                nextFollowUp = nextRebumpDate;
                              }
                            }
                            
                            if (!nextFollowUp) {
                              return 'No follow-ups scheduled';
                            }
                            
                            const timeUntil = nextFollowUp.getTime() - now.getTime();
                            const daysUntil = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
                            const hoursUntil = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            
                            if (timeUntil <= 0) {
                              return 'Due now (next check cycle)';
                            } else if (daysUntil > 0) {
                              return `${daysUntil}d ${hoursUntil}h`;
                            } else {
                              return `${hoursUntil}h`;
                            }
                          })()}
                        </div>
                        <div className="text-[#8FA6C1] text-xs mt-1">Based on {selectedAgent.settings?.emailBuilder?.rebumpIntervalDays || 7}-day interval</div>
                      </div>

                      {/* Schedule Mass Follow-up Button */}
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="w-full px-4 py-3 bg-[#4FD1FF]/20 hover:bg-[#4FD1FF]/30 border border-[#4FD1FF]/40 rounded-lg transition-colors text-white font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Schedule Mass Follow-up
                      </button>

                      {/* Enable/Disable Toggle */}
                      <div className="p-3 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white text-sm font-medium">Auto Follow-ups</div>
                            <div className="text-[#8FA6C1] text-xs mt-0.5">Enable automatic rebumps</div>
                          </div>
                          <button
                            onClick={async () => {
                              const newSettings = {
                                ...selectedAgent.settings,
                                emailBuilder: {
                                  ...selectedAgent.settings?.emailBuilder,
                                  enableRebump: !(selectedAgent.settings?.emailBuilder?.enableRebump !== false)
                                }
                              };
                              await updateAgentSettings(selectedAgent.agentId, newSettings);
                              setSelectedAgent({ ...selectedAgent, settings: newSettings });
                            }}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                            style={{
                              backgroundColor: (selectedAgent.settings?.emailBuilder?.enableRebump !== false) ? '#4ade80' : '#52525b'
                            }}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                (selectedAgent.settings?.emailBuilder?.enableRebump !== false) ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Interval Days */}
                      <div className="p-3 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg">
                        <label className="text-white text-sm font-medium block mb-2">Follow-up Interval</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={selectedAgent.settings?.emailBuilder?.rebumpIntervalDays || 7}
                            onChange={async (e) => {
                              const newSettings = {
                                ...selectedAgent.settings,
                                emailBuilder: {
                                  ...selectedAgent.settings?.emailBuilder,
                                  rebumpIntervalDays: parseInt(e.target.value) || 7
                                }
                              };
                              await updateAgentSettings(selectedAgent.agentId, newSettings);
                              setSelectedAgent({ ...selectedAgent, settings: newSettings });
                            }}
                            className="flex-1 px-3 py-2 bg-black/20 border border-[#4FD1FF]/20 rounded text-white text-sm focus:border-[#4FD1FF]/40 focus:outline-none"
                          />
                          <span className="text-[#8FA6C1] text-sm">days</span>
                        </div>
                        <div className="text-[#8FA6C1] text-xs mt-1">Days to wait before sending follow-up</div>
                      </div>

                      {/* Max Rebumps */}
                      <div className="p-3 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg">
                        <label className="text-white text-sm font-medium block mb-2">Max Follow-ups</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={selectedAgent.settings?.emailBuilder?.maxRebumps || 1}
                            onChange={async (e) => {
                              const newSettings = {
                                ...selectedAgent.settings,
                                emailBuilder: {
                                  ...selectedAgent.settings?.emailBuilder,
                                  maxRebumps: parseInt(e.target.value) || 1
                                }
                              };
                              await updateAgentSettings(selectedAgent.agentId, newSettings);
                              setSelectedAgent({ ...selectedAgent, settings: newSettings });
                            }}
                            className="flex-1 px-3 py-2 bg-black/20 border border-[#4FD1FF]/20 rounded text-white text-sm focus:border-[#4FD1FF]/40 focus:outline-none"
                          />
                          <span className="text-[#8FA6C1] text-sm">max</span>
                        </div>
                        <div className="text-[#8FA6C1] text-xs mt-1">Maximum follow-ups per lead</div>
                      </div>

                      {/* Agent-Specific Stats */}
                      <div className="p-3 bg-black/20 border border-[#4FD1FF]/20 rounded-lg">
                        <div className="text-[#8FA6C1] text-xs font-medium mb-2">Agent Statistics</div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#8FA6C1]">Templates:</span>
                            <span className="text-white font-semibold">
                              {followUpTemplates.filter(t => t.agentId === selectedAgent.agentId).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8FA6C1]">Follow-ups Sent:</span>
                            <span className="text-white font-semibold">
                              {followUpEmails.filter(e => e.agentId === selectedAgent.agentId).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8FA6C1]">Last Generated:</span>
                            <span className="text-white font-semibold">
                              {selectedAgent.settings?.followUpTemplates?.generatedAt
                                ? new Date(selectedAgent.settings.followUpTemplates.generatedAt).toLocaleDateString()
                                : 'Never'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

      {/* Email Detail Modal */}
      {selectedEmailForView && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedEmailForView(null)}>
          <div className="bg-gradient-to-br from-[#1B2F52] to-[#2A4570] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 border border-[#4FD1FF]/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Email Details</h2>
              <button
                onClick={() => setSelectedEmailForView(null)}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-white/50 mb-1">To</div>
                <div className="text-white">{selectedEmailForView.to || selectedEmailForView.recipient}</div>
              </div>
              
              <div>
                <div className="text-sm text-white/50 mb-1">Subject</div>
                <div className="text-white">{selectedEmailForView.subject || 'No subject'}</div>
              </div>
              
              <div>
                <div className="text-sm text-white/50 mb-1">Body</div>
                <div className="bg-white/5 rounded-lg p-4 text-white/90 whitespace-pre-wrap text-sm font-mono">
                  {selectedEmailForView.body || 'No content'}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-white/50 mb-1">Status</div>
                <div className="flex gap-2">
                  {selectedEmailForView.analyticsStatus?.replied && (
                    <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-400 text-sm font-medium rounded">
                      REPLIED
                    </span>
                  )}
                  {selectedEmailForView.analyticsStatus?.clicked && (
                    <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm font-medium rounded">
                      CLICKED
                    </span>
                  )}
                  {selectedEmailForView.analyticsStatus?.opened && (
                    <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-medium rounded">
                      OPENED {selectedEmailForView.analyticsStatus?.openCount > 1 ? `${selectedEmailForView.analyticsStatus.openCount}×` : ''}
                    </span>
                  )}
                  {selectedEmailForView.status === 'bounced' && (
                    <span className="px-3 py-1 bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-medium rounded">
                      BOUNCED
                    </span>
                  )}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-white/50 mb-1">Sent At</div>
                <div className="text-white">{new Date(selectedEmailForView.sentAt || selectedEmailForView.timestamp).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Mass Follow-up Modal */}
      {showScheduleModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-gradient-to-br from-[#1B2F52] to-[#2A4570] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 border border-[#4FD1FF]/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Schedule Mass Follow-up</h2>
                <p className="text-[#8FA6C1] text-sm mt-1">Select a template for {selectedAgent.name}</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {followUpTemplates.filter(t => t.agentId === selectedAgent.agentId).length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-[#4FD1FF]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-[#8FA6C1]">No templates available for this agent</p>
                </div>
              ) : (
                followUpTemplates
                  .filter(t => t.agentId === selectedAgent.agentId)
                  .map((template, idx) => (
                    <button
                      key={`${template.agentId}-${idx}`}
                      onClick={() => scheduleMassFollowUp(template)}
                      className="w-full text-left p-4 bg-[#0A1525]/60 hover:bg-[#0A1525] border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 rounded-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white font-semibold">{template.name}</h3>
                        <svg className="w-5 h-5 text-[#4FD1FF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-[#4FD1FF] font-medium">Subject: </span>
                          <span className="text-white">{template.subject}</span>
                        </div>
                        <div className="text-[#8FA6C1] line-clamp-2">{template.body}</div>
                      </div>
                    </button>
                  ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#4FD1FF]/20">
              <div className="flex items-center gap-2 text-sm text-[#8FA6C1]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>This will queue follow-ups for all eligible sent emails from this agent</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Follow-up Modal */}
      {editingFollowUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingFollowUp(null)}>
          <div className="bg-[#0F1E35] rounded-xl border border-[#4FD1FF]/30 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Edit Follow-up</h3>
              <button onClick={() => setEditingFollowUp(null)} className="text-[#8FA6C1] hover:text-white">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[#8FA6C1] text-sm mb-1 block">Follow-up Date & Time</label>
                <input
                  type="datetime-local"
                  value={editFollowUpDate}
                  onChange={(e) => setEditFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm focus:outline-none focus:border-[#4FD1FF]/40"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingFollowUp(null)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.put(`/api/email-queue/${editingFollowUp.id}/followup`, {
                        agentId: editingFollowUp.agentId,
                        followUpDate: new Date(editFollowUpDate).toISOString()
                      });
                      setEditingFollowUp(null);
                      fetchEmailActivity();
                    } catch (error) {
                      console.error('Error updating follow-up:', error);
                      alert('Failed to update follow-up');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-[#4FD1FF] hover:bg-[#3FB8E8] text-black font-medium rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mass Edit Follow-up Modal */}
      {showMassEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMassEditModal(false)}>
          <div className="bg-[#0F1E35] rounded-xl border border-[#4FD1FF]/30 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Reschedule {selectedEmails.size} Follow-ups</h3>
              <button onClick={() => setShowMassEditModal(false)} className="text-[#8FA6C1] hover:text-white">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[#8FA6C1] text-sm mb-1 block">New Follow-up Date & Time</label>
                <input
                  type="datetime-local"
                  value={massEditDate}
                  onChange={(e) => setMassEditDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm focus:outline-none focus:border-[#4FD1FF]/40"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMassEditModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const selectedEmailsList = emailActivity.filter(e => selectedEmails.has(e.trackingId || e.id));
                      await Promise.all(
                        selectedEmailsList.map(email =>
                          api.put(`/api/email-queue/${email.id}/followup`, {
                            agentId: email.agentId,
                            followUpDate: new Date(massEditDate).toISOString()
                          })
                        )
                      );
                      setShowMassEditModal(false);
                      setSelectedEmails(new Set());
                      fetchEmailActivity();
                    } catch (error) {
                      console.error('Error updating follow-ups:', error);
                      alert('Failed to update follow-ups');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-[#4FD1FF] hover:bg-[#3FB8E8] text-black font-medium rounded transition-colors"
                >
                  Reschedule All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
