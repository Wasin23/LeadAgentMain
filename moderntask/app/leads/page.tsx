'use client'

import { Suspense } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { LeadsContent } from '@/components/leads/leads-content'
import { CRMContent } from '@/components/crm/crm-content'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab = 'leads' | 'crm'

function isValidTab(value: string | null): value is Tab {
  return value === 'leads' || value === 'crm'
}

function LeadsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: Tab = isValidTab(tabParam) ? tabParam : 'leads'

  const changeTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.push(`/leads?${params.toString()}`)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:ml-64">
        <Header
          title="Leads"
          description="Review, research, and route your leads."
        />

        <div className="mt-5 flex items-center gap-1 border-b border-border">
          <button
            onClick={() => changeTab('leads')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === 'leads' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            All Leads
          </button>
          <button
            onClick={() => changeTab('crm')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === 'crm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            CRM
          </button>
        </div>

        <div className="mt-5">
          {tab === 'leads' ? <LeadsContent /> : <CRMContent />}
        </div>
      </main>
    </div>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageInner />
    </Suspense>
  )
}
