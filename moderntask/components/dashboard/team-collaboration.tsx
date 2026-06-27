"use client"

import { useRouter } from "next/navigation"
import { Bot, Users, ChevronRight } from "lucide-react"

export interface AgentActivityItem {
  agentId: string
  name: string
  status: "running" | "idle" | "stopped" | string
  currentActivity?: string | null
  personalityType?: string
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

const AVATAR_TONES = [
  "bg-amber-100 text-amber-700",
  "bg-emerald-100/70 text-emerald-700",
  "bg-violet-100 text-violet-600",
  "bg-sky-100 text-sky-700",
]

export function TeamCollaboration({ agents = [] }: TeamCollaborationProps) {
  const router = useRouter()
  const runningCount = agents.filter(a => a.status === "running").length

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-base text-foreground">Agent Status</h3>
        </div>
        <button onClick={() => router.push("/prospecting")} className="flex items-center gap-1 text-[12px] font-medium text-foreground/80 hover:text-foreground">
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 gap-2 text-muted-foreground">
          <Bot className="w-6 h-6 text-muted-foreground/40" />
          <p className="text-xs">No agents configured</p>
          <button onClick={() => router.push("/prospecting")} className="text-xs text-primary hover:underline">Set up an agent →</button>
        </div>
      ) : (
        <div className="mt-4 space-y-1">
          {agents.map((agent, index) => {
            const initials = agent.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            const tone = AVATAR_TONES[index % AVATAR_TONES.length]

            return (
              <button
                key={agent.agentId}
                onClick={() => router.push("/prospecting")}
                className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-accent transition-colors cursor-pointer text-left"
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm ${tone}`}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                  <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full ${statusBadge(agent.status)} px-1.5 py-0.5 text-[10px] font-medium`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {statusLabel(agent.status)}
                  </span>
                </div>
                <p className="truncate text-right text-[11px] text-muted-foreground max-w-[120px]">
                  {agent.status === "running" && agent.currentActivity ? agent.currentActivity : agent.status === "running" ? "Working…" : "Not running"}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
