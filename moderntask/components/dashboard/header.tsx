"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, Zap, CheckCircle2, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MobileNav } from "./mobile-nav"
import { GlobalSearch, type GlobalSearchProps } from "./global-search"
import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"

// ── CRM brand colours & initials ──────────────────────────────────────────────
const CRM_BRANDS: Record<string, { bg: string; text: string; initials: string }> = {
  hubspot:    { bg: "#FF7A59", text: "#fff",     initials: "HS" },
  salesforce: { bg: "#00A1E0", text: "#fff",     initials: "SF" },
  pipedrive:  { bg: "#25292E", text: "#fff",     initials: "PD" },
  zoho:       { bg: "#E42527", text: "#fff",     initials: "ZO" },
  close:      { bg: "#4CAF50", text: "#fff",     initials: "CL" },
  copper:     { bg: "#6B4FBB", text: "#fff",     initials: "CU" },
  freshsales: { bg: "#1FCECB", text: "#fff",     initials: "FS" },
}

function crmBrand(name: string | null) {
  if (!name) return null
  const key = name.toLowerCase().replace(/\s+/g, "")
  // try exact key, then partial match
  const found = CRM_BRANDS[key] ?? Object.entries(CRM_BRANDS).find(([k]) => key.includes(k) || k.includes(key))?.[1]
  return found ?? { bg: "#6b7280", text: "#fff", initials: name.slice(0, 2).toUpperCase() }
}

function CrmBadge({ name }: { name: string | null }) {
  const router = useRouter()
  const handleClick = () => router.push("/settings?tab=crm")

  if (!name) {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-muted cursor-pointer transition-colors select-none"
        title="Connect a CRM"
      >
        <Link2Off className="w-3 h-3" />
        <span className="hidden sm:inline">No CRM</span>
      </button>
    )
  }
  const brand = crmBrand(name)!
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted cursor-pointer transition-colors select-none"
      title={`${name} connected — click to manage`}
    >
      <span
        className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center shrink-0 leading-none"
        style={{ background: brand.bg, color: brand.text }}
      >
        {brand.initials}
      </span>
      <span className="hidden sm:inline text-foreground">{name}</span>
      <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
    </button>
  )
}

interface HeaderProps extends GlobalSearchProps {
  title?: string
  description?: string
  actions?: ReactNode
  credits?: number
  notificationCount?: number
  userName?: string
  userEmail?: string
  userPicture?: string
}


export function Header({
  title = "",
  description = "",
  actions,
  credits: creditsProp,
  notificationCount: notifProp,
  userName: userNameProp,
  userEmail: userEmailProp,
  userPicture: userPictureProp,
  agents,
  emails,
  leads,
  onQueryChange,
  loading,
}: HeaderProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [credits, setCredits] = useState<number>(creditsProp ?? 0)
  const [notifCount, setNotifCount] = useState<number>(notifProp ?? 0)
  const [profileName, setProfileName]       = useState<string>("")
  const [profileEmail, setProfileEmail]     = useState<string>("")
  const [profilePicture, setProfilePicture] = useState<string>("")
  const [crmName, setCrmName]               = useState<string | null | undefined>(undefined) // undefined = loading

  // Sync with billing tab credit calculation
  useEffect(() => {
    if (creditsProp !== undefined) return
    const handler = (e: CustomEvent<{ credits: number }>) => setCredits(e.detail.credits)
    window.addEventListener("credits-updated", handler as EventListener)
    return () => window.removeEventListener("credits-updated", handler as EventListener)
  }, [creditsProp])

  // Sync explicit props
  useEffect(() => { if (creditsProp !== undefined) setCredits(creditsProp) }, [creditsProp])
  useEffect(() => { if (notifProp   !== undefined) setNotifCount(notifProp)  }, [notifProp])

  // Self-fetch fresh profile, credits, notif count when not provided by parent
  useEffect(() => {
    // Profile — always fetch so we get the real email (not stale localStorage)
    api.get("/api/auth/profile").then(r => {
      const u = r.data?.user
      if (!u) return
      setProfileName(u.username || u.name || "")
      setProfileEmail(u.email || "")
      setProfilePicture(u.picture || "")
    }).catch(() => {})

    if (creditsProp === undefined) {
      // Aggregate all three credit sources — same logic as billing tab
      ;(async () => {
        let balance = 0
        try {
          const { data } = await api.get("/api/billing/trial-credits")
          if (data.success) balance += Number(data.credits?.creditsRemaining ?? 0)
        } catch {}
        try {
          const { data } = await api.get("/api/plans/status")
          if (data.success) balance += Number(data.plan?.remainingCredits ?? 0)
        } catch {}
        try {
          const { data } = await api.get("/api/billing/credit-balance")
          if (data.success) balance += Number(data.balance ?? 0)
        } catch {}
        setCredits(Math.round(balance))
      })()
    }

    if (notifProp === undefined) {
      api.get("/api/notifications/count").then(r => {
        setNotifCount(r.data?.unreadCount ?? 0)
      }).catch(() => {})
    }

    api.get("/api/crm/status").then(r => {
      setCrmName(r.data?.connected ? (r.data?.integration || "CRM") : null)
    }).catch(() => { setCrmName(null) })
  }, [creditsProp, notifProp])

  // Prop overrides > fresh profile > context fallback
  const userName    = userNameProp    || profileName    || user?.username || ""
  const userEmail   = userEmailProp   || profileEmail   || user?.email    || ""
  const userPicture = userPictureProp || profilePicture || user?.picture  || ""

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="space-y-3 md:space-y-4 animate-slide-in-up relative z-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <MobileNav />

          <GlobalSearch
            agents={agents}
            emails={emails}
            leads={leads}
            onQueryChange={onQueryChange}
            loading={loading}
          />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* CRM connection status */}
          {crmName !== undefined && <CrmBadge name={crmName} />}

          {/* Credit balance */}
          <Button
            variant="ghost"
            size="icon"
            title="AI Credits remaining"
            className="relative hover:bg-secondary transition-all duration-300 hover:scale-110 h-8 w-auto px-2 gap-1 text-xs font-semibold text-foreground"
          >
            <Zap className="w-4 h-4 text-primary flex-shrink-0" />
            <span>{credits.toLocaleString()}</span>
          </Button>

          {/* Notifications bell */}
          <Button
            variant="ghost"
            size="icon"
            title="Notifications"
            onClick={() => router.push('/notifications')}
            className="relative hover:bg-secondary transition-all duration-300 hover:scale-110 h-8 w-8"
          >
            <Bell className="w-4 h-4" />
            {notifCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
            )}
          </Button>

          <div className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border">
            <Link href="/settings" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <Avatar className="w-7 h-7 md:w-8 md:h-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
                {userPicture && <AvatarImage src={userPicture} alt={userName} referrerPolicy="no-referrer" />}
                <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
              </Avatar>
              <div className="text-xs hidden sm:block">
                <p className="font-semibold text-foreground">{userName || "Account"}</p>
                {userEmail && <p className="text-muted-foreground text-[10px]">{userEmail}</p>}
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-1">{title}</h1>
        <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
      </div>

      {actions && <div className="flex flex-col sm:flex-row gap-2">{actions}</div>}
    </header>
  )
}
