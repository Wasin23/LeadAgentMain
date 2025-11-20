'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import api from '../lib/api';

interface NotificationData {
  unreadCount: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: {
    billing: number;
    agent: number;
    email: number;
    system: number;
  };
}

export default function NotificationBadge() {
  const [notifications, setNotifications] = useState<NotificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      console.log('🔔 [NOTIFICATIONS] Fetching notification count...');
      const response = await api.get('/api/notifications/count');
      
      console.log('🔔 [NOTIFICATIONS] Response:', response);
      console.log('🔔 [NOTIFICATIONS] Response.data:', response.data);
      
      // api.get returns axios response, need to access .data
      const data = response.data || response;
      
      if (data.success) {
        setNotifications(data);
        console.log('🔔 [NOTIFICATIONS] Notifications set:', data);
        console.log('🔔 [NOTIFICATIONS] Critical count:', data.bySeverity?.critical);
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading || !notifications) {
    return (
      <div className="relative">
        <Bell className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  const { unreadCount, bySeverity } = notifications;
  const hasCritical = bySeverity.critical > 0;

  return (
    <button
      onClick={() => window.location.href = '/settings?tab=notifications'}
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      title={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
    >
      <Bell className={`h-6 w-6 ${hasCritical ? 'text-red-500' : unreadCount > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
      
      {unreadCount > 0 && (
        <span
          className={`absolute top-0 right-0 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full ${
            hasCritical ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
          }`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
