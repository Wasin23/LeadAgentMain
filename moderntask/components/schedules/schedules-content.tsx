'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, CheckCircle2, Calendar, X } from 'lucide-react'
import { DAY_LABELS } from '@/lib/schedule-types'
import type { SavedSchedule, SendingSchedule } from '@/lib/schedule-types'
import { ScheduleBuilder } from '@/components/schedule/schedule-builder'
import { SchedulePreviewCalendar } from '@/components/schedule/schedule-preview-calendar'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

function summarize(s: SendingSchedule) {
  return `${s.mainPerDay}/day · ${s.activeDays.map(d => DAY_LABELS[d]).join(', ')} · ${(() => {
    const [h, m] = s.sendTime.split(':').map(Number)
    const pm = h >= 12; const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
  })()}${s.sendTimeJitterMinutes ? ` (± ${s.sendTimeJitterMinutes}m)` : ''}`
}

export function SchedulesContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const highlightDate = searchParams.get('date')

  const [schedules, setSchedules] = useState<SavedSchedule[]>([])
  const [activeSavedScheduleId, setActiveSavedScheduleId] = useState<string | null>(null)
  const [liveSchedule, setLiveSchedule] = useState<SendingSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editing, setEditing] = useState<SavedSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedSchedule | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  useBodyScrollLock(showBuilder || !!deleteTarget)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/settings/saved-schedules'),
      api.get('/api/settings/sending-schedule'),
    ]).then(([savedRes, liveRes]) => {
      setSchedules(savedRes.data?.schedules ?? [])
      setActiveSavedScheduleId(savedRes.data?.activeSavedScheduleId ?? null)
      setLiveSchedule(liveRes.data?.schedule ?? null)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const applySchedule = async (s: SavedSchedule) => {
    setApplyingId(s.id)
    try {
      await api.post(`/api/settings/saved-schedules/${s.id}/apply`)
      await api.post('/api/email-queue/reset-batch-excluded', {}).catch(() => {})
      toast({ title: `"${s.name}" is now active`, duration: 2000 })
      load()
    } catch {
      toast({ title: 'Failed to apply schedule', variant: 'destructive', duration: 2500 })
    } finally {
      setApplyingId(null)
    }
  }

  const deleteSchedule = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/settings/saved-schedules/${deleteTarget.id}`)
      toast({ title: `"${deleteTarget.name}" deleted`, duration: 2000 })
      setDeleteTarget(null)
      load()
    } catch {
      toast({ title: 'Failed to delete schedule', variant: 'destructive', duration: 2500 })
    }
  }

  return (
    <div className="space-y-5">
      {/* Live schedule preview */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base text-foreground">Currently sending</h2>
          {activeSavedScheduleId && (
            <Badge variant="outline" className="text-[10px]">
              {schedules.find(s => s.id === activeSavedScheduleId)?.name ?? 'Named schedule'}
            </Badge>
          )}
        </div>
        {liveSchedule ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">{summarize(liveSchedule)}</p>
            <SchedulePreviewCalendar schedule={liveSchedule} days={30} highlightDate={highlightDate} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            No sending schedule is active yet. Emails won't auto-send until you create and apply one below.
          </p>
        )}
      </Card>

      {/* Saved schedules list */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base text-foreground">Saved schedules</h2>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => { setEditing(null); setShowBuilder(true) }}>
          <Plus className="w-3.5 h-3.5" /> New Schedule
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No saved schedules yet. Create one to name and switch between different sending paces.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map(s => {
            const isActive = s.id === activeSavedScheduleId
            return (
              <Card key={s.id} className={`p-4 ${isActive ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{summarize(s)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  {!isActive && (
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled={applyingId === s.id} onClick={() => applySchedule(s)}>
                      {applyingId === s.id ? 'Applying…' : 'Apply'}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditing(s); setShowBuilder(true) }}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-modal-swoop-backdrop" onClick={() => setShowBuilder(false)}>
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-modal-swoop-up [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setShowBuilder(false)}
                className="absolute right-3 top-3 z-10 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <ScheduleBuilder
                editing={editing}
                applyOnSave={false}
                onSaved={() => { setShowBuilder(false); load() }}
                onCancel={() => setShowBuilder(false)}
              />
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-modal-swoop-backdrop" onClick={() => setDeleteTarget(null)}>
          <Card className="p-6 w-full max-w-sm space-y-4 animate-modal-swoop-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Delete "{deleteTarget.name}"?</h3>
            <p className="text-xs text-muted-foreground">
              {deleteTarget.id === activeSavedScheduleId
                ? "This is your currently active schedule. Deleting it won't stop sending, it'll just forget the name."
                : 'This cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={deleteSchedule}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
