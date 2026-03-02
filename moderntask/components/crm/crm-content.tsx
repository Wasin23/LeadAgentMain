"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Play, Search, Building2, Mail, Phone, CheckCircle2, Loader2, User, Trash2 } from "lucide-react"
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
  status?: "queued" | "emailed" | "skipped"
}

interface Agent {
  agentId: string
  name: string
  status?: string
}

export function CRMContent() {
  const { toast } = useToast()

  // ── session contacts (auditor run, not persisted in this state) ──
  const [contacts, setContacts]             = useState<CRMContact[]>([])
  const [loading, setLoading]               = useState(false)
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [search, setSearch]                 = useState("")
  const [agents, setAgents]                 = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent]   = useState<string>("")
  const [launching, setLaunching]           = useState(false)
  const [launched, setLaunched]             = useState(false)
  const [scanningId, setScanningId]         = useState<string | null>(null)
  const [exitingIds, setExitingIds]         = useState<Set<string>>(new Set())
  const [completedCount, setCompletedCount] = useState(0)
  const [totalQueued, setTotalQueued]       = useState(0)
  const [statusLine, setStatusLine]         = useState("")

  // ── saved contacts (DB-persisted) ──
  const [savedContacts, setSavedContacts]   = useState<CRMContact[]>([])
  const [loadingSaved, setLoadingSaved]     = useState(true)

  const esRef       = useRef<EventSource | null>(null)
  const contactsRef = useRef<CRMContact[]>([])
  const totalRef    = useRef(0)
  useEffect(() => { contactsRef.current = contacts  }, [contacts])
  useEffect(() => { totalRef.current    = totalQueued }, [totalQueued])

  useEffect(() => {
    api.get("/api/auth/agents")
      .then(r => {
        const list: Agent[] = r.data?.agents ?? []
        setAgents(list)
        if (list.length > 0) setSelectedAgent(list[0].agentId)
      })
      .catch(() => {})
  }, [])

  // on mount: load saved contacts + restore any running auditor state
  useEffect(() => {
    fetchSavedContacts()
    restoreAuditorState()
    return () => { esRef.current?.close() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSavedContacts = async () => {
    setLoadingSaved(true)
    try {
      const res = await api.get("/api/crm/saved-contacts")
      setSavedContacts(res.data?.contacts ?? [])
    } catch { /* silent */ } finally { setLoadingSaved(false) }
  }

  const restoreAuditorState = async () => {
    try {
      const res   = await api.get("/api/crm/auditor-state")
      const state = res.data?.state
      if (!state?.launched) return
      setLaunched(true)
      setTotalQueued(state.totalQueued ?? 0)
      setCompletedCount(state.completedCount ?? 0)
      if (state.agentId) setSelectedAgent(state.agentId)
      setContacts(state.pendingContacts ?? [])
      setStatusLine("Reconnected to running session…")
      connectSSE()
    } catch { /* silent */ }
  }

  const connectSSE = () => {
    esRef.current?.close()
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
    const tok  = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
    if (!tok) return
    const es = new EventSource(`${base}/api/monitoring/stream?token=${encodeURIComponent(tok)}`)
    esRef.current = es
    es.addEventListener("message", (e) => {
      try {
        const msg  = JSON.parse(e.data)
        const data = msg.data ?? msg
        if (data.type === "crm_session_start") {
          setTotalQueued(data.contacts?.length ?? 0)
        }
        if (data.type === "crm_contact_scanning") {
          setScanningId(data.contactId ?? null)
          const found = contactsRef.current.find(c => (c.crmId || c.email) === data.contactId)
          if (found) {
            const name = [found.firstName, found.lastName].filter(Boolean).join(" ") || found.email
            setStatusLine(`Researching ${name} at ${found.company}…`)
          }
        }
        if (data.type === "crm_contact_complete") {
          const id = data.contactId
          if (!id) return
          const found = contactsRef.current.find(c => (c.crmId || c.email) === id)
          setScanningId(prev => prev === id ? null : prev)
          setExitingIds(prev => new Set([...prev, id]))
          setTimeout(() => {
            setContacts(prev => {
              const next = prev.filter(c => (c.crmId || c.email) !== id)
              setCompletedCount(n => {
                const newCount = n + 1
                const total    = totalRef.current
                const name     = found ? [found.firstName, found.lastName].filter(Boolean).join(" ") || found.email : "contact"
                setStatusLine(`Email built for ${name} ✓  (${newCount}/${total})`)
                api.post("/api/crm/auditor-state", { completedCount: newCount, pendingContacts: next }).catch(() => {})
                if (next.length === 0) api.delete("/api/crm/auditor-state").catch(() => {})
                return newCount
              })
              return next
            })
            setExitingIds(prev => { const n = new Set(prev); n.delete(id); return n })
            api.patch(`/api/crm/saved-contacts/${encodeURIComponent(id)}`, { status: "emailed" }).catch(() => {})
            setSavedContacts(prev => prev.map(c => (c.crmId || c.email) === id ? { ...c, status: "emailed" } : c))
          }, 400)
        }
      } catch { /* ignore */ }
    })
  }

  const loadContacts = async () => {
    setLoading(true)
    setSelected(new Set())
    setLaunched(false)
    setScanningId(null)
    setExitingIds(new Set())
    setCompletedCount(0)
    setTotalQueued(0)
    setStatusLine("")
    esRef.current?.close()
    esRef.current = null
    try {
      const res = await api.get("/api/crm/import-leads?limit=500")
      setContacts(res.data?.contacts ?? [])
      if ((res.data?.contacts ?? []).length === 0) {
        toast({ title: "No contacts found", description: "Make sure your CRM is connected in Settings -> CRM." })
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
    if (!selectedAgent) { toast({ title: "Select an agent first", variant: "destructive" }); return }
    if (selected.size === 0) { toast({ title: "Select at least one contact", variant: "destructive" }); return }
    const idSet   = selected
    const payload = contacts.filter(c => idSet.has(c.crmId || c.email))
    setLaunching(true)
    try {
      // 1. Save to DB
      await api.post("/api/crm/saved-contacts/batch", { contacts: payload })
      setSavedContacts(prev => {
        const existingIds = new Set(prev.map(c => c.crmId || c.email))
        return [...payload.filter(c => !existingIds.has(c.crmId || c.email)), ...prev]
      })
      // 2. Persist auditor state
      await api.post("/api/crm/auditor-state", {
        launched: true, agentId: selectedAgent,
        totalQueued: payload.length, completedCount: 0, pendingContacts: payload,
      })
      // 3. Start agent
      await api.post("/api/lead-agent/start-from-crm", { agentId: selectedAgent, contacts: payload })
      setLaunched(true)
      setTotalQueued(payload.length)
      setContacts(payload)
      setSelected(new Set())
      setStatusLine("Agent starting…")
      connectSSE()
      toast({ title: `Auditor launched on ${payload.length} contacts`, description: "Watch them disappear as emails are built." })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to launch agent"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setLaunching(false)
    }
  }

  const clearSavedContacts = async () => {
    try {
      await api.delete("/api/crm/saved-contacts")
      setSavedContacts([])
      toast({ title: "Saved contacts cleared" })
    } catch {
      toast({ title: "Failed to clear", variant: "destructive" })
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
    <div className="space-y-6">

      {/* ── SAVED CONTACTS (DB) ──────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Saved Contacts</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Persisted from Auditor runs</p>
          </div>
          {savedContacts.length > 0 && (
            <button onClick={clearSavedContacts} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3 h-3" />Clear all
            </button>
          )}
        </div>
        {loadingSaved ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…</div>
        ) : savedContacts.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-5 text-center">
            <User className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No contacts saved yet. Run Auditor Mode to populate this list.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {savedContacts.map((c, i) => (
              <div key={c.crmId || c.email} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(i)}`}>{initials(c)}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}</span>
                  <span className="text-[10px] text-muted-foreground truncate block">{c.title}{c.title && c.company ? " · " : ""}{c.company}</span>
                </div>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${c.status === "emailed" ? "border-emerald-400/50 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {c.status === "emailed" ? "✓ emailed" : "queued"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t" />

      {/* ── AUDITOR / IMPORT SECTION ─────────────────── */}
      <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={loadContacts} disabled={loading || launched} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : contacts.length > 0 ? "Refresh" : "Load from CRM"}
        </Button>
        {contacts.length > 0 && !launched && (
          <>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="h-8 text-sm w-[180px]"><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>{agents.map(a => (<SelectItem key={a.agentId} value={a.agentId}>{a.name}</SelectItem>))}</SelectContent>
            </Select>
            <Button size="sm" onClick={launchAgent} disabled={launching || selected.size === 0} className="gap-1.5">
              <Play className="w-3.5 h-3.5" />
              {launching ? "Launching..." : `Run Auditor${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </Button>
          </>
        )}
        {launched && totalQueued > 0 && (
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{ width: `${Math.min(100, (completedCount / totalQueued) * 100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{completedCount} / {totalQueued} built</span>
          </div>
        )}
      </div>

      {/* one-line live status */}
      {launched && statusLine && (
        <p className="text-[11px] text-muted-foreground pl-0.5 truncate">{statusLine}</p>
      )}

      {contacts.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-muted w-12 h-12 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              {completedCount > 0 ? (
                <>
                  <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">All done!</p>
                  <p className="text-xs text-muted-foreground mt-1">{completedCount} email{completedCount !== 1 ? "s" : ""} built and queued. Check the <span className="font-medium">Email Queue</span>.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm">No contacts loaded</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect your CRM in <span className="font-medium">Settings &rarr; CRM</span>, then click &ldquo;Load from CRM&rdquo; to import contacts.</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {contacts.length > 0 && (
        <div className="space-y-1.5">
          {!launched && (
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
              <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
              <span>{selected.size > 0 ? `${selected.size} of ${filtered.length} selected` : `${filtered.length} contacts${search ? " matching" : ""}`}</span>
              {contacts.length !== filtered.length && (<Badge variant="secondary" className="text-[10px]">{contacts.length} total</Badge>)}
            </div>
          )}
          {launched && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1 text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Auditor Mode
              </Badge>
              <span>{contacts.length} remaining</span>
            </div>
          )}
          {filtered.map((c, i) => {
            const id         = c.crmId || c.email
            const isSelected = selected.has(id)
            const isScanning = scanningId === id
            const isExiting  = exitingIds.has(id)
            return (
              <div key={id} className={`transition-all duration-400 ${isExiting ? "opacity-0 -translate-x-4 scale-95" : "opacity-100 translate-x-0 scale-100"}`}>
                <Card
                  className={`cursor-pointer transition-colors ${isScanning ? "border-blue-400 bg-blue-50/40 dark:bg-blue-900/20 shadow-sm shadow-blue-200 dark:shadow-blue-900/30" : isSelected ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => !launched && toggleContact(id)}
                >
                  <CardContent className="px-3 py-2.5 flex items-center gap-3">
                    {!launched && (<Checkbox checked={isSelected} onCheckedChange={() => toggleContact(id)} onClick={e => e.stopPropagation()} />)}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(i)} ${isScanning ? "animate-pulse ring-2 ring-blue-400 ring-offset-1" : ""}`}>
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : initials(c)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}</span>
                        {c.title && (<span className="text-xs text-muted-foreground truncate hidden sm:block">{c.title}</span>)}
                        {isScanning && (<span className="text-[10px] text-blue-500 font-medium animate-pulse shrink-0">building email...</span>)}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.email && (<span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{c.email}</span>)}
                        {c.company && (<span className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="w-3 h-3" />{c.company}</span>)}
                        {c.phone && (<span className="flex items-center gap-1 text-xs text-muted-foreground hidden md:flex"><Phone className="w-3 h-3" />{c.phone}</span>)}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:flex">{c.source?.replace(/_/g, " ") ?? "CRM"}</Badge>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {launched && contacts.length === 0 && completedCount > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All done — {completedCount} email{completedCount !== 1 ? "s" : ""} queued</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Head to <strong>Email Queue</strong> to review and approve before sending.</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
