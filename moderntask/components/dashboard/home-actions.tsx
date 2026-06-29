"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Bot, CheckCircle, Circle, ChevronDown, ArrowRight, Play, Mail, UserCheck, Users2, Settings } from "lucide-react"
import type { GettingStartedChecklist } from "@/components/dashboard/getting-started"

const QUICK_ACTIONS = [
  { label: "Start All",       icon: Play,      href: "/prospecting",            accent: "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10" },
  { label: "Awaiting Review", icon: Mail,      href: "/outreach?section=awaiting", accent: "text-primary hover:bg-primary/10" },
  { label: "Outreach",        icon: UserCheck, href: "/outreach?section=sent",   accent: "text-violet-600 dark:text-violet-400 hover:bg-violet-500/10" },
  { label: "Leads",           icon: Users2,    href: "/leads",                  accent: "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" },
  { label: "Settings",        icon: Settings,  href: "/settings",               accent: "text-muted-foreground hover:bg-muted" },
]

const BASE_STEPS = [
  { key: "hasAgent" as const,       title: "Create your first agent",   href: "/prospecting?tab=agents" },
  { key: "emailConnected" as const,  title: "Connect your email",        href: "/prospecting?tab=agents" },
  { key: "agentStarted" as const,    title: "Start your agent",          href: "/prospecting" },
]

const FREE_PLAN_LAST_STEP = { key: "gotReply" as const, title: "Get your first reply", href: "/outreach?section=sent" }
const PAID_PLAN_LAST_STEP = { key: "hasSecondAgent" as const, title: "Create another agent", href: "/prospecting?tab=agents" }

interface Props {
  checklist?: GettingStartedChecklist
  isPaidPlan?: boolean
  /** "icons" = only the 5 quick-action icon buttons; "actions" = Create Agent + Get Started; "create-agent" = just the Create Agent button; "get-started" = just the Get Started dropdown */
  mode?: "icons" | "actions" | "create-agent" | "get-started"
}

export function HomeActions({ checklist, isPaidPlan = false, mode }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const steps = [...BASE_STEPS, isPaidPlan ? PAID_PLAN_LAST_STEP : FREE_PLAN_LAST_STEP]

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

  if (mode === "icons") {
    return (
      <div className="flex items-center gap-1">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href, accent }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            title={label}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${accent}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    )
  }

  if (mode === "create-agent") {
    return (
      <Button
        onClick={() => router.push("/prospecting?tab=agents&create=true")}
        className="h-8 text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
      >
        <Bot className="w-3.5 h-3.5 mr-1.5" />
        Create Agent
      </Button>
    )
  }

  if (mode === "get-started") {
    return (
      <div ref={ref} className="relative">
        <Button
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          className="h-8 text-xs px-3 transition-all duration-300 hover:shadow-md hover:scale-105 bg-transparent gap-1.5"
        >
          Get Started
          {!allDone && checklist && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
              {remaining}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-card shadow-lg shadow-black/10 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Getting started</span>
              <span className="text-xs text-muted-foreground">{completed} / {steps.length}</span>
            </div>
            <div className="px-4 py-2 border-b border-border">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((completed / steps.length) * 100)}%` }}
                />
              </div>
            </div>
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
    )
  }

  return null
}
