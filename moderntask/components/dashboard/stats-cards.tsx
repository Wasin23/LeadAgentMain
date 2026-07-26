"use client"

import { ChevronRight, GripVertical, X, Settings2, RotateCcw, Clock, Send, MessageSquare, BarChart3, Bot, RefreshCw, Repeat, CalendarClock, MailWarning, PieChart, Percent, Coins, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  horizontalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type Tone = "amber" | "sage" | "moss" | "lilac"

const toneStyles: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-700",
  sage:  "bg-emerald-100/70 text-emerald-700",
  moss:  "bg-emerald-100/70 text-emerald-700",
  lilac: "bg-violet-100 text-violet-600",
}
const dotStyles: Record<Tone, string> = {
  amber: "bg-amber-500",
  sage:  "bg-emerald-500",
  moss:  "bg-emerald-500",
  lilac: "bg-violet-500",
}

type StatId = "sent" | "queued" | "agents" | "cycles" | "replies" | "reply-rate" | "total-agents" | "followups" | "scheduled" | "bounced" | "bounce-rate" | "open-rate" | "credits"

const DEFAULT_ORDER: StatId[] = ["queued", "sent", "replies", "reply-rate"]
const ALL_STAT_IDS: StatId[] = ["sent", "queued", "agents", "cycles", "replies", "reply-rate", "total-agents", "followups", "scheduled", "bounced", "bounce-rate", "open-rate", "credits"]

const STAT_HREFS: Record<StatId, string> = {
  sent:           "/outreach?section=sent",
  queued:         "/outreach?section=awaiting",
  agents:         "/prospecting",
  cycles:         "/prospecting",
  replies:        "/outreach?section=sent",
  "reply-rate":   "/outreach?section=sent",
  "total-agents": "/prospecting",
  followups:      "/outreach?section=sent",
  scheduled:      "/outreach?section=awaiting",
  bounced:        "/outreach?section=sent",
  "bounce-rate":  "/outreach?section=sent",
  "open-rate":    "/outreach?section=sent",
  credits:        "/settings?tab=billing",
}

interface StatDef {
  title: string
  value: string
  increase?: string
  subtitle?: string
  icon: LucideIcon
  tone: Tone
  href: string
}

interface StatsCardsProps {
  sent?: number
  queued?: number
  runningAgents?: number
  cyclesCompleted?: number
  replies?: number
  totalAgents?: number
  followUpCount?: number
  scheduledCount?: number
  bouncedCount?: number
  openedCount?: number
  creditBalance?: number | null
}

function SortableCard({
  id, stat, editMode, onRemove,
}: {
  id: StatId
  stat: StatDef
  editMode: boolean
  onRemove: (id: StatId) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [hovered, setHovered] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/card">
      {editMode && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-10 p-1 rounded opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemove(id)}
            className="absolute top-2 right-2 z-10 p-1 rounded opacity-50 hover:opacity-100 text-destructive"
            aria-label="Remove card"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {editMode ? (
        <div className="pt-6 select-none">
          <CardInner stat={stat} />
        </div>
      ) : (
        <Link
          href={stat.href}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="press-effect group block rounded-2xl border border-border bg-card p-3 transition-colors hover:border-foreground/15"
        >
          <CardInner stat={stat} hovered={hovered} />
        </Link>
      )}
    </div>
  )
}

function CardInner({ stat, hovered }: { stat: StatDef; hovered?: boolean }) {
  const Icon = stat.icon
  return (
    <div className="flex items-center gap-3">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneStyles[stat.tone]}`}>
        <Icon className="h-[14px] w-[14px]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm leading-tight text-foreground truncate">{stat.title}</p>
        <p className="font-mono text-lg leading-tight tracking-tight text-foreground">{stat.value}</p>
      </div>
      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform ${hovered ? "translate-x-0.5" : ""}`} />
    </div>
  )
}

