'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CompanyProfileInstagram from '@/components/CompanyProfileInstagram';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import AppLayout from '@/components/AppLayout';

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated) {
    return null; // Will redirect to signin
  }
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-2xl font-semibold text-white">Loading...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Profile - Takes 2 columns */}
        <div className="lg:col-span-2">
          <CompanyProfileInstagram />
        </div>

        {/* CRM Integration Panel - Takes 1 column */}
        <div className="lg:col-span-1 space-y-6">
          {/* CRM Integrations */}
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-[#4FD1FF]/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#4FD1FF]/20">
              <h2 className="text-xl font-semibold text-white">CRM Integrations</h2>
              <p className="text-xs text-[#A3B4CC] mt-1">Connected systems</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Salesforce */}
              <div className="flex items-center justify-between p-3 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">SF</div>
                  <div>
                    <div className="text-sm font-medium text-white">Salesforce</div>
                    <div className="text-xs text-[#8FA6C1]">Not connected</div>
                  </div>
                </div>
                <button className="text-xs text-[#4FD1FF] hover:text-[#6BE3FF]">Connect</button>
              </div>

              {/* HubSpot */}
              <div className="flex items-center justify-between p-3 bg-[#12213B] border border-[#4FD1FF]/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-bold">HS</div>
                  <div>
                    <div className="text-sm font-medium text-white">HubSpot</div>
                    <div className="text-xs text-[#8FA6C1]">Not connected</div>
                  </div>
                </div>
                <button className="text-xs text-[#4FD1FF] hover:text-[#6BE3FF]">Connect</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
