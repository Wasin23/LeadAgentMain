'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Mail, Eye, MessageSquare, MousePointer,
  RefreshCw, Bot, Building2, Clock, Search, X, ChevronDown,
  UserCheck, FileText, CalendarClock, Check, Settings2, ChevronLeft, ChevronRight, Sparkles, RotateCcw,
  MoreHorizontal, Zap,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CopyChip } from '@/components/leads/leads-content'
import { AIReportModal, AIReport } from '@/components/email-queue/email-queue-content'

// ── types ─────────────────────────────────────────────────────────────────────
interface AnalyticsEmail {
  id?: string
  trackingId?: string
  to?: string
  recipient?: string
  subject?: string
  body?: string
  sentAt?: string
  timestamp?: string
  status?: string
  isRebump?: boolean
  isSmartFollowUp?: boolean
  rebumpNumber?: number
  rebumpCount?: number
  maxFollowUps?: number
  followUpScheduled?: boolean
  followUpDate?: string
  followUpStatus?: string
  lastRebumpAt?: string
  lastFollowUpSentAt?: string
  assignedTemplate?: { name?: string; subject?: string; body?: string }
  assignedTemplateId?: number
  agentId?: string
  personInfo?: { fullName?: string; company?: string }
  lead?: { name?: string; company?: string }
  leadName?: string
  company?: string
  analyticsStatus?: {
    opened?: boolean
    clicked?: boolean
    replied?: boolean
    hasProxy?: boolean
    openCount?: number
  }
  unsubscribed?: boolean
  aiReport?: AIReport
}

interface AgentFull {
  agentId: string
  name: string
  personality?: { avatar?: string }
  settings?: {
    emailBuilder?: {
      enableRebump?: boolean
      rebumpIntervalDays?: number
      maxRebumps?: number
      smartRebump?: boolean
      rebumpLinkedinScrape?: boolean
    }
    followUpTemplates?: {
      templates?: Array<{ name: string; subject: string; body: string }>
      generatedAt?: string
    }
  }
}

interface UnsubscribeRecord {
  email: string
  reason?: string
  timestamp?: string
  source?: string
}

interface ReplyMessage {
  id: string
  type: 'outbound' | 'reply' | 'ai_response' | 'manual' | 'system'
  timestamp: string
  subject?: string | null
  content: string
  from?: string | null
  name?: string | null
}

interface ReplyConversation {
  trackingId: string
  leadEmail: string
  leadName: string
  company?: string | null
  subject: string
  status: string
  classification: string
  sentiment: 'positive' | 'negative' | 'neutral'
  preview: string
  lastReplyAt?: string | null
  lastActivityAt?: string | null
  replyCount: number
  aiReplyCount: number
  messages: ReplyMessage[]
}

// ── helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts?: string | null) {
  if (!ts) return '-'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
function leadName(e: AnalyticsEmail) { return e.personInfo?.fullName || e.lead?.name || e.leadName || e.to || e.recipient || 'Unknown' }
function leadCompany(e: AnalyticsEmail) { return e.personInfo?.company || e.lead?.company || e.company || '' }
function sentDate(e: AnalyticsEmail) { return e.sentAt || e.timestamp || '' }
function emailId(e: AnalyticsEmail) { return e.trackingId || e.id || '' }

// Strips the compliance footer (company branding + unsubscribe link) from a body for
// display - it's appended fresh at actual send time and shouldn't be shown in the UI.
function stripFooter(body: string) {
  const idx = body.indexOf('<!--MERIDIAN_FOOTER-->')
  return idx === -1 ? body : body.slice(0, idx).replace(/\s+$/, '')
}

