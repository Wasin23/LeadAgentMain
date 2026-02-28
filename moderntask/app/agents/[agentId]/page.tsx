'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Play, Square, RefreshCw, Settings2, Clock, User, Building2,
  Eye, CheckCircle2, Mail, AlertTriangle, X, Check, Search, Pencil,
  Pause, MessageSquare, Filter, Send, BarChart2, Zap, ChevronLeft,
  ChevronRight, Trash2, Plus, RotateCcw
} from 'lucide-react';
import api from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface AgentStatus {
  isActive: boolean;
  lastRun?: string;
  currentInterval: number;
  totalEmailsSent: number;
  successRate: number;
  nextCycleIn?: string;
}

interface LogEntry {
  id?: string;
  timestamp: string;
  operation: string;
  details?: any;
  status: string;
}

interface EmailContact {
  id: string;
  trackingId?: string;
  name: string;
  company: string;
  email: string;
  dateSent: string;
  subject?: string;
  body?: string;
  opened: boolean;
  replied: boolean;
  status: 'sent' | 'opened' | 'replied' | 'bounced';
}

// ─────────────────────────────────────────────────────
// Personality colour mapping → CSS classes for moderntask theme
// ─────────────────────────────────────────────────────
const PERSONALITY_COLORS: Record<string, string> = {
  red:    'bg-red-500/10 border-red-500/20',
  blue:   'bg-blue-500/10 border-blue-500/20',
  purple: 'bg-purple-500/10 border-purple-500/20',
  green:  'bg-green-500/10 border-green-500/20',
  indigo: 'bg-indigo-500/10 border-indigo-500/20',
  pink:   'bg-pink-500/10 border-pink-500/20',
  orange: 'bg-orange-500/10 border-orange-500/20',
  teal:   'bg-teal-500/10 border-teal-500/20',
};

const PERSONALITY_TEXT: Record<string, string> = {
  red: 'text-red-500', blue: 'text-blue-500', purple: 'text-purple-500',
  green: 'text-green-500', indigo: 'text-indigo-500', pink: 'text-pink-500',
  orange: 'text-orange-500', teal: 'text-teal-500',
};

