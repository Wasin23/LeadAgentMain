"use client"

import { Bell, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MobileNav } from "./mobile-nav"
import { GlobalSearch, type GlobalSearchProps } from "./global-search"
import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"

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
  const [credits, setCredits] = useState<number>(creditsProp ?? 0)
  const [notifCount, setNotifCount] = useState<number>(notifProp ?? 0)
  const [profileName, setProfileName]     = useState<string>("")
  const [profileEmail, setProfileEmail]   = useState<string>("")
  const [profilePicture, setProfilePicture] = useState<string>("")

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
      api.get("/api/billing/credit-balance").then(r => {
        setCredits(r.data?.balance ?? r.data?.credits ?? 0)
      }).catch(() => {})
    }

    if (notifProp === undefined) {
      api.get("/api/notifications/count").then(r => {
        setNotifCount(r.data?.unreadCount ?? 0)
      }).catch(() => {})
    }
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
    <header className="space-y-3 md:space-y-4 animate-slide-in-up">
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
          {/* Credit balance — matches bell style */}
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
            <Avatar className="w-7 h-7 md:w-8 md:h-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
              {userPicture && <AvatarImage src={userPicture} alt={userName} referrerPolicy="no-referrer" />}
              <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="text-xs hidden sm:block">
              <p className="font-semibold text-foreground">{userName || "Account"}</p>
              {userEmail && <p className="text-muted-foreground text-[10px]">{userEmail}</p>}
            </div>
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
