"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Bot } from "lucide-react"

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

const PERSONALITY_AVATAR: Record<string, string> = {
  hunter: "Hunter",
  analyst: "Analyst",
  consultant: "consultant",
  networker: "Networker",
  "relationship-builder": "Relationship-Builder",
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
    case "running": return "Running"
    case "idle":    return "Idle"
    default:        return "Stopped"
  }
}

export function TeamCollaboration({ agents = [] }: TeamCollaborationProps) {
  const router = useRouter()

  return (
    <Card
      className="p-6 transition-all duration-500 hover:shadow-xl animate-slide-in-up"
      style={{ animationDelay: "600ms" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Agent Activity</h2>
        <button
          onClick={() => router.push("/operations")}
          className="text-xs text-primary hover:underline transition-colors"
        >
          View operations →
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
          <Bot className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm">No agents configured</p>
          <button
            onClick={() => router.push("/agents")}
            className="text-xs text-primary hover:underline"
          >
            Set up an agent →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent, index) => {
            const avatarFile = PERSONALITY_AVATAR[agent.personalityType ?? "hunter"] ?? "Hunter"
            const initials = agent.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()

            return (
              <button
                key={agent.agentId}
                onClick={() => router.push("/operations")}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-secondary transition-all duration-300 cursor-pointer group text-left"
                style={{ animationDelay: `${650 + index * 80}ms` }}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300 group-hover:scale-105 bg-muted flex items-center justify-center">
                  <img
                    src={`/avatars/${avatarFile}.png`}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.style.display = "none"
                      t.parentElement!.innerHTML = `<span class="text-xs font-bold text-primary">${initials}</span>`
                    }}
                  />
                </div>

                {/* Name + activity */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {agent.status === "running" && agent.currentActivity
                      ? agent.currentActivity
                      : agent.status === "running"
                      ? "Working…"
                      : "Not running"}
                  </p>
                </div>

                {/* Status pill */}
                <span
                  className={`${statusBadge(agent.status)} text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-300 group-hover:scale-105 whitespace-nowrap flex-shrink-0`}
                >
                  {agent.status === "running" && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse align-middle" />
                  )}
                  {statusLabel(agent.status)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}
