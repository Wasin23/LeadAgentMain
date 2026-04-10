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

const CIRCUMFERENCE = 2 * Math.PI * 28 // r=28

function AgentRing({ agent, onClick }: { agent: AgentProgressItem; onClick: () => void }) {
  const percent = agent.max > 0 ? Math.min(agent.current / agent.max, 1) : 0
  const done = percent >= 1
  const offset = CIRCUMFERENCE - percent * CIRCUMFERENCE
  const label = agent.name.length > 8 ? agent.name.slice(0, 7) + "…" : agent.name

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group focus:outline-none"
      title={`${agent.name} — ${agent.current}/${agent.max} leads`}
    >
      <div className="relative w-[64px] h-[64px]">
        <svg className="-rotate-90 w-full h-full" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/30" />
          <circle
            cx="45" cy="45" r="28"
            stroke={done ? "#22c55e" : "#3b82f6"}
            strokeWidth="6"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          <span className="text-[9px] font-semibold text-foreground leading-tight">{label}</span>
          <span className="text-[8px] text-muted-foreground leading-none mt-0.5">{agent.max} leads</span>
          {done && <span className="text-[7px] text-green-500 font-bold mt-0.5">done</span>}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">{agent.current}/{agent.max}</span>
    </button>
  )
}

export function ProjectProgress({ agents = [] }: ProjectProgressProps) {
  const router = useRouter()

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Agent Progress</h2>
        {agents.length > 0 && (
          <button onClick={() => router.push("/operations")} className="text-xs text-primary hover:underline">View all</button>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 gap-1.5 text-muted-foreground">
          <Bot className="w-6 h-6 text-muted-foreground/50" />
          <p className="text-xs">No agents running</p>
          <button onClick={() => router.push("/agents")} className="text-xs text-primary hover:underline">Start an agent →</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 justify-center">
          {agents.map((agent) => (
            <AgentRing key={agent.agentId} agent={agent} onClick={() => router.push("/operations")} />
          ))}
        </div>
      )}
    </Card>
  )
}
