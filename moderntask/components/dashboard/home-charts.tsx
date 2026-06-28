"use client"

import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { DateRangePicker, type RangePreset, PRESET_DAYS } from "@/components/dashboard/date-range-picker"
import type { DateRange } from "react-day-picker"

export interface EmailTimePoint { date: string; rawDate: string; Sent: number; Replied: number }
export interface MonthlyPoint   { month: string; Credits: number }

export function ChartTooltip({ active, payload, label }: any) {
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

export function EmailActivityCard({ emailTimeSeries = [] }: { emailTimeSeries?: EmailTimePoint[] }) {
  const [preset, setPreset] = useState<RangePreset>("30d")
  const [customRange, setCustomRange] = useState<DateRange | undefined>()

  const minDate = emailTimeSeries.length > 0 ? new Date(emailTimeSeries[0].rawDate) : undefined
  const sliced = customRange?.from && customRange?.to
    ? emailTimeSeries.filter(p => {
        const d = new Date(p.rawDate)
        return d >= customRange.from! && d <= customRange.to!
      })
    : emailTimeSeries.slice(-PRESET_DAYS[preset])

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-sm text-foreground">Outreach Performance</h3>
          <InfoTooltip text="Sent emails and replies over time" />
        </div>
        <DateRangePicker
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          minDate={minDate}
        />
      </div>
      {sliced.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No email data yet</div>
      ) : (
        <div className="mt-2 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="eacSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="eacReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Sent" stroke="var(--foreground)" strokeWidth={2} fill="url(#eacSent)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Replied" stroke="var(--success)" strokeWidth={2} fill="url(#eacReplied)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-1 flex items-center justify-center gap-6 text-[11px] text-muted-foreground">
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

export function DeliveryHealthCard({ sent = 0, bounced = 0, opened = 0 }: { sent?: number; bounced?: number; opened?: number }) {
  const openRate    = sent > 0 ? ((opened  / sent) * 100).toFixed(1) : "—"
  const bounceRateN = sent > 0 ? (bounced / sent) * 100 : 0
  const bounceRate  = sent > 0 ? bounceRateN.toFixed(1) : "—"
  const isHealthy   = sent === 0 || bounceRateN <= 5

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-sm text-foreground">Delivery Health</h3>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-medium ${isHealthy ? "text-emerald-600" : "text-amber-600"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
          {sent === 0 ? "No data" : isHealthy ? "Healthy" : "Needs attention"}
        </span>
      </div>

      {sent > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center">
            <p className="text-sm font-bold tabular-nums">{sent.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center">
            <p className="text-sm font-bold text-violet-500 tabular-nums">{openRate}%</p>
            <p className="text-[10px] text-muted-foreground">Open rate</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center">
            <p className="text-sm font-bold tabular-nums">{bounceRate}%</p>
            <p className="text-[10px] text-muted-foreground">Bounce rate</p>
          </div>
        </div>
      )}
    </div>
  )
}
