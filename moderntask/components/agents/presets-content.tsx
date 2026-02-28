'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, Pencil, Building2, Users, MapPin, Mail,
  Zap, AlertCircle, CheckCircle2, X, ChevronDown, ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── types ────────────────────────────────────────────────────────────────────
interface Preset {
  id: string
  name: string
  targetIndustries?: string[]
  targetPositions?: string[]
  companySizeMin?: number | null
  companySizeMax?: number | null
  leadLimit?: number | null
  emailLength?: string
  callToAction?: string
  personalizationLevel?: string
  ccEmails?: string
  bccEmails?: string
  followupIntervalDays?: number
  enableAutoResponse?: boolean
  useCustomSignature?: boolean
  signatureName?: string
  signatureTitle?: string
  specialInstructions?: string
  createdAt?: string
  updatedAt?: string
}

const EMPTY_FORM: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  targetIndustries: [],
  targetPositions: [],
  companySizeMin: null,
  companySizeMax: null,
  leadLimit: null,
  emailLength: 'medium',
  callToAction: 'schedule-meeting',
  personalizationLevel: 'high',
  ccEmails: '',
  bccEmails: '',
  followupIntervalDays: 7,
  enableAutoResponse: true,
  useCustomSignature: false,
  signatureName: '',
  signatureTitle: '',
  specialInstructions: '',
}

// ── tag input helper ─────────────────────────────────────────────────────────
function TagInput({
  label, values, onChange,
}: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const trimmed = draft.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setDraft('')
  }
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted border border-border">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={`Add ${label.toLowerCase()}…`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={add} type="button">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── form field helpers ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function NumInput({ value, onChange, placeholder }: {
  value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string
}) {
  return (
    <input
      type="number"
      className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ value, onChange, label }: {
  value: boolean; onChange: (v: boolean) => void; label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
          value ? 'translate-x-4' : 'translate-x-0'
        )} />
      </button>
    </div>
  )
}

