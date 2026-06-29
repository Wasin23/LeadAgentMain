"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Link2, Check } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import { ScheduledActivityCalendar, type ScheduledBatch, type FollowUpItem } from "@/components/dashboard/scheduled-activity-calendar"

export function CalendarMini() {
  const [googleConnected, setGoogleConnected] = useState(false)
  const [calendlyLink, setCalendlyLink] = useState("")
  const [calendlyInput, setCalendlyInput] = useState("")
  const [savingLink, setSavingLink] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [batches, setBatches] = useState<ScheduledBatch[]>([])
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([])

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get("/api/calendar/status")
      setGoogleConnected(!!r.data?.googleConnected)
      setCalendlyLink(r.data?.calendlyLink || "")
      setCalendlyInput(r.data?.calendlyLink || "")
    } catch {}
  }, [])

  const loadSchedule = useCallback(async () => {
    try {
      const [batchesRes, sentRes] = await Promise.allSettled([
        api.get("/api/email-queue/scheduled-batches"),
        api.get("/api/email-queue/sent", { params: { agentId: "all" } }),
      ])
      if (batchesRes.status === "fulfilled") {
        setBatches((batchesRes.value.data?.batches ?? []).map((b: Record<string, unknown>) => ({
          scheduledSendTime: b.scheduledSendTime as string,
          count: b.count as number,
          agentName: (b.agentName as string) || undefined,
          agentId: (b.agentId as string) || undefined,
          emailIds: (b.emailIds as { id: string; agentId: string }[]) || undefined,
        })))
      }
      if (sentRes.status === "fulfilled") {
        const emails: Record<string, unknown>[] = Array.isArray(sentRes.value.data) ? sentRes.value.data : []
        setFollowUps(
          emails
            .filter((e) => {
              if (!e.followUpScheduled || !e.followUpDate) return false
              const rebumpCount = (e.rebumpCount as number) || 0
              const maxFollowUps = (e.maxFollowUps as number) || 1
              return rebumpCount < maxFollowUps
            })
            .map((e) => ({
              id: (e.id as string) || (e.trackingId as string) || String(Math.random()),
              leadName: (e.leadName as string) || (e.recipientName as string) || "Lead",
              leadEmail: (e.leadEmail as string) || (e.recipientEmail as string) || (e.to as string) || "",
              company: (e.company as string) || (e.leadCompany as string) || "",
              subject: (e.subject as string) || "",
              followUpDate: e.followUpDate as string,
              agentName: (e.agentName as string) || "",
              agentId: (e.agentId as string) || "",
            }))
        )
      }
    } catch {}
  }, [])

  useEffect(() => { loadStatus(); loadSchedule() }, [loadStatus, loadSchedule])

  const connectGoogle = async () => {
    setConnecting(true)
    try {
      const r = await api.get("/api/calendar/google-oauth-url")
      if (r.data?.authUrl) window.location.href = r.data.authUrl
    } catch {
      setConnecting(false)
    }
  }

  const disconnectGoogle = async () => {
    try {
      await api.post("/api/calendar/disconnect-google")
      setGoogleConnected(false)
    } catch {}
  }

  const saveCalendlyLink = async () => {
    setSavingLink(true)
    try {
      await api.post("/api/calendar/calendly-link", { calendlyLink: calendlyInput })
      setCalendlyLink(calendlyInput)
    } finally {
      setSavingLink(false)
    }
  }

  return (
    <Card className="p-3 space-y-3">
      <ScheduledActivityCalendar batches={batches} followUps={followUps} onChanged={loadSchedule} />

      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Google Calendar</span>
          {googleConnected ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" /> Connected
              </span>
              <button onClick={disconnectGoogle} className="text-[11px] text-muted-foreground hover:text-destructive">Disconnect</button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={connecting} onClick={connectGoogle}>
              {connecting ? "Redirecting…" : "Connect"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            value={calendlyInput}
            onChange={e => setCalendlyInput(e.target.value)}
            placeholder="Calendly link (optional)"
            className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {calendlyInput !== calendlyLink && (
            <Button size="sm" className="h-7 text-[11px]" disabled={savingLink} onClick={saveCalendlyLink}>
              {savingLink ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
