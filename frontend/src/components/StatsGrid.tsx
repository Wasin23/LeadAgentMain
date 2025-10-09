'use client';

import { motion } from 'framer-motion';
import { 
  UserGroupIcon, 
  EnvelopeIcon, 
  ChartBarIcon, 
  EyeIcon,
  ArrowTrendingUpIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { analyticsAPI } from '@/lib/api';

export default function StatsGrid() {
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [statsError, setStatsError] = useState<any>(null);
  const [activityError, setActivityError] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        console.log('🔄 Fetching stats - ONE TIME ONLY');
        const response = await analyticsAPI.getStats();
        console.log('✅ Stats API response:', response);
        if (isMounted) {
          setStats(response);
          setStatsLoading(false);
        }
      } catch (error) {
        console.error('❌ Stats API error:', error);
        if (isMounted) {
          setStatsError(error);
          setStatsLoading(false);
        }
      }
    };

    const fetchActivity = async () => {
      try {
        console.log('🔄 Fetching activity - ONE TIME ONLY');
        const response = await analyticsAPI.getActivity();
        console.log('✅ Activity API response:', response);
        if (isMounted) {
          setActivity(response);
          setActivityLoading(false);
        }
      } catch (error) {
        console.error('❌ Activity API error:', error);
        if (isMounted) {
          setActivityError(error);
          setActivityLoading(false);
        }
      }
    };

    fetchStats();
    fetchActivity();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <motion.div 
        className="bg-white border border-neutral-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-medium text-neutral-900 mb-4">Today's Overview</h3>
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 bg-neutral-50 border border-neutral-200 animate-pulse">
                <div className="h-4 bg-neutral-200 rounded mb-2"></div>
                <div className="h-6 bg-neutral-200 rounded mb-2"></div>
                <div className="h-3 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : statsError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600 text-sm">❌ Failed to load stats: {statsError.message}</p>
            <p className="text-red-600 text-xs mt-1">Check console for details</p>
          </div>
        ) : !stats?.data ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-600 text-sm">⚠️ No stats data received from API</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(Array.isArray(stats.data) ? stats.data : []).slice(0, 4).map((stat: any, index: number) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.id}
                className="p-4 bg-neutral-50 border border-neutral-200"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-4 h-4 text-neutral-600" />
                  <span className={`text-xs font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <div className="text-lg font-semibold text-neutral-900">{stat.value}</div>
                <div className="text-xs text-neutral-600">{stat.title}</div>
              </motion.div>
            );
          })}
          </div>
        )}
      </motion.div>

      {/* Performance Chart Placeholder */}
      <motion.div 
        className="bg-white border border-neutral-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="font-medium text-neutral-900 mb-4">Performance Trend</h3>
        <div className="h-32 bg-gradient-to-r from-blue-50 to-purple-50 border border-neutral-200 flex items-center justify-center">
          <div className="text-center">
            <ArrowTrendingUpIcon className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">Chart visualization coming soon</p>
          </div>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div 
        className="bg-white border border-neutral-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="w-4 h-4 text-neutral-600" />
          <h3 className="font-medium text-neutral-900">Recent Activity</h3>
        </div>
        {activityLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 py-2 animate-pulse">
                <div className="w-2 h-2 bg-neutral-200 rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 rounded mb-1"></div>
                  <div className="h-3 bg-neutral-200 rounded w-3/4"></div>
                </div>
                <div className="h-3 bg-neutral-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : activityError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600 text-sm">❌ Failed to load activity: {activityError.message}</p>
            <p className="text-red-600 text-xs mt-1">Check console for details</p>
          </div>
        ) : !activity?.data ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-600 text-sm">⚠️ No activity data received from API</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(Array.isArray(activity.data) ? activity.data : []).map((activityItem: any, index: number) => (
            <motion.div
              key={activityItem.id}
              className="flex items-start gap-3 py-2 border-b border-neutral-100 last:border-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-neutral-900">{activityItem.action}</p>
                <p className="text-xs text-neutral-600">{activityItem.target}</p>
              </div>
              <span className="text-xs text-neutral-500">{activityItem.time}</span>
            </motion.div>
          ))}
          </div>
        )}
      </motion.div>

      {/* Running Agents */}
      <motion.div 
        className="bg-white border border-neutral-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="font-medium text-neutral-900 mb-4">Running Agents</h3>
        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded text-center">
          <p className="text-sm text-neutral-600">No agents currently running</p>
          <p className="text-xs text-neutral-500 mt-1">Agents will appear here when active</p>
        </div>
      </motion.div>
    </div>
  );
}