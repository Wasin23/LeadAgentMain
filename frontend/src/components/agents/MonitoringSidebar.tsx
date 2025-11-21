'use client';

import { useState } from 'react';
import { 
  ChartBarIcon, 
  BellIcon, 
  Cog6ToothIcon,
  BoltIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  SparklesIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

export type MonitoringView = 'overview' | 'analytics' | 'agents' | 'integrations' | 'logs' | 'search' | 'report' | 'memory';

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
  const [showConnectionTooltip, setShowConnectionTooltip] = useState(false);
  const [showSettingsTooltip, setShowSettingsTooltip] = useState(false);

  const views: Array<{
    id: MonitoringView;
    icon: React.ComponentType<any>;
    label: string;
    badge?: number;
  }> = [
    { id: 'overview', icon: Squares2X2Icon, label: 'Overview' },
    { id: 'search', icon: MagnifyingGlassIcon, label: 'Lead Search' },
    { id: 'report', icon: SparklesIcon, label: 'AI Report' },
    { id: 'analytics', icon: ChartBarIcon, label: 'Analytics' },
    { id: 'agents', icon: BoltIcon, label: 'Agents' },
    { id: 'memory', icon: CpuChipIcon, label: 'Keyword Memory' },
    { id: 'integrations', icon: CurrencyDollarIcon, label: 'Billing' },
    { id: 'logs', icon: DocumentTextIcon, label: 'Activity Logs', badge: issueCount },
  ];

  return (
    <div className="w-16 h-screen bg-white border-r border-neutral-200 flex flex-col items-center py-4 gap-2 fixed left-0 top-0 overflow-visible">
      {/* Connection Status Indicator */}
      <div 
        className="mb-4 relative"
        onMouseEnter={() => setShowConnectionTooltip(true)}
        onMouseLeave={() => setShowConnectionTooltip(false)}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          connected ? 'bg-green-50' : 'bg-neutral-100'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-green-500' : 'bg-neutral-400'
          }`}></div>
        </div>
        
        {/* Tooltip */}
        {showConnectionTooltip && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-lg" style={{ zIndex: 9999 }}>
            {connected ? 'Live' : 'Offline'}
          </div>
        )}
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
            {isHovered && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-lg" style={{ zIndex: 9999 }}>
                {view.label}
                {view.badge !== undefined && view.badge > 0 && (
                  <span className="ml-1.5 text-red-400">({view.badge})</span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Settings at bottom */}
      <div className="mt-auto">
        <div 
          className="relative"
          onMouseEnter={() => setShowSettingsTooltip(true)}
          onMouseLeave={() => setShowSettingsTooltip(false)}
        >
          <button
            className="w-12 h-12 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 transition-all"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>

          {/* Tooltip */}
          {showSettingsTooltip && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-lg" style={{ zIndex: 9999 }}>
              Settings
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
