"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Bot, CheckCircle, Circle, ChevronDown, ArrowRight } from "lucide-react"
import type { GettingStartedChecklist } from "@/components/dashboard/getting-started"

const BASE_STEPS = [
  { key: "hasAgent" as const,       title: "Create your first agent",   href: "/agents" },
  { key: "emailConnected" as const,  title: "Connect your email",        href: "/agents" },
  { key: "agentStarted" as const,    title: "Start your agent",          href: "/operations" },
]

const FREE_PLAN_LAST_STEP = { key: "gotReply" as const, title: "Get your first reply", href: "/outreach" }
const PAID_PLAN_LAST_STEP = { key: "hasSecondAgent" as const, title: "Create another agent", href: "/agents" }

interface Props {
  checklist?: GettingStartedChecklist
  isPaidPlan?: boolean
}

export function HomeActions({ checklist, isPaidPlan = false }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const steps = [...BASE_STEPS, isPaidPlan ? PAID_PLAN_LAST_STEP : FREE_PLAN_LAST_STEP]

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const completed = checklist ? steps.filter((s) => checklist[s.key]).length : 0
  const allDone = completed === steps.length
  const remaining = steps.length - completed

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        onClick={() => router.push("/agents?create=true")}
        className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
      >
        <Bot className="w-4 h-4 mr-2" />
        Create Agent
      </Button>

      {/* Get Started dropdown */}
      <div ref={ref} className="relative">
        <Button
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          className="w-full sm:w-auto h-9 text-sm transition-all duration-300 hover:shadow-md hover:scale-105 bg-transparent gap-2"
        >
          Get Started
          {!allDone && checklist && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
              {remaining}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-card shadow-lg shadow-black/10 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Getting started</span>
              <span className="text-xs text-muted-foreground">{completed} / {steps.length}</span>
            </div>

            {/* Progress bar */}
            <div className="px-4 py-2 border-b border-border">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((completed / steps.length) * 100)}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="py-1">
              {steps.map((step) => {
                const done = checklist ? checklist[step.key] : false
                const isNext = !done && checklist && steps.findIndex((s) => !checklist[s.key]) === steps.indexOf(step)
                return (
                  <button
                    key={step.key}
                    disabled={done}
                    onClick={() => { setOpen(false); router.push(step.href) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      done
                        ? "opacity-40 cursor-default"
                        : isNext
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {done
                      ? <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      : <Circle className={`w-4 h-4 shrink-0 ${isNext ? "text-primary" : "text-muted-foreground/40"}`} />
                    }
                    <span className={`text-sm flex-1 ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {step.title}
                    </span>
                    {isNext && <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
