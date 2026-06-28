'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, Search, Building2, ExternalLink, X,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Linkedin, Newspaper, Globe, FileText, Mail, Info, XCircle, Users as UsersIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIReport {
  companyName?: string
  contactName?: string
  score: number
  confidence: string
  tier: 'HIGHLY_QUALIFIED' | 'QUALIFIED' | 'SHOTGUN' | 'REJECTED'
  reasoning: string
  keyStrengths?: string[]
  citedEvidence?: { fact: string; source: string }[]
  allCitedFacts?: { fact: string; source: string; sourceTitle?: string }[]
}

interface LeadRecord {
  id: string
  agentId?: string
  agentName?: string
  company: string
  contactName: string
  status: 'queued' | 'sent'
  subject?: string
  body?: string
  aiReport?: AIReport
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
    status,
    subject: (emailData.finalSubject as string) || (e.subject as string),
    body: (emailData.finalBody as string) || (e.body as string),
    aiReport,
  }
}

function tierBucket(tier?: string): 'qualified' | 'research' | 'rejected' | null {
  if (tier === 'HIGHLY_QUALIFIED' || tier === 'QUALIFIED') return 'qualified'
  if (tier === 'SHOTGUN') return 'research'
  if (tier === 'REJECTED') return 'rejected'
  return null
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
        <span key={i} className="h-1.5 w-4 rounded-full" style={{ background: i < filled ? 'oklch(0.52 0.14 158)' : 'oklch(0.9 0.012 95)' }} />
      ))}
    </div>
  )
}

function confidenceDotCount(confidence?: string): number {
  const c = (confidence || '').toLowerCase()
  if (c === 'high') return 5
  if (c === 'medium') return 3
  if (c === 'low') return 2
  return 0
}

function ConfidenceDots({ confidence }: { confidence?: string }) {
  const filled = confidenceDotCount(confidence)
  const c = (confidence || '').toLowerCase()
  const color = c === 'high' ? 'oklch(0.52 0.14 158)' : c === 'medium' ? 'oklch(0.72 0.09 80)' : 'oklch(0.6 0.18 28)'
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < filled ? color : 'oklch(0.9 0.012 95)' }} />
      ))}
    </div>
  )
}

export function LeadsContent() {
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'research' | 'sources' | 'draft'>('research')
  const pageSize = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, queueRes, sentRes] = await Promise.allSettled([
        api.get('/api/auth/agents'),
        api.get('/api/email-queue/queue', { params: { agentId: 'all', limit: 500 } }),
        api.get('/api/email-queue/sent', { params: { agentId: 'all', limit: 500 } }),
      ])
      const agentNameById = new Map<string, string>()
      if (agentsRes.status === 'fulfilled') {
        for (const a of (agentsRes.value.data?.agents ?? [])) agentNameById.set(a.agentId, a.name)
      }
      const queue = queueRes.status === 'fulfilled' ? (queueRes.value.data?.emails ?? queueRes.value.data?.queue ?? queueRes.value.data ?? []) : []
      const sent = sentRes.status === 'fulfilled' ? (sentRes.value.data?.emails ?? sentRes.value.data ?? []) : []
      const merged = [
        ...(Array.isArray(queue) ? queue : []).map((e: Record<string, unknown>) => extractLead(e, 'queued', agentNameById)),
        ...(Array.isArray(sent) ? sent : []).map((e: Record<string, unknown>) => extractLead(e, 'sent', agentNameById)),
      ].filter(l => l.aiReport)
      setLeads(merged)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return leads
    return leads.filter(l => `${l.company} ${l.contactName} ${l.agentName ?? ''}`.toLowerCase().includes(q))
  }, [leads, search])

  const counts = useMemo(() => {
    let qualified = 0, research = 0, rejected = 0
    for (const l of leads) {
      const b = tierBucket(l.aiReport?.tier)
      if (b === 'qualified') qualified++
      else if (b === 'research') research++
      else if (b === 'rejected') rejected++
    }
    return { qualified, research, rejected, total: leads.length }
  }, [leads])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)
  const selected = leads.find(l => l.id === selectedId) || null

  const tierColors: Record<string, string> = {
    HIGHLY_QUALIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    QUALIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    SHOTGUN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    REJECTED: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        Select a lead to view its research report, sources, and outreach draft.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'oklch(0.52 0.14 158)' }}>
            <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Qualified</p>
            <p className="font-display text-2xl leading-tight text-primary">{counts.qualified}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'oklch(0.72 0.09 80)' }}>
            <Search className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Research</p>
            <p className="font-display text-2xl leading-tight text-primary">{counts.research}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'oklch(0.6 0.015 145)' }}>
            <XCircle className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rejected</p>
            <p className="font-display text-2xl leading-tight text-primary">{counts.rejected}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'oklch(0.6 0.07 290)' }}>
            <UsersIcon className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Leads</p>
            <p className="font-display text-2xl leading-tight text-primary">{counts.total}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 @5xl:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <div className="relative mb-3 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search company, contact, agent…"
              className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
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
                        selectedId === l.id && 'bg-[oklch(0.97_0.02_150)] ring-1 ring-inset ring-[oklch(0.52_0.14_158)]',
                      )}
                    >
                      <td className="py-2.5 px-3">
                        <p className="font-medium truncate max-w-[180px]">{l.company || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{l.contactName}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">{l.aiReport?.score ?? '—'}%</span>
                          {l.aiReport?.score !== undefined && <ScoreMeter value={l.aiReport.score} />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <p>{l.aiReport?.confidence ?? '—'}</p>
                          <ConfidenceDots confidence={l.aiReport?.confidence} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium', tierColors[l.aiReport?.tier ?? ''] ?? 'bg-muted text-muted-foreground')}>
                          {l.aiReport?.tier ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs">{l.agentName ?? '—'}</td>
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
              <button onClick={() => setSelectedId(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            <div className="flex items-center gap-5 border-b border-border mb-3">
              {(['research', 'sources', 'draft'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDetailTab(t)}
                  className={cn(
                    'relative pb-2.5 text-sm font-medium capitalize',
                    detailTab === t ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'draft' ? 'Outreach Draft' : t}
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
                    <p className="text-lg font-bold">{selected.aiReport?.score ?? '—'}%</p>
                    <p className="text-[11px] text-muted-foreground">Fit Score</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-lg font-bold">{selected.aiReport?.confidence ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground">Confidence</p>
                  </div>
                </div>
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
