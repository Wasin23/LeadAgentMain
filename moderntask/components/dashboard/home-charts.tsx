"use client"

import { Card, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Database, ShieldCheck, ChevronRight } from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"
import { Reminders, type ScheduledBatch } from "@/components/dashboard/reminders"

export interface EmailTimePoint { date: string; Sent: number; Replied: number }
export interface MonthlyPoint   { month: string; Credits: number }

interface HomeChartsProps {
  emailTimeSeries?:  EmailTimePoint[]
  monthlyCredits?:   MonthlyPoint[]
  scheduledBatches?: ScheduledBatch[]
  creditBalance?:    number | null
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

type Range = "7d" | "14d" | "30d" | "90d"

const RANGE_LABELS: Record<Range, string> = { "7d": "7D", "14d": "14D", "30d": "30D", "90d": "90D" }
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }

function RangeToggle({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  return (
    <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
      {(["7d", "14d", "30d", "90d"] as Range[]).map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
            value === r ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  )
}

const DONUT_COLORS = ["#a855f7", "#f97316", "#22c55e"]

export function HomeCharts({
  emailTimeSeries = [],
  monthlyCredits = [],
  scheduledBatches = [],
  creditBalance = null,
}: HomeChartsProps) {
  const [range, setRange] = useState<Range>("7d")

  const slicedSeries = emailTimeSeries.slice(-RANGE_DAYS[range])

  return (
    <div className="space-y-3 md:space-y-4">

      {/* Email Activity — full width */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-sm font-semibold">Email Activity Over Time</CardTitle>
          <RangeToggle value={range} onChange={setRange} />
        </div>
        {slicedSeries.length === 0 ? (
          <div className="h-[150px] flex items-center justify-center text-xs text-muted-foreground">No email data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={slicedSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="hcgSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="hcgReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "hsl(var(--muted-foreground))" }} />
              <Area type="monotone" dataKey="Sent"    stroke="#a855f7" strokeWidth={2} fill="url(#hcgSent)"    dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Replied" stroke="#22c55e" strokeWidth={2} fill="url(#hcgReplied)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Scheduled Sends + Credit Consumption — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">

        <Reminders batches={scheduledBatches} />

        {/* Credit Consumption Over Time */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Credit Consumption Over Time</CardTitle>
              {creditBalance !== null && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Balance: <span className="font-semibold text-foreground">{creditBalance.toLocaleString()}</span> credits remaining
                </p>
              )}
            </div>
          </div>
          {monthlyCredits.every(m => m.Credits === 0) ? (
            <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">No usage data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyCredits} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="hcgCredit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a855f7" stopOpacity={1} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Credits" name="Emails Sent" fill="url(#hcgCredit)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

      </div>
    </div>
  )
}

export function EmailActivityCard({ emailTimeSeries = [] }: { emailTimeSeries?: EmailTimePoint[] }) {
  const [range, setRange] = useState<Range>("30d")
  const sliced = emailTimeSeries.slice(-RANGE_DAYS[range])
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base text-foreground">Outreach Performance</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Sent emails and replies over time</p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
          {(["7d", "14d", "30d", "90d"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                r === range ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      {sliced.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">No email data yet</div>
      ) : (
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="eacSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.32 0.035 155)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="oklch(0.32 0.035 155)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="eacReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.16 145)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="oklch(0.7 0.16 145)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.92 0.01 95)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="date" stroke="oklch(0.6 0.018 145)" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
              <YAxis stroke="oklch(0.6 0.018 145)" fontSize={11} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Sent" stroke="oklch(0.32 0.035 155)" strokeWidth={2} fill="url(#eacSent)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Replied" stroke="oklch(0.7 0.16 145)" strokeWidth={2} fill="url(#eacReplied)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex items-center justify-center gap-6 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-foreground/80" />
          Sent
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Replied
        </span>
      </div>
    </div>
  )
}

export function CreditConsumptionCard({
  creditBalance = null, creditsUsed = null, creditsLimit = null,
}: {
  monthlyCredits?: MonthlyPoint[]
  creditBalance?: number | null
  creditsUsed?: number | null
  creditsLimit?: number | null
}) {
  const router = useRouter()
  const hasUsageData = creditsUsed !== null && creditsLimit !== null && creditsLimit > 0
  const pct = hasUsageData ? Math.min(100, ((creditsUsed as number) / (creditsLimit as number)) * 100) : null

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-base text-foreground">Credit Usage</h3>
        </div>
        {creditBalance !== null && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-display text-base text-foreground">{creditBalance.toLocaleString()}</span> left
          </p>
        )}
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(pct ?? 1, 1)}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {hasUsageData
            ? `${(creditsUsed as number).toLocaleString()} of ${(creditsLimit as number).toLocaleString()} credits used`
            : "No usage data yet"}
        </p>
        <button
          onClick={() => router.push("/settings?tab=billing")}
          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:text-foreground"
        >
          Manage credits
        </button>
      </div>
    </div>
  )
}

export function DeliveryHealthCard({ sent = 0, bounced = 0, opened = 0 }: { sent?: number; bounced?: number; opened?: number }) {
  const openRate    = sent > 0 ? ((opened  / sent) * 100).toFixed(1) : "—"
  const bounceRateN = sent > 0 ? (bounced / sent) * 100 : 0
  const bounceRate  = sent > 0 ? bounceRateN.toFixed(1) : "—"
  const isHealthy   = sent === 0 || bounceRateN <= 5

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-base text-foreground">Delivery Health</h3>
        </div>
        <button className="flex items-center gap-1 text-[12px] font-medium text-foreground/80 hover:text-foreground">
          View details
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
        <p className="text-sm font-medium text-foreground">{sent === 0 ? "No data yet" : isHealthy ? "Healthy" : "Needs attention"}</p>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {sent === 0
          ? "No emails sent yet."
          : isHealthy
          ? "No issues detected. Delivery and open rates look good."
          : `Bounce rate is ${bounceRate}% — above the 5% threshold. Check sender domains.`}
      </p>

      {sent > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{sent.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Sent</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
            <p className="text-lg font-bold text-violet-500 tabular-nums">{openRate}%</p>
            <p className="text-[11px] text-muted-foreground">Open rate</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{bounceRate}%</p>
            <p className="text-[11px] text-muted-foreground">Bounce rate</p>
          </div>
        </div>
      )}
    </div>
  )
}
