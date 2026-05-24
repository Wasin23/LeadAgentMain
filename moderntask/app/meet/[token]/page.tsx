'use client'

import { Suspense } from 'react'
import { LeadChat } from '@/components/meet/lead-chat'

export default function MeetTokenPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading...</div>}>
      <LeadChat />
    </Suspense>
  )
}
