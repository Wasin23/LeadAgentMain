"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import api from "@/lib/api"
import {
  Send, Edit2, Check, RotateCcw, Bot, ArrowLeft,
  Mail, Clock, MessageSquare, Zap, Users, BarChart3
} from "lucide-react"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_HELP = [
  { title: "Getting Started",  body: "Create agents in the Agents tab, configure their personalities, and start building your outreach campaigns." },
  { title: "Managing Agents",  body: "Each agent can have a unique personality type. Visit the Agents page to create, edit, or delete agents." },
  { title: "Email Operations", body: "View queued, sent, and replied emails in the Operations tab. You can edit emails before they are sent." },
  { title: "Analytics",        body: "Track your outreach performance with detailed analytics on the Dashboard page." },
]

export function HelpContent() {
  const [showContact, setShowContact] = useState(false)

  // ── chat ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your Meridian AI assistant. I can help you understand how to use the platform, manage your agents, and answer questions about outreach campaigns. What would you like to know?",
      timestamp: new Date()
    }
  ])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editContent, setEditContent]   = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string, historyOverride?: Message[]) => {
    const history = historyOverride ?? messages
    setIsLoading(true)
    try {
      const res = await api.post('/api/help/chat', {
        messages: history.map(m => ({ role: m.role, content: m.content })),
        newMessage: text
      })
      const assistant: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: res.data.message,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistant])
    } catch {
      const errMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg: Message = { id: String(Date.now()), role: 'user', content: input.trim(), timestamp: new Date() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await sendMessage(userMsg.content, nextMessages)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const saveEdit = async (id: string) => {
    const idx = messages.findIndex(m => m.id === id)
    if (idx === -1) return
    const updated = messages.map((m, i) => i === idx ? { ...m, content: editContent } : m)
    const sliced = updated.slice(0, idx + 1)
    setMessages(sliced)
    setEditingId(null)
    if (updated[idx].role === 'user') await sendMessage(editContent, sliced)
  }

  // ── contact form ──────────────────────────────────────────────────────────
  const [form, setForm]       = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/api/help/contact', form)
      toast.success("Message sent! We'll get back to you within 24-48 hours.")
      setForm({ name: '', email: '', subject: '', message: '' })
      setShowContact(false)
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (showContact) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* Contact form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setShowContact(false)}
                className="p-1.5 rounded hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <h3 className="font-semibold text-base">Contact Support</h3>
                <p className="text-xs text-muted-foreground">We'll get back to you within 24-48 hours.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input placeholder="How can we help?" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <textarea
                  rows={6}
                  required
                  placeholder="Tell us more about your question or issue..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" disabled={sending} className="w-full gap-2">
                <Mail className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Quick help sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <h4 className="font-semibold text-sm mb-4">Quick Help</h4>
            <div className="space-y-4">
              {QUICK_HELP.map(item => (
                <div key={item.title}>
                  <p className="text-sm font-medium mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h4 className="font-semibold text-sm mb-3">Contact Info</h4>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                <span>support@meridianagent.xyz</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Response time: 24-48 hours</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // ── chat view ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl">
      <Card className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {messages.map(msg => {
            const isUser = msg.role === 'user'
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
                }`}>
                  {editingId === msg.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-2 py-1 rounded border border-input bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(msg.id)} className="p-1 rounded hover:bg-muted transition-colors">
                          <Check className="w-3.5 h-3.5 text-primary" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted transition-colors">
                          <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {isUser && (
                        <button
                          onClick={() => { setEditingId(msg.id); setEditContent(msg.content) }}
                          className="absolute -right-7 top-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                        >
                          <Edit2 className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className={`text-[10px] mt-1.5 ${isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about Meridian..."
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-10 w-10 rounded-xl flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setShowContact(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Need more help? Contact us directly
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
