'use client';

import { useState } from 'react';
import { 
  MagnifyingGlassIcon, 
  SparklesIcon, 
  XMarkIcon, 
  BuildingOfficeIcon, 
  MapPinIcon, 
  EnvelopeIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
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
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [buildingEmail, setBuildingEmail] = useState<string | null>(null);
  const [selectedAgentForLead, setSelectedAgentForLead] = useState<{[key: string]: string}>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSearch = async () => {
    console.log('🔍 [LeadSearch] Starting search...');
    console.log('🔍 [LeadSearch] Search query:', searchQuery);
    
    if (!searchQuery.trim()) {
      console.log('❌ [LeadSearch] Empty search query, aborting');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults([]);
    setSuccessMessage(null);
    setExpandedLead(null);
    
    try {
      console.log('📡 [LeadSearch] Sending API request to /api/ai-search/leads');
      console.log('📡 [LeadSearch] Request payload:', { query: searchQuery });
      
      const response = await api.post('/api/ai-search/leads', { query: searchQuery });
      
      console.log('✅ [LeadSearch] API response received:', response.data);
      console.log('✅ [LeadSearch] Response success:', response.data.success);
      console.log('✅ [LeadSearch] Number of leads:', response.data.leads?.length || 0);
      
      if (response.data.success) {
        setResults(response.data.leads || []);
        if (response.data.leads.length === 0) {
          console.log('⚠️ [LeadSearch] No leads found in results');
          setError('No leads found matching your search criteria. Try adjusting your search terms.');
        } else {
          console.log('✅ [LeadSearch] Successfully loaded leads:', response.data.leads);
        }
      } else {
        console.log('❌ [LeadSearch] API returned success=false');
        console.log('❌ [LeadSearch] Error message:', response.data.error);
        setError(response.data.error || 'Failed to search for leads');
      }
    } catch (err: any) {
      console.error('💥 [LeadSearch] Exception caught during search');
      console.error('💥 [LeadSearch] Error object:', err);
      console.error('💥 [LeadSearch] Error response:', err.response);
      console.error('💥 [LeadSearch] Error response data:', err.response?.data);
      console.error('💥 [LeadSearch] Error message:', err.message);
      console.error('💥 [LeadSearch] Error stack:', err.stack);
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to search for leads';
      console.error('💥 [LeadSearch] Setting error message:', errorMessage);
      setError(errorMessage);
    } finally {
      console.log('🏁 [LeadSearch] Search complete, setting loading to false');
      setLoading(false);
    }
  };

  const handleBuildEmail = async (lead: Lead, agentId: string) => {
    if (!agentId) return;
    
    setBuildingEmail(lead.id);
    setError(null);
    
    try {
      const response = await api.post('/api/ai-search/assign-lead', {
        lead: lead,
        agentId: agentId
      });
      
      if (response.data.success) {
        const agentName = agents.find(a => a.id === agentId)?.name || 'Agent';
        setSuccessMessage(`✓ Email built for ${lead.name} and added to ${agentName}'s queue!`);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(response.data.error || 'Failed to build email');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to build email');
    } finally {
      setBuildingEmail(null);
    }
  };

  const toggleExpanded = (leadId: string) => {
    setExpandedLead(expandedLead === leadId ? null : leadId);
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Header */}
      <div className="bg-white px-6 py-6 border-b border-neutral-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <MagnifyingGlassIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Lead Search Engine</h2>
            <p className="text-sm text-neutral-600">Find and contact prospects with AI-powered search</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch()}
              placeholder='Try: "Find CTOs at Series B fintech companies in San Francisco"'
              className="w-full pl-12 pr-4 py-3.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-neutral-900 placeholder-neutral-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            style={{ background: loading ? '#94a3b8' : 'linear-gradient(to right, #2563eb, #9333ea)' }}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                Search Leads
              </>
            )}
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-neutral-700 font-medium text-lg">Searching for leads...</p>
            <p className="text-neutral-500 text-sm mt-2">AI is analyzing millions of profiles</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="text-neutral-700 font-medium">
                Found <span className="text-blue-600 font-bold">{results.length}</span> lead{results.length !== 1 ? 's' : ''}
              </div>
              <div className="text-sm text-neutral-500">
                Click on a lead to see full details and build an email
              </div>
            </div>
            
            <div className="space-y-3">
              {results.map((lead) => {
                const isExpanded = expandedLead === lead.id;
                const selectedAgent = selectedAgentForLead[lead.id];
                const isBuilding = buildingEmail === lead.id;
                
                return (
                  <div
                    key={lead.id}
                    className="bg-white border border-neutral-200 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Lead Header - Always Visible */}
                    <button
                      onClick={() => toggleExpanded(lead.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-6 h-6 text-white" />
                        </div>
                        
                        {/* Lead Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-neutral-900 text-lg mb-0.5">{lead.name}</h3>
                          <p className="text-sm text-neutral-600 mb-1">{lead.title}</p>
                          <div className="flex items-center gap-2 text-sm text-neutral-500">
                            <BuildingOfficeIcon className="w-4 h-4" />
                            <span>{lead.company}</span>
                            {lead.location && (
                              <>
                                <span className="text-neutral-300">•</span>
                                <MapPinIcon className="w-4 h-4" />
                                <span>{lead.location}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Match Score Badge */}
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                            <span className="text-xs font-semibold text-blue-700">{lead.score}% Match</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUpIcon className="w-5 h-5 text-neutral-400" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-neutral-400" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          {/* Contact Information */}
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-700 mb-3">Contact Information</h4>
                            <div className="space-y-2.5">
                              {lead.email && (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200">
                                  <EnvelopeIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs text-neutral-500 mb-0.5">Email</div>
                                    <a href={`mailto:${lead.email}`} className="text-sm text-neutral-900 hover:text-blue-600 font-medium break-all">
                                      {lead.email}
                                    </a>
                                  </div>
                                </div>
                              )}
                              
                              {lead.linkedin && (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200">
                                  <LinkIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs text-neutral-500 mb-0.5">LinkedIn</div>
                                    <a 
                                      href={lead.linkedin} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:underline font-medium break-all"
                                    >
                                      View Profile →
                                    </a>
                                  </div>
                                </div>
                              )}
                              
                              {lead.companyWebsite && (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200">
                                  <GlobeAltIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs text-neutral-500 mb-0.5">Company Website</div>
                                    <a 
                                      href={lead.companyWebsite} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:underline font-medium break-all"
                                    >
                                      {lead.companyWebsite.replace(/^https?:\/\//, '')} →
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Why This Match */}
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-700 mb-3">Why This is a Match</h4>
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-900 leading-relaxed">{lead.matchReason}</p>
                            </div>
                          </div>
                        </div>

                        {/* Build Email Section */}
                        <div className="pt-5 border-t border-neutral-200">
                          <h4 className="text-sm font-semibold text-neutral-700 mb-3">Build Email for This Lead</h4>
                          <div className="flex gap-3">
                            <select
                              value={selectedAgent || ''}
                              onChange={(e) => setSelectedAgentForLead({...selectedAgentForLead, [lead.id]: e.target.value})}
                              className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              disabled={isBuilding}
                            >
                              <option value="">Select an agent to build email...</option>
                              {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name} {agent.personality?.name ? `(${agent.personality.name})` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleBuildEmail(lead, selectedAgent)}
                              disabled={!selectedAgent || isBuilding}
                              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                            >
                              {isBuilding ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Building...
                                </>
                              ) : (
                                <>
                                  <SparklesIcon className="w-4 h-4" />
                                  Build Email
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-neutral-500 mt-2">
                            The selected agent will research {lead.name} and generate a personalized email. It will be added to their queue for your review.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
              <MagnifyingGlassIcon className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">Search for Leads</h3>
            <p className="text-neutral-600 max-w-md">
              Use natural language to describe your ideal prospects. Our AI will find matching leads from millions of profiles.
            </p>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Example searches:</p>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>• "Find CTOs at Series B SaaS companies in California"</li>
                <li>• "Marketing Directors at healthcare startups"</li>
                <li>• "VPs of Sales at fintech companies with 50-500 employees"</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
