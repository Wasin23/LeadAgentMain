'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AgentManager from '@/components/agents/AgentManager';
import AgentDashboard from '@/components/agents/AgentDashboard';

function AgentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentIdFromUrl = searchParams.get('agent');
  const returnTo = searchParams.get('returnTo'); // Get return path from URL
  const [selectedAgent, setSelectedAgent] = useState<string | null>(agentIdFromUrl);
  const [isNavigating, setIsNavigating] = useState(false);

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
    // Show loading immediately
    setIsNavigating(true);
    
    // Use returnTo parameter if provided, otherwise default to agents-overview
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/agents-overview');
    }
  };

  return (
    <>
      {isNavigating && (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-2xl font-semibold text-white">Loading...</div>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63]">
        {selectedAgent ? (
          <AgentDashboard 
            agentId={selectedAgent} 
            onBack={handleBackToManager}
          />
        ) : (
          <AgentManager onSelectAgent={handleSelectAgent} />
        )}
      </div>
    </>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-2xl font-semibold text-white">Loading...</div>
        </div>
      </div>
    }>
      <AgentsPageContent />
    </Suspense>
  );
}