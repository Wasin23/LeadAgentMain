'use client'

import { Suspense } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { AgentsContent } from "@/components/agents/agents-content"
import { PresetsContent } from "@/components/agents/presets-content"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"

function AgentsPageInner() {
  const searchParams    = useSearchParams()
  const highlightAgent  = searchParams.get("agent") ?? undefined
  const autoOpenCreate  = searchParams.get("create") === "true"

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:ml-64 overflow-y-auto">
        <Header
          title="Agents"
          description="Manage, monitor, and control your AI outreach agents."
        />
        <div className="mt-5">
          <Tabs defaultValue="agents">
            <TabsList className="mb-5">
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="presets">Presets</TabsTrigger>
            </TabsList>
            <TabsContent value="agents">
              <AgentsContent highlightAgentId={highlightAgent} autoOpenCreate={autoOpenCreate} />
            </TabsContent>
            <TabsContent value="presets">
              <PresetsContent />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

export default function AgentsPage() {
  return (
    <Suspense>
      <AgentsPageInner />
    </Suspense>
  )
}
