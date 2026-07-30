'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Play, Square, RefreshCw, Bot, Mail, Clock,
  Activity,
  ChevronRight, ChevronDown, CheckCircle2, Send,
  Target, ExternalLink, User,
  UserCheck, Search, Settings, FileText, Users, Globe, Cpu,
  MoreHorizontal, Trash2, RotateCcw,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ── types ──────────────────────────────────────────────────────────────────
interface Agent {
  agentId: string
  name: string
  agentName?: string
  status: string
  currentActivity?: string
  personality?: { type?: string; avatar?: string }
  avatar?: string
  sent?: number
  replied?: number
  queued?: number
  nextCycleTime?: string | null
  lastRun?: string | null
  isCrmMode?: boolean
  targeting?: { location?: string; industry?: string; keywords?: string[] }
  emailStats?: { built: number; queued: number; sent: number }
  settings?: {
    companyCriteria?: { companyIndustries?: string[] }
    contactCriteria?: { targetPositions?: string[] }
    emailBuilder?: { useLinkedIn?: boolean }
    targeting?: { leadLimit?: number }
    geographicSettings?: { leadLimit?: number }
    concurrencyLevel?: number
  }
}

interface ActivityLog {
  id: string
  agentId: string
  agentName: string
  agentPersonality?: string
  message: string
  timestamp: number
  type?: string
  status?: string
  operation?: string
  data?: {
    score?: number
    tier?: string
    confidence?: string
    reasoning?: string
    strengths?: string[]
    weaknesses?: string[]
    recommendation?: string
    emailStrategy?: string
    citedEvidence?: number
    company?: string
    [key: string]: any
  }
}

