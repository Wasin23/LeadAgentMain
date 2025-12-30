'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CompanyProfileOnboarding from './CompanyProfileOnboarding';
import CalendarSetup from './CalendarSetup';
import AgentOnboarding from './agents/AgentOnboarding';
import api from '../lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [hasCompanyProfile, setHasCompanyProfile] = useState(false);
  const [hasCalendarSetup, setHasCalendarSetup] = useState<boolean | null>(null);
  const [showAgentOnboarding, setShowAgentOnboarding] = useState(false);

  useEffect(() => {
    checkCompanyProfile();
  }, []);

  // Redirect to dashboard if onboarding is complete
  useEffect(() => {
    if (!isCheckingProfile && hasCompanyProfile && hasCalendarSetup === true && !showAgentOnboarding) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCheckingProfile, hasCompanyProfile, hasCalendarSetup, showAgentOnboarding, router]);

  const checkCompanyProfile = async () => {
    try {
      const response = await api.get('/api/company-profile');
      setHasCompanyProfile(!!response.data?.profile);
      
      if (response.data?.profile) {
        setHasCalendarSetup(true);
      }
    } catch (error: any) {
      // 404 means no profile exists yet, which is expected for new users
      if (error.response?.status === 404) {
        setHasCompanyProfile(false);
      } else {
        console.error('Error checking company profile:', error);
        setHasCompanyProfile(false);
      }
    } finally {
      setIsCheckingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Show full-page onboarding if no company profile */}
      {isCheckingProfile ? (
        <div className="flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-900">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400"></div>
        </div>
      ) : !hasCompanyProfile ? (
        <div className="min-h-screen">
          <CompanyProfileOnboarding onComplete={() => {
            setHasCompanyProfile(true);
            setHasCalendarSetup(false);
          }} />
        </div>
      ) : hasCalendarSetup === false ? (
        <div className="min-h-screen">
          <CalendarSetup onComplete={() => {
            setHasCalendarSetup(true);
            setShowAgentOnboarding(true);
          }} />
        </div>
      ) : showAgentOnboarding ? (
        <AgentOnboarding 
          onComplete={() => {
            // Redirect to the new dashboard (globe page) after onboarding
            router.push('/dashboard');
          }}
          onSkip={() => {
            // Redirect to the new dashboard (globe page) after skipping
            router.push('/dashboard');
          }}
        />
      ) : (
        // If somehow we get here (onboarding complete), redirect to dashboard
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Redirecting to dashboard...</p>
          </div>
        </div>
      )}
    </div>
  );
}
