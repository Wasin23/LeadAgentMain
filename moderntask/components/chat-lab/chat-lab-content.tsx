'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, Trash2, Edit2, FileText, Check,
  MessageSquare, History, Sparkles, Save,
  ExternalLink, FlaskConical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType = 'case-study' | 'pricing' | 'objection-handler' | 'battle-card' | 'faq' | 'process' | 'general'
type Personality = 'HUNTER' | 'RELATIONSHIP' | 'ANALYST' | 'CONSULTANT' | 'NETWORKER'

interface KnowledgeDoc {
  docId:      string
  source:     string
  type:       DocType
  chunkCount: number
  editing:    boolean
}

interface ResearchSnapshot {
  buyerMotivation?:   string
  emailHooks?:        string[]
  tier?:              string
  score?:             number
  citedFacts?:        { fact: string; source: string }[]
  specificInsights?:  any[]
  originalEmail?:     string
  companyBranding?:   { name?: string; description?: string; offering?: string; advantages?: string; website?: string }
}

interface ChatSession {
  sessionId:        string
  leadName:         string
  leadCompany:      string
  messageCount:     number
  intentScore:      number
  createdAt:        string
  status:           'active' | 'ended'
  researchSnapshot?: ResearchSnapshot
}

interface PromptVersion {
  version:    number
  promptText: string
  createdAt:  string
}

