"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Cookies from "js-cookie"
import api from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Users, Crown, Copy, Check, RefreshCw, LogOut, Trash2, Plus, Link2 } from "lucide-react"

interface TeamMember {
  userId: string
  username: string
  email: string
  role: "owner" | "admin" | "member"
  joinedAt: string
}

interface Team {
  teamId: string
  name: string
  ownerId: string
  inviteToken: string
  members: TeamMember[]
  createdAt: string
}

export function TeamContent() {
  const searchParams = useSearchParams()
  const joinToken = searchParams.get("join")

  const { user: authUser } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  // Computed — never stale regardless of when authUser loads
  const isOwner = !!(team && authUser?.userId && team.ownerId === authUser.userId)

  // Create team form
  const [teamName, setTeamName] = useState("")
  const [creating, setCreating] = useState(false)

  // Join team form
  const [joinCode, setJoinCode] = useState(joinToken || "")
  const [joining, setJoining] = useState(false)
  const [joinPreview, setJoinPreview] = useState<{ name: string; memberCount: number } | null>(null)

  // Invite link state
  const [copied, setCopied] = useState(false)
  const [refreshingLink, setRefreshingLink] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const teamRes = await api.get("/api/teams/me").catch(() => null)
      const t = teamRes?.data?.team || null
      setTeam(t)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Pre-fetch invite info when token is in URL or user types one
  useEffect(() => {
    if (!joinCode || joinCode.length < 10) { setJoinPreview(null); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/api/teams/invite/${joinCode}`)
        setJoinPreview(r.data?.team || null)
      } catch {
        setJoinPreview(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [joinCode])

  const flash = (msg: string, type: "success" | "error" = "success") => {
    if (type === "success") { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    else { setError(msg); setTimeout(() => setError(null), 5000) }
  }

  function storeToken(token: string) {
    localStorage.setItem("authToken", token)
    Cookies.set("authToken", token, { expires: 7 })
  }

  async function handleCreate() {
    if (!teamName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const r = await api.post("/api/teams/create", { name: teamName.trim() })
      if (r.data.token) storeToken(r.data.token)
      setTeam(r.data.team)
      flash("Team created!")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create team."
      flash(msg, "error")
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    setJoining(true)
    setError(null)
    try {
      const r = await api.post(`/api/teams/invite/${joinCode.trim()}/accept`)
      if (r.data.token) storeToken(r.data.token)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to join team."
      flash(msg, "error")
    } finally {
      setJoining(false)
    }
  }

  async function handleCopyInvite() {
    if (!team) return
    const link = `${window.location.origin}/team?join=${team.inviteToken}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRefreshLink() {
    setRefreshingLink(true)
    try {
      const r = await api.post("/api/teams/invite/refresh")
      setTeam(prev => prev ? { ...prev, inviteToken: r.data.inviteToken } : prev)
      flash("Invite link refreshed.")
    } catch {
      flash("Failed to refresh link.", "error")
    } finally {
      setRefreshingLink(false)
    }
  }

  async function handleRoleChange(memberId: string, role: string) {
    try {
      await api.patch(`/api/teams/members/${memberId}/role`, { role })
      setTeam(prev => prev ? {
        ...prev,
        members: prev.members.map(m => m.userId === memberId ? { ...m, role: role as TeamMember["role"] } : m),
      } : prev)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update role."
      flash(msg, "error")
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await api.delete(`/api/teams/members/${memberId}`)
      setTeam(prev => prev ? { ...prev, members: prev.members.filter(m => m.userId !== memberId) } : prev)
      flash("Member removed.")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to remove member."
      flash(msg, "error")
    }
  }

  async function handleLeave() {
    try {
      const r = await api.post("/api/teams/leave")
      if (r.data.token) storeToken(r.data.token)
      setTeam(null)
      flash("You have left the team.")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to leave team."
      flash(msg, "error")
    }
  }

  async function handleDisband() {
    try {
      await api.delete("/api/teams")
      setTeam(null)
      flash("Team disbanded.")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to disband team."
      flash(msg, "error")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  const roleColor = (role: string) => {
    if (role === "owner") return "default"
    if (role === "admin") return "secondary"
    return "outline"
  }

  return (
    <div className="space-y-4 max-w-2xl animate-fade-in">
      {error && (
        <div className="px-4 py-2 text-sm bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-2 text-sm bg-primary/10 text-primary border border-primary/20">
          {success}
        </div>
      )}

      {!team ? (
        /* ── No team yet ─────────────────────────────── */
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Create a team</h2>
                <p className="text-xs text-muted-foreground">Invite colleagues to share this Meridian seat.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Team name"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                className="flex-1"
              />
              <Button onClick={handleCreate} disabled={creating || !teamName.trim()}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Link2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Join an existing team</h2>
                <p className="text-xs text-muted-foreground">
                  Team members share the owner&apos;s agents, contacts, and credits.
                </p>
              </div>
            </div>

            {joinPreview && (
              <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/20 text-xs text-foreground">
                <span className="font-medium">{joinPreview.name}</span>
                <span className="text-muted-foreground ml-2">· {joinPreview.memberCount} member{joinPreview.memberCount !== 1 ? "s" : ""}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Paste invite code or link"
                value={joinCode}
                onChange={e => {
                  // extract token from full URL if pasted
                  const val = e.target.value
                  const match = val.match(/[?&]join=([^&]+)/)
                  setJoinCode(match ? match[1] : val)
                }}
              />
              <Button onClick={handleJoin} disabled={joining || !joinCode.trim()} variant="outline">
                {joining ? "Joining…" : "Join"}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        /* ── Has team ────────────────────────────────── */
        <div className="space-y-4">
          {/* Team header */}
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">{team.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {team.members.length} member{team.members.length !== 1 ? "s" : ""} · created {new Date(team.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {isOwner ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Disband
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disband team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        All members will lose access. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisband} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Disband
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <LogOut className="w-3.5 h-3.5 mr-1.5" /> Leave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will lose access to shared data. You can rejoin with an invite link.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeave}>Leave</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Invite link — owner only */}
            {isOwner && (
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Invite link</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/team?join=${team.inviteToken}`}
                    className="flex-1 text-xs font-mono bg-muted/40"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyInvite}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRefreshLink} disabled={refreshingLink} title="Invalidate old link and generate a new one">
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingLink ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Anyone with this link can join your team. Refresh to revoke.</p>
              </div>
            )}
          </Card>

          {/* Members list */}
          <Card className="divide-y divide-border overflow-hidden">
            {team.members.map(member => {
              const isMe = member.userId === authUser?.userId
              return (
                <div key={member.userId} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      {member.username?.slice(0, 2) || "??"}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.username}
                      {isMe && <span className="text-xs text-muted-foreground ml-1.5">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>

                  {member.role === "owner" ? (
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-primary" />
                      <Badge variant={roleColor(member.role)} className="text-[11px]">Owner</Badge>
                    </div>
                  ) : isOwner ? (
                    <div className="flex items-center gap-2">
                      <Select value={member.role} onValueChange={val => handleRoleChange(member.userId, val)}>
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {member.username}?</AlertDialogTitle>
                            <AlertDialogDescription>They will lose access to the team immediately.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveMember(member.userId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <Badge variant={roleColor(member.role)} className="text-[11px]">{member.role}</Badge>
                  )}
                </div>
              )
            })}
          </Card>

          {/* Proxy note */}
          <p className="text-xs text-muted-foreground px-1">
            Team members operate under the owner&apos;s seat — sharing the same agents, contacts, and credits.
          </p>
        </div>
      )}
    </div>
  )
}
