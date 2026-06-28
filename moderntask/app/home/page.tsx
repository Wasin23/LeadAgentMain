"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"
import { Settings2, Check } from "lucide-react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { HomeCharts, type EmailTimePoint, type MonthlyPoint } from "@/components/dashboard/home-charts"
import { HomeSections } from "@/components/dashboard/home-sections"
import { ProjectAnalytics } from "@/components/dashboard/project-analytics"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { HomeActions } from "@/components/dashboard/home-actions"
import type { GettingStartedChecklist } from "@/components/dashboard/getting-started"
import type { QueueChartDataPoint } from "@/components/dashboard/project-analytics"
import type { AgentActivityItem } from "@/components/dashboard/team-collaboration"
import type { ScheduledBatch } from "@/components/dashboard/reminders"
import type { FollowUpItem } from "@/components/dashboard/upcoming-followups"
import type { NotificationItem } from "@/components/dashboard/recent-notifications"

// ── helpers ────────────────────────────────────────────────────────────────

function normaliseArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.emails)) return d.emails as unknown[]
    if (Array.isArray(d.items)) return d.items as unknown[]
  }
  return []
}

function dayLabel(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function isoDay(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toLocaleDateString('en-CA')
}

function emailDate(email: Record<string, unknown>): Date {
  return new Date(
    (email.sentAt as string) ||
    (email.timestamp as string) ||
    (email.createdAt as string) ||
    Date.now()
  )
}

// ── component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()

  // stats
  const [counts, setCounts] = useState({ sent: 0, queued: 0, replied: 0 })
  const [runningAgents, setRunningAgents] = useState(0)
  const [totalAgents, setTotalAgents] = useState(0)
  const [bouncedCount, setBouncedCount] = useState(0)
  const [openedCount, setOpenedCount] = useState(0)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null)
  const [creditsLimit, setCreditsLimit] = useState<number | null>(null)

  // chart – emails sent per day (last 7 days)
  const [chartData, setChartData] = useState<QueueChartDataPoint[]>([])
  const [emailTimeSeries, setEmailTimeSeries] = useState<EmailTimePoint[]>([])
  const [monthlyCredits, setMonthlyCredits] = useState<MonthlyPoint[]>([])

  // agent panels
  const [agentActivity, setAgentActivity] = useState<AgentActivityItem[]>([])

  // scheduled sends
  const [scheduledBatches, setScheduledBatches] = useState<ScheduledBatch[]>([])

  // follow-ups
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([])

  // notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notifCount, setNotifCount] = useState(0)

  // getting-started checklist (derived from live data — persists naturally)
  const [checklist, setChecklist] = useState<GettingStartedChecklist>({
    hasAgent: false,
    emailConnected: false,
    agentStarted: false,
    gotReply: false,
    hasSecondAgent: false,
  })
  const [isPaidPlan, setIsPaidPlan] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const fetchAll = useCallback(async () => {
    // Fire all requests in parallel; silently handle individual failures
    const [
      countsRes,
      agentsRes,
      sentRes,
      queueRes,
      scheduledBatchesRes,
      notifsRes,
      notifCountRes,
      planRes,
    ] = await Promise.allSettled([
      api.get("/api/email-queue/counts?agentId=all"),
      api.get("/api/auth/agents"),
      api.get("/api/email-queue/sent", { params: { agentId: "all" } }),
      api.get("/api/email-queue/queue", { params: { agentId: "all", limit: 200 } }),
      api.get("/api/email-queue/scheduled-batches"),
      api.get("/api/notifications/recent", { params: { limit: 6 } }),
      api.get("/api/notifications/count"),
      api.get("/api/plans/status"),
    ])

    if (planRes.status === "fulfilled") {
      const planId = planRes.value.data?.plan?.id || "free-trial"
      setIsPaidPlan(planId !== "free-trial")
      const d = planRes.value.data
      const bal = Number(d.credits?.remaining ?? d.plan?.remainingCredits ?? 0)
      if (bal > 0) setCreditBalance(Math.round(bal))
      if (d.credits?.used !== null && d.credits?.used !== undefined) setCreditsUsed(Math.round(Number(d.credits.used)))
      if (d.credits?.limit !== null && d.credits?.limit !== undefined) setCreditsLimit(Math.round(Number(d.credits.limit)))
    }

    // ── email counts ────────────────────────────────────────────────────
    if (countsRes.status === "fulfilled") {
      const d = countsRes.value.data
      const sent = d.sent ?? 0
      const replied = d.replied ?? 0
      setCounts({
        sent,
        queued: d.queued ?? 0,
        replied,
      })
      // Update the parts of checklist that depend on counts
      setChecklist((prev) => ({
        ...prev,
        agentStarted: prev.agentStarted,
        gotReply: replied > 0,
      }))
    }

    // ── agents ──────────────────────────────────────────────────────────
    if (agentsRes.status === "fulfilled") {
      const agents: Record<string, unknown>[] = agentsRes.value.data?.agents ?? []

      // running count — only count agents that are actually running, not merely "active" (created)
      const running = agents.filter(
        (a) => a.isRunning === true || a.status === "running"
      ).length
      setRunningAgents(running)
      setTotalAgents(agents.filter(a => a.agentId !== "orphan").length)

      // team-collaboration list
      setAgentActivity(
        agents
          .filter((a) => a.agentId !== "orphan")
          .map((a) => ({
            agentId: a.agentId as string,
            name: (a.name as string) || "Agent",
            status: (a.status as string) || "stopped",
            currentActivity: (a.currentActivity as string) || undefined,
            personalityType:
              ((a.personality as Record<string, unknown>)?.type as string) ||
              (a.personalityType as string) ||
              "professional",
          }))
      )

      // checklist state — derived from live agent + email data
      const nonOrphanAgents = agents.filter((a) => a.agentId !== "orphan")
      const anyEmailConnected = nonOrphanAgents.some((a) => {
        const eb = ((a.settings as Record<string, unknown>)?.emailBuilder as Record<string, unknown>) || {}
        return eb.useGmail === true || eb.useOutlook === true
      })
      setChecklist((prev) => ({
        ...prev,
        hasAgent: nonOrphanAgents.length > 0,
        emailConnected: anyEmailConnected,
        agentStarted: nonOrphanAgents.some((a) => a.isRunning === true || a.status === "running" || Boolean(a.lastRun)),
        hasSecondAgent: nonOrphanAgents.length > 1,
      }))

    }

    // ── queued emails → chart ────────────────────────────────────────────
    const queuedEmails = queueRes.status === "fulfilled"
      ? normaliseArray(queueRes.value.data) as Record<string, unknown>[]
      : []
    const sentEmailsForChart = sentRes.status === "fulfilled"
      ? normaliseArray(sentRes.value.data) as Record<string, unknown>[]
      : []
    const allEmailsForChart = [...queuedEmails, ...sentEmailsForChart]

    {
      // chart: emails queued per day for last 7 days
      const chart: QueueChartDataPoint[] = Array.from({ length: 7 }, (_, i) => {
        const daysAgo = 6 - i
        const dayStr = isoDay(daysAgo)
        const value = allEmailsForChart.filter((e) => {
          const d = emailDate(e).toLocaleDateString('en-CA')
          return d === dayStr
        }).length
        return { day: dayLabel(daysAgo), value, label: `${value} emails` }
      })
      setChartData(chart)

      // follow-ups: scheduled but not yet complete
      const followUpList: FollowUpItem[] = sentEmailsForChart
        .filter((e) => {
          if (!e.followUpScheduled || !e.followUpDate) return false
          const rebumpCount = (e.rebumpCount as number) || 0
          const maxFollowUps = (e.maxFollowUps as number) || 1
          return rebumpCount < maxFollowUps
        })
        .sort(
          (a, b) =>
            new Date(a.followUpDate as string).getTime() -
            new Date(b.followUpDate as string).getTime()
        )
        .slice(0, 8)
        .map((e) => ({
          id: (e.emailId as string) || (e.id as string) || String(Math.random()),
          leadName: (e.leadName as string) || (e.recipientName as string) || "Lead",
          leadEmail:
            (e.leadEmail as string) ||
            (e.recipientEmail as string) ||
            (e.to as string) ||
            "",
          company: (e.company as string) || (e.leadCompany as string) || "",
          subject: (e.subject as string) || "",
          followUpDate: e.followUpDate as string,
          agentName: (e.agentName as string) || "",
        }))
      setFollowUps(followUpList)

      // bounce + open stats derived from sent emails
      const bounced = sentEmailsForChart.filter(e => String(e.SK || "").startsWith("BOUNCED#")).length
      const opened  = sentEmailsForChart.filter(e => e.opened === true).length
      setBouncedCount(bounced)
      setOpenedCount(opened)

      // email activity time series — last 90 days
      const timeSeries: EmailTimePoint[] = Array.from({ length: 90 }, (_, rev) => {
        const daysAgo = 89 - rev
        const d = new Date()
        d.setDate(d.getDate() - daysAgo)
        const dayStr = d.toLocaleDateString("en-CA")
        const label  = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        let s = 0, r = 0
        sentEmailsForChart.forEach(e => {
          const ed = emailDate(e).toLocaleDateString("en-CA")
          if (ed === dayStr) {
            s++
            if (e.replied === true || e.status === "REPLIED") r++
          }
        })
        return { date: label, Sent: s, Replied: r }
      })
      setEmailTimeSeries(timeSeries)

      // monthly credit consumption (last 6 months)
      const now = new Date()
      const monthly: MonthlyPoint[] = Array.from({ length: 6 }, (_, rev) => {
        const i = 5 - rev
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        const label = d.toLocaleDateString("en-US", { month: "short" })
        const credits = sentEmailsForChart.filter(e => {
          const t = emailDate(e)
          return t >= start && t < end
        }).length
        return { month: label, Credits: credits }
      })
      setMonthlyCredits(monthly)
    }

    // ── scheduled batches (server-computed) ────────────────────────────
    if (scheduledBatchesRes.status === "fulfilled") {
      const raw = scheduledBatchesRes.value.data?.batches ?? []
      setScheduledBatches(
        (raw as Record<string, unknown>[]).map((b) => ({
          scheduledSendTime: b.scheduledSendTime as string,
          count:     b.count as number,
          agentName: (b.agentName as string) || undefined,
          agentId:   (b.agentId as string)   || undefined,
        }))
      )
    }

    // ── notifications ────────────────────────────────────────────────────
    if (notifsRes.status === "fulfilled") {
      const items = notifsRes.value.data?.notifications ?? []
      setNotifications(
        (items as Record<string, unknown>[]).map((n) => ({
          issueId: (n.issueId as string) || (n.id as string) || String(Math.random()),
          type: (n.type as NotificationItem["type"]) || "system",
          severity: (n.severity as NotificationItem["severity"]) || "low",
          title: (n.title as string) || "Notification",
          message: (n.message as string) || "",
          timestamp: (n.timestamp as string) || new Date().toISOString(),
          read: (n.read as boolean) ?? false,
        }))
      )
    }

    if (notifCountRes.status === "fulfilled") {
      setNotifCount(notifCountRes.value.data?.unreadCount ?? 0)
    }

  }, [])

  useEffect(() => {
    if (user) fetchAll()
  }, [user, fetchAll])

  // Refresh every 60 seconds while the tab is visible
  useEffect(() => {
    if (!user) return
    const id = setInterval(fetchAll, 60_000)
    return () => clearInterval(id)
  }, [user, fetchAll])

  const userName =
    (user as Record<string, unknown> | null)?.username as string | undefined
  const userEmail =
    (user as Record<string, unknown> | null)?.email as string | undefined
  const userPicture =
    (user as Record<string, unknown> | null)?.picture as string | undefined

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="@container flex-1 p-3 md:p-4 lg:p-5 lg:ml-64">
        <Header
          title="Home"
          description="Overview of your Meridian agents and outreach activity."
          notificationCount={notifCount}
          userName={userName}
          userEmail={userEmail}
          userPicture={userPicture}
        />

        <div className="space-y-3 md:space-y-4">
          {/* Unified customize bar */}
          <div className="flex items-center justify-between gap-2">
            <HomeActions checklist={checklist} isPaidPlan={isPaidPlan} mode="actions" />
            <button
              onClick={() => setEditMode(e => !e)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                editMode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {editMode
                ? <><Check className="w-3 h-3" /> Done</>
                : <><Settings2 className="w-3 h-3" /> Customize</>
              }
            </button>
          </div>

          <StatsCards
            sent={counts.sent}
            queued={counts.queued}
            runningAgents={runningAgents}
            cyclesCompleted={counts.replied}
            replies={counts.replied}
            totalAgents={totalAgents}
            followUpCount={followUps.length}
            scheduledCount={scheduledBatches.reduce((s, b) => s + b.count, 0)}
            bouncedCount={bouncedCount}
            openedCount={openedCount}
            creditBalance={creditBalance}
            editMode={editMode}
            onEditModeChange={setEditMode}
          />

          <HomeSections
            emailTimeSeries={emailTimeSeries}
            monthlyCredits={monthlyCredits}
            scheduledBatches={scheduledBatches}
            creditBalance={creditBalance}
            creditsUsed={creditsUsed}
            creditsLimit={creditsLimit}
            agentActivity={agentActivity}
            sent={counts.sent}
            bounced={bouncedCount}
            opened={openedCount}
            followUps={followUps}
            notifications={notifications}
            editMode={editMode}
            onEditModeChange={setEditMode}
          />
        </div>
      </main>
    </div>
  )
}
