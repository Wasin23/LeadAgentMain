'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bot, Play, Square, Zap, Mail, MessageSquare, Clock, Cpu,
  ExternalLink, Trash2, Send, TrendingUp, MoreHorizontal,
  AlertCircle, CheckCircle2, PauseCircle, Plus, X, Settings, Crown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ── types ────────────────────────────────────────────────────────────────────
interface Agent {
  agentId: string
  name: string
  status: string              // 'active' | 'running' | 'stopped'
  createdAt: string
  lastRun: string | null
  nextCycleTime?: string | null
  personality?: {
    type?: string
    name?: string
    avatar?: string
    color?: string
    traits?: string[]
  }
  settings?: {
    dailyLimit?: number
    maxEmails?: number
    appliedPresetId?: string
    appliedPresetName?: string
    companyCriteria?: { companyIndustries?: string[]; companySizeMin?: number | null; companySizeMax?: number | null }
    contactCriteria?: { targetPositions?: string[] }
    geographicSettings?: { leadLimit?: number | null }
    emailBuilder?: { length?: string; callToAction?: string; rebumpIntervalDays?: number; useLinkedIn?: boolean }
    concurrencyLevel?: number
    [key: string]: unknown
  }
  specialInstructions?: string
  // enriched counts
  queued?: number
  sent?: number
  replied?: number
  replyRate?: number
  // live status from SSE/polling
  isRunning?: boolean
  isCrmMode?: boolean   // true when agent is reserved for Auditor / CRM outreach
}