interface Agent {
  agentId: string
  name:    string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPE_META: Record<DocType, { label: string; color: string }> = {
  'case-study':        { label: 'Case Study',        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  'pricing':           { label: 'Pricing',           color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  'objection-handler': { label: 'Objection Handler', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  'battle-card':       { label: 'Battle Card',       color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  'faq':               { label: 'FAQ',               color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  'process':           { label: 'Process',           color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  'general':           { label: 'General',           color: 'bg-muted text-muted-foreground' },
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI sales representative. You are having a live conversation with {lead_name} from {lead_company}.

You have been given:
- Full research on this lead and their company
- The original email that brought them here
- Your company's knowledge base (case studies, pricing, FAQs, objection handlers)
- Prior conversation history if any

Your job:
- Answer questions accurately using the knowledge base — never fabricate details
- Reference the lead's specific situation naturally
- Handle objections with empathy first, then evidence
- Suggest next steps proactively
- If the lead is ready to move forward, offer to book a meeting

Tone: {personality_tone}

If you don't know something, say so and offer to follow up.`

const CONTEXT_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-sky-400', 'bg-teal-500', 'bg-amber-500']

// ── Helpers ───────────────────────────────────────────────────────────────────

function intentBadge(score: number) {
  if (score >= 7) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (score >= 4) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function DocTypeBadge({ type }: { type: DocType }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.color}`}>
      {meta.label}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ChatLabContent() {
  const [agents, setAgents]           = useState<Agent[]>([])
  const [agentId, setAgentId]         = useState<string>('')

  // Knowledge
  const [docs, setDocs]               = useState<KnowledgeDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [dragging, setDragging]       = useState(false)
  const [uploading, setUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prompt
  const [systemPrompt, setSystemPrompt]   = useState(DEFAULT_SYSTEM_PROMPT)
  const [promptSaved, setPromptSaved]     = useState(true)
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])
  const [promptLoading, setPromptLoading] = useState(false)

  // Sessions
  const [sessions, setSessions]           = useState<ChatSession[]>([])
  const [totalSessions, setTotalSessions] = useState<number | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // Selected session for Memory tab
  const [activeTab, setActiveTab]               = useState('knowledge')
  const [selectedSession, setSelectedSession]   = useState<ChatSession | null>(null)
  const [sessionMessages, setSessionMessages]   = useState<{ role: string; content: string }[]>([])
  const [sessionLoading, setSessionLoading]     = useState(false)
  const [sessionContext, setSessionContext]     = useState<{
    session:    any
    leadData:   any
    emailData:  any
    promptData: any
    docs:       any[]
  } | null>(null)

  // Snapshot editing
  const [editingSnap, setEditingSnap] = useState(false)
  const [snapDraft, setSnapDraft]     = useState({ companyName: '', companyOffering: '', companyAdvantages: '', buyerMotivation: '', emailHooksText: '', citedFactsText: '', originalEmail: '' })
  const [snapSaving, setSnapSaving]   = useState(false)

  // ── Load agents on mount ───────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/auth/agents').then(r => {
      const list: Agent[] = (r.data?.agents ?? [])
        .filter((a: any) => a.agentId !== 'orphan')
        .map((a: any) => ({ agentId: a.agentId, name: a.name || 'Agent' }))
      setAgents(list)
      if (list.length > 0) setAgentId(list[0].agentId)
    }).catch(() => {})
  }, [])

  // ── Load data when agentId changes ────────────────────────────────────────
  useEffect(() => {
    if (!agentId) return
    fetchDocs()
    fetchPrompt()
    fetchSessions()
    fetchSessionCount()
  }, [agentId])

  const fetchDocs = useCallback(async () => {
    if (!agentId) return
    setDocsLoading(true)
    try {
      const r = await api.get('/api/chat-lab/docs', { params: { agentId } })
      setDocs((r.data?.docs ?? []).map((d: any) => ({ ...d, editing: false })))
    } catch { /* silent */ }
    finally { setDocsLoading(false) }
  }, [agentId])

  const fetchPrompt = useCallback(async () => {
    if (!agentId) return
    setPromptLoading(true)
    try {
      const [promptRes, versionsRes] = await Promise.all([
        api.get('/api/chat-lab/prompt', { params: { agentId } }),
        api.get('/api/chat-lab/prompt/versions', { params: { agentId } }),
      ])
      if (promptRes.data?.prompt?.promptText) {
        setSystemPrompt(promptRes.data.prompt.promptText)
        setPromptSaved(true)
      }
      setPromptVersions(versionsRes.data?.versions ?? [])
    } catch { /* silent */ }
    finally { setPromptLoading(false) }
  }, [agentId])

  const fetchSessions = useCallback(async () => {
    if (!agentId) return
    setSessionsLoading(true)
    try {
      const r = await api.get('/api/chat-lab/sessions', { params: { agentId, limit: 50 } })
      setSessions(r.data?.sessions ?? [])
    } catch { /* silent */ }
    finally { setSessionsLoading(false) }
  }, [agentId])

  const fetchSessionCount = useCallback(async () => {
    try {
      const r = await api.get('/api/chat-lab/sessions/count')
      setTotalSessions(r.data?.count ?? 0)
    } catch { /* silent */ }
  }, [])

  const startEditSnap = (snap: ResearchSnapshot) => {
    const cb = snap.companyBranding || {}
    setSnapDraft({
      companyName:      cb.name           || '',
      companyOffering:  cb.offering       || '',
      companyAdvantages: cb.advantages    || '',
      buyerMotivation:  snap.buyerMotivation || '',
      emailHooksText:   (snap.emailHooks  || []).join('\n'),
      citedFactsText:   (snap.citedFacts  || []).map((f: any) => f.source ? `${f.fact} — ${f.source}` : f.fact).join('\n'),
      originalEmail:    snap.originalEmail || '',
    })
    setEditingSnap(true)
  }

  const saveSnapshot = async () => {
    if (!selectedSession || !sessionContext) return
    setSnapSaving(true)
    const original = sessionContext.session?.researchSnapshot || {}
    const updated: ResearchSnapshot = {
      ...original,
      companyBranding: { ...original.companyBranding, name: snapDraft.companyName, offering: snapDraft.companyOffering, advantages: snapDraft.companyAdvantages },
      buyerMotivation: snapDraft.buyerMotivation,
      emailHooks: snapDraft.emailHooksText.split('\n').map((s: string) => s.trim()).filter(Boolean),
      citedFacts: snapDraft.citedFactsText.split('\n').map((line: string) => {
        const idx = line.indexOf(' — ')
        if (idx === -1) return { fact: line.trim(), source: '' }
        return { fact: line.slice(0, idx).trim(), source: line.slice(idx + 3).trim() }
      }).filter((f: any) => f.fact),
      originalEmail: snapDraft.originalEmail,
    }
    try {
      await api.patch(`/api/chat-lab/sessions/${selectedSession.sessionId}/snapshot`, {
        createdAt: selectedSession.createdAt,
        researchSnapshot: updated,
      })
      setSessionContext(prev => prev ? { ...prev, session: { ...prev.session, researchSnapshot: updated } } : null)
      setEditingSnap(false)
    } catch (err) {
      console.error('Failed to save snapshot:', err)
    } finally {
      setSnapSaving(false)
    }
  }

  const openSessionMemory = useCallback(async (session: ChatSession) => {
    if (selectedSession?.sessionId === session.sessionId) {
      setSelectedSession(null)
      setSessionMessages([])
      setEditingSnap(false)
      return
    }
    setSelectedSession(session)
    setSessionContext(null)
    setSessionMessages([])
    setEditingSnap(false)
    setActiveTab('sessions')
    setSessionLoading(true)
    try {
      const r = await api.get(`/api/chat-lab/sessions/${session.sessionId}/context`, {
        params: { createdAt: session.createdAt },
      })
      setSessionMessages(r.data?.session?.messages ?? [])
      setSessionContext({
        session:    r.data?.session    ?? null,
        leadData:   r.data?.leadData   ?? null,
        emailData:  r.data?.emailData  ?? null,
        promptData: r.data?.promptData ?? null,
        docs:       r.data?.docs       ?? [],
      })
      // If the server backfilled a real name, update the sessions list in place
      const resolvedName = r.data?.session?.leadName
      if (resolvedName && resolvedName !== 'Lead' && resolvedName !== 'Guest') {
        setSessions(prev => prev.map(s => s.sessionId === session.sessionId ? { ...s, leadName: resolvedName } : s))
        setSelectedSession(prev => prev ? { ...prev, leadName: resolvedName } : null)
      }
    } catch { setSessionMessages([]) }
    finally { setSessionLoading(false) }
  }, [selectedSession])

  // ── Doc upload ─────────────────────────────────────────────────────────────
  const uploadFiles = async (files: File[]) => {
    if (!agentId || !files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('agentId', agentId)
        fd.append('type', 'general')
        await api.post('/api/chat-lab/docs', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      await fetchDocs()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  const deleteDoc = async (docId: string) => {
    await api.delete(`/api/chat-lab/docs/${docId}`, { params: { agentId } })
    setDocs(prev => prev.filter(d => d.docId !== docId))
  }

  const updateDocType = async (docId: string, type: DocType) => {
    await api.patch(`/api/chat-lab/docs/${docId}/type`, { type })
    setDocs(prev => prev.map(d => d.docId === docId ? { ...d, type } : d))
  }

  const toggleEdit = (docId: string) =>
    setDocs(prev => prev.map(d => d.docId === docId ? { ...d, editing: !d.editing } : d))

  // ── Save prompt ────────────────────────────────────────────────────────────
  const savePrompt = async () => {
    if (!agentId) return
    try {
      await api.post('/api/chat-lab/prompt', { agentId, promptText: systemPrompt })
      setPromptSaved(true)
      await fetchPrompt()
    } catch (err) {
      console.error('Save prompt failed:', err)
    }
  }

  const maxTokens = 8000
  const historyTokens = sessionMessages.reduce((s, m) => s + Math.ceil((m.content?.length || 0) / 4), 0)
  const contextBlocks = [
    { label: 'System prompt',        tokens: Math.ceil(systemPrompt.length / 4),                                                   color: CONTEXT_COLORS[0] },
    { label: 'Lead research profile',tokens: selectedSession ? 180 : 0,                                                             color: CONTEXT_COLORS[1] },
    { label: 'Original email',       tokens: selectedSession ? 220 : 0,                                                             color: CONTEXT_COLORS[2] },
    { label: 'RAG chunks (top-4)',   tokens: docs.length > 0 ? Math.min(docs.reduce((s,d) => s + d.chunkCount, 0), 4) * 380 : 0,   color: CONTEXT_COLORS[3] },
    { label: 'Conversation history', tokens: historyTokens,                                                                         color: CONTEXT_COLORS[4] },
  ]
  const totalTokens = contextBlocks.reduce((s, b) => s + b.tokens, 0)

  const previewUrl = agentId
    ? `/meet/preview?agentId=${agentId}`
    : '/meet/preview'

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Top bar: agent selector + stats + preview button ─────────────── */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="w-52">
          <Select value={agentId} onValueChange={setAgentId} disabled={agents.length === 0}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={agents.length === 0 ? 'No agents yet' : 'Select agent'} />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.agentId} value={a.agentId} className="text-xs">{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageSquare className="w-3.5 h-3.5" />
          {totalSessions === null
            ? <span>Loading...</span>
            : <span><span className="font-semibold text-foreground">{totalSessions}</span> total sessions</span>
          }
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          <span>
            <span className="font-semibold text-foreground">{docs.length}</span> docs ·{' '}
            <span className="font-semibold text-foreground">{docs.reduce((s, d) => s + d.chunkCount, 0)}</span> chunks
          </span>
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => window.open(previewUrl, '_blank')}
            disabled={!agentId}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Preview Chat
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
          </Button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-full grid grid-cols-3 h-9">
          <TabsTrigger value="knowledge" className="text-xs gap-1.5"><FileText className="w-3 h-3" />Knowledge</TabsTrigger>
          <TabsTrigger value="prompt"    className="text-xs gap-1.5"><Sparkles className="w-3 h-3" />Prompt</TabsTrigger>
          <TabsTrigger value="sessions"  className="text-xs gap-1.5"><History className="w-3 h-3" />Sessions</TabsTrigger>
        </TabsList>

        {/* ── Knowledge ── */}
        <TabsContent value="knowledge" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors shrink-0 ${
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
            } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={e => e.target.files && uploadFiles(Array.from(e.target.files))}
            />
            <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-sm font-medium">{uploading ? 'Uploading...' : 'Drop files or click to upload'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, TXT, MD — chunked & embedded automatically</p>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-1">
              {docsLoading && [0,1,2].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}

              {!docsLoading && docs.map(doc => (
                <div key={doc.docId} className="border border-border rounded-xl p-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.source}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <DocTypeBadge type={doc.type} />
                          <span className="text-[10px] text-muted-foreground">{doc.chunkCount} chunks</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleEdit(doc.docId)} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
                        {doc.editing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deleteDoc(doc.docId)} className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {doc.editing && (
                    <div className="mt-2.5 pt-2.5 border-t border-border">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Document Type</Label>
                      <Select value={doc.type} onValueChange={v => updateDocType(doc.docId, v as DocType)}>
                        <SelectTrigger className="h-7 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DOC_TYPE_META) as DocType[]).map(t => (
                            <SelectItem key={t} value={t} className="text-xs">{DOC_TYPE_META[t].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}

              {!docsLoading && docs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No documents yet. Upload your first file to power the chat AI.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Prompt ── */}
        <TabsContent value="prompt" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">System Prompt</Label>
              {!promptSaved && (
                <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">unsaved</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {promptVersions.length > 0 && (
                <Select
                  defaultValue={String(promptVersions[0]?.version)}
                  onValueChange={v => {
                    const found = promptVersions.find(p => String(p.version) === v)
                    if (found) { setSystemPrompt(found.promptText); setPromptSaved(true) }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {promptVersions.map((p, i) => (
                      <SelectItem key={p.version} value={String(p.version)} className="text-xs">
                        v{p.version}{i === 0 ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={savePrompt} disabled={promptSaved || !agentId}>
                <Save className="w-3 h-3" /> Save
              </Button>
            </div>
          </div>

          {promptLoading
            ? <Skeleton className="flex-1 rounded-xl" />
            : (
              <Textarea
                value={systemPrompt}
                onChange={e => { setSystemPrompt(e.target.value); setPromptSaved(false) }}
                className="flex-1 min-h-0 text-xs font-mono resize-none leading-relaxed"
                placeholder="Enter your system prompt..."
                disabled={!agentId}
              />
            )
          }

          <div className="shrink-0 p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Available variables</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {['{lead_name}', '{lead_company}', '{lead_title}', '{company_name}', '{personality_tone}', '{original_email}'].map(v => (
                <code key={v} className="text-primary">{v}</code>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Sessions ── */}
        <TabsContent value="sessions" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
          <div className="flex items-center justify-between shrink-0">
            <Label className="text-sm font-medium">Lead Sessions</Label>
            {totalSessions !== null && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                <span><span className="font-semibold text-foreground">{totalSessions}</span> total in DB</span>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-1">
              {sessionsLoading && [0,1,2].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}

              {!sessionsLoading && sessions.map(s => (
                <div key={s.sessionId}>
                  <div onClick={() => openSessionMemory(s)} className={`border rounded-xl p-3 bg-card hover:bg-muted/40 transition-colors cursor-pointer ${selectedSession?.sessionId === s.sessionId ? 'border-primary' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{(s.leadName && s.leadName !== 'Lead' && s.leadName !== 'Guest') ? s.leadName : 'Unknown'}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${intentBadge(s.intentScore)}`}>
                            Intent {s.intentScore}/10
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.leadCompany}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{relativeTime(s.createdAt)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.messageCount} messages</p>
                      </div>
                    </div>
                  </div>

                  {selectedSession?.sessionId === s.sessionId && (
                    <div className="border border-t-0 border-primary rounded-b-xl bg-muted/20 px-3 pb-3">
                      {sessionLoading ? (
                        <div className="py-4 space-y-2">
                          <Skeleton className="h-8 w-3/4 rounded-lg" />
                          <Skeleton className="h-8 w-1/2 rounded-lg" />
                        </div>
                      ) : (
                        <div className="pt-3 space-y-3">

                          {/* Conversation */}
                          {sessionMessages.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">No messages yet</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sessionMessages.map((m, i) => (
                                <div key={i} className={`flex gap-2 ${m.role !== 'user' ? '' : 'flex-row-reverse'}`}>
                                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                                    m.role !== 'user'
                                      ? 'bg-card border border-border text-foreground'
                                      : 'bg-primary text-primary-foreground ml-auto'
                                  }`}>{m.content}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Research context the AI has */}
                          {sessionContext?.session?.researchSnapshot && (() => {
                            const snap: ResearchSnapshot = sessionContext.session.researchSnapshot
                            const cb = snap.companyBranding || {}
                            return (
                              <div className="border-t border-border pt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">What the AI knows</p>
                                  {editingSnap ? (
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => setEditingSnap(false)} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded">Cancel</button>
                                      <button onClick={saveSnapshot} disabled={snapSaving} className="text-[10px] font-medium text-white bg-primary hover:opacity-90 disabled:opacity-50 px-2 py-0.5 rounded">
                                        {snapSaving ? 'Saving…' : 'Save'}
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={() => startEditSnap(snap)} className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {editingSnap ? (
                                  <div className="space-y-2">
                                    <div className="rounded-lg bg-card border border-border p-2.5 space-y-2">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Your company</p>
                                      <div>
                                        <p className="text-[9px] text-muted-foreground mb-0.5">Name</p>
                                        <input value={snapDraft.companyName} onChange={e => setSnapDraft(p => ({ ...p, companyName: e.target.value }))} className="w-full text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:border-primary" />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-muted-foreground mb-0.5">Offering</p>
                                        <textarea value={snapDraft.companyOffering} onChange={e => setSnapDraft(p => ({ ...p, companyOffering: e.target.value }))} rows={2} className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:border-primary" />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-muted-foreground mb-0.5">Advantages</p>
                                        <textarea value={snapDraft.companyAdvantages} onChange={e => setSnapDraft(p => ({ ...p, companyAdvantages: e.target.value }))} rows={2} className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:border-primary" />
                                      </div>
                                    </div>

                                    <div className="rounded-lg bg-card border border-border p-2.5">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why they'd buy</p>
                                      <textarea value={snapDraft.buyerMotivation} onChange={e => setSnapDraft(p => ({ ...p, buyerMotivation: e.target.value }))} rows={3} className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:border-primary" />
                                    </div>

                                    <div className="rounded-lg bg-card border border-border p-2.5">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email hooks</p>
                                      <p className="text-[9px] text-muted-foreground mb-1">One per line</p>
                                      <textarea value={snapDraft.emailHooksText} onChange={e => setSnapDraft(p => ({ ...p, emailHooksText: e.target.value }))} rows={3} className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:border-primary" />
                                    </div>

                                    <div className="rounded-lg bg-card border border-border p-2.5">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Research facts</p>
                                      <p className="text-[9px] text-muted-foreground mb-1">One per line · optionally append <span className="font-mono"> — source-url</span></p>
                                      <textarea value={snapDraft.citedFactsText} onChange={e => setSnapDraft(p => ({ ...p, citedFactsText: e.target.value }))} rows={5} className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:border-primary" />
                                    </div>

                                    <div className="rounded-lg bg-card border border-border p-2.5">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Original email sent</p>
                                      <textarea value={snapDraft.originalEmail} onChange={e => setSnapDraft(p => ({ ...p, originalEmail: e.target.value }))} rows={4} className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:border-primary" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {(cb.name || cb.offering) && (
                                      <div className="rounded-lg bg-card border border-border p-2.5 space-y-0.5">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your company</p>
                                        {cb.name       && <p className="text-xs"><span className="text-muted-foreground">Name:</span> {cb.name}</p>}
                                        {cb.offering   && <p className="text-xs"><span className="text-muted-foreground">Offering:</span> {cb.offering}</p>}
                                        {cb.advantages && <p className="text-xs"><span className="text-muted-foreground">Advantages:</span> {cb.advantages}</p>}
                                      </div>
                                    )}

                                    {snap.buyerMotivation && (
                                      <div className="rounded-lg bg-card border border-border p-2.5">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why they'd buy</p>
                                        <p className="text-xs leading-relaxed">{snap.buyerMotivation}</p>
                                      </div>
                                    )}

                                    {snap.emailHooks && snap.emailHooks.length > 0 && (
                                      <div className="rounded-lg bg-card border border-border p-2.5">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email hooks used</p>
                                        <ul className="space-y-0.5">
                                          {snap.emailHooks.map((h: string, i: number) => (
                                            <li key={i} className="text-xs text-muted-foreground">· {h}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {snap.citedFacts && snap.citedFacts.length > 0 && (
                                      <div className="rounded-lg bg-card border border-border p-2.5">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Research facts</p>
                                        <ul className="space-y-0.5">
                                          {snap.citedFacts.map((f: any, i: number) => (
                                            <li key={i} className="text-xs text-muted-foreground">· {f.fact}{f.source ? ` — ${f.source}` : ''}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {snap.originalEmail && (
                                      <div className="rounded-lg bg-card border border-border p-2.5">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Original email sent</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{snap.originalEmail}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {!sessionsLoading && sessions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No sessions yet. They appear here once leads click their chat link.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
