'use client'

import { ShieldCheck } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { fetchDisplayedCreditData } from '@/lib/credit-balance'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { InfoTooltip } from '@/components/ui/info-tooltip'

// ── static data ──────────────────────────────────────────────────────────────
// (Credit consumption chart moved to Settings → Billing: components/billing/credit-consumption-chart.tsx.
//  monthlyCredits is still built here because the CSV export includes it.)

function buildMonthlyCredits(emails: any[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, rev) => {
    const i = 5 - rev
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const credits = emails.filter(e => {
      const t = new Date(e.sentAt || e.createdAt || e.timestamp || 0)
      return t >= start && t < end
    }).length
    return { month: label, Credits: credits }
  })
}

function buildDomainStats(emails: any[], limit = 10) {
  const map: Record<string, { sent: number; bounced: number; opened: number; primary: number; promotional: number }> = {}
  emails.forEach((e: any) => {
    const sender: string = (e.fromAccount || e.from || 'Unknown').toLowerCase()
    if (!map[sender]) map[sender] = { sent: 0, bounced: 0, opened: 0, primary: 0, promotional: 0 }
    const sk: string = e.SK || ''
    if (sk.startsWith('BOUNCED#')) {
      map[sender].bounced++
    } else {
      map[sender].sent++
    }
    if (e.opened) map[sender].opened++
    if (e.inboxPlacement === 'primary') map[sender].primary++
    else if (e.inboxPlacement === 'promotional') map[sender].promotional++
  })
  return Object.entries(map)
    .sort((a, b) => (b[1].sent + b[1].bounced) - (a[1].sent + a[1].bounced))
    .slice(0, limit)
    .map(([sender, d]) => {
      const total = d.sent + d.bounced
      return {
        domain: sender.length > 26 ? sender.substring(0, 24) + '…' : sender,
        fullSender: sender,
        Sent: total,
        Bounced: d.bounced,
        Opened: d.opened,
        'Success Rate': total > 0 ? parseFloat((((total - d.bounced) / total) * 100).toFixed(1)) : 0,
        'Open Rate': total > 0 ? parseFloat(((d.opened / total) * 100).toFixed(1)) : 0,
        'Primary Inbox': total > 0 ? parseFloat(((d.primary / total) * 100).toFixed(1)) : 0,
        'Promotional Inbox': total > 0 ? parseFloat(((d.promotional / total) * 100).toFixed(1)) : 0,
      }
    })
}

// ── helpers ───────────────────────────────────────────────────────────────────
type Range = 'day' | 'week' | 'month'

