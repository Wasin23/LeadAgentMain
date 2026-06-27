"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertCircle, Bot, Mail, CreditCard, Info, ChevronRight } from "lucide-react"

export interface NotificationItem {
  issueId: string
  type: "billing" | "agent" | "email" | "system" | string
  severity: "critical" | "high" | "medium" | "low" | string
  title: string
  message: string
  timestamp: string
  read: boolean
}

interface RecentNotificationsProps {
  notifications?: NotificationItem[]
}

function typeIcon(type: string) {
  switch (type) {
    case "billing":  return <CreditCard className="w-3.5 h-3.5" />
    case "agent":    return <Bot className="w-3.5 h-3.5" />
    case "email":    return <Mail className="w-3.5 h-3.5" />
    case "system":   return <AlertCircle className="w-3.5 h-3.5" />
    default:         return <Info className="w-3.5 h-3.5" />
  }
}

function severityColors(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
    case "high":     return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
    case "medium":   return "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
    default:         return "bg-muted text-muted-foreground"
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return "just now"
}

type Filter = "all" | "agents" | "alerts"

export function RecentNotifications({ notifications = [] }: RecentNotificationsProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = notifications.filter(n => {
    if (filter === "agents") return n.type === "agent"
    if (filter === "alerts") return n.severity === "critical" || n.severity === "high"
    return true
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-base text-foreground">Recent Activity</h3>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
          {(["all", "agents", "alerts"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <AlertCircle className="w-7 h-7 text-muted-foreground/30" />
          <p className="text-sm">No notifications</p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {filtered.slice(0, 6).map((n) => (
            <li
              key={n.issueId}
              onClick={() => router.push("/help")}
              className="flex items-center gap-4 py-3.5 cursor-pointer"
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${severityColors(n.severity)}`}>
                {typeIcon(n.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{n.message}</p>
              </div>
              <span className="shrink-0 text-[12px] text-muted-foreground">{timeAgo(n.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => router.push("/help")}
        className="mt-1 flex items-center gap-1 text-[12px] font-medium text-foreground/80 hover:text-foreground"
      >
        View all activity
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
