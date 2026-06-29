"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, CalendarClock, Send, Bot, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import api from "@/lib/api"

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

type Mode = "both" | "sends" | "followups"

interface DayItem {
  kind: "send" | "followup"
  key: string
  time: string
  label: string
  sublabel?: string
  rescheduleAction: (newIso: string) => Promise<void>
}

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA")
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function DayItemRow({ item, onEditTarget }: { item: DayItem; onEditTarget: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(() => toDatetimeLocal(new Date()))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await item.rescheduleAction(new Date(value).toISOString())
      setEditing(false)
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg p-1.5 hover:bg-accent">
      <div className="flex items-start gap-2">
        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${item.kind === "send" ? "bg-muted text-muted-foreground" : "bg-success-soft text-success-soft-foreground"}`}>
          {item.kind === "send" ? <Send className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{item.label}</p>
          <p className="truncate text-[10px] text-muted-foreground">{item.time}{item.sublabel ? ` · ${item.sublabel}` : ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setEditing(e => !e)} className="text-[10px] font-medium text-primary hover:underline">
            Reschedule
          </button>
          <button onClick={() => router.push(onEditTarget)} className="text-[10px] font-medium text-muted-foreground hover:text-foreground hover:underline">
            Edit
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-8">
          <input
            type="datetime-local"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={save}
            disabled={saving}
            className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      )}
    </div>
  )
}

export function ScheduledActivityCalendar({ batches = [], followUps = [], onChanged }: ScheduledActivityCalendarProps) {
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
          rescheduleAction: async (newIso: string) => {
            await api.patch("/api/email-queue/scheduled-batches", { emailIds: b.emailIds, newScheduledAt: newIso })
            onChanged?.()
          },
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
          rescheduleAction: async (newIso: string) => {
            await api.put(`/api/email-queue/${f.id}/followup`, { agentId: f.agentId, followUpDate: newIso })
            onChanged?.()
          },
        })
      })
    }
    return map
  }, [batches, followUps, mode, onChanged])

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const todayKey = dayKey(new Date())

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-2.5 h-[440px] flex flex-col">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarClock className="h-3.5 w-3.5 text-foreground/70 shrink-0" strokeWidth={1.75} />
          <h3 className="font-display text-xs text-foreground truncate">Scheduled Activity</h3>
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

      <div className="mt-1.5 flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
        {([["both", "Both"], ["sends", "Sends"], ["followups", "Follow-ups"]] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded px-1 py-0.5 text-[9px] font-medium transition-colors ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-px text-center text-[10px] font-bold text-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mt-0.5 grid grid-cols-7 auto-rows-fr gap-0 rounded-lg border border-border overflow-hidden flex-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="border border-border/50" />
          const key = dayKey(d)
          const items = itemsByDay[key] ?? []
          const isToday = key === todayKey

          return (
            <Popover key={key} open={openDay === key} onOpenChange={(o) => setOpenDay(o ? key : null)}>
              <PopoverTrigger asChild>
                <button
                  className={`relative w-full h-full border border-border/50 text-[9px] font-medium transition-colors flex flex-col items-center justify-center hover:bg-accent cursor-pointer ${
                    isToday ? "bg-primary/10 text-primary" : "text-foreground/80"
                  }`}
                >
                  {d.getDate()}
                  {items.length > 0 && (
                    <span className="flex items-center gap-0.5 absolute bottom-0.5">
                      {items.some(it => it.kind === "send") && <span className="h-[3px] w-[3px] rounded-full bg-foreground/70" />}
                      {items.some(it => it.kind === "followup") && <span className="h-[3px] w-[3px] rounded-full bg-success" />}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-72 p-2">
                <p className="px-1 text-[11px] font-semibold text-foreground">{d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                {items.length === 0 ? (
                  <div className="px-1 py-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Nothing scheduled this day.</p>
                    <button
                      onClick={() => router.push("/outreach?section=awaiting")}
                      className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      Schedule emails →
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1 max-h-64 overflow-y-auto">
                    {items.map(it => (
                      <DayItemRow
                        key={it.key}
                        item={it}
                        onEditTarget={it.kind === "send" ? "/outreach?section=awaiting" : "/outreach?section=sent&tab=followups"}
                      />
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
    </div>
  )
}
