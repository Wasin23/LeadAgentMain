'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  CheckCircleIcon, 
  XCircleIcon,
  KeyIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface CRMStatus {
  connected: boolean;
  integration: string | null;
  connectedAt: string | null;
  autoSync: boolean;
  crmType?: 'merge' | 'direct';
}

interface CRMConfig {
  id: string;
  name: string;
  color: string;
  abbr: string;
  logo: string;
  fields: {
    name: string;
    key: string;
    type: 'text' | 'password';
    placeholder: string;
    helpText?: string;
  }[];
}

// All CRMs with their specific credential requirements
const CRM_CONFIGS: CRMConfig[] = [
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    color: 'bg-blue-500',
    abbr: 'AC',
    logo: 'https://www.activecampaign.com/favicon.ico',
    fields: [
      { name: 'API URL', key: 'apiUrl', type: 'text', placeholder: 'https://youraccountname.api-us1.com', helpText: 'Found in Settings → Developer' },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your ActiveCampaign API Key' }
    ]
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    color: 'bg-orange-500',
    abbr: 'HS',
    logo: 'https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png',
    fields: [
      { name: 'Private App Access Token', key: 'apiKey', type: 'password', placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', helpText: 'Create a Private App in Settings → Integrations → Private Apps' }
    ]
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    color: 'bg-blue-600',
    abbr: 'SF',
    logo: 'https://c1.sfdcstatic.com/content/dam/web/en_us/www/images/nav/salesforce-cloud-logo-sm.png',
    fields: [
      { name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.salesforce.com', helpText: 'Your Salesforce domain' },
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Salesforce access token', helpText: 'Create a Connected App or use OAuth' }
    ]
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    color: 'bg-green-600',
    abbr: 'PD',
    logo: 'https://www.pipedrive.com/favicon.ico',
    fields: [
      { name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Pipedrive API token', helpText: 'Found in Settings → Personal preferences → API' }
    ]
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    color: 'bg-red-600',
    abbr: 'ZC',
    logo: 'https://www.zohowebstatic.com/sites/zweb/images/favicon.ico',
    fields: [
      { name: 'Data Center', key: 'apiUrl', type: 'text', placeholder: 'https://www.zohoapis.com (or .eu, .in, .com.au)', helpText: 'Based on your account region' },
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zoho OAuth access token' }
    ]
  },
  {
    id: 'copper',
    name: 'Copper',
    color: 'bg-amber-600',
    abbr: 'CP',
    logo: 'https://www.copper.com/favicon.ico',
    fields: [
      { name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com', helpText: 'Email associated with your Copper account' },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Copper API key', helpText: 'Found in Settings → Integrations → API Keys' }
    ]
  },
  {
    id: 'close',
    name: 'Close',
    color: 'bg-purple-600',
    abbr: 'CL',
    logo: 'https://close.com/favicon.ico',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'api_xxxxxxxxxxxxxxxx', helpText: 'Found in Settings → API Keys' }
    ]
  },
  {
    id: 'affinity',
    name: 'Affinity',
    color: 'bg-indigo-600',
    abbr: 'AF',
    logo: 'https://www.affinity.co/favicon.ico',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Affinity API key', helpText: 'Found in Settings → API' }
    ]
  },
  {
    id: 'capsule',
    name: 'Capsule',
    color: 'bg-teal-600',
    abbr: 'CA',
    logo: 'https://capsulecrm.com/favicon.ico',
    fields: [
      { name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Capsule API token', helpText: 'Found in My Preferences → API Authentication Tokens' }
    ]
  },
  {
    id: 'insightly',
    name: 'Insightly',
    color: 'bg-cyan-600',
    abbr: 'IN',
    logo: 'https://www.insightly.com/favicon.ico',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Insightly API key', helpText: 'Found in User Settings → API' }
    ]
  },
  {
    id: 'keap',
    name: 'Keap (Infusionsoft)',
    color: 'bg-green-500',
    abbr: 'KP',
    logo: 'https://keap.com/favicon.ico',
    fields: [
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Keap access token', helpText: 'OAuth access token from Keap Developer Portal' }
    ]
  },
  {
    id: 'dynamics365',
    name: 'Microsoft Dynamics 365',
    color: 'bg-blue-700',
    abbr: 'D3',
    logo: 'https://dynamics.microsoft.com/favicon.ico',
    fields: [
      { name: 'Organization URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourorg.crm.dynamics.com', helpText: 'Your Dynamics 365 instance URL' },
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Azure AD access token' }
    ]
  },
  {
    id: 'nutshell',
    name: 'Nutshell',
    color: 'bg-yellow-600',
    abbr: 'NS',
    logo: 'https://www.nutshell.com/favicon.ico',
    fields: [
      { name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com' },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Nutshell API key', helpText: 'Found in Setup → API Keys' }
    ]
  },
  {
    id: 'pipeliner',
    name: 'Pipeliner',
    color: 'bg-orange-600',
    abbr: 'PL',
    logo: 'https://www.pipelinersales.com/favicon.ico',
    fields: [
      { name: 'Space ID', key: 'apiUrl', type: 'text', placeholder: 'Your Pipeliner Space ID' },
      { name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Pipeliner API token' }
    ]
  },
  {
    id: 'salesflare',
    name: 'Salesflare',
    color: 'bg-blue-400',
    abbr: 'SL',
    logo: 'https://salesflare.com/favicon.ico',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Salesflare API key', helpText: 'Found in Settings → API keys' }
    ]
  },
  {
    id: 'sugarcrm',
    name: 'SugarCRM',
    color: 'bg-red-500',
    abbr: 'SG',
    logo: 'https://www.sugarcrm.com/favicon.ico',
    fields: [
      { name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.sugarcrm.com' },
      { name: 'OAuth Token', key: 'apiKey', type: 'password', placeholder: 'Your SugarCRM OAuth token' }
    ]
  },
  {
    id: 'teamleader',
    name: 'Teamleader',
    color: 'bg-emerald-600',
    abbr: 'TL',
    logo: 'https://www.teamleader.eu/favicon.ico',
    fields: [
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Teamleader access token', helpText: 'OAuth token from Teamleader Marketplace' }
    ]
  },
  {
    id: 'teamwork',
    name: 'Teamwork CRM',
    color: 'bg-purple-500',
    abbr: 'TW',
    logo: 'https://www.teamwork.com/favicon.ico',
    fields: [
      { name: 'Site URL', key: 'apiUrl', type: 'text', placeholder: 'https://yoursite.teamwork.com' },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Teamwork API key' }
    ]
  },
  {
    id: 'vtiger',
    name: 'Vtiger',
    color: 'bg-sky-600',
    abbr: 'VT',
    logo: 'https://www.vtiger.com/favicon.ico',
    fields: [
      { name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.vtiger.com' },
      { name: 'Access Key', key: 'apiKey', type: 'password', placeholder: 'Your Vtiger access key', helpText: 'Found in My Preferences → Access Key' }
    ]
  },
  {
    id: 'zendesksell',
    name: 'Zendesk Sell',
    color: 'bg-green-700',
    abbr: 'ZS',
    logo: 'https://www.zendesk.com/favicon.ico',
    fields: [
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zendesk Sell access token', helpText: 'OAuth token or API token from Settings → OAuth' }
    ]
  },
  {
    id: 'accelo',
    name: 'Accelo',
    color: 'bg-slate-600',
    abbr: 'AC',
    logo: 'https://www.accelo.com/favicon.ico',
    fields: [
      { name: 'Deployment URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourcompany.api.accelo.com' },
      { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Accelo access token' }
    ]
  }
];

export default function CRMDashboard() {
  const [status, setStatus] = useState<CRMStatus>({
    connected: false,
    integration: null,
    connectedAt: null,
    autoSync: true
  });
  const [loading, setLoading] = useState(true);
  
  // CRM Selection state
  const [selectedCRM, setSelectedCRM] = useState<CRMConfig | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCRMStatus();
  }, []);

  const fetchCRMStatus = async () => {
    try {
      const response = await api.get('/api/crm/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching CRM status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCRM = (crm: CRMConfig) => {
    setSelectedCRM(crm);
    setShowDropdown(false);
    setCredentials({});
    setError(null);
  };

  const handleConnect = async () => {
    if (!selectedCRM) return;
    
    // Validate all fields are filled
    const missingFields = selectedCRM.fields.filter(f => !credentials[f.key]?.trim());
    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.map(f => f.name).join(', ')}`);
      return;
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      await api.post('/api/crm/connect-direct', {
        integrationName: selectedCRM.id,
        apiUrl: credentials.apiUrl?.trim() || '',
        apiKey: credentials.apiKey?.trim() || ''
      });
      
      // Refresh status
      await fetchCRMStatus();
      setSelectedCRM(null);
      setCredentials({});
    } catch (error: any) {
      console.error('Error connecting CRM:', error);
      setError(error.response?.data?.error || 'Failed to connect. Please check your credentials.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your CRM?')) return;
    
    try {
      setLoading(true);
      await api.post('/api/crm/disconnect');
      await fetchCRMStatus();
    } catch (error) {
      console.error('Error disconnecting CRM:', error);
      alert('Failed to disconnect CRM. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSync = async () => {
    try {
      const newAutoSync = !status.autoSync;
      await api.post('/api/crm/toggle-auto-sync', {
        autoSync: newAutoSync
      });
      setStatus({ ...status, autoSync: newAutoSync });
    } catch (error) {
      console.error('Error toggling auto-sync:', error);
    }
  };

  const getCRMInfo = (integration: string | null) => {
    if (!integration) return null;
    const lower = integration.toLowerCase();
    return CRM_CONFIGS.find(crm => lower.includes(crm.id) || crm.id.includes(lower));
  };

  if (loading && !status.connected) {
    return (
      <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-[#4FD1FF]/20">
        <div className="px-6 py-4 border-b border-[#4FD1FF]/20">
          <h2 className="text-xl font-semibold text-white">CRM Integration</h2>
          <p className="text-xs text-[#A3B4CC] mt-1">Sync leads automatically</p>
        </div>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-[#4FD1FF] border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-[#4FD1FF]/20">
      <div className="px-6 py-4 border-b border-[#4FD1FF]/20">
        <h2 className="text-xl font-semibold text-white">CRM Integration</h2>
        <p className="text-xs text-[#A3B4CC] mt-1">
          {status.connected ? 'Connected and syncing' : 'Connect your CRM to auto-sync leads'}
        </p>
      </div>

      {status.connected && status.integration ? (
        // Connected State
        <div className="p-6 space-y-4">
          {/* Connected CRM Info */}
          <div className="flex items-center justify-between p-4 bg-[#12213B] border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              {getCRMInfo(status.integration)?.logo ? (
                <img 
                  src={getCRMInfo(status.integration)?.logo} 
                  alt={getCRMInfo(status.integration)?.name || 'CRM'} 
                  className="w-10 h-10 rounded-lg object-contain bg-white/10 p-1"
                />
              ) : (
                <div className={`w-10 h-10 ${getCRMInfo(status.integration)?.color || 'bg-gray-600'} rounded-lg flex items-center justify-center text-white font-bold`}>
                  {getCRMInfo(status.integration)?.abbr || status.integration?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  {getCRMInfo(status.integration)?.name || status.integration}
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-xs text-[#8FA6C1]">
                  Connected {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ''}
                </div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>

          {/* Auto-Sync Toggle */}
          <div className="flex items-center justify-between p-4 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">Auto-Sync Leads</div>
              <div className="text-xs text-[#8FA6C1] mt-0.5">
                Automatically sync researched leads to your CRM
              </div>
            </div>
            <button
              onClick={handleToggleAutoSync}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                status.autoSync ? 'bg-[#4FD1FF]' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status.autoSync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sync Info */}
          <div className="text-xs text-[#8FA6C1] text-center">
            Leads will be synced to {getCRMInfo(status.integration)?.name || status.integration} when research completes
          </div>
        </div>
      ) : (
        // Not Connected State - CRM Selection
        <div className="p-6 space-y-4">
          {!selectedCRM ? (
            // CRM Dropdown Selection
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg">
                <KeyIcon className="w-10 h-10 text-[#4FD1FF] mb-3" />
                <h3 className="text-sm font-medium text-white mb-1">Select Your CRM</h3>
                <p className="text-xs text-[#8FA6C1] text-center mb-4">
                  Choose your CRM and enter API credentials to sync leads
                </p>
              </div>

              {/* CRM Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg text-white hover:bg-[#1a2e4a] transition-colors"
                >
                  <span className="text-sm text-[#8FA6C1]">Choose a CRM...</span>
                  <ChevronDownIcon className={`w-5 h-5 text-[#8FA6C1] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute z-[100] w-full mt-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg shadow-2xl max-h-[400px] overflow-y-auto">
                    {CRM_CONFIGS.map((crm) => (
                      <button
                        key={crm.id}
                        onClick={() => handleSelectCRM(crm)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a2e4a] transition-colors border-b border-[#4FD1FF]/10 last:border-b-0"
                      >
                        {crm.logo ? (
                          <img 
                            src={crm.logo} 
                            alt={crm.name}
                            className="w-6 h-6 rounded object-contain bg-white/10 p-0.5"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-6 h-6 ${crm.color} rounded flex items-center justify-center text-white text-xs font-bold ${crm.logo ? 'hidden' : ''}`}>
                          {crm.abbr}
                        </div>
                        <span className="text-sm text-white">{crm.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-[#5a7a9a] text-center">
                Supports 21 popular CRMs including Salesforce, HubSpot, Pipedrive, Zoho & more
              </p>
            </div>
          ) : (
            // Selected CRM - Credential Form
            <div className="space-y-4">
              {/* Selected CRM Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#4FD1FF]/20">
                <div className="flex items-center gap-3">
                  {selectedCRM.logo ? (
                    <img 
                      src={selectedCRM.logo} 
                      alt={selectedCRM.name}
                      className="w-8 h-8 rounded object-contain bg-white/10 p-1"
                    />
                  ) : (
                    <div className={`w-8 h-8 ${selectedCRM.color} rounded flex items-center justify-center text-white text-xs font-bold`}>
                      {selectedCRM.abbr}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-white">Connect {selectedCRM.name}</h3>
                    <p className="text-xs text-[#8FA6C1]">Enter your API credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCRM(null);
                    setCredentials({});
                    setError(null);
                  }}
                  className="text-xs text-[#8FA6C1] hover:text-white"
                >
                  Change
                </button>
              </div>

              {/* Credential Fields */}
              <div className="space-y-3">
                {selectedCRM.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs text-[#8FA6C1] mb-1">{field.name}</label>
                    <input
                      type={field.type}
                      value={credentials[field.key] || ''}
                      onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg text-white text-sm placeholder-[#5a7a9a] focus:border-[#4FD1FF] focus:outline-none"
                    />
                    {field.helpText && (
                      <p className="text-xs text-[#5a7a9a] mt-1">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedCRM(null);
                    setCredentials({});
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-[#12213B] hover:bg-[#1a2e4a] border border-[#4FD1FF]/30 rounded-lg text-sm text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#4FD1FF] hover:bg-[#6BE3FF] text-[#0F1E35] rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
                >
                  {connecting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-[#0F1E35] border-t-transparent rounded-full"></div>
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
