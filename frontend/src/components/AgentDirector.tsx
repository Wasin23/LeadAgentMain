'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function AgentDirector() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentStatus();
  }, []);

  const fetchAgentStatus = async () => {
    try {
      const response = await api.get('/api/lead-agent/status');
      setAgents([response.data]);
    } catch (error) {
      console.error('Error fetching agent status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-white mb-6">Agent Director</h2>
      <p className="text-[#8FA6C1] mb-8">Manage and monitor your AI agents</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent overview cards will go here */}
        <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-xl border border-[#4FD1FF]/20 p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Agent Director</h3>
          <p className="text-[#8FA6C1]">Agent management interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