// ─────────────────────────────────────────────────────
// Helper: format countdown seconds
// ─────────────────────────────────────────────────────
function formatCountdown(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(ts?: string) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────
export default function AgentDashboardPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const router = useRouter();

  // ── core state ──
  const [agentName, setAgentName] = useState('');
  const [agentPersonality, setAgentPersonality] = useState<any>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailContact[]>([]);
  const [emailQueue, setEmailQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── countdown ──
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [showStarting, setShowStarting] = useState(false);
  const [hasShownStarting, setHasShownStarting] = useState(false);

  // ── recent contacts state ──
  const [recentEmailsSearch, setRecentEmailsSearch] = useState('');
  const [recentEmailsFilter, setRecentEmailsFilter] = useState<'all' | 'sent' | 'opened' | 'replied'>('all');
  const [recentEmailsPage, setRecentEmailsPage] = useState(1);
  const [selectedRecentEmail, setSelectedRecentEmail] = useState<any>(null);

  // ── email queue state ──
  const [showEmailQueue, setShowEmailQueue] = useState(false);
  const [emailQueueSearch, setEmailQueueSearch] = useState('');
  const [emailQueueSort, setEmailQueueSort] = useState<'newest' | 'oldest'>('newest');
  const [emailQueuePage, setEmailQueuePage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [editingEmail, setEditingEmail] = useState<any>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedRecipient, setEditedRecipient] = useState('');
  const [editedCc, setEditedCc] = useState('');
  const [editedBcc, setEditedBcc] = useState('');

  // ── interval modal ──
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [newInterval, setNewInterval] = useState(30);

  // ── outreach view ──
  const [showOutreach, setShowOutreach] = useState(false);
  const [outreachTab, setOutreachTab] = useState<'conversations' | 'analytics' | 'viewed' | 'settings'>('conversations');
  const [agentOutreachStats, setAgentOutreachStats] = useState({ viewed: 0, replied: 0, meetings: 0, conversionRate: 0 });
  const [agentConversations, setAgentConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [viewedEmails, setViewedEmails] = useState<any[]>([]);
  const [outreachSettings, setOutreachSettings] = useState<any>({ aiResponseEnabled: true, rebumpEnabled: false, systemPrompt: '' });
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationFilter, setConversationFilter] = useState<'all' | 'active' | 'replied' | 'waiting'>('all');
  const [manualReplyMessage, setManualReplyMessage] = useState('');
  const [isSendingManualReply, setIsSendingManualReply] = useState(false);
  const [aiResponseControl, setAiResponseControl] = useState<Record<string, boolean>>({});
  const [editingSystemPrompt, setEditingSystemPrompt] = useState(false);
  const [tempSystemPrompt, setTempSystemPrompt] = useState('');
  const [viewedEmailsPage, setViewedEmailsPage] = useState(1);
  const [streamingResponses, setStreamingResponses] = useState<any[]>([]);

  const ITEMS_PER_PAGE = 20;
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<EventSource | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── personality helpers ──
  const pColor = PERSONALITY_COLORS[agentPersonality?.color] ?? 'bg-primary/10 border-primary/20';
  const pText = PERSONALITY_TEXT[agentPersonality?.color] ?? 'text-primary';

  // ─────────────────────────────────────────────────────
  // Notification
  // ─────────────────────────────────────────────────────
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ─────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────
  const fetchAgentInfo = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/agents');
      if (res.data.success && res.data.agents) {
        const agent = res.data.agents.find((a: any) => a.agentId === agentId);
        if (agent) { setAgentName(agent.name); setAgentPersonality(agent.personality); return; }
      }
    } catch { /* ignore */ }
    setAgentName(agentId.replace(/^agent-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
  }, [agentId]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/api/lead-agent/status?agentId=${agentId}`);
      setStatus(res.data);
    } catch { /* ignore */ }
  }, [agentId]);

  const fetchAgentLogs = useCallback(async () => {
    try {
      const res = await api.get(`/api/lead-agent/activity-logs?agentId=${agentId}`);
      if (Array.isArray(res.data)) setAgentLogs(res.data);
    } catch { setAgentLogs([]); }
  }, [agentId]);

  const fetchRecentEmails = useCallback(async () => {
    try {
      const res = await api.get(`/api/email-queue/sent?agentId=${agentId}`);
      const emails = Array.isArray(res.data) ? res.data : [];
      const mapped: EmailContact[] = emails.map((e: any) => ({
        id: e.trackingId || e.id || String(Date.now()),
        trackingId: e.trackingId,
        name: e.leadInfo?.name || e.personInfo?.fullName || e.recipientName || e.to?.split('@')[0] || 'Unknown',
        company: e.lead?.company || e.leadInfo?.company || e.company || 'Unknown Company',
        email: e.to || e.email || '',
        dateSent: e.approvedAt || e.sentAt || e.timestamp || new Date().toISOString(),
        subject: e.subject || e.emailSubject || '',
        body: e.body || e.content || e.personalizedEmail || '',
        opened: Boolean(e.opened || e.analytics?.opened),
        replied: Boolean(e.replied || e.analytics?.replied),
        status: (e.replied || e.analytics?.replied ? 'replied' : e.opened || e.analytics?.opened ? 'opened' : 'sent') as any,
        ...e,
      }));
      setRecentEmails(mapped.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
        .sort((a, b) => new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime()));
    } catch { setRecentEmails([]); }
  }, [agentId]);

  const fetchEmailQueue = useCallback(async () => {
    try {
      const res = await api.get(`/api/email-queue/queue?agentId=${agentId}`);
      if (Array.isArray(res.data)) setEmailQueue(res.data);
      else if (Array.isArray(res.data?.data?.pending)) setEmailQueue(res.data.data.pending);
      else setEmailQueue([]);
    } catch { setEmailQueue([]); }
  }, [agentId]);

  const fetchAgentOutreach = useCallback(async () => {
    try {
      const statsRes = await api.get(`/api/outreach/stats?agentId=${agentId}&timeRange=7d`).catch(() => null);
      if (statsRes?.data?.success) {
        const s = statsRes.data.stats;
        setAgentOutreachStats({ viewed: s.totalOpened || 0, replied: s.totalReplies || 0, meetings: s.totalMeetingsBooked || 0, conversionRate: s.replyRate || 0 });
      }
      const convRes = await api.get(`/api/outreach/conversations?agentId=${agentId}&timeRange=7d`).catch(() => null);
      if (convRes?.data?.success) {
        const convs = convRes.data.conversations || [];
        setAgentConversations(convs);
        const ctrl: Record<string, boolean> = {};
        convs.forEach((c: any) => { ctrl[c.trackingId] = c.aiEnabled !== false; });
        setAiResponseControl(ctrl);
      }
    } catch { /* ignore */ }
  }, [agentId]);

  const fetchViewedEmails = useCallback(async () => {
    try {
      const res = await api.get(`/api/outreach/viewed?agentId=${agentId}&timeRange=30d`);
      if (res?.data?.viewedEmails) setViewedEmails(res.data.viewedEmails);
    } catch { setViewedEmails([]); }
  }, [agentId]);

  const fetchOutreachSettings = useCallback(async () => {
    try {
      const res = await api.get(`/api/lead-agent/settings?agentId=${agentId}`);
      if (res?.data?.settings) {
        const s = res.data.settings;
        const prompt = s.personality?.emailPrompt || '';
        setOutreachSettings({ aiResponseEnabled: s.emailBuilder?.enableAutoResponse !== false, rebumpEnabled: s.emailBuilder?.rebumpEnabled || false, systemPrompt: prompt });
        setTempSystemPrompt(prompt);
      }
    } catch { /* ignore */ }
  }, [agentId]);

  // ─────────────────────────────────────────────────────
  // SSE: activity log stream
  // ─────────────────────────────────────────────────────
  const setupProgressStream = useCallback(() => {
    try {
      const token = localStorage.getItem('authToken');
      const es = new EventSource(`${API_BASE}/api/lead-agent/progress-stream?token=${encodeURIComponent(token || '')}&agentId=${encodeURIComponent(agentId)}`);
      wsRef.current = es;
      es.onmessage = (event) => {
        try {
          const pd = JSON.parse(event.data);
          if (pd.type === 'progress' && pd.data) {
            if (pd.data.type === 'email_queue') {
              fetchEmailQueue();
              setAgentLogs(prev => [{ id: `eq-${Date.now()}`, timestamp: new Date().toISOString(), operation: 'Email Queued', details: pd.data.message, status: 'success' }, ...prev.slice(0, 49)]);
            } else {
              setAgentLogs(prev => [pd.data, ...prev.slice(0, 49)]);
            }
          }
        } catch { /* ignore */ }
      };
      es.onerror = () => { es.close(); };
    } catch { /* ignore */ }
  }, [agentId, fetchEmailQueue]);

  // ─────────────────────────────────────────────────────
  // SSE: outreach stream
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!showOutreach) return;
    const token = localStorage.getItem('authToken');
    let es: EventSource | null = null;
    let hasConnected = false;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        es = new EventSource(`${API_BASE}/api/outreach/stream?token=${encodeURIComponent(token || '')}&agentId=${encodeURIComponent(agentId)}`);
        eventSourceRef.current = es;
        es.onopen = () => { hasConnected = true; };
        es.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d.type === 'response_start') {
              setStreamingResponses(prev => [...prev, { id: d.conversationId, leadName: d.leadName, leadEmail: d.leadEmail, content: '', status: 'generating', timestamp: new Date().toISOString() }]);
            } else if (d.type === 'response_chunk') {
              setStreamingResponses(prev => prev.map(r => r.id === d.conversationId ? { ...r, content: r.content + d.chunk } : r));
            } else if (d.type === 'response_complete') {
              setStreamingResponses(prev => prev.map(r => r.id === d.conversationId ? { ...r, status: 'sent', sentAt: new Date().toISOString() } : r));
              setTimeout(() => fetchAgentOutreach(), 500);
            } else if (d.type === 'tracking_update' && ['reply', 'ai_response', 'manual'].includes(d.eventType)) {
              fetchAgentOutreach();
              if (d.eventType === 'reply') {
                setStreamingResponses(prev => [{ id: `reply-${Date.now()}`, leadName: d.leadName || 'Unknown Lead', leadEmail: d.recipientEmail || '', content: `💬 Lead replied: "${d.messagePreview || d.subject || 'New message'}"`, status: 'replied', sentAt: new Date().toISOString(), type: 'tracking' }, ...prev].slice(0, 20));
              }
            }
          } catch { /* ignore */ }
        };
        es.onerror = () => {
          es?.close();
          eventSourceRef.current = null;
          if (hasConnected) reconnect = setTimeout(() => connect(), 5000);
        };
      } catch { /* ignore */ }
    };

    connect();
    return () => {
      if (reconnect) clearTimeout(reconnect);
      es?.close();
      eventSourceRef.current = null;
    };
  }, [showOutreach, agentId, fetchAgentOutreach]);

  useEffect(() => { if (showOutreach && outreachTab === 'viewed') fetchViewedEmails(); }, [showOutreach, outreachTab, fetchViewedEmails]);
  useEffect(() => { if (showOutreach && outreachTab === 'settings') fetchOutreachSettings(); }, [showOutreach, outreachTab, fetchOutreachSettings]);

  // ─────────────────────────────────────────────────────
  // Countdown timer
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!status?.isActive || !status?.nextCycleIn) { setCountdownTime(null); return; }
    const next = new Date(status.nextCycleIn);
    const timer = setInterval(() => {
      const remaining = Math.max(0, next.getTime() - Date.now());
      const seconds = Math.floor(remaining / 1000);
      setCountdownTime(seconds);
      if (seconds === 0 && !hasShownStarting) {
        setShowStarting(true);
        setHasShownStarting(true);
        setTimeout(() => setShowStarting(false), 1500);
      }
    }, 1000);
    setCountdownTime(Math.floor((next.getTime() - Date.now()) / 1000));
    return () => clearInterval(timer);
  }, [status?.isActive, status?.nextCycleIn, hasShownStarting]);

  // ─────────────────────────────────────────────────────
  // Initialise
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchAgentInfo(), fetchStatus(), fetchRecentEmails(), fetchEmailQueue(), fetchAgentLogs(), fetchAgentOutreach()]);
      setIsLoading(false);
    };
    init();
    setupProgressStream();
    const poll = setInterval(fetchStatus, 10000);
    return () => { clearInterval(poll); wsRef.current?.close(); };
  }, [agentId]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [agentLogs]);

  // ─────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────
  const toggleAgent = async () => {
    try {
      if (status?.isActive) {
        await api.post('/api/lead-agent/stop', { agentId });
        showNotification('Agent stopped', 'success');
      } else {
        await api.post('/api/lead-agent/start', { agentId });
        showNotification('Agent started', 'success');
      }
      setTimeout(fetchStatus, 1000);
    } catch { showNotification('Failed to toggle agent', 'error'); }
  };

  const resetAgent = async () => {
    try {
      await api.post('/api/lead-agent/reset', { agentId });
      setAgentLogs([]);
      await fetchStatus();
      showNotification('Agent reset', 'success');
    } catch { showNotification('Failed to reset agent', 'error'); }
  };

  const runCycle = async () => {
    try {
      await api.post('/api/lead-agent/run-cycle', { agentId });
      showNotification('Manual cycle started', 'success');
    } catch { showNotification('Failed to run cycle', 'error'); }
  };

  const handleIntervalChange = async () => {
    try {
      await api.post('/api/lead-agent/set-interval', { minutes: newInterval, agentId });
      if (status?.isActive) {
        await api.post('/api/lead-agent/stop', { agentId });
        await new Promise(r => setTimeout(r, 1000));
        await api.post('/api/lead-agent/start', { agentId });
      }
      setShowIntervalModal(false);
      await fetchStatus();
      showNotification(`Interval set to ${newInterval} minutes`, 'success');
    } catch { showNotification('Failed to update interval', 'error'); }
  };

  const approveEmail = async (emailId: string) => {
    try {
      await api.post(`/api/email-queue/${emailId}/approve`, { agentId });
      showNotification('Email sent successfully!', 'success');
      await fetchEmailQueue();
      setTimeout(() => { fetchRecentEmails(); fetchStatus(); }, 1000);
      setSelectedEmail(null); setEditingEmail(null);
    } catch (err: any) { showNotification(`Failed: ${err.response?.data?.error || err.message}`, 'error'); }
  };

  const rejectEmail = async (emailId: string) => {
    try {
      await api.post(`/api/email-queue/${emailId}/reject`, { agentId });
      showNotification('Email rejected', 'success');
      await fetchEmailQueue();
      setSelectedEmail(null); setEditingEmail(null);
    } catch (err: any) { showNotification(`Failed: ${err.response?.data?.error || err.message}`, 'error'); }
  };

  const saveEmailEdits = async () => {
    if (!editingEmail) return;
    try {
      const updates = { subject: editedSubject, personalizedEmail: editedContent, body: editedContent, to: editedRecipient, cc: editedCc, bcc: editedBcc, finalRecipient: editedRecipient, finalSubject: editedSubject, finalBody: editedContent };
      await api.put(`/api/email-queue/${editingEmail.id}?agentId=${agentId}`, updates);
      setEmailQueue(prev => prev.map(e => e.id === editingEmail.id ? { ...e, ...updates } : e));
      showNotification('Email updated', 'success');
    } catch { showNotification('Failed to save edits', 'error'); }
  };

  const startEditingEmail = (email: any) => {
    setEditingEmail(email);
    setEditedSubject(email.emailData?.subject || email.subject || email.finalSubject || '');
    setEditedContent(email.emailData?.body || email.personalizedEmail || email.body || email.finalBody || '');
    setEditedRecipient(email.leadData?.email || email.to || email.finalRecipient || '');
    setEditedCc(email.cc || email.emailData?.cc || '');
    setEditedBcc(email.bcc || email.emailData?.bcc || '');
  };

  const toggleAIResponse = async (trackingId: string, enabled: boolean) => {
    setAiResponseControl(prev => ({ ...prev, [trackingId]: !enabled }));
    try {
      await api.post('/api/outreach/control-ai', { trackingId, enabled: !enabled, agentId });
      await fetchAgentOutreach();
    } catch { setAiResponseControl(prev => ({ ...prev, [trackingId]: enabled })); showNotification('Failed to toggle AI response', 'error'); }
  };

  const sendManualReply = async () => {
    if (!manualReplyMessage.trim() || !selectedConversation) return;
    setIsSendingManualReply(true);
    try {
      await api.post('/api/outreach/manual-reply', { trackingId: selectedConversation.trackingId, leadEmail: selectedConversation.leadEmail, leadName: selectedConversation.leadName, agentId: selectedConversation.agentId, message: manualReplyMessage, pauseAI: true });
      showNotification('Reply sent', 'success');
      setManualReplyMessage('');
      setAiResponseControl(prev => ({ ...prev, [selectedConversation.trackingId]: false }));
      await fetchAgentOutreach();
    } catch (err: any) { showNotification(`Failed: ${err.response?.data?.error || err.message}`, 'error'); }
    finally { setIsSendingManualReply(false); }
  };

  const clearAgentData = async () => {
    if (!confirm('Clear all email history and tracking data for this agent? This cannot be undone.')) return;
    try {
      await api.delete('/api/email-queue/sent/clear', { params: { agentId } });
      await api.delete(`/api/analytics/emails?agentId=${agentId}`).catch(() => {});
      await api.delete(`/api/email-queue/approved?agentId=${agentId}`).catch(() => {});
      await api.delete(`/api/lead-agent/agent-data?agentId=${agentId}`).catch(() => {});
      await Promise.all([fetchRecentEmails(), fetchStatus()]);
      showNotification('All data cleared', 'success');
    } catch { showNotification('Failed to clear data', 'error'); }
  };

  // ─────────────────────────────────────────────────────
  // Derived / filtered lists
  // ─────────────────────────────────────────────────────
  const filteredRecentEmails = recentEmails.filter(e => {
    if (recentEmailsFilter !== 'all' && e.status !== recentEmailsFilter) return false;
    if (!recentEmailsSearch.trim()) return true;
    const s = recentEmailsSearch.toLowerCase();
    return e.name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) || e.company.toLowerCase().includes(s);
  });

  const filteredEmailQueue = React.useMemo(() => {
    let q = emailQueue;
    if (emailQueueSearch.trim()) {
      const s = emailQueueSearch.toLowerCase();
      q = q.filter(e => (e.leadInfo?.company || '').toLowerCase().includes(s) || (e.leadData?.email || e.to || '').toLowerCase().includes(s) || (e.emailData?.subject || e.subject || '').toLowerCase().includes(s));
    }
    return q.sort((a, b) => {
      const da = new Date(a.timestamp || a.createdAt || 0).getTime();
      const db = new Date(b.timestamp || b.createdAt || 0).getTime();
      return emailQueueSort === 'newest' ? db - da : da - db;
    });
  }, [emailQueue, emailQueueSearch, emailQueueSort]);

  const filteredConversations = agentConversations.filter(c => {
    if (conversationFilter !== 'all') {
      if (conversationFilter === 'active' && c.status !== 'active') return false;
      if (conversationFilter === 'replied' && c.status !== 'ai_responded') return false;
      if (conversationFilter === 'waiting' && c.status !== 'waiting_response') return false;
    }
    if (conversationSearch) {
      const s = conversationSearch.toLowerCase();
      return c.leadName?.toLowerCase().includes(s) || c.leadEmail?.toLowerCase().includes(s) || c.company?.toLowerCase().includes(s);
    }
    return true;
  });

  const paginate = (arr: any[], page: number) => arr.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = (arr: any[]) => Math.ceil(arr.length / ITEMS_PER_PAGE);

  const formatTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  // ─────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm">Loading agent dashboard…</p>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // ── OUTREACH FULL VIEW ──
  // ─────────────────────────────────────────────────────
  if (showOutreach) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 lg:p-6">
          {/* notification */}
          {notification && (
            <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium max-w-sm',
              notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300')}>
              <div className={cn('w-2 h-2 rounded-full', notification.type === 'success' ? 'bg-green-500' : 'bg-red-500')} />
              {notification.message}
              <button onClick={() => setNotification(null)} className="ml-auto"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setShowOutreach(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{agentName || agentId} — Outreach</h1>
              <p className="text-sm text-muted-foreground">Conversations, analytics & settings</p>
            </div>
          </div>

          <Tabs value={outreachTab} onValueChange={(v) => setOutreachTab(v as any)}>
            <TabsList className="mb-6">
              <TabsTrigger value="conversations"><MessageSquare className="w-4 h-4 mr-1.5" />Conversations</TabsTrigger>
              <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-1.5" />Analytics</TabsTrigger>
              <TabsTrigger value="viewed"><Eye className="w-4 h-4 mr-1.5" />Emails Viewed</TabsTrigger>
              <TabsTrigger value="settings"><Settings2 className="w-4 h-4 mr-1.5" />Settings</TabsTrigger>
            </TabsList>

            {/* ── Conversations ── */}
            <TabsContent value="conversations">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Live response stream */}
                <Card className="flex flex-col" style={{ height: 520 }}>
                  <CardHeader className="pb-3 border-b shrink-0">
                    <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Live Response Stream</CardTitle>
                    <p className="text-xs text-muted-foreground">Watch AI respond in real-time</p>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
                    {streamingResponses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Send className="h-10 w-10 mb-2 opacity-30" />
                        <p className="text-sm">No live responses yet</p>
                        <p className="text-xs mt-1 opacity-60">Responses will appear here as AI starts replying</p>
                      </div>
                    ) : (
                      [...streamingResponses].reverse().map((r, i) => (
                        <div key={r.id || i} className={cn('p-3 rounded-lg border text-sm', r.status === 'generating' ? 'border-primary/30 bg-primary/5' : r.status === 'replied' ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/40')}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground text-xs">{r.leadName}</span>
                            <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">{r.content || '...'}</p>
                          {r.status === 'generating' && (
                            <div className="flex gap-1 mt-2">
                              {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Conversation list */}
                <Card className="flex flex-col" style={{ height: 520 }}>
                  <CardHeader className="pb-3 border-b shrink-0">
                    <CardTitle className="text-base">Active Conversations</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input className="pl-8 h-8 text-sm" placeholder="Search…" value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} />
                      </div>
                      <select className="h-8 rounded-md border border-input bg-background text-sm px-2" value={conversationFilter} onChange={e => setConversationFilter(e.target.value as any)}>
                        <option value="all">All</option><option value="active">Active</option><option value="replied">Replied</option><option value="waiting">Waiting</option>
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-0">
                    {filteredConversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                        <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                        <p className="text-sm">No conversations yet</p>
                      </div>
                    ) : filteredConversations.map(conv => (
                      <button key={conv.trackingId} className="w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors" onClick={() => setSelectedConversation(conv)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">{conv.leadName}</p>
                            <p className="text-xs text-muted-foreground truncate">{conv.leadEmail}</p>
                            {conv.company && <p className="text-xs text-muted-foreground/70 truncate">{conv.company}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={conv.status === 'ai_responded' ? 'default' : conv.status === 'waiting_response' ? 'outline' : 'secondary'} className="text-[10px]">
                              {conv.status === 'ai_responded' ? 'Replied' : conv.status === 'waiting_response' ? 'Waiting' : conv.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{formatTimeAgo(conv.lastActivity || conv.timestamp)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Analytics ── */}
            <TabsContent value="analytics">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[{ label: 'Emails Viewed', value: agentOutreachStats.viewed, icon: Eye },
                  { label: 'Replies', value: agentOutreachStats.replied, icon: MessageSquare },
                  { label: 'Meetings Booked', value: agentOutreachStats.meetings, icon: CheckCircle2 },
                  { label: 'Reply Rate', value: `${agentOutreachStats.conversionRate.toFixed(1)}%`, icon: BarChart2 }].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p></div>
                        <stat.icon className={cn('h-8 w-8', pText, 'opacity-70')} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">7-Day Summary</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Analytics data is calculated from the past 7 days of outreach activity for this agent.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Viewed Emails ── */}
            <TabsContent value="viewed">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Emails Viewed ({viewedEmails.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => { if (confirm('Clear all viewed tracking data?')) api.delete(`/api/outreach/viewed?agentId=${agentId}`).then(() => { setViewedEmails([]); showNotification('Cleared', 'success'); }); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Clear
                  </Button>
                </CardHeader>
                <CardContent>
                  {viewedEmails.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground"><Eye className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No viewed emails yet</p></div>
                  ) : (
                    <div className="space-y-2">
                      {paginate(viewedEmails, viewedEmailsPage).map((e: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="text-sm font-medium text-foreground">{e.recipientEmail || e.email || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{e.company || ''} · {new Date(e.openedAt || e.timestamp).toLocaleString()}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">Opened</Badge>
                        </div>
                      ))}
                      {totalPages(viewedEmails) > 1 && (
                        <div className="flex items-center justify-between pt-3">
                          <Button variant="outline" size="sm" disabled={viewedEmailsPage === 1} onClick={() => setViewedEmailsPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                          <span className="text-xs text-muted-foreground">Page {viewedEmailsPage} of {totalPages(viewedEmails)}</span>
                          <Button variant="outline" size="sm" disabled={viewedEmailsPage === totalPages(viewedEmails)} onClick={() => setViewedEmailsPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Settings ── */}
            <TabsContent value="settings">
              <div className="space-y-4 max-w-2xl">
                <Card>
                  <CardHeader><CardTitle className="text-base">Auto-Response Settings</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div><Label>AI Auto-Response</Label><p className="text-xs text-muted-foreground mt-0.5">Automatically reply to leads with AI</p></div>
                      <Switch checked={outreachSettings.aiResponseEnabled} onCheckedChange={async (v) => {
                        setOutreachSettings((p: any) => ({ ...p, aiResponseEnabled: v }));
                        try { const r = await api.get(`/api/lead-agent/settings?agentId=${agentId}`); const s = r.data.settings || {}; await api.post('/api/lead-agent/settings', { ...s, agentId, emailBuilder: { ...(s.emailBuilder || {}), enableAutoResponse: v } }); } catch { showNotification('Failed to save', 'error'); }
                      }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div><Label>Auto Follow-up (Rebump)</Label><p className="text-xs text-muted-foreground mt-0.5">Send follow-up emails to non-responders</p></div>
                      <Switch checked={outreachSettings.rebumpEnabled} onCheckedChange={async (v) => {
                        setOutreachSettings((p: any) => ({ ...p, rebumpEnabled: v }));
                        try { const r = await api.get(`/api/lead-agent/settings?agentId=${agentId}`); const s = r.data.settings || {}; await api.post('/api/lead-agent/settings', { ...s, agentId, emailBuilder: { ...(s.emailBuilder || {}), rebumpEnabled: v } }); } catch { showNotification('Failed to save', 'error'); }
                      }} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">AI System Prompt</CardTitle>
                    {!editingSystemPrompt && <Button variant="outline" size="sm" onClick={() => setEditingSystemPrompt(true)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>}
                  </CardHeader>
                  <CardContent>
                    {editingSystemPrompt ? (
                      <div className="space-y-3">
                        <Textarea value={tempSystemPrompt} onChange={e => setTempSystemPrompt(e.target.value)} rows={5} placeholder="Enter AI response instructions…" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={async () => { try { const r = await api.get(`/api/lead-agent/settings?agentId=${agentId}`); const s = r.data.settings || {}; await api.post('/api/lead-agent/settings', { ...s, agentId, personality: { ...(s.personality || {}), emailPrompt: tempSystemPrompt } }); setOutreachSettings((p: any) => ({ ...p, systemPrompt: tempSystemPrompt })); setEditingSystemPrompt(false); showNotification('Saved', 'success'); } catch { showNotification('Failed to save', 'error'); } }}><Check className="h-3.5 w-3.5 mr-1" />Save</Button>
                          <Button variant="outline" size="sm" onClick={() => { setTempSystemPrompt(outreachSettings.systemPrompt); setEditingSystemPrompt(false); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">{outreachSettings.systemPrompt || 'No system prompt configured.'}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Conversation Detail Modal */}
          {selectedConversation && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedConversation(null)}>
              <div className="bg-background border border-border rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{selectedConversation.leadName}</h2>
                      <p className="text-sm text-muted-foreground">{selectedConversation.leadEmail}{selectedConversation.company && ` · ${selectedConversation.company}`}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)}><X className="h-5 w-5" /></Button>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className={cn('w-2 h-2 rounded-full', aiResponseControl[selectedConversation.trackingId] === false ? 'bg-red-500 animate-pulse' : 'bg-green-500')} />
                    <span className="text-sm font-medium text-foreground flex-1">AI Auto-Response: {aiResponseControl[selectedConversation.trackingId] === false ? 'Paused' : 'Active'}</span>
                    <Button size="sm" variant={aiResponseControl[selectedConversation.trackingId] === false ? 'default' : 'destructive'} onClick={() => toggleAIResponse(selectedConversation.trackingId, aiResponseControl[selectedConversation.trackingId] !== false)}>
                      {aiResponseControl[selectedConversation.trackingId] === false ? <><Play className="h-3.5 w-3.5 mr-1" />Enable AI</> : <><Pause className="h-3.5 w-3.5 mr-1" />Pause AI</>}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/20">
                  {(!selectedConversation.messages || selectedConversation.messages.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><MessageSquare className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No messages yet</p></div>
                  ) : selectedConversation.messages.map((msg: any, idx: number) => (
                    <div key={idx} className={cn('max-w-[80%] rounded-lg p-3', msg.type === 'outbound' || msg.type === 'ai_response' || msg.type === 'manual' ? 'ml-auto bg-primary/10 border border-primary/20' : 'mr-auto bg-card border border-border')}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-muted-foreground font-medium">{msg.type === 'outbound' ? 'Agent' : msg.type === 'reply' ? selectedConversation.leadName : msg.type === 'manual' ? 'You (Manual)' : 'AI Response'}</span>
                        <span className="text-[10px] text-muted-foreground/60">· {formatTimeAgo(msg.timestamp)}</span>
                        {msg.type === 'manual' && <Badge variant="outline" className="text-[10px]">manual</Badge>}
                        {msg.type === 'ai_response' && msg.status === 'generating' && <div className="flex gap-0.5">{[0,150,300].map(d => <div key={d} className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t">
                  <Label className="text-xs font-medium mb-2 block">Send Manual Reply (AI will be paused)</Label>
                  <div className="flex gap-2">
                    <Textarea value={manualReplyMessage} onChange={e => setManualReplyMessage(e.target.value)} placeholder="Type your reply…" rows={2} className="resize-none text-sm flex-1" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendManualReply(); }} />
                    <Button disabled={!manualReplyMessage.trim() || isSendingManualReply} onClick={sendManualReply} className="self-end">
                      {isSendingManualReply ? <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Cmd/Ctrl + Enter to send</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // ── MAIN DASHBOARD VIEW ──
  // ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-6 space-y-5">

        {/* Notification toast */}
        {notification && (
          <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium max-w-sm',
            notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300')}>
            <div className={cn('w-2 h-2 rounded-full', notification.type === 'success' ? 'bg-green-500' : 'bg-red-500')} />
            {notification.message}
            <button onClick={() => setNotification(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Header card ── */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* left: back + name */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.push('/agents')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-semibold text-foreground">{agentName || agentId}</h1>
                    {agentPersonality && (
                      <Badge variant="outline" className={cn('text-xs', pColor, pText)}>
                        {agentPersonality.avatar && !agentPersonality.avatar.startsWith('/') && <span className="mr-1">{agentPersonality.avatar}</span>}
                        {agentPersonality.name || agentPersonality.type}
                      </Badge>
                    )}
                    <Badge variant={status?.isActive ? 'default' : 'secondary'} className={cn('text-xs', status?.isActive && 'bg-green-500/15 text-green-600 border-green-500/30')}>
                      <div className={cn('w-1.5 h-1.5 rounded-full mr-1.5', status?.isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50')} />
                      {status?.isActive ? 'Running' : 'Stopped'}
                    </Badge>
                  </div>
                  {status?.lastRun && (
                    <p className="text-xs text-muted-foreground mt-0.5">Last run: {new Date(status.lastRun).toLocaleString()}</p>
                  )}
                </div>
              </div>

              {/* right: actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {error && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                    <AlertTriangle className="h-3.5 w-3.5" />{error}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => router.push(`/agents/${agentId}/settings`)}>
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />Settings
                </Button>
                <Button variant="outline" size="sm" onClick={resetAgent}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset
                </Button>
                <Button variant="outline" size="sm" onClick={runCycle} disabled={!status?.isActive}>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />Run Cycle
                </Button>
                <Button size="sm" variant={status?.isActive ? 'destructive' : 'default'} onClick={toggleAgent}>
                  {status?.isActive ? <><Square className="h-3.5 w-3.5 mr-1.5" />Stop</> : <><Play className="h-3.5 w-3.5 mr-1.5" />Start</>}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Emails Queued */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowEmailQueue(true)}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Emails Queued <span className="text-primary text-[10px]">· click</span></p>
                  <p className="text-3xl font-bold text-foreground">{emailQueue.length}</p>
                </div>
                <Mail className={cn('h-7 w-7', pText, 'opacity-70')} />
              </div>
            </CardContent>
          </Card>

          {/* Outreach */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowOutreach(true)}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Outreach <span className="text-primary text-[10px]">· click</span></p>
                  <p className="text-xl font-semibold text-foreground mt-1">View All</p>
                </div>
                <MessageSquare className={cn('h-7 w-7', pText, 'opacity-70')} />
              </div>
            </CardContent>
          </Card>

          {/* Recent Contacts */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recent Contacts</p>
                  <p className="text-3xl font-bold text-foreground">{recentEmails.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{status?.totalEmailsSent || 0} total sent</p>
                </div>
                <User className={cn('h-7 w-7', pText, 'opacity-70')} />
              </div>
            </CardContent>
          </Card>

          {/* Cycle Interval */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setNewInterval(status?.currentInterval || 30); setShowIntervalModal(true); }}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cycle Interval <span className="text-primary text-[10px]">· click</span></p>
                  <p className="text-3xl font-bold text-foreground">{status?.currentInterval || 30}<span className="text-lg font-normal text-muted-foreground">m</span></p>
                </div>
                <Clock className={cn('h-7 w-7', pText, 'opacity-70')} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main 2-col grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Activity Logs */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Activity Logs</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Real-time agent operations</p>
                </div>
                {/* Countdown */}
                {countdownTime !== null && (
                  <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                    countdownTime === 0 ? 'bg-green-500/10 border-green-500/30' : countdownTime <= 30 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-primary/10 border-primary/30')}>
                    {countdownTime > 0 ? (
                      <div className={cn('h-4 w-4 rounded-full border-2 border-t-transparent animate-spin', countdownTime <= 30 ? 'border-orange-500' : 'border-primary')} />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground">Next cycle</p>
                      <p className={cn('font-mono font-bold text-sm', countdownTime === 0 ? 'text-green-600' : countdownTime <= 30 ? 'text-orange-600' : 'text-primary', countdownTime <= 10 && countdownTime > 0 && 'animate-pulse')}>
                        {countdownTime === 0 ? (showStarting ? 'Starting…' : 'Running') : formatCountdown(countdownTime)}
                      </p>
                    </div>
                  </div>
                )}
                {status?.isActive && countdownTime === null && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
                    <span className="text-xs font-medium text-green-600">Running</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto font-mono text-xs" style={{ height: 480 }}>
              {agentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                  <p className="text-sm">No activity logs yet</p>
                  <p className="text-xs mt-1 opacity-60">Start the agent to see real-time operations</p>
                </div>
              ) : agentLogs.map((log, i) => (
                <div key={log.id || i} className="px-4 py-2 border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={cn('font-semibold',
                          log.status === 'completed' ? 'text-green-600' :
                          log.status === 'error' ? 'text-destructive' :
                          log.status === 'active' ? 'text-primary' :
                          log.status === 'running' ? 'text-purple-500' :
                          log.status === 'info' ? 'text-orange-500' :
                          'text-muted-foreground')}>
                          {log.operation}
                        </span>
                        <Badge variant="outline" className={cn('text-[10px] px-1 py-0',
                          log.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                          log.status === 'error' ? 'bg-destructive/10 text-destructive' :
                          log.status === 'active' ? 'bg-primary/10 text-primary' :
                          'bg-muted')}>
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate">
                        {typeof log.details === 'string' ? log.details : (log.details ? JSON.stringify(log.details).slice(0, 120) : '')}
                      </p>
                    </div>
                    <span className="text-muted-foreground/60 text-[10px] whitespace-nowrap shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </Card>

          {/* Recently Contacted */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recently Contacted</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Latest outreach attempts</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchRecentEmails} title="Refresh">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={clearAgentData} title="Clear all data">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-sm" placeholder="Search contacts…" value={recentEmailsSearch} onChange={e => { setRecentEmailsSearch(e.target.value); setRecentEmailsPage(1); }} />
                </div>
                <div className="flex gap-1.5">
                  {(['all', 'sent', 'opened', 'replied'] as const).map(f => (
                    <button key={f} onClick={() => { setRecentEmailsFilter(f); setRecentEmailsPage(1); }}
                      className={cn('px-2.5 py-1 text-xs rounded-md border transition-colors',
                        recentEmailsFilter === f ? cn('border-primary/40 text-primary', pColor) : 'border-border text-muted-foreground hover:bg-muted/50')}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground self-center">{filteredRecentEmails.length} of {recentEmails.length}</span>
                </div>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto divide-y divide-border" style={{ maxHeight: 420 }}>
              {recentEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-center px-4">
                  <Mail className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No emails sent yet</p>
                  <p className="text-xs mt-1 opacity-60">Start the agent to begin outreach</p>
                </div>
              ) : filteredRecentEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-center px-4">
                  <Search className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No matches</p>
                </div>
              ) : paginate(filteredRecentEmails, recentEmailsPage).map(contact => (
                <button key={contact.id} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors" onClick={() => setSelectedRecentEmail(contact)}>
                  <div className="flex items-center gap-3">
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 text-white', pColor, pText.replace('text-', 'bg-').split('/')[0])}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{contact.company}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(contact.dateSent).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] shrink-0',
                      contact.replied ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                      contact.opened ? 'bg-primary/10 text-primary border-primary/20' :
                      'bg-muted text-muted-foreground')}>
                      {contact.replied ? <><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Replied</> :
                       contact.opened ? <><Eye className="h-2.5 w-2.5 mr-1" />Opened</> :
                       <><Clock className="h-2.5 w-2.5 mr-1" />Sent</>}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
            {totalPages(filteredRecentEmails) > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <Button variant="outline" size="sm" disabled={recentEmailsPage === 1} onClick={() => setRecentEmailsPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Prev</Button>
                <span className="text-xs text-muted-foreground">Page {recentEmailsPage} of {totalPages(filteredRecentEmails)}</span>
                <Button variant="outline" size="sm" disabled={recentEmailsPage === totalPages(filteredRecentEmails)} onClick={() => setRecentEmailsPage(p => p + 1)}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            )}
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════
            MODALS
        ════════════════════════════════════════════════ */}

        {/* ── Cycle Interval Modal ── */}
        {showIntervalModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-xl w-full max-w-sm shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Change Cycle Interval</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowIntervalModal(false)}><X className="h-4 w-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">How often should the agent run a new cycle?</p>
              <div className="space-y-1.5 mb-5">
                {[1, 5, 10, 15, 30, 45, 60, 90, 120].map(m => (
                  <button key={m} onClick={() => setNewInterval(m)}
                    className={cn('w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between',
                      newInterval === m ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border hover:bg-muted/50 text-foreground')}>
                    <span>{m} {m === 1 ? 'minute' : 'minutes'}</span>
                    {newInterval === m && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowIntervalModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleIntervalChange}>Apply & Restart</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Recent Contact Detail Modal ── */}
        {selectedRecentEmail && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedRecentEmail(null)}>
            <div className="bg-background border border-border rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{selectedRecentEmail.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedRecentEmail.email} · {selectedRecentEmail.company}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-xs',
                    selectedRecentEmail.replied ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                    selectedRecentEmail.opened ? 'bg-primary/10 text-primary border-primary/20' :
                    'bg-muted text-muted-foreground')}>
                    {selectedRecentEmail.replied ? 'Replied' : selectedRecentEmail.opened ? 'Opened' : 'Sent'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedRecentEmail(null)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="text-sm font-medium text-foreground bg-muted rounded-lg px-3 py-2">{selectedRecentEmail.subject || 'No subject'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email Body</Label>
                  <div className="text-sm text-foreground bg-muted rounded-lg px-4 py-3 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">{selectedRecentEmail.body || selectedRecentEmail.content || selectedRecentEmail.personalizedEmail || 'No content'}</div>
                </div>
                <div className="text-xs text-muted-foreground">Sent: {new Date(selectedRecentEmail.dateSent).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Email Queue Modal ── */}
        {showEmailQueue && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
              {/* header */}
              <div className="flex items-center justify-between p-5 border-b">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Email Queue</h2>
                  <p className="text-sm text-muted-foreground">{filteredEmailQueue.length} emails pending approval</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-8 h-8 w-56 text-sm" placeholder="Search…" value={emailQueueSearch} onChange={e => { setEmailQueueSearch(e.target.value); setEmailQueuePage(1); }} />
                  </div>
                  <select className="h-8 text-sm border border-input rounded-md px-2 bg-background" value={emailQueueSort} onChange={e => setEmailQueueSort(e.target.value as any)}>
                    <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
                  </select>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowEmailQueue(false)}><X className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* content: list + detail side by side */}
              <div className="flex flex-1 overflow-hidden">
                {/* list */}
                <div className="w-80 border-r flex flex-col shrink-0 overflow-y-auto">
                  {filteredEmailQueue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-center px-4">
                      <Mail className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">{emailQueue.length === 0 ? 'Queue is empty' : 'No matches'}</p>
                    </div>
                  ) : paginate(filteredEmailQueue, emailQueuePage).map((email: any, i: number) => (
                    <button key={email.id || i} onClick={() => setSelectedEmail(email)}
                      className={cn('w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-muted/50', selectedEmail?.id === email.id && 'bg-primary/5')}>
                      <p className="text-sm font-medium text-foreground truncate">{email.leadInfo?.name || email.leadData?.name || email.to?.split('@')[0] || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{email.leadInfo?.company || email.leadData?.company || email.company || ''}</p>
                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{email.emailData?.subject || email.subject || email.finalSubject || 'No subject'}</p>
                    </button>
                  ))}
                  {totalPages(filteredEmailQueue) > 1 && (
                    <div className="flex items-center justify-between p-3 border-t mt-auto">
                      <Button variant="ghost" size="sm" disabled={emailQueuePage === 1} onClick={() => setEmailQueuePage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-xs text-muted-foreground">{emailQueuePage}/{totalPages(filteredEmailQueue)}</span>
                      <Button variant="ghost" size="sm" disabled={emailQueuePage === totalPages(filteredEmailQueue)} onClick={() => setEmailQueuePage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>

                {/* detail / editor */}
                <div className="flex-1 overflow-y-auto p-5">
                  {!selectedEmail ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                      <Mail className="h-12 w-12 mb-3 opacity-30" />
                      <p>Select an email to preview</p>
                    </div>
                  ) : editingEmail?.id === selectedEmail.id ? (
                    /* editor */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Edit Email</h3>
                        <Button variant="ghost" size="sm" onClick={() => setEditingEmail(null)}><X className="h-4 w-4 mr-1" />Close</Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">To</Label>
                        <Input value={editedRecipient} onChange={e => setEditedRecipient(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs">CC</Label><Input value={editedCc} onChange={e => setEditedCc(e.target.value)} placeholder="cc@example.com" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">BCC</Label><Input value={editedBcc} onChange={e => setEditedBcc(e.target.value)} placeholder="bcc@example.com" /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Subject</Label>
                        <Input value={editedSubject} onChange={e => setEditedSubject(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Body</Label>
                        <Textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} rows={12} className="font-mono text-sm resize-none" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={saveEmailEdits}><Check className="h-4 w-4 mr-1" />Save Changes</Button>
                        <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => approveEmail(selectedEmail.id)}><Send className="h-4 w-4 mr-1" />Save & Send</Button>
                        <Button variant="outline" onClick={() => setEditingEmail(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    /* preview */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{selectedEmail.leadInfo?.name || selectedEmail.leadData?.name || 'Unknown'}</h3>
                          <p className="text-sm text-muted-foreground">{selectedEmail.leadInfo?.company || selectedEmail.leadData?.company || selectedEmail.company || ''}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEditingEmail(selectedEmail)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveEmail(selectedEmail.id)}><Send className="h-3.5 w-3.5 mr-1" />Approve & Send</Button>
                          <Button variant="destructive" size="sm" onClick={() => rejectEmail(selectedEmail.id)}><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">To:</span>
                        <p className="text-sm font-medium text-foreground">{selectedEmail.leadData?.email || selectedEmail.to || selectedEmail.finalRecipient}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Subject:</span>
                        <p className="text-sm font-semibold text-foreground">{selectedEmail.emailData?.subject || selectedEmail.subject || selectedEmail.finalSubject}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Body:</span>
                        <div className="bg-muted rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                          {selectedEmail.emailData?.body || selectedEmail.personalizedEmail || selectedEmail.body || selectedEmail.finalBody || 'No content'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
