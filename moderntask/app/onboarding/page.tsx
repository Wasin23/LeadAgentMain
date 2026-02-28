'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import CompanyProfile from '@/components/onboarding/company-profile'
import AgentSetup from '@/components/onboarding/agent-setup'
import CalendarSetup from '@/components/onboarding/calendar-setup'

type OnboardingStage = 'loading' | 'company-profile' | 'agent-setup' | 'calendar-setup' | 'done'

export default function OnboardingPage() {
  const router = useRouter()
  const [stage, setStage] = useState<OnboardingStage>('loading')

  useEffect(() => {
    const init = async () => {
      try {
        // Load any saved progress
        let saved: { hasCompanyProfile?: boolean; hasAgentSetup?: boolean; hasCalendar?: boolean } = {}
        try {
          const raw = localStorage.getItem('onboardingProgress')
          if (raw) saved = JSON.parse(raw)
        } catch {}

        // Check company profile from server
        let hasProfile = saved.hasCompanyProfile ?? false
        if (!hasProfile) {
          const r = await api.get('/api/company-profile/check')
          hasProfile = r.data?.hasProfile ?? false
        }

        if (!hasProfile) {
          setStage('company-profile')
          return
        }

        // Company done — go to agent setup unless already done
        if (!saved.hasAgentSetup) {
          setStage('agent-setup')
          return
        }

        // Agent done — calendar last
        if (!saved.hasCalendar) {
          setStage('calendar-setup')
          return
        }

        // All done
        router.replace('/home')
      } catch {
        // On error, start from beginning
        setStage('company-profile')
      }
    }
    init()
  }, [router])

  const saveProgress = (update: Record<string, boolean>) => {
    try {
      const raw = localStorage.getItem('onboardingProgress')
      const prev = raw ? JSON.parse(raw) : {}
      localStorage.setItem('onboardingProgress', JSON.stringify({ ...prev, ...update }))
    } catch {}
  }

  const handleCompanyProfileComplete = () => {
    saveProgress({ hasCompanyProfile: true })
    setStage('agent-setup')
  }

  const handleAgentSetupComplete = () => {
    saveProgress({ hasAgentSetup: true })
    setStage('calendar-setup')
  }

  const handleAgentSetupSkip = () => {
    saveProgress({ hasAgentSetup: true })
    setStage('calendar-setup')
  }

  const handleCalendarComplete = () => {
    saveProgress({ hasCalendar: true })
    localStorage.removeItem('onboardingProgress')
    router.replace('/home')
  }

  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-[#4FD1FF] border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-[#A3B4CC] text-lg">Loading your setup...</p>
        </div>
      </div>
    )
  }

  if (stage === 'company-profile') {
    return <CompanyProfile onComplete={handleCompanyProfileComplete} />
  }

  if (stage === 'agent-setup') {
    return <AgentSetup onComplete={handleAgentSetupComplete} onSkip={handleAgentSetupSkip} />
  }

  if (stage === 'calendar-setup') {
    return <CalendarSetup onComplete={handleCalendarComplete} />
  }

  return null
}
