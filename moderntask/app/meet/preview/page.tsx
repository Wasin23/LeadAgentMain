'use client'

import { Suspense } from 'react'
import { PreviewChat } from '@/components/meet/preview-chat'

export default function MeetPreviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Loading...</div>}>
      <PreviewChat />
    </Suspense>
  )
}