function replyClassText(value?: string | null) {
  if (!value) return 'Neutral'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function replyBadgeClasses(kind: 'classification' | 'status' | 'sentiment', value?: string | null) {
  if (kind === 'sentiment') {
    if (value === 'positive') return 'text-green-400 border-green-500/30 bg-green-500/10'
    if (value === 'negative') return 'text-red-400 border-red-500/30 bg-red-500/10'
    return 'text-slate-400 border-slate-500/30 bg-slate-500/10'
  }

  if (kind === 'classification') {
    if (value === 'meeting_request') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    if (value === 'positive') return 'text-green-400 border-green-500/30 bg-green-500/10'
    if (value === 'question') return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
    if (value === 'unsubscribe') return 'text-red-400 border-red-500/30 bg-red-500/10'
    if (value === 'negative') return 'text-orange-400 border-orange-500/30 bg-orange-500/10'
    if (value === 'out_of_office') return 'text-violet-400 border-violet-500/30 bg-violet-500/10'
    return 'text-slate-400 border-slate-500/30 bg-slate-500/10'
  }

  if (value === 'meeting_requested') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  if (value === 'ai_responded') return 'text-purple-400 border-purple-500/30 bg-purple-500/10'
  if (value === 'manual_replied') return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
  if (value === 'unsubscribed') return 'text-red-400 border-red-500/30 bg-red-500/10'
  if (value === 'not_interested') return 'text-orange-400 border-orange-500/30 bg-orange-500/10'
  return 'text-slate-400 border-slate-500/30 bg-slate-500/10'
}

// ── sent email row ─────────────────────────────────────────────────────────────
function SentRow({ email, onEditFollowUp, onScheduleFollowUp, onSendNow, onCancelAllFollowUps, onViewReport, selectionMode, selected, onToggleSelect }: {
  email: AnalyticsEmail
  onEditFollowUp: (e: AnalyticsEmail) => void
  onScheduleFollowUp?: (e: AnalyticsEmail) => void
  onSendNow?: (e: AnalyticsEmail) => void
  onCancelAllFollowUps?: (e: AnalyticsEmail) => void
  onViewReport?: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const a = email.analyticsStatus || {}
  const isBounced = email.status === 'bounced'

  const statusBadge = () => {
    if (isBounced) return <Badge variant="outline" className="text-[9px] px-1 h-4 text-red-400 border-red-500/30 bg-red-500/10">Bounced</Badge>
    if (a.replied) return <Badge variant="outline" className="text-[9px] px-1 h-4 text-purple-400 border-purple-500/30 bg-purple-500/10">Replied</Badge>
    if (a.clicked) return <Badge variant="outline" className="text-[9px] px-1 h-4 text-yellow-400 border-yellow-500/30 bg-yellow-500/10">Clicked</Badge>
    if (a.opened) return <Badge variant="outline" className="text-[9px] px-1 h-4 text-green-400 border-green-500/30 bg-green-500/10">Opened{(a.openCount || 0) > 1 ? ` ×${a.openCount}` : ''}</Badge>
    if (a.hasProxy) return <Badge variant="outline" className="text-[9px] px-1 h-4 text-blue-400 border-blue-500/30 bg-blue-500/10">Primary inbox</Badge>
    return <Badge variant="outline" className="text-[9px] px-1 h-4 text-muted-foreground">Sent</Badge>
  }

  const followUpBadge = () => {
    const rc  = email.rebumpCount  ?? 0
    const max = email.maxFollowUps ?? 1
    const hasFuture = !!email.followUpDate
    const done      = rc >= max && max > 0
    const hasSent   = rc > 0

    // nothing at all to show
    if (!hasFuture && !hasSent && !done) return null

    const overdue = hasFuture && !done && new Date(email.followUpDate!) <= new Date()
    const dateStr = hasFuture ? new Date(email.followUpDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

    let cls = 'text-[9px] px-1.5 h-5 cursor-pointer '
    let label = ''
    if (done) {
      cls += 'text-green-400 border-green-500/30 bg-green-500/10'
      label = `${rc}/${max} done`
    } else if (hasSent && hasFuture) {
      cls += 'text-purple-400 border-purple-500/30 bg-purple-500/10'
      label = `${rc}/${max} sent · next ${dateStr}`
    } else if (hasSent) {
      cls += 'text-purple-400 border-purple-500/30 bg-purple-500/10'
      label = `${rc} follow-up${rc > 1 ? 's' : ''} sent`
    } else if (overdue) {
      cls += 'text-orange-400 border-orange-500/30 bg-orange-500/10'
      label = `overdue ${dateStr}`
    } else if (hasFuture) {
      cls += 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      label = max > 1 ? `${max} follow-ups · ${dateStr}` : `follow-up ${dateStr}`
    }

    return (
      <Badge variant="outline" className={cls} onClick={e => { e.stopPropagation(); onEditFollowUp(email) }} title="Click to edit follow-up date">
        <CalendarClock className="w-2.5 h-2.5 mr-0.5 inline" />{label}
      </Badge>
    )
  }

  const followUpStatus = () => {
    const rc  = email.rebumpCount  ?? 0
    const max = email.maxFollowUps ?? 1
    if (a.replied) return <span className="text-muted-foreground">Awaiting your response</span>
    if (email.followUpDate) {
      const overdue = new Date(email.followUpDate) <= new Date()
      const days = Math.ceil((new Date(email.followUpDate).getTime() - Date.now()) / 86400000)
      return overdue
        ? <span className="text-orange-500">Overdue</span>
        : <span className="text-muted-foreground">Scheduled in {days} day{days !== 1 ? 's' : ''}</span>
    }
    if (rc >= max && max > 0) return <span className="text-green-600 dark:text-green-400">Done ({rc}/{max})</span>
    if (rc > 0) return <span className="text-muted-foreground">{rc} sent</span>
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <>
      <tr className={cn('border-b last:border-0 cursor-pointer transition-colors', expanded ? 'bg-primary/5' : 'hover:bg-muted/30')} onClick={() => setExpanded(p => !p)}>
        {selectionMode && (
          <td className="py-2.5 pl-3 pr-1" onClick={e => e.stopPropagation()}>
            <input type="checkbox" className="w-3.5 h-3.5" checked={!!selected} onChange={onToggleSelect} />
          </td>
        )}
        <td className="py-2.5 px-3">
          <p className="text-sm font-medium truncate max-w-[220px]">{leadName(email)}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[220px]">{leadCompany(email)}</p>
        </td>
        <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(sentDate(email))}</td>
        <td className="py-2.5 px-3">{statusBadge()}</td>
        <td className="py-2.5 px-3 text-xs">{a.opened ? (a.openCount || 1) : 0}</td>
        <td className="py-2.5 px-3 text-xs">{a.replied ? 1 : 0}</td>
        <td className="py-2.5 px-3 text-xs whitespace-nowrap">{followUpStatus()}</td>
        <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
          {(onScheduleFollowUp || onSendNow || onCancelAllFollowUps) && !isBounced && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-muted transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs min-w-[160px]">
                {onScheduleFollowUp && !email.followUpScheduled && !email.isRebump && (
                  <DropdownMenuItem onClick={() => onScheduleFollowUp(email)} className="text-xs gap-2">
                    <CalendarClock className="w-3 h-3" /> Schedule follow-up
                  </DropdownMenuItem>
                )}
                {email.followUpScheduled && (
                  <DropdownMenuItem onClick={() => onEditFollowUp(email)} className="text-xs gap-2">
                    <CalendarClock className="w-3 h-3" /> Edit schedule
                  </DropdownMenuItem>
                )}
                {onSendNow && !email.isRebump && (
                  <>
                    {(onScheduleFollowUp && !email.followUpScheduled) || email.followUpScheduled ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem onClick={() => onSendNow(email)} className="text-xs gap-2">
                      <Zap className="w-3 h-3 text-yellow-400" /> Send follow-up now
                    </DropdownMenuItem>
                  </>
                )}
                {onCancelAllFollowUps && (email.followUpScheduled || (email.rebumpCount ?? 0) > 0) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onCancelAllFollowUps(email)} className="text-xs gap-2 text-destructive focus:text-destructive">
                      <X className="w-3 h-3" /> Cancel all follow-ups
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b last:border-0 bg-muted/20">
          <td colSpan={selectionMode ? 8 : 7} className="px-3 pb-3 pt-1">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><span className="font-medium text-foreground mr-1">To</span>{email.to || email.recipient}{(email.to || email.recipient) && <CopyChip text={(email.to || email.recipient)!} title="Copy recipient email" />}</div>
              <div><span className="font-medium text-foreground mr-1">Sent</span>{sentDate(email) ? new Date(sentDate(email)).toLocaleString() : '-'}</div>
              <div className="col-span-2"><span className="font-medium text-foreground mr-1">Subject</span>{email.subject}</div>
              {email.followUpDate && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <CalendarClock className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="font-medium text-foreground">Follow-up</span>
                  {new Date(email.followUpDate).toLocaleString()}
                  {(email.rebumpCount ?? 0) > 0 && <span className="text-muted-foreground">· {email.rebumpCount} sent</span>}
                </div>
              )}
              {email.body && (
                <div className="col-span-2">
                  <span className="font-medium text-foreground mr-1">Body</span>
                  <CopyChip text={stripFooter(email.body)} title="Copy email content" />
                  <span className="whitespace-pre-wrap block mt-0.5">{stripFooter(email.body)}</span>
                </div>
              )}
              {email.aiReport && onViewReport && (
                <div className="col-span-2 pt-1">
                  <button
                    onClick={e => { e.stopPropagation(); onViewReport() }}
                    className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity font-medium"
                  >
                    <FileText className="w-3 h-3" />
                    View Research Report
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── edit follow-up modal ──────────────────────────────────────────────────────
// ── follow-up row (shows actual follow-up sent, not original email) ───────────
function FollowUpRow({ email, onEditFollowUp, onCancelFollowUp, onRetryFollowUp }: { email: AnalyticsEmail; onEditFollowUp: (e: AnalyticsEmail) => void; onCancelFollowUp?: (e: AnalyticsEmail) => void; onRetryFollowUp?: (e: AnalyticsEmail) => void }) {
  const [expanded, setExpanded] = useState(false)
  const rc  = email.rebumpCount  ?? 0
  const max = email.maxFollowUps ?? 1
  const lastSent = email.lastRebumpAt || email.lastFollowUpSentAt
  const templateSubject = email.assignedTemplate?.subject || email.subject
  const templateName    = email.assignedTemplate?.name
  const templateBody    = email.assignedTemplate?.body
  const isScheduled = rc === 0 && email.followUpScheduled
  const isSmart = !!email.isSmartFollowUp
  const nextDate = email.followUpDate ? new Date(email.followUpDate) : null
  const isOverdue = nextDate && nextDate <= new Date() && !isScheduled

  return (
    <div
      className={cn('py-3 px-1 border-l-2 pl-3 transition-colors cursor-pointer',
        expanded ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/30')}
      onClick={() => setExpanded(p => !p)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* contact line */}
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="font-medium text-sm text-foreground">{leadName(email)}</span>
            {leadCompany(email) && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Building2 className="w-2.5 h-2.5" />{leadCompany(email)}
              </span>
            )}
          </div>
          {/* follow-up subject */}
          <p className="text-sm text-foreground truncate flex items-center gap-1.5">
            {isScheduled
              ? isSmart
                ? <><Sparkles className="w-3 h-3 text-purple-400 shrink-0" /><span className="truncate">{templateSubject || 'Smart AI follow-up'}</span></>
                : `Scheduled: ${templateSubject || '(no subject)'}`
              : `Re: ${templateSubject || email.subject || '(no subject)'}`
            }
          </p>
          {/* meta row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
            {isScheduled ? (
              <>
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-blue-400 border-blue-500/30 bg-blue-500/10">
                  <CalendarClock className="w-2.5 h-2.5 mr-0.5 inline" />
                  Scheduled {nextDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Badge>
                {isOverdue && (
                  <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-orange-400 border-orange-500/30 bg-orange-500/10">Overdue</Badge>
                )}
                <button
                  title="Edit follow-up"
                  onClick={e => { e.stopPropagation(); onEditFollowUp(email) }}
                  className="text-[9px] px-1 h-4 rounded border border-border text-muted-foreground hover:bg-muted flex items-center gap-0.5 transition-colors"
                >
                  <FileText className="w-2.5 h-2.5" /> Edit
                </button>
                {onCancelFollowUp && (
                  <button
                    title="Cancel follow-up"
                    onClick={e => { e.stopPropagation(); onCancelFollowUp(email) }}
                    className="text-[9px] px-1 h-4 rounded border border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:text-destructive flex items-center gap-0.5 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" /> Cancel current
                  </button>
                )}              </>
            ) : (
              <>
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-purple-400 border-purple-500/30 bg-purple-500/10">
                  Follow-up {rc > 1 ? `#${rc}` : ''} of {max}
                </Badge>
                {lastSent && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />sent {timeAgo(lastSent)}
                  </span>
                )}
                {nextDate && rc < max && (
                  <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-blue-400 border-blue-500/30 bg-blue-500/10 cursor-pointer"
                    onClick={e => { e.stopPropagation(); onEditFollowUp(email) }}>
                    <CalendarClock className="w-2.5 h-2.5 mr-0.5 inline" />
                    follow-up {rc + 1} of {max} · {nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {nextDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Badge>
                )}
                {rc >= max && (
                  <Badge variant="outline" className="text-[9px] px-1.5 h-4 gap-1 text-green-400 border-green-500/30 bg-green-500/10"><Check className="w-2.5 h-2.5" /> done</Badge>
                )}
                {onRetryFollowUp && (
                  <button
                    title="Retry follow-up now"
                    onClick={e => { e.stopPropagation(); onRetryFollowUp(email) }}
                    className="text-[9px] px-1 h-4 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex items-center gap-0.5 transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Retry
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div><span className="font-medium text-foreground mr-1">To</span>{email.to || email.recipient}</div>
            {lastSent && <div><span className="font-medium text-foreground mr-1">Follow-up sent</span>{new Date(lastSent).toLocaleString()}</div>}
            <div><span className="font-medium text-foreground mr-1">Original sent</span>{sentDate(email) ? new Date(sentDate(email)).toLocaleString() : '-'}</div>
            <div><span className="font-medium text-foreground mr-1">Count</span>{rc} / {max}</div>
            {templateName && <div className="col-span-2"><span className="font-medium text-foreground mr-1">Template</span>{templateName}</div>}
            {nextDate && rc < max && (
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="font-medium text-foreground">Next follow-up</span>
                {nextDate.toLocaleString()}
              </div>
            )}
          </div>
          {templateBody && (
            <div><span className="font-medium text-foreground">Follow-up body</span><p className="mt-1 whitespace-pre-wrap">{templateBody}</p></div>
          )}
        </div>
      )}
    </div>
  )
}

function ReplyRow({ reply, highlighted, onOpen }: { reply: ReplyConversation; highlighted: boolean; onOpen: (reply: ReplyConversation) => void }) {
  return (
    <button
      type="button"
      className={cn(
        'w-full py-3 px-1 border-l-2 pl-3 transition-colors text-left',
        highlighted ? 'border-l-primary bg-primary/10' : 'border-l-transparent hover:bg-muted/30'
      )}
      onClick={() => onOpen(reply)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="font-medium text-sm text-foreground">{reply.leadName || reply.leadEmail}</span>
            {reply.company && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" />{reply.company}</span>}
          </div>
          <p className="text-sm text-foreground truncate">{reply.subject || '(no subject)'}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reply.preview || 'Reply received'}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{timeAgo(reply.lastActivityAt || reply.lastReplyAt)}</span>
            {reply.classification && reply.classification !== 'neutral' && <Badge variant="outline" className={cn('text-[9px] px-1.5 h-4', replyBadgeClasses('classification', reply.classification))}>{replyClassText(reply.classification)}</Badge>}
            {reply.status && <Badge variant="outline" className={cn('text-[9px] px-1.5 h-4', replyBadgeClasses('status', reply.status))}>{replyClassText(reply.status)}</Badge>}
            {reply.sentiment && reply.sentiment !== 'neutral' && reply.sentiment !== reply.classification && <Badge variant="outline" className={cn('text-[9px] px-1.5 h-4', replyBadgeClasses('sentiment', reply.sentiment))}>{replyClassText(reply.sentiment)}</Badge>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-muted-foreground text-[11px] pt-0.5">
          <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3 text-green-400" />{reply.replyCount}</span>
          {reply.aiReplyCount > 0 && <span className="flex items-center gap-0.5"><Bot className="w-3 h-3 text-purple-400" />{reply.aiReplyCount}</span>}
        </div>
      </div>
    </button>
  )
}

function ReplyDetailModal({ reply, onClose }: { reply: ReplyConversation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-4xl w-full max-h-[88vh] overflow-hidden p-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border bg-background">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h3 className="text-base font-semibold text-foreground">{reply.leadName || reply.leadEmail}</h3>
              {reply.company && <span className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />{reply.company}</span>}
            </div>
            <p className="text-sm text-foreground truncate">{reply.subject || '(no subject)'}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
              {reply.classification && reply.classification !== 'neutral' && <Badge variant="outline" className={cn('text-[10px] px-1.5 h-5', replyBadgeClasses('classification', reply.classification))}>{replyClassText(reply.classification)}</Badge>}
              {reply.status && <Badge variant="outline" className={cn('text-[10px] px-1.5 h-5', replyBadgeClasses('status', reply.status))}>{replyClassText(reply.status)}</Badge>}
              {reply.sentiment && reply.sentiment !== 'neutral' && reply.sentiment !== reply.classification && <Badge variant="outline" className={cn('text-[10px] px-1.5 h-5', replyBadgeClasses('sentiment', reply.sentiment))}>{replyClassText(reply.sentiment)}</Badge>}
              <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(reply.lastActivityAt || reply.lastReplyAt)}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-5 py-3 border-b border-border bg-muted/20 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-muted-foreground">
          <div><span className="font-medium text-foreground mr-1">Email</span>{reply.leadEmail}</div>
          <div><span className="font-medium text-foreground mr-1">Thread</span><span className="font-mono text-[11px]">{reply.trackingId}</span></div>
          <div><span className="font-medium text-foreground mr-1">Lead replies</span>{reply.replyCount}</div>
          <div><span className="font-medium text-foreground mr-1">AI responses</span>{reply.aiReplyCount}</div>
        </div>

        <div className="overflow-y-auto p-5 space-y-3 bg-muted/10">
          {reply.messages.map((message) => (
            <div key={message.id} className={cn('max-w-[88%] rounded-lg p-3 text-sm border', message.type === 'reply' ? 'mr-auto bg-card border-border' : 'ml-auto bg-primary/10 border-primary/20')}>
              <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{message.type === 'reply' ? (message.name || reply.leadName || 'Lead') : message.type === 'manual' ? 'You' : message.type === 'ai_response' ? 'AI' : 'Agent'}</span>
                <span>· {timeAgo(message.timestamp)}</span>
              </div>
              <p className="whitespace-pre-wrap text-foreground">{message.content || message.subject || 'No content'}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function EditFollowUpModal({ email, onClose, onSaved }: { email: AnalyticsEmail; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(email.followUpDate ? new Date(email.followUpDate).toISOString().slice(0, 16) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))
  const [subject, setSubject] = useState(email.assignedTemplate?.subject || '')
  const [body, setBody] = useState(email.assignedTemplate?.body || '')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { agentId: email.agentId, followUpDate: new Date(date).toISOString() }
      if (subject || body) payload.assignedTemplate = { ...email.assignedTemplate, subject, body }
      await api.put(`/api/email-queue/${email.id || email.trackingId}/followup`, payload)
      onSaved(); onClose()
    } catch { /* silent */ }
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Edit Follow-up</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Send date</label>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line…" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Email body…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
        </div>
        <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
      </Card>
    </div>
  )
}

// ── mass reschedule modal ─────────────────────────────────────────────────────
function MassRescheduleModal({ emails, onClose, onSaved }: { emails: AnalyticsEmail[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await Promise.all(emails.map(e => api.put(`/api/email-queue/${e.id || e.trackingId}/followup`, { agentId: e.agentId, followUpDate: new Date(date).toISOString() }))); onSaved(); onClose() } catch { /* silent */ }
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Reschedule {emails.length} follow-ups</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Reschedule All'}</Button></div>
      </Card>
    </div>
  )
}

// ── mass follow-up modal ──────────────────────────────────────────────────────
function MassFollowUpModal({ agent, templates, eligibleEmails, onClose, onSent }: {
  agent: AgentFull; templates: Array<{ name: string; subject: string; body: string }>; eligibleEmails: AnalyticsEmail[]; onClose: () => void; onSent: () => void
}) {
  const [sending, setSending] = useState(false)
  const schedule = async (template: { name: string; subject: string; body: string }) => {
    setSending(true)
    try { await api.post('/api/email-queue/schedule-mass-followup', { agentId: agent.agentId, template, eligibleEmails: eligibleEmails.map(e => e.id || e.trackingId) }); onSent(); onClose() } catch { /* silent */ }
    setSending(false)
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div><h3 className="font-semibold">Schedule Mass Follow-up</h3><p className="text-xs text-muted-foreground mt-0.5">{eligibleEmails.length} eligible · {agent.name}</p></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        {templates.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No templates for this agent yet</p> : (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <button key={i} disabled={sending} onClick={() => schedule(t)} className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Subject: {t.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.body}</p>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground border-t border-border pt-3">This will queue follow-ups for all eligible sent emails from this agent</p>
      </Card>
    </div>
  )
}

const PAGE_SIZE = 20

function Pagination({ page, total, pageSize = PAGE_SIZE, onChange }: {
  page: number; total: number; pageSize?: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between pt-3 mt-2 border-t border-border text-xs text-muted-foreground">
      <span>{start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        ><ChevronLeft className="w-3.5 h-3.5" /></button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | '...')[]>((acc, p, i, arr) => {
            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
            acc.push(p); return acc
          }, [])
          .map((p, i) => p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1">…</span>
          ) : (
            <button key={p}
              onClick={() => onChange(p as number)}
              className={cn('w-7 h-7 flex items-center justify-center rounded-md border text-xs font-medium transition-colors',
                p === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              )}
            >{p}</button>
          ))
        }
        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        ><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

// ── TemplatesPanel ────────────────────────────────────────────────────────────
type Template = { name: string; subject: string; body: string }

function TemplatesPanel({ agent, templates, onMutate, onMassFollowUp, saved, followUps }: {
  agent: AgentFull
  templates: Template[]
  onMutate: (agent: AgentFull, partial: NonNullable<AgentFull['settings']>['emailBuilder']) => void
  onMassFollowUp: () => void
  saved: boolean
  followUps: AnalyticsEmail[]
}) {
  const [adding, setAdding] = useState(false)
  const [newT, setNewT] = useState<Template>({ name: '', subject: '', body: '' })

  const saveNew = () => {
    if (!newT.subject.trim() || !newT.body.trim()) return
    const updated = [...templates, { ...newT, name: newT.name || `Template ${templates.length + 1}` }]
    onMutate(agent, { useTemplates: true } as any)
    // save via settings update - store in followUpTemplates
    api.put(`/api/auth/agents/${agent.agentId}/settings`, {
      ...agent.settings,
      followUpTemplates: { ...agent.settings?.followUpTemplates, templates: updated }
    }).catch(() => {})
    setAdding(false)
    setNewT({ name: '', subject: '', body: '' })
  }

  const deleteTemplate = (i: number) => {
    const updated = templates.filter((_, idx) => idx !== i)
    api.put(`/api/auth/agents/${agent.agentId}/settings`, {
      ...agent.settings,
      followUpTemplates: { ...agent.settings?.followUpTemplates, templates: updated }
    }).catch(() => {})
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Templates</p>
          <p className="text-xs text-muted-foreground mt-0.5">Used as fallback when Smart Follow-ups is off or fails</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAdding(p => !p)}>+ Add template</Button>
          <Button size="sm" className="h-8 text-xs" onClick={onMassFollowUp}>+ Mass Follow-up</Button>
        </div>
      </div>

      {adding && (
        <Card className="p-4 space-y-3 border-primary/30">
          <p className="text-xs font-semibold text-primary">New Template</p>
          <input placeholder="Name (optional)" value={newT.name} onChange={e => setNewT(p => ({ ...p, name: e.target.value }))}
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          <input placeholder="Subject - use {name}, {company}, {topic}, {days_ago}" value={newT.subject} onChange={e => setNewT(p => ({ ...p, subject: e.target.value }))}
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          <textarea placeholder="Body - use {name}, {company}, {topic}, {days_ago}" value={newT.body} onChange={e => setNewT(p => ({ ...p, body: e.target.value }))} rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={saveNew}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {templates.length === 0 && !adding ? (
        <Card className="p-8 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No templates yet</p>
          <p className="text-xs text-muted-foreground mt-1">Auto-generated weekly, or add your own above.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4">{i + 1}</Badge>
                  <p className="font-semibold text-sm">{t.name}</p>
                </div>
                <button onClick={() => deleteTemplate(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Subject</p>
                  <p className="text-xs bg-muted/40 rounded px-2.5 py-1.5 font-mono">{t.subject}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Body</p>
                  <p className="text-xs bg-muted/40 rounded px-2.5 py-2 whitespace-pre-wrap leading-relaxed">{t.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {saved && <div className="flex items-center gap-1.5 text-green-500 text-xs"><Check className="w-3.5 h-3.5" /> Saved</div>}
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
type Tab = 'sent' | 'replies' | 'followups' | 'templates' | 'unsubscribed' | 'chat-sessions'

function isValidTab(value: string | null): value is Tab {
  return value === 'sent' || value === 'replies' || value === 'followups' || value === 'templates' || value === 'unsubscribed' || value === 'chat-sessions'
}

export function ContactedContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const urlTab: Tab = isValidTab(tabParam) ? tabParam : 'sent'
  const [tab, setTab] = useState<Tab>(urlTab)
  const highlightedTrackingId = searchParams.get('trackingId')
  const agentIdFromUrl = searchParams.get('agentId')

  // Sync tab whenever the URL search param changes (sidebar clicks)
  useEffect(() => { setTab(urlTab) }, [urlTab])
  const [emails, setEmails]               = useState<AnalyticsEmail[]>([])
  const [replies, setReplies]             = useState<ReplyConversation[]>([])
  const [unsubscribeList, setUnsubscribeList] = useState<UnsubscribeRecord[]>([])
  const [agents, setAgents]               = useState<AgentFull[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentFull | null>(null)
  const [agentFilter, setAgentFilter]     = useState('all')
  const [search, setSearch]               = useState('')
  const [loading, setLoading]             = useState(true)
  const [sentPage, setSentPage]           = useState(1)
  const [repliesPage, setRepliesPage]     = useState(1)
  const [followUpsPage, setFollowUpsPage] = useState(1)
  const [selectedReply, setSelectedReply] = useState<ReplyConversation | null>(null)
  const [chatSessions, setChatSessions]   = useState<any[]>([])
  const [chatSessionsLoading, setChatSessionsLoading] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [editFollowUpEmail, setEditFollowUpEmail] = useState<AnalyticsEmail | null>(null)
  const [activeReport, setActiveReport]           = useState<AIReport | null>(null)
  const [showMassReschedule, setShowMassReschedule]       = useState(false)
  const [showMassFollowUpModal, setShowMassFollowUpModal] = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [pendingInterval, setPendingInterval]   = useState<number | null>(null)
  const [pendingMaxRebumps, setPendingMaxRebumps] = useState<number | null>(null)
  useEffect(() => { setPendingInterval(null); setPendingMaxRebumps(null) }, [selectedAgent?.agentId])

  useEffect(() => {
    if (agentIdFromUrl) {
      setAgentFilter(agentIdFromUrl)
      return
    }

    setAgentFilter('all')
  }, [agentIdFromUrl])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = agentFilter !== 'all' ? { agentId: agentFilter } : {}
      const [emailRes, repliesRes, unsubRes] = await Promise.all([
        api.get('/api/analytics/emails', { params }),
        api.get('/api/replies', { params: { ...params, timeRange: '30d' } }).catch(() => null),
        api.get('/api/unsubscribe/list').catch(() => null),
      ])
      // api.get returns { data: { data: [...] } } when analytics wraps it, or { data: [...] }
      const raw = emailRes.data?.data ?? emailRes.data ?? []
      const list: AnalyticsEmail[] = Array.isArray(raw) ? raw : []
      setEmails([...list].sort((a, b) => new Date(sentDate(b)).getTime() - new Date(sentDate(a)).getTime()))
      setReplies(repliesRes?.data?.data?.replies || [])
      setUnsubscribeList(unsubRes?.data?.unsubscribes || [])
    } catch { /* silent */ }
    setLoading(false)
  }, [agentFilter])

  const cancelFollowUp = useCallback(async (email: AnalyticsEmail) => {
    try {
      await api.delete(`/api/email-queue/${email.id || email.trackingId}/followup`, { data: { agentId: email.agentId } })
      load()
    } catch { /* silent */ }
  }, [load])

  const retryFollowUp = useCallback(async (email: AnalyticsEmail) => {
    try {
      await api.post(`/api/email-queue/${email.id || email.trackingId}/followup/retry`, { agentId: email.agentId })
      load()
    } catch { /* silent */ }
  }, [load])

  const scheduleFollowUp = useCallback(async (email: AnalyticsEmail) => {
    try {
      await api.post(`/api/email-queue/${email.id || email.trackingId}/followup/schedule`, { agentId: email.agentId })
      load()
    } catch { /* silent */ }
  }, [load])

  const loadAgents = useCallback(async () => {
    try {
      const r = await api.get('/api/auth/agents')
      const list: AgentFull[] = r.data?.agents ?? []
      setAgents(list)
      if (list.length > 0 && !selectedAgent) setSelectedAgent(list[0])
    } catch { /* silent */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); loadAgents() }, [load, loadAgents])

  // Fire overdue follow-ups on mount
  useEffect(() => { api.post('/api/outreach/send-overdue', { agentId: 'all' }).catch(() => {}) }, [])

  const sent      = useMemo(() => emails, [emails])
  const followUps = useMemo(() => emails.filter(e =>
    (e.rebumpCount ?? 0) > 0 || e.followUpScheduled === true
  ), [emails])
  const unsubscribedEmails = useMemo(() => emails.filter(e => e.unsubscribed), [emails])

  const applySearch = (list: AnalyticsEmail[]) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(e =>
      leadName(e).toLowerCase().includes(q) ||
      (e.to || '').toLowerCase().includes(q) ||
      (e.subject || '').toLowerCase().includes(q) ||
      leadCompany(e).toLowerCase().includes(q)
    )
  }

  // Reset to page 1 when search or tab changes
  useEffect(() => { setSentPage(1); setRepliesPage(1); setFollowUpsPage(1) }, [search, tab])

  const displayedSent      = applySearch(sent)
  const displayedReplies   = useMemo(() => {
    if (!search.trim()) return replies
    const q = search.toLowerCase()
    return replies.filter((reply) =>
      (reply.leadName || '').toLowerCase().includes(q) ||
      (reply.leadEmail || '').toLowerCase().includes(q) ||
      (reply.company || '').toLowerCase().includes(q) ||
      (reply.subject || '').toLowerCase().includes(q) ||
      (reply.preview || '').toLowerCase().includes(q) ||
      (reply.classification || '').toLowerCase().includes(q)
    )
  }, [replies, search])

    useEffect(() => {
      if (!highlightedTrackingId) return
      const highlightedReply = replies.find((reply) => reply.trackingId === highlightedTrackingId)
      if (highlightedReply) setSelectedReply(highlightedReply)
    }, [highlightedTrackingId, replies])

    useEffect(() => {
      if (!selectedReply) return
      const updatedReply = replies.find((reply) => reply.trackingId === selectedReply.trackingId)
      if (updatedReply) setSelectedReply(updatedReply)
    }, [replies, selectedReply])
  const displayedFollowUps = applySearch(followUps)
  const pagedSent      = displayedSent.slice((sentPage - 1) * PAGE_SIZE, sentPage * PAGE_SIZE)
  const pagedReplies   = displayedReplies.slice((repliesPage - 1) * PAGE_SIZE, repliesPage * PAGE_SIZE)
  const pagedFollowUps = displayedFollowUps.slice((followUpsPage - 1) * PAGE_SIZE, followUpsPage * PAGE_SIZE)
  const agentTemplates     = selectedAgent?.settings?.followUpTemplates?.templates ?? []

  const fetchChatSessions = useCallback(async (agId?: string) => {
    const id = agId || selectedAgent?.agentId
    if (!id) return
    setChatSessionsLoading(true)
    try {
      const r = await api.get('/api/chat-lab/sessions', { params: { agentId: id, limit: 100 } })
      setChatSessions(r.data?.sessions ?? [])
    } catch { setChatSessions([]) }
    finally { setChatSessionsLoading(false) }
  }, [selectedAgent?.agentId])

  const changeTab = (nextTab: Tab) => {
    setTab(nextTab)
    if (nextTab === 'chat-sessions') fetchChatSessions()
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    if (nextTab !== 'replies') params.delete('trackingId')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const eligibleForMassFollowUp = useMemo(() => {
    if (!selectedAgent) return []
    const max = selectedAgent.settings?.emailBuilder?.maxRebumps ?? 1
    return sent.filter(e => e.agentId === selectedAgent.agentId && (e.rebumpCount ?? 0) < max)
  }, [sent, selectedAgent])

  const updateAgentSettings = async (agentId: string, settings: AgentFull['settings']) => {
    try {
      await api.put(`/api/auth/agents/${agentId}/settings`, settings)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      await loadAgents()
    } catch { /* silent */ }
  }

  const mutateSelected = (agent: AgentFull, partial: NonNullable<AgentFull['settings']>['emailBuilder']) => {
    const newSettings = { ...agent.settings, emailBuilder: { ...agent.settings?.emailBuilder, ...partial } }
    updateAgentSettings(agent.agentId, newSettings)
    const updated = { ...agent, settings: newSettings }
    setSelectedAgent(updated)
    setAgents(prev => prev.map(a => a.agentId === agent.agentId ? updated : a))
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'sent',          label: 'Sent Emails',   count: sent.length },
    { id: 'replies',       label: 'Replies',        count: replies.length },
    { id: 'followups',     label: 'Follow-ups',     count: followUps.length },
    { id: 'unsubscribed',  label: 'Unsubscribed',   count: unsubscribeList.length },
    { id: 'templates',     label: 'Templates' },
    { id: 'chat-sessions', label: 'Chat Qualified Leads', count: chatSessions.length || undefined },
  ]

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <h1 className="font-display text-lg text-foreground">Sent</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tab !== 'templates' && (
            <div className="relative">
              <Bot className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="h-8 pl-7 pr-7 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring appearance-none">
                <option value="all">All Agents</option>
                {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={load}>
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => changeTab(t.id)}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-success-strong text-white' : 'text-foreground/70 hover:bg-accent')}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── SENT ─────────────────────────────────────────────────────────── */}
      {tab === 'sent' && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <input className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Search name, email, company, subject…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
            </div>
            {!selectionMode ? (
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => setSelectionMode(true)}>Select</Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                {selectedIds.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowMassReschedule(true)}>Reschedule</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={async () => {
                      const agentId = pagedSent.find(e => selectedIds.has(emailId(e)))?.agentId
                      if (!agentId) return
                      await api.post('/api/email-queue/schedule-mass-followup', { agentId, emailIds: [...selectedIds] })
                      load(); setSelectionMode(false); setSelectedIds(new Set())
                    }}>Schedule Follow-ups</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={async () => {
                      const selected = pagedSent.filter(e => selectedIds.has(emailId(e)))
                      await Promise.allSettled(selected.map(e => api.post(`/api/email-queue/${e.id || e.trackingId}/followup/retry`, { agentId: e.agentId })))
                      load(); setSelectionMode(false); setSelectedIds(new Set())
                    }}><Zap className="w-3 h-3 mr-1" />Send Now</Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}>Done</Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="animate-pulse space-y-1"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-1/2" /><div className="h-2 bg-muted rounded w-1/4" /></div>)}</div>
          ) : displayedSent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                {search ? <Search className="w-5 h-5 text-muted-foreground" /> : <Mail className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium">{search ? 'No results' : 'No sent emails yet'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{search ? `No emails match "${search}"` : 'Sent emails appear here after your agents send them.'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b bg-surface/40">
                      {selectionMode && <th className="py-2 pl-3 pr-1 w-8" />}
                      <th className="py-2 px-3 font-medium">Thread</th>
                      <th className="py-2 px-3 font-medium">Sent</th>
                      <th className="py-2 px-3 font-medium">Delivery</th>
                      <th className="py-2 px-3 font-medium">Opens</th>
                      <th className="py-2 px-3 font-medium">Replies</th>
                      <th className="py-2 px-3 font-medium">Follow-up</th>
                      <th className="py-2 px-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSent.map(e => (
                      <SentRow
                        key={emailId(e)}
                        email={e}
                        onEditFollowUp={setEditFollowUpEmail}
                        onScheduleFollowUp={scheduleFollowUp}
                        onSendNow={retryFollowUp}
                        onCancelAllFollowUps={cancelFollowUp}
                        onViewReport={e.aiReport ? () => setActiveReport(e.aiReport!) : undefined}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(emailId(e))}
                        onToggleSelect={() => setSelectedIds(prev => { const s = new Set(prev); s.has(emailId(e)) ? s.delete(emailId(e)) : s.add(emailId(e)); return s })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={sentPage} total={displayedSent.length} onChange={p => { setSentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            </>
          )}
        </div>
      )}

      {/* ── REPLIES ─────────────────────────────────────────────────────── */}
      {tab === 'replies' && (
        <Card className="p-5">
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Search replies by lead, company, subject, classification..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="animate-pulse space-y-1"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-1/2" /><div className="h-2 bg-muted rounded w-1/4" /></div>)}</div>
          ) : displayedReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center"><MessageSquare className="w-5 h-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm font-medium">{search ? 'No results' : 'No replies yet'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{search ? `No replies match "${search}"` : 'Inbound lead replies will appear here with classifications.'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {pagedReplies.map((reply) => <ReplyRow key={reply.trackingId} reply={reply} highlighted={highlightedTrackingId === reply.trackingId} onOpen={setSelectedReply} />)}
              </div>
              <Pagination page={repliesPage} total={displayedReplies.length} onChange={p => { setRepliesPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            </>
          )}
        </Card>
      )}

      {/* ── FOLLOW-UPS ───────────────────────────────────────────────────── */}
      {tab === 'followups' && (
        <div className="@container">
        <div className="grid grid-cols-1 @3xl:grid-cols-[1fr_280px] gap-4 items-start">
          {/* list */}
          <Card className="min-w-0 p-5">
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <input className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Search follow-ups…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
            </div>
            {loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="animate-pulse space-y-1"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-1/2" /></div>)}</div>
            ) : displayedFollowUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center"><CalendarClock className="w-5 h-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium">{search ? 'No results' : 'No follow-ups yet'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{search ? `No follow-ups match "${search}"` : 'Emails with scheduled or sent follow-ups will appear here.'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {pagedFollowUps.map((e, i) => <FollowUpRow key={emailId(e) || i} email={e} onEditFollowUp={setEditFollowUpEmail} onCancelFollowUp={cancelFollowUp} onRetryFollowUp={retryFollowUp} />)}
                </div>
                <Pagination page={followUpsPage} total={displayedFollowUps.length} onChange={p => { setFollowUpsPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
              </>
            )}
          </Card>

          {/* settings sidebar */}
          {selectedAgent && (
            <div className="min-w-0 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5 px-1"><Settings2 className="w-4 h-4" /> Follow-up Settings</p>

              <Card className="p-4 divide-y divide-border">
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <p className="text-sm font-medium">Auto Follow-ups</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Send rebumps automatically</p>
                  </div>
                  <button onClick={() => mutateSelected(selectedAgent, { enableRebump: !(selectedAgent.settings?.emailBuilder?.enableRebump !== false) })}
                    className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0', (selectedAgent.settings?.emailBuilder?.enableRebump !== false) ? 'bg-green-500' : 'bg-muted')}>
                    <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', (selectedAgent.settings?.emailBuilder?.enableRebump !== false) ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>

                <div className="py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium mb-1.5">Interval</p>
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={1} max={30}
                          value={pendingInterval ?? selectedAgent.settings?.emailBuilder?.rebumpIntervalDays ?? 7}
                          onChange={e => setPendingInterval(parseInt(e.target.value) || 7)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">days</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1.5">Max sends</p>
                      <input type="number" min={1} max={5}
                        value={pendingMaxRebumps ?? selectedAgent.settings?.emailBuilder?.maxRebumps ?? 1}
                        onChange={e => setPendingMaxRebumps(parseInt(e.target.value) || 1)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                  </div>
                  {(pendingInterval !== null || pendingMaxRebumps !== null) && (
                    <button
                      onClick={async () => {
                        const newInterval = pendingInterval ?? selectedAgent.settings?.emailBuilder?.rebumpIntervalDays ?? 7
                        const newMax = pendingMaxRebumps ?? selectedAgent.settings?.emailBuilder?.maxRebumps ?? 1
                        mutateSelected(selectedAgent, { rebumpIntervalDays: newInterval, maxRebumps: newMax })
                        if (pendingInterval !== null) {
                          await api.post('/api/email-queue/reschedule-pending-followups', { agentId: selectedAgent.agentId, intervalDays: newInterval }).catch(() => {})
                          load()
                        }
                        setPendingInterval(null)
                        setPendingMaxRebumps(null)
                      }}
                      className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      Save &amp; update scheduled
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-purple-400" /> Smart Follow-ups</p>
                      <p className="text-xs text-muted-foreground mt-0.5">AI-written per lead · real cost</p>
                    </div>
                    <button onClick={() => mutateSelected(selectedAgent, { smartRebump: !selectedAgent.settings?.emailBuilder?.smartRebump })}
                      className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0', selectedAgent.settings?.emailBuilder?.smartRebump ? 'bg-purple-500' : 'bg-muted')}>
                      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', selectedAgent.settings?.emailBuilder?.smartRebump ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                </div>
              </Card>

              {(() => {
                const pending = sent.filter(e =>
                  e.agentId === selectedAgent.agentId && e.followUpScheduled && (e.rebumpCount ?? 0) === 0
                )
                if (pending.length === 0) return null
                return (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground px-1 mb-2">Pending follow-ups ({pending.length})</p>
                    <div className="relative" style={{ height: Math.min(pending.length, 4) * 8 + 52 }}>
                      {pending.slice(0, 5).map((e, i) => (
                        <div key={e.id || e.trackingId}
                          className="absolute w-full bg-card border border-border rounded-lg px-3 py-2 flex items-center justify-between shadow-sm"
                          style={{ top: i * 8, zIndex: pending.length - i }}>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{leadName(e)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {leadCompany(e) && `${leadCompany(e)} · `}
                              {e.followUpDate ? new Date(e.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'scheduled'}
                            </p>
                          </div>
                          <button onClick={() => cancelFollowUp(e)} className="shrink-0 ml-2 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {saved && <div className="flex items-center gap-1.5 text-green-500 text-xs px-1"><Check className="w-3.5 h-3.5" /> Saved</div>}
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── UNSUBSCRIBED ─────────────────────────────────────────────────── */}
      {tab === 'unsubscribed' && (
        <Card className="p-5">
          {unsubscribeList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <UserCheck className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No unsubscribes</p>
              <p className="text-xs text-muted-foreground">Nobody has opted out yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {unsubscribeList.map(u => {
                const matched = emails.find(e => (e.to || '').toLowerCase() === u.email.toLowerCase())
                const name = matched ? leadName(matched) : u.email.split('@')[0]
                const company = matched ? leadCompany(matched) : ''
                const agent = matched ? agents.find(a => a.agentId === matched.agentId) : null
                return (
                  <div key={u.email} className="py-3 px-1 border-l-2 border-l-destructive/40 pl-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-sm text-foreground">{name}</span>
                          {company && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" />{company}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{timeAgo(u.timestamp)}</span>
                          {agent && <span className="flex items-center gap-1"><Bot className="w-2.5 h-2.5" />{agent.name}</span>}
                          {u.source && <span className="text-muted-foreground/60">{u.source === 'email_link' ? 'via email link' : 'manual'}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-red-400 border-red-500/30 bg-red-500/10 shrink-0">Unsubscribed</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── TEMPLATES ────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-4">
          {agents.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {agents.map(agent => (
                <button key={agent.agentId} onClick={() => setSelectedAgent(agent)}
                  className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                    selectedAgent?.agentId === agent.agentId ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border hover:bg-muted/50 text-muted-foreground')}>
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {agent.personality?.avatar
                      ? <img src={agent.personality.avatar} alt={agent.name} className="w-full h-full object-cover" />
                      : <span className="text-[9px] font-bold text-primary">{agent.name?.[0]?.toUpperCase()}</span>}
                  </div>
                  {agent.name}
                </button>
              ))}
            </div>
          )}

          {!selectedAgent ? (
            <Card className="flex items-center justify-center p-12 text-muted-foreground text-sm">Select an agent</Card>
          ) : (
            <TemplatesPanel agent={selectedAgent} templates={agentTemplates} onMutate={mutateSelected} onMassFollowUp={() => setShowMassFollowUpModal(true)} saved={saved} followUps={followUps} />
          )}
        </div>
      )}

      {/* ── MQL CHAT SESSIONS ───────────────────────────────────────────── */}
      {tab === 'chat-sessions' && (
        <Card className="p-5">
          <div className="mb-4 p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-sm font-medium">What is Chat Qualified Leads?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When a lead clicks the link in their outreach email, they land on a branded chat page where they can ask
              questions and get answers grounded in your knowledge base, instead of just reading a static email. Every
              conversation here is a lead actively engaging back with you - ranked by an intent score so you can see who's
              warming up. Configure what the chat knows (knowledge base, system prompt) under Prospecting → agent settings.
            </p>
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Chat sessions started by leads who clicked their link.</p>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => fetchChatSessions()}>
              <RefreshCw className={cn('w-3.5 h-3.5', chatSessionsLoading && 'animate-spin')} />
            </Button>
          </div>

          {chatSessionsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="animate-pulse space-y-1"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-1/2" /><div className="h-2 bg-muted rounded w-1/4" /></div>)}</div>
          ) : chatSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No chat sessions yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sessions appear here once leads click their chat link.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {chatSessions.map((s: any) => {
                const intentColor = s.intentScore >= 7
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                  : s.intentScore >= 4
                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                  : 'text-muted-foreground bg-muted'
                return (
                  <div key={s.sessionId} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{s.leadName || 'Unknown'}</span>
                        {s.leadCompany && <span className="text-xs text-muted-foreground">{s.leadCompany}</span>}
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', intentColor)}>
                          Intent {s.intentScore ?? 0}/10
                        </span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          s.status === 'active' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-muted text-muted-foreground')}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.messageCount ?? 0} messages · {timeAgo(s.createdAt)}</p>
                    </div>
                    <a
                      href={`/chat-lab?session=${s.sessionId}`}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      View in MQL Chat →
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* modals */}
      {activeReport && <AIReportModal report={activeReport} onClose={() => setActiveReport(null)} />}
      {editFollowUpEmail && <EditFollowUpModal email={editFollowUpEmail} onClose={() => setEditFollowUpEmail(null)} onSaved={load} />}
      {showMassReschedule && (
        <MassRescheduleModal emails={sent.filter(e => selectedIds.has(emailId(e)))} onClose={() => setShowMassReschedule(false)}
          onSaved={() => { setSelectedIds(new Set()); setSelectionMode(false); load() }} />
      )}
      {showMassFollowUpModal && selectedAgent && (
        <MassFollowUpModal agent={selectedAgent} templates={agentTemplates} eligibleEmails={eligibleForMassFollowUp}
          onClose={() => setShowMassFollowUpModal(false)} onSent={load} />
      )}
      {selectedReply && <ReplyDetailModal reply={selectedReply} onClose={() => setSelectedReply(null)} />}
    </div>
  )
}
