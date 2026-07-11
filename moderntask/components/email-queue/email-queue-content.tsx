'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  CheckCircle2, XCircle,
  Clock, RefreshCw, Bot, Building2,
  Inbox, Pencil, ZoomIn, ZoomOut, Wand2,
  CheckSquare, Square, ChevronsLeft, ChevronLeft,
  ChevronRight, ChevronsRight, X, CalendarClock, Calendar,
  Settings2, Save, Search, FileText, ExternalLink,
  MoreHorizontal, Wrench, Loader2, Sparkles, Trash2, ListChecks,
  ArrowLeftRight, Mail, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyChip } from '@/components/leads/leads-content'

// ── types ─────────────────────────────────────────────────────────────────────
export interface Agent { agentId: string; name: string; personality?: { avatar?: string }; settings?: { sendingSchedule?: SendingSchedule; emailBuilder?: { smartRebump?: boolean } } }

export interface SendingSchedule {
  activeDays:  number[]  // 0=Sun … 6=Sat
  sendTime:    string    // "HH:MM" e.g. "09:00"
  dailyLimit:  number
  timezone:    string
}

interface ScheduledBatch {
  scheduledSendTime: string  // "YYYY-MM-DDTHH:MM" UTC
  count:    number
  agentName: string
  agentId:  string
  emailIds: { id: string; agentId: string }[]
}

interface QueueEmail {
  id: string; agentId?: string
  to?: string; cc?: string; bcc?: string; subject?: string; body?: string
  emailData?: { finalRecipient?: string; finalSubject?: string; finalBody?: string; cc?: string; bcc?: string }
  leadDetails?: { personInfo?: { fullName?: string; name?: string }; companyName?: string }
  leadName?: string; recipientName?: string
  createdAt?: string; sentAt?: string; fromAccount?: string
  isRebump?: boolean; status?: string; scheduledAt?: string
  batchExcluded?: boolean
  aiReport?: AIReport
}

export interface AIReport {
  companyName: string
  contactName: string
  score: number
  confidence: string
  totalSources: number
  tier: 'HIGHLY_QUALIFIED' | 'QUALIFIED' | 'SHOTGUN' | 'REJECTED'
  reasoning: string
  keyStrengths?: string[]
  weaknesses?: string[]
  citedEvidence?: { fact: string; source: string }[]
  allCitedFacts?: { fact: string; source: string; sourceTitle?: string }[]
  evaluatedAt: string
  researchQuality?: string
}

// Strips the compliance footer (company branding + unsubscribe link) from a draft body
// for display/editing - it's appended fresh at actual send time and shouldn't be shown
// or editable in the review queue. Covers both the sentinel marker and any legacy drafts
// that had the footer baked in before send-time injection existed.
function stripFooter(body: string) {
  const idx = body.indexOf('<!--MERIDIAN_FOOTER-->')
  return idx === -1 ? body : body.slice(0, idx).replace(/\s+$/, '')
}

function ef(e: QueueEmail) {
  return {
    to:      e.emailData?.finalRecipient || e.to      || '',
    cc:      e.emailData?.cc            || e.cc       || '',
    bcc:     e.emailData?.bcc           || e.bcc      || '',
    subject: e.emailData?.finalSubject  || e.subject  || '(no subject)',
    body:    stripFooter(e.emailData?.finalBody || e.body || ''),
    name:    e.leadDetails?.personInfo?.fullName || e.leadDetails?.personInfo?.name || e.leadName || e.recipientName || '',
    company: e.leadDetails?.companyName || '',
  }
}

