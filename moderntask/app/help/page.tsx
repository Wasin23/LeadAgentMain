'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { HelpContent } from "@/components/help/help-content"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"

export default function HelpPage() {
  const { user } = useAuth()
  const [notifCount, setNotifCount] = useState(0)

  const fetchMeta = useCallback(async () => {
    const [notifRes] = await Promise.allSettled([
      api.get('/api/notifications/count'),
    ])
    if (notifRes.status === 'fulfilled') {
      setNotifCount(notifRes.value.data?.unreadCount ?? 0)
    }
  }, [])

  useEffect(() => {
    if (user) fetchMeta()
  }, [user, fetchMeta])

  const userName    = (user as Record<string, unknown> | null)?.username as string | undefined
  const userEmail   = (user as Record<string, unknown> | null)?.email    as string | undefined
  const userPicture = (user as Record<string, unknown> | null)?.picture  as string | undefined

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 p-4 lg:p-6 lg:ml-64 overflow-y-auto">
        <Header
          title="Help & Support"
          description="Ask me anything about Meridian, or contact us directly."
          notificationCount={notifCount}
          userName={userName}
          userEmail={userEmail}
          userPicture={userPicture}
        />

        <div className="mt-6">
          <HelpContent />
        </div>
      </main>
    </div>
  )
}
