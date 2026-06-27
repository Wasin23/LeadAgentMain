'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { EmailQueueContent } from '@/components/email-queue/email-queue-content'
import { ContactedContent } from '@/components/outreach/contacted-content'
import { CalendarMini } from '@/components/calendar/calendar-mini'
import { cn } from '@/lib/utils'
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:ml-64">
        <Header
          title="Outreach"
          description="Emails awaiting your approval, and everything already sent and tracked."
        />

        <div className="mt-5 flex items-center gap-1 border-b border-border">
          <button
            onClick={() => changeSection('awaiting')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              section === 'awaiting' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Awaiting Review{awaitingCount > 0 ? ` (${awaitingCount})` : ''}
          </button>
          <button
            onClick={() => changeSection('sent')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              section === 'sent' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Sent
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
          <div className="min-w-0">
            {section === 'awaiting'
              ? <EmailQueueContent />
              : <ContactedContent />}
          </div>
          <CalendarMini />
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
