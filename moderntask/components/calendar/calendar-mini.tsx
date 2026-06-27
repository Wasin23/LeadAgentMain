"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CalendarDays, Link2, Check } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function daysInMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }

export function CalendarMini() {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [googleConnected, setGoogleConnected] = useState(false)
  const [calendlyLink, setCalendlyLink] = useState("")
  const [calendlyInput, setCalendlyInput] = useState("")
  const [savingLink, setSavingLink] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get("/api/calendar/status")
      setGoogleConnected(!!r.data?.googleConnected)
      setCalendlyLink(r.data?.calendlyLink || "")
      setCalendlyInput(r.data?.calendlyLink || "")
    } catch {}
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

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

  const today = new Date()
  const isCurrentMonth = viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear()
  const firstWeekday = startOfMonth(viewDate).getDay()
  const totalDays = daysInMonth(viewDate)
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-xs font-medium text-muted-foreground mb-2">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
          const isToday = isCurrentMonth && day === today.getDate()
          return (
            <div
              key={day}
              className={`aspect-square rounded-md flex items-center justify-center text-[11px] ${
                isToday ? "bg-primary text-primary-foreground font-semibold" : "text-foreground"
              }`}
            >
              {day}
            </div>
          )
        })}
      </div>

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
