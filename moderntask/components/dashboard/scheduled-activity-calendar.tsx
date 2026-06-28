"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, CalendarClock, Send, Bot } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface ScheduledBatch {
  scheduledSendTime: string   // ISO string
  count: number               // number of emails in this batch
  agentName?: string
  agentId?: string
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
}

type Mode = "both" | "sends" | "followups"

interface DayItem {
  kind: "send" | "followup"
  key: string
  time: string
  label: string
  sublabel?: string
}

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA")
}

export function ScheduledActivityCalendar({ batches = [], followUps = [] }: ScheduledActivityCalendarProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("both")
  const [monthOffset, setMonthOffset] = useState(0)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const cursor = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + monthOffset)
    return d
  }, [monthOffset])

  const itemsByDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {}
    if (mode !== "followups") {
      batches.forEach((b, i) => {
        const d = new Date(b.scheduledSendTime)
        const key = dayKey(d)
        if (!map[key]) map[key] = []
        map[key].push({
          kind: "send",
          key: `send-${i}`,
          time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          label: `${b.count} email${b.count !== 1 ? "s" : ""} scheduled`,
          sublabel: b.agentName,
        })
      })
    }
    if (mode !== "sends") {
      followUps.forEach((f) => {
        const d = new Date(f.followUpDate)
        const key = dayKey(d)
        if (!map[key]) map[key] = []
        map[key].push({
          kind: "followup",
          key: f.id,
          time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          label: f.leadName ?? f.leadEmail ?? "Follow-up",
          sublabel: f.company,
        })
      })
    }
    return map
  }, [batches, followUps, mode])

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const todayKey = dayKey(new Date())

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-base text-foreground">Scheduled Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            {([["both", "Both"], ["sends", "Sends"], ["followups", "Follow-ups"]] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setMonthOffset(o => o - 1)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-accent text-muted-foreground">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="w-28 text-center text-[11px] font-medium text-foreground">{monthLabel}</span>
            <button onClick={() => setMonthOffset(o => o + 1)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-accent text-muted-foreground">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = dayKey(d)
          const items = itemsByDay[key] ?? []
          const isToday = key === todayKey

          return (
            <Popover key={key} open={openDay === key} onOpenChange={(o) => setOpenDay(o ? key : null)}>
              <PopoverTrigger asChild>
                <button
                  disabled={items.length === 0}
                  className={`relative aspect-square w-full rounded-lg text-[11px] font-medium transition-colors flex flex-col items-center justify-center gap-0.5 ${
                    isToday ? "border border-primary text-primary" : "text-foreground/80"
                  } ${items.length > 0 ? "hover:bg-accent cursor-pointer" : "cursor-default opacity-60"}`}
                >
                  {d.getDate()}
                  {items.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      {items.some(it => it.kind === "send") && <span className="h-1 w-1 rounded-full bg-foreground/70" />}
                      {items.some(it => it.kind === "followup") && <span className="h-1 w-1 rounded-full bg-success" />}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              {items.length > 0 && (
                <PopoverContent align="center" className="w-64 p-2">
                  <p className="px-1 text-[11px] font-semibold text-foreground">{d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                  <div className="mt-1.5 space-y-1 max-h-56 overflow-y-auto">
                    {items.map(it => (
                      <div key={it.key} className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-accent">
                        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${it.kind === "send" ? "bg-muted text-muted-foreground" : "bg-success-soft text-success-soft-foreground"}`}>
                          {it.kind === "send" ? <Send className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{it.label}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{it.time}{it.sublabel ? ` · ${it.sublabel}` : ""}</p>
                        </div>
                        <button
                          onClick={() => router.push(it.kind === "send" ? "/outreach?section=awaiting" : "/outreach?section=sent&tab=followups")}
                          className="shrink-0 text-[10px] font-medium text-primary hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          )
        })}
      </div>
    </div>
  )
}
