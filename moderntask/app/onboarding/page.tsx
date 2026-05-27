'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import OnboardingFlow from '@/components/onboarding/onboarding-flow'
import { MeridianWordmark } from '@/components/ui/meridian-wordmark'
import { IllustrationTeam } from '@/components/onboarding/step-illustrations'

type OnboardingStage = 'loading' | 'team-prompt' | 'onboarding' | 'done'

function TeamPrompt({ onSkip, onJoined }: { onSkip: () => void; onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<{ name: string; memberCount: number } | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code || code.length < 10) { setPreview(null); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/api/teams/invite/${code.trim()}`)
        setPreview(r.data?.team || null)
        setError('')
      } catch {
        setPreview(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [code])

  async function handleJoin() {
    if (!code.trim()) return
    setJoining(true)
    setError('')
    try {
      const r = await api.post(`/api/teams/invite/${code.trim()}/accept`)
      // Store the fresh JWT so proxy is active before the redirect
      if (r.data.token) {
        localStorage.setItem('authToken', r.data.token)
        Cookies.set('authToken', r.data.token, { expires: 7 })
      }
      onJoined()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid invite code.')
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left: form panel */}
      <div className="relative z-10 w-full lg:w-[52%] bg-white min-h-screen flex flex-col">
        <div className="flex items-center gap-2 p-8 pb-0">
          <img src="/MeridianM.png" alt="Meridian" className="h-8 w-auto object-contain" />
          <MeridianWordmark className="h-3.5 w-auto text-gray-900" />
        </div>

        <div className="flex-1 flex flex-col justify-center px-12 py-8 max-w-lg mx-auto w-full space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Joining a team?</h2>
            <p className="text-base text-gray-500 leading-relaxed">
              If someone invited you to their Meridian seat, paste the invite code below.
              You&apos;ll share their agents, contacts, and credits.
            </p>
          </div>

          {preview && (
            <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              <span className="font-semibold">{preview.name}</span>
              <span className="text-gray-400 ml-2">· {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <input
            type="text"
            placeholder="Invite code or link"
            value={code}
            onChange={e => {
              const val = e.target.value
              const match = val.match(/[?&]join=([^&]+)/)
              setCode(match ? match[1] : val)
            }}
            className="w-full h-11 px-4 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors bg-white"
          />

          <button
            onClick={handleJoin}
            disabled={joining || !code.trim()}
            className="w-full h-11 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {joining ? 'Joining…' : 'Join team →'}
          </button>

          <button
            onClick={onSkip}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors text-left"
          >
            No, I&apos;m setting up my own account →
          </button>
        </div>
      </div>

      {/* Right: dark green panel */}
      <div className="hidden lg:flex lg:w-[48%] sticky top-0 h-screen bg-[#0d2b1e] items-center justify-center p-12">
        <IllustrationTeam />
      </div>
    </div>
  )
}

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stage, setStage] = useState<OnboardingStage>('loading')

  useEffect(() => {
    const init = async () => {
      try {
        // Fresh registration — wipe any stale onboarding cache so it can't skip the team-prompt
        const isNewRegistration = searchParams.get('new') === '1'
        if (isNewRegistration) localStorage.removeItem('onboardingProgress')

        let saved: { hasCompanyProfile?: boolean; hasAgentSetup?: boolean } = {}
        try {
          const raw = localStorage.getItem('onboardingProgress')
          if (raw) saved = JSON.parse(raw)
        } catch {}

        // If there's an invite token in the URL, jump straight to team prompt
        const inviteToken = searchParams.get('inviteToken') || searchParams.get('join')
        if (inviteToken) {
          setStage('team-prompt')
          return
        }

        // Check if already in a team — if so, skip onboarding entirely
        try {
          const teamRes = await api.get('/api/teams/me')
          if (teamRes.data?.team) {
            router.replace('/home')
            return
          }
        } catch {}

        // Check company profile from server
        let hasProfile = false
        try {
          const r = await api.get('/api/company-profile/check')
          hasProfile = r.data?.hasProfile ?? false
        } catch {
          hasProfile = saved.hasCompanyProfile ?? false
        }

        // Show team prompt only on fresh registration (?new=1), never for returning users
        if (!hasProfile && isNewRegistration) {
          setStage('team-prompt')
          return
        }

        if (!hasProfile) {
          setStage('onboarding')
          return
        }

        router.replace('/home')
      } catch {
        setStage('team-prompt')
      }
    }
    init()
  }, [router, searchParams])

  const handleTeamJoined = () => {
    // Joined a team — no need to set up their own profile
    localStorage.removeItem('onboardingProgress')
    router.replace('/home')
  }

  const handleTeamSkip = () => {
    setStage('onboarding')
  }

  const handleOnboardingComplete = () => {
    localStorage.removeItem('onboardingProgress')
    router.replace('/home')
  }

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex bg-white">
        <div className="relative z-10 w-full lg:w-[52%] bg-white flex flex-col items-start justify-center px-12 min-h-screen">
          <div className="flex items-center gap-2 mb-8">
            <img src="/MeridianM.png" alt="Meridian" className="h-8 w-auto object-contain" />
            <MeridianWordmark className="h-3.5 w-auto text-gray-900" />
          </div>
          <div className="w-8 h-8 border-[3px] border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="hidden lg:block lg:w-[48%] sticky top-0 h-screen bg-[#0d2b1e]" />
      </div>
    )
  }

  if (stage === 'team-prompt') {
    return <TeamPrompt onSkip={handleTeamSkip} onJoined={handleTeamJoined} />
  }

  if (stage === 'onboarding') {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />
  }

  return null
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  )
}
