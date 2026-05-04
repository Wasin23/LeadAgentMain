'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import CompanyProfile from '@/components/onboarding/company-profile'
import AgentSetup from '@/components/onboarding/agent-setup'
import GlobeBackground from '@/components/onboarding/globe-background'

type OnboardingStage = 'loading' | 'team-prompt' | 'company-profile' | 'agent-setup' | 'done'

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
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-8">
      <GlobeBackground />
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <svg width="36" height="36" viewBox="0 0 48 48" className="drop-shadow-lg">
            <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
          </svg>
          <span className="text-2xl font-bold text-white tracking-tight">Meridian</span>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 w-full space-y-4">
          <div>
            <h2 className="text-white font-semibold text-base">Joining a team?</h2>
            <p className="text-white/60 text-sm mt-1 leading-relaxed">
              If someone invited you to their Meridian seat, paste the invite code below.
              You&apos;ll share their agents, contacts, and credits.
            </p>
          </div>

          {preview && (
            <div className="px-3 py-2 bg-white/10 border border-white/20 text-xs text-white">
              <span className="font-medium">{preview.name}</span>
              <span className="text-white/60 ml-2">· {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {error && <p className="text-red-300 text-xs">{error}</p>}

          <input
            type="text"
            placeholder="Invite code or link"
            value={code}
            onChange={e => {
              const val = e.target.value
              const match = val.match(/[?&]join=([^&]+)/)
              setCode(match ? match[1] : val)
            }}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 px-3 py-2 text-sm outline-none focus:border-white/50 transition-colors"
          />

          <button
            onClick={handleJoin}
            disabled={joining || !code.trim()}
            className="w-full py-2 text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {joining ? 'Joining…' : 'Join team'}
          </button>
        </div>

        <button
          onClick={onSkip}
          className="text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          No, I&apos;m setting up my own account →
        </button>
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
          setStage('company-profile')
          return
        }

        if (!saved.hasAgentSetup) {
          setStage('agent-setup')
          return
        }

        router.replace('/home')
      } catch {
        setStage('team-prompt')
      }
    }
    init()
  }, [router, searchParams])

  const saveProgress = (update: Record<string, boolean>) => {
    try {
      const raw = localStorage.getItem('onboardingProgress')
      const prev = raw ? JSON.parse(raw) : {}
      localStorage.setItem('onboardingProgress', JSON.stringify({ ...prev, ...update }))
    } catch {}
  }

  const handleTeamJoined = () => {
    // Joined a team — no need to set up their own profile
    localStorage.removeItem('onboardingProgress')
    router.replace('/home')
  }

  const handleTeamSkip = () => {
    setStage('company-profile')
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

  if (stage === 'team-prompt') {
    return <TeamPrompt onSkip={handleTeamSkip} onJoined={handleTeamJoined} />
  }

  if (stage === 'company-profile') {
    return <CompanyProfile onComplete={handleCompanyProfileComplete} />
  }

  if (stage === 'agent-setup') {
    return <AgentSetup onComplete={handleAgentSetupComplete} onSkip={handleAgentSetupSkip} />
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
