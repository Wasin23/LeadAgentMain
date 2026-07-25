'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, Pencil, Building2, Users, MapPin, Mail,
  Zap, X, Send, MessageSquare, Wand2, Copy, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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
  writingRules?: string
  includeChatLink?: boolean
  chatLinkInstructions?: string
  templates?: Array<{ id: string; name: string; subject: string; body: string }>
  createdAt?: string
  updatedAt?: string
}

interface AgentLite { agentId: string; name: string }

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
  useCustomSignature: true,
  signatureName: '',
  signatureTitle: '',
  specialInstructions: '',
  writingRules: '',
  includeChatLink: false,
  chatLinkInstructions: '',
  templates: [],
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

function PillSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex gap-1 bg-muted rounded-md p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 px-2 py-1 rounded text-[11px] font-medium transition-all',
            value === o.value ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        className="w-full h-8 appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
    </div>
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

// ── inline preset editor panel (was a modal - now always visible, per the new layout) ──
function PresetEditorPanel({
  form, setForm, onSave, onCancel, saving, isNew,
}: {
  form: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>
  setForm: (f: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm({ ...form, [k]: v })
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const generatePreview = async () => {
    setPreviewing(true)
    setPreviewError(null)
    try {
      const res = await api.post('/api/lead-agent/test-email', {
        emailSettings: {
          emailLength: form.emailLength,
          callToAction: form.callToAction,
          personalizationLevel: form.personalizationLevel,
          ccEmails: form.ccEmails,
          bccEmails: form.bccEmails,
          useCustomSignature: form.useCustomSignature,
          signatureName: form.signatureName,
          signatureTitle: form.signatureTitle,
          customPrompt: form.writingRules,
          includeChatLink: form.includeChatLink,
          chatLinkInstructions: form.chatLinkInstructions,
        },
      })
      if (res.data?.success) setPreview({ subject: res.data.subject, body: res.data.body })
      else setPreviewError('Could not generate a preview.')
    } catch {
      setPreviewError('Save the preset first for the most accurate preview.')
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground">{isNew ? 'New Preset' : `Edit: ${form.name || 'Preset'}`}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure reusable outreach messaging styles and behaviour.</p>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Field label="Preset Name *">
        <TextInput value={form.name} onChange={v => set('name', v)} placeholder="e.g. SaaS CTOs - Mid-Market" />
      </Field>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Targeting</p>
        <TagInput label="Target Positions" values={form.targetPositions ?? []} onChange={v => set('targetPositions', v)} />
        <TagInput label="Target Industries" values={form.targetIndustries ?? []} onChange={v => set('targetIndustries', v)} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min Company Size"><NumInput value={form.companySizeMin} onChange={v => set('companySizeMin', v)} placeholder="1" /></Field>
          <Field label="Max Company Size"><NumInput value={form.companySizeMax} onChange={v => set('companySizeMax', v)} placeholder="10000" /></Field>
          <Field label="Leads per Cycle"><NumInput value={form.leadLimit} onChange={v => set('leadLimit', v)} placeholder="50" /></Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> Email Settings</p>
        <Field label="Email Length">
          <PillSelect value={form.emailLength ?? 'medium'} onChange={v => set('emailLength', v)} options={[
            { value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' },
          ]} />
        </Field>
        <Field label="Call to Action">
          <Select value={form.callToAction ?? 'schedule-meeting'} onChange={v => set('callToAction', v)} options={[
            { value: 'schedule-meeting', label: 'Schedule Meeting' },
            { value: 'demo', label: 'Request Demo' },
            { value: 'reply', label: 'Reply to Learn More' },
            { value: 'call', label: 'Schedule a Call' },
            { value: 'other', label: 'Other' },
          ]} />
        </Field>
        <Field label="Personalization">
          <PillSelect value={form.personalizationLevel ?? 'high'} onChange={v => set('personalizationLevel', v)} options={[
            { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
          ]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CC Emails"><TextInput value={form.ccEmails ?? ''} onChange={v => set('ccEmails', v)} placeholder="cc@company.com" /></Field>
          <Field label="BCC Emails"><TextInput value={form.bccEmails ?? ''} onChange={v => set('bccEmails', v)} placeholder="bcc@company.com" /></Field>
        </div>
        <Field label="Follow-up Interval (days)">
          <NumInput value={form.followupIntervalDays} onChange={v => set('followupIntervalDays', v ?? 7)} placeholder="7" />
        </Field>
      </div>

      <Field label="Extra Instructions">
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          rows={3} maxLength={500}
          placeholder="e.g. Always open with a specific observation about the company. Never use the word 'synergy'. End with a single low-friction ask."
          value={form.specialInstructions ?? ''}
          onChange={e => set('specialInstructions', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground text-right">{(form.specialInstructions ?? '').length}/500</p>
      </Field>

      <Field label="Writing Rules">
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
          rows={3}
          placeholder="e.g. Keep emails under 100 words. Never use 'synergy'. End with a single low-friction ask."
          value={form.writingRules ?? ''}
          onChange={e => set('writingRules', e.target.value)}
        />
      </Field>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <Toggle value={!!form.useCustomSignature} onChange={v => set('useCustomSignature', v)} label="Auto-sign emails" />
        {form.useCustomSignature && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Signature Name"><TextInput value={form.signatureName ?? ''} onChange={v => set('signatureName', v)} placeholder="John Smith" /></Field>
            <Field label="Signature Title"><TextInput value={form.signatureTitle ?? ''} onChange={v => set('signatureTitle', v)} placeholder="VP of Sales" /></Field>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <Toggle value={!!form.includeChatLink} onChange={v => set('includeChatLink', v)} label="Include Chat Link" />
        <p className="text-[11px] text-muted-foreground">Inserts a personalized chat link into the email so leads can start a live conversation.</p>
        {form.includeChatLink && (
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={2} maxLength={200}
            placeholder="Want to ask me anything directly? I'm available now:"
            value={form.chatLinkInstructions ?? ''}
            onChange={e => set('chatLinkInstructions', e.target.value)}
          />
        )}
      </div>

      <div className="space-y-2">
        <button onClick={generatePreview} disabled={previewing} className="inline-flex items-center gap-1.5 text-xs font-semibold text-success disabled:opacity-50">
          <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {previewing ? 'Generating…' : 'Generate Preview'}
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">· save first for most accurate results</span>
        </button>
        {preview || previewError ? (
          <div className="rounded-xl border border-border bg-surface/60 p-4 min-h-24">
            {previewError ? (
              <p className="text-xs text-destructive">{previewError}</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold">{preview!.subject}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">{preview!.body}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-8 text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-muted">
              <Send className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">No preview yet</div>
            <div className="text-[11px] text-muted-foreground">Click Generate Preview to see a sample email</div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        {!isNew && <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>}
        <Button size="sm" disabled={saving || !form.name.trim()} onClick={onSave}>
          {saving ? 'Saving…' : 'Save Preset'}
        </Button>
      </div>
    </div>
  )
}

// ── apply-to-agent picker ────────────────────────────────────────────────────
function ApplyPicker({ agents, onApply, onClose }: { agents: AgentLite[]; onApply: (agentId: string) => void; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-8 z-20 w-56 rounded-md border border-border bg-popover shadow-lg py-1">
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">Apply to agent</p>
      {agents.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No agents yet</p>
      ) : agents.map(a => (
        <button key={a.agentId} onClick={() => onApply(a.agentId)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">
          {a.name}
        </button>
      ))}
      <button onClick={onClose} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted border-t border-border">
        Cancel
      </button>
    </div>
  )
}

// ── preset card ───────────────────────────────────────────────────────────────
function PresetCard({
  preset, selected, onSelect, onDelete, onDuplicate, agents, onApply,
}: { preset: Preset; selected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; agents: AgentLite[]; onApply: (agentId: string) => void }) {
  const industries = preset.targetIndustries ?? []
  const positions  = preset.targetPositions  ?? []
  const tags       = [...industries.slice(0, 3), ...positions.slice(0, 3)]
  const [showApply, setShowApply] = useState(false)

  return (
    <div className={cn('rounded-xl border border-border bg-card p-3 space-y-2 transition-colors cursor-pointer hover:border-foreground/15', selected && 'border-primary ring-1 ring-primary/30')} onClick={onSelect}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-foreground truncate">{preset.name}</h3>
          {preset.createdAt && (
            <p className="text-[10px] text-muted-foreground">Created {new Date(preset.createdAt).toLocaleDateString()}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <div className="relative">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => setShowApply(v => !v)}>Apply</Button>
            {showApply && <ApplyPicker agents={agents} onApply={(id) => { onApply(id); setShowApply(false) }} onClose={() => setShowApply(false)} />}
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onSelect}><Pencil className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onDuplicate}><Copy className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>)}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {preset.leadLimit && <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5 text-primary" />{preset.leadLimit} leads</span>}
        {preset.emailLength && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{preset.emailLength}</span>}
        {preset.includeChatLink && <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />chat link</span>}
      </div>
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
export function PresetsContent() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [agents, setAgents] = useState<AgentLite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const { toast } = useToast()

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    toast({ title: msg, variant: type === 'error' ? 'destructive' : 'default', duration: 2500 })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [presetsRes, agentsRes] = await Promise.allSettled([
        api.get('/api/settings/presets'),
        api.get('/api/auth/agents'),
      ])
      if (presetsRes.status === 'fulfilled') setPresets(presetsRes.value.data.presets ?? [])
      if (agentsRes.status === 'fulfilled') {
        setAgents((agentsRes.value.data?.agents ?? []).filter((a: any) => a.agentId !== 'orphan').map((a: any) => ({ agentId: a.agentId, name: a.name })))
      }
    } catch { showToast('Failed to load presets', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const res = await api.put(`/api/settings/presets/${editingId}`, form)
        setPresets(prev => prev.map(p => p.id === editingId ? res.data.preset : p))
        showToast('Preset updated')
      } else {
        const res = await api.post('/api/settings/presets', form)
        setPresets(prev => [...prev, res.data.preset])
        setEditingId(res.data.preset.id)
        showToast('Preset created')
      }
    } catch { showToast('Failed to save preset', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/settings/presets/${deleteTarget.id}`)
      setPresets(prev => prev.filter(p => p.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) { setEditingId(null); setForm(EMPTY_FORM) }
      showToast('Preset deleted')
    } catch { showToast('Failed to delete preset', 'error') }
    finally { setDeleteTarget(null) }
  }

  const selectPreset = (p: Preset) => { setEditingId(p.id); setForm({ ...EMPTY_FORM, ...p }); setShowEditor(true) }
  const startNew = () => { setEditingId(null); setForm(EMPTY_FORM); setShowEditor(true) }
  const closeEditor = () => setShowEditor(false)

  const handleDuplicate = async (p: Preset) => {
    try {
      const { id, createdAt, updatedAt, ...fields } = p
      const res = await api.post('/api/settings/presets', { ...fields, name: `${p.name} (copy)` })
      setPresets(prev => [...prev, res.data.preset])
      showToast(`Duplicated "${p.name}"`)
    } catch { showToast('Failed to duplicate preset', 'error') }
  }

  const applyPresetToAgent = async (preset: Preset, agentId: string) => {
    try {
      const currentRes = await api.get(`/api/lead-agent/settings?agentId=${agentId}`)
      const current = currentRes.data?.settings || {}
      const payload = {
        ...current,
        agentId,
        companyCriteria: { ...(current.companyCriteria || {}), companyIndustries: preset.targetIndustries ?? current.companyCriteria?.companyIndustries },
        contactCriteria: { ...(current.contactCriteria || {}), targetPositions: preset.targetPositions ?? current.contactCriteria?.targetPositions },
        geographicSettings: { ...(current.geographicSettings || {}), leadLimit: preset.leadLimit ?? current.geographicSettings?.leadLimit },
        targeting: { ...(current.targeting || {}), leadLimit: preset.leadLimit ?? current.targeting?.leadLimit },
        emailBuilder: {
          ...(current.emailBuilder || {}),
          emailLength: preset.emailLength,
          callToAction: preset.callToAction,
          personalizationLevel: preset.personalizationLevel,
          ccEmails: preset.ccEmails,
          bccEmails: preset.bccEmails,
          useCustomSignature: preset.useCustomSignature,
          signatureName: preset.signatureName,
          signatureTitle: preset.signatureTitle,
          customPrompt: preset.writingRules,
          includeChatLink: preset.includeChatLink,
          chatLinkInstructions: preset.chatLinkInstructions,
        },
        followUpSettings: { ...(current.followUpSettings || {}), intervalDays: preset.followupIntervalDays },
        specialInstructions: preset.specialInstructions || current.specialInstructions,
      }
      await api.post('/api/lead-agent/settings', payload)
      showToast(`Applied "${preset.name}" to agent`)
    } catch {
      showToast('Failed to apply preset', 'error')
    }
  }

  return (
    <div className="space-y-5">
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-modal-swoop-backdrop">
          <Card className="p-6 w-full max-w-sm space-y-4 animate-modal-swoop-up">
            <h3 className="text-sm font-semibold">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="text-xs text-muted-foreground">This cannot be undone. Agents already using this preset keep their current settings.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xl text-foreground">{loading ? 'Loading…' : `${presets.length} Preset${presets.length !== 1 ? 's' : ''}`}</p>
          <p className="text-xs text-muted-foreground">Reusable targeting &amp; email configs - apply to any agent</p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={startNew}><Plus className="w-3.5 h-3.5" /> New Preset</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 items-start">
        <div className="min-w-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-xl border border-border bg-card p-3 h-20 animate-pulse" />)}
            </div>
          ) : presets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-16 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center"><Zap className="w-6 h-6 text-muted-foreground" /></div>
              <div>
                <h3 className="text-sm font-semibold mb-1">No presets yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs">Create a preset to save targeting and email settings for quick reuse across agents.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {presets.map(p => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  selected={editingId === p.id}
                  onSelect={() => selectPreset(p)}
                  onDelete={() => setDeleteTarget(p)}
                  onDuplicate={() => handleDuplicate(p)}
                  agents={agents}
                  onApply={(agentId) => applyPresetToAgent(p, agentId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-modal-swoop-backdrop" onClick={closeEditor}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-swoop-up" onClick={e => e.stopPropagation()}>
            <PresetEditorPanel
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={closeEditor}
              saving={saving}
              isNew={!editingId}
            />
          </div>
        </div>
      )}
    </div>
  )
}