// ── preset form modal ─────────────────────────────────────────────────────────
function PresetFormModal({
  initial, onSave, onClose, saving,
}: {
  initial: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>
  onSave: (data: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* header */}
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{form.name ? `Edit: ${form.name}` : 'New Preset'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* name */}
          <Field label="Preset Name *">
            <TextInput value={form.name} onChange={v => set('name', v)} placeholder="e.g. SaaS CTOs — Mid-Market" />
          </Field>

          {/* targeting */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Targeting</p>
            <TagInput
              label="Target Positions"
              values={form.targetPositions ?? []}
              onChange={v => set('targetPositions', v)}
            />
            <TagInput
              label="Target Industries"
              values={form.targetIndustries ?? []}
              onChange={v => set('targetIndustries', v)}
            />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Min Company Size">
                <NumInput value={form.companySizeMin} onChange={v => set('companySizeMin', v)} placeholder="1" />
              </Field>
              <Field label="Max Company Size">
                <NumInput value={form.companySizeMax} onChange={v => set('companySizeMax', v)} placeholder="10000" />
              </Field>
              <Field label="Leads per Cycle">
                <NumInput value={form.leadLimit} onChange={v => set('leadLimit', v)} placeholder="50" />
              </Field>
            </div>
          </div>

          {/* email settings */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> Email Settings</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Email Length">
                <Select value={form.emailLength ?? 'medium'} onChange={v => set('emailLength', v)} options={[
                  { value: 'short', label: 'Short' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'long', label: 'Long' },
                ]} />
              </Field>
              <Field label="Call To Action">
                <Select value={form.callToAction ?? 'schedule-meeting'} onChange={v => set('callToAction', v)} options={[
                  { value: 'schedule-meeting', label: 'Schedule Meeting' },
                  { value: 'demo', label: 'Request Demo' },
                  { value: 'reply', label: 'Reply to Learn More' },
                  { value: 'call', label: 'Schedule a Call' },
                  { value: 'other', label: 'Other' },
                ]} />
              </Field>
              <Field label="Personalization">
                <Select value={form.personalizationLevel ?? 'high'} onChange={v => set('personalizationLevel', v)} options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CC Emails">
                <TextInput value={form.ccEmails ?? ''} onChange={v => set('ccEmails', v)} placeholder="cc@company.com" />
              </Field>
              <Field label="BCC Emails">
                <TextInput value={form.bccEmails ?? ''} onChange={v => set('bccEmails', v)} placeholder="bcc@company.com" />
              </Field>
            </div>
            <Field label="Follow-up Interval (days)">
              <NumInput value={form.followupIntervalDays} onChange={v => set('followupIntervalDays', v ?? 7)} placeholder="7" />
            </Field>
            <Toggle value={!!form.enableAutoResponse} onChange={v => set('enableAutoResponse', v)} label="Enable auto-response" />
          </div>

          {/* special instructions */}
          <Field label="Special Instructions">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={3}
              placeholder="Any extra guidance for the agent when using this preset…"
              value={form.specialInstructions ?? ''}
              onChange={e => set('specialInstructions', e.target.value)}
            />
          </Field>

          {/* advanced (signature) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(p => !p)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Custom Signature
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3 pl-3 border-l-2 border-border">
                <Toggle value={!!form.useCustomSignature} onChange={v => set('useCustomSignature', v)} label="Use custom signature" />
                {form.useCustomSignature && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Signature Name">
                      <TextInput value={form.signatureName ?? ''} onChange={v => set('signatureName', v)} placeholder="John Smith" />
                    </Field>
                    <Field label="Signature Title">
                      <TextInput value={form.signatureTitle ?? ''} onChange={v => set('signatureTitle', v)} placeholder="VP of Sales" />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            size="sm"
            disabled={saving || !form.name.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? 'Saving…' : 'Save Preset'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── preset card ───────────────────────────────────────────────────────────────
function PresetCard({
  preset, onEdit, onDelete,
}: { preset: Preset; onEdit: () => void; onDelete: () => void }) {
  const industries = preset.targetIndustries ?? []
  const positions  = preset.targetPositions  ?? []
  const tags       = [...industries.slice(0, 3), ...positions.slice(0, 3)]

  return (
    <Card className="p-5 space-y-3 hover:shadow-md transition-shadow">
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{preset.name}</h3>
          {preset.createdAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Created {new Date(preset.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
          ))}
        </div>
      )}

      {/* meta pills */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        {preset.leadLimit && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="w-3 h-3 text-primary" />
            {preset.leadLimit} leads
          </div>
        )}
        {(preset.companySizeMin || preset.companySizeMax) && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Building2 className="w-3 h-3" />
            {preset.companySizeMin ?? '?'}–{preset.companySizeMax ?? '∞'}
          </div>
        )}
        {preset.emailLength && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Mail className="w-3 h-3" />
            {preset.emailLength} email
          </div>
        )}
      </div>

      {/* instructions */}
      {preset.specialInstructions && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2 line-clamp-2">
          {preset.specialInstructions}
        </p>
      )}
    </Card>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
export function PresetsContent() {
  const [presets, setPresets]     = useState<Preset[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Preset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null)
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/settings/presets')
      setPresets(res.data.presets ?? [])
    } catch { showToast('Failed to load presets', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (form: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true)
    try {
      if (editing) {
        const res = await api.put(`/api/settings/presets/${editing.id}`, form)
        setPresets(prev => prev.map(p => p.id === editing.id ? res.data.preset : p))
        showToast('Preset updated')
      } else {
        const res = await api.post('/api/settings/presets', form)
        setPresets(prev => [...prev, res.data.preset])
        showToast('Preset created')
      }
      setModalOpen(false)
      setEditing(null)
    } catch { showToast('Failed to save preset', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/settings/presets/${deleteTarget.id}`)
      setPresets(prev => prev.filter(p => p.id !== deleteTarget.id))
      showToast('Preset deleted')
    } catch { showToast('Failed to delete preset', 'error') }
    finally { setDeleteTarget(null) }
  }

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit   = (p: Preset) => { setEditing(p); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const formInitial = editing
    ? { ...EMPTY_FORM, ...editing }
    : EMPTY_FORM

  return (
    <div className="space-y-5">
      {/* toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border',
          toast.type === 'success'
            ? 'bg-green-500/15 border-green-500/30 text-green-400'
            : 'bg-destructive/15 border-destructive/30 text-destructive'
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="text-xs text-muted-foreground">This cannot be undone. Agents using this preset will keep their current settings.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </Card>
        </div>
      )}

      {/* modal */}
      {modalOpen && (
        <PresetFormModal
          initial={formInitial}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
        />
      )}

      {/* toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {loading ? 'Loading…' : `${presets.length} Preset${presets.length !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-muted-foreground">Reusable targeting &amp; email configs you can apply when creating agents</p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" /> New Preset
        </Button>
      </div>

      {/* grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 h-40 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <Card className="p-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Zap className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">No presets yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs">Create a preset to save your targeting criteria and email settings for quick reuse when spinning up agents.</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Create First Preset
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {presets.map(p => (
            <PresetCard
              key={p.id}
              preset={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
