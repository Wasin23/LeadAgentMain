'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, CheckCircle2, Calendar } from 'lucide-react'
import { DAY_LABELS } from '@/lib/schedule-types'
import type { SavedSchedule, SendingSchedule } from '@/lib/schedule-types'
import { ScheduleBuilder } from './schedule-builder'

function summarize(s: SendingSchedule) {
  return `${s.mainPerDay}/day · ${s.activeDays.map(d => DAY_LABELS[d]).join(', ')} · ${(() => {
    const [h, m] = s.sendTime.split(':').map(Number)
    const pm = h >= 12; const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
  })()}`
}

// Two-step content for the "Schedule for Send" modal: land on the list of saved schedules
// first (obvious "here's what you have, here's what's live"), only dropping into the full
// ScheduleBuilder form when you actually choose to create or edit one. Callers still own the
// modal shell (backdrop + close button) — this just swaps between the two inner views.
export function ScheduleModal({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<SavedSchedule[]>([])
  const [activeSavedScheduleId, setActiveSavedScheduleId] = useState<string | null>(null)
  const [liveSchedule, setLiveSchedule] = useState<SendingSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'builder'>('list')
  const [editing, setEditing] = useState<SavedSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedSchedule | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)

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
      onChanged?.()
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

  if (view === 'builder') {
    return (
      <ScheduleBuilder
        editing={editing}
        applyOnSave={false}
        onSaved={() => { setView('list'); load(); onChanged?.() }}
        onCancel={() => setView('list')}
      />
    )
  }

  return (
    <Card className="p-6 w-full space-y-5">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Schedule for Send</h2>
      </div>

      {/* Currently live */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-foreground">Currently sending</p>
          {activeSavedScheduleId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
              {schedules.find(s => s.id === activeSavedScheduleId)?.name ?? 'Named schedule'}
            </span>
          )}
        </div>
        {liveSchedule ? (
          <p className="text-xs text-muted-foreground">{summarize(liveSchedule)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No sending schedule is active yet. Create one below.</p>
        )}
      </div>

      {/* Saved schedules */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Saved schedules</h3>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => { setEditing(null); setView('builder') }}>
          <Plus className="w-3.5 h-3.5" /> New Schedule
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No saved schedules yet. Create one to name and switch between different sending paces.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map(s => {
            const isActive = s.id === activeSavedScheduleId
            return (
              <div key={s.id} className={`rounded-lg border p-4 ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditing(s); setView('builder') }}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <Card className="p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
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
    </Card>
  )
}
