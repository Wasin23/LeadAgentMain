'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, Trash2, Edit2, FileText, Check,
  Brain, MessageSquare, History, Sparkles, Save,
  AlertCircle, ExternalLink, FlaskConical, ChevronDown,
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

interface ChatSession {
  sessionId:   string
  leadName:    string
  leadCompany: string
  messageCount: number
  intentScore: number
  createdAt:   string
  status:      'active' | 'ended'
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

const CONTEXT_STRUCTURE = [
  { label: 'System prompt',         tokens: 0, color: 'bg-violet-500', cleared: false },
  { label: 'Lead research profile', tokens: 0, color: 'bg-blue-500',   cleared: false },
  { label: 'Original email',        tokens: 0, color: 'bg-sky-400',    cleared: false },
  { label: 'RAG chunks (top-4)',    tokens: 0, color: 'bg-teal-500',   cleared: false },
  { label: 'Conversation history',  tokens: 0, color: 'bg-amber-500',  cleared: false },
]

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

  const totalTokens = CONTEXT_STRUCTURE.reduce((s, b) => s + b.tokens, 0)
  const maxTokens   = 8000

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
      <Tabs defaultValue="knowledge" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-full grid grid-cols-4 h-9">
          <TabsTrigger value="knowledge" className="text-xs gap-1.5"><FileText className="w-3 h-3" />Knowledge</TabsTrigger>
          <TabsTrigger value="prompt"    className="text-xs gap-1.5"><Sparkles className="w-3 h-3" />Prompt</TabsTrigger>
          <TabsTrigger value="memory"    className="text-xs gap-1.5"><Brain className="w-3 h-3" />Memory</TabsTrigger>
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

        {/* ── Memory ── */}
        <TabsContent value="memory" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
          <div className="flex items-center justify-between shrink-0">
            <Label className="text-sm font-medium">Context Window</Label>
            <span className="text-xs text-muted-foreground">
              {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
            </span>
          </div>

          <div className="shrink-0 h-4 rounded-full overflow-hidden flex gap-px bg-muted">
            {CONTEXT_STRUCTURE.filter(b => !b.cleared).map((block, i) => (
              <div
                key={i}
                className={`${block.color} h-full`}
                style={{ width: `${(block.tokens / maxTokens) * 100}%` }}
                title={`${block.label}: ${block.tokens} tokens`}
              />
            ))}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-1">
              {CONTEXT_STRUCTURE.map((block, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${
                  block.cleared ? 'border-border bg-card opacity-40' : 'border-border bg-card'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${block.cleared ? 'bg-muted-foreground/30' : block.color}`} />
                    <div>
                      <p className="text-sm font-medium">{block.label}</p>
                      <p className="text-xs text-muted-foreground">{block.tokens.toLocaleString()} tokens</p>
                    </div>
                  </div>
                  {block.cleared
                    ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">Cleared</span>
                    : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">In context</span>
                  }
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="shrink-0 flex items-start gap-2 p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>Context usage will populate once real sessions are running. Token counts update live during active chats.</p>
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
                <div key={s.sessionId} className="border border-border rounded-xl p-3 bg-card hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{s.leadName}</p>
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
