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

  useEffect(() => {
    api.get('/api/settings/sending-schedule').then(r => {
      const cap = r.data?.planDailyCap ?? 50
      setPlanCap(cap)
      // Default split: half the plan's daily cap to each — not a flat 50 (that number only
      // means something for the separate per-email-address cap in the Outreach widget), and
      // not each independently maxed out either. Rounds up for main so the two always sum
      // to the full cap (e.g. cap=9 → 5 main / 4 follow-ups).
      const halfMain = Math.ceil(cap / 2)
      const halfFollowUp = Math.floor(cap / 2)

      if (editing) {
        // Re-clamp against the current plan cap in case it changed since this was saved.
        setMainStr(String(Math.min(cap, editing.mainPerDay || halfMain)))
        setFollowUpStr(String(Math.min(cap, editing.followUpPerDay ?? halfFollowUp)))
        return
      }

      const existing = r.data?.schedule
      if (existing) {
        setSched({ ...DEFAULT_SCHEDULE, ...existing })
        setMainStr(String(existing.mainPerDay ?? halfMain))
        setFollowUpStr(String(existing.followUpPerDay ?? halfFollowUp))
      } else {
        // No schedule yet — default to an even 50/50 split of the plan's actual cap.
        setMainStr(String(halfMain))
        setFollowUpStr(String(halfFollowUp))
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

  // Each field is independently settable up to the plan's full daily cap — main and
  // follow-ups aren't forced to split it. The allocator (utils/scheduleSlots.js) still
  // gives main priority for whatever the account can actually send each day, so setting
  // both to the max just means "use all available room for main first, follow-ups get
  // whatever main didn't use" rather than silently truncating what you type here.
  const rawMain = Math.min(planCap, Math.max(1, parseInt(mainStr) || 1))
  const rawFollowUp = Math.min(planCap, Math.max(0, parseInt(followUpStr) || 0))
  const followUpRoom = Math.max(0, planCap - rawMain)
  const followUpClamped = rawFollowUp > followUpRoom
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
          <label className="text-sm font-medium text-muted-foreground">Name <span className="text-muted-foreground/60">(optional — save it to switch back later)</span></label>
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Main Emails/Day <span className="text-muted-foreground/60">(max {planCap}, your plan's daily limit)</span></label>
            <div className="relative">
              <input
                type="number" min={1} max={planCap}
                className="w-full h-11 rounded-md border border-input bg-background px-3.5 pr-12 text-sm focus:outline-none"
                value={mainStr}
                onChange={e => {
                  const v = e.target.value
                  if (v === '') { setMainStr(''); return }
                  setMainStr(String(Math.min(planCap, Math.max(1, parseInt(v) || 1))))
                }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">/{planCap}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Follow-ups/Day <span className="text-muted-foreground/60">(max {planCap}, your plan's daily limit — 0 to pause auto follow-ups)</span>
          </label>
          <div className="relative">
            <input
              type="number" min={0} max={planCap}
              className="w-full h-11 rounded-md border border-input bg-background px-3.5 pr-12 text-sm focus:outline-none"
              value={followUpStr}
              onChange={e => {
                const v = e.target.value
                if (v === '') { setFollowUpStr(''); return }
                setFollowUpStr(String(Math.min(planCap, Math.max(0, parseInt(v) || 0))))
              }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">/{planCap}</span>
          </div>
          {followUpClamped && (
            <p className="text-xs text-amber-600">
              Main emails get priority for the shared {planCap}/day cap — on a day with {rawMain} main, only {followUpRoom} follow-up{followUpRoom === 1 ? '' : 's'} will actually go out, even though {rawFollowUp} is set.
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
