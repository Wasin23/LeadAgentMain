'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Reply, Eye, XCircle, Calendar, AlertTriangle, CheckCheck, RefreshCw,
  Inbox, Send, Mail, MessageSquare, Bot, CreditCard, Info, Server, Settings,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

type NotifType = string
type Severity = 'low' | 'medium' | 'high' | 'critical'

interface Notification {
  id: string
  type: NotifType
  severity?: Severity
  title: string
  message: string
  timestamp: string
  read: boolean
  data?: Record<string, any>
}

const DEFAULT_META = { icon: Info, badge: 'bg-slate-500/20 text-slate-400', label: 'Info' }

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; badge: string; label: string }> = {
  reply:          { icon: Reply,         badge: 'bg-blue-500/20 text-blue-400',     label: 'Reply' },
  view:           { icon: Eye,           badge: 'bg-green-500/20 text-green-400',   label: 'Opened' },
  failed_send:    { icon: XCircle,       badge: 'bg-red-500/20 text-red-400',       label: 'Failed' },
  meeting:        { icon: Calendar,      badge: 'bg-purple-500/20 text-purple-400', label: 'Meeting' },
  issue:          { icon: AlertTriangle, badge: 'bg-yellow-500/20 text-yellow-400', label: 'Issue' },
  warning:        { icon: AlertTriangle, badge: 'bg-yellow-500/20 text-yellow-400', label: 'Warning' },
  error:          { icon: AlertTriangle, badge: 'bg-red-500/20 text-red-400',       label: 'Error' },
  batch_send:     { icon: Send,          badge: 'bg-indigo-500/20 text-indigo-400', label: 'Batch Sent' },
  email:          { icon: Mail,          badge: 'bg-green-500/20 text-green-400',   label: 'Email' },
  agent:          { icon: Bot,           badge: 'bg-slate-500/20 text-slate-400',   label: 'Agent' },
  info:           DEFAULT_META,
  billing:        { icon: CreditCard,    badge: 'bg-amber-500/20 text-amber-400',   label: 'Billing' },
  system:         { icon: Server,        badge: 'bg-slate-500/20 text-slate-400',   label: 'System' },
  chat:           { icon: MessageSquare, badge: 'bg-blue-500/20 text-blue-400',     label: 'Chat' },
  scheduled_send: { icon: Calendar,      badge: 'bg-indigo-500/20 text-indigo-400', label: 'Scheduled' },
}

export function NotificationsDropdown({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [markingAll, setMarkingAll] = useState(false)
  const [count, setCount] = useState(0)

  const updateCount = useCallback((n: number) => {
    setCount(n)
    onCountChange?.(n)
  }, [onCountChange])

  // Lightweight unread count poll (badge stays fresh without opening)
  useEffect(() => {
    const fetchCount = () => {
      api.get('/api/notifications/count')
        .then(r => updateCount(r.data?.unreadCount ?? 0))
        .catch(() => {})
    }
    fetchCount()
    const t = setInterval(fetchCount, 60000)
    return () => clearInterval(t)
  }, [updateCount])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/notifications')
      const list: Notification[] = r.data?.notifications ?? []
      setNotifications(list)
      updateCount(list.filter(n => !n.read).length)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [updateCount])

  // Fetch when opened
  useEffect(() => { if (open) load() }, [open, load])

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    updateCount(Math.max(0, count - 1))
    try { await api.patch(`/api/notifications/${id}/read`) } catch {}
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    updateCount(0)
    try { await api.post('/api/notifications/mark-all-read') } catch {}
    setMarkingAll(false)
  }

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications

  const formatTime = (ts: string) => {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return ts }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Notifications"
          className="relative hover:bg-secondary transition-all duration-300 hover:scale-110 h-8 w-8"
        >
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-sm font-semibold">Notifications</span>
          {count > 0 && (
            <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">{count}</span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
              {(['all', 'unread'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                    filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button onClick={load} title="Refresh" className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {count > 0 && (
              <button onClick={markAllRead} disabled={markingAll} title="Mark all read" className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50">
                <CheckCheck className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                {filter === 'unread' ? "You're all caught up!" : 'Activity will appear here as your agents work.'}
              </p>
            </div>
          ) : (
            filtered.map(notif => {
              const meta = TYPE_META[notif.type] ?? DEFAULT_META
              const Icon = meta.icon
              return (
                <button
                  key={notif.id}
                  onClick={() => { if (!notif.read) markAsRead(notif.id) }}
                  className={`flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/40 ${notif.read ? 'opacity-60' : ''}`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">{notif.title}</span>
                      {!notif.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{notif.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{formatTime(notif.timestamp)}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-3 py-2">
          <Link
            href="/settings?tab=notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-3 h-3" />
            Notification preferences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
