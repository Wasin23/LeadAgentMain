'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { GlobalSearch } from '@/components/dashboard/global-search'
import { OperationsContent } from '@/components/operations/operations-content'
import { AgentsContent } from '@/components/agents/agents-content'
import { PresetsContent } from '@/components/agents/presets-content'
import { ChatLabContent } from '@/components/chat-lab/chat-lab-content'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, Mail, Clock, CheckCircle2, Bot, MessageSquare } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

type Section = 'monitor' | 'setup'

function isValidSection(value: string | null): value is Section {
  return value === 'monitor' || value === 'setup'
}

function GlobalStatRow() {
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
    { label: 'Sent', value: stats.sent, icon: Send },
    { label: 'Queued', value: stats.queued, icon: Mail },
    { label: 'Cycles', value: stats.cycles, icon: Clock },
    { label: 'Agents', value: stats.agents, sublabel: `${stats.running} running`, icon: Bot },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map(({ label, value, sublabel, icon: Icon }) => (
        <Card key={label} className="px-3 py-2 flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tabular-nums">{value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{sublabel ?? label}</p>
          </div>
        </Card>
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
    <Card className="px-3 py-2 flex items-center gap-3 text-xs">
      <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground">Chat link in emails — apply to all agents:</span>
      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={!!applying} onClick={() => applyToAll(true)}>
        {applying === 'on' ? 'Applying…' : 'Turn on for all'}
      </Button>
      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={!!applying} onClick={() => applyToAll(false)}>
        {applying === 'off' ? 'Applying…' : 'Turn off for all'}
      </Button>
    </Card>
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
  const [creditBalance, setCreditBalance] = useState<number | null>(null)

  useEffect(() => {
    api.get('/api/plans/status').then(r => {
      const d = r.data
      const bal = Number(d.credits?.remaining ?? d.plan?.remainingCredits ?? 0)
      if (bal > 0) setCreditBalance(Math.round(bal))
    }).catch(() => {})
  }, [])

  const changeSection = (next: Section) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', next)
    router.push(`/prospecting?${params.toString()}`)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:ml-64">
        <Header
          title="Prospecting"
          description="Monitor and manage your AI outreach agents."
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <GlobalSearch />
          </div>
          {creditBalance !== null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium">
              Credits {creditBalance.toLocaleString()}
            </span>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => router.push('/outreach?section=awaiting')}>
            <Send className="w-3.5 h-3.5" /> Send Emails
          </Button>
        </div>

        <div className="mt-4">
          <GlobalStatRow />
        </div>

        <div className="mt-5 flex items-center gap-1 border-b border-border">
          <button
            onClick={() => changeSection('monitor')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              section === 'monitor' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Monitor Agents
          </button>
          <button
            onClick={() => changeSection('setup')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              section === 'setup' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Agent Setup & Presets
          </button>
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
