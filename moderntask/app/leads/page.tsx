'use client'

import { Suspense } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { LeadsContent } from '@/components/leads/leads-content'
import { CRMContent } from '@/components/crm/crm-content'
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
        <Header />

        {/* @container scoped to below the header, not <main> itself — container-type
            establishes CSS containment, which (like a lingering transform) silently breaks
            position:sticky for descendants. Header's sticky bar must stay outside it. */}
        <div className="@container">
        <div className="mb-5 flex items-center gap-6 border-b border-border">
          <button
            onClick={() => changeTab('leads')}
            className={`relative -mb-px px-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'leads' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Leads
            {tab === 'leads' && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
          </button>
          <button
            onClick={() => changeTab('crm')}
            className={`relative -mb-px px-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'crm' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            CRM
            {tab === 'crm' && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
          </button>
        </div>

        <div>
          {tab === 'leads' ? <LeadsContent /> : <CRMContent />}
        </div>
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
