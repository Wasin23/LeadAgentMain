'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SendingSchedule, SchedulePreviewDay } from '@/lib/schedule-types'

// Horizontal, per-day fill bars — "how full is each day going to be" — driven by the
// server's /schedule-preview (the same allocator the real scheduler uses), not a client
// re-implementation. Debounced so it doesn't refetch on every keystroke while editing.
export function SchedulePreviewBars({ schedule, days = 21, compact = false, highlightDate }: {
  schedule: SendingSchedule | null
  days?: number
  compact?: boolean
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
    return <p className="text-[11px] text-muted-foreground py-2">Set active days and a send time to preview.</p>
  }

  const maxCap = Math.max(1, schedule.mainPerDay || 0, schedule.followUpPerDay || 0)
  const lastActiveIdx = (() => {
    let last = -1
    preview.forEach((d, i) => { if (d.active && (d.mainCount > 0 || d.followUpCount > 0)) last = i })
    return last
  })()

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">
          {compact ? 'Next' : 'Preview — next'} {days} days
        </p>
        {counts && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {counts.mainQueueCount} queued{counts.followUpQueueCount ? ` · ${counts.followUpQueueCount} follow-ups pending` : ''}
          </p>
        )}
      </div>
      <div className={compact ? 'flex gap-[3px] h-10 items-end' : 'flex gap-1 h-16 items-end'}>
        {preview.map((d) => {
          const mainH = d.active ? Math.round((d.mainCount / maxCap) * 100) : 0
          const followUpH = d.active ? Math.round((d.followUpCount / maxCap) * 100) : 0
          return (
            <div
              key={d.date}
              className="flex-1 min-w-0 flex flex-col items-center gap-0.5"
              title={d.active
                ? `${d.date}: ${d.mainCount}/${d.mainCap} main${d.followUpCap ? `, ${d.followUpCount}/${d.followUpCap} follow-ups` : ''}`
                : `${d.date}: not an active sending day`}
            >
              <div className={cn(
                'w-full rounded-sm relative overflow-hidden bg-muted',
                compact ? 'h-8' : 'h-14',
                highlightDate === d.date && 'ring-2 ring-offset-1 ring-primary'
              )}>
                {d.active && (
                  <>
                    <div
                      className="absolute bottom-0 left-0 right-1/2 mr-px bg-primary/70 rounded-sm transition-all"
                      style={{ height: `${mainH}%` }}
                    />
                    <div
                      className="absolute bottom-0 left-1/2 right-0 ml-px bg-emerald-500/70 rounded-sm transition-all"
                      style={{ height: `${followUpH}%` }}
                    />
                  </>
                )}
                {!d.active && <div className="absolute inset-0 bg-muted/40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)' }} />}
              </div>
              {!compact && (
                <span className="text-[8px] text-muted-foreground tabular-nums">
                  {new Date(d.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/70" /> Main</span>
        {schedule.followUpPerDay > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" /> Follow-ups</span>}
        {lastActiveIdx >= 0 && lastActiveIdx < preview.length - 1 && (
          <span className="ml-auto">Queue clears in ~{lastActiveIdx + 1} day{lastActiveIdx === 0 ? '' : 's'}</span>
        )}
        {loading && <span className="ml-auto">Updating…</span>}
      </div>
    </div>
  )
}
