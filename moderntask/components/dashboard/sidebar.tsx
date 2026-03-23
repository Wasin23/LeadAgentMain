"use client"

import { LayoutDashboard, CheckSquare, BarChart3, Settings, HelpCircle, LogOut, Mail, Bot, UserCheck, Circle, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import api from "@/lib/api"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: string
  children?: NavItem[]
}

const staticItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home",                 href: "/home" },
  { icon: CheckSquare,     label: "Operations",           href: "/operations" },
  { icon: Mail,            label: "Outreach Email Queue", href: "/email-queue" },
  { icon: Bot,             label: "Agents",               href: "/agents" },
  { icon: BarChart3,       label: "Analytics",            href: "/analytics" },
  {
    icon: UserCheck,
    label: "Contacted",
    href: "/outreach",
    children: [
      { icon: Circle, label: "Replies",    href: "/outreach?tab=replies" },
      { icon: Circle, label: "Follow-ups", href: "/outreach?tab=followups" },
      { icon: Circle, label: "Templates",  href: "/outreach?tab=templates" },
    ],
  },
  { icon: Building2,       label: "CRM",                  href: "/crm" },
]

const generalItems: NavItem[] = [
  {
    icon: Settings,
    label: "Settings",
    href: "/settings",
    children: [
      { icon: Circle, label: "Profile",         href: "/settings?tab=profile" },
      { icon: Circle, label: "Appearance",      href: "/settings?tab=appearance" },
      { icon: Circle, label: "Notifications",   href: "/settings?tab=notifications" },
      { icon: Circle, label: "Company Profile", href: "/settings?tab=company-profile" },
      { icon: Circle, label: "Email",           href: "/settings?tab=email" },
      { icon: Circle, label: "CRM Connection",   href: "/settings?tab=crm" },
      { icon: Circle, label: "Memory",          href: "/settings?tab=memory" },
      { icon: Circle, label: "Presets",         href: "/settings?tab=presets" },
      { icon: Circle, label: "Billing",         href: "/settings?tab=billing" },
    ],
  },
  { icon: HelpCircle, label: "Help",     href: "/help" },
  { icon: LogOut,     label: "Logout",   href: "/logout" },
]

function SidebarInner() {
  const [hoveredItem, setHoveredItem]   = useState<string | null>(null)
  const [agentItems, setAgentItems]     = useState<NavItem[]>([])
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const search      = searchParams.toString() ? `?${searchParams.toString()}` : ""

  useEffect(() => {
    api.get("/api/auth/agents").then(r => {
      const agents: Array<{ agentId: string; name: string }> = r.data?.agents ?? []
      setAgentItems(agents.map(a => ({
        icon: Circle,
        label: a.name,
        href: `/agents?agent=${a.agentId}`,
      })))
    }).catch(() => {})
  }, [])

  // Inject dynamic agent children
  const menuItems: NavItem[] = staticItems.map(item =>
    item.href === "/agents"
      ? { ...item, children: agentItems }
      : item
  )

  // Contacted sub-tab hrefs use ?tab= so isActive check needs to handle search params

  return (
    <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen overflow-y-auto lg:block">
      <div className="flex items-center gap-2 mb-6 group cursor-pointer">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 shrink-0 transition-transform group-hover:scale-110 duration-300">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="24" cy="24" rx="6"  ry="20" stroke="currentColor" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="8"  stroke="currentColor" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="4" y1="24" x2="44" y2="24"    stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-foreground">Meridian</span>
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Menu</p>
          <nav className="space-y-0.5">
            {menuItems.map(item => <NavEntry key={item.href} item={item} pathname={pathname} search={search} hovered={hoveredItem} setHovered={setHoveredItem} />)}
          </nav>
        </div>

        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">General</p>
          <nav className="space-y-0.5">
            {generalItems.map(item => <NavEntry key={item.href} item={item} pathname={pathname} search={search} hovered={hoveredItem} setHovered={setHoveredItem} />)}
          </nav>
        </div>
      </div>
    </aside>
  )
}

export function Sidebar() {
  return (
    <Suspense fallback={
      <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen lg:block" />
    }>
      <SidebarInner />
    </Suspense>
  )
}

function NavEntry({ item, pathname, search = "", hovered, setHovered, depth = 0 }: {
  item: NavItem
  pathname: string
  search?: string
  hovered: string | null
  setHovered: (v: string | null) => void
  depth?: number
}) {
  const fullPath    = pathname + search
  const isActive    = fullPath === item.href
                   || (item.href === "/" && pathname === "/" && !search)
                   || (!item.href.includes("?") && !search && pathname === item.href)
  const childActive = item.children?.some(c => fullPath === c.href) ?? false
  // Always expand if on the same base path, even without a tab param
  const basePath    = item.href.split("?")[0]
  const onBasePath  = pathname === basePath
  const showChildren = ((isActive || childActive || onBasePath) && (item.children?.length ?? 0) > 0)

  return (
    <div>
      <Link
        href={item.href}
        onMouseEnter={() => setHovered(item.href)}
        onMouseLeave={() => setHovered(null)}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
          depth > 0 && "text-xs py-1.5",
          isActive
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            : childActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          hovered === item.href && !isActive && !childActive && "translate-x-1",
        )}
      >
        {depth > 0
          ? <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0 ml-0.5" />
          : <item.icon className="w-4 h-4 shrink-0" />
        }
        <span className="truncate">{item.label}</span>
        {item.badge && (
          <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full animate-pulse">
            {item.badge}
          </span>
        )}
      </Link>

      {showChildren && (
        <div className="ml-3 mt-0.5 pl-3.5 border-l border-border space-y-0.5">
          {item.children!.map(child => (
            <NavEntry key={child.href} item={child} pathname={pathname} search={search} hovered={hovered} setHovered={setHovered} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
