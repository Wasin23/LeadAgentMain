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
    // Don't make API calls if no auth token
    const token = localStorage.getItem('authToken');
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all counts in one request
      const countsRes = await api.get('/api/email-queue/counts?agentId=all');

      setCounts({
        queued: countsRes.data?.queued || 0,
        sent: countsRes.data?.sent || 0,
        replied: countsRes.data?.replied || 0,
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
