"use client"

import { useState, useEffect } from "react"
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, Settings2, Check } from "lucide-react"

import {
  EmailActivityCard, CreditConsumptionCard, DeliveryHealthCard,
  type EmailTimePoint, type MonthlyPoint,
} from "@/components/dashboard/home-charts"
import { Reminders, type ScheduledBatch } from "@/components/dashboard/reminders"
import { TeamCollaboration, type AgentActivityItem } from "@/components/dashboard/team-collaboration"
import { UpcomingFollowUps, type FollowUpItem } from "@/components/dashboard/upcoming-followups"
import { RecentNotifications, type NotificationItem } from "@/components/dashboard/recent-notifications"
import { AnalyticsContent } from "@/components/analytics/analytics-content"

export type HomeSectionId =
  | "scheduled-sends"
  | "follow-ups"
  | "notifications"
  | "performance"

const SECTION_META: Record<HomeSectionId, { label: string; span: 1 | 2 }> = {
  "notifications":      { label: "Recent Notifications", span: 2 },
  "scheduled-sends":    { label: "Scheduled Sends",      span: 1 },
  "follow-ups":         { label: "Upcoming Follow-ups",  span: 1 },
  "performance":        { label: "Performance & Analytics", span: 2 },
}

const DEFAULT_ORDER: HomeSectionId[] = [
  "notifications",
  "scheduled-sends",
  "follow-ups",
  "performance",
]

interface HomeSectionsProps {
  emailTimeSeries?:  EmailTimePoint[]
  monthlyCredits?:   MonthlyPoint[]
  scheduledBatches?: ScheduledBatch[]
  creditBalance?:    number | null
  creditsUsed?:      number | null
  creditsLimit?:     number | null
  agentActivity?:    AgentActivityItem[]
  sent?:             number
  bounced?:          number
  opened?:           number
  followUps?:        FollowUpItem[]
  notifications?:    NotificationItem[]
  editMode?:         boolean
  onEditModeChange?: (v: boolean) => void
}

function SortableSection({
  id, span, editMode, onRemove, children,
}: {
  id: HomeSectionId
  span: 1 | 2
  editMode: boolean
  onRemove: (id: HomeSectionId) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${span === 2 ? "col-span-1 lg:col-span-2" : "col-span-1"}`}
    >
      {editMode && (
        <div className="absolute inset-0 z-10 rounded-xl ring-2 ring-primary/25 pointer-events-none" />
      )}
      {editMode && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-20 p-1.5 rounded-lg bg-background/90 backdrop-blur-sm border border-border opacity-70 hover:opacity-100 cursor-grab active:cursor-grabbing touch-none shadow-sm transition-opacity"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => onRemove(id)}
            className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-background/90 backdrop-blur-sm border border-destructive/40 opacity-70 hover:opacity-100 text-destructive shadow-sm transition-opacity"
            aria-label="Remove section"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <div className={editMode ? "pointer-events-none select-none" : ""}>
        {children}
      </div>
    </div>
  )
}

export function HomeSections({
  emailTimeSeries = [],
  monthlyCredits = [],
  scheduledBatches = [],
  creditBalance = null,
  creditsUsed = null,
  creditsLimit = null,
  agentActivity = [],
  sent = 0,
  bounced = 0,
  opened = 0,
  followUps = [],
  notifications = [],
  editMode: externalEditMode,
  onEditModeChange,
}: HomeSectionsProps) {
  const [order, setOrder]            = useState<HomeSectionId[]>(DEFAULT_ORDER)
  const [hidden, setHidden]          = useState<HomeSectionId[]>([])
  const [internalEditMode, setInternalEditMode] = useState(false)
  const editMode    = onEditModeChange ? (externalEditMode ?? false) : internalEditMode
  const setEditMode = onEditModeChange ? onEditModeChange : setInternalEditMode

  useEffect(() => {
    try {
      const o = localStorage.getItem("home-sections-order")
      const h = localStorage.getItem("home-sections-hidden")
      if (o) setOrder(JSON.parse(o) as HomeSectionId[])
      if (h) setHidden(JSON.parse(h) as HomeSectionId[])
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visible = order.filter(id => !hidden.includes(id))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = order.indexOf(active.id as HomeSectionId)
    const to   = order.indexOf(over.id   as HomeSectionId)
    const next = arrayMove(order, from, to)
    setOrder(next)
    localStorage.setItem("home-sections-order", JSON.stringify(next))
  }

  function removeSection(id: HomeSectionId) {
    const next = [...hidden, id]
    setHidden(next)
    localStorage.setItem("home-sections-hidden", JSON.stringify(next))
  }

  function addSection(id: HomeSectionId) {
    const next = hidden.filter(h => h !== id)
    setHidden(next)
    localStorage.setItem("home-sections-hidden", JSON.stringify(next))
  }

  function renderContent(id: HomeSectionId) {
    switch (id) {
      case "scheduled-sends":    return <Reminders batches={scheduledBatches} />
      case "follow-ups":         return <UpcomingFollowUps followUps={followUps} />
      case "notifications":      return <RecentNotifications notifications={notifications} />
      case "performance":        return <AnalyticsContent />
    }
  }

  const addable = order.filter(id => hidden.includes(id))

  return (
    <div className="space-y-3">
      {/* Hero row — matches reference: chart left, status cards stacked right */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 @5xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0">
          <EmailActivityCard emailTimeSeries={emailTimeSeries} />
        </div>
        <div className="min-w-0 flex flex-col gap-4 md:gap-5">
          <TeamCollaboration agents={agentActivity} />
          <CreditConsumptionCard monthlyCredits={monthlyCredits} creditBalance={creditBalance} creditsUsed={creditsUsed} creditsLimit={creditsLimit} />
          <DeliveryHealthCard sent={sent} bounced={bounced} opened={opened} />
        </div>
      </div>

      {/* Add pills — always shown when editing and sections are hidden */}
      {editMode && addable.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className="text-xs text-muted-foreground">Add section:</span>
          {addable.map(id => (
            <button
              key={id}
              onClick={() => addSection(id)}
              className="text-xs px-2.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              + {SECTION_META[id].label}
            </button>
          ))}
        </div>
      )}

      {/* Stats add pills — shown via StatsCards internally */}

      {/* Edit bar — only shown when not controlled externally */}
      {!onEditModeChange && (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              editMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {editMode
              ? <><Check className="w-3 h-3" /> Done</>
              : <><Settings2 className="w-3 h-3" /> Edit Layout</>
            }
          </button>
        </div>
      )}

      {/* Sortable grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {visible.map(id => (
              <SortableSection
                key={id}
                id={id}
                span={SECTION_META[id].span}
                editMode={editMode}
                onRemove={removeSection}
              >
                {renderContent(id)}
              </SortableSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
