import { Suspense } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { ContactedContent } from '@/components/outreach/contacted-content'

export default function ContactedPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 space-y-6">
        <Header title="Contacted" description="All sent emails, follow-ups, and templates" />
        <Suspense fallback={null}>
          <ContactedContent />
        </Suspense>
      </main>
    </div>
  )
}
