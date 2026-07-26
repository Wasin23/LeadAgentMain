'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Save, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { DAY_LABELS, TIMEZONES, BROWSER_TZ, DEFAULT_SCHEDULE } from '@/lib/schedule-types'
import type { SendingSchedule, SavedSchedule } from '@/lib/schedule-types'
import { SchedulePreviewCalendar } from './schedule-preview-calendar'

export function ScheduleBuilder({ editing, applyOnSave = true, onSaved, onCancel }: {
  editing?: SavedSchedule | null
  applyOnSave?: boolean
  onSaved?: (schedule: SendingSchedule, saved?: SavedSchedule) => void
  onCancel?: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(editing?.name ?? '')
  const [sched, setSched] = useState<SendingSchedule>(editing ?? DEFAULT_SCHEDULE)
  const [mainStr, setMainStr] = useState(String(editing?.mainPerDay ?? DEFAULT_SCHEDULE.mainPerDay))
  const [followUpStr, setFollowUpStr] = useState(String(editing?.followUpPerDay ?? DEFAULT_SCHEDULE.followUpPerDay))
  const [planCap, setPlanCap] = useState(50)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [backlog, setBacklog] = useState<{ main: number; followUp: number } | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/settings/sending-schedule'),
      // Real current backlog composition — a follow-up-heavy account (each main can spawn
      // several follow-ups via maxRebumps) should default the split toward follow-ups, not
      // an arbitrary 50/50. days=1 here since we only want mainQueueCount/followUpQueueCount.
      api.get('/api/email-queue/schedule-preview', { params: { days: 1 } }).catch(() => null),
    ]).then(([r, previewRes]) => {
      const cap = r.data?.planDailyCap ?? 50
      setPlanCap(cap)

      const backlogMain = previewRes?.data?.mainQueueCount ?? 0
      const backlogFollowUp = previewRes?.data?.followUpQueueCount ?? 0
      setBacklog({ main: backlogMain, followUp: backlogFollowUp })

      // Proportional default: split the cap the same way the real backlog is split, so an
      // account where follow-ups outnumber new mains starts with a schedule that actually
      // matches that reality instead of an even split. Falls back to 50/50 with no data yet.
      const total = backlogMain + backlogFollowUp
      const suggestedMain = total > 0 ? Math.round(cap * (backlogMain / total)) : Math.ceil(cap / 2)
      const clampedSuggestedMain = Math.min(cap, Math.max(0, suggestedMain))

      if (editing) {
        // Re-clamp against the current plan cap in case it changed since this was saved —
        // main wins the clamp, follow-ups take whatever's left so the two still sum to cap.
        const clampedMain = Math.min(cap, editing.mainPerDay ?? clampedSuggestedMain)
        setMainStr(String(clampedMain))
        setFollowUpStr(String(cap - clampedMain))
        return
      }

      const existing = r.data?.schedule
      if (existing) {
        setSched({ ...DEFAULT_SCHEDULE, ...existing })
        const clampedMain = Math.min(cap, existing.mainPerDay ?? clampedSuggestedMain)
        setMainStr(String(clampedMain))
        setFollowUpStr(String(cap - clampedMain))
      } else {
        // No schedule yet — default to the backlog-proportional split computed above.
        setMainStr(String(clampedSuggestedMain))
        setFollowUpStr(String(cap - clampedSuggestedMain))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [editing])

  const [timeH, timeM] = sched.sendTime.split(':').map(Number)
  const isPM = timeH >= 12
  const hour12 = timeH % 12 || 12

  const setTime = (h12: number, m: number, pm: boolean) => {
    const h24 = pm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12)
    setSched(s => ({ ...s, sendTime: `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}` }))
  }

  const toggleDay = (d: number) =>
    setSched(s => ({ ...s, activeDays: s.activeDays.includes(d) ? s.activeDays.filter(x => x !== d) : [...s.activeDays, d].sort() }))

  // Main and follow-ups split the plan's daily cap on a single scale (dragging the slider
  // above keeps them always summing to planCap), so there's no separate "does follow-up
  // fit" case to warn about anymore — the split itself is the whole cap by construction.
  const rawMain = Math.min(planCap, Math.max(0, parseInt(mainStr) || 0))
  const rawFollowUp = Math.min(planCap, Math.max(0, parseInt(followUpStr) || 0))
  const draftSchedule: SendingSchedule = {
    ...sched,
    mainPerDay: rawMain,
    followUpPerDay: rawFollowUp,
  }

  const save = async () => {
    setSaving(true)
    try {
      const trimmedName = name.trim()
      let savedSchedule: SavedSchedule | undefined

      if (!trimmedName) {
        // No name — quick/anonymous save, matches the old single-schedule flow.
        await api.put('/api/settings/sending-schedule', { schedule: draftSchedule })
      } else if (editing?.id) {
        const r = await api.put(`/api/settings/saved-schedules/${editing.id}`, { name: trimmedName, ...draftSchedule })
        savedSchedule = r.data.schedule
        if (applyOnSave) await api.post(`/api/settings/saved-schedules/${editing.id}/apply`)
      } else {
        const r = await api.post('/api/settings/saved-schedules', { name: trimmedName, ...draftSchedule })
        savedSchedule = r.data.schedule
        if (applyOnSave && savedSchedule) await api.post(`/api/settings/saved-schedules/${savedSchedule.id}/apply`)
      }

      if (!trimmedName || applyOnSave) {
        // Re-enroll any emails previously excluded from the batch under the old schedule.
        await api.post('/api/email-queue/reset-batch-excluded', {}).catch(() => {})
      }

      setSaved(true); setTimeout(() => setSaved(false), 2000)
      onSaved?.(draftSchedule, savedSchedule)
      toast({
        title: trimmedName ? `"${trimmedName}" saved${applyOnSave ? ' & applied' : ''}` : 'Schedule saved',
        description: `${draftSchedule.mainPerDay}/day${draftSchedule.followUpPerDay ? ` + ${draftSchedule.followUpPerDay} follow-ups/day` : ''} on ${draftSchedule.activeDays.map(d => DAY_LABELS[d]).join(', ')} at ${draftSchedule.sendTime}`,
        duration: 2500,
      })
    } catch (err: any) {
      toast({ title: 'Failed to save schedule', description: err?.response?.data?.error, variant: 'destructive', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{editing ? 'Edit Schedule' : 'Sending Schedule'}</h2>
        <span className="text-sm text-muted-foreground ml-1">applies to your whole account</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Name <span className="text-muted-foreground/60">(optional, save it to switch back later)</span></label>
          <input
            type="text"
            className="w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm focus:outline-none"
            placeholder="e.g. Aggressive outreach, Slow & steady…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Active Days</label>
          <div className="flex gap-2 flex-wrap">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={cn(
                  'w-12 h-11 rounded-md text-sm font-medium border transition-colors',
                  sched.activeDays.includes(i)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-input hover:bg-muted'
                )}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Send Time</label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <select
                  className="w-full h-11 appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-sm focus:outline-none"
                  value={hour12}
                  onChange={e => setTime(+e.target.value, timeM, isPM)}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground text-sm">:</span>
              <div className="relative w-20">
                <select
                  className="w-full h-11 appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-sm focus:outline-none"
                  value={timeM}
                  onChange={e => setTime(hour12, +e.target.value, isPM)}
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <div className="relative w-20">
                <select
                  className="w-full h-11 appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-sm focus:outline-none"
                  value={isPM ? 'PM' : 'AM'}
                  onChange={e => setTime(hour12, timeM, e.target.value === 'PM')}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary tabular-nums">{rawMain}</p>
              <p className="text-xs text-muted-foreground">Main Emails/Day</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{rawFollowUp}</p>
              <p className="text-xs text-muted-foreground">Follow-ups/Day</p>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={planCap}
            step={1}
            value={rawMain}
            onChange={e => {
              const m = Math.min(planCap, Math.max(0, parseInt(e.target.value, 10) || 0))
              setMainStr(String(m))
              setFollowUpStr(String(planCap - m))
            }}
            className="w-full h-3 rounded-full appearance-none cursor-pointer accent-primary"
            style={{ background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${planCap ? (rawMain / planCap) * 100 : 50}%, #10b981 ${planCap ? (rawMain / planCap) * 100 : 50}%, #10b981 100%)` }}
            aria-label="Split today's sending cap between main emails and follow-ups"
          />
          <p className="text-xs text-muted-foreground text-center">
            Main and follow-ups split your plan's {planCap}/day limit. Drag to rebalance.
          </p>
          {backlog && (backlog.main > 0 || backlog.followUp > 0) && (
            <p className="text-xs text-muted-foreground/80 text-center">
              Starting split matches your current backlog ({backlog.main} queued main, {backlog.followUp} pending follow-ups). Each main email can spawn several follow-ups, so that number tends to outgrow new mains over time. Worth rechecking this split periodically.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            Timezone
            {sched.timezone === BROWSER_TZ && <span className="text-xs text-blue-500/70">• auto-detected</span>}
          </label>
          <div className="relative">
            <select
              className="w-full h-11 appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-sm focus:outline-none"
              value={sched.timezone}
              onChange={e => setSched(s => ({ ...s, timezone: e.target.value }))}
            >
              {!TIMEZONES.includes(BROWSER_TZ) && <option key={BROWSER_TZ} value={BROWSER_TZ}>{BROWSER_TZ}</option>}
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

      </div>

      <div className="flex flex-col justify-between md:border-l md:border-border md:pl-8">
        <SchedulePreviewCalendar schedule={draftSchedule} days={30} />

        <div className="flex items-center justify-end gap-3 mt-5">
          {onCancel && (
            <Button size="default" variant="ghost" className="h-11 text-sm" onClick={onCancel}>Cancel</Button>
          )}
          <Button size="default" className="h-11 text-sm gap-2" disabled={saving || loading} onClick={save}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : saved ? 'Saved!' : name.trim() ? `Save${applyOnSave ? ' & Apply' : ''}` : 'Save'}
          </Button>
        </div>
      </div>
      </div>
    </Card>
  )
}