function buildTimeSeries(emails: any[], range: Range) {
  const points = range === 'day' ? 24 : range === 'week' ? 7 : 30
  const now = new Date()
  return Array.from({ length: points }, (_, rev) => {
    const i = points - 1 - rev
    const d = new Date(now)
    let label: string
    let start: Date, end: Date
    if (range === 'day') {
      d.setHours(d.getHours() - i)
      start = new Date(d); start.setMinutes(0, 0, 0)
      end = new Date(start); end.setHours(end.getHours() + 1)
      label = `${start.getHours()}:00`
    } else {
      d.setDate(d.getDate() - i)
      start = new Date(d); start.setHours(0, 0, 0, 0)
      end = new Date(start); end.setDate(end.getDate() + 1)
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    let sent = 0, replied = 0
    emails.forEach((e: any) => {
      const t = new Date(e.sentAt || e.createdAt || e.timestamp || 0)
      if (t >= start && t < end) {
        sent++
        if (e.replied || e.status === 'REPLIED') replied++
      }
    })
    return { date: label, Sent: sent, Replied: replied }
  })
}

// ── main component ────────────────────────────────────────────────────────────
const RANGE: Range = 'week'

export interface ExportState { run: () => void; loading: boolean }

export function AnalyticsContent({ onExportReady, healthSent = 0, healthBounced = 0, healthOpened = 0 }: {
  onExportReady?: (state: ExportState) => void
  healthSent?: number
  healthBounced?: number
  healthOpened?: number
} = {}) {
  const [agents, setAgents] = useState<any[]>([])
  const [totals, setTotals] = useState({ queued: 0, sent: 0, replied: 0, replyRate: '0' })
  const [allSentEmails, setAllSentEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [emailTimeSeries, setEmailTimeSeries] = useState<any[]>([])
  const [monthlyCredits, setMonthlyCredits] = useState<any[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [domainStats, setDomainStats] = useState<any[]>([])
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, countsRes, sentRes, creditRes] = await Promise.allSettled([
        api.get('/api/auth/agents'),
        api.get('/api/email-queue/counts', { params: { agentId: 'all' } }),
        api.get('/api/email-queue/sent',   { params: { agentId: 'all' } }),
        fetchDisplayedCreditData(),
      ])

      if (agentsRes.status === 'fulfilled') {
        const raw: any[] = agentsRes.value.data?.agents ?? []
        const enriched = await Promise.all(
          raw.filter((a: any) => a.agentId !== 'orphan').map(async (agent: any) => {
            try {
              const c = await api.get('/api/email-queue/counts', { params: { agentId: agent.agentId } })
              const q = c.data?.queued ?? 0
              const s = c.data?.sent ?? 0
              const r = c.data?.replied ?? 0
              return { name: agent.name || agent.agentName || 'Agent', queued: q, sent: s, replied: r, replyRate: s > 0 ? parseFloat(((r / s) * 100).toFixed(1)) : 0 }
            } catch {
              return { name: agent.name || 'Agent', queued: 0, sent: 0, replied: 0, replyRate: 0 }
            }
          }),
        )
        setAgents(enriched)
      }

      if (countsRes.status === 'fulfilled') {
        const d = countsRes.value.data
        const s = d.sent ?? 0; const r = d.replied ?? 0
        setTotals({ queued: d.queued ?? 0, sent: s, replied: r, replyRate: s > 0 ? ((r / s) * 100).toFixed(1) : '0' })
      }

      if (sentRes.status === 'fulfilled') {
        const all: any[] = Array.isArray(sentRes.value.data) ? sentRes.value.data : []
        all.sort((a, b) => new Date(b.sentAt || b.createdAt || b.timestamp || 0).getTime() - new Date(a.sentAt || a.createdAt || a.timestamp || 0).getTime())
        setAllSentEmails(all)
      }

      if (creditRes.status === 'fulfilled') {
        setCreditBalance(creditRes.value.balance)
      }
    } catch (e) { console.error('Analytics load error', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    setEmailTimeSeries(buildTimeSeries(allSentEmails, RANGE))
    setMonthlyCredits(buildMonthlyCredits(allSentEmails))
    setDomainStats(buildDomainStats(allSentEmails))
  }, [allSentEmails])

  const exportReport = useCallback(() => {
    const rows: string[] = []
    const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`

    // ── Summary ─────────────────────────────────────────────────────────
    rows.push('SUMMARY')
    rows.push(['Metric', 'Value'].map(q).join(','))
    rows.push([q('Queued Emails'),    q(String(totals.queued))].join(','))
    rows.push([q('Emails Sent'),      q(String(totals.sent))].join(','))
    rows.push([q('Replies Received'), q(String(totals.replied))].join(','))
    rows.push([q('Reply Rate'),       q(totals.replyRate + '%')].join(','))
    if (creditBalance !== null)
      rows.push([q('Credit Balance'), q(String(creditBalance))].join(','))
    rows.push('')

    // ── Per-Agent Performance ────────────────────────────────────────────
    rows.push('AGENT PERFORMANCE')
    rows.push(['Agent', 'Queued', 'Sent', 'Replied', 'Reply Rate'].map(q).join(','))
    agents.forEach(a => {
      rows.push([q(a.name), q(String(a.queued)), q(String(a.sent)), q(String(a.replied)), q(a.replyRate + '%')].join(','))
    })
    rows.push('')

    // ── Email Activity Time Series ───────────────────────────────────────
    rows.push(`EMAIL ACTIVITY (${RANGE})`)
    rows.push(['Date', 'Sent', 'Replied'].map(q).join(','))
    emailTimeSeries.forEach(r => {
      rows.push([q(r.date), q(r.Sent), q(r.Replied)].join(','))
    })
    rows.push('')

    // ── Sender Delivery Stats ────────────────────────────────────────────
    rows.push('SENDER DELIVERY STATS')
    rows.push(['Sender', 'Total Sent', 'Bounced', 'Opened', 'Success Rate', 'Open Rate', 'Primary Inbox', 'Promotional Inbox'].map(q).join(','))
    domainStats.forEach(d => {
      rows.push([q(d.fullSender), q(d.Sent), q(d.Bounced), q(d.Opened), q(d['Success Rate'] + '%'), q(d['Open Rate'] + '%'), q(d['Primary Inbox'] + '%'), q(d['Promotional Inbox'] + '%')].join(','))
    })
    rows.push('')

    // ── Monthly Credit Consumption ───────────────────────────────────────
    rows.push('MONTHLY EMAIL VOLUME')
    rows.push(['Month', 'Emails Sent'].map(q).join(','))
    monthlyCredits.forEach(m => {
      rows.push([q(m.month), q(m.Credits)].join(','))
    })
    rows.push('')

    // ── Recent Sent Emails ───────────────────────────────────────────────
    rows.push('RECENT SENT EMAILS')
    rows.push(['To', 'Subject', 'Agent', 'Date', 'Replied'].map(q).join(','))
    allSentEmails.slice(0, 200).forEach(e => {
      rows.push([
        q(e.recipientEmail || e.to || ''),
        q(e.subject || ''),
        q(e.agentName || ''),
        q(new Date(e.sentAt || e.timestamp || 0).toLocaleString()),
        q(e.replied || e.status === 'REPLIED' ? 'Yes' : 'No'),
      ].join(','))
    })

    const csv  = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `meridian-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [totals, agents, emailTimeSeries, domainStats, monthlyCredits, allSentEmails, creditBalance])

  useEffect(() => {
    onExportReady?.({ run: exportReport, loading })
  }, [exportReport, loading, onExportReady])

  const healthOpenRate    = healthSent > 0 ? ((healthOpened  / healthSent) * 100).toFixed(1) : '-'
  const healthBounceRateN = healthSent > 0 ? (healthBounced / healthSent) * 100 : 0
  const healthBounceRate  = healthSent > 0 ? healthBounceRateN.toFixed(1) : '-'
  const isHealthy         = healthSent === 0 || healthBounceRateN <= 5

  return (
    <div className="space-y-4">

      {/* Delivery: health strip + per-sender stats, one card */}
      <div className="grid grid-cols-1 gap-4">

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success-soft">
                <ShieldCheck className="h-4 w-4 text-success-soft-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-display text-base text-foreground">Delivery</h4>
                <InfoTooltip text="Success rate = delivered ÷ total · open rate = opened ÷ total" />
              </div>
            </div>
            <span className={`flex items-center gap-1 text-[11px] font-medium ${isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {healthSent === 0 ? 'No data' : isHealthy ? 'Healthy' : 'Needs attention'}
            </span>
          </div>

          {healthSent > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center">
                <p className="text-sm font-bold tabular-nums">{healthSent.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Sent</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center">
                <p className="text-sm font-bold text-violet-500 tabular-nums">{healthOpenRate}%</p>
                <p className="text-[10px] text-muted-foreground">Open rate</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center">
                <p className="text-sm font-bold tabular-nums">{healthBounceRate}%</p>
                <p className="text-[10px] text-muted-foreground">Bounce rate</p>
              </div>
            </div>
          )}
          {loading
            ? <div className="h-[240px] rounded bg-muted/30 animate-pulse" />
            : domainStats.length === 0
              ? <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">No emails sent yet</div>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={domainStats}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                    barSize={7}
                    barGap={2}
                    barCategoryGap="28%"
                  >
                    <defs>
                      <linearGradient id="gSuccess" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="var(--success)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="gOpenRate" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="var(--brass)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="var(--brass)" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="gPrimary" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="gPromo" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#a855f7" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="domain" width={115} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md space-y-1">
                            <p className="font-semibold">{d.fullSender}</p>
                            <p className="text-muted-foreground">Total sent: <span className="text-foreground font-medium">{d.Sent}</span></p>
                            <p className="text-muted-foreground">Bounced: <span className="text-foreground font-medium">{d.Bounced}</span></p>
                            <p className="text-muted-foreground">Success rate: <span className="text-success font-semibold">{d['Success Rate']}%</span></p>
                            <p className="text-muted-foreground">Opened: <span className="text-foreground font-medium">{d.Opened}</span> · Open rate: <span className="text-warning-soft-foreground font-semibold">{d['Open Rate']}%</span></p>
                            <p className="text-muted-foreground">Primary inbox: <span className="font-semibold" style={{ color: '#3b82f6' }}>{d['Primary Inbox']}%</span> · Promotional/other: <span className="font-semibold" style={{ color: '#a855f7' }}>{d['Promotional Inbox']}%</span></p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'var(--muted-foreground)' }} />
                    <Bar dataKey="Success Rate"      name="Success Rate"      fill="url(#gSuccess)" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="Open Rate"         name="Open Rate"         fill="url(#gOpenRate)" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="Primary Inbox"     name="Primary Inbox"     fill="url(#gPrimary)" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="Promotional Inbox" name="Promotional Inbox" fill="url(#gPromo)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
        </div>

      </div>
    </div>
  )
}
