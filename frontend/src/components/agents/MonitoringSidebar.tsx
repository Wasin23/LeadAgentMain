'use client';

import { useState } from 'react';
import { 
  ChartBarIcon, 
  BellIcon, 
  Cog6ToothIcon,
  BoltIcon,
  CurrencyDollarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

export type MonitoringView = 'overview' | 'analytics' | 'issues' | 'agents' | 'integrations' | 'logs';

interface MonitoringSidebarProps {
  activeView: MonitoringView;
  onViewChange: (view: MonitoringView) => void;
  issueCount?: number;
  connected?: boolean;
}

export default function MonitoringSidebar({ 
  activeView, 
  onViewChange, 
  issueCount = 0,
  connected = false 
}: MonitoringSidebarProps) {
  const [hoveredView, setHoveredView] = useState<MonitoringView | null>(null);

  const views: Array<{
    id: MonitoringView;
    icon: React.ComponentType<any>;
    label: string;
    badge?: number;
  }> = [
    { id: 'overview', icon: ChartBarIcon, label: 'Overview' },
    { id: 'analytics', icon: ChartBarIcon, label: 'Analytics' },
    { id: 'issues', icon: BellIcon, label: 'Issues', badge: issueCount },
    { id: 'agents', icon: BoltIcon, label: 'Agents' },
    { id: 'integrations', icon: CurrencyDollarIcon, label: 'Billing' },
    { id: 'logs', icon: DocumentTextIcon, label: 'Activity Logs' },
  ];

  return (
    <div className="w-16 h-screen bg-white border-r border-neutral-200 flex flex-col items-center py-4 gap-2 fixed left-0 top-0 overflow-y-auto">
      {/* Connection Status Indicator */}
      <div className="mb-4 relative group">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          connected ? 'bg-green-50' : 'bg-neutral-100'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-green-500' : 'bg-neutral-400'
          }`}></div>
        </div>
        
        {/* Tooltip */}
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      <div className="w-full h-px bg-neutral-200 mb-2"></div>

      {/* Navigation Icons */}
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        const isHovered = hoveredView === view.id;

        return (
          <div key={view.id} className="relative group">
            <button
              onClick={() => onViewChange(view.id)}
              onMouseEnter={() => setHoveredView(view.id)}
              onMouseLeave={() => setHoveredView(null)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all relative ${
                isActive 
                  ? 'bg-blue-50 text-blue-600 shadow-sm' 
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              
              {/* Badge for issues */}
              {view.badge !== undefined && view.badge > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {view.badge > 9 ? '9+' : view.badge}
                </span>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r"></div>
              )}
            </button>

            {/* Tooltip */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {view.label}
              {view.badge !== undefined && view.badge > 0 && (
                <span className="ml-1.5 text-red-400">({view.badge})</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Settings at bottom */}
      <div className="mt-auto">
        <div className="relative group">
          <button
            className="w-12 h-12 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 transition-all"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>

          {/* Tooltip */}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Settings
          </div>
        </div>
      </div>
    </div>
  );
}
