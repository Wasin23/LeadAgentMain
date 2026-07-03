"use client"

import { Card } from "@/components/ui/card"
import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

export interface QueueChartDataPoint {
  day: string
  value: number
  label: string
}

interface ProjectAnalyticsProps {
  data?: QueueChartDataPoint[]
}

function getBlueShade(value: number, max: number): string {
  if (max === 0) return "#bfdbfe" // blue-200
  const ratio = value / max
  if (ratio < 0.2) return "#bfdbfe"  // blue-200 - very low
  if (ratio < 0.4) return "#60a5fa"  // blue-400 - low
  if (ratio < 0.6) return "#3b82f6"  // blue-500 - mid
  if (ratio < 0.8) return "#2563eb"  // blue-600 - high
  return "#1d4ed8"                    // blue-700 - peak
}

export function ProjectAnalytics({ data }: ProjectAnalyticsProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  const chartData: QueueChartDataPoint[] = data ?? []
  const maxValue = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value), 1) : 1
  const total = chartData.reduce((acc, d) => acc + d.value, 0)
  const average = chartData.length > 0 ? Math.round(total / chartData.length) : 0

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-foreground text-background px-3 py-2 rounded-lg text-xs font-semibold shadow-lg">
          <p className="font-bold">{payload[0].value} queued</p>
          <p className="text-[10px] opacity-80">{payload[0].payload.label}</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card
      className="p-6 transition-all duration-500 hover:shadow-xl animate-slide-in-up bg-gradient-to-br from-background to-muted/20"
      style={{ animationDelay: "400ms" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Emails Queued</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span>Last 7 Days</span>
        </div>
      </div>

      <div className="h-64 mb-4 relative">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "currentColor", fontSize: 14 }}
                className="text-muted-foreground"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
              <Bar
                dataKey="value"
                radius={[12, 12, 12, 12]}
                maxBarSize={60}
                onMouseEnter={(_: any, index: number) => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBlueShade(entry.value, maxValue)}
                    className="transition-all duration-300"
                    style={{
                      filter:
                        hoveredBar === index
                          ? "brightness(1.15) drop-shadow(0 4px 8px rgba(59, 130, 246, 0.45))"
                          : "none",
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="pt-4 border-t border-muted/50 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Daily avg: </span>
          <span className="font-semibold text-foreground">{average}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Peak: </span>
          <span className="font-semibold text-blue-500">{maxValue === 1 && total === 0 ? 0 : maxValue}</span>
        </div>
      </div>
    </Card>
  )
}
