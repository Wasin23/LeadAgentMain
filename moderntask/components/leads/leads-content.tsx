'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, Search, Building2, ExternalLink, X,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Linkedin, Newspaper, Globe, FileText, Mail, Info, AlertTriangle, ArrowUpDown, Check,
  Star, Clock, Loader2, Copy, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StrengthsConcernsVenn } from '@/components/email-queue/email-queue-content'

// A literal tiny venn diagram (two overlapping circles) shown next to the strengths/concerns box
function VennIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" fill="none" className={className}>
      <circle cx="9" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" className="text-green-500" />
      <circle cx="15" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" className="text-yellow-500" />
    </svg>
  )
}

interface AIReport {
  companyName?: string
  contactName?: string
  score: number
  confidence: string
  tier: 'HIGHLY_QUALIFIED' | 'QUALIFIED' | 'SHOTGUN' | 'REJECTED'
  reasoning: string
  keyStrengths?: string[]
  weaknesses?: string[]
  citedEvidence?: { fact: string; source: string }[]
  allCitedFacts?: { fact: string; source: string; sourceTitle?: string }[]
}

interface LeadRecord {
  id: string
  agentId?: string
  agentName?: string
  company: string
  contactName: string
  email?: string
  status: 'queued' | 'sent'
  subject?: string
  body?: string
  aiReport?: AIReport
  starred?: boolean
  createdAt: number
}

interface TimelineEntry {
  entryId: string
  headline: string
  snippet: string
  url: string
  relevanceScore: number
  reason: string
  type: string
  foundAt: string
}

// Strips the compliance footer (company branding + unsubscribe link) from a body for
// display - it's appended fresh at actual send time and shouldn't be shown in the UI.
function stripFooter(body: string) {
  const idx = body.indexOf('<!--MERIDIAN_FOOTER-->')
  return idx === -1 ? body : body.slice(0, idx).replace(/\s+$/, '')
}

function extractLead(e: Record<string, unknown>, status: 'queued' | 'sent', agentNameById: Map<string, string>): LeadRecord {
  const leadDetails = (e.leadDetails as Record<string, unknown>) || {}
  const personInfo = (leadDetails.personInfo as Record<string, unknown>) || {}
  const emailData = (e.emailData as Record<string, unknown>) || {}
  const agentId = e.agentId as string | undefined
  const aiReport = e.aiReport as AIReport | undefined
  return {
    id: (e.id as string) || (e.SK as string) || String(Math.random()),
    agentId,
    agentName: agentId ? agentNameById.get(agentId) : undefined,
    company: aiReport?.companyName || (leadDetails.companyName as string) || (e.leadCompany as string) || '',
    contactName: aiReport?.contactName || (personInfo.fullName as string) || (personInfo.name as string) || (e.leadName as string) || (e.recipientName as string) || '',
    email: (emailData.finalRecipient as string) || (e.to as string) || '',
    status,
    subject: (emailData.finalSubject as string) || (e.subject as string),
    body: stripFooter((emailData.finalBody as string) || (e.body as string) || ''),
    aiReport,
    createdAt: new Date((e.sentAt as string) || (e.createdAt as string) || (e.timestamp as string) || 0).getTime(),
  }
}

function sourceCategory(url: string): { label: string; icon: typeof Globe } {
  const lower = url.toLowerCase()
  if (lower.includes('linkedin.com')) return { label: 'LinkedIn', icon: Linkedin }
  if (lower.includes('crunchbase.com') || lower.includes('zoominfo.com')) return { label: 'Company Profile', icon: Building2 }
  if (/(techcrunch|businesswire|prnewswire|forbes|bloomberg|reuters|news\.|\/news\/)/.test(lower)) return { label: 'News', icon: Newspaper }
  if (lower.includes('/careers') || lower.includes('/jobs')) return { label: 'Career Page', icon: FileText }
  return { label: 'Website', icon: Globe }
}

function ScoreMeter({ value }: { value: number }) {
  const filled = Math.round((value / 100) * 5)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="h-1.5 w-4 rounded-full" style={{ background: i < filled ? 'var(--success)' : 'var(--muted-dot)' }} />
      ))}
    </div>
  )
}

