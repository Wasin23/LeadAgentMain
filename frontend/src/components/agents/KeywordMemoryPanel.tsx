'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface KeywordMemory {
  keyword: string;
  position: string;
  searchCombo: string;
  totalAttempts: number;
  totalDuplicates: number;
  cumulativeDuplicateRate: number;
  isExhausted: boolean;
  keywordSource: string;
  lastUpdated: number;
}

interface MemoryStats {
  totalKeywords: number;
  exhaustedKeywords: number;
  avgDuplicateRate: number;
  totalSearchAttempts: number;
}

export default function KeywordMemoryPanel() {
  const [keywords, setKeywords] = useState<KeywordMemory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'exhausted' | 'good'>('all');
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    fetchMemory();
  }, []);

  const fetchMemory = async () => {
    setLoading(true);
    try {
      const [keywordsRes, statsRes] = await Promise.all([
        api.get('/api/lead-agent/memory/keywords'),
        api.get('/api/lead-agent/memory/stats')
      ]);

      if (keywordsRes.data.success) {
        setKeywords(keywordsRes.data.keywords || []);
      }

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
    } catch (error) {
      console.error('Error fetching keyword memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetKeyword = async (searchCombo: string) => {
    if (!confirm(`Reset "${searchCombo}"? This will clear its learning history.`)) {
      return;
    }

    setResetting(searchCombo);
    try {
      const response = await api.delete(`/api/lead-agent/memory/keyword/${encodeURIComponent(searchCombo)}`);
      
      if (response.data.success) {
        // Remove from local state
        setKeywords(prev => prev.filter(k => k.searchCombo !== searchCombo));
        
        // Refresh stats
        const statsRes = await api.get('/api/lead-agent/memory/stats');
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
        }
      }
    } catch (error) {
      console.error('Error resetting keyword:', error);
      alert('Failed to reset keyword');
    } finally {
      setResetting(null);
    }
  };

  const resetAllKeywords = async () => {
    if (!confirm('Reset ALL keyword memory? This will clear all learning history and cannot be undone.')) {
      return;
    }

    setResetting('all');
    try {
      const response = await api.delete('/api/lead-agent/memory/reset-all');
      
      if (response.data.success) {
        setKeywords([]);
        setStats({
          totalKeywords: 0,
          exhaustedKeywords: 0,
          avgDuplicateRate: 0,
          totalSearchAttempts: 0
        });
      }
    } catch (error) {
      console.error('Error resetting all memory:', error);
      alert('Failed to reset memory');
    } finally {
      setResetting(null);
    }
  };

  const filteredKeywords = keywords.filter(k => {
    if (filter === 'exhausted') return k.isExhausted;
    if (filter === 'good') return !k.isExhausted;
    return true;
  }).sort((a, b) => b.cumulativeDuplicateRate - a.cumulativeDuplicateRate);

  const getSourceBadge = (source: string) => {
    const badges = {
      base: { text: 'Base', color: 'bg-blue-100 text-blue-700' },
      ai: { text: 'AI Generated', color: 'bg-purple-100 text-purple-700' },
      campaign: { text: 'Campaign', color: 'bg-green-100 text-green-700' }
    };
    return badges[source as keyof typeof badges] || badges.base;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading keyword memory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">🧠 Keyword Learning Memory</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMemory}
            className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50 flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
          {keywords.length > 0 && (
            <button
              onClick={resetAllKeywords}
              disabled={resetting === 'all'}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              {resetting === 'all' ? 'Resetting...' : 'Reset All'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">Total Keywords</div>
            <div className="text-2xl font-bold text-neutral-900">{stats.totalKeywords}</div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">Exhausted</div>
            <div className="text-2xl font-bold text-red-600">{stats.exhaustedKeywords}</div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">Avg Duplicate Rate</div>
            <div className="text-2xl font-bold text-orange-600">{stats.avgDuplicateRate.toFixed(1)}%</div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">Total Searches</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalSearchAttempts}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          All ({keywords.length})
        </button>
        <button
          onClick={() => setFilter('exhausted')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            filter === 'exhausted'
              ? 'bg-red-600 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Exhausted ({keywords.filter(k => k.isExhausted).length})
        </button>
        <button
          onClick={() => setFilter('good')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            filter === 'good'
              ? 'bg-green-600 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Good ({keywords.filter(k => !k.isExhausted).length})
        </button>
      </div>

      {/* Keywords Table */}
      {filteredKeywords.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
          <div className="text-neutral-400 text-lg mb-2">🧠</div>
          <p className="text-neutral-600">No keyword memory yet</p>
          <p className="text-sm text-neutral-500 mt-1">
            {filter === 'all' 
              ? 'Start running agents to build learning history'
              : `No ${filter} keywords found`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Keyword + Position
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Duplicates
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredKeywords.map((keyword) => (
                <tr key={keyword.searchCombo} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-neutral-900">{keyword.keyword}</div>
                    <div className="text-xs text-neutral-500">{keyword.position}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSourceBadge(keyword.keywordSource).color}`}>
                      {getSourceBadge(keyword.keywordSource).text}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                    {keyword.totalAttempts}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                    {keyword.totalDuplicates}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-neutral-900">
                        {keyword.cumulativeDuplicateRate.toFixed(1)}%
                      </div>
                      <div className="w-24 bg-neutral-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            keyword.cumulativeDuplicateRate > 70
                              ? 'bg-red-600'
                              : keyword.cumulativeDuplicateRate > 50
                              ? 'bg-orange-500'
                              : keyword.cumulativeDuplicateRate > 30
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(keyword.cumulativeDuplicateRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {keyword.isExhausted ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
                        ⚠️ Exhausted
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                        ✓ Good
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => resetKeyword(keyword.searchCombo)}
                      disabled={resetting === keyword.searchCombo}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Reset this keyword"
                    >
                      {resetting === keyword.searchCombo ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <TrashIcon className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
