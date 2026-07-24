"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChevronRight, Globe, Users, MapPin, Calendar } from "lucide-react"
import api from "@/lib/api"

interface CompanyProfile {
  companyName?: string
  tagline?: string
  industry?: string
  companySize?: string
  employees?: string
  website?: string
  location?: string
  founded?: string
}

export function CompanyProfileCard() {
  const router = useRouter()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.get("/api/company-profile/profile")
      .then(res => setProfile(res.data?.profile ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true))
  }, [])

  const goToProfile = () => router.push("/settings?tab=company-profile")

  const hasProfile = loaded && !!profile?.companyName

  const stats: { icon: typeof Globe; label: string }[] = hasProfile
    ? [
        profile?.industry ? { icon: Building2, label: profile.industry } : null,
        (profile?.employees || profile?.companySize) ? { icon: Users, label: `${profile?.employees || profile?.companySize} employees` } : null,
        profile?.location ? { icon: MapPin, label: profile.location } : null,
        profile?.founded ? { icon: Calendar, label: `Founded ${profile.founded}` } : null,
        profile?.website ? { icon: Globe, label: profile.website.replace(/^https?:\/\//, "") } : null,
      ].filter((s): s is { icon: typeof Globe; label: string } => !!s)
    : []

  return (
    <div
      onClick={goToProfile}
      className="mt-4 rounded-2xl border border-border bg-card p-3 cursor-pointer hover:bg-accent/40 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.75} />
          <h3 className="font-display text-sm text-foreground">Company Profile</h3>
        </div>
        <span className="flex items-center gap-0.5 text-[11px] font-medium text-foreground/80">
          {hasProfile ? "Edit" : "Set up"}
          <ChevronRight className="h-3 w-3" />
        </span>
      </div>

      {!loaded ? (
        <div className="mt-1.5 py-3 animate-pulse text-[11px] text-muted-foreground">Loading…</div>
      ) : !hasProfile ? (
        <div className="mt-1.5 flex flex-col items-center justify-center py-3 gap-1.5 text-muted-foreground">
          <Building2 className="w-5 h-5 text-muted-foreground/40" />
          <p className="text-[11px]">No company profile yet</p>
          <span className="text-[11px] text-primary hover:underline">Add company details →</span>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{profile?.companyName}</p>
            {profile?.tagline && (
              <p className="truncate text-[10px] text-muted-foreground">{profile.tagline}</p>
            )}
          </div>
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {stats.map(({ icon: Icon, label }, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/90 max-w-full">
                  <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
