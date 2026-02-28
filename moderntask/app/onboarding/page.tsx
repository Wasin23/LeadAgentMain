'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import CompanyProfile from '@/components/onboarding/company-profile'

type OnboardingStage = 'loading' | 'company-profile' | 'done'

export default function OnboardingPage() {
  const router = useRouter()
  const [stage, setStage] = useState<OnboardingStage>('loading')

  useEffect(() => {
    const init = async () => {
      try {
        // Check company profile from server
        const r = await api.get('/api/company-profile/check')
        const hasProfile = r.data?.hasProfile ?? false

        if (!hasProfile) {
          setStage('company-profile')
          return
        }

        // Profile exists, go to home
        router.replace('/home')
      } catch {
        // On error, start from beginning
        setStage('company-profile')
      }
    }
    init()
  }, [router])

  const handleCompanyProfileComplete = () => {
    // Clear any old progress and go to home
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

  return null
}
