'use client'

import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock, Mail, MessageSquare, BarChart2,
  ArrowUpRight, Send, Bot, Activity, Download,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { fetchDisplayedCreditData } from '@/lib/credit-balance'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// ── static data ──────────────────────────────────────────────────────────────
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
  const map: Record<string, { sent: number; bounced: number; opened: number }> = {}
  emails.forEach((e: any) => {
    const sender: string = (e.fromAccount || e.from || 'Unknown').toLowerCase()
    if (!map[sender]) map[sender] = { sent: 0, bounced: 0, opened: 0 }
    const sk: string = e.SK || ''
    if (sk.startsWith('BOUNCED#')) {
      map[sender].bounced++
    } else {
      map[sender].sent++
    }
    if (e.opened) map[sender].opened++
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
      }
    })
}

const AGENT_COLORS = ['#a855f7', '#22c55e', '#3b82f6', '#f97316', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1']

function buildAgentTimeSeries(
  emails: any[],
  agentMap: Record<string, string>,
  range: Range,
) {
  const points = range === 'day' ? 24 : range === 'week' ? 7 : 30
  const now = new Date()
  const agentNames = Object.values(agentMap)
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
    const row: Record<string, any> = { date: label }
    agentNames.forEach(n => { row[n] = 0 })
    emails.forEach((e: any) => {
      const t = new Date(e.sentAt || e.createdAt || e.timestamp || 0)
      if (t >= start && t < end) {
        const name = agentMap[e.agentId] || e.agentId
        if (name) row[name] = (row[name] ?? 0) + 1
      }
    })
    return row
  })
}



// ── custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl text-xs z-50">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-1.5">
          <span>{p.name}:</span><span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── range toggle ──────────────────────────────────────────────────────────────
function RangeToggle({ value, onChange }: { value: string; onChange: (v: 'day' | 'week' | 'month') => void }) {
  return (
    <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
      {(['day', 'week', 'month'] as const).map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
            value === r ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  )
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

function buildCycleSeries(activities: any[], range: Range) {
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
    const count = activities.filter((a: any) => {
      if (!(a.title?.toLowerCase().includes('cycle') || a.category === 'cycle')) return false
      const t = new Date(a.timestamp)
      return t >= start && t < end
    }).length
    return { date: label, Cycles: count }
  })
}

