'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CompanyProfileInstagram from '@/components/CompanyProfileInstagram';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to signin
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 p-8">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="mb-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20 flex items-center gap-2"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back
      </button>

      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Profile - Takes 2 columns */}
        <div className="lg:col-span-2">
          <CompanyProfileInstagram />
        </div>

        {/* CRM Integration Panel - Takes 1 column */}
        <div className="lg:col-span-1 space-y-6">
          {/* CRM Integrations */}
          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="text-xl font-semibold text-neutral-900">CRM Integrations</h2>
              <p className="text-xs text-neutral-600 mt-1">Connected systems</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Salesforce */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">SF</div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900">Salesforce</div>
                    <div className="text-xs text-neutral-600">Not connected</div>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:text-blue-700">Connect</button>
              </div>

              {/* HubSpot */}
              <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-bold">HS</div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900">HubSpot</div>
                    <div className="text-xs text-neutral-600">Not connected</div>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:text-blue-700">Connect</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
