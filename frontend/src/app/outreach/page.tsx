'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';

export default function OutreachPage() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [emailActivity, setEmailActivity] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'opened' | 'sent' | 'bounced'>('all');
  const [outreachSearch, setOutreachSearch] = useState('');
  const [outreachPage, setOutreachPage] = useState(0);
  const [selectedEmailForView, setSelectedEmailForView] = useState<any | null>(null);
  const OUTREACH_PAGE_SIZE = 20;
  
  const [stats, setStats] = useState({
    emailsSent: 0
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
        setEmailActivity(sortedEmails.slice(0, 100));
        setStats({ emailsSent: sortedEmails.length });
      }
    } catch (err) {
      console.error('Error fetching email activity:', err);
    }
  };

  useEffect(() => {
    fetchEmailActivity();
    const interval = setInterval(fetchEmailActivity, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <div className="max-w-full">
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-white">Outreach</h1>
          </div>
          
          {/* Outreach Feed */}
          <div className="bg-[#223B61]/95 rounded-lg p-3 shadow-2xl w-full h-[calc(100vh-120px)]">
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
              <span className="text-[11px] text-[#8FA6C1]">{emailActivity.length} emails</span>
            </div>
            
            {/* Search Input */}
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
            
            <div className="space-y-1.5 h-[calc(100%-110px)] overflow-y-auto bg-[#0A1525]/40 rounded p-2">
              {emailActivity.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-[#4FD1FF]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-[#8FA6C1] text-lg">No email activity yet</p>
                  <p className="text-[#8FA6C1]/60 text-sm mt-2">Sent emails will appear here</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const filtered = emailActivity
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
                        {paginated.map((email, idx) => {
                          const hasOpened = email.analyticsStatus?.opened;
                          const hasProxy = email.analyticsStatus?.hasProxy;
                          const hasClicked = email.analyticsStatus?.clicked;
                          const hasReplied = email.analyticsStatus?.replied;
                          const isBounced = email.status === 'bounced';
                          const openCount = email.analyticsStatus?.openCount || 0;
                          const timeAgo = new Date(email.sentAt || email.timestamp).toLocaleString();
                          
                          return (
                            <div 
                              key={email.trackingId || email.id || idx} 
                              className="bg-[#0A1525]/60 rounded p-2 border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all cursor-pointer"
                              onClick={() => setSelectedEmailForView(email)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    hasReplied ? 'bg-purple-400' : hasClicked ? 'bg-yellow-400' : hasOpened ? 'bg-green-400' : isBounced ? 'bg-red-400' : 'bg-blue-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white text-xs font-medium truncate">
                                      {email.to || email.recipient || 'Unknown'}
                                    </div>
                                    <div className="text-[#8FA6C1] text-[10px] truncate">
                                      {email.subject || 'No subject'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-[#8FA6C1]/60">{timeAgo}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!isBounced && (
                                    <>
                                      {hasProxy ? (
                                        <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 text-green-400 text-[10px] font-medium rounded">
                                          PRI
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 bg-gray-500/20 border border-gray-500/40 text-gray-400 text-[10px] font-medium rounded">
                                          PRO
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
    </AppLayout>
  );
}
