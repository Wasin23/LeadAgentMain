'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Send, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SessionData {
  sessionId:        string
  sessionCreatedAt: string
  messages:         { role: string; content: string }[]
  agent: {
    name:        string
    avatar:      string | null
    personality: string | null
  }
  lead: {
    name:    string
    company: string
    title:   string
  }
  systemPrompt: string | null
  tone:         string
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://meridian-kdew.onrender.com'

export function LeadChat() {
  const params = useParams()
  const token  = params?.token as string

  const [session, setSession]   = useState<SessionData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    fetch(`${API}/api/meet/init/${token}`)
      .then(r => r.json())
      .then(async data => {
        if (data.error) { setInitError(data.error); return }
        setSession(data)
        const prior: Message[] = (data.messages || []).map((m: any) => ({
          role:    m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }))
        setMessages(prior)

        // If no prior messages, have the AI send an opener
        if (prior.length === 0) {
          setLoading(true)
          try {
            const r = await fetch(`${API}/api/meet/opener`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token,
                sessionId:        data.sessionId,
                sessionCreatedAt: data.sessionCreatedAt,
              }),
            })
            const openerData = await r.json()
            if (openerData.reply) {
              setMessages([{ role: 'assistant', content: openerData.reply }])
            }
          } catch { /* silent — lead can still message first */ }
          finally { setLoading(false) }
        }
      })
      .catch(() => setInitError('Could not connect. Please try again.'))
  }, [token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !session) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const r = await fetch(`${API}/api/meet/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          sessionId:        session.sessionId,
          sessionCreatedAt: session.sessionCreatedAt,
          message:          text,
          history:          next.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await r.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, session, token])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-white px-6 text-center">
        <div>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-gray-700 font-medium">{initError}</p>
          <p className="text-sm text-gray-400 mt-1">This link may have expired or already been used.</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white max-w-2xl mx-auto">

      {/* Header */}
      <div className="shrink-0 border-b border-gray-100 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-lg shrink-0 overflow-hidden">
          {session.agent.avatar && (session.agent.avatar.startsWith('/') || session.agent.avatar.startsWith('http'))
            ? <img src={session.agent.avatar} alt={session.agent.name} className="w-full h-full object-cover rounded-full" />
            : <span>{session.agent.avatar || '🤖'}</span>
          }
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{session.agent.name}</p>
          <p className="text-xs text-gray-400">{session.agent.personality || 'AI Sales Representative'} · Online now</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-400 text-sm pt-10">
            Starting conversation…
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              m.role === 'assistant' ? 'bg-blue-50' : 'bg-gray-100'
            }`}>
              {m.role === 'assistant'
                ? <Bot className="w-3.5 h-3.5 text-blue-500" />
                : <User className="w-3.5 h-3.5 text-gray-400" />
              }
            </div>
            <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'assistant'
                ? 'bg-gray-50 text-gray-900 rounded-tl-sm border border-gray-100'
                : 'bg-blue-500 text-white rounded-tr-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-400 min-h-[48px] max-h-36 bg-gray-50"
            style={{ fontSize: '16px', lineHeight: '1.5' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 w-11 h-11 rounded-2xl bg-blue-500 text-white flex items-center justify-center disabled:opacity-40 active:bg-blue-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