// ── main component ────────────────────────────────────────────────────────────
export function AnalyticsContent() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const [agents, setAgents] = useState<any[]>([])
  const [totals, setTotals] = useState({ queued: 0, sent: 0, replied: 0, replyRate: '0' })
  const [recentEmails, setRecentEmails] = useState<any[]>([])
  const [allSentEmails, setAllSentEmails] = useState<any[]>([])
  const [rawActivities, setRawActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [emailTimeSeries, setEmailTimeSeries] = useState<any[]>([])
  const [cycleTimeSeries, setCycleTimeSeries] = useState<any[]>([])
  const [monthlyCredits, setMonthlyCredits] = useState<any[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [domainStats, setDomainStats] = useState<any[]>([])
  const [agentMap, setAgentMap] = useState<Record<string, string>>({})
  const [agentTimeSeries, setAgentTimeSeries] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState<Range>('week')
  const [activityFilter, setActivityFilter] = useState<'all' | 'cycles' | 'issues' | 'agents'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, countsRes, sentRes, activityRes, creditRes] = await Promise.allSettled([
        api.get('/api/auth/agents'),
        api.get('/api/email-queue/counts', { params: { agentId: 'all' } }),
        api.get('/api/email-queue/sent',   { params: { agentId: 'all' } }),
        api.get('/api/monitoring/activity'),
        fetchDisplayedCreditData(),
      ])

      if (agentsRes.status === 'fulfilled') {
        const raw: any[] = agentsRes.value.data?.agents ?? []
        const map: Record<string, string> = {}
        raw.filter((a: any) => a.agentId !== 'orphan').forEach((a: any) => {
          map[a.agentId] = a.name || a.agentName || a.agentId
        })
        setAgentMap(map)
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
        setRecentEmails(all.slice(0, 20))
      }

      if (activityRes.status === 'fulfilled') {
        setRawActivities(activityRes.value.data?.activities ?? [])
      }

      if (creditRes.status === 'fulfilled') {
        setCreditBalance(creditRes.value.balance)
      }
    } catch (e) { console.error('Analytics load error', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    setEmailTimeSeries(buildTimeSeries(allSentEmails, timeRange))
    setCycleTimeSeries(buildCycleSeries(rawActivities, timeRange))
    setMonthlyCredits(buildMonthlyCredits(allSentEmails))
    setDomainStats(buildDomainStats(allSentEmails))
    setAgentTimeSeries(buildAgentTimeSeries(allSentEmails, agentMap, timeRange))
  }, [allSentEmails, rawActivities, timeRange, agentMap])

  const filteredActivities = rawActivities.filter((a: any) => {
    if (activityFilter === 'all')    return true
    if (activityFilter === 'cycles') return a.title?.toLowerCase().includes('cycle') || a.category === 'cycle'
    if (activityFilter === 'issues') return a.activityType === 'issue' || a.category === 'issue'
    if (activityFilter === 'agents') return ['agent', 'bot'].some((kw: string) => a.title?.toLowerCase().includes(kw))
    return true
  })

  const exportReport = useCallback(() => {
    const rows: string[] = []
    const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`

    // ── Summary ─────────────────────────────────────────────────────────
    rows.push('SUMMARY')
    rows.push(['Metric', 'Value'].map(q).join(','))
    rows.push([q('Queued Emails'),    q(totals.queued)].join(','))
    rows.push([q('Emails Sent'),      q(totals.sent)].join(','))
    rows.push([q('Replies Received'), q(totals.replied)].join(','))
    rows.push([q('Reply Rate'),       q(totals.replyRate + '%')].join(','))
    if (creditBalance !== null)
      rows.push([q('Credit Balance'), q(String(creditBalance))].join(','))
    rows.push('')

    // ── Per-Agent Performance ────────────────────────────────────────────
    rows.push('AGENT PERFORMANCE')
    rows.push(['Agent', 'Queued', 'Sent', 'Replied', 'Reply Rate'].map(q).join(','))
    agents.forEach(a => {
      rows.push([q(a.name), q(a.queued), q(a.sent), q(a.replied), q(a.replyRate + '%')].join(','))
    })
    rows.push('')

    // ── Email Activity Time Series ───────────────────────────────────────
    rows.push(`EMAIL ACTIVITY (${timeRange})`)
    rows.push(['Date', 'Sent', 'Replied'].map(q).join(','))
    emailTimeSeries.forEach(r => {
      rows.push([q(r.date), q(r.Sent), q(r.Replied)].join(','))
    })
    rows.push('')

    // ── Sender Delivery Stats ────────────────────────────────────────────
    rows.push('SENDER DELIVERY STATS')
    rows.push(['Sender', 'Total Sent', 'Bounced', 'Opened', 'Success Rate', 'Open Rate'].map(q).join(','))
    domainStats.forEach(d => {
      rows.push([q(d.fullSender), q(d.Sent), q(d.Bounced), q(d.Opened), q(d['Success Rate'] + '%'), q(d['Open Rate'] + '%')].join(','))
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
  }, [totals, agents, emailTimeSeries, domainStats, monthlyCredits, allSentEmails, creditBalance, timeRange])

  return (
    <div className="space-y-6">

      {/* Export bar */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={loading}
          onClick={exportReport}
        >
          <Download className="w-3.5 h-3.5" />
          {loading ? 'Loading data…' : 'Export Report (.csv)'}
        </Button>
      </div>

      {/* live email stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Queued Emails',    value: String(totals.queued),    unit: '',  Icon: Clock,          iconColor: 'text-orange-500', iconBg: 'bg-orange-500/10' },
          { label: 'Emails Sent',      value: String(totals.sent),      unit: '',  Icon: Mail,           iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10' },
          { label: 'Replies Received', value: String(totals.replied),   unit: '',  Icon: MessageSquare,  iconColor: 'text-green-500',  iconBg: 'bg-green-500/10'  },
          { label: 'Reply Rate',       value: String(totals.replyRate), unit: '%', Icon: BarChart2,      iconColor: 'text-blue-500',   iconBg: 'bg-blue-500/10'   },
        ] as const).map((card, i) => (
          <Card
            key={card.label}
            onMouseEnter={() => setHoveredCard(i)}
            onMouseLeave={() => setHoveredCard(null)}
            className={`p-4 cursor-pointer transition-all duration-300 ${hoveredCard === i ? 'scale-[1.02] shadow-xl' : 'shadow-sm'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 ${card.iconBg} rounded-full shrink-0`}>
                  <card.Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                </div>
                <p className="text-xs font-medium text-muted-foreground leading-tight">{card.label}</p>
              </div>
              <div className={`w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 transition-transform duration-300 ${hoveredCard === i ? 'rotate-45' : ''}`}>
                <ArrowUpRight className="w-3 h-3 text-primary-foreground" />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1.5">
              {card.value}
              {card.unit && <span className="text-sm font-normal ml-0.5 text-muted-foreground">{card.unit}</span>}
            </p>
            <div className="flex items-center gap-1 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-green-500">Live</span>
              <span className="text-muted-foreground ml-0.5">real-time data</span>
            </div>
          </Card>
        ))}
      </div>

      {/* main recharts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Email activity – area chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-sm font-semibold">Email Activity Over Time</CardTitle>
            <RangeToggle value={timeRange} onChange={setTimeRange} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={emailTimeSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="Sent"    stroke="#a855f7" strokeWidth={2} fill="url(#gSent)"    dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Replied" stroke="#22c55e" strokeWidth={2} fill="url(#gReplied)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Agent performance – multi-line time series */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-sm font-semibold">Agent Performance Over Time</CardTitle>
            <RangeToggle value={timeRange} onChange={setTimeRange} />
          </div>
          {loading ? <div className="h-[220px] rounded bg-muted/30 animate-pulse" />
            : Object.keys(agentMap).length === 0
              ? <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">No agent data yet</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={agentTimeSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {Object.values(agentMap).map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={AGENT_COLORS[i % AGENT_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
        </Card>

        {/* Reply trend – line chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-sm font-semibold">Reply Trend Over Time</CardTitle>
            <RangeToggle value={timeRange} onChange={setTimeRange} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={emailTimeSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Line type="monotone" dataKey="Sent"    stroke="#a855f7" strokeWidth={2}   dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Replied" stroke="#22c55e" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Cycles – area chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-sm font-semibold">Agent Cycles Completed</CardTitle>
            <RangeToggle value={timeRange} onChange={setTimeRange} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cycleTimeSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gCycle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Cycles" stroke="#3b82f6" strokeWidth={2} fill="url(#gCycle)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

      </div>

      {/* monthly credit + domain success stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Monthly Credit Consumption</CardTitle>
              {creditBalance !== null && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Balance: <span className="font-semibold text-foreground">{creditBalance.toLocaleString()}</span> credits remaining
                </p>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyCredits} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gCredit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={1}    />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Credits" fill="url(#gCredit)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Domain success rate + open rate */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Sender Delivery Stats</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Success rate = delivered ÷ total · open rate = opened ÷ total</p>
            </div>
          </div>
          {loading
            ? <div className="h-[260px] rounded bg-muted/30 animate-pulse" />
            : domainStats.length === 0
              ? <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">No emails sent yet</div>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={domainStats}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                    barSize={9}
                    barGap={3}
                    barCategoryGap="28%"
                  >
                    <defs>
                      <linearGradient id="gSuccess" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.9} />
                      </linearGradient>
                      <linearGradient id="gOpenRate" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="domain" width={115} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md space-y-1">
                            <p className="font-semibold">{d.fullSender}</p>
                            <p className="text-muted-foreground">Total sent: <span className="text-foreground font-medium">{d.Sent}</span></p>
                            <p className="text-muted-foreground">Bounced: <span className="text-foreground font-medium">{d.Bounced}</span></p>
                            <p className="text-muted-foreground">Success rate: <span className="text-green-500 font-semibold">{d['Success Rate']}%</span></p>
                            <p className="text-muted-foreground">Opened: <span className="text-foreground font-medium">{d.Opened}</span> · Open rate: <span className="text-blue-400 font-semibold">{d['Open Rate']}%</span></p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="Success Rate" name="Success Rate" fill="url(#gSuccess)" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="Open Rate"    name="Open Rate"    fill="url(#gOpenRate)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
        </Card>

      </div>

      {/* recent emails + agent performance + activity log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card className="p-5">
          <CardTitle className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-500" /> Recent Sent Emails
          </CardTitle>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)
              : recentEmails.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-10">No emails sent yet</p>
                : recentEmails.map((email, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{email.recipientEmail || email.to || '—'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{email.subject || '(no subject)'}</p>
                        </div>
                        {(email.replied || email.status === 'REPLIED') && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/15 text-green-600 border-green-500/30 shrink-0">Replied</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {email.agentName && `${email.agentName} · `}{new Date(email.sentAt || email.timestamp || 0).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" /> Agent Performance
          </CardTitle>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />)
              : agents.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-10">No agents configured</p>
                : agents.map((agent, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold truncate">{agent.name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{agent.replyRate}% reply rate</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-amber-500 text-lg font-bold leading-none">{agent.queued}</p><p className="text-[10px] text-muted-foreground mt-0.5">Queued</p></div>
                        <div><p className="text-purple-500 text-lg font-bold leading-none">{agent.sent}</p><p className="text-[10px] text-muted-foreground mt-0.5">Sent</p></div>
                        <div><p className="text-green-500 text-lg font-bold leading-none">{agent.replied}</p><p className="text-[10px] text-muted-foreground mt-0.5">Replied</p></div>
                      </div>
                    </div>
                  ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" /> Recent Activity
            </CardTitle>
            <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
              {(['all', 'cycles', 'issues', 'agents'] as const).map(f => (
                <button key={f} onClick={() => setActivityFilter(f)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all capitalize ${
                    activityFilter === f ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)
              : filteredActivities.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-10">No activity</p>
                : filteredActivities.slice(0, 25).map((act: any, i: number) => {
                    const isError = act.activityType === 'issue' || act.category === 'issue'
                    const isCycle = act.title?.toLowerCase().includes('cycle') || act.category === 'cycle'
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isError ? 'bg-red-500' : isCycle ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{act.title || act.message}</p>
                          {act.details && <p className="text-[11px] text-muted-foreground truncate">{act.details}</p>}
                          <p className="text-[10px] text-muted-foreground">{new Date(act.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  })}
          </div>
        </Card>

      </div>
    </div>
  )
}
