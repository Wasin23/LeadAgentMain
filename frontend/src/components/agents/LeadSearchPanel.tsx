'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon, SparklesIcon, XMarkIcon, BuildingOfficeIcon, MapPinIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';

interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  location?: string;
  email?: string;
  linkedin?: string;
  companyWebsite?: string;
  matchReason: string;
  score: number;
}

interface LeadSearchPanelProps {
  agents: any[];
}

export default function LeadSearchPanel({ agents }: LeadSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults([]);
    setSuccessMessage(null);
    
    try {
      const response = await api.post('/api/ai-search/leads', { query: searchQuery });
      if (response.data.success) {
        setResults(response.data.leads || []);
        if (response.data.leads.length === 0) {
          setError('No leads found matching your search criteria. Try adjusting your search terms.');
        }
      } else {
        setError(response.data.error || 'Failed to search for leads');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search for leads');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !selectedAgent) return;
    
    setAssigning(true);
    setError(null);
    
    try {
      const response = await api.post('/api/ai-search/assign-lead', {
        lead: selectedLead,
        agentId: selectedAgent
      });
      
      if (response.data.success) {
        setSuccessMessage(`✓ Email generated and added to ${agents.find(a => a.id === selectedAgent)?.name}'s queue!`);
        setAssignModalOpen(false);
        setSelectedLead(null);
        setSelectedAgent('');
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(response.data.error || 'Failed to assign lead');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign lead');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">AI Lead Search</h2>
        <p className="text-neutral-600 text-sm mb-4">
          Search for leads using natural language. Try: "Find CTOs at Series B fintech companies in California"
        </p>
        
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Describe the leads you're looking for..."
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-600">AI is searching for leads...</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="mb-4 text-sm text-neutral-600">
              Found {results.length} lead{results.length !== 1 ? 's' : ''}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  {/* Lead Header */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-neutral-900 mb-1">{lead.name}</h3>
                    <p className="text-sm text-neutral-600">{lead.title}</p>
                  </div>

                  {/* Company Info */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-700">
                      <BuildingOfficeIcon className="w-4 h-4 text-neutral-400" />
                      <span>{lead.company}</span>
                    </div>
                    {lead.location && (
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <MapPinIcon className="w-4 h-4 text-neutral-400" />
                        <span>{lead.location}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <EnvelopeIcon className="w-4 h-4 text-neutral-400" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Match Reason */}
                  <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-900">
                    <span className="font-medium">Why this is a match:</span>
                    <p className="mt-1">{lead.matchReason}</p>
                  </div>

                  {/* Match Score */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-500">
                      Match Score: {lead.score}%
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLead(lead);
                        setAssignModalOpen(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && results.length === 0 && searchQuery && !error && (
          <div className="text-center py-16 text-neutral-500">
            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p>No results yet. Try searching for leads!</p>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Assign Lead to Agent</h3>
              <button
                onClick={() => {
                  setAssignModalOpen(false);
                  setSelectedAgent('');
                  setError(null);
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="mb-4 p-4 bg-neutral-50 rounded-lg">
                <div className="font-medium text-neutral-900">{selectedLead.name}</div>
                <div className="text-sm text-neutral-600">{selectedLead.title} at {selectedLead.company}</div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select Agent
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.personality?.name || 'Default'})
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="text-sm text-neutral-600 mb-4">
                This will generate a personalized email for {selectedLead.name} and add it to the selected agent's queue for review.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setAssignModalOpen(false);
                  setSelectedAgent('');
                  setError(null);
                }}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignLead}
                disabled={!selectedAgent || assigning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {assigning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Email & Assign'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && !assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Lead Details</h3>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <h4 className="text-2xl font-bold text-neutral-900">{selectedLead.name}</h4>
                <p className="text-neutral-600">{selectedLead.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-neutral-700 mb-1">Company</div>
                  <div className="text-neutral-900">{selectedLead.company}</div>
                </div>
                {selectedLead.location && (
                  <div>
                    <div className="text-sm font-medium text-neutral-700 mb-1">Location</div>
                    <div className="text-neutral-900">{selectedLead.location}</div>
                  </div>
                )}
                {selectedLead.email && (
                  <div>
                    <div className="text-sm font-medium text-neutral-700 mb-1">Email</div>
                    <div className="text-neutral-900">{selectedLead.email}</div>
                  </div>
                )}
                {selectedLead.companyWebsite && (
                  <div>
                    <div className="text-sm font-medium text-neutral-700 mb-1">Website</div>
                    <a 
                      href={selectedLead.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {selectedLead.companyWebsite}
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-900 mb-2">Why this is a match:</div>
                <p className="text-blue-800">{selectedLead.matchReason}</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm text-neutral-600">Match Score:</div>
                <div className="flex-1 bg-neutral-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${selectedLead.score}%` }}
                  />
                </div>
                <div className="text-sm font-medium text-neutral-900">{selectedLead.score}%</div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={() => setAssignModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Assign to Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
