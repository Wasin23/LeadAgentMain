"use client"

import { useRouter } from "next/navigation"
import { CheckCircle, Circle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface GettingStartedChecklist {
  hasAgent: boolean
  emailConnected: boolean
  agentRan: boolean
  gotReply: boolean
}

const STEPS = [
  {
    key: "hasAgent" as const,
    title: "Create your first agent",
    desc: "Set up an AI agent with a personality and targeting criteria.",
    href: "/agents",
    cta: "Go to Agents",
  },
  {
    key: "emailConnected" as const,
    title: "Connect your email",
    desc: "Link Gmail or Outlook so your agent sends from your real inbox.",
    href: "/agents",
    cta: "Connect Email",
  },
  {
    key: "agentRan" as const,
    title: "Send your first campaign",
    desc: "Start your agent and let it research leads and send outreach.",
    href: "/agents",
    cta: "Start Agent",
  },
  {
    key: "gotReply" as const,
    title: "Get your first reply",
    desc: "When a lead responds, Meridian stops follow-ups and surfaces it for you.",
    href: "/outreach",
    cta: "View Outreach",
  },
]

export function GettingStarted({ checklist }: { checklist: GettingStartedChecklist }) {
  const router = useRouter()

  const completed = STEPS.filter((s) => checklist[s.key]).length
  const allDone = completed === STEPS.length

  // Vanish permanently once all tasks are done
  if (allDone) return null

  const pct = Math.round((completed / STEPS.length) * 100)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Getting started</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completed} of {STEPS.length} complete
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex-1 max-w-48">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {STEPS.map((step) => {
          const done = checklist[step.key]
          // Find first incomplete step for special styling
          const isNext = !done && STEPS.findIndex((s) => !checklist[s.key]) === STEPS.indexOf(step)

          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                done ? "opacity-50" : isNext ? "bg-primary/5" : ""
              }`}
            >
              {/* Icon */}
              <div className="shrink-0">
                {done ? (
                  <CheckCircle className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className={`w-5 h-5 ${isNext ? "text-primary" : "text-muted-foreground/40"}`} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {step.title}
                </p>
                {!done && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                )}
              </div>

              {/* CTA */}
              {!done && (
                <Button
                  size="sm"
                  variant={isNext ? "default" : "ghost"}
                  className="shrink-0 gap-1.5 text-xs h-7 px-3"
                  onClick={() => router.push(step.href)}
                >
                  {step.cta}
                  {isNext && <ArrowRight className="w-3 h-3" />}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
