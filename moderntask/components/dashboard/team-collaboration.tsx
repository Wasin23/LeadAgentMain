"use client"

import { useRouter } from "next/navigation"
import { Bot, Users, ChevronRight, Search, Mail, Gauge, Target, Timer } from "lucide-react"

export interface AgentActivityItem {
  agentId: string
  name: string
  status: "running" | "idle" | "stopped" | string
  currentActivity?: string | null
  personalityType?: string
  avatar?: string | null
  lastRun?: string | null
  nextCycleTime?: string | null
  currentKeyword?: string | null
  concurrencyLevel?: number | null
  leadLimit?: number | null
  cycleMinutes?: number | null
  emailsLast24h?: number
}

const PERSONALITY_AVATAR: Record<string, string> = {
  hunter: "Hunter", analyst: "Analyst", consultant: "consultant",
  networker: "Networker", "relationship-builder": "Relationship-Builder",
}

function resolveAvatarUrl(agent: AgentActivityItem): string {
  if (agent.avatar) return agent.avatar
  const type = agent.personalityType ?? "hunter"
  return `/avatars/${PERSONALITY_AVATAR[type] ?? "Hunter"}.png`
}

interface TeamCollaborationProps {
  agents?: AgentActivityItem[]
}

function statusBadge(status: string) {
  switch (status) {
    case "running":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
    case "idle":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "running": return "Active"
    case "idle":    return "Idle"
    default:        return "Stopped"
  }
}

function humanizePersonality(type?: string): string {
  if (!type) return "Agent"
  return type.split("-").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ")
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

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return "any moment"
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h ${mins % 60}m`
  if (mins > 0) return `${mins}m`
  return "under a minute"
}

function formatCycleLength(minutes?: number | null): string {
  if (!minutes) return "-"
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

function agentSubtitle(agent: AgentActivityItem): string {
  const parts: string[] = [humanizePersonality(agent.personalityType)]
  if (agent.status === "running" && agent.nextCycleTime) {
    parts.push(`Next cycle in ${timeUntil(agent.nextCycleTime)}`)
  } else if (agent.lastRun) {
    parts.push(`Last ran ${timeAgo(agent.lastRun)}`)
  } else {
    parts.push("Never run yet")
  }
  return parts.join(" · ")
}

export function TeamCollaboration({ agents = [] }: TeamCollaborationProps) {
  const router = useRouter()

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-sm text-foreground">Agent Status</h3>
        </div>
        <button onClick={() => router.push("/prospecting")} className="flex items-center gap-0.5 text-[11px] font-medium text-foreground/80 hover:text-foreground">
          View all
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-3 gap-1.5 text-muted-foreground">
          <Bot className="w-5 h-5 text-muted-foreground/40" />
          <p className="text-[11px]">No agents configured</p>
          <button onClick={() => router.push("/prospecting")} className="text-[11px] text-primary hover:underline">Set up an agent →</button>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1">
          {agents.map((agent) => {
            const initials = agent.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()

            const stats: { icon: typeof Search; label: string }[] = [
              { icon: Search, label: agent.status === "running" && agent.currentKeyword ? agent.currentKeyword : "No active search" },
              { icon: Mail, label: `${agent.emailsLast24h ?? 0} built / 24h` },
              { icon: Gauge, label: `${agent.concurrencyLevel ?? 1}x concurrency` },
              { icon: Target, label: `${agent.leadLimit ?? "-"} lead limit` },
              { icon: Timer, label: `${formatCycleLength(agent.cycleMinutes)} cycle` },
            ]

            return (
              <div
                key={agent.agentId}
                onClick={() => router.push("/prospecting")}
                className="w-full rounded-lg px-1.5 py-2 hover:bg-accent transition-colors cursor-pointer text-left"
              >
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-muted">
                    <img
                      src={resolveAvatarUrl(agent)}
                      alt={agent.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const t = e.target as HTMLImageElement
                        t.style.display = "none"
                        t.parentElement!.innerHTML = `<span class="absolute inset-0 grid place-items-center text-[10px] font-bold text-foreground/70">${initials}</span>`
                      }}
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${agent.status === "running" ? "bg-emerald-500" : agent.status === "idle" ? "bg-amber-500" : "bg-muted-foreground/50"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{agent.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{agentSubtitle(agent)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full ${statusBadge(agent.status)} px-1.5 py-0.5 text-[9px] font-medium shrink-0`}>
                    <span className="h-1 w-1 rounded-full bg-current opacity-70" />
                    {statusLabel(agent.status)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-[46px]">
                  {stats.map(({ icon: Icon, label }, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/90 max-w-full">
                      <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                      <span className="truncate">{label}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
