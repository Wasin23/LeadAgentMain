'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bot, Play, Square, Zap, Mail, MessageSquare, Clock, Cpu,
  ExternalLink, Trash2, Send, TrendingUp,
  AlertCircle, CheckCircle2, PauseCircle, Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
    emailBuilder?: { length?: string; callToAction?: string; rebumpIntervalDays?: number }
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
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PERSONALITY_COLORS: Record<string, string> = {
  hunter:              'border-orange-500/40',
  'relationship-builder': 'border-green-500/40',
  analyst:             'border-blue-500/40',
  consultant:          'border-purple-500/40',
  networker:           'border-pink-500/40',
}

const PERSONALITY_BADGE: Record<string, string> = {
  hunter:              'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'relationship-builder': 'bg-green-500/15 text-green-400 border-green-500/30',
  analyst:             'bg-blue-500/15 text-blue-400 border-blue-500/30',
  consultant:          'bg-purple-500/15 text-purple-400 border-purple-500/30',
  networker:           'bg-pink-500/15 text-pink-400 border-pink-500/30',
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
  busy,
}: {
  agent: Agent
  onStart: (id: string) => void
  onStop: (id: string) => void
  onRunCycle: (id: string) => void
  onDelete: (id: string, name: string) => void
  busy: boolean
}) {
  const personalityType = agent.personality?.type ?? 'hunter'
  const avatar = agent.personality?.avatar ?? '🤖'
  const personalityName = agent.personality?.name ?? personalityType
  const gradientClass = PERSONALITY_COLORS[personalityType] ?? PERSONALITY_COLORS.hunter
  const badgeClass = PERSONALITY_BADGE[personalityType] ?? PERSONALITY_BADGE.hunter
  const isRunning = agent.isRunning || agent.status === 'running'
  const replyRate = agent.replyRate ?? (agent.sent && agent.sent > 0 ? parseFloat(((agent.replied ?? 0) / agent.sent * 100).toFixed(1)) : 0)

  // Link to old per-agent dashboard
  const oldDashUrl = `http://localhost:3001/agents/${agent.agentId}`

  return (
    <Card className={cn(
      'relative p-5 border transition-all duration-300 hover:shadow-lg hover:shadow-primary/5',
      gradientClass,
    )}>
      {/* running pulse */}
      {isRunning && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
      )}

      {/* header row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl bg-background/60 border border-border shrink-0 overflow-hidden">
          {avatar.startsWith('/') || avatar.startsWith('http') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={personalityName} className="w-full h-full object-cover rounded-xl" />
          ) : (
            avatar
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{agent.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', badgeClass)}>
              {personalityName}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0', isRunning
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : 'bg-muted text-muted-foreground border-muted-foreground/20'
              )}
            >
              {isRunning ? (
                <><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Running</>
              ) : (
                <><PauseCircle className="w-2.5 h-2.5 mr-1" />Idle</>
              )}
            </Badge>
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
        if (!presetName && tags.length === 0) return null
        return (
          <div className="mb-4 space-y-1.5">
            {presetName && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Zap className="w-3 h-3 text-primary shrink-0" />
                <span className="font-medium text-foreground">{presetName}</span>
                {leadLimit && <span className="ml-auto text-muted-foreground">{leadLimit} leads/cycle</span>}
              </div>
            )}
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
      {agent.specialInstructions && (
        <p className="text-[11px] text-muted-foreground italic mb-4 line-clamp-2 border-l-2 border-border pl-2">
          {agent.specialInstructions}
        </p>
      )}

      {/* action row */}
      <div className="flex items-center gap-2 flex-wrap">
        {isRunning ? (
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
          disabled={busy || !isRunning}
          title={!isRunning ? 'Start the agent first' : 'Force-run one cycle now'}
          onClick={() => onRunCycle(agent.agentId)}
        >
          <Zap className="w-3 h-3" /> Run Cycle
        </Button>

        <a
          href={oldDashUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto"
        >
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <ExternalLink className="w-3 h-3" /> Dashboard
          </Button>
        </a>

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
    </Card>
  )
}

// ── delete confirm modal ──────────────────────────────────────────────────────
function DeleteModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="p-6 max-w-sm w-full mx-4 space-y-4">
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
export function AgentsContent({ highlightAgentId }: { highlightAgentId?: string } = {}) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
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

  useEffect(() => { loadAgents() }, [loadAgents])

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

  const summaryCards = [
    { label: 'Total Agents',   value: loading ? '—' : totalAgents,  icon: Bot,          accent: 'text-primary',    bg: 'bg-primary/10' },
    { label: 'Running',        value: loading ? '—' : runningCount, icon: Cpu,          accent: 'text-green-400',  bg: 'bg-green-500/10' },
    { label: 'Total Sent',     value: loading ? '—' : totalSent.toLocaleString(),    icon: Send,   accent: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Queued',   value: loading ? '—' : totalQueued.toLocaleString(),  icon: Mail,   accent: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: 'Total Replies',  value: loading ? '—' : totalReplied.toLocaleString(), icon: MessageSquare, accent: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Reply Rate',     value: loading ? '—' : `${overallReplyRate}%`,        icon: TrendingUp,   accent: 'text-orange-400', bg: 'bg-orange-500/10' },
  ]

  // ── loading skeleton ───────────────────────────────────────────────────────
  const skeletonCards = Array.from({ length: 3 })

  return (
    <div className="space-y-5">
      {/* toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border animate-slide-in-up',
          toast.type === 'success'
            ? 'bg-green-500/15 border-green-500/30 text-green-400'
            : 'bg-destructive/15 border-destructive/30 text-destructive'
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
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
          <h2 className="text-sm font-semibold text-foreground">
            {loading ? 'Loading agents…' : `${totalAgents} Agent${totalAgents !== 1 ? 's' : ''}`}
          </h2>
          <p className="text-xs text-muted-foreground">{runningCount} currently active</p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => window.open('http://localhost:3001/setup', '_blank')}
        >
          <Plus className="w-3.5 h-3.5" /> New Agent
        </Button>
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
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => window.open('http://localhost:3001/setup', '_blank')}
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
                busy={!!busy[agent.agentId]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
