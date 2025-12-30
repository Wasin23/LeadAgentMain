'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  PlusIcon, 
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
}

interface Meeting {
  leadName: string;
  leadEmail: string;
  meetingDate: string;
  meetingTime: string;
  agentId?: string;
  notes?: string;
  addedAt: string;
}

export default function OutreachPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    leadName: '',
    leadEmail: '',
    meetingDate: '',
    meetingTime: '',
    agentId: '',
    notes: ''
  });

  // Fetch agents list
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await api.get('/api/auth/agents');
        if (response.data?.success && response.data.agents) {
          setAgents(response.data.agents);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      }
    };
    fetchAgents();
  }, []);

  // Load meetings from localStorage
  useEffect(() => {
    const savedMeetings = localStorage.getItem('outreach_meetings');
    if (savedMeetings) {
      setMeetings(JSON.parse(savedMeetings));
    }
  }, []);

  // Save meetings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('outreach_meetings', JSON.stringify(meetings));
  }, [meetings]);

  const handleAddMeeting = () => {
    if (!meetingForm.leadName || !meetingForm.leadEmail || !meetingForm.meetingDate || !meetingForm.meetingTime) {
      alert('Please fill in all required fields');
      return;
    }
    
    setMeetings(prev => [...prev, { ...meetingForm, addedAt: new Date().toISOString() }]);
    
    setMeetingForm({
      leadName: '',
      leadEmail: '',
      meetingDate: '',
      meetingTime: '',
      agentId: '',
      notes: ''
    });
    
    setShowAddMeetingModal(false);
  };

  const handleDeleteMeeting = (index: number) => {
    setMeetings(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63]" />
      
      {/* Content */}
      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20"
            >
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Outreach Overview</h1>
              <p className="text-white/70 text-sm mt-1">Track all your outreach activity across agents</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddMeetingModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur-sm hover:bg-green-500/30 transition-all rounded-lg border border-green-500/40 text-green-300 font-medium"
          >
            <PlusIcon className="w-5 h-5" />
            Add Meeting
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <div className="text-white/60 text-sm mb-2">Total Emails Viewed</div>
            <div className="text-4xl font-bold text-white">0</div>
            <p className="text-xs text-white/50 mt-2">Coming soon</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <div className="text-white/60 text-sm mb-2">Total Responses</div>
            <div className="text-4xl font-bold text-white">0</div>
            <p className="text-xs text-white/50 mt-2">Coming soon</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <div className="text-white/60 text-sm mb-2">Meetings Booked</div>
            <div className="text-4xl font-bold text-white">{meetings.length}</div>
            <p className="text-xs text-green-300 mt-2">✓ Active tracking</p>
          </div>
        </div>

        {/* Activity Stream */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Scheduled Meetings</h2>
          
          {meetings.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-lg">No meetings scheduled yet</p>
              <p className="text-sm mt-2">Add your first meeting to start tracking your outreach success!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings
                .sort((a, b) => new Date(a.meetingDate + ' ' + a.meetingTime).getTime() - new Date(b.meetingDate + ' ' + b.meetingTime).getTime())
                .map((meeting, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">📅</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{meeting.leadName}</h3>
                          <p className="text-sm text-white/60">{meeting.leadEmail}</p>
                        </div>
                      </div>
                      <div className="ml-15 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-sm">📆</span>
                          <p className="text-sm text-white/80">
                            {new Date(meeting.meetingDate).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })} at {meeting.meetingTime}
                          </p>
                        </div>
                        {meeting.notes && (
                          <div className="flex items-start gap-2">
                            <span className="text-white/50 text-sm">📝</span>
                            <p className="text-sm text-white/70 flex-1">{meeting.notes}</p>
                          </div>
                        )}
                        {meeting.agentId && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 rounded-lg border border-cyan-500/40">
                            <span className="text-xs text-cyan-300">
                              Agent: {agents.find(a => a.id === meeting.agentId)?.name || 'Unknown'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMeeting(idx)}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 transition-all flex-shrink-0"
                      title="Delete meeting"
                    >
                      <TrashIcon className="w-5 h-5 text-red-300" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Meeting Modal */}
      <AnimatePresence>
        {showAddMeetingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            style={{ backgroundColor: 'rgba(23, 23, 23, 0.65)' }}
            onClick={() => setShowAddMeetingModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-[#1B2F52]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[#4FD1FF]/20 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-[#4FD1FF]/20 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Add Meeting</h2>
                  <p className="text-sm text-[#A3B4CC] mt-1">Log a manually scheduled meeting</p>
                </div>
                <button
                  onClick={() => setShowAddMeetingModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-[#A3B4CC]" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Lead Name *
                  </label>
                  <input
                    type="text"
                    value={meetingForm.leadName}
                    onChange={(e) => setMeetingForm({ ...meetingForm, leadName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] outline-none text-white placeholder-[#8FA6C1]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Lead Email *
                  </label>
                  <input
                    type="email"
                    value={meetingForm.leadEmail}
                    onChange={(e) => setMeetingForm({ ...meetingForm, leadEmail: e.target.value })}
                    placeholder="john@company.com"
                    className="w-full px-4 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] outline-none text-white placeholder-[#8FA6C1]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Meeting Date *
                    </label>
                    <input
                      type="date"
                      value={meetingForm.meetingDate}
                      onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                      className="w-full px-4 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] outline-none text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Meeting Time *
                    </label>
                    <input
                      type="time"
                      value={meetingForm.meetingTime}
                      onChange={(e) => setMeetingForm({ ...meetingForm, meetingTime: e.target.value })}
                      className="w-full px-4 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] outline-none text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Associated Agent (Optional)
                  </label>
                  <select
                    value={meetingForm.agentId}
                    onChange={(e) => setMeetingForm({ ...meetingForm, agentId: e.target.value })}
                    className="w-full px-4 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] outline-none text-white"
                  >
                    <option value="" className="bg-[#12213B]">Select an agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id} className="bg-[#12213B]">{agent.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={meetingForm.notes}
                    onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                    placeholder="Any additional notes about this meeting..."
                    rows={3}
                    className="w-full px-4 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-[#4FD1FF] outline-none resize-none text-white placeholder-[#8FA6C1]"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4FD1FF]/20 bg-[#12213B]/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAddMeetingModal(false)}
                  className="px-6 py-2 text-[#A3B4CC] hover:bg-white/10 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMeeting}
                  disabled={!meetingForm.leadName || !meetingForm.leadEmail || !meetingForm.meetingDate || !meetingForm.meetingTime}
                  className="px-6 py-2 bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] rounded-lg hover:opacity-90 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Meeting
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
