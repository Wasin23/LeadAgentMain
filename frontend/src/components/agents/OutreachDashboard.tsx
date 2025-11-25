'use client';

import { useState, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  EnvelopeOpenIcon, 
  CursorArrowRaysIcon, 
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';

interface TrackingEvent {
  id: string;
  trackingId: string;
  agentId: string;
  agentName?: string;
  eventType: 'open' | 'click' | 'reply' | 'ai_response' | 'meeting_booked';
  timestamp: string;
  recipientEmail: string;
  leadName?: string;
  company?: string;
  ipAddress?: string;
  url?: string;
  messagePreview?: string;
  aiResponsePreview?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  status?: string;
}

interface ConversationThread {
  trackingId: string;
  leadName: string;
  leadEmail: string;
  company?: string;
  agentId: string;
  agentName: string;
  status: 'ai_responded' | 'awaiting_ai' | 'meeting_booked' | 'interested' | 'not_interested';
  lastActivity: string;
  messageCount: number;
  messages: {
    type: 'outbound' | 'reply' | 'ai_response';
    content: string;
    timestamp: string;
  }[];
}

interface OutreachStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplies: number;
  totalAIResponses: number;
  totalMeetingsBooked: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bestSendTime?: { hour: number; dayOfWeek: string };
}

export default function OutreachDashboard() {
  const [activeSection, setActiveSection] = useState<'overview' | 'conversations' | 'timeline' | 'quality'>('overview');
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TrackingEvent[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetchAgents();
    fetchOutreachData();
  }, [selectedAgent, timeRange]);

  const fetchAgents = async () => {
    try {
      const response = await api.get('/api/lead-agent');
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchOutreachData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAgent !== 'all') params.append('agentId', selectedAgent);
      params.append('timeRange', timeRange);

      // Fetch stats
      const statsResponse = await api.get(`/api/outreach/stats?${params}`);
      if (statsResponse.data.success) {
        setStats(statsResponse.data.stats);
      }

      // Fetch conversations
      const convResponse = await api.get(`/api/outreach/conversations?${params}`);
      if (convResponse.data.success) {
        setConversations(convResponse.data.conversations || []);
      }

      // Fetch timeline events
      const timelineResponse = await api.get(`/api/outreach/timeline?${params}`);
      if (timelineResponse.data.success) {
        setTimelineEvents(timelineResponse.data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch outreach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'meeting_booked': return 'bg-green-100 text-green-700 border-green-200';
      case 'interested': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ai_responded': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'awaiting_ai': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'not_interested': return 'bg-neutral-100 text-neutral-700 border-neutral-200';
      default: return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Outreach Dashboard</h1>
          <p className="text-neutral-600">Monitor email performance, conversations, and AI responses</p>
        </div>

        {/* Filters */}
        <div className="px-6 pb-4 flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-neutral-700 mb-1 block">Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-neutral-700 mb-1 block">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button
            onClick={fetchOutreachData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-6 flex gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: EnvelopeIcon },
            { id: 'conversations', label: 'Active Conversations', icon: ChatBubbleLeftRightIcon },
            { id: 'timeline', label: 'Engagement Timeline', icon: ClockIcon },
            { id: 'quality', label: 'AI Quality Monitor', icon: SparklesIcon },
          ].map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === section.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-neutral-600 border-transparent hover:text-neutral-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Section */}
            {activeSection === 'overview' && stats && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <EnvelopeIcon className="w-4 h-4 text-neutral-500" />
                      <span className="text-sm text-neutral-600">Sent</span>
                    </div>
                    <div className="text-2xl font-bold text-neutral-900">{stats.totalSent}</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <EnvelopeOpenIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-neutral-600">Opened</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalOpened}</div>
                    <div className="text-xs text-neutral-500 mt-1">{stats.openRate.toFixed(1)}% rate</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CursorArrowRaysIcon className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-neutral-600">Clicked</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.totalClicked}</div>
                    <div className="text-xs text-neutral-500 mt-1">{stats.clickRate.toFixed(1)}% rate</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-neutral-600">Replies</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{stats.totalReplies}</div>
                    <div className="text-xs text-neutral-500 mt-1">{stats.replyRate.toFixed(1)}% rate</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <SparklesIcon className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-neutral-600">AI Responses</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{stats.totalAIResponses}</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-neutral-600">Meetings</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.totalMeetingsBooked}</div>
                  </div>
                </div>

                {/* Best Send Time */}
                {stats.bestSendTime && (
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <ClockIcon className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-neutral-900">Best Send Time</h3>
                    </div>
                    <p className="text-neutral-700">
                      Your emails perform best on <span className="font-semibold">{stats.bestSendTime.dayOfWeek}s</span> at{' '}
                      <span className="font-semibold">{stats.bestSendTime.hour}:00</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Active Conversations */}
            {activeSection === 'conversations' && (
              <div className="grid grid-cols-1 gap-4">
                {conversations.length === 0 ? (
                  <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
                    <ChatBubbleLeftRightIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                    <p className="text-neutral-600 font-medium">No active conversations yet</p>
                    <p className="text-sm text-neutral-500 mt-1">Conversations will appear here when leads reply</p>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <div
                      key={conv.trackingId}
                      className="bg-white rounded-lg border border-neutral-200 p-5 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-neutral-900">{conv.leadName}</h3>
                            {conv.company && (
                              <span className="text-sm text-neutral-500">• {conv.company}</span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600">{conv.leadEmail}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(conv.status)}`}>
                            {getStatusLabel(conv.status)}
                          </span>
                          <span className="text-xs text-neutral-500">{formatTimestamp(conv.lastActivity)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-neutral-600 mb-3">
                        <span className="flex items-center gap-1">
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          {conv.messageCount} messages
                        </span>
                        <span className="text-neutral-400">•</span>
                        <span>Agent: {conv.agentName}</span>
                      </div>

                      {conv.messages.length > 0 && (
                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                          <div className="flex items-center gap-2 mb-2">
                            {conv.messages[conv.messages.length - 1].type === 'ai_response' && (
                              <SparklesIcon className="w-4 h-4 text-orange-500" />
                            )}
                            <span className="text-xs font-medium text-neutral-600">
                              Latest {conv.messages[conv.messages.length - 1].type === 'ai_response' ? 'AI Response' : 'Message'}:
                            </span>
                          </div>
                          <p className="text-sm text-neutral-700 line-clamp-2">
                            {conv.messages[conv.messages.length - 1].content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Engagement Timeline */}
            {activeSection === 'timeline' && (
              <div className="space-y-3">
                {timelineEvents.length === 0 ? (
                  <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
                    <ClockIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                    <p className="text-neutral-600 font-medium">No engagement events yet</p>
                    <p className="text-sm text-neutral-500 mt-1">Activity will appear here as leads engage</p>
                  </div>
                ) : (
                  timelineEvents.map(event => (
                    <div
                      key={event.id}
                      className="bg-white rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          event.eventType === 'open' ? 'bg-blue-100' :
                          event.eventType === 'click' ? 'bg-green-100' :
                          event.eventType === 'reply' ? 'bg-purple-100' :
                          event.eventType === 'ai_response' ? 'bg-orange-100' :
                          'bg-green-100'
                        }`}>
                          {event.eventType === 'open' && <EnvelopeOpenIcon className="w-4 h-4 text-blue-600" />}
                          {event.eventType === 'click' && <CursorArrowRaysIcon className="w-4 h-4 text-green-600" />}
                          {event.eventType === 'reply' && <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-600" />}
                          {event.eventType === 'ai_response' && <SparklesIcon className="w-4 h-4 text-orange-600" />}
                          {event.eventType === 'meeting_booked' && <CalendarIcon className="w-4 h-4 text-green-600" />}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium text-neutral-900">{event.recipientEmail}</span>
                            {event.leadName && (
                              <span className="text-sm text-neutral-600">({event.leadName})</span>
                            )}
                            {event.company && (
                              <span className="text-sm text-neutral-500">• {event.company}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              event.eventType === 'open' ? 'bg-blue-100 text-blue-700' :
                              event.eventType === 'click' ? 'bg-green-100 text-green-700' :
                              event.eventType === 'reply' ? 'bg-purple-100 text-purple-700' :
                              event.eventType === 'ai_response' ? 'bg-orange-100 text-orange-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {event.eventType.toUpperCase().replace('_', ' ')}
                            </span>
                            <span className="text-xs text-neutral-500">{formatTimestamp(event.timestamp)}</span>
                            {event.agentName && (
                              <span className="text-xs text-neutral-500">• Agent: {event.agentName}</span>
                            )}
                          </div>

                          {event.eventType === 'click' && event.url && (
                            <p className="text-sm text-neutral-600 font-mono text-xs bg-neutral-50 p-2 rounded">
                              🔗 {event.url}
                            </p>
                          )}

                          {(event.eventType === 'reply' && event.messagePreview) && (
                            <div className="bg-purple-50 p-3 rounded border border-purple-200 text-sm text-neutral-700">
                              "{event.messagePreview}"
                            </div>
                          )}

                          {(event.eventType === 'ai_response' && event.aiResponsePreview) && (
                            <div className="bg-orange-50 p-3 rounded border border-orange-200 text-sm text-neutral-700">
                              🤖 "{event.aiResponsePreview}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* AI Quality Monitor */}
            {activeSection === 'quality' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg border border-orange-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <SparklesIcon className="w-6 h-6 text-orange-600" />
                    <h3 className="text-lg font-semibold text-neutral-900">AI Response Quality</h3>
                  </div>
                  <p className="text-neutral-700 mb-4">
                    Monitor AI-generated responses, sentiment analysis, and conversation quality metrics.
                  </p>
                  
                  {conversations.filter(c => c.status === 'ai_responded' || c.status === 'awaiting_ai').length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center border border-neutral-200">
                      <p className="text-neutral-600">No AI responses to review yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {conversations
                        .filter(c => c.status === 'ai_responded' || c.status === 'awaiting_ai')
                        .map(conv => (
                          <div
                            key={conv.trackingId}
                            className="bg-white rounded-lg border border-neutral-200 p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-neutral-900">{conv.leadName}</h4>
                                <p className="text-sm text-neutral-600">{conv.leadEmail}</p>
                              </div>
                              {conv.status === 'awaiting_ai' ? (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                                  Awaiting AI
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                  ✓ AI Responded
                                </span>
                              )}
                            </div>
                            
                            {conv.messages.filter(m => m.type === 'ai_response').length > 0 && (
                              <div className="bg-orange-50 rounded p-3 border border-orange-200">
                                <div className="text-xs font-medium text-orange-700 mb-1">Latest AI Response:</div>
                                <p className="text-sm text-neutral-700">
                                  {conv.messages.filter(m => m.type === 'ai_response')[conv.messages.filter(m => m.type === 'ai_response').length - 1].content}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Conversation Detail Modal */}
      <AnimatePresence>
        {selectedConversation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedConversation(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="border-b border-neutral-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 mb-1">{selectedConversation.leadName}</h2>
                    <p className="text-sm text-neutral-600">{selectedConversation.leadEmail}</p>
                    {selectedConversation.company && (
                      <p className="text-sm text-neutral-500 mt-1">{selectedConversation.company}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedConversation.status)}`}>
                    {getStatusLabel(selectedConversation.status)}
                  </span>
                  <span className="text-xs text-neutral-500">Agent: {selectedConversation.agentName}</span>
                  <span className="text-xs text-neutral-500">• {selectedConversation.messageCount} messages</span>
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedConversation.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`${
                      msg.type === 'outbound' ? 'ml-8' :
                      msg.type === 'reply' ? 'mr-8' :
                      'ml-8'
                    }`}
                  >
                    <div className={`rounded-lg p-4 ${
                      msg.type === 'outbound' ? 'bg-blue-50 border border-blue-200' :
                      msg.type === 'reply' ? 'bg-neutral-100 border border-neutral-200' :
                      'bg-orange-50 border border-orange-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {msg.type === 'ai_response' && <SparklesIcon className="w-4 h-4 text-orange-600" />}
                        <span className="text-xs font-medium text-neutral-600">
                          {msg.type === 'outbound' ? 'You' : msg.type === 'reply' ? selectedConversation.leadName : 'AI Response'}
                        </span>
                        <span className="text-xs text-neutral-400">• {formatTimestamp(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