// Confidence is only a 3-tier label (low/medium/high) from the model, which only gives
// 1/3/5 dots of variation. Use the numeric score to spread it across the full 1-5 range
// instead, while keeping the label's color for the tier the dots are filled in.
function confidenceDotCount(score?: number): number {
  if (score === undefined) return 0
  return Math.min(5, Math.max(1, Math.round(score / 20)))
}

function ConfidenceDots({ confidence, score }: { confidence?: string; score?: number }) {
  const filled = confidenceDotCount(score)
  const c = (confidence || '').toLowerCase()
  const color = c === 'high' ? 'var(--success)' : c === 'medium' ? 'var(--brass)' : 'var(--destructive)'
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < filled ? color : 'var(--muted-dot)' }} />
      ))}
    </div>
  )
}

// Small inline copy-to-clipboard button - shows a check for 1.5s after copying
export function CopyChip({ text, title = 'Copy' }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      title={title}
      onClick={async e => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
      className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

type SortKey = 'score-desc' | 'score-asc' | 'confidence-desc' | 'confidence-asc' | 'status' | 'assigned' | 'alpha' | 'newest' | 'oldest' | 'starred'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'starred', label: 'Starred first' },
  { key: 'score-desc', label: 'Fit Score (High → Low)' },
  { key: 'score-asc', label: 'Fit Score (Low → High)' },
  { key: 'confidence-desc', label: 'Confidence (High → Low)' },
  { key: 'confidence-asc', label: 'Confidence (Low → High)' },
  { key: 'status', label: 'Status' },
  { key: 'assigned', label: 'Assigned (A → Z)' },
  { key: 'alpha', label: 'Company (A → Z)' },
]

const TIER_RANK: Record<string, number> = { HIGHLY_QUALIFIED: 4, QUALIFIED: 3, SHOTGUN: 2, REJECTED: 1 }
const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

