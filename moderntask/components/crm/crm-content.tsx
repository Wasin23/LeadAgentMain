"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Play, Square, Search, Building2, CheckCircle2, XCircle, Loader2, User, Trash2, ChevronLeft, ChevronRight, GitMerge, Link2Off, X, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { CRM_CONFIGS, type CrmConfig } from "@/lib/crm-configs"

interface CRMContact {
  email: string
  firstName: string
  lastName: string
  title: string
  phone: string
  company: string
  crmId: string
  source: string
  status?: "fresh" | "queued" | "skipped"
  savedAt?: string
  assignedAt?: string
  // client-side only - live run status for the table (replaces the separate results feed)
  runStatus?: "scanning" | "success" | "failed" | "skipped"
  runMessage?: string
}

interface Agent {
  agentId: string
  name: string
  status?: string
  personality?: { avatar?: string; type?: string }
}

interface AuditorResult {
  contactId: string
  contactName: string
  company?: string | null
  email?: string | null
  crmStatus: "success" | "failed" | "skipped"
  crmAction: string
  crmMessage: string
  crmIntegration?: string | null
  crmContactId?: string | null
  completedAt: string
}

export function CRMContent() {
  const { toast } = useToast()
  const { user } = useAuth()

  // ── connection status ──
  const [crmName, setCrmName]             = useState<string | null | undefined>(undefined) // undefined = loading
  const [crmConnectedAt, setCrmConnectedAt] = useState<string | null>(null)

  const fetchCrmStatus = useCallback(async () => {
    try {
      const r = await api.get("/api/crm/status")
      setCrmName(r.data?.connected ? (r.data?.integration || "CRM") : null)
      setCrmConnectedAt(r.data?.connectedAt || null)
    } catch { setCrmName(null) }
  }, [])

  // ── connect / disconnect flow (inline - no redirect to Settings) ──
  const [selectedCRM, setSelectedCRM]       = useState<CrmConfig | null>(null)
  const [showCrmDropdown, setShowCrmDropdown] = useState(false)
  const [crmCredentials, setCrmCredentials] = useState<Record<string, string>>({})
  const [connectingCrm, setConnectingCrm]   = useState(false)
  const [crmError, setCrmError]             = useState<string | null>(null)
  const [disconnectingCrm, setDisconnectingCrm] = useState(false)

  const connectCRMDirect = async () => {
    if (!selectedCRM) return
    const missing = selectedCRM.fields.filter(f => !crmCredentials[f.key]?.trim())
    if (missing.length > 0) {
      setCrmError(`Please fill in: ${missing.map(f => f.name).join(", ")}`)
      return
    }
    setConnectingCrm(true)
    setCrmError(null)
    try {
      await api.post("/api/crm/connect-direct", {
        integrationName: selectedCRM.id,
        apiUrl: crmCredentials.apiUrl?.trim() || "",
        apiKey: crmCredentials.apiKey?.trim() || "",
      })
      await fetchCrmStatus()
      toast({ title: `${selectedCRM.name} connected!` })
      setSelectedCRM(null)
      setCrmCredentials({})
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to connect. Please check your credentials."
      setCrmError(msg)
    } finally {
      setConnectingCrm(false)
    }
  }

  const disconnectCrm = async () => {
    setDisconnectingCrm(true)
    try {
      await api.post("/api/crm/disconnect")
      setCrmName(null)
      setCrmConnectedAt(null)
      toast({ title: "CRM disconnected" })
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" })
    } finally {
      setDisconnectingCrm(false)
    }
  }

  useEffect(() => { fetchCrmStatus() }, [fetchCrmStatus])

  // ── session contacts (auditor run, not persisted in this state) ──
  const [contacts, setContacts]             = useState<CRMContact[]>([])
  const [loading, setLoading]               = useState(false)
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [search, setSearch]                 = useState("")
  const [agents, setAgents]                 = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent]   = useState<string>("")
  const [launching, setLaunching]           = useState(false)
  const [launched, setLaunched]             = useState(false)
  const [stopping, setStopping]             = useState(false)
  const [activeAuditorIds, setActiveAuditorIds] = useState<Set<string>>(new Set())
  const [exitingIds, setExitingIds]         = useState<Set<string>>(new Set())
  const [completedCount, setCompletedCount] = useState(0)
  const [totalQueued, setTotalQueued]       = useState(0)
  const [statusLine, setStatusLine]         = useState("")
  const [auditorResults, setAuditorResults] = useState<AuditorResult[]>([])
  const [page, setPage]                     = useState(1)
  const [companyFilter, setCompanyFilter]   = useState("__all__")
  const [sourceFilter, setSourceFilter]     = useState("__all__")

  // ── saved contacts (DB-persisted) ──
  const [savedContacts, setSavedContacts]   = useState<CRMContact[]>([])
  const [loadingSaved, setLoadingSaved]     = useState(true)

  const esRef            = useRef<EventSource | null>(null)
  const contactsRef      = useRef<CRMContact[]>([])
  const resultsRef       = useRef<AuditorResult[]>([])
  const activeIdsRef     = useRef<Set<string>>(new Set())
  const totalRef         = useRef(0)
  const selectedAgentRef = useRef<string>("")
  useEffect(() => { contactsRef.current      = contacts      }, [contacts])
  useEffect(() => { resultsRef.current       = auditorResults }, [auditorResults])
  useEffect(() => { activeIdsRef.current     = activeAuditorIds }, [activeAuditorIds])
  useEffect(() => { totalRef.current         = totalQueued   }, [totalQueued])
  useEffect(() => { selectedAgentRef.current = selectedAgent }, [selectedAgent])

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
      if (state.agentId) {
        const status = await api.get(`/api/lead-agent/status?agentId=${encodeURIComponent(state.agentId)}`)
        if (!status.data?.isActive) {
          await api.delete("/api/crm/auditor-state").catch(() => {})
          return
        }
      }
      setLaunched(true)
      setTotalQueued(state.totalQueued ?? 0)
      setCompletedCount(state.completedCount ?? 0)
      setAuditorResults(state.results ?? [])
      if (state.agentId) setSelectedAgent(state.agentId)
      setContacts(state.pendingContacts ?? [])
      setActiveAuditorIds(new Set(state.activeContactIds ?? []))
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
          const found = contactsRef.current.find(c => (c.crmId || c.email) === data.contactId)
          const fallbackName = found ? [found.firstName, found.lastName].filter(Boolean).join(" ") || found.email : data.email || "contact"
          const fallbackCompany = found?.company || data.company || "their company"
          if (data.contactId) {
            setActiveAuditorIds(prev => {
              const next = new Set(prev)
              next.add(data.contactId)
              const activeCount = next.size
              setStatusLine(activeCount > 1
                ? `Auditing ${activeCount} contacts in parallel…`
                : `Researching ${data.contactName || fallbackName} at ${fallbackCompany}…`)
              return next
            })
            setContacts(prev => prev.map(c => (c.crmId || c.email) === data.contactId ? { ...c, runStatus: "scanning" } : c))
          }
        }
        if (data.type === "crm_contact_complete") {
          const id = data.contactId
          if (!id) return
          const found = contactsRef.current.find(c => (c.crmId || c.email) === id)
          const result: AuditorResult = {
            contactId: id,
            contactName: data.contactName || (found ? [found.firstName, found.lastName].filter(Boolean).join(" ") || found.email : data.email || "Contact"),
            company: data.company || found?.company || null,
            email: data.email || found?.email || null,
            crmStatus: data.crmSync?.status === "failed" ? "failed" : data.crmSync?.status === "skipped" ? "skipped" : "success",
            crmAction: data.crmSync?.action || "crm_skipped",
            crmMessage: data.crmSync?.message || "Email queued",
            crmIntegration: data.crmSync?.crmIntegration || null,
            crmContactId: data.crmSync?.crmContactId || null,
            completedAt: data.timestamp || new Date().toISOString(),
          }
          const nextResults = [result, ...resultsRef.current].slice(0, 12)
          setAuditorResults(nextResults)
          setActiveAuditorIds(prev => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          // Mark the row's live status in-place instead of removing it from the table -
          // the table is the single source of truth now, no separate results feed.
          setContacts(prev => prev.map(c => (c.crmId || c.email) === id
            ? { ...c, runStatus: result.crmStatus, runMessage: result.crmMessage }
            : c))
          setCompletedCount(n => {
            const newCount = n + 1
            const total    = totalRef.current
            const remainingActive = activeIdsRef.current.has(id)
              ? Math.max(0, activeIdsRef.current.size - 1)
              : Math.max(0, activeIdsRef.current.size)
            const name     = result.contactName || (found ? [found.firstName, found.lastName].filter(Boolean).join(" ") || found.email : "contact")
            const resultLabel = result.crmStatus === "failed"
              ? "CRM update failed"
              : result.crmAction === "report_added"
                ? `report added${result.crmIntegration ? ` to ${result.crmIntegration}` : ""}`
                : result.crmAction === "contact_synced"
                  ? `synced${result.crmIntegration ? ` to ${result.crmIntegration}` : " to CRM"}`
                  : "queued"
            setStatusLine(remainingActive > 0
              ? `${name}: ${resultLabel} (${newCount}/${total}) · ${remainingActive} still in progress`
              : `${name}: ${resultLabel} (${newCount}/${total})`)
            if (newCount >= total && remainingActive === 0) {
              // Auto-stop the agent - job is done
              api.post("/api/lead-agent/stop", { agentId: selectedAgentRef.current }).catch(() => {})
              esRef.current?.close()
              esRef.current = null
              setActiveAuditorIds(new Set())
            }
            return newCount
          })
          api.patch(`/api/crm/saved-contacts/${encodeURIComponent(id)}`, { status: "queued" }).catch(() => {})
          setSavedContacts(prev => prev.map(c => (c.crmId || c.email) === id ? { ...c, status: "queued", assignedAt: c.assignedAt || new Date().toISOString() } : c))
        }
      } catch { /* ignore */ }
    })
  }

  const loadContacts = async () => {
    setLoading(true)
    setSelected(new Set())
    setLaunched(false)
    setActiveAuditorIds(new Set())
    setExitingIds(new Set())
    setCompletedCount(0)
    setTotalQueued(0)
    setStatusLine("")
    setAuditorResults([])
    setPage(1)
    setCompanyFilter("__all__")
    setSourceFilter("__all__")
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

  const PAGE_SIZE = 50

  const companies = useMemo(() => {
    const seen = new Set<string>()
    return contacts.reduce<string[]>((acc, c) => {
      if (c.company && !seen.has(c.company)) { seen.add(c.company); acc.push(c.company) }
      return acc
    }, []).sort()
  }, [contacts])

  const sources = useMemo(() => {
    const seen = new Set<string>()
    return contacts.reduce<string[]>((acc, c) => {
      if (c.source && !seen.has(c.source)) { seen.add(c.source); acc.push(c.source) }
      return acc
    }, []).sort()
  }, [contacts])

  const filtered = useMemo(() => {
    let list = contacts
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        `${c.firstName} ${c.lastName} ${c.email} ${c.company} ${c.title}`.toLowerCase().includes(q)
      )
    }
    if (companyFilter && companyFilter !== "__all__") list = list.filter(c => c.company === companyFilter)
    if (sourceFilter  && sourceFilter  !== "__all__") list = list.filter(c => c.source  === sourceFilter)
    return list
  }, [contacts, search, companyFilter, sourceFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  // reset to page 1 whenever any filter changes (ignore sentinel value)
  useEffect(() => { setPage(1) }, [search, companyFilter, sourceFilter])

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

  const removeContact = (id: string) => {
    setContacts(prev => prev.filter(c => (c.crmId || c.email) !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
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
        totalQueued: payload.length, completedCount: 0, pendingContacts: payload, results: [],
      })
      // 3. Start agent
      await api.post("/api/lead-agent/start-from-crm", { agentId: selectedAgent, contacts: payload })
      setLaunched(true)
      setTotalQueued(payload.length)
      setContacts(payload)
      setAuditorResults([])
      setSelected(new Set())
      setStatusLine("Agent starting…")
      connectSSE()
      toast({ title: `Auditor launched on ${payload.length} contacts`, description: "Live results will appear here as each CRM contact finishes." })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to launch agent"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setLaunching(false)
    }
  }

  const stopAuditor = async () => {
    setStopping(true)
    try {
      await api.post("/api/lead-agent/stop", { agentId: selectedAgent })
      await api.delete("/api/crm/auditor-state")
      esRef.current?.close()
      esRef.current = null
      setLaunched(false)
      setActiveAuditorIds(new Set())
      setStatusLine("")
      setExitingIds(new Set())
      toast({ title: "Auditor stopped" })
    } catch {
      toast({ title: "Failed to stop agent", variant: "destructive" })
    } finally {
      setStopping(false)
    }
  }

  const resetAuditor = () => {
    setLaunched(false)
    setContacts([])
    setSelected(new Set())
    setCompletedCount(0)
    setTotalQueued(0)
    setStatusLine("")
    setAuditorResults([])
    setActiveAuditorIds(new Set())
    setExitingIds(new Set())
    esRef.current?.close()
    esRef.current = null
  }

  const mergeDuplicate = async (id: string) => {
    try {
      await api.delete(`/api/crm/saved-contacts/${encodeURIComponent(id)}`)
      setSavedContacts(prev => prev.filter(c => (c.crmId || c.email) !== id))
      toast({ title: "Duplicate merged", description: "Kept the earliest record." })
    } catch {
      toast({ title: "Failed to merge duplicate", variant: "destructive" })
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

  const savedStats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const monthAgo = now - 30 * 86400000
    return {
      total: savedContacts.length,
      queued: savedContacts.filter(c => c.status === "queued").length,
      assignedThisWeek: savedContacts.filter(c => c.assignedAt && new Date(c.assignedAt).getTime() >= weekAgo).length,
      assignedThisMonth: savedContacts.filter(c => c.assignedAt && new Date(c.assignedAt).getTime() >= monthAgo).length,
    }
  }, [savedContacts])

  const duplicateIds = useMemo(() => {
    const byEmail = new Map<string, CRMContact[]>()
    for (const c of savedContacts) {
      const key = (c.email || "").toLowerCase().trim()
      if (!key) continue
      byEmail.set(key, [...(byEmail.get(key) ?? []), c])
    }
    const ids = new Set<string>()
    for (const group of byEmail.values()) {
      if (group.length < 2) continue
      const sorted = [...group].sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""))
      for (const dupe of sorted.slice(1)) ids.add(dupe.crmId || dupe.email)
    }
    return ids
  }, [savedContacts])

  // Real per-row "issue or finding" for the audit table: duplicate (against already-saved
  // contacts or within the session batch itself), missing email/phone, or none.
  const savedEmailSet = useMemo(
    () => new Set(savedContacts.map(c => (c.email || "").toLowerCase().trim()).filter(Boolean)),
    [savedContacts],
  )
  const sessionEmailCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of contacts) {
      const key = (c.email || "").toLowerCase().trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [contacts])

  function findingFor(c: CRMContact): { label: string; tone: "amber" | "rose" | "green" | "muted" } {
    const key = (c.email || "").toLowerCase().trim()
    if (!key) return { label: "Missing email", tone: "rose" }
    if (savedEmailSet.has(key)) return { label: "Already saved", tone: "amber" }
    if ((sessionEmailCounts.get(key) ?? 0) > 1) return { label: "Duplicate in this batch", tone: "amber" }
    if (!c.phone) return { label: "Missing phone", tone: "muted" }
    if (!c.company) return { label: "Missing company", tone: "muted" }
    return { label: "Ready to assign", tone: "green" }
  }

  return (
    <div className="grid grid-cols-1 @5xl:grid-cols-[1fr_320px] gap-4 items-start">
    <div className="min-w-0 space-y-6">

      {/* ── connection header ─────────────────────────── */}
      {crmName !== undefined && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-full ${crmName ? "bg-success-soft" : "bg-muted"}`}>
              {crmName
                ? <CheckCircle2 className="h-5 w-5 text-success-soft-foreground" strokeWidth={2.5} />
                : <Link2Off className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{crmName ? "CRM Connected" : "No CRM connected"}</p>
              <p className="text-sm font-semibold text-foreground">{crmName ?? "-"}</p>
              {crmConnectedAt && <p className="text-[11px] text-muted-foreground">Connected {new Date(crmConnectedAt).toLocaleDateString()}</p>}
            </div>
          </div>
          {crmName && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={disconnectingCrm} onClick={disconnectCrm}>
              {disconnectingCrm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              Disconnect
            </Button>
          )}
          <div className="ml-auto grid grid-cols-2 gap-4 sm:grid-cols-4">
            <CrmStat label="Saved" value={savedStats.total} />
            <CrmStat label="Queued" value={savedStats.queued} />
            <CrmStat label="Assigned (week)" value={savedStats.assignedThisWeek} />
            <CrmStat label="Assigned (month)" value={savedStats.assignedThisMonth} />
          </div>
        </div>
      )}

      {!crmName && (
        <ConnectCrmPanel
          selectedCRM={selectedCRM}
          setSelectedCRM={setSelectedCRM}
          showCrmDropdown={showCrmDropdown}
          setShowCrmDropdown={setShowCrmDropdown}
          crmCredentials={crmCredentials}
          setCrmCredentials={setCrmCredentials}
          connectingCrm={connectingCrm}
          crmError={crmError}
          setCrmError={setCrmError}
          onConnect={connectCRMDirect}
        />
      )}

      {/* ── SAVED CONTACTS (DB) ──────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-foreground">Saved Contacts</h3>
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
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
            <User className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No contacts saved yet. Run Auditor Mode to populate this list.</p>
          </div>
        ) : (() => {
          return (
            <div className="space-y-1">
              {savedContacts.map((c, i) => {
                const id = c.crmId || c.email
                const isDupe = duplicateIds.has(id)
                return (
                  <div key={id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-card ${isDupe ? "border-amber-400/50" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(i)}`}>{initials(c)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">{c.title}{c.title && c.company ? " · " : ""}{c.company}</span>
                    </div>
                    {isDupe && (
                      <button
                        onClick={() => mergeDuplicate(id)}
                        title="Duplicate email - keep the earliest record, discard this one"
                        className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 hover:underline shrink-0"
                      >
                        <GitMerge className="w-3 h-3" />Merge
                      </button>
                    )}
                    <Badge variant="outline" className={`text-[9px] shrink-0 gap-1 ${c.status === "queued" ? "border-emerald-400/50 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {c.status === "queued" ? <><CheckCircle2 className="w-2.5 h-2.5" /> queued</> : "fresh"}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      <div className="border-t" />

      {/* ── AUDITOR / IMPORT SECTION ─────────────────── */}
      <div className="space-y-3">

        {/* Selection-based assignment: pick contacts in the table below, choose an agent here, then Run */}
        {!launched && contacts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground shrink-0">Assign to:</span>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="h-8 text-xs w-[200px]">
                <SelectValue placeholder="Select an agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => <SelectItem key={a.agentId} value={a.agentId}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Toolbar: Load / Search / Run */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={loadContacts} disabled={loading || launched} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : contacts.length > 0 ? "Refresh" : "Load from CRM"}
        </Button>
        {contacts.length > 0 && !launched && (
          <>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search name, email, company…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Button size="sm" onClick={launchAgent} disabled={launching || selected.size === 0 || !selectedAgent} className="gap-1.5">
              <Play className="w-3.5 h-3.5" />
              {launching ? "Launching..." : `Run Auditor${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </Button>
          </>
        )}

        {/* Filter row */}
        {contacts.length > 0 && !launched && (companies.length > 1 || sources.length > 1) && (
          <div className="flex flex-wrap items-center gap-2">
            {companies.length > 1 && (
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="h-7 text-xs w-[170px]">
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All companies</SelectItem>
                  {companies.map(co => <SelectItem key={co} value={co}>{co}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {sources.length > 1 && (
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-7 text-xs w-[140px]">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sources</SelectItem>
                  {sources.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {(companyFilter !== "__all__" || sourceFilter !== "__all__") && (
              <button
                onClick={() => { setCompanyFilter("__all__"); setSourceFilter("__all__") }}
                className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {launched && totalQueued > 0 && (
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{ width: `${Math.min(100, (completedCount / totalQueued) * 100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{completedCount} / {totalQueued} completed</span>
          </div>
        )}
      </div>

      {/* one-line live status */}
      {launched && statusLine && (
        <p className="text-[11px] text-muted-foreground pl-0.5 truncate">{statusLine}</p>
      )}

      {contacts.length === 0 && !loading && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-muted w-12 h-12 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              {completedCount > 0 ? (
                <>
                  <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">All done!</p>
                  <p className="text-xs text-muted-foreground mt-1">{completedCount} contact{completedCount !== 1 ? "s" : ""} finished. Check the <span className="font-medium">Email Queue</span>.</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 h-7 text-xs" onClick={resetAuditor}>
                    <RefreshCw className="w-3 h-3" />Start New Batch
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm">No contacts loaded</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect your CRM in <span className="font-medium">Settings &rarr; CRM</span>, then click &ldquo;Load from CRM&rdquo; to import contacts.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="space-y-1.5">
          {!launched && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground flex-wrap">
              <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
              <span className="shrink-0">
                {selected.size > 0
                  ? <><span className="font-medium text-foreground">{selected.size}</span> of {filtered.length} selected</>              
                  : <>{filtered.length} contacts{(companyFilter || sourceFilter || search) ? " matching" : ""}</>}
              </span>
              {contacts.length !== filtered.length && (
                <Badge variant="secondary" className="text-[10px]">{contacts.length} total</Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                {selected.size < filtered.length && (
                  <button onClick={() => setSelected(new Set(filtered.map(c => c.crmId || c.email)))} className="text-[10px] hover:text-foreground underline transition-colors">
                    Select all {filtered.length}
                  </button>
                )}
                {selected.size < paginated.length && selected.size < filtered.length && (
                  <>
                    <span className="opacity-30">·</span>
                    <button onClick={() => setSelected(prev => { const n = new Set(prev); paginated.forEach(c => n.add(c.crmId || c.email)); return n })} className="text-[10px] hover:text-foreground underline transition-colors">
                      + this page
                    </button>
                  </>
                )}
                {selected.size > 0 && (
                  <>
                    <span className="opacity-30">·</span>
                    <button onClick={() => setSelected(new Set())} className="text-[10px] hover:text-foreground underline transition-colors">Clear</button>
                  </>
                )}
              </div>
            </div>
          )}
          {launched && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1 text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Auditor Mode
              </Badge>
              {activeAuditorIds.size > 0 && (
                <Badge variant="outline" className="text-[10px] border-blue-300/70 text-blue-600 dark:text-blue-400">
                  {activeAuditorIds.size} active
                </Badge>
              )}
              <span>{contacts.length} remaining</span>
              <button
                onClick={stopAuditor}
                disabled={stopping}
                className="ml-auto flex items-center gap-1 text-[10px] text-rose-500 hover:text-rose-600 disabled:opacity-50 transition-colors"
              >
                {stopping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 fill-current" />}
                {stopping ? "Stopping…" : "Stop"}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-surface/40">
                  {!launched && <th className="py-2 pl-3 pr-1 w-8"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></th>}
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">CRM Source</th>
                  <th className="py-2 px-3 font-medium">Issue or Finding</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Assigned Agent</th>
                  <th className="py-2 px-3 font-medium">Action</th>
                  {!launched && <th className="py-2 px-3 w-8" />}
                </tr>
              </thead>
              <tbody>
                {paginated.map((c, i) => {
                  const id         = c.crmId || c.email
                  const globalIdx  = (page - 1) * PAGE_SIZE + i
                  const isSelected = selected.has(id)
                  const isScanning = activeAuditorIds.has(id) || c.runStatus === "scanning"
                  const assignedAgentName = launched ? agents.find(a => a.agentId === selectedAgent)?.name : undefined
                  const finding = findingFor(c)
                  const findingCls: Record<typeof finding.tone, string> = {
                    amber: "bg-warning-soft text-warning-soft-foreground",
                    rose:  "bg-danger-soft text-danger-soft-foreground",
                    green: "bg-success-soft text-success-soft-foreground",
                    muted: "bg-muted text-muted-foreground",
                  }
                  const statusBadge = c.runStatus === "failed"
                    ? { label: "CRM update failed", cls: findingCls.rose }
                    : c.runStatus === "skipped"
                      ? { label: c.runMessage || "Skipped", cls: findingCls.amber }
                      : c.runStatus === "success"
                        ? { label: c.runMessage || "Queued", cls: findingCls.green }
                        : isScanning
                          ? { label: "Researching…", cls: "bg-info-soft text-info-soft-foreground" }
                          : c.status === "queued"
                            ? { label: "Queued", cls: findingCls.green }
                            : { label: "Fresh", cls: "bg-muted text-foreground/70" }
                  return (
                    <tr
                      key={id}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${isScanning ? "bg-info-soft" : isSelected ? "bg-success-soft" : "hover:bg-accent/30"}`}
                      onClick={() => !launched && toggleContact(id)}
                    >
                      {!launched && (
                        <td className="py-2 pl-3 pr-1" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleContact(id)} />
                        </td>
                      )}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(globalIdx)} ${isScanning ? "animate-pulse ring-2 ring-blue-400 ring-offset-1" : ""}`}>
                            {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : initials(c)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.email}{c.company ? ` · ${c.company}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px]">{c.source?.replace(/_/g, " ") ?? "CRM"}</Badge>
                      </td>
                      <td className="py-2 px-3 text-sm text-foreground">{finding.label}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
                      </td>
                      <td className="py-2 px-3">
                        {assignedAgentName ? (
                          <div className="flex items-center gap-2">
                            <div className="grid h-6 w-6 place-items-center rounded-full bg-chip-amber text-[9px] font-semibold text-chip-amber-foreground">
                              {assignedAgentName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-foreground">{assignedAgentName}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                        {finding.tone === "amber" && savedEmailSet.has((c.email || "").toLowerCase().trim()) ? (
                          <button
                            onClick={() => mergeDuplicate(id)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            Merge
                          </button>
                        ) : launched ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          <button
                            onClick={() => toggleContact(id)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        )}
                      </td>
                      {!launched && (
                        <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                          <button onClick={() => removeContact(id)} title="Remove from this import batch" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          {!launched && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 px-1">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-muted-foreground px-1">pg {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {launched && contacts.length === 0 && completedCount > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All done - {completedCount} contact{completedCount !== 1 ? "s" : ""} completed</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Head to <strong>Email Queue</strong> to review and approve before sending.</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto shrink-0 gap-1.5 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30" onClick={resetAuditor}>
            <RefreshCw className="w-3 h-3" />Start New Batch
          </Button>
        </div>
      )}
      </div>
    </div>

    <ImportSettingsPanel
      crmName={crmName}
      crmConnectedAt={crmConnectedAt}
      connectedBy={user?.email}
      savedStats={savedStats}
    />
    </div>
  )
}

function CrmStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-lg leading-tight text-foreground">{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function ConnectCrmPanel({
  selectedCRM, setSelectedCRM, showCrmDropdown, setShowCrmDropdown,
  crmCredentials, setCrmCredentials, connectingCrm, crmError, setCrmError, onConnect,
}: {
  selectedCRM: CrmConfig | null
  setSelectedCRM: (c: CrmConfig | null) => void
  showCrmDropdown: boolean
  setShowCrmDropdown: (v: boolean | ((v: boolean) => boolean)) => void
  crmCredentials: Record<string, string>
  setCrmCredentials: (v: Record<string, string> | ((v: Record<string, string>) => Record<string, string>)) => void
  connectingCrm: boolean
  crmError: string | null
  setCrmError: (v: string | null) => void
  onConnect: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Connect your CRM</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect HubSpot, Salesforce, Pipedrive, Zoho, and 17 more to sync researched leads and unlock Auditor Mode.
        </p>
      </div>

      {!selectedCRM ? (
        <div className="space-y-2">
          <Label className="text-sm">Choose your CRM</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCrmDropdown(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md border border-input bg-background hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">Select a CRM platform…</span>
              <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showCrmDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCrmDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {CRM_CONFIGS.map((crm) => (
                  <button
                    key={crm.id}
                    type="button"
                    onClick={() => { setSelectedCRM(crm); setShowCrmDropdown(false); setCrmCredentials({}); setCrmError(null) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span>{crm.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{selectedCRM.name}</p>
                <p className="text-xs text-muted-foreground">Enter your credentials</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedCRM(null); setCrmCredentials({}); setCrmError(null) }}
              className="text-xs text-primary hover:underline"
            >
              Change
            </button>
          </div>

          {selectedCRM.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs">{field.name}</Label>
              <Input
                type={field.type}
                value={crmCredentials[field.key] || ""}
                onChange={(e) => setCrmCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
              />
              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            </div>
          ))}

          {crmError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">{crmError}</p>
            </div>
          )}

          <Button onClick={onConnect} disabled={connectingCrm} className="w-full gap-2">
            {connectingCrm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {connectingCrm ? "Connecting…" : `Connect ${selectedCRM.name}`}
          </Button>
        </div>
      )}
    </div>
  )
}

function ImportSettingsPanel({
  crmName, crmConnectedAt, connectedBy, savedStats,
}: {
  crmName: string | null | undefined
  crmConnectedAt: string | null
  connectedBy?: string
  savedStats: { total: number; queued: number; assignedThisWeek: number; assignedThisMonth: number }
}) {
  return (
    <aside className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg text-foreground">Import Settings</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Connection Details</h3>
        {crmName ? (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm font-medium">{crmName}</span>
              <span className="rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success-soft-foreground">
                Connected
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              {connectedBy && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Connected by</dt>
                  <dd className="text-foreground truncate max-w-[160px]">{connectedBy}</dd>
                </div>
              )}
              {crmConnectedAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Connected on</dt>
                  <dd className="text-foreground">{new Date(crmConnectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Link2Off className="h-3.5 w-3.5 shrink-0" />
            Use the form to connect a CRM
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Saved / Assigned Contacts</h3>
        <p className="text-xs text-muted-foreground">Contacts already created or assigned as leads.</p>
        <ul className="space-y-2 text-xs">
          {[
            ["Assigned this week", savedStats.assignedThisWeek],
            ["Assigned this month", savedStats.assignedThisMonth],
            ["Total saved contacts", savedStats.total],
          ].map(([k, v]) => (
            <li key={k as string} className="flex items-center justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-foreground">{(v as number).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
