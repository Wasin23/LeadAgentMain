'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AgentManager from '@/components/agents/AgentManager';
import AgentDashboard from '@/components/agents/AgentDashboard';
import AdminChatbot from '@/components/AdminChatbot';

function AgentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentIdFromUrl = searchParams.get('agent');
  const returnTo = searchParams.get('returnTo'); // Get return path from URL
  const [selectedAgent, setSelectedAgent] = useState<string | null>(agentIdFromUrl);

  useEffect(() => {
    if (agentIdFromUrl) {
      setSelectedAgent(agentIdFromUrl);
    }
  }, [agentIdFromUrl]);

  console.log('AgentsPage rendering - AdminChatbot should appear');

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgent(agentId);
  };

  const handleBackToManager = () => {
    // Use returnTo parameter if provided, otherwise default to agents-overview
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/agents-overview');
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600">
        {selectedAgent ? (
          <AgentDashboard 
            agentId={selectedAgent} 
            onBack={handleBackToManager}
          />
        ) : (
          <AgentManager onSelectAgent={handleSelectAgent} />
        )}
      </div>
      <AdminChatbot />
    </>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <AgentsPageContent />
    </Suspense>
  );
}