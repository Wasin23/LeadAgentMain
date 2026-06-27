"use client"

import { ArrowUpRight, TrendingUp, GripVertical, X, Settings2, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
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
  bgColor: string
  textColor: string
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
      <Card
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`${stat.bgColor} ${stat.textColor} p-4 transition-all duration-300 shadow-lg ${
          editMode ? "pt-8 select-none" : "cursor-pointer p-0"
        } ${hovered && !editMode ? "scale-105 shadow-2xl" : ""}`}
      >
        {editMode ? (
          <CardInner stat={stat} hovered={hovered} editMode={editMode} />
        ) : (
          <Link href={stat.href} className="block p-4">
            <CardInner stat={stat} hovered={hovered} editMode={editMode} />
          </Link>
        )}
      </Card>
    </div>
  )
}

function CardInner({ stat, hovered, editMode }: { stat: StatDef; hovered: boolean; editMode: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
        {!editMode && (
          <div
            className={`w-6 h-6 rounded-full ${
              stat.bgColor === "bg-primary" ? "bg-primary-foreground/20" : "bg-primary"
            } flex items-center justify-center transition-transform duration-300 ${hovered ? "rotate-45" : ""}`}
          >
            <ArrowUpRight className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold mb-2">{stat.value}</p>
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        {stat.increase && <><TrendingUp className="w-3 h-3" /><span>{stat.increase}</span></>}
        {stat.subtitle && <span>{stat.subtitle}</span>}
      </div>
    </>
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
    sent:            { title: "Total Emails Sent",   value: sent.toLocaleString(),           increase: "All time",          bgColor: "bg-primary", textColor: "text-primary-foreground" },
    queued:          { title: "Total Emails Queued", value: queued.toLocaleString(),          increase: "Ready to send",     bgColor: "bg-card",    textColor: "text-foreground" },
    agents:          { title: "Running Agents",      value: runningAgents.toLocaleString(),   increase: "Active right now",  bgColor: "bg-card",    textColor: "text-foreground" },
    cycles:          { title: "Cycles Completed",    value: cyclesCompleted.toLocaleString(), subtitle: "Past 24 hours",     bgColor: "bg-card",    textColor: "text-foreground" },
    replies:         { title: "Total Replies",       value: replies.toLocaleString(),         increase: "All time",          bgColor: "bg-card",    textColor: "text-foreground" },
    "reply-rate":    { title: "Reply Rate",          value: replyRate,                        subtitle: "Replies / sent",    bgColor: "bg-card",    textColor: "text-foreground" },
    "total-agents":  { title: "Total Agents",        value: totalAgents.toLocaleString(),     increase: "Created",           bgColor: "bg-card",    textColor: "text-foreground" },
    followups:       { title: "Pending Follow-ups",  value: followUpCount.toLocaleString(),   increase: "Awaiting send",     bgColor: "bg-card",    textColor: "text-foreground" },
    scheduled:       { title: "Scheduled Emails",    value: scheduledCount.toLocaleString(),  increase: "In queue",          bgColor: "bg-card",    textColor: "text-foreground" },
    bounced:         { title: "Bounced Emails",      value: bouncedCount.toLocaleString(),    subtitle: "Delivery failures", bgColor: "bg-card",    textColor: "text-foreground" },
    "bounce-rate":   { title: "Bounce Rate",         value: bounceRate,                       subtitle: "Bounced / total",   bgColor: "bg-card",    textColor: "text-foreground" },
    "open-rate":     { title: "Open Rate",           value: openRate,                         subtitle: "Opens / total",     bgColor: "bg-card",    textColor: "text-foreground" },
    credits:         { title: "Credit Balance",      value: creditBalance !== null ? creditBalance.toLocaleString() : "—", subtitle: "Remaining", bgColor: "bg-card",    textColor: "text-foreground" },
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
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
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
          <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
              className="text-xs px-2.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
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