function timeAgo(iso?: string) {
  if (!iso) return '-'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── schedule send modal ──────────────────────────────────────────────────────────
function ScheduleModal({ email, onSave, onClose }: {
  email: QueueEmail
  onSave: (id: string, scheduledAt: string | null, agentId?: string) => Promise<void>
  onClose: () => void
}) {
  // Pre-fill date/time from existing scheduledAt (as the agent's timezone clock time if possible)
  const existing = email.scheduledAt ? new Date(email.scheduledAt).toISOString().slice(0, 16) : ''
  const [value, setValue]   = useState(existing)
  const [tz, setTz]         = useState<string>(
    email.agentId
      ? (BROWSER_TZ) // will be overridden by agent schedule tz if available, but BROWSER_TZ is a good default
      : BROWSER_TZ
  )
  const [saving, setSaving] = useState(false)

  // Convert a "YYYY-MM-DDTHH:MM" local string in `timezone` to a UTC ISO string
  const toUTC = (localStr: string, timezone: string): string => {
    const [datePart, timePart] = localStr.split('T')
    const [year, month, day]   = datePart.split('-').map(Number)
    const [h, m]               = timePart.split(':').map(Number)
    const naive    = new Date(Date.UTC(year, month - 1, day, h, m, 0))
    const rendered = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(naive)
    const rH     = parseInt(rendered.find(p => p.type === 'hour')!.value, 10)
    const rM     = parseInt(rendered.find(p => p.type === 'minute')!.value, 10)
    const diffMs = ((h * 60 + m) - ((rH === 24 ? 0 : rH) * 60 + rM)) * 60000
    return new Date(naive.getTime() + diffMs).toISOString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Schedule Send</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{ef(email).name || ef(email).to}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Send at</label>
          <input
            type="datetime-local"
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            Timezone
            {tz === BROWSER_TZ && (
              <span className="text-[10px] text-blue-500/70">• auto-detected</span>
            )}
          </label>
          <div className="relative">
            <select
              className="w-full h-8 appearance-none rounded-md border border-input bg-background pl-2 pr-6 text-xs focus:outline-none"
              value={tz}
              onChange={e => setTz(e.target.value)}
            >
              {!TIMEZONES.includes(BROWSER_TZ) && (
                <option key={BROWSER_TZ} value={BROWSER_TZ}>{BROWSER_TZ}</option>
              )}
              {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
        {email.scheduledAt && (
          <p className="text-[11px] text-muted-foreground">Currently scheduled: {new Date(email.scheduledAt).toLocaleString()}</p>
        )}
        <div className="flex justify-between items-center">
          {email.scheduledAt ? (
            <button className="text-[11px] text-destructive hover:underline" onClick={async () => { 
              setSaving(true); 
              await onSave(email.id, null, email.agentId); 
              onClose() 
            }}>Clear schedule</button>
          ) : <span />}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" disabled={saving || !value} onClick={async () => {
              setSaving(true)
              await onSave(email.id, toUTC(value, tz), email.agentId)
              onClose()
            }}>{saving ? 'Saving…' : 'Schedule'}</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── agent sending schedule panel ─────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
  'America/Mexico_City', 'America/Buenos_Aires',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Hong_Kong',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
]

// Browser's own IANA timezone - used as the default for new agents
const BROWSER_TZ: string =
  typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'America/New_York'

const DEFAULT_SCHEDULE: SendingSchedule = {
  activeDays: [1, 2, 3, 4, 5],
  sendTime: '09:00',
  dailyLimit: 50,
  timezone: BROWSER_TZ,
}

function ScheduledBatchesModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast()
  const [batches, setBatches] = useState<ScheduledBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTime, setEditingTime] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/email-queue/scheduled-batches')
      setBatches(r.data.batches ?? [])
    } catch {
      toast({ title: 'Failed to load schedules', variant: 'destructive', duration: 2000 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toLocalInput = (utcSlot: string) => {
    // "YYYY-MM-DDTHH:MM" is treated as UTC - convert to local datetime-local value
    const d = new Date(utcSlot + ':00Z')
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const formatDisplay = (utcSlot: string) => {
    const d = new Date(utcSlot + ':00Z')
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const save = async (idx: number, batch: ScheduledBatch) => {
    const raw = editingTime[idx]
    if (!raw) return
    const newUtc = new Date(raw).toISOString()
    setSaving(s => ({ ...s, [idx]: true }))
    try {
      await api.patch('/api/email-queue/scheduled-batches', { emailIds: batch.emailIds, newScheduledAt: newUtc })
      toast({ title: 'Schedule updated', duration: 2000 })
      setEditingTime(s => { const n = { ...s }; delete n[idx]; return n })
      onChanged()
      await load()
    } catch {
      toast({ title: 'Failed to update schedule', variant: 'destructive', duration: 2000 })
    } finally {
      setSaving(s => ({ ...s, [idx]: false }))
    }
  }

  const deleteBatch = async (idx: number, batch: ScheduledBatch) => {
    setDeleting(s => ({ ...s, [idx]: true }))
    try {
      await api.delete('/api/email-queue/scheduled-batches', { data: { emailIds: batch.emailIds } })
      toast({ title: `Removed ${batch.count} scheduled email${batch.count !== 1 ? 's' : ''}`, duration: 2000 })
      onChanged()
      await load()
    } catch {
      toast({ title: 'Failed to delete schedule', variant: 'destructive', duration: 2000 })
    } finally {
      setDeleting(s => ({ ...s, [idx]: false }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Active Schedules</h2>
            {!loading && <span className="text-[10px] px-1.5 rounded-full bg-primary/10 text-primary font-semibold">{batches.length}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : batches.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">No active schedules.</p>
          ) : batches.map((batch, idx) => {
            const isEditing = idx in editingTime
            return (
              <div key={batch.scheduledSendTime} className="rounded-lg border border-border p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium">
                      {batch.count} email{batch.count !== 1 ? 's' : ''}
                      {batch.agentName && <span className="text-muted-foreground font-normal"> · {batch.agentName}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {isEditing ? 'Editing…' : formatDisplay(batch.scheduledSendTime)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteBatch(idx, batch)}
                    disabled={deleting[idx]}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                    title="Delete this schedule"
                  >
                    {deleting[idx] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      value={editingTime[idx]}
                      onChange={e => setEditingTime(s => ({ ...s, [idx]: e.target.value }))}
                    />
                    <Button size="sm" className="h-8 text-xs gap-1" disabled={saving[idx]} onClick={() => save(idx, batch)}>
                      {saving[idx] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingTime(s => { const n = { ...s }; delete n[idx]; return n })}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingTime(s => ({ ...s, [idx]: toLocalInput(batch.scheduledSendTime) }))}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Edit time
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function AgentScheduleCard({ agent, onSaved }: { agent: Agent; onSaved?: (s: SendingSchedule) => void }) {
  const { toast } = useToast()
  const initial = { ...DEFAULT_SCHEDULE, ...agent.settings?.sendingSchedule }
  const [sched, setSched]     = useState<SendingSchedule>(initial)
  const [limitStr, setLimitStr] = useState(String(initial.dailyLimit ?? 50))
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)

  // parse sendTime into hour/minute parts
  const [timeH, timeM] = sched.sendTime.split(':').map(Number)
  const isPM = timeH >= 12
  const hour12 = timeH % 12 || 12

  const setTime = (h12: number, m: number, pm: boolean) => {
    const h24 = pm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12)
    setSched(s => ({ ...s, sendTime: `${String(h24).padStart(2,'0')}:${String(m).padStart(2,'0')}` }))
  }

  const toggleDay = (d: number) =>
    setSched(s => ({ ...s, activeDays: s.activeDays.includes(d) ? s.activeDays.filter(x => x !== d) : [...s.activeDays, d].sort() }))

  const save = async () => {
    setSaving(true)
    try {
      const scheduleToSave = { ...sched, dailyLimit: Math.min(50, Math.max(1, parseInt(limitStr) || 1)) }
      
      await api.put(`/api/auth/agents/${agent.agentId}/settings`, {
        ...agent.settings,
        sendingSchedule: scheduleToSave,
      })

      // Re-enroll any emails the user previously excluded from the batch
      await api.post('/api/email-queue/reset-batch-excluded', { agentId: agent.agentId }).catch(() => {})
      
      const saved = scheduleToSave
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      onSaved?.(saved)
      toast({ title: 'Schedule saved', description: `Sending ${saved.dailyLimit}/day on ${saved.activeDays.map(d => DAY_LABELS[d]).join(', ')} at ${saved.sendTime}`, duration: 2000 })
    } catch (err: any) {
      toast({ title: 'Failed to save schedule', variant: 'destructive', duration: 2000 })
    }
    finally { setSaving(false) }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Sending Schedule</h2>
        <span className="text-[10px] text-muted-foreground ml-1">for {agent.name}</span>
      </div>
      <div className="space-y-4">
        {/* active days */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">Active Days</label>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={cn(
                  'w-10 h-8 rounded-md text-xs font-medium border transition-colors',
                  sched.activeDays.includes(i)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-input hover:bg-muted'
                )}
              >{label}</button>
            ))}
          </div>
        </div>
        {/* send time + limit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Send Time</label>
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <select
                  className="w-full h-8 appearance-none rounded-md border border-input bg-background pl-2 pr-6 text-xs focus:outline-none"
                  value={hour12}
                  onChange={e => setTime(+e.target.value, timeM, isPM)}
                >
                  {Array.from({length:12},(_,i)=>i+1).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground text-xs">:</span>
              <div className="relative w-16">
                <select
                  className="w-full h-8 appearance-none rounded-md border border-input bg-background pl-2 pr-6 text-xs focus:outline-none"
                  value={timeM}
                  onChange={e => setTime(hour12, +e.target.value, isPM)}
                >
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2,'0')}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              </div>
              <div className="relative w-16">
                <select
                  className="w-full h-8 appearance-none rounded-md border border-input bg-background pl-2 pr-6 text-xs focus:outline-none"
                  value={isPM ? 'PM' : 'AM'}
                  onChange={e => setTime(hour12, timeM, e.target.value === 'PM')}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Daily Limit <span className="text-muted-foreground/60">(max 50)</span></label>
            <div className="relative">
              <input
                type="number" min={1} max={50}
                className="w-full h-8 rounded-md border border-input bg-background px-3 pr-9 text-xs focus:outline-none"
                value={limitStr}
                onChange={e => {
                  const v = e.target.value
                  if (v === '') { setLimitStr(''); return }
                  setLimitStr(String(Math.min(50, Math.max(1, parseInt(v) || 1))))
                }}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">/50</span>
            </div>
          </div>
        </div>
        {/* timezone + save */}
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              Timezone
              {sched.timezone === BROWSER_TZ && (
                <span className="text-[10px] text-blue-500/70">• auto-detected</span>
              )}
            </label>
            <div className="relative">
              <select
                className="w-full h-8 appearance-none rounded-md border border-input bg-background pl-2 pr-6 text-xs focus:outline-none"
                value={sched.timezone}
                onChange={e => setSched(s => ({ ...s, timezone: e.target.value }))}
              >
                {/* Always ensure the browser's detected timezone is selectable */}
                {!TIMEZONES.includes(BROWSER_TZ) && (
                  <option key={BROWSER_TZ} value={BROWSER_TZ}>{BROWSER_TZ}</option>
                )}
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          <Button size="sm" className="h-8 gap-1.5" disabled={saving} onClick={save}>
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── edit modal ────────────────────────────────────────────────────────────────
const inputCls = 'w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring'

function EditModal({ email, onSave, onClose }: {
  email: QueueEmail
  onSave: (id: string, to: string, cc: string, bcc: string, subject: string, body: string, agentId?: string) => Promise<void>
  onClose: () => void
}) {
  const fields = ef(email)
  const [to, setTo]           = useState(fields.to)
  const [cc, setCc]           = useState(fields.cc)
  const [bcc, setBcc]         = useState(fields.bcc)
  const [subject, setSubject] = useState(fields.subject)
  const [body, setBody]       = useState(fields.body)
  const [saving, setSaving]   = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <p className="text-xs font-semibold">Edit Email</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">To</label>
            <input className={inputCls} value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">CC</label>
              <input className={inputCls} value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">BCC</label>
              <input className={inputCls} value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Subject</label>
            <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Body</label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed" rows={14} value={body} onChange={e => setBody(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" disabled={saving || !to.trim() || !subject.trim()} onClick={async () => {
            setSaving(true)
            await onSave(email.id, to, cc, bcc, subject, body, email.agentId)
            setSaving(false); onClose()
          }}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── mass re-edit modal ────────────────────────────────────────────────────────
function MassReEditModal({ emails, onSave, onClose }: {
  emails: QueueEmail[]
  onSave: (id: string, to: string, cc: string, bcc: string, subject: string, body: string, agentId?: string) => Promise<void>
  onClose: () => void
}) {
  const [instruction, setInstruction] = useState('')
  const [running, setRunning]         = useState(false)
  const [done, setDone]               = useState(0)
  const [failed, setFailed]           = useState(0)
  const [completed, setCompleted]     = useState(false)
  const wordCount = instruction.trim() ? instruction.trim().split(/\s+/).length : 0
  const total = emails.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const run = async () => {
    setRunning(true)
    setDone(0)
    setFailed(0)
    for (const email of emails) {
      const fields = ef(email)
      try {
        const res = await api.post('/api/email-queue/rebuild', {
          emailId: email.id,
          agentId: email.agentId,
          instruction,
          currentSubject: fields.subject,
          currentBody: fields.body,
          aiReport: email.aiReport || null,
        })
        await onSave(email.id, fields.to, fields.cc, fields.bcc, res.data.subject, res.data.body, email.agentId)
      } catch {
        setFailed(f => f + 1)
      }
      setDone(d => d + 1)
    }
    setRunning(false)
    setCompleted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              Mass Re-edit
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{total} email{total !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} disabled={running}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {!completed ? (
          <>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">How should these emails be rewritten?</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                rows={3}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="e.g. Make them more casual and friendly…"
                maxLength={300}
                autoFocus
                disabled={running}
              />
              <p className={cn('text-[10px] text-right', wordCount > 30 ? 'text-destructive' : 'text-muted-foreground')}>{wordCount}/30 words</p>
            </div>

            {running && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Re-editing emails…
                  </span>
                  <span className="font-medium">{done}/{total} ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onClose} disabled={running}>Cancel</Button>
              <Button size="sm" disabled={running || !instruction.trim() || wordCount > 30} onClick={run}>
                {running
                  ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Running…</>
                  : <><Wand2 className="w-3 h-3 mr-1.5" />Re-edit {total} email{total !== 1 ? 's' : ''}</>
                }
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm font-medium">Done!</p>
              <p className="text-[11px] text-muted-foreground">
                {total - failed} email{(total - failed) !== 1 ? 's' : ''} updated{failed > 0 ? `, ${failed} failed` : ''}.
              </p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── pagination bar ────────────────────────────────────────────────────────────
function PaginationBar({ offset, limit, total, onChange }: {
  offset: number; limit: number; total: number; onChange: (off: number) => void
}) {
  const page      = Math.floor(offset / limit) + 1
  const pageCount = Math.ceil(total / limit) || 1
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="shrink-0 mr-1">{total === 0 ? '0' : `${offset + 1}–${Math.min(offset + limit, total)}`} of {total}</span>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={offset === 0} onClick={() => onChange(0)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={offset === 0} onClick={() => onChange(offset - limit)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
      <span className="px-1.5 text-[11px]">p.{page}/{pageCount}</span>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}><ChevronRight className="w-3.5 h-3.5" /></Button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={offset + limit >= total} onClick={() => onChange((pageCount - 1) * limit)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
    </div>
  )
}

// ── compact list row (left pane of the 3-pane Awaiting Review layout) ────────
function CompactEmailRow({ email, agentMap, active, selected, onActivate, onToggleSelect }: {
  email: QueueEmail; agentMap: Record<string, Agent>
  active: boolean; selected: boolean
  onActivate: () => void; onToggleSelect: () => void
}) {
  const { to, subject, name, company } = ef(email)
  const agent = email.agentId ? agentMap[email.agentId] : null
  const initials = (company || name || to || '?').slice(0, 2).toUpperCase()
  return (
    <button
      onClick={onActivate}
      className={cn(
        'mb-1 flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        active ? 'border border-success bg-success-soft' : 'border border-transparent hover:bg-accent',
      )}
    >
      <span onClick={e => { e.stopPropagation(); onToggleSelect() }} className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0">
        {selected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
      </span>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/85 text-[11px] font-medium text-background">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{company || name || to}</p>
        <p className="truncate text-xs text-muted-foreground">{name && company ? name : subject}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {agent
            ? <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">{agent.name}</span>
            : <span />}
          <span className="text-[10px] text-muted-foreground">{timeAgo(email.sentAt || email.createdAt)}</span>
        </div>
      </div>
    </button>
  )
}

// ── email row ─────────────────────────────────────────────────────────────────
function EmailRow({ email, agentMap, selected, onSelect, fontSize, actions, onEdit, onSchedule, onCancelSchedule, onCancelAutoSchedule, autoScheduleDate, onViewReport, onRebuild, forceExpanded, hideSelect }: {
  email: QueueEmail; agentMap: Record<string, Agent>
  selected: boolean; onSelect: (id: string) => void
  fontSize: number; actions?: React.ReactNode; onEdit?: () => void; onSchedule?: () => void
  onCancelSchedule?: () => void
  onCancelAutoSchedule?: () => void
  autoScheduleDate?: Date
  onViewReport?: () => void
  onRebuild?: () => void
  forceExpanded?: boolean
  hideSelect?: boolean
}) {
  const [expandedState, setExpanded] = useState(false)
  const expanded = forceExpanded || expandedState
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { to, subject, body, name, company } = ef(email)
  const agent = email.agentId ? agentMap[email.agentId] : null

  useEffect(() => {
    if (!menuOpen) return
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])
  return (
    <div className={cn('flex gap-3 py-3', !hideSelect && 'border-l-2 pl-3 transition-colors', !hideSelect && (selected ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/30'))}>
      {!hideSelect && (
        <button onClick={() => onSelect(email.id)} className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground">
          {selected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => setExpanded(p => !p)} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              {name && <span className="font-medium text-foreground truncate" style={{ fontSize }}>{name}</span>}
              {company && <span className="text-muted-foreground flex items-center gap-0.5" style={{ fontSize: fontSize - 1 }}><Building2 className="w-2.5 h-2.5" />{company}</span>}
              {!name && to && <span className="text-muted-foreground truncate" style={{ fontSize }}>{to}</span>}
            </div>
            <p className="font-medium text-foreground truncate" style={{ fontSize: fontSize + 1 }}>{subject}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5" style={{ fontSize: fontSize - 1 }}>
              <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{timeAgo(email.sentAt || email.createdAt)}</span>
              {agent && <span className="text-muted-foreground flex items-center gap-1"><Bot className="w-2.5 h-2.5" />{agent.name}</span>}
              {email.isRebump && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-orange-400 border-orange-500/30 bg-orange-500/10">Follow-up</Badge>}
              {email.fromAccount && <span className="text-muted-foreground truncate">via {email.fromAccount}</span>}
              {autoScheduleDate && !email.scheduledAt && (
                <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-4 flex items-center gap-0.5', agent?.settings?.emailBuilder?.smartRebump ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' : 'text-primary border-primary/30 bg-primary/10')}>
                  {agent?.settings?.emailBuilder?.smartRebump ? <Sparkles className="w-2 h-2" /> : <Clock className="w-2.5 h-2.5" />}
                  {agent?.settings?.emailBuilder?.smartRebump ? 'smart' : 'auto'} · {autoScheduleDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {onCancelAutoSchedule && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); onCancelAutoSchedule() }}
                      onKeyDown={e => e.key === 'Enter' && onCancelAutoSchedule()}
                      className="ml-0.5 rounded-full hover:bg-primary/20 p-px transition-colors cursor-pointer"
                      title="Remove from auto-schedule"
                    >
                      <X className="w-2 h-2" />
                    </span>
                  )}
                </Badge>
              )}
              {email.scheduledAt && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-blue-400 border-blue-500/30 bg-blue-500/10 flex items-center gap-0.5">
                  <CalendarClock className="w-2.5 h-2.5" />{new Date(email.scheduledAt).toLocaleDateString()}
                  {onCancelSchedule && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); onCancelSchedule() }}
                      onKeyDown={e => e.key === 'Enter' && onCancelSchedule()}
                      className="ml-0.5 rounded-full hover:bg-blue-500/20 p-px transition-colors cursor-pointer"
                      title="Cancel scheduled send"
                    >
                      <X className="w-2 h-2" />
                    </span>
                  )}
                </Badge>
              )}
              {email.aiReport && onViewReport && (
                <button
                  onClick={e => { e.stopPropagation(); onViewReport() }}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <FileText className="w-2.5 h-2.5" />
                  <span>View Report</span>
                </button>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {(email.aiReport || onSchedule || onEdit || onRebuild) && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(p => !p)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
                  title="More options"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  Edit
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                    {onSchedule && (
                      <button
                        onClick={() => { setMenuOpen(false); onSchedule() }}
                        className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors', email.scheduledAt ? 'text-blue-400' : 'text-foreground')}
                      >
                        <CalendarClock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        {email.scheduledAt ? 'Reschedule' : 'Schedule'}
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => { setMenuOpen(false); onEdit() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        Edit
                      </button>
                    )}
                    {onRebuild && (
                      <button
                        onClick={() => { setMenuOpen(false); onRebuild() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors border-t border-border"
                      >
                        <Wrench className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        Rebuild Email
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {actions}
          </div>
        </div>
        {expanded && body && (
          <div className="relative mt-2 rounded-lg bg-muted/40 border border-border">
            <div className="absolute right-2 top-2 z-10 flex items-center rounded-md bg-background/80 backdrop-blur-sm border border-border px-1.5 py-1">
              <CopyChip text={body} title="Copy email content" />
            </div>
            <div className="p-3 text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto" style={{ fontSize }}>
              {body}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── rebuild modal ───────────────────────────────────────────────────────────
function RebuildModal({ email, onSave, onClose }: {
  email: QueueEmail
  onSave: (id: string, to: string, cc: string, bcc: string, subject: string, body: string, agentId?: string) => Promise<void>
  onClose: () => void
}) {
  const fields = ef(email)
  const [instruction, setInstruction] = useState('')
  const [rebuilding, setRebuilding] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSave, setPendingSave] = useState<{ subject: string; body: string } | null>(null)
  const wordCount = instruction.trim() ? instruction.trim().split(/\s+/).length : 0

  const saveRule = async () => {
    if (!email.agentId) return
    setSavingRule(true)
    try {
      const settingsRes = await api.get(`/api/lead-agent/settings?agentId=${email.agentId}`)
      const s = settingsRes.data.settings || {}
      // Strip GET-response wrapper keys to avoid polluting DynamoDB
      const { userSettings: _us, emailSettings: _es, leadGeneration: _lg, ...cleanS } = s as Record<string, any>
      const e = (s.emailSettings || s.emailBuilder || cleanS) as Record<string, any>
      const existing = e.customPrompt || e.emailBuilder?.customPrompt || ''
      const merged = existing ? `${existing}\n${instruction.trim()}` : instruction.trim()
      await api.post('/api/lead-agent/settings', {
        ...cleanS,
        agentId: email.agentId,
        emailBuilder: { ...(cleanS.emailBuilder || {}), customPrompt: merged },
      })
    } catch (err) {
      console.error('[REBUILD] Failed to save writing rule:', err)
    } finally {
      setSavingRule(false)
    }
    if (pendingSave) {
      await onSave(email.id, fields.to, fields.cc, fields.bcc, pendingSave.subject, pendingSave.body, email.agentId)
    }
    onClose()
  }

  const skipRule = async () => {
    if (pendingSave) {
      await onSave(email.id, fields.to, fields.cc, fields.bcc, pendingSave.subject, pendingSave.body, email.agentId)
    }
    onClose()
  }

  const rebuild = async () => {
    setRebuilding(true)
    setError(null)
    try {
      const res = await api.post('/api/email-queue/rebuild', {
        emailId: email.id,
        agentId: email.agentId,
        instruction,
        currentSubject: fields.subject,
        currentBody: fields.body,
        aiReport: email.aiReport || null,
      })
      setPendingSave({ subject: res.data.subject, body: res.data.body })
    } catch {
      setError('Rebuild failed - try again.')
    } finally {
      setRebuilding(false)
    }
  }

  // ── post-rebuild: save prompt? ───────────────────────────────────────────
  if (pendingSave) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-sm p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Save to agent settings?</h3>
            <p className="text-xs text-muted-foreground mt-1">Add <span className="italic">&ldquo;{instruction.trim()}&rdquo;</span> to this agent&apos;s Writing Rules so future emails follow the same guidance.</p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={skipRule} disabled={savingRule}>Skip</Button>
            <Button size="sm" onClick={saveRule} disabled={savingRule}>
              {savingRule ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Saving…</> : 'Yes, save it'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              Rebuild Email
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{fields.name || fields.to}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">How should this email be rewritten?</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
            rows={3}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="e.g. Make it more casual and focus on cost savings…"
            maxLength={300}
            autoFocus
          />
          <p className={cn('text-[10px] text-right', wordCount > 30 ? 'text-destructive' : 'text-muted-foreground')}>{wordCount}/30 words</p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={rebuilding}>Cancel</Button>
          <Button size="sm" disabled={rebuilding || !instruction.trim() || wordCount > 30} onClick={rebuild}>
            {rebuilding
              ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Rebuilding…</>
              : <><Wrench className="w-3 h-3 mr-1.5" />Rebuild</>}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function Skel() {
  return (
    <div className="space-y-4 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-4 h-4 rounded bg-muted mt-1 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-48 rounded bg-muted" />
            <div className="h-2.5 w-64 rounded bg-muted" />
            <div className="h-2 w-32 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Given a 0-based position in the full queue and the agent's sending schedule,
// returns the Date when that email will be sent:
//   - emails 0..(limit-1) → first upcoming active day
//   - emails limit..(2*limit-1) → second active day, etc.
function computeAutoSendDate(index: number, schedule: SendingSchedule): Date {
  const { activeDays, sendTime, dailyLimit, timezone } = schedule
  const tz = timezone || 'America/New_York'
  const limit = Math.max(1, dailyLimit)
  const targetSlot = Math.floor(index / limit)
  const [schedH, schedM] = sendTime.split(':').map(Number)

  const now = new Date()
  // Today's date in the agent's configured timezone
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now) // "YYYY-MM-DD"
  const [todayY, todayMo, todayD] = todayStr.split('-').map(Number)

  // Has today's send window already passed in the agent's timezone?
  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const nowH = parseInt(nowParts.find(p => p.type === 'hour')!.value, 10)
  const nowM = parseInt(nowParts.find(p => p.type === 'minute')!.value, 10)
  const startOffset = ((nowH === 24 ? 0 : nowH) * 60 + nowM) >= (schedH * 60 + schedM) ? 1 : 0

  // Converts HH:MM on a given calendar day in tz to a UTC Date.
  // Inverse-offset trick: naive UTC candidate → measure TZ render → shift to correct.
  function localTimeToUTC(y: number, mo: number, d: number): Date {
    const naive = new Date(Date.UTC(y, mo - 1, d, schedH, schedM, 0))
    const rendered = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(naive)
    const rH = parseInt(rendered.find(p => p.type === 'hour')!.value, 10)
    const rM = parseInt(rendered.find(p => p.type === 'minute')!.value, 10)
    const diffMs = ((schedH * 60 + schedM) - ((rH === 24 ? 0 : rH) * 60 + rM)) * 60000
    return new Date(naive.getTime() + diffMs)
  }

  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  let slotsFound = 0
  for (let i = startOffset; i < 400; i++) {
    // UTC noon as probe avoids DST-at-midnight edge cases
    const probe = new Date(Date.UTC(todayY, todayMo - 1, todayD + i, 12, 0, 0))
    const wdStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(probe)
    const wd = wdMap[wdStr] ?? probe.getUTCDay()
    if (activeDays.includes(wd)) {
      if (slotsFound === targetSlot) {
        const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(probe)
        const [dY, dMo, dD] = dateStr.split('-').map(Number)
        return localTimeToUTC(dY, dMo, dD)
      }
      slotsFound++
    }
  }
  const fbProbe = new Date(Date.UTC(todayY, todayMo - 1, todayD + 400, 12, 0, 0))
  const fbStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(fbProbe)
  const [fY, fMo, fD] = fbStr.split('-').map(Number)
  return localTimeToUTC(fY, fMo, fD)
}

function Empty({ icon: Icon, text, sub }: { icon: React.ElementType; text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">{React.createElement(Icon as React.ElementType, { className: 'w-5 h-5 text-muted-foreground' })}</div>
      <div><p className="text-sm font-medium">{text}</p><p className="text-xs text-muted-foreground mt-0.5">{sub}</p></div>
    </div>
  )
}

// ── AI report modal ───────────────────────────────────────────────────────────
export function AIReportModal({ report, onClose }: { report: AIReport; onClose: () => void }) {
  const tierColors = {
    HIGHLY_QUALIFIED: 'bg-green-500/10 text-green-500 border-green-500/30',
    QUALIFIED: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    SHOTGUN: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    REJECTED: 'bg-red-500/10 text-red-500 border-red-500/30',
  }
  const tierLabels = {
    HIGHLY_QUALIFIED: 'Highly Qualified',
    QUALIFIED: 'Qualified',
    SHOTGUN: 'Shotgun',
    REJECTED: 'Rejected',
  }
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border">
            <div className="flex-1">
              <div className="mb-4">
                <h3 className="text-lg font-semibold uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Research Report
                </h3>
                <p className="text-muted-foreground text-sm mt-1">{report.companyName} • {report.contactName}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-muted/40">
                  <span className="text-xs text-muted-foreground">Score</span>
                  <span className="text-sm font-bold text-primary">{report.score}/100</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-muted/40">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <span className="text-sm font-bold">{report.confidence}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-muted/40">
                  <span className="text-xs text-muted-foreground">Sources</span>
                  <span className="text-sm font-bold">{report.totalSources}</span>
                </div>
                <Badge variant="outline" className={cn('ml-auto px-3 py-1.5 text-xs font-semibold uppercase tracking-wider', tierColors[report.tier])}>
                  {tierLabels[report.tier]}
                </Badge>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors ml-4">
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>

          {/* Content - Scrollable, one unified block instead of separate padded cards */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Analysis */}
              <div className="p-5 border-b border-border">
                <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Analysis</h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{report.reasoning}</p>
              </div>

              {/* Strengths vs Concerns — venn diagram header over a two-column table */}
              {((report.keyStrengths && report.keyStrengths.length > 0) || (report.weaknesses && report.weaknesses.length > 0)) && (
                <div className="p-5 border-b border-border">
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative flex items-center">
                      <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/40 flex items-center justify-center">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">Strengths</span>
                      </div>
                      <div className="w-20 h-20 -ml-7 rounded-full bg-yellow-500/10 border border-yellow-500/40 flex items-center justify-center">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Concerns</span>
                      </div>
                    </div>
                  </div>
                  <table className="w-full text-xs table-fixed">
                    <tbody>
                      {Array.from({ length: Math.max(report.keyStrengths?.length ?? 0, report.weaknesses?.length ?? 0) }).map((_, i) => (
                        <tr key={i} className="align-top">
                          <td className="w-1/2 py-1.5 pr-4">
                            {report.keyStrengths?.[i] && (
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <span className="text-green-500 mt-0.5 shrink-0">+</span>
                                <span>{report.keyStrengths[i]}</span>
                              </div>
                            )}
                          </td>
                          <td className="w-1/2 py-1.5 pl-4 border-l border-border">
                            {report.weaknesses?.[i] && (
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <span className="text-yellow-500 mt-0.5 shrink-0">−</span>
                                <span>{report.weaknesses[i]}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Key Evidence — table rows, fact + source */}
              {report.citedEvidence && report.citedEvidence.length > 0 && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Key Evidence</h4>
                  <table className="w-full text-xs">
                    <tbody>
                      {report.citedEvidence.map((evidence, i) => (
                        <tr key={i} className={i > 0 ? 'border-t border-border' : ''}>
                          <td className="py-2.5 pr-3 align-top text-muted-foreground leading-relaxed">{evidence.fact}</td>
                          <td className="py-2.5 align-top text-right whitespace-nowrap">
                            <a
                              href={evidence.source && !/^https?:\/\//i.test(evidence.source) ? `https://${evidence.source}` : evidence.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] text-primary hover:text-primary/70 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[180px]">{evidence.source}</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* All Sources */}
              {report.allCitedFacts && report.allCitedFacts.length > 0 && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
                    All Sources ({Array.from(new Set(report.allCitedFacts.map(f => f.source))).filter(s => s).length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {Array.from(new Set(report.allCitedFacts.map(f => f.source)))
                          .filter((source) => source)
                          .map((source, i) => {
                            const sourceTitle = report.allCitedFacts?.find(f => f.source === source)?.sourceTitle
                            return (
                              <tr key={i} className={i > 0 ? 'border-t border-border' : ''}>
                                <td className="py-2">
                                  <a
                                    href={source}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 hover:text-primary transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      {sourceTitle && <div className="truncate font-medium">{sourceTitle}</div>}
                                      <div className="text-[10px] truncate text-muted-foreground">{source}</div>
                                    </div>
                                  </a>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="px-5 py-3 bg-muted/20 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Evaluated: {new Date(report.evaluatedAt).toLocaleString()}</span>
                {report.researchQuality && <span className="px-2 py-1 bg-muted rounded">Quality: {report.researchQuality}</span>}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

// ── context pane (right column of the 3-pane Awaiting Review layout) ────────
function ContextPane({ email, agentMap }: { email: QueueEmail | null; agentMap: Record<string, Agent> }) {
  if (!email) {
    return (
      <div className="min-w-0 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        Select an email to see why it was written.
      </div>
    )
  }
  const { company } = ef(email)
  const report = email.aiReport
  const agent = email.agentId ? agentMap[email.agentId] : null
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <p className="truncate text-sm font-semibold text-foreground">{report?.companyName || company || 'Company'}</p>
      {report && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{report.score}/100</Badge>
          <Badge variant="outline" className="text-[10px]">{report.confidence}</Badge>
        </div>
      )}

      {report?.reasoning && (
        <>
          <div className="my-4 border-t border-border" />
          <p className="mb-2 text-xs font-semibold text-foreground">Why this email?</p>
          {report.keyStrengths && report.keyStrengths.length > 0 ? (
            <ul className="space-y-2">
              {report.keyStrengths.slice(0, 4).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/85">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-5">{report.reasoning}</p>
          )}
        </>
      )}

      {report?.tier && (
        <>
          <div className="my-4 border-t border-border" />
          <p className="mb-2 text-xs font-semibold text-foreground">Key context</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[11px] text-success-soft-foreground">
              <Sparkles className="h-3 w-3" />{report.tier.replace(/_/g, ' ')}
            </span>
            {report.researchQuality && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[11px] text-success-soft-foreground">
                <Sparkles className="h-3 w-3" />{report.researchQuality}
              </span>
            )}
          </div>
        </>
      )}

      <div className="my-4 border-t border-border" />
      <p className="mb-2 text-xs font-semibold text-foreground">Assigned Agent</p>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-surface text-brass">
          <Bot className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <p className="text-xs font-medium text-foreground">{agent?.name || '-'}</p>
      </div>

      <button
        onClick={() => window.location.href = '/leads'}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
      >
        View Full Lead Report
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── queued list ───────────────────────────────────────────────────────────────
function QueuedList({ agentId, agentMap, fontSize, setFontSize, onCountChange, activeSchedule }: {
  agentId: string; agentMap: Record<string, Agent>; fontSize: number
  setFontSize: (fn: (s: number) => number) => void
  onCountChange: (n: number) => void
  activeSchedule?: SendingSchedule | null
}) {
  const { toast } = useToast()
  const [excludedAuto, setExcludedAuto] = useState<Set<string>>(new Set())
  const [emails, setEmails]         = useState<QueueEmail[]>([])
  const [loading, setLoading]       = useState(true)
  const [total, setTotal]           = useState(0)
  const [offset, setOffset]         = useState(0)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget]       = useState<QueueEmail | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<QueueEmail | null>(null)
  const [rebuildTarget, setRebuildTarget] = useState<QueueEmail | null>(null)
  const [showMassReEdit, setShowMassReEdit] = useState(false)
  const [viewingAiReport, setViewingAiReport] = useState<AIReport | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const LIMIT = 20

  const load = useCallback(async (off = 0) => {
    setLoading(true); setSelected(new Set())
    try {
      const params: Record<string, string | number> = { limit: LIMIT, offset: off, agentId: agentId === 'all' ? 'all' : agentId }
      const res = await api.get('/api/email-queue/queue', { params })
      const list: QueueEmail[] = res.data.emails ?? res.data ?? []
      const tot  = res.data.total ?? list.length
      setEmails(list); setTotal(tot); setOffset(off); onCountChange(tot)
    } catch {} finally { setLoading(false) }
  }, [agentId, onCountChange])

  // Silent background refresh - doesn't clear selection or show spinner
  const silentRefresh = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { limit: LIMIT, offset: 0, agentId: agentId === 'all' ? 'all' : agentId }
      const res = await api.get('/api/email-queue/queue', { params })
      const list: QueueEmail[] = res.data.emails ?? res.data ?? []
      const tot = res.data.total ?? list.length
      setEmails(list)
      setTotal(tot)
      onCountChange(tot)
    } catch {}
  }, [agentId, onCountChange])

  const prevScheduleRef = useRef<SendingSchedule | null | undefined>(undefined)
  useEffect(() => {
    if (prevScheduleRef.current !== undefined && activeSchedule !== prevScheduleRef.current) {
      setExcludedAuto(new Set())
      load(0)
    }
    prevScheduleRef.current = activeSchedule
  }, [activeSchedule, load])

  useEffect(() => {
    load(0)
    const interval = setInterval(silentRefresh, 15000)
    return () => clearInterval(interval)
  }, [load, silentRefresh])

  const filtered = useMemo(() => {
    if (!search.trim()) return emails
    const q = search.toLowerCase()
    return emails.filter(e => {
      const f = ef(e)
      return (
        f.name.toLowerCase().includes(q) ||
        f.company.toLowerCase().includes(q) ||
        f.subject.toLowerCase().includes(q) ||
        f.body.toLowerCase().includes(q) ||
        f.to.toLowerCase().includes(q)
      )
    })
  }, [emails, search])

  // Map from email id → computed auto-send date, based on queue order + schedule
  const autoSendDates = useMemo<Map<string, Date>>(() => {
    const sorted = [...emails].sort((a, b) =>
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    )
    const map = new Map<string, Date>()
    if (agentId !== 'all') {
      // single-agent: use the passed activeSchedule
      if (!activeSchedule) return map
      let slotIndex = 0
      sorted.forEach(email => {
        if (!email.scheduledAt && !email.batchExcluded && !excludedAuto.has(email.id)) {
          map.set(email.id, computeAutoSendDate(slotIndex, activeSchedule))
          slotIndex++
        }
      })
      return map
    }
    // all-agents: compute slot index independently per agent
    const slotsByAgent: Record<string, number> = {}
    sorted.forEach(email => {
      if (email.scheduledAt || email.batchExcluded || excludedAuto.has(email.id)) return
      const aid = email.agentId
      if (!aid) return
      const sched = agentMap[aid]?.settings?.sendingSchedule
      if (!sched) return
      const idx = slotsByAgent[aid] ?? 0
      map.set(email.id, computeAutoSendDate(idx, sched))
      slotsByAgent[aid] = idx + 1
    })
    return map
  }, [emails, activeSchedule, excludedAuto, agentId, agentMap])

  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id))
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(filtered.map(e => e.id)))
  const toggleOne   = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const approve = async (email: QueueEmail) => {
    // Optimistic update - remove immediately
    setEmails(p => p.filter(e => e.id !== email.id))
    setTotal(t => t - 1); onCountChange(total - 1)
    toast({ title: 'Email sent', description: `Sent to ${ef(email).to || ef(email).name}`, duration: 2000 })
    
    // API call in background
    try {
      await api.post(`/api/email-queue/${email.id}/approve`, { agentId: email.agentId }, { params: { agentId: email.agentId } })
    } catch {
      // Silent failure - email already removed from UI
    }
  }

  const reject = async (email: QueueEmail) => {
    // Optimistic update - remove immediately
    setEmails(p => p.filter(e => e.id !== email.id))
    setTotal(t => t - 1); onCountChange(total - 1)
    toast({ title: 'Email rejected', description: ef(email).name || ef(email).to, duration: 2000 })
    
    // API call in background
    try {
      await api.post(`/api/email-queue/${email.id}/reject`, { agentId: email.agentId }, { params: { agentId: email.agentId } })
    } catch {
      // Silent failure - email already removed from UI
    }
  }

  const saveEdit = async (id: string, to: string, cc: string, bcc: string, subject: string, body: string, emailAgentId?: string) => {
    try {
      await api.put(`/api/email-queue/${id}`, { to, cc, bcc, subject, body, agentId: emailAgentId }, { params: { agentId: emailAgentId } })
      setEmails(p => p.map(e => e.id !== id ? e : {
        ...e, to, cc, bcc, subject, body,
        emailData: e.emailData ? { ...e.emailData, finalRecipient: to, cc, bcc, finalSubject: subject, finalBody: body } : undefined,
      }))
      toast({ title: 'Email updated', duration: 2000 })
    } catch { toast({ title: 'Failed to save', variant: 'destructive', duration: 2000 }) }
  }

  const scheduleEmail = async (id: string, scheduledAt: string | null, emailAgentId?: string) => {
    try {
      const response = await api.put(`/api/email-queue/${id}`, { scheduledAt }, { params: { agentId: emailAgentId } })
      
      // Update local state with API response (not just what we sent!)
      setEmails(p => p.map(e => {
        if (e.id !== id) return e
        return { ...e, ...response.data }
      }))
      
      if (scheduledAt) {
        toast({ title: 'Email scheduled', description: new Date(scheduledAt).toLocaleString(), duration: 3000 })
      } else {
        toast({ title: 'Schedule cleared', duration: 2000 })
      }
    } catch (err: any) { 
      toast({ 
        title: 'Failed to update schedule', 
        description: err.response?.data?.error || err.message,
        variant: 'destructive', 
        duration: 4000 
      }) 
    }
  }

  const bulkApprove = async () => {
    const targets = emails.filter(e => selected.has(e.id))
    const targetIds = new Set(targets.map(e => e.id))
    
    // Optimistic update - remove all immediately
    setEmails(p => p.filter(e => !targetIds.has(e.id)))
    setTotal(t => t - targets.length)
    onCountChange(total - targets.length)
    setSelected(new Set())
    toast({ title: `${targets.length} email${targets.length !== 1 ? 's' : ''} sent`, duration: 2000 })
    
    // API calls in background (don't await - fire and forget)
    targets.forEach(email => {
      api.post(`/api/email-queue/${email.id}/approve`, { agentId: email.agentId }, { params: { agentId: email.agentId } })
        .catch(() => {}) // Silent failure
    })
  }

  const bulkReject = async () => {
    const targets = emails.filter(e => selected.has(e.id))
    const targetIds = new Set(targets.map(e => e.id))
    
    // Optimistic update - remove all immediately
    setEmails(p => p.filter(e => !targetIds.has(e.id)))
    setTotal(t => t - targets.length)
    onCountChange(total - targets.length)
    setSelected(new Set())
    toast({ title: `${targets.length} email${targets.length !== 1 ? 's' : ''} rejected`, duration: 2000 })
    
    // API calls in background (don't await - fire and forget)
    targets.forEach(email => {
      api.post(`/api/email-queue/${email.id}/reject`, { agentId: email.agentId }, { params: { agentId: email.agentId } })
        .catch(() => {}) // Silent failure
    })
  }

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border">
        <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
          {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </button>

        {selected.size > 0 && (
          <>
            <div className="w-px h-4 bg-border" />
            <Button size="sm" className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90" onClick={bulkApprove}>
              <CheckCircle2 className="w-3 h-3" /> Send {selected.size}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={bulkReject}>
              <XCircle className="w-3 h-3" /> Reject {selected.size}
            </Button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn('h-7 text-xs gap-1', selected.size > 0 ? 'text-primary' : 'text-muted-foreground')}
            onClick={() => {
              if (selected.size === 0) {
                toast({ title: 'Select emails first', description: 'Check the boxes next to the emails you want to re-edit.', duration: 3000 })
                return
              }
              setShowMassReEdit(true)
            }}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Mass Re-edit{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => load(offset)}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        <input
          className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Search name, company, subject, body…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* pagination + title + font size - top */}
      <div className="grid grid-cols-3 items-center gap-3">
        <PaginationBar offset={offset} limit={LIMIT} total={total} onChange={off => load(off)} />
        <p className="text-center text-[11px] text-muted-foreground">Review, approve, and manage your outreach.</p>
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          <span className="text-[10px] text-muted-foreground">Increase font size</span>
          <button onClick={() => setFontSize(s => Math.max(9, s - 1))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Smaller text">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground w-6 text-center">{fontSize}</span>
          <button onClick={() => setFontSize(s => Math.min(18, s + 1))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Larger text">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3-pane: list / email body / context */}
      {loading ? <Skel /> : filtered.length === 0 ? (
        search ? <Empty icon={Search} text="No results" sub={`No emails match "${search}"`} /> :
        <Empty icon={Inbox} text="No emails queued" sub="Your agents haven't drafted any emails yet." />
      ) : (() => {
        const active = filtered.find(e => e.id === activeId) ?? filtered[0]
        return (
          <div className="@container">
          <div className="grid grid-cols-1 @4xl:grid-cols-[280px_1fr_280px] gap-3">
            <div className="min-w-0 divide-y divide-border max-h-[600px] overflow-y-auto rounded-lg border border-border bg-card p-1">
              {filtered.map(email => (
                <CompactEmailRow
                  key={email.id}
                  email={email}
                  agentMap={agentMap}
                  active={email.id === active.id}
                  selected={selected.has(email.id)}
                  onActivate={() => setActiveId(email.id)}
                  onToggleSelect={() => toggleOne(email.id)}
                />
              ))}
            </div>

            <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <EmailRow
                key={active.id}
                email={active}
                agentMap={agentMap}
                selected={selected.has(active.id)}
                onSelect={toggleOne}
                fontSize={fontSize}
                forceExpanded
                hideSelect
                onEdit={() => setEditTarget(active)}
                onSchedule={() => setScheduleTarget(active)}
                onRebuild={() => setRebuildTarget(active)}
                onViewReport={active.aiReport ? () => setViewingAiReport(active.aiReport!) : undefined}
                onCancelSchedule={active.scheduledAt ? () => scheduleEmail(active.id, null, active.agentId) : undefined}
                onCancelAutoSchedule={autoSendDates.has(active.id) ? async () => {
                  setExcludedAuto(s => { const n = new Set(s); n.add(active.id); return n })
                  toast({ title: 'Removed from auto-schedule', description: ef(active).name || ef(active).to, duration: 2000 })
                  try {
                    await api.put(`/api/email-queue/${active.id}`, { batchExcluded: true }, { params: { agentId: active.agentId } })
                    setEmails(p => p.map(e => e.id === active.id ? { ...e, batchExcluded: true } : e))
                  } catch { /* best-effort */ }
                } : undefined}
                autoScheduleDate={autoSendDates.get(active.id)}
                actions={
                  <>
                    <Button size="sm" className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90" onClick={() => approve(active)}>
                      <CheckCircle2 className="w-3 h-3" /> Send
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => reject(active)}>
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </>
                }
              />
            </div>

            <ContextPane email={active} agentMap={agentMap} />
          </div>
          </div>
        )
      })()}

      {editTarget      && <EditModal    email={editTarget}    onSave={saveEdit}    onClose={() => setEditTarget(null)} />}
      {scheduleTarget  && <ScheduleModal email={scheduleTarget} onSave={scheduleEmail} onClose={() => setScheduleTarget(null)} />}
      {rebuildTarget   && <RebuildModal  email={rebuildTarget}  onSave={saveEdit}    onClose={() => setRebuildTarget(null)} />}
      {showMassReEdit && <MassReEditModal emails={emails.filter(e => selected.has(e.id))} onSave={saveEdit} onClose={() => { setShowMassReEdit(false); load(offset) }} />}
      {viewingAiReport && <AIReportModal report={viewingAiReport} onClose={() => setViewingAiReport(null)} />}
    </div>
  )
}

// ── daily cap widget ──────────────────────────────────────────────────────────
interface CapAccount { email: string; provider: 'gmail' | 'outlook'; isActive: boolean; index: number }
interface CapData {
  accounts: CapAccount[]
  activeAccount: CapAccount | null
  sentToday: number
  perAccountCap: number
  totalCap: number
  remaining: number
  perAccountRemaining: number
}

function DailyCapWidget() {
  const [data, setData] = useState<CapData | null>(null)
  const [open, setOpen]   = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/email-queue/daily-cap-status')
      if (r.data.success) setData(r.data)
    } catch {}
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv) }, [load])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!data) return null

  const near = data.sentToday >= data.perAccountCap * 0.8
  const hit  = data.sentToday >= data.perAccountCap
  const displayEmail = data.activeAccount?.email || 'Mailgun (default)'
  const displayProvider = data.activeAccount?.provider || null
  const hasAccounts = data.accounts.length > 0

  const switchAccount = async (acc: CapAccount) => {
    setSwitching(true)
    try {
      const endpoint = acc.provider === 'gmail'
        ? '/api/auth/gmail/set-active'
        : '/api/auth/outlook/set-active'
      await api.post(endpoint, { accountIndex: acc.index })
      await load()
    } catch {} finally {
      setSwitching(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!hasAccounts}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors',
          hasAccounts ? 'border-border bg-muted/30 hover:bg-muted/60 cursor-pointer' : 'border-border bg-muted/20 cursor-default'
        )}
      >
        <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground truncate max-w-[140px]">
          {displayProvider && <span className="capitalize mr-1">{displayProvider}:</span>}
          {displayEmail}
        </span>
        <ArrowLeftRight className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className={cn('font-semibold tabular-nums shrink-0', hit ? 'text-destructive' : near ? 'text-yellow-500' : 'text-foreground')}>
          {data.sentToday}<span className="font-normal text-muted-foreground">/{data.perAccountCap}</span>
        </span>
        {hasAccounts && <ChevronRight className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', open && 'rotate-90')} />}
      </button>

      {open && hasAccounts && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Switch sending account</p>
          </div>
          <div className="py-1">
            {data.accounts.map((acc) => (
              <button
                key={`${acc.provider}-${acc.index}`}
                disabled={switching}
                onClick={() => switchAccount(acc)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-muted/60',
                  acc.isActive && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  acc.isActive ? 'bg-green-500' : 'bg-muted-foreground/30'
                )} />
                <span className="flex-1 truncate text-foreground">{acc.email}</span>
                <span className="text-[10px] text-muted-foreground capitalize shrink-0">{acc.provider}</span>
                {acc.isActive && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{data.sentToday}/{data.totalCap} total sent today</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
export function EmailQueueContent() {
  const { toast } = useToast()
  const [agents, setAgents]               = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [queuedCount, setQueuedCount]     = useState(0)
  const [fontSize, setFontSize]           = useState(12)
  const [showSchedule, setShowSchedule]   = useState(false)
  const [savedSchedule, setSavedSchedule] = useState<SendingSchedule | null>(null)
  const [showBatchesModal, setShowBatchesModal] = useState(false)
  const [batchCount, setBatchCount]             = useState(0)
  const activeScheduledAgentsCount = agents.filter(a => a.settings?.sendingSchedule?.activeDays?.length).length
  const hasAnyActiveSchedules = activeScheduledAgentsCount > 0
  const hasSelectedAgentSchedule = !!savedSchedule?.activeDays?.length

  const agentMap: Record<string, Agent> = {}
  agents.forEach(a => { agentMap[a.agentId] = a })

  const cancelSchedule = async () => {
    if (selectedAgent === 'all') return
    const agent = agents.find(a => a.agentId === selectedAgent)
    if (!agent) return
    await api.put(`/api/auth/agents/${selectedAgent}/settings`, {
      ...agent.settings,
      sendingSchedule: null,
    }).catch(() => {})
    setSavedSchedule(null)
    toast({ title: 'Sending schedule cancelled', duration: 2000 })
  }

  const refreshBatchCount = useCallback(() => {
    api.get('/api/email-queue/scheduled-batches').then(r => {
      setBatchCount((r.data.batches ?? []).length)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/api/auth/agents').then(r => {
      setAgents(r.data.agents ?? [])

      // Load saved schedule for current agent
      if (selectedAgent !== 'all') {
        const agent = r.data.agents?.find((a: Agent) => a.agentId === selectedAgent)
        if (agent?.settings?.sendingSchedule) {
          setSavedSchedule(agent.settings.sendingSchedule)
        }
      }
    }).catch(() => {})
    refreshBatchCount()
  }, [])
  
  // Load schedule when agent changes
  useEffect(() => {
    if (selectedAgent === 'all') {
      setSavedSchedule(null)
      return
    }
    const agent = agents.find(a => a.agentId === selectedAgent)
    if (agent?.settings?.sendingSchedule) {
      setSavedSchedule(agent.settings.sendingSchedule)
    } else {
      setSavedSchedule(null)
    }
  }, [selectedAgent, agents])

  return (
    <div className="space-y-5">
      {/* queue card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-none">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Inbox className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base text-foreground">Queued Emails</h2>
          {queuedCount > 0 && (
            <span className="px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">{queuedCount}</span>
          )}
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="relative">
              <select
                className="h-7 appearance-none rounded-md border border-input bg-background pl-2 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[130px]"
                value={selectedAgent}
                onChange={e => setSelectedAgent(e.target.value)}
              >
                <option value="all">All Agents</option>
                {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {selectedAgent === 'all' && hasAnyActiveSchedules && (
            <span className="flex items-center gap-1 text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              <Clock className="w-2.5 h-2.5" />
              {queuedCount > 0
                ? `${queuedCount} email${queuedCount !== 1 ? 's' : ''} auto-sending across ${activeScheduledAgentsCount} agent${activeScheduledAgentsCount !== 1 ? 's' : ''}`
                : `Auto-send schedule active across ${activeScheduledAgentsCount} agent${activeScheduledAgentsCount !== 1 ? 's' : ''} - waiting for queued emails`}
            </span>
          )}
          {selectedAgent !== 'all' && hasSelectedAgentSchedule && (
            <span className="flex items-center gap-1 text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              <Clock className="w-2.5 h-2.5" />
              {queuedCount > 0
                ? `${queuedCount} email${queuedCount !== 1 ? 's' : ''} auto-sending`
                : 'Auto-send schedule active'}
              {' '}on {savedSchedule.activeDays.map(d => DAY_LABELS[d]).join(', ')}
              {' '}at {(() => {
                const [h, m] = savedSchedule.sendTime.split(':').map(Number)
                const pm = h >= 12; const h12 = h % 12 || 12
                return `${h12}:${String(m).padStart(2,'0')} ${pm ? 'PM' : 'AM'}`
              })()}
              <button
                onClick={cancelSchedule}
                title="Cancel schedule"
                className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          <DailyCapWidget />
          <div className="ml-auto flex items-center gap-2">
            {batchCount > 0 && (
              <button
                onClick={() => setShowBatchesModal(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ListChecks className="w-3.5 h-3.5" />
                {batchCount} active schedule{batchCount !== 1 ? 's' : ''} planned
              </button>
            )}
            <button
              onClick={() => setShowSchedule(s => !s)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule for Send
            </button>
          </div>
        </div>

        {showSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSchedule(false)}>
            <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <button
                  onClick={() => setShowSchedule(false)}
                  className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                {selectedAgent === 'all' ? (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-semibold">Sending Schedule</h2>
                    </div>
                    <p className="text-xs text-muted-foreground py-2">
                      Select an agent from the dropdown above to configure its sending schedule.
                    </p>
                  </Card>
                ) : (
                  (() => {
                    const agent = agents.find(a => a.agentId === selectedAgent)
                    return agent
                      ? <AgentScheduleCard agent={agent} onSaved={s => { setSavedSchedule(s); refreshBatchCount(); setShowSchedule(false) }} />
                      : null
                  })()
                )}
              </div>
            </div>
          </div>
        )}
        <QueuedList
          agentId={selectedAgent}
          agentMap={agentMap}
          fontSize={fontSize}
          setFontSize={setFontSize}
          onCountChange={setQueuedCount}
          activeSchedule={savedSchedule}
        />
      </div>

      {showBatchesModal && (
        <ScheduledBatchesModal
          onClose={() => setShowBatchesModal(false)}
          onChanged={refreshBatchCount}
        />
      )}
    </div>
  )
}
