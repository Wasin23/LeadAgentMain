'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, X, Clock, Mail, Sparkles } from 'lucide-react'
import type { SendingSchedule, FollowUpSettings } from '@/lib/schedule-types'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DayCell {
  date: string
  active: boolean
  isPast: boolean
  mainCount: number
  mainCap: number
  followUpCount: number
  followUpCap: number
}

interface DayItem {
  id: string
  agentId: string
  type: 'main' | 'followup'
  to?: string
  subject?: string
  scheduledAt?: string
  sentAt?: string
  payload?: any
}

// Full month-navigable calendar for the schedule modal — past days show what ACTUALLY sent
// (from real sent-email records), future days show the PREDICTED forecast (same allocator as
// the plain 30-day preview). Clicking any day opens a drill-down panel listing that day's
// items, where a scheduled (not-yet-sent) item can be canceled or moved to a different date —
// which then feeds back into the prediction for every later day.
// `followUpSettings`, if passed, previews an UNSAVED draft (e.g. while the interval/max-per-
// lead inputs are being edited in the builder) — omit it to preview the account's live settings.
export function FullScheduleCalendar({ schedule, followUpSettings }: { schedule: SendingSchedule; followUpSettings?: FollowUpSettings }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [cells, setCells] = useState<DayCell[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<{ scheduled: DayItem[]; sent: DayItem[] } | null>(null)
  const [dayLoading, setDayLoading] = useState(false)
  const [rescheduling, setRescheduling] = useState<string | null>(null)

  const cursor = (() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + monthOffset)
    return d
  })()
  const year = cursor.getFullYear()
  const month = cursor.getMonth() + 1 // 1-12
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayStr = new Date().toLocaleDateString('en-CA')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [historyRes, previewRes] = await Promise.all([
        api.get('/api/email-queue/month-activity', { params: { year, month } }),
        api.get('/api/email-queue/schedule-preview', {
          params: {
            schedule: JSON.stringify(schedule),
            days: 60,
            ...(followUpSettings ? { followUpSettings: JSON.stringify(followUpSettings) } : {}),
          },
        }).catch(() => null),
      ])

      const history: Record<string, { mainSentCount: number; followUpSentCount: number }> = {}
      ;(historyRes.data?.activity || []).forEach((d: any) => { history[d.date] = d })

      const preview: Record<string, any> = {}
      ;(previewRes?.data?.preview || []).forEach((d: any) => { preview[d.date] = d })

      const daysInMonth = new Date(year, month, 0).getDate()
      const built: DayCell[] = Array.from({ length: daysInMonth }, (_, i) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
        const isPast = date < todayStr
        if (isPast) {
          const h = history[date]
          return { date, active: true, isPast, mainCount: h?.mainSentCount || 0, mainCap: 0, followUpCount: h?.followUpSentCount || 0, followUpCap: 0 }
        }
        const p = preview[date]
        return { date, active: p?.active ?? false, isPast, mainCount: p?.mainCount || 0, mainCap: p?.mainCap || 0, followUpCount: p?.followUpCount || 0, followUpCap: p?.followUpCap || 0 }
      })
      setCells(built)
    } catch { /* silent */ }
    setLoading(false)
  }, [year, month, JSON.stringify(schedule), JSON.stringify(followUpSettings), todayStr])

  useEffect(() => { load() }, [load])

  const openDay = async (date: string) => {
    setSelectedDate(date)
    setDayLoading(true)
    try {
      const r = await api.get('/api/email-queue/day-detail', { params: { date } })
      if (r.data.success) setDayDetail({ scheduled: r.data.scheduled, sent: r.data.sent })
      else setDayDetail(null)
    } catch { setDayDetail(null) }
    setDayLoading(false)
  }

  const cancelItem = async (item: DayItem) => {
    if (item.type === 'followup') {
      await api.delete(`/api/email-queue/${item.id}/followup`, { data: { agentId: item.agentId } }).catch(() => {})
    } else {
      await api.put(`/api/email-queue/${item.id}`, { batchExcluded: true }, { params: { agentId: item.agentId } }).catch(() => {})
    }
    if (selectedDate) openDay(selectedDate)
    load()
  }

  const rescheduleItem = async (item: DayItem, newDate: string) => {
    setRescheduling(item.id)
    try {
      const [h, m] = (schedule.sendTime || '09:00').split(':').map(Number)
      const newScheduledAt = new Date(`${newDate}T00:00:00`)
      newScheduledAt.setHours(h, m, 0, 0)
      await api.patch('/api/email-queue/scheduled-batches', {
        emailIds: [{ id: item.id, agentId: item.agentId, type: item.type, payload: item.payload }],
        newScheduledAt: newScheduledAt.toISOString(),
      })
      if (selectedDate) openDay(selectedDate)
      load()
    } finally {
      setRescheduling(null)
    }
  }

  const leadingBlanks = new Date(year, month - 1, 1).getDay()
  const gridCells: (DayCell | null)[] = [...Array(leadingBlanks).fill(null), ...cells]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMonthOffset(o => o - 1)} className="grid h-7 w-7 place-items-center rounded hover:bg-accent text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-36 text-center text-sm font-semibold">{monthLabel}</span>
          <button onClick={() => setMonthOffset(o => o + 1)} className="grid h-7 w-7 place-items-center rounded hover:bg-accent text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {monthOffset !== 0 && (
          <button onClick={() => setMonthOffset(0)} className="text-xs text-primary hover:underline">Today</button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAY_LABELS.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {gridCells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} />
          // Each bar scales against its own max, not a shared one — for history days that
          // max is the actual count itself (nothing else to compare against); for predicted
          // days it's the real cap (mainCap = plan's daily limit, followUpCap = mailbox
          // capacity), which can be a very different size from the other bar's cap.
          const mainMax = d.isPast ? Math.max(1, d.mainCount) : Math.max(1, d.mainCap)
          const followUpMax = d.isPast ? Math.max(1, d.followUpCount) : Math.max(1, d.followUpCap)
          const mainPct = Math.min(100, Math.round((d.mainCount / mainMax) * 100))
          const followUpPct = Math.min(100, Math.round((d.followUpCount / followUpMax) * 100))
          const dateObj = new Date(d.date + 'T12:00:00Z')
          const dayNum = dateObj.getUTCDate()
          const hasAny = d.mainCount > 0 || d.followUpCount > 0 || d.mainCap > 0 || d.followUpCap > 0

          return (
            <button
              key={d.date}
              onClick={() => openDay(d.date)}
              className={cn(
                'aspect-square rounded-lg border p-1.5 flex flex-col justify-between min-h-[52px] text-left transition-colors',
                d.date === todayStr ? 'border-primary' : 'border-border',
                d.active ? 'bg-card hover:bg-accent' : 'bg-muted/30 hover:bg-muted/50',
                selectedDate === d.date && 'ring-2 ring-primary'
              )}
              title={d.isPast ? `${d.date}: actual` : `${d.date}: predicted`}
            >
              <span className="text-xs text-foreground/80 font-medium tabular-nums">{dayNum}</span>
              {hasAny ? (
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-muted overflow-hidden" title={`${d.mainCount} main`}>
                    <div className="h-full bg-primary rounded-full" style={{ width: `${mainPct}%` }} />
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden" title={`${d.followUpCount} follow-up`}>
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${followUpPct}%` }} />
                  </div>
                </div>
              ) : <div className="h-2" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/70" /> Main</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Follow-ups</span>
        <span className="ml-auto">{loading ? 'Loading…' : 'Past days show actual sends · future days are predicted'}</span>
      </div>

      {selectedDate && (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {new Date(selectedDate + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {selectedDate < todayStr && <span className="ml-2 text-xs text-muted-foreground font-normal">(actual)</span>}
            </p>
            <button onClick={() => { setSelectedDate(null); setDayDetail(null) }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {dayLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !dayDetail || (dayDetail.scheduled.length === 0 && dayDetail.sent.length === 0) ? (
            <p className="text-xs text-muted-foreground">Nothing {selectedDate < todayStr ? 'sent' : 'scheduled'} this day.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
              {dayDetail.sent.map(item => (
                <div key={`sent-${item.type}-${item.id}`} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/40">
                  <div className="min-w-0 flex items-center gap-1.5">
                    {item.type === 'followup' ? <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" /> : <Mail className="w-3 h-3 text-primary shrink-0" />}
                    <span className="truncate">{item.subject || item.to || 'Untitled'}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">Sent</span>
                </div>
              ))}
              {dayDetail.scheduled.map(item => (
                <div key={`sched-${item.type}-${item.id}`} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md border border-border">
                  <div className="min-w-0 flex items-center gap-1.5">
                    {item.type === 'followup' ? <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" /> : <Clock className="w-3 h-3 text-primary shrink-0" />}
                    <span className="truncate">{item.subject || item.to || 'Untitled'}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="date"
                      defaultValue={selectedDate}
                      disabled={rescheduling === item.id}
                      onChange={e => e.target.value && rescheduleItem(item, e.target.value)}
                      className="h-6 text-[11px] rounded border border-input bg-background px-1"
                    />
                    <button onClick={() => cancelItem(item)} className="text-muted-foreground hover:text-destructive" title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
