'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { OperationsContent } from '@/components/operations/operations-content'
import { AgentsContent } from '@/components/agents/agents-content'
import { PresetsContent } from '@/components/agents/presets-content'
import { ChatLabContent } from '@/components/chat-lab/chat-lab-content'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Send, Mail, Clock, Bot, MessageSquare, Activity, SlidersHorizontal } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'

type Section = 'monitor' | 'setup'

function isValidSection(value: string | null): value is Section {
  return value === 'monitor' || value === 'setup'
}

function GlobalStatRow() {
  const router = useRouter()
  const [stats, setStats] = useState({ sent: 0, queued: 0, cycles: 0, agents: 0, running: 0 })

  const load = useCallback(async () => {
    try {
      const [countsRes, agentsRes] = await Promise.allSettled([
        api.get('/api/email-queue/counts', { params: { agentId: 'all' } }),
        api.get('/api/auth/agents'),
      ])
      const counts = countsRes.status === 'fulfilled' ? countsRes.value.data : {}
      const agents = agentsRes.status === 'fulfilled' ? (agentsRes.value.data?.agents ?? []) : []
      const nonOrphan = agents.filter((a: Record<string, unknown>) => a.agentId !== 'orphan')
      setStats({
        sent: counts.sent ?? 0,
        queued: counts.queued ?? 0,
        cycles: counts.replied ?? 0,
        agents: nonOrphan.length,
        running: nonOrphan.filter((a: Record<string, unknown>) => a.isRunning === true || a.status === 'running').length,
      })
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const items = [
    { label: 'Sent', value: stats.sent, icon: Send, onClick: () => router.push('/outreach?section=sent') },
    { label: 'Queued', value: stats.queued, icon: Mail, onClick: () => router.push('/outreach?section=awaiting') },
    { label: 'Cycles', value: stats.cycles, icon: Clock, onClick: () => router.push('/home') },
    { label: 'Agents', value: stats.agents, sublabel: `${stats.running} running`, icon: Bot, onClick: () => router.push('/prospecting?section=setup&tab=agents') },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map(({ label, value, sublabel, icon: Icon, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left hover:border-primary/40 hover:bg-accent transition-colors"
        >
          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tabular-nums">{value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{sublabel ?? label}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function BulkChatLinkToggle() {
  const [applying, setApplying] = useState<'on' | 'off' | null>(null)

  const applyToAll = async (enabled: boolean) => {
    setApplying(enabled ? 'on' : 'off')
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
            emailBuilder: { ...(current.emailBuilder || {}), includeChatLink: enabled },
          })
        } catch { /* continue with remaining agents */ }
      }
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs">
      <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground">Chat link in emails — apply to all agents:</span>
      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={!!applying} onClick={() => applyToAll(true)}>
        {applying === 'on' ? 'Applying…' : 'Turn on for all'}
      </Button>
      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={!!applying} onClick={() => applyToAll(false)}>
        {applying === 'off' ? 'Applying…' : 'Turn off for all'}
      </Button>
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="@container flex-1 p-4 lg:p-6 lg:ml-64">
        <Header />

        <div className="mb-5">
          <GlobalStatRow />
        </div>

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
                <ChatLabContent hideSessions />
              </TabsContent>
            </Tabs>
          )}
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
