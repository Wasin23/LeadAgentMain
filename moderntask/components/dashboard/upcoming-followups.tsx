"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { CalendarClock, Bot } from "lucide-react"

export interface FollowUpItem {
  id: string
  leadName?: string
  leadEmail?: string
  company?: string
  subject?: string
  followUpDate: string
  agentName?: string
  agentId?: string
}

interface UpcomingFollowUpsProps {
  followUps?: FollowUpItem[]
}

function timeFromNow(dateStr: string): { label: string; overdue: boolean } {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = then - now
  const absDiff = Math.abs(diff)
  const overdue = diff < 0

  const mins = Math.floor(absDiff / 60000)
  const hours = Math.floor(absDiff / 3600000)
  const days = Math.floor(absDiff / 86400000)

  let label: string
  if (days > 0) label = `${days}d`
  else if (hours > 0) label = `${hours}h`
  else if (mins > 0) label = `${mins}m`
  else label = "now"

  return { label: overdue ? `${label} ago` : `in ${label}`, overdue }
}

export function UpcomingFollowUps({ followUps = [] }: UpcomingFollowUpsProps) {
  const router = useRouter()

  return (
    <Card
      className="p-5 transition-all duration-500 hover:shadow-xl animate-slide-in-up"
      style={{ animationDelay: "700ms" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Upcoming Follow-ups</h2>
        </div>
        <button
          onClick={() => router.push("/outreach")}
          className="text-xs text-primary hover:underline transition-colors"
        >
          View all →
        </button>
      </div>

      {followUps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <CalendarClock className="w-7 h-7 text-muted-foreground/30" />
          <p className="text-sm">No follow-ups scheduled</p>
        </div>
      ) : (
        <div className="space-y-2">
          {followUps.slice(0, 6).map((f) => {
            const { label, overdue } = timeFromNow(f.followUpDate)
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary transition-all duration-200 cursor-pointer group"
                onClick={() => router.push("/outreach")}
              >
                {/* Avatar initials */}
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary uppercase">
                  {(f.leadName ?? f.leadEmail ?? "?").slice(0, 2)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {f.leadName ?? f.leadEmail ?? "Unknown lead"}
                    {f.company && (
                      <span className="text-muted-foreground font-normal"> · {f.company}</span>
                    )}
                  </p>
                  {f.subject && (
                    <p className="text-xs text-muted-foreground truncate">{f.subject}</p>
                  )}
                  {f.agentName && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Bot className="w-2.5 h-2.5 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground/70">{f.agentName}</span>
                    </div>
                  )}
                </div>

                {/* Time badge */}
                <span
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                    overdue
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