interface PlanStatus {
  plan?: {
    maxConcurrency?: number
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

// Namespaced by userId (read from the same 'currentUser' record AuthContext writes on
// login) so logs never leak across accounts on a shared browser/machine.
function activityLogsStorageKey(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('currentUser')
    const userId = raw ? JSON.parse(raw)?.userId : null
    return userId ? `meridian_operations_logs_${userId}` : null
  } catch { return null }
}
function loadStoredActivityLogs(): ActivityLog[] {
  const key = activityLogsStorageKey()
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F]/gu
function stripEmoji(s: string) { return s.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim() }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

// ── countdown timer ─────────────────────────────────────────────────────
function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function tick() {
      const diff = Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000))
      if (diff === 0) { setLabel('starting…'); return }
      const m = Math.floor(diff / 60)
      const s = diff % 60
      setLabel(m > 0 ? `Next: ${m}m ${s}s` : `Next: ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])
  return <span className="text-[10px] text-muted-foreground/60 block truncate">{label}</span>
}

// ── "still working" indicator — fills the dead air between log events so a
// running agent never reads as stalled just because nothing's printed in a bit ──
function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="truncate">{label}</span>
    </div>
  )
}

// ── "Simplify" mode — collapses the feed down to milestone events only:
// leads found, a lead's final outcome (queued or failed/rejected), and
// cycle/agent start-stop boundaries. Hides the noisy in-between chatter
// (research-in-progress pings, rubric-build steps, CRM sync ticks, etc).
const IMPORTANT_OPERATIONS = new Set([
  'Lead Search', 'Lead Search Results', 'Parallel Processing',
  'Lead Qualification', 'Lead Complete',
  'Research Failed', 'Pre-Qualify Rejected', 'Qualification Failed', 'Lead Rejected',
  'Email Unlock Failed', 'No Email Settings', 'Email Build Failed', 'Pipeline Error',
  'Search Exhausted', 'Agent Started', 'Agent Stopped', 'Cycle Stopped', 'Cycle Failed', 'Process Complete',
])

// ── score badge — counts up from 0 on mount instead of just appearing ──────
function ScoreBadge({ score, tier }: { score: number; tier?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf: number
    const duration = 700
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * score))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])

  return (
    <span className={cn(
      'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums',
      score >= 70 ? 'bg-green-500/15 text-green-500' :
      score >= 40 ? 'bg-amber-500/15 text-amber-500' :
      'bg-red-500/15 text-red-500'
    )}>
      {display}/100{tier ? ` · ${tier}` : ''}
    </span>
  )
}

const STATUS_ACCENT: Record<string, string> = {
  success: 'border-l-2 border-l-green-500/60',
  completed: 'border-l-2 border-l-green-500/60',
  warning: 'border-l-2 border-l-amber-500/60',
  error: 'border-l-2 border-l-red-500/60',
  failed: 'border-l-2 border-l-red-500/60',
}

function logIcon(msg: string): LucideIcon {
  const m = msg.toLowerCase()
  if (m.includes('qualify') || m.includes('pre-screen') || m.includes('tier')) return UserCheck
  if (m.includes('researching') || m.includes('research on')) return Globe
  if (m.includes('searching for') || m.includes('qualified leads') || m.includes('apollo')) return Users
  if (m.includes('loading email templates') || m.includes('email settings')) return Settings
  if (m.includes('search preferences') || m.includes('targeting criteria') || m.includes('loading your search')) return Settings
  if (m.includes('writing') || m.includes('personalized email') || m.includes('build')) return FileText
  if (m.includes('finding email') || m.includes('email address') || m.includes('scheduling email')) return Mail
  if (m.includes('email found') || m.includes('email unlocked')) return Mail
  if (m.includes('starting research')) return Search
  return Activity
}

// ── real refund total (credits refunded for disqualified/rejected leads) ─────
function TotalRefundCounter() {
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get('/api/notifications', { params: { limit: 100 } }).then(r => {
      if (cancelled) return
      const notifications: Record<string, unknown>[] = r.data?.notifications ?? []
      const total = notifications.reduce((sum, n) => {
        const refunded = (n.data as Record<string, unknown> | undefined)?.creditsRefunded
        return typeof refunded === 'number' ? sum + refunded : sum
      }, 0)
      setCredits(total)
    }).catch(() => setCredits(0))
    return () => { cancelled = true }
  }, [])

  if (credits === null) return null

  return (
    <span
      className="text-[10px] font-medium text-muted-foreground/70 tabular-nums select-none"
      title="Credits refunded for disqualified or rejected leads"
    >
      Total Refunds: {credits.toFixed(1)} credits
    </span>
  )
}

// ── component ──────────────────────────────────────────────────────────────
export function OperationsContent() {
  const router = useRouter()
  const { toast } = useToast()

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(loadStoredActivityLogs)
  const [agentActivities, setAgentActivities] = useState<Record<string, { status: string; timestamp: number }>>({})
  const [sseConnected, setSseConnected] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [simplifyLogs, setSimplifyLogs] = useState(false)
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  const [editingLeadLimit, setEditingLeadLimit] = useState<string | null>(null)
  const [editingConcurrency, setEditingConcurrency] = useState<string | null>(null)
  const [leadLimitDrafts, setLeadLimitDrafts] = useState<Record<string, number>>({})
  const [concurrencyDrafts, setConcurrencyDrafts] = useState<Record<string, number>>({})
  const [savingInline, setSavingInline] = useState<Record<string, boolean>>({})
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [runCycleCounts, setRunCycleCounts] = useState<Record<string, number>>({})
  const logsRef = useRef<HTMLDivElement>(null)

  function selectAgent(agentId: string) {
    setSelectedAgent(agentId)
    setShowAgentMenu(false)
    setConfirmingDelete(false)
  }

  async function deleteAgent(agentId: string) {
    try {
      await Promise.allSettled([
        api.delete(`/api/auth/agents/${agentId}`),
        api.delete('/api/lead-agent/agent-data', { params: { agentId } }),
      ])
      toast({ title: 'Agent deleted', duration: 2500 })
      setSelectedAgent('all')
      fetchAgents()
    } catch {
      toast({ title: 'Failed to delete agent', variant: 'destructive', duration: 2500 })
    } finally {
      setConfirmingDelete(false)
      setShowAgentMenu(false)
    }
  }

  async function resetAgent(agentId: string) {
    try {
      await api.post('/api/lead-agent/reset', { agentId })
      toast({ title: 'Agent reset', duration: 2500 })
      setActivityLogs(p => p.filter(l => l.agentId !== agentId))
    } catch {
      toast({ title: 'Failed to reset agent', variant: 'destructive', duration: 2500 })
    } finally {
      setShowAgentMenu(false)
    }
  }

  // ── fetch agents + counts ────────────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    try {
      const [agentsRes, countsRes] = await Promise.allSettled([
        api.get('/api/auth/agents'),
        api.get('/api/email-queue/counts', { params: { agentId: 'all' } }),
      ])
      if (agentsRes.status === 'fulfilled') {
        const raw: Agent[] = agentsRes.value.data?.agents ?? []
        const filtered = raw.filter((a: any) => a.agentId !== 'orphan')
        // fetch per-agent email counts in parallel
        const withCounts = await Promise.all(filtered.map(async (a: any) => {
          let queued = 0, sent = 0, replied = 0
          try {
            const r = await api.get('/api/email-queue/counts', { params: { agentId: a.agentId } })
            queued  = r.data?.queued  ?? 0
            sent    = r.data?.sent    ?? 0
            replied = r.data?.replied ?? 0
          } catch { /* silent */ }
          return {
            ...a,
            name: a.name || a.agentName || 'Agent',
            emailStats: {
              built: queued + sent,
              queued,
              sent,
            },
            replied,
          }
        }))
        setAgents(withCounts)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPlanStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/plans/status')
      if (res.data?.success) {
        setPlanStatus(res.data)
      }
    } catch { /* silent */ }
  }, [])

  const saveAgentInlineSetting = useCallback(async (agentId: string, updates: { leadLimit?: number; concurrencyLevel?: number }) => {
    const saveKey = `${agentId}-${updates.leadLimit !== undefined ? 'leadLimit' : 'concurrency'}`
    setSavingInline(prev => ({ ...prev, [saveKey]: true }))
    try {
      const currentRes = await api.get(`/api/lead-agent/settings?agentId=${agentId}`)
      const currentSettings = currentRes.data?.settings || {}
      const nextLeadLimit = updates.leadLimit ?? currentSettings.geographicSettings?.leadLimit ?? currentSettings.targeting?.leadLimit ?? 0
      const payload = {
        ...currentSettings,
        agentId,
        geographicSettings: {
          ...(currentSettings.geographicSettings || {}),
          leadLimit: nextLeadLimit,
        },
        targeting: {
          ...(currentSettings.targeting || {}),
          leadLimit: nextLeadLimit,
        },
        ...(updates.concurrencyLevel !== undefined ? { concurrencyLevel: updates.concurrencyLevel } : {}),
      }

      await api.post('/api/lead-agent/settings', payload)

      setAgents(prev => prev.map(agent => {
        if (agent.agentId !== agentId) return agent
        return {
          ...agent,
          settings: {
            ...(agent.settings || {}),
            geographicSettings: {
              ...(agent.settings?.geographicSettings || {}),
              leadLimit: nextLeadLimit,
            },
            targeting: {
              ...(agent.settings?.targeting || {}),
              leadLimit: nextLeadLimit,
            },
            ...(updates.concurrencyLevel !== undefined ? { concurrencyLevel: updates.concurrencyLevel } : {}),
          },
        }
      }))

      toast({ title: 'Agent updated', duration: 2500 })
    } catch (error: any) {
      toast({ title: error?.response?.data?.error || 'Failed to update agent', variant: 'destructive', duration: 2500 })
    } finally {
      setSavingInline(prev => ({ ...prev, [saveKey]: false }))
    }
  }, [])

  // ── SSE ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    const tok = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    if (!tok) return
    const es = new EventSource(`${base}/api/monitoring/stream?token=${encodeURIComponent(tok)}`)
    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)
    es.addEventListener('message', (e) => {
      try {
        const d = JSON.parse(e.data)
        const payload = d.data ?? d

        // track per-agent latest activity (use cardMessage = concise, details = full)
        if (payload.agentId && (payload.cardMessage || payload.details || payload.message || payload.currentActivity)) {
          const status = payload.cardMessage || payload.details || payload.message || payload.currentActivity || ''
          if (status) {
            setAgentActivities(p => ({
              ...p,
              [payload.agentId]: { status, timestamp: Date.now() },
            }))
          }
        }

        // activity log entry - prefer details (full text), then cardMessage, skip bare status strings like "info"
        // Skip logs from agents in CRM/auditor mode - those belong on the CRM page
        const logMsg = payload.details || payload.cardMessage || payload.message || payload.currentActivity || ''
        const agentIsCrm = payload.isCrmMode || agents.find(a => a.agentId === payload.agentId)?.isCrmMode
        if (payload.agentId && logMsg && logMsg !== 'info' && logMsg !== 'running' && logMsg !== 'active' && !agentIsCrm) {
          const agentName = payload.agentName
            || agents.find(a => a.agentId === payload.agentId)?.name
            || agents.find(a => a.agentId === payload.agentId)?.agentName
            || 'Agent'
          const entry: ActivityLog = {
            id: `${Date.now()}-${Math.random()}`,
            agentId: payload.agentId,
            agentName,
            agentPersonality: payload.personality?.type,
            message: logMsg,
            timestamp: Date.now(),
            type: d.type,
            status: payload.status,
            operation: payload.operation,
            data: payload.data && typeof payload.data === 'object' && Object.keys(payload.data).length > 0 ? payload.data : undefined,
          }
          setActivityLogs(p => [entry, ...p].slice(0, 120))
        }

        // cycle counters - events are wrapped: { type:'activity_added', data:{ type:'cycle_complete'|'cycle_start' } }
        if (payload.type === 'cycle_complete') {
          // Re-fetch agents so nextCycleTime is updated (it's set in-memory only after cycle ends)
          fetchAgents()
        }
        // direct top-level cycle events (fallback if broadcast uses top-level type)
        if (d.type === 'cycle_complete' && !payload.type) {
          fetchAgents()
        }

        // refresh counts on queue/send events
        if (payload.type === 'email_queued' || payload.type === 'email_sent' ||
            d.type === 'email_queued' || d.type === 'email_sent') {
          fetchAgents()
        }
      } catch { /* ignore */ }
    })
    return () => es.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, fetchAgents])

  useEffect(() => { fetchAgents() }, [fetchAgents])
  useEffect(() => { fetchPlanStatus() }, [fetchPlanStatus])

  // auto-scroll logs
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0
  }, [activityLogs.length])

  // Persist logs so they survive a pause/stop, page refresh, or navigating away and
  // back — previously this was plain in-memory state, so it reset to empty on any of those.
  useEffect(() => {
    const key = activityLogsStorageKey()
    if (!key) return
    try { localStorage.setItem(key, JSON.stringify(activityLogs)) } catch { /* storage full/unavailable — non-fatal */ }
  }, [activityLogs])

  // ── toggle agent ─────────────────────────────────────────────────────────
  const toggleAgent = async (agent: Agent) => {
    const isRunning = agent.status === 'running' || agent.status === 'active'
    setToggling(p => ({ ...p, [agent.agentId]: true }))
    setAgents(p => p.map(a => a.agentId === agent.agentId
      ? { ...a, status: isRunning ? 'idle' : 'running' } : a))
    try {
      await api.post(`/api/lead-agent/${isRunning ? 'stop' : 'start'}`, { agentId: agent.agentId })
    } catch {
      setAgents(p => p.map(a => a.agentId === agent.agentId ? { ...a, status: agent.status } : a))
    } finally {
      setToggling(p => ({ ...p, [agent.agentId]: false }))
      fetchAgents()
    }
  }

  const toggleAll = async () => {
    const allRunning = agents.every(a => a.status === 'running' || a.status === 'active')
    setAgents(p => p.map(a => ({ ...a, status: allRunning ? 'idle' : 'running' })))
    for (const a of agents) {
      try { await api.post(`/api/lead-agent/${allRunning ? 'stop' : 'start'}`, { agentId: a.agentId }) }
      catch { /* ignore */ }
    }
    fetchAgents()
  }

  const runningAgents = agents.filter(a => a.status === 'running' || a.status === 'active')
  const allRunning = agents.length > 0 && runningAgents.length === agents.length
  const filteredLogs = selectedAgent === 'all'
    ? activityLogs
    : activityLogs.filter(l => l.agentId === selectedAgent)
  const displayLogs = simplifyLogs
    ? filteredLogs.filter(l => l.operation && IMPORTANT_OPERATIONS.has(l.operation))
    : filteredLogs
  const maxConcurrency = planStatus?.plan?.maxConcurrency ?? 30

  const avatarUrl = (agent: Agent) => {
    if (agent.avatar || agent.personality?.avatar) return agent.avatar ?? agent.personality?.avatar
    const map: Record<string, string> = {
      hunter: 'Hunter', analyst: 'Analyst', consultant: 'consultant',
      networker: 'Networker', 'relationship-builder': 'Relationship-Builder',
    }
    const type = agent.personality?.type ?? 'hunter'
    return `/avatars/${map[type] ?? 'Hunter'}.png`
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">

      {/* ── LEFT (merged): Agent panel ──────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="flex-1 overflow-hidden flex flex-col rounded-2xl border border-border bg-card">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Agents
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground/70">{agents.length}</span>
              <button onClick={fetchAgents} className="ml-1 grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button
              onClick={toggleAll}
              disabled={agents.length === 0}
              variant={allRunning ? 'destructive' : 'default'}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1.5 rounded-lg"
            >
              {allRunning
                ? <><Square className="w-3 h-3" />Stop All</>
                : <><Play className="w-3 h-3 fill-current" />Start All</>}
            </Button>
          </div>

          <div className="px-3 pb-3 flex-shrink-0">
            <button
              onClick={() => { setSelectedAgent('all'); setShowAgentMenu(false); setConfirmingDelete(false) }}
              className={cn(
                'w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-sm transition-all',
                selectedAgent === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-surface text-foreground/80 hover:bg-accent'
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Bot className="w-4 h-4 flex-shrink-0" />
                All Agents
              </span>
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', selectedAgent === 'all' ? 'bg-primary-foreground/15' : 'bg-muted text-foreground/70')}>
                {runningAgents.length} on
              </span>
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-1.5">
              {loading && (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loading && agents.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No agents yet</p>
                  <button
                    onClick={() => router.push('/prospecting?section=setup&tab=agents')}
                    className="text-xs text-primary underline mt-1"
                  >Create one →</button>
                </div>
              )}

              {agents.map(agent => {
                const isRunning = agent.status === 'running' || agent.status === 'active'
                const isToggling = toggling[agent.agentId]
                const selected = selectedAgent === agent.agentId
                const activity = agentActivities[agent.agentId]
                const displayName = agent.name || agent.agentName || 'Agent'
                const leadLimit = agent.settings?.targeting?.leadLimit ?? agent.settings?.geographicSettings?.leadLimit ?? 0
                const concurrencyLevel = agent.settings?.concurrencyLevel ?? 1
                const isSavingLeadLimit = !!savingInline[`${agent.agentId}-leadLimit`]
                const isSavingConcurrency = !!savingInline[`${agent.agentId}-concurrency`]

                return (
                  <div
                    key={agent.agentId}
                    className={cn(
                      'rounded-xl border p-2.5 transition-all cursor-pointer',
                      selected
                        ? 'bg-primary/10 border-primary/30'
                        : isRunning
                          ? 'bg-surface/60 border-border hover:border-primary/40'
                          : 'bg-surface/60 border-border hover:bg-accent'
                    )}
                    onClick={() => selectAgent(agent.agentId)}
                  >
                    {/* Row 1: avatar + name + controls */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="relative flex-shrink-0">
                        <img
                          src={avatarUrl(agent)}
                          alt={displayName}
                          className="w-7 h-7 rounded-full object-cover border border-border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <span className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background',
                          isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {displayName}
                          {agent.isCrmMode && (
                            <span className="ml-1.5 text-[9px] px-1 py-0 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-medium align-middle">Auditor</span>
                          )}
                        </span>
                        {isRunning && agent.nextCycleTime && <Countdown target={agent.nextCycleTime} />}
                      </div>
                      <span
                        title={agent.settings?.emailBuilder?.useLinkedIn ? 'LinkedIn enabled' : 'LinkedIn not connected'}
                        className={cn('inline-flex items-center p-0.5', !agent.settings?.emailBuilder?.useLinkedIn && 'opacity-25')}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <rect width="24" height="24" rx="4" fill="#0A66C2"/>
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" fill="white"/>
                        </svg>
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/agents/${agent.agentId}/settings`) }}
                        className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                        title="Agent settings"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleAgent(agent) }}
                        disabled={isToggling}
                        className={cn(
                          'p-1 rounded transition-all flex-shrink-0',
                          isRunning ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'
                        )}
                      >
                        {isToggling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Row 2: stats + lead limit + concurrency */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-0.5" title="Built">
                          <Mail className="w-3 h-3 text-muted-foreground/60" />
                          <span className="text-[10px] text-muted-foreground">{agent.emailStats?.built ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-0.5" title="Queued">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] text-amber-500">{agent.emailStats?.queued ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-0.5" title="Sent">
                          <Send className="w-3 h-3 text-green-500" />
                          <span className="text-[10px] text-green-500">{agent.emailStats?.sent ?? 0}</span>
                        </div>
                      </div>
                      {editingLeadLimit === agent.agentId ? (
                        <form
                          className="flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                          onSubmit={async e => {
                            e.preventDefault()
                            const nextValue = Math.max(1, Math.min(200, Math.floor(leadLimitDrafts[agent.agentId] ?? leadLimit ?? 1)))
                            await saveAgentInlineSetting(agent.agentId, { leadLimit: nextValue })
                            setEditingLeadLimit(null)
                          }}
                        >
                          <RefreshCw className={cn('w-2.5 h-2.5 text-primary', isSavingLeadLimit && 'animate-spin')} />
                          <input
                            type="number" min={1} max={200}
                            value={leadLimitDrafts[agent.agentId] ?? leadLimit ?? 1}
                            onChange={e => setLeadLimitDrafts(prev => ({ ...prev, [agent.agentId]: parseInt(e.target.value) || 1 }))}
                            onClick={e => e.stopPropagation()}
                            className="h-5 w-14 rounded border border-primary/30 bg-background px-1 text-[10px] text-foreground"
                            autoFocus
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setLeadLimitDrafts(prev => ({ ...prev, [agent.agentId]: leadLimit || 1 })); setEditingLeadLimit(agent.agentId); setEditingConcurrency(null) }}
                          className="flex items-center gap-0.5 text-[10px] text-primary font-medium rounded px-1 py-0.5 hover:bg-primary/10"
                          title="Edit lead limit"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />{leadLimit}/cycle
                        </button>
                      )}
                      {editingConcurrency === agent.agentId ? (
                        <form
                          className="flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                          onSubmit={async e => {
                            e.preventDefault()
                            const nextValue = Math.max(1, Math.min(maxConcurrency, Math.floor(concurrencyDrafts[agent.agentId] ?? concurrencyLevel ?? 1)))
                            await saveAgentInlineSetting(agent.agentId, { concurrencyLevel: nextValue })
                            setEditingConcurrency(null)
                          }}
                        >
                          <Cpu className={cn('w-2.5 h-2.5 text-muted-foreground', isSavingConcurrency && 'animate-pulse')} />
                          <input
                            type="number" min={1} max={maxConcurrency}
                            value={concurrencyDrafts[agent.agentId] ?? concurrencyLevel ?? 1}
                            onChange={e => setConcurrencyDrafts(prev => ({ ...prev, [agent.agentId]: Math.min(maxConcurrency, parseInt(e.target.value) || 1) }))}
                            onClick={e => e.stopPropagation()}
                            className="h-5 w-10 rounded border border-border bg-background px-1 text-[10px] text-foreground"
                            autoFocus
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setConcurrencyDrafts(prev => ({ ...prev, [agent.agentId]: Math.min(maxConcurrency, concurrencyLevel || 1) })); setEditingConcurrency(agent.agentId); setEditingLeadLimit(null) }}
                          className="flex items-center gap-0.5 text-[10px] text-muted-foreground rounded px-1 py-0.5 hover:bg-muted"
                          title="Edit concurrency"
                        >
                          <Cpu className="w-2.5 h-2.5" />{concurrencyLevel}×
                        </button>
                      )}
                    </div>

                    {/* Row 3: current activity */}
                    {activity?.status && (
                      <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                        <span className="text-[10px] text-primary min-w-0" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{activity.status}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3 flex-shrink-0">
            <button
              onClick={() => router.push('/prospecting?section=setup&tab=agents')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-accent"
            >
              <Bot className="w-4 h-4" />Manage Agents
            </button>
          </div>
        </div>
      </div>
      {/* ── RIGHT: Main content ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
      {selectedAgent !== 'all' && agents.find(a => a.agentId === selectedAgent) ? (
        <AgentDetailPanel
          agent={agents.find(a => a.agentId === selectedAgent)!}
          avatarUrl={avatarUrl}
          showMenu={showAgentMenu}
          setShowMenu={setShowAgentMenu}
          confirmingDelete={confirmingDelete}
          setConfirmingDelete={setConfirmingDelete}
          onDelete={() => deleteAgent(selectedAgent)}
          onReset={() => resetAgent(selectedAgent)}
          onToggle={() => toggleAgent(agents.find(a => a.agentId === selectedAgent)!)}
          isToggling={!!toggling[selectedAgent]}
        />
      ) : (
      <>
        {/* Activity log */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardHeader className="px-4 py-2 pb-2 border-b flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Activity Log</CardTitle>
                <span className="text-[11px] text-muted-foreground">Press 'Start' or 'Start all' to start your agents and begin prospecting.</span>
                {runningAgents.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {runningAgents.length} running
                  </Badge>
                )}
                {displayLogs.length > 0 && (
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {displayLogs.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={simplifyLogs ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setSimplifyLogs(v => !v)}
                  title="Show only milestone events: leads found, email built, and final outcomes"
                >
                  Simplify
                </Button>
                <TotalRefundCounter />
              </div>
            </div>
          </CardHeader>

          <div className="flex-1 overflow-y-auto" ref={logsRef}>
            {/* No agents running */}
            {runningAgents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Bot className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No Active Agents</p>
                <p className="text-xs text-muted-foreground">Start an agent from the left panel to see live activity</p>
              </div>
            )}

            {/* Running but no logs yet */}
            {runningAgents.length > 0 && displayLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Waiting for activity…</p>
              </div>
            )}

            {/* Logs */}
            {displayLogs.length > 0 && (
              <div className="pt-1 px-3 pb-3 space-y-1">
                {/* Persistent "still working" cue — fills the gap between events so a running
                    agent never reads as stuck just because nothing's printed in a few seconds */}
                {runningAgents.length > 0 && (
                  <TypingIndicator
                    label={
                      runningAgents.length === 1
                        ? `${runningAgents[0].name || 'Agent'} is working…`
                        : `${runningAgents.length} agents working…`
                    }
                  />
                )}
                {displayLogs.map((log) => {
                  const agent = agents.find(a => a.agentId === log.agentId)
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors border border-border/50 overflow-hidden animate-slide-in-up',
                        log.status && STATUS_ACCENT[log.status]
                      )}
                    >
                      <div className="flex items-start gap-3 p-3">
                        {/* Avatar */}
                        <img
                          src={agent ? avatarUrl(agent) : `/avatars/Hunter.png`}
                          alt={log.agentName}
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5 border border-border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-foreground">{log.agentName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            {log.data?.score !== undefined && (
                              <ScoreBadge score={log.data.score} tier={log.data.tier} />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                            {(() => { const Icon = logIcon(log.message); return <Icon className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-50" /> })()}
                            <span>{stripEmoji(log.message)}</span>
                          </p>
                        </div>

                        {/* Expand button - only for qualify events with reasoning */}
                        {log.data?.reasoning && (
                          <button
                            onClick={() => setExpandedLogs(p => ({ ...p, [log.id]: !p[log.id] }))}
                            className="flex-shrink-0 p-1 rounded hover:bg-border/50 transition-colors mt-0.5"
                          >
                            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', expandedLogs[log.id] && 'rotate-180')} />
                          </button>
                        )}
                      </div>

                      {/* Expanded reasoning panel */}
                      {log.data?.reasoning && expandedLogs[log.id] && (
                        <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-1.5">
                          <p className="text-[11px] text-foreground/80 leading-relaxed">
                            <span className="font-semibold text-foreground">Reasoning: </span>{log.data.reasoning}
                          </p>
                          {log.data.strengths && log.data.strengths.length > 0 && (
                            <p className="text-[11px] text-green-600 dark:text-green-400">
                              <span className="font-semibold">Strengths: </span>{log.data.strengths.join(' · ')}
                            </p>
                          )}
                          {log.data.weaknesses && log.data.weaknesses.length > 0 && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              <span className="font-semibold">Concerns: </span>{log.data.weaknesses.join(' · ')}
                            </p>
                          )}
                          {log.data.emailStrategy && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">Strategy: </span>{log.data.emailStrategy}
                            </p>
                          )}
                          {log.data.confidence && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">Confidence: </span>{log.data.confidence}
                              {log.data.citedEvidence ? ` · ${log.data.citedEvidence} cited facts` : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </>
      )}

      </div>

    </div>
  )
}

// ── Selected-agent detail panel ───────────────────────────────────────────
function AgentDetailPanel({
  agent, avatarUrl,
  showMenu, setShowMenu, confirmingDelete, setConfirmingDelete,
  onDelete, onReset, onToggle, isToggling,
}: {
  agent: Agent
  avatarUrl: (a: Agent) => string | undefined
  showMenu: boolean
  setShowMenu: (v: boolean) => void
  confirmingDelete: boolean
  setConfirmingDelete: (v: boolean) => void
  onDelete: () => void
  onReset: () => void
  onToggle: () => void
  isToggling: boolean
}) {
  const router = useRouter()
  const isRunning = agent.status === 'running' || agent.status === 'active'
  const displayName = agent.name || agent.agentName || 'Agent'
  const sent = agent.emailStats?.sent ?? 0
  const queued = agent.emailStats?.queued ?? 0
  const replied = agent.replied ?? 0
  const replyRate = sent > 0 ? `${Math.round((replied / sent) * 100)}%` : '0%'
  const leadLimit = agent.settings?.targeting?.leadLimit ?? agent.settings?.geographicSettings?.leadLimit ?? 0
  const industries = agent.settings?.companyCriteria?.companyIndustries ?? []
  const positions = agent.settings?.contactCriteria?.targetPositions ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={avatarUrl(agent)}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold truncate">{displayName}</h2>
                {agent.personality?.type && (
                  <Badge variant="outline" className="text-[10px] capitalize">{agent.personality.type}</Badge>
                )}
                <Badge variant={isRunning ? 'default' : 'secondary'} className="text-[10px]">
                  {isRunning ? 'Active' : 'Idle'}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Agent ID: {agent.agentId}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant={isRunning ? 'destructive' : 'default'} className="h-7 text-xs gap-1" disabled={isToggling} onClick={onToggle}>
              {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRunning ? 'Stop' : 'Start'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => router.push(`/agents/${agent.agentId}`)}>
              <ExternalLink className="w-3 h-3" /> Open Dashboard
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => router.push(`/agents/${agent.agentId}/settings`)}>
              <Settings className="w-3 h-3" /> Settings
            </Button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 z-20 w-40 rounded-md border border-border bg-popover shadow-lg py-1">
                  <button onClick={onReset} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                  {!confirmingDelete ? (
                    <button onClick={() => setConfirmingDelete(true)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  ) : (
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] text-muted-foreground mb-1">Delete {displayName}?</p>
                      <div className="flex gap-1.5">
                        <button onClick={onDelete} className="text-[11px] font-medium text-destructive">Confirm</button>
                        <button onClick={() => setConfirmingDelete(false)} className="text-[11px] text-muted-foreground">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
          {[
            { label: 'Queued', value: queued },
            { label: 'Sent', value: sent },
            { label: 'Replied', value: replied },
            { label: 'Reply %', value: replyRate },
            { label: 'Leads/cycle', value: leadLimit || '-' },
            { label: 'Last run', value: agent.lastRun ? timeAgo(agent.lastRun) : 'Never' },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
              <p className="text-sm font-bold tabular-nums">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {(industries.length > 0 || positions.length > 0) && (
          <div className="mt-3 space-y-1.5">
            {industries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground shrink-0" title="This agent only targets companies in these industries">Industries:</span>
                {industries.map(i => <Badge key={i} variant="secondary" className="text-[10px]" title={`Targets companies in the "${i}" industry`}>{i}</Badge>)}
              </div>
            )}
            {positions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground shrink-0" title="This agent only targets contacts with these job titles">Job titles:</span>
                {positions.map(p => <Badge key={p} variant="outline" className="text-[10px]" title={`Targets contacts with the job title "${p}"`}>{p}</Badge>)}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
