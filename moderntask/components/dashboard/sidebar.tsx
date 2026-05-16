"use client"

import { LayoutDashboard, CheckSquare, BarChart3, Settings, HelpCircle, LogOut, Mail, Bot, UserCheck, Circle, Building2, GripVertical, Pencil, Check, Users } from "lucide-react"
import { MeridianWordmark } from "@/components/ui/meridian-wordmark"
import { cn } from "@/lib/utils"
import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import api from "@/lib/api"
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers"
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
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
  { icon: Users,      label: "Team",     href: "/team" },
  { icon: HelpCircle, label: "Help",     href: "/help" },
  { icon: LogOut,     label: "Logout",   href: "/logout" },
]

const STATIC_HREFS = staticItems.map(i => i.href)

function SortableNavItem({
  item, pathname, search, hovered, setHovered, editMode,
}: {
  item: NavItem
  pathname: string
  search: string
  hovered: string | null
  setHovered: (v: string | null) => void
  editMode: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center w-full">
      <div
        className={`flex items-center w-full transition-all duration-200 ${
          editMode ? "gap-1.5 pl-1" : "gap-0 pl-0"
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          tabIndex={-1}
          className={`p-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0 transition-all duration-200 ${
            editMode ? "opacity-40 hover:opacity-80" : "opacity-0 w-0 overflow-hidden pointer-events-none"
          }`}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <NavEntry item={item} pathname={pathname} search={search} hovered={hovered} setHovered={setHovered} />
        </div>
      </div>
    </div>
  )
}

function SidebarInner() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [agentItems, setAgentItems]   = useState<NavItem[]>([])
  const [navOrder, setNavOrder]       = useState<string[]>(STATIC_HREFS)
  const [editMode, setEditMode]       = useState(false)
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

    try {
      const saved = localStorage.getItem("sidebar-nav-order")
      if (saved) {
        const parsed: string[] = JSON.parse(saved)
        // Only use saved order if it contains all current hrefs (guards against stale data)
        if (STATIC_HREFS.every(h => parsed.includes(h))) setNavOrder(parsed)
      }
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newOrder = arrayMove(navOrder, navOrder.indexOf(active.id as string), navOrder.indexOf(over.id as string))
    setNavOrder(newOrder)
    localStorage.setItem("sidebar-nav-order", JSON.stringify(newOrder))
  }

  // Build item map with dynamic agent children injected
  const itemByHref: Record<string, NavItem> = {}
  for (const item of staticItems) {
    itemByHref[item.href] = item.href === "/agents" ? { ...item, children: agentItems } : item
  }

  const orderedMenuItems = navOrder
    .filter(h => itemByHref[h])
    .map(h => itemByHref[h])

  return (
    <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen overflow-y-auto lg:block">
      <div className="flex items-center gap-2 mb-6 group cursor-pointer">
        <Link href="/home" className="flex items-center gap-2">
          <Image src="/MeridianM.png" alt="Meridian" width={56} height={37} className="shrink-0" />
          <MeridianWordmark className="h-3 w-auto dark:text-white text-black" />
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Menu</p>
            <button
              onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                editMode
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={editMode ? "Done editing" : "Reorder menu"}
            >
              {editMode ? <Check className="w-2.5 h-2.5" /> : <Pencil className="w-2.5 h-2.5" />}
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
            <SortableContext items={navOrder} strategy={verticalListSortingStrategy}>
              <nav className="space-y-0.5">
                {orderedMenuItems.map(item => (
                  <SortableNavItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    search={search}
                    hovered={hoveredItem}
                    setHovered={setHoveredItem}
                    editMode={editMode}
                  />
                ))}
              </nav>
            </SortableContext>
          </DndContext>
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