export function LeadsContent() {
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
  const [starringId, setStarringId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'research' | 'sources' | 'draft' | 'timeline'>('research')
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('score-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [starLimit, setStarLimit] = useState<number | null>(null)
  const [unsubscribedEmails, setUnsubscribedEmails] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const pageSize = 10

  useEffect(() => {
    try { if (localStorage.getItem('leadsInfoBannerDismissed')) setShowBanner(false) } catch {}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, queueRes, sentRes, starredRes] = await Promise.allSettled([
        api.get('/api/auth/agents'),
        api.get('/api/email-queue/queue', { params: { agentId: 'all', limit: 500 } }),
        api.get('/api/email-queue/sent', { params: { agentId: 'all', limit: 500 } }),
        api.get('/api/leads/starred'),
      ])
      const agentNameById = new Map<string, string>()
      if (agentsRes.status === 'fulfilled') {
        for (const a of (agentsRes.value.data?.agents ?? [])) agentNameById.set(a.agentId, a.name)
      }
      let hiddenIds = new Set<string>()
      if (starredRes.status === 'fulfilled') {
        setStarredIds(new Set((starredRes.value.data?.starred ?? []).map((s: { leadId: string }) => s.leadId)))
        if (typeof starredRes.value.data?.limit === 'number') setStarLimit(starredRes.value.data.limit)
        hiddenIds = new Set((starredRes.value.data?.hidden ?? []) as string[])
      }
      const queue = queueRes.status === 'fulfilled' ? (queueRes.value.data?.emails ?? queueRes.value.data?.queue ?? queueRes.value.data ?? []) : []
      const sent = sentRes.status === 'fulfilled' ? (sentRes.value.data?.emails ?? sentRes.value.data ?? []) : []
      const merged = [
        ...(Array.isArray(queue) ? queue : []).map((e: Record<string, unknown>) => extractLead(e, 'queued', agentNameById)),
        ...(Array.isArray(sent) ? sent : []).map((e: Record<string, unknown>) => extractLead(e, 'sent', agentNameById)),
      ].filter(l => l.aiReport && !hiddenIds.has(l.id))
      setLeads(merged)

      // Flag leads whose email has unsubscribed (badge + banner)
      const emails = [...new Set(merged.map(l => l.email).filter(Boolean))]
      if (emails.length > 0) {
        api.post('/api/leads/check-unsubscribed', { emails })
          .then(r => setUnsubscribedEmails(new Set((r.data?.unsubscribed ?? []).map((e: string) => e.toLowerCase()))))
          .catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleStar = async (lead: LeadRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    setStarringId(lead.id)
    const isStarred = starredIds.has(lead.id)
    try {
      if (isStarred) {
        await api.delete(`/api/leads/star/${lead.id}`)
        setStarredIds(prev => { const s = new Set(prev); s.delete(lead.id); return s })
      } else {
        await api.post('/api/leads/star', {
          leadId: lead.id,
          email: lead.email,
          name: lead.contactName,
          company: lead.company,
          agentId: lead.agentId,
        })
        setStarredIds(prev => new Set([...prev, lead.id]))
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error
      if (err?.response?.status === 403 && msg) {
        toast({ title: 'Starred lead limit reached', description: msg, variant: 'destructive', duration: 4000 })
      }
    }
    setStarringId(null)
  }

  const [deleting, setDeleting] = useState(false)

  // Removes the lead from this page only. Queued/sent email records and outreach
  // history are untouched — this just hides it here (and unstars it).
  const deleteLead = async (lead: LeadRecord) => {
    if (!window.confirm(`Remove ${lead.contactName || lead.company || 'this lead'} from the Leads page? Emails and outreach history are not affected.`)) return
    setDeleting(true)
    try {
      await api.post('/api/leads/hide', { leadId: lead.id })
      setStarredIds(prev => { const s = new Set(prev); s.delete(lead.id); return s })
      setLeads(prev => prev.filter(l => l.id !== lead.id))
      if (selectedId === lead.id) setSelectedId(null)
      toast({ title: 'Lead removed from list', duration: 2000 })
    } catch (err: any) {
      toast({ title: 'Failed to remove lead', description: err?.response?.data?.error, variant: 'destructive', duration: 3000 })
    } finally {
      setDeleting(false)
    }
  }

  const loadTimeline = useCallback(async (leadId: string) => {
    setTimelineLoading(true)
    setTimeline([])
    try {
      const r = await api.get(`/api/leads/${leadId}/timeline`)
      setTimeline(r.data?.timeline ?? [])
    } catch {} finally {
      setTimelineLoading(false)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return leads
    return leads.filter(l => `${l.company} ${l.contactName} ${l.agentName ?? ''}`.toLowerCase().includes(q))
  }, [leads, search])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortKey) {
      case 'score-desc':
        arr.sort((a, b) => (b.aiReport?.score ?? -1) - (a.aiReport?.score ?? -1)); break
      case 'score-asc':
        arr.sort((a, b) => (a.aiReport?.score ?? 999) - (b.aiReport?.score ?? 999)); break
      case 'confidence-desc':
        arr.sort((a, b) => (CONFIDENCE_RANK[(b.aiReport?.confidence || '').toLowerCase()] ?? 0) - (CONFIDENCE_RANK[(a.aiReport?.confidence || '').toLowerCase()] ?? 0)); break
      case 'confidence-asc':
        arr.sort((a, b) => (CONFIDENCE_RANK[(a.aiReport?.confidence || '').toLowerCase()] ?? 0) - (CONFIDENCE_RANK[(b.aiReport?.confidence || '').toLowerCase()] ?? 0)); break
      case 'status':
        arr.sort((a, b) => (TIER_RANK[b.aiReport?.tier ?? ''] ?? 0) - (TIER_RANK[a.aiReport?.tier ?? ''] ?? 0)); break
      case 'assigned':
        arr.sort((a, b) => (a.agentName ?? '').localeCompare(b.agentName ?? '')); break
      case 'alpha':
        arr.sort((a, b) => (a.company ?? '').localeCompare(b.company ?? '')); break
      case 'newest':
        arr.sort((a, b) => b.createdAt - a.createdAt); break
      case 'oldest':
        arr.sort((a, b) => a.createdAt - b.createdAt); break
      case 'starred':
        // Starred leads first (newest starred at top), then everything else by recency
        arr.sort((a, b) => {
          const sa = starredIds.has(a.id) ? 1 : 0
          const sb = starredIds.has(b.id) ? 1 : 0
          if (sa !== sb) return sb - sa
          return b.createdAt - a.createdAt
        }); break
    }
    return arr
  }, [filtered, sortKey, starredIds])

  const counts = useMemo(() => ({ total: leads.length }), [leads])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize)
  const selected = leads.find(l => l.id === selectedId) || null

  const tierColors: Record<string, string> = {
    HIGHLY_QUALIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    QUALIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    SHOTGUN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    REJECTED: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="space-y-4">
      {showBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">
            Select a lead to view its research report, sources, and outreach draft.{' '}
            <span className="inline-flex items-center gap-1">
              <Star className="inline w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Star a lead</span>
            </span>
            {' '}to add it to your favorites and start automatic background research. Meridian will continuously scan the web for news, funding signals, and hiring activity and surface findings in a live timeline.
          </span>
          <button
            onClick={() => { setShowBanner(false); try { localStorage.setItem('leadsInfoBannerDismissed', '1') } catch {} }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 @5xl:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span><span className="font-mono text-sm text-foreground">{counts.total}</span> Total Leads</span>
              {starLimit !== null && (
                <>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1" title={`Starred leads: ${starredIds.size} of ${starLimit} allowed on your plan`}>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className={cn('tabular-nums font-semibold', starredIds.size >= starLimit ? 'text-destructive' : 'text-foreground')}>{starredIds.size}/{starLimit}</span>
                  </span>
                </>
              )}
            </div>
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search company, contact, agent…"
                className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Popover open={sortOpen} onOpenChange={setSortOpen}>
              <PopoverTrigger asChild>
                <button className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground/80 hover:bg-accent">
                  <ArrowUpDown className="h-3 w-3" />
                  Sort
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortKey(opt.key); setSortOpen(false) }}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    {opt.label}
                    {sortKey === opt.key && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : pageItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No leads yet</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-surface/40">
                    <th className="py-2 px-2 w-8"></th>
                    <th className="py-2 px-3 font-medium">Company</th>
                    <th className="py-2 px-3 font-medium">Fit Score</th>
                    <th className="py-2 px-3 font-medium">Confidence</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(l => (
                    <tr
                      key={l.id}
                      onClick={() => { setSelectedId(l.id); setDetailTab('research') }}
                      className={cn(
                        'border-b border-border last:border-0 cursor-pointer hover:bg-accent/40 transition-colors',
                        selectedId === l.id && 'bg-success-soft ring-1 ring-inset ring-success',
                      )}
                    >
                      <td className="py-2.5 px-2 w-8">
                        <button
                          onClick={e => toggleStar(l, e)}
                          disabled={starringId === l.id}
                          className="flex items-center justify-center rounded-md p-1 hover:bg-accent disabled:opacity-50"
                        >
                          <Star
                            className={cn('w-3.5 h-3.5 transition-colors', starredIds.has(l.id) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground')}
                          />
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                          <p className="font-medium truncate">{l.company || '-'}</p>
                          {l.email && unsubscribedEmails.has(l.email.toLowerCase()) && (
                            <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-destructive/10 text-destructive">Unsubscribed</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{l.contactName}</p>
                        {l.email && (
                          <span className="flex items-center gap-1 max-w-[180px]">
                            <span className="text-[11px] text-muted-foreground/70 truncate">{l.email}</span>
                            <CopyChip text={l.email} title="Copy email address" />
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">{l.aiReport?.score ?? '-'}%</span>
                          {l.aiReport?.score !== undefined && <ScoreMeter value={l.aiReport.score} />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <p>{l.aiReport?.confidence ?? '-'}</p>
                          <ConfidenceDots confidence={l.aiReport?.confidence} score={l.aiReport?.score} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium', tierColors[l.aiReport?.tier ?? ''] ?? 'bg-muted text-muted-foreground')}>
                          {l.aiReport?.tier?.replace(/_/g, ' ') ?? '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs">{l.agentName ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(1)} className="p-1 disabled:opacity-30"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span>p.{page}/{totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                <button disabled={page === totalPages} onClick={() => setPage(totalPages)} className="p-1 disabled:opacity-30"><ChevronsRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
        </div>

        {selected ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                  {selected.company?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{selected.company || 'Unknown company'}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.contactName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => deleteLead(selected)}
                  disabled={deleting}
                  title="Delete lead"
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setSelectedId(null)} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selected.email && unsubscribedEmails.has(selected.email.toLowerCase()) && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <div className="text-xs text-destructive">
                  <p className="font-semibold">This contact has unsubscribed.</p>
                  <p className="text-destructive/80">No new emails or follow-ups will be sent to {selected.email}. Any queued or scheduled sends are blocked automatically.</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 border-b border-border mb-3 whitespace-nowrap">
              {(['research', 'sources', 'draft', 'timeline'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setDetailTab(t)
                    if (t === 'timeline' && selected) loadTimeline(selected.id)
                  }}
                  className={cn(
                    'relative shrink-0 pb-2 text-xs font-medium capitalize',
                    detailTab === t ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'draft' ? 'Outreach Draft' : t === 'timeline' ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />Timeline
                      {starredIds.has(selected?.id ?? '') && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                    </span>
                  ) : t}
                  {detailTab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
                </button>
              ))}
            </div>

            {detailTab === 'research' && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Research Summary</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.aiReport?.reasoning || 'No research summary available.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-lg font-bold">{selected.aiReport?.score ?? '-'}%</p>
                    <p className="text-[11px] text-muted-foreground">Fit Score</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-lg font-bold">{selected.aiReport?.confidence ?? '-'}</p>
                    <p className="text-[11px] text-muted-foreground">Confidence</p>
                  </div>
                </div>
                {((selected.aiReport?.keyStrengths?.length ?? 0) > 0 || (selected.aiReport?.weaknesses?.length ?? 0) > 0) && (
                  <div className="rounded-lg border border-border p-2 overflow-x-auto">
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <VennIcon className="w-4 h-3" />
                      <p className="text-xs font-medium text-muted-foreground">Strengths vs. Concerns</p>
                    </div>
                    <StrengthsConcernsVenn report={selected.aiReport!} />
                  </div>
                )}
                {selected.aiReport?.keyStrengths && selected.aiReport.keyStrengths.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Why This Lead Qualifies</p>
                    <ul className="space-y-1">
                      {selected.aiReport.keyStrengths.map((s, i) => (
                        <li key={i} className="text-sm flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.aiReport?.weaknesses && selected.aiReport.weaknesses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Concerns</p>
                    <ul className="space-y-1">
                      {selected.aiReport.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" /> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'sources' && (() => {
              const facts = selected.aiReport?.allCitedFacts ?? selected.aiReport?.citedEvidence ?? []
              const uniqueSources = Array.from(new Set(facts.map(f => f.source))).filter(Boolean)
              if (uniqueSources.length === 0) return <p className="text-sm text-muted-foreground">No sources cited.</p>
              return (
                <div className="space-y-1.5">
                  {uniqueSources.map((src, i) => {
                    const { label, icon: Icon } = sourceCategory(src)
                    return (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                        <span className="truncate flex-1 text-primary">{src}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                      </a>
                    )
                  })}
                </div>
              )
            })()}

            {detailTab === 'draft' && (
              <div className="space-y-2">
                {selected.subject ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground">{selected.subject}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap p-3 rounded-lg bg-muted/40 max-h-64 overflow-y-auto">{selected.body}</p>
                    <Button
                      size="sm" variant="outline" className="w-full"
                      onClick={() => window.location.href = `/outreach?section=${selected.status === 'sent' ? 'sent' : 'awaiting'}`}
                    >
                      View in Outreach
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No draft built yet for this lead.</p>
                )}
              </div>
            )}

            {detailTab === 'timeline' && (() => {
              const isStarred = starredIds.has(selected.id)
              const chronological = [...timeline].reverse() // oldest → newest
              const DAY_PX = 100

              function formatRelative(iso: string) {
                const d = new Date(iso)
                const now = Date.now()
                const diff = now - d.getTime()
                const days = Math.floor(diff / 86400000)
                if (days === 0) return 'Today'
                if (days === 1) return 'Yesterday'
                if (days < 30) return `${days}d ago`
                const months = Math.floor(days / 30)
                return months === 1 ? '1 mo ago' : `${months} mo ago`
              }

              return (
                <div>
                  {!isStarred && (
                    <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                      <Star className="w-3.5 h-3.5 shrink-0" />
                      Star this lead to start building a research timeline automatically.
                    </div>
                  )}
                  {timelineLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading timeline…
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-[480px] pr-1">
                      <div className="relative">
                        {/* Continuous vertical line */}
                        <div className="absolute left-[15px] top-8 bottom-4 w-[2px] bg-border rounded-full" />

                        {/* Lead Found anchor */}
                        <div className="relative flex gap-4 items-start">
                          <div className="relative z-10 shrink-0 w-8 h-8 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
                            <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                          </div>
                          <div className="pt-1 pb-2">
                            <p className="text-sm font-semibold text-foreground">Lead Starred</p>
                            <p className="text-[11px] text-muted-foreground">Timeline research active</p>
                          </div>
                        </div>

                        {chronological.length === 0 ? (
                          <div style={{ marginTop: 60 }} className="relative flex gap-4 items-center">
                            <div className="relative z-10 shrink-0 w-8 h-8 rounded-full border-2 border-dashed border-border bg-background flex items-center justify-center">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {isStarred ? 'No entries yet. Research runs continuously between agent cycles.' : 'No timeline entries.'}
                            </p>
                          </div>
                        ) : (
                          chronological.map((entry, i) => {
                            const prevDate = i === 0
                              ? new Date(entry.foundAt) // Lead Found node sits above; first entry gets 80px fixed gap
                              : new Date(chronological[i - 1].foundAt)
                            const msGap = i === 0 ? 0 : new Date(entry.foundAt).getTime() - prevDate.getTime()
                            const days = msGap / 86400000
                            const marginTop = i === 0 ? 80 : Math.max(60, Math.round(days * DAY_PX))
                            const showGapLabel = i > 0 && days >= 1

                            return (
                              <div key={entry.entryId} style={{ marginTop }} className="relative flex gap-4 items-start">
                                {/* Gap label on the line */}
                                {showGapLabel && (
                                  <div
                                    className="absolute left-[16px] text-[10px] text-muted-foreground/60 tabular-nums leading-none"
                                    style={{ top: -(marginTop / 2) - 6, transform: 'translateX(4px)' }}
                                  >
                                    {Math.round(days)}d
                                  </div>
                                )}
                                {/* Node circle - click to open source */}
                                <a
                                  href={entry.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={entry.url}
                                  className={cn(
                                    'group relative z-10 shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-bold tabular-nums transition-opacity hover:opacity-70',
                                    entry.relevanceScore >= 8
                                      ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                      : 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                                  )}
                                >
                                  <span className="group-hover:hidden">{entry.relevanceScore}</span>
                                  <ExternalLink className="hidden group-hover:block w-3 h-3" />
                                </a>
                                {/* Content card */}
                                <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/30 p-2.5 space-y-1 -mt-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-semibold leading-snug flex-1">{entry.headline}</p>
                                    <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{formatRelative(entry.foundAt)}</span>
                                  </div>
                                  {entry.snippet && <p className="text-[11px] text-muted-foreground line-clamp-2">{entry.snippet}</p>}
                                  {entry.reason && <p className="text-[11px] text-muted-foreground/70 italic">{entry.reason}</p>}
                                  <a href={entry.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors truncate">
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{(() => { try { return new URL(entry.url).hostname.replace('www.', '') } catch { return entry.url } })()}</span>
                                  </a>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 flex items-center justify-center text-sm text-muted-foreground text-center">
            Select a lead from the list to see details.
          </div>
        )}
      </div>
    </div>
  )
}
