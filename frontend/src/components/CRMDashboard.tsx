'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMergeLink } from '@mergeapi/react-merge-link';
import api from '@/lib/api';
import { 
  ArrowPathIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

interface CRMStatus {
  connected: boolean;
  integration: string | null;
  connectedAt: string | null;
  autoSync: boolean;
}

export default function CRMDashboard() {
  const [status, setStatus] = useState<CRMStatus>({
    connected: false,
    integration: null,
    connectedAt: null,
    autoSync: true
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setIsSyncing] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);

  // Supported CRMs with their logos/colors
  const crmOptions = [
    { id: 'salesforce', name: 'Salesforce', color: 'bg-blue-600', abbr: 'SF', logo: 'https://c1.sfdcstatic.com/content/dam/web/en_us/www/images/nav/salesforce-cloud-logo-sm.png' },
    { id: 'hubspot', name: 'HubSpot', color: 'bg-orange-500', abbr: 'HS', logo: 'https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png' },
    { id: 'pipedrive', name: 'Pipedrive', color: 'bg-green-600', abbr: 'PD', logo: 'https://www.pipedrive.com/favicon.ico' },
    { id: 'zoho', name: 'Zoho CRM', color: 'bg-red-600', abbr: 'ZC', logo: 'https://www.zohowebstatic.com/sites/zweb/images/favicon.ico' },
    { id: 'copper', name: 'Copper', color: 'bg-amber-600', abbr: 'CP', logo: 'https://www.copper.com/favicon.ico' },
    { id: 'close', name: 'Close', color: 'bg-purple-600', abbr: 'CL', logo: 'https://close.com/favicon.ico' }
  ];

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

  const handleConnectCRM = async (crmName: string) => {
    try {
      setLoading(true);
      
      // Get link token from backend
      const response = await api.post('/api/crm/link-token');
      const token = response.data.linkToken;
      
      console.log('[CRM] Got link token:', token);
      setLinkToken(token);
      
    } catch (error) {
      console.error('Error connecting CRM:', error);
      alert('Failed to connect CRM. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Callback when user successfully connects CRM
  const onSuccess = useCallback(async (publicToken: string) => {
    try {
      console.log('[CRM] Received public token:', publicToken);
      
      // Exchange token with backend
      await api.post('/api/crm/exchange-token', {
        publicToken
      });
      
      // Refresh status
      await fetchCRMStatus();
      setLinkToken(null);
      setJustConnected(true);
      
      // Clear success animation after 3 seconds
      setTimeout(() => setJustConnected(false), 3000);
      
    } catch (error) {
      console.error('Error exchanging token:', error);
      alert('Failed to complete CRM connection. Please try again.');
    }
  }, []);

  // Initialize Merge Link hook
  const { open, isReady } = useMergeLink({
    linkToken: linkToken || '',
    onSuccess,
    onExit: () => {
      console.log('[CRM] User closed Merge Link');
      setLinkToken(null);
      setLoading(false);
    }
  });

  // Open Merge Link when we have a token
  useEffect(() => {
    if (linkToken && isReady) {
      open();
    }
  }, [linkToken, isReady, open]);

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
    return crmOptions.find(crm => lower.includes(crm.id));
  };

  if (loading && !status.connected) {
    return (
      <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-[#4FD1FF]/20 overflow-hidden">
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
    <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-[#4FD1FF]/20 overflow-hidden">
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
            Leads will be synced to {getCRMInfo(status.integration)?.name} when research completes
          </div>
        </div>
      ) : (
        // Not Connected State - Single Connect CRM Button
        <div className="p-6 space-y-4">
          <div className="flex flex-col items-center justify-center p-6 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg">
            <div className="w-12 h-12 bg-[#4FD1FF]/20 rounded-full flex items-center justify-center mb-4">
              <ArrowTopRightOnSquareIcon className="w-6 h-6 text-[#4FD1FF]" />
            </div>
            <h3 className="text-sm font-medium text-white mb-1">No CRM Connected</h3>
            <p className="text-xs text-[#8FA6C1] text-center mb-4">
              Connect your CRM to automatically sync leads when research completes
            </p>
            <button
              onClick={() => handleConnectCRM('crm')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#4FD1FF] hover:bg-[#6BE3FF] text-[#0F1E35] rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
            >
              Connect CRM
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-xs text-[#8FA6C1] text-center">
            Supports Salesforce, HubSpot, Pipedrive, Zoho, and more
          </p>
        </div>
      )}
    </div>
  );
}
