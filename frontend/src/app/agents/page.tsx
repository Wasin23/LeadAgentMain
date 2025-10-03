'use client';

import React, { useState } from 'react';
import AgentManager from '@/components/agents/AgentManager';
import AgentDashboard from '@/components/agents/AgentDashboard';

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgent(agentId);
  };

  const handleBackToManager = () => {
    setSelectedAgent(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {selectedAgent ? (
        <AgentDashboard 
          agentId={selectedAgent} 
          onBack={handleBackToManager}
        />
      ) : (
        <AgentManager onSelectAgent={handleSelectAgent} />
      )}
    </div>
  );
}