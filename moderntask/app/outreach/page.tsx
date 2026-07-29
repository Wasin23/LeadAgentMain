'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { EmailQueueContent } from '@/components/email-queue/email-queue-content'
import { ContactedContent } from '@/components/outreach/contacted-content'
import { CalendarMini } from '@/components/calendar/calendar-mini'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'

type Section = 'awaiting' | 'sent'

function isValidSection(value: string | null): value is Section {
  return value === 'awaiting' || value === 'sent'
}

function OutreachPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section: Section = isValidSection(sectionParam) ? sectionParam : 'awaiting'
  const [awaitingCount, setAwaitingCount] = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const r = await api.get('/api/email-queue/counts', { params: { agentId: 'all' } })
      setAwaitingCount(r.data?.queued ?? 0)
    } catch {}
  }, [])

  useEffect(() => { fetchCount() }, [fetchCount])

  const changeSection = (next: Section) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', next)
    router.push(`/outreach?${params.toString()}`)
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:ml-64 overflow-y-auto">
        <Header />

        {/* @container scoped to below the header, not <main> itself — container-type
            establishes CSS containment, which (like a lingering transform) silently breaks
            position:sticky for descendants. Header's sticky bar must stay outside it. */}
        <div className="@container">
        <div className="mb-5 border-b border-border">
          <div className="flex items-center gap-6">
            <button
              onClick={() => changeSection('awaiting')}
              className={`relative -mb-px flex items-center pb-3 pt-1 text-sm font-medium transition-colors ${
                section === 'awaiting' ? 'text-foreground border-b-2 border-success' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Awaiting Review
              <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums ${
                section === 'awaiting' ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {awaitingCount}
              </span>
            </button>
            <button
              onClick={() => changeSection('sent')}
              className={`relative -mb-px flex items-center pb-3 pt-1 text-sm font-medium transition-colors ${
                section === 'sent' ? 'text-foreground border-b-2 border-success' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sent
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 @5xl:grid-cols-[1fr_280px] gap-4 items-start">
          <div className="min-w-0">
            {section === 'awaiting'
              ? <EmailQueueContent />
              : <ContactedContent />}
          </div>
          <div className="min-w-0">
            <CalendarMini />
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

export default function OutreachPage() {
  return (
    <Suspense fallback={null}>
      <OutreachPageInner />
    </Suspense>
  )
}
