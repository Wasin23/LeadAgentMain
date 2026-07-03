'use client'

import { Coins, CalendarIcon } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { fetchDisplayedCreditData } from '@/lib/credit-balance'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange } from 'react-day-picker'

type CreditGranularity = 'day' | 'week' | 'month' | 'custom'

function buildDailyCredits(emails: any[], days = 90) {
  const now = new Date()
  return Array.from({ length: days }, (_, rev) => {
    const daysAgo = days - 1 - rev
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    const rawDate = d.toLocaleDateString('en-CA')
    const label   = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const credits = emails.filter(e => {
      const t = new Date(e.sentAt || e.createdAt || e.timestamp || 0)
      return t.toLocaleDateString('en-CA') === rawDate
    }).length
    return { month: label, rawDate, Credits: credits }
  })
}

function buildWeeklyCredits(emails: any[], weeks = 12) {
  const now = new Date()
  return Array.from({ length: weeks }, (_, rev) => {
    const weeksAgo = weeks - 1 - rev
    const end = new Date(now)
    end.setDate(end.getDate() - weeksAgo * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    const credits = emails.filter(e => {
      const t = new Date(e.sentAt || e.createdAt || e.timestamp || 0)
      return t >= start && t < end
    }).length
    return { month: label, Credits: credits }
  })
}

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

export function CreditConsumptionChart() {
  const [allSentEmails, setAllSentEmails] = useState<any[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [granularity, setGranularity] = useState<CreditGranularity>('day')
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = useCallback(async () => {
    const [sentRes, creditRes] = await Promise.allSettled([
      api.get('/api/email-queue/sent', { params: { agentId: 'all' } }),
      fetchDisplayedCreditData(),
    ])
    if (sentRes.status === 'fulfilled') {
      setAllSentEmails(Array.isArray(sentRes.value.data) ? sentRes.value.data : [])
    }
    if (creditRes.status === 'fulfilled') setCreditBalance(creditRes.value.balance)
  }, [])

  useEffect(() => { load() }, [load])

  const dailyCredits   = buildDailyCredits(allSentEmails)
  const weeklyCredits  = buildWeeklyCredits(allSentEmails)
  const monthlyCredits = buildMonthlyCredits(allSentEmails)
  const minDate = dailyCredits.length > 0 ? new Date(dailyCredits[0].rawDate) : undefined

  const series =
    granularity === 'week'  ? weeklyCredits :
    granularity === 'month' ? monthlyCredits :
    granularity === 'custom'
      ? (customRange?.from && customRange?.to
          ? dailyCredits.filter(p => {
              const d = new Date(p.rawDate)
              return d >= customRange.from! && d <= customRange.to!
            })
          : [])
      : dailyCredits.slice(-30)

  const maxTick = Math.max(10, Math.ceil(Math.max(0, ...series.map((p: any) => p.Credits ?? 0)) / 10) * 10)
  const ticks = Array.from({ length: maxTick / 10 + 1 }, (_, i) => i * 10)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning-soft">
            <Coins className="h-4 w-4 text-warning-soft-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-display text-base text-foreground">Credit Consumption</h4>
              <InfoTooltip text="Credits consumed (1 credit ≈ 1 sent email) over the selected period" />
            </div>
            {creditBalance !== null && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Balance: <span className="font-semibold text-foreground">{creditBalance.toLocaleString()}</span> credits remaining
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
          {(['day', 'week', 'month'] as CreditGranularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                granularity === g ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {g}
            </button>
          ))}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={() => setGranularity('custom')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  granularity === 'custom' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarIcon className="h-3 w-3" />
                {granularity === 'custom' && customRange?.from && customRange?.to
                  ? `${customRange.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${customRange.to.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'Custom'}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(range) => {
                  setCustomRange(range)
                  setGranularity('custom')
                  if (range?.from && range?.to) setPickerOpen(false)
                }}
                disabled={minDate ? { before: minDate } : undefined}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gCreditBilling" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--brass)" stopOpacity={1}    />
              <stop offset="95%" stopColor="var(--brass)" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
            domain={[0, maxTick]}
            ticks={ticks}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="Credits" fill="url(#gCreditBilling)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
