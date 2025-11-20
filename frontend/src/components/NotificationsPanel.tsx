'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X, DollarSign, Bot, Mail, Settings } from 'lucide-react';

interface Issue {
  issueId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

export default function NotificationsPanel() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const fetchIssues = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/issues`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssues(data.issues);
        }
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (issueId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/issues/${issueId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIssues(prev => prev.map(issue =>
          issue.issueId === issueId ? { ...issue, read: true } : issue
        ));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteIssue = async (issueId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/issues/${issueId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIssues(prev => prev.filter(issue => issue.issueId !== issueId));
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIssues(prev => prev.map(issue => ({ ...issue, read: true })));
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'billing':
        return <DollarSign className="h-4 w-4" />;
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const filteredIssues = filter === 'unread'
    ? issues.filter(issue => !issue.read)
    : issues;

  const sortedIssues = [...filteredIssues].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === 'unread'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unread
          </button>
          {filteredIssues.some(i => !i.read) && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        {sortedIssues.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">No notifications</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          sortedIssues.map((issue) => (
            <div
              key={issue.issueId}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                !issue.read ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(issue.severity)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${!issue.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {issue.title}
                      </h3>
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        {getTypeIcon(issue.type)}
                        {issue.type}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteIssue(issue.issueId)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{issue.message}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(issue.timestamp).toLocaleString()}
                    </span>
                    {!issue.read && (
                      <button
                        onClick={() => markAsRead(issue.issueId)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                  
                  {issue.data?.amount && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700">
                      Amount: ${issue.data.amount.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
