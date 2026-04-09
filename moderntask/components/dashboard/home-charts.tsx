"use client"

import { Card, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"

export interface EmailTimePoint { date: string; Sent: number; Replied: number }
export interface MonthlyPoint   { month: string; Credits: number }

interface HomeChartsProps {
  emailTimeSeries?: EmailTimePoint[]
  monthlyCredits?:  MonthlyPoint[]
  sent?:            number
  bounced?:         number
  opened?:          number
  creditBalance?:   number | null
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
  sent = 0,
  bounced = 0,
  opened = 0,
  creditBalance = null,
}: HomeChartsProps) {
  const [range, setRange] = useState<Range>("7d")

  const points = range === "7d" ? 7 : range === "14d" ? 14 : 30
  const slicedSeries = emailTimeSeries.slice(-points)

  const delivered = Math.max(sent - bounced, 0)
  const notOpened = Math.max(delivered - opened, 0)
  const donutData = [
    { name: "Opened",      value: opened },
    { name: "Not Opened",  value: notOpened },
    { name: "Bounced",     value: bounced },
  ].filter(d => d.value > 0)

  const totalEmails = sent + bounced
  const openRate   = totalEmails > 0 ? ((opened  / totalEmails) * 100).toFixed(1) : "0"
  const bounceRate = totalEmails > 0 ? ((bounced / totalEmails) * 100).toFixed(1) : "0"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">

      {/* Email Activity Over Time */}
      <div className="lg:col-span-2">
        <Card className="p-5 h-full">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-sm font-semibold">Email Activity Over Time</CardTitle>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          {slicedSeries.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">No email data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
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
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area type="monotone" dataKey="Sent"    stroke="#a855f7" strokeWidth={2} fill="url(#hcgSent)"    dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Replied" stroke="#22c55e" strokeWidth={2} fill="url(#hcgReplied)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Delivery Health */}
      <Card className="p-5">
        <CardTitle className="text-sm font-semibold mb-4">Delivery Health</CardTitle>
        {totalEmails === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">No emails sent yet</div>
        ) : (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]
                    const pct = totalEmails > 0 ? ((p.value as number / totalEmails) * 100).toFixed(1) : "0"
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                        <p style={{ color: p.payload.fill }} className="font-semibold">{p.name}</p>
                        <p className="text-foreground">{p.value} <span className="text-muted-foreground">({pct}%)</span></p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-xs mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a855f7] inline-block" />Open {openRate}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316] inline-block" />Not opened</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" />Bounced {bounceRate}%</span>
            </div>
          </div>
        )}
      </Card>

      {/* Credit Consumption Over Time */}
      <div className="lg:col-span-3">
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
            <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">No usage data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
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
