'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface QueueCounts {
  queued: number;
  sent: number;
  replied: number;
  byAgent: Record<string, { queued: number; sent: number; replied: number }>;
}

interface QueueCountContextType {
  counts: QueueCounts;
  refreshCounts: () => Promise<void>;
  isLoading: boolean;
}

const QueueCountContext = createContext<QueueCountContextType | undefined>(undefined);

export function QueueCountProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<QueueCounts>({
    queued: 0,
    sent: 0,
    replied: 0,
    byAgent: {}
  });
  const [isLoading, setIsLoading] = useState(false);

  const refreshCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch total counts
      const [queuedRes, sentRes, repliedRes] = await Promise.all([
        api.get('/api/email-queue/queue/count?agentId=all'),
        api.get('/api/email-queue/sent/count?agentId=all'),
        api.get('/api/email-queue/replied/count?agentId=all')
      ]);

      setCounts({
        queued: queuedRes.data?.count || 0,
        sent: sentRes.data?.count || 0,
        replied: repliedRes.data?.count || 0,
        byAgent: {} // Will be populated by operations page
      });
    } catch (error) {
      console.error('Failed to refresh queue counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 30000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  return (
    <QueueCountContext.Provider value={{ counts, refreshCounts, isLoading }}>
      {children}
    </QueueCountContext.Provider>
  );
}

export function useQueueCounts() {
  const context = useContext(QueueCountContext);
  if (!context) {
    throw new Error('useQueueCounts must be used within QueueCountProvider');
  }
  return context;
}
