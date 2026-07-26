'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

/**
 * Invisible component that subscribes to the backend SSE stream and shows an in-app toast
 * whenever a scheduled email batch fires, OR a real backend issue gets logged (Outlook/Gmail
 * reconnect needed, CRM sync failed, agent memory unavailable, etc.) — so a problem on the
 * backend surfaces immediately as a toast instead of silently sitting in the bell icon until
 * someone happens to open it, which reads as "the app is broken" rather than "here's what
 * happened." Routine low-severity issues (e.g. "email sent successfully") are intentionally
 * excluded so this doesn't turn into toast spam.
 * Mount once inside AuthProvider in layout.tsx.
 */
export function NotificationListener() {
  const { user } = useAuth()
  const { toast } = useToast()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Only connect when a user is logged in
    if (!user) {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      return
    }

    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('authToken') ?? '')
      : ''

    if (!token) return

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
    const url     = `${baseUrl}/api/monitoring/stream?token=${encodeURIComponent(token)}`

    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)

        // batch_send notification from sendingScheduleProcessor
        if (msg.type === 'notification' && msg.data) {
          toast({
            title:       msg.data.title   ?? 'Notification',
            description: msg.data.message ?? undefined,
            duration:    7000,
          })
        }

        // Real backend issues (utils/awsManager.js's addIssue) — Outlook/Gmail reconnect
        // needed, CRM sync failed, agent memory unavailable, etc. Only medium+ severity so
        // routine successes don't spam toasts.
        if (msg.type === 'activity_added' && msg.data?.type === 'issue') {
          const severity = msg.data.severity
          if (severity === 'critical' || severity === 'high' || severity === 'medium') {
            toast({
              title:       msg.data.message ?? 'Something needs attention',
              description: msg.data.details ?? undefined,
              variant:     (severity === 'critical' || severity === 'high') ? 'destructive' : undefined,
              duration:    9000,
            })
          }
        }
      } catch {
        // ignore malformed frames
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [user, toast])

  return null
}
