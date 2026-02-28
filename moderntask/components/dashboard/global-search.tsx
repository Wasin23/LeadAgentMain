"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  Users,
  Mail,
  Bot,
  Settings,
  HelpCircle,
  Search,
  Zap,
  CalendarClock,
  Play,
  Plus,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SearchAgent {
  agentId: string
  name: string
  status: string
  personalityType?: string
}

export interface SearchEmail {
  id: string
  to: string
  subject: string
  status: "queued" | "sent" | "replied"
  agentName?: string
}

export interface SearchLead {
  id: string
  name: string
  company?: string
  email: string
  agentName?: string
}

export interface GlobalSearchProps {
  agents?: SearchAgent[]
  emails?: SearchEmail[]
  leads?: SearchLead[]
  onQueryChange?: (q: string) => void
  loading?: boolean
}

// ── Static nav items ───────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Home",        href: "/",            icon: <LayoutDashboard className="w-4 h-4" />, shortcut: "H" },
  { label: "Operations",  href: "/operations",  icon: <CheckSquare className="w-4 h-4" />,     shortcut: "O" },
  { label: "Analytics",   href: "/analytics",   icon: <BarChart3 className="w-4 h-4" />,       shortcut: "A" },
  { label: "Outreach",    href: "/outreach",    icon: <Users className="w-4 h-4" />,           shortcut: null },
  { label: "Email Queue", href: "/email-queue", icon: <Mail className="w-4 h-4" />,            shortcut: "E" },
  { label: "Agents",      href: "/agents",      icon: <Bot className="w-4 h-4" />,             shortcut: null },
  { label: "Settings",    href: "/settings",    icon: <Settings className="w-4 h-4" />,        shortcut: null },
  { label: "Help",        href: "/help",        icon: <HelpCircle className="w-4 h-4" />,      shortcut: null },
]

const QUICK_ACTIONS = [
  { label: "Create Agent",        href: "/agents?create=true", icon: <Plus className="w-4 h-4" /> },
  { label: "Go to Operations",    href: "/operations",          icon: <Play className="w-4 h-4" /> },
  { label: "View Email Queue",    href: "/email-queue",         icon: <Mail className="w-4 h-4" /> },
  { label: "View Upcoming Follow-ups", href: "/outreach",       icon: <CalendarClock className="w-4 h-4" /> },
  { label: "Check Credits",       href: "/settings",            icon: <Zap className="w-4 h-4" /> },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function GlobalSearch({
  agents = [],
  emails = [],
  leads = [],
  onQueryChange,
  loading = false,
}: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const router = useRouter()

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleQueryChange = useCallback(
    (val: string) => {
      setQuery(val)
      onQueryChange?.(val)
    },
    [onQueryChange]
  )

  const go = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  const hasAgents   = agents.length > 0
  const hasEmails   = emails.length > 0
  const hasLeads    = leads.length > 0
  const hasDynamic  = hasAgents || hasEmails || hasLeads
  const showQuick   = query.length === 0

  return (
    <>
      {/* Fake search bar trigger */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center flex-1 max-w-md h-9 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200 gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="w-4 h-4 shrink-0 opacity-50" />
        <span className="flex-1 text-left truncate">Search agents, emails, leads…</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted rounded border border-border">
          ⌘K
        </kbd>
      </button>

      {/* Command palette dialog */}
      <CommandDialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val)
          if (!val) setQuery("")
        }}
        title="Global Search"
        description="Search across agents, emails, and leads"
        showCloseButton={false}
        className="max-w-2xl"
      >
        <CommandInput
          placeholder="Search agents, emails, leads…"
          value={query}
          onValueChange={handleQueryChange}
        />

        <CommandList className="max-h-[420px]">
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
              Searching…
            </div>
          )}

          {!loading && (
            <>
              <CommandEmpty>No results found for "{query}"</CommandEmpty>

              {/* Quick actions — shown when no query */}
              {showQuick && (
                <CommandGroup heading="Quick Actions">
                  {QUICK_ACTIONS.map((a) => (
                    <CommandItem key={a.label} onSelect={() => go(a.href)} className="gap-3">
                      <span className="text-primary">{a.icon}</span>
                      {a.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Navigation */}
              <CommandGroup heading="Navigation">
                {NAV_ITEMS.map((item) => (
                  <CommandItem key={item.href} onSelect={() => go(item.href)} className="gap-3">
                    <span className="text-muted-foreground">{item.icon}</span>
                    {item.label}
                    {item.shortcut && (
                      <CommandShortcut>⌘{item.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              {/* Dynamic: Agents */}
              {hasAgents && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Agents">
                    {agents.map((a) => (
                      <CommandItem
                        key={a.agentId}
                        value={`agent-${a.agentId}-${a.name}`}
                        onSelect={() => go(`/agents`)}
                        className="gap-3"
                      >
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="flex-1">{a.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          a.status === "running"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {a.status}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Dynamic: Emails */}
              {hasEmails && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Emails">
                    {emails.map((e) => (
                      <CommandItem
                        key={e.id}
                        value={`email-${e.id}-${e.subject}-${e.to}`}
                        onSelect={() => go(`/email-queue`)}
                        className="gap-3"
                      >
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="block truncate">{e.subject}</span>
                          <span className="text-xs text-muted-foreground truncate">{e.to}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{e.status}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Dynamic: Leads */}
              {hasLeads && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Leads">
                    {leads.map((l) => (
                      <CommandItem
                        key={l.id}
                        value={`lead-${l.id}-${l.name}-${l.company ?? ""}-${l.email}`}
                        onSelect={() => go(`/outreach`)}
                        className="gap-3"
                      >
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="block truncate">{l.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {l.company ? `${l.company} · ` : ""}{l.email}
                          </span>
                        </div>
                        {l.agentName && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{l.agentName}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>

        {/* Footer hint */}
        <div className="border-t px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            <kbd className="bg-muted border rounded px-1 py-0.5">↑↓</kbd> navigate
            <span className="mx-1.5">·</span>
            <kbd className="bg-muted border rounded px-1 py-0.5">↵</kbd> open
            <span className="mx-1.5">·</span>
            <kbd className="bg-muted border rounded px-1 py-0.5">Esc</kbd> close
          </span>
          {hasDynamic && (
            <span className="opacity-60">{agents.length + emails.length + leads.length} results</span>
          )}
        </div>
      </CommandDialog>
    </>
  )
}
