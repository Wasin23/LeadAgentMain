'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Save, ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { DAY_LABELS, TIMEZONES, BROWSER_TZ, DEFAULT_SCHEDULE, DEFAULT_FOLLOWUP_SETTINGS } from '@/lib/schedule-types'
import type { SendingSchedule, SavedSchedule, FollowUpSettings } from '@/lib/schedule-types'
import { SchedulePreviewCalendar } from './schedule-preview-calendar'
import { FullScheduleCalendar } from './full-schedule-calendar'

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
  const [planCap, setPlanCap] = useState(50)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Follow-up cadence — global, edited right here, not a ratio slider. Follow-ups are never
  // "configured" as a count: they're predicted from main volume (see the calendar preview).
  const [followUp, setFollowUp] = useState<FollowUpSettings>(DEFAULT_FOLLOWUP_SETTINGS)
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [showFullCalendar, setShowFullCalendar] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/api/settings/sending-schedule'),
      api.get('/api/settings/followup-settings').catch(() => null),
    ]).then(([r, fuRes]) => {
      const cap = r.data?.planDailyCap ?? 50
      setPlanCap(cap)
      if (fuRes?.data?.success) setFollowUp({ ...DEFAULT_FOLLOWUP_SETTINGS, ...fuRes.data.settings })

      if (editing) {
        // Re-clamp against the current plan cap in case it changed since this was saved.
        setMainStr(String(Math.min(cap, editing.mainPerDay ?? cap)))
        return
      }

      const existing = r.data?.schedule
      if (existing) {
        setSched({ ...DEFAULT_SCHEDULE, ...existing })
        setMainStr(String(Math.min(cap, existing.mainPerDay ?? cap)))
      } else {
        setMainStr(String(cap))
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

  const rawMain = Math.min(planCap, Math.max(1, parseInt(mainStr) || 0))
  const draftSchedule: SendingSchedule = { ...sched, mainPerDay: rawMain }

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
        description: `${draftSchedule.mainPerDay} emails/day on ${draftSchedule.activeDays.map(d => DAY_LABELS[d]).join(', ')} at ${draftSchedule.sendTime}`,
        duration: 2500,
      })
    } catch (err: any) {
      toast({ title: 'Failed to save schedule', description: err?.response?.data?.error, variant: 'destructive', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  const saveFollowUp = async (next: FollowUpSettings) => {
    setFollowUp(next)
    setSavingFollowUp(true)
    try {
      await api.put('/api/settings/followup-settings', next)
    } catch (err: any) {
      toast({ title: 'Failed to save follow-up settings', description: err?.response?.data?.error, variant: 'destructive', duration: 3000 })
    } finally {
      setSavingFollowUp(false)
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
          <label className="text-sm font-medium text-muted-foreground">Max Emails/Day</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={planCap}
              value={mainStr}
              onChange={e => setMainStr(e.target.value)}
              onBlur={() => setMainStr(String(Math.min(planCap, Math.max(1, parseInt(mainStr) || 1))))}
              className="w-28 h-14 rounded-lg border border-input bg-background px-3 text-3xl font-bold text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Main emails only, up to your plan's limit of <span className="font-medium text-foreground">{planCap}/day</span>. This is the bottleneck — follow-ups are predicted below, not configured.
            </p>
          </div>
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

        {/* Follow-up settings — global for the whole account, not per agent. Saved
            independently (on blur / toggle) so it's not tied to the main schedule's Save
            button. */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Follow-up Settings</p>
              <p className="text-xs text-muted-foreground mt-0.5">Applies to every agent · sends respect each mailbox's own 50/day limit</p>
            </div>
            <button
              onClick={() => saveFollowUp({ ...followUp, enabled: !followUp.enabled })}
              className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0', followUp.enabled ? 'bg-green-500' : 'bg-muted')}
            >
              <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', followUp.enabled ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>

          {followUp.enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium mb-1.5">Interval</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={1} max={60}
                      value={followUp.intervalDays}
                      onChange={e => setFollowUp(f => ({ ...f, intervalDays: parseInt(e.target.value) || 7 }))}
                      onBlur={() => saveFollowUp(followUp)}
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">days out</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5">Max per lead</p>
                  <input
                    type="number" min={1} max={10}
                    value={followUp.maxRebumps}
                    onChange={e => setFollowUp(f => ({ ...f, maxRebumps: parseInt(e.target.value) || 1 }))}
                    onBlur={() => saveFollowUp(followUp)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs font-medium flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-purple-400" /> Smart Follow-ups <span className="text-muted-foreground font-normal">— AI-written, real cost</span></p>
                <button
                  onClick={() => saveFollowUp({ ...followUp, smartRebump: !followUp.smartRebump })}
                  className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0', followUp.smartRebump ? 'bg-purple-500' : 'bg-muted')}
                >
                  <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', followUp.smartRebump ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>
              {savingFollowUp && <p className="text-xs text-muted-foreground/70">Saving…</p>}
            </>
          )}
        </div>

      </div>

      <div className="flex flex-col justify-between md:border-l md:border-border md:pl-8">
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowFullCalendar(v => !v)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              {showFullCalendar ? 'Close calendar' : 'Open Calendar'}
            </button>
          </div>
          {showFullCalendar ? (
            <FullScheduleCalendar schedule={draftSchedule} followUpSettings={followUp} />
          ) : (
            <SchedulePreviewCalendar schedule={draftSchedule} days={30} followUpSettings={followUp} />
          )}
        </div>

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
