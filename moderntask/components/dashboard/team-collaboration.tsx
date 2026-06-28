"use client"

import { useRouter } from "next/navigation"
import { Bot, Users, ChevronRight } from "lucide-react"

export interface AgentActivityItem {
  agentId: string
  name: string
  status: "running" | "idle" | "stopped" | string
  currentActivity?: string | null
  personalityType?: string
  avatar?: string | null
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
        <div className="mt-1.5 space-y-0.5">
          {agents.map((agent) => {
            const initials = agent.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()

            return (
              <button
                key={agent.agentId}
                onClick={() => router.push("/prospecting")}
                className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg px-1 py-1 hover:bg-accent transition-colors cursor-pointer text-left"
              >
                <div className="relative h-6 w-6 shrink-0 rounded-full overflow-hidden bg-muted">
                  <img
                    src={resolveAvatarUrl(agent)}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.style.display = "none"
                      t.parentElement!.innerHTML = `<span class="absolute inset-0 grid place-items-center text-[9px] font-bold text-foreground/70">${initials}</span>`
                    }}
                  />
                </div>
                <p className="truncate text-xs font-medium text-foreground">{agent.name}</p>
                <span className={`inline-flex items-center gap-1 rounded-full ${statusBadge(agent.status)} px-1.5 py-0.5 text-[9px] font-medium shrink-0`}>
                  <span className="h-1 w-1 rounded-full bg-current opacity-70" />
                  {statusLabel(agent.status)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