export function StatsCards({ sent = 0, queued = 0, runningAgents = 0, cyclesCompleted = 0, replies = 0, totalAgents = 0, followUpCount = 0, scheduledCount = 0, bouncedCount = 0, openedCount = 0, creditBalance = null, editMode = false, onEditModeChange }: StatsCardsProps & { editMode?: boolean; onEditModeChange?: (v: boolean) => void }) {
  const EXTRA_IDS: StatId[] = ["replies", "reply-rate", "total-agents", "followups", "scheduled", "bounced", "bounce-rate", "open-rate", "credits"]

  const [order, setOrder] = useState<StatId[]>(DEFAULT_ORDER)
  const [hidden, setHidden] = useState<Set<StatId>>(new Set(EXTRA_IDS))
  const [internalEditMode, setInternalEditMode] = useState(false)
  const isEditing = onEditModeChange ? editMode : internalEditMode
  const setIsEditing = onEditModeChange ? onEditModeChange : setInternalEditMode

  useEffect(() => {
    try {
      const savedOrder  = localStorage.getItem("home-stats-order")
      const savedHidden = localStorage.getItem("home-stats-hidden")
      if (savedOrder)  setOrder(JSON.parse(savedOrder))
      if (savedHidden) setHidden(new Set(JSON.parse(savedHidden) as StatId[]))
      else             setHidden(new Set(EXTRA_IDS))
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const replyRate  = sent > 0 ? ((replies / sent) * 100).toFixed(1) + "%" : "0%"
  const bounceRate = sent + bouncedCount > 0 ? ((bouncedCount / (sent + bouncedCount)) * 100).toFixed(1) + "%" : "0%"
  const openRate   = sent + bouncedCount > 0 ? ((openedCount  / (sent + bouncedCount)) * 100).toFixed(1) + "%" : "0%"

  const allStatsBase: Record<StatId, Omit<StatDef, "href">> = {
    queued:          { title: "Emails Queued",       value: queued.toLocaleString(),          increase: "Ready to send",     icon: Clock,        tone: "amber" },
    sent:            { title: "Emails Sent",         value: sent.toLocaleString(),            increase: "All time",          icon: Send,         tone: "sage"  },
    replies:         { title: "Replies Received",    value: replies.toLocaleString(),         increase: "All time",          icon: MessageSquare, tone: "moss" },
    "reply-rate":    { title: "Reply Rate",          value: replyRate,                        subtitle: "Replies vs. sent",  icon: BarChart3,    tone: "lilac" },
    agents:          { title: "Running Agents",      value: runningAgents.toLocaleString(),   increase: "Active right now",  icon: Bot,          tone: "amber" },
    cycles:          { title: "Cycles Completed",    value: cyclesCompleted.toLocaleString(), increase: "All time",          icon: RefreshCw,    tone: "sage" },
    "total-agents":  { title: "Total Agents",        value: totalAgents.toLocaleString(),     increase: "Created",           icon: Bot,          tone: "lilac" },
    followups:       { title: "Pending Follow-ups",  value: followUpCount.toLocaleString(),   increase: "Awaiting send",     icon: Repeat,       tone: "amber" },
    scheduled:       { title: "Scheduled Emails",    value: scheduledCount.toLocaleString(),  increase: "In queue",          icon: CalendarClock, tone: "sage" },
    bounced:         { title: "Bounced Emails",      value: bouncedCount.toLocaleString(),    subtitle: "Delivery failures", icon: MailWarning,  tone: "lilac" },
    "bounce-rate":   { title: "Bounce Rate",         value: bounceRate,                       subtitle: "Bounced / total",   icon: PieChart,     tone: "amber" },
    "open-rate":     { title: "Open Rate",           value: openRate,                         subtitle: "Opens / total",     icon: Percent,      tone: "sage" },
    credits:         { title: "Credit Balance",      value: creditBalance !== null ? creditBalance.toLocaleString() : "-", subtitle: "Remaining", icon: Coins, tone: "lilac" },
  }
  const allStats: Record<StatId, StatDef> = Object.fromEntries(
    (Object.entries(allStatsBase) as [StatId, Omit<StatDef, "href">][]).map(
      ([id, def]) => [id, { ...def, href: STAT_HREFS[id] }]
    )
  ) as Record<StatId, StatDef>

  const visibleOrder = order.filter(id => !hidden.has(id))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newOrder = arrayMove(order, order.indexOf(active.id as StatId), order.indexOf(over.id as StatId))
    setOrder(newOrder)
    localStorage.setItem("home-stats-order", JSON.stringify(newOrder))
  }

  function removeCard(id: StatId) {
    const newHidden = new Set(hidden)
    newHidden.add(id)
    setHidden(newHidden)
    localStorage.setItem("home-stats-hidden", JSON.stringify([...newHidden]))
  }

  function addCard(id: StatId) {
    const newHidden = new Set(hidden)
    newHidden.delete(id)
    setHidden(newHidden)
    localStorage.setItem("home-stats-hidden", JSON.stringify([...newHidden]))
    if (!order.includes(id)) {
      const newOrder = [...order, id]
      setOrder(newOrder)
      localStorage.setItem("home-stats-order", JSON.stringify(newOrder))
    }
  }

  function reset() {
    setOrder(DEFAULT_ORDER)
    setHidden(new Set(ALL_STAT_IDS.filter(id => !DEFAULT_ORDER.includes(id))))
    localStorage.removeItem("home-stats-order")
    localStorage.setItem("home-stats-hidden", JSON.stringify(ALL_STAT_IDS.filter(id => !DEFAULT_ORDER.includes(id))))
  }

  const colClass =
    visibleOrder.length >= 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" :
    visibleOrder.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
    visibleOrder.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"

  const addable = ALL_STAT_IDS.filter(id => hidden.has(id))

  return (
    <div>
      {!onEditModeChange && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`press-effect flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
              isEditing ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Settings2 className="w-3 h-3" />
            {isEditing ? "Done" : "Customize"}
          </button>
        </div>
      )}
      {isEditing && (
        <div className="flex items-center justify-end mb-1">
          <button onClick={reset} className="press-effect flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3 h-3" /> Reset stat cards
          </button>
        </div>
      )}

      {isEditing && addable.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground">Add:</span>
          {addable.map(id => (
            <button
              key={id}
              onClick={() => addCard(id)}
              className="press-effect text-xs px-2.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              + {allStats[id].title}
            </button>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrder} strategy={horizontalListSortingStrategy}>
          <div className={`grid gap-3 ${colClass}`}>
            {visibleOrder.map(id => (
              <SortableCard
                key={id}
                id={id}
                stat={allStats[id]}
                editMode={isEditing}
                onRemove={removeCard}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
