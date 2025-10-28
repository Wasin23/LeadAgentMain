'use client';

import { useState } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, SparklesIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIReportModal({ isOpen, onClose }: AIReportModalProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF download
    alert('PDF download coming soon!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-neutral-900">AI Performance Report</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Time Range Selector & Generate Button */}
        {!report && (
          <div className="px-6 py-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Time Range
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimeRange('24h')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    timeRange === '24h'
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Last 24 Hours
                </button>
                <button
                  onClick={() => setTimeRange('7d')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    timeRange === '7d'
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setTimeRange('30d')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    timeRange === '30d'
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Last 30 Days
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating AI Report...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Generate AI Report
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Report Content */}
        {report && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Overall Performance */}
              {report.overallPerformance && (
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    📈 Overall Performance
                  </h3>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {report.overallPerformance}
                    </p>
                  </div>
                </div>
              )}

              {/* Key Metrics */}
              {report.metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="text-2xl font-bold text-blue-600">{report.metrics.emailsSent || 0}</div>
                    <div className="text-sm text-neutral-600">Emails Sent</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="text-2xl font-bold text-green-600">{report.metrics.openRate || 0}%</div>
                    <div className="text-sm text-neutral-600">Open Rate</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="text-2xl font-bold text-purple-600">{report.metrics.replyRate || 0}%</div>
                    <div className="text-sm text-neutral-600">Reply Rate</div>
                  </div>
                  <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <div className="text-2xl font-bold text-orange-600">{report.metrics.meetings || 0}</div>
                    <div className="text-sm text-neutral-600">Meetings</div>
                  </div>
                </div>
              )}

              {/* Top Performers */}
              {report.topPerformers && report.topPerformers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    🏆 Top Performing Agents
                  </h3>
                  <div className="space-y-2">
                    {report.topPerformers.map((performer: any, index: number) => (
                      <div key={index} className="bg-white rounded-lg border border-neutral-200 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-neutral-400">#{index + 1}</div>
                            <div>
                              <div className="font-semibold text-neutral-900">{performer.name}</div>
                              <div className="text-sm text-neutral-600">{performer.summary}</div>
                            </div>
                          </div>
                          {performer.badge && (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                              {performer.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues Detected */}
              {report.issues && report.issues.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    ⚠️ Issues & Alerts
                  </h3>
                  <div className="space-y-2">
                    {report.issues.map((issue: any, index: number) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="font-medium text-red-900">{issue.title}</div>
                        <div className="text-sm text-red-700 mt-1">{issue.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendations */}
              {report.recommendations && report.recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    💡 AI Recommendations
                  </h3>
                  <div className="space-y-2">
                    {report.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                        <div className="text-green-600 font-bold">•</div>
                        <div className="text-green-900 flex-1">{rec}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw AI Analysis */}
              {report.aiAnalysis && (
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    🤖 Detailed AI Analysis
                  </h3>
                  <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {report.aiAnalysis}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-between">
              <button
                onClick={() => setReport(null)}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Generate New Report
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
