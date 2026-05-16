'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Bot, User, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AgentInfo {
  agentId:     string
  name:        string
  personality: { type: string; name: string; avatar: string } | null
}

const MOCK_LEAD = {
  name:    'Alex Johnson',
  company: 'Acme Corp',
  title:   'VP of Sales',
}

export function PreviewChat() {
  const params   = useSearchParams()
  const agentId  = params.get('agentId') || ''

  const [agent, setAgent]       = useState<AgentInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [systemPrompt, setSystemPrompt] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load agent info and system prompt
  useEffect(() => {
    if (!agentId) return
    api.get('/api/auth/agents').then(r => {
      const found = (r.data?.agents ?? []).find((a: any) => a.agentId === agentId)
      if (found) setAgent({ agentId: found.agentId, name: found.name, personality: found.personality ?? null })
    }).catch(() => {})

    api.get('/api/chat-lab/prompt', { params: { agentId } }).then(r => {
      if (r.data?.prompt?.promptText) setSystemPrompt(r.data.prompt.promptText)
    }).catch(() => {})
  }, [agentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const r = await api.post('/api/chat-lab/test-chat', {
        agentId,
        lead:        MOCK_LEAD,
        personality: agent?.personality?.type?.toUpperCase() || 'HUNTER',
        systemPrompt: systemPrompt || undefined,
        messages:    next.map(m => ({ role: m.role === 'user' ? 'lead' : 'assistant', content: m.content })),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: r.data.reply || '' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, agentId, agent, systemPrompt])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
          {agent?.personality?.avatar || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{agent?.name || 'Agent'}</p>
          <p className="text-xs text-muted-foreground">{agent?.personality?.name || 'AI Sales Representative'}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium">
          <FlaskConical className="w-3 h-3" />
          Preview mode
        </div>
      </div>

      {/* Preview notice */}
      <div className="shrink-0 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" />
        <span>This is exactly what your prospect sees when they click your chat link. You're typing as a mock lead — <span className="font-semibold">{MOCK_LEAD.name}, {MOCK_LEAD.title} at {MOCK_LEAD.company}</span>.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-muted-foreground text-sm py-16">
            Send a message to start the preview chat.
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              m.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'
            }`}>
              {m.role === 'assistant'
                ? <Bot className="w-3.5 h-3.5 text-primary" />
                : <User className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </div>
            <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'assistant'
                ? 'bg-card border border-border text-foreground rounded-tl-sm'
                : 'bg-primary text-primary-foreground rounded-tr-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-card border border-border">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type as the lead..."
            className="resize-none min-h-[44px] max-h-32 text-sm"
            rows={1}
            disabled={!agentId}
          />
          <Button
            size="icon"
            className="shrink-0 h-11 w-11"
            onClick={send}
            disabled={!input.trim() || loading || !agentId}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}
