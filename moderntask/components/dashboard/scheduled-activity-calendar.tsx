"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, CalendarClock, X, ArrowUpRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScheduleModal } from "@/components/schedule/schedule-modal"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import type { SchedulePreviewDay } from "@/lib/schedule-types"

export interface ScheduledBatch {
  scheduledSendTime: string   // ISO string
  count: number               // number of emails in this batch
  agentName?: string
  agentId?: string
  emailIds?: { id: string; agentId: string }[]
}

export interface FollowUpItem {
  id: string
  leadName?: string
  leadEmail?: string
  company?: string
  subject?: string
  followUpDate: string
  agentName?: string
  agentId?: string
}

interface ScheduledActivityCalendarProps {
  batches?: ScheduledBatch[]
  followUps?: FollowUpItem[]
  onChanged?: () => void
}

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA")
}

export function ScheduledActivityCalendar({ batches = [], followUps = [], onChanged }: ScheduledActivityCalendarProps) {
  const router = useRouter()
  const [monthOffset, setMonthOffset] = useState(0)
  const [openDay, setOpenDay] = useState<string | null>(null)
  // Sending schedule is global (one per account), so "Schedule emails" opens the
  // Sending Schedule card directly — no per-agent picker step needed anymore.
  const [showScheduleCard, setShowScheduleCard] = useState(false)
  useBodyScrollLock(showScheduleCard)
  const [preview, setPreview] = useState<SchedulePreviewDay[]>([])

  // The preview endpoint is relative to "today" (it's simulating the live queue draining
  // forward), not calendar-month-aware — fetch a 60-day rolling window once, which covers
  // "this month" fully; older/future months fall back to the plain presence indicator
  // below since there's no meaningful capacity data for them.
  const loadPreview = () => {
    api.get('/api/email-queue/schedule-preview', { params: { days: 60 } })
      .then(r => { if (r.data.success) setPreview(r.data.preview ?? []) })
      .catch(() => {})
  }
  useEffect(() => { loadPreview() }, [])

  const previewByDay = useMemo(() => {
    const map: Record<string, SchedulePreviewDay> = {}
    preview.forEach(d => { map[d.date] = d })
    return map
  }, [preview])

  const cursor = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + monthOffset)
    return d
  }, [monthOffset])

  // Fallback presence-only signal for days outside the preview window (older/future months).
  const hasActivityByDay = useMemo(() => {
    const set = new Set<string>()
    batches.forEach(b => set.add(dayKey(new Date(b.scheduledSendTime))))
    followUps.forEach(f => set.add(dayKey(new Date(f.followUpDate))))
    return set
  }, [batches, followUps])

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const todayKey = dayKey(new Date())

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ]

  const goToSchedules = (key: string) => {
    setOpenDay(null)
    router.push(`/schedules?date=${key}`)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-2.5 h-[440px] flex flex-col">
      <button
        onClick={() => setShowScheduleCard(true)}
        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shrink-0"
      >
        <CalendarClock className="w-4 h-4" /> Schedule for Send
      </button>

      <div className="mt-2.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarClock className="h-3.5 w-3.5 text-foreground/70 shrink-0" strokeWidth={1.75} />
          <h3 className="font-display text-xs text-foreground truncate">Scheduled Emails</h3>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setMonthOffset(o => o - 1)} className="grid h-4 w-4 place-items-center rounded hover:bg-accent text-muted-foreground">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="w-14 text-center text-[9px] font-medium text-foreground">{monthLabel}</span>
          <button onClick={() => setMonthOffset(o => o + 1)} className="grid h-4 w-4 place-items-center rounded hover:bg-accent text-muted-foreground">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 px-0.5 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-primary/70" /> Main</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-500/70" /> Follow-ups</span>
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-px text-center text-[10px] font-bold text-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mt-0.5 grid grid-cols-7 auto-rows-fr gap-1 rounded-lg bg-muted/30 p-1 flex-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = dayKey(d)
          const isToday = key === todayKey
          const day = previewByDay[key]
          const hasPreview = !!day
          const fallbackActivity = !hasPreview && hasActivityByDay.has(key)
          // Each bar scales against its own cap (main = plan's daily send limit, follow-up =
          // mailbox capacity) — sharing one scale made the main bar look artificially short
          // whenever follow-up capacity outsized it.
          const mainPct = day?.active && day.mainCap ? Math.min(100, Math.round((day.mainCount / day.mainCap) * 100)) : 0
          const followUpPct = day?.active && day.followUpCap ? Math.min(100, Math.round((day.followUpCount / day.followUpCap) * 100)) : 0

          return (
            <Popover key={key} open={openDay === key} onOpenChange={(o) => setOpenDay(o ? key : null)}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "relative w-full h-full rounded-md text-[9px] font-medium transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden",
                    isToday ? "bg-primary text-primary-foreground" : "bg-card text-foreground/80 hover:bg-accent"
                  )}
                >
                  <span className="relative z-10">{d.getDate()}</span>
                  {hasPreview && day.active && (day.mainCap > 0 || day.followUpCap > 0) && (
                    <span className="absolute bottom-0.5 left-1 right-1 flex flex-col gap-px z-10">
                      {day.mainCap > 0 && (
                        <span className="h-[4px] rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                          <span className="block h-full bg-primary rounded-full" style={{ width: `${mainPct}%` }} />
                        </span>
                      )}
                      {day.followUpCap > 0 && (
                        <span className="h-[4px] rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                          <span className="block h-full bg-emerald-500 rounded-full" style={{ width: `${followUpPct}%` }} />
                        </span>
                      )}
                    </span>
                  )}
                  {fallbackActivity && (
                    <span className={cn("absolute bottom-0.5 h-[3px] w-[3px] rounded-full z-10", isToday ? "bg-primary-foreground/80" : "bg-foreground/70")} />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-64 p-3">
                <p className="text-[11px] font-semibold text-foreground mb-2">{d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                {hasPreview ? (
                  day.active ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-primary/70" /> Main emails</span>
                        <span className="font-medium tabular-nums">{day.mainCount}/{day.mainCap}</span>
                      </div>
                      {day.followUpCap > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" /> Follow-ups</span>
                          <span className="font-medium tabular-nums">{day.followUpCount}/{day.followUpCap}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Not an active sending day.</p>
                  )
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {fallbackActivity ? "Something's scheduled this day." : "Nothing scheduled this day."}
                  </p>
                )}
                <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
                  <button onClick={() => setShowScheduleCard(true)} className="text-[11px] font-medium text-primary hover:underline">
                    Edit schedule
                  </button>
                  <button onClick={() => goToSchedules(key)} className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    View in Schedules <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>

      {/* Sending Schedule modal - lands on the saved-schedules list first, only dropping
          into the full builder form when you choose to create or edit one */}
      {showScheduleCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-modal-swoop-backdrop" onClick={() => setShowScheduleCard(false)}>
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-modal-swoop-up [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setShowScheduleCard(false)}
                className="absolute right-3 top-3 z-10 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <ScheduleModal onChanged={() => { loadPreview(); onChanged?.() }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
