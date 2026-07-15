"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { AlertCircle, Bot, Mail, CreditCard, Info, RefreshCw, ChevronRight, Download } from "lucide-react"
import api from "@/lib/api"
import type { ExportState } from "@/components/analytics/analytics-content"

export interface NotificationItem {
  issueId: string
  type: "billing" | "agent" | "email" | "system" | string
  severity: "critical" | "high" | "medium" | "low" | string
  title: string
  message: string
  timestamp: string
  read: boolean
}

interface ActivityFeedProps {
  notifications?: NotificationItem[]
  exportState?: ExportState | null
}

type FeedKind = "notification" | "activity"
// Normalized severity, independent of which of the two upstream vocabularies
// (critical/high/medium/low from notifications, error/warning/success/info
// from the monitoring/activity feed) an entry came from.
type Severity = "critical" | "warning" | "success" | "neutral"
interface FeedEntry {
  kind: FeedKind
  id: string
  title: string
  message?: string
  timestamp: string
  isIssue: boolean
  isCycle: boolean
  isAgent: boolean
  severity: Severity
  type?: string
}

function normalizeSeverity(raw: string | undefined, isCycle: boolean): Severity {
  const s = (raw || "").toLowerCase()
  if (s === "critical" || s === "high" || s === "error") return "critical"
  if (s === "medium" || s === "warning") return "warning"
  if (s === "success" || isCycle) return "success"
  return "neutral"
}

type Filter = "all" | "agents" | "cycles" | "issues"

function typeIcon(entry: FeedEntry) {
  if (entry.isIssue) return <AlertCircle className="w-3.5 h-3.5" />
  if (entry.isCycle) return <RefreshCw className="w-3.5 h-3.5" />
  if (entry.type === "billing") return <CreditCard className="w-3.5 h-3.5" />
  if (entry.type === "email") return <Mail className="w-3.5 h-3.5" />
  if (entry.isAgent) return <Bot className="w-3.5 h-3.5" />
  return <Info className="w-3.5 h-3.5" />
}

function iconColors(entry: FeedEntry): string {
  switch (entry.severity) {
    case "critical": return "bg-danger-soft text-danger-soft-foreground"
    case "warning": return "bg-warning-soft text-warning-soft-foreground"
    case "success": return "bg-success-soft text-success-soft-foreground"
    default: return "bg-muted text-muted-foreground"
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

export function ActivityFeed({ notifications = [], exportState = null }: ActivityFeedProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [rawActivities, setRawActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get("/api/monitoring/activity")
      setRawActivities(res.data?.activities ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const entries: FeedEntry[] = [
    ...notifications.map((n): FeedEntry => ({
      kind: "notification",
      id: n.issueId,
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      isIssue: n.severity === "critical" || n.severity === "high",
      isCycle: false,
      isAgent: n.type === "agent",
      severity: normalizeSeverity(n.severity, false),
      type: n.type,
    })),
    ...rawActivities.map((a, i): FeedEntry => {
      const isCycle = a.title?.toLowerCase().includes("cycle") || a.category === "cycle"
      return {
        kind: "activity",
        id: `act-${i}-${a.timestamp}`,
        title: a.title || a.message || "Activity",
        message: a.details,
        timestamp: a.timestamp,
        isIssue: a.activityType === "issue" || a.category === "issue",
        isCycle,
        isAgent: ["agent", "bot"].some((kw: string) => a.title?.toLowerCase().includes(kw)),
        // /api/monitoring/activity already normalizes to type: 'error'|'warning'|'success'|'info'
        severity: normalizeSeverity(a.type, isCycle),
      }
    }),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const filtered = entries.filter(e => {
    if (filter === "agents") return e.isAgent
    if (filter === "cycles") return e.isCycle
    if (filter === "issues") return e.isIssue
    return true
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-4 h-[440px] flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base text-foreground">Activity</h3>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            {(["all", "agents", "cycles", "issues"] as Filter[]).map(f => (
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
        {exportState && (
          <button
            disabled={exportState.loading}
            onClick={exportState.run}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-accent disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            {exportState.loading ? "Loading…" : "Export Report (.csv)"}
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-danger-soft-foreground" />Critical</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning-soft-foreground" />Warning</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success-soft-foreground" />Success</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />Info</span>
      </div>

      {loading ? (
        <div className="mt-3 space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <AlertCircle className="w-6 h-6 text-muted-foreground/30" />
          <p className="text-xs">No activity</p>
        </div>
      ) : (
        <ul className="mt-2 flex-1 min-h-0 divide-y divide-border overflow-y-auto pr-1">
          {filtered.slice(0, 30).map((e) => (
            <li
              key={e.id}
              onClick={() => router.push("/help")}
              className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-accent rounded-lg transition-colors px-1"
            >
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${iconColors(e)}`}>
                {typeIcon(e)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{e.title}</p>
                {e.message && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{e.message}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(e.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => router.push("/help")}
        className="mt-1 shrink-0 flex items-center gap-1 text-[11px] font-medium text-foreground/80 hover:text-foreground"
      >
        View all activity
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
