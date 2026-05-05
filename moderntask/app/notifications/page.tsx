'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Reply, Eye, XCircle, Calendar, AlertTriangle, ArrowLeft, CheckCheck, RefreshCw, Inbox, Send, Mail, MessageSquare, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'

type NotifType = 'reply' | 'view' | 'failed_send' | 'meeting' | 'issue' | string
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

const TYPE_META: Record<NotifType, { icon: React.ComponentType<{ className?: string }>; bg: string; badge: string; label: string }> = {
  reply:       { icon: Reply,        bg: 'bg-blue-500/10 border-blue-500/20',   badge: 'bg-blue-500/20 text-blue-400',   label: 'Reply' },
  view:        { icon: Eye,          bg: 'bg-green-500/10 border-green-500/20', badge: 'bg-green-500/20 text-green-400', label: 'Opened' },
  failed_send: { icon: XCircle,      bg: 'bg-red-500/10 border-red-500/20',     badge: 'bg-red-500/20 text-red-400',     label: 'Failed' },
  meeting:     { icon: Calendar,     bg: 'bg-purple-500/10 border-purple-500/20', badge: 'bg-purple-500/20 text-purple-400', label: 'Meeting' },
  issue:       { icon: AlertTriangle, bg: 'bg-yellow-500/10 border-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Issue' },
  batch_send:  { icon: Send,         bg: 'bg-indigo-500/10 border-indigo-500/20', badge: 'bg-indigo-500/20 text-indigo-400', label: 'Batch Sent' },
}

const SEVERITY_COLORS: Record<Severity, string> = {
  low: 'text-gray-400', medium: 'text-blue-400', high: 'text-orange-400', critical: 'text-red-500'
}

const FILTER_TABS = [
  { id: 'all',        label: 'All' },
  { id: 'unread',     label: 'Unread' },
  { id: 'reply',      label: 'Replies' },
  { id: 'view',       label: 'Opens' },
  { id: 'meeting',    label: 'Meetings' },
  { id: 'batch_send', label: 'Batches' },
  { id: 'failed_send', label: 'Failed' },
]

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [markingAll, setMarkingAll] = useState(false)

  // Notification preferences
  const [prefs, setPrefs] = useState({ emailEnabled: true, smsEnabled: false, phone: '' })
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState('')

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/notifications')
      setNotifications(r.data?.notifications ?? [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  // Load notification preferences
  useEffect(() => {
    api.get('/api/settings/notifications')
      .then(r => { if (r.data?.settings) setPrefs(r.data.settings) })
      .catch(() => {})
      .finally(() => setPrefsLoading(false))
  }, [])

  const savePrefs = async (updated: typeof prefs) => {
    setPrefsSaving(true)
    setPrefsMsg('')
    try {
      await api.put('/api/settings/notifications', updated)
      setPrefsMsg('Saved!')
      setTimeout(() => setPrefsMsg(''), 2500)
    } catch {
      setPrefsMsg('Failed to save')
    } finally {
      setPrefsSaving(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await api.post('/api/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
    setMarkingAll(false)
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'all') return true
    return n.type === filter
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const getMeta = (type: NotifType) => TYPE_META[type] ?? TYPE_META['issue']

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts)
      const now = Date.now()
      const diff = now - d.getTime()
      if (diff < 7 * 24 * 60 * 60 * 1000) return formatDistanceToNow(d, { addSuffix: true })
      return format(d, 'MMM d, yyyy h:mm a')
    } catch { return ts }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Bell className="w-5 h-5 text-primary flex-shrink-0" />
            <h1 className="text-xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[11px] h-5 px-1.5">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadNotifications} className="h-8 w-8" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll} className="h-8 text-xs gap-1.5">
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex gap-1 pb-3 overflow-x-auto scrollbar-hide">          {FILTER_TABS.map(tab => {
            const count = tab.id === 'all' ? notifications.length
              : tab.id === 'unread' ? unreadCount
              : notifications.filter(n => n.type === tab.id).length
            const active = filter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${active ? 'bg-white/20' : 'bg-primary/20 text-primary'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Notification Preferences Card ─────────────────────── */}
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
            <span className="text-xs text-muted-foreground ml-auto">Applies to scheduled batch sends</span>
          </div>
          {prefsLoading ? (
            <div className="h-10 flex items-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {/* Email toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email notifications</p>
                    <p className="text-xs text-muted-foreground">Receive a Meridian email after each auto-send batch</p>
                  </div>
                </div>
                <Switch
                  checked={prefs.emailEnabled}
                  onCheckedChange={(v) => {
                    const updated = { ...prefs, emailEnabled: v }
                    setPrefs(updated)
                    savePrefs(updated)
                  }}
                />
              </div>

              {/* SMS toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">SMS notifications</p>
                    <p className="text-xs text-muted-foreground">Get a text message when a batch sends</p>
                  </div>
                </div>
                <Switch
                  checked={prefs.smsEnabled}
                  onCheckedChange={(v) => {
                    const updated = { ...prefs, smsEnabled: v }
                    setPrefs(updated)
                    savePrefs(updated)
                  }}
                />
              </div>

              {/* Phone input (shown when SMS is on) */}
              {prefs.smsEnabled && (
                <div className="flex items-center gap-3 pl-6">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    className="h-8 text-sm max-w-xs"
                    placeholder="+15551234567"
                    value={prefs.phone}
                    onChange={(e) => setPrefs(p => ({ ...p, phone: e.target.value }))}
                    onBlur={() => savePrefs(prefs)}
                  />
                </div>
              )}

              {prefsMsg && (
                <p className={`text-xs font-medium ${prefsMsg === 'Saved!' ? 'text-green-500' : 'text-red-500'}`}>
                  {prefsSaving ? 'Saving…' : prefsMsg}
                </p>
              )}
            </div>
          )}
        </div>
        {/* ── End preferences card ──────────────────────────────── */}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' ? 'You\'re all caught up!' : 'Activity will appear here as your agent works.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(notif => {
              const meta = getMeta(notif.type)
              const Icon = meta.icon
              return (
                <div
                  key={notif.id}
                  onClick={() => { if (!notif.read) markAsRead(notif.id) }}
                  className={`relative flex gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.005] hover:shadow-md ${notif.read ? 'bg-card border-border opacity-75 hover:opacity-100' : `${meta.bg} border`}`}
                >
                  {/* Unread dot */}
                  {!notif.read && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.badge}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-start gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-foreground leading-tight">{notif.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.badge}`}>{meta.label}</span>
                      {notif.severity && notif.severity !== 'low' && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${SEVERITY_COLORS[notif.severity as Severity] ?? 'text-muted-foreground'}`}>
                          {notif.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug mb-1.5 line-clamp-2">{notif.message}</p>
                    {/* Extra data snippets */}
                    {notif.data?.subject && (
                      <p className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded mb-1.5 truncate">
                        Re: {notif.data.subject}
                      </p>
                    )}
                    {notif.data?.leadName && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{notif.data.leadName}</span>
                        {notif.data.company ? ` · ${notif.data.company}` : ''}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-2">{formatTime(notif.timestamp)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
