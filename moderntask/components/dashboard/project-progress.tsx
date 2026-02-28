"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Bot } from "lucide-react"

export interface AgentProgressItem {
  agentId: string
  name: string
  current: number  // emails sent/processed this cycle
  max: number      // lead limit
}

interface ProjectProgressProps {
  agents?: AgentProgressItem[]
}

const CIRCUMFERENCE = 2 * Math.PI * 36 // r=36

function AgentRing({ agent, onClick }: { agent: AgentProgressItem; onClick: () => void }) {
  const percent = agent.max > 0 ? Math.min(agent.current / agent.max, 1) : 0
  const done = percent >= 1
  const offset = CIRCUMFERENCE - percent * CIRCUMFERENCE
  const label = agent.name.length > 9 ? agent.name.slice(0, 8) + "…" : agent.name

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group focus:outline-none"
      title={`${agent.name} — ${agent.current}/${agent.max} leads`}
    >
      <div className="relative w-[88px] h-[88px]">
        <svg className="-rotate-90 w-full h-full" viewBox="0 0 90 90">
          {/* Track */}
          <circle
            cx="45" cy="45" r="36"
            stroke="currentColor"
            strokeWidth="7"
            fill="none"
            className="text-muted/30"
          />
          {/* Fill */}
          <circle
            cx="45" cy="45" r="36"
            stroke={done ? "#22c55e" : "#3b82f6"}
            strokeWidth="7"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.4s" }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          <span className="text-[10px] font-semibold text-foreground leading-tight">{label}</span>
          <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{agent.max} leads</span>
          {done && (
            <span className="text-[8px] text-green-500 font-bold mt-0.5">done</span>
          )}
        </div>
      </div>
      {/* Progress text */}
      <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
        {agent.current}/{agent.max}
      </span>
    </button>
  )
}

export function ProjectProgress({ agents = [] }: ProjectProgressProps) {
  const router = useRouter()

  return (
    <Card
      className="p-4 transition-all duration-500 hover:shadow-xl animate-slide-in-up overflow-hidden"
      style={{ animationDelay: "800ms" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Agent Progress</h2>
        {agents.length > 0 && (
          <button
            onClick={() => router.push("/operations")}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <Bot className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm">No agents running</p>
          <button
            onClick={() => router.push("/agents")}
            className="text-xs text-primary hover:underline mt-1"
          >
            Start an agent →
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 justify-center">
          {agents.map((agent) => (
            <AgentRing
              key={agent.agentId}
              agent={agent}
              onClick={() => router.push("/operations")}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
