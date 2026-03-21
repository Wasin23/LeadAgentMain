"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  User, Palette, Bell, Mail, LayoutGrid,
  CheckCircle2, XCircle, Plus, Trash2, Loader2, RefreshCw,
  Building2, Database, Link2Off, CreditCard,
  Reply, Eye, Calendar, CheckCheck, Inbox, AlertTriangle, Brain
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { Card } from "@/components/ui/card"
import { BillingTab } from "@/components/billing/billing-tab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import api from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { PresetsContent } from "@/components/agents/presets-content"

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "profile" | "appearance" | "notifications" | "company-profile" | "email" | "crm" | "presets" | "billing" | "memory"

interface EmailAccount { email: string; connectedAt: string; profilePicture?: string; isActive: boolean }

type NotifType = 'reply' | 'view' | 'failed_send' | 'meeting' | 'issue' | string
type Severity  = 'low' | 'medium' | 'high' | 'critical'

interface Notification {
  id: string
  type: NotifType
  severity?: Severity
  title: string
  message: string
  timestamp: string
  read: boolean
  data?: Record<string, unknown>
}

interface KeywordMemory {
  keyword: string
  position: string
  searchCombo: string
  totalAttempts: number
  totalDuplicates: number
  cumulativeDuplicateRate: number
  isExhausted: boolean
  keywordSource: string
  lastUpdated: number
}

interface MemoryStats {
  totalKeywords: number
  exhaustedKeywords: number
  avgDuplicateRate: number
  totalSearchAttempts: number
}

const NOTIF_TYPE_META: Record<string, { icon: React.ElementType; bg: string; badge: string; label: string }> = {
  reply:       { icon: Reply,         bg: 'bg-primary/10 border-primary/20',         badge: 'bg-primary/15 text-primary',                  label: 'Reply'   },
  view:        { icon: Eye,           bg: 'bg-muted/80 border-border',               badge: 'bg-muted text-muted-foreground',               label: 'Opened'  },
  failed_send: { icon: XCircle,       bg: 'bg-destructive/10 border-destructive/20', badge: 'bg-destructive/15 text-destructive',           label: 'Failed'  },
  meeting:     { icon: Calendar,      bg: 'bg-secondary border-border',              badge: 'bg-secondary text-secondary-foreground',       label: 'Meeting' },
  issue:       { icon: AlertTriangle, bg: 'bg-muted border-border',                  badge: 'bg-muted-foreground/20 text-muted-foreground', label: 'Issue'   },
}

const SEVERITY_STYLES: Record<Severity, string> = {
  low: 'text-muted-foreground', medium: 'text-primary', high: 'text-foreground font-semibold', critical: 'text-destructive font-bold'
}

const NOTIF_FILTER_TABS = [
  { id: 'all',         label: 'All'      },
  { id: 'unread',      label: 'Unread'   },
  { id: 'reply',       label: 'Replies'  },
  { id: 'view',        label: 'Opens'    },
  { id: 'meeting',     label: 'Meetings' },
  { id: 'failed_send', label: 'Failed'   },
]

function notifFormatTime(ts: string): string {
  try {
    const d = new Date(ts)
    const diff = Date.now() - d.getTime()
    if (diff < 7 * 24 * 60 * 60 * 1000) return formatDistanceToNow(d, { addSuffix: true })
    return format(d, 'MMM d, yyyy h:mm a')
  } catch { return ts }
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",         label: "Profile",         icon: User },
  { id: "appearance",      label: "Appearance",      icon: Palette },
  { id: "notifications",   label: "Notifications",   icon: Bell },
  { id: "company-profile", label: "Company Profile", icon: Building2 },
  { id: "email",           label: "Email",           icon: Mail },
  { id: "crm",             label: "CRM Connection",  icon: Database },
  { id: "memory",          label: "Memory",          icon: Brain },
  { id: "presets",         label: "Presets",         icon: LayoutGrid },
  { id: "billing",         label: "Billing",         icon: CreditCard },
]

