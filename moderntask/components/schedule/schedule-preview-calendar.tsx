'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SendingSchedule, SchedulePreviewDay } from '@/lib/schedule-types'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Real calendar grid (not a horizontal strip) — each day cell keeps the same two-color
// fill language (primary = main, emerald = follow-ups), driven by the server's
// /schedule-preview (the same allocator the real scheduler uses). Every cell shows a
// visible capacity track for each type even at 0 count, so a day with follow-up room but
// nothing queued yet still reads as "follow-ups can land here" instead of looking blank.
export function SchedulePreviewCalendar({ schedule, days = 30, highlightDate }: {
  schedule: SendingSchedule | null
  days?: number
  highlightDate?: string | null
}) {
  const [preview, setPreview] = useState<SchedulePreviewDay[]>([])
  const [counts, setCounts] = useState<{ mainQueueCount: number; followUpQueueCount: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!schedule?.activeDays?.length || !schedule.sendTime) { setPreview([]); return }
    const t = setTimeout(() => {
      setLoading(true)
      api.get('/api/email-queue/schedule-preview', {
        params: { schedule: JSON.stringify(schedule), days },
      }).then(r => {
        if (r.data.success) {
          setPreview(r.data.preview ?? [])
          setCounts({ mainQueueCount: r.data.mainQueueCount ?? 0, followUpQueueCount: r.data.followUpQueueCount ?? 0 })
        }
      }).catch(() => {}).finally(() => setLoading(false))
    }, 350)
    return () => clearTimeout(t)
  }, [JSON.stringify(schedule), days])

  if (!schedule?.activeDays?.length) {
    return <p className="text-sm text-muted-foreground py-2">Set active days and a send time to preview.</p>
  }

  // Pad the front of the grid so the first real day lands in its correct weekday column.
  const leadingBlanks = preview.length ? new Date(preview[0].date + 'T12:00:00Z').getUTCDay() : 0
  const cells: (SchedulePreviewDay | null)[] = [...Array(leadingBlanks).fill(null), ...preview]

  const lastActiveIdx = (() => {
    let last = -1
    preview.forEach((d, i) => { if (d.active && (d.mainCount > 0 || d.followUpCount > 0)) last = i })
    return last
  })()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Preview (next {days} days)</p>
        {counts && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {counts.mainQueueCount} queued{counts.followUpQueueCount ? ` · ${counts.followUpQueueCount} follow-ups pending` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAY_LABELS.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} />
          const dateObj = new Date(d.date + 'T12:00:00Z')
          const dayNum = dateObj.getUTCDate()
          const isFirstOfMonth = dayNum === 1

          const maxCap = Math.max(1, d.mainCap, d.followUpCap)
          const mainPct = d.mainCap ? Math.min(100, Math.round((d.mainCount / maxCap) * 100)) : 0
          const followUpPct = d.followUpCap ? Math.min(100, Math.round((d.followUpCount / maxCap) * 100)) : 0

          return (
            <div
              key={d.date}
              className={cn(
                'aspect-square rounded-lg border border-border p-1.5 flex flex-col justify-between min-h-[52px]',
                d.active ? 'bg-card' : 'bg-muted/30',
                highlightDate === d.date && 'ring-2 ring-primary'
              )}
              title={!d.active ? `${d.date}: not an active sending day` : undefined}
            >
              <span className="text-xs text-foreground/80 font-medium tabular-nums">
                {isFirstOfMonth ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : dayNum}
              </span>
              {d.active && (d.mainCap > 0 || d.followUpCap > 0) ? (
                <div className="space-y-1">
                  {/* The track itself is always a visible colored outline the moment that
                      day has capacity (so "there's room here" never disappears), with the
                      real backlog filled in solid on top so you can still see how full
                      today actually is. Hover each bar for the exact count. */}
                  {d.mainCap > 0 && (
                    <div
                      className="h-2 rounded-full border border-primary bg-primary/15 overflow-hidden"
                      title={`${d.mainCount} email${d.mainCount === 1 ? '' : 's'} sending`}
                    >
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${mainPct}%` }} />
                    </div>
                  )}
                  {d.followUpCap > 0 && (
                    <div
                      className="h-2 rounded-full border border-emerald-500 bg-emerald-500/15 overflow-hidden"
                      title={`${d.followUpCount} follow-up${d.followUpCount === 1 ? '' : 's'} sending`}
                    >
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${followUpPct}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-2" />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/70" /> Main</span>
        {schedule.followUpPerDay > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Follow-ups</span>}
        {lastActiveIdx >= 0 && lastActiveIdx < preview.length - 1 && (
          <span className="ml-auto">Queue clears in ~{lastActiveIdx + 1} day{lastActiveIdx === 0 ? '' : 's'}</span>
        )}
        {loading && <span className="ml-auto">Updating…</span>}
      </div>
    </div>
  )
}
