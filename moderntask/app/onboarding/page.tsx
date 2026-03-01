'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import CompanyProfile from '@/components/onboarding/company-profile'
import AgentSetup from '@/components/onboarding/agent-setup'
import GlobeBackground from '@/components/onboarding/globe-background'

type OnboardingStage = 'loading' | 'company-profile' | 'agent-setup' | 'done'

export default function OnboardingPage() {
  const router = useRouter()
  const [stage, setStage] = useState<OnboardingStage>('loading')

  useEffect(() => {
    const init = async () => {
      try {
        // Load any saved progress
        let saved: { hasCompanyProfile?: boolean; hasAgentSetup?: boolean } = {}
        try {
          const raw = localStorage.getItem('onboardingProgress')
          if (raw) saved = JSON.parse(raw)
        } catch {}

        // Always check company profile from server (don't trust localStorage — stale after account deletion)
        let hasProfile = false
        try {
          const r = await api.get('/api/company-profile/check')
          hasProfile = r.data?.hasProfile ?? false
        } catch {
          hasProfile = saved.hasCompanyProfile ?? false
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
    localStorage.removeItem('onboardingProgress')
    router.replace('/home')
  }

  const handleAgentSetupSkip = () => {
    localStorage.removeItem('onboardingProgress')
    router.replace('/home')
  }

  if (stage === 'loading') {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center gap-8">
        <GlobeBackground />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="flex items-center gap-3 mb-2">
            <svg width="44" height="44" viewBox="0 0 48 48" className="drop-shadow-lg">
              <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
            </svg>
            <span className="text-3xl font-bold text-white tracking-tight">Meridian</span>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white/70 text-base font-medium">Loading your setup…</p>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {(['Company Profile', 'Agent Setup'] as const).map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                <span className="text-white/60 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
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

  return null
}
