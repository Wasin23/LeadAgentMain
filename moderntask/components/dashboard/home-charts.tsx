"use client"

import { Card, CardTitle } from "@/components/ui/card"
import { useState } from "react"
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

type Range = "7d" | "14d" | "30d"

function RangeToggle({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  return (
    <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
      {(["7d", "14d", "30d"] as Range[]).map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
            value === r ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r === "7d" ? "7D" : r === "14d" ? "14D" : "30D"}
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

  const points = range === "7d" ? 7 : range === "14d" ? 14 : 30
  const slicedSeries = emailTimeSeries.slice(-points)

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
  const [range, setRange] = useState<Range>("7d")
  const points = range === "7d" ? 7 : range === "14d" ? 14 : 30
  const sliced = emailTimeSeries.slice(-points)
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="text-sm font-semibold">Email Activity Over Time</CardTitle>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      {sliced.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-xs text-muted-foreground">No email data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={sliced} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="eacSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="eacReplied" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "hsl(var(--muted-foreground))" }} />
            <Area type="monotone" dataKey="Sent"    stroke="#a855f7" strokeWidth={2} fill="url(#eacSent)"    dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="Replied" stroke="#22c55e" strokeWidth={2} fill="url(#eacReplied)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function CreditConsumptionCard({ monthlyCredits = [], creditBalance = null }: { monthlyCredits?: MonthlyPoint[]; creditBalance?: number | null }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <CardTitle className="text-sm font-semibold">Credit Usage</CardTitle>
        {creditBalance !== null && (
          <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{creditBalance.toLocaleString()}</span> left</span>
        )}
      </div>
      {monthlyCredits.every(m => m.Credits === 0) ? (
        <p className="text-xs text-muted-foreground py-1">No usage data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={monthlyCredits} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="cccCredit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a855f7" stopOpacity={1} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="Credits" name="Credits Used" fill="url(#cccCredit)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function DeliveryHealthCard({ sent = 0, bounced = 0, opened = 0 }: { sent?: number; bounced?: number; opened?: number }) {
  const openRate   = sent > 0 ? ((opened  / sent) * 100).toFixed(1) : "—"
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : "—"

  return (
    <Card className="p-4">
      <CardTitle className="text-sm font-semibold mb-3">Delivery Health</CardTitle>
      {sent === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No emails sent yet</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{sent.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Sent</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
            <p className="text-lg font-bold text-purple-500 tabular-nums">{openRate}%</p>
            <p className="text-[11px] text-muted-foreground">Open rate</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{bounceRate}%</p>
            <p className="text-[11px] text-muted-foreground">Bounce rate</p>
          </div>
        </div>
      )}
    </Card>
  )
}
