"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Play, Search, Building2, Mail, Phone, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

interface CRMContact {
  email: string
  firstName: string
  lastName: string
  title: string
  phone: string
  company: string
  crmId: string
  source: string
}

interface Agent {
  agentId: string
  name: string
  status?: string
}

export function CRMContent() {
  const { toast } = useToast()

  const [contacts, setContacts]         = useState<CRMContact[]>([])
  const [loading, setLoading]           = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [search, setSearch]             = useState("")
  const [agents, setAgents]             = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>("")
  const [launching, setLaunching]       = useState(false)
  const [launched, setLaunched]         = useState(false)

  // Load agents on mount
  useEffect(() => {
    api.get("/api/auth/agents")
      .then(r => {
        const list: Agent[] = r.data?.agents ?? []
        setAgents(list)
        if (list.length > 0) setSelectedAgent(list[0].agentId)
      })
      .catch(() => {})
  }, [])

  const loadContacts = async () => {
    setLoading(true)
    setSelected(new Set())
    setLaunched(false)
    try {
      const res = await api.get("/api/crm/import-leads?limit=500")
      setContacts(res.data?.contacts ?? [])
      if ((res.data?.contacts ?? []).length === 0) {
        toast({ title: "No contacts found", description: "Make sure your CRM is connected in Settings → CRM." })
      }
    } catch {
      toast({ title: "Failed to load contacts", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.company} ${c.title}`.toLowerCase().includes(q)
    )
  }, [contacts, search])

  const toggleContact = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.crmId || c.email)))
    }
  }

  const launchAgent = async () => {
    if (!selectedAgent) {
      toast({ title: "Select an agent first", variant: "destructive" })
      return
    }
    if (selected.size === 0) {
      toast({ title: "Select at least one contact", variant: "destructive" })
      return
    }

    const idSet = selected
    const payload = contacts.filter(c => idSet.has(c.crmId || c.email))

    setLaunching(true)
    try {
      await api.post("/api/lead-agent/start-from-crm", {
        agentId: selectedAgent,
        contacts: payload
      })
      setLaunched(true)
      toast({ title: `Agent launched on ${payload.length} contacts`, description: "Check Operations for live progress." })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to launch agent"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setLaunching(false)
    }
  }

  const initials = (c: CRMContact) => {
    const f = c.firstName?.[0] ?? ""
    const l = c.lastName?.[0]  ?? ""
    return (f + l).toUpperCase() || c.email?.[0]?.toUpperCase() || "?"
  }

  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-indigo-500"]
  const avatarColor = (i: number) => colors[i % colors.length]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={loadContacts} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading…" : contacts.length > 0 ? "Refresh" : "Load from CRM"}
        </Button>

        {contacts.length > 0 && (
          <>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search contacts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="h-8 text-sm w-[180px]">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.agentId} value={a.agentId}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={launchAgent}
              disabled={launching || selected.size === 0 || launched}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {launched
                ? "Launched"
                : launching
                  ? "Launching…"
                  : `Run Agent${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </Button>
          </>
        )}
      </div>

      {/* Empty state */}
      {contacts.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-muted w-12 h-12 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">No contacts loaded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect your CRM in <span className="font-medium">Settings → CRM</span>, then click &ldquo;Load from CRM&rdquo; to import contacts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact list */}
      {contacts.length > 0 && (
        <div className="space-y-1.5">
          {/* Select-all row */}
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={filtered.length > 0 && selected.size === filtered.length}
              onCheckedChange={toggleAll}
            />
            <span>
              {selected.size > 0
                ? `${selected.size} of ${filtered.length} selected`
                : `${filtered.length} contacts${search ? " matching" : ""}`}
            </span>
            {contacts.length !== filtered.length && (
              <Badge variant="secondary" className="text-[10px]">{contacts.length} total</Badge>
            )}
          </div>

          {filtered.map((c, i) => {
            const id = c.crmId || c.email
            const isSelected = selected.has(id)
            return (
              <Card
                key={id}
                className={`cursor-pointer transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"}`}
                onClick={() => toggleContact(id)}
              >
                <CardContent className="px-3 py-2.5 flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleContact(id)}
                    onClick={e => e.stopPropagation()}
                  />
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(i)}`}>
                    {initials(c)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
                      </span>
                      {c.title && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">{c.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />{c.email}
                        </span>
                      )}
                      {c.company && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="w-3 h-3" />{c.company}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground hidden md:flex">
                          <Phone className="w-3 h-3" />{c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Source badge */}
                  <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:flex">
                    {c.source?.replace(/_/g, " ") ?? "CRM"}
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Launched success banner */}
      {launched && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
          <User className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Agent is running</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              Processing {selected.size} contacts — skip Apollo, straight to research and email. Go to <strong>Operations</strong> to watch live.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
