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
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';

const mockStats = [
  {
    id: 'leads',
    title: 'Total Leads',
    value: '1,247',
    change: '+12.5%',
    trend: 'up',
    icon: UserGroupIcon,
  },
  {
    id: 'emails',
    title: 'Emails Sent',
    value: '3,892',
    change: '+8.2%',
    trend: 'up',
    icon: EnvelopeIcon,
  },
  {
    id: 'responses',
    title: 'Response Rate',
    value: '24.3%',
    change: '+3.1%',
    trend: 'up',
    icon: ChartBarIcon,
  },
  {
    id: 'views',
    title: 'Email Opens',
    value: '2,156',
    change: '+5.7%',
    trend: 'up',
    icon: EyeIcon,
  },
];

const recentActivity = [
  { id: 1, action: 'New lead researched', target: 'TechCorp Inc.', time: '2m ago' },
  { id: 2, action: 'Email campaign sent', target: '45 prospects', time: '1h ago' },
  { id: 3, action: 'Response received', target: 'Sarah Johnson', time: '2h ago' },
  { id: 4, action: 'Lead qualification', target: 'Marketing Manager', time: '4h ago' },
];

export default function StatsGrid() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: () => analyticsAPI.getStats().catch(() => ({ data: mockStats })),
    refetchInterval: 60000, // Refetch every minute
  });

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
        <div className="grid grid-cols-2 gap-4">
          {(stats?.data || mockStats).slice(0, 4).map((stat: any, index: number) => {
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
        <div className="space-y-3">
          {recentActivity.map((activity, index) => (
            <motion.div
              key={activity.id}
              className="flex items-start gap-3 py-2 border-b border-neutral-100 last:border-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-neutral-900">{activity.action}</p>
                <p className="text-xs text-neutral-600">{activity.target}</p>
              </div>
              <span className="text-xs text-neutral-500">{activity.time}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div 
        className="bg-white border border-neutral-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="font-medium text-neutral-900 mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <button className="w-full p-3 bg-blue-600 text-white text-sm font-medium transition-colors hover:bg-blue-500">
            Start Lead Research
          </button>
          <button className="w-full p-3 bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors hover:bg-neutral-200 border border-neutral-200">
            Create Email Campaign
          </button>
          <button className="w-full p-3 bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors hover:bg-neutral-200 border border-neutral-200">
            View Analytics
          </button>
        </div>
      </motion.div>
    </div>
  );
}