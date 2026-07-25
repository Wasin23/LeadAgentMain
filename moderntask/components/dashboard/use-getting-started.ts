"use client"

import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import type { GettingStartedChecklist } from "@/components/dashboard/getting-started"

export function useGettingStarted() {
  const [checklist, setChecklist] = useState<GettingStartedChecklist>({
    hasAgent: false,
    emailConnected: false,
    agentStarted: false,
    gotReply: false,
    hasSecondAgent: false,
  })
  const [isPaidPlan, setIsPaidPlan] = useState(false)

  const load = useCallback(async () => {
    const [agentsRes, countsRes, planRes, capRes] = await Promise.allSettled([
      api.get("/api/auth/agents"),
      api.get("/api/email-queue/counts", { params: { agentId: "all" } }),
      api.get("/api/plans/status"),
      api.get("/api/email-queue/daily-cap-status"),
    ])

    if (planRes.status === "fulfilled") {
      const planId = planRes.value.data?.plan?.id || "free-trial"
      setIsPaidPlan(planId !== "free-trial")
    }

    if (countsRes.status === "fulfilled") {
      const replied = countsRes.value.data?.replied ?? 0
      setChecklist((prev) => ({ ...prev, gotReply: replied > 0 }))
    }

    // Which provider sends everything is a single global setting (controlled
    // in Outreach), not per-agent — "connected" just means at least one
    // Gmail/Outlook account exists for the user.
    const anyEmailConnected = capRes.status === "fulfilled" && (capRes.value.data?.accounts?.length ?? 0) > 0

    if (agentsRes.status === "fulfilled") {
      const agents: Record<string, unknown>[] = agentsRes.value.data?.agents ?? []
      const nonOrphan = agents.filter((a) => a.agentId !== "orphan")
      setChecklist((prev) => ({
        ...prev,
        hasAgent: nonOrphan.length > 0,
        emailConnected: anyEmailConnected,
        agentStarted: nonOrphan.some((a) => a.isRunning === true || a.status === "running" || Boolean(a.lastRun)),
        hasSecondAgent: nonOrphan.length > 1,
      }))
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { checklist, isPaidPlan }
}