// ── CRM configs ───────────────────────────────────────────────────────────────
const CRM_CONFIGS = [
  { id: "activecampaign", name: "ActiveCampaign", fields: [{ name: "API URL", key: "apiUrl", type: "text", placeholder: "https://youracccount.api-us1.com" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your ActiveCampaign API key", helpText: "Found in Settings → Developer → API Access" }] },
  { id: "hubspot", name: "HubSpot", fields: [{ name: "Private App Access Token", key: "apiKey", type: "password", placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helpText: "Create a Private App in HubSpot Settings → Integrations → Private Apps" }] },
  { id: "salesforce", name: "Salesforce", fields: [{ name: "Instance URL", key: "apiUrl", type: "text", placeholder: "https://yourinstance.salesforce.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Salesforce OAuth access token" }] },
  { id: "pipedrive", name: "Pipedrive", fields: [{ name: "API Token", key: "apiKey", type: "password", placeholder: "Your Pipedrive API token", helpText: "Found in Settings → Personal Preferences → API" }] },
  { id: "zoho", name: "Zoho CRM", fields: [{ name: "Data Center", key: "apiUrl", type: "text", placeholder: "https://www.zohoapis.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Zoho OAuth access token" }] },
  { id: "copper", name: "Copper", fields: [{ name: "User Email", key: "apiUrl", type: "text", placeholder: "Your Copper account email" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your Copper API key", helpText: "Found in Settings → Integrations → API Key" }] },
  { id: "close", name: "Close", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Close API key", helpText: "Found in Settings → Your API Keys" }] },
  { id: "affinity", name: "Affinity", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Affinity API key", helpText: "Found in Settings → API" }] },
  { id: "capsule", name: "Capsule", fields: [{ name: "API Token", key: "apiKey", type: "password", placeholder: "Your Capsule API token", helpText: "Found in My Preferences → API Authentication Token" }] },
  { id: "insightly", name: "Insightly", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Insightly API key", helpText: "Found in User Settings → API Key" }] },
  { id: "keap", name: "Keap (Infusionsoft)", fields: [{ name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Keap access token", helpText: "OAuth access token from Keap Developer Console" }] },
  { id: "dynamics365", name: "Microsoft Dynamics 365", fields: [{ name: "Organization URL", key: "apiUrl", type: "text", placeholder: "https://yourorg.crm.dynamics.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Dynamics 365 OAuth access token" }] },
  { id: "nutshell", name: "Nutshell", fields: [{ name: "User Email", key: "apiUrl", type: "text", placeholder: "Your Nutshell account email" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your Nutshell API key", helpText: "Found in Setup → API Keys" }] },
  { id: "pipeliner", name: "Pipeliner", fields: [{ name: "Space ID", key: "apiUrl", type: "text", placeholder: "Your Pipeliner Space ID" }, { name: "API Token", key: "apiKey", type: "password", placeholder: "Your Pipeliner API token" }] },
  { id: "salesflare", name: "Salesflare", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Salesflare API key", helpText: "Found in Settings → API keys" }] },
  { id: "sugarcrm", name: "SugarCRM", fields: [{ name: "Instance URL", key: "apiUrl", type: "text", placeholder: "https://yourinstance.sugarcrm.com" }, { name: "OAuth Token", key: "apiKey", type: "password", placeholder: "Your SugarCRM OAuth token" }] },
  { id: "teamleader", name: "Teamleader", fields: [{ name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Teamleader access token", helpText: "OAuth token from Teamleader Marketplace" }] },
  { id: "teamwork", name: "Teamwork CRM", fields: [{ name: "Site URL", key: "apiUrl", type: "text", placeholder: "https://yoursite.teamwork.com" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your Teamwork API key" }] },
  { id: "vtiger", name: "Vtiger", fields: [{ name: "Instance URL", key: "apiUrl", type: "text", placeholder: "https://yourinstance.vtiger.com" }, { name: "Access Key", key: "apiKey", type: "password", placeholder: "Your Vtiger access key", helpText: "Found in My Preferences → Access Key" }] },
  { id: "zendesksell", name: "Zendesk Sell", fields: [{ name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Zendesk Sell access token", helpText: "OAuth token from Settings → OAuth" }] },
  { id: "accelo", name: "Accelo", fields: [{ name: "Deployment URL", key: "apiUrl", type: "text", placeholder: "https://yourcompany.api.accelo.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Accelo access token" }] },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()

  const [tab, setTab] = useState<Tab>((searchParams?.get("tab") as Tab) || "profile")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Profile ───────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({ username: "", email: "", createdAt: "", userId: "" })
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

  // ── Notification prefs ────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifications: true,
    agentActivityAlerts: true,
    leadResponseAlerts: true,
    errorAlerts: true,
  })

  // ── Email connections ─────────────────────────────────────────────────────
  const [gmailAccounts, setGmailAccounts] = useState<EmailAccount[]>([])
  const [outlookAccounts, setOutlookAccounts] = useState<EmailAccount[]>([])
  const [defaultUseGmail, setDefaultUseGmail] = useState(false)
  const [defaultUseOutlook, setDefaultUseOutlook] = useState(false)

  // ── Domain health ─────────────────────────────────────────────────────────
  const [customDomain, setCustomDomain] = useState("")
  const [domainHealth, setDomainHealth] = useState<{ spf: boolean; dkim: boolean; dmarc: boolean; lastChecked: string | null }>({
    spf: false, dkim: false, dmarc: false, lastChecked: null
  })
  const [checkingDomain, setCheckingDomain] = useState(false)

  // ── Lead targeting defaults ───────────────────────────────────────────────
  const [targeting, setTargeting] = useState({
    targetIndustries: [] as string[],
    targetPositions: [] as string[],
    companySizeMin: 50,
    companySizeMax: 500,
    defaultLeadLimit: 10,
  })
  const [industryInput, setIndustryInput] = useState("")
  const [positionInput, setPositionInput] = useState("")

  // ── Company profile ───────────────────────────────────────────────────────
  const [companyProfile, setCompanyProfile] = useState({
    companyName: "", industry: "", services: "", targetMarket: "",
    companySize: "", description: "", companyAddress: "",
    website: "", linkedinProfile: "", tagline: "", phone: "",
    location: "", founded: "", employees: "", coreOffering: "", keyAdvantages: "",
  })
  const [savingCP, setSavingCP] = useState(false)
  const [analyzingWebsite, setAnalyzingWebsite] = useState(false)
  const [analyzeWebsiteUrl, setAnalyzeWebsiteUrl] = useState("")

  // ── Email settings ────────────────────────────────────────────────────────
  const [aiAutoResponseEnabled, setAiAutoResponseEnabled] = useState(false)
  const [defaultEmailSource, setDefaultEmailSource] = useState<"meridian" | "gmail">("meridian")
  const [defaultRebumpEnabled, setDefaultRebumpEnabled] = useState(true)
  const [savingEmailSettings, setSavingEmailSettings] = useState(false)

  // ── CRM ───────────────────────────────────────────────────────────────────
  const [crmStatus, setCrmStatus] = useState<{ connected: boolean; integration?: string | null; connectedAt?: string | null; autoSync?: boolean }>({ connected: false })
  const [crmLoading, setCrmLoading] = useState(false)
  const [selectedCRM, setSelectedCRM] = useState<typeof CRM_CONFIGS[number] | null>(null)
  const [showCrmDropdown, setShowCrmDropdown] = useState(false)
  const [crmImportedLeads, setCrmImportedLeads] = useState<Array<{ email: string; firstName: string; lastName: string; title: string; phone: string; company: string; crmId: string; source: string }> | null>(null)
  const [crmImportLoading, setCrmImportLoading] = useState(false)
  const [crmImportExpanded, setCrmImportExpanded] = useState(false)
  const [crmCredentials, setCrmCredentials] = useState<Record<string, string>>({})
  const [connectingCrm, setConnectingCrm] = useState(false)
  const [crmError, setCrmError] = useState<string | null>(null)

  // ── Notification feed ────────────────────────────────────────────────────
  const [inboxNotifs, setInboxNotifs]       = useState<Notification[]>([])
  const [notifFilter, setNotifFilter]       = useState('all')
  const [notifLoading, setNotifLoading]     = useState(false)
  const [markingAll, setMarkingAll]         = useState(false)

  const loadInboxNotifs = useCallback(async () => {
    setNotifLoading(true)
    try {
      const r = await api.get('/api/notifications')
      setInboxNotifs(r.data?.notifications ?? [])
    } catch { setInboxNotifs([]) }
    finally { setNotifLoading(false) }
  }, [])

  const markNotifRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`)
      setInboxNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const markAllNotifsRead = async () => {
    setMarkingAll(true)
    try {
      await api.post('/api/notifications/mark-all-read')
      setInboxNotifs(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
    setMarkingAll(false)
  }

  // ── Memory ────────────────────────────────────────────────────────────────
  const [keywords, setKeywords] = useState<KeywordMemory[]>([])
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null)
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'exhausted' | 'good'>('all')
  const [resettingKeyword, setResettingKeyword] = useState<string | null>(null)

  // ── Industry Facts ────────────────────────────────────────────────────────
  type IndustryFact = { id: string; fact: string; industry: string; source: string; age: number; fresh: boolean }
  const [industryFactsGrouped, setIndustryFactsGrouped] = useState<Record<string, IndustryFact[]>>({})
  const [industryFactsTotal, setIndustryFactsTotal] = useState(0)
  const [industryFactsLoading, setIndustryFactsLoading] = useState(false)
  const [deletingFactId, setDeletingFactId] = useState<string | null>(null)
  const [deletingIndustry, setDeletingIndustry] = useState<string | null>(null)
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null)

  const fetchIndustryFacts = useCallback(async () => {
    setIndustryFactsLoading(true)
    try {
      const res = await api.get('/api/training/industry-facts')
      if (res.data.success) {
        setIndustryFactsGrouped(res.data.grouped || {})
        setIndustryFactsTotal(res.data.total || 0)
      }
    } catch {}
    finally { setIndustryFactsLoading(false) }
  }, [])

  const deleteIndustryFact = async (id: string) => {
    setDeletingFactId(id)
    try {
      await api.delete(`/api/training/industry-facts/${encodeURIComponent(id)}`)
      await fetchIndustryFacts()
    } catch {}
    finally { setDeletingFactId(null) }
  }

  const deleteIndustry = async (industry: string) => {
    if (!confirm(`Delete all facts for "${industry}"? This cannot be undone.`)) return
    setDeletingIndustry(industry)
    try {
      await api.delete(`/api/training/industry-facts/industry/${encodeURIComponent(industry)}`)
      await fetchIndustryFacts()
    } catch {}
    finally { setDeletingIndustry(null) }
  }

  const fetchMemory = useCallback(async () => {
    setMemoryLoading(true)
    try {
      const [keywordsRes, statsRes] = await Promise.allSettled([
        api.get('/api/lead-agent/memory/keywords'),
        api.get('/api/lead-agent/memory/stats')
      ])

      if (keywordsRes.status === 'fulfilled' && keywordsRes.value.data.success) {
        setKeywords(keywordsRes.value.data.keywords || [])
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.data.success) {
        setMemoryStats(statsRes.value.data.stats)
      }
    } catch {}
    finally { setMemoryLoading(false) }
  }, [])

  const resetKeyword = async (searchCombo: string) => {
    if (!confirm(`Reset "${searchCombo}"? This will clear its learning history.`)) return

    setResettingKeyword(searchCombo)
    try {
      const response = await api.delete(`/api/lead-agent/memory/keyword/${encodeURIComponent(searchCombo)}`)
      
      if (response.data.success) {
        setKeywords(prev => prev.filter(k => k.searchCombo !== searchCombo))
        const statsRes = await api.get('/api/lead-agent/memory/stats')
        if (statsRes.data.success) setMemoryStats(statsRes.data.stats)
        toast.success('Keyword reset successfully')
      }
    } catch {
      toast.error('Failed to reset keyword')
    } finally {
      setResettingKeyword(null)
    }
  }

  const resetAllKeywords = async () => {
    if (!confirm('Reset ALL keyword memory? This will clear all learning history and cannot be undone.')) return

    setResettingKeyword('all')
    try {
      const response = await api.delete('/api/lead-agent/memory/reset-all')
      
      if (response.data.success) {
        setKeywords([])
        setMemoryStats({
          totalKeywords: 0,
          exhaustedKeywords: 0,
          avgDuplicateRate: 0,
          totalSearchAttempts: 0
        })
        toast.success('All memory reset successfully')
      }
    } catch {
      toast.error('Failed to reset memory')
    } finally {
      setResettingKeyword(null)
    }
  }

  // ── Billing ───────────────────────────────────────────────────────────────
  // ── Fetch all ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, settingsRes] = await Promise.allSettled([
        api.get("/api/auth/profile"),
        api.get("/api/auth/settings"),
      ])
      if (profileRes.status === "fulfilled") {
        const u = profileRes.value.data.user
        setProfile({ username: u?.username || "", email: u?.email || "", createdAt: u?.createdAt || "", userId: u?.userId || "" })
      }
      if (settingsRes.status === "fulfilled") {
        const s = settingsRes.value.data.settings
        if (s?.preferences) {
          setDefaultUseGmail(s.preferences.defaultUseGmail || false)
          setDefaultUseOutlook(s.preferences.defaultUseOutlook || false)
          if (s.preferences.targetIndustries) setTargeting(prev => ({ ...prev, targetIndustries: s.preferences.targetIndustries }))
          if (s.preferences.targetPositions)  setTargeting(prev => ({ ...prev, targetPositions:  s.preferences.targetPositions }))
          if (s.preferences.companySizeMin)   setTargeting(prev => ({ ...prev, companySizeMin:   s.preferences.companySizeMin }))
          if (s.preferences.companySizeMax)   setTargeting(prev => ({ ...prev, companySizeMax:   s.preferences.companySizeMax }))
          if (s.preferences.defaultLeadLimit) setTargeting(prev => ({ ...prev, defaultLeadLimit: s.preferences.defaultLeadLimit }))
          if (s.preferences.notifPrefs)       setNotifPrefs(prev => ({ ...prev, ...s.preferences.notifPrefs }))
          if (typeof s.preferences.aiAutoResponseEnabled === "boolean") setAiAutoResponseEnabled(s.preferences.aiAutoResponseEnabled)
          if (s.preferences.defaultEmailSource) setDefaultEmailSource(s.preferences.defaultEmailSource)
          if (typeof s.preferences.defaultRebumpEnabled === "boolean") setDefaultRebumpEnabled(s.preferences.defaultRebumpEnabled)
        }
        if (s?.emailSettings) {
          setCustomDomain(s.emailSettings.customDomain || "")
          if (s.emailSettings.domainHealth) setDomainHealth(s.emailSettings.domainHealth)
        }
      }
      const [gmailRes, outlookRes, cpRes, crmRes] = await Promise.allSettled([
        api.get("/api/auth/gmail/status"),
        api.get("/api/auth/outlook/status"),
        api.get("/api/company-profile/profile"),
        api.get("/api/crm/status"),
      ])
      if (gmailRes.status === "fulfilled")   setGmailAccounts(gmailRes.value.data.accounts || [])
      if (outlookRes.status === "fulfilled") setOutlookAccounts(outlookRes.value.data.accounts || [])
      if (cpRes.status === "fulfilled" && cpRes.value.data.profile) {
        setCompanyProfile(prev => ({ ...prev, ...cpRes.value.data.profile }))
        setAnalyzeWebsiteUrl(cpRes.value.data.profile.website || "")
      }
      if (crmRes.status === "fulfilled") setCrmStatus(crmRes.value.data)
    } catch { }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { loadInboxNotifs() }, [loadInboxNotifs])

  // Load memory + industry facts when memory tab is active
  useEffect(() => {
    if (tab === 'memory') {
      fetchMemory()
      fetchIndustryFacts()
    }
  }, [tab, fetchMemory, fetchIndustryFacts])

  // Sync tab state when URL ?tab= param changes (e.g. sidebar subtab clicks)
  useEffect(() => {
    const t = searchParams?.get("tab") as Tab | null
    if (t) setTab(t)
  }, [searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("gmailAuth") === "success")   { toast.success("Gmail connected!"); setTab("email") }
    if (params.get("outlookAuth") === "success") { toast.success("Outlook connected!"); setTab("email") }
    if (params.get("gmailAuth") || params.get("outlookAuth"))
      window.history.replaceState({}, "", "/settings")
  }, [])

  const switchTab = (t: Tab) => {
    setTab(t)
    router.replace(`/settings?tab=${t}`, { scroll: false })
  }

  const savePrefs = async (updates: object) => {
    try { await api.post("/api/auth/settings/preferences", { preferences: updates }) }
    catch { toast.error("Failed to save") }
  }

  // Gmail OAuth popup
  const connectGmail = () => {
    const w = window.open(
      `${api.defaults.baseURL}/api/auth/gmail/authorize?userId=${user?.userId}`,
      "Gmail", "width=600,height=700,left=400,top=100"
    )
    let got = false
    const onMsg = async (e: MessageEvent) => {
      if (e.data?.type !== "GMAIL_CONNECTED") return
      got = true
      toast.success(`Gmail connected: ${e.data.email}`)
      const r = await api.get("/api/auth/gmail/status").catch(() => null)
      if (r?.data?.accounts) setGmailAccounts(r.data.accounts)
    }
    window.addEventListener("message", onMsg)
    const poll = setInterval(() => {
      if (!w?.closed) return
      clearInterval(poll); window.removeEventListener("message", onMsg)
      if (!got) setTimeout(async () => {
        const r = await api.get("/api/auth/gmail/status").catch(() => null)
        if (r?.data?.accounts?.length) { setGmailAccounts(r.data.accounts); toast.success("Gmail connected!") }
      }, 1000)
    }, 800)
  }

  const connectOutlook = async () => {
    try {
      const r = await api.get("/api/auth/outlook/oauth-url")
      const w = window.open(r.data.authUrl, "Outlook", "width=600,height=700,left=400,top=100")
      const onMsg = async (e: MessageEvent) => {
        if (e.data?.type !== "OUTLOOK_CONNECTED") return
        toast.success(`Outlook connected: ${e.data.email}`)
        const sr = await api.get("/api/auth/outlook/status").catch(() => null)
        if (sr?.data?.accounts) setOutlookAccounts(sr.data.accounts)
      }
      window.addEventListener("message", onMsg)
      const poll = setInterval(() => { if (!w?.closed) return; clearInterval(poll); window.removeEventListener("message", onMsg) }, 800)
    } catch { toast.error("Failed to connect Outlook") }
  }

  const disconnectGmail = async (email: string) => {
    if (!confirm(`Disconnect ${email}?`)) return
    try {
      await api.post("/api/auth/gmail/disconnect", { email })
      setGmailAccounts(a => a.filter(x => x.email !== email))
      toast.success("Disconnected")
    } catch { toast.error("Failed to disconnect") }
  }

  const disconnectOutlook = async (email: string) => {
    if (!confirm(`Disconnect ${email}?`)) return
    try {
      await api.post("/api/auth/outlook/disconnect", { email })
      setOutlookAccounts(a => a.filter(x => x.email !== email))
      toast.success("Disconnected")
    } catch { toast.error("Failed to disconnect") }
  }

  const checkDomainHealth = async () => {
    if (!customDomain.trim()) { toast.error("Enter a domain first"); return }
    setCheckingDomain(true)
    try {
      const r = await api.post("/api/email/check-domain-health", { domain: customDomain })
      if (r.data.success) {
        const h = { spf: r.data.health.spf || false, dkim: r.data.health.dkim || false, dmarc: r.data.health.dmarc || false, lastChecked: new Date().toISOString() }
        setDomainHealth(h)
        toast.success("Domain health checked!")
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Check failed")
    } finally { setCheckingDomain(false) }
  }

  const saveTargeting = async () => {
    setSaving(true)
    try {
      await savePrefs({
        targetIndustries: targeting.targetIndustries,
        targetPositions:  targeting.targetPositions,
        companySizeMin:   targeting.companySizeMin,
        companySizeMax:   targeting.companySizeMax,
        defaultLeadLimit: targeting.defaultLeadLimit,
      })
      toast.success("Lead targeting defaults saved!")
    } finally { setSaving(false) }
  }

  const addTag = (field: "targetIndustries" | "targetPositions", value: string) => {
    const v = value.trim()
    if (!v || targeting[field].includes(v)) return
    setTargeting(t => ({ ...t, [field]: [...t[field], v] }))
  }

  const removeTag = (field: "targetIndustries" | "targetPositions", value: string) => {
    setTargeting(t => ({ ...t, [field]: t[field].filter(x => x !== value) }))
  }

  // Company profile helpers
  const saveCompanyProfile = async () => {
    setSavingCP(true)
    try {
      await api.post("/api/company-profile/save", { profile: companyProfile, recommendedPreset: null })
      toast.success("Company profile saved!")
    } catch { toast.error("Failed to save profile") }
    finally { setSavingCP(false) }
  }

  const analyzeFromWebsite = async () => {
    if (!analyzeWebsiteUrl.trim()) { toast.error("Enter a website URL first"); return }
    setAnalyzingWebsite(true)
    try {
      const r = await api.post("/api/company-profile/analyze", { website: analyzeWebsiteUrl })
      if (r.data?.profile) {
        setCompanyProfile(prev => ({ ...prev, ...r.data.profile }))
        toast.success("Profile filled from website!")
      }
    } catch { toast.error("Failed to analyze website") }
    finally { setAnalyzingWebsite(false) }
  }

  // Email settings helpers
  const saveEmailSettings = async () => {
    setSavingEmailSettings(true)
    try {
      await savePrefs({ aiAutoResponseEnabled, defaultEmailSource, defaultRebumpEnabled })
      toast.success("Email settings saved!")
    } catch { toast.error("Failed to save") }
    finally { setSavingEmailSettings(false) }
  }

  // CRM helpers
  const connectCRMDirect = async () => {
    if (!selectedCRM) return
    const missing = selectedCRM.fields.filter((f: any) => !crmCredentials[f.key]?.trim())
    if (missing.length > 0) {
      setCrmError(`Please fill in: ${missing.map((f: any) => f.name).join(", ")}`)
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
      const statusRes = await api.get("/api/crm/status").catch(() => null)
      if (statusRes?.data) setCrmStatus(statusRes.data)
      toast.success(`${selectedCRM.name} connected!`)
      setSelectedCRM(null)
      setCrmCredentials({})
    } catch (e: any) {
      setCrmError(e.response?.data?.error || "Failed to connect. Please check your credentials.")
    } finally {
      setConnectingCrm(false)
    }
  }

  const disconnectCRM = async () => {
    if (!confirm("Disconnect your CRM? This will stop lead syncing.")) return
    setCrmLoading(true)
    try {
      await api.post("/api/crm/disconnect")
      setCrmStatus({ connected: false })
      setCrmImportedLeads(null)
      toast.success("CRM disconnected")
    } catch { toast.error("Failed to disconnect") }
    finally { setCrmLoading(false) }
  }

  const importLeadsFromCRM = async () => {
    setCrmImportLoading(true)
    try {
      const res = await api.get("/api/crm/import-leads?limit=200")
      if (res.data?.contacts) {
        setCrmImportedLeads(res.data.contacts)
        setCrmImportExpanded(true)
        toast.success(`Loaded ${res.data.contacts.length} contacts from ${crmStatus.integration}`)
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to import leads")
    } finally {
      setCrmImportLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Horizontal top nav */}
      <nav className="flex gap-1 border-b border-border pb-0 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon
          const notifUnreadCount = inboxNotifs.filter(n => !n.read).length
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {t.label}
              {t.id === "notifications" && notifUnreadCount > 0 && (
                <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Tab content */}
      <div className="space-y-5">

        {/* ── PROFILE ───────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <>
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-5">Account Information</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input value={profile.username} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={profile.email} disabled className="opacity-60" />
                </div>
                {profile.userId && (
                  <div className="space-y-1.5">
                    <Label>User ID</Label>
                    <div className="flex gap-2">
                      <Input value={profile.userId} disabled className="opacity-60 font-mono text-xs" />
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => { navigator.clipboard.writeText(profile.userId); toast.success("Copied!") }}>Copy</Button>
                    </div>
                  </div>
                )}
                {profile.createdAt && (
                  <div className="space-y-1.5">
                    <Label>Member Since</Label>
                    <Input
                      value={new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      disabled className="opacity-60"
                    />
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-5">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <Input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter current password" />
                </div>
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Enter new password" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Confirm new password" />
                </div>
                {pwError && <p className="text-sm text-destructive">{pwError}</p>}
                <div className="flex items-center gap-3">
                  <Button disabled={pwSaving} onClick={async () => {
                    setPwError(null)
                    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwError("All fields required"); return }
                    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords don't match"); return }
                    if (pwForm.next.length < 8) { setPwError("Password must be at least 8 characters"); return }
                    setPwSaving(true)
                    try {
                      await api.post("/api/auth/change-password", { currentPassword: pwForm.current, newPassword: pwForm.next })
                      toast.success("Password changed!")
                      setPwForm({ current: "", next: "", confirm: "" })
                    } catch (e: any) {
                      setPwError(e.response?.data?.message || "Failed to change password")
                    } finally { setPwSaving(false) }
                  }}>
                    {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                  </Button>
                  <button
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
                    disabled={forgotSent}
                    onClick={async () => {
                      if (!profile.email) return
                      try {
                        await api.post("/api/auth/forgot-password", { email: profile.email })
                        setForgotSent(true)
                        toast.success("Reset link sent to " + profile.email)
                      } catch { toast.error("Failed to send reset email") }
                    }}
                  >
                    {forgotSent ? "Reset email sent ✓" : "Forgot password?"}
                  </button>
                </div>
              </div>
            </Card>
            <Card className="p-6 border-destructive/40">
              <h3 className="font-semibold text-lg text-destructive mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Reset all account data and restart onboarding. Deletes all agents, emails, analytics, and company profile.{" "}
                <strong>This action is irreversible.</strong>
              </p>
              <Button variant="destructive" onClick={async () => {
                if (!confirm("Are you sure? This will delete ALL data. This cannot be undone.")) return
                try {
                  await api.delete("/api/company-profile")
                  toast.success("Account reset. Redirecting to sign in...")
                  localStorage.clear()
                  sessionStorage.clear()
                  setTimeout(() => { window.location.href = "/signin" }, 1500)
                } catch (e: any) {
                  toast.error(e.response?.data?.error || "Failed to reset account")
                }
              }}>
                Reset Account Data
              </Button>
            </Card>
          </>
        )}

        {/* ── APPEARANCE ────────────────────────────────────────────────── */}
        {tab === "appearance" && (
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-5">Appearance</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3 max-w-sm">
                {(["light", "dark", "system"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                      theme === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`w-10 h-6 rounded-md mx-auto mb-2 ${
                      t === "light" ? "bg-white border border-gray-200" :
                      t === "dark"  ? "bg-gray-900 border border-gray-700" :
                      "bg-gradient-to-r from-white to-gray-900 border border-gray-400"
                    }`} />
                    <p className="text-xs font-medium capitalize">{t}</p>
                    {theme === t && (
                      <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                System follows your device's dark/light mode preference.
              </p>
            </div>
          </Card>
        )}

        {/* ── NOTIFICATIONS ─────────────────────────────────────────────── */}
        {tab === "notifications" && (() => {
          const notifUnread = inboxNotifs.filter(n => !n.read).length
          const filteredNotifs = inboxNotifs.filter(n => {
            if (notifFilter === 'unread') return !n.read
            if (notifFilter === 'all')    return true
            return n.type === notifFilter
          })
          const getNotifMeta = (type: NotifType) => NOTIF_TYPE_META[type] ?? NOTIF_TYPE_META['issue']

          return (
            <div className="space-y-5">
              {/* Feed card */}
              <Card className="overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                  <Bell className="w-4 h-4 text-primary flex-shrink-0" />
                  <h3 className="font-semibold text-base flex-1">Notifications</h3>
                  {notifUnread > 0 && (
                    <Badge variant="destructive" className="text-[11px] h-5 px-1.5">{notifUnread}</Badge>
                  )}
                  <button
                    onClick={loadInboxNotifs}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${notifLoading ? 'animate-spin' : ''}`} />
                  </button>
                  {notifUnread > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllNotifsRead} disabled={markingAll} className="h-7 text-xs gap-1.5">
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </Button>
                  )}
                </div>

                {/* Filter pills */}
                <div className="flex gap-1.5 px-5 py-3 border-b border-border overflow-x-auto scrollbar-hide flex-wrap">
                  {NOTIF_FILTER_TABS.map(ft => {
                    const count = ft.id === 'all' ? inboxNotifs.length
                      : ft.id === 'unread' ? notifUnread
                      : inboxNotifs.filter(n => n.type === ft.id).length
                    const active = notifFilter === ft.id
                    return (
                      <button
                        key={ft.id}
                        onClick={() => setNotifFilter(ft.id)}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {ft.label}
                        {count > 0 && (
                          <span className={`text-[10px] px-1 rounded-full ${active ? 'bg-white/20' : 'bg-primary/20 text-primary'}`}>{count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Notification list */}
                <div className="px-4 py-3 max-h-[480px] overflow-y-auto space-y-2">
                  {notifLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredNotifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Inbox className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No notifications</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notifFilter === 'unread' ? "You're all caught up!" : "Activity will appear here as your agent works."}
                      </p>
                    </div>
                  ) : (
                    filteredNotifs.map(notif => {
                      const meta = getNotifMeta(notif.type)
                      const Icon = meta.icon
                      return (
                        <div
                          key={notif.id}
                          onClick={() => { if (!notif.read) markNotifRead(notif.id) }}
                          className={`relative flex gap-3 p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                            notif.read ? 'bg-card border-border opacity-75 hover:opacity-100' : `${meta.bg} border`
                          }`}
                        >
                          {!notif.read && (
                            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.badge}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-start gap-2 flex-wrap mb-0.5">
                              <span className="text-sm font-semibold text-foreground leading-tight">{notif.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.badge}`}>{meta.label}</span>
                              {notif.severity && notif.severity !== 'low' && (
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${SEVERITY_STYLES[notif.severity as Severity] ?? 'text-muted-foreground'}`}>
                                  {notif.severity}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground leading-snug mb-1 line-clamp-2">{notif.message}</p>
                            {notif.data?.subject && (
                              <p className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded mb-1 truncate">
                                Re: {String(notif.data.subject)}
                              </p>
                            )}
                            {notif.data?.leadName && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{String(notif.data.leadName)}</span>
                                {notif.data.company ? ` · ${String(notif.data.company)}` : ''}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-1.5">{notifFormatTime(notif.timestamp)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>

              {/* Preferences card */}
              <Card className="p-6">
                <h3 className="font-semibold text-base mb-4">Preferences</h3>
                <div className="space-y-1">
                  {[
                    { key: "emailNotifications",  label: "Email Notifications",   desc: "Important account updates via email" },
                    { key: "agentActivityAlerts", label: "Agent Activity Alerts",  desc: "When agents complete campaigns or hit issues" },
                    { key: "leadResponseAlerts",  label: "Lead Response Alerts",   desc: "When a lead replies to outreach" },
                    { key: "errorAlerts",         label: "Error Alerts",           desc: "Failed sends, API issues" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifPrefs[item.key as keyof typeof notifPrefs]}
                        onCheckedChange={async v => {
                          const updated = { ...notifPrefs, [item.key]: v }
                          setNotifPrefs(updated)
                          await savePrefs({ notifPrefs: updated })
                          toast.success("Saved")
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )
        })()}


        {/* ── EMAIL CONNECTIONS ─────────────────────────────────────────── */}
        {tab === "email" && (
          <Card className="p-6 space-y-8">
            <div>
              <h3 className="font-semibold text-lg mb-1">Email Connections</h3>
              <p className="text-sm text-muted-foreground">Connect email accounts for outreach cycling and better deliverability.</p>
            </div>

            {/* Step 1: Gmail */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-sm font-semibold">Connect Your Gmail</p>
                  <p className="text-xs text-muted-foreground">Add multiple accounts for email cycling</p>
                </div>
                {gmailAccounts.length > 0 && <Badge variant="secondary" className="ml-auto">{gmailAccounts.length} connected</Badge>}
              </div>
              {gmailAccounts.length > 0 && (
                <div className="space-y-2 mb-4 ml-10">
                  {gmailAccounts.map((acc, i) => (
                    <div key={acc.email} className={`flex items-center gap-3 p-3 rounded-lg border ${acc.isActive ? "border-primary bg-primary/5" : "border-border"}`}>
                      {acc.profilePicture
                        ? <img src={acc.profilePicture} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">{acc.email[0].toUpperCase()}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acc.email}</p>
                        <p className="text-xs text-muted-foreground">Connected {new Date(acc.connectedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {acc.isActive
                          ? <Badge className="text-[10px]">Active</Badge>
                          : <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={async () => {
                              await api.post("/api/auth/gmail/set-active", { accountIndex: i })
                              setGmailAccounts(a => a.map((x, j) => ({ ...x, isActive: j === i })))
                            }}>Set Active</Button>
                        }
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => disconnectGmail(acc.email)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="ml-10">
                <Button variant="outline" onClick={connectGmail} className="gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {gmailAccounts.length > 0 ? "Add Another Account" : "Connect Gmail"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Step 2: Outlook */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-sm font-semibold">Connect Your Outlook <span className="text-muted-foreground font-normal">(Optional)</span></p>
                  <p className="text-xs text-muted-foreground">Office 365 / Outlook for additional account cycling</p>
                </div>
                {outlookAccounts.length > 0 && <Badge variant="secondary" className="ml-auto">{outlookAccounts.length} connected</Badge>}
              </div>
              {outlookAccounts.length > 0 && (
                <div className="space-y-2 mb-4 ml-10">
                  {outlookAccounts.map((acc, i) => (
                    <div key={acc.email} className={`flex items-center gap-3 p-3 rounded-lg border ${acc.isActive ? "border-primary bg-primary/5" : "border-border"}`}>
                      {acc.profilePicture
                        ? <img src={acc.profilePicture} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{acc.email[0].toUpperCase()}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acc.email}</p>
                        <p className="text-xs text-muted-foreground">Connected {new Date(acc.connectedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {acc.isActive
                          ? <Badge className="text-[10px]">Active</Badge>
                          : <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={async () => {
                              await api.post("/api/auth/outlook/set-active", { accountIndex: i })
                              setOutlookAccounts(a => a.map((x, j) => ({ ...x, isActive: j === i })))
                            }}>Set Active</Button>
                        }
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => disconnectOutlook(acc.email)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="ml-10">
                <Button variant="outline" onClick={connectOutlook} className="gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#0078D4" d="M23 12c0 6.07-4.93 11-11 11S1 18.07 1 12 5.93 1 12 1s11 4.93 11 11z"/>
                    <path fill="#fff" d="M15.5 8.5h-3v7h1.5v-2.5H15a2.25 2.25 0 000-4.5zm0 3H14V10h1.5a.75.75 0 010 1.5zM8.5 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0 5.5a2 2 0 110-4 2 2 0 010 4z"/>
                  </svg>
                  {outlookAccounts.length > 0 ? "Add Another Account" : "Connect Outlook"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Default sending toggles */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Default Sending</p>
              {gmailAccounts.length > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm">Default Gmail Sending</p>
                    <p className="text-xs text-muted-foreground">Use Gmail as the default sending source for new agents</p>
                  </div>
                  <Switch
                    checked={defaultUseGmail}
                    onCheckedChange={async v => {
                      setDefaultUseGmail(v)
                      if (v) setDefaultUseOutlook(false)
                      await savePrefs({ defaultUseGmail: v, defaultUseOutlook: v ? false : defaultUseOutlook })
                    }}
                  />
                </div>
              )}
              {outlookAccounts.length > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm">Default Outlook Sending</p>
                    <p className="text-xs text-muted-foreground">Use Outlook as the default sending source for new agents</p>
                  </div>
                  <Switch
                    checked={defaultUseOutlook}
                    onCheckedChange={async v => {
                      setDefaultUseOutlook(v)
                      if (v) setDefaultUseGmail(false)
                      await savePrefs({ defaultUseOutlook: v, defaultUseGmail: v ? false : defaultUseGmail })
                    }}
                  />
                </div>
              )}
              {gmailAccounts.length === 0 && outlookAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground">Connect an account above to configure default sending.</p>
              )}
            </div>
          </Card>
        )}



        {/* ── PRESETS ───────────────────────────────────────────────────── */}
        {tab === "presets" && <PresetsContent />}

        {/* ── COMPANY PROFILE ───────────────────────────────────────────── */}
        {tab === "company-profile" && (
          <Card className="p-6 space-y-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">Company Profile</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Used by agents to personalize outreach and email copy</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Input
                  value={analyzeWebsiteUrl}
                  onChange={e => setAnalyzeWebsiteUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="text-sm w-56"
                />
                <Button variant="secondary" className="gap-1.5 flex-shrink-0" onClick={analyzeFromWebsite} disabled={analyzingWebsite}>
                  {analyzingWebsite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Auto-fill
                </Button>
              </div>
            </div>

            {/* Basic info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={companyProfile.companyName} onChange={e => setCompanyProfile(p => ({ ...p, companyName: e.target.value }))} placeholder="Acme Inc." />
                </div>
                <div className="space-y-1.5">
                  <Label>Tagline</Label>
                  <Input value={companyProfile.tagline} onChange={e => setCompanyProfile(p => ({ ...p, tagline: e.target.value }))} placeholder="A brief, memorable phrase" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Input value={companyProfile.industry} onChange={e => setCompanyProfile(p => ({ ...p, industry: e.target.value }))} placeholder="SaaS, Healthcare…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Size</Label>
                  <Input value={companyProfile.companySize} onChange={e => setCompanyProfile(p => ({ ...p, companySize: e.target.value }))} placeholder="1-10, 50-200…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea className="w-full min-h-[72px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" value={companyProfile.description} onChange={e => setCompanyProfile(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of your company…" />
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact & Links</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={companyProfile.website} onChange={e => setCompanyProfile(p => ({ ...p, website: e.target.value }))} placeholder="https://yourcompany.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>LinkedIn</Label>
                  <Input value={companyProfile.linkedinProfile} onChange={e => setCompanyProfile(p => ({ ...p, linkedinProfile: e.target.value }))} placeholder="https://linkedin.com/company/…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={companyProfile.phone} onChange={e => setCompanyProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={companyProfile.companyAddress} onChange={e => setCompanyProfile(p => ({ ...p, companyAddress: e.target.value }))} placeholder="123 Main St, City, State ZIP" />
                  <p className="text-xs text-muted-foreground">Appears in email signatures.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={companyProfile.location} onChange={e => setCompanyProfile(p => ({ ...p, location: e.target.value }))} placeholder="City, Country" />
                </div>
                <div className="space-y-1.5">
                  <Label>Founded</Label>
                  <Input value={companyProfile.founded} onChange={e => setCompanyProfile(p => ({ ...p, founded: e.target.value }))} placeholder="2020" />
                </div>
                <div className="space-y-1.5">
                  <Label>Employees</Label>
                  <Input value={companyProfile.employees} onChange={e => setCompanyProfile(p => ({ ...p, employees: e.target.value }))} placeholder="25" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Market & Offering */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Market & Offering</p>
              <div className="space-y-1.5">
                <Label>Target Market</Label>
                <Input value={companyProfile.targetMarket} onChange={e => setCompanyProfile(p => ({ ...p, targetMarket: e.target.value }))} placeholder="e.g. B2B SaaS companies with 50-500 employees" />
              </div>
              <div className="space-y-1.5">
                <Label>Services / Products</Label>
                <textarea className="w-full min-h-[72px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" value={companyProfile.services} onChange={e => setCompanyProfile(p => ({ ...p, services: e.target.value }))} placeholder="Describe your offerings…" />
              </div>
              <div className="space-y-1.5">
                <Label>Core Offering</Label>
                <Input value={companyProfile.coreOffering} onChange={e => setCompanyProfile(p => ({ ...p, coreOffering: e.target.value }))} placeholder="e.g. AI-powered outreach platform" />
              </div>
              <div className="space-y-1.5">
                <Label>Key Advantages</Label>
                <textarea className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" value={companyProfile.keyAdvantages} onChange={e => setCompanyProfile(p => ({ ...p, keyAdvantages: e.target.value }))} placeholder="What makes you different?" />
              </div>
            </div>

            <Button onClick={saveCompanyProfile} disabled={savingCP}>
              {savingCP && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Save Company Profile
            </Button>
          </Card>
        )}

        {/* ── EMAIL SETTINGS (merged into email tab) ─────────────────── */}
        {tab === "email" && (
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-5">Email Settings</h3>
            <div className="space-y-6 max-w-lg">

              {/* AI Auto Response */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">AI Auto Response</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enable AI-powered automatic email responses when leads reply</p>
                </div>
                <Switch
                  checked={aiAutoResponseEnabled}
                  onCheckedChange={setAiAutoResponseEnabled}
                />
              </div>

              <Separator />

              {/* Default Email Source */}
              <div>
                <p className="text-sm font-medium mb-3">Default Email Source</p>
                <div className="space-y-2">
                  {[
                    { value: "meridian", label: "Meridian Email", desc: "Use our managed email service (mg.meridian)" },
                    { value: "gmail",    label: "Connected Gmail", desc: gmailAccounts.length > 0 ? `Send from: ${gmailAccounts.find(a => a.isActive)?.email || gmailAccounts[0]?.email}` : "No Gmail connected — go to the Email tab first" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => opt.value === "gmail" && gmailAccounts.length === 0 ? undefined : setDefaultEmailSource(opt.value as "meridian" | "gmail")}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all ${
                        defaultEmailSource === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      } ${opt.value === "gmail" && gmailAccounts.length === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${defaultEmailSource === opt.value ? "border-primary" : "border-muted-foreground"}`}>
                        {defaultEmailSource === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Default Rebump */}
              <div>
                <p className="text-sm font-medium mb-3">Default Rebump Behavior</p>
                <div className="space-y-2">
                  {[
                    { value: true,  label: "Rebump Enabled",  desc: "Send follow-up emails after no response" },
                    { value: false, label: "Rebump Disabled", desc: "No automatic follow-up emails" },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setDefaultRebumpEnabled(opt.value)}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                        defaultRebumpEnabled === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${defaultRebumpEnabled === opt.value ? "border-primary" : "border-muted-foreground"}`}>
                        {defaultRebumpEnabled === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">This is the default for new agents. Override per-agent in agent settings.</p>
              </div>

              <Button onClick={saveEmailSettings} disabled={savingEmailSettings}>
                {savingEmailSettings && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                Save Email Settings
              </Button>
            </div>
          </Card>
        )}

        {/* ── CRM ───────────────────────────────────────────────────────── */}
        {tab === "crm" && (
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-1">CRM Integration</h3>
              <p className="text-sm text-muted-foreground">
                Connect your CRM to automatically sync researched leads. Supports HubSpot, Salesforce, Pipedrive, Zoho, and 17 more.
              </p>
            </div>

            {/* Connected state */}
            {crmStatus.connected && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{crmStatus.integration || "CRM"} Connected</p>
                    {crmStatus.connectedAt && (
                      <p className="text-xs text-muted-foreground">Connected {new Date(crmStatus.connectedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Active</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setCrmStatus({ connected: false }); setSelectedCRM(null); setCrmCredentials({}) }}
                    disabled={crmLoading}
                    className="gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconnect
                  </Button>
                  <Button variant="ghost" onClick={disconnectCRM} disabled={crmLoading} className="gap-1.5 text-destructive hover:text-destructive">
                    {crmLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                    Disconnect
                  </Button>
                </div>

                {/* Import leads section */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">Import from {crmStatus.integration}</p>
                      <p className="text-xs text-muted-foreground">Pull existing contacts into Meridian for outreach</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={importLeadsFromCRM} disabled={crmImportLoading} className="gap-1.5">
                      {crmImportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                      {crmImportLoading ? 'Loading…' : crmImportedLeads ? 'Refresh' : 'Import Contacts'}
                    </Button>
                  </div>
                  {crmImportedLeads && crmImportedLeads.length > 0 && (
                    <div>
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors border-t"
                        onClick={() => setCrmImportExpanded(v => !v)}
                      >
                        <span>{crmImportedLeads.length} contacts loaded</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${crmImportExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {crmImportExpanded && (
                        <div className="max-h-72 overflow-y-auto border-t divide-y divide-border/50">
                          {crmImportedLeads.map((c, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/30 transition-colors">
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-semibold text-muted-foreground">
                                  {(c.firstName?.[0] || c.email[0] || '?').toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {c.firstName || c.lastName ? `${c.firstName} ${c.lastName}`.trim() : c.email}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                              </div>
                              {c.title && <span className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[120px]">{c.title}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {crmImportedLeads && crmImportedLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4 border-t">No contacts with email addresses found</p>
                  )}
                </div>
              </div>
            )}

            {/* Not connected — dropdown + credential form */}
            {!crmStatus.connected && (
              <div className="space-y-5">
                {/* CRM selector dropdown */}
                {!selectedCRM && (
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
                              onClick={() => { setSelectedCRM(crm as any); setShowCrmDropdown(false); setCrmCredentials({}); setCrmError(null) }}
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
                )}

                {/* Credential form for selected CRM */}
                {selectedCRM && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
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

                    {selectedCRM.fields.map((field: any) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-xs">{field.name}</Label>
                        <Input
                          type={field.type}
                          value={crmCredentials[field.key] || ""}
                          onChange={(e) => setCrmCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                        />
                        {field.helpText && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                      </div>
                    ))}

                    {crmError && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                        <p className="text-xs text-destructive">{crmError}</p>
                      </div>
                    )}

                    <Button onClick={connectCRMDirect} disabled={connectingCrm} className="w-full gap-2">
                      {connectingCrm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      {connectingCrm ? "Connecting…" : `Connect ${selectedCRM.name}`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── MEMORY ───────────────────────────────────────────────────────── */}
        {tab === "memory" && (() => {
          const filteredKeywords = keywords.filter(k => {
            if (memoryFilter === 'exhausted') return k.isExhausted
            if (memoryFilter === 'good') return !k.isExhausted
            return true
          }).sort((a, b) => b.cumulativeDuplicateRate - a.cumulativeDuplicateRate)

          const getSourceBadge = (source: string) => {
            const badges = {
              base: { text: 'Base', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
              ai: { text: 'AI Generated', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
              campaign: { text: 'Campaign', color: 'bg-green-500/10 text-green-500 border-green-500/20' }
            }
            return badges[source as keyof typeof badges] || badges.base
          }

          return (
            <div className="space-y-5">
              {/* Header with actions */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Keyword Learning Memory</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMemory()}
                      disabled={memoryLoading}
                      className="gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${memoryLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    {keywords.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={resetAllKeywords}
                        disabled={resettingKeyword === 'all'}
                        className="gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {resettingKeyword === 'all' ? 'Resetting...' : 'Reset All'}
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  AI agents learn from search results to avoid exhausted keyword combinations. Track duplicate rates and reset underperforming keywords.
                </p>
              </Card>

              {/* Stats Cards */}
              {memoryStats && (
                <div className="grid grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Total Keywords</div>
                    <div className="text-2xl font-bold">{memoryStats.totalKeywords}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Exhausted</div>
                    <div className="text-2xl font-bold text-destructive">{memoryStats.exhaustedKeywords}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Avg Duplicate Rate</div>
                    <div className="text-2xl font-bold text-orange-500">{memoryStats.avgDuplicateRate.toFixed(1)}%</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Total Searches</div>
                    <div className="text-2xl font-bold">{memoryStats.totalSearchAttempts}</div>
                  </Card>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={memoryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMemoryFilter('all')}
                  className="text-xs"
                >
                  All ({keywords.length})
                </Button>
                <Button
                  variant={memoryFilter === 'exhausted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMemoryFilter('exhausted')}
                  className="text-xs"
                >
                  Exhausted ({keywords.filter(k => k.isExhausted).length})
                </Button>
                <Button
                  variant={memoryFilter === 'good' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMemoryFilter('good')}
                  className="text-xs"
                >
                  Good ({keywords.filter(k => !k.isExhausted).length})
                </Button>
              </div>

              {/* Keywords Table */}
              {memoryLoading ? (
                <Card className="p-12">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading keyword memory...</p>
                  </div>
                </Card>
              ) : filteredKeywords.length === 0 ? (
                <Card className="p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Brain className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-base font-medium mb-1">No keyword memory yet</p>
                    <p className="text-sm text-muted-foreground">
                      {memoryFilter === 'all' 
                        ? 'Start running agents to build learning history'
                        : `No ${memoryFilter} keywords found`}
                    </p>
                  </div>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Keyword + Position
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Source
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Attempts
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Duplicates
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Rate
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredKeywords.map((keyword) => {
                          const sourceBadge = getSourceBadge(keyword.keywordSource)
                          return (
                            <tr key={keyword.searchCombo} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium">{keyword.keyword}</div>
                                <div className="text-xs text-muted-foreground">{keyword.position}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={`text-xs font-medium border ${sourceBadge.color}`}>
                                  {sourceBadge.text}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {keyword.totalAttempts}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {keyword.totalDuplicates}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">
                                    {keyword.cumulativeDuplicateRate.toFixed(1)}%
                                  </div>
                                  <div className="w-24 bg-muted rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        keyword.cumulativeDuplicateRate > 70
                                          ? 'bg-red-600'
                                          : keyword.cumulativeDuplicateRate > 50
                                          ? 'bg-orange-500'
                                          : keyword.cumulativeDuplicateRate > 30
                                          ? 'bg-yellow-500'
                                          : 'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(keyword.cumulativeDuplicateRate, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {keyword.isExhausted ? (
                                  <Badge variant="destructive" className="text-xs">
                                    ⚠️ Exhausted
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                    ✓ Good
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetKeyword(keyword.searchCombo)}
                                  disabled={resettingKeyword === keyword.searchCombo}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title="Reset this keyword"
                                >
                                  {resettingKeyword === keyword.searchCombo ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
              {/* Industry Intelligence RAG */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Industry Intelligence</h3>
                    <Badge variant="outline" className="text-xs">{industryFactsTotal} facts</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchIndustryFacts}
                    disabled={industryFactsLoading}
                    className="gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${industryFactsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Stats and facts learned from industry research. Reused across leads in the same industry to back up email claims. Refreshes automatically after 2 weeks.
                </p>

                {industryFactsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : Object.keys(industryFactsGrouped).length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No industry facts yet — run the agent on a few leads to build the database.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(industryFactsGrouped).map(([industry, facts]) => (
                      <div key={industry} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                          onClick={() => setExpandedIndustry(expandedIndustry === industry ? null : industry)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">{industry}</span>
                            <Badge variant="outline" className="text-xs">{facts.length} facts</Badge>
                            <Badge variant="outline" className={`text-xs ${
                              facts.some(f => f.fresh) ? 'text-green-500 border-green-500/30' : 'text-orange-500 border-orange-500/30'
                            }`}>
                              {facts.some(f => f.fresh) ? 'Fresh' : 'Stale'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); deleteIndustry(industry) }}
                              disabled={deletingIndustry === industry}
                              className="h-7 px-2 text-destructive hover:text-destructive text-xs"
                            >
                              {deletingIndustry === industry ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                        {expandedIndustry === industry && (
                          <div className="divide-y divide-border">
                            {facts.map(fact => (
                              <div key={fact.id} className="flex items-start justify-between px-4 py-3 gap-3 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm">{fact.fact}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {fact.age === 0 ? 'today' : `${fact.age}d ago`}
                                    {fact.source && <> · <a href={fact.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 opacity-60 hover:opacity-100 truncate max-w-[200px] inline-block align-bottom">{new URL(fact.source).hostname}</a></>}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteIndustryFact(fact.id)}
                                  disabled={deletingFactId === fact.id}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                                >
                                  {deletingFactId === fact.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )
        })()}

        {/* ── Billing ──────────────────────────────────────────────────────── */}
        {tab === "billing" && <BillingTab />}

      </div>
    </div>
  )
}

