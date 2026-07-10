'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Bot, User, FlaskConical } from 'lucide-react'
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

  const agentFirstName = agent?.name?.split(' ')[0] || 'Agent'
  const mockFirstName  = MOCK_LEAD.name.split(' ')[0]

  return (
    <div className="flex flex-col h-screen bg-white max-w-2xl mx-auto">

      {/* Header - identical to lead chat */}
      <div className="shrink-0 border-b border-gray-100 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-lg shrink-0 overflow-hidden">
          {agent?.personality?.avatar && (agent.personality.avatar.startsWith('/') || agent.personality.avatar.startsWith('http')) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.personality.avatar} alt={agent?.name || 'Agent'} className="w-full h-full object-cover" />
          ) : (
            <Bot className="w-5 h-5 text-indigo-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{agent?.name || 'Agent'}</p>
          <p className="text-xs text-gray-400">{agent?.personality?.name || 'AI Sales Representative'} · <span className="text-green-500 font-medium">Online</span></p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium shrink-0">
          <FlaskConical className="w-3 h-3" />
          Preview mode
        </div>
      </div>

      {/* Preview notice */}
      <div className="shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" />
        <span>This is exactly what your prospect sees. You&apos;re typing as <span className="font-semibold">{MOCK_LEAD.name}, {MOCK_LEAD.title} at {MOCK_LEAD.company}</span>.</span>
      </div>

      {/* Messages - identical to lead chat */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-400 text-sm pt-10">Send a message to start the preview.</div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          return (
            <div key={i} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isUser ? 'bg-blue-100' : 'bg-indigo-100'
                }`}>
                  {isUser
                    ? <User className="w-3.5 h-3.5 text-blue-500" />
                    : <Bot className="w-3.5 h-3.5 text-indigo-500" />
                  }
                </div>
                <span className="text-[10px] text-gray-400 leading-none">
                  {isUser ? mockFirstName : agentFirstName}
                </span>
              </div>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                isUser
                  ? 'bg-blue-500 text-white rounded-tr-sm'
                  : 'bg-indigo-50 text-gray-900 rounded-tl-sm border border-indigo-100'
              }`}>
                {m.content}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-indigo-50 border border-indigo-100">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input - identical to lead chat */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type as the lead..."
            rows={1}
            disabled={!agentId}
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 focus:outline-none focus:border-indigo-400 min-h-[48px] max-h-28 bg-gray-50 text-gray-900 disabled:opacity-50"
            style={{ fontSize: '16px', lineHeight: '1.4' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || !agentId}
            className="shrink-0 w-11 h-11 rounded-2xl bg-blue-500 text-white flex items-center justify-center disabled:opacity-40 active:bg-blue-700 transition-colors hover:bg-blue-600"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}
