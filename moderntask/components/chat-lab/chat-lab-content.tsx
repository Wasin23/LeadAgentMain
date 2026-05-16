'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send, RotateCcw, Upload, Trash2, Edit2, Plus, FileText, X, Check,
  Brain, MessageSquare, History, ChevronDown, ChevronUp, User,
  Layers, Sparkles, FlaskConical, Save, Eye, EyeOff, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType = 'case-study' | 'pricing' | 'objection-handler' | 'battle-card' | 'faq' | 'process' | 'general'
type Personality = 'HUNTER' | 'ANALYST' | 'CONSULTANT' | 'ADVISOR'

interface FakeLead {
  name: string
  company: string
  title: string
  industry: string
  painPoints: string
  recentSignals: string
}

interface ChatMessage {
  id: string
  role: 'lead' | 'ai'
  content: string
  intent: number
  retrievedChunks: string[]
  timestamp: Date
}

interface KnowledgeDoc {
  id: string
  name: string
  type: DocType
  chunks: number
  addedAt: Date
  preview: string
  editing: boolean
}

interface ChatSession {
  sessionId: string
  leadName: string
  company: string
  messages: number
  intent: number
  startedAt: Date
  status: 'active' | 'ended'
}

interface ContextBlock {
  label: string
  tokens: number
  color: string
  cleared: boolean
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

const PERSONALITIES: { value: Personality; label: string; desc: string }[] = [
  { value: 'HUNTER',     label: 'Hunter',     desc: 'Direct & results-focused' },
  { value: 'ANALYST',    label: 'Analyst',    desc: 'Data-driven & methodical' },
  { value: 'CONSULTANT', label: 'Consultant', desc: 'Trusted advisor' },
  { value: 'ADVISOR',    label: 'Advisor',    desc: 'Strategic & senior' },
]

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

const DEFAULT_LEAD: FakeLead = {
  name: 'Alex Rivera',
  company: 'ScaleFlow Inc.',
  title: 'VP of Sales',
  industry: 'B2B SaaS',
  painPoints: 'SDR team is expensive and not hitting quota. Struggling to personalize outreach at scale.',
  recentSignals: 'Hired 3 new SDRs last month. Posted a job for "Head of Growth". Recent LinkedIn post about pipeline efficiency.',
}

const MOCK_SESSIONS: ChatSession[] = [
  { sessionId: 's1', leadName: 'Sarah Chen',   company: 'Foundry Labs',  messages: 14, intent: 8, startedAt: new Date(Date.now() - 2 * 3600000),       status: 'ended' },
  { sessionId: 's2', leadName: 'Marcus Webb',  company: 'Vertex Growth', messages:  6, intent: 5, startedAt: new Date(Date.now() - 24 * 3600000),      status: 'ended' },
  { sessionId: 's3', leadName: 'Priya Nair',   company: 'Delphi AI',     messages:  3, intent: 3, startedAt: new Date(Date.now() - 3 * 86400000),      status: 'ended' },
  { sessionId: 's4', leadName: 'Jordan Blake', company: 'Apexio',        messages: 21, intent: 9, startedAt: new Date(Date.now() - 7 * 86400000),      status: 'ended' },
]

const MOCK_CONTEXT: ContextBlock[] = [
  { label: 'System prompt',         tokens: 420,  color: 'bg-violet-500',  cleared: false },
  { label: 'Lead research profile', tokens: 890,  color: 'bg-blue-500',    cleared: false },
  { label: 'Original email',        tokens: 310,  color: 'bg-sky-400',     cleared: false },
  { label: 'RAG chunks (top-4)',    tokens: 1240, color: 'bg-teal-500',    cleared: false },
  { label: 'Conversation history',  tokens: 2100, color: 'bg-amber-500',   cleared: false },
  { label: 'Early messages',        tokens: 680,  color: 'bg-rose-400',    cleared: true  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function intentBadge(score: number) {
  if (score >= 7) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (score >= 4) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  // Chat state
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState('')
  const [isTyping, setIsTyping]         = useState(false)
  const [personality, setPersonality]   = useState<Personality>('HUNTER')
  const [leadExpanded, setLeadExpanded] = useState(true)
  const [lead, setLead]                 = useState<FakeLead>(DEFAULT_LEAD)
  const [showChunks, setShowChunks]     = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Knowledge state
  const [docs, setDocs]                 = useState<KnowledgeDoc[]>([
    { id: '1', name: 'Q1 2025 Case Studies.pdf',         type: 'case-study',        chunks: 12, addedAt: new Date(Date.now() - 5 * 86400000), preview: 'SaaS company reduced CAC by 40%...', editing: false },
    { id: '2', name: 'Pricing & Packaging v3.docx',      type: 'pricing',           chunks:  8, addedAt: new Date(Date.now() - 3 * 86400000), preview: 'Starter $99/mo, Pro $299/mo...', editing: false },
    { id: '3', name: 'Common Objections Playbook.pdf',   type: 'objection-handler', chunks: 18, addedAt: new Date(Date.now() - 7 * 86400000), preview: '"Too expensive" → Lead with ROI...', editing: false },
  ])
  const [dragging, setDragging]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prompt state
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [promptSaved, setPromptSaved]   = useState(true)
  const [promptVersions]                = useState(['v3 (current)', 'v2', 'v1'])

  // Sessions state
  const [sessions]                      = useState<ChatSession[]>(MOCK_SESSIONS)
  const totalSessions                   = sessions.length + 47 // mock total from DB

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Simulate AI response
  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg: ChatMessage = {
      id: uid(), role: 'lead', content: input.trim(),
      intent: 0, retrievedChunks: [], timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setTimeout(() => {
      const intent = Math.min(10, Math.floor(Math.random() * 4) + (messages.length > 4 ? 5 : 2))
      const aiMsg: ChatMessage = {
        id: uid(),
        role: 'ai',
        content: `Thanks for bringing that up. Based on what I know about ${lead.company}'s situation — specifically around ${lead.painPoints.split('.')[0].toLowerCase()} — here's how I'd think about it...\n\nWe've helped companies at a similar stage cut SDR overhead by 60% while increasing qualified pipeline. Happy to walk through a specific example if that's useful.`,
        intent,
        retrievedChunks: [
          'Case Study: ScaleFlow reduced CAC by 40% in Q2 2024...',
          'Pricing: Pro plan includes unlimited agents at $299/mo...',
          'Objection Handler: When prospect mentions cost → anchor on SDR replacement value...',
        ],
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
      setIsTyping(false)
    }, 1400)
  }

  const resetChat = () => {
    setMessages([])
    setInput('')
    setIsTyping(false)
    setShowChunks(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  const addFiles = (files: File[]) => {
    const newDocs: KnowledgeDoc[] = files.map(f => ({
      id: uid(),
      name: f.name,
      type: 'general' as DocType,
      chunks: Math.floor(Math.random() * 20) + 4,
      addedAt: new Date(),
      preview: 'Processing...',
      editing: false,
    }))
    setDocs(prev => [...prev, ...newDocs])
  }

  const deleteDoc = (id: string) => setDocs(prev => prev.filter(d => d.id !== id))

  const updateDocType = (id: string, type: DocType) =>
    setDocs(prev => prev.map(d => d.id === id ? { ...d, type } : d))

  const toggleEditDoc = (id: string) =>
    setDocs(prev => prev.map(d => d.id === id ? { ...d, editing: !d.editing } : d))

  const totalTokens = MOCK_CONTEXT.reduce((s, b) => s + b.tokens, 0)
  const maxTokens = 8000

  return (
    <div className="flex gap-4 h-full overflow-hidden">

      {/* ── LEFT: Test Chat ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-[44%] min-w-0 gap-3 h-full">

        {/* Lead card */}
        <div className="border border-border rounded-xl bg-card overflow-hidden shrink-0">
          <button
            onClick={() => setLeadExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Simulated Lead</span>
              <span className="text-xs text-muted-foreground">— {lead.name}, {lead.title} @ {lead.company}</span>
            </div>
            {leadExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {leadExpanded && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
              {([ ['name', 'Name'], ['company', 'Company'], ['title', 'Title'], ['industry', 'Industry'] ] as [keyof FakeLead, string][]).map(([field, label]) => (
                <div key={field}>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
                  <Input
                    value={lead[field]}
                    onChange={e => setLead(prev => ({ ...prev, [field]: e.target.value }))}
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Pain Points</Label>
                <Textarea
                  value={lead.painPoints}
                  onChange={e => setLead(prev => ({ ...prev, painPoints: e.target.value }))}
                  className="text-xs mt-0.5 min-h-[56px] resize-none"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recent Signals</Label>
                <Textarea
                  value={lead.recentSignals}
                  onChange={e => setLead(prev => ({ ...prev, recentSignals: e.target.value }))}
                  className="text-xs mt-0.5 min-h-[48px] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Persona + Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex-1">
            <Select value={personality} onValueChange={v => setPersonality(v as Personality)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSONALITIES.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground ml-1.5">— {p.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={resetChat} className="h-8 text-xs gap-1.5 shrink-0">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>

        {/* Chat messages */}
        <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                <FlaskConical className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Type a message as the lead to start testing</p>
              </div>
            )}

            <div className="space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'lead' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'lead'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.role === 'ai' && (
                    <div className="flex items-center gap-2 mt-1 ml-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${intentBadge(msg.intent)}`}>
                        Intent {msg.intent}/10
                      </span>
                      {msg.retrievedChunks.length > 0 && (
                        <button
                          onClick={() => setShowChunks(showChunks === msg.id ? null : msg.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          <Layers className="w-2.5 h-2.5" />
                          {msg.retrievedChunks.length} chunks
                        </button>
                      )}
                    </div>
                  )}

                  {/* Retrieved chunks inspector */}
                  {msg.role === 'ai' && showChunks === msg.id && (
                    <div className="mt-1.5 ml-1 w-full max-w-[90%] border border-border rounded-lg bg-background p-2.5 space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Retrieved chunks</p>
                      {msg.retrievedChunks.map((chunk, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground bg-muted/60 rounded px-2 py-1.5 leading-relaxed">
                          {chunk}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Type as the lead..."
              className="min-h-[40px] max-h-[100px] text-sm resize-none"
            />
            <Button size="icon" onClick={sendMessage} disabled={!input.trim() || isTyping} className="shrink-0 h-10 w-10">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Control Panel ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-3 shrink-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            <span><span className="font-semibold text-foreground">{totalSessions}</span> total chat sessions initialized</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            <span><span className="font-semibold text-foreground">{docs.length}</span> documents · <span className="font-semibold text-foreground">{docs.reduce((s, d) => s + d.chunks, 0)}</span> chunks</span>
          </div>
        </div>

        <Tabs defaultValue="knowledge" className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 w-full grid grid-cols-4 h-9">
            <TabsTrigger value="knowledge" className="text-xs gap-1.5"><FileText className="w-3 h-3" />Knowledge</TabsTrigger>
            <TabsTrigger value="prompt"    className="text-xs gap-1.5"><Sparkles className="w-3 h-3" />Prompt</TabsTrigger>
            <TabsTrigger value="memory"    className="text-xs gap-1.5"><Brain className="w-3 h-3" />Memory</TabsTrigger>
            <TabsTrigger value="sessions"  className="text-xs gap-1.5"><History className="w-3 h-3" />Sessions</TabsTrigger>
          </TabsList>

          {/* ── Knowledge Tab ── */}
          <TabsContent value="knowledge" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">

            {/* Upload area */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors shrink-0 ${
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
              />
              <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-sm font-medium">Drop files here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, TXT, MD — chunks embedded automatically</p>
            </div>

            {/* Document list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 pr-1">
                {docs.map(doc => (
                  <div key={doc.id} className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{doc.preview}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <DocTypeBadge type={doc.type} />
                            <span className="text-[10px] text-muted-foreground">{doc.chunks} chunks</span>
                            <span className="text-[10px] text-muted-foreground">{relativeTime(doc.addedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleEditDoc(doc.id)} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
                          {doc.editing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteDoc(doc.id)} className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {doc.editing && (
                      <div className="mt-2.5 pt-2.5 border-t border-border">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Document Type</Label>
                        <Select value={doc.type} onValueChange={v => updateDocType(doc.id, v as DocType)}>
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

                {docs.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No documents yet. Upload your first file above.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Prompt Tab ── */}
          <TabsContent value="prompt" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">System Prompt</Label>
                {!promptSaved && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">unsaved</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select defaultValue="v3 (current)">
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promptVersions.map(v => (
                      <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setPromptSaved(true)}
                  disabled={promptSaved}
                >
                  <Save className="w-3 h-3" /> Save
                </Button>
              </div>
            </div>

            <Textarea
              value={systemPrompt}
              onChange={e => { setSystemPrompt(e.target.value); setPromptSaved(false) }}
              className="flex-1 min-h-0 text-xs font-mono resize-none leading-relaxed"
              placeholder="Enter your system prompt..."
            />

            <div className="shrink-0 p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Available variables</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {['{lead_name}', '{lead_company}', '{lead_title}', '{company_name}', '{personality_tone}', '{original_email}'].map(v => (
                  <code key={v} className="text-primary">{v}</code>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Memory Tab ── */}
          <TabsContent value="memory" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <Label className="text-sm font-medium">Context Window</Label>
              <span className="text-xs text-muted-foreground">
                {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
              </span>
            </div>

            {/* Token bar */}
            <div className="shrink-0 h-4 rounded-full overflow-hidden flex gap-px bg-muted">
              {MOCK_CONTEXT.filter(b => !b.cleared).map((block, i) => (
                <div
                  key={i}
                  className={`${block.color} h-full transition-all`}
                  style={{ width: `${(block.tokens / maxTokens) * 100}%` }}
                  title={`${block.label}: ${block.tokens} tokens`}
                />
              ))}
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 pr-1">
                {MOCK_CONTEXT.map((block, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-opacity ${
                    block.cleared ? 'border-border bg-card opacity-40' : 'border-border bg-card'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${block.cleared ? 'bg-muted-foreground/30' : block.color}`} />
                      <div>
                        <p className="text-sm font-medium">{block.label}</p>
                        <p className="text-xs text-muted-foreground">{block.tokens.toLocaleString()} tokens</p>
                      </div>
                    </div>
                    {block.cleared ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                        Cleared
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        In context
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="shrink-0 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>Early conversation messages have been cleared to stay within the context limit. The AI retains semantic memory via vector search.</p>
            </div>
          </TabsContent>

          {/* ── Sessions Tab ── */}
          <TabsContent value="sessions" className="flex-1 flex flex-col min-h-0 mt-3 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <Label className="text-sm font-medium">Real Lead Sessions</Label>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                <span><span className="font-semibold text-foreground">{totalSessions}</span> total in DB</span>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 pr-1">
                {sessions.map(s => (
                  <div key={s.sessionId} className="border border-border rounded-xl p-3 bg-card hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{s.leadName}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${intentBadge(s.intent)}`}>
                            Intent {s.intent}/10
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.company}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{relativeTime(s.startedAt)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.messages} messages</p>
                      </div>
                    </div>
                  </div>
                ))}

                {sessions.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No lead sessions yet. They appear here once leads click their chat link.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
