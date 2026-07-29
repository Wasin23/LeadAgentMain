'use client'

import { Suspense, useState } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { OperationsContent } from '@/components/operations/operations-content'
import { AgentsContent } from '@/components/agents/agents-content'
import { PresetsContent } from '@/components/agents/presets-content'
import { ChatLabContent } from '@/components/chat-lab/chat-lab-content'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Send, MessageSquare, Activity, SlidersHorizontal, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { useEffect } from 'react'

type Section = 'monitor' | 'setup'

function isValidSection(value: string | null): value is Section {
  return value === 'monitor' || value === 'setup'
}

function BulkChatLinkToggle() {
  const [enabled, setEnabled] = useState<boolean>(false)
  const [applying, setApplying] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/auth/agents').then(async res => {
      const agents = (res.data?.agents ?? []).filter((a: { agentId: string }) => a.agentId !== 'orphan')
      if (agents.length === 0) { setLoading(false); return }
      const settings = await Promise.allSettled(
        agents.map((a: { agentId: string }) => api.get(`/api/lead-agent/settings?agentId=${a.agentId}`))
      )
      const allOn = settings.every(r => r.status === 'fulfilled' && r.value.data?.settings?.emailBuilder?.includeChatLink === true)
      setEnabled(allOn)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggle = async (next: boolean) => {
    setEnabled(next)
    setApplying(true)
    try {
      const agentsRes = await api.get('/api/auth/agents')
      const agents = (agentsRes.data?.agents ?? []).filter((a: { agentId: string }) => a.agentId !== 'orphan')
      for (const a of agents) {
        try {
          const currentRes = await api.get(`/api/lead-agent/settings?agentId=${a.agentId}`)
          const current = currentRes.data?.settings || {}
          await api.post('/api/lead-agent/settings', {
            ...current,
            agentId: a.agentId,
            emailBuilder: { ...(current.emailBuilder || {}), includeChatLink: next },
          })
        } catch { /* continue with remaining agents */ }
      }
    } catch {
      setEnabled(!next)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs">
      <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground">Include chat link in all agent emails</span>
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Switch checked={enabled} onCheckedChange={toggle} disabled={applying} />
      )}
      {applying && <span className="text-muted-foreground">Applying…</span>}
    </div>
  )
}

function ProspectingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section: Section = isValidSection(sectionParam) ? sectionParam : 'monitor'
  const setupTab = searchParams.get('tab') === 'presets' ? 'presets' : 'agents'
  const highlightAgent = searchParams.get('agent') ?? undefined
  const autoOpenCreate = searchParams.get('create') === 'true'

  const changeSection = (next: Section) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', next)
    router.push(`/prospecting?${params.toString()}`)
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
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <button
            onClick={() => changeSection('monitor')}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              section === 'monitor'
                ? 'border-border bg-card text-foreground shadow-[0_1px_0_oklch(0_0_0/0.02)]'
                : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-4 w-4" strokeWidth={1.75} />
            Monitor Agents
          </button>
          <button
            onClick={() => changeSection('setup')}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              section === 'setup'
                ? 'border-border bg-card text-foreground shadow-[0_1px_0_oklch(0_0_0/0.02)]'
                : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
            Agent Setup & Presets
          </button>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => router.push('/outreach?section=awaiting')}>
            <Send className="w-3.5 h-3.5" /> Send Emails
          </Button>
        </div>

        <div className="mt-5">
          {section === 'monitor' ? (
            <OperationsContent />
          ) : (
            <Tabs defaultValue={setupTab}>
              <div className="mb-4">
                <BulkChatLinkToggle />
              </div>
              <TabsList className="mb-5">
                <TabsTrigger value="agents">Agents</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
                <TabsTrigger value="chat-setup">Chat Setup</TabsTrigger>
              </TabsList>
              <TabsContent value="agents">
                <AgentsContent highlightAgentId={highlightAgent} autoOpenCreate={autoOpenCreate} />
              </TabsContent>
              <TabsContent value="presets">
                <PresetsContent />
              </TabsContent>
              <TabsContent value="chat-setup">
                <p className="text-xs text-muted-foreground mb-4">When a prospect clicks your chat link, they&apos;re dropped into a conversation with an AI that already knows who they are - built from your research report. Upload documents below so the AI can answer questions about your product, pricing, and use cases.</p>
                <ChatLabContent hideSessions />
              </TabsContent>
            </Tabs>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}

export default function ProspectingPage() {
  return (
    <Suspense fallback={null}>
      <ProspectingPageInner />
    </Suspense>
  )
}
