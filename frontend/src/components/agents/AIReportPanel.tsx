'use client';

import { useState, useEffect } from 'react';
import { 
  SparklesIcon, 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  CalendarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import api from '../../lib/api';

export default function AIReportPanel() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load report from localStorage on mount
  useEffect(() => {
    const savedReport = localStorage.getItem('aiReport');
    if (savedReport) {
      try {
        const parsed = JSON.parse(savedReport);
        setReport(parsed.report);
        setTimeRange(parsed.timeRange || '7d');
      } catch (e) {
        console.error('Failed to parse saved report:', e);
      }
    }
  }, []);

  // Save report to localStorage whenever it changes
  useEffect(() => {
    if (report) {
      localStorage.setItem('aiReport', JSON.stringify({ report, timeRange }));
    }
  }, [report, timeRange]);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/api/ai-report/generate', { timeRange });
      
      if (response.data.success) {
        setReport(response.data.report);
      } else {
        setError(response.data.error || 'Failed to generate report');
      }
    } catch (err: any) {
      console.error('Error generating AI report:', err);
      setError(err.response?.data?.error || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetReport = () => {
    setReport(null);
    setError(null);
    localStorage.removeItem('aiReport');
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    
    // Create a printable HTML version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const timeRangeLabel = timeRange === '24h' ? '24 Hours' : timeRange === '7d' ? '7 Days' : '30 Days';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Performance Report - ${timeRangeLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
          h2 { color: #3b82f6; margin-top: 30px; }
          .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
          .metric-card { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
          .metric-label { color: #6b7280; font-size: 12px; margin-bottom: 5px; }
          .metric-value { font-size: 28px; font-weight: bold; color: #1f2937; }
          .section { margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
          .performer { margin: 15px 0; padding: 15px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; }
          .issue { margin: 10px 0; padding: 10px; background: #fef2f2; border-left: 4px solid #ef4444; }
          .recommendation { margin: 10px 0; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; }
          ul { line-height: 1.8; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>🤖 AI Performance Report</h1>
        <p style="color: #6b7280; margin-bottom: 30px;">Time Range: ${timeRangeLabel} | Generated: ${new Date().toLocaleString()}</p>
        
        <div class="section">
          <h2>📊 Overall Performance</h2>
          <p>${report.overallPerformance}</p>
        </div>
        
        <h2>📈 Key Metrics</h2>
        <div class="metrics">
          <div class="metric-card">
            <div class="metric-label">Emails Sent</div>
            <div class="metric-value">${report.metrics.emailsSent}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Open Rate</div>
            <div class="metric-value" style="color: #3b82f6;">${report.metrics.openRate}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Reply Rate</div>
            <div class="metric-value" style="color: #10b981;">${report.metrics.replyRate}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Meetings Booked</div>
            <div class="metric-value" style="color: #8b5cf6;">${report.metrics.meetings}</div>
          </div>
        </div>
        
        ${report.topPerformers && report.topPerformers.length > 0 ? `
          <h2>🏆 Top Performing Agents</h2>
          ${report.topPerformers.map((p: any) => `
            <div class="performer">
              <strong>${p.badge} ${p.name}</strong>
              <p>${p.summary}</p>
            </div>
          `).join('')}
        ` : ''}
        
        ${report.issues && report.issues.length > 0 ? `
          <h2>⚠️ Issues Detected</h2>
          ${report.issues.map((issue: any) => `
            <div class="issue">
              <strong>${issue.severity.toUpperCase()}: ${issue.title}</strong>
              <p>${issue.description}</p>
            </div>
          `).join('')}
        ` : ''}
        
        ${report.recommendations && report.recommendations.length > 0 ? `
          <h2>💡 AI Recommendations</h2>
          ${report.recommendations.map((rec: string) => `
            <div class="recommendation">
              ${rec}
            </div>
          `).join('')}
        ` : ''}
        
        ${report.targetData ? `
          <div class="section">
            <h2>🎯 Target Overview</h2>
            <div class="metrics">
              <div class="metric-card">
                <div class="metric-label">Industries Targeted</div>
                <div class="metric-value" style="color: #3b82f6;">${report.targetData.totalUniqueIndustries || 0}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Companies Contacted</div>
                <div class="metric-value" style="color: #8b5cf6;">${report.targetData.totalUniqueCompanies || 0}</div>
              </div>
            </div>
            
            ${report.targetData.industries && report.targetData.industries.length > 0 ? `
              <h3>Industries:</h3>
              <p>${report.targetData.industries.join(', ')}</p>
            ` : ''}
            
            ${report.targetData.jobTitles && report.targetData.jobTitles.length > 0 ? `
              <h3>Job Titles Targeted:</h3>
              <p>${report.targetData.jobTitles.join(', ')}</p>
            ` : ''}
            
            ${report.targetData.researchFocusAreas && report.targetData.researchFocusAreas.length > 0 ? `
              <h3>Research Focus Areas:</h3>
              <p>${report.targetData.researchFocusAreas.join(', ')}</p>
            ` : ''}
            
            ${report.targetData.companiesContacted && report.targetData.companiesContacted.length > 0 ? `
              <h3>Companies Contacted ${report.targetData.companiesContacted.length > 50 ? '(Top 50 of ' + report.targetData.totalUniqueCompanies + ')' : '(' + report.targetData.companiesContacted.length + ')'}:</h3>
              <ul>
                ${report.targetData.companiesContacted.map((c: string) => `<li>${c}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        ` : ''}
        
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  return (
    <div className="flex-1 p-8 bg-neutral-50">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">AI Performance Report</h1>
              <p className="text-sm text-neutral-600">AI-powered insights and analytics</p>
            </div>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-all flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={handleResetReport}
                className="px-4 py-2.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-all flex items-center gap-2"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Time Range & Generate Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-neutral-200">
            <button
              onClick={() => setTimeRange('24h')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === '24h' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
              style={timeRange === '24h' ? { backgroundColor: '#3b82f6', color: '#ffffff' } : {}}
            >
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              24 Hours
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === '7d' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
              style={timeRange === '7d' ? { backgroundColor: '#3b82f6', color: '#ffffff' } : {}}
            >
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === '30d' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
              style={timeRange === '30d' ? { backgroundColor: '#3b82f6', color: '#ffffff' } : {}}
            >
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              30 Days
            </button>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: loading ? '#94a3b8' : 'linear-gradient(to right, #2563eb, #9333ea)' }}
          >
            <SparklesIcon className="w-5 h-5" />
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-neutral-600 font-medium">Generating AI Report...</p>
          <p className="text-sm text-neutral-500 mt-2">Analyzing your agent performance data</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">Error Generating Report</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Report Content */}
      {report && !loading && (
        <div className="space-y-6">
          {/* Overall Performance */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Overall Performance</h2>
            </div>
            <p className="text-blue-50 leading-relaxed">{report.overallPerformance}</p>
          </div>

          {/* Key Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-blue-600" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Emails Sent</div>
                <div className="text-3xl font-bold text-neutral-900">{report.metrics.emailsSent}</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Open Rate</div>
                <div className="text-3xl font-bold text-blue-600">{report.metrics.openRate}%</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Reply Rate</div>
                <div className="text-3xl font-bold text-green-600">{report.metrics.replyRate}%</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Meetings Booked</div>
                <div className="text-3xl font-bold text-purple-600">{report.metrics.meetings}</div>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          {report.topPerformers && report.topPerformers.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                Top Performing Agents
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {report.topPerformers.map((performer: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-neutral-900">{performer.name}</span>
                      <span className="text-2xl">{performer.badge}</span>
                    </div>
                    <p className="text-sm text-neutral-600">{performer.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues & Alerts - Only Important Events */}
          {report.issues && report.issues.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                Important Events
              </h2>
              <div className="space-y-3">
                {report.issues
                  .filter((issue: any) => {
                    // Only show important events: agent created/deleted, budget limits hit
                    const importantKeywords = ['agent created', 'agent deleted', 'budget limit', 'rate limit', 'quota exceeded'];
                    const titleLower = issue.title?.toLowerCase() || '';
                    const descLower = issue.description?.toLowerCase() || '';
                    return importantKeywords.some(keyword => 
                      titleLower.includes(keyword) || descLower.includes(keyword)
                    );
                  })
                  .map((issue: any, idx: number) => (
                  <div key={idx} className={`rounded-lg p-4 border ${
                    issue.severity === 'error' 
                      ? 'bg-red-50 border-red-200' 
                      : issue.severity === 'warning'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <h3 className={`font-semibold mb-1 ${
                      issue.severity === 'error' 
                        ? 'text-red-900' 
                        : issue.severity === 'warning'
                        ? 'text-yellow-900'
                        : 'text-blue-900'
                    }`}>{issue.title}</h3>
                    <p className={`text-sm ${
                      issue.severity === 'error' 
                        ? 'text-red-700' 
                        : issue.severity === 'warning'
                        ? 'text-yellow-700'
                        : 'text-blue-700'
                    }`}>{issue.description}</p>
                  </div>
                ))}
                {report.issues.filter((issue: any) => {
                  const importantKeywords = ['agent created', 'agent deleted', 'budget limit', 'rate limit', 'quota exceeded'];
                  const titleLower = issue.title?.toLowerCase() || '';
                  const descLower = issue.description?.toLowerCase() || '';
                  return importantKeywords.some(keyword => 
                    titleLower.includes(keyword) || descLower.includes(keyword)
                  );
                }).length === 0 && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-neutral-600">No important events to report</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <LightBulbIcon className="w-5 h-5 text-yellow-600" />
                AI Recommendations
              </h2>
              <div className="space-y-3">
                {report.recommendations.map((rec: string, idx: number) => (
                  <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-900">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Overview - Industries, Companies, Roles */}
          {report.agentConfigs && report.agentConfigs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-blue-600" />
                Agent Targeting & Strategy
              </h2>
              
              {/* Agent Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
                {report.agentConfigs.map((agent: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-lg border border-neutral-200 p-3 shadow-sm">
                    {/* Agent Header - Compact */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100">
                      {agent.personality?.avatar ? (
                        <img 
                          src={agent.personality.avatar} 
                          alt={agent.name}
                          className="w-8 h-8 rounded object-cover border border-neutral-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                          {agent.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-neutral-900 truncate">{agent.name}</h3>
                        <div className="text-xs text-neutral-500">
                          {agent.emailsSent} sent · {agent.replyRate}% rate
                        </div>
                      </div>
                    </div>

                    {/* Metrics - Compact */}
                    <div className="space-y-1.5 text-xs mb-3">
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Runtime:</span>
                        <span className="font-medium text-neutral-900">{agent.totalRuntime}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">API Calls:</span>
                        <span className="font-medium text-neutral-900">{agent.totalApiCalls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Cost:</span>
                        <span className="font-medium text-neutral-900">${agent.costAccumulated?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Cycles:</span>
                        <span className="font-medium text-neutral-900">{agent.cyclesCompleted}</span>
                      </div>
                    </div>

                    {/* Configuration Data - Compact */}
                    <div className="space-y-2 text-xs">
                      {/* Target Industries */}
                      {agent.targetIndustries && agent.targetIndustries.length > 0 && (
                        <div>
                          <div className="font-semibold text-neutral-700 mb-0.5">Industries:</div>
                          <div className="text-neutral-600 text-xs leading-tight">
                            {agent.targetIndustries.slice(0, 3).join(', ')}
                            {agent.targetIndustries.length > 3 && ` +${agent.targetIndustries.length - 3} more`}
                          </div>
                        </div>
                      )}

                      {/* Target Positions */}
                      {agent.targetPositions && agent.targetPositions.length > 0 && (
                        <div>
                          <div className="font-semibold text-neutral-700 mb-0.5">Positions:</div>
                          <div className="text-neutral-600 text-xs leading-tight">
                            {agent.targetPositions.slice(0, 3).join(', ')}
                            {agent.targetPositions.length > 3 && ` +${agent.targetPositions.length - 3} more`}
                          </div>
                        </div>
                      )}

                      {/* Company Size */}
                      {(agent.companySize?.min || agent.companySize?.max) && (
                        <div>
                          <div className="font-semibold text-neutral-700 mb-0.5">Company Size:</div>
                          <div className="text-neutral-600 text-xs">
                            {agent.companySize.min && agent.companySize.max 
                              ? `${agent.companySize.min}-${agent.companySize.max} emp`
                              : agent.companySize.min 
                              ? `${agent.companySize.min}+ emp`
                              : `Up to ${agent.companySize.max} emp`}
                          </div>
                        </div>
                      )}

                      {/* Lead Limit per Cycle */}
                      {agent.leadLimit && (
                        <div>
                          <div className="font-semibold text-neutral-700 mb-0.5">Leads/Cycle:</div>
                          <div className="text-neutral-600 text-xs">
                            {agent.leadLimit} leads
                          </div>
                        </div>
                      )}

                      {/* Research Focus */}
                      {agent.researchFocus && agent.researchFocus.length > 0 && (
                        <div>
                          <div className="font-semibold text-neutral-700 mb-0.5">Research:</div>
                          <div className="text-neutral-600 text-xs leading-tight">
                            {agent.researchFocus.slice(0, 2).join(', ')}
                            {agent.researchFocus.length > 2 && ` +${agent.researchFocus.length - 2} more`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Companies & Titles - Compact Lists */}
          {report.targetData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Job Titles */}
              {report.targetData.jobTitles && report.targetData.jobTitles.length > 0 && (
                <div className="bg-white rounded-lg border border-neutral-200 p-4">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">💼 Job Titles Reached ({report.targetData.jobTitles.length})</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {report.targetData.jobTitles.slice(0, 15).map((title: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-green-50 border border-green-200 text-green-800 rounded text-xs">
                        {title}
                      </span>
                    ))}
                    {report.targetData.jobTitles.length > 15 && (
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs">
                        +{report.targetData.jobTitles.length - 15} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Companies */}
              {report.targetData.companiesContacted && report.targetData.companiesContacted.length > 0 && (
                <div className="bg-white rounded-lg border border-neutral-200 p-4">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">
                    🏢 Companies Contacted ({report.targetData.totalUniqueCompanies || report.targetData.companiesContacted.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {report.targetData.companiesContacted.slice(0, 30).map((company: string, idx: number) => (
                      <div key={idx} className="text-sm text-neutral-700 px-2 py-1 hover:bg-neutral-50 rounded">
                        • {company}
                      </div>
                    ))}
                    {report.targetData.companiesContacted.length > 30 && (
                      <div className="text-xs text-neutral-500 px-2 py-1">
                        And {report.targetData.totalUniqueCompanies - 30} more companies...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Report Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
            <div className="text-sm text-neutral-500">
              Report generated at {new Date(report.generatedAt).toLocaleString()}
            </div>
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Regenerate Report
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
            <SparklesIcon className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">Generate Your First AI Report</h3>
          <p className="text-neutral-600 max-w-md">
            Select a time range and click "Generate Report" to get AI-powered insights about your agent performance
          </p>
        </div>
      )}
    </div>
  );
}