interface PlanStatusResponse {
  plan?: {
    id?: string
    name?: string
    maxAgents?: number
    maxConcurrency?: number
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PERSONALITY_COLORS: Record<string, string> = {
  hunter:              'border-red-600/40',
  'relationship-builder': 'border-green-600/40',
  analyst:             'border-blue-600/40',
  consultant:          'border-purple-600/40',
  networker:           'border-orange-500/40',
}

// Full, solid, generic colors for the personality ribbon — no translucency.
const PERSONALITY_RIBBON: Record<string, string> = {
  hunter:              'bg-red-600',
  'relationship-builder': 'bg-green-600',
  analyst:             'bg-blue-600',
  consultant:          'bg-purple-600',
  networker:           'bg-orange-500',
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── stat mini card ────────────────────────────────────────────────────────────
function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-muted/40">
      <span className={cn('text-sm font-semibold', accent ?? 'text-foreground')}>{value}</span>
      <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
    </div>
  )
}

// ── agent card ────────────────────────────────────────────────────────────────
function AgentCard({
  agent,
  onStart,
  onStop,
  onRunCycle,
  onDelete,
  onSettingsChange,
  busy,
  maxConcurrencyLimit,
  allAgents,
  onCopySettings,
}: {
  agent: Agent
  onStart: (id: string) => void
  onStop: (id: string) => void
  onRunCycle: (id: string) => void
  onDelete: (id: string, name: string) => void
  onSettingsChange: (id: string) => void
  busy: boolean
  maxConcurrencyLimit: number
  allAgents: Agent[]
  onCopySettings: (fromAgentId: string, toAgentId: string) => void
}) {
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const { toast } = useToast()
  const personalityType = agent.personality?.type ?? 'hunter'
  const avatar = agent.personality?.avatar ?? null
  const personalityName = agent.personality?.name ?? personalityType
  const ribbonLabel = personalityName.replace(/^The\s+/i, '')
  const gradientClass = PERSONALITY_COLORS[personalityType] ?? PERSONALITY_COLORS.hunter
  const ribbonClass = PERSONALITY_RIBBON[personalityType] ?? PERSONALITY_RIBBON.hunter
  const isRunning = agent.isRunning || agent.status === 'running'
  const isAuditor = !!agent.isCrmMode
  const replyRate = agent.replyRate ?? (agent.sent && agent.sent > 0 ? parseFloat(((agent.replied ?? 0) / agent.sent * 100).toFixed(1)) : 0)

  const [editingConcurrency, setEditingConcurrency] = useState(false)
  const [concurrencyDraft, setConcurrencyDraft] = useState(agent.settings?.concurrencyLevel ?? 1)
  const saveConcurrency = async (val: number) => {
    const clamped = Math.min(maxConcurrencyLimit, Math.max(1, val || 1))
    setConcurrencyDraft(clamped)
    setEditingConcurrency(false)
    try {
      await api.post('/api/lead-agent/settings', { ...(agent.settings ?? {}), agentId: agent.agentId, concurrencyLevel: clamped })
      onSettingsChange(agent.agentId)
    } catch (error: any) {
      toast({ title: 'Failed to update concurrency', description: error?.response?.data?.error, variant: 'destructive', duration: 4000 })
    }
  }

  // Link to per-agent dashboard page
  const dashUrl = `/agents/${agent.agentId}`

  return (
    <div className={cn(
      'relative rounded-2xl p-5 border bg-card transition-colors overflow-hidden flex flex-col h-full',
      gradientClass,
      isAuditor && 'opacity-60',
    )}>
      {/* personality ribbon - bookmark-style banner hanging from the top-right corner.
          The clipped shape and the text are separate layers: clip-path forces a
          rasterized composite layer, which blurs any text drawn inside it, so the
          label is rendered as an unclipped sibling on top instead. The wrapper has
          no explicit size — it sizes to the (unclipped, in-flow) text underneath. */}
      <div className="absolute top-0 right-5 z-10">
        <div className="relative">
          <div
            className={cn('absolute inset-0 shadow-sm', ribbonClass)}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)' }}
          />
          <div className="relative px-3 pt-1.5 pb-2.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {ribbonLabel}
          </div>
        </div>
      </div>

      {/* header row */}
      <div className="flex items-start gap-3 mb-4 pr-16">
        <div className="relative text-2xl w-10 h-10 flex items-center justify-center rounded-xl bg-background/60 border border-border shrink-0 overflow-hidden">
          {avatar && (avatar.startsWith('/') || avatar.startsWith('http')) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={personalityName} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <Bot className="w-5 h-5 text-muted-foreground" />
          )}
          {isRunning && !isAuditor && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{agent.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {isAuditor && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-yellow-500 text-white border-yellow-600">
                <Bot className="w-2.5 h-2.5 mr-1" />Auditor
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0', isRunning
                ? 'bg-green-600 text-white border-green-700'
                : 'bg-muted text-muted-foreground border-muted-foreground/20'
              )}
            >
              {isRunning ? (
                <><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Running</>
              ) : (
                <><PauseCircle className="w-2.5 h-2.5 mr-1" />Idle</>
              )}
            </Badge>
            <span
              title={agent.settings?.emailBuilder?.useLinkedIn ? 'LinkedIn enabled' : 'LinkedIn not connected'}
              className={cn('inline-flex items-center', !agent.settings?.emailBuilder?.useLinkedIn && 'opacity-25')}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="4" fill="#0A66C2"/>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" fill="white"/>
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        <StatPill label="Queued"  value={agent.queued  ?? 0} />
        <StatPill label="Sent"    value={agent.sent    ?? 0} accent="text-purple-400" />
        <StatPill label="Replied" value={agent.replied ?? 0} accent="text-green-400" />
        <StatPill label="Reply%" value={`${replyRate}%`} accent="text-blue-400" />
      </div>

      {/* meta row */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
        <Clock className="w-3 h-3 shrink-0" />
        <span>Last run: <span className="text-foreground font-medium">{timeAgo(agent.lastRun)}</span></span>
        {agent.nextCycleTime && (
          <>
            <span className="text-border">·</span>
            <span>Next: <span className="text-foreground font-medium">{agent.nextCycleTime}</span></span>
          </>
        )}
      </div>

      {/* preset / targeting tags */}
      {(() => {
        const industries: string[] = agent.settings?.companyCriteria?.companyIndustries ?? []
        const positions: string[]  = agent.settings?.contactCriteria?.targetPositions ?? []
        const presetName: string   = agent.settings?.appliedPresetName ?? ''
        const leadLimit: number | null = agent.settings?.geographicSettings?.leadLimit ?? null
        const tags = [...industries.slice(0, 2), ...positions.slice(0, 2)]
        return (
          <div className="mb-4 space-y-1.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {presetName && <>
                  <Zap className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-medium text-foreground">{presetName}</span>
                </>}
                {leadLimit && <span className={cn('text-muted-foreground', presetName ? 'ml-auto' : '')}>{leadLimit} leads/cycle</span>}
                <span className="flex items-center gap-0.5 ml-auto">
                  {editingConcurrency ? (
                    <input
                      type="number" min={1} max={maxConcurrencyLimit} autoFocus
                      value={concurrencyDraft}
                      className="w-10 text-center text-[10px] bg-background border border-border rounded px-0.5 focus:outline-none"
                      onChange={e => setConcurrencyDraft(Math.min(maxConcurrencyLimit, parseInt(e.target.value) || 1))}
                      onBlur={() => saveConcurrency(concurrencyDraft)}
                      onKeyDown={e => { if (e.key === 'Enter') saveConcurrency(concurrencyDraft); if (e.key === 'Escape') setEditingConcurrency(false) }}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingConcurrency(true)}
                      className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      title="Speed – click to edit"
                    >
                      <Cpu className="w-2.5 h-2.5" />{concurrencyDraft}×
                    </button>
                  )}
                </span>
              </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border/50">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* special instructions snippet */}
      {agent.specialInstructions && typeof agent.specialInstructions === 'string' && (
        <p className="text-[11px] text-muted-foreground italic mb-4 line-clamp-2 border-l-2 border-border pl-2">
          {agent.specialInstructions}
        </p>
      )}

      {/* action row — pinned to the bottom of the card (via mt-auto on this flex-col
          card) so it lines up across cards even when the content above it varies in
          height (special instructions, tag count, etc.) */}
      <div className="flex items-center gap-2 flex-wrap mt-auto pt-4">
        {isAuditor ? (
          <span className="text-[11px] text-yellow-400/80 italic">Agent reserved for Auditor Mode. Stop the auditor to use normally.</span>
        ) : isRunning ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
            disabled={busy}
            onClick={() => onStop(agent.agentId)}
          >
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90"
            disabled={busy}
            onClick={() => onStart(agent.agentId)}
          >
            <Play className="w-3 h-3" /> Start
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          disabled={busy || !isRunning || isAuditor}
          title={!isRunning ? 'Start the agent first' : 'Force-run one cycle now'}
          onClick={() => onRunCycle(agent.agentId)}
        >
          <Zap className="w-3 h-3" /> Run Cycle
        </Button>

        <a
          href={dashUrl}
          className="ml-auto"
        >
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <ExternalLink className="w-3 h-3" /> Dashboard
          </Button>
        </a>

        <a href={`/agents/${agent.agentId}/settings`}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Agent settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </a>

        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowCopyMenu(v => !v)}
            title="More actions"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
          {showCopyMenu && (
            <div className="absolute right-0 top-8 z-20 w-52 rounded-md border border-border bg-popover shadow-lg py-1">
              <p className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">Copy settings to…</p>
              {allAgents.filter(a => a.agentId !== agent.agentId).length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No other agents</p>
              ) : allAgents.filter(a => a.agentId !== agent.agentId).map(a => (
                <button
                  key={a.agentId}
                  onClick={() => { onCopySettings(agent.agentId, a.agentId); setShowCopyMenu(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(agent.agentId, agent.name)}
          title="Delete agent"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── personality definitions (mirrors frontend exactly) ───────────────────────
const PERSONALITIES = [
  {
    id: 'hunter',
    name: 'The Hunter',
    description: 'Aggressive prospector focused on high-volume outreach and quick conversions',
    avatar: '/avatars/Hunter.png',
    traits: ['High-energy', 'Results-driven', 'Persistent', 'Direct communication'],
    emailStyle: 'Bold, action-oriented, creates urgency',
    prompt: `You are The Hunter - a high-energy, results-driven AI sales agent. Your approach is direct, persistent, and focused on quick conversions.`,
    color: 'red',
    ringStyle: 'linear-gradient(135deg, #f87171, #ea580c)',
    pillStyle: 'linear-gradient(135deg, #ef4444, #dc2626)',
  },
  {
    id: 'relationship-builder',
    name: 'The Relationship Builder',
    description: 'Warm, consultative approach focused on building long-term partnerships',
    avatar: '/avatars/Relationship-Builder.png',
    traits: ['Empathetic', 'Patient', 'Consultative', 'Trust-focused'],
    emailStyle: 'Warm, personal, relationship-focused',
    prompt: `You are The Relationship Builder - a warm, empathetic AI sales agent focused on building genuine, long-term partnerships.`,
    color: 'blue',
    ringStyle: 'linear-gradient(135deg, #60a5fa, #0891b2)',
    pillStyle: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
  },
  {
    id: 'analyst',
    name: 'The Analyst',
    description: 'Data-driven methodology with deep research and industry insights',
    avatar: '/avatars/Analyst.png',
    traits: ['Analytical', 'Research-heavy', 'Detail-oriented', 'Evidence-based'],
    emailStyle: 'Data-rich, insightful, credential-heavy',
    prompt: `You are The Analyst - a data-driven, research-focused AI sales agent who leads with insights and evidence.`,
    color: 'purple',
    ringStyle: 'linear-gradient(135deg, #c084fc, #db2777)',
    pillStyle: 'linear-gradient(135deg, #a855f7, #ec4899)',
  },
  {
    id: 'consultant',
    name: 'The Consultant',
    description: 'Solution-focused industry expert who positions as a strategic advisor',
    avatar: '/avatars/consultant.png',
    traits: ['Advisory', 'Solution-focused', 'Industry expert', 'Strategic'],
    emailStyle: 'Advisory, strategic, solution-oriented',
    prompt: `You are The Consultant - a strategic advisor and industry expert who positions yourself as a trusted consultant.`,
    color: 'green',
    ringStyle: 'linear-gradient(135deg, #4ade80, #0d9488)',
    pillStyle: 'linear-gradient(135deg, #22c55e, #14b8a6)',
  },
  {
    id: 'networker',
    name: 'The Networker',
    description: 'LinkedIn-heavy, connection-based approach leveraging mutual contacts',
    avatar: '/avatars/Networker.png',
    traits: ['Social', 'Connection-focused', 'Community-driven', 'Referral-based'],
    emailStyle: 'Social, community-focused, leverages connections',
    prompt: `You are The Networker - a socially-savvy AI sales agent who leverages connections, community, and referrals.`,
    color: 'indigo',
    ringStyle: 'linear-gradient(135deg, #818cf8, #7c3aed)',
    pillStyle: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
] as const

type PersonalityDef = typeof PERSONALITIES[number]

// ── create agent modal - exact replica of InfoDashboard personality modal ─────
function CreateAgentModal({ onClose, onCreated, atLimit = false }: { onClose: () => void; onCreated: () => void; atLimit?: boolean }) {
  const router = useRouter()

  if (atLimit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-modal-swoop-backdrop">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center gap-4 animate-modal-swoop-up">
          <div className="w-14 h-14 rounded-full bg-green-900/20 border border-green-800/30 flex items-center justify-center">
            <Crown className="w-7 h-7 text-green-700 dark:text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Add More Agent Plans</h2>
            <p className="text-sm text-muted-foreground mt-2">To create additional agents, you&apos;ll need to upgrade your plan.</p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
            <Button className="flex-1 bg-green-800 hover:bg-green-900 dark:bg-green-700 dark:hover:bg-green-800 text-white" onClick={() => { onClose(); router.push('/settings?tab=billing&upgrade=plans') }}>See Plans</Button>
          </div>
        </div>
      </div>
    )
  }
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')
  const [showPresetSelection, setShowPresetSelection] = useState(false)
  const [specialInstructions, setSpecialInstructions] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [presets, setPresets] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedPreset, setSelectedPreset] = useState<any>(null)
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planStatus, setPlanStatus] = useState<PlanStatusResponse | null>(null)
  const [agentCount, setAgentCount] = useState(0)

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/plans/status'),
      api.get('/api/auth/agents'),
    ]).then(([planRes, agentsRes]) => {
      if (planRes.status === 'fulfilled' && planRes.value.data?.success) {
        setPlanStatus(planRes.value.data)
      }
      if (agentsRes.status === 'fulfilled') {
        setAgentCount((agentsRes.value.data?.agents ?? []).length)
      }
    }).catch(() => {})
  }, [])

  const maxAgents = planStatus?.plan?.maxAgents ?? 0
  const maxConcurrency = planStatus?.plan?.maxConcurrency ?? 0
  const planName = planStatus?.plan?.name ?? 'Current plan'
  const atAgentLimit = maxAgents > 0 && agentCount >= maxAgents
  const tierRows = [
    { name: 'Free Trial', agents: 1, speed: 3 },
    { name: 'Basic', agents: 3, speed: 5 },
    { name: 'Starter', agents: 5, speed: 10 },
    { name: 'Professional', agents: 10, speed: 20 },
    { name: 'Enterprise', agents: 30, speed: 30 },
  ]

  const fetchPresets = async () => {
    setLoadingPresets(true)
    try {
      const r = await api.get('/api/settings/presets')
      const data = Array.isArray(r.data) ? r.data : (r.data?.presets || r.data?.data || [])
      setPresets(data)
    } catch { setPresets([]) }
    finally { setLoadingPresets(false) }
  }

  const handleCreate = async () => {
    if (atAgentLimit) {
      setError(`You are already using ${agentCount}/${maxAgents} agents on ${planName}. Upgrade your plan to add more.`)
      return
    }
    if (!agentName.trim() || !selectedPersonalityId) return
    setIsCreating(true)
    setError(null)
    const personality = PERSONALITIES.find(p => p.id === selectedPersonalityId)!
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        name: agentName.trim(),
        type: 'reasoning-lead-agent',
        specialInstructions: specialInstructions.trim() || selectedPreset?.specialInstructions || '',
        personality: {
          type: personality.id,
          name: personality.name,
          description: personality.description,
          avatar: personality.avatar,
          emailPrompt: personality.prompt,
          emailStyle: personality.emailStyle,
          traits: [...personality.traits],
          color: personality.color,
        },
      }
      if (selectedPreset) {
        body.preset = {
          presetId: selectedPreset._id || selectedPreset.id,
          name: selectedPreset.name,
          targetIndustries: selectedPreset.targetIndustries,
          targetPositions: selectedPreset.targetPositions,
          companySizeMin: selectedPreset.companySizeMin,
          companySizeMax: selectedPreset.companySizeMax,
          leadLimit: selectedPreset.leadLimit,
          emailLength: selectedPreset.emailLength,
          callToAction: selectedPreset.callToAction,
          personalizationLevel: selectedPreset.personalizationLevel,
          ccEmails: selectedPreset.ccEmails,
          bccEmails: selectedPreset.bccEmails,
          followupIntervalDays: selectedPreset.followupIntervalDays,
          enableAutoResponse: selectedPreset.enableAutoResponse,
          useCustomSignature: selectedPreset.useCustomSignature,
          signatureName: selectedPreset.signatureName,
          signatureTitle: selectedPreset.signatureTitle,
        }
      }
      const res = await api.post('/api/auth/create-agent', body)
      if (res.data?.success) { onCreated(); onClose() }
      else setError(res.data?.message || res.data?.error || 'Failed to create agent.')
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to create agent.')
    } finally { setIsCreating(false) }
  }

  // gradientStyle removed - now using p.ringStyle and p.pillStyle directly

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-modal-swoop-backdrop">
      <div className="bg-background border border-border rounded-xl shadow-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-modal-swoop-up">

        {maxAgents > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-muted/35 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Current plan limits</p>
                <h3 className="text-sm font-semibold text-foreground mt-1">{planName}: {agentCount}/{maxAgents} agents used</h3>
                <p className="text-xs text-muted-foreground mt-1">Each agent is its own AI worker with separate personality, targeting, and outreach settings. Concurrency is how many leads one agent researches in parallel per cycle.</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => router.push('/settings?tab=billing&upgrade=plans')}>
                Upgrade Plan
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
              <div className="rounded-lg border border-border bg-background px-3 py-2">Your plan: up to {maxAgents} agent{maxAgents === 1 ? '' : 's'} and {maxConcurrency}x concurrency</div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">Higher tiers unlock more parallel research and more separate agents</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
              {tierRows.map((tier) => (
                <div key={tier.name} className="rounded-lg border border-border bg-background px-3 py-2 flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{tier.name}</span>
                  <span>{tier.agents} agents · {tier.speed}x</span>
                </div>
              ))}
            </div>

            {atAgentLimit && (
              <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                You are at your current agent limit. Upgrade your plan to create another agent.
              </div>
            )}
          </div>
        )}

        {/* ── PHASE 1: personality grid ── */}
        {!selectedPersonalityId && (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">Choose Your Agent&apos;s Personality</h2>
            <p className="text-muted-foreground mb-6">Select the personality type that best matches your outreach style</p>

            <div className="grid grid-cols-5 gap-4">
              {PERSONALITIES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersonalityId(p.id)}
                  className="relative p-5 rounded-xl text-center transition-all bg-muted/40 border border-border shadow-sm hover:shadow-md hover:border-primary/50 hover:bg-muted hover:scale-105"
                >
                  <div className="relative mx-auto mb-4">
                    <div className="w-20 h-20 rounded-full p-[3px] mx-auto" style={{ background: p.ringStyle }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover bg-white" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold mb-2 text-foreground">{p.name}</h3>
                  <p className="text-[11px] mb-3 leading-relaxed text-muted-foreground">{p.description}</p>
                  <div className="space-y-1">
                    {p.traits.slice(0, 2).map((trait, idx) => (
                      <div key={idx} className="text-[10px] px-2 py-1 rounded-full font-medium text-white" style={{ background: p.pillStyle }}>
                        {trait}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all text-sm"
            >
              Cancel
            </button>
          </>
        )}

        {/* ── PHASE 2: name input ── */}
        {selectedPersonalityId && !showPresetSelection && (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">Name Your Agent</h2>
            <p className="text-muted-foreground mb-6">
              Choose a name for your {PERSONALITIES.find(p => p.id === selectedPersonalityId)?.name}
            </p>

            <input
              autoFocus
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="Enter agent name…"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              onKeyDown={e => {
                if (e.key === 'Enter' && agentName.trim()) {
                  setShowPresetSelection(true)
                  fetchPresets()
                }
              }}
            />

            <div className="mt-5">
              <label className="block text-sm font-medium text-foreground mb-2">Special Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                rows={3}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Only target fintech companies with Series B+ funding…"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none text-sm"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setSelectedPersonalityId(null); setAgentName(''); setSpecialInstructions('') }}
                className="px-6 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all text-sm"
              >
                Back
              </button>
              <button
                onClick={() => { if (!agentName.trim()) return; setShowPresetSelection(true); fetchPresets() }}
                disabled={!agentName.trim() || atAgentLimit}
                className="flex-1 px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-all text-sm"
              >
                {atAgentLimit ? 'Upgrade to Continue' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {/* ── PHASE 3: preset selection ── */}
        {selectedPersonalityId && showPresetSelection && (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">Choose a Preset (Optional)</h2>
            <p className="text-muted-foreground mb-6">Apply targeting settings to your agent</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            {loadingPresets ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
                <p className="mt-2 text-sm text-muted-foreground">Loading presets…</p>
              </div>
            ) : !Array.isArray(presets) || presets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-foreground font-medium mb-1">You haven&apos;t saved any presets yet</p>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">That&apos;s fine — presets are just reusable targeting templates you save later from an agent&apos;s settings. Hit &quot;Skip &amp; Create&quot; below to configure targeting directly on the agent instead.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto mb-6 p-2">
                {presets.map(preset => {
                  const pid = preset._id || preset.id
                  const spid = selectedPreset ? (selectedPreset._id || selectedPreset.id) : null
                  const isSelected = spid === pid
                  return (
                    <button
                      key={pid}
                      onClick={() => setSelectedPreset(preset)}
                      className={cn(
                        'relative text-left p-3 rounded-lg border-2 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50',
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <h3 className="text-foreground font-semibold mb-1 pr-8 text-sm">{preset.name}</h3>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {preset.targetIndustries?.length > 0 && (
                          <div>Industries: {preset.targetIndustries.slice(0, 2).join(', ')}{preset.targetIndustries.length > 2 ? '…' : ''}</div>
                        )}
                        {preset.targetPositions?.length > 0 && (
                          <div>Positions: {preset.targetPositions.slice(0, 2).join(', ')}{preset.targetPositions.length > 2 ? '…' : ''}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowPresetSelection(false); setSelectedPreset(null) }}
                disabled={isCreating}
                className="px-6 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all text-sm disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={() => atAgentLimit ? router.push('/settings?tab=billing&upgrade=plans') : handleCreate()}
                disabled={isCreating}
                className="flex-1 px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                {isCreating && <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />}
                {isCreating ? 'Creating…' : atAgentLimit ? 'Upgrade to Add Another Agent' : selectedPreset ? 'Create with Preset' : 'Skip & Create'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── delete confirm modal ──────────────────────────────────────────────────────
function DeleteModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-modal-swoop-backdrop">
      <Card className="p-6 max-w-sm w-full mx-4 space-y-4 animate-modal-swoop-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Delete Agent</h3>
            <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">{name}</span>? All agent data, settings, and email history will be permanently removed.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete Agent</Button>
        </div>
      </Card>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export function AgentsContent({ highlightAgentId, autoOpenCreate }: { highlightAgentId?: string; autoOpenCreate?: boolean } = {}) {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [planStatus, setPlanStatus] = useState<PlanStatusResponse | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    toast({ title: msg, variant: type === 'error' ? 'destructive' : 'default', duration: 2500 })
  }

  // ── fetch all agents + their email counts ──────────────────────────────────
  const loadAgents = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/agents')
      const raw: Agent[] = res.data?.agents ?? []

      // fetch per-agent counts + live status in parallel
      const enriched = await Promise.all(raw.map(async (agent) => {
        const [countsRes, statusRes] = await Promise.allSettled([
          api.get('/api/email-queue/counts', { params: { agentId: agent.agentId } }),
          api.get('/api/lead-agent/status',  { params: { agentId: agent.agentId } }),
        ])
        const c = countsRes.status === 'fulfilled' ? countsRes.value.data : {}
        const s = statusRes.status === 'fulfilled' ? statusRes.value.data : {}
        const sent    = c.sent    ?? 0
        const replied = c.replied ?? 0
        return {
          ...agent,
          queued:    c.queued    ?? 0,
          sent,
          replied,
          replyRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(1)) : 0,
          isRunning: s.isActive ?? s.data?.isActive ?? false,
          nextCycleTime: s.nextCycleIn ?? s.data?.nextCycleIn ?? agent.nextCycleTime ?? null,
        }
      }))

      setAgents(enriched)
    } catch (e) {
      console.error('[AGENTS] load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPlanStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/plans/status')
      if (res.data?.success) {
        setPlanStatus(res.data)
      }
    } catch {
      setPlanStatus(null)
    }
  }, [])

  useEffect(() => { loadAgents() }, [loadAgents])
  useEffect(() => { loadPlanStatus() }, [loadPlanStatus])

  // auto-open create modal when directed from home page
  useEffect(() => { if (autoOpenCreate) setShowCreate(true) }, [autoOpenCreate])

  // scroll to highlighted agent once agents are loaded
  useEffect(() => {
    if (!highlightAgentId || loading) return
    const el = document.getElementById(`agent-${highlightAgentId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightAgentId, loading])

  // ── actions ────────────────────────────────────────────────────────────────
  const setBusyFor = (id: string, val: boolean) => setBusy(p => ({ ...p, [id]: val }))

  const handleStart = async (agentId: string) => {
    setBusyFor(agentId, true)
    try {
      await api.post('/api/lead-agent/start', { agentId })
      showToast('Agent started')
      await loadAgents()
    } catch { showToast('Failed to start agent', 'error') }
    finally { setBusyFor(agentId, false) }
  }

  const handleStop = async (agentId: string) => {
    setBusyFor(agentId, true)
    try {
      await api.post('/api/lead-agent/stop', { agentId })
      showToast('Agent stopped')
      await loadAgents()
    } catch { showToast('Failed to stop agent', 'error') }
    finally { setBusyFor(agentId, false) }
  }

  const handleRunCycle = async (agentId: string) => {
    setBusyFor(agentId, true)
    try {
      await api.post('/api/lead-agent/run-cycle', { agentId })
      showToast('Cycle triggered')
    } catch { showToast('Failed to run cycle', 'error') }
    finally { setBusyFor(agentId, false) }
  }

  const handleCopySettings = async (fromAgentId: string, toAgentId: string) => {
    try {
      const currentRes = await api.get(`/api/lead-agent/settings?agentId=${fromAgentId}`)
      const source = currentRes.data?.settings || {}
      await api.post('/api/lead-agent/settings', { ...source, agentId: toAgentId })
      showToast('Settings copied')
    } catch {
      showToast('Failed to copy settings', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusyFor(deleteTarget.id, true)
    setDeleteTarget(null)
    try {
      // Remove agent record + wipe all agent data in parallel
      await Promise.allSettled([
        api.delete(`/api/auth/agents/${deleteTarget.id}`),
        api.delete('/api/lead-agent/agent-data', { params: { agentId: deleteTarget.id } }),
      ])
      showToast(`${deleteTarget.name} deleted`)
      setAgents(prev => prev.filter(a => a.agentId !== deleteTarget.id))
    } catch { showToast('Failed to delete agent', 'error') }
    finally { setBusyFor(deleteTarget.id, false) }
  }

  // ── summary stats ──────────────────────────────────────────────────────────
  const totalAgents  = agents.length
  const runningCount = agents.filter(a => a.isRunning || a.status === 'running').length
  const totalSent    = agents.reduce((acc, a) => acc + (a.sent ?? 0), 0)
  const totalQueued  = agents.reduce((acc, a) => acc + (a.queued ?? 0), 0)
  const totalReplied = agents.reduce((acc, a) => acc + (a.replied ?? 0), 0)
  const overallReplyRate = totalSent > 0 ? parseFloat(((totalReplied / totalSent) * 100).toFixed(1)) : 0
  const maxAgents = planStatus?.plan?.maxAgents ?? 0
  const maxConcurrency = planStatus?.plan?.maxConcurrency ?? 30
  const currentPlanName = planStatus?.plan?.name ?? 'Current plan'
  const hasPlanLimit = maxAgents > 0
  const atAgentLimit = hasPlanLimit && totalAgents >= maxAgents

  const summaryCards = [
    { label: 'Total Agents',   value: loading ? '-' : totalAgents,  icon: Bot,          accent: 'text-primary',    bg: 'bg-primary/10' },
    { label: 'Running',        value: loading ? '-' : runningCount, icon: Cpu,          accent: 'text-green-400',  bg: 'bg-green-500/10' },
    { label: 'Total Sent',     value: loading ? '-' : totalSent.toLocaleString(),    icon: Send,   accent: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Queued',   value: loading ? '-' : totalQueued.toLocaleString(),  icon: Mail,   accent: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: 'Total Replies',  value: loading ? '-' : totalReplied.toLocaleString(), icon: MessageSquare, accent: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Reply Rate',     value: loading ? '-' : `${overallReplyRate}%`,        icon: TrendingUp,   accent: 'text-orange-400', bg: 'bg-orange-500/10' },
  ]

  // ── loading skeleton ───────────────────────────────────────────────────────
  const skeletonCards = Array.from({ length: 3 })

  return (
    <div className="space-y-5">
      {/* create agent modal */}
      {showCreate && (
        <CreateAgentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { showToast('Agent created successfully!'); loadAgents() }}
          atLimit={atAgentLimit}
        />
      )}

      {/* delete confirm modal */}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground">
            {loading ? 'Loading agents…' : `${totalAgents} Agent${totalAgents !== 1 ? 's' : ''}`}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">{runningCount} currently active</p>
            {hasPlanLimit && (
              <>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  {currentPlanName}: {totalAgents}/{maxAgents} agents used
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  Up to {maxConcurrency}x concurrency
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={atAgentLimit ? 'default' : 'default'}
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-3.5 h-3.5" /> {atAgentLimit ? 'Add Agent' : 'New Agent'}
          </Button>
        </div>
      </div>

      {/* agent grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {skeletonCards.map((_, i) => (
            <Card key={i} className="p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="h-2.5 w-20 rounded bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-10 rounded-lg bg-muted" />)}
              </div>
              <div className="h-8 rounded-lg bg-muted" />
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="p-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Bot className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No agents yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create your first AI outreach agent to start generating leads automatically.
            </p>
            {hasPlanLimit && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{currentPlanName}</span>
                <span>{totalAgents}/{maxAgents} agents used</span>
                <span>·</span>
                <span>Up to {maxConcurrency}x concurrency</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Create your first agent
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div
              key={agent.agentId}
              id={`agent-${agent.agentId}`}
              className={cn(
                'rounded-xl transition-all duration-500',
                highlightAgentId === agent.agentId && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
            >
              <AgentCard
                agent={agent}
                onStart={handleStart}
                onStop={handleStop}
                onRunCycle={handleRunCycle}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
                onSettingsChange={loadAgents}
                busy={!!busy[agent.agentId]}
                maxConcurrencyLimit={maxConcurrency}
                allAgents={agents}
                onCopySettings={handleCopySettings}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
