'use client';

import { MonitoringView } from './MonitoringSidebar';
import { 
  ChartBarIcon, 
  BellIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface MonitoringContentProps {
  view: MonitoringView;
  metrics: any;
  issues: any[];
  connected: boolean;
}

export default function MonitoringContent({ view, metrics, issues, connected }: MonitoringContentProps) {
  
  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">System Overview</h2>
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Emails Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">EMAILS</span>
                <ChartBarIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {metrics.emails?.sent || 0}
                </span>
                <span className="text-xs text-neutral-500">sent</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {metrics.emails?.queued || 0} queued · {metrics.emails?.replied || 0} replied
              </div>
            </div>

            {/* Leads Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">LEADS</span>
                <ChartBarIcon className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {metrics.leads?.found || 0}
                </span>
                <span className="text-xs text-neutral-500">found</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {metrics.leads?.contacted || 0} contacted
              </div>
            </div>

            {/* Meetings Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">MEETINGS</span>
                <ChartBarIcon className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {metrics.meetings?.booked || 0}
                </span>
                <span className="text-xs text-neutral-500">booked</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {metrics.emails?.replied || 0} responses
              </div>
            </div>

            {/* Issues Card */}
            <div className="bg-white rounded-lg p-4 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-600">ISSUES</span>
                <BellIcon className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {issues.filter(i => !i.resolved).length}
                </span>
                <span className="text-xs text-neutral-500">active</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {issues.filter(i => i.severity === 'error').length} errors · {issues.filter(i => i.severity === 'warning').length} warnings
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Issues */}
      {issues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">Recent Issues</h3>
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm divide-y divide-neutral-100">
            {issues.slice(0, 5).map((issue) => (
              <div key={issue.id} className="p-4">
                <div className="flex items-start gap-3">
                  {issue.severity === 'error' && <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  {issue.severity === 'warning' && <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                  {issue.severity === 'info' && <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{issue.message}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(issue.timestamp).toLocaleString()} · Agent: {issue.agentId}
                    </p>
                  </div>
                  {issue.resolved && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Analytics Dashboard</h2>
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
        <p className="text-neutral-600">Detailed analytics charts and graphs will appear here.</p>
        <p className="text-sm text-neutral-500 mt-2">Connected: {connected ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );

  const renderIssues = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Issues & Alerts</h2>
        <div className="text-sm text-neutral-600">
          {issues.filter(i => !i.resolved).length} active
        </div>
      </div>
      
      <div className="space-y-2">
        {issues.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-neutral-600">No issues detected</p>
            <p className="text-sm text-neutral-500 mt-1">All systems operating normally</p>
          </div>
        ) : (
          issues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
              <div className="flex items-start gap-3">
                {issue.severity === 'error' && <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                {issue.severity === 'warning' && <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                {issue.severity === 'info' && <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{issue.message}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {new Date(issue.timestamp).toLocaleString()} · Agent: {issue.agentId}
                  </p>
                  {issue.details && (
                    <pre className="text-xs text-neutral-600 mt-2 bg-neutral-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(issue.details, null, 2)}
                    </pre>
                  )}
                </div>
                {issue.resolved ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <button className="text-xs px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Agent Management</h2>
      {metrics?.agents && Object.keys(metrics.agents).length > 0 ? (
        <div className="grid gap-4">
          {Object.entries(metrics.agents).map(([agentId, agent]: [string, any]) => (
            <div key={agentId} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-neutral-900">{agent.type}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  agent.status === 'running' || agent.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-sm text-neutral-600">ID: {agentId}</p>
              {agent.lastActivity && (
                <p className="text-xs text-neutral-500 mt-1">
                  Last activity: {new Date(agent.lastActivity).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8 text-center">
          <p className="text-neutral-600">No active agents detected</p>
        </div>
      )}
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Integrations</h2>
      {metrics?.integrations && (
        <div className="grid gap-4">
          {Object.entries(metrics.integrations).map(([service, data]: [string, any]) => (
            <div key={service} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-neutral-900 capitalize">{service}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  data.status === 'healthy' || data.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : data.status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {data.status || 'unknown'}
                </span>
              </div>
              {data.usage !== undefined && data.quota && (
                <div className="text-sm text-neutral-600">
                  Usage: {data.usage} / {data.quota}
                </div>
              )}
              {data.lastCall && (
                <p className="text-xs text-neutral-500 mt-1">
                  Last call: {new Date(data.lastCall).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Activity Logs</h2>
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
        <p className="text-neutral-600">Activity logs will appear here.</p>
      </div>
    </div>
  );

  switch (view) {
    case 'overview':
      return renderOverview();
    case 'analytics':
      return renderAnalytics();
    case 'issues':
      return renderIssues();
    case 'agents':
      return renderAgents();
    case 'integrations':
      return renderIntegrations();
    case 'logs':
      return renderLogs();
    default:
      return renderOverview();
  }
}
