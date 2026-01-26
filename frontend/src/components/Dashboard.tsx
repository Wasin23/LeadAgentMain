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

  // Save onboarding progress to localStorage
  useEffect(() => {
    if (!isCheckingProfile) {
      const progress = {
        hasCompanyProfile,
        hasCalendarSetup,
        showAgentOnboarding
      };
      localStorage.setItem('onboardingProgress', JSON.stringify(progress));
    }
  }, [isCheckingProfile, hasCompanyProfile, hasCalendarSetup, showAgentOnboarding]);

  // Restore onboarding progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('onboardingProgress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        if (progress.hasCompanyProfile) setHasCompanyProfile(true);
        if (progress.hasCalendarSetup !== null) setHasCalendarSetup(progress.hasCalendarSetup);
        if (progress.showAgentOnboarding) setShowAgentOnboarding(true);
      } catch (e) {
        console.error('Failed to restore onboarding progress:', e);
      }
    }
  }, []);

  // Redirect to home if onboarding is complete
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
      const response = await api.get('/api/company-profile/check');
      const hasProfile = !!response.data?.profile;
      setHasCompanyProfile(hasProfile);
      
      if (hasProfile) {
        // Skip calendar setup for existing profiles
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
            // Clear onboarding progress since they completed setup
            localStorage.removeItem('onboardingProgress');
            // Redirect to the new home page after onboarding
            router.push('/home');
          }}
          onSkip={() => {
            // Redirect to the new home page after skipping
            router.push('/home');
          }}
        />
      ) : (
        // If somehow we get here (onboarding complete), redirect to home
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Redirecting to home...</p>
          </div>
        </div>
      )}
    </div>
  );
}
