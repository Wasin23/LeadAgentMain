'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CompanyProfileInstagram from '@/components/CompanyProfileInstagram';
import CRMDashboard from '@/components/CRMDashboard';
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
          <CRMDashboard />
        </div>
      </div>
    </AppLayout>
  );
}
